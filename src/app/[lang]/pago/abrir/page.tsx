import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { AceptarCondiciones } from "@/components/legal/TextoLegal";
import { PagoAbrir } from "@/components/superapp/Pagos";
import { DICCIONARIOS } from "@/lib/i18n";
import { esLocale } from "@/lib/i18n/locales";

export async function generateMetadata({ params }: PageProps<"/[lang]/pago/abrir">): Promise<Metadata> {
  const { lang } = await params;
  return esLocale(lang) ? { title: DICCIONARIOS[lang].pago.continuarPago } : {};
}

export default async function PagoAbrirPagina({ params }: PageProps<"/[lang]/pago/abrir">) {
  const { lang } = await params;
  if (!esLocale(lang)) notFound();
  return (
    <div className="contenedor--estrecho" style={{ margin: "0 auto" }}>
      <PagoAbrir locale={lang}>
        <AceptarCondiciones locale={lang} />
      </PagoAbrir>
    </div>
  );
}
