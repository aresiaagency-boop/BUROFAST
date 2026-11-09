import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { detectarIntencion } from "@/lib/hestia/intenciones";
import { responderLocal } from "@/lib/hestia/local";
import type { Locale } from "@/lib/i18n/locales";
import type { AgenteId, MotorId } from "@/lib/motores";

// Casos reales de la consola de HESTIA en modo local (sin IA). Cada línea de
// eval/hestia.jsonl es un caso: añadir uno cada vez que HESTIA conteste mal.
// La seguridad manda: asilo y «quiero una persona» siempre escalan.
type Caso = {
  caso: string;
  locale: Locale;
  motor: MotorId | null;
  mensaje: string;
  esperado: { intencion: string; agente: AgenteId; motor: MotorId | null; escalar: boolean };
};

const ruta = fileURLToPath(new URL("../../../eval/hestia.jsonl", import.meta.url));
const casos = readFileSync(ruta, "utf8")
  .split("\n")
  .filter((linea) => linea.trim())
  .map((linea) => JSON.parse(linea) as Caso);

describe("eval de HESTIA (modo local)", () => {
  it("tiene al menos veinte casos y todos los idiomas", () => {
    expect(casos.length).toBeGreaterThanOrEqual(20);
    expect(new Set(casos.map((c) => c.locale))).toEqual(new Set(["es", "en", "fr", "pt", "ar", "uk"]));
  });

  for (const caso of casos) {
    it(caso.caso, () => {
      expect(detectarIntencion(caso.mensaje)).toBe(caso.esperado.intencion);
      const respuesta = responderLocal({ mensaje: caso.mensaje, locale: caso.locale, motor: caso.motor, ruta: null, nivelCita: null, conGuardian: false, expedientes: null });
      expect({ agente: respuesta.agente, motor: respuesta.motor, escalar: respuesta.escalar }).toEqual({
        agente: caso.esperado.agente,
        motor: caso.esperado.motor,
        escalar: caso.esperado.escalar,
      });
      expect(respuesta.texto.length).toBeGreaterThan(0);
    });
  }
});
