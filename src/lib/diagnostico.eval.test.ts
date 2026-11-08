import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { diagnosticar, respuestasSchema } from "@/lib/diagnostico";

// Casos reales y límite del diagnóstico. Cada línea de eval/diagnostico.jsonl
// es un caso: añadir uno nuevo cada vez que un abogado corrija una ruta.
const ruta = fileURLToPath(new URL("../../eval/diagnostico.jsonl", import.meta.url));
const casos = readFileSync(ruta, "utf8")
  .split("\n")
  .filter((linea) => linea.trim())
  .map((linea) => JSON.parse(linea) as {
    caso: string;
    respuestas: unknown;
    esperado: { ruta: string; producto: string; nivel: string; incluyeCita: string | null };
  });

describe("eval del diagnóstico", () => {
  it("tiene al menos veinte casos", () => {
    expect(casos.length).toBeGreaterThanOrEqual(20);
  });

  for (const caso of casos) {
    it(caso.caso, () => {
      const resultado = diagnosticar(respuestasSchema.parse(caso.respuestas));
      expect(resultado.id).toBe(caso.esperado.ruta);
      expect(resultado.producto).toBe(caso.esperado.producto);
      expect(resultado.nivel).toBe(caso.esperado.nivel);
      if (caso.esperado.incluyeCita) {
        expect(resultado.citas).toContain(caso.esperado.incluyeCita);
      } else {
        expect(resultado.citas).toHaveLength(0);
      }
    });
  }
});
