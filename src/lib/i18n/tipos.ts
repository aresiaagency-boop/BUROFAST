import type { Autoridad, CitaId, NivelCita, ProductoId } from "@/lib/catalogo";
import type { EstadoCita, SemaforoSla } from "@/lib/citas";
import type { AvisoId, DocumentoId, EtapaId, RutaId } from "@/lib/diagnostico";
import type { PASAPORTES, SITUACIONES, SUENOS, TIEMPOS, UBICACIONES } from "@/lib/diagnostico";
import type { EstadoLead } from "@/lib/expediente";
import type { AgenteId, EstadoDocumento, EstadoPlazo, MotorId, ReglaTemis } from "@/lib/motores";
import type { EstadoPago, TipoPago } from "@/lib/pagos/repositorio";

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
    emailAyuda: string;
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
    despuesPago: string;
    verExpediente: string;
  };

  // ---------- Superapp (fase 2) ----------
  app: {
    nucleo: string;
    motores: Record<MotorId, string>;
    entrar: string;
    salir: string;
    idioma: string;
    hablarHestia: string;
    cerrar: string;
    saltar: string;
    navegacion: string;
    pie: string;
  };
  agentes: Record<AgenteId, { nombre: string; rol: string; frase: string }>;
  nucleo: {
    saludo: string;
    titulo: string;
    narrativa: string;
    empezar: string;
    continuar: string;
    duracion: string;
    motoresTitulo: string;
    motoresNarrativa: string;
    abrir: string;
    estadoCamino: { sinEmpezar: string; enCurso: string; listo: (ruta: string) => string };
    estadoCitas: { sinRuta: string; conRuta: (n: number) => string; ninguna: string };
    estadoDocumentos: { sinRuta: string; conRuta: (listos: number, total: number) => string };
    estadoGuardian: { sinFecha: string; lejos: (dias: number) => string; ventana: string; gracia: string; fuera: string };
    estadoExpediente: { sinSesion: string; conSesion: (n: number) => string };
    garantiasTitulo: string;
    lecturas: { idioma: string; agentes: string; datos: string; datosValor: string };
  };
  temis: Record<ReglaTemis, string>;
  hestia: {
    titulo: string;
    subtitulo: string;
    avisoIa: string;
    placeholder: string;
    enviar: string;
    pensando: string;
    modoIa: string;
    modoLocal: string;
    modoLocalDetalle: string;
    error: string;
    limite: string;
    sugerencias: string[];
    vacio: string;
    escalado: string;
    whatsapp: string;
    abrirMotor: (motor: string) => string;
    borrar: string;
  };
  hestiaLocal: {
    saludo: string;
    gracias: string;
    noEntendido: string;
    camino: string;
    caminoConRuta: (ruta: string) => string;
    precioConRuta: (p: { ruta: string; total: string; anticipo: string; resto: string }) => string;
    precioSinRuta: (desde: string) => string;
    precioGratis: string;
    documentosConRuta: (ruta: string, lista: string) => string;
    documentosSinRuta: string;
    citasConRuta: (lista: string, esperar: string, urgente: string) => string;
    citasSinRuta: (esperar: string, urgente: string) => string;
    plazos: string;
    asilo: string;
    humano: string;
    nacionalidad: string;
    nacionalidadConRuta: (ruta: string) => string;
    expedienteSinSesion: string;
    expedienteVacio: string;
    expedienteResumen: (p: { referencia: string; ruta: string; estado: string; pagado: string }) => string;
    pago: string;
    pagoConRuta: (anticipo: string) => string;
  };
  motorCitas: {
    titulo: string;
    narrativa: string;
    sinRuta: string;
    irCamino: string;
    planificadas: string;
    enExpediente: string;
    estados: Record<EstadoCita, string>;
    semaforo: Record<SemaforoSla, string>;
    fecha: string;
    lugar: string;
    sinFecha: string;
    encargar: string;
  };
  motorDocumentos: {
    titulo: string;
    narrativa: string;
    sinRuta: string;
    progreso: (listos: number, total: number) => string;
    estados: Record<EstadoDocumento, string>;
    extranjero: string;
    reciente: string;
    guardadoLocal: string;
    preguntar: string;
  };
  motorGuardian: {
    titulo: string;
    narrativa: string;
    fecha: string;
    fechaAyuda: string;
    estados: Record<EstadoPlazo, string>;
    abre: string;
    caduca: string;
    cierra: string;
    dias: (n: number) => string;
    diasPasados: (n: number) => string;
    calendario: string;
    avisoLegal: string;
    activar: string;
    eventoAbre: string;
    eventoCaduca: string;
  };
  expediente: {
    titulo: string;
    narrativa: string;
    entrarGoogle: string;
    googleNoConfigurado: string;
    comoFunciona: string;
    vacio: (email: string) => string;
    empezar: string;
    referencia: string;
    ruta: string;
    estado: string;
    total: string;
    pagado: string;
    estados: Record<EstadoLead, string>;
    pagos: string;
    estadosPago: Record<EstadoPago, string>;
    citas: string;
    sinCitas: string;
    sesionComo: (email: string) => string;
    errorAcceso: string;
    vincularTitulo: string;
    vincularTexto: string;
    vincularCampo: string;
    vincularBoton: string;
    vincularNoCoincide: string;
    vincularError: string;
  };
  pago: {
    concepto: (tipo: TipoPago, referencia: string) => string;
    pagarAnticipo: (importe: string) => string;
    condiciones: string;
    abriendo: string;
    noDisponible: string;
    yaPagado: string;
    error: string;
    confirmando: string;
    ok: string;
    okDetalle: (importe: string, referencia: string) => string;
    cancelado: string;
    canceladoDetalle: string;
    pendienteLento: string;
    volverExpediente: string;
    seguro: string;
    empezarYa: string;
    continuarPago: string;
  };
};
