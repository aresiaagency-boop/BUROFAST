import { z } from "zod";
import { exigirRol } from "@/lib/autorizacion";
import { isDatabaseConfigured } from "@/lib/db";
import { DECISIONES_EQUIPO, leerDocumento, revisarDocumento } from "@/lib/documentos";
import { correlationId, error, json, origenEstricto } from "@/lib/http";
import { formatearEuros } from "@/lib/catalogo";
import { citaQueCubre } from "@/lib/diagnostico";
import { DICCIONARIOS } from "@/lib/i18n";
import { auditar, replanificarPorDocumentos } from "@/lib/repositorio";

// La Dirección abre y revisa los documentos de cualquier expediente. Cada
// apertura queda auditada: un documento de identidad no se mira sin rastro.
export async function GET(request: Request, ctx: RouteContext<"/api/v1/mando/documentos/[id]">) {
  const correlation = correlationId(request);
  const sesion = await exigirRol("viewer");
  if (!sesion) return error("NO_AUTORIZADO", "Inicia sesión en la Dirección.", { status: 401, correlation });
  const { id } = await ctx.params;
  if (!z.uuid().safeParse(id).success || !isDatabaseConfigured()) return error("NO_ENCONTRADO", "Documento no encontrado.", { status: 404, correlation });
  const documento = await leerDocumento(id);
  await auditar({ actorId: sesion.sub, accion: "documento.abrir", objetivoId: documento?.leadId ?? null, parametros: { documento: id }, resultado: documento ? "ok" : "rechazado", correlationId: correlation });
  if (!documento) return error("NO_ENCONTRADO", "Documento no encontrado.", { status: 404, correlation });
  return new Response(new Uint8Array(documento.contenido), {
    headers: {
      "content-type": documento.mime,
      // inline: el equipo lo revisa en el navegador, sin dejar copias en Descargas.
      "content-disposition": `inline; filename*=UTF-8''${encodeURIComponent(documento.nombre)}`,
      "cache-control": "no-store",
      "x-content-type-options": "nosniff",
      // sandbox aísla las imágenes; el visor de PDF de Chrome no abre bajo sandbox.
      "content-security-policy": documento.mime === "application/pdf" ? "default-src 'none'; script-src 'none'" : "default-src 'none'; img-src 'self' data:; style-src 'unsafe-inline'; sandbox",
    },
  });
}

const revisionSchema = z.object({ estado: z.enum(DECISIONES_EQUIPO), nota: z.string().trim().max(300).nullable().optional() });

export async function POST(request: Request, ctx: RouteContext<"/api/v1/mando/documentos/[id]">) {
  const correlation = correlationId(request);
  if (!origenEstricto(request)) return error("ORIGEN_NO_PERMITIDO", "La petición no viene de BUROFAST.", { status: 403, correlation });
  const sesion = await exigirRol("operator");
  if (!sesion) return error("SIN_PERMISO", "Inicia sesión en la Dirección.", { status: 403, correlation });
  const { id } = await ctx.params;
  const revision = revisionSchema.safeParse(await request.json().catch(() => null));
  if (!z.uuid().safeParse(id).success || !revision.success || !isDatabaseConfigured()) return error("ENTRADA_INVALIDA", "Revisión no válida.", { status: 400, correlation });
  const revisado = await revisarDocumento(id, revision.data.estado, revision.data.nota ?? null);
  const leadId = revisado?.leadId ?? null;
  const tipo = revisado && revisado.tipo !== "otro" ? revisado.tipo : null;
  await auditar({ actorId: sesion.sub, accion: "documento.revisar", objetivoId: leadId, parametros: { documento: id, estado: revision.data.estado }, resultado: leadId ? "ok" : "rechazado", correlationId: correlation });
  if (!leadId) return error("NO_ENCONTRADO", "Documento no encontrado.", { status: 404, correlation });
  // Validar o rechazar un documento que cubre una cita rehace el plan (antes de
  // aprobar). Si ya no se puede, el equipo lo ve y lo ajusta a mano.
  const plan = await replanificarPorDocumentos(leadId);
  if (plan.ok && plan.cambiado) {
    await auditar({ actorId: sesion.sub, accion: "lead.replanificar_documentos", objetivoId: leadId, parametros: plan, resultado: "ok", correlationId: correlation });
  }
  const cita = tipo ? citaQueCubre(tipo) : null;
  let aviso: string | null = null;
  if (plan.ok && plan.cambiado) {
    aviso = `Presupuesto ajustado: ${formatearEuros(plan.antesCentimos, "es-ES")} → ${formatearEuros(plan.totalCentimos, "es-ES")}.`;
  } else if (!plan.ok && cita) {
    aviso = `La cita «${DICCIONARIOS.es.citas[cita].nombre}» no se ha ajustado sola (${plan.motivo}): revisa el presupuesto a mano.`;
    await auditar({ actorId: sesion.sub, accion: "lead.replanificar_documentos", objetivoId: leadId, parametros: { documento: id, motivo: plan.motivo }, resultado: "rechazado", correlationId: correlation });
  }
  return json({ ok: true, aviso }, { correlation });
}
