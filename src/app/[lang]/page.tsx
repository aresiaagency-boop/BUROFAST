import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { NucleoPagina } from "@/components/superapp/NucleoPagina";
import { sesionClienteActual } from "@/lib/auth/cliente";
import { isDatabaseConfigured } from "@/lib/db";
import { expedientesDeCliente } from "@/lib/expediente";
import { DICCIONARIOS } from "@/lib/i18n";
import { esLocale } from "@/lib/i18n/locales";

export async function generateMetadata({ params }: PageProps<"/[lang]">): Promise<Metadata> {
  const { lang } = await params;
  return esLocale(lang) ? { title: DICCIONARIOS[lang].app.nucleo } : {};
}

export default async function Nucleo({ params }: PageProps<"/[lang]">) {
  const { lang } = await params;
  if (!esLocale(lang)) notFound();
  const cliente = await sesionClienteActual();
  let expedientes: number | null = null;
  if (cliente && isDatabaseConfigured()) {
    try {
      expedientes = (await expedientesDeCliente(cliente.emailHash)).length;
    } catch {
      expedientes = null;
    }
  }
  return <NucleoPagina locale={lang} expedientes={expedientes} />;
}
