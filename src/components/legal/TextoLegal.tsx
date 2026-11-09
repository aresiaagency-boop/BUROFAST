import Link from "next/link";
import { Fragment } from "react";
import { LEGALES } from "@/lib/i18n/legal";
import type { Locale } from "@/lib/i18n/locales";
import { trocearTextoLegal } from "@/lib/legal";

// Pinta un texto legal con sus datos. Un dato que falta se ve como «pendiente»,
// marcado: nunca un hueco silencioso ni un dato inventado.
export function TextoLegal({ texto, locale }: { texto: string; locale: Locale }) {
  const t = LEGALES[locale];
  return trocearTextoLegal(texto).map((trozo, i) => {
    if (trozo.tipo === "texto") return <Fragment key={i}>{trozo.valor}</Fragment>;
    if (trozo.valor) return <strong key={i} className="dato-legal">{trozo.valor}</strong>;
    return <mark key={i} className="dato-legal dato-legal--pendiente">{t.pendiente}</mark>;
  });
}

// «Al pagar aceptas las {condiciones}.» con el enlace en su sitio, sea cual sea
// el orden de las palabras en cada idioma.
export function AceptarCondiciones({ locale }: { locale: Locale }) {
  const t = LEGALES[locale];
  const [antes, despues = ""] = t.aceptarPago.split("{condiciones}");
  return (
    <p className="legal-aceptar">
      {antes}
      <Link href={`/${locale}/legal/condiciones`} target="_blank">{t.enlaceCondiciones}</Link>
      {despues}
    </p>
  );
}
