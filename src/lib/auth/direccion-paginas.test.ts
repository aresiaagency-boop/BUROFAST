import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

// Next renderiza el layout y la página en paralelo: que el layout redirija no
// impide que la página consulte y serialice sus datos en la respuesta del 307.
// Cada página de la Dirección tiene que llamar a exigirDireccion() como
// primera instrucción, antes de cualquier consulta.
const PANEL = join(process.cwd(), "src/app/mando/(panel)");

function paginas(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((e) =>
    e.isDirectory() ? paginas(join(dir, e.name)) : e.name === "page.tsx" ? [join(dir, e.name)] : [],
  );
}

describe("páginas de la Dirección", () => {
  const todas = paginas(PANEL);

  it("hay páginas que proteger (si no, la ruta del panel cambió)", () => {
    expect(todas.length).toBeGreaterThanOrEqual(5);
  });

  it.each(todas.map((p) => [p.slice(PANEL.length + 1)]))("%s exige la sesión antes de nada", (relativa) => {
    const fuente = readFileSync(join(PANEL, relativa), "utf8");
    const cuerpo = fuente.match(/export default async function \w+\([^)]*\)[^{]*\{\s*([^\n]+)/);
    expect(cuerpo, "la página tiene que ser «export default async function»").not.toBeNull();
    expect(cuerpo?.[1]).toMatch(/^(const sesion = )?await exigirDireccion\(\);$/);
  });
});
