import { NextResponse } from "next/server";
import { destinoSeguro, urlBase } from "@/lib/auth/base";
import { opcionesCookie } from "@/lib/auth/cliente";
import { direccionBloqueada, direccionDisponible } from "@/lib/auth/direccion";
import { COOKIE_OAUTH, googleConfigurado, iniciarGoogle } from "@/lib/auth/google";
import { ipCliente } from "@/lib/http";
import { limitar } from "@/lib/security/limites";

// Inicio del acceso con Google. ?destino= dice adónde volver (solo rutas
// internas): /mando para la Dirección, /{idioma}/expediente para clientes.
export async function GET(request: Request) {
  const url = new URL(request.url);
  const destino = destinoSeguro(url.searchParams.get("destino"), "/es/expediente");
  const esDireccion = destino === "/mando" || destino.startsWith("/mando/");
  const base = urlBase() ?? url.origin;
  const volver = (motivo: string) => {
    const vuelta = new URL(esDireccion ? "/mando/acceso" : destino, base);
    vuelta.searchParams.set("acceso", motivo);
    return NextResponse.redirect(vuelta, 303);
  };

  if (!googleConfigurado() || (esDireccion && !direccionDisponible())) return volver("no_configurado");
  const ip = ipCliente(request);
  const limite = await limitar(`google:${ip}`, { limite: 20, ventanaMs: 10 * 60_000 });
  if (!limite.permitido) return volver("limite");
  if (esDireccion && (await direccionBloqueada(ip))) return volver("bloqueado");

  const inicio = iniciarGoogle(destino, { pedirAuthTime: esDireccion });
  const respuesta = NextResponse.redirect(inicio.url, 303);
  respuesta.cookies.set(COOKIE_OAUTH, inicio.cookie, opcionesCookie(inicio.maxAge));
  respuesta.headers.set("cache-control", "no-store");
  return respuesta;
}
