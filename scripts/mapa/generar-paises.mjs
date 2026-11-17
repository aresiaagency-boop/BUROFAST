// Proyecta los países que el radar resalta sobre el plano EXACTO del
// mapamundi de public/mapa/mapamundi.jpg (azimutal equidistante centrada en el
// polo norte, Greenwich abajo, este a la derecha; calibración en src/lib/radar.ts).
//
// Salidas (no se editan a mano):
//   public/mapa/paises.<hash>.json  trazados por país, zona de idioma y grupo de
//                                   pasaporte; el nombre cambia con el contenido y
//                                   se sirve como inmutable (next.config.ts)
//   src/lib/radar-paises.ts         códigos, centroides, pertenencia y la URL
//
// Uso (las dependencias geográficas NO entran en package.json):
//   mkdir -p /tmp/geo && cd /tmp/geo && npm i d3-geo@3 topojson-client@3 world-atlas@2
//   GEO_DIR=/tmp/geo node scripts/mapa/generar-paises.mjs
import { createHash } from "node:crypto";
import { readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

const requerir = createRequire(join(process.env.GEO_DIR ?? process.cwd(), "x.js"));
const cargar = async (m) => import(pathToFileURL(requerir.resolve(m)).href);
const { geoAzimuthalEquidistant, geoPath } = await cargar("d3-geo");
const { feature, merge } = await cargar("topojson-client");
// 1:110M basta a la escala del mapamundi (un píxel ≈ 60 km). 1:50M solo para
// los países que 1:110M no trae (Andorra, Malta, Cabo Verde…) y para España,
// que sin Baleares no tendría Palma.
const mundo110 = JSON.parse(readFileSync(requerir.resolve("world-atlas/countries-110m.json"), "utf8"));
const mundo50 = JSON.parse(readFileSync(requerir.resolve("world-atlas/countries-50m.json"), "utf8"));
const DETALLE_50M = new Set(["ES"]);

// La calibración del mapamundi vive en un solo sitio: la usan este script y src/lib/radar.ts.
const MAPA = JSON.parse(readFileSync("src/lib/mapa-calibracion.json", "utf8"));

// ISO 3166-1: alfa-2 → numérico (los id de world-atlas).
const ISO = {
  AD: "020", AO: "024", AR: "032", AT: "040", BE: "056", BG: "100", BO: "068", BR: "076", CA: "124", CD: "180", CH: "756", CI: "384",
  CL: "152", CM: "120", CO: "170", CR: "188", CU: "192", CV: "132", CY: "196", CZ: "203", DE: "276", DK: "208", DO: "214", DZ: "012",
  EC: "218", EE: "233", EG: "818", EH: "732", ES: "724", FI: "246", FR: "250", GB: "826", GH: "288", GM: "270", GN: "324", GQ: "226",
  GR: "300", GT: "320", GW: "624", HN: "340", HR: "191", HT: "332", HU: "348", IE: "372", IN: "356", IQ: "368", IS: "352", IT: "380",
  JO: "400", LB: "422", LI: "438", LT: "440", LU: "442", LV: "428", LY: "434", MA: "504", ML: "466", MR: "478", MT: "470", MX: "484",
  MZ: "508", NG: "566", NI: "558", NL: "528", NO: "578", PA: "591", PE: "604", PH: "608", PK: "586", PL: "616", PR: "630", PT: "620",
  PY: "600", RO: "642", SA: "682", SE: "752", SI: "705", SK: "703", SN: "686", ST: "678", SV: "222", SY: "760", TN: "788", UA: "804",
  US: "840", UY: "858", VE: "862",
  AE: "784", AM: "051", BD: "050", BH: "048", CN: "156", GE: "268", KW: "414", OM: "512", PS: "275", QA: "634", RU: "643", SD: "729",
  TR: "792", YE: "887",
};

// Zona de cada idioma: la misma que nombra la portada (radar.zonas en los
// diccionarios). Si cambia una, cambia la otra.
const ZONAS = {
  es: ["MX", "GT", "HN", "SV", "NI", "CR", "PA", "CU", "DO", "PR", "CO", "VE", "EC", "PE", "BO", "CL", "AR", "UY", "PY"],
  en: ["GB", "NG", "GH", "GM"],
  fr: ["SN", "ML", "CI", "GN", "CM", "CD"],
  pt: ["BR", "AO", "MZ", "GW", "CV", "ST"],
  ar: ["MA", "DZ", "TN", "LY", "EG", "MR", "EH", "SD", "SY", "LB", "JO", "PS", "IQ", "SA", "YE", "OM", "AE", "QA", "BH", "KW"],
  uk: ["UA"],
};

// Pasaportes del diagnóstico (PASAPORTES en src/lib/diagnostico.ts).
const GRUPOS = {
  iberoamericano: ["MX", "GT", "HN", "SV", "NI", "CR", "PA", "CU", "DO", "PR", "CO", "VE", "EC", "PE", "BO", "CL", "AR", "UY", "PY", "BR", "AD", "PH", "GQ"],
  ue: ["AT", "BE", "BG", "HR", "CY", "CZ", "DK", "EE", "FI", "FR", "DE", "GR", "HU", "IE", "IT", "LV", "LT", "LU", "MT", "NL", "PL", "PT", "RO", "SK", "SI", "SE", "IS", "LI", "NO", "CH"],
};

const proyeccion = geoAzimuthalEquidistant().rotate([0, -90]).scale(MAPA.radio / Math.PI).translate([MAPA.cx, MAPA.cy]);
// La calibración de radar.ts manda: x = cx + ρ·sen(lon), y = cy + ρ·cos(lon).
const esperado = (lon, lat) => {
  const rho = (MAPA.radio * (90 - lat)) / 180;
  const a = (lon * Math.PI) / 180;
  return [MAPA.cx + rho * Math.sin(a), MAPA.cy + rho * Math.cos(a)];
};
for (const [lon, lat] of [[0, 0], [90, 0], [2.65, 39.57], [-74, 4.6], [30.5, 50.4]]) {
  const [x, y] = proyeccion([lon, lat]);
  const [ex, ey] = esperado(lon, lat);
  if (Math.hypot(x - ex, y - ey) > 0.01) throw new Error(`Proyección distinta de la calibración en ${lon},${lat}: ${x},${y} ≠ ${ex},${ey}`);
}

const trazo = geoPath(proyeccion).digits(1);

// Quita puntos a menos de 0,4 px del anterior y anillos de menos de 1 px²,
// salvo el anillo mayor de cada país (Andorra o Malta no pueden desaparecer).
function aligerar(d, { islas = false } = {}) {
  const anillos = d.split("M").filter(Boolean).map((a) => a.replace(/Z$/, "").split("L").map((p) => p.split(",").map(Number)));
  const area = (pts) => Math.abs(pts.reduce((s, [x, y], i) => { const [x2, y2] = pts[(i + 1) % pts.length]; return s + x * y2 - x2 * y; }, 0)) / 2;
  const limpios = anillos.map((pts) => {
    const fuera = [pts[0]];
    for (const p of pts.slice(1)) { const u = fuera[fuera.length - 1]; if (Math.hypot(p[0] - u[0], p[1] - u[1]) >= 0.4) fuera.push(p); }
    // Un anillo pequeño que se queda en menos de tres puntos se conserva tal cual.
    return fuera.length >= 3 ? fuera : pts;
  });
  // El área se mide sobre el anillo ORIGINAL: aligerar no puede borrar Mallorca.
  // El anillo mayor siempre queda (Liechtenstein, Andorra…); con «islas»
  // (España) quedan todas las que se ven: Baleares y Canarias.
  const minimo = islas ? 0.02 : 1;
  const iMayor = anillos.reduce((m, pts, i) => (area(pts) > area(anillos[m]) ? i : m), 0);
  return limpios
    .filter((pts, i) => i === iMayor || area(anillos[i]) >= minimo)
    .map((pts) => "M" + pts.map(([x, y]) => `${+x.toFixed(1)},${+y.toFixed(1)}`).join("L") + "Z")
    .join("");
}

const buscar = (topologia, codigo) => topologia.objects.countries.geometries.find((o) => o.id === ISO[codigo]);
// Para cada país, la topología de la que sale y su geometría.
const origen = (codigo) => {
  const g110 = !DETALLE_50M.has(codigo) && buscar(mundo110, codigo);
  if (g110) return { topologia: mundo110, g: g110 };
  const g50 = buscar(mundo50, codigo);
  if (!g50) throw new Error(`world-atlas no tiene ${codigo} (${ISO[codigo]})`);
  return { topologia: mundo50, g: g50 };
};

const paises = {};
const centros = {};
for (const codigo of Object.keys(ISO).sort()) {
  const { topologia, g } = origen(codigo);
  const f = feature(topologia, g);
  paises[codigo] = aligerar(trazo(f), { islas: DETALLE_50M.has(codigo) });
  // Centro del polígono mayor: Francia en Europa, no en la Guayana.
  const poligonos = f.geometry.type === "MultiPolygon" ? f.geometry.coordinates.map((c) => ({ type: "Polygon", coordinates: c })) : [f.geometry];
  const mayor = poligonos.reduce((a, b) => (trazo.area(b) > trazo.area(a) ? b : a));
  const [x, y] = trazo.centroid(mayor);
  centros[codigo] = [+x.toFixed(1), +y.toFixed(1)];
}

// Zonas y grupos: un solo contorno exterior (el plasma no recorre fronteras
// internas). Se unen en 1:110M; lo diminuto que no trae no cambia el contorno.
const unir = (codigos) => aligerar(trazo(merge(mundo110, codigos.map((c) => buscar(mundo110, c)).filter(Boolean))));
const zonas = Object.fromEntries(Object.entries(ZONAS).map(([idioma, codigos]) => [idioma, unir(codigos)]));
const grupos = Object.fromEntries(Object.entries(GRUPOS).map(([grupo, codigos]) => [grupo, unir(codigos)]));

for (const codigos of [...Object.values(ZONAS), ...Object.values(GRUPOS)]) for (const c of codigos) if (!ISO[c]) throw new Error(`Falta ${c} en ISO`);

const json = JSON.stringify({ v: 1, paises, zonas, grupos });
// El nombre lleva el hash del contenido: se sirve como inmutable y un cambio
// de trazados nunca sale de una caché vieja. Se borran las versiones anteriores.
const version = createHash("sha256").update(json).digest("hex").slice(0, 10);
for (const viejo of readdirSync("public/mapa")) if (/^paises(\.[a-f0-9]{10})?\.json$/.test(viejo)) rmSync(`public/mapa/${viejo}`);
writeFileSync(`public/mapa/paises.${version}.json`, json);

const ts = `// GENERADO por scripts/mapa/generar-paises.mjs: no se edita a mano.
// Países que el radar sabe resaltar, su centro en el plano del mapamundi
// (px sobre 640×640) y a qué zona de idioma o grupo de pasaporte pertenecen.
// Los trazados pesan: viven en public/mapa/paises.<hash>.json y se piden al dibujar.

export const TRAZADOS_URL = "/mapa/paises.${version}.json";

export const PAISES_RADAR = ${JSON.stringify(Object.keys(ISO).sort())} as const;
export type PaisRadar = (typeof PAISES_RADAR)[number];

export const CENTRO_PAIS: Record<PaisRadar, readonly [number, number]> = ${JSON.stringify(centros)};

export const ZONA_IDIOMA = ${JSON.stringify(ZONAS)} as const satisfies Record<string, readonly PaisRadar[]>;

export const GRUPO_PASAPORTE = ${JSON.stringify(GRUPOS)} as const satisfies Record<string, readonly PaisRadar[]>;
`;
writeFileSync("src/lib/radar-paises.ts", ts);
const kb = (s) => (Buffer.byteLength(s) / 1024).toFixed(1);
console.log(`paises.${version}.json ${kb(json)} KB · ${Object.keys(paises).length} países · zonas ${Object.keys(zonas).join(",")} · grupos ${Object.keys(grupos).join(",")}`);
