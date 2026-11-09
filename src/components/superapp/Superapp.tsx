"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { EmblemaAgente, COLOR_AGENTE } from "@/components/holo/EmblemaAgente";
import { NucleoHestia } from "@/components/holo/NucleoHestia";
import { SimboloBurofast } from "@/components/Marca";
import { HestiaConsola } from "@/components/superapp/HestiaConsola";
import { EVENTO_PREGUNTAR } from "@/lib/hestia/vivo";
import { DICCIONARIOS } from "@/lib/i18n";
import type { Locale } from "@/lib/i18n/locales";
import { direccion, LOCALES, NOMBRE_NATIVO } from "@/lib/i18n/locales";
import type { DocumentoLegalId } from "@/lib/legal";
import { DOCUMENTOS_LEGALES } from "@/lib/legal";
import { ENTRADAS, entradaDeRuta, PESTANAS } from "@/lib/navegacion";

const CLAVE_CONSOLA = "burofast.consola.abierta";

export type ClienteVisible = { email: string } | null;

export function Superapp({
  locale,
  cliente,
  whatsapp,
  legal,
  children,
}: {
  locale: Locale;
  cliente: ClienteVisible;
  whatsapp: string | null;
  legal: { menu: string; nombres: Record<DocumentoLegalId, string> };
  children: React.ReactNode;
}) {
  const t = DICCIONARIOS[locale];
  const ruta = usePathname();
  const actual = entradaDeRuta(ruta);
  const [consolaAbierta, setConsolaAbierta] = useState(false);
  const [aperturas, setAperturas] = useState(0);

  // En pantallas anchas la consola empieza abierta; en el resto, cerrada.
  // Se recuerda la última elección durante la sesión.
  useEffect(() => {
    let abierta = window.matchMedia("(min-width: 1440px)").matches;
    try {
      const guardada = sessionStorage.getItem(CLAVE_CONSOLA);
      if (guardada !== null) abierta = guardada === "1";
    } catch {
      // sin almacenamiento: valor por defecto
    }
    const id = requestAnimationFrame(() => setConsolaAbierta(abierta));
    return () => cancelAnimationFrame(id);
  }, []);

  // Un motor pregunta a HESTIA: la consola se abre (la consola envía).
  useEffect(() => {
    const abrir = () => {
      setConsolaAbierta(true);
      setAperturas((n) => n + 1);
    };
    window.addEventListener(EVENTO_PREGUNTAR, abrir);
    return () => window.removeEventListener(EVENTO_PREGUNTAR, abrir);
  }, []);

  const alternarConsola = (abrir: boolean) => {
    setConsolaAbierta(abrir);
    if (abrir) setAperturas((n) => n + 1);
    try {
      sessionStorage.setItem(CLAVE_CONSOLA, abrir ? "1" : "0");
    } catch {
      // sin almacenamiento
    }
  };

  const nombreEntrada = (id: (typeof ENTRADAS)[number]["id"]) => (id === "nucleo" ? t.app.nucleo : t.app.motores[id]);
  const entradaActual = ENTRADAS.find((e) => e.id === actual) ?? ENTRADAS[0];
  const sufijo = ruta.split("/").slice(2).join("/");

  return (
    <div className="superapp" lang={locale} dir={direccion(locale)}>
      <a className="saltar" href="#contenido">{t.app.saltar}</a>
      <div className="rejilla-holo" aria-hidden="true" />

      <header className="barra">
        <Link className="marca" href={`/${locale}`}>
          <SimboloBurofast tamano={32} />
          <span>
            <span className="marca-nombre">BUROFAST</span>
            <span className="marca-lema">{t.marca.lema}</span>
          </span>
        </Link>
        <p className="barra-miga hud-etiqueta" aria-hidden="true">
          <span>{t.app.nucleo}</span>
          {actual && actual !== "nucleo" && <span>{nombreEntrada(actual)}</span>}
          <span className="oro">{t.agentes[entradaActual.agente].nombre}</span>
        </p>
        <div className="barra-acciones">
          <details className="selector-idioma">
            <summary className="chip-cristal" aria-label={t.app.idioma}>
              <span className="mono">{locale.toUpperCase()}</span>
            </summary>
            <ul>
              {LOCALES.map((l) => (
                <li key={l}>
                  <a href={`/${l}${sufijo ? `/${sufijo}` : ""}`} hrefLang={l} lang={l} aria-current={l === locale ? "true" : undefined}>
                    <span>{NOMBRE_NATIVO[l]}</span>
                    <span className="mono">{l.toUpperCase()}</span>
                  </a>
                </li>
              ))}
            </ul>
          </details>
          <button
            type="button"
            className="chip-cristal chip-hestia"
            aria-expanded={consolaAbierta}
            aria-controls="consola-hestia"
            onClick={() => alternarConsola(!consolaAbierta)}
          >
            <NucleoHestia tamano={22} mini etiqueta="" />
            <span>HESTIA</span>
          </button>
          {cliente ? (
            <Link className="chip-cristal" href={`/${locale}/expediente`} title={t.expediente.sesionComo(cliente.email)}>
              {t.app.motores.expediente}
            </Link>
          ) : (
            <a className="chip-cristal" href={`/api/v1/auth/google?destino=${encodeURIComponent(`/${locale}/expediente`)}`}>
              {t.app.entrar}
            </a>
          )}
        </div>
      </header>

      <aside className="riel" aria-label={t.app.navegacion}>
        <nav>
          {ENTRADAS.map((entrada, indice) => (
            <div key={entrada.id}>
              {indice === 1 && <div className="riel-separador" />}
              <Link
                href={`/${locale}${entrada.ruta}`}
                className="riel-enlace cristal plasma-agente"
                aria-current={actual === entrada.id ? "page" : undefined}
                style={{ "--agente": COLOR_AGENTE[entrada.agente] } as React.CSSProperties}
              >
                <EmblemaAgente agente={entrada.agente} tamano={30} activo={actual === entrada.id} />
                <span>
                  <span className="riel-motor">{nombreEntrada(entrada.id)}</span>
                  <span className="riel-agente">{t.agentes[entrada.agente].nombre}</span>
                </span>
              </Link>
            </div>
          ))}
        </nav>
        <p className="riel-temis">{t.temis.ia_se_identifica}</p>
      </aside>

      <main className="trabajo-app" id="contenido" tabIndex={-1}>
        <div className="contenedor">{children}</div>
      </main>

      <HestiaConsola
        locale={locale}
        abierta={consolaAbierta}
        aperturas={aperturas}
        onCerrar={() => alternarConsola(false)}
        whatsapp={whatsapp}
      />
      {!consolaAbierta && (
        <button type="button" className="boton-cristal boton-hestia-flotante plasma-oro" aria-label={t.app.hablarHestia} aria-controls="consola-hestia" aria-expanded={false} onClick={() => alternarConsola(true)}>
          <NucleoHestia tamano={26} mini etiqueta="" />
          <span className="texto-largo">{t.app.hablarHestia}</span>
          <span className="solo-movil" aria-hidden="true">HESTIA</span>
        </button>
      )}

      <nav className="pestanas" aria-label={t.app.navegacion}>
        {PESTANAS.map((id) => {
          const entrada = ENTRADAS.find((e) => e.id === id) ?? ENTRADAS[0];
          return (
            <Link key={id} className="pestana" href={`/${locale}${entrada.ruta}`} aria-current={actual === id ? "page" : undefined} style={{ color: actual === id ? COLOR_AGENTE[entrada.agente] : undefined }}>
              <EmblemaAgente agente={entrada.agente} tamano={26} activo={actual === id} />
              <span>{nombreEntrada(id)}</span>
            </Link>
          );
        })}
      </nav>

      <footer className="pie-app">
        <span>{t.app.idioma}: {NOMBRE_NATIVO[locale]}</span>
        <span>{t.nucleo.lecturas.datos}: {t.nucleo.lecturas.datosValor}</span>
        <nav className="pie-legal" aria-label={legal.menu}>
          {DOCUMENTOS_LEGALES.map((id) => (
            <Link key={id} href={`/${locale}/legal/${id}`}>{legal.nombres[id]}</Link>
          ))}
        </nav>
        <span>{t.app.pie}</span>
      </footer>
    </div>
  );
}
