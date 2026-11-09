import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { POST } from "@/app/api/v1/pagos/checkout/route";

// Sin «empezad ya» no se abre ningún Checkout: la ruta corta antes de mirar
// la ficha o la referencia (y antes de llamar a Stripe).
describe("checkout: petición expresa de empezar ya", () => {
  const anterior = { ...process.env };
  beforeEach(() => {
    process.env.STRIPE_SECRET_KEY = "sk_test_prueba";
    process.env.DATABASE_URL = process.env.DATABASE_URL ?? "postgres://nadie@127.0.0.1:1/nada";
    process.env.APP_BASE_URL = "https://burofast.test";
  });
  afterEach(() => {
    process.env = { ...anterior };
  });

  const pedir = (cuerpo: unknown) =>
    POST(new Request("https://burofast.test/api/v1/pagos/checkout", { method: "POST", headers: { "content-type": "application/json", "x-forwarded-for": "203.0.113.9" }, body: JSON.stringify(cuerpo) }));

  it.each([[{ locale: "es", referencia: "BF-ABC234" }], [{ locale: "es", referencia: "BF-ABC234", empezarYa: false }], [{ locale: "es", ficha: "x.y" }]])("rechaza %j", async (cuerpo) => {
    const respuesta = await pedir(cuerpo);
    expect(respuesta.status).toBe(400);
    expect((await respuesta.json()).error.codigo).toBe("EMPEZAR_YA_REQUERIDO");
  });

  it("con la casilla marcada sigue adelante (y aquí se para en la ficha falsa)", async () => {
    const respuesta = await pedir({ locale: "es", ficha: "x.y", empezarYa: true });
    expect((await respuesta.json()).error.codigo).toBe("FICHA_INVALIDA");
  });
});
