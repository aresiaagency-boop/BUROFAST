import type { Comprobacion } from "@/lib/estado";

export function estadoGlobal(piezas: Comprobacion[]) {
  if (piezas.some((p) => p.estado === "desconectado" || p.estado === "error")) return { tono: "critico" as const, texto: "Hay piezas caídas" };
  if (piezas.some((p) => p.estado === "no_configurado")) return { tono: "aviso" as const, texto: "Configuración incompleta" };
  return { tono: "ok" as const, texto: "Todo operativo" };
}

export const NOMBRE_PIEZA: Record<Comprobacion["id"], string> = {
  postgres: "PostgreSQL",
  cifrado: "Cifrado de datos personales",
  autenticacion: "Autenticación",
  n8n: "n8n (orquestador de HESTIA)",
  whatsapp: "Número de WhatsApp de HESTIA",
  hestia_webhook: "Credenciales de HESTIA (contexto y eventos)",
};
