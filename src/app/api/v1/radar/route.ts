import { db, isDatabaseConfigured } from "@/lib/db";
import { comprobarPostgres } from "@/lib/estado";
import { n8nHestiaConfigurado } from "@/lib/hestia/orquestador";
import { ipCliente } from "@/lib/http";
import { LOCALES, type Locale } from "@/lib/i18n/locales";
import { contenidoPlataforma, type SenalesRadar } from "@/lib/radar";
import { checkEphemeralRateLimit } from "@/lib/security/rate-limit";

export const dynamic = "force-dynamic";

// Señales públicas del radar de la portada. Solo agregados sin datos
// personales: conversaciones de HESTIA por idioma en 24 h, latencia de la
// base de datos y estado de HESTIA. La CDN lo guarda 30 s, pero una URL con
// parámetros inventados se la salta: por eso la instancia guarda también el
// resultado 30 s y la base de datos ve como mucho una consulta cada 30 s por
// instancia, se pida como se pida. El límite por IP frena al resto.
const VIGENCIA_RADAR_MS = 30_000;
let enMemoria: { senales: SenalesRadar; hasta: number } | null = null;
let enCurso: Promise<SenalesRadar> | null = null;

export async function GET(request: Request) {
  const cabeceras = { "cache-control": "public, s-maxage=30, stale-while-revalidate=60" };
  if (!checkEphemeralRateLimit(`radar:${ipCliente(request)}`, { limit: 30, windowMs: 60_000 }).allowed) {
    return Response.json({ error: { codigo: "DEMASIADAS_PETICIONES", mensaje: "Espera un minuto." } }, { status: 429, headers: { "cache-control": "no-store" } });
  }
  if (enMemoria && enMemoria.hasta > Date.now()) return Response.json(enMemoria.senales, { headers: cabeceras });
  // Peticiones simultáneas comparten la misma consulta.
  enCurso ??= medir().finally(() => {
    enCurso = null;
  });
  const senales = await enCurso;
  enMemoria = { senales, hasta: Date.now() + VIGENCIA_RADAR_MS };
  return Response.json(senales, { headers: cabeceras });
}

async function medir(): Promise<SenalesRadar> {
  const postgres = await comprobarPostgres();
  const senales: SenalesRadar = {
    comprobadoEn: new Date().toISOString(),
    contenido: contenidoPlataforma(),
    baseDatos: {
      estado: postgres.estado === "operativo" ? "operativo" : postgres.estado === "no_configurado" ? "no_configurado" : "error",
      latenciaMs: postgres.latenciaMs,
    },
    hestia: n8nHestiaConfigurado() ? null : { estado: "local", latenciaMediaMs: null },
    conversaciones24h: null,
  };

  if (isDatabaseConfigured() && postgres.estado === "operativo") {
    try {
      const filas = await db()<{ locale: string; total: number; ia: number; fallos: number; latencia: number | null }[]>`
        select locale, count(*)::int as total,
               count(*) filter (where modo = 'ia')::int as ia,
               count(*) filter (where not ok)::int as fallos,
               round(avg(latencia_ms) filter (where modo = 'ia'))::int as latencia
        from hestia_turnos
        where creado_en > now() - interval '24 hours'
        group by locale
      `;
      const porIdioma = Object.fromEntries(LOCALES.map((l) => [l, 0])) as Record<Locale, number>;
      let ia = 0;
      let fallos = 0;
      let suma = 0;
      for (const fila of filas) {
        if ((LOCALES as readonly string[]).includes(fila.locale)) porIdioma[fila.locale as Locale] = fila.total;
        ia += fila.ia;
        fallos += fila.fallos;
        if (fila.latencia !== null) suma += fila.latencia * fila.ia;
      }
      senales.conversaciones24h = porIdioma;
      if (n8nHestiaConfigurado()) {
        // Con IA configurada, «ia» solo si hubo turnos con IA o ninguno falló.
        senales.hestia = { estado: ia > 0 || fallos === 0 ? "ia" : "error", latenciaMediaMs: ia > 0 ? Math.round(suma / ia) : null };
      }
    } catch {
      senales.conversaciones24h = null;
    }
  }
  return senales;
}
