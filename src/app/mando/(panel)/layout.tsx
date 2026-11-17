import { redirect } from "next/navigation";
import { Navegacion } from "@/components/mando/Navegacion";
import { accesoAnterior } from "@/lib/auth/direccion";
import { sesionDireccion } from "@/lib/autorizacion";

export const dynamic = "force-dynamic";
export const metadata = { robots: { index: false, follow: false } };

const hora = (fecha: Date) => fecha.toLocaleString("es-ES", { timeZone: "Europe/Madrid", dateStyle: "short", timeStyle: "short" });

export default async function PanelLayout({ children }: { children: React.ReactNode }) {
  const sesion = await sesionDireccion();
  if (!sesion) redirect("/mando/acceso");
  // El acceso anterior a la vista: si no lo reconoces, alguien entró.
  const anterior = await accesoAnterior(sesion.sid).catch(() => null);
  return (
    <div className="mando">
      <div className="rejilla-holo" aria-hidden="true" />
      <Navegacion />
      {children}
      <footer className="estado-pie">
        <span>entorno: {process.env.BUROFAST_ENTORNO ?? "sin definir"}</span>
        <span>sesión: {sesion.email} · desde {hora(sesion.creadaEn)} · caduca {hora(sesion.expiraEn)}</span>
        <span>acceso anterior: {anterior ? hora(anterior) : "ninguno"}</span>
        <span>v0.3.0 · Dirección</span>
      </footer>
    </div>
  );
}
