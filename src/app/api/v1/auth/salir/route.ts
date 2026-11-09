import { COOKIE_CLIENTE, opcionesCookie } from "@/lib/auth/cliente";
import { correlationId, error, json, origenPermitido } from "@/lib/http";

// Cierra la sesión de cliente («Mi expediente»).
export function POST(request: Request) {
  const correlation = correlationId(request);
  if (!origenPermitido(request)) return error("ORIGEN_NO_PERMITIDO", "La petición no viene de BUROFAST.", { status: 403, correlation });
  const respuesta = json({ ok: true }, { correlation });
  respuesta.cookies.set(COOKIE_CLIENTE, "", opcionesCookie(0));
  return respuesta;
}
