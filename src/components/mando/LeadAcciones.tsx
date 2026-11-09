"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import type { EstadoLead } from "@/lib/expediente";

const TEXTO: Partial<Record<EstadoLead, string>> = {
  contactado: "Contactado",
  revision_abogado: "A revisión del abogado",
  aprobado: "Confirmar ruta (abogado)",
  descartado: "Descartar",
  nuevo: "Reabrir",
};

// Acciones de una solicitud. El servidor decide qué transición vale y con
// qué rol; aquí solo se ofrecen las que el estado actual permite.
export function LeadAcciones({ id, transiciones, puedeEnlace }: { id: string; transiciones: EstadoLead[]; puedeEnlace: boolean }) {
  const router = useRouter();
  const [ocupado, setOcupado] = useState(false);
  const [fallo, setFallo] = useState<string | null>(null);
  const [enlace, setEnlace] = useState<string | null>(null);

  async function cambiar(estado: EstadoLead) {
    if (estado === "descartado" && !window.confirm("¿Descartar esta solicitud? Se puede reabrir después.")) return;
    setOcupado(true);
    setFallo(null);
    const respuesta = await fetch(`/api/v1/mando/leads/${id}/estado`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ estado }),
    }).catch(() => null);
    setOcupado(false);
    if (!respuesta?.ok) {
      const cuerpo = (await respuesta?.json().catch(() => null)) as { error?: { mensaje?: string } } | null;
      setFallo(cuerpo?.error?.mensaje ?? "No se pudo cambiar el estado.");
      return;
    }
    router.refresh();
  }

  async function crearEnlace() {
    setOcupado(true);
    setFallo(null);
    const respuesta = await fetch(`/api/v1/mando/leads/${id}/enlace-pago`, { method: "POST" }).catch(() => null);
    setOcupado(false);
    const cuerpo = (await respuesta?.json().catch(() => null)) as { url?: string; error?: { mensaje?: string } } | null;
    if (!respuesta?.ok || !cuerpo?.url) {
      setFallo(cuerpo?.error?.mensaje ?? "No se pudo crear el enlace.");
      return;
    }
    setEnlace(cuerpo.url);
    try {
      await navigator.clipboard.writeText(cuerpo.url);
    } catch {
      // Sin portapapeles: el enlace queda visible para copiarlo a mano.
    }
  }

  return (
    <div style={{ display: "grid", gap: 6 }}>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
        {transiciones.map((estado) => (
          <button key={estado} type="button" disabled={ocupado} className={`chip-cristal${estado === "aprobado" ? " plasma-oro" : estado === "descartado" ? " plasma-rojo" : ""}`} onClick={() => void cambiar(estado)}>
            {TEXTO[estado] ?? estado}
          </button>
        ))}
        {puedeEnlace && (
          <button type="button" disabled={ocupado} className="chip-cristal plasma-oro" onClick={() => void crearEnlace()}>Enlace de pago</button>
        )}
      </div>
      {enlace && <input readOnly value={enlace} aria-label="Enlace de pago (copiado)" className="mono" style={{ width: "100%", fontSize: "0.72rem", background: "transparent", border: "1px solid var(--linea)", color: "var(--texto-suave)", padding: 4 }} onFocus={(e) => e.currentTarget.select()} />}
      {fallo && <span role="alert" style={{ color: "var(--rojo-texto)", fontSize: "0.8rem" }}>{fallo}</span>}
    </div>
  );
}
