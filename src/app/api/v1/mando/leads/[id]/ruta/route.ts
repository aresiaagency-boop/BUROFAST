import { z } from "zod";
import { puedeConfirmarRuta } from "@/lib/auth/equipo";
import { exigirRol } from "@/lib/autorizacion";
import { NIVELES_CITA } from "@/lib/catalogo";
import { isDatabaseConfigured } from "@/lib/db";
import { respuestasSchema } from "@/lib/diagnostico";
import { correlationId, error, json, origenPermitido } from "@/lib/http";
import { auditar, corregirRuta } from "@/lib/repositorio";
import { respuestasCoherentes } from "@/lib/schemas";

const nivelesCita = Object.keys(NIVELES_CITA) as [keyof typeof NIVELES_CITA, ...(keyof typeof NIVELES_CITA)[]];
const correccionSchema = z.object({
  respuestas: respuestasSchema,
  nivelCita: z.enum(nivelesCita).nullable(),
  conGuardian: z.boolean(),
}).refine((c) => respuestasCoherentes(c.respuestas), { path: ["respuestas"], message: "RESPUESTAS_INCOHERENTES" });

const MENSAJE: Record<string, string> = {
  LEAD_NO_EXISTE: "La solicitud no existe.",
  ESTADO_NO_PERMITE: "La ruta solo se corrige antes de aprobarla (nuevo, contactado o en revisión).",
  TIENE_PAGOS: "Esta solicitud ya tiene pagos: no se puede cambiar su precio.",
  CITAS_EN_CURSO: "El equipo ya está gestionando alguna cita de esta solicitud.",
};

// El abogado corrige la ruta mientras la revisa. Las respuestas cambian; la
// ruta, las citas y el precio los recalcula el servidor (nunca llegan cifras).
export async function POST(request: Request, ctx: RouteContext<"/api/v1/mando/leads/[id]/ruta">) {
  const correlation = correlationId(request);
  if (!origenPermitido(request)) return error("ORIGEN_NO_PERMITIDO", "La petición no viene de BUROFAST.", { status: 403, correlation });
  const sesion = await exigirRol("operator");
  if (!sesion) return error("SIN_PERMISO", "Corregir una ruta requiere rol operator u owner.", { status: 403, correlation });
  if (!puedeConfirmarRuta(sesion.sub, sesion.rol)) {
    return error("SOLO_ABOGADO", "Solo un abogado de ABOGADOS_EMAILS (o el owner, si la lista está vacía) puede corregir la ruta.", { status: 403, correlation });
  }
  if (!isDatabaseConfigured()) return error("SIN_BASE_DE_DATOS", "DATABASE_URL no está configurada.", { status: 503, correlation });

  const { id } = await ctx.params;
  if (!z.uuid().safeParse(id).success) return error("ID_INVALIDO", "Identificador no válido.", { status: 400, correlation });
  const entrada = correccionSchema.safeParse(await request.json().catch(() => null));
  if (!entrada.success) return error("RESPUESTAS_INVALIDAS", "Las respuestas no forman una ruta válida.", { status: 400, correlation });

  const resultado = await corregirRuta(id, entrada.data);
  await auditar({
    actorId: sesion.sub,
    accion: "lead.corregir_ruta",
    objetivoId: id,
    parametros: resultado.ok ? { rutaId: resultado.rutaId, totalCentimos: resultado.totalCentimos } : { motivo: resultado.motivo },
    resultado: resultado.ok ? "ok" : "rechazado",
    correlationId: correlation,
  });
  if (!resultado.ok) {
    return error(resultado.motivo, MENSAJE[resultado.motivo], { status: resultado.motivo === "LEAD_NO_EXISTE" ? 404 : 409, correlation });
  }
  return json(resultado, { correlation });
}
