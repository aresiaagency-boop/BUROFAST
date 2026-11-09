# Seguridad · BUROFAST

## Hallazgo heredado que requiere acción

El flujo original `AgenteWhatsapp.json` contiene en `pinData.Webhook[0].json.body.apikey` una API key de Evolution y un número de teléfono real. Hay que tratar esa clave como **expuesta**:

1. Rotar la API key en Evolution.
2. Importar solo `infrastructure/n8n/hestia.workflow.json`, que no lleva `pinData`.
3. Guardar la clave nueva en una credencial de n8n (`Evolution API · BUROFAST`), nunca en el flujo.

El flujo nuevo tampoco toma la URL de Evolution del cuerpo del webhook. Si lo hiciera, un webhook falso podría desviar la llamada con nuestra clave.

## Controles implementados

- **Datos personales**: nombre, teléfono y correo se cifran con AES-256-GCM (`DATA_ENCRYPTION_KEY`). El teléfono se deduplica con un HMAC. Si falta la clave, no se guarda nada (devuelve 503). El centro de mando enmascara el teléfono y deja en la auditoría cada vez que se leen solicitudes.
- **Consentimiento**: la casilla de privacidad es obligatoria. El marketing va aparte y viene desmarcado.
- **Precio**: el navegador envía respuestas, no rutas ni importes. El servidor recalcula la ruta y el presupuesto.
- **Google**: OIDC con PKCE (S256), `state` contra CSRF y `nonce` contra repetición; se validan emisor, audiencia, caducidad y correo verificado. No se guarda ningún token de Google. Un correo fuera de `OWNER_EMAIL`/`STAFF_EMAILS` nunca entra al mando.
- **Pagos**: solo se cobra con el expediente `aprobado` por el abogado, y el importe sale del presupuesto guardado en el servidor. El webhook verifica la firma de Stripe sobre el cuerpo crudo, registra cada evento una sola vez en la misma transacción que el cambio de estado e ignora los eventos de otras apps de la cuenta (`metadata.app`). La clave de Stripe es restringida (solo Checkout Sessions).
- **Fichas firmadas**: el enlace de pago y la sesión de cliente van firmados con una clave derivada por propósito: una ficha de pago no sirve como sesión.
- **Sesión**: cookie HttpOnly, SameSite=Lax y Secure en producción, firmada con HMAC y válida 8 horas. Se comprueba en `proxy.ts` y otra vez en cada página y cada handler. La contraseña usa scrypt y la comparación es en tiempo constante.
- **CSRF**: toda petición que cambia estado comprueba que la cabecera `Origin` sea la nuestra.
- **Límite de peticiones**: 5 solicitudes cada 10 minutos por IP. El acceso permite 8 intentos cada 15 minutos por IP y 10 por cuenta.
  - La IP sale del valor que añade nuestro proxy (`TRUSTED_PROXY_HOPS`), no del primero de `x-forwarded-for`, que el cliente puede falsificar.
  - El límite vive en PostgreSQL (tabla `limites`, claves resumidas con SHA-256) para que sea uno solo entre funciones de Vercel; sin base de datos cae a memoria.
  - Los motores admiten 120 consultas cada 10 minutos por IP; HESTIA, con su credencial de lectura, tiene un cupo propio.
- **HESTIA**: el contexto y los eventos usan tokens distintos. Quien tenga el de lectura no puede escribir eventos.
  - Los eventos exigen `x-burofast-timestamp` dentro de una ventana de 5 minutos y se deduplican por `mensaje_id`.
  - Como alternativa al token se acepta una firma HMAC (`HESTIA_WEBHOOK_SECRET`).
  - La ruta del webhook de n8n se personaliza en cada despliegue.
- **Trampa para bots**: si llega relleno el campo oculto, la API responde con un éxito creíble y no guarda nada.
- **Situación administrativa**: se guarda cifrada (migración 002). Es un dato sensible.
- **Cabeceras**: CSP, `X-Frame-Options: DENY`, `nosniff` y `Referrer-Policy`.
- **Logs**: JSON estructurado con `correlation_id`, sin texto de mensajes ni datos personales.
- **Auditoría**: `audit_logs` registra actor, acción, objetivo, parámetros redactados, resultado y `correlation_id`.

## Reglas de producto que son de seguridad

- Ningún componente automatiza el acceso a webs de cita previa.
- La protección internacional la atiende siempre una persona.
- HESTIA se identifica como IA, conforme al artículo 50 del Reglamento de IA, en vigor desde el 2 de agosto de 2026.

## Pendiente antes de producción

- Rellenar los datos legales del titular y del abogado (`src/lib/legal.ts`); hasta entonces las páginas legales muestran «pendiente» y el mando avisa.
- PostgreSQL: rol propio con permisos mínimos en lugar de `postgres`, y TLS en el puerto público (ahora va sin cifrar por internet).
- Rotar la API key de Evolution del `pinData` del flujo original.
- Evaluación de impacto (EIPD) por tratar antecedentes penales, que son datos del artículo 10 del RGPD.
- Política de retención y borrado: purga programada de solicitudes no convertidas.
- Roles operator y viewer con usuarios reales; ahora solo existe el owner.
- Retención de la memoria de chat de n8n (`Postgres Chat Memory`).
