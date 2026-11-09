import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { abrir, sellar } from "@/lib/security/sello";

const AHORA = Date.UTC(2026, 10, 9, 12, 0, 0);

describe("fichas selladas", () => {
  const anterior = process.env.AUTH_SECRET;
  beforeEach(() => {
    process.env.AUTH_SECRET = "x".repeat(40);
  });
  afterEach(() => {
    process.env.AUTH_SECRET = anterior;
  });

  it("abre lo que sella, con su caducidad", () => {
    const ficha = sellar({ leadId: "L1" }, 60, "pago", AHORA);
    expect(abrir<{ leadId: string }>(ficha, "pago", AHORA)).toMatchObject({ leadId: "L1", exp: AHORA / 1000 + 60 });
  });

  it("una ficha de un propósito no sirve para otro", () => {
    const ficha = sellar({ email: "a@b.c" }, 60, "pago", AHORA);
    expect(abrir(ficha, "cliente", AHORA)).toBeNull();
  });

  it("rechaza fichas manipuladas, caducadas o vacías", () => {
    const ficha = sellar({ leadId: "L1" }, 60, "pago", AHORA);
    const [cuerpo, firma] = ficha.split(".");
    const otroCuerpo = Buffer.from(JSON.stringify({ leadId: "L2", exp: AHORA / 1000 + 60 })).toString("base64url");
    expect(abrir(`${otroCuerpo}.${firma}`, "pago", AHORA)).toBeNull();
    expect(abrir(`${cuerpo}.${firma.slice(0, -2)}xx`, "pago", AHORA)).toBeNull();
    expect(abrir(ficha, "pago", AHORA + 61_000)).toBeNull();
    expect(abrir("", "pago", AHORA)).toBeNull();
    expect(abrir("sin-punto", "pago", AHORA)).toBeNull();
  });

  it("cambiar AUTH_SECRET invalida todas las fichas", () => {
    const ficha = sellar({ leadId: "L1" }, 60, "pago", AHORA);
    process.env.AUTH_SECRET = "y".repeat(40);
    expect(abrir(ficha, "pago", AHORA)).toBeNull();
  });

  it("sin AUTH_SECRET no se puede sellar ni abrir", () => {
    const ficha = sellar({ leadId: "L1" }, 60, "pago", AHORA);
    delete process.env.AUTH_SECRET;
    expect(() => sellar({}, 60, "pago", AHORA)).toThrow("AUTH_SECRET_NOT_CONFIGURED");
    expect(abrir(ficha, "pago", AHORA)).toBeNull();
  });
});
