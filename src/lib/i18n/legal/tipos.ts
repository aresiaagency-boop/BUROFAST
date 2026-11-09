import type { DocumentoLegalId } from "@/lib/legal";

// Textos legales por idioma. Las marcas {titular}, {nif}, {domicilio},
// {correo}, {registro}, {abogado}, {colegio} y {colegiado} se sustituyen por
// los datos de src/lib/legal.ts. Cada traducción usa las mismas marcas en la
// misma sección que el castellano (lo comprueba legal.test.ts).

export type SeccionLegal = { titulo: string; parrafos: readonly string[] };
export type DocumentoLegal = { titulo: string; resumen: string; secciones: readonly SeccionLegal[] };

export type TextosLegales = {
  menu: string;
  nombres: Record<DocumentoLegalId, string>;
  pendiente: string;
  // Nota de traducción; null en castellano, que es la versión vinculante.
  traduccion: string | null;
  actualizado: string;
  leerPrivacidad: string;
  // Lleva la marca {condiciones}, que se pinta como enlace con enlaceCondiciones.
  aceptarPago: string;
  enlaceCondiciones: string;
  documentos: Record<DocumentoLegalId, DocumentoLegal>;
};
