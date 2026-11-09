import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { CabeceraMotor } from "@/components/superapp/CabeceraMotor";
import { MotorCitas } from "@/components/superapp/MotorCitas";
import { sesionClienteActual } from "@/lib/auth/cliente";
import { semaforoSla } from "@/lib/citas";
import { isDatabaseConfigured } from "@/lib/db";
import type { Expediente } from "@/lib/expediente";
import { expedientesDeCliente } from "@/lib/expediente";
import { DICCIONARIOS } from "@/lib/i18n";
import { esLocale, ETIQUETA_INTL } from "@/lib/i18n/locales";

export async function generateMetadata({ params }: PageProps<"/[lang]/citas">): Promise<Metadata> {
  const { lang } = await params;
  return esLocale(lang) ? { title: DICCIONARIOS[lang].motorCitas.titulo } : {};
}

const TONO: Record<string, string> = { en_plazo: "ok", vence_pronto: "aviso", vencida: "critico", cerrada: "tenue", en_espera: "info" };

export default async function Citas({ params }: PageProps<"/[lang]/citas">) {
  const { lang } = await params;
  if (!esLocale(lang)) notFound();
  const t = DICCIONARIOS[lang];
  const cliente = await sesionClienteActual();
  let expedientes: Expediente[] = [];
  if (cliente && isDatabaseConfigured()) {
    try {
      expedientes = await expedientesDeCliente(cliente.emailHash);
    } catch {
      expedientes = [];
    }
  }
  const citas = expedientes.flatMap((e) => e.citas.map((c) => ({ ...c, referencia: e.referencia })));
  const fecha = new Intl.DateTimeFormat(ETIQUETA_INTL[lang], { dateStyle: "medium", timeStyle: "short" });

  return (
    <>
      <CabeceraMotor locale={lang} agente="CRONOS" titulo={t.motorCitas.titulo} narrativa={t.motorCitas.narrativa} />
      {citas.length > 0 && (
        <section className="cristal cristal--grande bloque">
          <h2>{t.motorCitas.enExpediente}</h2>
          <div className="tabla-contenedor">
            <table className="tabla">
              <thead>
                <tr>
                  <th>{t.expediente.referencia}</th>
                  <th>{t.expediente.citas}</th>
                  <th>{t.expediente.estado}</th>
                  <th>{t.motorCitas.fecha}</th>
                  <th>{t.motorCitas.lugar}</th>
                </tr>
              </thead>
              <tbody>
                {citas.map((c) => {
                  const semaforo = semaforoSla({ estado: c.estado, nivel: c.nivel, slaVenceEn: c.slaVenceEn });
                  return (
                    <tr key={`${c.referencia}-${c.tipo}`}>
                      <td className="mono">{c.referencia}</td>
                      <td>{t.citas[c.tipo].nombre}<br /><small style={{ color: "var(--texto-tenue)" }}>{t.nivelesCita[c.nivel].nombre}</small></td>
                      <td>
                        <span className={`estado-holo ${TONO[semaforo]}`}>{t.motorCitas.estados[c.estado]}</span>
                        <br />
                        <small style={{ color: "var(--texto-tenue)" }}>{t.motorCitas.semaforo[semaforo]}</small>
                      </td>
                      <td className="mono">{c.fechaCita ? fecha.format(c.fechaCita) : t.motorCitas.sinFecha}</td>
                      <td>{c.lugar ?? "—"}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>
      )}
      <MotorCitas locale={lang} />
      <section className="cristal bloque" style={{ marginTop: 18 }}>
        <h3>{t.nivelesCita.reglasTitulo}</h3>
        <ul className="avisos">{t.nivelesCita.reglas.map((regla) => <li key={regla}>{regla}</li>)}</ul>
        <p style={{ marginTop: 10, color: "var(--oro-claro)" }}>{t.nivelesCita.garantia}</p>
      </section>
    </>
  );
}
