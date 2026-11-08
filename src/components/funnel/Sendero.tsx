// Ilustración del camino: un sendero que serpentea hacia el hogar. El viajero
// avanza un hito por capítulo. Los hitos se dibujan, no se escriben: la
// leyenda en texto va debajo para lectores de pantalla y para cualquier idioma.
const HITOS = [
  { x: 40, y: 78 },
  { x: 140, y: 52 },
  { x: 250, y: 70 },
  { x: 360, y: 40 },
  { x: 470, y: 62 },
  { x: 575, y: 36 },
  { x: 660, y: 46 },
];

const RECORRIDO = "M40 78 C 85 78, 100 52, 140 52 S 210 70, 250 70 S 320 40, 360 40 S 430 62, 470 62 S 540 36, 575 36 S 630 46, 660 46";

export function Sendero({ hito, capitulo, meta, rtl }: { hito: number; capitulo: string; meta: string; rtl: boolean }) {
  const progreso = Math.max(0, Math.min(100, (hito / (HITOS.length - 1)) * 100));
  const actual = HITOS[Math.max(0, Math.min(HITOS.length - 1, hito))];
  return (
    <div className="sendero">
      <svg viewBox="0 0 700 110" role="img" aria-label={`${capitulo} → ${meta}`} style={rtl ? { transform: "scaleX(-1)" } : undefined}>
        <defs>
          <linearGradient id="sendero-luz" x1="0" x2="1">
            <stop offset="0" stopColor="#16BDEB" />
            <stop offset="1" stopColor="#42D8F5" />
          </linearGradient>
          <radialGradient id="sendero-hogar" cx="0.5" cy="0.5" r="0.5">
            <stop offset="0" stopColor="#F1DCAA" stopOpacity="0.9" />
            <stop offset="1" stopColor="#D6B56E" stopOpacity="0" />
          </radialGradient>
        </defs>
        <path d="M0 96 Q 120 70 240 90 T 480 84 T 700 70" fill="none" stroke="rgba(66,216,245,0.08)" strokeWidth="1" />
        <path d={RECORRIDO} fill="none" stroke="rgba(66,216,245,0.18)" strokeWidth="3" strokeDasharray="0.4 1.4" strokeLinecap="round" pathLength={100} />
        <path d={RECORRIDO} fill="none" stroke="url(#sendero-luz)" strokeWidth="3" strokeLinecap="round" pathLength={100} strokeDasharray={`${progreso} 100`} style={{ transition: "stroke-dasharray 600ms ease" }} />
        {HITOS.slice(0, -1).map((punto, indice) => (
          <circle key={indice} cx={punto.x} cy={punto.y} r={indice < hito ? 6 : 5} fill={indice < hito ? "#16BDEB" : "#071322"} stroke={indice <= hito ? "#42D8F5" : "rgba(66,216,245,0.35)"} strokeWidth="2" />
        ))}
        <circle cx="660" cy="40" r="26" fill="url(#sendero-hogar)" className="hogar-brillo" />
        <path d="M646 50 660 37l14 13v14h-28z" fill="#10253B" stroke="#D6B56E" strokeWidth="2" strokeLinejoin="round" />
        <path d="M660 47c2.4 2.2 3.3 3.8 3.3 5.4a3.3 3.3 0 0 1-6.6 0c0-1.6 1-3.2 3.3-5.4z" fill="#F1DCAA" />
        <g style={{ transition: "transform 600ms ease" }} transform={`translate(${actual.x} ${actual.y})`}>
          <circle r="11" fill="rgba(214,181,110,0.22)" />
          <circle r="6.5" fill="#D6B56E" stroke="#F1DCAA" strokeWidth="2" />
        </g>
      </svg>
      <div className="sendero-leyenda">
        <span>{capitulo}</span>
        <span>{meta}</span>
      </div>
    </div>
  );
}
