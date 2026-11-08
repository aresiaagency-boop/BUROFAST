import { db, isDatabaseConfigured } from "@/lib/db";
import { cifradoConfigurado } from "@/lib/security/cifrado";
import { autenticacionConfigurada } from "@/lib/security/sesion";

// Estado REAL de cada pieza. Nunca se pinta «operativo» sin una comprobación
// reciente: si no se puede comprobar, se dice «no configurado» o «desconectado».
export type EstadoPieza = "operativo" | "desconectado" | "no_configurado" | "error";
export type Comprobacion = {
  id: "postgres" | "cifrado" | "autenticacion" | "n8n" | "whatsapp" | "hestia_webhook";
  estado: EstadoPieza;
  detalle: string;
  latenciaMs: number | null;
  fuente: string;
  comprobadoEn: string;
};

async function cronometrar<T>(fn: () => Promise<T>) {
  const inicio = performance.now();
  const valor = await fn();
  return { valor, ms: Math.round(performance.now() - inicio) };
}

export async function comprobarPostgres(): Promise<Comprobacion> {
  const comprobadoEn = new Date().toISOString();
  if (!isDatabaseConfigured()) {
    return { id: "postgres", estado: "no_configurado", detalle: "Falta DATABASE_URL.", latenciaMs: null, fuente: "entorno", comprobadoEn };
  }
  try {
    const { ms } = await cronometrar(() => db()`select 1`);
    return { id: "postgres", estado: "operativo", detalle: "select 1 respondió.", latenciaMs: ms, fuente: "PostgreSQL", comprobadoEn };
  } catch (fallo) {
    const codigo = typeof fallo === "object" && fallo && "code" in fallo ? String((fallo as { code: unknown }).code) : "SIN_CODIGO";
    return { id: "postgres", estado: "desconectado", detalle: `No responde (${codigo}).`, latenciaMs: null, fuente: "PostgreSQL", comprobadoEn };
  }
}

export async function comprobarN8n(): Promise<Comprobacion> {
  const comprobadoEn = new Date().toISOString();
  const base = process.env.N8N_BASE_URL?.trim();
  if (!base) {
    return { id: "n8n", estado: "no_configurado", detalle: "Falta N8N_BASE_URL.", latenciaMs: null, fuente: "entorno", comprobadoEn };
  }
  try {
    const { valor, ms } = await cronometrar(() => fetch(new URL("/healthz", base), { signal: AbortSignal.timeout(4000), cache: "no-store" }));
    return valor.ok
      ? { id: "n8n", estado: "operativo", detalle: "/healthz respondió 200.", latenciaMs: ms, fuente: "n8n /healthz", comprobadoEn }
      : { id: "n8n", estado: "error", detalle: `/healthz respondió ${valor.status}.`, latenciaMs: ms, fuente: "n8n /healthz", comprobadoEn };
  } catch {
    return { id: "n8n", estado: "desconectado", detalle: "No se pudo conectar en 4 s.", latenciaMs: null, fuente: "n8n /healthz", comprobadoEn };
  }
}

function deEntorno(id: Comprobacion["id"], configurado: boolean, falta: string): Comprobacion {
  return {
    id,
    estado: configurado ? "operativo" : "no_configurado",
    detalle: configurado ? "Configurado en el servidor." : `Falta ${falta}.`,
    latenciaMs: null,
    fuente: "entorno",
    comprobadoEn: new Date().toISOString(),
  };
}

export async function comprobarTodo() {
  const [postgres, n8n] = await Promise.all([comprobarPostgres(), comprobarN8n()]);
  return [
    postgres,
    deEntorno("cifrado", cifradoConfigurado(), "DATA_ENCRYPTION_KEY"),
    deEntorno("autenticacion", autenticacionConfigurada(), "AUTH_SECRET, OWNER_EMAIL u OWNER_PASSWORD_HASH"),
    n8n,
    deEntorno("whatsapp", Boolean(process.env.HESTIA_WHATSAPP_NUMERO?.trim()), "HESTIA_WHATSAPP_NUMERO"),
    deEntorno(
      "hestia_webhook",
      Boolean(process.env.HESTIA_CONTEXTO_TOKEN?.trim() && (process.env.HESTIA_EVENTOS_TOKEN?.trim() || process.env.HESTIA_WEBHOOK_SECRET?.trim())),
      "HESTIA_CONTEXTO_TOKEN y HESTIA_EVENTOS_TOKEN (o HESTIA_WEBHOOK_SECRET)",
    ),
  ];
}
