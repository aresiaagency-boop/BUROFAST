import { db, isDatabaseConfigured } from "@/lib/db";
import { ETAPA_DE_RUTA, type RutaId } from "@/lib/diagnostico";
import { documentosDeLeads, documentosRequeridos } from "@/lib/documentos";
import { correlationId, error, json } from "@/lib/http";
import { DICCIONARIOS } from "@/lib/i18n";
import { telefonoSchema } from "@/lib/schemas";
import { cifradoConfigurado, descifrar, hashEstable } from "@/lib/security/cifrado";
import { verifyMachineBearer } from "@/lib/security/hmac";

// MNEMÓSINE para HESTIA por WhatsApp: el expediente de quien escribe, por el
// hash de su número. Sin nombre, sin teléfono y sin contenido de documentos:
// solo lo que HESTIA necesita para decir «te falta esto» y dónde adjuntarlo.
function situacionEnClaro(sobre: string | null | undefined) {
  try {
    return sobre ? descifrar(sobre) : null;
  } catch {
    return null;
  }
}

export async function POST(request: Request) {
  const correlation = correlationId(request);
  const secreto = process.env.HESTIA_CONTEXTO_TOKEN?.trim();
  if (!secreto) return error("HESTIA_NO_CONFIGURADA", "Falta HESTIA_CONTEXTO_TOKEN en el servidor.", { status: 503, correlation });
  if (!verifyMachineBearer(secreto, request.headers.get("authorization"))) {
    return error("NO_AUTORIZADO", "Credencial de máquina no válida.", { status: 401, correlation });
  }
  if (!isDatabaseConfigured() || !cifradoConfigurado()) return error("NO_DISPONIBLE", "Sin base de datos.", { status: 503, correlation });
  const cuerpo = (await request.json().catch(() => null)) as { telefono?: unknown } | null;
  const telefono = telefonoSchema.safeParse(typeof cuerpo?.telefono === "string" ? cuerpo.telefono : "");
  if (!telefono.success) return error("ENTRADA_INVALIDA", "Teléfono no válido.", { status: 400, correlation });

  const leads = await db()<{ id: string; referencia: string; rutaId: RutaId; estado: string; locale: string; vinculado: boolean; respuestas: Record<string, string | null> }[]>`
    select id, referencia, ruta_id as "rutaId", estado, locale, (email_verificado_en is not null) as vinculado,
           json_build_object('sueno', sueno, 'ubicacion', ubicacion, 'situacion', situacion, 'tiempo', tiempo, 'pasaporte', pasaporte) as respuestas
    from leads where telefono_hash = ${hashEstable(telefono.data)} and estado <> 'descartado' and demo = false
    order by creado_en desc limit 3
  `;
  const base = (process.env.APP_BASE_URL ?? new URL(request.url).origin).replace(/\/$/, "");
  const documentos = await documentosDeLeads(leads.map((l) => l.id));
  const t = DICCIONARIOS.es;
  const nombreDoc = (tipo: string) => (tipo === "otro" ? "Otro documento" : t.documentos[tipo as keyof typeof t.documentos] ?? tipo);

  return json(
    {
      encontrado: leads.length > 0,
      enlaceCamino: `${base}/es/camino`,
      expedientes: leads.map((l) => {
        const suyos = documentos.get(l.id) ?? [];
        const validos = new Set(suyos.filter((d) => d.estado !== "rechazado").map((d) => d.tipo));
        return {
          referencia: l.referencia,
          ruta: t.rutas[l.rutaId]?.nombre ?? l.rutaId,
          etapa: ETAPA_DE_RUTA[l.rutaId] ?? null,
          estado: t.expediente.estados[l.estado as keyof typeof t.expediente.estados] ?? l.estado,
          // Sin vincular con Google no puede adjuntar: primero entra en su expediente.
          vinculadoConGoogle: l.vinculado,
          enlaceExpediente: `${base}/${l.locale}/expediente`,
          documentosQueFaltan: documentosRequeridos({ ...l.respuestas, situacion: situacionEnClaro(l.respuestas.situacion) }).filter((d) => !validos.has(d)).map(nombreDoc),
          documentosRecibidos: suyos.map((d) => ({ documento: nombreDoc(d.tipo), estado: t.boveda.estados[d.estado], nota: d.nota })),
        };
      }),
    },
    { correlation },
  );
}
