import { COLOR_AGENTE, EmblemaAgente } from "@/components/holo/EmblemaAgente";
import { Constelacion } from "@/components/mando/Constelacion";
import { EstadoPiezaBadge, hace, Metrica, Vacio } from "@/components/mando/piezas";
import { Superior } from "@/components/mando/Superior";
import { metricasAgentes } from "@/lib/agentes-metricas";
import { comprobarTodo } from "@/lib/estado";
import { estadoGlobal, NOMBRE_PIEZA } from "@/lib/estado-global";
import { DICCIONARIOS } from "@/lib/i18n";
import { AGENTES } from "@/lib/motores";
import { resumenOperativo } from "@/lib/repositorio";

export const metadata = { title: "HESTIA y agentes" };
export const dynamic = "force-dynamic";

export default async function Hestia() {
  const piezas = await comprobarTodo();
  const dbOk = piezas.find((p) => p.id === "postgres")?.estado === "operativo";
  const [resumen, metricas] = dbOk ? await Promise.all([resumenOperativo(), metricasAgentes().catch(() => ({}))]) : [null, {}];
  const t = DICCIONARIOS.es;
  const delAgente = piezas.filter((p) => ["n8n", "hestia_ia", "whatsapp", "hestia_webhook"].includes(p.id));
  return (
    <>
      <Superior titulo="HESTIA y agentes" miga="BUROFAST / Mando / HESTIA" estadoGlobal={estadoGlobal(delAgente)} />
      <div className="trabajo">
        <div className="columna">
          {resumen ? (
            <div className="kpis">
              <Metrica nombre="WhatsApp: mensajes entrantes (24 h)" valor={resumen.hestia.entrantes} fuente="hestia_eventos" consultadoEn={resumen.consultadoEn} />
              <Metrica nombre="WhatsApp: escalados (24 h)" valor={resumen.hestia.escalados} fuente="hestia_eventos" consultadoEn={resumen.consultadoEn} />
              <Metrica nombre="WhatsApp: último evento" valor={resumen.hestia.ultimo ? hace(resumen.hestia.ultimo) : "Nunca"} fuente="hestia_eventos" consultadoEn={resumen.consultadoEn} />
            </div>
          ) : (
            <Vacio titulo="Sin métricas de HESTIA" texto="Sin PostgreSQL no se registran turnos ni eventos del agente." />
          )}
          <section className="panel cristal">
            <h2>Equipo de agentes <span className="metrica-fuente">turnos de la superapp · últimos 7 días · hestia_turnos</span></h2>
            <div className="agentes-grid">
              {AGENTES.map((a) => {
                const m = (metricas as Record<string, { turnos: number; ia: number; escalados: number; latencia: number }>)[a];
                return (
                  <article key={a} className="agente-tarjeta cristal plasma-agente" style={{ "--agente": COLOR_AGENTE[a] } as React.CSSProperties}>
                    <EmblemaAgente agente={a} tamano={40} />
                    <div>
                      <p className="hud-etiqueta"><span>{t.agentes[a].nombre}</span><span>{t.agentes[a].rol}</span></p>
                      <p style={{ margin: 0, fontSize: "0.82rem", color: "var(--texto-suave)" }}>{t.agentes[a].frase}</p>
                    </div>
                    <dl>
                      <div><dt>Turnos</dt><dd>{m?.turnos ?? 0}</dd></div>
                      <div><dt>Con IA</dt><dd>{m && m.turnos > 0 ? `${Math.round((m.ia * 100) / m.turnos)} %` : "—"}</dd></div>
                      <div><dt>Escalados</dt><dd>{m?.escalados ?? 0}</dd></div>
                    </dl>
                  </article>
                );
              })}
            </div>
          </section>
          <section className="panel cristal">
            <h2>Cómo orquesta HESTIA</h2>
            <ol className="lista">
              <li>La superapp manda cada mensaje al backend de BUROFAST, nunca directamente a n8n.</li>
              <li>El backend añade el contexto justo (la ruta calculada por ARIADNA, el expediente si el cliente entró con Google) y llama al flujo HESTIA de n8n con su credencial.</li>
              <li>HESTIA consulta a los motores (ARIADNA, CRONOS, MNEMÓSINE, ARGOS, TEMIS) como herramientas de solo lectura y responde en el idioma del cliente, presentándose como IA.</li>
              <li>Si n8n no responde, contesta el modo local con los mismos motores y la interfaz lo dice.</li>
              <li>Asilo, recursos, requerimientos y cualquier duda de elegibilidad pasan a una persona.</li>
            </ol>
          </section>
        </div>
        <aside className="columna">
          <section className="panel cristal">
            <h2>Mapa de sistemas</h2>
            <Constelacion piezas={piezas} />
          </section>
          <section className="panel cristal">
            <h2>Todas las piezas</h2>
            <table className="tabla"><tbody>{piezas.map((p) => <tr key={p.id}><td>{NOMBRE_PIEZA[p.id]}<br /><span className="metrica-fuente">{p.detalle}</span></td><td><EstadoPiezaBadge estado={p.estado} /></td></tr>)}</tbody></table>
          </section>
        </aside>
      </div>
    </>
  );
}
