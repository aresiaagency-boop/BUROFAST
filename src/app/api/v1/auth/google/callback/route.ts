import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { destinoSeguro, urlBase } from "@/lib/auth/base";
import { COOKIE_CLIENTE, crearSesionCliente, DURACION_CLIENTE_S, opcionesCookie } from "@/lib/auth/cliente";
import { rolDeEquipo } from "@/lib/auth/equipo";
import { canjearCodigo, COOKIE_OAUTH, leerEstadoOauth } from "@/lib/auth/google";
import { isDatabaseConfigured } from "@/lib/db";
import { correlationId, log } from "@/lib/http";
import { auditar } from "@/lib/repositorio";
import { cifradoConfigurado, hashEstable } from "@/lib/security/cifrado";
import { COOKIE_SESION, crearTokenSesion, DURACION_SESION_S } from "@/lib/security/sesion";

// Vuelta de Google. Valida state (anti-CSRF), canjea el código con PKCE y
// abre la sesión que toque: equipo si el correo está en la lista, cliente si
// no. Nunca guarda el token de Google: solo el correo verificado.
export async function GET(request: Request) {
  const correlation = correlationId(request);
  const url = new URL(request.url);
  const base = urlBase() ?? url.origin;
  const almacen = await cookies();
  const estado = leerEstadoOauth(almacen.get(COOKIE_OAUTH)?.value);
  // El destino ya se filtró al empezar; se vuelve a filtrar por si acaso.
  const destino = destinoSeguro(estado?.destino, "/es/expediente");
  const esMando = destino.startsWith("/mando");

  const salir = (motivo: string) => {
    const vuelta = new URL(esMando ? "/mando/acceso" : destino, base);
    vuelta.searchParams.set("acceso", motivo);
    const respuesta = NextResponse.redirect(vuelta, 303);
    respuesta.cookies.set(COOKIE_OAUTH, "", opcionesCookie(0));
    return respuesta;
  };

  const state = url.searchParams.get("state");
  const codigo = url.searchParams.get("code");
  if (url.searchParams.get("error")) return salir("cancelado");
  if (!estado || !state || state !== estado.state || !codigo) {
    log("warn", "google_state_invalido", { correlation });
    return salir("error");
  }

  let identidad = null;
  try {
    identidad = await canjearCodigo(codigo, estado);
  } catch {
    identidad = null;
  }
  if (!identidad) {
    log("warn", "google_canje_fallido", { correlation });
    return salir("error");
  }

  const rol = rolDeEquipo(identidad.email);
  // Del equipo se audita el correo; de un cliente, solo una huella.
  const actor = rol ? identidad.email : cifradoConfigurado() ? `cliente:${hashEstable(identidad.email).slice(0, 16)}` : "cliente";
  if (esMando && !rol) {
    if (isDatabaseConfigured()) await auditar({ actorId: actor, accion: "sesion.google", resultado: "rechazado", correlationId: correlation });
    return salir("sin_permiso");
  }

  const respuesta = NextResponse.redirect(new URL(destino, base), 303);
  respuesta.cookies.set(COOKIE_OAUTH, "", opcionesCookie(0));
  if (rol) {
    respuesta.cookies.set(COOKIE_SESION, crearTokenSesion(identidad.email, rol), opcionesCookie(DURACION_SESION_S));
  }
  // La sesión de cliente necesita la clave de datos: el expediente se busca
  // por el hash del correo.
  if (cifradoConfigurado()) {
    respuesta.cookies.set(COOKIE_CLIENTE, crearSesionCliente(identidad.email, identidad.nombre), opcionesCookie(DURACION_CLIENTE_S));
  }
  if (isDatabaseConfigured()) {
    await auditar({ actorId: actor, accion: rol ? "sesion.google" : "cliente.google", parametros: { rol: rol ?? "cliente" }, resultado: "ok", correlationId: correlation });
  }
  return respuesta;
}
