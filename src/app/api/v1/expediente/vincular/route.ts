import { z } from "zod";
import { sesionClienteActual } from "@/lib/auth/cliente";
import { isDatabaseConfigured } from "@/lib/db";
import { vincularExpediente } from "@/lib/expediente";
import { correlationId, error, ipCliente, json, origenPermitido } from "@/lib/http";
import { auditar } from "@/lib/repositorio";
import { limitar } from "@/lib/security/limites";

const entradaSchema = z.object({ referencia: z.string().trim().toUpperCase().regex(/^BF-[A-Z0-9]{6}$/) });

// El cliente que ha entrado con Google demuestra que un expediente es suyo con
// el código de camino que vio al enviarlo. Solo entonces lo ve y lo puede pagar.
export async function POST(request: Request) {
  const correlation = correlationId(request);
  if (!origenPermitido(request)) return error("ORIGEN_NO_PERMITIDO", "La petición no viene de BUROFAST.", { status: 403, correlation });
  if (!isDatabaseConfigured()) return error("SIN_BASE_DE_DATOS", "Base de datos no configurada.", { status: 503, correlation });
  const cliente = await sesionClienteActual();
  if (!cliente) return error("NO_AUTORIZADO", "Entra con Google para vincular tu expediente.", { status: 401, correlation });
  // Por IP y por cuenta: probar códigos al azar no sale a cuenta.
  for (const clave of [`vincular:${ipCliente(request)}`, `vincular-cuenta:${cliente.emailHash}`]) {
    const limite = await limitar(clave, { limite: 8, ventanaMs: 60 * 60_000 });
    if (!limite.permitido) return error("DEMASIADAS_PETICIONES", "Demasiados intentos. Prueba más tarde.", { status: 429, correlation });
  }
  const entrada = entradaSchema.safeParse(await request.json().catch(() => null));
  if (!entrada.success) return error("CODIGO_INVALIDO", "El código tiene la forma BF-XXXXXX.", { status: 400, correlation });

  const resultado = await vincularExpediente(entrada.data.referencia, cliente.emailHash);
  await auditar({
    actorId: `cliente:${cliente.emailHash.slice(0, 16)}`,
    accion: "expediente.vincular",
    objetivoId: resultado.ok ? resultado.leadId : null,
    resultado: resultado.ok ? "ok" : "rechazado",
    correlationId: correlation,
  });
  if (!resultado.ok) return error("NO_COINCIDE", "Ese código no está asociado a este correo.", { status: 404, correlation });
  return json({ ok: true }, { correlation });
}
