import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { conversar } from "@/lib/hestia/orquestador";

const entrada = (mensaje: string) => ({
  locale: "es" as const,
  conversacion: "prueba-orquestador",
  mensaje,
  motor: null,
  ruta: null,
  nivelCita: null,
  conGuardian: false,
  expedientes: null,
});

describe("HESTIA con n8n", () => {
  const anterior = { url: process.env.HESTIA_N8N_URL, token: process.env.HESTIA_N8N_TOKEN, db: process.env.DATABASE_URL };
  beforeEach(() => {
    process.env.HESTIA_N8N_URL = "https://n8n.invalid/webhook/burofast-hestia-app";
    process.env.HESTIA_N8N_TOKEN = "token-de-prueba";
    delete process.env.DATABASE_URL;
  });
  afterEach(() => {
    vi.unstubAllGlobals();
    process.env.HESTIA_N8N_URL = anterior.url;
    process.env.HESTIA_N8N_TOKEN = anterior.token;
    process.env.DATABASE_URL = anterior.db;
  });

  it("una respuesta de la IA sin motor (null) se acepta, no cae al modo local", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => Response.json({ respuesta: "Hola, soy HESTIA.", agente: "HESTIA", motor: null, escalar: false })));
    expect(await conversar(entrada("Hola"))).toEqual({ texto: "Hola, soy HESTIA.", agente: "HESTIA", motor: null, escalar: false, modo: "ia" });
  });

  it("asilo escala aunque la IA no lo marque", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => Response.json({ respuesta: "Te explico el proceso.", agente: "TEMIS", motor: null, escalar: false })));
    expect(await conversar(entrada("Necesito pedir asilo"))).toMatchObject({ modo: "ia", escalar: true });
  });

  it("si n8n falla responde el modo local, y lo dice", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response("caído", { status: 502 })));
    expect(await conversar(entrada("quiero una persona"))).toMatchObject({ modo: "local", escalar: true, agente: "HESTIA" });
  });
});
