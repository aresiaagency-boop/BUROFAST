import type { Comprobacion } from "@/lib/estado";

export function estadoGlobal(piezas: Comprobacion[]) {
  if (piezas.some((p) => p.estado === "desconectado" || p.estado === "error")) return { tono: "critico" as const, texto: "Hay piezas caídas" };
  if (piezas.some((p) => p.estado === "no_configurado")) return { tono: "aviso" as const, texto: "Configuración incompleta" };
  return { tono: "ok" as const, texto: "Todo operativo" };
}

export const NOMBRE_PIEZA: Record<Comprobacion["id"], string> = {
  postgres: "PostgreSQL (EasyPanel)",
  cifrado: "Cifrado de datos personales",
  autenticacion: "Acceso del equipo",
  google: "Acceso con Google",
  n8n: "n8n (servidor de HESTIA)",
  hestia_ia: "HESTIA orquestadora (IA vía n8n)",
  whatsapp: "Número de WhatsApp de HESTIA",
  hestia_webhook: "Credenciales de HESTIA por WhatsApp",
  stripe: "Stripe (cobros)",
  stripe_webhook: "Webhook de Stripe",
};
