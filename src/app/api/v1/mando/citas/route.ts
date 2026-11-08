import { exigirRol } from "@/lib/autorizacion";
import { isDatabaseConfigured } from "@/lib/db";
import { correlationId, error, json } from "@/lib/http";
import { listarCitas } from "@/lib/repositorio";

export async function GET(request: Request) {
  const correlation = correlationId(request);
  if (!(await exigirRol("viewer"))) return error("NO_AUTORIZADO", "Inicia sesión en el centro de mando.", { status: 401, correlation });
  if (!isDatabaseConfigured()) return error("SIN_BASE_DE_DATOS", "DATABASE_URL no está configurada.", { status: 503, correlation });
  const abiertas = new URL(request.url).searchParams.get("todas") !== "1";
  try {
    return json({ citas: await listarCitas({ abiertas }), consultadoEn: new Date().toISOString() }, { correlation });
  } catch {
    return error("BASE_DE_DATOS_NO_RESPONDE", "PostgreSQL no respondió.", { status: 503, correlation });
  }
}
