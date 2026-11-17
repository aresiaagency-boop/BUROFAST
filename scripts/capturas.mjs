// Evidencia visual de la superapp: puerta de idiomas, Núcleo, el camino
// completo, cada motor, HESTIA respondiendo, el expediente y el centro de
// la Dirección. Guarda una captura por pantalla en artifacts/capturas. Necesita
// el servidor en marcha (BASE_URL, por defecto http://localhost:3000). La
// Dirección solo se abre con Google; para capturarla en local, el script abre
// una sesión de prueba directamente en la base de datos local (DATABASE_URL y
// AUTH_SECRET) y se niega a hacerlo contra cualquier servidor que no sea local.
import { createHmac, randomBytes } from "node:crypto";
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

// 3. Dirección (solo en local: sesión de prueba creada en la base local)
const local = /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(BASE);
if (local && process.env.DATABASE_URL && process.env.AUTH_SECRET) {
  const postgres = createRequire(import.meta.url)("postgres");
  const sql = postgres(process.env.DATABASE_URL, { max: 1 });
  // Réplica de huella() en src/lib/auth/direccion.ts (HMAC con clave derivada).
  const claveHuella = createHmac("sha256", process.env.AUTH_SECRET.trim()).update("burofast:direccion:huella").digest();
  const huella = (v) => createHmac("sha256", claveHuella).update(v).digest("base64url");
  const sid = randomBytes(32).toString("base64url");
  const agente = "Mozilla/5.0 (capturas BUROFAST)";
  await sql`insert into direccion_sesiones (id_hash, sub_hash, ip_hash, agente_hash, expira_en) values (${huella(sid)}, ${huella("capturas")}, ${huella("127.0.0.1")}, ${huella(agente)}, now() + interval '10 minutes')`;
  const cuerpo = Buffer.from(JSON.stringify({ sid, exp: Math.floor(Date.now() / 1000) + 600 })).toString("base64url");
  const token = `${cuerpo}.${createHmac("sha256", process.env.AUTH_SECRET.trim()).update(`direccion:${cuerpo}`).digest("base64url")}`;

  const acceso = await pagina({ viewport: { width: 1440, height: 900 } });
  await acceso.goto(`${BASE}/mando/acceso`);
  await acceso.waitForTimeout(400);
  await foto(acceso, "20-direccion-acceso");

  const mando = await pagina({ viewport: { width: 1440, height: 900 }, userAgent: agente });
  // `next start` corre en modo producción: la cookie es «__Host-» (Chrome la
  // admite en http://localhost). Con `next dev`, sin prefijo.
  await mando.context().addCookies([
    { name: "__Host-burofast.direccion", value: token, domain: new URL(BASE).hostname, path: "/", httpOnly: true, secure: true, sameSite: "Strict" },
    { name: "burofast.direccion", value: token, domain: new URL(BASE).hostname, path: "/", httpOnly: true, sameSite: "Strict" },
  ]);
  await mando.goto(`${BASE}/mando`);
  await mando.waitForTimeout(500);
  await foto(mando, "21-direccion", true);
  for (const [ruta, nombre] of [["leads", "22-direccion-solicitudes"], ["citas", "23-direccion-citas"], ["pagos", "24-direccion-pagos"], ["hestia", "25-direccion-agentes"]]) {
    await mando.goto(`${BASE}/mando/${ruta}`);
    await mando.waitForTimeout(500);
    await foto(mando, nombre, true);
  }
  await mando.goto(`${BASE}/mando/leads`);
  const corregir = mando.getByRole("button", { name: "Corregir ruta" }).first();
  if (await corregir.count()) {
    await corregir.click();
    await mando.waitForTimeout(300);
    await foto(mando, "26-direccion-corregir-ruta", true);
  }
  await sql`update direccion_sesiones set revocada_en = now(), motivo_revocacion = 'capturas' where id_hash = ${huella(sid)}`;
  await sql.end({ timeout: 5 });
}

await navegador.close();
console.log(errores.length ? `Errores en el navegador:\n${errores.join("\n")}` : "Sin errores de consola ni de página.");
