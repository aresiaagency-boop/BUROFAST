"""Construye infrastructure/n8n/hestia.workflow.json: HESTIA con dos canales.

1. WhatsApp, a partir del flujo original AgenteWhatsapp.json. Cambios: sin
   pinData ni claves del cuerpo del webhook, URL de Evolution fija (no la que
   diga el cuerpo), agrupación de mensajes sin el desfase de 3 h, teléfonos de
   cualquier país, imágenes, contexto vivo de BUROFAST en el prompt y eventos
   autenticados con credencial hacia /api/v1/hestia/eventos.
2. App: la consola de la superapp. Webhook con credencial, HESTIA con memoria
   por sesión y los cinco motores como herramientas (ARIADNA, CRONOS,
   MNEMÓSINE, ARGOS, TEMIS), y respuesta JSON con agente, motor y escalado.

Los valores válidos de cada herramienta se leen del código TypeScript (una
regla vive en un sitio); src/lib/hestia-flujo.test.ts comprueba que siguen al día.

Uso: python3 scripts/n8n/construir-hestia.py <ruta a AgenteWhatsapp.json>
"""
import copy, json, re, sys, uuid
from pathlib import Path

RAIZ = Path(__file__).resolve().parents[2]
origen = json.loads(Path(sys.argv[1]).read_text(encoding="utf-8"))
prompt = (RAIZ / "infrastructure/n8n/prompts/hestia-system.md").read_text(encoding="utf-8")
prompt_app = (RAIZ / "infrastructure/n8n/prompts/hestia-app.md").read_text(encoding="utf-8")
# Producción. Si cambia el dominio, se cambia aquí y se regenera.
API_BUROFAST = "https://burofast.vercel.app"

nodos = {n["name"]: copy.deepcopy(n) for n in origen["nodes"]}
def nid(nombre):  # ids estables para que reimportar no duplique nodos
    return str(uuid.uuid5(uuid.NAMESPACE_URL, f"burofast-hestia/{nombre}"))

CRED_EVOLUTION = {"httpHeaderAuth": {"id": "REEMPLAZAR_AL_IMPORTAR", "name": "Evolution API · BUROFAST (cabecera apikey)"}}
CRED_CONTEXTO = {"httpHeaderAuth": {"id": "REEMPLAZAR_AL_IMPORTAR", "name": "BUROFAST · HESTIA contexto (Authorization: Bearer)"}}
CRED_EVENTOS = {"httpHeaderAuth": {"id": "REEMPLAZAR_AL_IMPORTAR", "name": "BUROFAST · HESTIA eventos (Authorization: Bearer)"}}

# n8n Community no tiene $vars: la configuración no secreta vive en un nodo Set
# que se edita tras importar, y los secretos solo en credenciales.
def cfg(clave):
    return "$('Configuración').first().json." + clave

# 1. Webhook con ruta propia por despliegue: la del flujo original está
#    publicada y cualquiera podría llamarla.
webhook = nodos["Webhook"]
webhook["parameters"]["path"] = "hestia-REEMPLAZAR-por-un-uuid-propio"
webhook["webhookId"] = nid("webhook-hestia")

configuracion = {
    "parameters": {"assignments": {"assignments": [
        {"id": nid("cfg-evo"), "name": "EVOLUTION_BASE_URL", "value": "https://REEMPLAZAR-evolution-api", "type": "string"},
        {"id": nid("cfg-inst"), "name": "EVOLUTION_INSTANCE", "value": "REEMPLAZAR-instancia", "type": "string"},
        {"id": nid("cfg-api"), "name": "BUROFAST_API_URL", "value": API_BUROFAST, "type": "string"},
    ]}, "includeOtherFields": True, "options": {}},
    "type": "n8n-nodes-base.set", "typeVersion": 3.4, "position": [-176, 320], "id": nid("Configuración"), "name": "Configuración",
}

# 2. Filtro de entrada: solo mensajes nuevos de personas, nunca los propios ni de grupos.
filtro = {
    "parameters": {
        "conditions": {
            "options": {"caseSensitive": True, "leftValue": "", "typeValidation": "loose", "version": 2},
            "conditions": [
                {"id": nid("c-evento"), "leftValue": "={{ $json.body.event }}", "rightValue": "messages.upsert", "operator": {"type": "string", "operation": "equals"}},
                {"id": nid("c-propio"), "leftValue": "={{ $json.body.data.key.fromMe }}", "rightValue": True, "operator": {"type": "boolean", "operation": "notEquals"}},
                {"id": nid("c-grupo"), "leftValue": "={{ $json.body.data.key.remoteJid }}", "rightValue": "@g.us", "operator": {"type": "string", "operation": "notEndsWith"}},
                {"id": nid("c-instancia"), "leftValue": "={{ $json.body.instance }}", "rightValue": "={{ " + cfg("EVOLUTION_INSTANCE") + " }}", "operator": {"type": "string", "operation": "equals"}},
            ],
            "combinator": "and",
        },
        "options": {},
    },
    "type": "n8n-nodes-base.if", "typeVersion": 2.2, "position": [-16, 128], "id": nid("Solo mensajes entrantes"), "name": "Solo mensajes entrantes",
}

# 3. Edit Fields6: la URL y la instancia de Evolution salen del nodo Configuración, NUNCA del
#    cuerpo (un webhook falso podría desviar la llamada con nuestra clave).
campos = nodos["Edit Fields6"]
asignaciones = [a for a in campos["parameters"]["assignments"]["assignments"] if a["name"] not in ("instance.apikey", "calendarId", "locationId")]
for a in asignaciones:
    if a["name"] == "instance.server_url":
        a["value"] = "={{ " + cfg("EVOLUTION_BASE_URL") + " }}"
    if a["name"] == "instance.instance":
        a["value"] = "={{ " + cfg("EVOLUTION_INSTANCE") + " }}"
campos["parameters"]["assignments"]["assignments"] = asignaciones
campos["position"] = [176, 112]

# 4. Agrupación: continúa cuando el último mensaje tiene 4 s de antigüedad
#    (antes: +3 h fijas, un apaño de zona horaria que en España falla).
switch2 = nodos["Switch2"]
regla = switch2["parameters"]["rules"]["values"][1]["conditions"]["conditions"][0]
regla["leftValue"] = "={{ DateTime.fromISO(JSON.parse($json.messages.last()).timestampt).plus({ seconds: 4 }).toISO() }}"
regla["rightValue"] = "={{ $now.toISO() }}"
nodos["Wait1"]["parameters"]["amount"] = 2

# 5. Imágenes: antes se perdían. HESTIA recibe un aviso, no la imagen.
switch3 = nodos["Switch3"]
switch3["parameters"]["rules"]["values"].append({
    "conditions": {
        "options": {"caseSensitive": True, "leftValue": "", "typeValidation": "strict", "version": 2},
        "conditions": [{"id": nid("c-imagen"), "leftValue": "={{ $json.content_type }}", "rightValue": "image", "operator": {"type": "string", "operation": "equals"}}],
        "combinator": "and",
    },
    "renameOutput": True, "outputKey": "image",
})
imagen = {
    "parameters": {"assignments": {"assignments": [
        {"id": nid("img-content"), "name": "content", "value": "=[La persona ha enviado una imagen{{ $json.content ? ' con el texto: ' + $json.content : '' }}. No la has visto. Recuérdale que los documentos no se envían por WhatsApp y escala.]", "type": "string"},
        {"id": nid("img-ts"), "name": "timestampt", "value": "={{ $('JSON Parser1').item.json.timestampt }}", "type": "string"},
    ]}, "options": {}},
    "type": "n8n-nodes-base.set", "typeVersion": 3.4, "position": [2336, 480], "id": nid("Aviso de imagen"), "name": "Aviso de imagen",
}
merge = nodos["Merge1"]
merge["parameters"] = {"numberInputs": 3}

# 6. Teléfono internacional, sin el atajo argentino del original.
nodos["Code2"]["parameters"]["jsCode"] = (
    "const jid = $('Edit Fields6').first().json.message.number || '';\n"
    "const digitos = jid.replace('@s.whatsapp.net', '').replace(/\\D/g, '');\n"
    "return {\n"
    "  phone: digitos ? '+' + digitos : null,\n"
    "  message: $input.first().json.messages.join('\\n'),\n"
    "  messageId: $('Edit Fields6').first().json.message.message_id,\n"
    "};"
)

# 7. Contexto vivo de BUROFAST (precios, reglas de citas, enlaces al funnel).
contexto = {
    "parameters": {
        "url": "={{ " + cfg("BUROFAST_API_URL") + " }}/api/v1/hestia/contexto",
        "authentication": "genericCredentialType", "genericAuthType": "httpHeaderAuth",
        "options": {"timeout": 5000},
    },
    "type": "n8n-nodes-base.httpRequest", "typeVersion": 4.2, "position": [3952, -160],
    "id": nid("Contexto BUROFAST"), "name": "Contexto BUROFAST", "credentials": CRED_CONTEXTO,
    # Si BUROFAST no responde, HESTIA sigue atendiendo pero sin dar precios.
    "onError": "continueRegularOutput",
}

agente = nodos["AI Agent"]
agente["name"] = "HESTIA"
agente["id"] = nid("HESTIA")
agente["position"] = [4176, 32]
agente["parameters"]["text"] = "=Mensaje de la persona: {{ $('Code2').item.json.message }}"
agente["parameters"]["options"]["systemMessage"] = (
    "=" + prompt
    + "\n--- CONTEXTO BUROFAST (fuente única de precios y reglas; si está vacío o trae error, no des cifras) ---\n"
    + "{{ JSON.stringify($('Contexto BUROFAST').item.json) }}\n\nFecha y hora: {{ $now.setZone('Europe/Madrid').toISO() }}"
)

# 8. Retirar la marca [[ESCALAR]] antes de enviar y preparar los eventos.
preparar = {
    "parameters": {"jsCode": (
        "const salida = String($input.first().json.output || '');\n"
        "const escalar = salida.includes('[[ESCALAR]]');\n"
        "const texto = salida.replace(/\\[\\[ESCALAR\\]\\]/g, '').trim();\n"
        "return [{ json: { texto, escalar } }];"
    )},
    "type": "n8n-nodes-base.code", "typeVersion": 2, "position": [4464, 32], "id": nid("Preparar respuesta"), "name": "Preparar respuesta",
}

respuesta = nodos["whatsapp_response"]
respuesta["position"] = [4704, 32]
respuesta["parameters"]["url"] = "={{ " + cfg("EVOLUTION_BASE_URL") + " }}/message/sendText/{{ " + cfg("EVOLUTION_INSTANCE") + " }}"
respuesta["parameters"]["sendHeaders"] = False
respuesta["parameters"].pop("headerParameters", None)
respuesta["parameters"]["authentication"] = "genericCredentialType"
respuesta["parameters"]["genericAuthType"] = "httpHeaderAuth"
respuesta["credentials"] = CRED_EVOLUTION
for p in respuesta["parameters"]["bodyParameters"]["parameters"]:
    if p["name"] == "text":
        p["value"] = "={{ $('Preparar respuesta').item.json.texto }}"

audio = nodos["Get Audio"]
audio["parameters"]["url"] = "={{ " + cfg("EVOLUTION_BASE_URL") + " }}/chat/getBase64FromMediaMessage/{{ " + cfg("EVOLUTION_INSTANCE") + " }}"
audio["parameters"]["sendHeaders"] = False
audio["parameters"].pop("headerParameters", None)
audio["parameters"]["authentication"] = "genericCredentialType"
audio["parameters"]["genericAuthType"] = "httpHeaderAuth"
audio["credentials"] = CRED_EVOLUTION

# 9. Eventos firmados hacia BUROFAST: entrante, respuesta y, si toca, escalado.
eventos = {
    "parameters": {"jsCode": (
        "const id = $('Code2').first().json.messageId;\n"
        "const telefono = $('Code2').first().json.phone;\n"
        "const escalar = $('Preparar respuesta').first().json.escalar;\n"
        "const tipos = ['mensaje_entrante', 'respuesta_enviada'].concat(escalar ? ['escalado_humano'] : []);\n"
        "const timestamp = new Date().toISOString();\n"
        "return tipos.map((tipo) => {\n"
        "  const body = JSON.stringify({ mensajeId: tipo === 'mensaje_entrante' ? id : id + ':' + tipo, tipo, telefono });\n"
        "  return { json: { timestamp, body } };\n"
        "});"
    )},
    "type": "n8n-nodes-base.code", "typeVersion": 2, "position": [4944, 32], "id": nid("Eventos para BUROFAST"), "name": "Eventos para BUROFAST",
}
enviar_evento = {
    "parameters": {
        "method": "POST", "url": "={{ " + cfg("BUROFAST_API_URL") + " }}/api/v1/hestia/eventos",
        "authentication": "genericCredentialType", "genericAuthType": "httpHeaderAuth",
        "sendHeaders": True,
        "headerParameters": {"parameters": [
            {"name": "x-burofast-timestamp", "value": "={{ $json.timestamp }}"},
        ]},
        "sendBody": True, "contentType": "raw", "rawContentType": "application/json", "body": "={{ $json.body }}",
        "options": {"timeout": 5000},
    },
    "type": "n8n-nodes-base.httpRequest", "typeVersion": 4.2, "position": [5168, 32],
    "id": nid("Registrar en BUROFAST"), "name": "Registrar en BUROFAST", "credentials": CRED_EVENTOS,
    # Que BUROFAST no responda nunca debe impedir que la persona reciba su respuesta.
    "onError": "continueRegularOutput",
}

nodos["Postgres Chat Memory"]["parameters"]["sessionKey"] = "={{ $('Code2').item.json.phone }}"
del nodos["AI Agent"]
for nuevo in (configuracion, filtro, imagen, contexto, agente, preparar, eventos, enviar_evento):
    nodos[nuevo["name"]] = nuevo

c = origen["connections"]
conexiones = {
    "Webhook": {"main": [[{"node": "Configuración", "type": "main", "index": 0}]]},
    "Configuración": {"main": [[{"node": "Solo mensajes entrantes", "type": "main", "index": 0}]]},
    "Solo mensajes entrantes": {"main": [[{"node": "Edit Fields6", "type": "main", "index": 0}], []]},
    "Edit Fields6": c["Edit Fields6"],
    "push_buffer1": c["push_buffer1"],
    "get_message_buffer1": c["get_message_buffer1"],
    "Switch2": c["Switch2"],
    "Wait1": c["Wait1"],
    "Redis3": c["Redis3"],
    "Split Out1": c["Split Out1"],
    "JSON Parser1": c["JSON Parser1"],
    "Switch3": {"main": c["Switch3"]["main"] + [[{"node": "Aviso de imagen", "type": "main", "index": 0}]]},
    "Get Audio": c["Get Audio"],
    "Convert to File1": c["Convert to File1"],
    "Transcribe a recording1": c["Transcribe a recording1"],
    "Edit Fields5": c["Edit Fields5"],
    "Edit Fields7": c["Edit Fields7"],
    "Aviso de imagen": {"main": [[{"node": "Merge1", "type": "main", "index": 2}]]},
    "Merge1": c["Merge1"],
    "Sort1": c["Sort1"],
    "Aggregate2": c["Aggregate2"],
    "Code2": {"main": [[{"node": "Contexto BUROFAST", "type": "main", "index": 0}]]},
    "Contexto BUROFAST": {"main": [[{"node": "HESTIA", "type": "main", "index": 0}]]},
    "OpenAI Chat Model": {"ai_languageModel": [[{"node": "HESTIA", "type": "ai_languageModel", "index": 0}]]},
    "Postgres Chat Memory": {"ai_memory": [[{"node": "HESTIA", "type": "ai_memory", "index": 0}]]},
    "HESTIA": {"main": [[{"node": "Preparar respuesta", "type": "main", "index": 0}]]},
    "Preparar respuesta": {"main": [[{"node": "whatsapp_response", "type": "main", "index": 0}]]},
    "whatsapp_response": {"main": [[{"node": "Eventos para BUROFAST", "type": "main", "index": 0}]]},
    "Eventos para BUROFAST": {"main": [[{"node": "Registrar en BUROFAST", "type": "main", "index": 0}]]},
}

# ─── Canal 2 · App ──────────────────────────────────────────────────────────
# La consola de la superapp habla con HESTIA a través del backend (el navegador
# nunca llama a n8n). Contrato: src/lib/hestia/orquestador.ts.

def lista_ts(ruta, nombre):
    texto = (RAIZ / ruta).read_text(encoding="utf-8")
    bloque = re.search(r"export const " + nombre + r" = \[(.*?)\] as const;", texto, re.S)
    return re.findall(r'"([^"]+)"', bloque.group(1))

def claves_ts(ruta, nombre):
    texto = (RAIZ / ruta).read_text(encoding="utf-8")
    bloque = re.search(r"export const " + nombre + r" = \{\n(.*?)\n\} as const;", texto, re.S)
    return re.findall(r"^  ([a-z_]+): \{", bloque.group(1), re.M)

DIAG = "src/lib/diagnostico.ts"
uno_de = lambda valores: "Uno de: " + ", ".join(valores) + "."
valores = lambda lista: "Valores posibles: " + ", ".join(lista) + "."
CITAS_IDS = claves_ts("src/lib/catalogo.ts", "CITAS")
DOCUMENTOS_IDS = lista_ts(DIAG, "DOCUMENTOS")

CRED_APP = {"httpHeaderAuth": {"id": "REEMPLAZAR_AL_IMPORTAR", "name": "BUROFAST · app → HESTIA (Authorization: Bearer)"}}
# Las herramientas usan la credencial de contexto (solo lectura): con ella el
# servidor aplica el límite de peticiones de HESTIA, no el de una IP cualquiera.

webhook_app = {
    "parameters": {"httpMethod": "POST", "path": "burofast-hestia-app", "authentication": "headerAuth", "responseMode": "responseNode", "options": {}},
    "type": "n8n-nodes-base.webhook", "typeVersion": 2, "position": [-176, 1200],
    "id": nid("Webhook app"), "name": "Webhook app", "webhookId": nid("webhook-app"), "credentials": CRED_APP,
}
entrada_app = {
    "parameters": {"assignments": {"assignments": [
        {"id": nid("app-sesion"), "name": "sesion", "value": "={{ String($json.body.sesion || '').slice(0, 80) }}", "type": "string"},
        {"id": nid("app-mensaje"), "name": "mensaje", "value": "={{ String($json.body.mensaje || '').slice(0, 2000) }}", "type": "string"},
        {"id": nid("app-idioma"), "name": "idioma", "value": "={{ ['es','en','fr','pt','ar','uk'].includes($json.body.idioma) ? $json.body.idioma : 'es' }}", "type": "string"},
        {"id": nid("app-motor"), "name": "motor", "value": "={{ $json.body.motor || '' }}", "type": "string"},
        {"id": nid("app-contexto"), "name": "contexto", "value": "={{ $json.body.contexto || {} }}", "type": "object"},
    ]}, "options": {}},
    "type": "n8n-nodes-base.set", "typeVersion": 3.4, "position": [48, 1200], "id": nid("Entrada app"), "name": "Entrada app",
}
hestia_app = {
    "parameters": {
        "promptType": "define",
        "text": "={{ $json.mensaje }}",
        "options": {
            "systemMessage": (
                "=" + prompt_app
                + "\n--- CONTEXTO DE ESTA PERSONA (sin nombre, teléfono ni correo) ---\n"
                + "{{ JSON.stringify($json.contexto) }}\n\n"
                + "Idioma: {{ $json.idioma }}\nMotor abierto: {{ $json.motor || 'ninguno' }}\n"
                + "Fecha: {{ $now.setZone('Europe/Madrid').toISODate() }}"
            ),
            "maxIterations": 6,
        },
    },
    "type": "@n8n/n8n-nodes-langchain.agent", "typeVersion": 1.9, "position": [304, 1200],
    "id": nid("HESTIA · App"), "name": "HESTIA · App",
    # Si la IA falla, la salida vacía hace que el backend responda en modo local.
    "onError": "continueRegularOutput",
}
modelo_app = {
    "parameters": {"model": {"__rl": True, "mode": "list", "value": "gpt-4o-mini"}, "options": {"temperature": 0.3}},
    "type": "@n8n/n8n-nodes-langchain.lmChatOpenAi", "typeVersion": 1.2, "position": [176, 1440],
    "id": nid("OpenAI · App"), "name": "OpenAI · App",
}
memoria_app = {
    "parameters": {"sessionIdType": "customKey", "sessionKey": "={{ $('Entrada app').item.json.sesion }}", "contextWindowLength": 10},
    "type": "@n8n/n8n-nodes-langchain.memoryPostgresChat", "typeVersion": 1.3, "position": [336, 1440],
    "id": nid("Memoria · App"), "name": "Memoria · App",
}

def herramienta(nombre, motor, descripcion, cuerpo, x):
    return {
        "parameters": {
            "toolDescription": descripcion,
            "method": "POST",
            "url": f"{API_BUROFAST}/api/v1/motores/{motor}",
            "authentication": "genericCredentialType", "genericAuthType": "httpHeaderAuth",
            "sendBody": True, "specifyBody": "json", "jsonBody": cuerpo,
            "options": {"timeout": 8000},
        },
        "type": "n8n-nodes-base.httpRequestTool", "typeVersion": 4.2, "position": [x, 1440],
        "id": nid(nombre), "name": nombre, "credentials": CRED_CONTEXTO,
    }

def de_ia(clave, descripcion):
    # Llamada $fromAI con comillas simples: n8n la lee para construir el
    # esquema de la herramienta.
    return "$fromAI('" + clave + "', '" + descripcion.replace("'", "’") + "', 'string')"

def desde_ia(clave, descripcion, vacio_es_null=False):
    # JSON.stringify deja comillas y escapes bien puestos dentro del cuerpo.
    valor = de_ia(clave, descripcion) + (" || null" if vacio_es_null else "")
    return "{{ JSON.stringify(" + valor + ") }}"

def lista_desde_ia(clave, descripcion):
    return "{{ JSON.stringify(String(" + de_ia(clave, descripcion) + " || '').split(',').map((v) => v.trim()).filter(Boolean)) }}"

herramientas = [
    herramienta(
        "ARIADNA_rutas", "ariadna",
        "ARIADNA. Calcula la ruta de extranjería de la persona y su presupuesto por nivel de gestión de citas, a partir de cinco respuestas. Úsala si cambia su situación o pregunta por otra ruta.",
        "={ \"respuestas\": { "
        + "\"sueno\": " + desde_ia("sueno", "Qué quiere. " + uno_de(lista_ts(DIAG, "SUENOS"))) + ", "
        + "\"ubicacion\": " + desde_ia("ubicacion", "Dónde está ahora. " + uno_de(lista_ts(DIAG, "UBICACIONES"))) + ", "
        + "\"situacion\": " + desde_ia("situacion", "Su situación en España; vacío si está fuera. " + uno_de(lista_ts(DIAG, "SITUACIONES")), vacio_es_null=True) + ", "
        + "\"tiempo\": " + desde_ia("tiempo", "Tiempo en España (residencia legal si tiene autorización); vacío si está fuera. " + uno_de(lista_ts(DIAG, "TIEMPOS")), vacio_es_null=True) + ", "
        + "\"pasaporte\": " + desde_ia("pasaporte", "Su pasaporte. " + uno_de(lista_ts(DIAG, "PASAPORTES")))
        + " } }",
        560,
    ),
    herramienta(
        "CRONOS_citas", "cronos",
        "CRONOS. Para una lista de citas oficiales devuelve quién las da, cuándo se piden, cuáles gestiona BUROFAST y cuánto cuesta gestionarlas por nivel (la cita oficial es gratis).",
        "={ \"citas\": " + lista_desde_ia("citas", "Ids de cita separados por comas. " + valores(CITAS_IDS)) + " }",
        720,
    ),
    herramienta(
        "MNEMOSINE_documentos", "mnemosine",
        "MNEMÓSINE. Para una lista de documentos dice cuáles necesitan legalización o apostilla y traducción jurada, y cuáles deben ser recientes.",
        "={ \"documentos\": " + lista_desde_ia("documentos", "Ids de documento separados por comas. " + valores(DOCUMENTOS_IDS)) + " }",
        880,
    ),
    herramienta(
        "ARGOS_plazos", "argos",
        "ARGOS. Con la fecha de caducidad de una tarjeta de residencia calcula cuándo se abre y se cierra el plazo de renovación y en qué punto está hoy.",
        "={ \"caducidad\": " + desde_ia("caducidad", "Fecha de caducidad de la tarjeta, formato AAAA-MM-DD.") + " }",
        1040,
    ),
    herramienta(
        "TEMIS_reglas", "temis",
        "TEMIS. Devuelve las garantías y límites de BUROFAST: qué prometemos, qué no y qué decide siempre una persona.",
        "={}",
        1200,
    ),
]

salida_app = {
    "parameters": {"jsCode": (
        "const bruto = String($input.first().json.output || '');\n"
        "const agente = ((bruto.match(/\\[\\[AGENTE:([^\\]]+)\\]\\]/i) || [])[1] || 'HESTIA')\n"
        "  .normalize('NFD').replace(/[\\u0300-\\u036f]/g, '').trim().toUpperCase();\n"
        "const motor = ((bruto.match(/\\[\\[MOTOR:([^\\]]+)\\]\\]/i) || [])[1] || '').trim().toLowerCase() || null;\n"
        "const escalar = bruto.includes('[[ESCALAR]]');\n"
        "const respuesta = bruto.replace(/\\[\\[(AGENTE|MOTOR):[^\\]]*\\]\\]/gi, '').replace(/\\[\\[ESCALAR\\]\\]/g, '').trim();\n"
        "// Sin texto, el backend no lo acepta y responde en modo local.\n"
        "return [{ json: { respuesta: respuesta || null, agente, motor, escalar } }];"
    )},
    "type": "n8n-nodes-base.code", "typeVersion": 2, "position": [624, 1200], "id": nid("Salida app"), "name": "Salida app",
}
responder_app = {
    "parameters": {"respondWith": "firstIncomingItem", "options": {}},
    "type": "n8n-nodes-base.respondToWebhook", "typeVersion": 1.1, "position": [848, 1200],
    "id": nid("Responder a la app"), "name": "Responder a la app",
}

for nuevo in (webhook_app, entrada_app, hestia_app, modelo_app, memoria_app, *herramientas, salida_app, responder_app):
    nodos[nuevo["name"]] = nuevo
conexiones.update({
    "Webhook app": {"main": [[{"node": "Entrada app", "type": "main", "index": 0}]]},
    "Entrada app": {"main": [[{"node": "HESTIA · App", "type": "main", "index": 0}]]},
    "OpenAI · App": {"ai_languageModel": [[{"node": "HESTIA · App", "type": "ai_languageModel", "index": 0}]]},
    "Memoria · App": {"ai_memory": [[{"node": "HESTIA · App", "type": "ai_memory", "index": 0}]]},
    **{h["name"]: {"ai_tool": [[{"node": "HESTIA · App", "type": "ai_tool", "index": 0}]]} for h in herramientas},
    "HESTIA · App": {"main": [[{"node": "Salida app", "type": "main", "index": 0}]]},
    "Salida app": {"main": [[{"node": "Responder a la app", "type": "main", "index": 0}]]},
})

flujo = {
    "name": "HESTIA · BUROFAST",
    "nodes": list(nodos.values()),
    "pinData": {},
    "connections": conexiones,
    "active": False,
    "settings": {"executionOrder": "v1", "saveDataSuccessExecution": "none", "saveManualExecutions": False},
    "meta": {"templateCredsSetupCompleted": False},
    "tags": [],
}
destino = RAIZ / "infrastructure/n8n/hestia.workflow.json"
destino.write_text(json.dumps(flujo, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
print(f"{destino} · {len(flujo['nodes'])} nodos")
