"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { emitirHestia } from "@/lib/hestia/vivo";
import { DICCIONARIOS } from "@/lib/i18n";
import type { Locale } from "@/lib/i18n/locales";

// Botón de pago del anticipo desde «Mi expediente». El importe lo decide el
// servidor; aquí solo se pide abrir la pasarela y se redirige a Stripe.
export function PagarAnticipo({ locale, referencia, importe }: { locale: Locale; referencia: string; importe: string }) {
  const t = DICCIONARIOS[locale];
  const [estado, setEstado] = useState<"listo" | "abriendo" | "error">("listo");
  const [mensaje, setMensaje] = useState<string | null>(null);

  async function pagar() {
    setEstado("abriendo");
    setMensaje(null);
    emitirHestia("pensando");
    try {
      const respuesta = await fetch("/api/v1/pagos/checkout", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ locale, referencia }),
      });
      const cuerpo = (await respuesta.json().catch(() => null)) as { url?: string; error?: { codigo?: string } } | null;
      if (respuesta.ok && cuerpo?.url) {
        window.location.assign(cuerpo.url);
        return;
      }
      const codigo = cuerpo?.error?.codigo;
      setMensaje(codigo === "YA_PAGADO" ? t.pago.yaPagado : codigo === "PAGOS_NO_CONFIGURADOS" ? t.pago.noDisponible : t.pago.error);
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
      <div className="acciones" style={{ marginTop: 10 }}>
        <button type="button" className="boton-cristal plasma-oro cristal--vivo" disabled={estado === "abriendo"} onClick={() => void pagar()}>
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
