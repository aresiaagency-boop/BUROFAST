import { NextResponse, type NextRequest } from "next/server";
import { esLocale, LOCALE_POR_DEFECTO } from "@/lib/i18n/locales";
import { COOKIE_SESION, leerTokenDireccion } from "@/lib/security/sesion";

const NO_INDEXAR = { "x-robots-tag": "noindex, nofollow", "cache-control": "no-store" };

// Primera barrera de la Dirección y fuente del idioma para <html lang>. Aquí
// solo se comprueba la firma de la cookie; cada página y handler comprueba
// además la sesión en la base de datos.
export function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl;
  const esDireccion = pathname === "/mando" || (pathname.startsWith("/mando/") && !pathname.startsWith("/mando/acceso"));
  const esApiDireccion = pathname.startsWith("/api/v1/mando");

  if (esDireccion || esApiDireccion) {
    // Una petición que cambia algo y viene de otro sitio se corta aquí.
    const sitio = request.headers.get("sec-fetch-site");
    if (esApiDireccion && !["GET", "HEAD"].includes(request.method) && sitio && sitio !== "same-origin") {
      return NextResponse.json({ error: { codigo: "ORIGEN_NO_PERMITIDO", mensaje: "La petición no viene de BUROFAST." } }, { status: 403, headers: NO_INDEXAR });
    }
    let token = null;
    try {
      token = leerTokenDireccion(request.cookies.get(COOKIE_SESION)?.value);
    } catch {
      token = null;
    }
    if (!token) {
      if (esApiDireccion) {
        return NextResponse.json({ error: { codigo: "NO_AUTORIZADO", mensaje: "Inicia sesión en la Dirección." } }, { status: 401, headers: NO_INDEXAR });
      }
      const destino = new URL("/mando/acceso", request.url);
      destino.searchParams.set("siguiente", `${pathname}${search}`);
      const respuesta = NextResponse.redirect(destino);
      for (const [clave, valor] of Object.entries(NO_INDEXAR)) respuesta.headers.set(clave, valor);
      return respuesta;
    }
  }

  const primerSegmento = pathname.split("/")[1];
  const locale = esLocale(primerSegmento) ? primerSegmento : LOCALE_POR_DEFECTO;
  const cabeceras = new Headers(request.headers);
  cabeceras.set("x-burofast-locale", locale);
  return NextResponse.next({ request: { headers: cabeceras } });
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|icon.svg|health|mapa/).*)"],
};
