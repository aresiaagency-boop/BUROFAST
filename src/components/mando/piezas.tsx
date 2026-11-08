import type { EstadoCita, SemaforoSla } from "@/lib/citas";
import type { EstadoPieza } from "@/lib/estado";

// Estado = texto + icono (punto) + color. El color nunca va solo.
export function EstadoBadge({ tono, texto }: { tono: "ok" | "aviso" | "critico" | "desconocido" | "info" | "demo"; texto: string }) {
  return <span className={`estado ${tono}`}>{texto}</span>;
}

const PIEZA: Record<EstadoPieza, { tono: "ok" | "aviso" | "critico" | "desconocido"; texto: string }> = {
  operativo: { tono: "ok", texto: "Operativo" },
  desconectado: { tono: "critico", texto: "Desconectado" },
  no_configurado: { tono: "desconocido", texto: "No configurado" },
  error: { tono: "aviso", texto: "Con error" },
};
export function EstadoPiezaBadge({ estado }: { estado: EstadoPieza }) {
  return <EstadoBadge {...PIEZA[estado]} />;
}

const CITA: Record<EstadoCita, { tono: "ok" | "aviso" | "critico" | "desconocido" | "info"; texto: string }> = {
  en_espera: { tono: "desconocido", texto: "Espera resolución" },
  requerida: { tono: "info", texto: "Requerida" },
  en_gestion: { tono: "aviso", texto: "En gestión" },
  reservada: { tono: "ok", texto: "Reservada" },
  confirmada: { tono: "ok", texto: "Confirmada" },
  asistida: { tono: "desconocido", texto: "Asistida" },
  reprogramar: { tono: "aviso", texto: "Reprogramar" },
  cancelada: { tono: "desconocido", texto: "Cancelada" },
  sin_cita_reembolso: { tono: "critico", texto: "Sin cita · reembolso" },
};
export function EstadoCitaBadge({ estado }: { estado: EstadoCita }) {
  return <EstadoBadge {...CITA[estado]} />;
}

const SLA: Record<SemaforoSla, { tono: "ok" | "aviso" | "critico" | "desconocido"; texto: string }> = {
  en_plazo: { tono: "ok", texto: "En plazo" },
  vence_pronto: { tono: "aviso", texto: "Vence pronto" },
  vencida: { tono: "critico", texto: "Vencida" },
  cerrada: { tono: "desconocido", texto: "Sin plazo" },
  en_espera: { tono: "desconocido", texto: "Aún no cuenta" },
};
export function SlaBadge({ semaforo }: { semaforo: SemaforoSla }) {
  return <EstadoBadge {...SLA[semaforo]} />;
}

export function Metrica({ nombre, valor, fuente, consultadoEn }: { nombre: string; valor: string | number; fuente: string; consultadoEn: Date | null }) {
  return (
    <div className="metrica">
      <div className="metrica-valor">{valor}</div>
      <div className="metrica-nombre">{nombre}</div>
      <div className="metrica-fuente">{fuente} · {consultadoEn ? `actualizado ${hace(consultadoEn)}` : "sin dato"}</div>
    </div>
  );
}

export function Vacio({ titulo, texto }: { titulo: string; texto: string }) {
  return (
    <div className="vacio">
      <strong>{titulo}</strong>
      {texto}
    </div>
  );
}

const relativo = new Intl.RelativeTimeFormat("es", { numeric: "auto" });
export function hace(fecha: Date, ahora = new Date()) {
  const segundos = Math.round((fecha.getTime() - ahora.getTime()) / 1000);
  const abs = Math.abs(segundos);
  if (abs < 60) return relativo.format(segundos, "second");
  if (abs < 3600) return relativo.format(Math.round(segundos / 60), "minute");
  if (abs < 86_400) return relativo.format(Math.round(segundos / 3600), "hour");
  return relativo.format(Math.round(segundos / 86_400), "day");
}

export const fechaHora = new Intl.DateTimeFormat("es-ES", { dateStyle: "medium", timeStyle: "short", timeZone: "Europe/Madrid" });
