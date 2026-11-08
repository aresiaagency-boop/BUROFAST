# HESTIA en n8n

`hestia-whatsapp.workflow.json` se genera desde el flujo original `AgenteWhatsapp.json`:

```bash
python3 scripts/n8n/construir-hestia.py /ruta/a/AgenteWhatsapp.json
npx vitest run src/lib/hestia-flujo.test.ts   # contrato: sin secretos, conexiones válidas, firma compatible
```

## Qué cambia respecto al original

| Original | HESTIA |
| --- | --- |
| `pinData` con API key y teléfono reales | Sin `pinData` |
| URL e instancia de Evolution leídas del cuerpo del webhook | Fijas en el nodo **Configuración** (sin `$vars`, que n8n Community no tiene). El webhook se filtra por evento, instancia, mensajes propios y grupos |
| Ruta del webhook publicada en el JSON | `hestia-REEMPLAZAR-por-un-uuid-propio`: cada despliegue pone la suya, imposible de adivinar |
| API key de Evolution enviada en el cuerpo | Credencial `httpHeaderAuth` de n8n |
| Agrupación con `+3 horas` (zona horaria de Argentina) | Continúa cuando el último mensaje tiene 4 s de antigüedad |
| Teléfono normalizado solo para Argentina (`549` → `54`) | Formato internacional `+` y dígitos |
| Imágenes descartadas | Aviso a HESTIA: pide no enviar documentos por WhatsApp y escala a una persona |
| Prompt genérico de atención al cliente | Prompt de HESTIA (`prompts/hestia-system.md`) más contexto vivo de BUROFAST |
| Sin rastro | Eventos con credencial propia (Bearer) y marca de tiempo: entrante, respuesta enviada y escalado a una persona |

## Importar

1. En n8n: *Import from file* → `hestia-whatsapp.workflow.json`.
2. En el nodo **Configuración**, rellena `EVOLUTION_BASE_URL`, `EVOLUTION_INSTANCE` y `BUROFAST_API_URL`.
3. En el nodo **Webhook**, cambia la ruta por un UUID nuevo: `node -e "console.log(crypto.randomUUID())"`.
4. Credenciales que hay que crear o asignar (todas de tipo Header Auth):
   - `Evolution API · BUROFAST (cabecera apikey)`: nombre `apikey`; valor, la clave **nueva** de Evolution.
   - `BUROFAST · HESTIA contexto (Authorization: Bearer)`: nombre `Authorization`; valor, `Bearer <HESTIA_CONTEXTO_TOKEN>`.
   - `BUROFAST · HESTIA eventos (Authorization: Bearer)`: nombre `Authorization`; valor, `Bearer <HESTIA_EVENTOS_TOKEN>`.
   - OpenAI, Redis y PostgreSQL (memoria): las que ya usa tu n8n.
5. En Evolution, apunta el webhook de `messages.upsert` a la URL de producción del nodo Webhook.
6. Prueba con un número de test antes de activar el flujo. Comprueba en `/mando/hestia` que llegan los eventos.

## Estado real

El flujo se ha verificado por contrato. **No se ha importado ni ejecutado en un n8n real.** Antes de activarlo, revisa que tu versión de n8n acepta los nodos `if` v2.2, `set` v3.4 con `includeOtherFields` y `httpRequest` v4.2 con `contentType: raw`.
