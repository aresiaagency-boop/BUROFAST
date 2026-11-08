# Variables de entorno

Crea tu `.env.local` (o las variables del servicio en EasyPanel) con esta lista. En el repositorio solo debe haber placeholders.

| Variable | Obligatoria | Para qué | Cómo generarla |
| --- | --- | --- | --- |
| `DATABASE_URL` | Sí | PostgreSQL (red privada en EasyPanel) | `postgres://usuario:clave@host:5432/burofast` |
| `DATA_ENCRYPTION_KEY` | Sí | Cifrado de nombre, teléfono y correo | `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"` |
| `AUTH_SECRET` | Sí | Firma de la sesión del centro de mando (≥ 32 caracteres) | `node -e "console.log(require('crypto').randomBytes(32).toString('base64url'))"` |
| `OWNER_EMAIL` | Sí | Correo del owner del centro de mando | — |
| `OWNER_PASSWORD_HASH` | Sí | Hash scrypt de la contraseña | `printf '%s' 'tu-frase-larga' \| npm run -s hash-password` |
| `HESTIA_CONTEXTO_TOKEN` | Para HESTIA | Bearer de `/api/v1/hestia/contexto` (solo lectura) | `node -e "console.log(require('crypto').randomBytes(24).toString('hex'))"` |
| `HESTIA_EVENTOS_TOKEN` | Para HESTIA | Bearer de `/api/v1/hestia/eventos`; es distinto del de contexto | Igual que el anterior |
| `HESTIA_WEBHOOK_SECRET` | No | Firma HMAC de eventos, alternativa al token, para emisores que pueden firmar | Igual que el anterior |
| `TRUSTED_PROXY_HOPS` | Recomendada | Cuántos proxys propios hay delante (Traefik de EasyPanel = 1). Con 0 se ignora `x-forwarded-for` | `1` |
| `HESTIA_WHATSAPP_NUMERO` | Para HESTIA | Número de WhatsApp de HESTIA en el botón final del funnel | `34600000000` (solo dígitos) |
| `N8N_BASE_URL` | Para el estado | Comprobación `/healthz` de n8n en el centro de mando | URL del n8n |
| `APP_BASE_URL` | Recomendada | Enlaces al funnel que HESTIA envía | `https://burofast.tu-dominio` |
| `BUROFAST_ENTORNO` | Recomendada | `local`, `staging` o `produccion`; en `produccion` el seed DEMO no se ejecuta | — |
| `LOG_LEVEL` | No | `info` o `warn` | — |

## En n8n

n8n Community no tiene `$vars`. La configuración que no es secreta (`EVOLUTION_BASE_URL`, `EVOLUTION_INSTANCE`, `BUROFAST_API_URL`) se edita en el nodo **Configuración** del flujo. Los secretos van solo en credenciales. Ver `infrastructure/n8n/README.md`.
