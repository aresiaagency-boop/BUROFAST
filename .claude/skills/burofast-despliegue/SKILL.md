---
name: burofast-despliegue
description: Comprobar y publicar BUROFAST en producción (check con base de datos, evals, capturas, push a main, Vercel Ready y sondas en burofast.vercel.app). Úsala antes de cada push y después de tocar cobros, acceso, HESTIA o pantallas.
---

# Despliegue de BUROFAST

Producción: https://burofast.vercel.app · Vercel `aresiaagency/burofast` despliega cada push a `main`. El repo es PÚBLICO.

## 1. Verde en local, con base de datos

```bash
source /tmp/burofast-local.sh   # o tu .env.local: DATABASE_URL y DATA_ENCRYPTION_KEY obligatorios
npm run check                   # lint + typecheck + test + build
npm run eval                    # eval/diagnostico.jsonl y eval/hestia.jsonl
```

Si el número de pruebas baja, las de integración se saltaron: falta la base. No sigas.

## 2. Evidencia visual (si cambió una pantalla)

```bash
npx next start -p 3000 &        # con el build del paso 1
CAPTURAS_EMAIL=… CAPTURAS_PASSWORD=… npm run screenshots
```

Mira las capturas de `artifacts/capturas/` (escritorio, árabe RTL y móvil), no solo el log.

## 3. Nada secreto en el commit

```bash
git add -A && git diff --cached | grep -nE "sk_live|rk_live|whsec_[A-Za-z0-9]{8}|GOCSPX|[0-9A-F]{8}-[0-9A-F]{4}-[0-9A-F]{4}-[0-9A-F]{4}-[0-9A-F]{12}"
```

Solo pueden salir placeholders de documentación.

## 4. Publicar y comprobar

1. Commit en castellano y `git push origin main`.
2. Vercel → Deployments: el despliegue del commit tiene que acabar en **Ready**. Si falla en `onBuildComplete`, alguien activó `output: "standalone"` en Vercel.
3. Sondas en producción (desde el navegador, el shell no llega a Vercel):
   - `GET /health/ready` → 200 cuando hay base y clave de cifrado.
   - `POST /api/v1/motores/argos` con `{"caducidad":"2027-03-01","hoy":"2026-11-09"}` → `estado: "lejos"`.
   - `/es/legal/aviso-legal` → cuántos datos «pendiente» quedan.
   - `/mando` → la pieza que no esté «operativo» dice qué falta.

## Reglas

- Un agente nunca escribe secretos en Vercel, Stripe, Google ni n8n: los pega una persona.
- Variables nuevas: documéntalas en `docs/variables-entorno.md`.
- Después de desplegar, apunta en `MEMORY.md` lo aprendido (hechos, fallos, próximos pasos).
