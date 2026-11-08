import { z } from "zod";
import { exigirRol } from "@/lib/autorizacion";
import { isDatabaseConfigured } from "@/lib/db";
import { correlationId, error, json, origenPermitido } from "@/lib/http";
import { auditar, cambiarEstadoCita } from "@/lib/repositorio";
import { cambioEstadoCitaSchema } from "@/lib/schemas";

export async function POST(request: Request, ctx: RouteContext<"/api/v1/mando/citas/[id]/estado">) {
  const correlation = correlationId(request);
  if (!origenPermitido(request)) return error("ORIGEN_NO_PERMITIDO", "La petición no viene de BUROFAST.", { status: 403, correlation });
  const sesion = await exigirRol("operator");
  if (!sesion) return error("SIN_PERMISO", "Cambiar el estado de una cita requiere rol operator u owner.", { status: 403, correlation });
  if (!isDatabaseConfigured()) return error("SIN_BASE_DE_DATOS", "DATABASE_URL no está configurada.", { status: 503, correlation });

  const { id } = await ctx.params;
  if (!z.uuid().safeParse(id).success) return error("ID_INVALIDO", "El identificador de la cita no es válido.", { status: 400, correlation });
  const cambio = cambioEstadoCitaSchema.safeParse(await request.json().catch(() => null));
  if (!cambio.success) return error("CAMBIO_INVALIDO", "El estado o los datos de la cita no son válidos.", { status: 400, correlation });

  const resultado = await cambiarEstadoCita({ citaId: id, ...cambio.data, actor: sesion.sub });
  await auditar({
    actorId: sesion.sub,
    accion: "cita.cambiar_estado",
    objetivoId: id,
    parametros: { hacia: cambio.data.estado, desde: "desde" in resultado ? resultado.desde : null },
    resultado: resultado.ok ? "ok" : "rechazado",
    correlationId: correlation,
  });
  if (!resultado.ok) {
    const status = resultado.motivo === "CITA_NO_EXISTE" ? 404 : 409;
    return error(resultado.motivo, resultado.motivo === "CITA_NO_EXISTE" ? "La cita no existe." : "Ese cambio de estado no está permitido desde el estado actual.", { status, correlation });
  }
  return json({ ok: true, estado: cambio.data.estado }, { correlation });
}
