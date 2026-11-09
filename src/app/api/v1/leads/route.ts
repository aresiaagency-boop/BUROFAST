import { isDatabaseConfigured } from "@/lib/db";
import { correlationId, error, ipCliente, json, log, origenPermitido } from "@/lib/http";
import { auditar, crearLead, nuevaReferencia } from "@/lib/repositorio";
import { solicitudLeadSchema } from "@/lib/schemas";
import { cifradoConfigurado } from "@/lib/security/cifrado";
import { limitar } from "@/lib/security/limites";

export async function POST(request: Request) {
  const correlation = correlationId(request);
  if (!origenPermitido(request)) {
    return error("ORIGEN_NO_PERMITIDO", "La petición no viene de BUROFAST.", { status: 403, correlation });
  }
  const limite = await limitar(`leads:${ipCliente(request)}`, { limite: 5, ventanaMs: 10 * 60_000 });
  if (!limite.permitido) {
    return error("DEMASIADAS_PETICIONES", "Demasiados envíos seguidos desde esta conexión.", { status: 429, correlation });
  }

  const cuerpo = await request.json().catch(() => null);
  if (cuerpo && typeof cuerpo === "object" && "web" in cuerpo && String((cuerpo as { web: unknown }).web ?? "").length > 0) {
    // Trampa para bots: respuesta de éxito creíble y nada guardado.
    log("warn", "lead_trampa", { correlation });
    return json({ referencia: nuevaReferencia(), ruta: "consulta", totalCentimos: 0 }, { status: 201, correlation });
  }
  const solicitud = solicitudLeadSchema.safeParse(cuerpo);
  if (!solicitud.success) {
    const campos = [...new Set(solicitud.error.issues.map((issue) => String(issue.path[0] ?? "")))];
    return error("SOLICITUD_INVALIDA", "Hay campos que faltan o no tienen el formato correcto.", { status: 400, correlation, detalle: { campos } });
  }

  // Sin base de datos o sin clave de cifrado no se acepta nada: guardar datos
  // personales en claro no es una opción, y fingir que se guardaron tampoco.
  if (!isDatabaseConfigured() || !cifradoConfigurado()) {
    log("warn", "lead_rechazado_sin_configuracion", { correlation, db: isDatabaseConfigured(), cifrado: cifradoConfigurado() });
    return error("SERVICIO_NO_CONFIGURADO", "El registro de solicitudes no está configurado en este servidor.", { status: 503, correlation });
  }

  try {
    const lead = await crearLead(solicitud.data);
    await auditar({
      actorId: "funnel",
      accion: "lead.crear",
      objetivoId: lead.id,
      parametros: { ruta: lead.ruta.id, producto: lead.ruta.producto, nivelCita: lead.nivelCita, locale: solicitud.data.locale },
      resultado: "ok",
      correlationId: correlation,
    });
    log("info", "lead_creado", { correlation, ruta: lead.ruta.id });
    return json({ referencia: lead.referencia, ruta: lead.ruta.id, totalCentimos: lead.importe.total }, { status: 201, correlation });
  } catch (fallo) {
    const codigo = typeof fallo === "object" && fallo && "code" in fallo ? String((fallo as { code: unknown }).code) : "DESCONOCIDO";
    log("error", "lead_fallo", { correlation, codigo });
    return error("ERROR_GUARDANDO", "No se pudo guardar la solicitud. Inténtalo de nuevo en unos minutos.", { status: 500, correlation });
  }
}
