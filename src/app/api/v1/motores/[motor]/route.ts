import { z } from "zod";
import { CITAS } from "@/lib/catalogo";
import { DOCUMENTOS, respuestasSchema } from "@/lib/diagnostico";
import { correlationId, error, ipCliente, json } from "@/lib/http";
import { DICCIONARIOS } from "@/lib/i18n";
import { esFechaIso, motorAriadna, motorArgos, motorCronos, motorMnemosine, REGLAS_TEMIS } from "@/lib/motores";
import { limitar } from "@/lib/security/limites";

// Los motores como herramientas: HESTIA (n8n) los consulta y la interfaz
// también. Son cálculos de solo lectura, sin datos personales: no requieren
// sesión, pero sí límite de peticiones.

const citaIds = Object.keys(CITAS) as [keyof typeof CITAS, ...(keyof typeof CITAS)[]];
const docIds = [...DOCUMENTOS] as [(typeof DOCUMENTOS)[number], ...(typeof DOCUMENTOS)[number][]];
const t = DICCIONARIOS.es;

const esquemas = {
  ariadna: z.object({ respuestas: respuestasSchema }),
  cronos: z.object({ citas: z.array(z.enum(citaIds)).max(20) }),
  mnemosine: z.object({ documentos: z.array(z.enum(docIds)).max(20) }),
  argos: z.object({ caducidad: z.string().refine(esFechaIso), hoy: z.string().refine(esFechaIso).optional() }),
  temis: z.object({}).passthrough(),
} as const;

type Motor = keyof typeof esquemas;
const esMotor = (valor: string): valor is Motor => valor in esquemas;

export async function POST(request: Request, { params }: RouteContext<"/api/v1/motores/[motor]">) {
  const correlation = correlationId(request);
  const { motor } = await params;
  if (!esMotor(motor)) return error("MOTOR_DESCONOCIDO", "Ese motor no existe.", { status: 404, correlation });
  const limite = await limitar(`motor:${ipCliente(request)}`, { limite: 120, ventanaMs: 10 * 60_000 });
  if (!limite.permitido) return error("DEMASIADAS_PETICIONES", "Demasiadas consultas seguidas.", { status: 429, correlation });

  const cuerpo = await request.json().catch(() => ({}));
  switch (motor) {
    case "ariadna": {
      const entrada = esquemas.ariadna.safeParse(cuerpo);
      if (!entrada.success) return error("ENTRADA_INVALIDA", "Faltan respuestas del camino.", { status: 400, correlation });
      const { ruta, presupuestos } = motorAriadna(entrada.data.respuestas);
      return json(
        {
          agente: "ARIADNA",
          ruta: { id: ruta.id, nombre: t.rutas[ruta.id].nombre, resumen: t.rutas[ruta.id].resumen, nivel: ruta.nivel, etapa: t.etapas[ruta.etapaActual] },
          documentos: ruta.documentos.map((d) => t.documentos[d]),
          citas: ruta.citas.map((c) => t.citas[c].nombre),
          avisos: ruta.avisos.map((a) => t.avisos[a]),
          siguiente: ruta.siguiente ? t.rutas[ruta.siguiente].nombre : null,
          presupuestosCentimos: presupuestos,
        },
        { correlation },
      );
    }
    case "cronos": {
      const entrada = esquemas.cronos.safeParse(cuerpo);
      if (!entrada.success) return error("ENTRADA_INVALIDA", "Lista de citas no válida.", { status: 400, correlation });
      const resultado = motorCronos(entrada.data.citas);
      return json(
        {
          agente: "CRONOS",
          citas: resultado.citas.map((c) => ({ nombre: t.citas[c.id].nombre, cuando: t.citas[c.id].cuando, autoridad: t.autoridades[c.autoridad], gestionable: c.gestionable })),
          gestionables: resultado.cobrables,
          totalPorNivelCentimos: resultado.porNivel,
          garantiaUrgenteDias: resultado.garantiaUrgenteDias,
          reglas: t.nivelesCita.reglas,
        },
        { correlation },
      );
    }
    case "mnemosine": {
      const entrada = esquemas.mnemosine.safeParse(cuerpo);
      if (!entrada.success) return error("ENTRADA_INVALIDA", "Lista de documentos no válida.", { status: 400, correlation });
      const resultado = motorMnemosine(entrada.data.documentos);
      return json(
        {
          agente: "MNEMOSINE",
          documentos: resultado.documentos.map((d) => ({
            nombre: t.documentos[d.id],
            extranjero: d.extranjero ? t.motorDocumentos.extranjero : null,
            reciente: d.reciente ? t.motorDocumentos.reciente : null,
          })),
          total: resultado.total,
        },
        { correlation },
      );
    }
    case "argos": {
      const entrada = esquemas.argos.safeParse(cuerpo);
      if (!entrada.success) return error("ENTRADA_INVALIDA", "Fecha no válida (AAAA-MM-DD).", { status: 400, correlation });
      const hoy = entrada.data.hoy ?? new Date().toISOString().slice(0, 10);
      return json({ agente: "ARGOS", ...motorArgos(entrada.data.caducidad, hoy), aviso: t.motorGuardian.avisoLegal }, { correlation });
    }
    case "temis":
      return json({ agente: "TEMIS", reglas: REGLAS_TEMIS.map((r) => t.temis[r]) }, { correlation });
  }
}
