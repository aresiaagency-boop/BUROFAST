# MEMORY · BUROFAST

## Plataformas (9 nov 2026)

| Pieza | Dónde |
| --- | --- |
| Producción | https://burofast.vercel.app (Vercel `aresiaagency/burofast`, Hobby, `lhr1`, despliega cada push a `main`) |
| Repo | github.com/aresiaagency-boop/BUROFAST — **público**: nada de secretos |
| PostgreSQL | EasyPanel `burofast/postgres`, puerto público (host y puerto en EasyPanel → postgres → Expose; **no se versionan**), servidor en Reino Unido, base `burofast` |
| n8n | https://burofast-n8n.7dklrk.easypanel.host, flujo de HESTIA `LzDIhpysxeGsOAsH` |
| Stripe | cuenta ARESIAAGENCY `acct_1U6yjPHpT9pLYTca`, **live**, compartida con FlyDish. Destino de webhook `burofast` (`we_1UZgpqHpT9pLYTcaVIAdEbh1`), 5 eventos, API 2026-10-28.endive |
| Google | proyecto `burofast-514123`, cliente OAuth «BUROFAST web», app en modo Prueba con el owner como usuario de prueba |

## Hechos verificados

- `npm run check` pasa con PostgreSQL 16 local: 181 pruebas (19 archivos), incluidas persistencia, cobros, vínculo de expediente y límites contra la base, y los evals de diagnóstico (26 casos) y HESTIA (37 casos).
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

## Fallos que encontraron las pruebas y el verificador (ya corregidos)

- Verificador independiente (9 nov): 2 críticos, 5 altos, 8 medios, 6 bajos. Corregidos los críticos, los altos y casi todos los medios:
  - HESTIA local no escalaba «quiero una persona», «I am a refugee», «Прошу притулку»…: raíces en vez de palabras, prefijos árabes también en frases, y red de seguridad en `conversar()` (asilo y persona siempre escalan, con IA o sin ella).
  - El backend tiraba la respuesta de n8n cuando `motor` venía `null`: el esquema acepta `nullish` y la prueba del flujo pasa la salida del nodo por `interpretarRespuestaN8n`.
  - Redirección abierta en el acceso con Google con `/\t/evil` y con `/es/../..//evil`: se rechazan controles y rutas que normalizadas empiezan por `//`.
  - Saltarse al abogado con un Checkout ya abierto: Checkout de 1 h, cierre de los abiertos al retirar la aprobación, conversión solo desde `aprobado` y aviso en el mando.
  - Cobro live sin datos legales: bloqueado (`LEGAL_PENDIENTE`).
  - El correo tecleado ataba el expediente a quien controlara ese correo: ahora se vincula con el código de camino (`email_verificado_en`).
  - Teléfono y nombre reales de un tercero dentro de una prueba: sustituidos por huellas SHA-256.
- El host y el puerto del PostgreSQL llegaron a publicarse en el commit `7745194`: retirados del árbol; siguen en el historial.
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

1. Owner: pegar en Vercel (tipo Secret) `DATABASE_URL`, `AUTH_SECRET`, `DATA_ENCRYPTION_KEY`, `GOOGLE_CLIENT_SECRET`, `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `HESTIA_N8N_TOKEN`, `HESTIA_CONTEXTO_TOKEN`, `HESTIA_EVENTOS_TOKEN` y `CRON_SECRET`; después, redeploy. `HESTIA_N8N_URL` y las variables de configuración ya están.
2. Owner: entrar en n8n (≥ 1.90) para importar `hestia.workflow.json` en `LzDIhpysxeGsOAsH`, crear las credenciales y activarlo.
3. Owner: rellenar `src/lib/legal.ts` (titular, NIF, domicilio, correo, registro, abogado, colegio, número). Hasta entonces no hay cobro live. En Google ya están la marca, los enlaces legales y el dominio: falta «Publicar app» para que entren los clientes.
4. Decisión del owner: reescribir el historial público (`git filter-repo`) para quitar el host del PostgreSQL y los datos del flujo original, o cambiar el puerto expuesto y la contraseña.
5. Seguridad: rol propio de PostgreSQL con permisos mínimos y TLS (`?sslmode=require`); rotar la API key de Evolution del `pinData` original; revisar que FlyDish ignora los eventos de Stripe de BUROFAST.
6. Pendiente del verificador: casilla de «empezar ya» antes de pagar (art. 108 TRLGDCU) y corrección de ruta y precio por el abogado durante la revisión.
7. Vercel Hobby es solo para uso no comercial: pasar a Pro antes de cobrar en serio.
