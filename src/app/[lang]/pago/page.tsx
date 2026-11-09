import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { PagoVuelta } from "@/components/superapp/Pagos";
import { DICCIONARIOS } from "@/lib/i18n";
import { esLocale } from "@/lib/i18n/locales";

export async function generateMetadata({ params }: PageProps<"/[lang]/pago">): Promise<Metadata> {
  const { lang } = await params;
  return esLocale(lang) ? { title: DICCIONARIOS[lang].pago.confirmando } : {};
}

export default async function Pago({ params, searchParams }: PageProps<"/[lang]/pago">) {
  const { lang } = await params;
  if (!esLocale(lang)) notFound();
  const consulta = await searchParams;
  const sesion = typeof consulta.sesion === "string" && /^cs_(test|live)_[A-Za-z0-9]+$/.test(consulta.sesion) ? consulta.sesion : null;
  return (
    <div className="contenedor--estrecho" style={{ margin: "0 auto" }}>
      <PagoVuelta locale={lang} sesion={sesion} cancelado={consulta.estado === "cancelado"} />
    </div>
  );
}
