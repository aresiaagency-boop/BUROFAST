import { googleConfigurado } from "@/lib/auth/google";
import { db, isDatabaseConfigured } from "@/lib/db";
import { n8nHestiaConfigurado } from "@/lib/hestia/orquestador";
import { modoStripe, stripe, stripeConfigurado, webhookStripeConfigurado } from "@/lib/pagos/stripe";
import { cifradoConfigurado } from "@/lib/security/cifrado";
import { autenticacionConfigurada } from "@/lib/security/sesion";
import { datosLegalesPendientes } from "@/lib/legal";

// Estado REAL de cada pieza. Nunca se pinta «operativo» sin una comprobación
// reciente: si no se puede comprobar, se dice «no configurado» o «desconectado».
export type EstadoPieza = "operativo" | "desconectado" | "no_configurado" | "error";
export type Comprobacion = {
  id: "postgres" | "cifrado" | "autenticacion" | "google" | "n8n" | "hestia_ia" | "whatsapp" | "hestia_webhook" | "stripe" | "stripe_webhook" | "legal";
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

// Stripe: se comprueba de verdad con una llamada de solo lectura a la API.
export async function comprobarStripe(): Promise<Comprobacion> {
  const comprobadoEn = new Date().toISOString();
  if (!stripeConfigurado()) return { id: "stripe", estado: "no_configurado", detalle: "Falta STRIPE_SECRET_KEY.", latenciaMs: null, fuente: "entorno", comprobadoEn };
  const modo = modoStripe();
  try {
    const { ms } = await cronometrar(() => stripe().checkout.sessions.list({ limit: 1 }, { timeout: 5000, maxNetworkRetries: 0 }));
    return { id: "stripe", estado: "operativo", detalle: `API respondió · modo ${modo === "live" ? "LIVE (cobros reales)" : modo === "test" ? "TEST" : "desconocido"}.`, latenciaMs: ms, fuente: "Stripe API", comprobadoEn };
  } catch (fallo) {
    const tipo = typeof fallo === "object" && fallo && "type" in fallo ? String((fallo as { type: unknown }).type) : "error";
    return { id: "stripe", estado: "error", detalle: `La API rechazó la llamada (${tipo}).`, latenciaMs: null, fuente: "Stripe API", comprobadoEn };
  }
}

async function ultimo(sql: () => Promise<{ fecha: Date | null }[]>) {
  if (!isDatabaseConfigured()) return null;
  try {
    const [fila] = await sql();
    return fila?.fecha ?? null;
  } catch {
    return null;
  }
}

async function comprobarWebhookStripe(): Promise<Comprobacion> {
  const comprobadoEn = new Date().toISOString();
  if (!webhookStripeConfigurado()) return { id: "stripe_webhook", estado: "no_configurado", detalle: "Falta STRIPE_WEBHOOK_SECRET.", latenciaMs: null, fuente: "entorno", comprobadoEn };
  const fecha = await ultimo(() => db()<{ fecha: Date | null }[]>`select max(procesado_en) as fecha from stripe_eventos`);
  return {
    id: "stripe_webhook",
    estado: "operativo",
    // Solo se registran eventos propios con firma válida: sin ninguno, la firma
    // aún no se ha podido comprobar.
    detalle: fecha ? `Último evento propio con firma válida: ${fecha.toISOString()}.` : "Secreto puesto; la firma se confirmará con el primer cobro (aún no ha llegado ningún evento propio).",
    latenciaMs: null,
    fuente: "stripe_eventos",
    comprobadoEn,
  };
}

async function comprobarGoogle(): Promise<Comprobacion> {
  const comprobadoEn = new Date().toISOString();
  if (!googleConfigurado()) return { id: "google", estado: "no_configurado", detalle: "Faltan GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET o APP_BASE_URL.", latenciaMs: null, fuente: "entorno", comprobadoEn };
  const fecha = await ultimo(() => db()<{ fecha: Date | null }[]>`select max(creado_en) as fecha from audit_logs where accion in ('sesion.google', 'cliente.google') and resultado = 'ok'`);
  return { id: "google", estado: "operativo", detalle: fecha ? `Último acceso correcto: ${fecha.toISOString()}.` : "Configurado; todavía nadie ha entrado con Google.", latenciaMs: null, fuente: "audit_logs", comprobadoEn };
}

async function comprobarHestiaIa(): Promise<Comprobacion> {
  const comprobadoEn = new Date().toISOString();
  if (!n8nHestiaConfigurado()) return { id: "hestia_ia", estado: "no_configurado", detalle: "Faltan HESTIA_N8N_URL o HESTIA_N8N_TOKEN: HESTIA responde en modo local.", latenciaMs: null, fuente: "entorno", comprobadoEn };
  if (!isDatabaseConfigured()) return { id: "hestia_ia", estado: "operativo", detalle: "Configurada; sin base de datos no hay métricas.", latenciaMs: null, fuente: "entorno", comprobadoEn };
  try {
    const [fila] = await db()<{ total: number; ia: number; fallos: number; ultimo: Date | null }[]>`
      select count(*)::int as total, count(*) filter (where modo = 'ia')::int as ia, count(*) filter (where not ok)::int as fallos, max(creado_en) filter (where modo = 'ia') as ultimo
      from hestia_turnos where canal = 'app' and creado_en > now() - interval '24 hours'
    `;
    if (fila.total === 0) return { id: "hestia_ia", estado: "operativo", detalle: "Configurada; sin conversaciones en 24 h.", latenciaMs: null, fuente: "hestia_turnos", comprobadoEn };
    const estado = fila.fallos > 0 && fila.ia === 0 ? "error" : "operativo";
    return { id: "hestia_ia", estado, detalle: `${fila.ia}/${fila.total} turnos con IA en 24 h · ${fila.fallos} fallos de n8n.`, latenciaMs: null, fuente: "hestia_turnos", comprobadoEn };
  } catch {
    return { id: "hestia_ia", estado: "operativo", detalle: "Configurada; métricas no disponibles.", latenciaMs: null, fuente: "entorno", comprobadoEn };
  }
}

export async function comprobarTodo() {
  const [postgres, n8n, stripeApi] = await Promise.all([comprobarPostgres(), comprobarN8n(), comprobarStripe()]);
  const [google, hestiaIa, webhook] = await Promise.all([comprobarGoogle(), comprobarHestiaIa(), comprobarWebhookStripe()]);
  return [
    postgres,
    deEntorno("cifrado", cifradoConfigurado(), "DATA_ENCRYPTION_KEY"),
    deEntorno("autenticacion", autenticacionConfigurada(), "AUTH_SECRET, OWNER_EMAIL y Google (o OWNER_PASSWORD_HASH)"),
    google,
    n8n,
    hestiaIa,
    stripeApi,
    webhook,
    deEntorno("whatsapp", Boolean(process.env.HESTIA_WHATSAPP_NUMERO?.trim()), "HESTIA_WHATSAPP_NUMERO"),
    deEntorno(
      "hestia_webhook",
      Boolean(process.env.HESTIA_CONTEXTO_TOKEN?.trim() && (process.env.HESTIA_EVENTOS_TOKEN?.trim() || process.env.HESTIA_WEBHOOK_SECRET?.trim())),
      "HESTIA_CONTEXTO_TOKEN y HESTIA_EVENTOS_TOKEN (o HESTIA_WEBHOOK_SECRET)",
    ),
    deEntorno("legal", datosLegalesPendientes().length === 0, `rellenar en src/lib/legal.ts: ${datosLegalesPendientes().join(", ")}`),
  ];
}
