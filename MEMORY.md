# MEMORY · BUROFAST

## Plataformas (9 nov 2026)

| Pieza | Dónde |
| --- | --- |
| Producción | https://burofast.vercel.app (Vercel `aresiaagency/burofast`, Hobby, `lhr1`, despliega cada push a `main`) |
| Repo | github.com/aresiaagency-boop/BUROFAST — **público**: nada de secretos |
| PostgreSQL | EasyPanel `burofast/postgres`, expuesto en 72.61.18.243:47432 (servidor en Reino Unido), base `burofast` |
| n8n | https://burofast-n8n.7dklrk.easypanel.host, flujo de HESTIA `LzDIhpysxeGsOAsH` |
| Stripe | cuenta ARESIAAGENCY `acct_1U6yjPHpT9pLYTca`, **live**, compartida con FlyDish. Destino de webhook `burofast` (`we_1UZgpqHpT9pLYTcaVIAdEbh1`), 5 eventos, API 2026-10-28.endive |
| Google | proyecto `burofast-514123`, cliente OAuth «BUROFAST web», app en modo Prueba con el owner como usuario de prueba |

## Hechos verificados

- `npm run check` pasa con PostgreSQL 16 local: 152 pruebas (18 archivos), incluidas persistencia, cobros y límites contra la base, y los evals de diagnóstico (26 casos) y HESTIA (22 casos).
- Next 16: `middleware.ts` es `proxy.ts` y corre en Node; `PageProps`, `LayoutProps` y `RouteContext` salen de `npx next typegen` (hay que relanzarlo al crear rutas).
- Vercel: con `output: "standalone"` la build falla en `onBuildComplete` (`ENOENT .next/next-server.js.nft.json`). `next.config.ts` solo lo activa fuera de Vercel.
- En Vercel, `x-forwarded-for` lo escribe Vercel con la IP real: `TRUSTED_PROXY_HOPS=1` toma la buena.
- El formulario de variables de Vercel acepta un `.env` pegado en el campo Key: un `ClipboardEvent('paste')` con `DataTransfer` rellena todas las filas de golpe.
- Google Auth Platform enseña el secreto del cliente una sola vez al crearlo; si se pierde, «Agregar secreto».
- Stripe Workbench crea el destino con versión de API elegible: se eligió la del SDK (2026-10-28.endive).
- La cuenta de Stripe es compartida: cada webhook recibe los eventos de todas las apps. BUROFAST marca sus sesiones con `metadata.app = "burofast"` y responde 200 sin tocar la base a lo ajeno.
- Restricted key de Stripe: basta *Checkout Sessions: Escritura* (crear, leer y listar sesiones).
- `OWNER_PASSWORD_HASH` usa `:` como separador: con `$`, dotenv lo expandiría.
- El plugin claude-seo-ai bloquea escribir `.env.example`: las variables están en `docs/variables-entorno.md`.
- n8n Community no tiene `$vars`: configuración en un nodo Set y secretos en credenciales Header Auth.
- El tiempo «en España» no es tiempo de residencia legal; la autorización de 2026 nunca da todavía la nacionalidad. Portugal es UE (fuera de «iberoamericano»).
- Árabe: `letter-spacing` rompe las uniones de las letras; con `:lang(ar)` se pone a 0 en etiquetas HUD.
- Francés del producto con «vous»; portugués europeo con «tu»; ucraniano con «ви».

## Fallos que encontraron las pruebas (y ya están corregidos)

- Un anticipo pagado no convertía el expediente: el `update` solo aceptaba `nuevo/contactado/revision_abogado` y el pago exige `aprobado`. Lo destapó `pagos.integration.test.ts`.
- HESTIA local tomaba «tarjeta/card/carte/картка» como pago: en extranjería es la TIE. Lo destapó `eval/hestia.jsonl`.
- En árabe «اللجوء» (con artículo) no se reconocía como asilo: se prueba también sin el prefijo `ال`.

## Intentos fallidos

- `add_repo` con push: sin la GitHub App de Claude no hay permiso; se instaló desde el navegador.
- El shell de esta sesión no llega a Vercel, Stripe, n8n ni al PostgreSQL de EasyPanel: todo se configura por el navegador o por la integración GitHub → Vercel.
- La sesión de n8n caduca: con 401 en `/rest` o `/types/nodes.json` hay que pedir a la persona que vuelva a entrar (un agente no escribe contraseñas).
- `docker build` sin probar (no hay daemon de Docker en la sesión).

## Última sesión (9 nov 2026)

Superapp holográfica en producción: núcleo HESTIA, cinco motores con agentes, expediente con Google, cobro del anticipo con Stripe tras la aprobación del abogado, páginas legales en seis idiomas, canal app de HESTIA en el flujo de n8n (construido y probado por contrato). En Vercel están las variables de configuración; faltan los secretos, que pega el owner.

## Próximos pasos

1. Owner: pegar en Vercel `DATABASE_URL`, `AUTH_SECRET`, `DATA_ENCRYPTION_KEY`, `GOOGLE_CLIENT_SECRET`, `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `HESTIA_N8N_TOKEN`, `HESTIA_CONTEXTO_TOKEN` y `HESTIA_EVENTOS_TOKEN`; redeploy.
2. Owner: entrar en n8n para importar `hestia.workflow.json` en `LzDIhpysxeGsOAsH`, crear credenciales, activar y poner `HESTIA_N8N_URL`.
3. Owner: rellenar `src/lib/legal.ts` (titular, NIF, domicilio, correo, registro, abogado, colegio, número). Después, en Google: página principal, privacidad, condiciones, dominio `burofast.vercel.app` y «Publicar app» para que los clientes entren con Google.
4. Seguridad: rol propio de PostgreSQL con permisos mínimos y TLS; rotar la API key de Evolution del `pinData` original; revisar que FlyDish ignora los eventos de Stripe de BUROFAST.
5. Purga programada de solicitudes no convertidas a los 12 meses (la política de privacidad ya lo promete).
6. Vercel Hobby es solo para uso no comercial: pasar a Pro antes de cobrar en serio.
