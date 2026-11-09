import { cookies } from "next/headers";
import { hashEstable } from "@/lib/security/cifrado";
import { abrir, sellar } from "@/lib/security/sello";

// Sesión del cliente («Mi expediente»): cookie firmada, HttpOnly, 7 días. Solo
// sirve para ver SUS expedientes, que se encuentran por el hash del correo
// verificado por Google.
export const COOKIE_CLIENTE = "burofast.cliente";
export const DURACION_CLIENTE_S = 7 * 24 * 60 * 60;

export type SesionCliente = { email: string; emailHash: string; nombre: string | null };

export function crearSesionCliente(email: string, nombre: string | null) {
  const datos: SesionCliente = { email, emailHash: hashEstable(email), nombre };
  return sellar(datos, DURACION_CLIENTE_S, "cliente");
}

export function leerSesionCliente(valor: string | undefined): SesionCliente | null {
  const datos = abrir<SesionCliente>(valor, "cliente");
  if (!datos || typeof datos.email !== "string" || typeof datos.emailHash !== "string") return null;
  return { email: datos.email, emailHash: datos.emailHash, nombre: typeof datos.nombre === "string" ? datos.nombre : null };
}

export async function sesionClienteActual() {
  try {
    return leerSesionCliente((await cookies()).get(COOKIE_CLIENTE)?.value);
  } catch {
    return null;
  }
}

export const opcionesCookie = (maxAge: number) => ({
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "lax" as const,
  path: "/",
  maxAge,
});
