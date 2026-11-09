import type { AgenteId, MotorId } from "@/lib/motores";
import { AGENTE_DE_MOTOR } from "@/lib/motores";

// El mapa de la superapp: un único sitio dice qué motor vive en qué ruta y
// qué agente lo mueve.
export const ENTRADAS = [
  { id: "nucleo", ruta: "", agente: "HESTIA" },
  { id: "camino", ruta: "/camino", agente: AGENTE_DE_MOTOR.camino },
  { id: "citas", ruta: "/citas", agente: AGENTE_DE_MOTOR.citas },
  { id: "documentos", ruta: "/documentos", agente: AGENTE_DE_MOTOR.documentos },
  { id: "guardian", ruta: "/guardian", agente: AGENTE_DE_MOTOR.guardian },
  { id: "expediente", ruta: "/expediente", agente: AGENTE_DE_MOTOR.expediente },
] as const satisfies readonly { id: "nucleo" | MotorId; ruta: string; agente: AgenteId }[];

export type EntradaId = (typeof ENTRADAS)[number]["id"];

// En móvil caben cinco pestañas: Guardián se abre desde el Núcleo.
export const PESTANAS: EntradaId[] = ["nucleo", "camino", "citas", "documentos", "expediente"];

export function entradaDeRuta(pathname: string): EntradaId {
  const segmento = pathname.split("/")[2] ?? "";
  const encontrada = ENTRADAS.find((e) => e.ruta === `/${segmento}`);
  return encontrada ? encontrada.id : "nucleo";
}

export function motorDeRuta(pathname: string): MotorId | null {
  const entrada = entradaDeRuta(pathname);
  return entrada === "nucleo" ? null : entrada;
}
