import { describe, expect, it } from "vitest";
import { ESTADOS_CITA, esEstadoFinal, puedeTransicionar, semaforoSla, venceSla } from "@/lib/citas";

describe("ciclo de vida de la cita", () => {
  it("una cita asistida o cancelada no vuelve a moverse", () => {
    for (const destino of ESTADOS_CITA) {
      expect(puedeTransicionar("asistida", destino, "urgente")).toBe(false);
      expect(puedeTransicionar("cancelada", destino, "urgente")).toBe(false);
    }
  });

  it("no se puede marcar como asistida una cita que no estaba confirmada", () => {
    expect(puedeTransicionar("requerida", "asistida", "urgente")).toBe(false);
    expect(puedeTransicionar("reservada", "asistida", "urgente")).toBe(false);
    expect(puedeTransicionar("confirmada", "asistida", "urgente")).toBe(true);
  });

  it("el reembolso solo existe mientras se está gestionando", () => {
    expect(puedeTransicionar("en_gestion", "sin_cita_reembolso", "urgente")).toBe(true);
    expect(puedeTransicionar("confirmada", "sin_cita_reembolso", "urgente")).toBe(false);
    expect(esEstadoFinal("sin_cita_reembolso")).toBe(true);
  });
});

describe("reembolso y citas en espera", () => {
  it("«puedo esperar» no tiene garantía: nunca ofrece reembolso", () => {
    expect(puedeTransicionar("en_gestion", "sin_cita_reembolso", "puede_esperar")).toBe(false);
  });

  it("una cita en espera solo puede activarse o cancelarse, y no cuenta plazo", () => {
    expect(puedeTransicionar("en_espera", "requerida", "urgente")).toBe(true);
    expect(puedeTransicionar("en_espera", "en_gestion", "urgente")).toBe(false);
    expect(semaforoSla({ estado: "en_espera", nivel: "urgente", slaVenceEn: null })).toBe("en_espera");
  });
});

describe("semáforo del plazo de primera acción", () => {
  const creada = new Date("2026-11-05T09:00:00Z");

  it("urgente vence a las 24 horas", () => {
    expect(venceSla("urgente", creada).toISOString()).toBe("2026-11-06T09:00:00.000Z");
  });

  it("avisa con la cuarta parte del plazo por delante", () => {
    const vence = venceSla("urgente", creada);
    expect(semaforoSla({ estado: "requerida", nivel: "urgente", slaVenceEn: vence, ahora: new Date("2026-11-06T04:00:00Z") })).toBe("vence_pronto");
    expect(semaforoSla({ estado: "requerida", nivel: "urgente", slaVenceEn: vence, ahora: new Date("2026-11-05T12:00:00Z") })).toBe("en_plazo");
    expect(semaforoSla({ estado: "en_gestion", nivel: "urgente", slaVenceEn: vence, ahora: new Date("2026-11-06T10:00:00Z") })).toBe("vencida");
  });

  it("una cita ya reservada deja de contar plazo", () => {
    expect(semaforoSla({ estado: "reservada", nivel: "urgente", slaVenceEn: creada, ahora: new Date("2026-12-01T00:00:00Z") })).toBe("cerrada");
  });
});
