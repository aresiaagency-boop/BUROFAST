import { describe, expect, it } from "vitest";
import { ESTADOS_LEAD } from "@/lib/expediente";
import { puedeCambiarLead } from "@/lib/leads";

describe("ciclo de vida de una solicitud", () => {
  it("solo se aprueba desde la revisión del abogado", () => {
    for (const desde of ESTADOS_LEAD) expect(puedeCambiarLead(desde, "aprobado"), desde).toBe(desde === "revision_abogado");
  });

  it("a «convertido» nunca se llega a mano: solo pagando", () => {
    for (const desde of ESTADOS_LEAD) expect(puedeCambiarLead(desde, "convertido"), desde).toBe(false);
  });

  it("un expediente convertido ya no cambia de estado", () => {
    for (const hacia of ESTADOS_LEAD) expect(puedeCambiarLead("convertido", hacia), hacia).toBe(false);
  });

  it("lo descartado puede reabrirse y lo aprobado volver a revisión", () => {
    expect(puedeCambiarLead("descartado", "nuevo")).toBe(true);
    expect(puedeCambiarLead("aprobado", "revision_abogado")).toBe(true);
  });
});
