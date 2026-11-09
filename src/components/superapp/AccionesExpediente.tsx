"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { emitirHestia } from "@/lib/hestia/vivo";
import { useAlmacen } from "@/lib/useAlmacen";
import { DICCIONARIOS } from "@/lib/i18n";
import type { Locale } from "@/lib/i18n/locales";

// Botón de pago del anticipo desde «Mi expediente». El importe lo decide el
// servidor; aquí solo se pide abrir la pasarela y se redirige a Stripe.
export function PagarAnticipo({ locale, referencia, importe }: { locale: Locale; referencia: string; importe: string }) {
  const t = DICCIONARIOS[locale];
  const [estado, setEstado] = useState<"listo" | "abriendo" | "error">("listo");
  const [mensaje, setMensaje] = useState<string | null>(null);
  const [empezarYa, setEmpezarYa] = useState(false);

  async function pagar() {
    setEstado("abriendo");
    setMensaje(null);
    emitirHestia("pensando");
    try {
      const respuesta = await fetch("/api/v1/pagos/checkout", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ locale, referencia, empezarYa }),
      });
      const cuerpo = (await respuesta.json().catch(() => null)) as { url?: string; error?: { codigo?: string } } | null;
      if (respuesta.ok && cuerpo?.url) {
        window.location.assign(cuerpo.url);
        return;
      }
      const codigo = cuerpo?.error?.codigo;
      setMensaje(codigo === "YA_PAGADO" ? t.pago.yaPagado : codigo === "PAGOS_NO_CONFIGURADOS" || codigo === "LEGAL_PENDIENTE" ? t.pago.noDisponible : t.pago.error);
      setEstado("error");
      emitirHestia("alerta");
    } catch {
      setMensaje(t.pago.error);
      setEstado("error");
      emitirHestia("alerta");
    }
  }

  return (
    <div className="pagar">
      <p className="aviso-ia">{t.pago.condiciones}</p>
      <label className="casilla-pago">
        <input type="checkbox" checked={empezarYa} onChange={(e) => setEmpezarYa(e.target.checked)} />
        <span>{t.pago.empezarYa}</span>
      </label>
      <div className="acciones" style={{ marginTop: 10 }}>
        <button type="button" className="boton-cristal plasma-oro cristal--vivo" disabled={estado === "abriendo" || !empezarYa} onClick={() => void pagar()}>
          {estado === "abriendo" ? t.pago.abriendo : t.pago.pagarAnticipo(importe)}
        </button>
        <small className="mono" style={{ color: "var(--texto-tenue)" }}>{t.pago.seguro}</small>
      </div>
      {mensaje && <p className="alerta-holo error" role="alert" style={{ marginTop: 10 }}>{mensaje}</p>}
    </div>
  );
}

export function SalirCliente({ locale }: { locale: Locale }) {
  const t = DICCIONARIOS[locale];
  const router = useRouter();
  return (
    <button
      type="button"
      className="chip-cristal"
      onClick={async () => {
        await fetch("/api/v1/auth/salir", { method: "POST" }).catch(() => null);
        router.refresh();
      }}
    >
      {t.app.salir}
    </button>
  );
}

// Vincula un expediente a la cuenta con el código de camino. Si este navegador
// lo recuerda (acaba de terminar el camino), viene ya escrito.
export function VincularExpediente({ locale }: { locale: Locale }) {
  const t = DICCIONARIOS[locale];
  const router = useRouter();
  const { camino } = useAlmacen();
  const [escrito, setEscrito] = useState<string | null>(null);
  const [estado, setEstado] = useState<"listo" | "enviando" | "no_coincide" | "error">("listo");
  const codigo = escrito ?? camino.referencia ?? "";

  async function vincular(evento: React.FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    setEstado("enviando");
    try {
      const respuesta = await fetch("/api/v1/expediente/vincular", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ referencia: codigo }),
      });
      if (respuesta.ok) {
        emitirHestia("exito");
        setEstado("listo");
        router.refresh();
        return;
      }
      setEstado(respuesta.status === 404 || respuesta.status === 400 ? "no_coincide" : "error");
      emitirHestia("alerta");
    } catch {
      setEstado("error");
    }
  }

  return (
    <form className="cristal cristal--grande bloque vincular" onSubmit={(e) => void vincular(e)}>
      <h2>{t.expediente.vincularTitulo}</h2>
      <p>{t.expediente.vincularTexto}</p>
      <label className="campo-cristal" htmlFor="codigo-camino">
        <span>{t.expediente.vincularCampo}</span>
        <input
          id="codigo-camino"
          name="referencia"
          value={codigo}
          onChange={(e) => setEscrito(e.target.value.toUpperCase())}
          placeholder="BF-XXXXXX"
          autoComplete="off"
          spellCheck={false}
          pattern="[Bb][Ff]-[A-Za-z0-9]{6}"
          required
          aria-invalid={estado === "no_coincide"}
          dir="ltr"
        />
      </label>
      {estado === "no_coincide" && <p className="alerta-holo error" role="alert">{t.expediente.vincularNoCoincide}</p>}
      {estado === "error" && <p className="alerta-holo error" role="alert">{t.expediente.vincularError}</p>}
      <div className="acciones">
        <button type="submit" className="boton-cristal plasma-oro" disabled={estado === "enviando"}>{t.expediente.vincularBoton}</button>
      </div>
    </form>
  );
}
