// Evidencia visual: recorre el funnel completo y el centro de mando y guarda
// una captura por pantalla en artifacts/capturas. Necesita el servidor en
// marcha (BASE_URL, por defecto http://localhost:3000) y, para el centro de
// mando, CAPTURAS_EMAIL y CAPTURAS_PASSWORD.
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
  const contexto = await navegador.newContext({ deviceScaleFactor: 2, ...opciones });
  const p = await contexto.newPage();
  p.on("pageerror", (e) => errores.push(`pageerror: ${e.message}`));
  p.on("console", (m) => m.type() === "error" && errores.push(`console: ${m.text()}`));
  return p;
}

const foto = (p, nombre) => p.screenshot({ path: `${SALIDA}/${nombre}.png`, fullPage: true });
const elegir = async (p, texto) => {
  await p.getByRole("button", { name: texto }).first().click();
  await p.waitForTimeout(450);
};

// 1. Funnel completo en español, escritorio.
const es = await pagina({ viewport: { width: 1280, height: 900 } });
await es.goto(`${BASE}/`);
await foto(es, "01-idioma");
await es.getByRole("link", { name: /Español/ }).click();
await es.waitForURL("**/es/camino");
await es.evaluate(() => sessionStorage.clear());
await es.reload();
await es.waitForTimeout(400);
await foto(es, "02-sueno");
await elegir(es, /Vivir en regla/);
await foto(es, "03-ubicacion");
await elegir(es, /Ya estoy en España/);
await foto(es, "04-situacion");
await elegir(es, /Me regularicé en 2026/);
await foto(es, "05-tiempo");
await elegir(es, /Entre 2 y 5 años/);
await foto(es, "06-pasaporte");
await elegir(es, /Iberoamericano/);
await foto(es, "07-camino");
await elegir(es, "Continuar");
await elegir(es, /Urgente/);
await foto(es, "08-citas");
await elegir(es, "Continuar");
await es.getByRole("checkbox").first().check();
await foto(es, "09-plan");
await elegir(es, "Continuar");
await es.fill("#nombre", "Capturas Prueba");
await es.fill("#telefono", "+34 633 444 555");
await es.getByLabel(/Acepto que BUROFAST/).check();
await foto(es, "10-contacto");
await es.getByRole("button", { name: "Dar el primer paso" }).click();
await es.getByText(/Tu código de camino/).waitFor({ timeout: 10_000 });
await es.waitForTimeout(400);
await foto(es, "11-listo");

// 2. Árabe (derecha a izquierda) y ucraniano en móvil.
const ar = await pagina({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
await ar.goto(`${BASE}/ar/camino`);
await ar.evaluate(() => sessionStorage.clear());
await ar.reload();
await ar.waitForTimeout(400);
await foto(ar, "12-ar-movil-sueno");
await elegir(ar, /العمل/);
await elegir(ar, /ما زلت خارج إسبانيا/);
await elegir(ar, /بلد آخر/);
await foto(ar, "13-ar-movil-camino");

const uk = await pagina({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
await uk.goto(`${BASE}/uk/camino`);
await uk.evaluate(() => sessionStorage.clear());
await uk.reload();
await uk.waitForTimeout(400);
await elegir(uk, /Добре розпочати/);
await elegir(uk, /Я вже в Іспанії/);
await elegir(uk, /У мене ще немає документів/);
await elegir(uk, /Менше 6 місяців/);
await elegir(uk, /Інша країна/);
await elegir(uk, "Далі");
await foto(uk, "14-uk-movil-citas");

// 3. Centro de mando.
if (process.env.CAPTURAS_EMAIL && process.env.CAPTURAS_PASSWORD) {
  const mando = await pagina({ viewport: { width: 1440, height: 900 } });
  await mando.goto(`${BASE}/mando`);
  await foto(mando, "20-mando-acceso");
  await mando.fill("#email", process.env.CAPTURAS_EMAIL);
  await mando.fill("#password", process.env.CAPTURAS_PASSWORD);
  await mando.getByRole("button", { name: "Entrar" }).click();
  await mando.waitForURL(`${BASE}/mando`);
  await mando.waitForTimeout(500);
  await foto(mando, "21-mando-dashboard");
  await mando.goto(`${BASE}/mando/citas`);
  await foto(mando, "22-mando-citas");
  await mando.goto(`${BASE}/mando/leads`);
  await foto(mando, "23-mando-solicitudes");
  await mando.goto(`${BASE}/mando/hestia`);
  await foto(mando, "24-mando-hestia");
}

await navegador.close();
if (errores.length) {
  console.error(errores.join("\n"));
  process.exitCode = 1;
}
console.log(`[capturas] guardadas en ${SALIDA}`);
