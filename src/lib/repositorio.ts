import { randomBytes, randomUUID } from "node:crypto";
import type { CitaId, NivelCita } from "@/lib/catalogo";
import { CITAS, presupuesto } from "@/lib/catalogo";
import type { EstadoCita } from "@/lib/citas";
import { puedeTransicionar, venceGarantiaUrgente, venceSla } from "@/lib/citas";
import type { NivelCita as Nivel } from "@/lib/catalogo";
import { db, toDatabaseJson } from "@/lib/db";
import { diagnosticar } from "@/lib/diagnostico";
import type { SolicitudLead } from "@/lib/schemas";
import { cifrar, descifrar, enmascararTelefono, hashEstable } from "@/lib/security/cifrado";

const ALFABETO = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

export function nuevaReferencia() {
  const bytes = randomBytes(6);
  return `BF-${[...bytes].map((b) => ALFABETO[b % ALFABETO.length]).join("")}`;
}

export async function crearLead(solicitud: SolicitudLead) {
  const ruta = diagnosticar(solicitud.respuestas);
  const citasCobrables = ruta.citas.filter((cita) => CITAS[cita].gestionable);
  const nivelCita = citasCobrables.length > 0 ? solicitud.nivelCita : null;
  // Guardián no se vende en protección internacional (gratuita) ni dos veces.
  const conGuardian = solicitud.conGuardian && ruta.nivel !== "N3" && ruta.producto !== "guardian";
  const importe = presupuesto({ producto: ruta.producto, citas: ruta.citas, nivelCita, conGuardian });
  const referencia = nuevaReferencia();
  const ahora = new Date();
  const telefono = solicitud.telefono;

  const lead = await db().begin(async (tx) => {
    const [fila] = await tx<{ id: string }[]>`
      insert into leads (
        referencia, origen, locale, sueno, ubicacion, situacion, tiempo, pasaporte,
        ruta_id, producto_id, nivel, nivel_cita, con_guardian, total_estimado_centimos,
        nombre_cifrado, telefono_cifrado, telefono_hash, email_cifrado,
        consentimiento_privacidad_en, consentimiento_marketing
      ) values (
        ${referencia}, 'funnel', ${solicitud.locale}, ${solicitud.respuestas.sueno}, ${solicitud.respuestas.ubicacion},
        ${solicitud.respuestas.situacion ? cifrar(solicitud.respuestas.situacion) : null}, ${solicitud.respuestas.tiempo}, ${solicitud.respuestas.pasaporte},
        ${ruta.id}, ${ruta.producto}, ${ruta.nivel}, ${nivelCita}, ${conGuardian}, ${importe.total},
        ${cifrar(solicitud.nombre)}, ${cifrar(telefono)}, ${hashEstable(telefono)},
        ${solicitud.email ? cifrar(solicitud.email) : null},
        ${ahora}, ${solicitud.consentimientoMarketing}
      )
      returning id
    `;

    if (nivelCita) {
      for (const tipo of citasCobrables) {
        const yaPosible = CITAS[tipo].momento === "ahora";
        await tx`
          insert into citas (lead_id, tipo, nivel, estado, sla_vence_en, garantia_vence_en, activada_en)
          values (${fila.id}, ${tipo}, ${nivelCita}, ${yaPosible ? "requerida" : "en_espera"},
                  ${yaPosible ? venceSla(nivelCita, ahora) : null},
                  ${yaPosible && nivelCita === "urgente" ? venceGarantiaUrgente(ahora) : null},
                  ${yaPosible ? ahora : null})
        `;
      }
    }
    return fila;
  });

  return { id: lead.id, referencia, ruta, importe, nivelCita };
}

export type FilaCita = {
  id: string;
  referencia: string;
  tipo: CitaId;
  nivel: NivelCita;
  estado: EstadoCita;
  slaVenceEn: Date | null;
  garantiaVenceEn: Date | null;
  fechaCita: Date | null;
  lugar: string | null;
  locale: string;
  creadoEn: Date;
  demo: boolean;
};

export async function listarCitas(filtro: { abiertas: boolean }) {
  const filas = await db()<FilaCita[]>`
    select c.id, l.referencia, c.tipo, c.nivel, c.estado, c.sla_vence_en as "slaVenceEn",
           c.garantia_vence_en as "garantiaVenceEn", c.fecha_cita as "fechaCita", c.lugar,
           l.locale, c.creado_en as "creadoEn", c.demo
    from citas c join leads l on l.id = c.lead_id
    where (${!filtro.abiertas} or c.estado not in ('asistida', 'cancelada', 'sin_cita_reembolso'))
    order by case when c.estado = 'en_espera' then 1 else 0 end, case c.nivel when 'urgente' then 0 else 1 end, c.sla_vence_en asc nulls last
    limit 200
  `;
  return filas;
}

export type FilaLead = {
  id: string;
  referencia: string;
  nombre: string;
  telefono: string;
  locale: string;
  rutaId: string;
  productoId: string;
  nivel: string;
  nivelCita: string | null;
  totalCentimos: number;
  estado: string;
  creadoEn: Date;
  demo: boolean;
};

export async function listarLeads(): Promise<FilaLead[]> {
  const filas = await db()<
    {
      id: string; referencia: string; nombre_cifrado: string; telefono_cifrado: string; locale: string;
      ruta_id: string; producto_id: string; nivel: string; nivel_cita: string | null;
      total_estimado_centimos: number; estado: string; creado_en: Date; demo: boolean;
    }[]
  >`
    select id, referencia, nombre_cifrado, telefono_cifrado, locale, ruta_id, producto_id, nivel,
           nivel_cita, total_estimado_centimos, estado, creado_en, demo
    from leads order by creado_en desc limit 200
  `;
  // El centro de mando ve el nombre y un teléfono enmascarado; el número
  // completo solo se descifra cuando hay que contactar (fase 2, con auditoría).
  return filas.map((fila) => ({
    id: fila.id,
    referencia: fila.referencia,
    nombre: descifrar(fila.nombre_cifrado),
    telefono: enmascararTelefono(descifrar(fila.telefono_cifrado)),
    locale: fila.locale,
    rutaId: fila.ruta_id,
    productoId: fila.producto_id,
    nivel: fila.nivel,
    nivelCita: fila.nivel_cita,
    totalCentimos: fila.total_estimado_centimos,
    estado: fila.estado,
    creadoEn: fila.creado_en,
    demo: fila.demo,
  }));
}

export async function resumenOperativo() {
  const [leads] = await db()<{ total: number; semana: number; demo: number }[]>`
    select count(*)::int as total,
           count(*) filter (where creado_en > now() - interval '7 days')::int as semana,
           count(*) filter (where demo)::int as demo
    from leads
  `;
  const [citas] = await db()<{ urgentes: number; esperan: number; vencidas: number; reservadas: number; enEspera: number }[]>`
    select count(*) filter (where nivel = 'urgente' and estado in ('requerida', 'en_gestion', 'reprogramar'))::int as urgentes,
           count(*) filter (where estado = 'en_espera')::int as "enEspera",
           count(*) filter (where nivel = 'puede_esperar' and estado in ('requerida', 'en_gestion', 'reprogramar'))::int as esperan,
           count(*) filter (where estado in ('requerida', 'en_gestion', 'reprogramar') and sla_vence_en < now())::int as vencidas,
           count(*) filter (where estado in ('reservada', 'confirmada'))::int as reservadas
    from citas
  `;
  const rutas = await db()<{ rutaId: string; total: number }[]>`
    select ruta_id as "rutaId", count(*)::int as total from leads
    group by ruta_id order by total desc limit 5
  `;
  const [hestia] = await db()<{ entrantes: number; escalados: number; ultimo: Date | null }[]>`
    select count(*) filter (where tipo = 'mensaje_entrante' and creado_en > now() - interval '24 hours')::int as entrantes,
           count(*) filter (where tipo = 'escalado_humano' and creado_en > now() - interval '24 hours')::int as escalados,
           max(creado_en) as ultimo
    from hestia_eventos
  `;
  return { leads, citas, rutas, hestia, consultadoEn: new Date() };
}

export async function cambiarEstadoCita(input: {
  citaId: string;
  estado: EstadoCita;
  fechaCita?: string | null;
  lugar?: string | null;
  nota?: string;
  actor: string;
}) {
  return db().begin(async (tx) => {
    const [actual] = await tx<{ estado: EstadoCita; nivel: Nivel }[]>`select estado, nivel from citas where id = ${input.citaId} for update`;
    if (!actual) return { ok: false as const, motivo: "CITA_NO_EXISTE" };
    if (!puedeTransicionar(actual.estado, input.estado, actual.nivel)) {
      return { ok: false as const, motivo: "TRANSICION_NO_PERMITIDA", desde: actual.estado };
    }
    // Al activar una cita en espera empiezan a contar su plazo y su garantía.
    const activar = actual.estado === "en_espera" && input.estado === "requerida";
    const ahora = new Date();
    await tx`
      update citas set estado = ${input.estado},
        fecha_cita = coalesce(${input.fechaCita ?? null}::timestamptz, fecha_cita),
        lugar = coalesce(${input.lugar ?? null}, lugar),
        sla_vence_en = case when ${activar} then ${venceSla(actual.nivel, ahora)}::timestamptz else sla_vence_en end,
        garantia_vence_en = case when ${activar && actual.nivel === "urgente"} then ${venceGarantiaUrgente(ahora)}::timestamptz else garantia_vence_en end,
        activada_en = case when ${activar} then ${ahora}::timestamptz else activada_en end,
        actualizado_en = now()
      where id = ${input.citaId}
    `;
    await tx`
      insert into cita_eventos (cita_id, estado_anterior, estado_nuevo, actor, nota)
      values (${input.citaId}, ${actual.estado}, ${input.estado}, ${input.actor}, ${input.nota ?? null})
    `;
    return { ok: true as const, desde: actual.estado };
  });
}

export async function registrarEventoHestia(evento: {
  mensajeId: string;
  tipo: string;
  locale?: string | null;
  telefono?: string | null;
}) {
  const filas = await db()`
    insert into hestia_eventos (mensaje_id, tipo, locale, telefono_hash)
    values (${evento.mensajeId}, ${evento.tipo}, ${evento.locale ?? null},
            ${evento.telefono ? hashEstable(evento.telefono) : null})
    on conflict (mensaje_id) do nothing
    returning id
  `;
  return { duplicado: filas.length === 0 };
}

export async function auditar(entrada: {
  actorId: string;
  accion: string;
  objetivoId?: string | null;
  parametros?: Record<string, unknown>;
  resultado: "ok" | "rechazado" | "error";
  correlationId?: string;
}) {
  const correlationId = entrada.correlationId ?? randomUUID();
  try {
    await db()`
      insert into audit_logs (actor_id, accion, objetivo_id, parametros_redactados, resultado, correlation_id)
      values (${entrada.actorId}, ${entrada.accion}, ${entrada.objetivoId ?? null},
              ${db().json(toDatabaseJson(entrada.parametros ?? {}))}, ${entrada.resultado}, ${correlationId})
    `;
  } catch {
    // La auditoría nunca debe tumbar la operación que audita; el fallo queda
    // en el log estructurado del servidor con su correlation_id.
    console.error(JSON.stringify({ nivel: "error", evento: "audit_write_failed", correlationId, accion: entrada.accion }));
  }
  return correlationId;
}

export async function ultimasAuditorias() {
  return db()<{ id: number; actorId: string; accion: string; resultado: string; creadoEn: Date; correlationId: string }[]>`
    select id, actor_id as "actorId", accion, resultado, creado_en as "creadoEn", correlation_id as "correlationId"
    from audit_logs order by creado_en desc limit 20
  `;
}
