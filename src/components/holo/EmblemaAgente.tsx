import type { AgenteId } from "@/lib/motores";

// Emblemas propios de cada agente: trazo de luz dentro de un hexágono
// cortado a láser. Iconografía original, sin recursos de terceros.

export const COLOR_AGENTE: Record<AgenteId, string> = {
  HESTIA: "var(--agente-hestia)",
  ARIADNA: "var(--agente-ariadna)",
  CRONOS: "var(--agente-cronos)",
  MNEMOSINE: "var(--agente-mnemosine)",
  ARGOS: "var(--agente-argos)",
  TEMIS: "var(--agente-temis)",
};

// Espiral de Ariadna: el hilo que sale del laberinto.
const ESPIRAL = (() => {
  const puntos: string[] = [];
  for (let paso = 0; paso <= 64; paso += 1) {
    const angulo = paso * 0.32;
    const radio = 1.2 + angulo * 1.05;
    puntos.push(`${(24 + radio * Math.cos(angulo)).toFixed(2)} ${(24 + radio * Math.sin(angulo)).toFixed(2)}`);
  }
  return `M${puntos.join(" L")}`;
})();

const TRAZOS: Record<AgenteId, string> = {
  HESTIA: "M24 9c6 7 11 12 11 19.5a11 11 0 0 1-22 0C13 21 18 16 24 9zM24 22c3 3.4 5 6 5 9a5 5 0 0 1-10 0c0-3 2-5.6 5-9zM13 40q11 5 22 0",
  ARIADNA: ESPIRAL,
  CRONOS: "M15 9h18M15 39h18M17 9c0 9 13 10 13 15s-13 6-13 15M31 9c0 9-13 10-13 15s13 6 13 15M20 35h8",
  MNEMOSINE: "M13 15h17v24H13zM18 10h17v24M17 22h9M17 27h9M17 32h6M38 6l1.2 2.4 2.4 1.2-2.4 1.2L38 13.2l-1.2-2.4-2.4-1.2 2.4-1.2z",
  ARGOS: "M7 24c4.5-7.5 10.5-11.5 17-11.5S36.5 16.5 41 24c-4.5 7.5-10.5 11.5-17 11.5S11.5 31.5 7 24zM24 29a5 5 0 1 0 0-10 5 5 0 0 0 0 10zM24 6v3M24 39v3M9 11l2 2M37 35l2 2M39 11l-2 2M11 35l-2 2",
  TEMIS: "M24 9v30M15 39h18M10 16h28M10 16l-5 10h10zM38 16l-5 10h10zM5 26a5 3 0 0 0 10 0M33 26a5 3 0 0 0 10 0",
};

export function EmblemaAgente({ agente, tamano = 48, activo = false }: { agente: AgenteId; tamano?: number; activo?: boolean }) {
  return (
    <svg
      className={`emblema${activo ? " activo" : ""}`}
      width={tamano}
      height={tamano}
      viewBox="0 0 48 48"
      aria-hidden="true"
      focusable="false"
      style={{ color: COLOR_AGENTE[agente] }}
    >
      <path d="M14 2h20l12 12v20L34 46H14L2 34V14z" fill="rgba(7,19,34,0.72)" stroke="currentColor" strokeOpacity="0.55" strokeWidth="1.2" />
      <path d="M16 5h16l11 11v16L32 43H16L5 32V16z" fill="none" stroke="currentColor" strokeOpacity="0.16" strokeWidth="1" />
      <path d={TRAZOS[agente]} fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" className="emblema-trazo" />
    </svg>
  );
}
