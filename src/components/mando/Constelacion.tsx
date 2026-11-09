import type { Comprobacion } from "@/lib/estado";

// Mapa de sistemas: HESTIA en el centro y cada pieza real en su órbita, con
// el color de su ÚLTIMA comprobación. Texto y color siempre juntos.
const POSICION: Partial<Record<Comprobacion["id"], number>> = {
  postgres: 0,
  hestia_ia: 52,
  n8n: 104,
  whatsapp: 156,
  google: 208,
  stripe: 260,
  stripe_webhook: 312,
};
const NOMBRE_CORTO: Partial<Record<Comprobacion["id"], string>> = {
  postgres: "POSTGRES",
  hestia_ia: "HESTIA · IA",
  n8n: "N8N",
  whatsapp: "WHATSAPP",
  google: "GOOGLE",
  stripe: "STRIPE",
  stripe_webhook: "WEBHOOK",
};
const CLASE: Record<Comprobacion["estado"], string> = { operativo: "nodo-ok", no_configurado: "nodo-aviso", desconectado: "nodo-critico", error: "nodo-critico" };

export function Constelacion({ piezas }: { piezas: Comprobacion[] }) {
  const c = 210;
  const r = 150;
  const nodos = piezas.filter((p) => POSICION[p.id] !== undefined).map((p) => {
    const angulo = (((POSICION[p.id] ?? 0) - 90) * Math.PI) / 180;
    return { p, x: c + r * Math.cos(angulo), y: c + r * Math.sin(angulo) };
  });
  return (
    <svg className="constelacion" viewBox="0 0 420 420" role="img" aria-label="Mapa de sistemas de BUROFAST y su estado">
      <circle cx={c} cy={c} r={r} fill="none" stroke="rgba(66,216,245,0.18)" strokeDasharray="2 6" />
      <circle cx={c} cy={c} r={r - 60} fill="none" stroke="rgba(169,139,255,0.14)" />
      {nodos.map(({ p, x, y }) => (
        <g key={p.id} className={CLASE[p.estado]}>
          <line x1={c} y1={c} x2={x} y2={y} stroke="currentColor" strokeOpacity="0.35" strokeDasharray="4 5" />
          <rect x={x - 9} y={y - 9} width="18" height="18" transform={`rotate(45 ${x} ${y})`} fill="#071322" stroke="currentColor" strokeWidth="1.8" style={{ filter: "drop-shadow(0 0 6px currentColor)" }} />
          <circle cx={x} cy={y} r="3" fill="currentColor" />
          <text x={x} y={y + (y > c ? 30 : -20)} textAnchor="middle">{NOMBRE_CORTO[p.id]}</text>
        </g>
      ))}
      <circle cx={c} cy={c} r="34" fill="rgba(214,181,110,0.14)" stroke="#D6B56E" strokeOpacity="0.7" />
      <path d={`M${c} ${c - 20}c8 9 14 15 14 24a14 14 0 0 1-28 0c0-9 6-15 14-24z`} fill="#F1DCAA" />
      <text x={c} y={c + 52} textAnchor="middle" style={{ fill: "#D6B56E" }}>HESTIA</text>
    </svg>
  );
}
