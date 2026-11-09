# Variables de entorno

En producción viven en Vercel (proyecto `aresiaagency/burofast` → Settings → Environment Variables, entorno Production). En local, en tu `.env.local`. En el repositorio nunca hay valores reales.

Tipo **Config**: se puede leer después de guardar. Tipo **Secret**: no se vuelve a ver; guárdalo también en tu gestor de contraseñas.

## Base

| Variable | Tipo | Para qué | Valor / cómo generarla |
| --- | --- | --- | --- |
| `DATABASE_URL` | Secret | PostgreSQL de EasyPanel | `postgres://USUARIO:CLAVE@HOST:PUERTO/burofast` (EasyPanel → postgres → Expose). Con TLS activado en el servidor, añade `?sslmode=require`. Si la clave lleva `@`, `:` o `/`, codifícala (`encodeURIComponent`) |
| `DATA_ENCRYPTION_KEY` | Secret | Cifrado de nombre, teléfono y correo. **Si se pierde, los datos cifrados no se recuperan** | `openssl rand -hex 32` |
| `AUTH_SECRET` | Secret | Firma de sesiones, del estado de OAuth y de los enlaces de pago (≥ 32 caracteres) | `openssl rand -hex 32` |
| `APP_BASE_URL` | Config | URL pública: vuelta de Google, de Stripe y enlaces de HESTIA | `https://burofast.vercel.app` |
| `BUROFAST_ENTORNO` | Config | `local`, `staging` o `produccion`; en `produccion` el seed DEMO no se ejecuta | `produccion` |
| `TRUSTED_PROXY_HOPS` | Config | Cuántos proxys propios hay delante (Vercel = 1, Traefik de EasyPanel = 1) | `1` |
| `LOG_LEVEL` | Config | `info` o `warn` | — |

## Acceso

| Variable | Tipo | Para qué | Valor / cómo generarla |
| --- | --- | --- | --- |
| `OWNER_EMAIL` | Config | Correo del owner del centro de mando | — |
| `STAFF_EMAILS` | Config | Resto del equipo: `correo:rol, correo:rol` (rol `operator` o `viewer`) | — |
| `GOOGLE_CLIENT_ID` | Config | Cliente OAuth «BUROFAST web» (Google Cloud, proyecto `burofast-514123`) | `…apps.googleusercontent.com` |
| `GOOGLE_CLIENT_SECRET` | Secret | Secreto de ese cliente | Google Auth Platform → Clientes → BUROFAST web |
| `OWNER_PASSWORD_HASH` | Secret | Respaldo si Google falla | `printf '%s' 'tu-frase-larga' \| npm run -s hash-password` |
| `ABOGADOS_EMAILS` | Config | Quién puede confirmar una ruta (y abrir el cobro): `correo, correo`. Vacío: solo el owner | — |

## Cobros (Stripe)

| Variable | Tipo | Para qué | Valor / cómo generarla |
| --- | --- | --- | --- |
| `STRIPE_SECRET_KEY` | Secret | Crear y leer sesiones de Checkout | Clave **restringida** `rk_live_…` con solo *Checkout Sessions: Escritura* |
| `STRIPE_WEBHOOK_SECRET` | Secret | Verificar la firma del webhook | Workbench → Webhooks → `burofast` → Secreto de firma (`whsec_…`) |

## HESTIA

| Variable | Tipo | Para qué | Valor / cómo generarla |
| --- | --- | --- | --- |
| `HESTIA_N8N_URL` | Config | URL de producción del nodo **Webhook app** del flujo | `https://burofast-n8n.7dklrk.easypanel.host/webhook/burofast-hestia-app` |
| `HESTIA_N8N_TOKEN` | Secret | Bearer que el backend manda a n8n (el mismo valor va en la credencial `BUROFAST · app → HESTIA`) | `openssl rand -hex 32` |
| `HESTIA_CONTEXTO_TOKEN` | Secret | Bearer de n8n hacia `/api/v1/hestia/contexto` y `/api/v1/motores/*` (solo lectura) | `openssl rand -hex 24` |
| `HESTIA_EVENTOS_TOKEN` | Secret | Bearer de n8n hacia `/api/v1/hestia/eventos`; distinto del de contexto | `openssl rand -hex 24` |
| `HESTIA_WEBHOOK_SECRET` | Secret | Firma HMAC de eventos, alternativa al token | `openssl rand -hex 24` |
| `HESTIA_WHATSAPP_NUMERO` | Config | Número de WhatsApp de HESTIA (solo dígitos) | `34600000000` |
| `N8N_BASE_URL` | Config | Comprobación `/healthz` de n8n en el centro de mando | `https://burofast-n8n.7dklrk.easypanel.host` |

## Mantenimiento

| Variable | Tipo | Para qué | Valor / cómo generarla |
| --- | --- | --- | --- |
| `CRON_SECRET` | Secret | Vercel Cron la manda como `Authorization: Bearer` a `/api/v1/mantenimiento/purgar` (cada noche borra las solicitudes no convertidas de más de 12 meses) | `openssl rand -hex 32` |

## Solo para pruebas y capturas

| Variable | Para qué |
| --- | --- |
| `CAPTURAS_EMAIL`, `CAPTURAS_PASSWORD` | `npm run screenshots` entra al mando con la contraseña de respaldo |
| `BASE_URL` | Servidor contra el que se hacen las capturas (por defecto `http://localhost:3000`) |

Sin `openssl`: en la consola de cualquier navegador, `[...crypto.getRandomValues(new Uint8Array(32))].map(b => b.toString(16).padStart(2, "0")).join("")`.

## En n8n

n8n Community no tiene `$vars`. La configuración que no es secreta (`EVOLUTION_BASE_URL`, `EVOLUTION_INSTANCE`, `BUROFAST_API_URL`) se edita en el nodo **Configuración** del flujo. Los secretos van solo en credenciales. Ver `infrastructure/n8n/README.md`.
