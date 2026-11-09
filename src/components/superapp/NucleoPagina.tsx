"use client";

import Link from "next/link";
import { COLOR_AGENTE, EmblemaAgente } from "@/components/holo/EmblemaAgente";
import type { Estacion } from "@/components/holo/NucleoHestia";
import { NucleoHestia } from "@/components/holo/NucleoHestia";
import { hoyIso } from "@/lib/almacen";
import { CITAS } from "@/lib/catalogo";
import { DICCIONARIOS } from "@/lib/i18n";
import type { Locale } from "@/lib/i18n/locales";
import { NOMBRE_NATIVO } from "@/lib/i18n/locales";
import type { MotorId } from "@/lib/motores";
import { AGENTE_DE_MOTOR, AGENTES, motorArgos, MOTORES } from "@/lib/motores";
import { useAlmacen } from "@/lib/useAlmacen";

// Ángulo de cada motor en la órbita del núcleo.
const ANGULO: Record<MotorId, number> = { camino: 300, citas: 12, documentos: 84, guardian: 156, expediente: 228 };
const REGLAS_PORTADA = ["abogado_revisa", "cita_gratis", "sin_bots", "urgente_no_salta_cola", "asilo_persona", "datos_cifrados"] as const;

export function NucleoPagina({ locale, expedientes }: { locale: Locale; expedientes: number | null }) {
  const t = DICCIONARIOS[locale];
  const { listo, camino, documentos, guardian } = useAlmacen();
  const ruta = camino.ruta;

  // Avance real del camino: terminado, con ruta, a medias o sin empezar.
  const progreso = !listo ? null : camino.referencia ? 1 : ruta ? 0.72 : camino.empezado ? Math.min(0.6, camino.paso / 9) : null;

  const estadoDe: Record<MotorId, string> = {
    camino: camino.referencia ? t.nucleo.estadoCamino.listo(t.rutas[ruta?.id ?? "consulta"].nombre) : ruta ? t.nucleo.estadoCamino.listo(t.rutas[ruta.id].nombre) : camino.empezado ? t.nucleo.estadoCamino.enCurso : t.nucleo.estadoCamino.sinEmpezar,
    citas: !ruta ? t.nucleo.estadoCitas.sinRuta : ruta.citas.filter((c) => CITAS[c].gestionable).length === 0 ? t.nucleo.estadoCitas.ninguna : t.nucleo.estadoCitas.conRuta(ruta.citas.filter((c) => CITAS[c].gestionable).length),
    documentos: !ruta ? t.nucleo.estadoDocumentos.sinRuta : t.nucleo.estadoDocumentos.conRuta(ruta.documentos.filter((d) => documentos[d] === "tengo").length, ruta.documentos.length),
    guardian: (() => {
      if (!guardian) return t.nucleo.estadoGuardian.sinFecha;
      const plazo = motorArgos(guardian, hoyIso());
      return plazo.estado === "lejos" ? t.nucleo.estadoGuardian.lejos(plazo.diasHastaVentana) : t.nucleo.estadoGuardian[plazo.estado];
    })(),
    expediente: expedientes === null ? t.nucleo.estadoExpediente.sinSesion : t.nucleo.estadoExpediente.conSesion(expedientes),
  };

  const estaciones: Estacion[] = MOTORES.map((m) => ({
    id: m,
    angulo: ANGULO[m],
    color: COLOR_AGENTE[AGENTE_DE_MOTOR[m]],
    activa: (m === "camino" && Boolean(ruta)) || (m === "guardian" && Boolean(guardian)) || (m === "expediente" && Boolean(expedientes)),
  }));

  const textoAccion = camino.referencia ? t.listo.verExpediente : camino.empezado ? t.nucleo.continuar : t.nucleo.empezar;
  const hrefAccion = camino.referencia ? `/${locale}/expediente` : `/${locale}/camino`;

  return (
    <>
      <section className="nucleo-portada">
        <div className="portada-texto">
          <p className="hud-etiqueta">
            <span>{t.app.nucleo}</span>
            <span className="oro">HESTIA · {t.agentes.HESTIA.rol}</span>
          </p>
          <p className="capitulo">{t.nucleo.saludo}</p>
          <h1 className="portada-titulo">{t.nucleo.titulo}</h1>
          <p className="portada-narrativa">{t.nucleo.narrativa}</p>
          <div className="portada-accion">
            <Link className="boton-cristal plasma-oro" href={hrefAccion}>{textoAccion}</Link>
            {!camino.referencia && <small>{t.nucleo.duracion}</small>}
          </div>
        </div>
        <div className="portada-nucleo marco-hud">
          <NucleoHestia tamano={380} progreso={progreso} estaciones={estaciones} etiqueta={`HESTIA · ${t.agentes.HESTIA.frase}`} />
          <div className="lecturas">
            <div className="lectura"><span className="lectura-nombre">{t.nucleo.lecturas.idioma}</span><span className="lectura-valor">{NOMBRE_NATIVO[locale]}</span></div>
            <div className="lectura"><span className="lectura-nombre">{t.nucleo.lecturas.agentes}</span><span className="lectura-valor">{AGENTES.length}</span></div>
            <div className="lectura"><span className="lectura-nombre">{t.nucleo.lecturas.datos}</span><span className="lectura-valor">{t.nucleo.lecturas.datosValor}</span></div>
          </div>
        </div>
      </section>

      <div className="motores-titulo">
        <div>
          <p className="hud-etiqueta"><span>{t.nucleo.motoresTitulo}</span></p>
          <h2>{t.nucleo.motoresTitulo}</h2>
        </div>
        <p>{t.nucleo.motoresNarrativa}</p>
      </div>
      <div className="motores">
        {MOTORES.map((m) => {
          const agente = AGENTE_DE_MOTOR[m];
          return (
            <Link key={m} href={`/${locale}/${m}`} className="motor cristal plasma-agente" style={{ "--agente": COLOR_AGENTE[agente] } as React.CSSProperties}>
              <EmblemaAgente agente={agente} tamano={52} />
              <div>
                <p className="hud-etiqueta"><span>{t.agentes[agente].nombre}</span><span>{t.agentes[agente].rol}</span></p>
                <p className="motor-nombre">{t.app.motores[m]}</p>
                <p className="motor-frase">{t.agentes[agente].frase}</p>
              </div>
              <div className="motor-pie">
                <span className="motor-estado">{listo ? estadoDe[m] : "…"}</span>
                <span className="motor-abrir" aria-hidden="true">{t.nucleo.abrir} →</span>
              </div>
            </Link>
          );
        })}
      </div>

      <section className="temis-banda cristal" style={{ "--agente": COLOR_AGENTE.TEMIS } as React.CSSProperties}>
        <p className="hud-etiqueta" style={{ color: "var(--agente-temis)" }}><span>{t.agentes.TEMIS.nombre}</span><span>{t.agentes.TEMIS.rol}</span></p>
        <h2>{t.nucleo.garantiasTitulo}</h2>
        <ul className="temis-reglas">
          {REGLAS_PORTADA.map((r) => <li key={r}>{t.temis[r]}</li>)}
        </ul>
      </section>
    </>
  );
}
