import type { CitaId, NivelCita } from "@/lib/catalogo";
import type { EstadoCita } from "@/lib/citas";
import { db } from "@/lib/db";
import type { RutaId } from "@/lib/diagnostico";
import type { EstadoPago, TipoPago } from "@/lib/pagos/repositorio";

// «Mi expediente»: lo que el cliente ve de lo suyo. Se busca SOLO por el hash
// del correo verificado por Google; nunca por referencia suelta.

export const ESTADOS_LEAD = ["nuevo", "contactado", "revision_abogado", "aprobado", "convertido", "descartado"] as const;
export type EstadoLead = (typeof ESTADOS_LEAD)[number];

export type CitaExpediente = { tipo: CitaId; nivel: NivelCita; estado: EstadoCita; slaVenceEn: Date | null; fechaCita: Date | null; lugar: string | null };
export type PagoExpediente = { tipo: TipoPago; importe: number; estado: EstadoPago; pagadoEn: Date | null };
export type Expediente = {
  id: string;
  referencia: string;
  locale: string;
  rutaId: RutaId;
  productoId: string;
  nivel: string;
  nivelCita: NivelCita | null;
  conGuardian: boolean;
  totalCentimos: number;
  estado: EstadoLead;
  creadoEn: Date;
  citas: CitaExpediente[];
  pagos: PagoExpediente[];
  pagadoCentimos: number;
};

export async function expedientesDeCliente(emailHash: string): Promise<Expediente[]> {
  const leads = await db()<Omit<Expediente, "citas" | "pagos" | "pagadoCentimos">[]>`
    select id, referencia, locale, ruta_id as "rutaId", producto_id as "productoId", nivel, nivel_cita as "nivelCita",
           con_guardian as "conGuardian", total_estimado_centimos as "totalCentimos", estado, creado_en as "creadoEn"
    from leads where email_hash = ${emailHash} order by creado_en desc limit 10
  `;
  if (leads.length === 0) return [];
  const ids = leads.map((l) => l.id);
  const citas = await db()<(CitaExpediente & { leadId: string })[]>`
    select lead_id as "leadId", tipo, nivel, estado, sla_vence_en as "slaVenceEn", fecha_cita as "fechaCita", lugar
    from citas where lead_id in ${db()(ids)} order by creado_en
  `;
  const pagos = await db()<(PagoExpediente & { leadId: string })[]>`
    select lead_id as "leadId", tipo, importe_centimos as importe, estado, pagado_en as "pagadoEn"
    from pagos where lead_id in ${db()(ids)} order by creado_en desc
  `;
  return leads.map((lead) => {
    const susPagos = pagos.filter((p) => p.leadId === lead.id);
    return {
      ...lead,
      citas: citas.filter((c) => c.leadId === lead.id),
      pagos: susPagos,
      pagadoCentimos: susPagos.filter((p) => p.estado === "pagado").reduce((suma, p) => suma + p.importe, 0),
    };
  });
}
