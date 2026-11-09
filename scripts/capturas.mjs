// Evidencia visual de la superapp: puerta de idiomas, Núcleo, el camino
// completo, cada motor, HESTIA respondiendo, el expediente y el centro de
// mando. Guarda una captura por pantalla en artifacts/capturas. Necesita el
// servidor en marcha (BASE_URL, por defecto http://localhost:3000) y, para el
// centro de mando, CAPTURAS_EMAIL y CAPTURAS_PASSWORD (acceso de respaldo).
import { mkdir } from "node:fs/promises";
import { createRequire } from "node:module";

// Playwright no es dependencia del proyecto: se usa el instalado en la máquina
// (require respeta NODE_PATH; import no).
const { chromium } = createRequire(import.meta.url)("playwright");

const BASE = process.env.BASE_URL ?? "http://localhost:3000";
const SALIDA = "artifacts/capturas";
await mkdir(SALIDA, { recursive: true });

const navegador = await chromium.launch();
const errores = [];

async function pagina(opciones) {
  const contexto = await navegador.newContext({ deviceScaleFactor: 1, reducedMotion: "reduce", ...opciones });
  const p = await contexto.newPage();
  p.on("pageerror", (e) => errores.push(`pageerror: ${e.message}`));
  p.on("console", (m) => m.type() === "error" && errores.push(`console: ${m.text()}`));
  return p;
}

const foto = (p, nombre, completa = false) => p.screenshot({ path: `${SALIDA}/${nombre}.png`, fullPage: completa });
const elegir = async (p, texto) => {
  await p.getByRole("button", { name: texto }).first().click();
  await p.waitForTimeout(350);
};

// 1. Escritorio ancho (consola de HESTIA abierta)
const es = await pagina({ viewport: { width: 1440, height: 900 } });
await es.goto(`${BASE}/`);
await es.waitForTimeout(500);
await foto(es, "01-puerta");
await es.getByRole("link", { name: /Español/ }).click();
await es.waitForURL("**/es");
await es.evaluate(() => sessionStorage.clear());
await es.reload();
await es.waitForTimeout(600);
await foto(es, "02-nucleo", true);

await es.goto(`${BASE}/es/camino`);
await es.waitForTimeout(500);
await foto(es, "03-camino-sueno");
await elegir(es, /Vivir en regla/);
await elegir(es, /Ya estoy en España/);
await elegir(es, /Todavía no tengo papeles/);
await elegir(es, /Entre 2 y 5 años/);
await elegir(es, /Otro país/);
await foto(es, "04-camino-ruta", true);
await elegir(es, "Continuar");
await elegir(es, /Urgente/);
await foto(es, "05-camino-citas", true);
await elegir(es, "Continuar");
await foto(es, "06-camino-plan");
await elegir(es, "Continuar");
await es.fill("#nombre", "Capturas Prueba");
await es.fill("#telefono", "+34 633 444 555");
await es.fill("#email", "capturas@example.com");
await es.getByLabel(/Acepto que BUROFAST/).check();
await foto(es, "07-camino-contacto", true);
await es.getByRole("button", { name: "Dar el primer paso" }).click();
await es.getByText(/Tu código de camino/).waitFor({ timeout: 10_000 });
await es.waitForTimeout(400);
await foto(es, "08-camino-listo");

// HESTIA en modo local respondiendo con los motores
await es.getByRole("textbox", { name: /Escribe tu pregunta/ }).fill("¿Qué papeles necesito?");
await es.keyboard.press("Enter");
await es.getByText(/vas a necesitar/).first().waitFor({ timeout: 15_000 });
await es.getByRole("textbox", { name: /Escribe tu pregunta/ }).fill("¿Cuánto cuesta?");
await es.keyboard.press("Enter");
await es.getByText(/tu plan suma/).first().waitFor({ timeout: 15_000 });
await es.waitForTimeout(500);
await foto(es, "09-hestia-conversacion");

for (const [ruta, nombre] of [["citas", "10-citas"], ["documentos", "11-documentos"], ["guardian", "12-guardian"], ["expediente", "13-expediente"]]) {
  await es.goto(`${BASE}/es/${ruta}`);
  await es.waitForTimeout(600);
  if (ruta === "documentos") {
    await es.getByRole("button", { name: "Lo tengo" }).first().click();
    await es.getByRole("button", { name: "Lo estoy pidiendo" }).nth(1).click();
    await es.waitForTimeout(300);
  }
  if (ruta === "guardian") {
    const dentroDe = new Date(Date.now() + 40 * 86_400_000).toISOString().slice(0, 10);
    await es.fill("#caducidad", dentroDe);
    await es.waitForTimeout(300);
  }
  await foto(es, nombre, true);
}

// 2. Móvil: árabe (RTL) y ucraniano
const ar = await pagina({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
await ar.goto(`${BASE}/ar`);
await ar.waitForTimeout(600);
await foto(ar, "14-ar-movil-nucleo");
await ar.goto(`${BASE}/ar/camino`);
await ar.evaluate(() => sessionStorage.clear());
await ar.reload();
await ar.waitForTimeout(500);
await foto(ar, "15-ar-movil-camino");
await ar.getByRole("button", { name: /تحدّث مع HESTIA/ }).click();
await ar.waitForTimeout(400);
await foto(ar, "16-ar-movil-hestia");

const uk = await pagina({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
await uk.goto(`${BASE}/uk/guardian`);
await uk.waitForTimeout(500);
await uk.fill("#caducidad", new Date(Date.now() + 20 * 86_400_000).toISOString().slice(0, 10));
await uk.waitForTimeout(300);
await foto(uk, "17-uk-movil-guardian", true);

// Páginas legales: escritorio y móvil RTL, con los datos pendientes a la vista
await es.goto(`${BASE}/es/legal/privacidad`);
await es.waitForTimeout(400);
await foto(es, "18-legal-privacidad", true);
// Contexto nuevo: sin la consola que quedó abierta en la captura 16.
const arLegal = await pagina({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
await arLegal.goto(`${BASE}/ar/legal/condiciones`);
await arLegal.waitForTimeout(400);
await foto(arLegal, "19-ar-movil-condiciones");

// 3. Centro de mando (acceso de respaldo con contraseña)
if (process.env.CAPTURAS_EMAIL && process.env.CAPTURAS_PASSWORD) {
  const mando = await pagina({ viewport: { width: 1440, height: 900 } });
  await mando.goto(`${BASE}/mando/acceso`);
  await mando.waitForTimeout(400);
  await foto(mando, "20-mando-acceso");
  await mando.fill("#email", process.env.CAPTURAS_EMAIL);
  await mando.fill("#password", process.env.CAPTURAS_PASSWORD);
  await mando.getByRole("button", { name: /Entrar con contraseña/ }).click();
  await mando.waitForURL(`${BASE}/mando`);
  await mando.waitForTimeout(500);
  await foto(mando, "21-mando", true);
  for (const [ruta, nombre] of [["leads", "22-mando-solicitudes"], ["citas", "23-mando-citas"], ["pagos", "24-mando-pagos"], ["hestia", "25-mando-agentes"]]) {
    await mando.goto(`${BASE}/mando/${ruta}`);
    await mando.waitForTimeout(500);
    await foto(mando, nombre, true);
  }
  // El formulario del abogado para corregir la ruta, si hay alguna solicitud en revisión.
  await mando.goto(`${BASE}/mando/leads`);
  const corregir = mando.getByRole("button", { name: "Corregir ruta" }).first();
  if (await corregir.count()) {
    await corregir.click();
    await mando.waitForTimeout(300);
    await foto(mando, "26-mando-corregir-ruta", true);
  }
}

await navegador.close();
console.log(errores.length ? `Errores en el navegador:\n${errores.join("\n")}` : "Sin errores de consola ni de página.");
