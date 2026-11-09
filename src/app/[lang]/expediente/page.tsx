import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { PagarAnticipo, SalirCliente } from "@/components/superapp/AccionesExpediente";
import { CabeceraMotor } from "@/components/superapp/CabeceraMotor";
import { sesionClienteActual } from "@/lib/auth/cliente";
import { googleConfigurado } from "@/lib/auth/google";
import { formatearEuros } from "@/lib/catalogo";
import { isDatabaseConfigured } from "@/lib/db";
import type { EstadoLead, Expediente } from "@/lib/expediente";
import { expedientesDeCliente } from "@/lib/expediente";
import { DICCIONARIOS } from "@/lib/i18n";
import { esLocale, ETIQUETA_INTL } from "@/lib/i18n/locales";
import { importeDe } from "@/lib/pagos/repositorio";
import { stripeConfigurado } from "@/lib/pagos/stripe";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: PageProps<"/[lang]/expediente">): Promise<Metadata> {
  const { lang } = await params;
  return esLocale(lang) ? { title: DICCIONARIOS[lang].expediente.titulo } : {};
}

const TONO_LEAD: Record<EstadoLead, string> = { nuevo: "info", contactado: "info", revision_abogado: "info", aprobado: "oro", convertido: "ok", descartado: "tenue" };
const TONO_PAGO: Record<string, string> = { pendiente: "aviso", pagado: "ok", fallido: "critico", expirado: "tenue", reembolsado: "tenue" };
const MOTIVOS_ACCESO = ["error", "cancelado", "no_configurado", "limite", "sin_permiso"];

export default async function MiExpediente({ params, searchParams }: PageProps<"/[lang]/expediente">) {
  const { lang } = await params;
  if (!esLocale(lang)) notFound();
  const t = DICCIONARIOS[lang];
  const intl = ETIQUETA_INTL[lang];
  const consulta = await searchParams;
  const acceso = typeof consulta.acceso === "string" && MOTIVOS_ACCESO.includes(consulta.acceso) ? consulta.acceso : null;
  const cliente = await sesionClienteActual();

  if (!cliente) {
    const google = googleConfigurado();
    return (
      <>
        <CabeceraMotor locale={lang} agente="HESTIA" titulo={t.expediente.titulo} narrativa={t.expediente.narrativa} />
        <section className="cristal cristal--grande bloque">
          {acceso && acceso !== "no_configurado" && <p className="alerta-holo error" role="alert" style={{ marginBottom: 14 }}>{t.expediente.errorAcceso}</p>}
          {google ? (
            <>
              <a className="boton-cristal plasma-oro" href={`/api/v1/auth/google?destino=${encodeURIComponent(`/${lang}/expediente`)}`}>{t.expediente.entrarGoogle}</a>
              <p className="aviso-ia" style={{ marginTop: 12 }}>{t.expediente.comoFunciona}</p>
            </>
          ) : (
            <p className="alerta-holo info">{t.expediente.googleNoConfigurado}</p>
          )}
        </section>
      </>
    );
  }

  let expedientes: Expediente[] = [];
  let fallo = false;
  if (isDatabaseConfigured()) {
    try {
      expedientes = await expedientesDeCliente(cliente.emailHash);
    } catch {
      fallo = true;
    }
  }
  const pagosActivos = stripeConfigurado();
  const fecha = new Intl.DateTimeFormat(intl, { dateStyle: "medium" });

  return (
    <>
      <CabeceraMotor locale={lang} agente="HESTIA" titulo={t.expediente.titulo} narrativa={t.expediente.narrativa} />
      <div className="acciones" style={{ marginTop: 0, marginBottom: 16 }}>
        <span className="mono" style={{ color: "var(--texto-suave)", fontSize: "0.82rem" }}>{t.expediente.sesionComo(cliente.email)}</span>
        <SalirCliente locale={lang} />
      </div>
      {fallo && <p className="alerta-holo error" role="alert">{t.expediente.errorAcceso}</p>}
      {!fallo && expedientes.length === 0 && (
        <section className="cristal cristal--grande bloque">
          <p>{t.expediente.vacio(cliente.email)}</p>
          <div className="acciones"><a className="boton-cristal" href={`/${lang}/camino`}>{t.expediente.empezar}</a></div>
        </section>
      )}
      <div className="expedientes">
        {expedientes.map((e) => {
          const anticipoPagado = e.pagos.some((p) => p.tipo === "anticipo" && p.estado === "pagado");
          const puedePagar = e.estado === "aprobado" && !anticipoPagado && e.totalCentimos > 0 && e.nivel !== "N3";
          return (
            <article key={e.id} className="cristal cristal--grande">
              <p className="hud-etiqueta"><span>{e.referencia}</span><span>{fecha.format(e.creadoEn)}</span></p>
              <h2>{t.rutas[e.rutaId].nombre}</h2>
              <p><span className={`estado-holo ${TONO_LEAD[e.estado]}`}>{t.expediente.estados[e.estado]}</span></p>
              <div className="expediente-fila lecturas">
                <div className="lectura"><span className="lectura-nombre">{t.expediente.total}</span><span className="lectura-valor">{e.nivel === "N3" ? t.plan.gratis : formatearEuros(e.totalCentimos, intl)}</span></div>
                <div className="lectura"><span className="lectura-nombre">{t.expediente.pagado}</span><span className="lectura-valor">{formatearEuros(e.pagadoCentimos, intl)}</span></div>
                <div className="lectura"><span className="lectura-nombre">{t.expediente.citas}</span><span className="lectura-valor">{e.citas.length}</span></div>
              </div>
              {puedePagar && (pagosActivos
                ? <PagarAnticipo locale={lang} referencia={e.referencia} importe={formatearEuros(importeDe("anticipo", e.totalCentimos), intl)} />
                : <p className="alerta-holo info">{t.pago.noDisponible}</p>)}
              {e.pagos.length > 0 && (
                <>
                  <h3 style={{ marginTop: 16 }}>{t.expediente.pagos}</h3>
                  <ul className="avisos">
                    {e.pagos.map((p, i) => (
                      <li key={i}>
                        <span>{t.pago.concepto(p.tipo, e.referencia)} · <span className="mono">{formatearEuros(p.importe, intl)}</span> · <span className={`estado-holo ${TONO_PAGO[p.estado]}`}>{t.expediente.estadosPago[p.estado]}</span></span>
                      </li>
                    ))}
                  </ul>
                </>
              )}
              <h3 style={{ marginTop: 16 }}>{t.expediente.citas}</h3>
              {e.citas.length === 0 ? (
                <p>{t.expediente.sinCitas}</p>
              ) : (
                <ul className="avisos">
                  {e.citas.map((c) => (
                    <li key={c.tipo}>
                      <span>{t.citas[c.tipo].nombre} · {t.motorCitas.estados[c.estado]}{c.fechaCita ? ` · ${fecha.format(c.fechaCita)}` : ""}</span>
                    </li>
                  ))}
                </ul>
              )}
            </article>
          );
        })}
      </div>
    </>
  );
}
