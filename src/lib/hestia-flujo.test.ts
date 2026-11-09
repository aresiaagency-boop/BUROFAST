import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { CITAS } from "@/lib/catalogo";
import { DOCUMENTOS, PASAPORTES, SITUACIONES, SUENOS, TIEMPOS, UBICACIONES } from "@/lib/diagnostico";

// Contrato del flujo de n8n de HESTIA (canales WhatsApp y app). No ejecuta n8n:
// comprueba que el JSON importable no lleva secretos, que funciona en n8n
// Community (sin $vars), que todas las conexiones apuntan a nodos que existen,
// que los eventos llevan lo que exige /api/v1/hestia/eventos y que el canal app
// habla el contrato de src/lib/hestia/orquestador.ts con los motores al día.
type Nodo = { name: string; type: string; parameters: Record<string, unknown>; credentials?: Record<string, unknown>; onError?: string };
const ruta = fileURLToPath(new URL("../../infrastructure/n8n/hestia.workflow.json", import.meta.url));
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

  it("la ruta del webhook de WhatsApp se personaliza en cada despliegue", () => {
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

  describe("canal app", () => {
    const herramientas = ["ARIADNA_rutas", "CRONOS_citas", "MNEMOSINE_documentos", "ARGOS_plazos", "TEMIS_reglas"];
    const motores = ["ariadna", "cronos", "mnemosine", "argos", "temis"];

    it("el webhook exige credencial y responde desde un nodo", () => {
      const webhook = porNombre.get("Webhook app");
      expect(webhook?.parameters).toMatchObject({ httpMethod: "POST", authentication: "headerAuth", responseMode: "responseNode" });
      expect(JSON.stringify(webhook?.credentials)).toContain("app → HESTIA");
      expect(flujo.connections["Salida app"].main[0][0].node).toBe("Responder a la app");
    });

    it("lee exactamente lo que envía el backend", () => {
      const asignaciones = (porNombre.get("Entrada app")?.parameters.assignments as { assignments: { name: string; value: string }[] }).assignments;
      expect(asignaciones.map((a) => a.name)).toEqual(["sesion", "mensaje", "idioma", "motor", "contexto"]);
      for (const a of asignaciones) expect(a.value).toContain(`$json.body.${a.name}`);
    });

    it("HESTIA · App es IA declarada, usa memoria por sesión y no tumba la respuesta si falla", () => {
      const agente = porNombre.get("HESTIA · App");
      const prompt = String((agente?.parameters.options as { systemMessage: string }).systemMessage);
      expect(prompt).toContain("Eres HESTIA");
      expect(prompt).toContain("inteligencia artificial");
      expect(prompt).toContain("nunca la cita");
      for (const h of herramientas) expect(prompt).toContain(h);
      expect(agente?.onError).toBe("continueRegularOutput");
      expect(String(porNombre.get("Memoria · App")?.parameters.sessionKey)).toContain("$('Entrada app').item.json.sesion");
    });

    it("los cinco motores son herramientas con credencial de lectura", () => {
      herramientas.forEach((nombre, i) => {
        const nodo = porNombre.get(nombre);
        expect(nodo?.type).toBe("n8n-nodes-base.httpRequestTool");
        expect(String(nodo?.parameters.url)).toMatch(new RegExp(`/api/v1/motores/${motores[i]}$`));
        expect(JSON.stringify(nodo?.credentials)).toContain("contexto");
        expect(flujo.connections[nombre].ai_tool[0][0].node).toBe("HESTIA · App");
      });
    });

    it("las herramientas ofrecen los valores vigentes del código", () => {
      const ariadna = String(porNombre.get("ARIADNA_rutas")?.parameters.jsonBody);
      for (const valor of [...SUENOS, ...UBICACIONES, ...SITUACIONES, ...TIEMPOS, ...PASAPORTES]) expect(ariadna).toContain(valor);
      const cronos = String(porNombre.get("CRONOS_citas")?.parameters.jsonBody);
      for (const cita of Object.keys(CITAS)) expect(cronos).toContain(cita);
      const mnemosine = String(porNombre.get("MNEMOSINE_documentos")?.parameters.jsonBody);
      for (const documento of DOCUMENTOS) expect(mnemosine).toContain(documento);
    });

    it("la salida retira las marcas y devuelve agente, motor y escalado", () => {
      const codigo = String(porNombre.get("Salida app")?.parameters.jsCode);
      const ejecutar = (output: string) =>
        (new Function("$input", codigo) as (i: unknown) => { json: Record<string, unknown> }[])({ first: () => ({ json: { output } }) })[0].json;
      expect(ejecutar("Te faltan dos documentos.\n[[AGENTE:MNEMÓSINE]] [[MOTOR:documentos]]")).toEqual({
        respuesta: "Te faltan dos documentos.",
        agente: "MNEMOSINE",
        motor: "documentos",
        escalar: false,
      });
      expect(ejecutar("Te atiende una persona, sin coste.\n[[AGENTE:HESTIA]] [[ESCALAR]]")).toMatchObject({ escalar: true, motor: null });
      // Sin texto, el backend rechaza la respuesta y contesta en modo local.
      expect(ejecutar("")).toMatchObject({ respuesta: null, agente: "HESTIA" });
    });
  });
});
