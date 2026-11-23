import { z } from "zod";
import { sesionClienteActual } from "@/lib/auth/cliente";
import { isDatabaseConfigured } from "@/lib/db";
import { DOCUMENTOS } from "@/lib/diagnostico";
import { declararDocumento, leadDelCliente } from "@/lib/documentos";
import { correlationId, error, ipCliente, json, origenEstricto } from "@/lib/http";
import { cifradoConfigurado } from "@/lib/security/cifrado";
import { limitar } from "@/lib/security/limites";

// «¿Ya lo tienes?»: la persona responde por cada documento de su ruta. Sí →
// se le pide adjuntarlo; todavía no → BUROFAST la acompaña a conseguirlo.
const entradaSchema = z.object({
  referencia: z.string().trim().toUpperCase().regex(/^BF-[A-Z0-9]{6}$/),
  tipo: z.enum(DOCUMENTOS),
  tiene: z.boolean(),
});

export async function POST(request: Request) {
  const correlation = correlationId(request);
  if (!origenEstricto(request)) return error("ORIGEN_NO_PERMITIDO", "La petición no viene de BUROFAST.", { status: 403, correlation });
  if (!isDatabaseConfigured() || !cifradoConfigurado()) return error("NO_DISPONIBLE", "La bóveda de documentos no está disponible.", { status: 503, correlation });
  const cliente = await sesionClienteActual();
  if (!cliente) return error("NO_AUTORIZADO", "Entra con Google.", { status: 401, correlation });
  const limite = await limitar(`docs-declarar:${ipCliente(request)}`, { limite: 120, ventanaMs: 60 * 60_000 });
  if (!limite.permitido) return error("DEMASIADAS_PETICIONES", "Demasiadas respuestas seguidas. Prueba más tarde.", { status: 429, correlation });
  const entrada = entradaSchema.safeParse(await request.json().catch(() => null));
  if (!entrada.success) return error("ENTRADA_INVALIDA", "Respuesta no válida.", { status: 400, correlation });
  const lead = await leadDelCliente(entrada.data.referencia, cliente.emailHash);
  if (!lead) return error("NO_ENCONTRADO", "Ese expediente no está en tu cuenta.", { status: 404, correlation });
  await declararDocumento(lead.id, entrada.data.tipo, entrada.data.tiene);
  return json({ ok: true }, { correlation });
}
