import { CITAS, presupuesto } from "@/lib/catalogo";
import { diagnosticar, respuestasSchema } from "@/lib/diagnostico";
import { correlationId, error, json } from "@/lib/http";

export async function POST(request: Request) {
  const correlation = correlationId(request);
  const cuerpo = await request.json().catch(() => null);
  const respuestas = respuestasSchema.safeParse(cuerpo);
  if (!respuestas.success) {
    return error("RESPUESTAS_INVALIDAS", "Faltan respuestas o alguna no es válida.", { status: 400, correlation, detalle: respuestas.error.issues });
  }
  const ruta = diagnosticar(respuestas.data);
  const gestionables = ruta.citas.filter((cita) => CITAS[cita].gestionable);
  return json(
    {
      ruta,
      presupuesto: {
        sinGestionCitas: presupuesto({ producto: ruta.producto, citas: ruta.citas, nivelCita: null, conGuardian: false }),
        puedeEsperar: gestionables.length ? presupuesto({ producto: ruta.producto, citas: ruta.citas, nivelCita: "puede_esperar", conGuardian: false }) : null,
        urgente: gestionables.length ? presupuesto({ producto: ruta.producto, citas: ruta.citas, nivelCita: "urgente", conGuardian: false }) : null,
      },
    },
    { correlation },
  );
}
