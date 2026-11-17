"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import type { EstadoNucleo } from "@/lib/hestia/vivo";
import { ESTADOS_PASAJEROS, EVENTO_HESTIA } from "@/lib/hestia/vivo";
import type { Locale } from "@/lib/i18n/locales";
import type { GrupoPasaporte, PaisRadar } from "@/lib/radar";
import { TRAZADOS_URL } from "@/lib/radar-paises";

// Lo que da vida a todos los radares: el estado de HESTIA (piensa, acierta,
// avisa) y los trazados de los países, que se piden una sola vez al dibujar.

export function useEstadoHestia(estadoInicial: EstadoNucleo = "reposo") {
  const [estado, setEstado] = useState<EstadoNucleo>(estadoInicial);
  useEffect(() => {
    let temporizador: ReturnType<typeof setTimeout> | undefined;
    const escuchar = (evento: Event) => {
      const nuevo = (evento as CustomEvent<EstadoNucleo>).detail;
      clearTimeout(temporizador);
      setEstado(nuevo);
      const dura = ESTADOS_PASAJEROS[nuevo];
      if (dura) temporizador = setTimeout(() => setEstado(estadoInicial), dura);
    };
    window.addEventListener(EVENTO_HESTIA, escuchar);
    return () => {
      window.removeEventListener(EVENTO_HESTIA, escuchar);
      clearTimeout(temporizador);
    };
  }, [estadoInicial]);
  // Un cambio de estadoInicial desde fuera (p. ej., el pago confirmado) manda.
  const [previo, setPrevio] = useState(estadoInicial);
  if (previo !== estadoInicial) {
    setPrevio(estadoInicial);
    setEstado(estadoInicial);
  }
  return estado;
}

export type Trazados = { v: number; paises: Record<PaisRadar, string>; zonas: Record<Locale, string>; grupos: Record<GrupoPasaporte, string> };

let trazados: Trazados | null = null;
let pedido: Promise<void> | null = null;
let intentos = 0;
const avisos = new Set<() => void>();

// Si falla (red o HTTP), se reintenta con espera creciente mientras haya un
// radar a la vista: tres veces como mucho por sesión de página.
function pedir() {
  pedido ??= fetch(TRAZADOS_URL)
    .then((r) => {
      if (!r.ok) throw new Error(String(r.status));
      return r.json() as Promise<Trazados>;
    })
    .then((datos) => {
      trazados = datos;
      for (const a of avisos) a();
    })
    .catch(() => {
      // Sin trazados el radar sigue: mapa, barrido y sede; sin cristal.
      pedido = null;
      intentos += 1;
      if (intentos < 3) setTimeout(() => avisos.size > 0 && !trazados && pedir(), 4000 * intentos);
    });
}

function suscribir(avisar: () => void) {
  avisos.add(avisar);
  if (!trazados) pedir();
  return () => {
    avisos.delete(avisar);
  };
}

export function useTrazados() {
  return useSyncExternalStore(suscribir, () => trazados, () => null);
}
