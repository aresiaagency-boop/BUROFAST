import { createHmac, timingSafeEqual } from "node:crypto";

// Fichas firmadas de uso único por propósito (acceso de cliente, estado de
// OAuth, permiso de pago). La clave de cada propósito se deriva de AUTH_SECRET:
// una ficha de pago nunca sirve como sesión, ni al revés.

export type Proposito = "cliente" | "oauth-google" | "pago";

function clave(proposito: Proposito) {
  const secreto = process.env.AUTH_SECRET?.trim();
  if (!secreto || secreto.length < 32) throw new Error("AUTH_SECRET_NOT_CONFIGURED");
  return createHmac("sha256", secreto).update(`burofast:${proposito}`).digest();
}

export function selloConfigurado() {
  const secreto = process.env.AUTH_SECRET?.trim();
  return Boolean(secreto && secreto.length >= 32);
}

export function sellar<T extends Record<string, unknown>>(datos: T, segundos: number, proposito: Proposito, ahoraMs = Date.now()) {
  const cuerpo = Buffer.from(JSON.stringify({ ...datos, exp: Math.floor(ahoraMs / 1000) + segundos })).toString("base64url");
  const firma = createHmac("sha256", clave(proposito)).update(cuerpo).digest("base64url");
  return `${cuerpo}.${firma}`;
}

export function abrir<T extends Record<string, unknown>>(ficha: string | null | undefined, proposito: Proposito, ahoraMs = Date.now()): (T & { exp: number }) | null {
  if (!ficha) return null;
  const [cuerpo, firma] = ficha.split(".");
  if (!cuerpo || !firma) return null;
  let esperada: Buffer;
  try {
    esperada = Buffer.from(createHmac("sha256", clave(proposito)).update(cuerpo).digest("base64url"));
  } catch {
    return null;
  }
  const recibida = Buffer.from(firma);
  if (esperada.length !== recibida.length || !timingSafeEqual(esperada, recibida)) return null;
  try {
    const datos = JSON.parse(Buffer.from(cuerpo, "base64url").toString("utf8")) as T & { exp: number };
    if (typeof datos.exp !== "number" || datos.exp * 1000 <= ahoraMs) return null;
    return datos;
  } catch {
    return null;
  }
}
