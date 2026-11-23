import { z } from "zod";
import { sesionClienteActual } from "@/lib/auth/cliente";
import { isDatabaseConfigured } from "@/lib/db";
import { borrarDocumento, leadDelCliente, leerDocumento } from "@/lib/documentos";
import { correlationId, error, json, origenEstricto } from "@/lib/http";
import { auditar } from "@/lib/repositorio";

const idSchema = z.uuid();
const referenciaSchema = z.string().trim().toUpperCase().regex(/^BF-[A-Z0-9]{6}$/);

// Descarga y borrado por el propio cliente: el documento tiene que ser de un
// expediente de su cuenta. La descarga nunca se guarda en cachés.
async function contexto(request: Request, id: string) {
  const cliente = await sesionClienteActual();
  const referencia = referenciaSchema.safeParse(new URL(request.url).searchParams.get("expediente"));
  if (!cliente || !idSchema.safeParse(id).success || !referencia.success || !isDatabaseConfigured()) return null;
  const lead = await leadDelCliente(referencia.data, cliente.emailHash);
  return lead ? { cliente, lead } : null;
}

export async function GET(request: Request, { params }: RouteContext<"/api/v1/expediente/documentos/[id]">) {
  const correlation = correlationId(request);
  const { id } = await params;
  const ctx = await contexto(request, id);
  if (!ctx) return error("NO_ENCONTRADO", "Documento no encontrado.", { status: 404, correlation });
  const documento = await leerDocumento(id, ctx.lead.id);
  if (!documento) return error("NO_ENCONTRADO", "Documento no encontrado.", { status: 404, correlation });
  return new Response(new Uint8Array(documento.contenido), {
    headers: {
      "content-type": documento.mime,
      "content-disposition": `attachment; filename*=UTF-8''${encodeURIComponent(documento.nombre)}`,
      "cache-control": "no-store",
      "x-content-type-options": "nosniff",
    },
  });
}

export async function DELETE(request: Request, { params }: RouteContext<"/api/v1/expediente/documentos/[id]">) {
  const correlation = correlationId(request);
  if (!origenEstricto(request)) return error("ORIGEN_NO_PERMITIDO", "La petición no viene de BUROFAST.", { status: 403, correlation });
  const { id } = await params;
  const ctx = await contexto(request, id);
  if (!ctx) return error("NO_ENCONTRADO", "Documento no encontrado.", { status: 404, correlation });
  const borrado = await borrarDocumento(id, ctx.lead.id);
  await auditar({ actorId: `cliente:${ctx.cliente.emailHash.slice(0, 16)}`, accion: "documento.borrar", objetivoId: ctx.lead.id, resultado: borrado ? "ok" : "rechazado", correlationId: correlation });
  if (!borrado) return error("NO_ENCONTRADO", "Documento no encontrado.", { status: 404, correlation });
  return json({ ok: true }, { correlation });
}
