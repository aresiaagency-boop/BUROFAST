import type { CitaId, NivelCita } from "@/lib/catalogo";
import { CITAS, DIAS_GARANTIA_URGENTE, NIVELES_CITA, presupuesto } from "@/lib/catalogo";
import type { DocumentoId, Respuestas } from "@/lib/diagnostico";
import { diagnosticar } from "@/lib/diagnostico";

// Los motores de la superapp. Cada uno tiene un agente que lo representa y
// todos son deterministas: misma entrada, misma salida, auditables. HESTIA
// (la IA, en n8n) los consulta como herramientas y explica el resultado; no
// los sustituye.

export const MOTORES = ["camino", "citas", "documentos", "guardian", "expediente"] as const;
export type MotorId = (typeof MOTORES)[number];

export const AGENTES = ["HESTIA", "ARIADNA", "CRONOS", "MNEMOSINE", "ARGOS", "TEMIS"] as const;
export type AgenteId = (typeof AGENTES)[number];

export const AGENTE_DE_MOTOR: Record<MotorId, AgenteId> = {
  camino: "ARIADNA",
  citas: "CRONOS",
  documentos: "MNEMOSINE",
  guardian: "ARGOS",
  expediente: "HESTIA",
};

// ARIADNA · el hilo que saca del laberinto: ruta + presupuesto por nivel.
export function motorAriadna(respuestas: Respuestas) {
  const ruta = diagnosticar(respuestas);
  const base = { producto: ruta.producto, citas: ruta.citas, conGuardian: false };
  return {
    ruta,
    presupuestos: {
      sinGestionCitas: presupuesto({ ...base, nivelCita: null }),
      puedeEsperar: presupuesto({ ...base, nivelCita: "puede_esperar" }),
      urgente: presupuesto({ ...base, nivelCita: "urgente" }),
    },
  };
}

// CRONOS · el tiempo de las citas: qué cita, quién la da, cuándo y cuánto
// cuesta GESTIONARLA (la cita oficial es gratis).
export function motorCronos(citas: readonly CitaId[]) {
  const detalle = citas.map((id) => ({ id, ...CITAS[id] }));
  const cobrables = detalle.filter((c) => c.gestionable).length;
  const porNivel = Object.fromEntries(
    (Object.keys(NIVELES_CITA) as NivelCita[]).map((nivel) => [nivel, cobrables * NIVELES_CITA[nivel].precioCentimos]),
  ) as Record<NivelCita, number>;
  return { citas: detalle, cobrables, porNivel, garantiaUrgenteDias: DIAS_GARANTIA_URGENTE };
}

// MNEMÓSINE · la memoria del expediente: qué documento, si viene de fuera
// (legalización/apostilla y traducción jurada) y si se pide reciente.
export const META_DOCUMENTO: Record<DocumentoId, { extranjero: boolean; reciente: boolean }> = {
  pasaporte: { extranjero: false, reciente: false },
  padron: { extranjero: false, reciente: true },
  padron_historico: { extranjero: false, reciente: true },
  antecedentes_origen: { extranjero: true, reciente: true },
  antecedentes_espana: { extranjero: false, reciente: true },
  tie_actual: { extranjero: false, reciente: false },
  contrato_u_oferta: { extranjero: false, reciente: false },
  medios_economicos: { extranjero: false, reciente: true },
  matricula: { extranjero: false, reciente: false },
  seguro_medico: { extranjero: false, reciente: false },
  vinculo_familiar: { extranjero: true, reciente: false },
  informe_vivienda: { extranjero: false, reciente: true },
  certificado_nacimiento: { extranjero: true, reciente: false },
  ccse_dele: { extranjero: false, reciente: false },
  plan_negocio: { extranjero: false, reciente: false },
  resolucion_regularizacion: { extranjero: false, reciente: false },
};

export const ESTADOS_DOCUMENTO = ["tengo", "pidiendo", "falta"] as const;
export type EstadoDocumento = (typeof ESTADOS_DOCUMENTO)[number];

export function motorMnemosine(documentos: readonly DocumentoId[], estados: Partial<Record<DocumentoId, EstadoDocumento>> = {}) {
  const lista = documentos.map((id) => ({ id, ...META_DOCUMENTO[id], estado: estados[id] ?? ("falta" as EstadoDocumento) }));
  const listos = lista.filter((d) => d.estado === "tengo").length;
  const enCamino = lista.filter((d) => d.estado === "pidiendo").length;
  return { documentos: lista, listos, enCamino, total: lista.length, porcentaje: lista.length ? Math.round((listos * 100) / lista.length) : 100 };
}

// ARGOS · cien ojos sobre los plazos. Regla general de renovación de una
// autorización temporal: se pide en los 60 días naturales antes de caducar y
// se admite hasta 90 días después (con posible sanción). El abogado confirma
// el caso concreto: es orientación, no un dictamen.
export const DIAS_ANTES_RENOVAR = 60;
export const DIAS_DESPUES_RENOVAR = 90;
const DIA_MS = 86_400_000;

export type EstadoPlazo = "lejos" | "ventana" | "gracia" | "fuera";

function diaUtc(iso: string) {
  const [anio, mes, dia] = iso.split("-").map(Number);
  return Date.UTC(anio, mes - 1, dia);
}
const aIso = (ms: number) => new Date(ms).toISOString().slice(0, 10);

export function esFechaIso(valor: unknown): valor is string {
  if (typeof valor !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(valor)) return false;
  const ms = diaUtc(valor);
  return Number.isFinite(ms) && aIso(ms) === valor;
}

export function motorArgos(caducidadIso: string, hoyIso: string) {
  const caducidad = diaUtc(caducidadIso);
  const hoy = diaUtc(hoyIso);
  const abre = caducidad - DIAS_ANTES_RENOVAR * DIA_MS;
  const cierra = caducidad + DIAS_DESPUES_RENOVAR * DIA_MS;
  const estado: EstadoPlazo = hoy < abre ? "lejos" : hoy <= caducidad ? "ventana" : hoy <= cierra ? "gracia" : "fuera";
  return {
    estado,
    abreVentana: aIso(abre),
    caducidad: aIso(caducidad),
    cierraGracia: aIso(cierra),
    diasHastaVentana: Math.max(0, Math.round((abre - hoy) / DIA_MS)),
    diasHastaCaducidad: Math.round((caducidad - hoy) / DIA_MS),
    diasHastaCierre: Math.round((cierra - hoy) / DIA_MS),
  };
}

// TEMIS · las reglas que ningún agente se salta. Las mismas que aplica el
// prompt de HESTIA y que enseña la interfaz.
export const REGLAS_TEMIS = [
  "ia_se_identifica",
  "abogado_revisa",
  "sin_promesas",
  "cita_gratis",
  "sin_bots",
  "urgente_no_salta_cola",
  "asilo_persona",
  "tasas_aparte",
  "datos_cifrados",
  "emergencias",
] as const;
export type ReglaTemis = (typeof REGLAS_TEMIS)[number];
