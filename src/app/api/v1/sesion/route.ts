import { z } from "zod";
import { correlationId, error, ipCliente, json, origenPermitido } from "@/lib/http";
import { auditar } from "@/lib/repositorio";
import { verificarPassword } from "@/lib/security/password";
import { limitar } from "@/lib/security/limites";
import { COOKIE_SESION, crearTokenSesion, DURACION_SESION_S, passwordConfigurada } from "@/lib/security/sesion";
import { isDatabaseConfigured } from "@/lib/db";

const credencialesSchema = z.object({ email: z.string().trim().toLowerCase().email(), password: z.string().min(1).max(200) });

export async function POST(request: Request) {
  const correlation = correlationId(request);
  if (!origenPermitido(request)) return error("ORIGEN_NO_PERMITIDO", "La petición no viene de BUROFAST.", { status: 403, correlation });
  if (!passwordConfigurada()) {
    return error("AUTENTICACION_NO_CONFIGURADA", "El acceso con contraseña no está activado: entra con Google.", { status: 503, correlation });
  }
  const limite = await limitar(`login:${ipCliente(request)}`, { limite: 8, ventanaMs: 15 * 60_000 });
  if (!limite.permitido) return error("DEMASIADOS_INTENTOS", "Demasiados intentos. Espera quince minutos.", { status: 429, correlation });

  const credenciales = credencialesSchema.safeParse(await request.json().catch(() => null));
  if (!credenciales.success) return error("CREDENCIALES_INVALIDAS", "Correo o contraseña incorrectos.", { status: 401, correlation });
  // Segundo límite por cuenta: aunque alguien rote IPs, la cuenta del owner no
  // admite más de 10 intentos cada 15 minutos.
  const porCuenta = await limitar(`login-cuenta:${credenciales.data.email}`, { limite: 10, ventanaMs: 15 * 60_000 });
  if (!porCuenta.permitido) return error("DEMASIADOS_INTENTOS", "Demasiados intentos para esta cuenta. Espera quince minutos.", { status: 429, correlation });

  const emailCorrecto = credenciales.data.email === process.env.OWNER_EMAIL?.trim().toLowerCase();
  // Se verifica la contraseña aunque el correo no coincida, para no revelar por
  // el tiempo de respuesta qué correos existen.
  const passwordCorrecta = await verificarPassword(credenciales.data.password, process.env.OWNER_PASSWORD_HASH ?? "");
  const ok = emailCorrecto && passwordCorrecta;

  if (isDatabaseConfigured()) {
    await auditar({ actorId: credenciales.data.email, accion: "sesion.iniciar", resultado: ok ? "ok" : "rechazado", correlationId: correlation });
  }
  if (!ok) return error("CREDENCIALES_INVALIDAS", "Correo o contraseña incorrectos.", { status: 401, correlation });

  const respuesta = json({ ok: true }, { correlation });
  respuesta.cookies.set(COOKIE_SESION, crearTokenSesion(credenciales.data.email, "owner"), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: DURACION_SESION_S,
  });
  return respuesta;
}

export async function DELETE(request: Request) {
  const correlation = correlationId(request);
  const respuesta = json({ ok: true }, { correlation });
  respuesta.cookies.set(COOKIE_SESION, "", { httpOnly: true, path: "/", maxAge: 0 });
  respuesta.cookies.set("burofast.cliente", "", { httpOnly: true, path: "/", maxAge: 0 });
  return respuesta;
}
