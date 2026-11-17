"use client";

import type { ReactNode } from "react";
import { useEffect, useId, useRef, useState } from "react";
import { useEstadoHestia, useTrazados } from "@/components/holo/useRadarVivo";
import type { EstadoNucleo } from "@/lib/hestia/vivo";
import type { Locale } from "@/lib/i18n/locales";
import type { GrupoPasaporte, PaisRadar, VarianteRadar } from "@/lib/radar";
import { arcoASede, ENCUADRE_DE, ENCUADRES, MAPA, SEDE } from "@/lib/radar";

// El radar de extranjería: el mapamundi de A.R.E.S. tal cual y, encima, lo
// que el usuario ha elegido convertido en cristal en relieve con bordes de
// plasma: su idioma (la zona), su pasaporte (el grupo), su país y España, la
// meta, siempre en oro. Cada página lo mira con su encuadre, el color de su
// agente y su instrumento propio (reloj, escáner, vigía…), que llega como
// `instrumento` en coordenadas nominales: centro (0, 0) y radio R0.

export const R0 = MAPA.radio;

export type IdsRadar = { disco: string; brillo: string };
export type MarcaAro = { angulo: number; tono: string; activa: boolean; titulo: string };

const polar = (radio: number, grados: number) => {
  const a = ((grados - 90) * Math.PI) / 180;
  return { x: radio * Math.cos(a), y: radio * Math.sin(a) };
};

// Arco del aro entre dos ángulos (0° arriba, sentido horario). Una vuelta
// entera se dibuja en dos mitades: un arco SVG con inicio = fin no se pinta.
export function arcoAro(desde: number, hasta: number, radio: number): string {
  if (hasta - desde >= 359.99) return `${arcoAro(desde, desde + 180, radio)}${arcoAro(desde + 180, desde + 360, radio).replace(/^M[^A]+/, "")}`;
  const a = polar(radio, desde);
  const b = polar(radio, hasta);
  const largo = hasta - desde > 180 ? 1 : 0;
  return `M${a.x.toFixed(1)} ${a.y.toFixed(1)}A${radio} ${radio} 0 ${largo} 1 ${b.x.toFixed(1)} ${b.y.toFixed(1)}`;
}

function sector(desde: number, hasta: number, radio: number) {
  const a = polar(radio, desde);
  const b = polar(radio, hasta);
  return `M0 0L${a.x.toFixed(1)} ${a.y.toFixed(1)}A${radio} ${radio} 0 0 1 ${b.x.toFixed(1)} ${b.y.toFixed(1)}Z`;
}

// Haz con estela. El disco invisible centra la caja en el polo para girar.
export function Barrido({ periodo, estela = 22, paso = 2.5 }: { periodo: number; estela?: number; paso?: number }) {
  return (
    <g className="rx-barrido" style={{ animationDuration: `${periodo}s` }}>
      <circle r={R0} className="rx-caja" />
      {Array.from({ length: estela }, (_, i) => (
        <path key={i} d={sector(-(i + 1) * paso, -i * paso, R0)} className="rx-estela" style={{ opacity: 0.42 * (1 - i / estela) ** 1.5 }} />
      ))}
      <line x1={0} y1={0} x2={0} y2={-R0} className="rx-haz" />
    </g>
  );
}

export type Nivel = "zona" | "grupo" | "pais" | "sede";

// Cristal en relieve: sombra, canto (el grosor del vidrio), cara con bisel
// de luz especular, reflejo y, en el borde, plasma: halo, filo y chispa.
export type IdsCristal = { relieve: string; sombra: string; halo: string; reflejo: string };

export function Cristal({ d, nivel, ids, grosor }: { d: string; nivel: Nivel; ids: IdsCristal; grosor: number }) {
  return (
    <g className={`rx-cristal rx-cristal--${nivel}`}>
      <path d={d} className="rx-cristal-sombra" transform={`translate(${grosor * 1.2} ${grosor * 2.2})`} filter={`url(#${ids.sombra})`} />
      <path d={d} className="rx-cristal-canto" transform={`translate(${grosor * 0.45} ${grosor})`} />
      <path d={d} className="rx-cristal-cara" filter={`url(#${ids.relieve})`} />
      <path d={d} className="rx-cristal-reflejo" fill={`url(#${ids.reflejo})`} />
      <path d={d} className="rx-plasma-halo" vectorEffect="non-scaling-stroke" filter={`url(#${ids.halo})`} />
      <path d={d} className="rx-plasma-filo" vectorEffect="non-scaling-stroke" />
      <path d={d} className="rx-plasma-chispa" vectorEffect="non-scaling-stroke" />
    </g>
  );
}

// Filtros del cristal. `lado` es el del encuadre: el bisel y los halos se
// miden en unidades del mapa y deben verse igual a cualquier acercamiento.
export function DefsCristal({ ids, lado }: { ids: IdsCristal; lado: number }) {
  return (
    <>
      <linearGradient id={ids.reflejo} x1="0" y1="0" x2="1" y2="1">
        <stop offset="0" stopColor="#ffffff" stopOpacity="0.55" />
        <stop offset="0.38" stopColor="#ffffff" stopOpacity="0.1" />
        <stop offset="0.55" stopColor="#ffffff" stopOpacity="0" />
        <stop offset="1" stopColor="#ffffff" stopOpacity="0.12" />
      </linearGradient>
      {/* Bisel: la luz especular sobre el alfa difuminado levanta el vidrio. */}
      <filter id={ids.relieve} x="-15%" y="-15%" width="130%" height="130%" colorInterpolationFilters="sRGB">
        <feGaussianBlur in="SourceAlpha" stdDeviation={(lado * 0.0032).toFixed(2)} result="alfa" />
        <feSpecularLighting in="alfa" surfaceScale="4" specularConstant="1.1" specularExponent="22" lightingColor="#ffffff" result="luz">
          <feDistantLight azimuth="225" elevation="42" />
        </feSpecularLighting>
        <feComposite in="luz" in2="SourceAlpha" operator="in" result="luzDentro" />
        <feComposite in="SourceGraphic" in2="luzDentro" operator="arithmetic" k1="0" k2="1" k3="0.75" k4="0" />
      </filter>
      <filter id={ids.sombra} x="-20%" y="-20%" width="140%" height="140%">
        <feGaussianBlur stdDeviation={(lado * 0.004).toFixed(2)} />
      </filter>
      <filter id={ids.halo} x="-30%" y="-30%" width="160%" height="160%">
        <feGaussianBlur stdDeviation={(lado * 0.0042).toFixed(2)} />
      </filter>
    </>
  );
}

export function RadarExtranjeria({
  variante,
  etiqueta,
  zona = null,
  grupo = null,
  pais = null,
  origen = null,
  enEspana = false,
  estado: estadoInicial = "reposo",
  progreso = null,
  marcas = [],
  barrido = null,
  instrumento,
  sobreMapa,
  hilo = "arco",
  className,
}: {
  variante: VarianteRadar;
  etiqueta: string;
  zona?: Locale | null;
  grupo?: GrupoPasaporte | null;
  pais?: PaisRadar | null;
  origen?: { x: number; y: number } | null;
  enEspana?: boolean;
  estado?: EstadoNucleo;
  progreso?: number | null;
  marcas?: MarcaAro[];
  barrido?: { periodo: number; estela?: number } | null;
  instrumento?: (ids: IdsRadar) => ReactNode;
  sobreMapa?: ReactNode;
  hilo?: "arco" | "ariadna" | "ninguno";
  className?: string;
}) {
  const base = useId().replace(/[^a-zA-Z0-9]/g, "");
  const ids = {
    disco: `rx-disco-${base}`,
    discoNominal: `rx-disco-n-${base}`,
    relieve: `rx-relieve-${base}`,
    sombra: `rx-sombra-${base}`,
    halo: `rx-halo-${base}`,
    reflejo: `rx-reflejo-${base}`,
    vineta: `rx-vineta-${base}`,
    brillo: `rx-brillo-${base}`,
  };
  const estado = useEstadoHestia(estadoInicial);
  const trazados = useTrazados();

  // Fuera de la pantalla, el radar se congela: el plasma no gasta batería.
  const lienzo = useRef<SVGSVGElement>(null);
  const [visible, setVisible] = useState(true);
  useEffect(() => {
    const el = lienzo.current;
    if (!el || typeof IntersectionObserver === "undefined") return;
    const observador = new IntersectionObserver(([e]) => setVisible(e.isIntersecting));
    observador.observe(el);
    return () => observador.disconnect();
  }, []);

  const encuadre = ENCUADRE_DE[variante];
  const [x0, y0, lado] = ENCUADRES[encuadre];
  const radio = lado / 2;
  const cx = x0 + radio;
  const cy = y0 + radio;
  const k = radio / R0;
  const margen = lado * 0.085;
  const grosor = lado * 0.0055;
  const avance = progreso === null ? null : Math.max(0, Math.min(1, progreso));

  // Lo elegido manda: con país, la zona y el grupo bajan de tono.
  const capas: { d: string; nivel: Nivel; clave: string }[] = [];
  if (trazados) {
    if (zona && trazados.zonas[zona]) capas.push({ d: trazados.zonas[zona], nivel: "zona", clave: `z-${zona}` });
    if (grupo && trazados.grupos[grupo]) capas.push({ d: trazados.grupos[grupo], nivel: "grupo", clave: `g-${grupo}` });
    if (pais && trazados.paises[pais]) capas.push({ d: trazados.paises[pais], nivel: "pais", clave: `p-${pais}` });
    capas.push({ d: trazados.paises.ES, nivel: "sede", clave: "sede" });
  }

  return (
    <svg
      ref={lienzo}
      className={`rx rx--${variante}${className ? ` ${className}` : ""}`}
      data-estado={estado}
      data-pausado={visible ? undefined : "si"}
      // Unidad de alzado del cristal: igual a cualquier acercamiento.
      style={{ "--rx-u": (lado / 632).toFixed(3) } as React.CSSProperties}
      data-encuadre={encuadre}
      data-con-pais={pais ? "si" : undefined}
      data-con-grupo={grupo ? "si" : undefined}
      viewBox={`${(x0 - margen).toFixed(1)} ${(y0 - margen).toFixed(1)} ${(lado + margen * 2).toFixed(1)} ${(lado + margen * 2).toFixed(1)}`}
      {...(etiqueta ? { role: "img", "aria-label": etiqueta } : { "aria-hidden": true, focusable: "false" })}
    >
      <defs>
        <clipPath id={ids.disco}>
          <circle cx={cx} cy={cy} r={radio} />
        </clipPath>
        <clipPath id={ids.discoNominal}>
          <circle r={R0} />
        </clipPath>
        <radialGradient id={ids.vineta} cx="50%" cy="50%" r="50%">
          <stop offset="0.62" stopColor="#040c17" stopOpacity="0" />
          <stop offset="1" stopColor="#040c17" stopOpacity="0.72" />
        </radialGradient>
        <DefsCristal ids={ids} lado={lado} />
        <filter id={ids.brillo} x="-60%" y="-60%" width="220%" height="220%">
          <feGaussianBlur stdDeviation="3" result="b" />
          <feMerge>
            <feMergeNode in="b" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>

      {/* Fondo del disco: halo del aro. */}
      <circle cx={cx} cy={cy} r={radio * 1.04} className="rx-fondo" />

      {/* El mapamundi tal cual, con el tinte del agente de la página. */}
      <g clipPath={`url(#${ids.disco})`}>
        <image href="/mapa/mapamundi.jpg" x={0} y={0} width={MAPA.lado} height={MAPA.lado} className="rx-mapa" preserveAspectRatio="xMidYMid slice" />
        <circle cx={cx} cy={cy} r={radio} className="rx-tinte" />
        <circle cx={cx} cy={cy} r={radio} fill={`url(#${ids.vineta})`} />

        {/* Lo elegido, en cristal. */}
        <g className="rx-cristales">
          {capas.map((c) => (
            <Cristal key={c.clave} d={c.d} nivel={c.nivel} ids={ids} grosor={grosor} />
          ))}
        </g>

        {origen && hilo !== "ninguno" && (
          <g className={`rx-hilo rx-hilo--${hilo}`}>
            <path d={arcoASede(origen.x, origen.y)} className="rx-hilo-halo" vectorEffect="non-scaling-stroke" filter={`url(#${ids.halo})`} />
            {/* Con pathLength, el hilo de ARIADNA se teje de 0 a 100 sea cual sea su largo. */}
            <path d={arcoASede(origen.x, origen.y)} className="rx-hilo-trazo" pathLength={hilo === "ariadna" ? 100 : undefined} />
            <circle cx={origen.x} cy={origen.y} r={radio * 0.012 + 2} className="rx-hilo-origen" />
          </g>
        )}

        {sobreMapa}
      </g>

      {/* Instrumento de la página, en coordenadas nominales. */}
      <g transform={`translate(${cx} ${cy}) scale(${k.toFixed(4)})`}>
        {barrido && (
          <g clipPath={`url(#${ids.discoNominal})`}>
            <Barrido periodo={barrido.periodo} estela={barrido.estela} />
          </g>
        )}
        {instrumento?.({ disco: ids.discoNominal, brillo: ids.brillo })}

        {/* Aro: escala, avance real y estaciones. */}
        <circle r={R0} className="rx-borde" vectorEffect="non-scaling-stroke" />
        <g className="rx-aro">
          {Array.from({ length: 72 }, (_, i) => {
            const mayor = i % 6 === 0;
            const a = polar(R0 + 6, i * 5);
            const b = polar(R0 + (mayor ? 17 : 11), i * 5);
            return <line key={i} x1={a.x} y1={a.y} x2={b.x} y2={b.y} className={mayor ? "rx-marca rx-marca--mayor" : "rx-marca"} vectorEffect="non-scaling-stroke" />;
          })}
          <circle r={R0 + 26} className="rx-aro-guion" vectorEffect="non-scaling-stroke" />
        </g>
        {avance !== null && avance > 0 && <path d={arcoAro(0, avance * 360, R0 + 26)} className="rx-avance" vectorEffect="non-scaling-stroke" />}
        {marcas.map((m) => {
          const p = polar(R0 + 26, m.angulo);
          return (
            <g key={`${m.angulo}-${m.titulo}`} transform={`translate(${p.x.toFixed(1)} ${p.y.toFixed(1)})`} className="rx-estacion" data-activa={m.activa ? "si" : undefined} style={{ "--rx-marca": m.tono } as React.CSSProperties}>
              <path d="M0 -11L11 0L0 11L-11 0Z" filter={m.activa ? `url(#${ids.brillo})` : undefined} />
              <title>{m.titulo}</title>
            </g>
          );
        })}
      </g>

      {/* La meta: España, con la sede en Palma. */}
      <g className="rx-sede" transform={`translate(${SEDE.x} ${SEDE.y}) scale(${Math.max(k, 0.32).toFixed(3)})`} data-aqui={enEspana ? "si" : undefined}>
        <circle r={16} className="rx-sede-onda" />
        {enEspana && <circle r={26} className="rx-sede-aqui" />}
        <path d="M0 -8L8 0L0 8L-8 0Z" className="rx-sede-rombo" filter={`url(#${ids.brillo})`} />
      </g>
    </svg>
  );
}

// Glifo del radar para tamaños de icono (consola, botones): disco del mapa,
// aro y haz. Reacciona a HESTIA igual que el radar grande.
export function RadarMini({ tamano, estadoInicial = "reposo" }: { tamano: number; estadoInicial?: EstadoNucleo }) {
  const estado = useEstadoHestia(estadoInicial);
  const id = useId().replace(/[^a-zA-Z0-9]/g, "");
  return (
    <svg className="rx-mini" data-estado={estado} width={tamano} height={tamano} viewBox="-50 -50 100 100" aria-hidden="true" focusable="false">
      <defs>
        <clipPath id={`rxm-${id}`}>
          <circle r={40} />
        </clipPath>
      </defs>
      <g clipPath={`url(#rxm-${id})`}>
        <image href="/mapa/mapamundi.jpg" x={-41} y={-41} width={82} height={82} className="rx-mini-mapa" />
        <circle r={40} className="rx-mini-velo" />
        <g className="rx-mini-barrido">
          <circle r={40} className="rx-caja" />
          <path d="M0 0L0 -40A40 40 0 0 1 28.3 -28.3Z" className="rx-mini-estela" />
          <line x1={0} y1={0} x2={0} y2={-40} className="rx-mini-haz" />
        </g>
      </g>
      <circle r={40} className="rx-mini-borde" />
      <circle r={46} className="rx-mini-aro" />
      {/* Palma sobre el mapa reducido (82/640 del plano). */}
      <path d="M0.6 7.8L4.1 11.3L0.6 14.8L-2.9 11.3Z" className="rx-mini-sede" />
    </svg>
  );
}
