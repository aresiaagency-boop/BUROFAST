"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Icono, type NombreIcono } from "@/components/Iconos";
import { SimboloBurofast } from "@/components/Marca";

const MODULOS: { href: string; texto: string; icono: NombreIcono }[] = [
  { href: "/mando", texto: "Mando", icono: "mando" },
  { href: "/mando/citas", texto: "Citas", icono: "citas" },
  { href: "/mando/leads", texto: "Solicitudes", icono: "personas" },
  { href: "/mando/pagos", texto: "Pagos", icono: "documento" },
  { href: "/mando/hestia", texto: "HESTIA y agentes", icono: "agente" },
];

export function Navegacion() {
  const ruta = usePathname();
  const router = useRouter();
  async function salir() {
    await fetch("/api/v1/sesion", { method: "DELETE" });
    router.push("/mando/acceso");
  }
  return (
    <aside className="lateral">
      <Link href="/mando" className="marca" style={{ padding: "4px 8px" }}>
        <SimboloBurofast tamano={30} />
        <span>
          <span className="marca-nombre">BUROFAST</span>
          <span className="marca-lema">Centro de mando</span>
        </span>
      </Link>
      <nav aria-label="Módulos">
        {MODULOS.map((m) => (
          <Link key={m.href} href={m.href} className="cristal" aria-current={(m.href === "/mando" ? ruta === m.href : ruta.startsWith(m.href)) ? "page" : undefined}>
            <Icono nombre={m.icono} tamano={18} /> {m.texto}
          </Link>
        ))}
      </nav>
      <div className="lateral-pie">
        <Link className="chip-cristal" href="/es">Ver la superapp</Link>
        <button type="button" className="chip-cristal" onClick={salir}>
          <Icono nombre="salir" tamano={16} /> Salir
        </button>
      </div>
    </aside>
  );
}
