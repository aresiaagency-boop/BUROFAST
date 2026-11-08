@AGENTS.md

# BUROFAST

Oficina de extranjería automatizada de A.R.E.S. (Palma → toda España). El
cliente recorre un camino paso a paso en su idioma; HESTIA (agente de IA en
WhatsApp, n8n) acompaña; un abogado colegiado firma lo que hay que firmar.
El objetivo no es informar de trámites: es que la persona llegue a su meta.

## Stack

| Pieza | Versión / nota |
| --- | --- |
| Next.js | 16.3.4, App Router, `type: module`. `middleware` ahora es `src/proxy.ts` |
| React | 19.2.8 |
| TypeScript | estricto, sin `any` |
| Node | `>=22 <25` |
| PostgreSQL | `postgres` (porsager). **Sin ORM**, SQL a mano |
| Migraciones | `db/migrations/*.sql`, se aplican con `npm run migrate` y al arrancar el contenedor |
| Validación | Zod 4 |
| Pruebas | vitest 4; capturas con Playwright del sistema (`npm run screenshots`) |
| Auth | sesión propia firmada con HMAC (`AUTH_SECRET`), rol owner en fase 1 |
| HESTIA | n8n + Evolution API + OpenAI (modelo del flujo original) |
| Despliegue | Docker standalone en EasyPanel |

## Comandos

```bash
npm run check        # lint + typecheck + test + build. Tiene que pasar antes de un commit.
npm run eval         # casos de eval/diagnostico.jsonl
npm run screenshots  # evidencia visual de cada paso del funnel y del mando
npx next typegen     # genera PageProps/RouteContext si tsc no los encuentra
```

## Estilo

- Dominio en castellano (`diagnosticar`, `presupuesto`, `venceSla`); plataforma como la nombra la plataforma.
- Comentarios en castellano y solo para el *por qué*.
- Una regla vive en un sitio: precios en `catalogo.ts`, transiciones en `citas.ts`, rutas en `diagnostico.ts`. La interfaz pinta; el servidor decide (el precio se recalcula en el servidor).
- Ningún texto visible fuera de `src/lib/i18n/*`. Un texto nuevo va a los seis idiomas o `tsc` falla.
- Estados de datos honestos: nunca «operativo» sin comprobación reciente; DEMO siempre marcado.

## Archivos que no se tocan

- `AGENTS.md` (lo reescribe `next dev`).
- Cualquier `.env*`. Las variables se documentan en `docs/variables-entorno.md`.
- `infrastructure/n8n/hestia-whatsapp.workflow.json` a mano: se regenera con `scripts/n8n/construir-hestia.py`. Nunca con `pinData`.

## Revisión

1. `npm run check` en verde CON `DATABASE_URL` y `DATA_ENCRYPTION_KEY` (si no, la persistencia no se probó).
2. ¿Se puede saltar la regla desde la consola del navegador? Entonces está en el sitio equivocado.
3. Si cambia una pantalla: `npm run screenshots` y mirar las capturas, no solo el log.
4. Si cambia el diagnóstico: un caso nuevo en `eval/diagnostico.jsonl`.
5. ¿Algún secreto en código, fixture, log o commit?

## Prohibiciones

- Nada que automatice el acceso a webs de cita previa (bots, scraping, reserva masiva). Es delito de daños informáticos y es la línea roja de la marca.
- Nada de prometer resultados de la Administración en textos, prompts o anuncios.
- Asilo y protección internacional: siempre una persona, sin coste.
- No guardar datos personales sin cifrar ni sin consentimiento.
