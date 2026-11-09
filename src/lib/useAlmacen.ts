"use client";

import { useSyncExternalStore } from "react";
import type { EstadoCaminoLocal } from "@/lib/almacen";
import { CLAVE_CAMINO, CLAVE_DOCUMENTOS, CLAVE_GUARDIAN, EVENTO_ALMACEN, leerCamino, leerDocumentos, leerGuardian } from "@/lib/almacen";
import type { DocumentoId } from "@/lib/diagnostico";
import type { EstadoDocumento } from "@/lib/motores";

// Lectura reactiva de lo que la superapp guarda en este navegador. Con
// useSyncExternalStore el servidor pinta el estado «sin datos» y el cliente
// lo completa al hidratar, sin parpadeos ni setState en efectos.

export type InstantaneaLocal = {
  listo: boolean;
  camino: EstadoCaminoLocal;
  documentos: Partial<Record<DocumentoId, EstadoDocumento>>;
  guardian: string | null;
};

const VACIO: InstantaneaLocal = {
  listo: false,
  camino: { empezado: false, respuestas: {}, ruta: null, nivelCita: null, conGuardian: false, referencia: null, paso: 0 },
  documentos: {},
  guardian: null,
};

let crudoEnCache: string | null = null;
let valorEnCache: InstantaneaLocal = VACIO;

function crudo() {
  try {
    return [CLAVE_CAMINO, CLAVE_DOCUMENTOS, CLAVE_GUARDIAN].map((clave) => sessionStorage.getItem(clave) ?? "").join("\u0001");
  } catch {
    return "";
  }
}

function instantanea(): InstantaneaLocal {
  const actual = crudo();
  if (actual !== crudoEnCache) {
    crudoEnCache = actual;
    valorEnCache = { listo: true, camino: leerCamino(), documentos: leerDocumentos(), guardian: leerGuardian() };
  }
  return valorEnCache;
}

function suscribir(avisar: () => void) {
  window.addEventListener(EVENTO_ALMACEN, avisar);
  window.addEventListener("storage", avisar);
  return () => {
    window.removeEventListener(EVENTO_ALMACEN, avisar);
    window.removeEventListener("storage", avisar);
  };
}

export function useAlmacen() {
  return useSyncExternalStore(suscribir, instantanea, () => VACIO);
}
