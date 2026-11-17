import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { destinoSeguro, urlBase } from "@/lib/auth/base";
import { COOKIE_CLIENTE, crearSesionCliente, DURACION_CLIENTE_S, opcionesCookie } from "@/lib/auth/cliente";
import { abrirSesion, direccionBloqueada, direccionDisponible, evaluarIdentidad, fijarIdentidad, huella, registrarFallo, subFijado } from "@/lib/auth/direccion";
import { canjearCodigo, COOKIE_OAUTH, leerEstadoOauth, type IdentidadGoogle } from "@/lib/auth/google";
import { isDatabaseConfigured } from "@/lib/db";
import { correlationId, ipCliente, log } from "@/lib/http";
import { auditar } from "@/lib/repositorio";
import { cifradoConfigurado, hashEstable } from "@/lib/security/cifrado";
import { COOKIE_SESION, crearTokenDireccion, DURACION_SESION_S, opcionesCookieDireccion } from "@/lib/security/sesion";

const escaparHtml = (texto: string) => texto.replace(/[&"<>]/g, (c) => ({ "&": "&amp;", '"': "&quot;", "<": "&lt;", ">": "&gt;" })[c] as string);

// Vuelta de Google. Valida state (anti-CSRF), canjea el código con PKCE y abre
// la sesión que toque. La Dirección y «Mi expediente» son caminos separados:
// entrar como cliente nunca abre la Dirección. Nunca se guarda el token de
// Google: solo el correo verificado (cliente) o huellas (Dirección).
export async function GET(request: Request) {
  const correlation = correlationId(request);
  const url = new URL(request.url);
  const base = urlBase() ?? url.origin;
  const almacen = await cookies();
  const estado = leerEstadoOauth(almacen.get(COOKIE_OAUTH)?.value);
  // El destino ya se filtró al empezar; se vuelve a filtrar por si acaso.
  const destino = destinoSeguro(estado?.destino, "/es/expediente");
  const esDireccion = destino === "/mando" || destino.startsWith("/mando/");
  const ip = ipCliente(request);

  const salir = (motivo: string) => {
    const vuelta = new URL(esDireccion ? "/mando/acceso" : destino, base);
    vuelta.searchParams.set("acceso", motivo);
    const respuesta = NextResponse.redirect(vuelta, 303);
    respuesta.cookies.set(COOKIE_OAUTH, "", opcionesCookie(0));
    respuesta.headers.set("cache-control", "no-store");
    return respuesta;
  };

  // Todo fallo de la Dirección queda auditado, sin guardar el correo de quien
  // lo intentó: solo una huella. Cuenta para el bloqueo de la IP salvo que
  // sea la propia cuenta de A.R.E.S. con la sesión de Google antigua: RHC no
  // puede quedarse fuera por eso.
  const rechazarDireccion = async (motivo: string, identidad?: IdentidadGoogle) => {
    if (motivo !== "autenticacion_antigua") await registrarFallo(ip);
    log("warn", "direccion_rechazada", { correlation, motivo });
    if (isDatabaseConfigured()) {
      await auditar({
        actorId: identidad ? `google:${huella(identidad.email).slice(0, 16)}` : `ip:${huella(ip).slice(0, 16)}`,
        accion: "direccion.acceso",
        parametros: { motivo },
        resultado: "rechazado",
        correlationId: correlation,
      });
    }
    // Al usuario, un mensaje único: no se revela qué comprobación falló. La
    // excepción es la sesión antigua: solo llega ahí la cuenta de A.R.E.S.
    if (motivo === "cancelado" || motivo === "autenticacion_antigua") return salir(motivo);
    return salir("sin_permiso");
  };

  const state = url.searchParams.get("state");
  const codigo = url.searchParams.get("code");
  if (esDireccion) {
    if (!direccionDisponible()) return salir("no_configurado");
    if (await direccionBloqueada(ip)) return salir("bloqueado");
  }
  if (url.searchParams.get("error")) return esDireccion ? rechazarDireccion("cancelado") : salir("cancelado");
  if (!estado || !state || state !== estado.state || !codigo) {
    log("warn", "google_state_invalido", { correlation });
    return esDireccion ? rechazarDireccion("state_invalido") : salir("error");
  }

  let identidad: IdentidadGoogle | null = null;
  try {
    identidad = await canjearCodigo(codigo, estado);
  } catch {
    identidad = null;
  }
  if (!identidad) {
    log("warn", "google_canje_fallido", { correlation });
    return esDireccion ? rechazarDireccion("canje_fallido") : salir("error");
  }

  if (esDireccion) {
    let fijado: string | null;
    try {
      fijado = await subFijado();
    } catch {
      return salir("no_configurado");
    }
    const veredicto = evaluarIdentidad(identidad, { ownerEmail: process.env.OWNER_EMAIL, subFijado: fijado, ahoraS: Math.floor(Date.now() / 1000) });
    if (!veredicto.ok) return rechazarDireccion(veredicto.motivo, identidad);
    let sid: string;
    try {
      // Primer acceso: se fija la cuenta. Si otra la fijó a la vez, se comprueba.
      if (!fijado && (await fijarIdentidad(identidad.sub)) !== huella(identidad.sub)) return rechazarDireccion("identidad_distinta", identidad);
      sid = await abrirSesion({ sub: identidad.sub, ip, agente: request.headers.get("user-agent") ?? "" });
    } catch {
      return salir("no_configurado");
    }
    await auditar({ actorId: identidad.email, accion: "direccion.acceso", parametros: { primerAcceso: !fijado }, resultado: "ok", correlationId: correlation });

    // La cookie es SameSite=Strict y esta respuesta llega desde Google (otro
    // sitio): si redirigiéramos con 303, el navegador no la enviaría en la
    // siguiente petición. Una página propia hace el último salto.
    const respuesta = new NextResponse(
      `<!doctype html><meta charset="utf-8"><meta name="robots" content="noindex"><meta http-equiv="refresh" content="0;url=${escaparHtml(destino)}"><title>BUROFAST</title>`,
      { status: 200, headers: { "content-type": "text/html; charset=utf-8", "cache-control": "no-store", "referrer-policy": "no-referrer" } },
    );
    respuesta.cookies.set(COOKIE_OAUTH, "", opcionesCookie(0));
    respuesta.cookies.set(COOKIE_SESION, crearTokenDireccion(sid), opcionesCookieDireccion(DURACION_SESION_S));
    return respuesta;
  }

  // Cliente: la sesión necesita la clave de datos (el expediente se busca por
  // el hash del correo).
  const respuesta = NextResponse.redirect(new URL(destino, base), 303);
  respuesta.cookies.set(COOKIE_OAUTH, "", opcionesCookie(0));
  if (cifradoConfigurado()) {
    respuesta.cookies.set(COOKIE_CLIENTE, crearSesionCliente(identidad.email, identidad.nombre), opcionesCookie(DURACION_CLIENTE_S));
  }
  if (isDatabaseConfigured()) {
    const actor = cifradoConfigurado() ? `cliente:${hashEstable(identidad.email).slice(0, 16)}` : "cliente";
    await auditar({ actorId: actor, accion: "cliente.google", parametros: { rol: "cliente" }, resultado: "ok", correlationId: correlation });
  }
  return respuesta;
}
