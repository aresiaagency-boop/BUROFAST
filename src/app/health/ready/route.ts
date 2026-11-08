import { comprobarPostgres } from "@/lib/estado";
import { cifradoConfigurado } from "@/lib/security/cifrado";

// Listo = puede guardar solicitudes: base de datos que responde y clave de
// cifrado presente. Vivo (/health/live) solo dice que el proceso corre.
export async function GET() {
  const postgres = await comprobarPostgres();
  const cifrado = cifradoConfigurado();
  const listo = postgres.estado === "operativo" && cifrado;
  return Response.json(
    { listo, postgres: { estado: postgres.estado, latenciaMs: postgres.latenciaMs }, cifrado: cifrado ? "operativo" : "no_configurado", ts: new Date().toISOString() },
    { status: listo ? 200 : 503, headers: { "cache-control": "no-store" } },
  );
}
