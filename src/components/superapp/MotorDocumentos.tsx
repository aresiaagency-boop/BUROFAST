"use client";

import Link from "next/link";
import { CLAVE_DOCUMENTOS, escribir } from "@/lib/almacen";
import type { DocumentoId } from "@/lib/diagnostico";
import { emitirHestia, preguntarHestia } from "@/lib/hestia/vivo";
import { DICCIONARIOS } from "@/lib/i18n";
import type { Locale } from "@/lib/i18n/locales";
import type { EstadoDocumento } from "@/lib/motores";
import { ESTADOS_DOCUMENTO, motorMnemosine } from "@/lib/motores";
import { useAlmacen } from "@/lib/useAlmacen";

// MNEMÓSINE: la lista exacta de papeles de la ruta, con lo que ya tienes
// marcado. Las marcas se guardan solo en este dispositivo.
export function MotorDocumentos({ locale }: { locale: Locale }) {
  const t = DICCIONARIOS[locale];
  const { listo, camino, documentos } = useAlmacen();
  if (!listo) return <section className="cristal bloque" aria-busy="true"><p>…</p></section>;
  const ruta = camino.ruta;
  if (!ruta || ruta.documentos.length === 0) {
    return (
      <section className="cristal cristal--grande bloque">
        <p>{t.motorDocumentos.sinRuta}</p>
        <div className="acciones"><Link className="boton-cristal" href={`/${locale}/camino`}>{t.motorCitas.irCamino}</Link></div>
      </section>
    );
  }
  const mnemosine = motorMnemosine(ruta.documentos, documentos);

  const marcar = (id: DocumentoId, estado: EstadoDocumento) => {
    const siguiente = { ...documentos, [id]: estado };
    escribir(CLAVE_DOCUMENTOS, siguiente);
    const resultado = motorMnemosine(ruta.documentos, siguiente);
    emitirHestia(resultado.listos === resultado.total ? "exito" : "escuchando");
  };

  return (
    <>
      <section className="cristal cristal--grande bloque">
        <div className="progreso-documentos">
          <p className="hud-etiqueta"><span>{t.rutas[ruta.id].nombre}</span><span>{mnemosine.porcentaje}%</span></p>
          <div className="barra-luz" role="progressbar" aria-valuemin={0} aria-valuemax={mnemosine.total} aria-valuenow={mnemosine.listos} aria-label={t.motorDocumentos.progreso(mnemosine.listos, mnemosine.total)}>
            <span style={{ width: `${mnemosine.porcentaje}%` }} />
          </div>
          <p style={{ marginTop: 8 }}>{t.motorDocumentos.progreso(mnemosine.listos, mnemosine.total)}</p>
        </div>
      </section>
      <ul className="documentos">
        {mnemosine.documentos.map((doc) => (
          <li key={doc.id} className="cristal documento" data-estado={doc.estado}>
            <div>
              <strong>{t.documentos[doc.id]}</strong>
              {doc.extranjero && <small>{t.motorDocumentos.extranjero}</small>}
              {doc.reciente && <small>{t.motorDocumentos.reciente}</small>}
            </div>
            <div className="selector-estado" role="group" aria-label={t.documentos[doc.id]}>
              {ESTADOS_DOCUMENTO.map((estado) => (
                <button key={estado} type="button" className={`chip-cristal ${estado === "tengo" ? "" : estado === "pidiendo" ? "plasma-oro" : "plasma-rojo"}`} aria-pressed={doc.estado === estado} onClick={() => marcar(doc.id, estado)}>
                  {t.motorDocumentos.estados[estado]}
                </button>
              ))}
            </div>
          </li>
        ))}
      </ul>
      <p className="aviso-ia">{t.motorDocumentos.guardadoLocal}</p>
      <div className="acciones">
        <button type="button" className="boton-cristal plasma-agente" style={{ "--agente": "var(--agente-mnemosine)" } as React.CSSProperties} onClick={() => preguntarHestia(t.hestia.sugerencias[0])}>
          {t.motorDocumentos.preguntar}
        </button>
      </div>
    </>
  );
}
