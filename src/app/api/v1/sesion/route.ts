import { cookies } from "next/headers";
import { revocarSesion } from "@/lib/auth/direccion";
import { opcionesCookie } from "@/lib/auth/cliente";
import { isDatabaseConfigured } from "@/lib/db";
import { correlationId, error, json, origenEstricto } from "@/lib/http";
import { auditar } from "@/lib/repositorio";
import { COOKIE_SESION, leerTokenDireccion, opcionesCookieDireccion } from "@/lib/security/sesion";

// Salir de la Dirección: la sesión se revoca en la base de datos, no solo se
// borra la cookie. Ya no hay acceso con contraseña: solo Google.
export async function DELETE(request: Request) {
  const correlation = correlationId(request);
  if (!origenEstricto(request)) return error("ORIGEN_NO_PERMITIDO", "La petición no viene de BUROFAST.", { status: 403, correlation });
  const token = leerTokenDireccion((await cookies()).get(COOKIE_SESION)?.value);
  if (token && isDatabaseConfigured()) {
    try {
      await revocarSesion(token.sid, "salida");
      await auditar({ actorId: process.env.OWNER_EMAIL?.trim().toLowerCase() ?? "owner", accion: "direccion.salida", resultado: "ok", correlationId: correlation });
    } catch {
      // La cookie se borra igualmente.
    }
  }
  const respuesta = json({ ok: true }, { correlation });
  respuesta.cookies.set(COOKIE_SESION, "", opcionesCookieDireccion(0));
  respuesta.cookies.set("burofast.cliente", "", opcionesCookie(0));
  return respuesta;
}
