import Link from "next/link";
import { NucleoHestia } from "@/components/holo/NucleoHestia";
import { SimboloBurofast } from "@/components/Marca";
import { DICCIONARIOS } from "@/lib/i18n";
import { direccion, LOCALES, NOMBRE_NATIVO } from "@/lib/i18n/locales";

// Paso 0: el idioma se elige antes que nada. Cada puerta se presenta en su
// propio idioma, para que cualquiera encuentre la suya.
export default function Puerta() {
  const es = DICCIONARIOS.es;
  return (
    <div className="puerta">
      <div className="rejilla-holo" aria-hidden="true" />
      <header className="puerta-cabecera">
        <span className="marca">
          <SimboloBurofast tamano={34} />
          <span>
            <span className="marca-nombre">BUROFAST</span>
            <span className="marca-lema">{es.marca.lema}</span>
          </span>
        </span>
        <Link className="chip-cristal" href="/mando">Centro de mando</Link>
      </header>

      <main className="puerta-escena entrar">
        <div className="puerta-nucleo marco-hud">
          <NucleoHestia tamano={260} etiqueta="HESTIA" estadoInicial="escuchando" />
        </div>
        <div className="puerta-texto">
          <p className="hud-etiqueta">
            <span>HESTIA</span>
            <span>{LOCALES.map((l) => l.toUpperCase()).join(" · ")}</span>
          </p>
          <h1 className="portada-titulo">{es.pasos.idioma.titulo}</h1>
          <p className="portada-narrativa">{es.pasos.idioma.narrativa}</p>
          <div className="opciones idiomas">
            {LOCALES.map((locale) => (
              <Link key={locale} href={`/${locale}`} className="opcion idioma cristal" hrefLang={locale} lang={locale} dir={direccion(locale)}>
                <span className="opcion-icono mono" aria-hidden="true">{locale.toUpperCase()}</span>
                <span>
                  <span className="opcion-titulo">{NOMBRE_NATIVO[locale]}</span>
                  <span className="opcion-detalle">{DICCIONARIOS[locale].nucleo.saludo}</span>
                </span>
              </Link>
            ))}
          </div>
        </div>
      </main>

      <footer className="puerta-pie">
        <span>{es.comun.avisoIa}</span>
        <span className="mono">v0.2 · fase 2</span>
      </footer>
    </div>
  );
}
