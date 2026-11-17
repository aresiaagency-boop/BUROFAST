"use client";

import { useEffect, useState } from "react";
import { DICCIONARIOS } from "@/lib/i18n";
import { LOCALES, type Locale } from "@/lib/i18n/locales";
import { MAPA, MERIDIANOS, PERIODO_BARRIDO_S, SEDE, ZONAS, type SenalesRadar } from "@/lib/radar";

// Radar holográfico de la portada sobre el mapamundi de A.R.E.S. El haz barre
// el mapa y enciende cada zona de atención al pasar por ella; las cifras son
// las de la plataforma, pedidas a /api/v1/radar cada 30 s.
const t = DICCIONARIOS.es.radar;
const { cx, cy, radio, lado } = MAPA;
const MARGEN = 50;
const ESTELA = 22; // sectores de la estela del haz (2,5° cada uno)

// Posición de la etiqueta de cada idioma respecto a su ciudad principal:
// Europa queda muy junta en esta proyección y las etiquetas no deben pisarse.
const DESPLAZAMIENTO: Record<Locale, [number, number, "start" | "end"]> = {
  es: [-14, -16, "end"],
  en: [-30, -26, "end"],
  fr: [-22, 26, "end"],
  pt: [-16, 22, "end"],
  ar: [-34, 6, "end"],
  uk: [20, -18, "start"],
};

function sector(desde: number, hasta: number) {
  const a = ((desde - 90) * Math.PI) / 180;
  const b = ((hasta - 90) * Math.PI) / 180;
  const r = radio;
  return `M0 0L${(r * Math.cos(a)).toFixed(1)} ${(r * Math.sin(a)).toFixed(1)}A${r} ${r} 0 0 1 ${(r * Math.cos(b)).toFixed(1)} ${(r * Math.sin(b)).toFixed(1)}Z`;
}

// Curva de cada zona a la sede: la señal «viaja» a Palma.
function arco(x: number, y: number) {
  const mx = (x + SEDE.x) / 2;
  const my = (y + SEDE.y) / 2;
  const dx = SEDE.x - x;
  const dy = SEDE.y - y;
  return `M${x} ${y}Q${(mx - dy * 0.22).toFixed(1)} ${(my + dx * 0.22).toFixed(1)} ${SEDE.x} ${SEDE.y}`;
}

const retardo = (angulo: number) => `${((angulo / 360) * PERIODO_BARRIDO_S).toFixed(2)}s`;

export function RadarMundial() {
  const [senales, setSenales] = useState<SenalesRadar | null>(null);
  const [sinSenal, setSinSenal] = useState(false);

  useEffect(() => {
    let vivo = true;
    async function pedir() {
      if (document.visibilityState === "hidden") return;
      try {
        const respuesta = await fetch("/api/v1/radar", { cache: "no-store" });
        if (!respuesta.ok) throw new Error(String(respuesta.status));
        const datos = (await respuesta.json()) as SenalesRadar;
        if (vivo) {
          setSenales(datos);
          setSinSenal(false);
        }
      } catch {
        if (vivo) setSinSenal(true);
      }
    }
    void pedir();
    const intervalo = window.setInterval(pedir, 30_000);
    document.addEventListener("visibilitychange", pedir);
    return () => {
      vivo = false;
      window.clearInterval(intervalo);
      document.removeEventListener("visibilitychange", pedir);
    };
  }, []);

  const cuenta = (idioma: Locale) => senales?.conversaciones24h?.[idioma];
  const hora = senales ? new Date(senales.comprobadoEn).toLocaleTimeString("es-ES") : null;
  const hestia = senales?.hestia;
  const estadoHestia = !hestia ? null : hestia.estado === "ia" ? "operativo" : hestia.estado === "local" ? "aviso" : "error";
  const estadoBase = !senales ? null : senales.baseDatos.estado === "operativo" ? "operativo" : senales.baseDatos.estado === "no_configurado" ? "aviso" : "error";

  return (
    <figure className="radar" aria-label={t.titulo}>
      <svg className="radar-lienzo" viewBox={`${-MARGEN} ${-MARGEN} ${lado + MARGEN * 2} ${lado + MARGEN * 2}`} role="img" aria-labelledby="radar-titulo radar-desc">
        <title id="radar-titulo">{t.titulo}</title>
        <desc id="radar-desc">{t.descripcion}</desc>
        <defs>
          <clipPath id="radar-disco">
            <circle cx={cx} cy={cy} r={radio + 1} />
          </clipPath>
          <clipPath id="radar-disco-centrado">
            <circle cx={0} cy={0} r={radio} />
          </clipPath>
          <radialGradient id="radar-viñeta" cx="50%" cy="50%" r="50%">
            <stop offset="0.72" stopColor="#040c17" stopOpacity="0" />
            <stop offset="1" stopColor="#040c17" stopOpacity="0.55" />
          </radialGradient>
          <filter id="radar-brillo" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="3" result="b" />
            <feMerge>
              <feMergeNode in="b" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        {/* Anillo exterior: escala de meridianos y aro que gira despacio. */}
        <g className="radar-aro">
          <circle cx={cx} cy={cy} r={radio + 30} className="radar-aro-guion" />
          {Array.from({ length: 72 }, (_, i) => {
            const a = ((i * 5 - 90) * Math.PI) / 180;
            const largo = i % 6 === 0 ? 12 : 5;
            return <line key={i} x1={cx + (radio + 6) * Math.cos(a)} y1={cy + (radio + 6) * Math.sin(a)} x2={cx + (radio + 6 + largo) * Math.cos(a)} y2={cy + (radio + 6 + largo) * Math.sin(a)} className={i % 6 === 0 ? "radar-marca radar-marca--mayor" : "radar-marca"} />;
          })}
          {MERIDIANOS.map((m) => {
            const dx = m.x - cx;
            const dy = m.y - cy;
            const d = Math.hypot(dx, dy) || 1;
            return (
              <text key={m.lon} x={cx + (dx / d) * (radio + 38)} y={cy + (dy / d) * (radio + 38)} className="radar-meridiano" textAnchor="middle" dominantBaseline="middle">
                {m.etiqueta}
              </text>
            );
          })}
        </g>

        {/* El mapamundi tal cual, recortado a su disco. */}
        <image href="/mapa/mapamundi.jpg" x={0} y={0} width={lado} height={lado} clipPath="url(#radar-disco)" preserveAspectRatio="xMidYMid slice" />
        <circle cx={cx} cy={cy} r={radio} fill="url(#radar-viñeta)" />
        <circle cx={cx} cy={cy} r={radio} className="radar-borde" />

        {/* Haz del radar con su estela. */}
        <g transform={`translate(${cx} ${cy})`} clipPath="url(#radar-disco-centrado)">
          <g className="radar-barrido" style={{ animationDuration: `${PERIODO_BARRIDO_S}s` }}>
            <circle r={radio} className="radar-barrido-caja" />
            {Array.from({ length: ESTELA }, (_, i) => (
              <path key={i} d={sector(-(i + 1) * 2.5, -i * 2.5)} className="radar-estela" style={{ opacity: 0.32 * (1 - i / ESTELA) ** 1.6 }} />
            ))}
            <line x1={0} y1={0} x2={0} y2={-radio} className="radar-haz" />
          </g>
        </g>

        {/* Señales: cada zona viaja a la sede. */}
        {ZONAS.map((z) => (
          <path key={`arco-${z.ciudad}`} d={arco(z.x, z.y)} className="radar-arco" data-idioma={z.idioma} />
        ))}

        {ZONAS.map((z) => (
          <g key={z.ciudad} className="radar-zona" data-idioma={z.idioma} transform={`translate(${z.x} ${z.y})`}>
            <circle r={4} className="radar-ping" style={{ animationDelay: retardo(z.angulo), animationDuration: `${PERIODO_BARRIDO_S}s` }} />
            <circle r={4.5} className="radar-punto" filter="url(#radar-brillo)" />
            <title>{`${z.idioma.toUpperCase()} · ${z.ciudad}`}</title>
          </g>
        ))}

        {ZONAS.filter((z) => z.principal).map((z) => {
          const [dx, dy, ancla] = DESPLAZAMIENTO[z.idioma];
          const n = cuenta(z.idioma);
          return (
            <g key={`etq-${z.idioma}`} className="radar-etiqueta" data-idioma={z.idioma}>
              <line x1={z.x} y1={z.y} x2={z.x + dx * 0.7} y2={z.y + dy * 0.7} className="radar-guia" />
              <text x={z.x + dx} y={z.y + dy} textAnchor={ancla} dominantBaseline="middle">
                <tspan className="radar-codigo">{z.idioma.toUpperCase()}</tspan>
                {typeof n === "number" && <tspan className="radar-cuenta" dx={6}>{n}</tspan>}
              </text>
            </g>
          );
        })}

        <g className="radar-sede" transform={`translate(${SEDE.x} ${SEDE.y})`}>
          <circle r={14} className="radar-sede-onda" />
          <path d="M0 -7L7 0L0 7L-7 0Z" className="radar-sede-rombo" filter="url(#radar-brillo)" />
          <title>{t.sede}</title>
        </g>
        <text x={SEDE.x + 16} y={SEDE.y + 22} className="radar-sede-texto" textAnchor="start">{t.sede.toUpperCase()}</text>
      </svg>

      <figcaption className="radar-hud" aria-live="polite">
        <p className="radar-hud-cabecera">
          <span className="radar-latido" aria-hidden="true" />
          <span>{t.enVivo}</span>
          {hora && <span className="radar-hora">{t.comprobado(hora)}</span>}
        </p>
        {sinSenal && !senales ? (
          <p className="radar-hud-aviso">{t.sinSenal}</p>
        ) : (
          <>
            <p className="radar-hud-sistema">
              <span className="radar-indicador" data-estado={estadoHestia ?? "sin-datos"}>
                {!hestia ? `HESTIA · ${t.sinDatos}` : hestia.estado === "ia" ? t.hestiaIa : hestia.estado === "local" ? t.hestiaLocal : t.hestiaError}
                {hestia?.latenciaMediaMs != null && <span className="mono"> · {(hestia.latenciaMediaMs / 1000).toLocaleString("es-ES", { maximumFractionDigits: 1 })} s</span>}
              </span>
              <span className="radar-indicador" data-estado={estadoBase ?? "sin-datos"}>
                {t.baseDatos}
                <span className="mono"> · {senales?.baseDatos.latenciaMs != null ? `${senales.baseDatos.latenciaMs} ms` : t.sinDatos}</span>
              </span>
            </p>
            <p className="radar-hud-titulo">{t.conversaciones}</p>
            <ul className="radar-idiomas">
              {LOCALES.map((l) => (
                <li key={l} data-idioma={l}>
                  <span className="radar-codigo-hud mono">{l.toUpperCase()}</span>
                  <span className="radar-region">{t.zonas[l]}</span>
                  <span className="mono radar-numero">{typeof cuenta(l) === "number" ? cuenta(l) : "—"}</span>
                </li>
              ))}
            </ul>
            {senales && <p className="radar-hud-contenido mono">{t.contenido(senales.contenido)}</p>}
          </>
        )}
      </figcaption>
    </figure>
  );
}
