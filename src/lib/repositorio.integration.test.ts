import { afterAll, describe, expect, it } from "vitest";
import { db } from "@/lib/db";
import { cambiarEstadoCita, crearLead, listarCitas, listarLeads, registrarEventoHestia } from "@/lib/repositorio";
import { solicitudLeadSchema } from "@/lib/schemas";

// Se salta sola sin DATABASE_URL o sin clave: si el número de pruebas baja en
// CI, es esto, y la persistencia NO se ha probado.
const conBase = Boolean(process.env.DATABASE_URL && process.env.DATA_ENCRYPTION_KEY);

describe.skipIf(!conBase)("persistencia real en PostgreSQL", () => {
  const creados: string[] = [];
  let referencia = "";

  afterAll(async () => {
    if (creados.length) await db()`delete from leads where id = any(${creados})`;
    await db().end({ timeout: 5 });
  });

  it("guarda la solicitud cifrada, recalcula la ruta en el servidor y crea una cita por cada cita gestionable", async () => {
    const solicitud = solicitudLeadSchema.parse({
      locale: "es",
      respuestas: { sueno: "renovar", ubicacion: "espana", situacion: "regularizacion_2026", tiempo: "2a_5a", pasaporte: "otro" },
      nivelCita: "urgente",
      conGuardian: true,
      nombre: "Prueba Integración",
      telefono: "+34 611 222 333",
      email: "",
      consentimientoPrivacidad: true,
      consentimientoMarketing: false,
    });
    const lead = await crearLead(solicitud);
    creados.push(lead.id);
    referencia = lead.referencia;

    expect(lead.ruta.id).toBe("paso_via_ordinaria");
    expect(lead.importe.total).toBe(29_000 + 2 * 9_900 + 4_900);

    const [fila] = await db()<{ nombre_cifrado: string; telefono_cifrado: string }[]>`select nombre_cifrado, telefono_cifrado from leads where id = ${lead.id}`;
    expect(fila.nombre_cifrado).not.toContain("Prueba");
    expect(fila.telefono_cifrado).not.toContain("611");

    const visibles = await listarLeads();
    const propio = visibles.find((l) => l.id === lead.id);
    expect(propio?.nombre).toBe("Prueba Integración");
    expect(propio?.telefono).toBe("+34 ••• ••• 333");

    const citas = (await listarCitas({ abiertas: true })).filter((c) => c.referencia === lead.referencia);
    expect(citas.map((c) => c.tipo).sort()).toEqual(["huellas_tie", "recogida_tie"]);
    // Huellas y recogida dependen de la resolución: nacen en espera, sin plazo
    // ni garantía corriendo (antes contaban desde el encargo y caducaban solas).
    expect(citas.every((c) => c.nivel === "urgente" && c.estado === "en_espera" && !c.slaVenceEn && !c.garantiaVenceEn)).toBe(true);
  });

  it("aplica el ciclo de vida: activar arranca plazo y garantía, rechaza saltos y registra cada cambio", async () => {
    const [cita] = (await listarCitas({ abiertas: true })).filter((c) => c.referencia === referencia && c.tipo === "huellas_tie");
    expect(cita?.estado).toBe("en_espera");

    const salto = await cambiarEstadoCita({ citaId: cita.id, estado: "en_gestion", actor: "test" });
    expect(salto).toMatchObject({ ok: false, motivo: "TRANSICION_NO_PERMITIDA" });

    expect((await cambiarEstadoCita({ citaId: cita.id, estado: "requerida", actor: "test" })).ok).toBe(true);
    const [activada] = (await listarCitas({ abiertas: true })).filter((c) => c.id === cita.id);
    expect(activada.slaVenceEn).toBeInstanceOf(Date);
    expect(activada.garantiaVenceEn).toBeInstanceOf(Date);

    expect((await cambiarEstadoCita({ citaId: cita.id, estado: "asistida", actor: "test" }))).toMatchObject({ ok: false });
    expect((await cambiarEstadoCita({ citaId: cita.id, estado: "en_gestion", actor: "test" })).ok).toBe(true);
    expect((await cambiarEstadoCita({ citaId: cita.id, estado: "reservada", fechaCita: "2026-11-20T09:30:00.000Z", lugar: "Oficina", actor: "test" })).ok).toBe(true);

    const eventos = await db()<{ estado_nuevo: string }[]>`select estado_nuevo from cita_eventos where cita_id = ${cita.id} order by id`;
    expect(eventos.map((e) => e.estado_nuevo)).toEqual(["requerida", "en_gestion", "reservada"]);
  });

  it("un evento de HESTIA repetido no se cuenta dos veces", async () => {
    const id = `test-${Date.now()}`;
    expect((await registrarEventoHestia({ mensajeId: id, tipo: "mensaje_entrante", locale: "es", telefono: "+34611222333" })).duplicado).toBe(false);
    expect((await registrarEventoHestia({ mensajeId: id, tipo: "mensaje_entrante", locale: "es", telefono: "+34611222333" })).duplicado).toBe(true);
    await db()`delete from hestia_eventos where mensaje_id = ${id}`;
  });
});
