import { cookies, headers } from "next/headers";
import { validarSesion } from "@/lib/auth/direccion";
import { isDatabaseConfigured } from "@/lib/db";
import type { Rol, Sesion } from "@/lib/security/sesion";
import { COOKIE_SESION, leerTokenDireccion, tieneRol } from "@/lib/security/sesion";

// Segunda barrera tras el proxy: cada página y handler de la Dirección
// comprueba la sesión en la base de datos (no revocada, sin caducar, activa en
// los últimos 30 minutos y desde el mismo navegador). Solo existe un rol:
// owner, la cuenta de Google de A.R.E.S.
export async function sesionDireccion() {
  try {
    const token = leerTokenDireccion((await cookies()).get(COOKIE_SESION)?.value);
    const owner = process.env.OWNER_EMAIL?.trim().toLowerCase();
    if (!token || !owner || !isDatabaseConfigured()) return null;
    const agente = (await headers()).get("user-agent") ?? "";
    const sesion = await validarSesion(token.sid, agente);
    return sesion ? { sid: token.sid, email: owner, ...sesion } : null;
  } catch {
    return null;
  }
}

export async function sesionActual(): Promise<Sesion | null> {
  const sesion = await sesionDireccion();
  return sesion ? { sub: sesion.email, rol: "owner", exp: Math.floor(sesion.expiraEn.getTime() / 1000) } : null;
}

export async function exigirRol(minimo: Rol) {
  const sesion = await sesionActual();
  return tieneRol(sesion, minimo) ? sesion : null;
}
