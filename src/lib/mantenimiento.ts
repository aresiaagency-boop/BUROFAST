import { db } from "@/lib/db";

// Lo que la política de privacidad promete, hecho cada noche: una solicitud
// que no se convirtió en encargo se borra a los 12 meses de enviarse (con sus
// citas, por cascada). Lo que tiene pagos se queda: es documentación contable.
// Los registros técnicos se recortan a lo que hace falta.
export async function purgar() {
  const leads = await db()<{ id: string }[]>`
    delete from leads l
    where l.estado <> 'convertido'
      and l.creado_en < now() - interval '12 months'
      and not exists (select 1 from pagos p where p.lead_id = l.id)
    returning l.id
  `;
  const turnos = await db()`delete from hestia_turnos where creado_en < now() - interval '12 months'`;
  const eventosHestia = await db()`delete from hestia_eventos where creado_en < now() - interval '12 months'`;
  // Stripe reintenta un evento durante 3 días: 90 días de memoria sobran para la idempotencia.
  const eventosStripe = await db()`delete from stripe_eventos where procesado_en < now() - interval '90 days'`;
  const limites = await db()`delete from limites where ventana_inicio < now() - interval '1 day'`;
  return {
    solicitudes: leads.length,
    turnosHestia: turnos.count,
    eventosHestia: eventosHestia.count,
    eventosStripe: eventosStripe.count,
    limites: limites.count,
  };
}
