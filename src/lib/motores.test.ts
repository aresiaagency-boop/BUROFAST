import { describe, expect, it } from "vitest";
import { esFechaIso, motorArgos } from "@/lib/motores";

// ARGOS: la ventana de renovación abre 60 días antes de caducar y la gracia
// cierra 90 días después.
describe("ARGOS · plazos de renovación", () => {
  const caducidad = "2027-03-01";

  it.each([
    ["2026-11-09", "lejos"],
    ["2026-12-31", "ventana"],
    ["2027-03-01", "ventana"],
    ["2027-03-02", "gracia"],
    ["2027-05-30", "gracia"],
    ["2027-05-31", "fuera"],
  ])("hoy %s → %s", (hoy, estado) => {
    expect(motorArgos(caducidad, hoy).estado).toBe(estado);
  });

  it("da las fechas y los días que faltan", () => {
    expect(motorArgos(caducidad, "2026-11-09")).toEqual({
      estado: "lejos",
      abreVentana: "2026-12-31",
      caducidad: "2027-03-01",
      cierraGracia: "2027-05-30",
      diasHastaVentana: 52,
      diasHastaCaducidad: 112,
      diasHastaCierre: 202,
    });
  });

  it("solo acepta fechas reales AAAA-MM-DD", () => {
    expect(esFechaIso("2027-03-01")).toBe(true);
    expect(esFechaIso("2027-02-30")).toBe(false);
    expect(esFechaIso("2027-13-01")).toBe(false);
    expect(esFechaIso("01/03/2027")).toBe(false);
    expect(esFechaIso(20270301)).toBe(false);
  });
});
