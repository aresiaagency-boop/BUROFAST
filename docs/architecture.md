# Arquitectura · BUROFAST

Monolito modular en Next.js 16 desplegado en Vercel (`lhr1`). No hay microservicios. HESTIA vive en n8n; el navegador nunca habla con n8n: el backend es la puerta.

```
Cliente (móvil, 6 idiomas)                         Equipo
   │ superapp /{idioma}: núcleo + 5 motores           │ /mando (Google o contraseña, rol)
   ▼                                                  ▼
Next.js 16 · App Router · proxy.ts (sesión + idioma)
   ├── lib/motores        ARIADNA rutas · CRONOS citas · MNEMÓSINE documentos · ARGOS plazos · TEMIS reglas
   ├── lib/diagnostico    reglas de ruta (sin IA) + eval/diagnostico.jsonl
   ├── lib/catalogo       precios, citas, niveles Urgente / Puedo esperar
   ├── lib/hestia         orquestador (backend ↔ n8n) + modo local + eval/hestia.jsonl
   ├── lib/pagos          Stripe Checkout + webhook idempotente
   ├── lib/auth           Google OIDC (PKCE, state, nonce) + sesión de cliente
   ├── lib/repositorio    SQL a mano (postgres) + cifrado de PII
   └── api/v1/*           Zod en cada entrada, correlation_id en cada salida
   │
   ├── PostgreSQL (EasyPanel)  leads · citas · pagos · stripe_eventos · hestia_turnos · limites · audit_logs
   ├── Stripe ──POST /api/v1/pagos/stripe/webhook (firma; ignora lo que no es metadata.app=burofast)
   ├── Google ──GET  /api/v1/auth/google/callback
   └── n8n (HESTIA)
         ├─ canal app:      backend ──POST webhook «burofast-hestia-app» (Bearer HESTIA_N8N_TOKEN)
         │                  HESTIA · App ──POST /api/v1/motores/{ariadna|cronos|mnemosine|argos|temis} (Bearer de lectura)
         └─ canal WhatsApp: Evolution → webhook n8n
                            ──GET  /api/v1/hestia/contexto (Bearer de lectura)
                            └─POST /api/v1/hestia/eventos  (Bearer de eventos + ventana de 5 min)
```

## Cobro con puerta humana

```
nuevo → (contactado) → revision_abogado ─(el abogado aprueba)→ aprobado ─(paga el anticipo, webhook)→ convertido
```

- El botón de pago y el enlace firmado (7 días) solo existen con el expediente `aprobado`, y solo un abogado aprueba.
- Antes de pagar, el cliente marca «empezad ya» (art. 108.2 TRLGDCU); sin esa marca no se abre Checkout.
- El importe es el 50 % del presupuesto guardado en el servidor; el navegador no manda cifras.
- Cada evento de Stripe se registra una sola vez (`stripe_eventos`) en la misma transacción que el cambio de estado.

## Ciclo de una cita

```
en_espera ─(llega la resolución)→ requerida → en_gestion → reservada → confirmada → asistida
                                       │           │            │           └→ reprogramar → en_gestion
                                       └→ cancelada └→ sin_cita_reembolso (solo Urgente)
```

Las citas que dependen de una resolución (huellas, recogida de la TIE y jura) nacen en `en_espera`, sin plazo ni garantía. Las que se pueden pedir ya (padrón, NIE, Seguridad Social y similares) nacen en `requerida`.

Cada cambio se valida en `lib/citas.ts`, se guarda en `cita_eventos` y se registra en `audit_logs`.

Plazo de la primera acción: **24 h** en Urgente y **120 h** en Puedo esperar. La garantía Urgente es de 30 días.

## API v1

| Método y ruta | Acceso | Qué hace |
| --- | --- | --- |
| `GET /health/live` | Público | El proceso está vivo |
| `GET /health/ready` | Público | PostgreSQL responde y la clave de cifrado está presente |
| `GET /api/v1/catalogo` | Público | Precios y niveles de cita |
| `POST /api/v1/diagnostico` | Público | Devuelve la ruta y el presupuesto de unas respuestas |
| `POST /api/v1/leads` | Público, con límite de peticiones, Origin y trampa para bots | Crea la solicitud y sus citas |
| `POST/DELETE /api/v1/sesion` | Público, con límite de intentos | Inicia o cierra la sesión del mando |
| `GET /api/v1/mando/resumen` | viewer | KPIs del mando |
| `GET /api/v1/mando/citas?todas=1` | viewer | Cola de citas |
| `POST /api/v1/mando/citas/:id/estado` | operator | Cambia el estado de una cita (auditado) |
| `GET /api/v1/mando/leads` | viewer | Solicitudes con teléfono enmascarado (lectura auditada) |
| `GET /api/v1/mando/estado` | viewer | Comprobación real de cada pieza |
| `GET /api/v1/hestia/contexto` | Bearer `HESTIA_CONTEXTO_TOKEN` | Contexto para el prompt de HESTIA |
| `POST /api/v1/hestia/eventos` | Bearer `HESTIA_EVENTOS_TOKEN` + marca de tiempo, o firma HMAC | Eventos del agente, sin texto de mensajes |
| `POST /api/v1/hestia/conversar` | Público, con límite y Origin | La consola habla con HESTIA (n8n o modo local) |
| `POST /api/v1/motores/:motor` | Público con límite por IP; cupo propio con Bearer de lectura | ARIADNA, CRONOS, MNEMÓSINE, ARGOS y TEMIS como herramientas |
| `GET /api/v1/auth/google` · `/callback` | Público, con límite | Acceso con Google (equipo o cliente) |
| `POST /api/v1/auth/salir` | Sesión de cliente | Cierra la sesión del cliente |
| `POST /api/v1/pagos/checkout` | Sesión de cliente o enlace firmado; expediente `aprobado` | Abre el Checkout del anticipo |
| `GET /api/v1/pagos/estado` | Público (id de sesión) | Sincroniza la vuelta de Stripe |
| `POST /api/v1/pagos/stripe/webhook` | Firma de Stripe | Cambia el estado del pago, una sola vez por evento |
| `POST /api/v1/mando/leads/:id/estado` | operator | Mueve una solicitud por su ciclo (solo el abogado aprueba) |
| `POST /api/v1/mando/leads/:id/enlace-pago` | operator | Enlace de pago firmado para un expediente aprobado |
| `POST /api/v1/mando/leads/:id/ruta` | abogado (`ABOGADOS_EMAILS`) | Corrige respuestas antes de aprobar; ruta, citas y precio los recalcula el servidor |
| `POST /api/v1/expediente/vincular` | Sesión de cliente | Vincula un expediente a la cuenta con su código de camino |
| `GET /api/v1/mantenimiento/purgar` | Bearer `CRON_SECRET` (Vercel Cron) | Purga nocturna de lo que la política dice que se borra |

Formato de error: `{ error: { codigo, mensaje, correlationId, detalle? } }`.

## Decisiones

- **Diagnóstico sin IA.** La ruta y el precio tienen que ser reproducibles y auditables. La IA conversa (HESTIA); las reglas deciden.
- **Sin ORM.** Es la misma convención que BUROINSTANT, y las consultas son pocas y explícitas.
- **Google sin librería.** OIDC con PKCE, `state` y `nonce` hecho a mano (unas 100 líneas auditables) en vez de NextAuth: una sola dependencia menos que vigilar, y la misma sesión firmada sirve para equipo y clientes.
- **HESTIA orquesta, los motores deciden.** Un solo LLM con los cinco motores deterministas como herramientas, en vez de cinco LLM: cada cifra sale de código probado, y si la IA cae responde el modo local.
- **Seis idiomas tipados.** El tipo `Diccionario` obliga a que cada texto exista en los seis.
