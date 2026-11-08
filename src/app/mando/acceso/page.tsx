import { Acceso } from "@/components/mando/Acceso";
import { autenticacionConfigurada } from "@/lib/security/sesion";

export const metadata = { title: "Acceso al centro de mando" };
export const dynamic = "force-dynamic";

export default async function PaginaAcceso({ searchParams }: PageProps<"/mando/acceso">) {
  const { siguiente } = await searchParams;
  const destino = typeof siguiente === "string" && siguiente.startsWith("/mando") && !siguiente.startsWith("//") ? siguiente : "/mando";
  return <Acceso configurado={autenticacionConfigurada()} destino={destino} />;
}
