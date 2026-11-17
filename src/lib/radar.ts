import { CITAS } from "@/lib/catalogo";
import { RUTAS } from "@/lib/diagnostico";
import { LOCALES, type Locale } from "@/lib/i18n/locales";
import { AGENTES } from "@/lib/motores";

// Radar de la portada, dibujado sobre public/mapa/mapamundi.jpg (640 × 640),
// el mapamundi que eligió A.R.E.S.: proyección azimutal equidistante centrada
// en el Polo Norte, Greenwich hacia abajo y el este a la derecha.
// Calibración contra los datos de Natural Earth (16 nov 2026): centro en
// (319, 319) y 316 px para los 180° que separan el polo del borde. Con esto,
// cada ciudad cae en su sitio sobre la imagen.
export const MAPA = { lado: 640, cx: 319, cy: 319, radio: 316 } as const;

// Periodo del barrido del radar. La animación CSS y el destello de cada zona
// usan el mismo número para que el haz «encienda» la zona al pasar.
export const PERIODO_BARRIDO_S = 8;

export type PuntoMapa = { x: number; y: number; angulo: number };

const r1 = (n: number) => Math.round(n * 10) / 10;

export function proyectar(lon: number, lat: number): PuntoMapa {
  const distancia = (MAPA.radio * (90 - lat)) / 180;
  const theta = (lon * Math.PI) / 180;
  const x = MAPA.cx + distancia * Math.sin(theta);
  const y = MAPA.cy + distancia * Math.cos(theta);
  // 0° arriba y sentido horario, como el haz del radar.
  const angulo = ((Math.atan2(x - MAPA.cx, -(y - MAPA.cy)) * 180) / Math.PI + 360) % 360;
  return { x: r1(x), y: r1(y), angulo: r1(angulo) };
}

// Zonas de atención: de dónde llega la gente que atiende cada idioma de la
// portada. La primera ciudad de cada idioma lleva la etiqueta del idioma.
const CIUDADES: { idioma: Locale; ciudad: string; lon: number; lat: number }[] = [
  { idioma: "es", ciudad: "Bogotá", lon: -74.07, lat: 4.71 },
  { idioma: "es", ciudad: "Ciudad de México", lon: -99.13, lat: 19.43 },
  { idioma: "es", ciudad: "Buenos Aires", lon: -58.38, lat: -34.6 },
  { idioma: "en", ciudad: "London", lon: -0.13, lat: 51.51 },
  { idioma: "en", ciudad: "Lagos", lon: 3.38, lat: 6.52 },
  { idioma: "fr", ciudad: "Dakar", lon: -17.47, lat: 14.72 },
  { idioma: "fr", ciudad: "Kinshasa", lon: 15.27, lat: -4.44 },
  { idioma: "pt", ciudad: "São Paulo", lon: -46.63, lat: -23.55 },
  { idioma: "pt", ciudad: "Luanda", lon: 13.23, lat: -8.84 },
  { idioma: "ar", ciudad: "الدار البيضاء", lon: -7.59, lat: 33.57 },
  { idioma: "ar", ciudad: "القاهرة", lon: 31.24, lat: 30.04 },
  { idioma: "uk", ciudad: "Київ", lon: 30.52, lat: 50.45 },
];

export type ZonaRadar = PuntoMapa & { idioma: Locale; ciudad: string; principal: boolean };

export const ZONAS: ZonaRadar[] = CIUDADES.map((c, i) => ({
  ...proyectar(c.lon, c.lat),
  idioma: c.idioma,
  ciudad: c.ciudad,
  principal: CIUDADES.findIndex((o) => o.idioma === c.idioma) === i,
}));

export const SEDE = { ciudad: "Palma", ...proyectar(2.65, 39.57) };

// Meridianos cada 30°, rotulados en el borde del radar.
export const MERIDIANOS = Array.from({ length: 12 }, (_, i) => {
  const lon = i * 30 - 150;
  return { lon, etiqueta: lon === 0 ? "0°" : lon === 180 ? "180°" : `${Math.abs(lon)}°${lon > 0 ? "E" : "W"}`, ...proyectar(lon, -90) };
});

// Lo que la plataforma contiene hoy, contado del propio código: nunca cifras
// escritas a mano que se queden viejas.
export function contenidoPlataforma() {
  return { rutas: RUTAS.length, agentes: AGENTES.length, citas: Object.keys(CITAS).length, idiomas: LOCALES.length };
}

export type SenalesRadar = {
  comprobadoEn: string;
  contenido: ReturnType<typeof contenidoPlataforma>;
  // null = no se pudo medir: la interfaz dice «sin datos», nunca «operativo».
  baseDatos: { estado: "operativo" | "error" | "no_configurado"; latenciaMs: number | null };
  hestia: { estado: "ia" | "local" | "error"; latenciaMediaMs: number | null } | null;
  conversaciones24h: Record<Locale, number> | null;
};
