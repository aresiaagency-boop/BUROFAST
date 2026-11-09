import { afterAll, describe, expect, it } from "vitest";
import { db } from "@/lib/db";
import { cambiarEstadoLead } from "@/lib/leads";
import type { Stripe } from "@/lib/pagos/stripe";
import { aplicarResultado, importeDe, leadPagablePorId, marcarReembolsado, registrarEventoStripe, registrarPendiente, sesionAbierta, yaPagado } from "@/lib/pagos/repositorio";
import { procesarEventoStripe } from "@/lib/pagos/webhook";
import { crearLead } from "@/lib/repositorio";
import { solicitudLeadSchema } from "@/lib/schemas";
import { limitar } from "@/lib/security/limites";

// Se salta sola sin DATABASE_URL o sin clave: si el número de pruebas baja en
// CI, es esto, y los cobros NO se han probado contra PostgreSQL.
const conBase = Boolean(process.env.DATABASE_URL && process.env.DATA_ENCRYPTION_KEY);
const sufijo = `${Date.now()}`;

describe.skipIf(!conBase)("cobros y límites en PostgreSQL", () => {
  const leads: string[] = [];
  const sesionId = `cs_test_integracion_${sufijo}`;
  const intento = `pi_test_integracion_${sufijo}`;

  afterAll(async () => {
    if (leads.length) {
      await db()`delete from pagos where lead_id = any(${leads})`;
      await db()`delete from leads where id = any(${leads})`;
    }
    await db()`delete from stripe_eventos where id like ${`evt_integracion_${sufijo}%`}`;
    await db().end({ timeout: 5 });
  });

  it("del abogado al cobro: solo un expediente aprobado llega a convertido, y una sola vez", async () => {
    const lead = await crearLead(solicitudLeadSchema.parse({
      locale: "es",
      respuestas: { sueno: "renovar", ubicacion: "espana", situacion: "autorizacion_vigente", tiempo: "1a_2a", pasaporte: "otro" },
      nivelCita: "puede_esperar",
      conGuardian: false,
      nombre: "Pago Integración",
      telefono: "+34 600 000 001",
      email: "pago@ejemplo.test",
      consentimientoPrivacidad: true,
      consentimientoMarketing: false,
    }));
    leads.push(lead.id);

    // La puerta humana: de nuevo a aprobado solo pasando por el abogado.
    expect(await cambiarEstadoLead({ leadId: lead.id, estado: "aprobado" })).toMatchObject({ ok: false, motivo: "TRANSICION_NO_PERMITIDA" });
    expect(await cambiarEstadoLead({ leadId: lead.id, estado: "revision_abogado" })).toMatchObject({ ok: true });
    expect(await cambiarEstadoLead({ leadId: lead.id, estado: "aprobado" })).toMatchObject({ ok: true });

    const pagable = await leadPagablePorId(lead.id);
    expect(pagable?.estado).toBe("aprobado");
    const importe = importeDe("anticipo", pagable?.totalCentimos ?? 0);
    expect(importe).toBe(Math.floor((pagable?.totalCentimos ?? 0) / 2));

    await registrarPendiente({ leadId: lead.id, tipo: "anticipo", importe, modo: "test", sessionId: sesionId, url: "https://checkout.stripe.test/x", expiraEn: new Date(Date.now() + 60 * 60_000) });
    expect(await sesionAbierta(lead.id, "anticipo")).toMatchObject({ sessionId: sesionId });

    const completado = { id: `evt_integracion_${sufijo}_1`, type: "checkout.session.completed", data: { object: { id: sesionId, mode: "payment", payment_status: "paid", payment_intent: intento, metadata: { app: "burofast" } } } } as unknown as Stripe.Event;
    const primero = await db().begin(async (tx) => ((await registrarEventoStripe(tx, completado.id, completado.type)) ? procesarEventoStripe(tx, completado) : { accion: "duplicado" }));
    expect(primero).toMatchObject({ accion: "pagado", leadId: lead.id });
    // Stripe reintenta: el mismo evento no se procesa dos veces.
    const repetido = await db().begin(async (tx) => ((await registrarEventoStripe(tx, completado.id, completado.type)) ? procesarEventoStripe(tx, completado) : { accion: "duplicado" }));
    expect(repetido).toEqual({ accion: "duplicado" });

    expect(await yaPagado(lead.id, "anticipo")).toBe(true);
    expect(await sesionAbierta(lead.id, "anticipo")).toBeNull();
    const [estado] = await db()<{ estado: string }[]>`select estado from leads where id = ${lead.id}`;
    expect(estado.estado).toBe("convertido");

    // Una expiración tardía no deshace un cobro; un reembolso total sí lo marca.
    expect(await db().begin((tx) => aplicarResultado(tx, { sessionId: sesionId, estado: "expirado", paymentIntent: null }))).toBeNull();
    expect(await db().begin((tx) => marcarReembolsado(tx, intento))).toEqual({ leadId: lead.id });
    expect(await yaPagado(lead.id, "anticipo")).toBe(false);
  });

  it("el límite de peticiones es uno para todas las instancias", async () => {
    const clave = `prueba:${sufijo}`;
    const opciones = { limite: 2, ventanaMs: 60_000 };
    expect((await limitar(clave, opciones)).permitido).toBe(true);
    expect((await limitar(clave, opciones)).permitido).toBe(true);
    expect(await limitar(clave, opciones)).toEqual({ permitido: false, restantes: 0 });
  });
});
