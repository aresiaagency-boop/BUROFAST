"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { NucleoHestia } from "@/components/holo/NucleoHestia";

const MOTIVOS: Record<string, string> = {
  error: "No se pudo completar el acceso con Google. Vuelve a intentarlo.",
  cancelado: "Has cancelado el acceso con Google.",
  sin_permiso: "Esa cuenta de Google no forma parte del equipo de BUROFAST.",
  no_configurado: "El acceso con Google no está configurado en este servidor.",
  limite: "Demasiados intentos. Espera unos minutos.",
};

// Acceso del equipo: Google es la vía principal; la contraseña del owner
// queda como respaldo solo si su hash está configurado.
export function Acceso({ google, password, destino, motivo }: { google: boolean; password: boolean; destino: string; motivo: string | null }) {
  const router = useRouter();
  const [fallo, setFallo] = useState<string | null>(motivo ? (MOTIVOS[motivo] ?? null) : null);
  const [ocupado, setOcupado] = useState(false);

  async function entrar(evento: React.FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    const datos = new FormData(evento.currentTarget);
    setOcupado(true);
    setFallo(null);
    const respuesta = await fetch("/api/v1/sesion", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email: datos.get("email"), password: datos.get("password") }),
    }).catch(() => null);
    setOcupado(false);
    if (respuesta?.ok) {
      router.push(destino);
      router.refresh();
      return;
    }
    const cuerpo = (await respuesta?.json().catch(() => null)) as { error?: { mensaje?: string } } | null;
    setFallo(cuerpo?.error?.mensaje ?? "No se pudo conectar con el servidor.");
  }

  return (
    <main className="acceso">
      <div className="rejilla-holo" aria-hidden="true" />
      <div className="acceso-caja">
        <NucleoHestia tamano={150} etiqueta="HESTIA" />
        <p className="hud-etiqueta" style={{ justifyContent: "center" }}><span>BUROFAST</span><span>Centro de mando</span></p>
        <h1 className="titulo-paso" style={{ fontSize: "1.6rem" }}>Acceso del equipo</h1>
        {fallo && <p className="alerta-holo error" role="alert" style={{ width: "100%", textAlign: "start" }}>{fallo}</p>}
        {google ? (
          <a className="boton-cristal plasma-oro boton-cristal--ancho" href={`/api/v1/auth/google?destino=${encodeURIComponent(destino)}`}>Entrar con Google</a>
        ) : (
          <p className="alerta-holo info" style={{ width: "100%", textAlign: "start" }}>El acceso con Google no está configurado: faltan GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, APP_BASE_URL o AUTH_SECRET.</p>
        )}
        {password && (
          <form className="formulario cristal" onSubmit={entrar}>
            <p className="metrica-fuente">Respaldo: contraseña del owner</p>
            <div className="campo"><label htmlFor="email">Correo</label><span className="campo-cristal"><input id="email" name="email" type="email" autoComplete="username" required /></span></div>
            <div className="campo"><label htmlFor="password">Contraseña</label><span className="campo-cristal"><input id="password" name="password" type="password" autoComplete="current-password" required /></span></div>
            <button className="boton-cristal boton-cristal--fantasma" type="submit" disabled={ocupado}>{ocupado ? "Entrando…" : "Entrar con contraseña"}</button>
          </form>
        )}
      </div>
    </main>
  );
}
