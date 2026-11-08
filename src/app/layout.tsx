import type { Metadata, Viewport } from "next";
import { headers } from "next/headers";
import { direccion, esLocale, LOCALE_POR_DEFECTO } from "@/lib/i18n/locales";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: "BUROFAST · Del primer NIE a la nacionalidad", template: "%s · BUROFAST" },
  description: "Tu camino de extranjería en España, paso a paso y en tu idioma, con HESTIA y abogados colegiados.",
  robots: { index: false, follow: false },
};

export const viewport: Viewport = { themeColor: "#071322", width: "device-width", initialScale: 1 };

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const cabecera = (await headers()).get("x-burofast-locale");
  const locale = esLocale(cabecera) ? cabecera : LOCALE_POR_DEFECTO;
  return (
    <html lang={locale} dir={direccion(locale)}>
      <body>{children}</body>
    </html>
  );
}
