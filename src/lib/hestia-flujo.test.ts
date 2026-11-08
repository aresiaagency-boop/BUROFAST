import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

// Contrato del flujo de n8n de HESTIA. No ejecuta n8n: comprueba que el JSON
// importable no lleva secretos, que funciona en n8n Community (sin $vars), que
// todas las conexiones apuntan a nodos que existen y que los eventos llevan lo
// que exige /api/v1/hestia/eventos.
type Nodo = { name: string; type: string; parameters: Record<string, unknown>; credentials?: Record<string, unknown> };
const ruta = fileURLToPath(new URL("../../infrastructure/n8n/hestia-whatsapp.workflow.json", import.meta.url));
const texto = readFileSync(ruta, "utf8");
const flujo = JSON.parse(texto) as { nodes: Nodo[]; pinData: object; connections: Record<string, Record<string, { node: string }[][]>> };
const porNombre = new Map(flujo.nodes.map((n) => [n.name, n]));

describe("flujo n8n de HESTIA", () => {
  it("no versiona pinData ni restos del flujo original con datos reales", () => {
    expect(flujo.pinData).toEqual({});
    expect(texto).not.toMatch(/jdirlx|5492314517600|Lautaro/i);
    // Las API keys de Evolution tienen forma de UUID en mayúsculas.
    expect(texto).not.toMatch(/[0-9A-F]{8}-[0-9A-F]{4}-[0-9A-F]{4}-[0-9A-F]{4}-[0-9A-F]{12}/);
    expect(texto).not.toMatch(/body\.apikey|calendarId|locationId/);
  });

  it("no depende de $vars, que n8n Community no tiene", () => {
    expect(texto).not.toContain("$vars");
  });

  it("la ruta del webhook se personaliza en cada despliegue", () => {
    expect(String(porNombre.get("Webhook")?.parameters.path)).toContain("REEMPLAZAR");
  });

  it("la URL de Evolution nunca sale del cuerpo del webhook", () => {
    expect(texto).not.toMatch(/body\.server_url/);
    for (const nombre of ["Get Audio", "whatsapp_response"]) {
      const nodo = porNombre.get(nombre);
      expect(String(nodo?.parameters.url)).toContain("$('Configuración').first().json.EVOLUTION_BASE_URL");
      expect(nodo?.credentials).toBeDefined();
    }
  });

  it("todas las conexiones apuntan a nodos existentes y los nombres son únicos", () => {
    expect(porNombre.size).toBe(flujo.nodes.length);
    for (const [origen, salidas] of Object.entries(flujo.connections)) {
      expect(porNombre.has(origen), origen).toBe(true);
      for (const ramas of Object.values(salidas)) for (const rama of ramas) for (const destino of rama) expect(porNombre.has(destino.node), destino.node).toBe(true);
    }
  });

  it("el agente se llama HESTIA, se presenta como IA y lee el contexto vivo de BUROFAST", () => {
    const hestia = porNombre.get("HESTIA");
    const prompt = String((hestia?.parameters.options as { systemMessage: string }).systemMessage);
    expect(prompt).toContain("Eres HESTIA");
    expect(prompt).toContain("inteligencia artificial");
    expect(prompt).toContain("$('Contexto BUROFAST')");
    expect(prompt).toContain("nunca la cita");
  });

  it("envía los eventos con credencial y la marca de tiempo que exige el servidor", () => {
    const envio = porNombre.get("Registrar en BUROFAST");
    const cabeceras = (envio?.parameters.headerParameters as { parameters: { name: string }[] }).parameters.map((p) => p.name);
    expect(cabeceras).toEqual(["x-burofast-timestamp"]);
    expect(envio?.parameters).toMatchObject({ authentication: "genericCredentialType", genericAuthType: "httpHeaderAuth" });
    expect(JSON.stringify(envio?.credentials)).toContain("eventos");
    expect(JSON.stringify(porNombre.get("Contexto BUROFAST")?.credentials)).toContain("contexto");
  });
});
