import { cookies } from "next/headers";
import type { Rol } from "@/lib/security/sesion";
import { COOKIE_SESION, leerTokenSesion, tieneRol } from "@/lib/security/sesion";

// Segunda barrera tras el proxy: cada handler y cada página del centro de
// mando vuelve a comprobar la sesión y el rol en el servidor.
export async function sesionActual() {
  try {
    const almacen = await cookies();
    return leerTokenSesion(almacen.get(COOKIE_SESION)?.value);
  } catch {
    return null;
  }
}

export async function exigirRol(minimo: Rol) {
  const sesion = await sesionActual();
  return tieneRol(sesion, minimo) ? sesion : null;
}
