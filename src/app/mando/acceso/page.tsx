import { Acceso } from "@/components/mando/Acceso";
import { googleConfigurado } from "@/lib/auth/google";
import { passwordConfigurada } from "@/lib/security/sesion";

export const metadata = { title: "Acceso al centro de mando" };
export const dynamic = "force-dynamic";

export default async function PaginaAcceso({ searchParams }: PageProps<"/mando/acceso">) {
  const { siguiente, acceso } = await searchParams;
  const destino = typeof siguiente === "string" && siguiente.startsWith("/mando") && !siguiente.startsWith("//") ? siguiente : "/mando";
  return <Acceso google={googleConfigurado()} password={passwordConfigurada()} destino={destino} motivo={typeof acceso === "string" ? acceso : null} />;
}
