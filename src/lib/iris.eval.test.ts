import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { decidirRevision, lecturaIrisSchema } from "@/lib/iris";

// Casos de la decisión de IRIS: qué lectura da verde y cuál ámbar. Cada vez
// que un abogado corrija un verde o un ámbar, un caso nuevo en eval/iris.jsonl.
const ruta = fileURLToPath(new URL("../../eval/iris.jsonl", import.meta.url));
const casos = readFileSync(ruta, "utf8")
  .split("\n")
  .filter((linea) => linea.trim())
  .map((linea) => JSON.parse(linea) as { caso: string; hoy: string; tipo: Parameters<typeof decidirRevision>[0]; lectura: unknown; esperado: { estado: string; codigo: string } });

describe("eval de IRIS", () => {
  it("tiene al menos quince casos", () => {
    expect(casos.length).toBeGreaterThanOrEqual(15);
  });

  for (const c of casos) {
    it(c.caso, () => {
      const lectura = c.lectura === null ? null : lecturaIrisSchema.parse(c.lectura);
      expect(decidirRevision(c.tipo, lectura, new Date(c.hoy))).toEqual(c.esperado);
    });
  }
});
