# BUROFAST · superapp

Oficina de extranjería automatizada: **del primer NIE a la nacionalidad**. Producción: https://burofast.vercel.app

HESTIA (IA) orquesta a cinco agentes, cada uno con un motor determinista:

| Agente | Motor | Ruta | Qué calcula |
| --- | --- | --- | --- |
| ARIADNA | Camino | `/{idioma}/camino` | La ruta, sus citas y el plan con precio por nivel de citas |
| CRONOS | Citas | `/{idioma}/citas` | Qué cita, quién la da, cuándo y cuánto cuesta gestionarla (la cita es gratis) |
| MNEMÓSINE | Documentos | `/{idioma}/documentos` | Qué reunir, qué legalizar o traducir, qué tiene que ser reciente |
| ARGOS | Guardián | `/{idioma}/guardian` | Ventana de renovación (60 días antes → 90 después) y recordatorio `.ics` |
| TEMIS | Garantías | todas | Las reglas que ningún agente se salta |

Además:

- **Expediente** (`/{idioma}/expediente`): el cliente entra con Google y ve su caso, sus citas y sus pagos. Paga el anticipo (50 %) solo cuando un abogado ha aprobado su ruta.
- **Centro de mando** (`/mando`): acceso con Google (o contraseña de respaldo), estado real de cada pieza, solicitudes, citas, pagos y métricas de HESTIA.
- **HESTIA en n8n** (`infrastructure/n8n/hestia.workflow.json`): canal WhatsApp y canal app con los motores como herramientas. Sin n8n, la consola responde en modo local y lo dice.
- **Legal** (`/{idioma}/legal/privacidad|condiciones|aviso-legal`): seis idiomas; los datos del titular y del abogado viven en `src/lib/legal.ts` y se ven como «pendiente» hasta rellenarlos.

Seis idiomas en todo: es, en, fr, pt, ar (derecha a izquierda) y uk.

## Arranque local

```bash
npm ci
# Variables: docs/variables-entorno.md (crea tu .env.local a partir de esa lista)
npm run migrate
npm run seed:demo        # opcional: 5 solicitudes DEMO (marcadas como tales)
npm run dev              # http://localhost:3000
```

## Comprobaciones

```bash
npm run check            # lint + typecheck + test + build
npm run eval             # eval/diagnostico.jsonl y eval/hestia.jsonl
npm run screenshots      # capturas de cada pantalla (servidor en marcha; CAPTURAS_EMAIL/PASSWORD para el mando)
```

Las pruebas de integración (persistencia, cobros, límites) se saltan solas sin `DATABASE_URL` y `DATA_ENCRYPTION_KEY`. Si baja el número de pruebas, es eso.

## Despliegue

- **Vercel** (producción): proyecto `aresiaagency/burofast`, conectado a este repositorio; cada push a `main` despliega. Funciones en Londres (`lhr1`), junto al PostgreSQL. La build aplica las migraciones.
- **Docker / EasyPanel** (alternativa): `infrastructure/docker/Dockerfile` con salida standalone. Operación, backup y rollback: `docs/operations-runbook.md`.

## Mapa

| Ruta | Qué es |
| --- | --- |
| `src/lib/diagnostico.ts` | Motor de rutas, auditado por `eval/diagnostico.jsonl` |
| `src/lib/motores.ts` | Los cinco motores y sus agentes |
| `src/lib/catalogo.ts` | Única fuente de precios, citas y niveles Urgente / Puedo esperar |
| `src/lib/hestia/` | Orquestador (backend ↔ n8n), modo local e intenciones, auditadas por `eval/hestia.jsonl` |
| `src/lib/pagos/` | Stripe Checkout, webhook idempotente y repositorio de pagos |
| `src/lib/auth/` | Google OIDC (PKCE + state + nonce), sesión de cliente y equipo |
| `src/lib/legal.ts` | Datos legales del titular y del abogado |
| `src/lib/i18n/` | Diccionarios (y `legal/`) con el mismo contrato de tipos en seis idiomas |
| `src/styles/` | Sistema de cristal de diamante con filo de plasma |
| `src/app/api/v1/` | API versionada (ver `docs/architecture.md`) |
| `infrastructure/n8n/` | HESTIA: flujo, prompts y guía de importación |
