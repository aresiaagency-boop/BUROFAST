import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { TextoLegal } from "@/components/legal/TextoLegal";
import { LEGALES } from "@/lib/i18n/legal";
import { esLocale, ETIQUETA_INTL } from "@/lib/i18n/locales";
import { DOCUMENTOS_LEGALES, esDocumentoLegal, LEGAL_ACTUALIZADO } from "@/lib/legal";

export async function generateMetadata({ params }: PageProps<"/[lang]/legal/[documento]">): Promise<Metadata> {
  const { lang, documento } = await params;
  if (!esLocale(lang) || !esDocumentoLegal(documento)) return {};
  return { title: LEGALES[lang].documentos[documento].titulo };
}

export default async function PaginaLegal({ params }: PageProps<"/[lang]/legal/[documento]">) {
  const { lang, documento } = await params;
  if (!esLocale(lang) || !esDocumentoLegal(documento)) notFound();
  const t = LEGALES[lang];
  const doc = t.documentos[documento];
  const fecha = new Intl.DateTimeFormat(ETIQUETA_INTL[lang], { dateStyle: "long", timeZone: "UTC" }).format(new Date(`${LEGAL_ACTUALIZADO}T00:00:00Z`));
  return (
    <article className="legal cristal">
      <p className="hud-etiqueta"><span>{t.menu}</span></p>
      <h1>{doc.titulo}</h1>
      <p className="legal-resumen">{doc.resumen}</p>
      <p className="legal-meta">
        {t.actualizado}: <time dateTime={LEGAL_ACTUALIZADO}>{fecha}</time>
        {t.traduccion && <span> · {t.traduccion}</span>}
      </p>
      <nav className="legal-nav" aria-label={t.menu}>
        {DOCUMENTOS_LEGALES.map((id) => (
          <Link key={id} className="chip-cristal" href={`/${lang}/legal/${id}`} aria-current={id === documento ? "page" : undefined}>
            {t.nombres[id]}
          </Link>
        ))}
      </nav>
      {doc.secciones.map((seccion) => (
        <section key={seccion.titulo}>
          <h2>{seccion.titulo}</h2>
          {seccion.parrafos.map((parrafo) => (
            <p key={parrafo}><TextoLegal texto={parrafo} locale={lang} /></p>
          ))}
        </section>
      ))}
    </article>
  );
}
