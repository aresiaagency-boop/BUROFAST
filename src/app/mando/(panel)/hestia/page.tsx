import { EstadoPiezaBadge, hace, Metrica, Vacio } from "@/components/mando/piezas";
import { Superior } from "@/components/mando/Superior";
import { comprobarTodo } from "@/lib/estado";
import { estadoGlobal, NOMBRE_PIEZA } from "@/lib/estado-global";
import { resumenOperativo } from "@/lib/repositorio";

export const metadata = { title: "HESTIA y sistemas" };

export default async function Hestia() {
  const piezas = await comprobarTodo();
  const dbOk = piezas.find((p) => p.id === "postgres")?.estado === "operativo";
  const resumen = dbOk ? await resumenOperativo() : null;
  const delAgente = piezas.filter((p) => ["n8n", "whatsapp", "hestia_webhook"].includes(p.id));
  return (
    <>
      <Superior titulo="HESTIA y sistemas" miga="BUROFAST / Mando / HESTIA" estadoGlobal={estadoGlobal(delAgente)} />
      <div className="trabajo">
        <div className="columna">
          {resumen ? (
            <div className="kpis">
              <Metrica nombre="Mensajes entrantes (24 h)" valor={resumen.hestia.entrantes} fuente="hestia_eventos" consultadoEn={resumen.consultadoEn} />
              <Metrica nombre="Escalados a una persona (24 h)" valor={resumen.hestia.escalados} fuente="hestia_eventos" consultadoEn={resumen.consultadoEn} />
              <Metrica nombre="Último evento recibido" valor={resumen.hestia.ultimo ? hace(resumen.hestia.ultimo) : "Nunca"} fuente="hestia_eventos" consultadoEn={resumen.consultadoEn} />
            </div>
          ) : (
            <Vacio titulo="Sin métricas de HESTIA" texto="Sin PostgreSQL no se registran eventos del agente." />
          )}
          <section className="panel">
            <h2>Conexiones del agente</h2>
            <table className="tabla">
              <thead><tr><th>Pieza</th><th>Estado</th><th>Detalle</th><th>Fuente</th></tr></thead>
              <tbody>
                {delAgente.map((p) => (
                  <tr key={p.id}><td>{NOMBRE_PIEZA[p.id]}</td><td><EstadoPiezaBadge estado={p.estado} /></td><td>{p.detalle}</td><td className="mono">{p.fuente} · {hace(new Date(p.comprobadoEn))}</td></tr>
                ))}
              </tbody>
            </table>
          </section>
          <section className="panel">
            <h2>Cómo trabaja HESTIA</h2>
            <ol className="lista">
              <li>Evolution API entrega cada mensaje de WhatsApp al webhook de n8n.</li>
              <li>n8n agrupa los mensajes seguidos, transcribe los audios y pide a BUROFAST el contexto vigente (precios, reglas de citas, enlaces al funnel).</li>
              <li>HESTIA responde en el idioma del cliente, se presenta como IA y le envía su enlace al camino.</li>
              <li>Cada mensaje entrante, respuesta y escalado se registra aquí con credencial propia y marca de tiempo; nunca el texto del mensaje.</li>
              <li>Asilo, recursos, requerimientos y cualquier duda de elegibilidad pasan a una persona.</li>
            </ol>
            <p className="metrica-fuente" style={{ marginTop: 10 }}>Flujo importable: infrastructure/n8n/hestia-whatsapp.workflow.json</p>
          </section>
        </div>
        <aside className="columna">
          <section className="panel">
            <h2>Todas las piezas</h2>
            <table className="tabla"><tbody>{piezas.map((p) => <tr key={p.id}><td>{NOMBRE_PIEZA[p.id]}</td><td><EstadoPiezaBadge estado={p.estado} /></td></tr>)}</tbody></table>
          </section>
        </aside>
      </div>
    </>
  );
}
