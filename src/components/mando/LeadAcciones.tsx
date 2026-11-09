"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import type { NivelCita } from "@/lib/catalogo";
import { PASAPORTES, SITUACIONES, SUENOS, TIEMPOS, UBICACIONES } from "@/lib/diagnostico";
import type { EstadoLead } from "@/lib/expediente";
import { DICCIONARIOS } from "@/lib/i18n";

type RespuestasLead = { sueno: string; ubicacion: string; situacion: string | null; tiempo: string | null; pasaporte: string };
type Plan = { respuestas: RespuestasLead; nivelCita: string | null; conGuardian: boolean };

const TEXTO: Partial<Record<EstadoLead, string>> = {
  contactado: "Contactado",
  revision_abogado: "A revisión del abogado",
  aprobado: "Confirmar ruta (abogado)",
  descartado: "Descartar",
  nuevo: "Reabrir",
};

// Acciones de una solicitud. El servidor decide qué transición vale y con
// qué rol; aquí solo se ofrecen las que el estado actual permite.
export function LeadAcciones({ id, transiciones, puedeEnlace, plan }: { id: string; transiciones: EstadoLead[]; puedeEnlace: boolean; plan: Plan | null }) {
  const router = useRouter();
  const [ocupado, setOcupado] = useState(false);
  const [fallo, setFallo] = useState<string | null>(null);
  const [enlace, setEnlace] = useState<string | null>(null);
  const [corrigiendo, setCorrigiendo] = useState(false);

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
        {plan && (
          <button type="button" disabled={ocupado} className="chip-cristal" aria-expanded={corrigiendo} onClick={() => setCorrigiendo((v) => !v)}>Corregir ruta</button>
        )}
      </div>
      {plan && corrigiendo && <CorregirRuta id={id} plan={plan} onHecho={() => { setCorrigiendo(false); router.refresh(); }} />}
      {enlace && <input readOnly value={enlace} aria-label="Enlace de pago (copiado)" className="mono" style={{ width: "100%", fontSize: "0.72rem", background: "transparent", border: "1px solid var(--linea)", color: "var(--texto-suave)", padding: 4 }} onFocus={(e) => e.currentTarget.select()} />}
      {fallo && <span role="alert" style={{ color: "var(--rojo-texto)", fontSize: "0.8rem" }}>{fallo}</span>}
    </div>
  );
}

// Formulario del abogado: cambia respuestas y nivel de citas; el servidor
// recalcula la ruta, las citas y el precio.
function CorregirRuta({ id, plan, onHecho }: { id: string; plan: Plan; onHecho: () => void }) {
  const t = DICCIONARIOS.es;
  const [r, setR] = useState<RespuestasLead>(plan.respuestas);
  const [nivelCita, setNivelCita] = useState<string>(plan.nivelCita ?? "");
  const [conGuardian, setConGuardian] = useState(plan.conGuardian);
  const [ocupado, setOcupado] = useState(false);
  const [mensaje, setMensaje] = useState<string | null>(null);
  const fuera = r.ubicacion === "fuera";

  async function guardar(evento: React.FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    setOcupado(true);
    setMensaje(null);
    const respuestas = fuera ? { ...r, situacion: null, tiempo: null } : r;
    const respuesta = await fetch(`/api/v1/mando/leads/${id}/ruta`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ respuestas, nivelCita: (nivelCita || null) as NivelCita | null, conGuardian }),
    }).catch(() => null);
    setOcupado(false);
    const cuerpo = (await respuesta?.json().catch(() => null)) as { error?: { mensaje?: string } } | null;
    if (!respuesta?.ok) {
      setMensaje(cuerpo?.error?.mensaje ?? "No se pudo corregir la ruta.");
      return;
    }
    onHecho();
  }

  const campo = (etiqueta: string, valor: string, cambiar: (v: string) => void, opciones: readonly string[], nombre: (o: string) => string, desactivado = false) => (
    <label style={{ display: "grid", gap: 2, fontSize: "0.72rem", color: "var(--texto-suave)" }}>
      {etiqueta}
      <select className="campo-mini" value={valor} disabled={desactivado} onChange={(e) => cambiar(e.target.value)} required={!desactivado}>
        {desactivado && <option value="">—</option>}
        {opciones.map((o) => <option key={o} value={o}>{nombre(o)}</option>)}
      </select>
    </label>
  );

  return (
    <form onSubmit={(e) => void guardar(e)} style={{ display: "grid", gap: 6, padding: 8, border: "1px solid var(--linea)" }}>
      {campo("Qué quiere", r.sueno, (v) => setR({ ...r, sueno: v }), SUENOS, (o) => t.suenos[o as (typeof SUENOS)[number]].titulo)}
      {campo("Dónde está", r.ubicacion, (v) => setR({ ...r, ubicacion: v, situacion: v === "fuera" ? null : r.situacion ?? SITUACIONES[0], tiempo: v === "fuera" ? null : r.tiempo ?? TIEMPOS[0] }), UBICACIONES, (o) => t.ubicaciones[o as (typeof UBICACIONES)[number]].titulo)}
      {campo("Situación", fuera ? "" : r.situacion ?? SITUACIONES[0], (v) => setR({ ...r, situacion: v }), SITUACIONES, (o) => t.situaciones[o as (typeof SITUACIONES)[number]].titulo, fuera)}
      {campo("Tiempo en España", fuera ? "" : r.tiempo ?? TIEMPOS[0], (v) => setR({ ...r, tiempo: v }), TIEMPOS, (o) => t.tiempos[o as (typeof TIEMPOS)[number]], fuera)}
      {campo("Pasaporte", r.pasaporte, (v) => setR({ ...r, pasaporte: v }), PASAPORTES, (o) => t.pasaportes[o as (typeof PASAPORTES)[number]].titulo)}
      <label style={{ display: "grid", gap: 2, fontSize: "0.72rem", color: "var(--texto-suave)" }}>
        Gestión de citas
        <select className="campo-mini" value={nivelCita} onChange={(e) => setNivelCita(e.target.value)}>
          <option value="">Sin gestión de citas</option>
          <option value="puede_esperar">{t.nivelesCita.puede_esperar.nombre}</option>
          <option value="urgente">{t.nivelesCita.urgente.nombre}</option>
        </select>
      </label>
      <label style={{ display: "flex", gap: 6, alignItems: "center", fontSize: "0.75rem" }}>
        <input type="checkbox" checked={conGuardian} onChange={(e) => setConGuardian(e.target.checked)} /> Con Guardián de renovación
      </label>
      <button type="submit" className="chip-cristal plasma-oro" disabled={ocupado}>Guardar ruta corregida</button>
      {mensaje && <span role="alert" style={{ color: "var(--rojo-texto)", fontSize: "0.8rem" }}>{mensaje}</span>}
    </form>
  );
}
