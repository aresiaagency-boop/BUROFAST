import Link from "next/link";
import { SimboloBurofast } from "@/components/Marca";
import { Sendero } from "@/components/funnel/Sendero";
import { DICCIONARIOS } from "@/lib/i18n";
import { LOCALES, NOMBRE_NATIVO } from "@/lib/i18n/locales";

// Paso 0: el idioma se elige antes que nada, y cada opción se presenta en su
// propio idioma para que cualquiera encuentre la suya.
export default function Inicio() {
  const es = DICCIONARIOS.es;
  return (
    <div className="funnel">
      <header className="cabecera">
        <span className="marca">
          <SimboloBurofast />
          <span>
            <span className="marca-nombre">BUROFAST</span>
            <span className="marca-lema">{es.marca.lema}</span>
          </span>
        </span>
      </header>
      <Sendero hito={0} capitulo={es.pasos.idioma.capitulo} meta={es.comun.meta} rtl={false} />
      <main className="escena entrar">
        <p className="capitulo">{LOCALES.map((l) => DICCIONARIOS[l].pasos.idioma.capitulo).join(" · ")}</p>
        <h1 className="titulo-paso">{es.pasos.idioma.titulo}</h1>
        <p className="narrativa">{es.pasos.idioma.narrativa}</p>
        <div className="opciones idiomas">
          {LOCALES.map((locale) => (
            <Link key={locale} href={`/${locale}/camino`} className="opcion idioma" hrefLang={locale} lang={locale} dir={locale === "ar" ? "rtl" : "ltr"}>
              <span className="opcion-icono mono" aria-hidden="true">{locale.toUpperCase()}</span>
              <span>
                <span className="opcion-titulo">{NOMBRE_NATIVO[locale]}</span>
                <span className="opcion-detalle">{DICCIONARIOS[locale].pasos.idioma.titulo}</span>
              </span>
            </Link>
          ))}
        </div>
      </main>
      <footer className="pie">
        <span>{es.comun.avisoIa}</span>
        <Link className="boton-texto" href="/mando">Centro de mando</Link>
      </footer>
    </div>
  );
}
