"use client";

import type { NivelCita } from "@/lib/catalogo";
import type { DocumentoId, Respuestas, Ruta } from "@/lib/diagnostico";
import { diagnosticar, respuestasSchema } from "@/lib/diagnostico";
import type { EstadoDocumento } from "@/lib/motores";
import { ESTADOS_DOCUMENTO } from "@/lib/motores";

// Lo que la superapp recuerda en ESTE navegador (sessionStorage): las
// respuestas del camino, las marcas de documentos y la fecha del Guardián.
// Nada de nombre, teléfono ni correo: eso solo viaja al servidor, cifrado.

export const CLAVE_CAMINO = "burofast.camino.v1";
export const CLAVE_DOCUMENTOS = "burofast.documentos.v1";
export const CLAVE_GUARDIAN = "burofast.guardian.v1";
export const CLAVE_CONVERSACION = "burofast.hestia.v1";
export const EVENTO_ALMACEN = "burofast:almacen";

function leer<T>(clave: string): T | null {
  try {
    const texto = sessionStorage.getItem(clave);
    return texto ? (JSON.parse(texto) as T) : null;
  } catch {
    return null;
  }
}

export function escribir(clave: string, valor: unknown) {
  try {
    sessionStorage.setItem(clave, JSON.stringify(valor));
    window.dispatchEvent(new CustomEvent(EVENTO_ALMACEN, { detail: clave }));
  } catch {
    // Sin almacenamiento la superapp sigue funcionando; solo olvida al recargar.
  }
}

export function borrar(clave: string) {
  try {
    sessionStorage.removeItem(clave);
    window.dispatchEvent(new CustomEvent(EVENTO_ALMACEN, { detail: clave }));
  } catch {
    // Igual que arriba.
  }
}

export type CaminoGuardado = {
  historial?: string[];
  respuestas?: Partial<Respuestas>;
  nivelCita?: NivelCita | null;
  conGuardian?: boolean;
  referencia?: string | null;
};

export type EstadoCaminoLocal = {
  empezado: boolean;
  respuestas: Partial<Respuestas>;
  ruta: Ruta | null;
  nivelCita: NivelCita | null;
  conGuardian: boolean;
  referencia: string | null;
  paso: number;
};

export function leerCamino(): EstadoCaminoLocal {
  const guardado = leer<CaminoGuardado>(CLAVE_CAMINO);
  const respuestas = guardado?.respuestas ?? {};
  const completas = respuestasSchema.safeParse(respuestas);
  return {
    empezado: Boolean(guardado && (guardado.historial?.length ?? 0) > 1),
    respuestas,
    ruta: completas.success ? diagnosticar(completas.data) : null,
    nivelCita: guardado?.nivelCita ?? null,
    conGuardian: Boolean(guardado?.conGuardian),
    referencia: guardado?.referencia ?? null,
    paso: Math.max(0, (guardado?.historial?.length ?? 1) - 1),
  };
}

export function leerDocumentos(): Partial<Record<DocumentoId, EstadoDocumento>> {
  const datos = leer<Record<string, string>>(CLAVE_DOCUMENTOS) ?? {};
  const limpio: Partial<Record<DocumentoId, EstadoDocumento>> = {};
  for (const [clave, valor] of Object.entries(datos)) {
    if ((ESTADOS_DOCUMENTO as readonly string[]).includes(valor)) limpio[clave as DocumentoId] = valor as EstadoDocumento;
  }
  return limpio;
}

export function leerGuardian(): string | null {
  const datos = leer<{ caducidad?: string }>(CLAVE_GUARDIAN);
  return typeof datos?.caducidad === "string" && /^\d{4}-\d{2}-\d{2}$/.test(datos.caducidad) ? datos.caducidad : null;
}

export function hoyIso() {
  const ahora = new Date();
  const local = new Date(ahora.getTime() - ahora.getTimezoneOffset() * 60_000);
  return local.toISOString().slice(0, 10);
}
