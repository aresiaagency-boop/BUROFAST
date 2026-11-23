import { beforeAll, describe, expect, it } from "vitest";
import { detectarTipo, documentosRequeridos, esTipoDocumento } from "@/lib/documentos";
import { cifrarBytes, descifrarBytes } from "@/lib/security/cifrado";

beforeAll(() => {
  process.env.DATA_ENCRYPTION_KEY = "22".repeat(32);
});

const bytes = (...b: number[]) => new Uint8Array([...b, ...new Array(16).fill(0)]);

describe("bóveda de documentos", () => {
  it("cifra el binario y lo devuelve idéntico", () => {
    const original = new TextEncoder().encode("%PDF-1.7 pasaporte de prueba");
    const sobre = cifrarBytes(original);
    expect(Buffer.from(sobre).includes(Buffer.from("pasaporte"))).toBe(false);
    expect(Buffer.from(descifrarBytes(sobre)).equals(Buffer.from(original))).toBe(true);
  });

  it("rechaza un sobre manipulado", () => {
    const sobre = Buffer.from(cifrarBytes(new TextEncoder().encode("%PDF-1.7 x")));
    sobre[sobre.length - 1] ^= 0xff;
    expect(() => descifrarBytes(sobre)).toThrow();
  });

  it("reconoce el tipo por el contenido, no por el nombre", () => {
    expect(detectarTipo(new TextEncoder().encode("%PDF-1.4\n…"))).toBe("application/pdf");
    expect(detectarTipo(bytes(0xff, 0xd8, 0xff, 0xe0))).toBe("image/jpeg");
    expect(detectarTipo(bytes(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a))).toBe("image/png");
    expect(detectarTipo(new TextEncoder().encode("RIFF\0\0\0\0WEBPVP8 "))).toBe("image/webp");
    expect(detectarTipo(new TextEncoder().encode("\0\0\0\x18ftypheic\0\0\0\0"))).toBe("image/heic");
    expect(detectarTipo(new TextEncoder().encode("<html><script>alert(1)</script>"))).toBeNull();
    expect(detectarTipo(new TextEncoder().encode("MZ\x90\0ejecutable"))).toBeNull();
  });

  it("solo acepta tipos de documento conocidos", () => {
    expect(esTipoDocumento("pasaporte")).toBe(true);
    expect(esTipoDocumento("otro")).toBe(true);
    expect(esTipoDocumento("../../etc/passwd")).toBe(false);
  });

  it("pide los documentos de la ruta y nada si las respuestas no valen", () => {
    const pedidos = documentosRequeridos({ sueno: "nacionalidad", ubicacion: "espana", situacion: "autorizacion_vigente", tiempo: "2a_5a", pasaporte: "iberoamericano" });
    expect(pedidos).toContain("pasaporte");
    expect(documentosRequeridos({ sueno: "inventado" })).toEqual([]);
    expect(documentosRequeridos(null)).toEqual([]);
  });
});
