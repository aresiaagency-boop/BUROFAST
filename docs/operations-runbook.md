# Runbook de operación · BUROFAST

## Despliegue en EasyPanel

1. Crea un servicio **App** desde el repositorio, con el Dockerfile `infrastructure/docker/Dockerfile`.
2. Crea un servicio **Postgres 16** en el mismo proyecto. No publiques su puerto.
3. Pon las variables de `docs/variables-entorno.md` en el servicio App. `DATABASE_URL` debe apuntar al host interno de Postgres.
4. Dominio con HTTPS en el servicio App, puerto 3000.
5. Healthcheck: `/health/live`. La comprobación de que está listo es `/health/ready`, que devuelve 503 si la base de datos o la clave de cifrado fallan.
6. Las migraciones corren solas al arrancar el contenedor (`node scripts/migrate.mjs`). Si una migración aplicada cambia de contenido, el arranque se detiene con `MIGRATION_CHECKSUM_MISMATCH`.

## Comprobación tras desplegar

```bash
curl -s https://<dominio>/health/ready        # {"listo":true,...}
curl -s https://<dominio>/api/v1/catalogo     # precios
```

Después entra en `/mando` y revisa que la tabla de sistemas no tenga piezas en rojo.

## Backups

- Volcado diario: `pg_dump -Fc "$DATABASE_URL" > burofast-$(date +%F).dump`. Guarda 30 días fuera del servidor.
- Haz una prueba de restauración cada mes en staging: `pg_restore -d "$DATABASE_URL_STAGING" --clean burofast-AAAA-MM-DD.dump`.
- **`DATA_ENCRYPTION_KEY` va aparte del backup.** Sin ella, el backup no se puede leer, y con ella junto al backup el cifrado no protege nada.

## Rollback

1. En EasyPanel, vuelve a desplegar la imagen anterior.
2. Las migraciones solo añaden: una versión anterior funciona sobre el esquema nuevo. Si una migración futura no cumple esto, debe traer su script de vuelta atrás en `db/rollback/`.

## Incidentes

| Síntoma | Dónde mirar | Acción |
| --- | --- | --- |
| `/health/ready` 503 con postgres desconectado | Servicio Postgres en EasyPanel | Revisa el estado, `DATABASE_URL` y la red interna |
| Solicitudes con 503 `SERVICIO_NO_CONFIGURADO` | Variables del servicio App | Falta `DATABASE_URL` o `DATA_ENCRYPTION_KEY` |
| HESTIA no responde | n8n → ejecuciones del flujo | Credenciales, `$vars` y webhook de Evolution |
| Eventos de HESTIA con 401 `FIRMA_INVALIDA` | Hora del servidor n8n y `$vars.HESTIA_WEBHOOK_SECRET` | La ventana antirreplay es de 5 min; sincroniza con NTP |
| Citas con «Primera acción vencida» | `/mando/citas` | Atiende primero las urgentes, ordenadas por plazo |

## Pausa de emergencia

Para dejar de aceptar solicitudes sin borrar nada, quita `DATA_ENCRYPTION_KEY` del servicio y reinicia. El funnel sigue visible y `/api/v1/leads` devuelve 503. Para HESTIA, desactiva el flujo en n8n.
