import { z } from "zod";
import { puedeConfirmarRuta } from "@/lib/auth/equipo";
import { exigirRol } from "@/lib/autorizacion";
import { isDatabaseConfigured } from "@/lib/db";
import { ESTADOS_LEAD } from "@/lib/expediente";
import { correlationId, error, json, origenPermitido } from "@/lib/http";
import { cambiarEstadoLead } from "@/lib/leads";
import { cerrarCheckoutsAbiertos } from "@/lib/pagos/checkout";
import { stripeConfigurado } from "@/lib/pagos/stripe";
import { auditar } from "@/lib/repositorio";

// «convertido» no está: a ese estado solo se llega pagando.
const cambioSchema = z.object({ estado: z.enum(ESTADOS_LEAD.filter((e) => e !== "convertido") as [string, ...string[]]) });

export async function POST(request: Request, ctx: RouteContext<"/api/v1/mando/leads/[id]/estado">) {
  const correlation = correlationId(request);
  if (!origenPermitido(request)) return error("ORIGEN_NO_PERMITIDO", "La petición no viene de BUROFAST.", { status: 403, correlation });
  const sesion = await exigirRol("operator");
  if (!sesion) return error("SIN_PERMISO", "Cambiar una solicitud requiere rol operator u owner.", { status: 403, correlation });
  if (!isDatabaseConfigured()) return error("SIN_BASE_DE_DATOS", "DATABASE_URL no está configurada.", { status: 503, correlation });

  const { id } = await ctx.params;
  if (!z.uuid().safeParse(id).success) return error("ID_INVALIDO", "Identificador no válido.", { status: 400, correlation });
  const cambio = cambioSchema.safeParse(await request.json().catch(() => null));
  if (!cambio.success) return error("CAMBIO_INVALIDO", "Estado no válido.", { status: 400, correlation });
  const estado = cambio.data.estado as (typeof ESTADOS_LEAD)[number];
  if (estado === "aprobado" && !puedeConfirmarRuta(sesion.sub, sesion.rol)) {
    await auditar({ actorId: sesion.sub, accion: "lead.confirmar_ruta", objetivoId: id, resultado: "rechazado", correlationId: correlation });
    return error("SOLO_ABOGADO", "Solo un abogado de ABOGADOS_EMAILS (o el owner, si la lista está vacía) puede confirmar la ruta.", { status: 403, correlation });
  }

  const resultado = await cambiarEstadoLead({ leadId: id, estado });
  await auditar({
    actorId: sesion.sub,
    // Confirmar la ruta es la decisión que abre el cobro: se audita aparte.
    accion: estado === "aprobado" ? "lead.confirmar_ruta" : "lead.cambiar_estado",
    objetivoId: id,
    parametros: { hacia: estado, desde: "desde" in resultado ? resultado.desde : null },
    resultado: resultado.ok ? "ok" : "rechazado",
    correlationId: correlation,
  });
  if (!resultado.ok) {
    const status = resultado.motivo === "LEAD_NO_EXISTE" ? 404 : 409;
    return error(resultado.motivo, status === 404 ? "La solicitud no existe." : "Ese cambio no está permitido desde el estado actual.", { status, correlation });
  }
  // Si el abogado retira la aprobación, ningún Checkout abierto puede seguir cobrando.
  let checkouts = null;
  if (resultado.desde === "aprobado" && stripeConfigurado()) {
    checkouts = await cerrarCheckoutsAbiertos(id);
    await auditar({
      actorId: sesion.sub,
      accion: "pago.cerrar_checkouts",
      objetivoId: id,
      parametros: checkouts,
      resultado: checkouts.fallidas > 0 ? "error" : "ok",
      correlationId: correlation,
    });
  }
  return json({ ok: true, estado, checkouts }, { correlation });
}
