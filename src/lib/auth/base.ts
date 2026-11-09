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

// Solo rutas internas: evita que ?destino= sirva para redirigir fuera.
export function destinoSeguro(destino: string | null | undefined, porDefecto: string) {
  if (!destino || !destino.startsWith("/") || destino.startsWith("//") || destino.includes("\\")) return porDefecto;
  return destino;
}
