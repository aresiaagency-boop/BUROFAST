import { beforeAll, describe, expect, it } from "vitest";
import { crearTokenDireccion, DURACION_SESION_S, leerTokenDireccion, nuevoIdSesion, tieneRol } from "@/lib/security/sesion";

beforeAll(() => {
  process.env.AUTH_SECRET ??= "secreto-de-pruebas-de-al-menos-32-caracteres";
});

describe("cookie de la Dirección", () => {
  it("lleva solo un identificador aleatorio firmado", () => {
    const sid = nuevoIdSesion();
    expect(sid.length).toBeGreaterThanOrEqual(43);
    expect(nuevoIdSesion()).not.toBe(sid);
    expect(leerTokenDireccion(crearTokenDireccion(sid))?.sid).toBe(sid);
  });

  it("rechaza un token manipulado o con la firma de otro", () => {
    const [cuerpo, firma] = crearTokenDireccion(nuevoIdSesion()).split(".");
    const otro = Buffer.from(JSON.stringify({ sid: nuevoIdSesion(), exp: 9_999_999_999 })).toString("base64url");
    expect(leerTokenDireccion(`${otro}.${firma}`)).toBeNull();
    expect(leerTokenDireccion(`${cuerpo}.${firma}.extra`)).toBeNull();
    expect(leerTokenDireccion(`${cuerpo}`)).toBeNull();
    expect(leerTokenDireccion("x".repeat(500))).toBeNull();
  });

  it("caduca a las cuatro horas", () => {
    const inicio = Date.parse("2026-01-01T00:00:00Z");
    const token = crearTokenDireccion(nuevoIdSesion(), inicio);
    expect(leerTokenDireccion(token, inicio + (DURACION_SESION_S - 1) * 1000)).not.toBeNull();
    expect(leerTokenDireccion(token, inicio + DURACION_SESION_S * 1000)).toBeNull();
  });

  it("los roles se ordenan de menos a más", () => {
    expect(tieneRol({ sub: "a", rol: "owner", exp: 0 }, "operator")).toBe(true);
    expect(tieneRol(null, "viewer")).toBe(false);
  });
});
