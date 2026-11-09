import { NextResponse } from "next/server";
import { destinoSeguro, urlBase } from "@/lib/auth/base";
import { opcionesCookie } from "@/lib/auth/cliente";
import { COOKIE_OAUTH, googleConfigurado, iniciarGoogle } from "@/lib/auth/google";
import { ipCliente } from "@/lib/http";
import { limitar } from "@/lib/security/limites";

// Inicio del acceso con Google. ?destino= dice adónde volver (solo rutas
// internas): /mando para el equipo, /{idioma}/expediente para clientes.
export async function GET(request: Request) {
  const url = new URL(request.url);
  const destino = destinoSeguro(url.searchParams.get("destino"), "/es/expediente");
  const base = urlBase() ?? url.origin;
  if (!googleConfigurado()) {
    const vuelta = new URL(destino, base);
    vuelta.searchParams.set("acceso", "no_configurado");
    return NextResponse.redirect(vuelta, 303);
  }
  const limite = await limitar(`google:${ipCliente(request)}`, { limite: 20, ventanaMs: 10 * 60_000 });
  if (!limite.permitido) {
    const vuelta = new URL(destino, base);
    vuelta.searchParams.set("acceso", "limite");
    return NextResponse.redirect(vuelta, 303);
  }
  const inicio = iniciarGoogle(destino);
  const respuesta = NextResponse.redirect(inicio.url, 303);
  respuesta.cookies.set(COOKIE_OAUTH, inicio.cookie, opcionesCookie(inicio.maxAge));
  return respuesta;
}
