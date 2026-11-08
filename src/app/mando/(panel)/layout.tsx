import { redirect } from "next/navigation";
import { Navegacion } from "@/components/mando/Navegacion";
import { sesionActual } from "@/lib/autorizacion";

export const dynamic = "force-dynamic";

export default async function PanelLayout({ children }: { children: React.ReactNode }) {
  const sesion = await sesionActual();
  if (!sesion) redirect("/mando/acceso");
  return (
    <div className="mando">
      <Navegacion />
      {children}
      <footer className="estado-pie">
        <span>entorno: {process.env.BUROFAST_ENTORNO ?? "sin definir"}</span>
        <span>sesión: {sesion.sub} · {sesion.rol}</span>
        <span>v0.1.0 · fase 1</span>
      </footer>
    </div>
  );
}
