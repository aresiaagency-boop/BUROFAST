import { z } from "zod";
import type { DocumentoId } from "@/lib/diagnostico";
import { VIGENCIA_DIAS } from "@/lib/motores";

// IRIS · la mirada del expediente. Lee el documento (IA de visión en n8n) y
// devuelve lo que ve; quien decide si queda en verde es este archivo, con
// reglas fijas que se pueden auditar. El verde de IRIS deja seguir el proceso;
// el precio solo cambia con la validación del abogado. Nunca rechaza: lo que
// no cuadra queda en ámbar y lo mira una persona.

export const CODIGOS_REVISION = ["comprobado", "ilegible", "otro_documento", "titular", "caducado", "antiguo", "sin_fecha", "no_apto", "dudoso", "sin_lectura"] as const;
export type CodigoRevision = (typeof CODIGOS_REVISION)[number];

// Antecedentes penales: datos de condenas (art. 10 RGPD). No salen hacia un
// proveedor de IA; los revisa siempre una persona.
export const TIPOS_SIN_IRIS: readonly DocumentoId[] = ["antecedentes_origen", "antecedentes_espana"];

// Documentos que siempre llevan titular: sin coincidencia comprobada, ámbar.
const CON_TITULAR: readonly DocumentoId[] = ["pasaporte", "tie_actual", "certificado_nacimiento", "ccse", "dele_a2", "padron", "padron_historico", "matricula", "resolucion_regularizacion"];
// Documentos que siempre caducan: sin fecha de caducidad visible, ámbar.
const CON_CADUCIDAD: readonly DocumentoId[] = ["pasaporte", "tie_actual"];
// Diplomas de examen: tienen que decir APTO.
const DIPLOMAS: readonly DocumentoId[] = ["ccse", "dele_a2"];

const fecha = z.string().trim().max(20).nullable();

// Lo que devuelve IRIS. El nombre del titular viene del documento y solo se
// usa aquí para compararlo: no se guarda.
export const respuestaLecturaSchema = z.object({
  tipoDetectado: z.string().trim().max(40),
  esElPedido: z.boolean(),
  confianza: z.number().min(0).max(1),
  legible: z.boolean(),
  titularDocumento: z.string().trim().max(160).nullable(),
  fechaEmision: fecha,
  fechaCaducidad: fecha,
  resultadoApto: z.boolean().nullable(),
  observacion: z.string().trim().max(300).nullable(),
});
export type RespuestaLectura = z.infer<typeof respuestaLecturaSchema>;

// Lo que se guarda (cifrado) y lo que decide: sin el nombre, con la comparación.
export const lecturaIrisSchema = respuestaLecturaSchema.omit({ titularDocumento: true }).extend({ titularCoincide: z.boolean().nullable() });
export type LecturaIris = z.infer<typeof lecturaIrisSchema>;

const palabras = (nombre: string) =>
  nombre
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .split(/[^a-zñ]+/)
    .filter((p) => p.length >= 2 && !["de", "del", "la", "las", "los", "y"].includes(p));

// El titular coincide si aparecen en el documento al menos dos palabras del
// nombre del expediente (o la única que tenga): admite orden, tildes y un solo
// apellido. Sin nombre en uno de los dos lados, no se sabe (null).
export function compararTitular(nombreExpediente: string, titularDocumento: string | null): boolean | null {
  const delExpediente = palabras(nombreExpediente);
  const delDocumento = new Set(palabras(titularDocumento ?? ""));
  if (delExpediente.length === 0 || delDocumento.size === 0) return null;
  const comunes = delExpediente.filter((p) => delDocumento.has(p)).length;
  return comunes >= Math.min(2, delExpediente.length);
}

export function evaluarLectura(respuesta: RespuestaLectura, nombreExpediente: string): LecturaIris {
  const { titularDocumento, ...resto } = respuesta;
  return { ...resto, titularCoincide: compararTitular(nombreExpediente, titularDocumento) };
}

export type Decision = { estado: "verificado" | "dudoso" | "recibido"; codigo: CodigoRevision };

const DIA_MS = 86_400_000;
const CONFIANZA_MINIMA = 0.8;

// Día de una fecha AAAA-MM-DD que exista de verdad; NaN si no (2026-13-01, 2019-02-30…).
function dia(texto: string) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(texto);
  if (!m) return Number.NaN;
  const [anio, mes, d] = [Number(m[1]), Number(m[2]), Number(m[3])];
  const ms = Date.UTC(anio, mes - 1, d);
  const real = new Date(ms);
  if (anio < 1900 || anio > 2100 || real.getUTCMonth() !== mes - 1 || real.getUTCDate() !== d) return Number.NaN;
  return ms;
}

// «Hoy» es el de Madrid: un documento que caducó ayer no sigue en verde a las 00:30.
function hoyEnMadrid(hoy: Date) {
  return dia(new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Madrid", year: "numeric", month: "2-digit", day: "2-digit" }).format(hoy));
}

export function decidirRevision(tipo: DocumentoId | "otro", lectura: LecturaIris | null, hoy = new Date()): Decision {
  if (tipo === "otro" || TIPOS_SIN_IRIS.includes(tipo) || !lectura) return { estado: "recibido", codigo: "sin_lectura" };
  if (!lectura.legible) return { estado: "dudoso", codigo: "ilegible" };
  if (!lectura.esElPedido || lectura.tipoDetectado !== tipo) return { estado: "dudoso", codigo: "otro_documento" };
  if (lectura.confianza < CONFIANZA_MINIMA) return { estado: "dudoso", codigo: "dudoso" };
  if (lectura.titularCoincide === false) return { estado: "dudoso", codigo: "titular" };
  if (lectura.titularCoincide === null && CON_TITULAR.includes(tipo)) return { estado: "dudoso", codigo: "dudoso" };

  const emision = lectura.fechaEmision ? dia(lectura.fechaEmision) : null;
  const caducidad = lectura.fechaCaducidad ? dia(lectura.fechaCaducidad) : null;
  // Una fecha que no existe es una mala lectura: mejor que lo mire alguien.
  if (Number.isNaN(emision) || Number.isNaN(caducidad)) return { estado: "dudoso", codigo: "dudoso" };
  const hoyDia = hoyEnMadrid(hoy);
  if (caducidad !== null && caducidad < hoyDia) return { estado: "dudoso", codigo: "caducado" };
  if (caducidad === null && CON_CADUCIDAD.includes(tipo)) return { estado: "dudoso", codigo: "sin_fecha" };
  if (emision !== null && emision > hoyDia + DIA_MS) return { estado: "dudoso", codigo: "dudoso" };
  const vigencia = VIGENCIA_DIAS[tipo];
  if (vigencia) {
    if (emision === null) return { estado: "dudoso", codigo: "sin_fecha" };
    if (hoyDia - emision > vigencia * DIA_MS) return { estado: "dudoso", codigo: "antiguo" };
  }
  if (DIPLOMAS.includes(tipo) && lectura.resultadoApto !== true) return { estado: "dudoso", codigo: "no_apto" };
  return { estado: "verificado", codigo: "comprobado" };
}

// HEIC no lo admite el modelo de visión: esos documentos los mira una persona.
export const MIMES_IRIS = ["application/pdf", "image/jpeg", "image/png", "image/webp"] as const;

export function irisPuedeLeer(tipo: DocumentoId | "otro", mime: string) {
  return tipo !== "otro" && !TIPOS_SIN_IRIS.includes(tipo) && (MIMES_IRIS as readonly string[]).includes(mime);
}

function urlIris() {
  const propia = process.env.IRIS_N8N_URL?.trim();
  if (propia) return propia;
  // Mismo n8n y misma credencial que el canal app de HESTIA, otra ruta.
  const hestia = process.env.HESTIA_N8N_URL?.trim();
  if (!hestia) return null;
  try {
    const url = new URL(hestia);
    url.pathname = url.pathname.replace(/[^/]+\/?$/, "burofast-iris");
    return url.toString();
  } catch {
    return null;
  }
}

export function irisConfigurado() {
  return Boolean(urlIris() && process.env.HESTIA_N8N_TOKEN?.trim());
}

const respuestaIrisSchema = z.object({ ok: z.literal(true), lectura: respuestaLecturaSchema });

// Sin respuesta válida en 25 s, null: el documento queda «recibido» y lo mira
// una persona. Un fallo de IRIS nunca bloquea la subida. A IRIS no se le manda
// el nombre de la persona: lo lee del documento y se compara aquí.
export async function leerConIris(entrada: {
  tipo: DocumentoId;
  catalogo: Record<string, string>;
  mime: string;
  contenido: Uint8Array;
}): Promise<RespuestaLectura | null> {
  const url = urlIris();
  if (!url || !irisPuedeLeer(entrada.tipo, entrada.mime)) return null;
  try {
    const respuesta = await fetch(url, {
      method: "POST",
      headers: { "content-type": "application/json", authorization: `Bearer ${process.env.HESTIA_N8N_TOKEN?.trim() ?? ""}` },
      body: JSON.stringify({
        tipoEsperado: entrada.tipo,
        catalogo: entrada.catalogo,
        mime: entrada.mime,
        base64: Buffer.from(entrada.contenido).toString("base64"),
      }),
      signal: AbortSignal.timeout(25_000),
    });
    if (!respuesta.ok) return null;
    const cuerpo: unknown = await respuesta.json();
    const datos = respuestaIrisSchema.safeParse(Array.isArray(cuerpo) ? cuerpo[0] : cuerpo);
    return datos.success ? datos.data.lectura : null;
  } catch {
    return null;
  }
}
