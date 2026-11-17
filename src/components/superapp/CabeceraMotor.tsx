import { COLOR_AGENTE, EmblemaAgente } from "@/components/holo/EmblemaAgente";
import { LeyendaUsuario, RadarPagina } from "@/components/holo/RadarPagina";
import { DICCIONARIOS } from "@/lib/i18n";
import type { Locale } from "@/lib/i18n/locales";
import type { EtapaId } from "@/lib/diagnostico";
import type { AgenteId } from "@/lib/motores";

// Cabecera común de cada motor: el agente que lo mueve, su rol, el título y
// su radar de extranjería (reloj de CRONOS, escáner de MNEMÓSINE, vigía de
// ARGOS o recorrido de HESTIA).
export function CabeceraMotor({
  locale,
  agente,
  titulo,
  narrativa,
  radar,
  etapaServidor,
}: {
  locale: Locale;
  agente: AgenteId;
  titulo: string;
  narrativa: string;
  radar: "citas" | "documentos" | "guardian" | "expediente";
  // Con sesión, la etapa sale del expediente del servidor, no del navegador.
  etapaServidor?: EtapaId | null;
}) {
  const t = DICCIONARIOS[locale];
  return (
    <header className={`cabecera-motor rx-figura--${radar}`} style={{ "--agente": COLOR_AGENTE[agente] } as React.CSSProperties}>
      <div className="cabecera-motor-texto">
        <EmblemaAgente agente={agente} tamano={64} activo />
        <p className="hud-etiqueta">
          <span>{t.agentes[agente].nombre}</span>
          <span>{t.agentes[agente].rol}</span>
        </p>
        <h1>{titulo}</h1>
        <p className="cabecera-motor-narrativa">{narrativa}</p>
        <div className="cabecera-motor-leyenda">
          <LeyendaUsuario locale={locale} />
        </div>
      </div>
      <div className="cabecera-motor-radar">
        <RadarPagina locale={locale} variante={radar} conLeyenda={false} etapaServidor={etapaServidor} />
      </div>
    </header>
  );
}
