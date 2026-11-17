import { redirect } from "next/navigation";
import { Navegacion } from "@/components/mando/Navegacion";
import { accesoAnterior, rechazosRecientes } from "@/lib/auth/direccion";
import { sesionDireccion } from "@/lib/autorizacion";

export const dynamic = "force-dynamic";
export const metadata = { robots: { index: false, follow: false } };

const hora = (fecha: Date) => fecha.toLocaleString("es-ES", { timeZone: "Europe/Madrid", dateStyle: "short", timeStyle: "short" });

export default async function PanelLayout({ children }: { children: React.ReactNode }) {
  const sesion = await sesionDireccion();
  if (!sesion) redirect("/mando/acceso");
  // El acceso anterior y los rechazos de 24 h a la vista: si no reconoces el
  // acceso, alguien entró; si hay rechazos de cuentas ajenas, alguien lo intenta.
  const [anterior, rechazos] = await Promise.all([accesoAnterior(sesion.sid).catch(() => null), rechazosRecientes().catch(() => null)]);
  return (
    <div className="mando">
      <div className="rejilla-holo" aria-hidden="true" />
      <Navegacion />
      {children}
      <footer className="estado-pie">
        <span>entorno: {process.env.BUROFAST_ENTORNO ?? "sin definir"}</span>
        <span>sesión: {sesion.email} · desde {hora(sesion.creadaEn)} · caduca {hora(sesion.expiraEn)}</span>
        <span>acceso anterior: {anterior ? hora(anterior) : "ninguno"}</span>
        {rechazos === null ? (
          <span className="pie-alerta">intentos rechazados: sin dato</span>
        ) : rechazos.total > 0 ? (
          <span className="pie-alerta" role="status">
            intentos rechazados (24 h): {rechazos.total}{rechazos.cuentasAjenas > 0 ? ` · ${rechazos.cuentasAjenas} con otra cuenta de Google` : ""} · último {rechazos.ultimo ? hora(rechazos.ultimo) : "—"}
          </span>
        ) : (
          <span>intentos rechazados (24 h): 0</span>
        )}
        <span>v0.3.0 · Dirección</span>
      </footer>
    </div>
  );
}
