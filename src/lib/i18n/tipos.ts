import type { Autoridad, CitaId, NivelCita, ProductoId } from "@/lib/catalogo";
import type { AvisoId, DocumentoId, EtapaId, RutaId } from "@/lib/diagnostico";
import type { PASAPORTES, SITUACIONES, SUENOS, TIEMPOS, UBICACIONES } from "@/lib/diagnostico";

type Opcion = { titulo: string; detalle: string };
type Paso = { capitulo: string; titulo: string; narrativa: string };

export const PASOS = [
  "idioma",
  "sueno",
  "ubicacion",
  "situacion",
  "tiempo",
  "pasaporte",
  "camino",
  "citas",
  "plan",
  "contacto",
  "listo",
] as const;
export type PasoId = (typeof PASOS)[number];

// Un único contrato para los seis idiomas: si a un diccionario le falta una
// clave, `tsc` falla. Así ningún usuario ve un hueco en su idioma.
export type Diccionario = {
  marca: { lema: string; agentePresenta: string };
  comun: {
    atras: string;
    continuar: string;
    paso: (actual: number, total: number) => string;
    cambiarIdioma: string;
    avisoIa: string;
    privacidadCorta: string;
    meta: string;
  };
  pasos: Record<PasoId, Paso>;
  // Variante de la pregunta de tiempo para quien ya tiene residencia legal.
  tiempoLegal: Paso;
  suenos: Record<(typeof SUENOS)[number], Opcion>;
  ubicaciones: Record<(typeof UBICACIONES)[number], Opcion>;
  situaciones: Record<(typeof SITUACIONES)[number], Opcion>;
  tiempos: Record<(typeof TIEMPOS)[number], string>;
  pasaportes: Record<(typeof PASAPORTES)[number], Opcion>;
  rutas: Record<RutaId, { nombre: string; resumen: string }>;
  etapas: Record<EtapaId, string>;
  avisos: Record<AvisoId, string>;
  documentos: Record<DocumentoId, string>;
  citas: Record<CitaId, { nombre: string; cuando: string }>;
  autoridades: Record<Autoridad, string>;
  productos: Record<ProductoId, string>;
  niveles: { N1: string; N2: string; N3: string };
  camino: {
    tuRuta: string;
    quienFirma: string;
    documentos: string;
    siguiente: string;
    estasAqui: string;
    meta: string;
  };
  nivelesCita: Record<NivelCita, { nombre: string; promesa: string; incluye: string[] }> & {
    porCita: string;
    elegir: string;
    sinCitasGestionables: string;
    reglasTitulo: string;
    reglas: string[];
    garantia: string;
    citasDeTuRuta: string;
    noGestionable: string;
    sinGestion: string;
  };
  plan: {
    honorarios: string;
    citas: string;
    guardian: string;
    guardianDetalle: string;
    total: string;
    alEncargo: string;
    alPresentar: string;
    tasas: string;
    gratis: string;
  };
  contacto: {
    nombre: string;
    telefono: string;
    telefonoAyuda: string;
    email: string;
    opcional: string;
    privacidad: string;
    marketing: string;
    enviar: string;
    enviando: string;
    errorRed: string;
    errorConfig: string;
    errorValidacion: string;
    errorLimite: string;
  };
  listo: {
    referencia: string;
    whatsapp: string;
    whatsappNoConfigurado: string;
    siguientePaso: string;
    reiniciar: string;
  };
};
