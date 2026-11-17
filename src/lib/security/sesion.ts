import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";

// Sesión de la Dirección. La cookie lleva solo un identificador aleatorio
// firmado con HMAC y su caducidad; la sesión de verdad vive en la base de datos
// (direccion_sesiones), donde se puede revocar. El proxy comprueba la firma y
// cada página y handler comprueba además la base de datos.
const PRODUCCION = process.env.NODE_ENV === "production";
// «__Host-» obliga al navegador a exigir Secure, Path=/ y ningún Domain: la
// cookie no se puede plantar desde otro subdominio.
export const COOKIE_SESION = PRODUCCION ? "__Host-burofast.direccion" : "burofast.direccion";
export const DURACION_SESION_S = 4 * 60 * 60; // caducidad absoluta
export const INACTIVIDAD_MAX_S = 30 * 60; // sin uso, la sesión se cierra

export const ROLES = ["viewer", "operator", "owner"] as const;
export type Rol = (typeof ROLES)[number];
// sub = correo de la cuenta que entró (siempre OWNER_EMAIL).
export type Sesion = { sub: string; rol: Rol; exp: number };
export type TokenDireccion = { sid: string; exp: number };

function secreto() {
  const valor = process.env.AUTH_SECRET?.trim();
  if (!valor || valor.length < 32) throw new Error("AUTH_SECRET_NOT_CONFIGURED");
  return valor;
}

function secretoValido() {
  return Boolean(process.env.AUTH_SECRET && process.env.AUTH_SECRET.trim().length >= 32);
}

// La Dirección solo se abre con Google y con la cuenta de OWNER_EMAIL.
export function autenticacionConfigurada() {
  return secretoValido() && Boolean(process.env.OWNER_EMAIL?.trim() && process.env.GOOGLE_CLIENT_ID?.trim() && process.env.GOOGLE_CLIENT_SECRET?.trim());
}

// Clave de las huellas de la Dirección (sub de Google, IP, navegador, sid),
// derivada de AUTH_SECRET y distinta de la que firma la cookie. Con SHA-256 a
// secas una IP se recupera probando las 2^32 posibles; con HMAC no.
// Rotar AUTH_SECRET invalida las sesiones y el «sub» fijado: hay que vaciar
// direccion_identidad (docs/variables-entorno.md).
export function claveHuella() {
  return createHmac("sha256", secreto()).update("burofast:direccion:huella").digest();
}

function firmar(cuerpo: string) {
  return createHmac("sha256", secreto()).update(`direccion:${cuerpo}`).digest("base64url");
}

export function nuevoIdSesion() {
  return randomBytes(32).toString("base64url");
}

export function crearTokenDireccion(sid: string, ahoraMs = Date.now()) {
  const datos: TokenDireccion = { sid, exp: Math.floor(ahoraMs / 1000) + DURACION_SESION_S };
  const cuerpo = Buffer.from(JSON.stringify(datos)).toString("base64url");
  return `${cuerpo}.${firmar(cuerpo)}`;
}

export function leerTokenDireccion(token: string | undefined | null, ahoraMs = Date.now()): TokenDireccion | null {
  if (!token || token.length > 400) return null;
  const [cuerpo, firma, sobra] = token.split(".");
  if (!cuerpo || !firma || sobra !== undefined) return null;
  let esperada: Buffer;
  try {
    esperada = Buffer.from(firmar(cuerpo));
  } catch {
    return null;
  }
  const recibida = Buffer.from(firma);
  if (esperada.length !== recibida.length || !timingSafeEqual(esperada, recibida)) return null;
  try {
    const datos = JSON.parse(Buffer.from(cuerpo, "base64url").toString("utf8")) as TokenDireccion;
    if (typeof datos.sid !== "string" || datos.sid.length < 40 || typeof datos.exp !== "number") return null;
    if (datos.exp * 1000 <= ahoraMs) return null;
    return datos;
  } catch {
    return null;
  }
}

// La cookie de la Dirección es Strict: ninguna web ajena puede hacer que el
// navegador la envíe. Por eso la vuelta de Google entra por una página
// intermedia propia (ver /api/v1/auth/google/callback).
export const opcionesCookieDireccion = (maxAge: number) => ({
  httpOnly: true,
  secure: PRODUCCION,
  sameSite: "strict" as const,
  path: "/",
  maxAge,
});

const RANGO: Record<Rol, number> = { viewer: 0, operator: 1, owner: 2 };

export function tieneRol(sesion: Sesion | null, minimo: Rol) {
  return Boolean(sesion) && RANGO[(sesion as Sesion).rol] >= RANGO[minimo];
}
