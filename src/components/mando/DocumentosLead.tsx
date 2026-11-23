"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

// Revisión de la bóveda desde la Dirección: abrir (auditado en el servidor),
// marcar válido o rechazar con una nota que el cliente ve en su expediente.
export type DocumentoFila = {
  id: string;
  etiqueta: string;
  nombre: string;
  estado: "recibido" | "verificado" | "dudoso" | "valido" | "rechazado";
  nota: string | null;
  origen: string;
  // Lo que dijo IRIS, para que el abogado decida rápido.
  iris: string | null;
  // Cita que este documento hace innecesaria al validarlo.
  cubre: string | null;
};

const TONO = { recibido: "info", verificado: "ok", dudoso: "aviso", valido: "ok", rechazado: "critico" } as const;
const TEXTO = { recibido: "Recibido", verificado: "Verde de IRIS", dudoso: "Ámbar de IRIS", valido: "Válido (abogado)", rechazado: "Rechazado" } as const;

export function DocumentosLead({ documentos, faltan, operador, resumen }: { documentos: DocumentoFila[]; faltan: string[]; operador: boolean; resumen: string | null }) {
  const router = useRouter();
  const [ocupado, setOcupado] = useState<string | null>(null);
  const [fallo, setFallo] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);

  const revisar = async (id: string, estado: "valido" | "rechazado") => {
    const nota = estado === "rechazado" ? window.prompt("Motivo del rechazo (lo verá el cliente):", "")?.trim() : null;
    if (estado === "rechazado" && !nota) return;
    setOcupado(id);
    setFallo(null);
    const r = await fetch(`/api/v1/mando/documentos/${id}`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ estado, nota: nota ?? null }),
    }).catch(() => null);
    setOcupado(null);
    if (!r?.ok) return setFallo("No se pudo guardar la revisión.");
    const cuerpo = (await r.json().catch(() => null)) as { aviso?: string | null } | null;
    setAviso(cuerpo?.aviso ?? null);
    router.refresh();
  };

  return (
    <div className="documentos-lead">
      {resumen && <span className="metrica-fuente">{resumen}</span>}
      {documentos.length === 0 && <span className="metrica-fuente">Sin documentos</span>}
      {documentos.map((d) => (
        <div key={d.id} className="documento-lead">
          <span className={`estado-holo ${TONO[d.estado]}`}>{TEXTO[d.estado]}</span>
          <a href={`/api/v1/mando/documentos/${d.id}`} target="_blank" rel="noopener noreferrer">{d.etiqueta}</a>
          <span className="metrica-fuente">{d.nombre} · {d.origen}</span>
          {d.iris && <span className="metrica-fuente">IRIS: {d.iris}</span>}
          {d.cubre && ["recibido", "verificado", "dudoso"].includes(d.estado) && <span className="metrica-fuente">{d.cubre}</span>}
          {d.nota && <span className="metrica-fuente">«{d.nota}»</span>}
          {operador && ["recibido", "verificado", "dudoso"].includes(d.estado) && (
            <span className="documento-lead-acciones">
              <button type="button" className="boton-texto" disabled={ocupado !== null} onClick={() => revisar(d.id, "valido")}>Válido</button>
              <button type="button" className="boton-texto" disabled={ocupado !== null} onClick={() => revisar(d.id, "rechazado")}>Rechazar</button>
            </span>
          )}
        </div>
      ))}
      {faltan.length > 0 && <span className="metrica-fuente">Faltan: {faltan.join(", ")}</span>}
      {aviso && <span className="metrica-fuente" role="status">{aviso}</span>}
      {fallo && <span className="metrica-fuente" role="alert">{fallo}</span>}
    </div>
  );
}
