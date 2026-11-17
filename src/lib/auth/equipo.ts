import type { Rol } from "@/lib/security/sesion";

// La Dirección es de una sola cuenta: la de Google de A.R.E.S. (OWNER_EMAIL).
// Confirmar o corregir una ruta abre el cobro y lo hace esa cuenta, después de
// la revisión del responsable legal.
export function puedeConfirmarRuta(_email: string, rol: Rol) {
  return rol === "owner";
}
