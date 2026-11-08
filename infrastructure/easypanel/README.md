# EasyPanel

La guía de despliegue completa está en `docs/operations-runbook.md`. Resumen: servicio App con `infrastructure/docker/Dockerfile` (puerto 3000, healthcheck `/health/live`), Postgres 16 interno, variables de `docs/variables-entorno.md` y dominio con HTTPS.
