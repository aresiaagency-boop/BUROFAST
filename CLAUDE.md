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
| Auth | Google OIDC hecho a mano (PKCE + state + nonce) y sesión en servidor (`direccion_sesiones`) con cookie `__Host-` Strict firmada con HMAC (`AUTH_SECRET`). La Dirección (`/mando`) solo admite la cuenta de Google de `OWNER_EMAIL`: sin contraseñas |
| Pagos | Stripe Checkout (stripe@23, API 2026-10-28.endive), cuenta de ARES compartida con otras apps: solo se procesan sesiones con `metadata.app = "burofast"` |
| HESTIA | n8n (EasyPanel) + OpenAI gpt-4o-mini; canal WhatsApp (Evolution) y canal app; sin n8n, modo local |
| Despliegue | Vercel (`lhr1`, sin `output: standalone`); Docker standalone como alternativa |
| PostgreSQL | EasyPanel con puerto público (Reino Unido). Host y puerto no se versionan |

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
- Documentos del cliente: solo en la bóveda (`documentos.ts`), cifrados, con consentimiento y cada acceso auditado. Lo que se calcule desde `leads` descifra antes `situacion`.
- IRIS (IA) solo describe un documento; el verde lo decide `iris.ts` con reglas fijas (`decidirRevision`, casos en `eval/iris.jsonl`). Nunca rechaza: el ámbar lo mira una persona. Antecedentes penales nunca van a IRIS. El verde deja seguir; el precio solo cambia cuando el abogado valida (`CITA_SE_CUBRE_CON` + `replanificarPorDocumentos`: solo toca las citas cubiertas y ajusta por diferencia, antes de aprobar y sin pagos).
- Una regla vive en un sitio: precios en `catalogo.ts`, transiciones en `citas.ts` y `leads.ts`, rutas en `diagnostico.ts`, motores en `motores.ts`, datos legales en `legal.ts`. La interfaz pinta; el servidor decide (el precio se recalcula en el servidor).
- Ningún texto visible fuera de `src/lib/i18n/*` (los textos legales en `src/lib/i18n/legal/`). Un texto nuevo va a los seis idiomas o `tsc` falla. Francés con «vous», portugués europeo con «tu», ucraniano con «ви».
- Los componentes cliente reciben por props los textos que no están en el diccionario general (no se importa `LEGALES` en cliente).
- Estados de datos honestos: nunca «operativo» sin comprobación reciente; DEMO siempre marcado.

## Archivos que no se tocan

- `AGENTS.md` (lo reescribe `next dev`).
- Cualquier `.env*`. Las variables se documentan en `docs/variables-entorno.md`.
- `infrastructure/n8n/hestia.workflow.json` e `iris.workflow.json` a mano: se regeneran con `scripts/n8n/construir-hestia.py`. Nunca con `pinData`. IRIS va en su propio flujo sin historial de ejecuciones (los documentos no se quedan en n8n).
- `public/mapa/mapamundi.jpg`: el mapamundi de A.R.E.S., tal cual. Todo el radar se dibuja encima, sobre su plano.
- `public/mapa/paises.<hash>.json` y `src/lib/radar-paises.ts` a mano: se regeneran con `scripts/mapa/generar-paises.mjs` (zonas de idioma y grupos de pasaporte viven en ese script; la calibración, en `src/lib/mapa-calibracion.json`).

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
