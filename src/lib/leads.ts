import type { EstadoLead } from "@/lib/expediente";
import { db } from "@/lib/db";

// Ciclo de vida de una solicitud. «aprobado» es la puerta humana: un abogado
// ha confirmado la ruta y solo entonces se puede cobrar el anticipo. A
// «convertido» solo se llega pagando (lo pone el webhook de Stripe), nunca a
// mano.
const TRANSICIONES: Record<EstadoLead, EstadoLead[]> = {
  nuevo: ["contactado", "revision_abogado", "descartado"],
  contactado: ["revision_abogado", "descartado"],
  revision_abogado: ["aprobado", "contactado", "descartado"],
  aprobado: ["revision_abogado", "descartado"],
  convertido: [],
  descartado: ["nuevo"],
};

export function transicionesLead(estado: EstadoLead) {
  return TRANSICIONES[estado];
}

export function puedeCambiarLead(desde: EstadoLead, hacia: EstadoLead) {
  return TRANSICIONES[desde].includes(hacia);
}

export async function cambiarEstadoLead(input: { leadId: string; estado: EstadoLead }) {
  return db().begin(async (tx) => {
    const [actual] = await tx<{ estado: EstadoLead }[]>`select estado from leads where id = ${input.leadId} for update`;
    if (!actual) return { ok: false as const, motivo: "LEAD_NO_EXISTE" };
    if (!puedeCambiarLead(actual.estado, input.estado)) return { ok: false as const, motivo: "TRANSICION_NO_PERMITIDA", desde: actual.estado };
    await tx`update leads set estado = ${input.estado} where id = ${input.leadId}`;
    return { ok: true as const, desde: actual.estado };
  });
}
