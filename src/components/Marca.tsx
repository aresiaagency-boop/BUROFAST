// Símbolo propio de BUROFAST: un hogar con su llama (HESTIA) dentro de una
// órbita. Identidad original, sin referencias a marcas de terceros.
export function SimboloBurofast({ tamano = 34 }: { tamano?: number }) {
  return (
    <svg width={tamano} height={tamano} viewBox="0 0 40 40" aria-hidden="true" focusable="false">
      <defs>
        <linearGradient id="bf-orbita" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#42D8F5" />
          <stop offset="1" stopColor="#16BDEB" />
        </linearGradient>
        <radialGradient id="bf-llama" cx="0.5" cy="0.7" r="0.6">
          <stop offset="0" stopColor="#F1DCAA" />
          <stop offset="1" stopColor="#D6B56E" />
        </radialGradient>
      </defs>
      <ellipse cx="20" cy="20" rx="18" ry="11" fill="none" stroke="url(#bf-orbita)" strokeWidth="1.4" transform="rotate(-18 20 20)" opacity="0.9" />
      <path d="M11 21.5 20 13l9 8.5V30H11z" fill="#10253B" stroke="#42D8F5" strokeWidth="1.4" strokeLinejoin="round" />
      <path d="M20 19.5c2.2 2 3 3.6 3 5.2A3 3 0 0 1 20 28a3 3 0 0 1-3-3.3c0-1.6 1-3 3-5.2z" fill="url(#bf-llama)" />
    </svg>
  );
}
