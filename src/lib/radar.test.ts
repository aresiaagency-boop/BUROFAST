import { createHash } from "node:crypto";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { LOCALES } from "@/lib/i18n/locales";
import CALIBRACION from "@/lib/mapa-calibracion.json";
import { CENTRO_PAIS, ENCUADRES, esPaisRadar, GRUPO_PASAPORTE, MAPA, PAISES_RADAR, proyectar, puntoEnArco, resaltadoRadar, SEDE, ZONA_IDIOMA, ZONAS } from "@/lib/radar";
import { TRAZADOS_URL } from "@/lib/radar-paises";

const json = readFileSync(join(process.cwd(), "public", TRAZADOS_URL), "utf8");
const trazados = JSON.parse(json) as { paises: Record<string, string>; zonas: Record<string, string>; grupos: Record<string, string> };
const distancia = (a: { x: number; y: number }, b: readonly [number, number]) => Math.hypot(a.x - b[0], a.y - b[1]);

describe("países del radar sobre el mapamundi", () => {
  it("el JSON público es el que generó el script (el hash del nombre casa) y no quedan versiones viejas", () => {
    const version = createHash("sha256").update(json).digest("hex").slice(0, 10);
    expect(TRAZADOS_URL).toBe(`/mapa/paises.${version}.json`);
    expect(readdirSync(join(process.cwd(), "public/mapa")).filter((f) => f.startsWith("paises"))).toEqual([`paises.${version}.json`]);
  });

  it("la calibración es una sola, la del JSON compartido con el generador", () => {
    expect(MAPA).toEqual(CALIBRACION);
  });

  it("España incluye Baleares (Palma) y Canarias, y Palma no cae en el mar", () => {
    const anillos = trazados.paises.ES.split("M").filter(Boolean).map((a) => a.replace(/Z$/, "").split("L").map((p) => p.split(",").map(Number) as [number, number]));
    const dentro = ({ x, y }: { x: number; y: number }) =>
      anillos.some((pts) => {
        let par = false;
        for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
          const [xi, yi] = pts[i];
          const [xj, yj] = pts[j];
          if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) par = !par;
        }
        return par;
      });
    // Palma en Mallorca, con medio píxel de tolerancia por el aligerado.
    const cerca = (p: { x: number; y: number }) => [0, 0.5, -0.5].some((dx) => [0, 0.5, -0.5].some((dy) => dentro({ x: p.x + dx, y: p.y + dy })));
    expect(cerca(SEDE)).toBe(true);
    expect(cerca(proyectar(-15.43, 28.1))).toBe(true); // Gran Canaria
    expect(dentro(proyectar(-3.7, 40.42))).toBe(true); // Madrid
    expect(dentro(proyectar(4.5, 40.0))).toBe(false); // el Mediterráneo entre Menorca y Cerdeña
  });

  it("cada país, zona de idioma y grupo de pasaporte tiene trazado", () => {
    for (const c of PAISES_RADAR) expect(trazados.paises[c], c).toMatch(/^M[\d.,LMZ-]+Z$/);
    for (const l of LOCALES) expect(trazados.zonas[l], l).toMatch(/^M/);
    for (const g of Object.keys(GRUPO_PASAPORTE)) expect(trazados.grupos[g], g).toMatch(/^M/);
    for (const codigos of [...Object.values(ZONA_IDIOMA), ...Object.values(GRUPO_PASAPORTE)]) for (const c of codigos) expect(esPaisRadar(c), c).toBe(true);
  });

  it("los centros caen donde la calibración pone sus capitales", () => {
    // Si alguien cambia la proyección del script o la calibración, esto avisa.
    expect(distancia(proyectar(-74.07, 4.71), CENTRO_PAIS.CO)).toBeLessThan(14);
    expect(distancia(proyectar(-3.7, 40.42), CENTRO_PAIS.ES)).toBeLessThan(8);
    expect(distancia(proyectar(30.52, 50.45), CENTRO_PAIS.UA)).toBeLessThan(10);
    expect(distancia(proyectar(-7.59, 33.57), CENTRO_PAIS.MA)).toBeLessThan(10);
    // Palma, la sede, está en el trazado de España (con Baleares).
    expect(distancia(SEDE, CENTRO_PAIS.ES)).toBeLessThan(15);
  });

  it("cada zona de idioma contiene el país de su ciudad principal", () => {
    const principal = { es: "CO", en: "GB", fr: "SN", pt: "BR", ar: "MA", uk: "UA" } as const;
    // Las grandes nacionalidades no comunitarias en España se pueden elegir.
    for (const c of ["CN", "RU", "GE", "AM", "BD", "TR", "MA", "CO", "VE", "UA", "PK", "IN"]) expect(esPaisRadar(c), c).toBe(true);
    for (const l of LOCALES) expect(ZONA_IDIOMA[l] as readonly string[]).toContain(principal[l]);
    for (const z of ZONAS.filter((z) => z.principal)) expect(z.idioma).toMatch(/^(es|en|fr|pt|ar|uk)$/);
  });

  it("los encuadres caben en el disco del mapa", () => {
    for (const [x, y, lado] of Object.values(ENCUADRES)) {
      const centro = { x: x + lado / 2, y: y + lado / 2 };
      expect(Math.hypot(centro.x - MAPA.cx, centro.y - MAPA.cy) + lado / 2).toBeLessThanOrEqual(MAPA.radio + 1);
    }
  });
});

describe("lo que se resalta para cada usuario", () => {
  it("sin respuestas: solo la zona de su idioma y el hilo desde su ciudad principal", () => {
    const r = resaltadoRadar({ locale: "uk" });
    expect(r).toMatchObject({ zona: "uk", grupo: null, pais: null, enEspana: false });
    expect(r.origen).toEqual({ x: ZONAS.find((z) => z.idioma === "uk")!.x, y: ZONAS.find((z) => z.idioma === "uk")!.y });
  });

  it("el pasaporte iberoamericano enciende su grupo y el hilo sale de Latinoamérica aunque el idioma sea otro", () => {
    const r = resaltadoRadar({ locale: "en", respuestas: { pasaporte: "iberoamericano", ubicacion: "espana" } });
    expect(r.grupo).toBe("iberoamericano");
    expect(r.enEspana).toBe(true);
    const bogota = ZONAS.find((z) => z.ciudad === "Bogotá")!;
    expect(r.origen).toEqual({ x: bogota.x, y: bogota.y });
  });

  it("con pasaporte de la UE no hay hilo desde fuera; con país elegido, el hilo sale de él", () => {
    expect(resaltadoRadar({ locale: "fr", respuestas: { pasaporte: "ue" } }).origen).toBeNull();
    const r = resaltadoRadar({ locale: "fr", respuestas: { pasaporte: "ue" }, pais: "RO" });
    expect(r.pais).toBe("RO");
    expect(r.origen).toEqual({ x: CENTRO_PAIS.RO[0], y: CENTRO_PAIS.RO[1] });
  });

  it("un país inventado o España no se resaltan como «tu país»", () => {
    expect(resaltadoRadar({ locale: "es", pais: "XX" }).pais).toBeNull();
    expect(resaltadoRadar({ locale: "es", pais: "ES" }).pais).toBeNull();
    expect(resaltadoRadar({ locale: "es", pais: "<script>" }).pais).toBeNull();
  });

  it("las etapas del expediente recorren el hilo y terminan en la sede", () => {
    const o = CENTRO_PAIS.CO;
    expect(puntoEnArco(o[0], o[1], 0)).toEqual({ x: o[0], y: o[1] });
    expect(puntoEnArco(o[0], o[1], 1)).toEqual({ x: SEDE.x, y: SEDE.y });
  });
});

describe("aro del radar", () => {
  it("una vuelta entera (un solo documento, avance completo) se dibuja y no colapsa en un punto", async () => {
    const { arcoAro } = await import("@/components/holo/RadarExtranjeria");
    const d = arcoAro(0, 360, 100);
    expect(d.match(/A/g)).toHaveLength(2);
    expect(d).toMatch(/^M0\.0 -100\.0A100 100 0 0 1 0\.0 100\.0A100 100 0 0 1 -?0\.0 -100\.0$/);
    expect(arcoAro(0, 90, 100)).toMatch(/^M0\.0 -100\.0A100 100 0 0 1 100\.0 0\.0$/);
  });
});

describe("la animación antigua ya no existe", () => {
  it("ningún componente usa el núcleo de HESTIA", () => {
    const buscar = (dir: string): string[] =>
      readdirSync(dir, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? buscar(join(dir, e.name)) : /\.tsx?$/.test(e.name) ? [join(dir, e.name)] : []));
    const usos = buscar(join(process.cwd(), "src")).filter((f) => !f.endsWith("radar.test.ts") && /NucleoHestia/.test(readFileSync(f, "utf8")));
    expect(usos).toEqual([]);
  });
});
