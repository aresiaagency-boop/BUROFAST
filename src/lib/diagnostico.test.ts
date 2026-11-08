import { describe, expect, it } from "vitest";
import { CITAS } from "@/lib/catalogo";
import { diagnosticar, PASAPORTES, SITUACIONES, SUENOS, TIEMPOS, type Respuestas } from "@/lib/diagnostico";

function todasLasCombinaciones(): Respuestas[] {
  const combinaciones: Respuestas[] = [];
  for (const sueno of SUENOS) {
    for (const pasaporte of PASAPORTES) {
      combinaciones.push({ sueno, ubicacion: "fuera", situacion: null, tiempo: null, pasaporte });
      for (const situacion of SITUACIONES) {
        for (const tiempo of TIEMPOS) {
          combinaciones.push({ sueno, ubicacion: "espana", situacion, tiempo, pasaporte });
        }
      }
    }
  }
  return combinaciones;
}

describe("diagnóstico sobre todas las combinaciones de respuestas", () => {
  const combinaciones = todasLasCombinaciones();

  it("siempre devuelve una ruta y nunca lanza", () => {
    for (const respuestas of combinaciones) {
      expect(() => diagnosticar(respuestas)).not.toThrow();
    }
  });

  it("el asilo nunca acaba en un producto de pago ni en citas cobrables", () => {
    for (const respuestas of combinaciones.filter((r) => r.situacion === "asilo")) {
      const ruta = diagnosticar(respuestas);
      expect(ruta.nivel).toBe("N3");
      expect(ruta.citas.every((cita) => !CITAS[cita].gestionable)).toBe(true);
    }
  });

  it("toda ruta de pago avisa de la revisión del abogado y de que no hay garantía", () => {
    for (const respuestas of combinaciones) {
      const ruta = diagnosticar(respuestas);
      if (ruta.nivel !== "N3") {
        expect(ruta.avisos).toContain("revision_abogado");
        expect(ruta.avisos).toContain("sin_garantia");
      }
    }
  });

  it("nadie con pasaporte no iberoamericano y menos de diez años recibe la ruta de nacionalidad", () => {
    for (const respuestas of combinaciones) {
      if (respuestas.pasaporte === "otro" && respuestas.tiempo !== "mas_10a") {
        expect(diagnosticar(respuestas).id).not.toBe("nacionalidad");
      }
    }
  });

  it("no hay citas repetidas dentro de una ruta", () => {
    for (const respuestas of combinaciones) {
      const { citas } = diagnosticar(respuestas);
      expect(new Set(citas).size).toBe(citas.length);
    }
  });
});
