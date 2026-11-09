import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { CabeceraMotor } from "@/components/superapp/CabeceraMotor";
import { MotorGuardian } from "@/components/superapp/MotorGuardian";
import { DICCIONARIOS } from "@/lib/i18n";
import { esLocale } from "@/lib/i18n/locales";

export async function generateMetadata({ params }: PageProps<"/[lang]/guardian">): Promise<Metadata> {
  const { lang } = await params;
  return esLocale(lang) ? { title: DICCIONARIOS[lang].motorGuardian.titulo } : {};
}

export default async function Guardian({ params }: PageProps<"/[lang]/guardian">) {
  const { lang } = await params;
  if (!esLocale(lang)) notFound();
  const t = DICCIONARIOS[lang];
  return (
    <>
      <CabeceraMotor locale={lang} agente="ARGOS" titulo={t.motorGuardian.titulo} narrativa={t.motorGuardian.narrativa} />
      <MotorGuardian locale={lang} />
    </>
  );
}
