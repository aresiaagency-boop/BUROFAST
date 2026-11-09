import { z } from "zod";
import { urlBase } from "@/lib/auth/base";
import { exigirRol } from "@/lib/autorizacion";
import { isDatabaseConfigured } from "@/lib/db";
import { correlationId, error, json, origenPermitido } from "@/lib/http";
import { leadPagablePorId } from "@/lib/pagos/repositorio";
import { stripeConfigurado } from "@/lib/pagos/stripe";
import { auditar } from "@/lib/repositorio";
import { sellar } from "@/lib/security/sello";

const DURACION_ENLACE_S = 7 * 24 * 60 * 60;

// Enlace de pago firmado para enviar por WhatsApp o correo. Solo existe para
// expedientes con la ruta ya confirmada por el abogado; caduca en 7 días.
export async function POST(request: Request, ctx: RouteContext<"/api/v1/mando/leads/[id]/enlace-pago">) {
  const correlation = correlationId(request);
  if (!origenPermitido(request)) return error("ORIGEN_NO_PERMITIDO", "La petición no viene de BUROFAST.", { status: 403, correlation });
  const sesion = await exigirRol("operator");
  if (!sesion) return error("SIN_PERMISO", "Crear un enlace de pago requiere rol operator u owner.", { status: 403, correlation });
  const base = urlBase();
  if (!isDatabaseConfigured() || !stripeConfigurado() || !base) return error("PAGOS_NO_CONFIGURADOS", "Faltan Stripe, la base de datos o APP_BASE_URL.", { status: 503, correlation });

  const { id } = await ctx.params;
  if (!z.uuid().safeParse(id).success) return error("ID_INVALIDO", "Identificador no válido.", { status: 400, correlation });
  const lead = await leadPagablePorId(id);
  if (!lead) return error("LEAD_NO_EXISTE", "La solicitud no existe.", { status: 404, correlation });
  if (lead.estado !== "aprobado") return error("RUTA_NO_CONFIRMADA", "Primero hay que confirmar la ruta (abogado).", { status: 409, correlation });

  const ficha = sellar({ leadId: lead.id }, DURACION_ENLACE_S, "pago");
  await auditar({ actorId: sesion.sub, accion: "pago.crear_enlace", objetivoId: lead.id, resultado: "ok", correlationId: correlation });
  return json({ url: `${base}/${lead.locale}/pago/abrir#${ficha}`, caducaEnDias: 7 }, { correlation });
}
