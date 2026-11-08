import { exigirRol } from "@/lib/autorizacion";
import { comprobarTodo } from "@/lib/estado";
import { correlationId, error, json } from "@/lib/http";

export async function GET(request: Request) {
  const correlation = correlationId(request);
  if (!(await exigirRol("viewer"))) return error("NO_AUTORIZADO", "Inicia sesión en el centro de mando.", { status: 401, correlation });
  return json({ piezas: await comprobarTodo() }, { correlation });
}
