import { beforeAll, describe, expect, it } from "vitest";
import { crearTokenSesion, leerTokenSesion, tieneRol } from "@/lib/security/sesion";
import { hashPassword, verificarPassword } from "@/lib/security/password";

beforeAll(() => {
  process.env.AUTH_SECRET = "a".repeat(48);
});

describe("sesión firmada del centro de mando", () => {
  it("acepta un token recién emitido", () => {
    const token = crearTokenSesion("owner@example.com", "owner");
    expect(leerTokenSesion(token)?.sub).toBe("owner@example.com");
  });

  it("rechaza un token con el rol cambiado a mano", () => {
    const token = crearTokenSesion("viewer@example.com", "viewer");
    const [cuerpo, firma] = token.split(".");
    const manipulado = Buffer.from(JSON.stringify({ ...JSON.parse(Buffer.from(cuerpo, "base64url").toString()), rol: "owner" })).toString("base64url");
    expect(leerTokenSesion(`${manipulado}.${firma}`)).toBeNull();
  });

  it("rechaza un token caducado", () => {
    const token = crearTokenSesion("owner@example.com", "owner", Date.parse("2026-01-01T00:00:00Z"));
    expect(leerTokenSesion(token, Date.parse("2026-01-01T09:00:00Z"))).toBeNull();
  });

  it("un viewer no tiene permisos de operator", () => {
    expect(tieneRol({ sub: "x", rol: "viewer", exp: 0 }, "operator")).toBe(false);
    expect(tieneRol({ sub: "x", rol: "owner", exp: 0 }, "operator")).toBe(true);
  });
});

describe("contraseña", () => {
  it("verifica la correcta y rechaza otra", async () => {
    const hash = await hashPassword("una-frase-larga-de-prueba");
    expect(await verificarPassword("una-frase-larga-de-prueba", hash)).toBe(true);
    expect(await verificarPassword("otra", hash)).toBe(false);
  });
});
