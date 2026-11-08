import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";

export function correlationId(request: Request) {
  const entrante = request.headers.get("x-correlation-id");
  return entrante && /^[\w-]{8,64}$/.test(entrante) ? entrante : randomUUID();
}

// IP para el límite de peticiones. El primer valor de x-forwarded-for lo puede
// escribir el cliente; el fiable es el que añade NUESTRO proxy, que va al final.
// TRUSTED_PROXY_HOPS = cuántos proxys propios hay delante (Traefik de
// EasyPanel = 1). Con 0, la cabecera se ignora.
export function ipCliente(request: Request) {
  const saltos = Number.parseInt(process.env.TRUSTED_PROXY_HOPS ?? "1", 10);
  const cadena = (request.headers.get("x-forwarded-for") ?? "").split(",").map((v) => v.trim()).filter(Boolean);
  if (saltos > 0 && cadena.length >= saltos) return cadena[cadena.length - saltos];
  return request.headers.get("x-real-ip") ?? "desconocida";
}

export function json(datos: unknown, init: { status?: number; correlation: string }) {
  return NextResponse.json(datos, {
    status: init.status ?? 200,
    headers: { "x-correlation-id": init.correlation, "cache-control": "no-store" },
  });
}

export function error(codigo: string, mensaje: string, init: { status: number; correlation: string; detalle?: unknown }) {
  return json({ error: { codigo, mensaje, correlationId: init.correlation, detalle: init.detalle } }, init);
}

export function log(nivel: "info" | "warn" | "error", evento: string, datos: Record<string, unknown>) {
  const linea = JSON.stringify({ nivel, evento, ts: new Date().toISOString(), ...datos });
  if (nivel === "error") console.error(linea);
  else if (nivel === "warn") console.warn(linea);
  else if ((process.env.LOG_LEVEL ?? "info") !== "warn") console.log(linea);
}

// Protección CSRF para peticiones que cambian estado: si el navegador manda
// Origin, tiene que ser el nuestro. Las llamadas máquina (n8n) no mandan Origin
// y van firmadas por otra vía.
export function origenPermitido(request: Request) {
  const origen = request.headers.get("origin");
  if (!origen) return true;
  const host = request.headers.get("x-forwarded-host") ?? request.headers.get("host");
  try {
    return new URL(origen).host === host;
  } catch {
    return false;
  }
}
