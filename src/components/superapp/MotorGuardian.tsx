"use client";

import Link from "next/link";
import { CLAVE_GUARDIAN, escribir, hoyIso } from "@/lib/almacen";
import { emitirHestia } from "@/lib/hestia/vivo";
import { DICCIONARIOS } from "@/lib/i18n";
import type { Locale } from "@/lib/i18n/locales";
import { ETIQUETA_INTL } from "@/lib/i18n/locales";
import type { EstadoPlazo } from "@/lib/motores";
import { esFechaIso, motorArgos } from "@/lib/motores";
import { useAlmacen } from "@/lib/useAlmacen";

const TONO: Record<EstadoPlazo, string> = { lejos: "info", ventana: "ok", gracia: "aviso", fuera: "critico" };

function escaparIcs(texto: string) {
  return texto.replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\n/g, "\\n");
}

function diaSiguiente(iso: string) {
  const [a, m, d] = iso.split("-").map(Number);
  return new Date(Date.UTC(a, m - 1, d + 1)).toISOString().slice(0, 10);
}

// Calendario .ics con dos avisos: cuando se abre la ventana y cuando caduca.
// Se genera en el navegador: la fecha no sale del dispositivo.
function descargarCalendario(eventos: { fecha: string; titulo: string }[]) {
  const marca = new Date().toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
  const lineas = ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//BUROFAST//ARGOS//ES", "CALSCALE:GREGORIAN"];
  for (const e of eventos) {
    lineas.push(
      "BEGIN:VEVENT",
      `UID:${e.fecha}-${e.titulo.length}@burofast`,
      `DTSTAMP:${marca}`,
      `DTSTART;VALUE=DATE:${e.fecha.replace(/-/g, "")}`,
      `DTEND;VALUE=DATE:${diaSiguiente(e.fecha).replace(/-/g, "")}`,
      `SUMMARY:${escaparIcs(e.titulo)}`,
      "END:VEVENT",
    );
  }
  lineas.push("END:VCALENDAR");
  const url = URL.createObjectURL(new Blob([lineas.join("\r\n")], { type: "text/calendar;charset=utf-8" }));
  const enlace = document.createElement("a");
  enlace.href = url;
  enlace.download = "burofast-plazos.ics";
  enlace.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function MotorGuardian({ locale }: { locale: Locale }) {
  const t = DICCIONARIOS[locale];
  const { listo, guardian } = useAlmacen();
  const hoy = hoyIso();
  const plazo = guardian && esFechaIso(guardian) ? motorArgos(guardian, hoy) : null;
  const formato = new Intl.DateTimeFormat(ETIQUETA_INTL[locale], { dateStyle: "long", timeZone: "UTC" });
  const fecha = (iso: string) => formato.format(new Date(`${iso}T00:00:00Z`));
  const relativa = (dias: number) => (dias >= 0 ? t.motorGuardian.dias(dias) : t.motorGuardian.diasPasados(-dias));

  return (
    <div className="argos">
      <section className="cristal cristal--grande bloque">
        <div className="campo">
          <label htmlFor="caducidad">{t.motorGuardian.fecha}</label>
          <span className="campo-cristal">
            <input
              id="caducidad"
              type="date"
              dir="ltr"
              value={listo ? (guardian ?? "") : ""}
              aria-describedby="caducidad-ayuda"
              onChange={(e) => {
                const valor = e.target.value;
                if (!valor) {
                  escribir(CLAVE_GUARDIAN, {});
                  return;
                }
                if (!esFechaIso(valor)) return;
                escribir(CLAVE_GUARDIAN, { caducidad: valor });
                const estado = motorArgos(valor, hoyIso()).estado;
                emitirHestia(estado === "lejos" || estado === "ventana" ? "exito" : "alerta");
              }}
            />
          </span>
          <small id="caducidad-ayuda">{t.motorGuardian.fechaAyuda}</small>
        </div>
        <p className="aviso-ia" style={{ marginTop: 14 }}>{t.motorGuardian.avisoLegal}</p>
      </section>

      <section className="cristal cristal--grande bloque" aria-live="polite">
        {!plazo ? (
          <p>{t.nucleo.estadoGuardian.sinFecha}</p>
        ) : (
          <>
            <p><span className={`estado-holo ${TONO[plazo.estado]}`}>{t.motorGuardian.estados[plazo.estado]}</span></p>
            <ul className="linea-plazos" style={{ marginTop: 12 }}>
              <li className={plazo.diasHastaVentana === 0 ? "pasado" : ""}>
                <span>{t.motorGuardian.abre}</span>
                <span className="mono">{fecha(plazo.abreVentana)}</span>
                <small>{relativa(plazo.diasHastaCaducidad - 60)}</small>
              </li>
              <li className={plazo.diasHastaCaducidad < 0 ? "pasado" : ""}>
                <span>{t.motorGuardian.caduca}</span>
                <span className="mono">{fecha(plazo.caducidad)}</span>
                <small>{relativa(plazo.diasHastaCaducidad)}</small>
              </li>
              <li className={plazo.diasHastaCierre < 0 ? "pasado" : ""}>
                <span>{t.motorGuardian.cierra}</span>
                <span className="mono">{fecha(plazo.cierraGracia)}</span>
                <small>{relativa(plazo.diasHastaCierre)}</small>
              </li>
            </ul>
            <div className="acciones">
              <button
                type="button"
                className="boton-cristal plasma-agente"
                style={{ "--agente": "var(--agente-argos)" } as React.CSSProperties}
                onClick={() => descargarCalendario([
                  { fecha: plazo.abreVentana, titulo: t.motorGuardian.eventoAbre },
                  { fecha: plazo.caducidad, titulo: t.motorGuardian.eventoCaduca },
                ])}
              >
                {t.motorGuardian.calendario}
              </button>
              <Link className="boton-cristal boton-cristal--fantasma" href={`/${locale}/camino`}>{t.motorGuardian.activar}</Link>
            </div>
          </>
        )}
      </section>
    </div>
  );
}
