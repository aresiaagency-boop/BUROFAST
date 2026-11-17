import { createHash } from "node:crypto";
import { db, isDatabaseConfigured } from "@/lib/db";
import type { IdentidadGoogle } from "@/lib/auth/google";
import { DURACION_SESION_S, INACTIVIDAD_MAX_S, nuevoIdSesion } from "@/lib/security/sesion";

// Barrera de la Dirección. Solo entra la cuenta de Google de A.R.E.S.:
//  1. Google OIDC con PKCE, state y nonce; nada de contraseñas.
//  2. Correo exacto de OWNER_EMAIL, verificado por Google.
//  3. Autenticación reciente: Google vuelve a pedir la contraseña (max_age).
//  4. La cuenta queda fijada por su «sub» de Google en el primer acceso.
//  5. Sesión en servidor: revocable, una sola activa, ligada al navegador,
//     cuatro horas como máximo y treinta minutos de inactividad.
//  6. Bloqueo: 5 fallos en una hora bloquean la IP. Además, 20 intentos en
//     una hora de cuentas de Google que no son la de A.R.E.S., vengan de donde
//     vengan, cierran la puerta durante esa hora. Solo cuentan para ese
//     bloqueo global los intentos que superan el login de Google (caros de
//     fabricar): peticiones basura no pueden dejar fuera a la Dirección.
// Sin base de datos no hay Dirección: la barrera falla cerrada.

export const MAX_EDAD_AUTENTICACION_S = 10 * 60;
export const FALLOS_POR_IP = 5;
export const FALLOS_GLOBALES = 20;
export const VENTANA_FALLOS_MS = 60 * 60_000;

export const huella = (valor: string) => createHash("sha256").update(`burofast:direccion:${valor}`).digest("base64url");

export type MotivoRechazo = "sin_owner" | "otra_cuenta" | "no_verificada" | "autenticacion_antigua" | "identidad_distinta";

// Pura, para probarla sin red ni base de datos.
export function evaluarIdentidad(
  identidad: IdentidadGoogle,
  contexto: { ownerEmail: string | undefined; subFijado: string | null; ahoraS: number },
): { ok: true } | { ok: false; motivo: MotivoRechazo } {
  const owner = contexto.ownerEmail?.trim().toLowerCase();
  if (!owner) return { ok: false, motivo: "sin_owner" };
  if (identidad.email !== owner) return { ok: false, motivo: "otra_cuenta" };
  if (!identidad.verificada) return { ok: false, motivo: "no_verificada" };
  if (typeof identidad.authTime !== "number" || contexto.ahoraS - identidad.authTime > MAX_EDAD_AUTENTICACION_S || identidad.authTime - contexto.ahoraS > 60) {
    return { ok: false, motivo: "autenticacion_antigua" };
  }
  if (contexto.subFijado && contexto.subFijado !== huella(identidad.sub)) return { ok: false, motivo: "identidad_distinta" };
  return { ok: true };
}

export function direccionDisponible() {
  return isDatabaseConfigured();
}

// --- Bloqueo por intentos fallidos -----------------------------------------

const claveFallo = (ambito: string) => huella(`fallo:${ambito}`);

async function fallosRecientes(ambito: string) {
  const [fila] = await db()<{ cuenta: number }[]>`
    select cuenta from limites
    where clave = ${claveFallo(ambito)} and ventana_inicio > now() - make_interval(secs => ${VENTANA_FALLOS_MS / 1000})
  `;
  return fila?.cuenta ?? 0;
}

export async function direccionBloqueada(ip: string) {
  // Si la base no responde, se trata como bloqueada: nunca se abre a ciegas.
  try {
    const [porIp, global] = await Promise.all([fallosRecientes(`ip:${ip}`), fallosRecientes("global")]);
    return porIp >= FALLOS_POR_IP || global >= FALLOS_GLOBALES;
  } catch {
    return true;
  }
}

export async function registrarFallo(ip: string, opciones: { global: boolean }) {
  const segundos = VENTANA_FALLOS_MS / 1000;
  for (const ambito of opciones.global ? [`ip:${ip}`, "global"] : [`ip:${ip}`]) {
    try {
      await db()`
        insert into limites (clave, ventana_inicio, cuenta) values (${claveFallo(ambito)}, now(), 1)
        on conflict (clave) do update set
          cuenta = case when limites.ventana_inicio < now() - make_interval(secs => ${segundos}) then 1 else limites.cuenta + 1 end,
          ventana_inicio = case when limites.ventana_inicio < now() - make_interval(secs => ${segundos}) then now() else limites.ventana_inicio end
      `;
    } catch {
      // Si no se puede contar, direccionBloqueada ya falla cerrada.
    }
  }
}

// --- Identidad fijada --------------------------------------------------------

export async function subFijado(): Promise<string | null> {
  const [fila] = await db()<{ sub_hash: string }[]>`select sub_hash from direccion_identidad where id = 1`;
  return fila?.sub_hash ?? null;
}

// Primer acceso: se fija la cuenta. «on conflict do nothing» evita que dos
// accesos simultáneos fijen cuentas distintas; se relee lo que quedó.
export async function fijarIdentidad(sub: string) {
  await db()`insert into direccion_identidad (id, sub_hash) values (1, ${huella(sub)}) on conflict (id) do nothing`;
  return subFijado();
}

// --- Sesiones -----------------------------------------------------------------

export async function abrirSesion(datos: { sub: string; ip: string; agente: string }) {
  const sid = nuevoIdSesion();
  const subHash = huella(datos.sub);
  await db().begin(async (tx) => {
    // Una sola sesión activa: entrar desde otro sitio cierra la anterior.
    await tx`update direccion_sesiones set revocada_en = now(), motivo_revocacion = 'nuevo_acceso' where sub_hash = ${subHash} and revocada_en is null`;
    await tx`
      insert into direccion_sesiones (id_hash, sub_hash, ip_hash, agente_hash, expira_en)
      values (${huella(sid)}, ${subHash}, ${huella(datos.ip)}, ${huella(datos.agente)}, now() + make_interval(secs => ${DURACION_SESION_S}))
    `;
  });
  return sid;
}

export type SesionDireccion = { creadaEn: Date; expiraEn: Date };

export async function validarSesion(sid: string, agente: string): Promise<SesionDireccion | null> {
  const id = huella(sid);
  const [fila] = await db()<{ agente_hash: string; creada_en: Date; vista_en: Date; expira_en: Date; revocada_en: Date | null; activa: boolean; inactiva: boolean; refrescar: boolean }[]>`
    select agente_hash, creada_en, vista_en, expira_en, revocada_en,
           (revocada_en is null and expira_en > now()) as activa,
           (vista_en < now() - make_interval(secs => ${INACTIVIDAD_MAX_S})) as inactiva,
           (vista_en < now() - interval '60 seconds') as refrescar
    from direccion_sesiones where id_hash = ${id}
  `;
  if (!fila || !fila.activa) return null;
  if (fila.inactiva) {
    await revocarSesion(sid, "inactividad");
    return null;
  }
  // Una cookie robada que se use desde otro navegador deja de valer.
  if (fila.agente_hash !== huella(agente)) {
    await revocarSesion(sid, "otro_navegador");
    return null;
  }
  if (fila.refrescar) await db()`update direccion_sesiones set vista_en = now() where id_hash = ${id}`;
  return { creadaEn: fila.creada_en, expiraEn: fila.expira_en };
}

export async function revocarSesion(sid: string, motivo: string) {
  await db()`update direccion_sesiones set revocada_en = now(), motivo_revocacion = ${motivo} where id_hash = ${huella(sid)} and revocada_en is null`;
}

export async function accesoAnterior(sid: string): Promise<Date | null> {
  const [fila] = await db()<{ creada_en: Date }[]>`
    select creada_en from direccion_sesiones where id_hash <> ${huella(sid)} order by creada_en desc limit 1
  `;
  return fila?.creada_en ?? null;
}
