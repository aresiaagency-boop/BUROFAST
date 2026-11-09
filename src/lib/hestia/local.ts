import type { NivelCita } from "@/lib/catalogo";
import { CITAS, formatearEuros, NIVELES_CITA, PRODUCTOS, presupuesto } from "@/lib/catalogo";
import type { Ruta } from "@/lib/diagnostico";
import type { Expediente } from "@/lib/expediente";
import type { Intencion } from "@/lib/hestia/intenciones";
import { detectarIntencion } from "@/lib/hestia/intenciones";
import { DICCIONARIOS } from "@/lib/i18n";
import type { Locale } from "@/lib/i18n/locales";
import { ETIQUETA_INTL } from "@/lib/i18n/locales";
import type { AgenteId, MotorId } from "@/lib/motores";
import { AGENTE_DE_MOTOR } from "@/lib/motores";

// HESTIA sin IA: cuando n8n no está configurado o no responde, la superapp no
// se queda muda. Responde con los motores deterministas y lo dice («modo
// local»), en el idioma del usuario.

export type RespuestaHestia = {
  texto: string;
  agente: AgenteId;
  motor: MotorId | null;
  escalar: boolean;
};

export type EntradaLocal = {
  mensaje: string;
  locale: Locale;
  motor: MotorId | null;
  ruta: Ruta | null;
  nivelCita: NivelCita | null;
  conGuardian: boolean;
  expedientes: Expediente[] | null;
};

const lista = (elementos: string[], locale: Locale) =>
  new Intl.ListFormat(ETIQUETA_INTL[locale], { style: "long", type: "conjunction" }).format(elementos);

// El motor en el que está el usuario desempata un mensaje ambiguo.
const INTENCION_DE_MOTOR: Record<MotorId, Intencion> = {
  camino: "camino",
  citas: "citas",
  documentos: "documentos",
  guardian: "plazos",
  expediente: "expediente",
};

export function responderLocal(entrada: EntradaLocal): RespuestaHestia {
  const t = DICCIONARIOS[entrada.locale];
  const h = t.hestiaLocal;
  const euros = (c: number) => formatearEuros(c, ETIQUETA_INTL[entrada.locale]);
  const { ruta } = entrada;
  let intencion = detectarIntencion(entrada.mensaje);
  if (intencion === "desconocida" && entrada.motor) intencion = INTENCION_DE_MOTOR[entrada.motor];

  const responder = (texto: string, agente: AgenteId, motor: MotorId | null, escalar = false): RespuestaHestia => ({ texto, agente, motor, escalar });

  switch (intencion) {
    case "asilo":
      return responder(h.asilo, "TEMIS", null, true);
    case "humano":
      return responder(h.humano, "HESTIA", null, true);
    case "saludo":
      return responder(h.saludo, "HESTIA", null);
    case "gracias":
      return responder(h.gracias, "HESTIA", null);
    case "camino":
      return ruta ? responder(h.caminoConRuta(t.rutas[ruta.id].nombre), "ARIADNA", "camino") : responder(h.camino, "ARIADNA", "camino");
    case "nacionalidad":
      return ruta
        ? responder(h.nacionalidadConRuta(t.rutas[ruta.id].nombre), "ARIADNA", "camino")
        : responder(h.nacionalidad, "ARIADNA", "camino");
    case "precio": {
      if (!ruta) {
        const desde = Math.min(...Object.values(PRODUCTOS).map((p) => p.precioCentimos).filter((c) => c > 0));
        return responder(h.precioSinRuta(euros(desde)), "ARIADNA", "camino");
      }
      if (ruta.nivel === "N3") return responder(h.precioGratis, "TEMIS", "camino");
      const importe = presupuesto({ producto: ruta.producto, citas: ruta.citas, nivelCita: entrada.nivelCita, conGuardian: entrada.conGuardian });
      return responder(
        h.precioConRuta({ ruta: t.rutas[ruta.id].nombre, total: euros(importe.total), anticipo: euros(importe.alEncargo), resto: euros(importe.alPresentar) }),
        "ARIADNA",
        "camino",
      );
    }
    case "pago": {
      if (!ruta || ruta.nivel === "N3") return responder(h.pago, "HESTIA", "expediente");
      const importe = presupuesto({ producto: ruta.producto, citas: ruta.citas, nivelCita: entrada.nivelCita, conGuardian: entrada.conGuardian });
      return responder(h.pagoConRuta(euros(importe.alEncargo)), "HESTIA", "expediente");
    }
    case "documentos":
      return ruta && ruta.documentos.length > 0
        ? responder(h.documentosConRuta(t.rutas[ruta.id].nombre, lista(ruta.documentos.map((d) => t.documentos[d]), entrada.locale)), "MNEMOSINE", "documentos")
        : responder(h.documentosSinRuta, "MNEMOSINE", "documentos");
    case "citas": {
      const esperar = euros(NIVELES_CITA.puede_esperar.precioCentimos);
      const urgente = euros(NIVELES_CITA.urgente.precioCentimos);
      const gestionables = ruta?.citas.filter((c) => CITAS[c].gestionable) ?? [];
      return gestionables.length > 0
        ? responder(h.citasConRuta(lista(gestionables.map((c) => t.citas[c].nombre), entrada.locale), esperar, urgente), "CRONOS", "citas")
        : responder(h.citasSinRuta(esperar, urgente), "CRONOS", "citas");
    }
    case "plazos":
      return responder(h.plazos, "ARGOS", "guardian");
    case "expediente": {
      if (entrada.expedientes === null) return responder(h.expedienteSinSesion, "HESTIA", "expediente");
      const ultimo = entrada.expedientes[0];
      if (!ultimo) return responder(h.expedienteVacio, "HESTIA", "expediente");
      return responder(
        h.expedienteResumen({
          referencia: ultimo.referencia,
          ruta: t.rutas[ultimo.rutaId].nombre,
          estado: t.expediente.estados[ultimo.estado],
          pagado: euros(ultimo.pagadoCentimos),
        }),
        "HESTIA",
        "expediente",
      );
    }
    default: {
      const agente = entrada.motor ? AGENTE_DE_MOTOR[entrada.motor] : "HESTIA";
      return responder(h.noEntendido, agente, entrada.motor);
    }
  }
}
