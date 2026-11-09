"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { COLOR_AGENTE, EmblemaAgente } from "@/components/holo/EmblemaAgente";
import { NucleoHestia } from "@/components/holo/NucleoHestia";
import { CLAVE_CONVERSACION, leerCamino } from "@/lib/almacen";
import { emitirHestia, EVENTO_PREGUNTAR } from "@/lib/hestia/vivo";
import { DICCIONARIOS } from "@/lib/i18n";
import type { Locale } from "@/lib/i18n/locales";
import type { AgenteId, MotorId } from "@/lib/motores";
import { AGENTES, MOTORES } from "@/lib/motores";
import { motorDeRuta } from "@/lib/navegacion";

type Mensaje =
  | { de: "yo"; texto: string }
  | { de: "hestia"; texto: string; agente: AgenteId; modo: "ia" | "local"; motor: MotorId | null; escalar: boolean };

type Guardado = { id: string; mensajes: Mensaje[] };

const MAX_GUARDADOS = 40;

function nuevoId() {
  return typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function cargar(): Guardado {
  try {
    const texto = sessionStorage.getItem(CLAVE_CONVERSACION);
    if (texto) {
      const datos = JSON.parse(texto) as Guardado;
      if (typeof datos.id === "string" && Array.isArray(datos.mensajes)) return datos;
    }
  } catch {
    // conversación nueva
  }
  return { id: nuevoId(), mensajes: [] };
}

export function HestiaConsola({ locale, abierta, aperturas, onCerrar, whatsapp }: { locale: Locale; abierta: boolean; aperturas: number; onCerrar: () => void; whatsapp: string | null }) {
  const t = DICCIONARIOS[locale];
  const ruta = usePathname();
  const motorActual = motorDeRuta(ruta);
  const [conversacion, setConversacion] = useState<Guardado>({ id: "", mensajes: [] });
  const [texto, setTexto] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const campoRef = useRef<HTMLTextAreaElement>(null);
  const listaRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const id = requestAnimationFrame(() => setConversacion(cargar()));
    return () => cancelAnimationFrame(id);
  }, []);

  useEffect(() => {
    if (!conversacion.id) return;
    try {
      sessionStorage.setItem(CLAVE_CONVERSACION, JSON.stringify({ id: conversacion.id, mensajes: conversacion.mensajes.slice(-MAX_GUARDADOS) }));
    } catch {
      // sin almacenamiento
    }
    listaRef.current?.scrollTo({ top: listaRef.current.scrollHeight, behavior: "smooth" });
  }, [conversacion]);

  // El foco va al campo solo cuando el usuario abre la consola, no cuando se
  // abre sola al cargar en pantallas anchas.
  useEffect(() => {
    if (aperturas > 0) campoRef.current?.focus({ preventScroll: true });
  }, [aperturas]);

  // Preguntas que llegan desde los motores («Preguntar a MNEMÓSINE»).
  const enviarRef = useRef<(mensaje: string) => Promise<void>>(async () => {});
  useEffect(() => {
    const escuchar = (evento: Event) => {
      const texto = (evento as CustomEvent<string>).detail;
      if (typeof texto === "string") void enviarRef.current(texto);
    };
    window.addEventListener(EVENTO_PREGUNTAR, escuchar);
    return () => window.removeEventListener(EVENTO_PREGUNTAR, escuchar);
  }, []);

  async function enviar(mensaje: string) {
    const limpio = mensaje.trim().slice(0, 1000);
    if (!limpio || enviando) return;
    const id = conversacion.id || nuevoId();
    setConversacion((c) => ({ id, mensajes: [...c.mensajes, { de: "yo", texto: limpio }] }));
    setTexto("");
    setEnviando(true);
    setError(null);
    emitirHestia("pensando");
    const camino = leerCamino();
    try {
      const respuesta = await fetch("/api/v1/hestia/conversar", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          locale,
          conversacion: id,
          mensaje: limpio,
          motor: motorActual,
          camino: { respuestas: camino.respuestas, nivelCita: camino.nivelCita, conGuardian: camino.conGuardian },
        }),
      });
      if (respuesta.status === 429) {
        setError(t.hestia.limite);
        emitirHestia("alerta");
        return;
      }
      const cuerpo = (await respuesta.json().catch(() => null)) as { texto?: string; agente?: string; modo?: string; motor?: string | null; escalar?: boolean } | null;
      if (!respuesta.ok || !cuerpo?.texto) {
        setError(t.hestia.error);
        emitirHestia("alerta");
        return;
      }
      const agente = (AGENTES as readonly string[]).includes(cuerpo.agente ?? "") ? (cuerpo.agente as AgenteId) : "HESTIA";
      const motor = (MOTORES as readonly string[]).includes(cuerpo.motor ?? "") ? (cuerpo.motor as MotorId) : null;
      setConversacion((c) => ({
        id,
        mensajes: [...c.mensajes, { de: "hestia", texto: cuerpo.texto ?? "", agente, modo: cuerpo.modo === "ia" ? "ia" : "local", motor, escalar: Boolean(cuerpo.escalar) }],
      }));
      emitirHestia("hablando");
    } catch {
      setError(t.hestia.error);
      emitirHestia("alerta");
    } finally {
      setEnviando(false);
    }
  }

  useEffect(() => {
    enviarRef.current = enviar;
  });

  const reiniciar = () => {
    setConversacion({ id: nuevoId(), mensajes: [] });
    setError(null);
  };

  return (
    <section
      id="consola-hestia"
      className="consola"
      hidden={!abierta}
      aria-label={`${t.hestia.titulo} · ${t.hestia.subtitulo}`}
      onKeyDown={(e) => {
        if (e.key === "Escape") onCerrar();
      }}
    >
      <div className="consola-cabecera">
        <NucleoHestia tamano={44} etiqueta="" />
        <div>
          <h2>{t.hestia.titulo}</h2>
          <p>{t.hestia.subtitulo}</p>
        </div>
        <button type="button" className="chip-cristal" onClick={onCerrar}>{t.app.cerrar}</button>
      </div>
      <p className="consola-aviso">{t.hestia.avisoIa}</p>

      <div className="consola-mensajes" ref={listaRef} aria-live="polite" aria-busy={enviando}>
        {conversacion.mensajes.length === 0 && <p className="consola-vacio">{t.hestia.vacio}</p>}
        {conversacion.mensajes.map((m, indice) =>
          m.de === "yo" ? (
            <div key={indice} className="mensaje mensaje-yo">
              <div className="mensaje-texto cristal">{m.texto}</div>
            </div>
          ) : (
            <div key={indice} className="mensaje" style={{ "--agente": COLOR_AGENTE[m.agente] } as React.CSSProperties}>
              <div className="mensaje-cabecera">
                <EmblemaAgente agente={m.agente} tamano={18} />
                <span>{t.agentes[m.agente].nombre}</span>
                <span className={`estado-holo ${m.modo === "ia" ? "info" : "aviso"}`} title={m.modo === "local" ? t.hestia.modoLocalDetalle : undefined}>
                  {m.modo === "ia" ? t.hestia.modoIa : t.hestia.modoLocal}
                </span>
              </div>
              <div className="mensaje-texto cristal plasma-agente">{m.texto}</div>
              {(m.motor && m.motor !== motorActual) || (m.escalar && whatsapp) ? (
                <div className="mensaje-acciones">
                  {m.motor && m.motor !== motorActual && (
                    <Link className="chip-cristal" href={`/${locale}/${m.motor}`}>{t.hestia.abrirMotor(t.app.motores[m.motor])}</Link>
                  )}
                  {m.escalar && whatsapp && (
                    <a className="chip-cristal plasma-oro" href={`https://wa.me/${whatsapp}`} target="_blank" rel="noopener noreferrer">{t.hestia.whatsapp}</a>
                  )}
                </div>
              ) : null}
              {m.escalar && <p className="aviso-ia">{t.hestia.escalado}</p>}
            </div>
          ),
        )}
        {enviando && (
          <p className="consola-pensando">
            <NucleoHestia tamano={22} mini etiqueta="" estadoInicial="pensando" />
            {t.hestia.pensando}
          </p>
        )}
      </div>

      {error && <p className="alerta-holo error consola-error" role="alert">{error}</p>}

      {conversacion.mensajes.length === 0 ? (
        <div className="consola-sugerencias">
          {t.hestia.sugerencias.map((s) => (
            <button key={s} type="button" className="chip-cristal" onClick={() => enviar(s)}>{s}</button>
          ))}
        </div>
      ) : (
        <div className="consola-sugerencias">
          <button type="button" className="chip-cristal" onClick={reiniciar}>{t.hestia.borrar}</button>
        </div>
      )}

      <form
        className="consola-formulario"
        onSubmit={(e) => {
          e.preventDefault();
          void enviar(texto);
        }}
      >
        <label className="campo-cristal">
          <span className="solo-lectores">{t.hestia.placeholder}</span>
          <textarea
            ref={campoRef}
            rows={2}
            maxLength={1000}
            value={texto}
            placeholder={t.hestia.placeholder}
            onChange={(e) => {
              setTexto(e.target.value);
              if (e.target.value.length === 1) emitirHestia("escuchando");
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                void enviar(texto);
              }
            }}
          />
        </label>
        <button type="submit" className="boton-cristal" disabled={enviando || !texto.trim()}>{t.hestia.enviar}</button>
      </form>
    </section>
  );
}
