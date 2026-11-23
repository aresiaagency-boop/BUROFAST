import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { CITAS } from "@/lib/catalogo";
import { DOCUMENTOS, PASAPORTES, SITUACIONES, SUENOS, TIEMPOS, UBICACIONES } from "@/lib/diagnostico";
import { interpretarRespuestaN8n } from "@/lib/hestia/orquestador";

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
    // Restos del flujo original (instancia, teléfono y nombre reales) por su
    // huella: el repo es público y no debe contener esos datos ni para buscarlos.
    const prohibidos = new Set(["1fbb565d208538eb", "2985a021378c2e00", "239a64eeb1339768"]);
    const huellas = (texto.toLowerCase().match(/[\p{L}\p{N}]+/gu) ?? []).map((t) => createHash("sha256").update(t).digest("hex").slice(0, 16));
    expect(huellas.filter((h) => prohibidos.has(h))).toEqual([]);
    // Ningún número de teléfono (11 cifras o más seguidas), sin contar los UUID de los nodos.
    expect(texto.replace(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi, "")).not.toMatch(/\d{11,}/);
    // Las API keys de Evolution tienen forma de UUID en mayúsculas.
    expect(texto).not.toMatch(/[0-9A-F]{8}-[0-9A-F]{4}-[0-9A-F]{4}-[0-9A-F]{4}-[0-9A-F]{12}/);
    expect(texto).not.toMatch(/calendarId|locationId/);
    // La clave de Evolution solo se lee del cuerpo en un sitio, nunca se escribe en el flujo.
    expect(texto.match(/body\.apikey/g)).toHaveLength(1);
  });

  it("no depende de $vars, que n8n Community no tiene", () => {
    expect(texto).not.toContain("$vars");
  });

  it("la ruta del webhook de WhatsApp no es la pública del flujo original", () => {
    expect(String(porNombre.get("Webhook")?.parameters.path)).not.toMatch(/^f1ec2445/);
  });

  it("la URL y la instancia de Evolution nunca salen del cuerpo del webhook", () => {
    expect(texto).not.toMatch(/body\.server_url/);
    for (const nombre of ["Get Audio", "whatsapp_response"]) {
      const url = String(porNombre.get(nombre)?.parameters.url);
      expect(url).toContain("$('Configuración').first().json.EVOLUTION_BASE_URL");
      expect(url).toContain("$('Configuración').first().json.EVOLUTION_INSTANCE");
    }
    // Solo entran mensajes de personas: ni los propios, ni grupos, ni otra instancia.
    const filtro = JSON.stringify(porNombre.get("Solo mensajes entrantes")?.parameters);
    for (const condicion of ["messages.upsert", "fromMe", "@g.us", "EVOLUTION_INSTANCE"]) expect(filtro).toContain(condicion);
  });

  it("los adjuntos (imagen, documento, vídeo) llegan a HESTIA como aviso, no se pierden", () => {
    const tipos = (porNombre.get("Switch3")?.parameters as { rules: { values: { outputKey: string }[] } }).rules.values.map((v) => v.outputKey);
    expect(tipos).toEqual(["audio", "text", "image", "document", "video"]);
    for (const salida of flujo.connections.Switch3.main.slice(2)) expect(salida[0].node).toBe("Aviso de adjunto");
    expect(JSON.stringify(porNombre.get("Edit Fields6")?.parameters)).toContain("documentMessage");
  });

  it("HESTIA por WhatsApp consulta a los cinco agentes y nunca se queda sin respuesta", () => {
    for (const nombre of ["ARIADNA_rutas_WA", "CRONOS_citas_WA", "MNEMOSINE_documentos_WA", "ARGOS_plazos_WA", "TEMIS_reglas_WA"]) {
      expect(flujo.connections[nombre].ai_tool[0][0].node).toBe("HESTIA");
      expect(String(porNombre.get("HESTIA")?.parameters.options && JSON.stringify(porNombre.get("HESTIA")?.parameters.options))).toContain(nombre);
    }
    // Sin credencial de contexto, el catálogo público da los precios.
    expect(flujo.connections["Contexto BUROFAST"].main[1][0].node).toBe("Catálogo público");
    expect(flujo.connections["Catálogo público"].main[0][0].node).toBe("HESTIA");
    const preparar = new Function("$input", String(porNombre.get("Preparar respuesta")?.parameters.jsCode));
    const ejecutar = (output: string) => (preparar({ first: () => ({ json: { output } }) }) as { json: { texto: string; escalar: boolean } }[])[0].json;
    expect(ejecutar("Hola.\n[[ESCALAR]]")).toEqual({ texto: "Hola.", escalar: true });
    expect(ejecutar("")).toMatchObject({ escalar: true });
    expect(ejecutar("").texto.length).toBeGreaterThan(20);
  });

  it("MNEMÓSINE consulta solo el expediente de quien escribe: el teléfono sale del mensaje, no de la IA", () => {
    const herramienta = porNombre.get("MNEMOSINE_expediente_WA");
    expect(flujo.connections.MNEMOSINE_expediente_WA.ai_tool[0][0].node).toBe("HESTIA");
    expect(herramienta?.parameters.url).toBe("https://burofast.vercel.app/api/v1/hestia/expediente");
    expect(String(herramienta?.parameters.jsonBody)).toContain("$('Code2').first().json.phone");
    expect(String(herramienta?.parameters.jsonBody)).not.toContain("$fromAI");
    expect(JSON.stringify(porNombre.get("HESTIA")?.parameters.options)).toContain("MNEMOSINE_expediente_WA");
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
    expect(prompt).toContain("CONTEXTO BUROFAST");
    expect(prompt).toContain("{{ JSON.stringify($json) }}");
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

    it("el backend acepta lo que devuelve el nodo, también sin motor y al escalar", () => {
      const codigo = String(porNombre.get("Salida app")?.parameters.jsCode);
      const ejecutar = (output: string) =>
        (new Function("$input", codigo) as (i: unknown) => { json: Record<string, unknown> }[])({ first: () => ({ json: { output } }) })[0].json;
      expect(interpretarRespuestaN8n(ejecutar("Hola, soy HESTIA, una inteligencia artificial.\n[[AGENTE:HESTIA]]"))).toEqual({
        texto: "Hola, soy HESTIA, una inteligencia artificial.",
        agente: "HESTIA",
        motor: null,
        escalar: false,
      });
      expect(interpretarRespuestaN8n(ejecutar("Una persona te atenderá sin coste.\n[[AGENTE:TEMIS]] [[ESCALAR]]"))).toMatchObject({ agente: "TEMIS", motor: null, escalar: true });
      expect(interpretarRespuestaN8n([ejecutar("Mira tus documentos.\n[[AGENTE:MNEMOSINE]] [[MOTOR:documentos]]")])).toMatchObject({ motor: "documentos" });
      expect(() => interpretarRespuestaN8n(ejecutar(""))).toThrow();
    });
  });
});
