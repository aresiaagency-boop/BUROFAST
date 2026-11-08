import { EstadoBadge } from "@/components/mando/piezas";

export function Superior({ titulo, miga, estadoGlobal }: { titulo: string; miga: string; estadoGlobal: { tono: "ok" | "aviso" | "critico" | "desconocido"; texto: string } }) {
  return (
    <header className="superior">
      <div>
        <div className="miga">{miga}</div>
        <h1>{titulo}</h1>
      </div>
      <EstadoBadge tono={estadoGlobal.tono} texto={estadoGlobal.texto} />
    </header>
  );
}
