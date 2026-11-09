import { COLOR_AGENTE, EmblemaAgente } from "@/components/holo/EmblemaAgente";
import { DICCIONARIOS } from "@/lib/i18n";
import type { Locale } from "@/lib/i18n/locales";
import type { AgenteId } from "@/lib/motores";

// Cabecera común de cada motor: el agente que lo mueve, su rol y el título.
export function CabeceraMotor({ locale, agente, titulo, narrativa }: { locale: Locale; agente: AgenteId; titulo: string; narrativa: string }) {
  const t = DICCIONARIOS[locale];
  return (
    <header className="cabecera-motor" style={{ "--agente": COLOR_AGENTE[agente] } as React.CSSProperties}>
      <EmblemaAgente agente={agente} tamano={64} activo />
      <p className="hud-etiqueta">
        <span>{t.agentes[agente].nombre}</span>
        <span>{t.agentes[agente].rol}</span>
      </p>
      <h1>{titulo}</h1>
      <p>{narrativa}</p>
    </header>
  );
}
