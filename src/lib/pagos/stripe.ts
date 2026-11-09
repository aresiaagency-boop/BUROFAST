import Stripe from "stripe";
import type { Locale } from "@/lib/i18n/locales";

// Cliente de Stripe. La clave vive solo en el servidor (STRIPE_SECRET_KEY:
// mejor una clave restringida rk_ con permiso de escritura en Checkout
// Sessions). El navegador nunca ve una clave ni decide un importe.

let cliente: Stripe | null = null;

export function stripeConfigurado() {
  return Boolean(process.env.STRIPE_SECRET_KEY?.trim());
}

export function webhookStripeConfigurado() {
  return Boolean(process.env.STRIPE_WEBHOOK_SECRET?.trim());
}

export type ModoStripe = "live" | "test";

export function modoStripe(): ModoStripe | null {
  const clave = process.env.STRIPE_SECRET_KEY?.trim() ?? "";
  if (/^(sk|rk)_live_/.test(clave)) return "live";
  if (/^(sk|rk)_test_/.test(clave)) return "test";
  return null;
}

export function stripe() {
  const clave = process.env.STRIPE_SECRET_KEY?.trim();
  if (!clave) throw new Error("STRIPE_NOT_CONFIGURED");
  if (!cliente) {
    cliente = new Stripe(clave, { maxNetworkRetries: 2, timeout: 20_000, appInfo: { name: "BUROFAST", version: "0.2.0" } });
  }
  return cliente;
}

// Checkout no tiene árabe ni ucraniano: «auto» usa el idioma del navegador.
export const LOCALE_STRIPE: Record<Locale, "es" | "en-GB" | "fr" | "pt" | "auto"> = {
  es: "es",
  en: "en-GB",
  fr: "fr",
  pt: "pt",
  ar: "auto",
  uk: "auto",
};

export function construirEventoStripe(cuerpo: string, firma: string | null) {
  const secreto = process.env.STRIPE_WEBHOOK_SECRET?.trim();
  if (!secreto) throw new Error("STRIPE_WEBHOOK_NOT_CONFIGURED");
  if (!firma) throw new Error("STRIPE_SIGNATURE_MISSING");
  return stripe().webhooks.constructEvent(cuerpo, firma, secreto);
}

export type { Stripe };
