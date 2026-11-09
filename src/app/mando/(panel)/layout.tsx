import { redirect } from "next/navigation";
import { Navegacion } from "@/components/mando/Navegacion";
import { sesionActual } from "@/lib/autorizacion";

export const dynamic = "force-dynamic";

export default async function PanelLayout({ children }: { children: React.ReactNode }) {
  const sesion = await sesionActual();
  if (!sesion) redirect("/mando/acceso");
  return (
    <div className="mando">
      <div className="rejilla-holo" aria-hidden="true" />
      <Navegacion />
      {children}
      <footer className="estado-pie">
        <span>entorno: {process.env.BUROFAST_ENTORNO ?? "sin definir"}</span>
        <span>sesión: {sesion.sub} · {sesion.rol}</span>
        <span>v0.2.0 · superapp</span>
      </footer>
    </div>
  );
}
