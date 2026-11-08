import { ar } from "@/lib/i18n/ar";
import { en } from "@/lib/i18n/en";
import { es } from "@/lib/i18n/es";
import { fr } from "@/lib/i18n/fr";
import type { Locale } from "@/lib/i18n/locales";
import { pt } from "@/lib/i18n/pt";
import type { Diccionario } from "@/lib/i18n/tipos";
import { uk } from "@/lib/i18n/uk";

export const DICCIONARIOS: Record<Locale, Diccionario> = { es, en, fr, pt, ar, uk };

export function diccionario(locale: Locale) {
  return DICCIONARIOS[locale];
}
