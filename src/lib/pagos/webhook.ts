import type { TransactionSql } from "postgres";
import { aplicarResultado, marcarReembolsado } from "@/lib/pagos/repositorio";
import type { Stripe } from "@/lib/pagos/stripe";

// La cuenta de Stripe de ARES la comparten varias apps (FlyDish, BUROFAST…) y
// cada webhook recibe los eventos de todas. Solo se procesan las sesiones que
// creó BUROFAST; un reembolso se cruza por el pago, que solo existe si es nuestro.
export const APP_STRIPE = "burofast";

export function esEventoAjeno(evento: Stripe.Event) {
  if (!evento.type.startsWith("checkout.session.")) return false;
  const sesion = evento.data.object as Stripe.Checkout.Session;
  return sesion.metadata?.app !== APP_STRIPE;
}

export function idPaymentIntent(valor: string | { id: string } | null | undefined) {
  if (!valor) return null;
  return typeof valor === "string" ? valor : valor.id;
}

// Traduce un evento de Stripe a un cambio de estado del pago. Devuelve qué
// hizo, para el log y la auditoría.
export async function procesarEventoStripe(tx: TransactionSql, evento: Stripe.Event) {
  switch (evento.type) {
    case "checkout.session.completed": {
      const sesion = evento.data.object;
      if (sesion.mode !== "payment") return { accion: "ignorado" as const };
      // Con métodos asíncronos (transferencia, SEPA) la sesión se completa
      // antes de cobrar: se espera a async_payment_succeeded.
      if (sesion.payment_status !== "paid") return { accion: "esperando_cobro" as const };
      const fila = await aplicarResultado(tx, { sessionId: sesion.id, estado: "pagado", paymentIntent: idPaymentIntent(sesion.payment_intent) });
      return { accion: fila ? ("pagado" as const) : ("sin_cambios" as const), leadId: fila?.leadId };
    }
    case "checkout.session.async_payment_succeeded": {
      const sesion = evento.data.object;
      const fila = await aplicarResultado(tx, { sessionId: sesion.id, estado: "pagado", paymentIntent: idPaymentIntent(sesion.payment_intent) });
      return { accion: fila ? ("pagado" as const) : ("sin_cambios" as const), leadId: fila?.leadId };
    }
    case "checkout.session.async_payment_failed": {
      const sesion = evento.data.object;
      const fila = await aplicarResultado(tx, { sessionId: sesion.id, estado: "fallido", paymentIntent: idPaymentIntent(sesion.payment_intent) });
      return { accion: fila ? ("fallido" as const) : ("sin_cambios" as const), leadId: fila?.leadId };
    }
    case "checkout.session.expired": {
      const sesion = evento.data.object;
      const fila = await aplicarResultado(tx, { sessionId: sesion.id, estado: "expirado", paymentIntent: null });
      return { accion: fila ? ("expirado" as const) : ("sin_cambios" as const), leadId: fila?.leadId };
    }
    case "charge.refunded": {
      const cargo = evento.data.object;
      const intento = idPaymentIntent(cargo.payment_intent);
      // Solo un reembolso total cambia el estado; uno parcial (la garantía
      // Urgente, por ejemplo) lo registra el equipo.
      if (!cargo.refunded || !intento) return { accion: "reembolso_parcial" as const };
      const fila = await marcarReembolsado(tx, intento);
      return { accion: fila ? ("reembolsado" as const) : ("sin_cambios" as const), leadId: fila?.leadId };
    }
    default:
      return { accion: "ignorado" as const };
  }
}
