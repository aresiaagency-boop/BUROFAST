import { createHmac, timingSafeEqual } from "node:crypto";

// Sesión del centro de mando: cookie firmada con HMAC, HttpOnly, ocho horas.
// La firma se comprueba en el proxy Y en cada handler: ocultar un botón no es
// seguridad, y el proxy solo es la primera barrera.
export const COOKIE_SESION = "burofast.session";
export const DURACION_SESION_S = 8 * 60 * 60;

export const ROLES = ["viewer", "operator", "owner"] as const;
export type Rol = (typeof ROLES)[number];
export type Sesion = { sub: string; rol: Rol; exp: number };

function secreto() {
  const valor = process.env.AUTH_SECRET?.trim();
  if (!valor || valor.length < 32) throw new Error("AUTH_SECRET_NOT_CONFIGURED");
  return valor;
}

export function autenticacionConfigurada() {
  return Boolean(
    process.env.AUTH_SECRET && process.env.AUTH_SECRET.trim().length >= 32 && process.env.OWNER_EMAIL && process.env.OWNER_PASSWORD_HASH,
  );
}

function firmar(cuerpo: string) {
  return createHmac("sha256", secreto()).update(cuerpo).digest("base64url");
}

export function crearTokenSesion(sub: string, rol: Rol, ahoraMs = Date.now()) {
  const sesion: Sesion = { sub, rol, exp: Math.floor(ahoraMs / 1000) + DURACION_SESION_S };
  const cuerpo = Buffer.from(JSON.stringify(sesion)).toString("base64url");
  return `${cuerpo}.${firmar(cuerpo)}`;
}

export function leerTokenSesion(token: string | undefined | null, ahoraMs = Date.now()): Sesion | null {
  if (!token) return null;
  const [cuerpo, firma] = token.split(".");
  if (!cuerpo || !firma) return null;
  let esperada: Buffer;
  try {
    esperada = Buffer.from(firmar(cuerpo));
  } catch {
    return null;
  }
  const recibida = Buffer.from(firma);
  if (esperada.length !== recibida.length || !timingSafeEqual(esperada, recibida)) return null;
  try {
    const sesion = JSON.parse(Buffer.from(cuerpo, "base64url").toString("utf8")) as Sesion;
    if (!ROLES.includes(sesion.rol) || typeof sesion.sub !== "string") return null;
    if (sesion.exp * 1000 <= ahoraMs) return null;
    return sesion;
  } catch {
    return null;
  }
}

const RANGO: Record<Rol, number> = { viewer: 0, operator: 1, owner: 2 };

export function tieneRol(sesion: Sesion | null, minimo: Rol) {
  return Boolean(sesion) && RANGO[(sesion as Sesion).rol] >= RANGO[minimo];
}
