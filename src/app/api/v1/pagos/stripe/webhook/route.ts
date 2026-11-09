import { db, isDatabaseConfigured } from "@/lib/db";
import { correlationId, error, json, log } from "@/lib/http";
import { registrarEventoStripe } from "@/lib/pagos/repositorio";
import type { Stripe } from "@/lib/pagos/stripe";
import { construirEventoStripe, stripeConfigurado, webhookStripeConfigurado } from "@/lib/pagos/stripe";
import { esEventoAjeno, procesarEventoStripe } from "@/lib/pagos/webhook";
import { auditar } from "@/lib/repositorio";

// Webhook de Stripe. La firma (Stripe-Signature, HMAC con marca de tiempo) se
// verifica sobre el cuerpo crudo. Cada evento se procesa una sola vez: el
// registro del evento y el cambio de estado van en la misma transacción.
export async function POST(request: Request) {
  const correlation = correlationId(request);
  if (!webhookStripeConfigurado() || !stripeConfigurado() || !isDatabaseConfigured()) {
    return error("WEBHOOK_NO_CONFIGURADO", "El webhook de Stripe no está configurado.", { status: 503, correlation });
  }
  const cuerpo = await request.text();
  let evento: Stripe.Event;
  try {
    evento = construirEventoStripe(cuerpo, request.headers.get("stripe-signature"));
  } catch {
    log("warn", "stripe_firma_invalida", { correlation });
    return error("FIRMA_INVALIDA", "Firma de Stripe no válida.", { status: 400, correlation });
  }

  // De otra app de la misma cuenta: 200 para que Stripe no reintente, y nada
  // en nuestra base.
  if (esEventoAjeno(evento)) return json({ recibido: true, accion: "ajeno" }, { correlation });

  try {
    const resultado = await db().begin(async (tx) => {
      const nuevo = await registrarEventoStripe(tx, evento.id, evento.type);
      if (!nuevo) return { accion: "duplicado" as const, leadId: undefined };
      return procesarEventoStripe(tx, evento);
    });
    if (!["duplicado", "ignorado", "sin_cambios"].includes(resultado.accion)) {
      await auditar({
        actorId: "stripe",
        accion: `pago.${resultado.accion}`,
        objetivoId: "leadId" in resultado ? (resultado.leadId ?? null) : null,
        parametros: { evento: evento.type, modo: evento.livemode ? "live" : "test" },
        resultado: "ok",
        correlationId: correlation,
      });
    }
    log("info", "stripe_evento", { correlation, tipo: evento.type, accion: resultado.accion });
    return json({ recibido: true, accion: resultado.accion }, { correlation });
  } catch (fallo) {
    const codigo = typeof fallo === "object" && fallo && "code" in fallo ? String((fallo as { code: unknown }).code) : "SIN_CODIGO";
    log("error", "stripe_evento_fallo", { correlation, tipo: evento.type, codigo });
    // 500: Stripe reintentará más tarde.
    return error("ERROR_PROCESANDO", "No se pudo procesar el evento.", { status: 500, correlation });
  }
}
