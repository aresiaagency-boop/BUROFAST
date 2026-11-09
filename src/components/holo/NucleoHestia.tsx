"use client";

import { useEffect, useId, useState } from "react";
import type { EstadoNucleo } from "@/lib/hestia/vivo";
import { ESTADOS_PASAJEROS, EVENTO_HESTIA } from "@/lib/hestia/vivo";

export type Estacion = { id: string; angulo: number; color: string; activa?: boolean };

const CENTRO = 200;
const polar = (radio: number, grados: number) => {
  const rad = ((grados - 90) * Math.PI) / 180;
  return { x: CENTRO + radio * Math.cos(rad), y: CENTRO + radio * Math.sin(rad) };
};

// Marcas del anillo exterior: cada 5°, más largas cada 30°.
const MARCAS = Array.from({ length: 72 }, (_, i) => {
  const grados = i * 5;
  const larga = i % 6 === 0;
  const a = polar(larga ? 172 : 177, grados);
  const b = polar(184, grados);
  return { i, a, b, larga };
});

// El Hogar de plasma: el núcleo vivo de HESTIA. Anillos grabados a láser
// alrededor de una llama de hogar (Hestia es la diosa del hogar). El anillo
// exterior enseña el avance REAL del camino del usuario; si no hay dato, no
// se pinta avance.
export function NucleoHestia({
  tamano = 320,
  progreso = null,
  estaciones = [],
  etiqueta,
  estadoInicial = "reposo",
  mini = false,
}: {
  tamano?: number;
  progreso?: number | null;
  estaciones?: Estacion[];
  etiqueta: string;
  estadoInicial?: EstadoNucleo;
  mini?: boolean;
}) {
  const id = useId().replace(/:/g, "");
  const [estado, setEstado] = useState<EstadoNucleo>(estadoInicial);

  useEffect(() => {
    let temporizador: ReturnType<typeof setTimeout> | undefined;
    const escuchar = (evento: Event) => {
      const nuevo = (evento as CustomEvent<EstadoNucleo>).detail;
      clearTimeout(temporizador);
      setEstado(nuevo);
      const dura = ESTADOS_PASAJEROS[nuevo];
      if (dura) temporizador = setTimeout(() => setEstado(estadoInicial), dura);
    };
    window.addEventListener(EVENTO_HESTIA, escuchar);
    return () => {
      window.removeEventListener(EVENTO_HESTIA, escuchar);
      clearTimeout(temporizador);
    };
  }, [estadoInicial]);

  const avance = progreso === null ? null : Math.max(0, Math.min(1, progreso));

  return (
    <svg
      className={`nucleo${mini ? " nucleo--mini" : ""}`}
      data-estado={estado}
      width={tamano}
      height={tamano}
      viewBox="0 0 400 400"
      {...(etiqueta ? { role: "img", "aria-label": etiqueta } : { "aria-hidden": true, focusable: "false" })}
    >
      <defs>
        <radialGradient id={`llama-${id}`} cx="0.5" cy="0.72" r="0.62">
          <stop offset="0" className="nucleo-stop-a" />
          <stop offset="0.55" className="nucleo-stop-b" />
          <stop offset="1" className="nucleo-stop-c" />
        </radialGradient>
        <radialGradient id={`halo-${id}`} cx="0.5" cy="0.5" r="0.5">
          <stop offset="0" className="nucleo-halo-a" />
          <stop offset="1" stopColor="#071322" stopOpacity="0" />
        </radialGradient>
        <linearGradient id={`barrido-${id}`} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#42D8F5" stopOpacity="0" />
          <stop offset="1" className="nucleo-barrido-b" />
        </linearGradient>
        <pattern id={`lineas-${id}`} width="4" height="4" patternUnits="userSpaceOnUse">
          <rect width="4" height="1.1" fill="rgba(223,248,255,0.07)" />
        </pattern>
      </defs>

      <circle cx={CENTRO} cy={CENTRO} r="190" fill={`url(#halo-${id})`} className="nucleo-halo" />

      {/* Anillo exterior graduado: avance del camino */}
      <circle cx={CENTRO} cy={CENTRO} r="186" fill="none" stroke="rgba(66,216,245,0.22)" strokeWidth="1" />
      {!mini && MARCAS.map((m) => (
        <line key={m.i} x1={m.a.x} y1={m.a.y} x2={m.b.x} y2={m.b.y} stroke={m.larga ? "rgba(155,240,255,0.55)" : "rgba(66,216,245,0.28)"} strokeWidth={m.larga ? 1.4 : 1} />
      ))}
      {avance !== null && (
        <circle
          cx={CENTRO}
          cy={CENTRO}
          r="186"
          fill="none"
          className="nucleo-avance"
          strokeWidth={mini ? 10 : 3}
          strokeLinecap="round"
          pathLength={100}
          strokeDasharray={`${Math.max(0.6, avance * 100)} 100`}
          transform={`rotate(-90 ${CENTRO} ${CENTRO})`}
        />
      )}

      {/* Anillo segmentado (gira) y anillo interior (contragira) */}
      <g className="nucleo-segmentos">
        <circle cx={CENTRO} cy={CENTRO} r="150" fill="none" stroke="rgba(66,216,245,0.42)" strokeWidth={mini ? 8 : 2} strokeDasharray="46 12 10 12 70 14" />
      </g>
      {!mini && (
        <g className="nucleo-interior">
          <circle cx={CENTRO} cy={CENTRO} r="118" fill="none" stroke="rgba(169,139,255,0.35)" strokeWidth="1" strokeDasharray="2 7" />
          <circle cx={CENTRO} cy={CENTRO} r="96" fill="none" stroke="rgba(66,216,245,0.2)" strokeWidth="1" />
        </g>
      )}

      {/* Barrido del radar */}
      {!mini && (
        <g className="nucleo-barrido">
          <path d={`M${CENTRO} ${CENTRO} L${polar(150, 0).x} ${polar(150, 0).y} A150 150 0 0 1 ${polar(150, 38).x} ${polar(150, 38).y} Z`} fill={`url(#barrido-${id})`} opacity="0.5" />
        </g>
      )}

      {/* Estaciones de los motores sobre la órbita */}
      {estaciones.map((e) => {
        const p = polar(150, e.angulo);
        return (
          <g key={e.id} className={`nucleo-estacion${e.activa ? " activa" : ""}`} style={{ color: e.color }}>
            <line x1={CENTRO} y1={CENTRO} x2={p.x} y2={p.y} stroke="currentColor" strokeOpacity="0.18" strokeWidth="1" strokeDasharray="3 5" />
            <rect x={p.x - 7} y={p.y - 7} width="14" height="14" transform={`rotate(45 ${p.x} ${p.y})`} fill="#071322" stroke="currentColor" strokeWidth="1.6" />
            <circle cx={p.x} cy={p.y} r="2.6" fill="currentColor" />
          </g>
        );
      })}

      {/* El hogar: base y llama */}
      <circle cx={CENTRO} cy={CENTRO} r="74" fill="rgba(7,19,34,0.55)" stroke="rgba(214,181,110,0.35)" strokeWidth="1" />
      <circle cx={CENTRO} cy={CENTRO} r="74" fill={`url(#lineas-${id})`} />
      <g className="nucleo-llama">
        <path d="M200 140c17 20 34 37 34 62a34 34 0 0 1-68 0c0-25 17-42 34-62z" fill={`url(#llama-${id})`} />
        <path d="M200 182c8 9 14 16 14 26a14 14 0 0 1-28 0c0-10 6-17 14-26z" className="nucleo-corazon" />
      </g>
      <path d="M164 246q36 18 72 0" fill="none" stroke="rgba(214,181,110,0.7)" strokeWidth="2.4" strokeLinecap="round" />
    </svg>
  );
}
