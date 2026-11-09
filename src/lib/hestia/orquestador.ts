import { createHash } from "node:crypto";
import { z } from "zod";
import { urlBase } from "@/lib/auth/base";
import type { NivelCita } from "@/lib/catalogo";
import { CITAS, formatearEuros, presupuesto } from "@/lib/catalogo";
import { db, isDatabaseConfigured } from "@/lib/db";
import type { Ruta } from "@/lib/diagnostico";
import type { Expediente } from "@/lib/expediente";
import type { RespuestaHestia } from "@/lib/hestia/local";
import { detectarIntencion } from "@/lib/hestia/intenciones";
import { responderLocal } from "@/lib/hestia/local";
import { DICCIONARIOS } from "@/lib/i18n";
import type { Locale } from "@/lib/i18n/locales";
import { ETIQUETA_INTL } from "@/lib/i18n/locales";
import type { MotorId } from "@/lib/motores";
import { AGENTES, MOTORES, REGLAS_TEMIS } from "@/lib/motores";

// HESTIA orquesta: recibe el mensaje, le da a la IA (n8n) el contexto justo de
// ESTE usuario y deja que consulte a los motores. El backend es la puerta: el
// navegador nunca llama a n8n ni ve sus credenciales. Si n8n no está o falla,
// responde el modo local, y se dice.

export type EntradaConversacion = {
  locale: Locale;
  conversacion: string;
  mensaje: string;
  motor: MotorId | null;
  ruta: Ruta | null;
  nivelCita: NivelCita | null;
  conGuardian: boolean;
  expedientes: Expediente[] | null;
};

export type SalidaConversacion = RespuestaHestia & { modo: "ia" | "local" };

export function n8nHestiaConfigurado() {
  return Boolean(process.env.HESTIA_N8N_URL?.trim() && process.env.HESTIA_N8N_TOKEN?.trim());
}

// Lo que n8n puede devolver. Se acepta también la salida por defecto del nodo
// AI Agent ({ output }) para que un flujo recién importado funcione. El nodo
// «Salida app» manda null en lo que no aplica (sin motor, sin agente): null
// es válido; solo la falta de texto hace caer al modo local.
export const respuestaN8nSchema = z
  .object({
    respuesta: z.string().trim().min(1).max(6000).nullish(),
    output: z.string().trim().min(1).max(6000).nullish(),
    agente: z.string().trim().toUpperCase().nullish(),
    motor: z.string().trim().toLowerCase().nullish(),
    escalar: z.boolean().nullish(),
  })
  .refine((r) => Boolean(r.respuesta ?? r.output), { message: "SIN_TEXTO" });

// Traduce el cuerpo que devuelve n8n a una respuesta de HESTIA. Lanza si no
// trae texto: entonces responde el modo local.
export function interpretarRespuestaN8n(cuerpo: unknown): RespuestaHestia {
  // n8n a veces envuelve la respuesta en un array.
  const datos = respuestaN8nSchema.parse(Array.isArray(cuerpo) ? cuerpo[0] : cuerpo);
  const textoBruto = datos.respuesta ?? datos.output ?? "";
  const agente = (AGENTES as readonly string[]).includes(datos.agente ?? "") ? (datos.agente as RespuestaHestia["agente"]) : "HESTIA";
  const motor = (MOTORES as readonly string[]).includes(datos.motor ?? "") ? (datos.motor as MotorId) : null;
  return { texto: limpiar(textoBruto), agente, motor, escalar: Boolean(datos.escalar) || textoBruto.includes("[[ESCALAR]]") };
}

function limpiar(texto: string) {
  // La respuesta se pinta como texto, nunca como HTML; aun así se quitan
  // marcas internas y se acota la longitud.
  return texto.replace(/\[\[ESCALAR\]\]/g, "").replace(/\u0000/g, "").trim().slice(0, 4000);
}

export function construirContexto(entrada: EntradaConversacion) {
  const t = DICCIONARIOS.es;
  const euros = (c: number) => formatearEuros(c, ETIQUETA_INTL.es);
  const base = urlBase();
  const enlace = (ruta: string) => (base ? `${base}/${entrada.locale}${ruta}` : null);
  const ruta = entrada.ruta;
  const importe = ruta
    ? presupuesto({ producto: ruta.producto, citas: ruta.citas, nivelCita: entrada.nivelCita, conGuardian: entrada.conGuardian })
    : null;
  return {
    canal: "app" as const,
    idioma: entrada.locale,
    motorActual: entrada.motor,
    // Datos del camino que el usuario ha recorrido en este navegador. Sin
    // nombre, teléfono ni correo.
    ruta: ruta && importe
      ? {
          id: ruta.id,
          nombre: t.rutas[ruta.id].nombre,
          nivel: ruta.nivel,
          producto: t.productos[ruta.producto],
          etapa: t.etapas[ruta.etapaActual],
          siguiente: ruta.siguiente ? t.rutas[ruta.siguiente].nombre : null,
          documentos: ruta.documentos.map((d) => t.documentos[d]),
          citas: ruta.citas.map((c) => ({ nombre: t.citas[c].nombre, gestionable: CITAS[c].gestionable, cuando: t.citas[c].cuando })),
          avisos: ruta.avisos.map((a) => t.avisos[a]),
          nivelCita: entrada.nivelCita,
          presupuesto: ruta.nivel === "N3" ? "gratuito" : { total: euros(importe.total), anticipo: euros(importe.alEncargo), alPresentar: euros(importe.alPresentar) },
        }
      : null,
    // Solo si el cliente ha entrado con Google: sus expedientes, resumidos.
    expedientes: entrada.expedientes?.map((e) => ({
      referencia: e.referencia,
      ruta: t.rutas[e.rutaId].nombre,
      estado: e.estado,
      total: euros(e.totalCentimos),
      pagado: euros(e.pagadoCentimos),
      citas: e.citas.map((c) => ({ cita: t.citas[c.tipo].nombre, estado: c.estado, fecha: c.fechaCita?.toISOString() ?? null })),
    })) ?? null,
    reglas: REGLAS_TEMIS.map((r) => t.temis[r]),
    enlaces: {
      camino: enlace("/camino"),
      citas: enlace("/citas"),
      documentos: enlace("/documentos"),
      guardian: enlace("/guardian"),
      expediente: enlace("/expediente"),
    },
  };
}

async function preguntarN8n(entrada: EntradaConversacion): Promise<RespuestaHestia> {
  const url = process.env.HESTIA_N8N_URL?.trim() ?? "";
  const respuesta = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json", authorization: `Bearer ${process.env.HESTIA_N8N_TOKEN?.trim() ?? ""}` },
    body: JSON.stringify({
      canal: "app",
      // La memoria de la conversación en n8n se separa por canal y por id.
      sesion: `app:${entrada.conversacion}`,
      idioma: entrada.locale,
      mensaje: entrada.mensaje,
      motor: entrada.motor,
      contexto: construirContexto(entrada),
    }),
    signal: AbortSignal.timeout(28_000),
    cache: "no-store",
  });
  if (!respuesta.ok) throw new Error(`N8N_HTTP_${respuesta.status}`);
  return interpretarRespuestaN8n(await respuesta.json());
}

async function registrarTurno(turno: { conversacion: string; agente: string; motor: string | null; modo: "ia" | "local"; ok: boolean; escalado: boolean; latenciaMs: number; locale: string }) {
  if (!isDatabaseConfigured()) return;
  try {
    await db()`
      insert into hestia_turnos (canal, conversacion_hash, agente, motor, modo, ok, escalado, latencia_ms, locale)
      values ('app', ${createHash("sha256").update(turno.conversacion).digest("hex").slice(0, 32)}, ${turno.agente}, ${turno.motor},
              ${turno.modo}, ${turno.ok}, ${turno.escalado}, ${turno.latenciaMs}, ${turno.locale})
    `;
  } catch {
    // Las métricas nunca tumban una conversación.
  }
}

export async function conversar(entrada: EntradaConversacion): Promise<SalidaConversacion> {
  const inicio = performance.now();
  let salida: SalidaConversacion;
  let ok = true;
  if (n8nHestiaConfigurado()) {
    try {
      salida = { ...(await preguntarN8n(entrada)), modo: "ia" };
    } catch (fallo) {
      ok = false;
      console.warn(JSON.stringify({ nivel: "warn", evento: "hestia_n8n_fallo", motivo: fallo instanceof Error ? fallo.message.slice(0, 80) : "desconocido" }));
      salida = { ...responderLocal(entrada), modo: "local" };
    }
  } else {
    salida = { ...responderLocal(entrada), modo: "local" };
  }
  // Red de seguridad determinista, con IA o sin ella: asilo y «quiero una
  // persona» siempre pasan a una persona, diga lo que diga el modelo.
  const intencion = detectarIntencion(entrada.mensaje);
  if (intencion === "asilo" || intencion === "humano") salida = { ...salida, escalar: true };
  await registrarTurno({
    conversacion: entrada.conversacion,
    agente: salida.agente,
    motor: salida.motor,
    modo: salida.modo,
    ok,
    escalado: salida.escalar,
    latenciaMs: Math.round(performance.now() - inicio),
    locale: entrada.locale,
  });
  return salida;
}
