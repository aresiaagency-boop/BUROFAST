import type { TransactionSql } from "postgres";
import { describe, expect, it } from "vitest";
import type { Stripe } from "@/lib/pagos/stripe";
import { esEventoAjeno, procesarEventoStripe } from "@/lib/pagos/webhook";

// Un tx falso: guarda cada consulta y devuelve las filas preparadas en orden.
function txFalso(respuestas: unknown[][] = []) {
  const consultas: string[] = [];
  const tx = ((partes: TemplateStringsArray) => {
    consultas.push(partes.join("?").replace(/\s+/g, " ").trim());
    return Promise.resolve(respuestas.shift() ?? []);
  }) as unknown as TransactionSql;
  return { tx, consultas };
}

const evento = (type: string, object: Record<string, unknown>) => ({ id: "evt_1", type, data: { object } }) as unknown as Stripe.Event;
const sesion = (extra: Record<string, unknown> = {}) => ({ id: "cs_1", mode: "payment", payment_status: "paid", payment_intent: "pi_1", metadata: { app: "burofast", lead_id: "L1" }, ...extra });

describe("eventos de Stripe de otras apps de la cuenta", () => {
  it("ignora las sesiones que no creó BUROFAST", () => {
    expect(esEventoAjeno(evento("checkout.session.completed", sesion({ metadata: { pedido: "flydish-9" } })))).toBe(true);
    expect(esEventoAjeno(evento("checkout.session.expired", sesion({ metadata: null })))).toBe(true);
    expect(esEventoAjeno(evento("checkout.session.completed", sesion()))).toBe(false);
  });

  it("los reembolsos se cruzan por el pago, no por metadata", () => {
    expect(esEventoAjeno(evento("charge.refunded", { refunded: true, payment_intent: "pi_x" }))).toBe(false);
  });
});

describe("procesar un evento de Stripe", () => {
  it("cobro completado: marca el pago y convierte el expediente del anticipo", async () => {
    const { tx, consultas } = txFalso([[{ leadId: "L1", tipo: "anticipo" }], []]);
    expect(await procesarEventoStripe(tx, evento("checkout.session.completed", sesion()))).toEqual({ accion: "pagado", leadId: "L1" });
    expect(consultas[0]).toContain("update pagos set");
    expect(consultas[1]).toContain("update leads set estado = 'convertido'");
  });

  it("con pago asíncrono pendiente espera; sin fila propia no cambia nada", async () => {
    const { tx, consultas } = txFalso();
    expect(await procesarEventoStripe(tx, evento("checkout.session.completed", sesion({ payment_status: "unpaid" })))).toEqual({ accion: "esperando_cobro" });
    expect(consultas).toHaveLength(0);
    expect(await procesarEventoStripe(tx, evento("checkout.session.async_payment_succeeded", sesion()))).toMatchObject({ accion: "sin_cambios" });
  });

  it("un reembolso parcial no cambia el estado; uno total sí", async () => {
    const parcial = txFalso();
    expect(await procesarEventoStripe(parcial.tx, evento("charge.refunded", { refunded: false, payment_intent: "pi_1" }))).toEqual({ accion: "reembolso_parcial" });
    expect(parcial.consultas).toHaveLength(0);
    const total = txFalso([[{ leadId: "L1" }]]);
    expect(await procesarEventoStripe(total.tx, evento("charge.refunded", { refunded: true, payment_intent: "pi_1" }))).toEqual({ accion: "reembolsado", leadId: "L1" });
  });

  it("los modos que no son pago y los tipos desconocidos se ignoran", async () => {
    const { tx } = txFalso();
    expect(await procesarEventoStripe(tx, evento("checkout.session.completed", sesion({ mode: "subscription" })))).toEqual({ accion: "ignorado" });
    expect(await procesarEventoStripe(tx, evento("customer.created", {}))).toEqual({ accion: "ignorado" });
  });
});
