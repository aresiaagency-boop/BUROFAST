import { z } from "zod";
import { sesionClienteActual } from "@/lib/auth/cliente";
import { NIVELES_CITA } from "@/lib/catalogo";
import { isDatabaseConfigured } from "@/lib/db";
import { respuestasSchema } from "@/lib/diagnostico";
import { diagnosticar } from "@/lib/diagnostico";
import type { Expediente } from "@/lib/expediente";
import { expedientesDeCliente } from "@/lib/expediente";
import { correlationId, error, ipCliente, json, log, origenPermitido } from "@/lib/http";
import { conversar } from "@/lib/hestia/orquestador";
import { LOCALES } from "@/lib/i18n/locales";
import { MOTORES } from "@/lib/motores";
import { limitar } from "@/lib/security/limites";

// La IA puede tardar: margen holgado para la respuesta de n8n (28 s).
export const maxDuration = 45;

const nivelesCita = Object.keys(NIVELES_CITA) as [keyof typeof NIVELES_CITA, ...(keyof typeof NIVELES_CITA)[]];

const entradaSchema = z.object({
  locale: z.enum(LOCALES),
  conversacion: z.string().trim().min(8).max(64).regex(/^[\w-]+$/),
  mensaje: z.string().trim().min(1).max(1000),
  motor: z.enum(MOTORES).nullable().optional(),
  camino: z
    .object({
      respuestas: z.record(z.string(), z.unknown()).optional(),
      nivelCita: z.enum(nivelesCita).nullable().optional(),
      conGuardian: z.boolean().optional(),
    })
    .optional(),
});

export async function POST(request: Request) {
  const correlation = correlationId(request);
  if (!origenPermitido(request)) return error("ORIGEN_NO_PERMITIDO", "La petición no viene de BUROFAST.", { status: 403, correlation });

  const porIp = await limitar(`hestia:${ipCliente(request)}`, { limite: 30, ventanaMs: 10 * 60_000 });
  if (!porIp.permitido) return error("DEMASIADAS_PETICIONES", "Demasiados mensajes seguidos.", { status: 429, correlation });

  const entrada = entradaSchema.safeParse(await request.json().catch(() => null));
  if (!entrada.success) return error("MENSAJE_INVALIDO", "El mensaje no tiene el formato esperado.", { status: 400, correlation });

  const porConversacion = await limitar(`hestia-conv:${entrada.data.conversacion}`, { limite: 120, ventanaMs: 24 * 60 * 60_000 });
  if (!porConversacion.permitido) return error("DEMASIADAS_PETICIONES", "Esta conversación ha llegado a su límite diario.", { status: 429, correlation });

  // La ruta se recalcula aquí con el motor determinista: el navegador manda
  // respuestas, nunca una ruta ni un precio.
  const respuestas = respuestasSchema.safeParse(entrada.data.camino?.respuestas ?? {});
  const ruta = respuestas.success ? diagnosticar(respuestas.data) : null;

  let expedientes: Expediente[] | null = null;
  const cliente = await sesionClienteActual();
  if (cliente && isDatabaseConfigured()) {
    try {
      expedientes = await expedientesDeCliente(cliente.emailHash);
    } catch {
      expedientes = null;
    }
  }

  const salida = await conversar({
    locale: entrada.data.locale,
    conversacion: entrada.data.conversacion,
    mensaje: entrada.data.mensaje,
    motor: entrada.data.motor ?? null,
    ruta,
    nivelCita: entrada.data.camino?.nivelCita ?? null,
    conGuardian: Boolean(entrada.data.camino?.conGuardian),
    expedientes,
  });
  log("info", "hestia_turno", { correlation, modo: salida.modo, agente: salida.agente, escalar: salida.escalar });
  return json(salida, { correlation });
}
