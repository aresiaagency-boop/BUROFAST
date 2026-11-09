import { EstadoBadge, fechaHora, Vacio } from "@/components/mando/piezas";
import { LeadAcciones } from "@/components/mando/LeadAcciones";
import { Superior } from "@/components/mando/Superior";
import { exigirRol } from "@/lib/autorizacion";
import { formatearEuros, type ProductoId } from "@/lib/catalogo";
import type { RutaId } from "@/lib/diagnostico";
import { comprobarPostgres } from "@/lib/estado";
import type { EstadoLead } from "@/lib/expediente";
import { ESTADOS_LEAD } from "@/lib/expediente";
import { DICCIONARIOS } from "@/lib/i18n";
import { transicionesLead } from "@/lib/leads";
import { stripeConfigurado } from "@/lib/pagos/stripe";
import { auditar, listarLeads } from "@/lib/repositorio";
import { cifradoConfigurado } from "@/lib/security/cifrado";
import { tieneRol } from "@/lib/security/sesion";

export const metadata = { title: "Solicitudes" };

const TONO: Record<EstadoLead, "ok" | "aviso" | "critico" | "desconocido" | "info" | "demo"> = {
  nuevo: "info", contactado: "info", revision_abogado: "aviso", aprobado: "demo", convertido: "ok", descartado: "desconocido",
};

export default async function Leads() {
  const sesion = await exigirRol("viewer");
  const postgres = await comprobarPostgres();
  const listo = postgres.estado === "operativo" && cifradoConfigurado();
  const leads = listo ? await listarLeads() : [];
  if (listo && sesion) await auditar({ actorId: sesion.sub, accion: "leads.listar", parametros: { total: leads.length }, resultado: "ok" });
  const t = DICCIONARIOS.es;
  const operador = tieneRol(sesion, "operator");
  const esEstado = (e: string): e is EstadoLead => (ESTADOS_LEAD as readonly string[]).includes(e);
  return (
    <>
      <Superior titulo="Solicitudes" miga="BUROFAST / Mando / Solicitudes" estadoGlobal={listo ? { tono: "ok", texto: `${leads.length} solicitudes` } : { tono: "critico", texto: "Sin datos" }} />
      <div className="trabajo ancho">
        <section className="panel cristal">
          <h2>Solicitudes del camino <span className="metrica-fuente">teléfonos enmascarados · lectura auditada · el cobro solo se abre con la ruta confirmada</span></h2>
          {!listo ? (
            <Vacio titulo="No se pueden mostrar solicitudes" texto="Hace falta PostgreSQL operativo y DATA_ENCRYPTION_KEY para descifrar los nombres." />
          ) : leads.length === 0 ? (
            <Vacio titulo="Todavía no hay solicitudes" texto="Aparecerán aquí cuando alguien complete el último paso del camino." />
          ) : (
            <div className="tabla-contenedor">
              <table className="tabla">
                <thead><tr><th>Camino</th><th>Nombre</th><th>WhatsApp</th><th>Idioma</th><th>Ruta</th><th>Citas</th><th>Total · pagado</th><th>Estado</th><th>Recibida</th>{operador && <th>Acciones</th>}</tr></thead>
                <tbody>
                  {leads.map((l) => {
                    const estado = esEstado(l.estado) ? l.estado : "nuevo";
                    return (
                      <tr key={l.id}>
                        <td className="mono">{l.referencia} {l.demo && <EstadoBadge tono="demo" texto="DEMO" />}</td>
                        <td>{l.nombre}<br /><span className="metrica-fuente">{l.tieneEmail ? "con correo (Google)" : "sin correo"}</span></td>
                        <td className="mono">{l.telefono}</td>
                        <td className="mono">{l.locale.toUpperCase()}</td>
                        <td>{t.rutas[l.rutaId as RutaId]?.nombre ?? l.rutaId}<br /><span className="metrica-fuente">{t.productos[l.productoId as ProductoId] ?? l.productoId} · {l.nivel}</span></td>
                        <td>{l.nivelCita ? <span className={`etiqueta ${l.nivelCita === "urgente" ? "urgente" : "espera"}`}>{l.nivelCita === "urgente" ? "Urgente" : "Puedo esperar"}</span> : "—"}</td>
                        <td className="mono">{formatearEuros(l.totalCentimos, "es-ES")}<br /><span className="metrica-fuente">{formatearEuros(l.pagadoCentimos, "es-ES")} cobrado</span></td>
                        <td><EstadoBadge tono={TONO[estado]} texto={t.expediente.estados[estado]} /></td>
                        <td className="mono">{fechaHora.format(l.creadoEn)}</td>
                        {operador && (
                          <td style={{ minWidth: 220 }}>
                            <LeadAcciones
                              id={l.id}
                              transiciones={transicionesLead(estado)}
                              puedeEnlace={estado === "aprobado" && stripeConfigurado()}
                              plan={["nuevo", "contactado", "revision_abogado"].includes(estado) && l.pagadoCentimos === 0 ? { respuestas: l.respuestas, nivelCita: l.nivelCita, conGuardian: l.conGuardian } : null}
                            />
                          </td>
                        )}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>
    </>
  );
}
