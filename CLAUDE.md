@AGENTS.md

# BUROFAST

Oficina de extranjería automatizada de A.R.E.S. (Palma → toda España), como
superapp: HESTIA (IA en n8n) orquesta a cinco agentes con motores
deterministas (ARIADNA rutas, CRONOS citas, MNEMÓSINE documentos, ARGOS
plazos, TEMIS garantías); un abogado colegiado aprueba la ruta antes de
cobrar. El objetivo no es informar de trámites: es que la persona llegue a su meta.
Producción: https://burofast.vercel.app · repo público aresiaagency-boop/BUROFAST.

## Stack

| Pieza | Versión / nota |
| --- | --- |
| Next.js | 16.3.4, App Router, `type: module`. `middleware` ahora es `src/proxy.ts` |
| React | 19.2.8 |
| TypeScript | estricto, sin `any` |
| Node | `>=22 <25` |
| PostgreSQL | `postgres` (porsager). **Sin ORM**, SQL a mano |
| Migraciones | `db/migrations/*.sql`, se aplican con `npm run migrate`, en cada build (Vercel) y al arrancar el contenedor |
| Validación | Zod 4 |
| Pruebas | vitest 4; capturas con Playwright del sistema (`npm run screenshots`) |
| Auth | Google OIDC hecho a mano (PKCE + state + nonce) y sesión propia firmada con HMAC (`AUTH_SECRET`); contraseña de respaldo para el owner |
| Pagos | Stripe Checkout (stripe@23, API 2026-10-28.endive), cuenta de ARES compartida con otras apps: solo se procesan sesiones con `metadata.app = "burofast"` |
| HESTIA | n8n (EasyPanel) + OpenAI gpt-4o-mini; canal WhatsApp (Evolution) y canal app; sin n8n, modo local |
| Despliegue | Vercel (`lhr1`, sin `output: standalone`); Docker standalone como alternativa |
| PostgreSQL | EasyPanel, puerto público 47432 (Reino Unido) |

## Comandos

```bash
npm run check        # lint + typecheck + test + build. Tiene que pasar antes de un commit.
npm run eval         # eval/diagnostico.jsonl y eval/hestia.jsonl
npm run screenshots  # evidencia visual de cada paso del funnel y del mando
npx next typegen     # genera PageProps/RouteContext si tsc no los encuentra
```

## Estilo

- Dominio en castellano (`diagnosticar`, `presupuesto`, `venceSla`); plataforma como la nombra la plataforma.
- Comentarios en castellano y solo para el *por qué*.
- Una regla vive en un sitio: precios en `catalogo.ts`, transiciones en `citas.ts` y `leads.ts`, rutas en `diagnostico.ts`, motores en `motores.ts`, datos legales en `legal.ts`. La interfaz pinta; el servidor decide (el precio se recalcula en el servidor).
- Ningún texto visible fuera de `src/lib/i18n/*` (los textos legales en `src/lib/i18n/legal/`). Un texto nuevo va a los seis idiomas o `tsc` falla. Francés con «vous», portugués europeo con «tu», ucraniano con «ви».
- Los componentes cliente reciben por props los textos que no están en el diccionario general (no se importa `LEGALES` en cliente).
- Estados de datos honestos: nunca «operativo» sin comprobación reciente; DEMO siempre marcado.

## Archivos que no se tocan

- `AGENTS.md` (lo reescribe `next dev`).
- Cualquier `.env*`. Las variables se documentan en `docs/variables-entorno.md`.
- `infrastructure/n8n/hestia.workflow.json` a mano: se regenera con `scripts/n8n/construir-hestia.py`. Nunca con `pinData`.

## Revisión

1. `npm run check` en verde CON `DATABASE_URL` y `DATA_ENCRYPTION_KEY` (si no, la persistencia no se probó).
2. ¿Se puede saltar la regla desde la consola del navegador? Entonces está en el sitio equivocado.
3. Si cambia una pantalla: `npm run screenshots` y mirar las capturas, no solo el log.
4. Si cambia el diagnóstico: un caso nuevo en `eval/diagnostico.jsonl`. Si HESTIA contesta mal: un caso en `eval/hestia.jsonl`.
5. ¿Algún secreto en código, fixture, log o commit? El repo es PÚBLICO.
6. Cobros: ¿sigue haciendo falta `aprobado` para pagar, y el webhook ignora lo que no es de BUROFAST?

## Prohibiciones

- Nada que automatice el acceso a webs de cita previa (bots, scraping, reserva masiva). Es delito de daños informáticos y es la línea roja de la marca.
- Nada de prometer resultados de la Administración en textos, prompts o anuncios.
- Asilo y protección internacional: siempre una persona, sin coste.
- No guardar datos personales sin cifrar ni sin consentimiento.
- No cobrar antes de que un abogado apruebe la ruta.
- Ningún agente escribe secretos en formularios: las claves las pega una persona.
