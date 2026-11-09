import { afterAll, describe, expect, it } from "vitest";
import { db } from "@/lib/db";
import { cambiarEstadoLead } from "@/lib/leads";
import type { Stripe } from "@/lib/pagos/stripe";
import { hashEstable } from "@/lib/security/cifrado";
import { vincularExpediente } from "@/lib/expediente";
import { aplicarResultado, existePagoConIntento, importeDe, leadPagablePorId, leadPagablePorReferencia, listarPagos, marcarReembolsado, registrarEventoStripe, registrarPendiente, sesionAbierta, yaPagado } from "@/lib/pagos/repositorio";
import { procesarEventoStripe } from "@/lib/pagos/webhook";
import { corregirRuta, crearLead } from "@/lib/repositorio";
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

    await registrarPendiente({ leadId: lead.id, tipo: "anticipo", importe, modo: "test", sessionId: sesionId, url: "https://checkout.stripe.test/x", expiraEn: new Date(Date.now() + 60 * 60_000), condicionesVersion: "2026-11-09", empezarYaEn: new Date() });
    expect(await sesionAbierta(lead.id, "anticipo")).toMatchObject({ sessionId: sesionId });

    const completado = { id: `evt_integracion_${sufijo}_1`, type: "checkout.session.completed", data: { object: { id: sesionId, mode: "payment", payment_status: "paid", payment_intent: intento, metadata: { app: "burofast" } } } } as unknown as Stripe.Event;
    const primero = await db().begin(async (tx) => ((await registrarEventoStripe(tx, completado.id, completado.type)) ? procesarEventoStripe(tx, completado) : { accion: "duplicado" }));
    expect(primero).toMatchObject({ accion: "pagado", leadId: lead.id });
    // Stripe reintenta: el mismo evento no se procesa dos veces.
    const repetido = await db().begin(async (tx) => ((await registrarEventoStripe(tx, completado.id, completado.type)) ? procesarEventoStripe(tx, completado) : { accion: "duplicado" }));
    expect(repetido).toEqual({ accion: "duplicado" });

    expect(await yaPagado(lead.id, "anticipo")).toBe(true);
    expect(await existePagoConIntento(intento)).toBe(true);
    expect(await existePagoConIntento("pi_de_otra_app")).toBe(false);
    expect(await sesionAbierta(lead.id, "anticipo")).toBeNull();
    const [estado] = await db()<{ estado: string }[]>`select estado from leads where id = ${lead.id}`;
    expect(estado.estado).toBe("convertido");

    // Una expiración tardía no deshace un cobro; un reembolso total sí lo marca.
    expect(await db().begin((tx) => aplicarResultado(tx, { sessionId: sesionId, estado: "expirado", paymentIntent: null }))).toBeNull();
    expect(await db().begin((tx) => marcarReembolsado(tx, intento))).toEqual({ leadId: lead.id });
    expect(await yaPagado(lead.id, "anticipo")).toBe(false);
  });

  it("el expediente solo se ve y se paga desde la cuenta que lo vinculó con su código", async () => {
    const lead = await crearLead(solicitudLeadSchema.parse({
      locale: "es",
      respuestas: { sueno: "renovar", ubicacion: "espana", situacion: "autorizacion_vigente", tiempo: "1a_2a", pasaporte: "otro" },
      nivelCita: null,
      conGuardian: false,
      nombre: "Vínculo Integración",
      telefono: "+34 600 000 002",
      email: "vinculo@ejemplo.test",
      consentimientoPrivacidad: true,
      consentimientoMarketing: false,
    }));
    leads.push(lead.id);
    const hash = hashEstable("vinculo@ejemplo.test");
    // Sin vínculo, ni el dueño del correo lo ve: el correo tecleado no prueba nada.
    expect(await leadPagablePorReferencia(lead.referencia, hash)).toBeNull();
    // Otro correo con el código no vincula; el correo correcto con el código, sí.
    expect(await vincularExpediente(lead.referencia, hashEstable("otra@ejemplo.test"))).toEqual({ ok: false });
    expect(await vincularExpediente(lead.referencia, hash)).toEqual({ ok: true, leadId: lead.id });
    expect((await leadPagablePorReferencia(lead.referencia, hash))?.id).toBe(lead.id);
  });

  it("un pago que llega sin aprobación no convierte el expediente y se señala", async () => {
    const lead = await crearLead(solicitudLeadSchema.parse({
      locale: "es",
      respuestas: { sueno: "renovar", ubicacion: "espana", situacion: "autorizacion_vigente", tiempo: "1a_2a", pasaporte: "otro" },
      nivelCita: null,
      conGuardian: false,
      nombre: "Sin Aprobación",
      telefono: "+34 600 000 003",
      email: "",
      consentimientoPrivacidad: true,
      consentimientoMarketing: false,
    }));
    leads.push(lead.id);
    await cambiarEstadoLead({ leadId: lead.id, estado: "revision_abogado" });
    await cambiarEstadoLead({ leadId: lead.id, estado: "aprobado" });
    const sesion = `${sesionId}_b`;
    await registrarPendiente({ leadId: lead.id, tipo: "anticipo", importe: 1_000, modo: "test", sessionId: sesion, url: "https://checkout.stripe.test/y", expiraEn: new Date(Date.now() + 60 * 60_000), condicionesVersion: "2026-11-09", empezarYaEn: new Date() });
    // El abogado retira la aprobación y el cliente paga en una pestaña vieja.
    await cambiarEstadoLead({ leadId: lead.id, estado: "revision_abogado" });
    expect(await db().begin((tx) => aplicarResultado(tx, { sessionId: sesion, estado: "pagado", paymentIntent: `${intento}_b` }))).toMatchObject({ leadId: lead.id });
    const [estado] = await db()<{ estado: string }[]>`select estado from leads where id = ${lead.id}`;
    expect(estado.estado).toBe("revision_abogado");
    expect((await listarPagos()).find((p) => p.sessionId === sesion)?.sinAprobacion).toBe(true);
  });

  it("el abogado corrige la ruta y el precio antes de aprobar, nunca después", async () => {
    const lead = await crearLead(solicitudLeadSchema.parse({
      locale: "es",
      respuestas: { sueno: "trabajar", ubicacion: "fuera", situacion: null, tiempo: null, pasaporte: "otro" },
      nivelCita: "urgente",
      conGuardian: false,
      nombre: "Corrección Integración",
      telefono: "+34 600 000 004",
      email: "",
      consentimientoPrivacidad: true,
      consentimientoMarketing: false,
    }));
    leads.push(lead.id);
    const [antes] = await db()<{ ruta_id: string; total: number }[]>`select ruta_id, total_estimado_centimos as total from leads where id = ${lead.id}`;
    await cambiarEstadoLead({ leadId: lead.id, estado: "revision_abogado" });

    const corregida = await corregirRuta(lead.id, {
      respuestas: { sueno: "renovar", ubicacion: "espana", situacion: "autorizacion_vigente", tiempo: "1a_2a", pasaporte: "otro" },
      nivelCita: "puede_esperar",
      conGuardian: true,
    });
    expect(corregida.ok).toBe(true);
    const [despues] = await db()<{ ruta_id: string; total: number; nivel_cita: string | null; con_guardian: boolean }[]>`
      select ruta_id, total_estimado_centimos as total, nivel_cita, con_guardian from leads where id = ${lead.id}`;
    expect(despues.ruta_id).not.toBe(antes.ruta_id);
    expect(corregida.ok && corregida.totalCentimos).toBe(despues.total);
    const citas = await db()<{ nivel: string }[]>`select nivel from citas where lead_id = ${lead.id}`;
    for (const cita of citas) expect(cita.nivel).toBe("puede_esperar");

    await cambiarEstadoLead({ leadId: lead.id, estado: "aprobado" });
    expect(await corregirRuta(lead.id, { respuestas: { sueno: "renovar", ubicacion: "espana", situacion: "autorizacion_vigente", tiempo: "1a_2a", pasaporte: "otro" }, nivelCita: null, conGuardian: false }))
      .toEqual({ ok: false, motivo: "ESTADO_NO_PERMITE" });
  });

  it("el límite de peticiones es uno para todas las instancias", async () => {
    const clave = `prueba:${sufijo}`;
    const opciones = { limite: 2, ventanaMs: 60_000 };
    expect((await limitar(clave, opciones)).permitido).toBe(true);
    expect((await limitar(clave, opciones)).permitido).toBe(true);
    expect(await limitar(clave, opciones)).toEqual({ permitido: false, restantes: 0 });
  });
});
