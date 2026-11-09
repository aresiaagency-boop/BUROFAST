import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { CabeceraMotor } from "@/components/superapp/CabeceraMotor";
import { MotorDocumentos } from "@/components/superapp/MotorDocumentos";
import { DICCIONARIOS } from "@/lib/i18n";
import { esLocale } from "@/lib/i18n/locales";

export async function generateMetadata({ params }: PageProps<"/[lang]/documentos">): Promise<Metadata> {
  const { lang } = await params;
  return esLocale(lang) ? { title: DICCIONARIOS[lang].motorDocumentos.titulo } : {};
}

export default async function Documentos({ params }: PageProps<"/[lang]/documentos">) {
  const { lang } = await params;
  if (!esLocale(lang)) notFound();
  const t = DICCIONARIOS[lang];
  return (
    <>
      <CabeceraMotor locale={lang} agente="MNEMOSINE" titulo={t.motorDocumentos.titulo} narrativa={t.motorDocumentos.narrativa} />
      <MotorDocumentos locale={lang} />
    </>
  );
}
