"""Construye infrastructure/n8n/hestia-whatsapp.workflow.json a partir del flujo
original AgenteWhatsapp.json. Cambios: sin pinData ni claves del cuerpo del
webhook, URL de Evolution fija (no la que diga el cuerpo), agrupación de mensajes
sin el desfase de 3 h, teléfonos de cualquier país, imágenes, contexto vivo de
BUROFAST en el prompt y eventos autenticados con credencial hacia /api/v1/hestia/eventos.

Uso: python3 scripts/n8n/construir-hestia.py <ruta a AgenteWhatsapp.json>
"""
import copy, json, sys, uuid
from pathlib import Path

RAIZ = Path(__file__).resolve().parents[2]
origen = json.loads(Path(sys.argv[1]).read_text(encoding="utf-8"))
prompt = (RAIZ / "infrastructure/n8n/prompts/hestia-system.md").read_text(encoding="utf-8")

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
        {"id": nid("cfg-api"), "name": "BUROFAST_API_URL", "value": "https://REEMPLAZAR-burofast", "type": "string"},
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

flujo = {
    "name": "HESTIA · BUROFAST · WhatsApp",
    "nodes": list(nodos.values()),
    "pinData": {},
    "connections": conexiones,
    "active": False,
    "settings": {"executionOrder": "v1", "saveDataSuccessExecution": "none", "saveManualExecutions": False},
    "meta": {"templateCredsSetupCompleted": False},
    "tags": [],
}
destino = RAIZ / "infrastructure/n8n/hestia-whatsapp.workflow.json"
destino.write_text(json.dumps(flujo, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
print(f"{destino} · {len(flujo['nodes'])} nodos")
