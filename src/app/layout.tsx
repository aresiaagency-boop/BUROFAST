import type { Metadata, Viewport } from "next";
import { headers } from "next/headers";
import "@fontsource-variable/inter";
import "@fontsource-variable/space-grotesk";
import "@fontsource-variable/jetbrains-mono";
import "@fontsource-variable/noto-sans-arabic";
import "@/styles/tokens.css";
import "@/styles/cristal.css";
import "@/styles/nucleo.css";
import "@/styles/superapp.css";
import "@/styles/funnel.css";
import "@/styles/mando.css";
import { direccion, esLocale, LOCALE_POR_DEFECTO } from "@/lib/i18n/locales";

export const metadata: Metadata = {
  title: { default: "BUROFAST · Del primer NIE a la nacionalidad", template: "%s · BUROFAST" },
  description: "Tu camino de extranjería en España, paso a paso y en tu idioma, con HESTIA, su equipo de agentes y abogados colegiados.",
  robots: { index: false, follow: false },
};

export const viewport: Viewport = { themeColor: "#071322", width: "device-width", initialScale: 1, viewportFit: "cover" };

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const cabecera = (await headers()).get("x-burofast-locale");
  const locale = esLocale(cabecera) ? cabecera : LOCALE_POR_DEFECTO;
  return (
    <html lang={locale} dir={direccion(locale)}>
      <body>{children}</body>
    </html>
  );
}
