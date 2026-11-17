import { describe, expect, it } from "vitest";
import { destinoSeguro } from "@/lib/auth/base";
import { evaluarIdentidad, huella, MAX_EDAD_AUTENTICACION_S } from "@/lib/auth/direccion";
import { puedeConfirmarRuta } from "@/lib/auth/equipo";
import { CLAIMS_AUTH_TIME, iniciarGoogle, validarClaims } from "@/lib/auth/google";

// huella() es un HMAC con clave derivada de AUTH_SECRET.
process.env.AUTH_SECRET ??= "secreto-de-pruebas-de-al-menos-32-caracteres";

const AHORA = Date.UTC(2026, 10, 9, 12, 0, 0);
const base = {
  iss: "https://accounts.google.com",
  aud: "cliente-burofast",
  exp: AHORA / 1000 + 300,
  nonce: "n-123",
  email: "Persona@Ejemplo.com",
  email_verified: true,
  sub: "google-1",
  name: " Persona ",
};
const esperado = { clientId: "cliente-burofast", nonce: "n-123", ahoraMs: AHORA };

describe("claims del id_token de Google", () => {
  it("acepta un token válido y normaliza el correo", () => {
    expect(validarClaims(base, esperado)).toEqual({ email: "persona@ejemplo.com", nombre: "Persona", sub: "google-1", verificada: true, authTime: null });
    expect(validarClaims({ ...base, auth_time: AHORA / 1000 - 30 }, esperado)?.authTime).toBe(AHORA / 1000 - 30);
  });

  it.each([
    ["emisor ajeno", { iss: "https://evil.example" }],
    ["audiencia de otra app", { aud: "otra-app" }],
    ["caducado", { exp: AHORA / 1000 - 1 }],
    ["nonce distinto (repetición)", { nonce: "otro" }],
    ["correo sin verificar", { email_verified: false }],
    ["sin correo", { email: undefined }],
  ])("rechaza: %s", (_motivo, cambio) => {
    expect(validarClaims({ ...base, ...cambio } as typeof base, esperado)).toBeNull();
  });
});

describe("destino tras el acceso", () => {
  it.each(["/mando", "/es/expediente", "/ar/expediente?x=1"])("deja pasar la ruta interna %s", (destino) => {
    expect(destinoSeguro(destino, "/es/expediente")).toBe(destino);
  });

  it.each(["https://evil.example", "//evil.example", "/\\evil.example", "/\t/evil.example/robar", "/\n/evil.example", "", null])("bloquea %j", (destino) => {
    expect(destinoSeguro(destino, "/es/expediente")).toBe("/es/expediente");
  });
});

describe("destino tras el acceso: cualquier cosa que deje pasar se queda en casa", () => {
  it.each(["/%09/evil.example", "/es/../..//evil.example", "/./%2F%2Fevil.example", "/mando?x=//evil.example"])("%s", (destino) => {
    const resultado = destinoSeguro(destino, "/es/expediente");
    expect(new URL(resultado, "https://burofast.vercel.app").origin).toBe("https://burofast.vercel.app");
  });
});

describe("barrera de la Dirección", () => {
  const ahoraS = AHORA / 1000;
  const owner = { email: "ares@gmail.com", nombre: "ARES", sub: "google-ares", verificada: true, authTime: ahoraS - 60 };
  const contexto = { ownerEmail: " ARES@gmail.com ", subFijado: null, ahoraS };

  it("deja entrar a la cuenta de A.R.E.S. recién autenticada", () => {
    expect(evaluarIdentidad(owner, contexto)).toEqual({ ok: true });
    expect(evaluarIdentidad(owner, { ...contexto, subFijado: huella("google-ares") })).toEqual({ ok: true });
  });

  it("sin auth_time (app sin verificar o «Session age claims» apagado) no bloquea a A.R.E.S.", () => {
    expect(evaluarIdentidad({ ...owner, authTime: null }, contexto)).toEqual({ ok: true });
    // Pero el resto de comprobaciones siguen en pie.
    expect(evaluarIdentidad({ ...owner, authTime: null, email: "otra@gmail.com" }, contexto)).toEqual({ ok: false, motivo: "otra_cuenta" });
  });

  it.each([
    ["otra cuenta de Gmail", { email: "otra@gmail.com" }, {}, "otra_cuenta"],
    ["un correo parecido", { email: "ares@gmail.com.evil.example" }, {}, "otra_cuenta"],
    ["correo sin verificar", { verificada: false }, {}, "no_verificada"],
    ["autenticación de hace más de 10 minutos", { authTime: ahoraS - MAX_EDAD_AUTENTICACION_S - 1 }, {}, "autenticacion_antigua"],
    ["autenticación «del futuro»", { authTime: ahoraS + 600 }, {}, "autenticacion_antigua"],
    ["misma dirección, otra cuenta de Google (sub)", { sub: "google-impostor" }, { subFijado: huella("google-ares") }, "identidad_distinta"],
    ["sin OWNER_EMAIL configurado", {}, { ownerEmail: undefined }, "sin_owner"],
  ])("rechaza: %s", (_motivo, cambio, ctx, motivo) => {
    expect(evaluarIdentidad({ ...owner, ...cambio }, { ...contexto, ...ctx })).toEqual({ ok: false, motivo });
  });

  it("las huellas son HMAC: sin AUTH_SECRET no se pueden recalcular", async () => {
    const { createHash } = await import("node:crypto");
    const ip = "203.0.113.7";
    expect(huella(ip)).toBe(huella(ip));
    expect(huella(ip)).not.toBe(createHash("sha256").update(`burofast:direccion:${ip}`).digest("base64url"));
    expect(huella(ip)).not.toBe(createHash("sha256").update(ip).digest("base64url"));
    const anterior = process.env.AUTH_SECRET;
    process.env.AUTH_SECRET = "z".repeat(40);
    const otra = huella(ip);
    process.env.AUTH_SECRET = anterior;
    expect(otra).not.toBe(huella(ip));
  });

  it("el inicio con Google pide auth_time por «claims» y no usa max_age (Google no lo admite)", () => {
    const previo = { id: process.env.GOOGLE_CLIENT_ID, base: process.env.APP_BASE_URL };
    process.env.GOOGLE_CLIENT_ID = "cliente-burofast";
    process.env.APP_BASE_URL = "https://burofast.vercel.app";
    try {
      const direccion = new URL(iniciarGoogle("/mando", { pedirAuthTime: true }).url);
      expect(JSON.parse(direccion.searchParams.get("claims") ?? "{}")).toEqual({ id_token: { auth_time: { essential: true } } });
      expect(direccion.searchParams.get("claims")).toBe(CLAIMS_AUTH_TIME);
      expect(direccion.searchParams.has("max_age")).toBe(false);
      expect(direccion.searchParams.has("login_hint")).toBe(false); // no se revela OWNER_EMAIL
      const cliente = new URL(iniciarGoogle("/es/expediente").url);
      expect(cliente.searchParams.has("claims")).toBe(false);
    } finally {
      if (previo.id === undefined) delete process.env.GOOGLE_CLIENT_ID;
      else process.env.GOOGLE_CLIENT_ID = previo.id;
      if (previo.base === undefined) delete process.env.APP_BASE_URL;
      else process.env.APP_BASE_URL = previo.base;
    }
  });

  it("solo la cuenta de la Dirección confirma o corrige una ruta", () => {
    expect(puedeConfirmarRuta("ares@gmail.com", "owner")).toBe(true);
    expect(puedeConfirmarRuta("ares@gmail.com", "operator")).toBe(false);
    expect(puedeConfirmarRuta("ares@gmail.com", "viewer")).toBe(false);
  });
});
