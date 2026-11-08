import { EstadoBadge, fechaHora, Vacio } from "@/components/mando/piezas";
import { Superior } from "@/components/mando/Superior";
import { exigirRol } from "@/lib/autorizacion";
import { formatearEuros, type ProductoId } from "@/lib/catalogo";
import type { RutaId } from "@/lib/diagnostico";
import { comprobarPostgres } from "@/lib/estado";
import { DICCIONARIOS } from "@/lib/i18n";
import { auditar, listarLeads } from "@/lib/repositorio";
import { cifradoConfigurado } from "@/lib/security/cifrado";

export const metadata = { title: "Solicitudes" };

export default async function Leads() {
  const sesion = await exigirRol("viewer");
  const postgres = await comprobarPostgres();
  const listo = postgres.estado === "operativo" && cifradoConfigurado();
  const leads = listo ? await listarLeads() : [];
  if (listo && sesion) await auditar({ actorId: sesion.sub, accion: "leads.listar", parametros: { total: leads.length }, resultado: "ok" });
  const t = DICCIONARIOS.es;
  return (
    <>
      <Superior titulo="Solicitudes" miga="BUROFAST / Mando / Solicitudes" estadoGlobal={listo ? { tono: "ok", texto: `${leads.length} solicitudes` } : { tono: "critico", texto: "Sin datos" }} />
      <div className="trabajo ancho">
        <section className="panel">
          <h2>Últimas solicitudes del funnel <span className="metrica-fuente">teléfonos enmascarados · lectura auditada</span></h2>
          {!listo ? (
            <Vacio titulo="No se pueden mostrar solicitudes" texto="Hace falta PostgreSQL operativo y DATA_ENCRYPTION_KEY para descifrar los nombres." />
          ) : leads.length === 0 ? (
            <Vacio titulo="Todavía no hay solicitudes" texto="Aparecerán aquí cuando alguien complete el último paso del funnel." />
          ) : (
            <div className="tabla-contenedor">
              <table className="tabla">
                <thead><tr><th>Camino</th><th>Nombre</th><th>WhatsApp</th><th>Idioma</th><th>Ruta</th><th>Nivel</th><th>Citas</th><th>Estimado</th><th>Estado</th><th>Recibida</th></tr></thead>
                <tbody>
                  {leads.map((l) => (
                    <tr key={l.id}>
                      <td className="mono">{l.referencia} {l.demo && <EstadoBadge tono="demo" texto="DEMO" />}</td>
                      <td>{l.nombre}</td>
                      <td className="mono">{l.telefono}</td>
                      <td className="mono">{l.locale.toUpperCase()}</td>
                      <td>{t.rutas[l.rutaId as RutaId]?.nombre ?? l.rutaId}<br /><span className="metrica-fuente">{t.productos[l.productoId as ProductoId] ?? l.productoId}</span></td>
                      <td className="mono">{l.nivel}</td>
                      <td>{l.nivelCita ? <span className={`etiqueta ${l.nivelCita === "urgente" ? "urgente" : "espera"}`}>{l.nivelCita === "urgente" ? "Urgente" : "Puedo esperar"}</span> : "—"}</td>
                      <td className="mono">{formatearEuros(l.totalCentimos, "es-ES")}</td>
                      <td>{l.estado}</td>
                      <td className="mono">{fechaHora.format(l.creadoEn)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>
    </>
  );
}
