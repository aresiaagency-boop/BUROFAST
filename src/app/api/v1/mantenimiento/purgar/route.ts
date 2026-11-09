import { isDatabaseConfigured } from "@/lib/db";
import { correlationId, error, json, log } from "@/lib/http";
import { purgar } from "@/lib/mantenimiento";
import { auditar } from "@/lib/repositorio";
import { verifyMachineBearer } from "@/lib/security/hmac";

// La llama Vercel Cron cada noche (vercel.json) con Authorization: Bearer
// CRON_SECRET. Sin ese secreto no hace nada.
export async function GET(request: Request) {
  const correlation = correlationId(request);
  const secreto = process.env.CRON_SECRET?.trim();
  if (!secreto) return error("PURGA_NO_CONFIGURADA", "Falta CRON_SECRET en el servidor.", { status: 503, correlation });
  if (!verifyMachineBearer(secreto, request.headers.get("authorization"))) return error("NO_AUTORIZADO", "Credencial no válida.", { status: 401, correlation });
  if (!isDatabaseConfigured()) return error("SIN_BASE_DE_DATOS", "Base de datos no configurada.", { status: 503, correlation });
  const borrado = await purgar();
  await auditar({ actorId: "cron", accion: "mantenimiento.purgar", parametros: borrado, resultado: "ok", correlationId: correlation });
  log("info", "purga", { correlation, ...borrado });
  return json({ ok: true, borrado }, { correlation });
}
