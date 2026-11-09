import Link from "next/link";
import { EstadoPiezaBadge, fechaHora, hace, Metrica, Vacio } from "@/components/mando/piezas";
import { Superior } from "@/components/mando/Superior";
import { DICCIONARIOS } from "@/lib/i18n";
import { comprobarTodo } from "@/lib/estado";
import { estadoGlobal, NOMBRE_PIEZA } from "@/lib/estado-global";
import { resumenOperativo, ultimasAuditorias } from "@/lib/repositorio";
import type { RutaId } from "@/lib/diagnostico";

export const metadata = { title: "Centro de mando" };

export default async function Mando() {
  const piezas = await comprobarTodo();
  const dbOk = piezas.find((p) => p.id === "postgres")?.estado === "operativo";
  const [resumen, auditorias] = dbOk ? await Promise.all([resumenOperativo(), ultimasAuditorias()]) : [null, []];
  const global = estadoGlobal(piezas);
  const maxRuta = Math.max(1, ...(resumen?.rutas.map((r) => r.total) ?? [1]));
  const fuente = "PostgreSQL";

  return (
    <>
      <Superior titulo="Mando" miga="BUROFAST / Centro de mando" estadoGlobal={global} />
      <div className="trabajo">
        <div className="columna">
          {resumen && resumen.leads.demo > 0 && (
            <p className="banner-demo">DEMO · Hay {resumen.leads.demo} solicitudes de demostración cargadas con el seed. Se distinguen con la etiqueta DEMO y no son clientes reales.</p>
          )}
          {!dbOk && <Vacio titulo="Sin datos operativos" texto="PostgreSQL no está configurado o no responde. Revisa DATABASE_URL en el servidor; mientras tanto no se muestra ninguna cifra." />}
          {resumen && (
            <div className="kpis">
              <Metrica nombre="Citas urgentes abiertas" valor={resumen.citas.urgentes} fuente={fuente} consultadoEn={resumen.consultadoEn} />
              <Metrica nombre="Citas «puedo esperar» abiertas" valor={resumen.citas.esperan} fuente={fuente} consultadoEn={resumen.consultadoEn} />
              <Metrica nombre="Primera acción vencida" valor={resumen.citas.vencidas} fuente={fuente} consultadoEn={resumen.consultadoEn} />
              <Metrica nombre="Citas reservadas o confirmadas" valor={resumen.citas.reservadas} fuente={fuente} consultadoEn={resumen.consultadoEn} />
              <Metrica nombre="Citas esperando resolución" valor={resumen.citas.enEspera} fuente={fuente} consultadoEn={resumen.consultadoEn} />
              <Metrica nombre="Solicitudes en 7 días" valor={resumen.leads.semana} fuente={fuente} consultadoEn={resumen.consultadoEn} />
              <Metrica nombre="Solicitudes totales" valor={resumen.leads.total} fuente={fuente} consultadoEn={resumen.consultadoEn} />
            </div>
          )}
          {resumen && (
            <section className="panel cristal">
              <h2>Rutas más pedidas <Link className="chip-cristal" href="/mando/leads">Ver solicitudes</Link></h2>
              {resumen.rutas.length === 0 ? (
                <Vacio titulo="Aún no hay solicitudes" texto="Cuando alguien complete el funnel aparecerá aquí su ruta." />
              ) : (
                <div className="barras">
                  {resumen.rutas.map((r) => (
                    <div className="barra-fila" key={r.rutaId}>
                      <span>{DICCIONARIOS.es.rutas[r.rutaId as RutaId]?.nombre ?? r.rutaId}</span>
                      <span className="barra-fondo"><span className="barra-relleno" style={{ width: `${(r.total / maxRuta) * 100}%`, display: "block" }} /></span>
                      <span className="mono">{r.total}</span>
                    </div>
                  ))}
                </div>
              )}
            </section>
          )}
          <section className="panel cristal">
            <h2>Sistemas</h2>
            <div className="tabla-contenedor">
              <table className="tabla">
                <thead><tr><th>Pieza</th><th>Estado</th><th>Detalle</th><th>Latencia</th><th>Comprobado</th></tr></thead>
                <tbody>
                  {piezas.map((p) => (
                    <tr key={p.id}>
                      <td>{NOMBRE_PIEZA[p.id]}</td>
                      <td><EstadoPiezaBadge estado={p.estado} /></td>
                      <td>{p.detalle}</td>
                      <td className="mono">{p.latenciaMs === null ? "—" : `${p.latenciaMs} ms`}</td>
                      <td className="mono">{p.fuente} · {hace(new Date(p.comprobadoEn))}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        </div>
        <aside className="columna">
          <section className="panel cristal">
            <h2>Alertas</h2>
            <ul className="avisos">
              {resumen && resumen.citas.vencidas > 0 && <li>{resumen.citas.vencidas === 1 ? "1 cita ha superado" : `${resumen.citas.vencidas} citas han superado`} su plazo de primera acción. <Link href="/mando/citas">Abrir citas</Link></li>}
              {piezas.filter((p) => p.estado !== "operativo").map((p) => <li key={p.id}>{NOMBRE_PIEZA[p.id]}: {p.detalle}</li>)}
              {resumen && resumen.citas.vencidas === 0 && piezas.every((p) => p.estado === "operativo") && <li>Sin alertas abiertas.</li>}
            </ul>
          </section>
          <section className="panel cristal">
            <h2>Actividad</h2>
            {auditorias.length === 0 ? (
              <Vacio titulo="Sin actividad registrada" texto={dbOk ? "La auditoría está vacía." : "Sin base de datos no hay registro de auditoría."} />
            ) : (
              <ul className="linea-tiempo">
                {auditorias.map((a) => (
                  <li key={a.id}>
                    <span>
                      {a.accion} · {a.resultado}
                      <small>{a.actorId} · {fechaHora.format(a.creadoEn)} · {a.correlationId.slice(0, 8)}</small>
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </aside>
      </div>
    </>
  );
}
