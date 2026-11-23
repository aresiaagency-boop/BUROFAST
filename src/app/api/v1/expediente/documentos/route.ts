import { sesionClienteActual } from "@/lib/auth/cliente";
import { isDatabaseConfigured } from "@/lib/db";
import { aplicarRevisionIris, esTipoDocumento, fueRechazado, guardarDocumento, leadDelCliente, MAX_BYTES_DOCUMENTO, registrarConsentimiento } from "@/lib/documentos";
import { correlationId, error, ipCliente, json, origenEstricto } from "@/lib/http";
import { DICCIONARIOS } from "@/lib/i18n";
import { type Decision, decidirRevision, evaluarLectura, irisConfigurado, irisPuedeLeer, leerConIris } from "@/lib/iris";
import { auditar } from "@/lib/repositorio";
import { cifradoConfigurado } from "@/lib/security/cifrado";
import { limitar } from "@/lib/security/limites";

// Subir + comprobar con IRIS cabe en un minuto (IRIS corta a los 25 s).
export const maxDuration = 60;

// El cliente adjunta un documento a SU expediente: sesión de Google, correo
// verificado del expediente, consentimiento expreso la primera vez y archivo
// comprobado por su firma. Si la persona aceptó la comprobación, IRIS lo lee y
// este servidor decide verde o ámbar. El verde deja seguir; el precio solo lo
// cambia la validación del abogado. El servidor decide; el navegador propone.
export async function POST(request: Request) {
  const correlation = correlationId(request);
  if (!origenEstricto(request)) return error("ORIGEN_NO_PERMITIDO", "La petición no viene de BUROFAST.", { status: 403, correlation });
  if (!isDatabaseConfigured() || !cifradoConfigurado()) return error("NO_DISPONIBLE", "La bóveda de documentos no está disponible.", { status: 503, correlation });
  const cliente = await sesionClienteActual();
  if (!cliente) return error("NO_AUTORIZADO", "Entra con Google para adjuntar documentos.", { status: 401, correlation });
  for (const clave of [`docs:${ipCliente(request)}`, `docs-cuenta:${cliente.emailHash}`]) {
    const limite = await limitar(clave, { limite: 30, ventanaMs: 60 * 60_000 });
    if (!limite.permitido) return error("DEMASIADAS_PETICIONES", "Demasiados archivos seguidos. Prueba más tarde.", { status: 429, correlation });
  }
  if (Number(request.headers.get("content-length") ?? 0) > MAX_BYTES_DOCUMENTO + 64 * 1024) {
    return error("DEMASIADO_GRANDE", "El archivo supera 4 MB.", { status: 413, correlation });
  }
  const formulario = await request.formData().catch(() => null);
  const archivo = formulario?.get("archivo");
  const referencia = String(formulario?.get("referencia") ?? "").trim().toUpperCase();
  const tipo = formulario?.get("tipo");
  const consiento = formulario?.get("consiento") === "si";
  const consientoIa = formulario?.get("consientoIa") === "si";
  if (!(archivo instanceof File) || !/^BF-[A-Z0-9]{6}$/.test(referencia) || !esTipoDocumento(tipo)) {
    return error("ENTRADA_INVALIDA", "Falta el archivo, el expediente o el tipo de documento.", { status: 400, correlation });
  }
  const lead = await leadDelCliente(referencia, cliente.emailHash);
  if (!lead) return error("NO_ENCONTRADO", "Ese expediente no está en tu cuenta.", { status: 404, correlation });
  if (!lead.consentido && !consiento) return error("SIN_CONSENTIMIENTO", "Necesitamos tu consentimiento para guardar tus documentos.", { status: 400, correlation });
  await registrarConsentimiento(lead.id, { guardar: !lead.consentido && consiento, ia: !lead.consentidoIa && consientoIa });

  const contenido = new Uint8Array(await archivo.arrayBuffer());
  const resultado = await guardarDocumento({ leadId: lead.id, tipo, nombre: archivo.name, contenido, origen: "app" });
  await auditar({
    actorId: `cliente:${cliente.emailHash.slice(0, 16)}`,
    accion: "documento.subir",
    objetivoId: lead.id,
    parametros: { tipo, bytes: contenido.length, ...(resultado.ok ? { mime: resultado.mime } : { motivo: resultado.motivo }) },
    resultado: resultado.ok ? "ok" : "rechazado",
    correlationId: correlation,
  });
  if (!resultado.ok) {
    const mensajes = { tipo: "Solo PDF, JPG, PNG, WEBP o HEIC.", tamano: "El archivo supera 4 MB.", limite: "Este expediente ya tiene el máximo de documentos." } as const;
    return error(`DOCUMENTO_${resultado.motivo.toUpperCase()}`, mensajes[resultado.motivo], { status: 400, correlation });
  }

  let revision: Decision = { estado: "recibido", codigo: "sin_lectura" };
  if (tipo !== "otro" && (lead.consentidoIa || consientoIa) && irisConfigurado() && irisPuedeLeer(tipo, resultado.mime)) {
    const respuesta = await leerConIris({ tipo, catalogo: DICCIONARIOS.es.documentos, mime: resultado.mime, contenido });
    const lectura = respuesta ? evaluarLectura(respuesta, lead.titular) : null;
    revision = decidirRevision(tipo, lectura);
    // Volver a subir lo que el abogado ya rechazó no da verde.
    if (revision.estado === "verificado" && (await fueRechazado(lead.id, resultado.sha256))) revision = { estado: "dudoso", codigo: "dudoso" };
    await aplicarRevisionIris(resultado.id, revision, lectura);
    await auditar({ actorId: "iris", accion: "documento.comprobar", objetivoId: lead.id, parametros: { documento: resultado.id, tipo, ...revision }, resultado: "ok", correlationId: correlation });
  }
  return json({ ok: true, id: resultado.id, estado: revision.estado, codigo: revision.codigo }, { correlation });
}
