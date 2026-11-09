import type { TransactionSql } from "postgres";
import { db } from "@/lib/db";
import { descifrar } from "@/lib/security/cifrado";

export type TipoPago = "anticipo" | "resto";
export type EstadoPago = "pendiente" | "pagado" | "fallido" | "expirado" | "reembolsado";

export type LeadPagable = {
  id: string;
  referencia: string;
  locale: string;
  productoId: string;
  rutaId: string;
  nivel: string;
  totalCentimos: number;
  email: string | null;
  emailHash: string | null;
  estado: string;
};

type FilaLead = {
  id: string; referencia: string; locale: string; producto_id: string; ruta_id: string; nivel: string;
  total_estimado_centimos: number; email_cifrado: string | null; email_hash: string | null; estado: string;
};

function aLeadPagable(fila: FilaLead): LeadPagable {
  let email: string | null = null;
  try {
    email = fila.email_cifrado ? descifrar(fila.email_cifrado) : null;
  } catch {
    email = null;
  }
  return {
    id: fila.id, referencia: fila.referencia, locale: fila.locale, productoId: fila.producto_id, rutaId: fila.ruta_id,
    nivel: fila.nivel, totalCentimos: fila.total_estimado_centimos, email, emailHash: fila.email_hash, estado: fila.estado,
  };
}

export async function leadPagablePorId(id: string) {
  const [fila] = await db()<FilaLead[]>`
    select id, referencia, locale, producto_id, ruta_id, nivel, total_estimado_centimos, email_cifrado, email_hash, estado
    from leads where id = ${id}
  `;
  return fila ? aLeadPagable(fila) : null;
}

export async function leadPagablePorReferencia(referencia: string, emailHash: string) {
  const [fila] = await db()<FilaLead[]>`
    select id, referencia, locale, producto_id, ruta_id, nivel, total_estimado_centimos, email_cifrado, email_hash, estado
    from leads where referencia = ${referencia} and email_hash = ${emailHash} and email_verificado_en is not null
  `;
  return fila ? aLeadPagable(fila) : null;
}

// El anticipo es la mitad del total, redondeada hacia abajo: la misma regla
// que enseña el plan (catalogo.presupuesto → alEncargo).
export function importeDe(tipo: TipoPago, totalCentimos: number) {
  const anticipo = Math.floor(totalCentimos / 2);
  return tipo === "anticipo" ? anticipo : totalCentimos - anticipo;
}

export async function yaPagado(leadId: string, tipo: TipoPago) {
  const [fila] = await db()<{ n: number }[]>`
    select count(*)::int as n from pagos where lead_id = ${leadId} and tipo = ${tipo} and estado = 'pagado'
  `;
  return fila.n > 0;
}

// Una sesión de Checkout abierta y con margen se reutiliza: dos clics no abren
// dos cobros.
export async function sesionAbierta(leadId: string, tipo: TipoPago) {
  const [fila] = await db()<{ url: string; sessionId: string }[]>`
    select checkout_url as url, stripe_session_id as "sessionId" from pagos
    where lead_id = ${leadId} and tipo = ${tipo} and estado = 'pendiente'
      and checkout_url is not null and expira_en > now() + interval '10 minutes'
    order by creado_en desc limit 1
  `;
  return fila ?? null;
}

export async function registrarPendiente(p: {
  leadId: string; tipo: TipoPago; importe: number; modo: "live" | "test"; sessionId: string; url: string; expiraEn: Date; condicionesVersion: string;
}) {
  await db()`
    insert into pagos (lead_id, tipo, importe_centimos, modo, stripe_session_id, checkout_url, expira_en, condiciones_version)
    values (${p.leadId}, ${p.tipo}, ${p.importe}, ${p.modo}, ${p.sessionId}, ${p.url}, ${p.expiraEn}, ${p.condicionesVersion})
    on conflict (stripe_session_id) do nothing
  `;
}

// Pagos con Checkout abierto de un expediente: hay que cerrarlos si el
// expediente deja de estar aprobado.
export async function sesionesPendientes(leadId: string) {
  return db()<{ sessionId: string }[]>`
    select stripe_session_id as "sessionId" from pagos
    where lead_id = ${leadId} and estado = 'pendiente' and stripe_session_id is not null
  `;
}

export async function marcarExpirado(sessionId: string) {
  await db()`update pagos set estado = 'expirado', actualizado_en = now() where stripe_session_id = ${sessionId} and estado = 'pendiente'`;
}

// ¿Este payment_intent es de un cobro nuestro? Los reembolsos de otras apps
// de la cuenta no deben dejar rastro aquí.
export async function existePagoConIntento(paymentIntent: string) {
  const [fila] = await db()<{ existe: boolean }[]>`select exists(select 1 from pagos where stripe_payment_intent = ${paymentIntent}) as existe`;
  return Boolean(fila?.existe);
}

// Aplica lo que dice Stripe. Nunca rebaja un pago ya «pagado» (un evento
// tardío de expiración no deshace un cobro).
export async function aplicarResultado(
  tx: TransactionSql,
  r: { sessionId: string; estado: Exclude<EstadoPago, "pendiente" | "reembolsado">; paymentIntent: string | null },
) {
  const filas = await tx<{ leadId: string; tipo: TipoPago }[]>`
    update pagos set
      estado = ${r.estado},
      stripe_payment_intent = coalesce(${r.paymentIntent}, stripe_payment_intent),
      pagado_en = case when ${r.estado} = 'pagado' then coalesce(pagado_en, now()) else pagado_en end,
      actualizado_en = now()
    where stripe_session_id = ${r.sessionId} and estado in ('pendiente', 'fallido', 'expirado')
      and not (${r.estado} = 'expirado' and estado = 'fallido')
    returning lead_id as "leadId", tipo
  `;
  const fila = filas[0];
  if (fila && r.estado === "pagado" && fila.tipo === "anticipo") {
    // Solo un expediente aprobado por el abogado pasa a «convertido». Un pago
    // que llega en otro estado (un Checkout que no se pudo cerrar a tiempo) se
    // queda pagado y el centro de mando lo marca para revisar o devolver.
    await tx`update leads set estado = 'convertido' where id = ${fila.leadId} and estado = 'aprobado'`;
  }
  return fila ?? null;
}

export async function marcarReembolsado(tx: TransactionSql, paymentIntent: string) {
  const filas = await tx<{ leadId: string }[]>`
    update pagos set estado = 'reembolsado', actualizado_en = now()
    where stripe_payment_intent = ${paymentIntent} and estado = 'pagado'
    returning lead_id as "leadId"
  `;
  return filas[0] ?? null;
}

// true si el evento es nuevo (hay que procesarlo); false si ya se procesó.
export async function registrarEventoStripe(tx: TransactionSql, id: string, tipo: string) {
  const filas = await tx`insert into stripe_eventos (id, tipo) values (${id}, ${tipo}) on conflict (id) do nothing returning id`;
  return filas.length > 0;
}

export async function pagoPorSesion(sessionId: string) {
  const [fila] = await db()<{ estado: EstadoPago; importe: number; referencia: string; tipo: TipoPago; locale: string }[]>`
    select p.estado, p.importe_centimos as importe, l.referencia, p.tipo, l.locale
    from pagos p join leads l on l.id = p.lead_id where p.stripe_session_id = ${sessionId}
  `;
  return fila ?? null;
}

export type FilaPago = {
  id: string; referencia: string; tipo: TipoPago; importe: number; estado: EstadoPago; modo: string;
  sessionId: string | null; creadoEn: Date; pagadoEn: Date | null; duplicado: boolean; sinAprobacion: boolean;
};

export async function listarPagos(): Promise<FilaPago[]> {
  return db()<FilaPago[]>`
    select p.id, l.referencia, p.tipo, p.importe_centimos as importe, p.estado, p.modo,
           p.stripe_session_id as "sessionId", p.creado_en as "creadoEn", p.pagado_en as "pagadoEn",
           (p.estado = 'pagado' and (select count(*) from pagos q where q.lead_id = p.lead_id and q.tipo = p.tipo and q.estado = 'pagado') > 1) as duplicado,
           (p.estado = 'pagado' and p.tipo = 'anticipo' and l.estado <> 'convertido') as "sinAprobacion"
    from pagos p join leads l on l.id = p.lead_id
    order by p.creado_en desc limit 200
  `;
}

export async function resumenPagos() {
  const [fila] = await db()<{ cobradoHoy: number; cobradoMes: number; pendientes: number; pagados: number; ultimoEvento: Date | null }[]>`
    select
      coalesce(sum(importe_centimos) filter (where estado = 'pagado' and pagado_en >= date_trunc('day', now())), 0)::int as "cobradoHoy",
      coalesce(sum(importe_centimos) filter (where estado = 'pagado' and pagado_en >= date_trunc('month', now())), 0)::int as "cobradoMes",
      count(*) filter (where estado = 'pendiente')::int as pendientes,
      count(*) filter (where estado = 'pagado')::int as pagados,
      (select max(procesado_en) from stripe_eventos) as "ultimoEvento"
    from pagos
  `;
  return fila;
}

export async function pagosDeLeads(leadIds: string[]) {
  if (leadIds.length === 0) return [];
  return db()<{ leadId: string; tipo: TipoPago; importe: number; estado: EstadoPago; pagadoEn: Date | null; creadoEn: Date }[]>`
    select lead_id as "leadId", tipo, importe_centimos as importe, estado, pagado_en as "pagadoEn", creado_en as "creadoEn"
    from pagos where lead_id in ${db()(leadIds)} order by creado_en desc
  `;
}
