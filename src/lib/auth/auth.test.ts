import { afterEach, describe, expect, it } from "vitest";
import { destinoSeguro } from "@/lib/auth/base";
import { puedeConfirmarRuta, rolDeEquipo } from "@/lib/auth/equipo";
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
    expect(validarClaims(base, esperado)).toEqual({ email: "persona@ejemplo.com", nombre: "Persona", sub: "google-1" });
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

describe("rol de equipo", () => {
  const anterior = { owner: process.env.OWNER_EMAIL, staff: process.env.STAFF_EMAILS };
  afterEach(() => {
    process.env.OWNER_EMAIL = anterior.owner;
    process.env.STAFF_EMAILS = anterior.staff;
  });

  it("owner por OWNER_EMAIL, equipo por STAFF_EMAILS y cliente el resto", () => {
    process.env.OWNER_EMAIL = "Dueno@Ares.es";
    process.env.STAFF_EMAILS = "abogada@ares.es:operator, mirona@ares.es:viewer, raro@ares.es:superadmin";
    expect(rolDeEquipo("dueno@ares.es")).toBe("owner");
    expect(rolDeEquipo(" ABOGADA@ares.es ")).toBe("operator");
    expect(rolDeEquipo("mirona@ares.es")).toBe("viewer");
    expect(rolDeEquipo("raro@ares.es")).toBeNull();
    expect(rolDeEquipo("cliente@gmail.com")).toBeNull();
  });
});

describe("quién confirma una ruta (abre el cobro)", () => {
  const anterior = process.env.ABOGADOS_EMAILS;
  afterEach(() => {
    process.env.ABOGADOS_EMAILS = anterior;
  });

  it("sin lista de abogados, solo el owner", () => {
    delete process.env.ABOGADOS_EMAILS;
    expect(puedeConfirmarRuta("dueno@ares.es", "owner")).toBe(true);
    expect(puedeConfirmarRuta("operadora@ares.es", "operator")).toBe(false);
  });

  it("con lista, solo los abogados de la lista, sea cual sea su rol", () => {
    process.env.ABOGADOS_EMAILS = "Abogada@Ares.es, otro@ares.es";
    expect(puedeConfirmarRuta("abogada@ares.es", "operator")).toBe(true);
    expect(puedeConfirmarRuta("dueno@ares.es", "owner")).toBe(false);
  });
});
