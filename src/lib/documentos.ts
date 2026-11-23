import { createHash } from "node:crypto";
import { db } from "@/lib/db";
import type { DocumentoId } from "@/lib/diagnostico";
import type { CitaId } from "@/lib/catalogo";
import { citaQueCubre, diagnosticar, DOCUMENTOS, respuestasSchema } from "@/lib/diagnostico";
import type { CodigoRevision, Decision, LecturaIris } from "@/lib/iris";
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
// recibido: lo mira una persona · verificado: verde de IRIS · dudoso: ámbar,
// lo mira una persona · valido / rechazado: decisión del abogado.
export const ESTADOS_DOCUMENTO_BOVEDA = ["recibido", "verificado", "dudoso", "valido", "rechazado"] as const;
export type EstadoDocumentoBoveda = (typeof ESTADOS_DOCUMENTO_BOVEDA)[number];
// Lo que puede decidir una persona del equipo.
export const DECISIONES_EQUIPO = ["valido", "rechazado"] as const;
// En verde: el paso de ese documento está hecho y el proceso sigue.
export const ESTADOS_VERDES: readonly EstadoDocumentoBoveda[] = ["verificado", "valido"];
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
  return planDocumental(respuestas).requeridos;
}

// Qué documentos pide la ruta y, de los que aún no se tienen, cuáles consigue
// BUROFAST con una cita de esa misma ruta (el CCSE, con la inscripción al examen).
export function planDocumental(respuestas: unknown) {
  const validas = respuestasSchema.safeParse(respuestas);
  if (!validas.success) return { requeridos: [] as DocumentoId[], citaQueLoGestiona: {} as Partial<Record<DocumentoId, CitaId>> };
  const ruta = diagnosticar(validas.data);
  const citaQueLoGestiona: Partial<Record<DocumentoId, CitaId>> = {};
  for (const documento of ruta.documentos) {
    const cita = citaQueCubre(documento);
    if (cita && ruta.citas.includes(cita)) citaQueLoGestiona[documento] = cita;
  }
  return { requeridos: ruta.documentos, citaQueLoGestiona };
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
  revisionCodigo: CodigoRevision | null;
  revisadoPor: "iris" | "equipo" | null;
  // Lo que leyó IRIS, para el equipo. No se manda al navegador del cliente.
  lectura: LecturaIris | null;
};

type Fila = Omit<DocumentoBoveda, "nombre" | "lectura"> & { nombreCifrado: string; revisionCifrada: string | null };
const leerCifrado = <T,>(sobre: string | null, convertir: (texto: string) => T): T | null => {
  if (!sobre) return null;
  try {
    return convertir(descifrar(sobre));
  } catch {
    // Un dato ilegible no impide ver que el documento existe.
    return null;
  }
};
const aDocumento = ({ nombreCifrado, revisionCifrada, ...resto }: Fila): DocumentoBoveda => ({
  ...resto,
  nombre: leerCifrado(nombreCifrado, (t) => t) ?? "documento",
  lectura: leerCifrado(revisionCifrada, (t) => JSON.parse(t) as LecturaIris),
});

export async function documentosDeLeads(leadIds: string[]) {
  if (leadIds.length === 0) return new Map<string, DocumentoBoveda[]>();
  const filas = await db()<(Fila & { leadId: string })[]>`
    select id, lead_id as "leadId", tipo, nombre_cifrado as "nombreCifrado", mime, bytes, estado, nota, origen, creado_en as "creadoEn",
           revision_codigo as "revisionCodigo", revisado_por as "revisadoPor", revision_cifrada as "revisionCifrada"
    from documentos where lead_id in ${db()(leadIds)} and borrado_en is null order by creado_en desc
  `;
  const porLead = new Map<string, DocumentoBoveda[]>();
  for (const { leadId, ...fila } of filas) porLead.set(leadId, [...(porLead.get(leadId) ?? []), aDocumento(fila)]);
  return porLead;
}

// El expediente es del cliente si su correo verificado es el de la sesión.
export async function leadDelCliente(referencia: string, emailHash: string) {
  const [fila] = await db()<{ id: string; consentido: Date | null; consentidoIa: Date | null; nombreCifrado: string }[]>`
    select id, documentos_consentidos_en as consentido, documentos_ia_consentidos_en as "consentidoIa", nombre_cifrado as "nombreCifrado"
    from leads where referencia = ${referencia} and email_hash = ${emailHash} and email_verificado_en is not null
  `;
  if (!fila) return null;
  const { nombreCifrado, ...resto } = fila;
  // El nombre solo sirve para que IRIS compruebe que el documento es de esta persona.
  return { ...resto, titular: leerCifrado(nombreCifrado, (t) => t) ?? "" };
}

// Dos consentimientos: guardar (necesario para adjuntar) y comprobar con IRIS
// (opcional: sin él, los documentos los mira solo una persona).
export async function registrarConsentimiento(leadId: string, que: { guardar: boolean; ia: boolean }) {
  if (que.guardar) await db()`update leads set documentos_consentidos_en = coalesce(documentos_consentidos_en, now()) where id = ${leadId}`;
  if (que.ia) await db()`update leads set documentos_ia_consentidos_en = coalesce(documentos_ia_consentidos_en, now()) where id = ${leadId}`;
}

// Tope por expediente: una bóveda no es un disco duro.
export const MAX_DOCUMENTOS_EXPEDIENTE = 40;

export async function guardarDocumento(entrada: { leadId: string; tipo: TipoDocumentoBoveda; nombre: string; contenido: Uint8Array; origen: "app" | "whatsapp" | "equipo" }) {
  const mime = detectarTipo(entrada.contenido);
  if (!mime) return { ok: false as const, motivo: "tipo" as const };
  if (entrada.contenido.length > MAX_BYTES_DOCUMENTO) return { ok: false as const, motivo: "tamano" as const };
  const [{ total }] = await db()<{ total: number }[]>`select count(*)::int as total from documentos where lead_id = ${entrada.leadId} and borrado_en is null`;
  if (total >= MAX_DOCUMENTOS_EXPEDIENTE) return { ok: false as const, motivo: "limite" as const };
  const huella = createHash("sha256").update(entrada.contenido).digest("hex");
  const nombre = entrada.nombre.replace(/[\u0000-\u001f\u007f/\\]/g, "").trim().slice(0, 120) || "documento";
  const [fila] = await db()<{ id: string }[]>`
    insert into documentos (lead_id, tipo, nombre_cifrado, mime, bytes, sha256, contenido_cifrado, origen)
    values (${entrada.leadId}, ${entrada.tipo}, ${cifrar(nombre)}, ${mime}, ${entrada.contenido.length},
            ${huella}, ${cifrarBytes(entrada.contenido)}, ${entrada.origen})
    returning id
  `;
  return { ok: true as const, id: fila.id, mime, sha256: huella };
}

// El mismo archivo que el abogado ya rechazó en este expediente no vuelve a
// quedar en verde por subirlo otra vez.
export async function fueRechazado(leadId: string, sha256: string) {
  const [fila] = await db()`select 1 from documentos where lead_id = ${leadId} and sha256 = ${sha256} and estado = 'rechazado' limit 1`;
  return Boolean(fila);
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
    update documentos set borrado_en = now(), contenido_cifrado = null, revision_cifrada = null, revision_codigo = null
    where id = ${id} and lead_id = ${leadId} and borrado_en is null returning id
  `;
  return filas.length > 0;
}

// Decisión de una persona del equipo: manda sobre la de IRIS.
export async function revisarDocumento(id: string, estado: (typeof DECISIONES_EQUIPO)[number], nota: string | null) {
  const [fila] = await db()<{ leadId: string; tipo: TipoDocumentoBoveda }[]>`
    update documentos set estado = ${estado}, nota = ${nota?.slice(0, 300) ?? null}, revisado_en = now(), revisado_por = 'equipo'
    where id = ${id} and borrado_en is null returning lead_id as "leadId", tipo
  `;
  return fila ?? null;
}

// Decisión de IRIS. Solo sobre un documento que nadie ha revisado todavía.
export async function aplicarRevisionIris(id: string, decision: Decision, lectura: LecturaIris | null) {
  const filas = await db()`
    update documentos set estado = ${decision.estado}, revision_codigo = ${decision.codigo},
           revision_cifrada = ${lectura ? cifrar(JSON.stringify(lectura)) : null},
           revisado_por = ${lectura ? "iris" : null}, revisado_en = ${lectura ? new Date() : null}
    where id = ${id} and borrado_en is null and estado = 'recibido' returning id
  `;
  return filas.length > 0;
}

// «¿Ya lo tienes?»: la respuesta de la persona, por documento.
export async function declararDocumento(leadId: string, tipo: DocumentoId, tiene: boolean) {
  await db()`
    insert into documentos_declaraciones (lead_id, tipo, tiene) values (${leadId}, ${tipo}, ${tiene})
    on conflict (lead_id, tipo) do update set tiene = excluded.tiene, actualizado_en = now()
  `;
}

export async function declaracionesDeLeads(leadIds: string[]) {
  const porLead = new Map<string, Partial<Record<DocumentoId, boolean>>>();
  if (leadIds.length === 0) return porLead;
  const filas = await db()<{ leadId: string; tipo: DocumentoId; tiene: boolean }[]>`
    select lead_id as "leadId", tipo, tiene from documentos_declaraciones where lead_id in ${db()(leadIds)}
  `;
  for (const f of filas) porLead.set(f.leadId, { ...porLead.get(f.leadId), [f.tipo]: f.tiene });
  return porLead;
}

// Cuántos documentos de la ruta están en verde. Completo = el proceso sigue.
export function progresoDocumental(requeridos: readonly DocumentoId[], documentos: readonly Pick<DocumentoBoveda, "tipo" | "estado">[]) {
  const verdes = requeridos.filter((tipo) => documentos.some((d) => d.tipo === tipo && ESTADOS_VERDES.includes(d.estado)));
  return { verdes, total: requeridos.length, completo: requeridos.length > 0 && verdes.length === requeridos.length };
}
