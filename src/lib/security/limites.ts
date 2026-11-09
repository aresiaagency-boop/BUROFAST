import { createHash } from "node:crypto";
import { db, isDatabaseConfigured } from "@/lib/db";
import { checkEphemeralRateLimit } from "@/lib/security/rate-limit";

// Límite de peticiones compartido entre instancias. En Vercel cada función
// tiene su propia memoria: un contador en memoria se salta abriendo más
// conexiones. Con base de datos, el contador es uno solo (ventana fija).
// Sin base de datos se cae al contador en memoria, que sigue frenando ráfagas.

export type ResultadoLimite = { permitido: boolean; restantes: number };

// La clave puede contener una IP (dato personal): se guarda resumida.
function resumir(clave: string) {
  return createHash("sha256").update(`burofast:${clave}`).digest("base64url").slice(0, 32);
}

export async function limitar(clave: string, opciones: { limite: number; ventanaMs: number }): Promise<ResultadoLimite> {
  if (!isDatabaseConfigured()) {
    const local = checkEphemeralRateLimit(clave, { limit: opciones.limite, windowMs: opciones.ventanaMs });
    return { permitido: local.allowed, restantes: local.remaining };
  }
  try {
    const segundos = Math.max(1, Math.round(opciones.ventanaMs / 1000));
    const [fila] = await db()<{ cuenta: number }[]>`
      insert into limites (clave, ventana_inicio, cuenta)
      values (${resumir(clave)}, now(), 1)
      on conflict (clave) do update set
        cuenta = case when limites.ventana_inicio < now() - make_interval(secs => ${segundos}) then 1 else limites.cuenta + 1 end,
        ventana_inicio = case when limites.ventana_inicio < now() - make_interval(secs => ${segundos}) then now() else limites.ventana_inicio end
      returning cuenta
    `;
    // Limpieza perezosa: de vez en cuando se borran ventanas viejas.
    if (Math.random() < 0.02) {
      await db()`delete from limites where ventana_inicio < now() - interval '1 day'`;
    }
    return { permitido: fila.cuenta <= opciones.limite, restantes: Math.max(0, opciones.limite - fila.cuenta) };
  } catch {
    // Si la base falla, el límite no debe tumbar la petición: se cae a memoria.
    const local = checkEphemeralRateLimit(clave, { limit: opciones.limite, windowMs: opciones.ventanaMs });
    return { permitido: local.allowed, restantes: local.remaining };
  }
}
