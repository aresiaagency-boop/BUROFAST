# Arquitectura · BUROFAST fase 1

Es un monolito modular en Next.js 16. No hay microservicios. HESTIA vive en n8n y habla con la aplicación solo por dos endpoints, los dos autenticados.

```
Cliente (móvil)                Equipo
   │ funnel /{idioma}/camino       │ /mando (sesión HMAC, rol)
   ▼                               ▼
Next.js 16 · App Router · proxy.ts (sesión + idioma)
   ├── lib/diagnostico     reglas de ruta (sin IA) + eval
   ├── lib/catalogo        precios, citas, niveles Urgente / Puedo esperar
   ├── lib/citas           ciclo de vida + semáforo de plazo
   ├── lib/repositorio     SQL a mano (postgres) + cifrado de PII
   └── api/v1/*            Zod en cada entrada, correlation_id en cada salida
   │
   ├── PostgreSQL 16  leads · citas · cita_eventos · hestia_eventos · audit_logs
   │
   └── n8n (HESTIA) ──GET  /api/v1/hestia/contexto (Bearer de lectura)
                    └─POST /api/v1/hestia/eventos  (Bearer de eventos + ventana de 5 min)
       ▲
   Evolution API (WhatsApp) → webhook n8n
```

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

Formato de error: `{ error: { codigo, mensaje, correlationId, detalle? } }`.

## Decisiones

- **Diagnóstico sin IA.** La ruta y el precio tienen que ser reproducibles y auditables. La IA conversa (HESTIA); las reglas deciden.
- **Sin ORM.** Es la misma convención que BUROINSTANT, y las consultas son pocas y explícitas.
- **Sesión propia en fase 1.** Se puede probar sin proveedores externos. En fase 2 se pasa a Google con NextAuth, compartido con BUROINSTANT.
- **Seis idiomas tipados.** El tipo `Diccionario` obliga a que cada texto exista en los seis.
