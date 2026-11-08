import { describe, expect, it } from "vitest";
import { NIVELES_CITA, precioCitas, presupuesto } from "@/lib/catalogo";

describe("presupuesto", () => {
  it("cobra solo las citas gestionables: la de asilo nunca suma", () => {
    expect(precioCitas(["huellas_tie", "entrevista_asilo"], "urgente")).toBe(NIVELES_CITA.urgente.precioCentimos);
  });

  it("los dos hitos de pago suman siempre el total, también con céntimos impares", () => {
    const resultado = presupuesto({ producto: "renovacion", citas: ["huellas_tie"], nivelCita: "puede_esperar", conGuardian: true });
    expect(resultado.alEncargo + resultado.alPresentar).toBe(resultado.total);
    expect(resultado.total).toBe(19_000 + 3_900 + 4_900);
  });

  it("sin nivel de cita elegido no se cobra gestión de citas", () => {
    expect(presupuesto({ producto: "llegada", citas: ["nie", "empadronamiento"], nivelCita: null, conGuardian: false }).citas).toBe(0);
  });

  it("Guardián no se suma dos veces cuando el producto ya es Guardián", () => {
    expect(presupuesto({ producto: "guardian", citas: [], nivelCita: null, conGuardian: true }).total).toBe(4_900);
  });

  it("urgente cuesta más que puedo esperar y su reembolso es la diferencia exacta", () => {
    expect(NIVELES_CITA.urgente.precioCentimos - NIVELES_CITA.puede_esperar.precioCentimos).toBe(NIVELES_CITA.urgente.reembolsoSinCitaCentimos);
  });
});
