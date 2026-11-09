"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import type { EstadoCita } from "@/lib/citas";

const TEXTO: Record<EstadoCita, string> = {
  en_espera: "En espera",
  requerida: "Activar (llegó la resolución)",
  en_gestion: "Empezar gestión",
  reservada: "Marcar reservada",
  confirmada: "Confirmar",
  asistida: "Asistió",
  reprogramar: "Reprogramar",
  cancelada: "Cancelar",
  sin_cita_reembolso: "Sin cita · reembolsar",
};

// Los botones salen de las transiciones que permite el servidor; aun así, el
// servidor vuelve a validar cada cambio y lo deja en la auditoría.
export function CitaAcciones({ citaId, permitidas, puedeEditar }: { citaId: string; permitidas: readonly EstadoCita[]; puedeEditar: boolean }) {
  const router = useRouter();
  const [pidiendoFecha, setPidiendoFecha] = useState(false);
  const [ocupado, setOcupado] = useState(false);
  const [fallo, setFallo] = useState<string | null>(null);

  if (!puedeEditar) return <span className="metrica-fuente">Solo lectura</span>;
  if (permitidas.length === 0) return <span className="metrica-fuente">Cerrada</span>;

  async function cambiar(estado: EstadoCita, extra: { fechaCita?: string; lugar?: string } = {}) {
    if ((estado === "cancelada" || estado === "sin_cita_reembolso") && !window.confirm(`¿Seguro? «${TEXTO[estado]}» no se puede deshacer.`)) return;
    setOcupado(true);
    setFallo(null);
    const respuesta = await fetch(`/api/v1/mando/citas/${citaId}/estado`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ estado, ...extra }),
    }).catch(() => null);
    setOcupado(false);
    if (!respuesta?.ok) {
      const cuerpo = (await respuesta?.json().catch(() => null)) as { error?: { mensaje?: string; correlationId?: string } } | null;
      setFallo(`${cuerpo?.error?.mensaje ?? "No se pudo conectar."}${cuerpo?.error?.correlationId ? ` (${cuerpo.error.correlationId.slice(0, 8)})` : ""}`);
      return;
    }
    setPidiendoFecha(false);
    router.refresh();
  }

  if (pidiendoFecha) {
    return (
      <form
        style={{ display: "grid", gap: 6 }}
        onSubmit={(e) => {
          e.preventDefault();
          const datos = new FormData(e.currentTarget);
          const fecha = String(datos.get("fecha") ?? "");
          void cambiar("reservada", { fechaCita: fecha ? new Date(fecha).toISOString() : undefined, lugar: String(datos.get("lugar") ?? "") || undefined });
        }}
      >
        <input className="campo-mini" type="datetime-local" name="fecha" required aria-label="Fecha y hora de la cita" />
        <input className="campo-mini" name="lugar" placeholder="Oficina / dirección" aria-label="Lugar de la cita" maxLength={160} />
        <span style={{ display: "flex", gap: 6 }}>
          <button className="chip-cristal plasma-oro" type="submit" disabled={ocupado}>Guardar</button>
          <button className="chip-cristal" type="button" onClick={() => setPidiendoFecha(false)}>Volver</button>
        </span>
      </form>
    );
  }

  return (
    <span style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
      {permitidas.map((estado) => (
        <button key={estado} type="button" disabled={ocupado} className={`chip-cristal${estado === "cancelada" || estado === "sin_cita_reembolso" ? " plasma-rojo" : ""}`}
          onClick={() => (estado === "reservada" ? setPidiendoFecha(true) : void cambiar(estado))}>
          {TEXTO[estado]}
        </button>
      ))}
      {fallo && <span role="alert" style={{ color: "#f0a3a3", fontSize: "0.78rem" }}>{fallo}</span>}
    </span>
  );
}
