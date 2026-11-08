"use client";

import Link from "next/link";
import { useEffect, useMemo, useReducer, useRef, useState } from "react";
import type { NivelCita } from "@/lib/catalogo";
import { CITAS, formatearEuros, NIVELES_CITA, presupuesto } from "@/lib/catalogo";
import type { Respuestas, Ruta } from "@/lib/diagnostico";
import { diagnosticar, ETAPA_DE_RUTA, ETAPAS, PASAPORTES, preguntaResidenciaLegal, SITUACIONES, SUENOS, TIEMPOS, UBICACIONES } from "@/lib/diagnostico";
import { DICCIONARIOS } from "@/lib/i18n";
import type { Locale } from "@/lib/i18n/locales";
import { direccion, ETIQUETA_INTL } from "@/lib/i18n/locales";
import type { PasoId } from "@/lib/i18n/tipos";
import { Icono, type NombreIcono } from "@/components/Iconos";
import { SimboloBurofast } from "@/components/Marca";
import { Sendero } from "@/components/funnel/Sendero";

type Estado = {
  historial: PasoId[];
  respuestas: Partial<Respuestas>;
  // undefined = todavía no ha elegido; null = gestiona sus citas él mismo.
  nivelCita: NivelCita | null | undefined;
  conGuardian: boolean;
  referencia: string | null;
  // Pasa a true cuando ya se intentó leer sessionStorage: hasta entonces no se
  // escribe, para no pisar un camino guardado con el estado inicial.
  restaurado: boolean;
};

type Accion =
  | { tipo: "responder"; campo: keyof Respuestas; valor: string | null; siguiente: PasoId }
  | { tipo: "ir"; paso: PasoId }
  | { tipo: "atras" }
  | { tipo: "nivelCita"; valor: NivelCita | null }
  | { tipo: "guardian"; valor: boolean }
  | { tipo: "terminar"; referencia: string }
  | { tipo: "reiniciar" }
  | { tipo: "restaurar"; estado: Estado };

const INICIAL: Estado = { historial: ["sueno"], respuestas: {}, nivelCita: undefined, conGuardian: false, referencia: null, restaurado: false };
const CLAVE_ALMACEN = "burofast.camino.v1";

function reducir(estado: Estado, accion: Accion): Estado {
  switch (accion.tipo) {
    case "responder": {
      const respuestas = { ...estado.respuestas, [accion.campo]: accion.valor };
      // Fuera de España, situación y tiempo no aplican: se limpian para que el
      // diagnóstico no use respuestas de un intento anterior.
      if (accion.campo === "ubicacion" && accion.valor === "fuera") {
        respuestas.situacion = null;
        respuestas.tiempo = null;
      }
      return { ...estado, respuestas, nivelCita: undefined, historial: [...estado.historial, accion.siguiente] };
    }
    case "ir":
      return { ...estado, historial: [...estado.historial, accion.paso] };
    case "atras":
      return estado.historial.length > 1 ? { ...estado, historial: estado.historial.slice(0, -1) } : estado;
    case "nivelCita":
      return { ...estado, nivelCita: accion.valor };
    case "guardian":
      return { ...estado, conGuardian: accion.valor };
    case "terminar":
      return { ...estado, referencia: accion.referencia, historial: [...estado.historial, "listo"] };
    case "reiniciar":
      return { ...INICIAL, restaurado: true };
    case "restaurar":
      return { ...accion.estado, restaurado: true };
  }
}

const ICONO_SUENO: Record<(typeof SUENOS)[number], NombreIcono> = {
  trabajar: "maletin", estudiar: "libro", familia: "familia", regularizar: "escudo",
  renovar: "renovar", nacionalidad: "estrella", emprender: "chispa", llegar: "puerta",
};

const HITO: Record<PasoId, number> = {
  idioma: 0, sueno: 0, ubicacion: 1, situacion: 1, tiempo: 1, pasaporte: 1, camino: 2, citas: 3, plan: 4, contacto: 5, listo: 6,
};

function respuestasCompletas(r: Partial<Respuestas>): r is Respuestas {
  return Boolean(r.sueno && r.ubicacion && r.pasaporte && (r.ubicacion === "fuera" || (r.situacion && r.tiempo)));
}

function recorridoPrevisto(r: Partial<Respuestas>, ruta: Ruta | null): PasoId[] {
  const pasos: PasoId[] = ["sueno", "ubicacion"];
  if (r.ubicacion !== "fuera") pasos.push("situacion", "tiempo");
  pasos.push("pasaporte", "camino");
  if (!ruta || ruta.citas.some((c) => CITAS[c].gestionable)) pasos.push("citas");
  pasos.push("plan", "contacto");
  return pasos;
}

export function Funnel({ locale, whatsapp }: { locale: Locale; whatsapp: string | null }) {
  const t = DICCIONARIOS[locale];
  const rtl = direccion(locale) === "rtl";
  const [estado, despachar] = useReducer(reducir, INICIAL);
  const tituloRef = useRef<HTMLHeadingElement>(null);
  const paso = estado.historial.at(-1) ?? "sueno";

  // Las respuestas sobreviven a una recarga en sessionStorage; los datos de
  // contacto nunca se guardan en el navegador.
  useEffect(() => {
    let guardado: Estado = INICIAL;
    try {
      const texto = sessionStorage.getItem(CLAVE_ALMACEN);
      if (texto) guardado = { ...INICIAL, ...(JSON.parse(texto) as Estado) };
    } catch {
      // Navegación privada o almacenamiento bloqueado: se empieza de cero.
    }
    despachar({ tipo: "restaurar", estado: guardado });
  }, []);

  useEffect(() => {
    if (!estado.restaurado) return;
    try {
      sessionStorage.setItem(CLAVE_ALMACEN, JSON.stringify(estado));
    } catch {
      // Sin almacenamiento el camino sigue funcionando, solo no sobrevive a recargas.
    }
  }, [estado]);

  useEffect(() => {
    tituloRef.current?.focus();
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, [paso]);

  const ruta = useMemo(() => (respuestasCompletas(estado.respuestas) ? diagnosticar(estado.respuestas) : null), [estado.respuestas]);
  const previsto = recorridoPrevisto(estado.respuestas, ruta);
  const indicePaso = Math.max(0, previsto.indexOf(paso));
  const textos = paso === "tiempo" && preguntaResidenciaLegal(estado.respuestas.situacion) ? t.tiempoLegal : t.pasos[paso];

  const responder = (campo: keyof Respuestas, valor: string | null, siguiente: PasoId) =>
    despachar({ tipo: "responder", campo, valor, siguiente });

  return (
    <div className="funnel" lang={locale} dir={direccion(locale)}>
      <header className="cabecera">
        <Link className="marca" href="/">
          <SimboloBurofast />
          <span>
            <span className="marca-nombre">BUROFAST</span>
            <span className="marca-lema">{t.marca.lema}</span>
          </span>
        </Link>
        <Link className="boton-texto" href="/">{t.comun.cambiarIdioma}</Link>
      </header>

      <Sendero hito={HITO[paso]} capitulo={textos.capitulo} meta={t.comun.meta} rtl={rtl} />

      <main className="escena entrar" key={paso} aria-live="polite">
        <p className="capitulo">{textos.capitulo}</p>
        <h1 className="titulo-paso" tabIndex={-1} ref={tituloRef}>{textos.titulo}</h1>
        <p className="narrativa">{textos.narrativa}</p>
        {(paso === "situacion" || paso === "tiempo" || paso === "pasaporte") && (
          <p className="aviso-ia" style={{ marginTop: -12, marginBottom: 18 }}>{t.comun.privacidadCorta}</p>
        )}

        {paso === "sueno" && (
          <>
            <div className="hestia">
              <SimboloBurofast tamano={30} />
              <p>
                <strong>HESTIA · </strong>{t.marca.agentePresenta}
                <span className="aviso-ia">{t.comun.avisoIa}</span>
              </p>
            </div>
            <div className="opciones dos">
              {SUENOS.map((sueno) => (
                <BotonOpcion key={sueno} icono={ICONO_SUENO[sueno]} titulo={t.suenos[sueno].titulo} detalle={t.suenos[sueno].detalle}
                  marcado={estado.respuestas.sueno === sueno} onElegir={() => responder("sueno", sueno, "ubicacion")} />
              ))}
            </div>
          </>
        )}

        {paso === "ubicacion" && (
          <div className="opciones">
            {UBICACIONES.map((ubicacion) => (
              <BotonOpcion key={ubicacion} icono={ubicacion === "espana" ? "pin" : "globo"} titulo={t.ubicaciones[ubicacion].titulo}
                detalle={t.ubicaciones[ubicacion].detalle} marcado={estado.respuestas.ubicacion === ubicacion}
                onElegir={() => responder("ubicacion", ubicacion, ubicacion === "espana" ? "situacion" : "pasaporte")} />
            ))}
          </div>
        )}

        {paso === "situacion" && (
          <div className="opciones">
            {SITUACIONES.map((situacion) => (
              <BotonOpcion key={situacion} icono="documento" titulo={t.situaciones[situacion].titulo} detalle={t.situaciones[situacion].detalle}
                marcado={estado.respuestas.situacion === situacion} onElegir={() => responder("situacion", situacion, "tiempo")} />
            ))}
          </div>
        )}

        {paso === "tiempo" && (
          <div className="opciones">
            {TIEMPOS.map((tiempo) => (
              <BotonOpcion key={tiempo} icono="reloj" titulo={t.tiempos[tiempo]} marcado={estado.respuestas.tiempo === tiempo}
                onElegir={() => responder("tiempo", tiempo, "pasaporte")} />
            ))}
          </div>
        )}

        {paso === "pasaporte" && (
          <div className="opciones">
            {PASAPORTES.map((pasaporte) => (
              <BotonOpcion key={pasaporte} icono="pasaporte" titulo={t.pasaportes[pasaporte].titulo} detalle={t.pasaportes[pasaporte].detalle}
                marcado={estado.respuestas.pasaporte === pasaporte} onElegir={() => responder("pasaporte", pasaporte, "camino")} />
            ))}
          </div>
        )}

        {paso === "camino" && ruta && <PasoCamino locale={locale} ruta={ruta} onSeguir={() => despachar({ tipo: "ir", paso: previsto.includes("citas") ? "citas" : "plan" })} />}

        {paso === "citas" && ruta && (
          <PasoCitas locale={locale} ruta={ruta} elegido={estado.nivelCita}
            onElegir={(valor) => despachar({ tipo: "nivelCita", valor })} onSeguir={() => despachar({ tipo: "ir", paso: "plan" })} />
        )}

        {paso === "plan" && ruta && (
          <PasoPlan locale={locale} ruta={ruta} nivelCita={estado.nivelCita ?? null} conGuardian={estado.conGuardian}
            onGuardian={(valor) => despachar({ tipo: "guardian", valor })} onSeguir={() => despachar({ tipo: "ir", paso: "contacto" })} />
        )}

        {paso === "contacto" && ruta && respuestasCompletas(estado.respuestas) && (
          <PasoContacto locale={locale} respuestas={estado.respuestas} nivelCita={estado.nivelCita ?? null} conGuardian={estado.conGuardian}
            whatsapp={whatsapp} onTerminado={(referencia) => despachar({ tipo: "terminar", referencia })} />
        )}

        {paso === "listo" && estado.referencia && (
          <PasoListo locale={locale} referencia={estado.referencia} whatsapp={whatsapp} onReiniciar={() => {
            try { sessionStorage.removeItem(CLAVE_ALMACEN); } catch { /* sin almacenamiento */ }
            despachar({ tipo: "reiniciar" });
          }} />
        )}

        {/* Un camino sin respuestas suficientes (p. ej. tras borrar datos) vuelve al principio. */}
        {["camino", "citas", "plan", "contacto"].includes(paso) && !ruta && estado.restaurado && (
          <div className="acciones"><button className="boton" type="button" onClick={() => despachar({ tipo: "reiniciar" })}>{t.listo.reiniciar}</button></div>
        )}
      </main>

      <footer className="pie">
        {paso !== "listo" && estado.historial.length > 1 ? (
          <button className="boton-texto" type="button" onClick={() => despachar({ tipo: "atras" })}>{rtl ? "→" : "←"} {t.comun.atras}</button>
        ) : <span />}
        <span>{paso === "listo" ? t.comun.meta : t.comun.paso(indicePaso + 1, previsto.length)}</span>
      </footer>
    </div>
  );
}

function BotonOpcion({ icono, titulo, detalle, marcado, onElegir }: { icono: NombreIcono; titulo: string; detalle?: string; marcado: boolean; onElegir: () => void }) {
  return (
    <button type="button" className="opcion" aria-pressed={marcado} onClick={onElegir}>
      <span className="opcion-icono"><Icono nombre={icono} /></span>
      <span>
        <span className="opcion-titulo">{titulo}</span>
        {detalle && <span className="opcion-detalle">{detalle}</span>}
      </span>
    </button>
  );
}

function PasoCamino({ locale, ruta, onSeguir }: { locale: Locale; ruta: Ruta; onSeguir: () => void }) {
  const t = DICCIONARIOS[locale];
  const principales = ETAPAS.filter((e) => e !== "familia" || ruta.etapaActual === "familia" || (ruta.siguiente && ETAPA_DE_RUTA[ruta.siguiente] === "familia"));
  const actual = principales.indexOf(ruta.etapaActual);
  const siguienteEtapa = ruta.siguiente ? ETAPA_DE_RUTA[ruta.siguiente] : null;
  return (
    <>
      <ol className="etapas" aria-label={t.camino.tuRuta}>
        {principales.map((etapa, indice) => (
          <li key={etapa} className={`etapa${indice < actual ? " hecha" : ""}${indice === actual ? " actual" : ""}${etapa === siguienteEtapa && indice !== actual ? " siguiente" : ""}`}
            aria-current={indice === actual ? "step" : undefined}>
            {t.etapas[etapa]}
            {indice === actual && <span className="etapa-marca">{t.camino.estasAqui}</span>}
          </li>
        ))}
      </ol>
      <section className="tarjeta">
        <p className="capitulo">{t.camino.tuRuta}</p>
        <h2>{t.rutas[ruta.id].nombre}</h2>
        <p>{t.rutas[ruta.id].resumen}</p>
      </section>
      <section className="tarjeta">
        <h3>{t.camino.quienFirma}</h3>
        <p>{t.niveles[ruta.nivel]}</p>
      </section>
      {ruta.documentos.length > 0 && (
        <section className="tarjeta">
          <h3>{t.camino.documentos}</h3>
          <ul className="lista">{ruta.documentos.map((doc) => <li key={doc}>{t.documentos[doc]}</li>)}</ul>
        </section>
      )}
      <section className="tarjeta">
        <ul className="avisos">{ruta.avisos.map((aviso) => <li key={aviso}>{t.avisos[aviso]}</li>)}</ul>
      </section>
      {ruta.siguiente && (
        <section className="tarjeta">
          <h3>{t.camino.siguiente}</h3>
          <p>{t.rutas[ruta.siguiente].nombre}</p>
        </section>
      )}
      <div className="acciones"><button className="boton" type="button" onClick={onSeguir}>{t.comun.continuar}</button></div>
    </>
  );
}

function PasoCitas({ locale, ruta, elegido, onElegir, onSeguir }: { locale: Locale; ruta: Ruta; elegido: NivelCita | null | undefined; onElegir: (v: NivelCita | null) => void; onSeguir: () => void }) {
  const t = DICCIONARIOS[locale];
  const intl = ETIQUETA_INTL[locale];
  const cobrables = ruta.citas.filter((c) => CITAS[c].gestionable);
  return (
    <>
      <section className="tarjeta">
        <h3>{t.nivelesCita.citasDeTuRuta}</h3>
        <ul className="citas-ruta">
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
      </section>
      <div className="niveles" role="group" aria-label={t.pasos.citas.titulo}>
        {(["puede_esperar", "urgente"] as const).map((nivel) => (
          <button key={nivel} type="button" className={`tarjeta nivel ${nivel === "urgente" ? "urgente" : ""}`} aria-pressed={elegido === nivel} onClick={() => onElegir(nivel)}>
            <span className={`etiqueta ${nivel === "urgente" ? "urgente" : "espera"}`}>{t.nivelesCita[nivel].nombre}</span>
            <p className="nivel-precio">
              {formatearEuros(NIVELES_CITA[nivel].precioCentimos, intl)} <small>{t.nivelesCita.porCita}</small>
            </p>
            <p>{t.nivelesCita[nivel].promesa}</p>
            <ul className="lista">{t.nivelesCita[nivel].incluye.map((linea) => <li key={linea}>{linea}</li>)}</ul>
            <p className="mono" style={{ marginTop: 10 }}>{cobrables.length} × {formatearEuros(NIVELES_CITA[nivel].precioCentimos, intl)} = {formatearEuros(cobrables.length * NIVELES_CITA[nivel].precioCentimos, intl)}</p>
          </button>
        ))}
      </div>
      <button type="button" className="opcion" style={{ marginTop: 12 }} aria-pressed={elegido === null} onClick={() => onElegir(null)}>
        <span className="opcion-icono"><Icono nombre="calendario" /></span>
        <span className="opcion-titulo">{t.nivelesCita.sinGestion}</span>
      </button>
      <section className="tarjeta" style={{ marginTop: 14 }}>
        <h3>{t.nivelesCita.reglasTitulo}</h3>
        <ul className="avisos">{t.nivelesCita.reglas.map((regla) => <li key={regla}>{regla}</li>)}</ul>
        <p style={{ marginTop: 10, color: "var(--oro-claro)" }}>{t.nivelesCita.garantia}</p>
      </section>
      <div className="acciones">
        <button className="boton" type="button" disabled={elegido === undefined} onClick={onSeguir}>{t.comun.continuar}</button>
      </div>
    </>
  );
}

function PasoPlan({ locale, ruta, nivelCita, conGuardian, onGuardian, onSeguir }: { locale: Locale; ruta: Ruta; nivelCita: NivelCita | null; conGuardian: boolean; onGuardian: (v: boolean) => void; onSeguir: () => void }) {
  const t = DICCIONARIOS[locale];
  const intl = ETIQUETA_INTL[locale];
  const gratis = ruta.nivel === "N3";
  const ofrecerGuardian = !gratis && ruta.producto !== "guardian";
  const importe = presupuesto({ producto: ruta.producto, citas: ruta.citas, nivelCita, conGuardian: ofrecerGuardian && conGuardian });
  return (
    <>
      <section className="tarjeta">
        <table className="resumen-plan">
          <tbody>
            <tr><td>{t.productos[ruta.producto]}</td><td>{gratis ? t.plan.gratis : formatearEuros(importe.honorarios, intl)}</td></tr>
            {nivelCita && importe.citas > 0 && (
              <tr><td>{t.plan.citas} · {t.nivelesCita[nivelCita].nombre}</td><td>{formatearEuros(importe.citas, intl)}</td></tr>
            )}
            {importe.guardian > 0 && <tr><td>{t.productos.guardian}</td><td>{formatearEuros(importe.guardian, intl)}</td></tr>}
            <tr className="total"><td>{t.plan.total}</td><td>{gratis ? t.plan.gratis : formatearEuros(importe.total, intl)}</td></tr>
            {!gratis && importe.total > 0 && (
              <>
                <tr className="hito"><td>{t.plan.alEncargo}</td><td>{formatearEuros(importe.alEncargo, intl)}</td></tr>
                <tr className="hito"><td>{t.plan.alPresentar}</td><td>{formatearEuros(importe.alPresentar, intl)}</td></tr>
              </>
            )}
          </tbody>
        </table>
        {!gratis && <p style={{ marginTop: 10, fontSize: "0.85rem" }}>{t.plan.tasas}</p>}
      </section>
      {ofrecerGuardian && (
        <label className="tarjeta interruptor">
          <input type="checkbox" checked={conGuardian} onChange={(e) => onGuardian(e.target.checked)} />
          <span>
            <strong>{t.plan.guardian} · {formatearEuros(4_900, intl)}</strong>
            <br />
            <span style={{ color: "var(--texto-suave)" }}>{t.plan.guardianDetalle}</span>
          </span>
        </label>
      )}
      <div className="acciones"><button className="boton" type="button" onClick={onSeguir}>{t.comun.continuar}</button></div>
    </>
  );
}

function PasoContacto({ locale, respuestas, nivelCita, conGuardian, whatsapp, onTerminado }: { locale: Locale; respuestas: Respuestas; nivelCita: NivelCita | null; conGuardian: boolean; whatsapp: string | null; onTerminado: (referencia: string) => void }) {
  const t = DICCIONARIOS[locale];
  const [enviando, setEnviando] = useState(false);
  const [fallo, setFallo] = useState<string | null>(null);
  const [camposMal, setCamposMal] = useState<string[]>([]);
  const [sinServicio, setSinServicio] = useState(false);

  async function enviar(evento: React.FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    const datos = new FormData(evento.currentTarget);
    setEnviando(true);
    setFallo(null);
    setCamposMal([]);
    try {
      const respuesta = await fetch("/api/v1/leads", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          locale,
          respuestas,
          nivelCita,
          conGuardian,
          nombre: String(datos.get("nombre") ?? ""),
          telefono: String(datos.get("telefono") ?? ""),
          email: String(datos.get("email") ?? ""),
          consentimientoPrivacidad: datos.get("privacidad") === "on",
          consentimientoMarketing: datos.get("marketing") === "on",
          web: String(datos.get("web") ?? ""),
        }),
      });
      const cuerpo = (await respuesta.json().catch(() => null)) as { referencia?: string; error?: { codigo: string; detalle?: { campos?: string[] } } } | null;
      if (respuesta.ok && cuerpo?.referencia) {
        onTerminado(cuerpo.referencia);
        return;
      }
      if (respuesta.status === 400) {
        setCamposMal(cuerpo?.error?.detalle?.campos ?? []);
        setFallo(t.contacto.errorValidacion);
      } else if (respuesta.status === 429) {
        setFallo(t.contacto.errorLimite);
      } else if (respuesta.status === 503) {
        setSinServicio(true);
        setFallo(t.contacto.errorConfig);
      } else {
        setFallo(t.contacto.errorRed);
      }
    } catch {
      setFallo(t.contacto.errorRed);
    } finally {
      setEnviando(false);
    }
  }

  const mal = (campo: string) => camposMal.includes(campo);
  return (
    <form className="formulario tarjeta" onSubmit={enviar} noValidate>
      <div className="campo">
        <label htmlFor="nombre">{t.contacto.nombre}</label>
        <input id="nombre" name="nombre" autoComplete="name" required minLength={2} maxLength={80} aria-invalid={mal("nombre")} />
      </div>
      <div className="campo">
        <label htmlFor="telefono">{t.contacto.telefono}</label>
        <input id="telefono" name="telefono" type="tel" inputMode="tel" autoComplete="tel" required dir="ltr" placeholder="+34 600 000 000" aria-invalid={mal("telefono")} aria-describedby="telefono-ayuda" />
        <small id="telefono-ayuda">{t.contacto.telefonoAyuda}</small>
      </div>
      <div className="campo">
        <label htmlFor="email">{t.contacto.email} <span style={{ color: "var(--texto-tenue)", fontWeight: 400 }}>({t.contacto.opcional})</span></label>
        <input id="email" name="email" type="email" autoComplete="email" dir="ltr" aria-invalid={mal("email")} />
      </div>
      <input className="trampa" name="web" tabIndex={-1} autoComplete="off" aria-hidden="true" />
      <label className="interruptor">
        <input type="checkbox" name="privacidad" required aria-invalid={mal("consentimientoPrivacidad")} />
        <span>{t.contacto.privacidad}</span>
      </label>
      <label className="interruptor">
        <input type="checkbox" name="marketing" />
        <span>{t.contacto.marketing}</span>
      </label>
      <p className="aviso-ia">{t.comun.avisoIa} {t.comun.privacidadCorta}</p>
      {fallo && <div className="alerta error" role="alert">{fallo}</div>}
      {sinServicio && whatsapp && (
        <a className="boton secundario" href={`https://wa.me/${whatsapp}`} target="_blank" rel="noopener noreferrer">{t.listo.whatsapp}</a>
      )}
      <button className="boton oro" type="submit" disabled={enviando}>{enviando ? t.contacto.enviando : t.contacto.enviar}</button>
    </form>
  );
}

function PasoListo({ locale, referencia, whatsapp, onReiniciar }: { locale: Locale; referencia: string; whatsapp: string | null; onReiniciar: () => void }) {
  const t = DICCIONARIOS[locale];
  const mensaje = encodeURIComponent(`HESTIA · ${t.listo.referencia}: ${referencia}`);
  return (
    <section className="tarjeta celebracion">
      <svg width="96" height="96" viewBox="0 0 96 96" aria-hidden="true" style={{ margin: "0 auto 8px", display: "block" }}>
        <circle cx="48" cy="48" r="44" fill="rgba(214,181,110,0.12)" className="hogar-brillo" />
        <path d="M24 50 48 28l24 22v24H24z" fill="#10253B" stroke="#D6B56E" strokeWidth="3" strokeLinejoin="round" />
        <path d="M48 46c5 4.6 7 8.2 7 11.6a7 7 0 0 1-14 0c0-3.4 2-7 7-11.6z" fill="#F1DCAA" />
      </svg>
      <p className="capitulo">{t.listo.referencia}</p>
      <p className="codigo" dir="ltr">{referencia}</p>
      <p style={{ margin: "12px 0" }}>{t.listo.siguientePaso}</p>
      <div className="acciones" style={{ justifyContent: "center" }}>
        {whatsapp ? (
          <a className="boton oro" href={`https://wa.me/${whatsapp}?text=${mensaje}`} target="_blank" rel="noopener noreferrer">{t.listo.whatsapp}</a>
        ) : (
          <p className="alerta info">{t.listo.whatsappNoConfigurado}</p>
        )}
        <button className="boton secundario" type="button" onClick={onReiniciar}>{t.listo.reiniciar}</button>
      </div>
    </section>
  );
}
