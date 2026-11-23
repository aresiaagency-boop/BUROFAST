import { createHash } from "node:crypto";
import { db } from "@/lib/db";
import type { DocumentoId } from "@/lib/diagnostico";
import { diagnosticar, DOCUMENTOS, respuestasSchema } from "@/lib/diagnostico";
import { cifrar, cifrarBytes, descifrar, descifrarBytes } from "@/lib/security/cifrado";

// Bóveda de documentos del expediente. El cliente adjunta; BUROFAST guarda
// cifrado y el equipo revisa. Reglas:
// - Solo PDF, JPEG, PNG, WEBP y HEIC, comprobados por su firma, no por lo que
//   diga el navegador.
// - 4 MB por archivo: Vercel corta el cuerpo de una petición a 4,5 MB. Las
//   fotos grandes se comprimen en el navegador antes de subir.
// - Nombre y contenido cifrados; en claro solo tipo, tamaño y huella.
// - Borrar elimina el contenido en el acto.

export const MAX_BYTES_DOCUMENTO = 4 * 1024 * 1024;
export const TIPOS_ARCHIVO = ["application/pdf", "image/jpeg", "image/png", "image/webp", "image/heic"] as const;
export type TipoArchivo = (typeof TIPOS_ARCHIVO)[number];
export const ESTADOS_DOCUMENTO_BOVEDA = ["recibido", "valido", "rechazado"] as const;
export type EstadoDocumentoBoveda = (typeof ESTADOS_DOCUMENTO_BOVEDA)[number];
export type TipoDocumentoBoveda = DocumentoId | "otro";

export function esTipoDocumento(valor: unknown): valor is TipoDocumentoBoveda {
  return valor === "otro" || (typeof valor === "string" && (DOCUMENTOS as readonly string[]).includes(valor));
}

// El tipo real del archivo, por sus primeros bytes. null = no se acepta.
export function detectarTipo(bytes: Uint8Array): TipoArchivo | null {
  const ascii = (desde: number, hasta: number) => String.fromCharCode(...bytes.subarray(desde, hasta));
  if (bytes.length < 12) return null;
  if (ascii(0, 5) === "%PDF-") return "application/pdf";
  if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return "image/jpeg";
  if (bytes[0] === 0x89 && ascii(1, 4) === "PNG") return "image/png";
  if (ascii(0, 4) === "RIFF" && ascii(8, 12) === "WEBP") return "image/webp";
  if (ascii(4, 8) === "ftyp" && /^(heic|heix|mif1|msf1|hevc)$/.test(ascii(8, 12))) return "image/heic";
  return null;
}

// Acepta cualquier forma: lo que no valida no pide documentos. Ojo: en la
// base, «situacion» está cifrada; hay que pasarla ya descifrada.
export function documentosRequeridos(respuestas: unknown): DocumentoId[] {
  const validas = respuestasSchema.safeParse(respuestas);
  return validas.success ? diagnosticar(validas.data).documentos : [];
}

export type DocumentoBoveda = {
  id: string;
  tipo: TipoDocumentoBoveda;
  nombre: string;
  mime: TipoArchivo;
  bytes: number;
  estado: EstadoDocumentoBoveda;
  nota: string | null;
  origen: "app" | "whatsapp" | "equipo";
  creadoEn: Date;
};

type Fila = Omit<DocumentoBoveda, "nombre"> & { nombreCifrado: string };
const aDocumento = ({ nombreCifrado, ...resto }: Fila): DocumentoBoveda => {
  let nombre = "documento";
  try {
    nombre = descifrar(nombreCifrado);
  } catch {
    // Un nombre ilegible no impide ver que el documento existe.
  }
  return { ...resto, nombre };
};

export async function documentosDeLeads(leadIds: string[]) {
  if (leadIds.length === 0) return new Map<string, DocumentoBoveda[]>();
  const filas = await db()<(Fila & { leadId: string })[]>`
    select id, lead_id as "leadId", tipo, nombre_cifrado as "nombreCifrado", mime, bytes, estado, nota, origen, creado_en as "creadoEn"
    from documentos where lead_id in ${db()(leadIds)} and borrado_en is null order by creado_en desc
  `;
  const porLead = new Map<string, DocumentoBoveda[]>();
  for (const { leadId, ...fila } of filas) porLead.set(leadId, [...(porLead.get(leadId) ?? []), aDocumento(fila)]);
  return porLead;
}

// El expediente es del cliente si su correo verificado es el de la sesión.
export async function leadDelCliente(referencia: string, emailHash: string) {
  const [fila] = await db()<{ id: string; consentido: Date | null }[]>`
    select id, documentos_consentidos_en as consentido from leads
    where referencia = ${referencia} and email_hash = ${emailHash} and email_verificado_en is not null
  `;
  return fila ?? null;
}

export async function registrarConsentimiento(leadId: string) {
  await db()`update leads set documentos_consentidos_en = coalesce(documentos_consentidos_en, now()) where id = ${leadId}`;
}

// Tope por expediente: una bóveda no es un disco duro.
export const MAX_DOCUMENTOS_EXPEDIENTE = 40;

export async function guardarDocumento(entrada: { leadId: string; tipo: TipoDocumentoBoveda; nombre: string; contenido: Uint8Array; origen: "app" | "whatsapp" | "equipo" }) {
  const mime = detectarTipo(entrada.contenido);
  if (!mime) return { ok: false as const, motivo: "tipo" as const };
  if (entrada.contenido.length > MAX_BYTES_DOCUMENTO) return { ok: false as const, motivo: "tamano" as const };
  const [{ total }] = await db()<{ total: number }[]>`select count(*)::int as total from documentos where lead_id = ${entrada.leadId} and borrado_en is null`;
  if (total >= MAX_DOCUMENTOS_EXPEDIENTE) return { ok: false as const, motivo: "limite" as const };
  const nombre = entrada.nombre.replace(/[\u0000-\u001f\u007f/\\]/g, "").trim().slice(0, 120) || "documento";
  const [fila] = await db()<{ id: string }[]>`
    insert into documentos (lead_id, tipo, nombre_cifrado, mime, bytes, sha256, contenido_cifrado, origen)
    values (${entrada.leadId}, ${entrada.tipo}, ${cifrar(nombre)}, ${mime}, ${entrada.contenido.length},
            ${createHash("sha256").update(entrada.contenido).digest("hex")}, ${cifrarBytes(entrada.contenido)}, ${entrada.origen})
    returning id
  `;
  return { ok: true as const, id: fila.id, mime };
}

// Contenido descifrado. leadId restringe al expediente del que pide (cliente);
// sin él, solo la Dirección.
export async function leerDocumento(id: string, leadId?: string) {
  const [fila] = await db()<{ leadId: string; nombreCifrado: string; mime: TipoArchivo; contenido: Buffer | null }[]>`
    select lead_id as "leadId", nombre_cifrado as "nombreCifrado", mime, contenido_cifrado as contenido
    from documentos where id = ${id} and borrado_en is null
  `;
  if (!fila?.contenido || (leadId && fila.leadId !== leadId)) return null;
  return { leadId: fila.leadId, nombre: aDocumento({ nombreCifrado: fila.nombreCifrado } as Fila).nombre, mime: fila.mime, contenido: descifrarBytes(fila.contenido) };
}

export async function borrarDocumento(id: string, leadId: string) {
  const filas = await db()`
    update documentos set borrado_en = now(), contenido_cifrado = null
    where id = ${id} and lead_id = ${leadId} and borrado_en is null returning id
  `;
  return filas.length > 0;
}

export async function revisarDocumento(id: string, estado: EstadoDocumentoBoveda, nota: string | null) {
  const filas = await db()`
    update documentos set estado = ${estado}, nota = ${nota?.slice(0, 300) ?? null}, revisado_en = now()
    where id = ${id} and borrado_en is null returning id
  `;
  return filas.length > 0;
}
