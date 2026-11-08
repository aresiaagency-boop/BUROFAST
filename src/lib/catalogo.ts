// Catálogo comercial de BUROFAST. Es la única fuente de precios: el funnel,
// la API, HESTIA (vía /api/v1/hestia/contexto) y el centro de mando leen de aquí.
// Precios en céntimos, IVA incluido, sin tasas oficiales. Son hipótesis de
// trabajo de la fase piloto (ver el plan de negocio), no tarifas cerradas.

export const PRODUCTOS = {
  diagnostico: { precioCentimos: 3_500, nivel: "N1" },
  llegada: { precioCentimos: 14_900, nivel: "N1" },
  renovacion: { precioCentimos: 19_000, nivel: "N2" },
  paso_via_ordinaria: { precioCentimos: 29_000, nivel: "N2" },
  primera_residencia: { precioCentimos: 45_000, nivel: "N2" },
  familia: { precioCentimos: 45_000, nivel: "N2" },
  nacionalidad: { precioCentimos: 35_000, nivel: "N2" },
  estudiante: { precioCentimos: 29_000, nivel: "N2" },
  autonomo: { precioCentimos: 59_000, nivel: "N2" },
  integral: { precioCentimos: 99_000, nivel: "N2" },
  proteccion_internacional: { precioCentimos: 0, nivel: "N3" },
  guardian: { precioCentimos: 4_900, nivel: "N1" },
} as const;

export type ProductoId = keyof typeof PRODUCTOS;
export type Nivel = "N1" | "N2" | "N3";

// Las citas oficiales son gratuitas. BUROFAST cobra la GESTIÓN: preparar la
// cita, reservarla con el cliente o en su nombre con su autorización expresa,
// vigilarla, recordarla y comprobar los documentos. Nunca la cita en sí, nunca
// con sistemas automáticos contra webs de cita previa y nunca acaparando.
export const NIVELES_CITA = {
  puede_esperar: {
    precioCentimos: 3_900,
    primeraAccionHoras: 120,
    revisionCadaHoras: 168,
    reembolsoSinCitaCentimos: 0,
  },
  urgente: {
    precioCentimos: 9_900,
    primeraAccionHoras: 24,
    revisionCadaHoras: 24,
    // Si en 30 días no hay cita, se devuelve la diferencia con «puedo esperar».
    reembolsoSinCitaCentimos: 6_000,
  },
} as const;

export type NivelCita = keyof typeof NIVELES_CITA;
export const DIAS_GARANTIA_URGENTE = 30;

// `momento`: «ahora» se puede gestionar desde el encargo; «tras_resolucion»
// no existe hasta que la Administración resuelve (huellas, recogida, jura), y
// su plazo y su garantía empiezan a contar ese día, no al contratar.
export const CITAS = {
  huellas_tie: { autoridad: "policia", gestionable: true, momento: "tras_resolucion" },
  recogida_tie: { autoridad: "policia", gestionable: true, momento: "tras_resolucion" },
  nie: { autoridad: "policia", gestionable: true, momento: "ahora" },
  registro_ue: { autoridad: "policia", gestionable: true, momento: "ahora" },
  empadronamiento: { autoridad: "ayuntamiento", gestionable: true, momento: "ahora" },
  seguridad_social: { autoridad: "tgss", gestionable: true, momento: "ahora" },
  certificado_digital: { autoridad: "registro", gestionable: true, momento: "ahora" },
  consulado_visado: { autoridad: "consulado", gestionable: true, momento: "ahora" },
  informe_vivienda: { autoridad: "comunidad", gestionable: true, momento: "ahora" },
  examenes_ccse_dele: { autoridad: "cervantes", gestionable: true, momento: "ahora" },
  jura_nacionalidad: { autoridad: "registro_civil", gestionable: true, momento: "tras_resolucion" },
  // La protección internacional la lleva siempre una persona, sin coste.
  entrevista_asilo: { autoridad: "policia", gestionable: false, momento: "ahora" },
} as const;

export type CitaId = keyof typeof CITAS;
export type Autoridad = (typeof CITAS)[CitaId]["autoridad"];

export function precioCitas(citas: readonly CitaId[], nivel: NivelCita) {
  const cobrables = citas.filter((cita) => CITAS[cita].gestionable);
  return cobrables.length * NIVELES_CITA[nivel].precioCentimos;
}

export function presupuesto(input: {
  producto: ProductoId;
  citas: readonly CitaId[];
  nivelCita: NivelCita | null;
  conGuardian: boolean;
}) {
  const honorarios = PRODUCTOS[input.producto].precioCentimos;
  const citas = input.nivelCita ? precioCitas(input.citas, input.nivelCita) : 0;
  const guardian = input.conGuardian && input.producto !== "guardian" ? PRODUCTOS.guardian.precioCentimos : 0;
  const total = honorarios + citas + guardian;
  // Pago por hitos: la mitad al encargo y el resto al presentar. Los céntimos
  // impares van al segundo hito para que la suma cuadre siempre.
  const alEncargo = Math.floor(total / 2);
  return { honorarios, citas, guardian, total, alEncargo, alPresentar: total - alEncargo };
}

export function formatearEuros(centimos: number, locale: string) {
  return new Intl.NumberFormat(locale, {
    style: "currency",
    currency: "EUR",
    // «€» en todos los idiomas: algunos (uk-UA) escribirían «EUR».
    currencyDisplay: "narrowSymbol",
    maximumFractionDigits: centimos % 100 === 0 ? 0 : 2,
  }).format(centimos / 100);
}
