import { isDatabaseConfigured } from "@/lib/db";
import { correlationId, error, json } from "@/lib/http";
import { registrarEventoHestia } from "@/lib/repositorio";
import { eventoHestiaSchema } from "@/lib/schemas";
import { cifradoConfigurado } from "@/lib/security/cifrado";
import { verifyMachineBearer, verifyWebhookSignature } from "@/lib/security/hmac";

const VENTANA_MS = 5 * 60_000;

// Dos formas de autenticarse, ambas con x-burofast-timestamp dentro de una
// ventana de cinco minutos y deduplicación por mensajeId:
// 1. HMAC-SHA256 de `${timestamp}.${cuerpo}` con HESTIA_WEBHOOK_SECRET en
//    x-burofast-signature (para emisores que pueden guardar un secreto).
// 2. Bearer HESTIA_EVENTOS_TOKEN guardado como credencial de n8n: n8n Community
//    no tiene $vars y no puede firmar sin dejar el secreto en el flujo.
export async function POST(request: Request) {
  const correlation = correlationId(request);
  const secretoHmac = process.env.HESTIA_WEBHOOK_SECRET?.trim();
  const token = process.env.HESTIA_EVENTOS_TOKEN?.trim();
  if (!secretoHmac && !token) {
    return error("HESTIA_NO_CONFIGURADA", "Faltan HESTIA_EVENTOS_TOKEN o HESTIA_WEBHOOK_SECRET en el servidor.", { status: 503, correlation });
  }

  const cuerpo = await request.text();
  const timestamp = request.headers.get("x-burofast-timestamp");
  const firma = request.headers.get("x-burofast-signature");
  const autorizacion = request.headers.get("authorization");
  const enVentana = Boolean(timestamp) && Math.abs(Date.now() - Date.parse(timestamp as string)) <= VENTANA_MS;
  const valido = firma && secretoHmac
    ? verifyWebhookSignature({ secret: secretoHmac, timestamp, signature: firma, rawBody: cuerpo })
    : Boolean(token) && enVentana && verifyMachineBearer(token as string, autorizacion);
  if (!valido) return error("FIRMA_INVALIDA", "Credencial o firma ausente, caducada o incorrecta.", { status: 401, correlation });

  let datos: unknown;
  try {
    datos = JSON.parse(cuerpo);
  } catch {
    return error("JSON_INVALIDO", "El cuerpo no es JSON.", { status: 400, correlation });
  }
  const evento = eventoHestiaSchema.safeParse(datos);
  if (!evento.success) return error("EVENTO_INVALIDO", "El evento no tiene el formato esperado.", { status: 400, correlation });
  if (!isDatabaseConfigured() || !cifradoConfigurado()) {
    return error("SERVICIO_NO_CONFIGURADO", "Faltan DATABASE_URL o DATA_ENCRYPTION_KEY.", { status: 503, correlation });
  }
  const { duplicado } = await registrarEventoHestia(evento.data);
  return json({ ok: true, duplicado }, { status: duplicado ? 200 : 201, correlation });
}
