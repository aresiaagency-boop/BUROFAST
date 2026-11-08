import { NextResponse, type NextRequest } from "next/server";
import { esLocale, LOCALE_POR_DEFECTO } from "@/lib/i18n/locales";
import { COOKIE_SESION, leerTokenSesion } from "@/lib/security/sesion";

// Primera barrera del centro de mando y fuente del idioma para <html lang>.
// Cada página y handler vuelve a comprobar la sesión en el servidor.
export function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl;
  const esMando = pathname.startsWith("/mando") && !pathname.startsWith("/mando/acceso");
  const esApiMando = pathname.startsWith("/api/v1/mando");

  if (esMando || esApiMando) {
    let sesion = null;
    try {
      sesion = leerTokenSesion(request.cookies.get(COOKIE_SESION)?.value);
    } catch {
      sesion = null;
    }
    if (!sesion) {
      if (esApiMando) {
        return NextResponse.json({ error: { codigo: "NO_AUTORIZADO", mensaje: "Inicia sesión en el centro de mando." } }, { status: 401 });
      }
      const destino = new URL("/mando/acceso", request.url);
      destino.searchParams.set("siguiente", `${pathname}${search}`);
      return NextResponse.redirect(destino);
    }
  }

  const primerSegmento = pathname.split("/")[1];
  const locale = esLocale(primerSegmento) ? primerSegmento : LOCALE_POR_DEFECTO;
  const cabeceras = new Headers(request.headers);
  cabeceras.set("x-burofast-locale", locale);
  return NextResponse.next({ request: { headers: cabeceras } });
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|icon.svg|health).*)"],
};
