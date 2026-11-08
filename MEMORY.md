# MEMORY · BUROFAST

## Hechos verificados (5 nov 2026)

- Stack heredado de BUROINSTANT (mismas versiones de Next, React, postgres, Zod y vitest).
- `npm run check` pasa con PostgreSQL 16 local: 66 pruebas, incluidas 3 de persistencia real y 20 casos del eval de diagnóstico.
- El servidor standalone arranca, migra y responde `/health/ready` con 200 si recibe `node_modules/postgres` (el Dockerfile lo copia; Next lo empaqueta en sus chunks, pero `scripts/migrate.mjs` lo necesita suelto).
- Next 16: `middleware.ts` es `proxy.ts` y corre en Node; `PageProps` y `RouteContext` salen de `npx next typegen`.
- `OWNER_PASSWORD_HASH` usa `:` como separador: con `$`, dotenv lo expandiría y el hash llegaría roto.
- El plugin claude-seo-ai bloquea escribir `.env.example` en estas sesiones: las variables están en `docs/variables-entorno.md`.
- La regla de React `react-hooks/set-state-in-effect` impide `setState` directo en efectos: el flag `restaurado` vive en el reducer.
- n8n Community no tiene `$vars`. La configuración va en un nodo Set y los secretos en credenciales Header Auth. Por eso los eventos van con Bearer y la firma HMAC queda como alternativa.
- El tiempo «en España» no es tiempo de residencia legal. Con autorización, el funnel pregunta por la residencia legal, que es la que cuenta para nacionalidad, larga duración y reagrupación. La autorización de 2026 nunca da todavía la nacionalidad.
- Portugal es UE: sale de la lista «iberoamericano» del funnel, y su plazo de nacionalidad de 2 años lo revisa el abogado.
- Huellas, recogida de la TIE y jura nacen `en_espera`: su plazo y su garantía empiezan al activarlas, cuando llega la resolución.

## Intentos fallidos

- Importar Playwright con `import` desde un `.mjs`: falla, porque NODE_PATH solo aplica a `require`. Se usa `createRequire`.
- `docker build`: no se pudo probar, porque esta sesión no tiene daemon de Docker. El Dockerfile está sin verificar en una build real.
- Flujo n8n: solo se ha verificado por contrato (`src/lib/hestia-flujo.test.ts`). No se ha importado ni ejecutado en un n8n real.

## Última sesión

Fase 1 construida: funnel en 6 idiomas, sección de citas con niveles, centro de mando con login y auditoría, API v1, HESTIA en n8n y Docker. Un verificador independiente encontró 7 problemas importantes; quedan corregidos y cubiertos por pruebas, salvo la autenticación del webhook de Evolution, que se mitiga con una ruta propia por despliegue.

## Próximos pasos

1. Importar el flujo en el n8n de EasyPanel, crear las dos credenciales y las variables `$vars`, y probarlo con un número de test.
2. Rotar la API key de Evolution que aparece en el `pinData` del flujo original.
3. Fase 2: cobro con Stripe por hitos (el plan ya calcula 50/50), portal seguro de documentos, roles operator y viewer con usuarios reales, y acceso con Google compartido con BUROINSTANT.
4. Recalcular el modelo financiero mensual con la línea de citas.
