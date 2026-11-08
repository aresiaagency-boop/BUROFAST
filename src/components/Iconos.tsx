// Iconografía lineal propia: trazo 1.6, caja 24. Sin emojis ni recursos de terceros.
type Props = { nombre: NombreIcono; tamano?: number };

export type NombreIcono =
  | "maletin" | "libro" | "familia" | "escudo" | "renovar" | "estrella" | "chispa" | "puerta"
  | "pin" | "globo" | "documento" | "reloj" | "pasaporte" | "camino" | "calendario" | "hogar"
  | "mando" | "citas" | "personas" | "agente" | "sistemas" | "salir";

const TRAZOS: Record<NombreIcono, string> = {
  maletin: "M4 8h16v11H4zM9 8V5h6v3M4 13h16",
  libro: "M5 4h9a3 3 0 0 1 3 3v13H8a3 3 0 0 1-3-3zM5 17a3 3 0 0 1 3-3h9",
  familia: "M8 10a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM16.5 11a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5zM3 20c0-3 2.5-5.5 5-5.5s5 2.5 5 5.5M13 20c.3-2.6 1.8-4.5 3.5-4.5S20 17.4 20 20",
  escudo: "M12 3l7 3v6c0 4.2-3 7.6-7 9-4-1.4-7-4.8-7-9V6zM9 12l2 2 4-4",
  renovar: "M19 8a7 7 0 0 0-12.5-2M5 4v3h3M5 16a7 7 0 0 0 12.5 2M19 20v-3h-3",
  estrella: "M12 3l2.6 5.6 6.1.7-4.5 4.2 1.2 6.1L12 16.6 6.6 19.6l1.2-6.1L3.3 9.3l6.1-.7z",
  chispa: "M12 3v4M12 17v4M3 12h4M17 12h4M6 6l2.5 2.5M15.5 15.5 18 18M18 6l-2.5 2.5M8.5 15.5 6 18",
  puerta: "M6 21V4h10v17M4 21h16M13 12h.01M16 7l3-1v14",
  pin: "M12 21s7-6.2 7-11.5A7 7 0 0 0 5 9.5C5 14.8 12 21 12 21zM12 12a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5z",
  globo: "M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM3 12h18M12 3c2.5 2.7 3.8 5.7 3.8 9S14.5 18.3 12 21c-2.5-2.7-3.8-5.7-3.8-9S9.5 5.7 12 3z",
  documento: "M7 3h7l4 4v14H7zM14 3v4h4M9.5 12h6M9.5 16h6",
  reloj: "M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM12 7v5l3 2",
  pasaporte: "M6 3h12v18H6zM12 13a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM9 17h6",
  camino: "M4 20c4 0 4-5 8-5s4-5 8-5M4 20h.01M20 10h.01M12 15h.01",
  calendario: "M4 6h16v14H4zM4 10h16M8 3v5M16 3v5M8 14h3",
  hogar: "M4 11l8-7 8 7v9H4zM10 20v-5h4v5",
  mando: "M4 4h7v7H4zM13 4h7v4h-7zM13 10h7v10h-7zM4 13h7v7H4z",
  citas: "M4 6h16v14H4zM4 10h16M8 3v5M16 3v5M9 15l2 2 4-4",
  personas: "M9 11a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7zM3 20c0-3.3 2.7-6 6-6s6 2.7 6 6M16 4.5a3.5 3.5 0 0 1 0 6.5M18 14.5c1.8.8 3 2.8 3 5.5",
  agente: "M12 3v3M7 8h10a3 3 0 0 1 3 3v5a3 3 0 0 1-3 3H7a3 3 0 0 1-3-3v-5a3 3 0 0 1 3-3zM9.5 13h.01M14.5 13h.01M9 16.5h6",
  sistemas: "M4 5h16v5H4zM4 14h16v5H4zM8 7.5h.01M8 16.5h.01",
  salir: "M10 4H5v16h5M15 8l4 4-4 4M19 12H9",
};

export function Icono({ nombre, tamano = 22 }: Props) {
  return (
    <svg width={tamano} height={tamano} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
      <path d={TRAZOS[nombre]} />
    </svg>
  );
}
