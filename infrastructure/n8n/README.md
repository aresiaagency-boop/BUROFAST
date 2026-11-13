# HESTIA en n8n

Un solo flujo, `hestia.workflow.json`, con dos canales que comparten credenciales:

| Canal | Entrada | Qué hace |
| --- | --- | --- |
| **WhatsApp** | Webhook de Evolution (`hestia-REEMPLAZAR-…`) | Agrupa mensajes, transcribe audios, lee el contexto vivo de BUROFAST, responde y registra eventos |
| **App** | `POST /webhook/burofast-hestia-app` con `Authorization: Bearer <HESTIA_N8N_TOKEN>` | La consola de la superapp: HESTIA con memoria por sesión y los cinco motores como herramientas |

Se genera desde el flujo original `AgenteWhatsapp.json`. Nunca se edita a mano:

```bash
python3 scripts/n8n/construir-hestia.py /ruta/a/AgenteWhatsapp.json
npx vitest run src/lib/hestia-flujo.test.ts   # contrato: sin secretos, conexiones válidas, motores al día
```

## Canal app: HESTIA orquesta, los motores calculan

```
Backend (/api/v1/hestia/conversar)
  └─ POST Webhook app  {canal, sesion, idioma, mensaje, motor, contexto}
       └─ Entrada app → HESTIA · App (gpt-4o-mini, memoria Postgres por sesión)
            ├─ ARIADNA_rutas        → POST /api/v1/motores/ariadna
            ├─ CRONOS_citas         → POST /api/v1/motores/cronos
            ├─ MNEMOSINE_documentos → POST /api/v1/motores/mnemosine
            ├─ ARGOS_plazos         → POST /api/v1/motores/argos
            └─ TEMIS_reglas         → POST /api/v1/motores/temis
       └─ Salida app → {respuesta, agente, motor, escalar} → Responder a la app
```

- El navegador nunca llama a n8n: el backend es la puerta y pone el contexto (ruta, presupuesto y expedientes resumidos, sin nombre, teléfono ni correo).
- Los valores válidos de cada herramienta se leen del código (`diagnostico.ts`, `catalogo.ts`). Si cambian y no se regenera el flujo, la prueba de contrato falla.
- Las herramientas usan la credencial de contexto (solo lectura): con ella `/api/v1/motores/*` aplica a HESTIA un cupo propio (3 000 llamadas cada 10 min) en vez del de una IP.
- Si la IA falla o tarda más de 28 s, el backend responde en **modo local** con los motores deterministas y lo dice en la consola.

## Qué cambia en WhatsApp respecto al original

| Original | HESTIA |
| --- | --- |
| `pinData` con API key y teléfono reales | Sin `pinData` |
| URL e instancia de Evolution leídas del cuerpo del webhook | Fijas en el nodo **Configuración** (sin `$vars`, que n8n Community no tiene). El webhook se filtra por evento, instancia, mensajes propios y grupos |
| Ruta del webhook publicada en el JSON | `hestia-REEMPLAZAR-por-un-uuid-propio`: cada despliegue pone la suya |
| API key de Evolution enviada en el cuerpo | Credencial `httpHeaderAuth` de n8n |
| Agrupación con `+3 horas` (zona horaria de Argentina) | Continúa cuando el último mensaje tiene 4 s de antigüedad |
| Teléfono normalizado solo para Argentina | Formato internacional `+` y dígitos |
| Imágenes descartadas | Aviso a HESTIA: pide no enviar documentos por WhatsApp y escala a una persona |
| Prompt genérico | `prompts/hestia-system.md` más contexto vivo de BUROFAST |
| Sin rastro | Eventos con credencial propia: entrante, respuesta enviada y escalado |

## Importar en el flujo de producción

1. En el flujo de HESTIA: *Import from file* → `hestia.workflow.json` (sustituye el contenido).
2. Nodo **Configuración** (WhatsApp): `EVOLUTION_BASE_URL` y `EVOLUTION_INSTANCE`. `BUROFAST_API_URL` ya viene con `https://burofast.vercel.app`.
3. Nodo **Webhook** (WhatsApp): cambia la ruta por un UUID nuevo (`node -e "console.log(crypto.randomUUID())"`).
4. Credenciales, todas de tipo Header Auth salvo las de modelo y memoria:
   - `BUROFAST · app → HESTIA (Authorization: Bearer)`: nombre `Authorization`; valor `Bearer <HESTIA_N8N_TOKEN>`. Va en **Webhook app**.
   - `BUROFAST · HESTIA contexto (Authorization: Bearer)`: `Bearer <HESTIA_CONTEXTO_TOKEN>`. Va en **Contexto BUROFAST** y en las cinco herramientas.
   - `BUROFAST · HESTIA eventos (Authorization: Bearer)`: `Bearer <HESTIA_EVENTOS_TOKEN>`.
   - `Evolution API · BUROFAST (cabecera apikey)`: nombre `apikey`; valor, la clave **nueva** de Evolution.
   - OpenAI (en *OpenAI Chat Model* y *OpenAI · App*) y PostgreSQL (en *Postgres Chat Memory* y *Memoria · App*); Redis para el búfer de WhatsApp.
5. Activa el flujo y copia la URL de producción de **Webhook app** en Vercel como `HESTIA_N8N_URL`.
6. Prueba: escribe en la consola de la app y comprueba en `/mando/hestia` que los turnos salen «con IA». En WhatsApp, prueba con un número de test antes de apuntar Evolution al webhook.

## Estado real

Contrato verificado por pruebas (nodos, conexiones, credenciales, valores de los motores y el código que interpreta las marcas `[[AGENTE:…]] [[MOTOR:…]] [[ESCALAR]]`). Requiere **n8n 1.90 o superior** (el nodo AI Agent 1.9 llega en 1.89 y `httpRequestTool` en 1.90).

En el n8n de EasyPanel (2.29.9, 9 nov 2026), flujo `LzDIhpysxeGsOAsH`:

- **Borrador** con 36 nodos: los 12 del canal app añadidos debajo del WhatsApp **original**, que no se tocó (webhook con ruta `BUROFAST`, apikey de Evolution leída del cuerpo). No es un *Import from file* completo: el WhatsApp de este repo sigue sin importar.
- *OpenAI · App* y *Memoria · App* usan las credenciales de OpenAI y PostgreSQL que ya tenía el flujo.
- 13 nov 2026: **publicado**. Webhook app usa la credencial «Header Auth account» creada por el owner; sin token responde 403. Las cinco herramientas siguen sin autenticación (120 consultas cada 10 min por IP; con la credencial de contexto, 3 000).
- Falta `HESTIA_N8N_TOKEN` en Vercel (el mismo valor de la credencial) para que la app llame al flujo.
