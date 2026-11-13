// Sello de BUROFAST: el casco de A.R.E.S. reducido a su silueta simétrica,
// con alas de velocidad (trámite rápido) dentro de un sello de oro de 24 muescas.
const MUESCAS = "M32.00 6.80L32.00 3.20M38.52 7.66L39.45 4.18M44.60 10.18L46.40 7.06M49.82 14.18L52.36 11.64M53.82 19.40L56.94 17.60M56.34 25.48L59.82 24.55M57.20 32.00L60.80 32.00M56.34 38.52L59.82 39.45M53.82 44.60L56.94 46.40M49.82 49.82L52.36 52.36M44.60 53.82L46.40 56.94M38.52 56.34L39.45 59.82M32.00 57.20L32.00 60.80M25.48 56.34L24.55 59.82M19.40 53.82L17.60 56.94M14.18 49.82L11.64 52.36M10.18 44.60L7.06 46.40M7.66 38.52L4.18 39.45M6.80 32.00L3.20 32.00M7.66 25.48L4.18 24.55M10.18 19.40L7.06 17.60M14.18 14.18L11.64 11.64M19.40 10.18L17.60 7.06M25.48 7.66L24.55 4.18";
const CASCO = "M32 16C23 16 19.5 23.5 19.5 31.5V40.5L28 47.5H30V33.5H24V29.5H40V33.5H34V47.5H36L44.5 40.5V31.5C44.5 23.5 41 16 32 16Z";
const CRESTA = "M32 9.5L34.2 16.6H29.8Z";
const ALAS = "M10.5 27.5H16.5M12 31.5H16.5M13.5 35.5H16.5M53.5 27.5H47.5M52 31.5H47.5M50.5 35.5H47.5";

export function SimboloBurofast({ tamano = 34 }: { tamano?: number }) {
  return (
    <svg width={tamano} height={tamano} viewBox="0 0 64 64" aria-hidden="true" focusable="false">
      <defs>
        <linearGradient id="bf-oro" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#F6E7B8" />
          <stop offset="0.45" stopColor="#D9B45F" />
          <stop offset="1" stopColor="#9C7424" />
        </linearGradient>
      </defs>
      <circle cx="32" cy="32" r="31" fill="#0B1826" />
      <circle cx="32" cy="32" r="30.3" fill="none" stroke="url(#bf-oro)" strokeWidth="1.4" />
      <circle cx="32" cy="32" r="23.6" fill="none" stroke="url(#bf-oro)" strokeWidth="1" />
      <path d={MUESCAS} stroke="url(#bf-oro)" strokeWidth="1.1" strokeLinecap="round" />
      <path d={ALAS} stroke="url(#bf-oro)" strokeWidth="1.6" strokeLinecap="round" />
      <path d={CRESTA} fill="url(#bf-oro)" />
      <path d={CASCO} fill="url(#bf-oro)" />
    </svg>
  );
}
