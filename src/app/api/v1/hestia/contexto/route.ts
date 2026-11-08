import { CITAS, DIAS_GARANTIA_URGENTE, NIVELES_CITA, PRODUCTOS } from "@/lib/catalogo";
import { correlationId, error, json } from "@/lib/http";
import { DICCIONARIOS } from "@/lib/i18n";
import { LOCALES } from "@/lib/i18n/locales";
import { verifyMachineBearer } from "@/lib/security/hmac";

// Contexto que n8n inyecta en el prompt de HESTIA antes de responder: precios,
// reglas de citas y enlaces al funnel por idioma. Una sola fuente de verdad: si
// cambia un precio aquí, HESTIA lo dice bien en la siguiente conversación.
export function GET(request: Request) {
  const correlation = correlationId(request);
  // Token propio, distinto del de eventos: quien lea este no puede escribir.
  const secreto = process.env.HESTIA_CONTEXTO_TOKEN?.trim();
  if (!secreto) return error("HESTIA_NO_CONFIGURADA", "Falta HESTIA_CONTEXTO_TOKEN en el servidor.", { status: 503, correlation });
  if (!verifyMachineBearer(secreto, request.headers.get("authorization"))) {
    return error("NO_AUTORIZADO", "Credencial de máquina no válida.", { status: 401, correlation });
  }
  const base = (process.env.APP_BASE_URL ?? new URL(request.url).origin).replace(/\/$/, "");
  const productos = Object.fromEntries(
    Object.entries(PRODUCTOS).map(([id, p]) => [id, { nombre: DICCIONARIOS.es.productos[id as keyof typeof PRODUCTOS], euros: p.precioCentimos / 100, nivel: p.nivel }]),
  );
  return json(
    {
      marca: "BUROFAST",
      agente: "HESTIA",
      ivaIncluido: true,
      productos,
      nivelesCita: {
        puede_esperar: { euros: NIVELES_CITA.puede_esperar.precioCentimos / 100, incluye: DICCIONARIOS.es.nivelesCita.puede_esperar.incluye },
        urgente: { euros: NIVELES_CITA.urgente.precioCentimos / 100, incluye: DICCIONARIOS.es.nivelesCita.urgente.incluye, diasGarantia: DIAS_GARANTIA_URGENTE },
      },
      reglasCitas: DICCIONARIOS.es.nivelesCita.reglas,
      citas: Object.fromEntries(Object.keys(CITAS).map((id) => [id, DICCIONARIOS.es.citas[id as keyof typeof CITAS].nombre])),
      enlacesFunnel: Object.fromEntries(LOCALES.map((locale) => [locale, `${base}/${locale}/camino`])),
    },
    { correlation },
  );
}
