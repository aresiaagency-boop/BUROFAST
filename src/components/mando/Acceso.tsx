import { NucleoHestia } from "@/components/holo/NucleoHestia";

const MOTIVOS: Record<string, string> = {
  error: "No se pudo completar el acceso con Google. Vuelve a intentarlo.",
  cancelado: "Has cancelado el acceso con Google.",
  sin_permiso: "Esa cuenta de Google no tiene acceso a la Dirección.",
  no_configurado: "El acceso a la Dirección no está disponible en este servidor.",
  limite: "Demasiados intentos. Espera unos minutos.",
  bloqueado: "Acceso bloqueado temporalmente por intentos fallidos. Vuelve a intentarlo dentro de una hora.",
  autenticacion_antigua: "Google indica que iniciaste sesión hace más de 10 minutos. Cierra sesión en Google, vuelve a entrar con la cuenta de A.R.E.S. y pulsa «Entrar con Google».",
};

// Acceso a la Dirección: solo Google y solo la cuenta de A.R.E.S. No hay
// contraseña propia ni otra vía de entrada.
export function Acceso({ google, destino, motivo }: { google: boolean; destino: string; motivo: string | null }) {
  const fallo = motivo ? (MOTIVOS[motivo] ?? null) : null;
  return (
    <main className="acceso">
      <div className="rejilla-holo" aria-hidden="true" />
      <div className="acceso-caja">
        <NucleoHestia tamano={150} etiqueta="HESTIA" />
        <p className="hud-etiqueta" style={{ justifyContent: "center" }}><span>BUROFAST</span><span>Dirección</span></p>
        <h1 className="titulo-paso" style={{ fontSize: "1.6rem" }}>Acceso a la Dirección</h1>
        <p className="metrica-fuente" style={{ textAlign: "center" }}>Solo la cuenta de Google de A.R.E.S. La primera vez que entre, quedará fijada.</p>
        {fallo && <p className="alerta-holo error" role="alert" style={{ width: "100%", textAlign: "start" }}>{fallo}</p>}
        {google ? (
          <a className="boton-cristal plasma-oro boton-cristal--ancho" href={`/api/v1/auth/google?destino=${encodeURIComponent(destino)}`} rel="nofollow">Entrar con Google</a>
        ) : (
          <p className="alerta-holo info" style={{ width: "100%", textAlign: "start" }}>El acceso con Google no está configurado: faltan GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, APP_BASE_URL u OWNER_EMAIL.</p>
        )}
      </div>
    </main>
  );
}
