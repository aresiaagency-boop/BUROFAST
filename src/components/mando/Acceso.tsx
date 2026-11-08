"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { SimboloBurofast } from "@/components/Marca";

export function Acceso({ configurado, destino }: { configurado: boolean; destino: string }) {
  const router = useRouter();
  const [fallo, setFallo] = useState<string | null>(null);
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
      <form className="tarjeta formulario" onSubmit={entrar}>
        <div className="marca"><SimboloBurofast /><span><span className="marca-nombre">BUROFAST</span><span className="marca-lema">Centro de mando</span></span></div>
        <h1 className="titulo-paso" style={{ fontSize: "1.5rem" }}>Acceso del equipo</h1>
        {!configurado && <div className="alerta info">El acceso no está configurado en este servidor: faltan AUTH_SECRET, OWNER_EMAIL u OWNER_PASSWORD_HASH.</div>}
        <div className="campo"><label htmlFor="email">Correo</label><input id="email" name="email" type="email" autoComplete="username" required /></div>
        <div className="campo"><label htmlFor="password">Contraseña</label><input id="password" name="password" type="password" autoComplete="current-password" required /></div>
        {fallo && <div className="alerta error" role="alert">{fallo}</div>}
        <button className="boton" type="submit" disabled={ocupado || !configurado}>{ocupado ? "Entrando…" : "Entrar"}</button>
      </form>
    </main>
  );
}
