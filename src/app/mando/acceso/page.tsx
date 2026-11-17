import { Acceso } from "@/components/mando/Acceso";
import { direccionDisponible } from "@/lib/auth/direccion";
import { googleConfigurado } from "@/lib/auth/google";
import { autenticacionConfigurada } from "@/lib/security/sesion";

export const metadata = { title: "Acceso a la Dirección", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

export default async function PaginaAcceso({ searchParams }: PageProps<"/mando/acceso">) {
  const { siguiente, acceso } = await searchParams;
  const destino = typeof siguiente === "string" && /^\/mando(\/|$|\?)/.test(siguiente) && !siguiente.startsWith("//") ? siguiente : "/mando";
  const disponible = googleConfigurado() && autenticacionConfigurada() && direccionDisponible();
  return <Acceso google={disponible} destino={destino} motivo={typeof acceso === "string" ? acceso : null} />;
}
