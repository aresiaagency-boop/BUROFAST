"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

// Revisión de la bóveda desde la Dirección: abrir (auditado en el servidor),
// marcar válido o rechazar con una nota que el cliente ve en su expediente.
export type DocumentoFila = { id: string; etiqueta: string; nombre: string; estado: "recibido" | "valido" | "rechazado"; nota: string | null; origen: string };

const TONO = { recibido: "info", valido: "ok", rechazado: "critico" } as const;
const TEXTO = { recibido: "Recibido", valido: "Válido", rechazado: "Rechazado" } as const;

export function DocumentosLead({ documentos, faltan, operador }: { documentos: DocumentoFila[]; faltan: string[]; operador: boolean }) {
  const router = useRouter();
  const [ocupado, setOcupado] = useState<string | null>(null);
  const [fallo, setFallo] = useState<string | null>(null);

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
    if (!r?.ok) setFallo("No se pudo guardar la revisión.");
    else router.refresh();
  };

  return (
    <div className="documentos-lead">
      {documentos.length === 0 && <span className="metrica-fuente">Sin documentos</span>}
      {documentos.map((d) => (
        <div key={d.id} className="documento-lead">
          <span className={`estado-holo ${TONO[d.estado]}`}>{TEXTO[d.estado]}</span>
          <a href={`/api/v1/mando/documentos/${d.id}`} target="_blank" rel="noopener noreferrer">{d.etiqueta}</a>
          <span className="metrica-fuente">{d.nombre} · {d.origen}</span>
          {d.nota && <span className="metrica-fuente">«{d.nota}»</span>}
          {operador && d.estado === "recibido" && (
            <span className="documento-lead-acciones">
              <button type="button" className="boton-texto" disabled={ocupado !== null} onClick={() => revisar(d.id, "valido")}>Válido</button>
              <button type="button" className="boton-texto" disabled={ocupado !== null} onClick={() => revisar(d.id, "rechazado")}>Rechazar</button>
            </span>
          )}
        </div>
      ))}
      {faltan.length > 0 && <span className="metrica-fuente">Faltan: {faltan.join(", ")}</span>}
      {fallo && <span className="metrica-fuente" role="alert">{fallo}</span>}
    </div>
  );
}
