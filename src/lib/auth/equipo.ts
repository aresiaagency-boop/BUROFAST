import type { Rol } from "@/lib/security/sesion";
import { ROLES } from "@/lib/security/sesion";

// Quién es del equipo y con qué rol. OWNER_EMAIL es el owner; STAFF_EMAILS
// añade más personas con el formato «correo:rol, correo:rol». Un correo que no
// está aquí entra como cliente, nunca como equipo.
export function rolDeEquipo(email: string): Rol | null {
  const correo = email.trim().toLowerCase();
  if (correo && correo === process.env.OWNER_EMAIL?.trim().toLowerCase()) return "owner";
  for (const entrada of (process.env.STAFF_EMAILS ?? "").split(",")) {
    const [candidato, rol] = entrada.split(":").map((v) => v.trim().toLowerCase());
    if (candidato && candidato === correo && (ROLES as readonly string[]).includes(rol)) return rol as Rol;
  }
  return null;
}

// Confirmar una ruta abre el cobro: lo hace un abogado colegiado. Quién lo es
// lo dice ABOGADOS_EMAILS («correo, correo»); sin esa lista, solo el owner.
export function puedeConfirmarRuta(email: string, rol: Rol) {
  const abogados = (process.env.ABOGADOS_EMAILS ?? "").split(",").map((v) => v.trim().toLowerCase()).filter(Boolean);
  if (abogados.length === 0) return rol === "owner";
  return abogados.includes(email.trim().toLowerCase());
}
