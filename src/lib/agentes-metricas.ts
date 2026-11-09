import { db } from "@/lib/db";

// Lo que ha hecho cada agente en los últimos 7 días (canal app). Sin textos:
// solo turnos, cuántos con IA, escalados y latencia media.
export type MetricaAgente = { agente: string; turnos: number; ia: number; escalados: number; latencia: number };

export async function metricasAgentes(): Promise<Record<string, MetricaAgente>> {
  const filas = await db()<MetricaAgente[]>`
    select agente,
           count(*)::int as turnos,
           count(*) filter (where modo = 'ia')::int as ia,
           count(*) filter (where escalado)::int as escalados,
           coalesce(round(avg(latencia_ms)), 0)::int as latencia
    from hestia_turnos
    where creado_en > now() - interval '7 days'
    group by agente
  `;
  return Object.fromEntries(filas.map((f) => [f.agente, f]));
}
