# BUROFAST · fase 1

Oficina de extranjería automatizada: **del primer NIE a la nacionalidad**.
HESTIA es su agente de IA. La fase 1 incluye tres piezas:

1. **El camino** (`/`, `/{idioma}/camino`). Un funnel de una pregunta por pantalla, en seis idiomas (es, en, fr, pt, ar con escritura de derecha a izquierda, uk). Lleva una narrativa por capítulos y un sendero ilustrado hacia el hogar. Termina en una ruta, las citas que esa ruta necesita, el nivel de gestión de citas (**Urgente** o **Puedo esperar**), el plan con precio y la solicitud con consentimiento.
2. **El centro de mando** (`/mando`). Acceso con sesión firmada. Incluye estado real de sistemas, KPIs con fuente y hora, la cola de **expedición y seguimiento de citas** con plazo de primera acción y garantía, solicitudes con datos cifrados y teléfono enmascarado, HESTIA y auditoría.
3. **HESTIA en n8n** (`infrastructure/n8n/hestia-whatsapp.workflow.json`). Se construye desde el flujo original `AgenteWhatsapp.json`, sin secretos. Funciona en n8n Community (sin `$vars`), lee el contexto vivo de BUROFAST y registra cada evento con credencial propia.

## Arranque local

```bash
npm ci
# Variables: ver docs/variables-entorno.md (crea tu archivo .env.local a partir de esa lista)
npm run migrate
npm run seed:demo        # opcional: 5 solicitudes DEMO (marcadas como tales)
npm run dev              # http://localhost:3000
```

Contraseña del centro de mando: `printf '%s' 'tu-frase-larga' | npm run -s hash-password` → `OWNER_PASSWORD_HASH`.

## Comprobaciones

```bash
npm run check            # lint + typecheck + test + build
npm run eval             # solo los casos de eval/diagnostico.jsonl
npm run screenshots      # capturas de cada paso (servidor en marcha; CAPTURAS_EMAIL/PASSWORD para el mando)
```

Las pruebas de integración se saltan solas sin `DATABASE_URL` y `DATA_ENCRYPTION_KEY`. Si baja el número de pruebas, es eso: la persistencia **no** se ha probado.

## Despliegue

Docker: `infrastructure/docker/Dockerfile` (Next standalone; migra al arrancar) y `docker-compose.yml` (web + PostgreSQL 16 sin puerto público). EasyPanel: `infrastructure/easypanel/README.md`. Operación, backup y rollback: `docs/operations-runbook.md`.

## Mapa

| Ruta | Qué es |
| --- | --- |
| `src/lib/diagnostico.ts` | Motor de rutas determinista (sin IA), auditado por `eval/diagnostico.jsonl` |
| `src/lib/catalogo.ts` | Única fuente de precios, citas y niveles Urgente / Puedo esperar |
| `src/lib/citas.ts` | Ciclo de vida de una cita y semáforo de plazo |
| `src/lib/i18n/` | Seis diccionarios con el mismo contrato de tipos |
| `src/components/funnel/` | Funnel paso a paso e ilustración del sendero |
| `src/app/mando/` | Centro de mando |
| `src/app/api/v1/` | API versionada (ver `docs/architecture.md`) |
| `infrastructure/n8n/` | HESTIA: flujo, prompt y guía de importación |
