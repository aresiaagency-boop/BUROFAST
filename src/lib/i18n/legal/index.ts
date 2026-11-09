import { ar } from "@/lib/i18n/legal/ar";
import { en } from "@/lib/i18n/legal/en";
import { es } from "@/lib/i18n/legal/es";
import { fr } from "@/lib/i18n/legal/fr";
import { pt } from "@/lib/i18n/legal/pt";
import type { TextosLegales } from "@/lib/i18n/legal/tipos";
import { uk } from "@/lib/i18n/legal/uk";
import type { Locale } from "@/lib/i18n/locales";

export const LEGALES: Record<Locale, TextosLegales> = { es, en, fr, pt, ar, uk };
