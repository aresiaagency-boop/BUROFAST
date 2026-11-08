import { describe, expect, it } from "vitest";
import { DICCIONARIOS } from "@/lib/i18n";
import { LOCALES } from "@/lib/i18n/locales";

function hojas(valor: unknown, ruta: string[] = []): Array<[string, unknown]> {
  if (typeof valor === "function") return [[ruta.join("."), (valor as (a: number, b: number) => string)(1, 9)]];
  if (Array.isArray(valor)) return valor.flatMap((v, i) => hojas(v, [...ruta, String(i)]));
  if (valor && typeof valor === "object") return Object.entries(valor).flatMap(([k, v]) => hojas(v, [...ruta, k]));
  return [[ruta.join("."), valor]];
}

describe("diccionarios", () => {
  const referencia = new Map(hojas(DICCIONARIOS.es));

  for (const locale of LOCALES) {
    it(`${locale}: ningún texto vacío y las mismas claves que el español`, () => {
      const propias = new Map(hojas(DICCIONARIOS[locale]));
      expect([...propias.keys()].sort()).toEqual([...referencia.keys()].sort());
      for (const [clave, texto] of propias) {
        expect(typeof texto, clave).toBe("string");
        expect((texto as string).trim().length, clave).toBeGreaterThan(0);
      }
    });
  }

  it("los idiomas distintos del español están traducidos de verdad", () => {
    for (const locale of LOCALES.filter((l) => l !== "es")) {
      expect(DICCIONARIOS[locale].pasos.sueno.titulo).not.toBe(DICCIONARIOS.es.pasos.sueno.titulo);
    }
  });
});
