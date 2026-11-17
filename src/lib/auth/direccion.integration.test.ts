import { afterAll, describe, expect, it } from "vitest";
import { abrirSesion, accesoAnterior, direccionBloqueada, FALLOS_GLOBALES, FALLOS_POR_IP, fijarIdentidad, huella, registrarFallo, revocarSesion, subFijado, validarSesion } from "@/lib/auth/direccion";
import { db } from "@/lib/db";

// Se salta sola sin DATABASE_URL: si el número de pruebas baja, la barrera de
// la Dirección NO se ha probado contra PostgreSQL.
const conBase = Boolean(process.env.DATABASE_URL);
const sufijo = `${Date.now()}`;

describe.skipIf(!conBase)("Dirección en PostgreSQL", () => {
  const sub = `google-prueba-${sufijo}`;
  const agente = "Mozilla/5.0 prueba";
  let identidadPrevia: string | null = null;

  afterAll(async () => {
    await db()`delete from direccion_sesiones where sub_hash = ${huella(sub)}`;
    // La identidad fijada es única: si la fijó esta prueba, se borra.
    if (!identidadPrevia) await db()`delete from direccion_identidad where sub_hash = ${huella(sub)}`;
    await db()`delete from limites where clave = any(${[huella(`fallo:ip:198.51.100.${sufijo.slice(-2)}`), huella("fallo:global")]})`;
    await db().end({ timeout: 5 });
  });

  it("una sola sesión activa: entrar de nuevo cierra la anterior", async () => {
    const primera = await abrirSesion({ sub, ip: "203.0.113.1", agente });
    expect(await validarSesion(primera, agente)).not.toBeNull();
    const segunda = await abrirSesion({ sub, ip: "203.0.113.2", agente });
    expect(await validarSesion(primera, agente)).toBeNull();
    expect(await validarSesion(segunda, agente)).not.toBeNull();
    expect(await accesoAnterior(segunda)).toBeInstanceOf(Date);
  });

  it("una cookie usada desde otro navegador deja de valer para siempre", async () => {
    const sid = await abrirSesion({ sub, ip: "203.0.113.3", agente });
    expect(await validarSesion(sid, "curl/8.0")).toBeNull();
    expect(await validarSesion(sid, agente)).toBeNull();
  });

  it("revocar y caducar por inactividad", async () => {
    const sid = await abrirSesion({ sub, ip: "203.0.113.4", agente });
    await revocarSesion(sid, "salida");
    expect(await validarSesion(sid, agente)).toBeNull();
    const otra = await abrirSesion({ sub, ip: "203.0.113.4", agente });
    await db()`update direccion_sesiones set vista_en = now() - interval '31 minutes' where id_hash = ${huella(otra)}`;
    expect(await validarSesion(otra, agente)).toBeNull();
    const [fila] = await db()<{ motivo_revocacion: string }[]>`select motivo_revocacion from direccion_sesiones where id_hash = ${huella(otra)}`;
    expect(fila.motivo_revocacion).toBe("inactividad");
  });

  it("un identificador inventado no abre nada", async () => {
    expect(await validarSesion("inventado".repeat(6), agente)).toBeNull();
  });

  it("la cuenta se fija en el primer acceso y no cambia", async () => {
    identidadPrevia = await subFijado();
    const fijada = await fijarIdentidad(sub);
    if (identidadPrevia) {
      expect(fijada).toBe(identidadPrevia);
    } else {
      expect(fijada).toBe(huella(sub));
      expect(await fijarIdentidad("google-impostor")).toBe(huella(sub));
    }
  });

  it(`bloqueo global solo con ${FALLOS_GLOBALES} cuentas de Google ajenas`, async () => {
    await db()`delete from limites where clave = ${huella("fallo:global")}`;
    for (let i = 0; i < FALLOS_GLOBALES; i += 1) await registrarFallo(`192.0.2.${i}`, { global: true });
    expect(await direccionBloqueada("192.0.2.200")).toBe(true);
    await db()`delete from limites where clave = any(${[huella("fallo:global"), ...Array.from({ length: FALLOS_GLOBALES }, (_, i) => huella(`fallo:ip:192.0.2.${i}`))]})`;
    expect(await direccionBloqueada("192.0.2.200")).toBe(false);
  });

  it(`bloquea la IP al ${FALLOS_POR_IP}.º fallo`, async () => {
    const ip = `198.51.100.${sufijo.slice(-2)}`;
    await db()`delete from limites where clave = ${huella("fallo:global")}`;
    expect(await direccionBloqueada(ip)).toBe(false);
    for (let i = 0; i < FALLOS_POR_IP; i += 1) await registrarFallo(ip, { global: false });
    expect(await direccionBloqueada(ip)).toBe(true);
    // Peticiones basura no tocan el contador global: otras IP siguen entrando.
    expect(await direccionBloqueada("198.51.100.250")).toBe(false);
  });
});
