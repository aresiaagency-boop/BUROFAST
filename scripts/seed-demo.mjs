// Carga datos de DEMOSTRACIÓN marcados con demo = true. Nunca en producción:
// se niega si BUROFAST_ENTORNO=produccion. Uso: npm run seed:demo
import { createCipheriv, createHmac, randomBytes } from "node:crypto";
import postgres from "postgres";

if (process.env.BUROFAST_ENTORNO === "produccion") {
  console.error("[seed-demo] BUROFAST_ENTORNO=produccion: no se cargan datos de demostración.");
  process.exit(1);
}
const url = process.env.DATABASE_URL?.trim();
const claveBruta = process.env.DATA_ENCRYPTION_KEY?.trim();
if (!url || !claveBruta) {
  console.error("[seed-demo] Faltan DATABASE_URL o DATA_ENCRYPTION_KEY.");
  process.exit(1);
}
const clave = /^[0-9a-f]{64}$/i.test(claveBruta) ? Buffer.from(claveBruta, "hex") : Buffer.from(claveBruta, "base64");
const cifrar = (texto) => {
  const iv = randomBytes(12);
  const c = createCipheriv("aes-256-gcm", clave, iv);
  const datos = Buffer.concat([c.update(texto, "utf8"), c.final()]);
  return ["v1", iv.toString("base64url"), c.getAuthTag().toString("base64url"), datos.toString("base64url")].join(".");
};
const hash = (t) => createHmac("sha256", clave).update(t).digest("hex");

const ahora = Date.now();
const h = (horas) => new Date(ahora + horas * 3_600_000);
const casos = [
  { ref: "BF-DEMO01", nombre: "Demo · Ana R.", tel: "+34600000101", locale: "es", ruta: "paso_via_ordinaria", producto: "paso_via_ordinaria", nivel: "N2", nivelCita: "urgente", total: 29000 + 2 * 9900, citas: [["huellas_tie", "en_gestion", -30], ["recogida_tie", "requerida", 20]] },
  { ref: "BF-DEMO02", nombre: "Demo · Youssef B.", tel: "+34600000102", locale: "ar", ruta: "arraigo", producto: "primera_residencia", nivel: "N2", nivelCita: "puede_esperar", total: 45000 + 3 * 3900, citas: [["empadronamiento", "reservada", 100], ["huellas_tie", "requerida", 110], ["recogida_tie", "requerida", 110]] },
  { ref: "BF-DEMO03", nombre: "Demo · Olena K.", tel: "+34600000103", locale: "uk", ruta: "llegada", producto: "llegada", nivel: "N1", nivelCita: "urgente", total: 14900 + 4 * 9900, citas: [["nie", "confirmada", 18], ["empadronamiento", "en_gestion", 4], ["seguridad_social", "requerida", 22], ["certificado_digital", "requerida", 22]] },
  { ref: "BF-DEMO04", nombre: "Demo · Lucas M.", tel: "+34600000104", locale: "pt", ruta: "nacionalidad", producto: "nacionalidad", nivel: "N2", nivelCita: "puede_esperar", total: 35000 + 2 * 3900, citas: [["examenes_ccse_dele", "en_gestion", 60], ["jura_nacionalidad", "requerida", 120]] },
  { ref: "BF-DEMO05", nombre: "Demo · Aminata D.", tel: "+34600000105", locale: "fr", ruta: "reagrupacion", producto: "familia", nivel: "N2", nivelCita: null, total: 45000, citas: [] },
];

const sql = postgres(url, { max: 1, prepare: false });
try {
  await sql.begin(async (tx) => {
    await tx`delete from leads where demo = true`;
    for (const c of casos) {
      const [lead] = await tx`
        insert into leads (referencia, origen, locale, sueno, ubicacion, situacion, tiempo, pasaporte, ruta_id, producto_id, nivel,
          nivel_cita, con_guardian, total_estimado_centimos, nombre_cifrado, telefono_cifrado, telefono_hash,
          consentimiento_privacidad_en, consentimiento_marketing, demo, creado_en)
        values (${c.ref}, 'funnel', ${c.locale}, 'regularizar', 'espana', ${cifrar('sin_autorizacion')}, '2a_5a', 'otro', ${c.ruta}, ${c.producto}, ${c.nivel},
          ${c.nivelCita}, false, ${c.total}, ${cifrar(c.nombre)}, ${cifrar(c.tel)}, ${hash(c.tel)}, now(), false, true, ${h(-48)})
        returning id`;
      for (const [tipo, estado, horasSla] of c.citas) {
        const fijada = estado === "reservada" || estado === "confirmada";
        await tx`
          insert into citas (lead_id, tipo, nivel, estado, sla_vence_en, garantia_vence_en, fecha_cita, lugar, demo)
          values (${lead.id}, ${tipo}, ${c.nivelCita}, ${estado}, ${h(horasSla)}, ${c.nivelCita === "urgente" ? h(24 * 28) : null},
            ${fijada ? h(24 * 9) : null}, ${fijada ? "Oficina de ejemplo (DEMO)" : null}, true)`;
      }
    }
  });
  console.log(`[seed-demo] ${casos.length} solicitudes DEMO cargadas.`);
} finally {
  await sql.end({ timeout: 5 });
}
