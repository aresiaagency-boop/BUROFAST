"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { NucleoHestia } from "@/components/holo/NucleoHestia";
import { formatearEuros } from "@/lib/catalogo";
import { emitirHestia } from "@/lib/hestia/vivo";
import { DICCIONARIOS } from "@/lib/i18n";
import type { Locale } from "@/lib/i18n/locales";
import { ETIQUETA_INTL } from "@/lib/i18n/locales";

type EstadoVuelta = { fase: "comprobando" | "pagado" | "pendiente" | "error"; importe?: number; referencia?: string };

// Vuelta de Stripe: se pregunta al servidor (que a su vez confirma con
// Stripe) hasta que el pago figura como pagado o se agota el tiempo.
export function PagoVuelta({ locale, sesion, cancelado }: { locale: Locale; sesion: string | null; cancelado: boolean }) {
  const t = DICCIONARIOS[locale];
  const [estado, setEstado] = useState<EstadoVuelta>({ fase: cancelado || !sesion ? "error" : "comprobando" });

  useEffect(() => {
    if (cancelado || !sesion) return;
    let intentos = 0;
    let parar = false;
    emitirHestia("pensando");
    const comprobar = async () => {
      intentos += 1;
      try {
        const respuesta = await fetch(`/api/v1/pagos/estado?sesion=${encodeURIComponent(sesion)}`, { cache: "no-store" });
        const cuerpo = (await respuesta.json().catch(() => null)) as { estado?: string; importe?: number; referencia?: string } | null;
        if (parar) return;
        if (cuerpo?.estado === "pagado") {
          setEstado({ fase: "pagado", importe: cuerpo.importe, referencia: cuerpo.referencia });
          emitirHestia("exito");
          return;
        }
        if (intentos >= 12) {
          setEstado({ fase: "pendiente", referencia: cuerpo?.referencia });
          emitirHestia("alerta");
          return;
        }
      } catch {
        if (intentos >= 12) {
          setEstado({ fase: "pendiente" });
          return;
        }
      }
      setTimeout(comprobar, 2500);
    };
    void comprobar();
    return () => {
      parar = true;
    };
  }, [sesion, cancelado]);

  return (
    <section className="cristal cristal--grande pago-escena" aria-live="polite">
      <NucleoHestia tamano={180} etiqueta="HESTIA" estadoInicial={estado.fase === "pagado" ? "exito" : estado.fase === "comprobando" ? "pensando" : "reposo"} />
      {cancelado ? (
        <>
          <h1 className="titulo-paso">{t.pago.cancelado}</h1>
          <p>{t.pago.canceladoDetalle}</p>
        </>
      ) : estado.fase === "comprobando" ? (
        <h1 className="titulo-paso">{t.pago.confirmando}</h1>
      ) : estado.fase === "pagado" ? (
        <>
          <h1 className="titulo-paso">{t.pago.ok}</h1>
          <p>{t.pago.okDetalle(formatearEuros(estado.importe ?? 0, ETIQUETA_INTL[locale]), estado.referencia ?? "")}</p>
        </>
      ) : (
        <p>{t.pago.pendienteLento}</p>
      )}
      <Link className="boton-cristal plasma-oro" href={`/${locale}/expediente`}>{t.pago.volverExpediente}</Link>
    </section>
  );
}

// Enlace de pago enviado por el equipo: la ficha viaja en el fragmento (#),
// que el navegador nunca manda a ningún servidor ni queda en los logs.
export function PagoAbrir({ locale }: { locale: Locale }) {
  const t = DICCIONARIOS[locale];
  const [mensaje, setMensaje] = useState<string | null>(null);

  useEffect(() => {
    const ficha = window.location.hash.slice(1);
    let cancelado = false;
    const abrir = async () => {
      if (!ficha) {
        setMensaje(t.pago.error);
        return;
      }
      emitirHestia("pensando");
      try {
        const respuesta = await fetch("/api/v1/pagos/checkout", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ locale, ficha }),
        });
        const cuerpo = (await respuesta.json().catch(() => null)) as { url?: string; error?: { codigo?: string } } | null;
        if (cancelado) return;
        if (respuesta.ok && cuerpo?.url) {
          window.location.replace(cuerpo.url);
          return;
        }
        const codigo = cuerpo?.error?.codigo;
        setMensaje(codigo === "YA_PAGADO" ? t.pago.yaPagado : codigo === "PAGOS_NO_CONFIGURADOS" ? t.pago.noDisponible : t.pago.error);
        emitirHestia("alerta");
      } catch {
        if (!cancelado) setMensaje(t.pago.error);
      }
    };
    void abrir();
    return () => {
      cancelado = true;
    };
  }, [locale, t]);

  return (
    <section className="cristal cristal--grande pago-escena" aria-live="polite">
      <NucleoHestia tamano={160} etiqueta="HESTIA" estadoInicial={mensaje ? "alerta" : "pensando"} />
      <h1 className="titulo-paso">{mensaje ?? t.pago.abriendo}</h1>
      <p className="mono" style={{ color: "var(--texto-tenue)" }}>{t.pago.seguro}</p>
      {mensaje && <Link className="boton-cristal" href={`/${locale}/expediente`}>{t.pago.volverExpediente}</Link>}
    </section>
  );
}
