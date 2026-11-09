import { z } from "zod";
import { urlBase } from "@/lib/auth/base";
import { sesionClienteActual } from "@/lib/auth/cliente";
import { isDatabaseConfigured } from "@/lib/db";
import { correlationId, error, ipCliente, json, log, origenPermitido } from "@/lib/http";
import { LOCALES } from "@/lib/i18n/locales";
import { abrirCheckout } from "@/lib/pagos/checkout";
import { leadPagablePorId, leadPagablePorReferencia } from "@/lib/pagos/repositorio";
import { stripeConfigurado } from "@/lib/pagos/stripe";
import { auditar } from "@/lib/repositorio";
import { limitar } from "@/lib/security/limites";
import { abrir } from "@/lib/security/sello";

const entradaSchema = z.object({
  locale: z.enum(LOCALES),
  // O una ficha de pago firmada (enlace que envía el equipo)…
  ficha: z.string().max(800).optional(),
  // …o la referencia de un expediente del cliente que ha entrado con Google.
  referencia: z.string().regex(/^BF-[A-Z0-9]{6}$/).optional(),
});

export async function POST(request: Request) {
  const correlation = correlationId(request);
  if (!origenPermitido(request)) return error("ORIGEN_NO_PERMITIDO", "La petición no viene de BUROFAST.", { status: 403, correlation });
  const limite = await limitar(`checkout:${ipCliente(request)}`, { limite: 10, ventanaMs: 10 * 60_000 });
  if (!limite.permitido) return error("DEMASIADAS_PETICIONES", "Demasiados intentos de pago seguidos.", { status: 429, correlation });
  if (!stripeConfigurado() || !isDatabaseConfigured() || !urlBase()) {
    return error("PAGOS_NO_CONFIGURADOS", "Los pagos con tarjeta no están configurados en este servidor.", { status: 503, correlation });
  }

  const entrada = entradaSchema.safeParse(await request.json().catch(() => null));
  if (!entrada.success || (!entrada.data.ficha && !entrada.data.referencia)) {
    return error("ENTRADA_INVALIDA", "Falta la ficha de pago o la referencia.", { status: 400, correlation });
  }

  let lead = null;
  if (entrada.data.ficha) {
    const ficha = abrir<{ leadId: string }>(entrada.data.ficha, "pago");
    if (!ficha || typeof ficha.leadId !== "string") return error("FICHA_INVALIDA", "El enlace de pago no es válido o ha caducado.", { status: 401, correlation });
    lead = await leadPagablePorId(ficha.leadId);
  } else if (entrada.data.referencia) {
    const cliente = await sesionClienteActual();
    if (!cliente) return error("NO_AUTORIZADO", "Entra con Google para pagar desde tu expediente.", { status: 401, correlation });
    lead = await leadPagablePorReferencia(entrada.data.referencia, cliente.emailHash);
  }
  if (!lead) return error("EXPEDIENTE_NO_ENCONTRADO", "No encontramos ese expediente.", { status: 404, correlation });
  if (lead.estado === "convertido") return error("YA_PAGADO", "Este anticipo ya está pagado.", { status: 409, correlation });
  // Puerta humana: sin ruta confirmada por el abogado no se cobra.
  if (lead.estado !== "aprobado") return error("RUTA_NO_CONFIRMADA", "Un abogado tiene que confirmar la ruta antes del pago.", { status: 409, correlation });

  try {
    const resultado = await abrirCheckout(lead, "anticipo", entrada.data.locale);
    if (!resultado.ok) {
      const estado = resultado.motivo === "YA_PAGADO" ? 409 : resultado.motivo === "SIN_IMPORTE" ? 422 : 503;
      const mensaje = resultado.motivo === "LEGAL_PENDIENTE" ? "Los cobros se activan cuando BUROFAST publique sus datos legales completos." : "No se puede abrir el pago de este expediente.";
      return error(resultado.motivo, mensaje, { status: estado, correlation });
    }
    await auditar({
      actorId: entrada.data.ficha ? "enlace_pago" : "cliente",
      accion: "pago.checkout",
      objetivoId: lead.id,
      parametros: { tipo: "anticipo", reutilizada: resultado.reutilizada },
      resultado: "ok",
      correlationId: correlation,
    });
    return json({ url: resultado.url }, { correlation });
  } catch (fallo) {
    const codigo = typeof fallo === "object" && fallo && "code" in fallo ? String((fallo as { code: unknown }).code) : "SIN_CODIGO";
    log("error", "stripe_checkout_fallo", { correlation, codigo });
    return error("STRIPE_ERROR", "La pasarela de pago no respondió. Inténtalo de nuevo.", { status: 502, correlation });
  }
}
