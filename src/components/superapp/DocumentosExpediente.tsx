"use client";

import { useRouter } from "next/navigation";
import { useId, useState } from "react";
import type { DocumentoId } from "@/lib/diagnostico";
import { DICCIONARIOS } from "@/lib/i18n";
import type { Locale } from "@/lib/i18n/locales";

// La parte del cliente en «aceptar y adjuntar»: la lista de documentos que
// pide su ruta, con su estado, y un botón por documento. Las fotos grandes se
// reducen aquí antes de subir (Vercel no acepta cuerpos de más de 4,5 MB).

export type DocumentoVista = { id: string; tipo: string; nombre: string; bytes: number; estado: "recibido" | "valido" | "rechazado"; nota: string | null };

const LIMITE = 4 * 1024 * 1024;
const TONO = { recibido: "info", valido: "ok", rechazado: "critico" } as const;

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

export function DocumentosExpediente({ locale, referencia, requeridos, documentos, consentido }: { locale: Locale; referencia: string; requeridos: DocumentoId[]; documentos: DocumentoVista[]; consentido: boolean }) {
  const t = DICCIONARIOS[locale];
  const b = t.boveda;
  const router = useRouter();
  const id = useId();
  const [acepta, setAcepta] = useState(consentido);
  const [ocupado, setOcupado] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);

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
    try {
      const r = await fetch("/api/v1/expediente/documentos", { method: "POST", body: datos });
      if (!r.ok) {
        const codigo = String((await r.json().catch(() => null))?.error?.codigo ?? "");
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

  const filas: { tipo: string; nombre: string }[] = [...requeridos.map((d) => ({ tipo: d, nombre: t.documentos[d] })), { tipo: "otro", nombre: b.otro }];

  return (
    <section className="boveda" aria-labelledby={`${id}-titulo`}>
      <h3 id={`${id}-titulo`}>{b.titulo}</h3>
      <p className="boveda-intro">{b.intro}</p>
      {!consentido && (
        <label className="boveda-consentimiento">
          <input type="checkbox" checked={acepta} onChange={(e) => setAcepta(e.target.checked)} />
          <span>{b.consentimiento}</span>
        </label>
      )}
      <ul className="boveda-lista">
        {filas.map((fila) => {
          const suyos = documentos.filter((d) => d.tipo === fila.tipo);
          const entradaId = `${id}-${fila.tipo}`;
          return (
            <li key={fila.tipo} className="boveda-fila">
              <div className="boveda-cabeza">
                <strong>{fila.nombre}</strong>
                {suyos.length === 0 && fila.tipo !== "otro" && <span className="estado-holo aviso">{b.falta}</span>}
              </div>
              {suyos.map((doc) => (
                <div key={doc.id} className="boveda-documento">
                  <span className={`estado-holo ${TONO[doc.estado]}`}>{b.estados[doc.estado]}</span>
                  <span className="boveda-nombre">{doc.nombre} · <span className="mono">{tamano(doc.bytes)}</span></span>
                  {doc.nota && <span className="boveda-nota">{doc.nota}</span>}
                  <a className="boton-texto" href={`/api/v1/expediente/documentos/${doc.id}?expediente=${encodeURIComponent(referencia)}`}>{b.ver}</a>
                  <button type="button" className="boton-texto" onClick={() => borrar(doc)} disabled={ocupado !== null}>{b.borrar}</button>
                </div>
              ))}
              <input
                id={entradaId}
                className="solo-lectores"
                type="file"
                accept="application/pdf,image/jpeg,image/png,image/webp,image/heic,.heic"
                aria-label={b.aria(fila.nombre)}
                disabled={!acepta || ocupado !== null}
                onChange={(e) => {
                  void subir(fila.tipo, e.target.files?.[0]);
                  e.target.value = "";
                }}
              />
              <label className="boton-cristal boton-cristal--mini boton-cristal--fantasma" htmlFor={entradaId} aria-disabled={!acepta || ocupado !== null}>
                {ocupado === fila.tipo ? b.subiendo : suyos.length ? b.otroMas : b.adjuntar}
              </label>
            </li>
          );
        })}
      </ul>
      <p className="boveda-formatos">{acepta ? b.formatos : b.primeroConsiente}</p>
      {aviso && <p className="alerta-holo error" role="alert">{aviso}</p>}
    </section>
  );
}
