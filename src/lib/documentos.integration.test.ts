import { afterAll, describe, expect, it } from "vitest";
import { db } from "@/lib/db";
import { aplicarRevisionIris, borrarDocumento, declaracionesDeLeads, declararDocumento, documentosDeLeads, documentosRequeridos, fueRechazado, guardarDocumento, leadDelCliente, leerDocumento, progresoDocumental, registrarConsentimiento, revisarDocumento } from "@/lib/documentos";
import { expedientesDeCliente, vincularExpediente } from "@/lib/expediente";
import { decidirRevision, evaluarLectura } from "@/lib/iris";
import { cambiarEstadoLead } from "@/lib/leads";
import { crearLead, replanificarPorDocumentos } from "@/lib/repositorio";
import { solicitudLeadSchema } from "@/lib/schemas";
import { hashEstable } from "@/lib/security/cifrado";

// Se salta sola sin DATABASE_URL o sin clave: entonces la bóveda NO se ha probado.
const conBase = Boolean(process.env.DATABASE_URL && process.env.DATA_ENCRYPTION_KEY);

describe.skipIf(!conBase)("bóveda de documentos en PostgreSQL", () => {
  const creados: string[] = [];

  afterAll(async () => {
    if (creados.length) await db()`delete from leads where id = any(${creados})`;
    await db().end({ timeout: 5 });
  });

  it("guarda cifrado, solo lo abre su dueño, se revisa y se borra sin dejar el contenido", async () => {
    const email = `boveda-${Date.now()}@ejemplo.test`;
    const lead = await crearLead(solicitudLeadSchema.parse({
      locale: "es",
      respuestas: { sueno: "nacionalidad", ubicacion: "espana", situacion: "autorizacion_vigente", tiempo: "2a_5a", pasaporte: "iberoamericano" },
      nivelCita: null,
      conGuardian: false,
      nombre: "Prueba Bóveda",
      telefono: "+34 611 000 999",
      email,
      consentimientoPrivacidad: true,
      consentimientoMarketing: false,
    }));
    creados.push(lead.id);

    // Sin correo verificado el expediente no es de nadie.
    expect(await leadDelCliente(lead.referencia, hashEstable(email))).toBeNull();
    await vincularExpediente(lead.referencia, hashEstable(email));
    const propio = await leadDelCliente(lead.referencia, hashEstable(email));
    expect(propio?.id).toBe(lead.id);
    expect(propio?.consentido).toBeNull();
    expect(await leadDelCliente(lead.referencia, hashEstable("otra@ejemplo.test"))).toBeNull();

    // La situación viaja cifrada en la base: el expediente la devuelve en claro y
    // la bóveda puede pedir los documentos de la ruta.
    const [expediente] = await expedientesDeCliente(hashEstable(email));
    expect(expediente.respuestas.situacion).toBe("autorizacion_vigente");
    expect(documentosRequeridos(expediente.respuestas)).toEqual(expect.arrayContaining(["pasaporte", "certificado_nacimiento", "ccse"]));
    expect(documentosRequeridos(expediente.respuestas)).not.toContain("dele_a2");
    expect(expediente.documentosConsentidos).toBe(false);

    await registrarConsentimiento(lead.id, { guardar: true, ia: false });
    expect((await leadDelCliente(lead.referencia, hashEstable(email)))?.consentido).toBeInstanceOf(Date);

    const contenido = new TextEncoder().encode("%PDF-1.7\nPASAPORTE-X1234567");
    const guardado = await guardarDocumento({ leadId: lead.id, tipo: "pasaporte", nombre: "pasaporte\u0000/../ana.pdf", contenido, origen: "app" });
    expect(guardado.ok).toBe(true);
    if (!guardado.ok) return;
    expect(await guardarDocumento({ leadId: lead.id, tipo: "otro", nombre: "x.html", contenido: new TextEncoder().encode("<script>"), origen: "app" })).toEqual({ ok: false, motivo: "tipo" });

    const [fila] = await db()<{ nombre_cifrado: string; contenido_cifrado: Buffer }[]>`select nombre_cifrado, contenido_cifrado from documentos where id = ${guardado.id}`;
    expect(fila.nombre_cifrado).not.toContain("ana");
    expect(fila.contenido_cifrado.includes(Buffer.from("PASAPORTE"))).toBe(false);

    const leido = await leerDocumento(guardado.id, lead.id);
    expect(leido?.nombre).toBe("pasaporte..ana.pdf");
    expect(Buffer.from(leido!.contenido).equals(Buffer.from(contenido))).toBe(true);
    expect(await leerDocumento(guardado.id, "00000000-0000-4000-8000-000000000000")).toBeNull();

    expect(await revisarDocumento(guardado.id, "rechazado", "Se ve cortado")).toEqual({ leadId: lead.id, tipo: "pasaporte" });
    const lista = (await documentosDeLeads([lead.id])).get(lead.id) ?? [];
    expect(lista).toHaveLength(1);
    expect(lista[0]).toMatchObject({ tipo: "pasaporte", estado: "rechazado", nota: "Se ve cortado", mime: "application/pdf" });

    expect(await borrarDocumento(guardado.id, "00000000-0000-4000-8000-000000000000")).toBe(false);
    expect(await borrarDocumento(guardado.id, lead.id)).toBe(true);
    const [borrado] = await db()<{ contenido_cifrado: Buffer | null }[]>`select contenido_cifrado from documentos where id = ${guardado.id}`;
    expect(borrado.contenido_cifrado).toBeNull();
    expect(await leerDocumento(guardado.id)).toBeNull();
    expect((await documentosDeLeads([lead.id])).get(lead.id)).toBeUndefined();
  });

  it("caso real de nacionalidad: ya tiene el CCSE → lo adjunta, IRIS da el verde y, al validarlo el abogado, la cita del examen sale del presupuesto", async () => {
    const email = `ccse-${Date.now()}@ejemplo.test`;
    const lead = await crearLead(solicitudLeadSchema.parse({
      locale: "es",
      respuestas: { sueno: "nacionalidad", ubicacion: "espana", situacion: "autorizacion_vigente", tiempo: "2a_5a", pasaporte: "iberoamericano" },
      nivelCita: "urgente",
      conGuardian: false,
      nombre: "Ronaldo Prueba Castillo",
      telefono: "+34 611 000 777",
      email,
      consentimientoPrivacidad: true,
      consentimientoMarketing: false,
    }));
    creados.push(lead.id);
    await vincularExpediente(lead.referencia, hashEstable(email));
    const citas = async () => (await db()<{ tipo: string; sla: Date | null }[]>`select tipo, sla_vence_en as sla from citas where lead_id = ${lead.id} order by tipo`);
    const antes = await citas();
    expect(antes.map((c) => c.tipo)).toEqual(["examenes_ccse_dele", "jura_nacionalidad"]);

    // «¿Ya lo tienes?» → sí.
    await declararDocumento(lead.id, "ccse", true);
    expect((await declaracionesDeLeads([lead.id])).get(lead.id)).toEqual({ ccse: true });
    // Dos consentimientos: guardar no implica pasar por IA.
    await registrarConsentimiento(lead.id, { guardar: true, ia: false });
    expect(await leadDelCliente(lead.referencia, hashEstable(email))).toMatchObject({ consentidoIa: null, titular: "Ronaldo Prueba Castillo" });
    await registrarConsentimiento(lead.id, { guardar: false, ia: true });
    expect((await leadDelCliente(lead.referencia, hashEstable(email)))?.consentidoIa).toBeInstanceOf(Date);

    const contenido = new TextEncoder().encode("%PDF-1.7\nCCSE APTO");
    const guardado = await guardarDocumento({ leadId: lead.id, tipo: "ccse", nombre: "ccse.pdf", contenido, origen: "app" });
    if (!guardado.ok) throw new Error("no se guardó");
    const lectura = evaluarLectura({ tipoDetectado: "ccse", esElPedido: true, confianza: 0.97, legible: true, titularDocumento: "CASTILLO, RONALDO", fechaEmision: "2025-06-12", fechaCaducidad: null, resultadoApto: true, observacion: null }, "Ronaldo Prueba Castillo");
    const decision = decidirRevision("ccse", lectura, new Date("2026-11-23T12:00:00Z"));
    expect(decision).toEqual({ estado: "verificado", codigo: "comprobado" });
    expect(await aplicarRevisionIris(guardado.id, decision, lectura)).toBe(true);
    // IRIS no pisa una decisión ya tomada.
    expect(await aplicarRevisionIris(guardado.id, { estado: "dudoso", codigo: "dudoso" }, lectura)).toBe(false);

    const [doc] = (await documentosDeLeads([lead.id])).get(lead.id) ?? [];
    expect(doc).toMatchObject({ estado: "verificado", revisionCodigo: "comprobado", revisadoPor: "iris", lectura: { resultadoApto: true, titularCoincide: true } });
    const [cifrada] = await db()<{ revision_cifrada: string }[]>`select revision_cifrada from documentos where id = ${guardado.id}`;
    expect(cifrada.revision_cifrada).not.toContain("2025-06-12");
    expect(progresoDocumental(documentosRequeridos({ sueno: "nacionalidad", ubicacion: "espana", situacion: "autorizacion_vigente", tiempo: "2a_5a", pasaporte: "iberoamericano" }), [doc]))
      .toMatchObject({ verdes: ["ccse"], completo: false });

    // El verde de IRIS deja seguir, pero no cambia el precio.
    expect(await replanificarPorDocumentos(lead.id)).toEqual({ ok: true, cambiado: false });

    // El abogado lo valida: fuera la cita del examen; la jura conserva su plazo e historial.
    expect(await revisarDocumento(guardado.id, "valido", null)).toEqual({ leadId: lead.id, tipo: "ccse" });
    const urgente = 9_900;
    expect(await replanificarPorDocumentos(lead.id)).toMatchObject({ ok: true, cambiado: true, antesCentimos: lead.importe.total, totalCentimos: lead.importe.total - urgente, quitadas: ["examenes_ccse_dele"], restituidas: [] });
    const despues = await citas();
    expect(despues.map((c) => c.tipo)).toEqual(["jura_nacionalidad"]);
    expect(despues[0].sla?.getTime() ?? null).toBe(antes.find((c) => c.tipo === "jura_nacionalidad")?.sla?.getTime() ?? null);
    expect(await replanificarPorDocumentos(lead.id)).toEqual({ ok: true, cambiado: false });

    // Rechazado después: la cita vuelve y el precio también.
    await revisarDocumento(guardado.id, "rechazado", "Es de otra persona");
    expect(await replanificarPorDocumentos(lead.id)).toMatchObject({ ok: true, cambiado: true, totalCentimos: lead.importe.total, restituidas: ["examenes_ccse_dele"] });
    expect(await fueRechazado(lead.id, guardado.sha256)).toBe(true);

    // Aprobado el expediente, un documento ya no cambia el precio: lo dice, no lo hace.
    await revisarDocumento(guardado.id, "valido", null);
    await cambiarEstadoLead({ leadId: lead.id, estado: "revision_abogado" });
    await cambiarEstadoLead({ leadId: lead.id, estado: "aprobado" });
    expect(await replanificarPorDocumentos(lead.id)).toEqual({ ok: false, motivo: "ESTADO_NO_PERMITE" });

    // Borrar no deja la lectura de IRIS.
    await borrarDocumento(guardado.id, lead.id);
    const [borrado] = await db()<{ revision_cifrada: string | null; revision_codigo: string | null }[]>`select revision_cifrada, revision_codigo from documentos where id = ${guardado.id}`;
    expect(borrado).toEqual({ revision_cifrada: null, revision_codigo: null });
  });

  it("sin el DELE, un CCSE validado no quita el examen a quien no es de habla hispana", async () => {
    const lead = await crearLead(solicitudLeadSchema.parse({
      locale: "es",
      respuestas: { sueno: "nacionalidad", ubicacion: "espana", situacion: "autorizacion_vigente", tiempo: "mas_10a", pasaporte: "otro" },
      nivelCita: "puede_esperar",
      conGuardian: false,
      nombre: "Olena Prueba",
      telefono: "+34 611 000 888",
      email: "",
      consentimientoPrivacidad: true,
      consentimientoMarketing: false,
    }));
    creados.push(lead.id);
    expect(lead.ruta.documentos).toEqual(expect.arrayContaining(["ccse", "dele_a2"]));
    const subir = async (tipo: "ccse" | "dele_a2") => {
      const g = await guardarDocumento({ leadId: lead.id, tipo, nombre: `${tipo}.pdf`, contenido: new TextEncoder().encode(`%PDF-1.7\n${tipo}`), origen: "app" });
      if (!g.ok) throw new Error("no se guardó");
      await revisarDocumento(g.id, "valido", null);
    };
    await subir("ccse");
    expect(await replanificarPorDocumentos(lead.id)).toEqual({ ok: true, cambiado: false });
    await subir("dele_a2");
    expect(await replanificarPorDocumentos(lead.id)).toMatchObject({ ok: true, cambiado: true, quitadas: ["examenes_ccse_dele"] });
  });
});
