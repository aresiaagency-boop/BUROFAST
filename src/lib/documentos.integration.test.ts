import { afterAll, describe, expect, it } from "vitest";
import { db } from "@/lib/db";
import { borrarDocumento, documentosDeLeads, documentosRequeridos, guardarDocumento, leadDelCliente, leerDocumento, registrarConsentimiento, revisarDocumento } from "@/lib/documentos";
import { expedientesDeCliente, vincularExpediente } from "@/lib/expediente";
import { crearLead } from "@/lib/repositorio";
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
    expect(documentosRequeridos(expediente.respuestas)).toEqual(expect.arrayContaining(["pasaporte", "certificado_nacimiento"]));
    expect(expediente.documentosConsentidos).toBe(false);

    await registrarConsentimiento(lead.id);
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

    expect(await revisarDocumento(guardado.id, "rechazado", "Se ve cortado")).toBe(true);
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
});
