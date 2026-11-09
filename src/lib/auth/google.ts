import { createHash, randomBytes } from "node:crypto";
import { urlBase } from "@/lib/auth/base";
import { abrir, sellar, selloConfigurado } from "@/lib/security/sello";

// Acceso con Google (OpenID Connect, flujo de código con PKCE). Sin librerías:
// el id_token llega directamente del endpoint de tokens de Google por TLS, así
// que basta con validar sus claims (aud, iss, exp, nonce, email verificado).

const AUTORIZAR = "https://accounts.google.com/o/oauth2/v2/auth";
const TOKENS = "https://oauth2.googleapis.com/token";
export const COOKIE_OAUTH = "burofast.oauth";
const DURACION_ESTADO_S = 10 * 60;

export function googleConfigurado() {
  return Boolean(process.env.GOOGLE_CLIENT_ID?.trim() && process.env.GOOGLE_CLIENT_SECRET?.trim() && urlBase() && selloConfigurado());
}

export function urlRetorno() {
  const base = urlBase();
  if (!base) throw new Error("APP_BASE_URL_NOT_CONFIGURED");
  return `${base}/api/v1/auth/google/callback`;
}

const base64url = (buffer: Buffer) => buffer.toString("base64url");

export function iniciarGoogle(destino: string) {
  const state = base64url(randomBytes(24));
  const nonce = base64url(randomBytes(24));
  const verificador = base64url(randomBytes(48));
  const desafio = base64url(createHash("sha256").update(verificador).digest());
  const url = new URL(AUTORIZAR);
  url.searchParams.set("client_id", process.env.GOOGLE_CLIENT_ID?.trim() ?? "");
  url.searchParams.set("redirect_uri", urlRetorno());
  url.searchParams.set("response_type", "code");
  url.searchParams.set("scope", "openid email profile");
  url.searchParams.set("state", state);
  url.searchParams.set("nonce", nonce);
  url.searchParams.set("code_challenge", desafio);
  url.searchParams.set("code_challenge_method", "S256");
  url.searchParams.set("prompt", "select_account");
  const cookie = sellar({ state, nonce, verificador, destino }, DURACION_ESTADO_S, "oauth-google");
  return { url: url.toString(), cookie, maxAge: DURACION_ESTADO_S };
}

export type EstadoOauth = { state: string; nonce: string; verificador: string; destino: string };

export function leerEstadoOauth(cookie: string | undefined) {
  return abrir<EstadoOauth>(cookie, "oauth-google");
}

export type ClaimsGoogle = { iss?: string; aud?: string | string[]; exp?: number; nonce?: string; email?: string; email_verified?: boolean | string; name?: string; sub?: string };

export type IdentidadGoogle = { email: string; nombre: string | null; sub: string };

// Función pura para poder probarla sin red.
export function validarClaims(claims: ClaimsGoogle, esperado: { clientId: string; nonce: string; ahoraMs?: number }): IdentidadGoogle | null {
  const ahora = Math.floor((esperado.ahoraMs ?? Date.now()) / 1000);
  const audiencias = Array.isArray(claims.aud) ? claims.aud : [claims.aud];
  if (!claims.iss || !["https://accounts.google.com", "accounts.google.com"].includes(claims.iss)) return null;
  if (!audiencias.includes(esperado.clientId)) return null;
  if (typeof claims.exp !== "number" || claims.exp <= ahora) return null;
  if (!claims.nonce || claims.nonce !== esperado.nonce) return null;
  if (!(claims.email_verified === true || claims.email_verified === "true")) return null;
  if (!claims.email || !claims.sub) return null;
  return { email: claims.email.trim().toLowerCase(), nombre: claims.name?.trim() || null, sub: claims.sub };
}

export function decodificarIdToken(idToken: string): ClaimsGoogle | null {
  const partes = idToken.split(".");
  if (partes.length !== 3) return null;
  try {
    return JSON.parse(Buffer.from(partes[1], "base64url").toString("utf8")) as ClaimsGoogle;
  } catch {
    return null;
  }
}

export async function canjearCodigo(codigo: string, estado: EstadoOauth): Promise<IdentidadGoogle | null> {
  const clientId = process.env.GOOGLE_CLIENT_ID?.trim() ?? "";
  const respuesta = await fetch(TOKENS, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code: codigo,
      client_id: clientId,
      client_secret: process.env.GOOGLE_CLIENT_SECRET?.trim() ?? "",
      redirect_uri: urlRetorno(),
      grant_type: "authorization_code",
      code_verifier: estado.verificador,
    }),
    signal: AbortSignal.timeout(10_000),
    cache: "no-store",
  });
  if (!respuesta.ok) return null;
  const cuerpo = (await respuesta.json().catch(() => null)) as { id_token?: string } | null;
  if (!cuerpo?.id_token) return null;
  const claims = decodificarIdToken(cuerpo.id_token);
  return claims ? validarClaims(claims, { clientId, nonce: estado.nonce }) : null;
}
