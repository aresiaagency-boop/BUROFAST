import type { NivelCita } from "@/lib/catalogo";
import { DIAS_GARANTIA_URGENTE, NIVELES_CITA } from "@/lib/catalogo";

// Ciclo de vida de una cita gestionada. La regla de qué transición vale vive
// aquí y sólo aquí: la API la aplica y la interfaz sólo pinta los botones que
// esta función permite.
export const ESTADOS_CITA = [
  "en_espera",
  "requerida",
  "en_gestion",
  "reservada",
  "confirmada",
  "asistida",
  "reprogramar",
  "cancelada",
  "sin_cita_reembolso",
] as const;
export type EstadoCita = (typeof ESTADOS_CITA)[number];

const TRANSICIONES: Record<EstadoCita, readonly EstadoCita[]> = {
  // Esperando la resolución que hace posible la cita: al activarla empieza a
  // contar el plazo de primera acción y, en urgente, la garantía.
  en_espera: ["requerida", "cancelada"],
  requerida: ["en_gestion", "cancelada"],
  en_gestion: ["reservada", "cancelada", "sin_cita_reembolso"],
  reservada: ["confirmada", "reprogramar", "cancelada"],
  confirmada: ["asistida", "reprogramar", "cancelada"],
  reprogramar: ["en_gestion", "cancelada"],
  asistida: [],
  cancelada: [],
  sin_cita_reembolso: [],
};

// El reembolso solo existe en urgente: en «puedo esperar» no hay garantía.
export function transicionesPermitidas(estado: EstadoCita, nivel: NivelCita) {
  return TRANSICIONES[estado].filter((hacia) => hacia !== "sin_cita_reembolso" || nivel === "urgente");
}

export function puedeTransicionar(desde: EstadoCita, hacia: EstadoCita, nivel: NivelCita) {
  return transicionesPermitidas(desde, nivel).includes(hacia);
}

export function esEstadoFinal(estado: EstadoCita) {
  return TRANSICIONES[estado].length === 0;
}

// Fecha límite de la primera acción del equipo según el nivel contratado.
export function venceSla(nivel: NivelCita, creadaEn: Date) {
  return new Date(creadaEn.getTime() + NIVELES_CITA[nivel].primeraAccionHoras * 3_600_000);
}

export function venceGarantiaUrgente(creadaEn: Date) {
  return new Date(creadaEn.getTime() + DIAS_GARANTIA_URGENTE * 86_400_000);
}

export type SemaforoSla = "en_plazo" | "vence_pronto" | "vencida" | "cerrada" | "en_espera";

export function semaforoSla(input: {
  estado: EstadoCita;
  nivel: NivelCita;
  slaVenceEn: Date | null;
  ahora?: Date;
}): SemaforoSla {
  if (input.estado === "en_espera" || !input.slaVenceEn) return "en_espera";
  if (esEstadoFinal(input.estado) || input.estado === "reservada" || input.estado === "confirmada") {
    return "cerrada";
  }
  const ahora = input.ahora ?? new Date();
  const restanteMs = input.slaVenceEn.getTime() - ahora.getTime();
  if (restanteMs < 0) return "vencida";
  // «Pronto» es la cuarta parte del plazo del nivel: 6 h en urgente, 30 h en
  // puedo esperar. Así el aviso llega con margen real para actuar.
  const margenMs = (NIVELES_CITA[input.nivel].primeraAccionHoras * 3_600_000) / 4;
  return restanteMs <= margenMs ? "vence_pronto" : "en_plazo";
}
