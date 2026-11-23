import { afterEach, describe, expect, it, vi } from "vitest";
import { compararTitular, evaluarLectura, irisConfigurado, irisPuedeLeer, leerConIris } from "@/lib/iris";

const respuesta = { tipoDetectado: "ccse", esElPedido: true, confianza: 0.97, legible: true, titularDocumento: "HERNÁNDEZ CASTILLO, RONALD", fechaEmision: "2025-06-12", fechaCaducidad: null, resultadoApto: true, observacion: null };
const entrada = { tipo: "ccse" as const, catalogo: { ccse: "Diploma CCSE" }, mime: "image/png", contenido: new Uint8Array([1, 2, 3]) };

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe("titular", () => {
  it("compara en el servidor: tildes, orden y un solo apellido valen; otra persona no", () => {
    expect(compararTitular("Ronald Hernández Castillo", "HERNANDEZ CASTILLO, RONALD")).toBe(true);
    expect(compararTitular("Ronald Hernández Castillo", "Ronald Hernandez")).toBe(true);
    expect(compararTitular("Ronald Hernández Castillo", "María Hernández López")).toBe(false);
    expect(compararTitular("Ana", "ANA")).toBe(true);
    expect(compararTitular("Ana Pérez", null)).toBeNull();
    expect(compararTitular("", "Ana Pérez")).toBeNull();
  });

  it("el nombre que lee IRIS no se guarda: solo si coincide", () => {
    const lectura = evaluarLectura(respuesta, "Ronald Hernández Castillo");
    expect(lectura.titularCoincide).toBe(true);
    expect(JSON.stringify(lectura)).not.toContain("RONALD");
  });
});

describe("IRIS por n8n", () => {
  it("usa el mismo n8n y la misma credencial que el canal app, en su propia ruta, y no le manda el nombre", async () => {
    vi.stubEnv("HESTIA_N8N_URL", "https://n8n.ejemplo.test/webhook/burofast-hestia-app");
    vi.stubEnv("HESTIA_N8N_TOKEN", "token-de-prueba");
    const llamada = vi.fn(async () => new Response(JSON.stringify([{ ok: true, lectura: respuesta }]), { status: 200 }));
    vi.stubGlobal("fetch", llamada);
    expect(irisConfigurado()).toBe(true);
    expect(await leerConIris(entrada)).toEqual(respuesta);
    const [url, opciones] = llamada.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("https://n8n.ejemplo.test/webhook/burofast-iris");
    expect((opciones.headers as Record<string, string>).authorization).toBe("Bearer token-de-prueba");
    const cuerpo = JSON.parse(String(opciones.body)) as Record<string, unknown>;
    expect(cuerpo).toMatchObject({ tipoEsperado: "ccse", mime: "image/png", base64: "AQID" });
    expect(cuerpo).not.toHaveProperty("titular");
  });

  it("antecedentes penales, HEIC y «otro» nunca salen hacia IRIS", () => {
    expect(irisPuedeLeer("antecedentes_origen", "application/pdf")).toBe(false);
    expect(irisPuedeLeer("antecedentes_espana", "image/jpeg")).toBe(false);
    expect(irisPuedeLeer("pasaporte", "image/heic")).toBe(false);
    expect(irisPuedeLeer("otro", "image/png")).toBe(false);
    expect(irisPuedeLeer("pasaporte", "application/pdf")).toBe(true);
  });

  it("sin n8n, con respuesta rara o con error, no hay lectura: lo mira una persona", async () => {
    expect(irisConfigurado()).toBe(false);
    expect(await leerConIris(entrada)).toBeNull();
    vi.stubEnv("HESTIA_N8N_URL", "https://n8n.ejemplo.test/webhook/burofast-hestia-app");
    vi.stubEnv("HESTIA_N8N_TOKEN", "t");
    const llamada = vi.fn(async () => new Response(JSON.stringify({ ok: true, lectura: { ...respuesta, confianza: 7 } }), { status: 200 }));
    vi.stubGlobal("fetch", llamada);
    expect(await leerConIris({ ...entrada, tipo: "antecedentes_origen" })).toBeNull();
    expect(llamada).not.toHaveBeenCalled();
    expect(await leerConIris(entrada)).toBeNull();
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({ ok: false }), { status: 200 })));
    expect(await leerConIris(entrada)).toBeNull();
    vi.stubGlobal("fetch", vi.fn(async () => { throw new Error("caído"); }));
    expect(await leerConIris(entrada)).toBeNull();
  });
});
