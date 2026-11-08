import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Funnel } from "@/components/funnel/Funnel";
import { DICCIONARIOS } from "@/lib/i18n";
import { esLocale } from "@/lib/i18n/locales";

export async function generateMetadata({ params }: PageProps<"/[lang]/camino">): Promise<Metadata> {
  const { lang } = await params;
  return esLocale(lang) ? { title: DICCIONARIOS[lang].pasos.sueno.capitulo } : {};
}

export default async function Camino({ params }: PageProps<"/[lang]/camino">) {
  const { lang } = await params;
  if (!esLocale(lang)) notFound();
  // Solo dígitos: wa.me no acepta «+» ni espacios.
  const whatsapp = process.env.HESTIA_WHATSAPP_NUMERO?.replace(/\D/g, "") || null;
  return <Funnel locale={lang} whatsapp={whatsapp} />;
}
