import { z } from "zod";
import { CITAS, NIVELES_CITA } from "@/lib/catalogo";
import { respuestasSchema } from "@/lib/diagnostico";
import { LOCALES } from "@/lib/i18n/locales";

const citaIds = Object.keys(CITAS) as [keyof typeof CITAS, ...(keyof typeof CITAS)[]];
const nivelesCita = Object.keys(NIVELES_CITA) as [keyof typeof NIVELES_CITA, ...(keyof typeof NIVELES_CITA)[]];

// Fuera de España no hay situación ni tiempo; en España, ambos son obligatorios.
export function respuestasCoherentes(r: { ubicacion: string; situacion: string | null; tiempo: string | null }) {
  return (r.ubicacion === "fuera") === (r.situacion === null && r.tiempo === null);
}

// Teléfono en formato internacional: prefijo + 8 a 15 dígitos (E.164).
export const telefonoSchema = z
  .string()
  .trim()
  .transform((valor) => valor.replace(/[\s().-]/g, ""))
  .pipe(z.string().regex(/^\+[1-9]\d{7,14}$/, "TELEFONO_FORMATO"));

// Lo que envía el funnel. La ruta NO viaja desde el navegador: el servidor la
// recalcula con las respuestas, para que nadie pueda fijarse un precio.
export const solicitudLeadSchema = z.object({
  locale: z.enum(LOCALES),
  respuestas: respuestasSchema,
  nivelCita: z.enum(nivelesCita).nullable(),
  conGuardian: z.boolean(),
  nombre: z.string().trim().min(2).max(80),
  telefono: telefonoSchema,
  email: z.union([z.literal(""), z.string().trim().email().max(120)]).optional(),
  consentimientoPrivacidad: z.literal(true),
  consentimientoMarketing: z.boolean(),
  // Campo trampa para bots: un humano nunca lo ve. Si llega relleno, la API
  // responde como si todo fuera bien y no guarda nada (ver /api/v1/leads).
  web: z.string().max(200).optional(),
}).refine((s) => respuestasCoherentes(s.respuestas), { path: ["respuestas"], message: "RESPUESTAS_INCOHERENTES" });

export type SolicitudLead = z.infer<typeof solicitudLeadSchema>;

export const cambioEstadoCitaSchema = z.object({
  estado: z.enum(["en_espera", "requerida", "en_gestion", "reservada", "confirmada", "asistida", "reprogramar", "cancelada", "sin_cita_reembolso"]),
  fechaCita: z.iso.datetime().nullable().optional(),
  lugar: z.string().trim().max(160).nullable().optional(),
  nota: z.string().trim().max(500).optional(),
}).refine((c) => c.estado !== "reservada" || Boolean(c.fechaCita), { path: ["fechaCita"], message: "RESERVADA_SIN_FECHA" });

export const eventoHestiaSchema = z.object({
  mensajeId: z.string().min(1).max(120),
  tipo: z.enum(["mensaje_entrante", "respuesta_enviada", "escalado_humano", "enlace_funnel"]),
  locale: z.enum(LOCALES).nullable().optional(),
  telefono: telefonoSchema.nullable().optional(),
});

export { citaIds };
