"use client";

import { useRouter } from "next/navigation";
import { useId, useState } from "react";
import type { CitaId } from "@/lib/catalogo";
import type { DocumentoId } from "@/lib/diagnostico";
import type { EstadoDocumentoBoveda } from "@/lib/documentos";
import { DICCIONARIOS } from "@/lib/i18n";
import type { Locale } from "@/lib/i18n/locales";
import type { CodigoRevision } from "@/lib/iris";

// La parte del cliente en «aceptar y adjuntar»: por cada documento de su ruta,
// «¿ya lo tienes?»; si lo tiene, lo adjunta e IRIS lo comprueba al momento (si
// la persona lo acepta); el verde (lo decide el servidor) marca ese paso como
// hecho. El precio solo cambia cuando el abogado valida. Las fotos grandes se
// reducen aquí antes de subir (Vercel no acepta cuerpos de más de 4,5 MB).

export type DocumentoVista = { id: string; tipo: string; nombre: string; bytes: number; estado: EstadoDocumentoBoveda; nota: string | null; revisionCodigo: CodigoRevision | null };

const LIMITE = 4 * 1024 * 1024;
const TONO: Record<EstadoDocumentoBoveda, string> = { recibido: "info", verificado: "ok", dudoso: "aviso", valido: "ok", rechazado: "critico" };
// Solo para pintar; el verde lo decide el servidor (ESTADOS_VERDES).
const VERDE: readonly EstadoDocumentoBoveda[] = ["verificado", "valido"];

async function reducirFoto(archivo: File): Promise<File> {
  if (archivo.size <= LIMITE * 0.9 || !/^image\/(jpeg|png|webp)$/.test(archivo.type)) return archivo;
  try {
    const imagen = await createImageBitmap(archivo);
    const escala = Math.min(1, 2400 / Math.max(imagen.width, imagen.height));
    const lienzo = document.createElement("canvas");
    lienzo.width = Math.round(imagen.width * escala);
    lienzo.height = Math.round(imagen.height * escala);
    lienzo.getContext("2d")?.drawImage(imagen, 0, 0, lienzo.width, lienzo.height);
    const blob = await new Promise<Blob | null>((ok) => lienzo.toBlob(ok, "image/jpeg", 0.85));
    return blob ? new File([blob], archivo.name.replace(/\.\w+$/, "") + ".jpg", { type: "image/jpeg" }) : archivo;
  } catch {
    return archivo;
  }
}

const tamano = (bytes: number) => (bytes > 1024 * 1024 ? `${(bytes / 1024 / 1024).toFixed(1)} MB` : `${Math.max(1, Math.round(bytes / 1024))} KB`);

type Props = {
  locale: Locale;
  referencia: string;
  requeridos: DocumentoId[];
  documentos: DocumentoVista[];
  consentido: boolean;
  consentidoIa: boolean;
  // Citas que el expediente tiene de verdad ahora (no las de la ruta teórica).
  citasActivas: CitaId[];
  declaraciones: Partial<Record<DocumentoId, boolean>>;
  citaQueLoGestiona: Partial<Record<DocumentoId, CitaId>>;
  progreso: { verdes: number; total: number; completo: boolean };
};

export function DocumentosExpediente({ locale, referencia, requeridos, documentos, consentido, consentidoIa, citasActivas, declaraciones, citaQueLoGestiona, progreso }: Props) {
  const t = DICCIONARIOS[locale];
  const b = t.boveda;
  const router = useRouter();
  const id = useId();
  const [acepta, setAcepta] = useState(consentido);
  const [aceptaIa, setAceptaIa] = useState(consentidoIa);
  const [ocupado, setOcupado] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  const [respuestas, setRespuestas] = useState(declaraciones);

  const declarar = async (tipo: DocumentoId, tiene: boolean) => {
    setRespuestas((r) => ({ ...r, [tipo]: tiene }));
    await fetch("/api/v1/expediente/documentos/declarar", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ referencia, tipo, tiene }),
    }).catch(() => null);
    router.refresh();
  };

  const subir = async (tipo: string, archivo: File | undefined) => {
    if (!archivo) return;
    setAviso(null);
    if (!acepta) return setAviso(b.errores.consentimiento);
    const final = await reducirFoto(archivo);
    if (final.size > LIMITE) return setAviso(b.errores.tamano);
    setOcupado(tipo);
    const datos = new FormData();
    datos.set("archivo", final);
    datos.set("referencia", referencia);
    datos.set("tipo", tipo);
    datos.set("consiento", acepta ? "si" : "no");
    datos.set("consientoIa", aceptaIa ? "si" : "no");
    try {
      const r = await fetch("/api/v1/expediente/documentos", { method: "POST", body: datos });
      if (!r.ok) {
        const cuerpo = (await r.json().catch(() => null)) as { error?: { codigo?: string } } | null;
        const codigo = String(cuerpo?.error?.codigo ?? "");
        setAviso(codigo === "DOCUMENTO_TIPO" ? b.errores.tipo : codigo === "DOCUMENTO_TAMANO" || codigo === "DEMASIADO_GRANDE" ? b.errores.tamano : codigo === "DOCUMENTO_LIMITE" ? b.errores.limite : codigo === "SIN_CONSENTIMIENTO" ? b.errores.consentimiento : b.errores.generico);
      } else router.refresh();
    } catch {
      setAviso(b.errores.generico);
    } finally {
      setOcupado(null);
    }
  };

  const borrar = async (doc: DocumentoVista) => {
    if (!window.confirm(b.confirmarBorrar)) return;
    setOcupado(doc.id);
    await fetch(`/api/v1/expediente/documentos/${doc.id}?expediente=${encodeURIComponent(referencia)}`, { method: "DELETE" }).catch(() => null);
    setOcupado(null);
    router.refresh();
  };

  const botonAdjuntar = (tipo: string, nombre: string, texto: string) => {
    const entradaId = `${id}-${tipo}`;
    return (
      <>
        <input
          id={entradaId}
          className="solo-lectores"
          type="file"
          accept="application/pdf,image/jpeg,image/png,image/webp,image/heic,.heic"
          aria-label={b.aria(nombre)}
          disabled={!acepta || ocupado !== null}
          onChange={(e) => {
            void subir(tipo, e.target.files?.[0]);
            e.target.value = "";
          }}
        />
        <label className="boton-cristal boton-cristal--mini boton-cristal--fantasma" htmlFor={entradaId} aria-disabled={!acepta || ocupado !== null}>
          {ocupado === tipo ? b.comprobando : texto}
        </label>
      </>
    );
  };

  const filas: { tipo: string; nombre: string }[] = [...requeridos.map((d) => ({ tipo: d, nombre: t.documentos[d] })), { tipo: "otro", nombre: b.otro }];
  const porcentaje = progreso.total ? Math.round((progreso.verdes / progreso.total) * 100) : 0;

  return (
    <section className="boveda" aria-labelledby={`${id}-titulo`}>
      <h3 id={`${id}-titulo`}>{b.titulo}</h3>
      <p className="boveda-intro">{b.intro}</p>
      {progreso.total > 0 && (
        <div className="boveda-progreso">
          <span className="boveda-progreso-texto mono">{b.progreso(progreso.verdes, progreso.total)}</span>
          <span className="boveda-barra" role="progressbar" aria-valuemin={0} aria-valuemax={progreso.total} aria-valuenow={progreso.verdes} aria-label={b.progreso(progreso.verdes, progreso.total)}>
            <span style={{ width: `${porcentaje}%` }} />
          </span>
        </div>
      )}
      {progreso.completo && <p className="alerta-holo oro" role="status">{b.completo}</p>}
      {!consentido && (
        <label className="boveda-consentimiento">
          <input type="checkbox" checked={acepta} onChange={(e) => setAcepta(e.target.checked)} />
          <span>{b.consentimiento}</span>
        </label>
      )}
      {!consentidoIa && (
        <label className="boveda-consentimiento boveda-consentimiento--ia">
          <input type="checkbox" checked={aceptaIa} onChange={(e) => setAceptaIa(e.target.checked)} />
          <span>{b.consentimientoIa}</span>
        </label>
      )}
      <ul className="boveda-lista">
        {filas.map((fila) => {
          const suyos = documentos.filter((d) => d.tipo === fila.tipo);
          const enVerde = suyos.some((d) => VERDE.includes(d.estado));
          const requerido = fila.tipo !== "otro" ? (fila.tipo as DocumentoId) : null;
          const respuesta = requerido ? respuestas[requerido] : undefined;
          const cita = requerido ? citaQueLoGestiona[requerido] : undefined;
          const citaActiva = cita ? citasActivas.includes(cita) : false;
          const validado = suyos.some((d) => d.estado === "valido");
          return (
            <li key={fila.tipo} className={`boveda-fila${enVerde ? " en-verde" : ""}`}>
              <div className="boveda-cabeza">
                <strong>{fila.nombre}</strong>
                {requerido && suyos.length === 0 && respuesta !== false && <span className="estado-holo aviso">{b.falta}</span>}
              </div>
              {suyos.map((doc) => (
                <div key={doc.id} className="boveda-documento">
                  <span className={`estado-holo ${TONO[doc.estado]}`}>{b.estados[doc.estado]}</span>
                  <span className="boveda-nombre">{doc.nombre} · <span className="mono">{tamano(doc.bytes)}</span></span>
                  <a className="boton-texto" href={`/api/v1/expediente/documentos/${doc.id}?expediente=${encodeURIComponent(referencia)}`}>{b.ver}</a>
                  <button type="button" className="boton-texto" onClick={() => borrar(doc)} disabled={ocupado !== null}>{b.borrar}</button>
                  {doc.revisionCodigo && !["valido", "rechazado"].includes(doc.estado) && <span className={`boveda-revision ${TONO[doc.estado]}`}>{b.revision[doc.revisionCodigo]}</span>}
                  {doc.nota && <span className="boveda-nota">{doc.nota}</span>}
                </div>
              ))}
              {enVerde && cita && validado && !citaActiva && <span className="boveda-revision ok">{b.citaYaNo(t.citas[cita].nombre)}</span>}
              {enVerde && cita && !validado && citaActiva && <span className="boveda-revision info">{b.citaAlValidar(t.citas[cita].nombre)}</span>}
              {requerido && suyos.length === 0 && respuesta === undefined && (
                <div className="boveda-pregunta" role="group" aria-label={`${b.pregunta} ${fila.nombre}`}>
                  <span>{b.pregunta}</span>
                  <button type="button" className="boton-cristal boton-cristal--mini" onClick={() => declarar(requerido, true)}>{b.si}</button>
                  <button type="button" className="boton-cristal boton-cristal--mini boton-cristal--fantasma" onClick={() => declarar(requerido, false)}>{b.no}</button>
                </div>
              )}
              {requerido && suyos.length === 0 && respuesta === false && (
                <div className="boveda-pregunta">
                  <span className="boveda-nota-suave">{cita && citaActiva ? b.citaGestiona(t.citas[cita].nombre) : b.loConseguimos}</span>
                  <button type="button" className="boton-texto" onClick={() => declarar(requerido, true)}>{b.si}</button>
                </div>
              )}
              {requerido && suyos.length === 0 && respuesta === true && (
                <div className="boveda-pregunta">
                  <span className="boveda-nota-suave">{b.loTienes}</span>
                  {botonAdjuntar(fila.tipo, fila.nombre, b.adjuntar)}
                  <button type="button" className="boton-texto" onClick={() => declarar(requerido, false)}>{b.no}</button>
                </div>
              )}
              {(suyos.length > 0 || !requerido) && !enVerde && botonAdjuntar(fila.tipo, fila.nombre, suyos.length ? b.otroMas : b.adjuntar)}
            </li>
          );
        })}
      </ul>
      <p className="boveda-formatos">{acepta ? b.formatos : b.primeroConsiente}</p>
      {aviso && <p className="alerta-holo error" role="alert">{aviso}</p>}
    </section>
  );
}
