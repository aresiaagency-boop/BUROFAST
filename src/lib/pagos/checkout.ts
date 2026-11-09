import { urlBase } from "@/lib/auth/base";
import type { ProductoId } from "@/lib/catalogo";
import { PRODUCTOS } from "@/lib/catalogo";
import { DICCIONARIOS } from "@/lib/i18n";
import { LEGALES } from "@/lib/i18n/legal";
import type { Locale } from "@/lib/i18n/locales";
import type { LeadPagable, TipoPago } from "@/lib/pagos/repositorio";
import { importeDe, marcarExpirado, registrarPendiente, sesionAbierta, sesionesPendientes, yaPagado } from "@/lib/pagos/repositorio";
import { LOCALE_STRIPE, modoStripe, stripe } from "@/lib/pagos/stripe";
import { APP_STRIPE } from "@/lib/pagos/webhook";
import { datosLegalesPendientes, LEGAL_ACTUALIZADO } from "@/lib/legal";

export type ResultadoCheckout =
  | { ok: true; url: string; reutilizada: boolean }
  | { ok: false; motivo: "YA_PAGADO" | "SIN_IMPORTE" | "NO_CONFIGURADO" | "LEGAL_PENDIENTE" };

const esProducto = (valor: string): valor is ProductoId => valor in PRODUCTOS;

// Abre (o reutiliza) un Checkout de Stripe para un expediente. El importe sale
// del presupuesto que el servidor guardó al crear el expediente, nunca del
// navegador.
export async function abrirCheckout(lead: LeadPagable, tipo: TipoPago, locale: Locale): Promise<ResultadoCheckout> {
  const base = urlBase();
  const modo = modoStripe();
  if (!base || !modo) return { ok: false, motivo: "NO_CONFIGURADO" };
  // Cobrar en serio exige que el cliente sepa con quién contrata (LSSI art. 10,
  // TRLGDCU art. 97): sin titular, NIF, domicilio y abogado no hay cobro live.
  if (modo === "live" && datosLegalesPendientes().length > 0) return { ok: false, motivo: "LEGAL_PENDIENTE" };
  if (lead.nivel === "N3" || lead.totalCentimos <= 0) return { ok: false, motivo: "SIN_IMPORTE" };
  if (await yaPagado(lead.id, tipo)) return { ok: false, motivo: "YA_PAGADO" };

  const abierta = await sesionAbierta(lead.id, tipo);
  if (abierta) return { ok: true, url: abierta.url, reutilizada: true };

  const importe = importeDe(tipo, lead.totalCentimos);
  const t = DICCIONARIOS[locale];
  const producto = esProducto(lead.productoId) ? t.productos[lead.productoId] : lead.productoId;
  // Misma clave durante una hora: un doble clic o dos pestañas devuelven la
  // misma sesión en lugar de abrir dos cobros.
  const hora = Math.floor(Date.now() / 3_600_000);
  // `app` separa nuestros cobros de los de otras apps de la misma cuenta de Stripe.
  const metadata = { app: APP_STRIPE, lead_id: lead.id, referencia: lead.referencia, tipo };
  const sesion = await stripe().checkout.sessions.create(
    {
      mode: "payment",
      // Una hora (Stripe permite de 30 min a 24 h): un Checkout abierto no
      // debe sobrevivir a un cambio de opinión del abogado.
      expires_at: Math.floor(Date.now() / 1000) + DURACION_CHECKOUT_S,
      locale: LOCALE_STRIPE[locale],
      client_reference_id: lead.id,
      customer_email: lead.email ?? undefined,
      line_items: [
        {
          quantity: 1,
          price_data: {
            currency: "eur",
            unit_amount: importe,
            product_data: { name: `BUROFAST · ${producto}`, description: t.pago.concepto(tipo, lead.referencia) },
          },
        },
      ],
      metadata,
      // Stripe no enlaza nuestras condiciones por sí solo: van junto al botón de pagar.
      custom_text: { submit: { message: avisoCondiciones(locale, base) } },
      payment_intent_data: { metadata, description: `BUROFAST ${lead.referencia} · ${tipo}` },
      success_url: `${base}/${locale}/pago?estado=ok&sesion={CHECKOUT_SESSION_ID}`,
      cancel_url: `${base}/${locale}/pago?estado=cancelado&ref=${encodeURIComponent(lead.referencia)}`,
    },
    { idempotencyKey: `bf:${lead.id}:${tipo}:${importe}:${locale}:${hora}` },
  );
  if (!sesion.url) throw new Error("STRIPE_SESSION_WITHOUT_URL");
  await registrarPendiente({
    leadId: lead.id, tipo, importe, modo, sessionId: sesion.id, url: sesion.url, expiraEn: new Date(sesion.expires_at * 1000),
    condicionesVersion: LEGAL_ACTUALIZADO,
    // Solo se llega aquí si el cliente marcó «empezad ya» (lo exige la ruta).
    empezarYaEn: new Date(),
  });
  return { ok: true, url: sesion.url, reutilizada: false };
}

export const DURACION_CHECKOUT_S = 60 * 60;

// Cierra los Checkout abiertos de un expediente que ha dejado de estar
// aprobado. Si una sesión ya se pagó, Stripe no deja cerrarla y el webhook la
// marcará pagada (el centro de mando la señalará para revisar).
export async function cerrarCheckoutsAbiertos(leadId: string) {
  let cerradas = 0;
  let fallidas = 0;
  for (const { sessionId } of await sesionesPendientes(leadId)) {
    try {
      await stripe().checkout.sessions.expire(sessionId);
      await marcarExpirado(sessionId);
      cerradas += 1;
    } catch {
      try {
        const remota = await stripe().checkout.sessions.retrieve(sessionId);
        if (remota.status === "expired") {
          await marcarExpirado(sessionId);
          cerradas += 1;
        } else {
          fallidas += 1;
        }
      } catch {
        fallidas += 1;
      }
    }
  }
  return { cerradas, fallidas };
}

export function avisoCondiciones(locale: Locale, base: string) {
  const legal = LEGALES[locale];
  return `${legal.aceptarPago.replace("{condiciones}", legal.enlaceCondiciones)} ${base}/${locale}/legal/condiciones`;
}
