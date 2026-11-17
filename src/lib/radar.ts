import { CITAS } from "@/lib/catalogo";
import type { Respuestas } from "@/lib/diagnostico";
import { RUTAS } from "@/lib/diagnostico";
import { LOCALES, type Locale } from "@/lib/i18n/locales";
import CALIBRACION from "@/lib/mapa-calibracion.json";
import { AGENTES } from "@/lib/motores";
import { CENTRO_PAIS, GRUPO_PASAPORTE, PAISES_RADAR, type PaisRadar, ZONA_IDIOMA } from "@/lib/radar-paises";

export { CENTRO_PAIS, GRUPO_PASAPORTE, PAISES_RADAR, ZONA_IDIOMA, type PaisRadar };

// Radar de la portada, dibujado sobre public/mapa/mapamundi.jpg (640 × 640),
// el mapamundi que eligió A.R.E.S.: proyección azimutal equidistante centrada
// en el Polo Norte, Greenwich hacia abajo y el este a la derecha.
// Calibración contra los datos de Natural Earth (16 nov 2026): centro en
// (319, 319) y 316 px para los 180° que separan el polo del borde. Con esto,
// cada ciudad cae en su sitio sobre la imagen. La calibración vive en
// mapa-calibracion.json porque también la usa scripts/mapa/generar-paises.mjs.
export const MAPA: Readonly<{ lado: number; cx: number; cy: number; radio: number }> = CALIBRACION;

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

// --- Radar de extranjería: un radar por página -----------------------------
// Todas las páginas comparten el mapamundi, el cristal de los países y la sede
// de Palma; cada una lo mira con su encuadre, su agente y su instrumento.

export const VARIANTES_RADAR = ["nucleo", "camino", "citas", "documentos", "guardian", "expediente", "pagos", "acceso"] as const;
export type VarianteRadar = (typeof VARIANTES_RADAR)[number];
export type GrupoPasaporte = keyof typeof GRUPO_PASAPORTE;

// Recuadros sobre el plano de 640 × 640 [x, y, lado]. «mundo» es el disco
// entero; los demás acercan la lente: el Atlántico (de América y África a
// España), Europa con el Magreb y la sede (Europa occidental y el norte de
// África, con España en el centro).
export const ENCUADRES = {
  mundo: [3, 3, 632],
  atlantico: [70, 200, 400],
  europa: [228, 300, 200],
  sede: [262, 344, 124],
} as const satisfies Record<string, readonly [number, number, number]>;
export type Encuadre = keyof typeof ENCUADRES;

export const ENCUADRE_DE: Record<VarianteRadar, Encuadre> = {
  nucleo: "mundo",
  camino: "atlantico",
  citas: "europa",
  documentos: "mundo",
  guardian: "sede",
  expediente: "atlantico",
  pagos: "europa",
  acceso: "sede",
};

export function esPaisRadar(valor: unknown): valor is PaisRadar {
  return typeof valor === "string" && (PAISES_RADAR as readonly string[]).includes(valor);
}

export type ResaltadoRadar = {
  // Tu idioma: la zona del mundo de quienes lo hablan.
  zona: Locale;
  // Tu pasaporte, si es de un grupo con reglas propias (iberoamericano, UE).
  grupo: GrupoPasaporte | null;
  // Tu país, si lo has elegido (solo en este dispositivo).
  pais: PaisRadar | null;
  // De dónde sale el hilo hasta Palma: tu país, o el corazón de tu zona.
  origen: { x: number; y: number } | null;
  enEspana: boolean;
};

export function resaltadoRadar({ locale, respuestas, pais }: { locale: Locale; respuestas?: Partial<Respuestas>; pais?: string | null }): ResaltadoRadar {
  const pasaporte = respuestas?.pasaporte;
  const grupo = pasaporte === "iberoamericano" || pasaporte === "ue" ? pasaporte : null;
  const elegido = esPaisRadar(pais) && pais !== "ES" ? pais : null;
  let origen: ResaltadoRadar["origen"] = null;
  if (elegido) {
    const [x, y] = CENTRO_PAIS[elegido];
    origen = { x, y };
  } else if (grupo !== "ue") {
    // Sin país: la ciudad principal de la zona (del grupo iberoamericano si es
    // ese el pasaporte, aunque el idioma elegido sea otro).
    const idioma = grupo === "iberoamericano" ? "es" : locale;
    const principal = ZONAS.find((z) => z.idioma === idioma && z.principal);
    origen = principal ? { x: principal.x, y: principal.y } : null;
  }
  return { zona: locale, grupo, pais: elegido, origen, enEspana: respuestas?.ubicacion === "espana" };
}

// Curva de un punto a la sede: la señal «viaja» a Palma.
export function arcoASede(x: number, y: number, curva = 0.22) {
  const mx = (x + SEDE.x) / 2;
  const my = (y + SEDE.y) / 2;
  const dx = SEDE.x - x;
  const dy = SEDE.y - y;
  return `M${x} ${y}Q${(mx - dy * curva).toFixed(1)} ${(my + dx * curva).toFixed(1)} ${SEDE.x} ${SEDE.y}`;
}

// Punto de esa curva en la fracción t (0 = origen, 1 = sede).
export function puntoEnArco(x: number, y: number, t: number, curva = 0.22) {
  const mx = (x + SEDE.x) / 2;
  const my = (y + SEDE.y) / 2;
  const qx = mx - (SEDE.y - y) * curva;
  const qy = my + (SEDE.x - x) * curva;
  const u = 1 - t;
  return { x: r1(u * u * x + 2 * u * t * qx + t * t * SEDE.x), y: r1(u * u * y + 2 * u * t * qy + t * t * SEDE.y) };
}
