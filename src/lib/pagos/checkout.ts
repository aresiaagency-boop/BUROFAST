import { urlBase } from "@/lib/auth/base";
import type { ProductoId } from "@/lib/catalogo";
import { PRODUCTOS } from "@/lib/catalogo";
import { DICCIONARIOS } from "@/lib/i18n";
import { LEGALES } from "@/lib/i18n/legal";
import type { Locale } from "@/lib/i18n/locales";
import type { LeadPagable, TipoPago } from "@/lib/pagos/repositorio";
import { importeDe, registrarPendiente, sesionAbierta, yaPagado } from "@/lib/pagos/repositorio";
import { LOCALE_STRIPE, modoStripe, stripe } from "@/lib/pagos/stripe";
import { APP_STRIPE } from "@/lib/pagos/webhook";

export type ResultadoCheckout =
  | { ok: true; url: string; reutilizada: boolean }
  | { ok: false; motivo: "YA_PAGADO" | "SIN_IMPORTE" | "NO_CONFIGURADO" };

const esProducto = (valor: string): valor is ProductoId => valor in PRODUCTOS;

// Abre (o reutiliza) un Checkout de Stripe para un expediente. El importe sale
// del presupuesto que el servidor guardó al crear el expediente, nunca del
// navegador.
export async function abrirCheckout(lead: LeadPagable, tipo: TipoPago, locale: Locale): Promise<ResultadoCheckout> {
  const base = urlBase();
  const modo = modoStripe();
  if (!base || !modo) return { ok: false, motivo: "NO_CONFIGURADO" };
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
  });
  return { ok: true, url: sesion.url, reutilizada: false };
}

export function avisoCondiciones(locale: Locale, base: string) {
  const legal = LEGALES[locale];
  return `${legal.aceptarPago.replace("{condiciones}", legal.enlaceCondiciones)} ${base}/${locale}/legal/condiciones`;
}
