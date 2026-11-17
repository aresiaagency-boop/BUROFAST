"use client";

import { useId, useMemo, useSyncExternalStore } from "react";
import { COLOR_AGENTE } from "@/components/holo/EmblemaAgente";
import type { MarcaAro } from "@/components/holo/RadarExtranjeria";
import { arcoAro, R0, RadarExtranjeria } from "@/components/holo/RadarExtranjeria";
import { borrar, CLAVE_PAIS, escribir, hoyIso } from "@/lib/almacen";
import type { CitaId } from "@/lib/catalogo";
import { CITAS } from "@/lib/catalogo";
import type { EtapaId, Respuestas, Ruta } from "@/lib/diagnostico";
import { ETAPAS } from "@/lib/diagnostico";
import { DICCIONARIOS } from "@/lib/i18n";
import type { Locale } from "@/lib/i18n/locales";
import type { EstadoDocumento } from "@/lib/motores";
import { motorArgos } from "@/lib/motores";
import type { PaisRadar, ResaltadoRadar, VarianteRadar } from "@/lib/radar";
import { esPaisRadar, PAISES_RADAR, puntoEnArco, resaltadoRadar } from "@/lib/radar";
import { useAlmacen } from "@/lib/useAlmacen";

// Un radar por página, todos sobre el mismo mapamundi y con lo que el usuario
// eligió (idioma, pasaporte, país) en cristal. Lo que cambia es el agente que
// mira y su instrumento:
//   camino      ARIADNA · el hilo cruza el laberinto hasta Palma
//   citas       CRONOS · reloj: cada hora es un tipo de cita; brillan las tuyas
//   documentos  MNEMÓSINE · escáner; el aro, un segmento por documento
//   guardian    ARGOS · vigía sobre la península; el aro, la cuenta atrás
//   expediente  HESTIA · las etapas de tu camino sobre el hilo
//   nucleo      HESTIA · todo: avance real y los cinco motores en el aro

const CITAS_RELOJ = Object.keys(CITAS) as CitaId[];
const ETAPAS_HILO = ETAPAS.filter((e) => e !== "familia");

export function nombrePais(locale: Locale, pais: string) {
  try {
    return new Intl.DisplayNames([locale], { type: "region" }).of(pais) ?? pais;
  } catch {
    return pais;
  }
}

const sinSuscripcion = () => () => {};

export function SelectorPais({ locale, pais }: { locale: Locale; pais: PaisRadar | null }) {
  const t = DICCIONARIOS[locale].radarExtranjeria.pais;
  const id = useId();
  // Los nombres salen del Intl del navegador: el servidor no los pinta, así
  // dos versiones de CLDR distintas no rompen la hidratación.
  const montado = useSyncExternalStore(sinSuscripcion, () => true, () => false);
  const opciones = useMemo(() => {
    if (!montado) return [];
    const orden = new Intl.Collator(locale);
    return PAISES_RADAR.filter((c) => c !== "ES")
      .map((c) => ({ c, nombre: nombrePais(locale, c) }))
      .sort((a, b) => orden.compare(a.nombre, b.nombre));
  }, [locale, montado]);
  return (
    <div className="rx-selector">
      <label className="rx-selector-etiqueta" htmlFor={`${id}-pais`}>{t.etiqueta}</label>
      <select
        id={`${id}-pais`}
        aria-describedby={`${id}-ayuda`}
        value={montado ? (pais ?? "") : ""}
        onChange={(e) => {
          const valor = e.target.value;
          if (esPaisRadar(valor)) escribir(CLAVE_PAIS, { pais: valor });
          else borrar(CLAVE_PAIS);
        }}
      >
        <option value="">{t.ninguno}</option>
        {opciones.map((o) => (
          <option key={o.c} value={o.c}>{o.nombre}</option>
        ))}
      </select>
      <small id={`${id}-ayuda`}>{t.ayuda}</small>
    </div>
  );
}

export function LeyendaRadar({ locale, resaltado }: { locale: Locale; resaltado: ResaltadoRadar }) {
  const t = DICCIONARIOS[locale];
  const l = t.radarExtranjeria.leyenda;
  return (
    <ul className="rx-leyenda">
      <li data-nivel="zona"><span className="rx-muestra" aria-hidden="true" /><span>{l.idioma}</span><strong>{t.radar.zonas[resaltado.zona]}</strong></li>
      {resaltado.grupo && (
        <li data-nivel="grupo"><span className="rx-muestra" aria-hidden="true" /><span>{l.pasaporte}</span><strong>{t.pasaportes[resaltado.grupo].titulo}</strong></li>
      )}
      {resaltado.pais && (
        <li data-nivel="pais"><span className="rx-muestra" aria-hidden="true" /><span>{l.pais}</span><strong>{nombrePais(locale, resaltado.pais)}</strong></li>
      )}
      <li data-nivel="sede"><span className="rx-muestra" aria-hidden="true" /><strong>{resaltado.enEspana ? `${l.meta} · ${l.estasEnEspana}` : l.meta}</strong></li>
    </ul>
  );
}

// La leyenda con lo guardado en este dispositivo, para ponerla fuera del radar.
export function LeyendaUsuario({ locale }: { locale: Locale }) {
  const { camino, pais } = useAlmacen();
  return <LeyendaRadar locale={locale} resaltado={resaltadoRadar({ locale, respuestas: camino.respuestas, pais })} />;
}

// --- Instrumentos -----------------------------------------------------------

function Laberinto({ disco }: { disco: string }) {
  return (
    <g clipPath={`url(#${disco})`} className="rx-laberinto">
      {[0.2, 0.38, 0.56, 0.74, 0.92].map((f, i) => (
        <circle key={f} r={R0 * f} className="rx-laberinto-anillo" data-sentido={i % 2 ? "horario" : "antihorario"} vectorEffect="non-scaling-stroke" style={{ animationDuration: `${40 + i * 14}s` }} />
      ))}
    </g>
  );
}

function Reloj({ citas, locale, brillo }: { citas: readonly CitaId[]; locale: Locale; brillo: string }) {
  const t = DICCIONARIOS[locale];
  const proxima = CITAS_RELOJ.findIndex((c) => citas.includes(c) && CITAS[c].gestionable);
  return (
    <g className="rx-reloj">
      {Array.from({ length: 60 }, (_, i) => {
        const hora = i % 5 === 0;
        const a = ((i * 6 - 90) * Math.PI) / 180;
        const r1 = R0 * (hora ? 0.86 : 0.91);
        return <line key={i} x1={r1 * Math.cos(a)} y1={r1 * Math.sin(a)} x2={R0 * 0.95 * Math.cos(a)} y2={R0 * 0.95 * Math.sin(a)} className={hora ? "rx-reloj-hora" : "rx-reloj-minuto"} vectorEffect="non-scaling-stroke" />;
      })}
      {CITAS_RELOJ.map((c, i) => {
        const a = ((i * 30 - 90) * Math.PI) / 180;
        const r = R0 * 0.76;
        const tuya = citas.includes(c);
        return (
          <g key={c} transform={`translate(${(r * Math.cos(a)).toFixed(1)} ${(r * Math.sin(a)).toFixed(1)})`} className="rx-reloj-cita" data-tuya={tuya ? "si" : undefined}>
            <path d={tuya ? "M0 -16L16 0L0 16L-16 0Z" : "M0 -6L6 0L0 6L-6 0Z"} filter={tuya ? `url(#${brillo})` : undefined} />
            <title>{t.citas[c].nombre}</title>
          </g>
        );
      })}
      {/* Aguja de horas: la primera cita tuya que se puede gestionar. */}
      {proxima >= 0 && <line x1={0} y1={0} x2={0} y2={-R0 * 0.58} className="rx-reloj-aguja-hora" transform={`rotate(${proxima * 30})`} vectorEffect="non-scaling-stroke" />}
      <g className="rx-reloj-segundero">
        <circle r={R0} className="rx-caja" />
        <path d={`M0 0L0 ${-R0 * 0.9}A${R0 * 0.9} ${R0 * 0.9} 0 0 0 ${(-R0 * 0.9 * Math.sin(Math.PI / 9)).toFixed(1)} ${(-R0 * 0.9 * Math.cos(Math.PI / 9)).toFixed(1)}Z`} className="rx-reloj-estela" />
        <line x1={0} y1={R0 * 0.12} x2={0} y2={-R0 * 0.9} className="rx-reloj-aguja" vectorEffect="non-scaling-stroke" />
      </g>
      <circle r={R0 * 0.035} className="rx-reloj-eje" />
    </g>
  );
}

function Escaner({ disco, documentos }: { disco: string; documentos: EstadoDocumento[] }) {
  const n = documentos.length;
  const hueco = n > 1 ? 3 : 0;
  return (
    <>
      <g clipPath={`url(#${disco})`} className="rx-escaner">
        {Array.from({ length: 15 }, (_, i) => {
          const y = -R0 + ((i + 1) * 2 * R0) / 16;
          return <line key={i} x1={-R0} y1={y} x2={R0} y2={y} className="rx-escaner-rejilla" vectorEffect="non-scaling-stroke" />;
        })}
        <g className="rx-escaner-haz">
          <rect x={-R0} y={-R0 * 0.3} width={R0 * 2} height={R0 * 0.3} className="rx-escaner-estela" />
          <line x1={-R0} y1={0} x2={R0} y2={0} className="rx-escaner-linea" vectorEffect="non-scaling-stroke" />
        </g>
      </g>
      {documentos.map((estado, i) => (
        <path key={i} d={arcoAro((i * 360) / n + hueco / 2, ((i + 1) * 360) / n - hueco / 2, R0 + 42)} className="rx-documento" data-estado={estado} vectorEffect="non-scaling-stroke" />
      ))}
    </>
  );
}

function Vigia({ disco, cuenta }: { disco: string; cuenta: { fraccion: number; estado: string } | null }) {
  return (
    <>
      <g clipPath={`url(#${disco})`} className="rx-vigia">
        {[0, 1, 2].map((i) => (
          <circle key={i} r={R0} className="rx-vigia-onda" style={{ animationDelay: `${i * 1.6}s` }} vectorEffect="non-scaling-stroke" />
        ))}
        <circle r={R0 * 0.62} className="rx-vigia-iris" vectorEffect="non-scaling-stroke" />
        <circle r={R0 * 0.34} className="rx-vigia-iris rx-vigia-iris--interior" vectorEffect="non-scaling-stroke" />
        <path d={`M${-R0} 0Q0 ${-R0 * 0.62} ${R0} 0Q0 ${R0 * 0.62} ${-R0} 0Z`} className="rx-vigia-ojo" vectorEffect="non-scaling-stroke" />
      </g>
      {cuenta && <path d={arcoAro(0, Math.max(2, cuenta.fraccion * 360), R0 + 42)} className="rx-cuenta" data-estado={cuenta.estado} vectorEffect="non-scaling-stroke" />}
    </>
  );
}

// Estaciones del expediente sobre el hilo, en coordenadas del mapa.
function Etapas({ origen, actual, locale, soloMeta }: { origen: { x: number; y: number }; actual: number; locale: Locale; soloMeta: boolean }) {
  const t = DICCIONARIOS[locale];
  return (
    <g className="rx-etapas">
      {ETAPAS_HILO.map((e, i) => {
        const p = puntoEnArco(origen.x, origen.y, 0.18 + (i / (ETAPAS_HILO.length - 1)) * 0.8);
        // Con el expediente del servidor solo se sabe hacia dónde va, no qué hay hecho.
        const estado = i === actual ? "actual" : i < actual && !soloMeta ? "hecha" : "futura";
        return (
          <g key={e} transform={`translate(${p.x} ${p.y})`} className="rx-etapa" data-estado={estado}>
            <circle r={estado === "actual" ? 9 : 6} />
            <title>{t.etapas[e]}</title>
          </g>
        );
      })}
    </g>
  );
}

// --- El radar de cada página ---------------------------------------------

const MOTORES_ARO = [
  { motor: "camino", agente: "ARIADNA", angulo: 300 },
  { motor: "citas", agente: "CRONOS", angulo: 12 },
  { motor: "documentos", agente: "MNEMOSINE", angulo: 84 },
  { motor: "guardian", agente: "ARGOS", angulo: 156 },
  { motor: "expediente", agente: "HESTIA", angulo: 228 },
] as const;

export function RadarPagina({
  locale,
  variante,
  respuestas: respuestasForzadas,
  ruta: rutaForzada,
  progreso = null,
  activos,
  etapaServidor,
  conLeyenda = true,
  pie,
}: {
  locale: Locale;
  variante: Exclude<VarianteRadar, "pagos" | "acceso">;
  // El diagnóstico pasa sus respuestas en vivo; el resto lee las guardadas.
  respuestas?: Partial<Respuestas>;
  ruta?: Ruta | null;
  progreso?: number | null;
  activos?: Partial<Record<(typeof MOTORES_ARO)[number]["motor"], boolean>>;
  // Expediente con sesión: la etapa a la que lleva la ruta guardada en el
  // servidor manda sobre el diagnóstico de este navegador (null = sin expediente).
  etapaServidor?: EtapaId | null;
  conLeyenda?: boolean;
  pie?: React.ReactNode;
}) {
  const t = DICCIONARIOS[locale];
  const { camino, documentos, guardian, pais } = useAlmacen();
  const respuestas = respuestasForzadas ?? camino.respuestas;
  const ruta = rutaForzada !== undefined ? rutaForzada : camino.ruta;
  const resaltado = resaltadoRadar({ locale, respuestas, pais });

  let marcas: MarcaAro[] = [];
  let lectura: string | null = null;
  let instrumento: Parameters<typeof RadarExtranjeria>[0]["instrumento"];
  let sobreMapa: React.ReactNode = null;
  let barrido: { periodo: number; estela?: number } | null = null;
  let hilo: "arco" | "ariadna" | "ninguno" = "arco";

  switch (variante) {
    case "nucleo":
      barrido = { periodo: 8 };
      marcas = MOTORES_ARO.map((m) => ({ angulo: m.angulo, tono: COLOR_AGENTE[m.agente], activa: Boolean(activos?.[m.motor]), titulo: `${t.agentes[m.agente].nombre} · ${t.app.motores[m.motor]}` }));
      break;
    case "camino":
      hilo = "ariadna";
      instrumento = ({ disco }) => <Laberinto disco={disco} />;
      break;
    case "citas": {
      const citas = ruta?.citas ?? [];
      instrumento = ({ brillo }) => <Reloj citas={citas} locale={locale} brillo={brillo} />;
      const gestionables = citas.filter((c) => CITAS[c].gestionable).length;
      lectura = !ruta ? t.nucleo.estadoCitas.sinRuta : gestionables === 0 ? t.nucleo.estadoCitas.ninguna : t.nucleo.estadoCitas.conRuta(gestionables);
      hilo = "ninguno";
      break;
    }
    case "documentos": {
      const lista = (ruta?.documentos ?? []).map((d) => documentos[d] ?? ("falta" as EstadoDocumento));
      instrumento = ({ disco }) => <Escaner disco={disco} documentos={lista} />;
      lectura = !ruta ? t.nucleo.estadoDocumentos.sinRuta : t.nucleo.estadoDocumentos.conRuta(lista.filter((e) => e === "tengo").length, lista.length);
      break;
    }
    case "guardian": {
      const plazo = guardian ? motorArgos(guardian, hoyIso()) : null;
      const cuenta = plazo ? { fraccion: plazo.estado === "lejos" ? Math.min(1, plazo.diasHastaVentana / 365) : 1, estado: plazo.estado } : null;
      instrumento = ({ disco }) => <Vigia disco={disco} cuenta={cuenta} />;
      lectura = !plazo ? t.nucleo.estadoGuardian.sinFecha : plazo.estado === "lejos" ? t.nucleo.estadoGuardian.lejos(plazo.diasHastaVentana) : t.nucleo.estadoGuardian[plazo.estado];
      hilo = "ninguno";
      break;
    }
    case "expediente": {
      barrido = { periodo: 14, estela: 16 };
      const servidor = etapaServidor !== undefined;
      const etapaId = servidor ? etapaServidor : (ruta?.etapaActual ?? null);
      const etapa = etapaId ? ETAPAS_HILO.indexOf(etapaId === "familia" ? "residencia" : etapaId) : -1;
      if (resaltado.origen) sobreMapa = <Etapas origen={resaltado.origen} actual={etapa} locale={locale} soloMeta={servidor} />;
      lectura = !etapaId ? null : servidor ? t.radarExtranjeria.rumbo(t.etapas[etapaId]) : t.radarExtranjeria.etapa(t.etapas[etapaId]);
      break;
    }
  }

  return (
    <figure className={`rx-figura rx-figura--${variante}`}>
      <RadarExtranjeria
        variante={variante}
        etiqueta={t.radarExtranjeria.titulo[variante]}
        zona={resaltado.zona}
        grupo={resaltado.grupo}
        pais={resaltado.pais}
        origen={resaltado.origen}
        enEspana={resaltado.enEspana}
        progreso={progreso}
        marcas={marcas}
        barrido={barrido}
        instrumento={instrumento}
        sobreMapa={sobreMapa}
        hilo={hilo}
      />
      {(conLeyenda || lectura || pie) && (
        <figcaption className="rx-pie">
          {lectura && <p className="rx-lectura">{lectura}</p>}
          {conLeyenda && <LeyendaRadar locale={locale} resaltado={resaltado} />}
          {pie}
        </figcaption>
      )}
    </figure>
  );
}
