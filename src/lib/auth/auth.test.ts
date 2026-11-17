import { describe, expect, it } from "vitest";
import { destinoSeguro } from "@/lib/auth/base";
import { evaluarIdentidad, huella, MAX_EDAD_AUTENTICACION_S } from "@/lib/auth/direccion";
import { puedeConfirmarRuta } from "@/lib/auth/equipo";
import { validarClaims } from "@/lib/auth/google";

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

  it.each([
    ["otra cuenta de Gmail", { email: "otra@gmail.com" }, {}, "otra_cuenta"],
    ["un correo parecido", { email: "ares@gmail.com.evil.example" }, {}, "otra_cuenta"],
    ["correo sin verificar", { verificada: false }, {}, "no_verificada"],
    ["Google no dice cuándo se autenticó", { authTime: null }, {}, "autenticacion_antigua"],
    ["autenticación de hace más de 10 minutos", { authTime: ahoraS - MAX_EDAD_AUTENTICACION_S - 1 }, {}, "autenticacion_antigua"],
    ["autenticación «del futuro»", { authTime: ahoraS + 600 }, {}, "autenticacion_antigua"],
    ["misma dirección, otra cuenta de Google (sub)", { sub: "google-impostor" }, { subFijado: huella("google-ares") }, "identidad_distinta"],
    ["sin OWNER_EMAIL configurado", {}, { ownerEmail: undefined }, "sin_owner"],
  ])("rechaza: %s", (_motivo, cambio, ctx, motivo) => {
    expect(evaluarIdentidad({ ...owner, ...cambio }, { ...contexto, ...ctx })).toEqual({ ok: false, motivo });
  });

  it("solo la cuenta de la Dirección confirma o corrige una ruta", () => {
    expect(puedeConfirmarRuta("ares@gmail.com", "owner")).toBe(true);
    expect(puedeConfirmarRuta("ares@gmail.com", "operator")).toBe(false);
    expect(puedeConfirmarRuta("ares@gmail.com", "viewer")).toBe(false);
  });
});
