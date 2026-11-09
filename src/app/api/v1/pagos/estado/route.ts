import { db, isDatabaseConfigured } from "@/lib/db";
import { correlationId, error, ipCliente, json } from "@/lib/http";
import { aplicarResultado, pagoPorSesion } from "@/lib/pagos/repositorio";
import { stripe, stripeConfigurado } from "@/lib/pagos/stripe";
import { idPaymentIntent } from "@/lib/pagos/webhook";
import { auditar } from "@/lib/repositorio";
import { limitar } from "@/lib/security/limites";

// Estado de un pago para la página de vuelta de Stripe. Si el webhook aún no
// ha llegado, se pregunta a Stripe directamente: el cobro se refleja aunque
// el webhook tarde o no esté configurado.
export async function GET(request: Request) {
  const correlation = correlationId(request);
  const sesion = new URL(request.url).searchParams.get("sesion") ?? "";
  if (!/^cs_(test|live)_[A-Za-z0-9]{10,200}$/.test(sesion)) return error("SESION_INVALIDA", "Identificador de pago no válido.", { status: 400, correlation });
  if (!isDatabaseConfigured()) return error("PAGOS_NO_CONFIGURADOS", "Base de datos no configurada.", { status: 503, correlation });
  const limite = await limitar(`pago-estado:${ipCliente(request)}`, { limite: 90, ventanaMs: 10 * 60_000 });
  if (!limite.permitido) return error("DEMASIADAS_PETICIONES", "Demasiadas consultas.", { status: 429, correlation });

  let fila = await pagoPorSesion(sesion);
  if (!fila) return error("PAGO_NO_ENCONTRADO", "No encontramos ese pago.", { status: 404, correlation });

  if (fila.estado === "pendiente" && stripeConfigurado()) {
    try {
      const remota = await stripe().checkout.sessions.retrieve(sesion);
      const nuevo = remota.payment_status === "paid" ? "pagado" : remota.status === "expired" ? "expirado" : null;
      if (nuevo) {
        const cambio = await db().begin((tx) => aplicarResultado(tx, { sessionId: sesion, estado: nuevo, paymentIntent: idPaymentIntent(remota.payment_intent) }));
        // Si la vuelta llega antes que el webhook, el cambio se audita aquí:
        // el webhook lo verá ya hecho y no dejará rastro.
        if (cambio) {
          await auditar({ actorId: "stripe", accion: `pago.${nuevo}`, objetivoId: cambio.leadId, parametros: { via: "vuelta", tipo: cambio.tipo }, resultado: "ok", correlationId: correlation });
        }
        fila = (await pagoPorSesion(sesion)) ?? fila;
      }
    } catch {
      // Stripe no respondió: se devuelve lo que sabemos, sin inventar.
    }
  }
  return json({ estado: fila.estado, importe: fila.importe, referencia: fila.referencia, tipo: fila.tipo }, { correlation });
}
