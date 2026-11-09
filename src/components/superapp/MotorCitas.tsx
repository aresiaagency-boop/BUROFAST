"use client";

import Link from "next/link";
import { CITAS, formatearEuros, NIVELES_CITA } from "@/lib/catalogo";
import { DICCIONARIOS } from "@/lib/i18n";
import type { Locale } from "@/lib/i18n/locales";
import { ETIQUETA_INTL } from "@/lib/i18n/locales";
import { motorCronos } from "@/lib/motores";
import { useAlmacen } from "@/lib/useAlmacen";

// CRONOS con lo que el usuario ha recorrido en este navegador: qué citas
// tiene su ruta y cuánto costaría gestionarlas en cada nivel.
export function MotorCitas({ locale }: { locale: Locale }) {
  const t = DICCIONARIOS[locale];
  const intl = ETIQUETA_INTL[locale];
  const { listo, camino } = useAlmacen();
  if (!listo) return <section className="cristal bloque" aria-busy="true"><p>…</p></section>;
  const ruta = camino.ruta;
  if (!ruta) {
    return (
      <section className="cristal cristal--grande bloque">
        <p>{t.motorCitas.sinRuta}</p>
        <div className="acciones"><Link className="boton-cristal" href={`/${locale}/camino`}>{t.motorCitas.irCamino}</Link></div>
      </section>
    );
  }
  const cronos = motorCronos(ruta.citas);
  return (
    <>
      <section className="cristal cristal--grande bloque">
        <h2>{t.motorCitas.planificadas} · {t.rutas[ruta.id].nombre}</h2>
        {ruta.citas.length === 0 ? (
          <p>{t.nucleo.estadoCitas.ninguna}</p>
        ) : (
          <ul className="citas-ruta" style={{ marginTop: 10 }}>
            {ruta.citas.map((cita) => (
              <li key={cita}>
                <div>
                  <strong>{t.citas[cita].nombre}</strong>
                  <br />
                  <span>{t.autoridades[CITAS[cita].autoridad]} · {t.citas[cita].cuando}</span>
                </div>
                {!CITAS[cita].gestionable && <span>{t.nivelesCita.noGestionable}</span>}
              </li>
            ))}
          </ul>
        )}
      </section>
      {cronos.cobrables > 0 && (
        <div className="niveles bloque">
          {(["puede_esperar", "urgente"] as const).map((nivel) => (
            <section key={nivel} className={`cristal nivel ${nivel === "urgente" ? "urgente" : ""}`} aria-label={t.nivelesCita[nivel].nombre}>
              <span className={`etiqueta ${nivel === "urgente" ? "urgente" : "espera"}`}>{t.nivelesCita[nivel].nombre}</span>
              <p className="nivel-precio">{formatearEuros(NIVELES_CITA[nivel].precioCentimos, intl)} <small>{t.nivelesCita.porCita}</small></p>
              <p>{t.nivelesCita[nivel].promesa}</p>
              <p className="mono" style={{ marginTop: 10 }}>
                {cronos.cobrables} × {formatearEuros(NIVELES_CITA[nivel].precioCentimos, intl)} = {formatearEuros(cronos.porNivel[nivel], intl)}
              </p>
            </section>
          ))}
        </div>
      )}
      <div className="acciones">
        <Link className="boton-cristal plasma-oro" href={`/${locale}/${camino.referencia ? "expediente" : "camino"}`}>
          {camino.referencia ? t.listo.verExpediente : t.motorCitas.encargar}
        </Link>
      </div>
    </>
  );
}
