export const LOCALES = ["es", "en", "fr", "pt", "ar", "uk"] as const;
export type Locale = (typeof LOCALES)[number];
export const LOCALE_POR_DEFECTO: Locale = "es";

export const NOMBRE_NATIVO: Record<Locale, string> = {
  es: "Español",
  en: "English",
  fr: "Français",
  pt: "Português",
  ar: "العربية",
  uk: "Українська",
};

// Código BCP-47 para Intl (precios, fechas) y para el atributo lang.
export const ETIQUETA_INTL: Record<Locale, string> = {
  es: "es-ES",
  en: "en-GB",
  fr: "fr-FR",
  pt: "pt-PT",
  ar: "ar",
  uk: "uk-UA",
};

export function esLocale(valor: string | null | undefined): valor is Locale {
  return Boolean(valor) && (LOCALES as readonly string[]).includes(valor as string);
}

export function direccion(locale: Locale) {
  return locale === "ar" ? "rtl" : "ltr";
}
