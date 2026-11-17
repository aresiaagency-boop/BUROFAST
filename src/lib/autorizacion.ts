import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { cache } from "react";
import { validarSesion } from "@/lib/auth/direccion";
import { isDatabaseConfigured } from "@/lib/db";
import type { Rol, Sesion } from "@/lib/security/sesion";
import { COOKIE_SESION, leerTokenDireccion, tieneRol } from "@/lib/security/sesion";

// Segunda barrera tras el proxy: cada página y handler de la Dirección
// comprueba la sesión en la base de datos (no revocada, sin caducar, activa en
// los últimos 30 minutos y desde el mismo navegador). Solo existe un rol:
// owner, la cuenta de Google de A.R.E.S. Con cache() el layout y la página
// comparten una sola consulta por petición.
export const sesionDireccion = cache(async () => {
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
});

export async function sesionActual(): Promise<Sesion | null> {
  const sesion = await sesionDireccion();
  return sesion ? { sub: sesion.email, rol: "owner", exp: Math.floor(sesion.expiraEn.getTime() / 1000) } : null;
}

export async function exigirRol(minimo: Rol) {
  const sesion = await sesionActual();
  return tieneRol(sesion, minimo) ? sesion : null;
}

// Primera línea de cada página de la Dirección. Next renderiza el layout y la
// página en paralelo: si solo el layout redirigiera, la página ya habría
// consultado y serializado sus datos en la respuesta del 307. Por eso cada
// página llama a esto antes de tocar la base de datos.
export async function exigirDireccion(): Promise<Sesion> {
  const sesion = await sesionActual();
  if (!sesion) redirect("/mando/acceso");
  return sesion;
}
