import { beforeAll, describe, expect, it } from "vitest";
import { cifrar, descifrar, enmascararTelefono, hashEstable } from "@/lib/security/cifrado";

beforeAll(() => {
  process.env.DATA_ENCRYPTION_KEY = "11".repeat(32);
});

describe("cifrado de datos personales", () => {
  it("descifra lo que cifra y nunca deja el texto en claro", () => {
    const sobre = cifrar("+34 600 111 222");
    expect(sobre).not.toContain("600");
    expect(descifrar(sobre)).toBe("+34 600 111 222");
  });

  it("rechaza un texto cifrado manipulado", () => {
    const [v, iv, tag, datos] = cifrar("Ana").split(".");
    const alterado = [v, iv, tag, `${datos.slice(0, -2)}AA`].join(".");
    expect(() => descifrar(alterado)).toThrow();
  });

  it("el hash del teléfono es estable para deduplicar", () => {
    expect(hashEstable("+34600111222")).toBe(hashEstable("+34600111222"));
  });

  it("enmascara el teléfono para el centro de mando", () => {
    expect(enmascararTelefono("+34 600 111 222")).toBe("+34 ••• ••• 222");
  });
});
