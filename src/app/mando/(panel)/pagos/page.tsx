import { EstadoBadge, fechaHora, hace, Metrica, Vacio } from "@/components/mando/piezas";
import { Superior } from "@/components/mando/Superior";
import { formatearEuros } from "@/lib/catalogo";
import { comprobarPostgres, comprobarStripe } from "@/lib/estado";
import { listarPagos, resumenPagos } from "@/lib/pagos/repositorio";
import { modoStripe, webhookStripeConfigurado } from "@/lib/pagos/stripe";

export const metadata = { title: "Pagos" };
export const dynamic = "force-dynamic";

const TONO = { pendiente: "aviso", pagado: "ok", fallido: "critico", expirado: "desconocido", reembolsado: "info" } as const;

export default async function Pagos() {
  const [postgres, stripeApi] = await Promise.all([comprobarPostgres(), comprobarStripe()]);
  const dbOk = postgres.estado === "operativo";
  const [resumen, pagos] = dbOk ? await Promise.all([resumenPagos(), listarPagos()]) : [null, []];
  const modo = modoStripe();
  const consultado = new Date();
  return (
    <>
      <Superior
        titulo="Pagos"
        miga="BUROFAST / Mando / Pagos"
        estadoGlobal={stripeApi.estado === "operativo" ? { tono: modo === "live" ? "ok" : "aviso", texto: modo === "live" ? "Stripe LIVE · cobros reales" : "Stripe en modo TEST" } : { tono: "critico", texto: "Stripe sin conectar" }}
      />
      <div className="trabajo">
        <div className="columna">
          {resumen ? (
            <div className="kpis">
              <Metrica nombre="Cobrado hoy" valor={formatearEuros(resumen.cobradoHoy, "es-ES")} fuente="pagos · Stripe" consultadoEn={consultado} />
              <Metrica nombre="Cobrado este mes" valor={formatearEuros(resumen.cobradoMes, "es-ES")} fuente="pagos · Stripe" consultadoEn={consultado} />
              <Metrica nombre="Pagos completados" valor={resumen.pagados} fuente="pagos" consultadoEn={consultado} />
              <Metrica nombre="Checkouts abiertos" valor={resumen.pendientes} fuente="pagos" consultadoEn={consultado} />
            </div>
          ) : (
            <Vacio titulo="Sin datos de pagos" texto="PostgreSQL no responde; no se muestra ninguna cifra." />
          )}
          <section className="panel cristal">
            <h2>Movimientos <span className="metrica-fuente">el importe lo fija el servidor; Stripe confirma por webhook firmado</span></h2>
            {pagos.length === 0 ? (
              <Vacio titulo="Todavía no hay pagos" texto="Aparecerán cuando un cliente con la ruta confirmada abra el pago del anticipo." />
            ) : (
              <div className="tabla-contenedor">
                <table className="tabla">
                  <thead><tr><th>Camino</th><th>Concepto</th><th>Importe</th><th>Estado</th><th>Modo</th><th>Creado</th><th>Pagado</th></tr></thead>
                  <tbody>
                    {pagos.map((p) => (
                      <tr key={p.id}>
                        <td className="mono">{p.referencia}</td>
                        <td>{p.tipo === "anticipo" ? "Anticipo 50 %" : "Pago final"}</td>
                        <td className="mono">{formatearEuros(p.importe, "es-ES")}</td>
                        <td><EstadoBadge tono={TONO[p.estado]} texto={p.estado} />{p.duplicado && <> <EstadoBadge tono="critico" texto="Duplicado: devolver uno" /></>}</td>
                        <td className="mono">{p.modo.toUpperCase()}</td>
                        <td className="mono">{fechaHora.format(p.creadoEn)}</td>
                        <td className="mono">{p.pagadoEn ? fechaHora.format(p.pagadoEn) : "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </div>
        <aside className="columna">
          <section className="panel cristal">
            <h2>Conexión con Stripe</h2>
            <ul className="avisos">
              <li>API: {stripeApi.detalle}</li>
              <li>Webhook: {webhookStripeConfigurado() ? (resumen?.ultimoEvento ? `último evento ${hace(resumen.ultimoEvento)}` : "configurado, sin eventos todavía") : "falta STRIPE_WEBHOOK_SECRET"}</li>
              <li>Solo se cobra el anticipo de expedientes con la ruta confirmada por el abogado.</li>
              <li>Los reembolsos se hacen desde el panel de Stripe; el estado se actualiza solo con el evento charge.refunded.</li>
            </ul>
          </section>
        </aside>
      </div>
    </>
  );
}
