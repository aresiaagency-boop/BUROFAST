import { exigirRol } from "@/lib/autorizacion";
import { isDatabaseConfigured } from "@/lib/db";
import { correlationId, error, json } from "@/lib/http";
import { auditar, listarLeads } from "@/lib/repositorio";

export async function GET(request: Request) {
  const correlation = correlationId(request);
  const sesion = await exigirRol("viewer");
  if (!sesion) return error("NO_AUTORIZADO", "Inicia sesión en el centro de mando.", { status: 401, correlation });
  if (!isDatabaseConfigured()) return error("SIN_BASE_DE_DATOS", "DATABASE_URL no está configurada.", { status: 503, correlation });
  try {
    const leads = await listarLeads();
    // Leer datos personales también deja rastro.
    await auditar({ actorId: sesion.sub, accion: "leads.listar", parametros: { total: leads.length }, resultado: "ok", correlationId: correlation });
    return json({ leads }, { correlation });
  } catch {
    return error("BASE_DE_DATOS_NO_RESPONDE", "PostgreSQL no respondió o falta la clave de cifrado.", { status: 503, correlation });
  }
}
