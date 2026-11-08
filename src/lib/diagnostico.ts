import { z } from "zod";
import type { CitaId, Nivel, ProductoId } from "@/lib/catalogo";
import { PRODUCTOS } from "@/lib/catalogo";

// Motor de diagnóstico determinista. No usa IA a propósito: la ruta que ve el
// cliente tiene que ser la misma cada vez y poder auditarse. Es ORIENTATIVA:
// un abogado colegiado la confirma antes de cobrar nada (puerta humana 1).

export const SUENOS = [
  "trabajar",
  "estudiar",
  "familia",
  "regularizar",
  "renovar",
  "nacionalidad",
  "emprender",
  "llegar",
] as const;
export const UBICACIONES = ["espana", "fuera"] as const;
export const SITUACIONES = [
  "sin_autorizacion",
  "regularizacion_2026",
  "autorizacion_vigente",
  "estudiante",
  "ciudadano_ue",
  "familiar_ue_espanol",
  "asilo",
] as const;
export const TIEMPOS = ["menos_6m", "6m_1a", "1a_2a", "2a_5a", "5a_10a", "mas_10a"] as const;

// Con autorización, la pregunta de tiempo es de RESIDENCIA LEGAL (la que cuenta
// para nacionalidad, larga duración y reagrupación); sin ella, de estancia.
export const SITUACIONES_CON_RESIDENCIA_LEGAL = ["autorizacion_vigente", "estudiante", "familiar_ue_espanol", "ciudadano_ue"] as const;
export function preguntaResidenciaLegal(situacion: string | null | undefined) {
  return (SITUACIONES_CON_RESIDENCIA_LEGAL as readonly string[]).includes(situacion ?? "");
}
export const PASAPORTES = ["iberoamericano", "ue", "otro"] as const;

export const respuestasSchema = z.object({
  sueno: z.enum(SUENOS),
  ubicacion: z.enum(UBICACIONES),
  // Fuera de España no se pregunta situación ni tiempo: no aplican.
  situacion: z.enum(SITUACIONES).nullable(),
  tiempo: z.enum(TIEMPOS).nullable(),
  pasaporte: z.enum(PASAPORTES),
});

export type Respuestas = z.infer<typeof respuestasSchema>;

export const RUTAS = [
  "proteccion_internacional",
  "registro_ue",
  "familia_comunitaria",
  "nacionalidad",
  "nacionalidad_aun_no",
  "paso_via_ordinaria",
  "renovacion",
  "larga_duracion",
  "arraigo",
  "preparar_arraigo",
  "visado_estudios",
  "prorroga_estudios",
  "estudios_a_trabajo",
  "visado_trabajo",
  "cuenta_propia",
  "reagrupacion",
  "reagrupacion_aun_no",
  "llegada",
  "consulta",
] as const;
export type RutaId = (typeof RUTAS)[number];

export const ETAPAS = ["llegada", "residencia", "renovacion", "estabilidad", "nacionalidad", "familia"] as const;
export type EtapaId = (typeof ETAPAS)[number];

export const AVISOS = [
  "revision_abogado",
  "sin_garantia",
  "tasas_aparte",
  "arraigo_familiar_sin_plazo",
  "tipo_arraigo_lo_decide_abogado",
  "empleador_presenta",
  "iberoamericano_dos_anos",
  "requisito_general_diez_anos",
  "casos_especiales_nacionalidad",
  "reagrupar_tras_un_ano",
  "asilo_humano_gratis",
] as const;
export type AvisoId = (typeof AVISOS)[number];

export const DOCUMENTOS = [
  "pasaporte",
  "padron",
  "padron_historico",
  "antecedentes_origen",
  "antecedentes_espana",
  "tie_actual",
  "contrato_u_oferta",
  "medios_economicos",
  "matricula",
  "seguro_medico",
  "vinculo_familiar",
  "informe_vivienda",
  "certificado_nacimiento",
  "ccse_dele",
  "plan_negocio",
  "resolucion_regularizacion",
] as const;
export type DocumentoId = (typeof DOCUMENTOS)[number];

// Etapa del Camino del residente a la que lleva cada ruta. La usa la interfaz
// para marcar «la siguiente etapa» sin repetir la lógica del diagnóstico.
export const ETAPA_DE_RUTA: Record<RutaId, EtapaId> = {
  proteccion_internacional: "llegada",
  registro_ue: "llegada",
  familia_comunitaria: "residencia",
  nacionalidad: "nacionalidad",
  nacionalidad_aun_no: "estabilidad",
  paso_via_ordinaria: "renovacion",
  renovacion: "renovacion",
  larga_duracion: "estabilidad",
  arraigo: "residencia",
  preparar_arraigo: "llegada",
  visado_estudios: "llegada",
  prorroga_estudios: "residencia",
  estudios_a_trabajo: "residencia",
  visado_trabajo: "llegada",
  cuenta_propia: "residencia",
  reagrupacion: "familia",
  reagrupacion_aun_no: "residencia",
  llegada: "llegada",
  consulta: "llegada",
};

export type Ruta = {
  id: RutaId;
  producto: ProductoId;
  nivel: Nivel;
  etapaActual: EtapaId;
  citas: CitaId[];
  documentos: DocumentoId[];
  avisos: AvisoId[];
  // La siguiente parada del Camino del residente, la que Guardián avisará.
  siguiente: RutaId | null;
};

const AVISOS_COMUNES: AvisoId[] = ["revision_abogado", "sin_garantia", "tasas_aparte"];

function ruta(
  id: RutaId,
  producto: ProductoId,
  etapaActual: EtapaId,
  citas: CitaId[],
  documentos: DocumentoId[],
  avisos: AvisoId[],
  siguiente: RutaId | null,
): Ruta {
  const nivel = PRODUCTOS[producto].nivel;
  const base = nivel === "N3" ? (["asilo_humano_gratis"] as AvisoId[]) : AVISOS_COMUNES;
  return { id, producto, nivel, etapaActual, citas, documentos, avisos: [...base, ...avisos], siguiente };
}

const anosMinimos = (tiempo: Respuestas["tiempo"], minimo: "6m" | "1a" | "2a" | "5a" | "10a") => {
  if (!tiempo) return false;
  const umbral = { "6m": 1, "1a": 2, "2a": 3, "5a": 4, "10a": 5 }[minimo];
  return TIEMPOS.indexOf(tiempo) >= umbral;
};

export function diagnosticar(respuestas: Respuestas): Ruta {
  const { sueno, ubicacion, situacion, tiempo, pasaporte } = respuestas;

  // La protección internacional va primero y siempre a una persona.
  if (situacion === "asilo") {
    return ruta("proteccion_internacional", "proteccion_internacional", "llegada", ["entrevista_asilo"], [], [], null);
  }

  if (ubicacion === "fuera") {
    if (pasaporte === "ue") {
      return ruta("registro_ue", "llegada", "llegada", ["registro_ue", "empadronamiento", "seguridad_social"], ["pasaporte", "medios_economicos", "seguro_medico"], [], "nacionalidad");
    }
    if (sueno === "estudiar") {
      return ruta("visado_estudios", "estudiante", "llegada", ["consulado_visado", "huellas_tie", "empadronamiento"], ["pasaporte", "matricula", "medios_economicos", "seguro_medico", "antecedentes_origen"], [], "prorroga_estudios");
    }
    if (sueno === "emprender") {
      return ruta("cuenta_propia", "autonomo", "llegada", ["consulado_visado", "huellas_tie", "seguridad_social"], ["pasaporte", "plan_negocio", "medios_economicos", "antecedentes_origen"], [], "renovacion");
    }
    if (sueno === "familia") {
      // Quien está fuera no reagrupa: le reagrupa el familiar residente.
      return ruta("reagrupacion", "familia", "familia", ["consulado_visado", "informe_vivienda", "huellas_tie"], ["pasaporte", "vinculo_familiar", "informe_vivienda", "medios_economicos"], ["reagrupar_tras_un_ano"], "renovacion");
    }
    if (sueno === "trabajar") {
      return ruta("visado_trabajo", "primera_residencia", "llegada", ["consulado_visado", "huellas_tie", "empadronamiento"], ["pasaporte", "contrato_u_oferta", "antecedentes_origen"], ["empleador_presenta"], "renovacion");
    }
    // Desde fuera, «vivir en regla», «renovar» o «nacionalidad» no tienen una
    // ruta automática segura: lo estudia una persona.
    return ruta("consulta", "diagnostico", "llegada", ["consulado_visado"], ["pasaporte"], [], null);
  }

  if (situacion === "ciudadano_ue") {
    if (sueno === "nacionalidad") {
      return anosMinimos(tiempo, "10a")
        ? nacionalidad(pasaporte)
        : ruta("nacionalidad_aun_no", "guardian", "estabilidad", [], ["pasaporte"], ["requisito_general_diez_anos", "casos_especiales_nacionalidad"], "nacionalidad");
    }
    return ruta("registro_ue", "llegada", "llegada", ["registro_ue", "empadronamiento", "seguridad_social", "certificado_digital"], ["pasaporte", "medios_economicos", "seguro_medico"], [], "nacionalidad");
  }

  if (situacion === "familiar_ue_espanol") {
    return ruta("familia_comunitaria", "familia", "residencia", ["huellas_tie", "empadronamiento"], ["pasaporte", "vinculo_familiar", "padron"], [], "larga_duracion");
  }

  if (situacion === "regularizacion_2026") {
    // La autorización de 2026 tiene menos de un año: la residencia legal que
    // cuenta para la nacionalidad empieza con ella, no con la llegada a España.
    const avisoNacionalidad: AvisoId[] = sueno === "nacionalidad" ? [pasaporte === "iberoamericano" ? "iberoamericano_dos_anos" : "requisito_general_diez_anos"] : [];
    return ruta("paso_via_ordinaria", "paso_via_ordinaria", "renovacion", ["huellas_tie", "recogida_tie"], ["pasaporte", "resolucion_regularizacion", "tie_actual", "contrato_u_oferta", "padron"], avisoNacionalidad, pasaporte === "iberoamericano" ? "nacionalidad" : "larga_duracion");
  }

  if (situacion === "estudiante" || situacion === "autorizacion_vigente") {
    if (sueno === "llegar") {
      return ruta("llegada", "llegada", "llegada", ["huellas_tie", "empadronamiento", "seguridad_social", "certificado_digital"], ["pasaporte", "padron"], [], "renovacion");
    }
  }

  if (situacion === "estudiante") {
    if (sueno === "trabajar" || sueno === "emprender") {
      return ruta("estudios_a_trabajo", "estudiante", "residencia", ["huellas_tie"], ["pasaporte", "tie_actual", "contrato_u_oferta"], [], "renovacion");
    }
    return ruta("prorroga_estudios", "estudiante", "residencia", ["huellas_tie"], ["pasaporte", "tie_actual", "matricula", "medios_economicos", "seguro_medico"], [], "estudios_a_trabajo");
  }

  if (situacion === "autorizacion_vigente") {
    if (sueno === "nacionalidad") {
      const cumple = pasaporte === "iberoamericano" ? anosMinimos(tiempo, "2a") : anosMinimos(tiempo, "10a");
      return cumple
        ? nacionalidad(pasaporte)
        : ruta("nacionalidad_aun_no", "guardian", "estabilidad", [], ["tie_actual"], [pasaporte === "iberoamericano" ? "iberoamericano_dos_anos" : "requisito_general_diez_anos", "casos_especiales_nacionalidad"], "nacionalidad");
    }
    if (sueno === "familia") {
      return anosMinimos(tiempo, "1a")
        ? ruta("reagrupacion", "familia", "familia", ["informe_vivienda", "consulado_visado", "huellas_tie"], ["tie_actual", "vinculo_familiar", "informe_vivienda", "medios_economicos"], ["reagrupar_tras_un_ano"], "nacionalidad")
        : ruta("reagrupacion_aun_no", "guardian", "residencia", [], ["tie_actual"], ["reagrupar_tras_un_ano"], "reagrupacion");
    }
    if (sueno === "emprender") {
      return ruta("cuenta_propia", "autonomo", "residencia", ["huellas_tie", "seguridad_social"], ["tie_actual", "plan_negocio", "medios_economicos"], [], "renovacion");
    }
    if (anosMinimos(tiempo, "5a")) {
      return ruta("larga_duracion", "renovacion", "estabilidad", ["huellas_tie", "recogida_tie"], ["pasaporte", "tie_actual", "medios_economicos", "antecedentes_espana"], [], "nacionalidad");
    }
    return ruta("renovacion", "renovacion", "renovacion", ["huellas_tie", "recogida_tie"], ["pasaporte", "tie_actual", "contrato_u_oferta"], [], "larga_duracion");
  }

  // Sin autorización y en España. NIE, Seguridad Social y certificado digital
  // no son el primer paso de quien aún no tiene papeles: lo es el padrón.
  if (anosMinimos(tiempo, "2a")) {
    return ruta("arraigo", "primera_residencia", "residencia", ["empadronamiento", "huellas_tie", "recogida_tie"], ["pasaporte", "padron_historico", "antecedentes_origen", "contrato_u_oferta"], ["tipo_arraigo_lo_decide_abogado", "arraigo_familiar_sin_plazo"], "renovacion");
  }
  if (sueno === "familia") {
    return ruta("preparar_arraigo", "diagnostico", "llegada", ["empadronamiento"], ["pasaporte", "padron", "vinculo_familiar"], ["arraigo_familiar_sin_plazo"], "arraigo");
  }
  return ruta("preparar_arraigo", "diagnostico", "llegada", ["empadronamiento"], ["pasaporte", "padron"], ["arraigo_familiar_sin_plazo"], "arraigo");
}

function nacionalidad(pasaporte: Respuestas["pasaporte"]): Ruta {
  return ruta(
    "nacionalidad",
    "nacionalidad",
    "nacionalidad",
    ["examenes_ccse_dele", "jura_nacionalidad"],
    ["pasaporte", "certificado_nacimiento", "antecedentes_origen", "padron", "ccse_dele"],
    [pasaporte === "iberoamericano" ? "iberoamericano_dos_anos" : "requisito_general_diez_anos", "casos_especiales_nacionalidad"],
    null,
  );
}
