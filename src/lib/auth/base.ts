// URL pública de BUROFAST. La usan el redirect de Google (tiene que coincidir
// EXACTAMENTE con la registrada en Google Cloud) y las vueltas de Stripe.
// En Vercel, si no se define APP_BASE_URL, se usa el dominio de producción
// que Vercel expone como variable de sistema.
export function urlBase(): string | null {
  const explicita = process.env.APP_BASE_URL?.trim().replace(/\/+$/, "");
  if (explicita) return explicita;
  const vercel = process.env.VERCEL_PROJECT_PRODUCTION_URL?.trim();
  return vercel ? `https://${vercel}` : null;
}

// Solo rutas internas: evita que ?destino= sirva para redirigir fuera. El
// parser de URL borra tabuladores y saltos de línea («/\t/evil» acaba en
// «//evil»), así que se rechazan los caracteres de control y, además, se
// comprueba que la ruta resuelta no salga de nuestro origen.
const ORIGEN_FICTICIO = "https://burofast.invalid";

export function destinoSeguro(destino: string | null | undefined, porDefecto: string) {
  if (!destino || !destino.startsWith("/") || destino.startsWith("//") || /[\u0000-\u001f\u007f\\]/.test(destino)) return porDefecto;
  try {
    const url = new URL(destino, ORIGEN_FICTICIO);
    // «/es/../..//evil» se normaliza a «//evil»: también fuera.
    if (url.origin !== ORIGEN_FICTICIO || url.pathname.startsWith("//")) return porDefecto;
    return `${url.pathname}${url.search}`;
  } catch {
    return porDefecto;
  }
}
