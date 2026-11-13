// Datos legales del titular y del abogado. Son públicos por ley (LSSI art. 10)
// y aparecen en el aviso legal, la privacidad y las condiciones. Lo que está a
// null se muestra como «pendiente»: nunca se inventa. Rellenarlos es requisito
// para cobrar en serio; el centro de mando avisa mientras falte alguno.

export const CLAVES_LEGALES = ["titular", "nif", "domicilio", "correo", "registro", "abogado", "colegio", "colegiado"] as const;
export type ClaveLegal = (typeof CLAVES_LEGALES)[number];

export const DATOS_LEGALES: Record<ClaveLegal, string | null> = {
  titular: "ARES IA SYSTEMS S.L.",
  nif: "B05779293",
  domicilio: "C/ Joaquín Verdaguer, 10, 1.º A, 07600 L'Arenal (Illes Balears)",
  correo: null, // Correo para privacidad, desistimiento y reclamaciones
  registro: null, // Datos de inscripción en el Registro Mercantil
  // Quien revisa los asuntos legales (clave histórica «abogado»). No se afirma
  // un título profesional que no esté acreditado: colegio y número, pendientes.
  abogado: "Roberto de Souza Escobal (Palma Auditores), Gran Via Asima, 20, 3.º, local 35, 07009 Palma",
  colegio: null,
  colegiado: null,
};

export const LEGAL_ACTUALIZADO = "2026-11-13";

export const DOCUMENTOS_LEGALES = ["privacidad", "condiciones", "aviso-legal"] as const;
export type DocumentoLegalId = (typeof DOCUMENTOS_LEGALES)[number];

export function esDocumentoLegal(valor: string): valor is DocumentoLegalId {
  return (DOCUMENTOS_LEGALES as readonly string[]).includes(valor);
}

export function datosLegalesPendientes(datos: Record<ClaveLegal, string | null> = DATOS_LEGALES) {
  return CLAVES_LEGALES.filter((clave) => !datos[clave]?.trim());
}

// Parte un texto con marcas {clave} en trozos para pintarlos: texto normal o
// dato legal (con su valor o pendiente).
export type TrozoLegal = { tipo: "texto"; valor: string } | { tipo: "dato"; clave: ClaveLegal; valor: string | null };

export function trocearTextoLegal(texto: string, datos: Record<ClaveLegal, string | null> = DATOS_LEGALES): TrozoLegal[] {
  const trozos: TrozoLegal[] = [];
  let resto = 0;
  for (const marca of texto.matchAll(/\{([a-z]+)\}/g)) {
    const clave = marca[1] as ClaveLegal;
    if (!(CLAVES_LEGALES as readonly string[]).includes(clave)) continue;
    if (marca.index > resto) trozos.push({ tipo: "texto", valor: texto.slice(resto, marca.index) });
    trozos.push({ tipo: "dato", clave, valor: datos[clave]?.trim() || null });
    resto = marca.index + marca[0].length;
  }
  if (resto < texto.length) trozos.push({ tipo: "texto", valor: texto.slice(resto) });
  return trozos;
}
