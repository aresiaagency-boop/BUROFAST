import { describe, expect, it } from "vitest";
import { LEGALES } from "@/lib/i18n/legal";
import { LOCALES } from "@/lib/i18n/locales";
import { CLAVES_LEGALES, datosLegalesPendientes, DOCUMENTOS_LEGALES, trocearTextoLegal } from "@/lib/legal";

const marcas = (texto: string) => [...texto.matchAll(/\{([a-z]+)\}/g)].map((m) => m[1]).sort();
const completos = Object.fromEntries(CLAVES_LEGALES.map((c) => [c, `valor-${c}`])) as Record<(typeof CLAVES_LEGALES)[number], string>;

describe("datos legales", () => {
  it("un dato que falta sale como pendiente y uno presente con su valor", () => {
    const trozos = trocearTextoLegal("Titular: {titular}. NIF: {nif}.", { ...completos, nif: null });
    expect(trozos).toEqual([
      { tipo: "texto", valor: "Titular: " },
      { tipo: "dato", clave: "titular", valor: "valor-titular" },
      { tipo: "texto", valor: ". NIF: " },
      { tipo: "dato", clave: "nif", valor: null },
      { tipo: "texto", valor: "." },
    ]);
  });

  it("una marca desconocida se queda como texto", () => {
    expect(trocearTextoLegal("Hola {nadie}", completos)).toEqual([{ tipo: "texto", valor: "Hola {nadie}" }]);
  });

  it("dice qué falta y nada cuando está completo", () => {
    expect(datosLegalesPendientes(completos)).toEqual([]);
    expect(datosLegalesPendientes({ ...completos, correo: "  ", abogado: null })).toEqual(["correo", "abogado"]);
  });
});

describe("textos legales en los seis idiomas", () => {
  const es = LEGALES.es;

  it("solo usan marcas que existen", () => {
    for (const locale of LOCALES) {
      for (const id of DOCUMENTOS_LEGALES) {
        for (const seccion of LEGALES[locale].documentos[id].secciones) {
          for (const parrafo of seccion.parrafos) for (const marca of marcas(parrafo)) expect(CLAVES_LEGALES, `${locale}/${id}: ${marca}`).toContain(marca);
        }
      }
    }
  });

  it("cada traducción tiene las mismas secciones, párrafos y marcas que el castellano", () => {
    for (const locale of LOCALES) {
      for (const id of DOCUMENTOS_LEGALES) {
        const original = es.documentos[id].secciones;
        const traducido = LEGALES[locale].documentos[id].secciones;
        expect(traducido.length, `${locale}/${id}`).toBe(original.length);
        original.forEach((seccion, i) => {
          expect(traducido[i].parrafos.length, `${locale}/${id}/${i}`).toBe(seccion.parrafos.length);
          seccion.parrafos.forEach((parrafo, j) => expect(marcas(traducido[i].parrafos[j]), `${locale}/${id}/${i}/${j}`).toEqual(marcas(parrafo)));
        });
      }
    }
  });

  it("el aviso de pago lleva el enlace a las condiciones y solo el castellano es vinculante", () => {
    for (const locale of LOCALES) {
      expect(LEGALES[locale].aceptarPago.split("{condiciones}")).toHaveLength(2);
      expect(LEGALES[locale].traduccion === null).toBe(locale === "es");
    }
  });
});
