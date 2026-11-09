import Link from "next/link";
import { CitaAcciones } from "@/components/mando/CitaAcciones";
import { EstadoBadge, EstadoCitaBadge, fechaHora, hace, SlaBadge, Vacio } from "@/components/mando/piezas";
import { Superior } from "@/components/mando/Superior";
import { exigirRol } from "@/lib/autorizacion";
import { CITAS, NIVELES_CITA } from "@/lib/catalogo";
import { semaforoSla, transicionesPermitidas } from "@/lib/citas";
import { comprobarPostgres } from "@/lib/estado";
import { DICCIONARIOS } from "@/lib/i18n";
import { listarCitas } from "@/lib/repositorio";
import { tieneRol } from "@/lib/security/sesion";

export const metadata = { title: "Citas" };

export default async function Citas({ searchParams }: PageProps<"/mando/citas">) {
  const parametros = await searchParams;
  const todas = parametros.todas === "1";
  const nivel = parametros.nivel === "urgente" || parametros.nivel === "puede_esperar" ? parametros.nivel : null;
  const sesion = await exigirRol("viewer");
  const postgres = await comprobarPostgres();
  const dbOk = postgres.estado === "operativo";
  const citas = dbOk ? (await listarCitas({ abiertas: !todas })).filter((c) => !nivel || c.nivel === nivel) : [];
  const ahora = new Date();
  const t = DICCIONARIOS.es;
  const enlace = (q: Record<string, string | null>) => {
    const p = new URLSearchParams();
    const base = { todas: todas ? "1" : null, nivel, ...q };
    for (const [k, v] of Object.entries(base)) if (v) p.set(k, v);
    const s = p.toString();
    return s ? `/mando/citas?${s}` : "/mando/citas";
  };

  return (
    <>
      <Superior titulo="Expedición y seguimiento de citas" miga="BUROFAST / Mando / Citas"
        estadoGlobal={dbOk ? { tono: "ok", texto: `${citas.length} citas en vista` } : { tono: "critico", texto: "Sin base de datos" }} />
      <div className="trabajo ancho">
        <div className="columna">
          <section className="panel cristal">
            <h2>Cola de citas <span className="metrica-fuente">PostgreSQL · {hace(new Date(postgres.comprobadoEn))}</span></h2>
            <div className="filtros" role="group" aria-label="Filtros">
              <Link className="chip-cristal" aria-current={!todas} href={enlace({ todas: null })}>Abiertas</Link>
              <Link className="chip-cristal" aria-current={todas} href={enlace({ todas: "1" })}>Todas</Link>
              <Link className="chip-cristal" aria-current={!nivel} href={enlace({ nivel: null })}>Cualquier nivel</Link>
              <Link className="chip-cristal" aria-current={nivel === "urgente"} href={enlace({ nivel: "urgente" })}>Urgente · primera acción {NIVELES_CITA.urgente.primeraAccionHoras} h</Link>
              <Link className="chip-cristal" aria-current={nivel === "puede_esperar"} href={enlace({ nivel: "puede_esperar" })}>Puedo esperar · {NIVELES_CITA.puede_esperar.primeraAccionHoras} h</Link>
            </div>
            {!dbOk ? (
              <Vacio titulo="PostgreSQL no responde" texto={postgres.detalle} />
            ) : citas.length === 0 ? (
              <Vacio titulo="No hay citas en esta vista" texto="Las citas se crean cuando un cliente elige «Urgente» o «Puedo esperar» en el funnel." />
            ) : (
              <div className="tabla-contenedor">
                <table className="tabla">
                  <thead>
                    <tr><th>Camino</th><th>Cita</th><th>Nivel</th><th>Estado</th><th>Primera acción</th><th>Garantía</th><th>Cita fijada</th><th>Acciones</th></tr>
                  </thead>
                  <tbody>
                    {citas.map((c) => (
                      <tr key={c.id}>
                        <td className="mono">{c.referencia} {c.demo && <EstadoBadge tono="demo" texto="DEMO" />}<br /><span className="metrica-fuente">{c.locale.toUpperCase()}</span></td>
                        <td>{t.citas[c.tipo].nombre}<br /><span className="metrica-fuente">{t.autoridades[CITAS[c.tipo].autoridad]}</span></td>
                        <td><span className={`etiqueta ${c.nivel === "urgente" ? "urgente" : "espera"}`}>{c.nivel === "urgente" ? "Urgente" : "Puedo esperar"}</span></td>
                        <td><EstadoCitaBadge estado={c.estado} /></td>
                        <td>{(() => {
                          const semaforo = semaforoSla({ estado: c.estado, nivel: c.nivel, slaVenceEn: c.slaVenceEn, ahora });
                          const cuenta = c.slaVenceEn && semaforo !== "cerrada" && semaforo !== "en_espera";
                          return <><SlaBadge semaforo={semaforo} />{cuenta && c.slaVenceEn && <><br /><span className="metrica-fuente">{hace(c.slaVenceEn, ahora)}</span></>}</>;
                        })()}</td>
                        <td className="mono">{c.garantiaVenceEn ? fechaHora.format(c.garantiaVenceEn) : "—"}</td>
                        <td>{c.fechaCita ? <>{fechaHora.format(c.fechaCita)}<br /><span className="metrica-fuente">{c.lugar ?? ""}</span></> : "—"}</td>
                        <td><CitaAcciones citaId={c.id} permitidas={transicionesPermitidas(c.estado, c.nivel)} puedeEditar={tieneRol(sesion, "operator")} /></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
          <section className="panel cristal">
            <h2>Reglas que aplica este módulo</h2>
            <ul className="avisos">
              {t.nivelesCita.reglas.map((r) => <li key={r}>{r}</li>)}
              <li>Cada cambio de estado queda en cita_eventos y en la auditoría con quién, cuándo y desde qué estado.</li>
            </ul>
          </section>
        </div>
      </div>
    </>
  );
}
