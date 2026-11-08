import { CITAS, DIAS_GARANTIA_URGENTE, NIVELES_CITA, PRODUCTOS } from "@/lib/catalogo";
import { correlationId, json } from "@/lib/http";

export function GET(request: Request) {
  return json(
    { moneda: "EUR", ivaIncluido: true, tasasOficialesIncluidas: false, productos: PRODUCTOS, nivelesCita: NIVELES_CITA, diasGarantiaUrgente: DIAS_GARANTIA_URGENTE, citas: CITAS },
    { correlation: correlationId(request) },
  );
}
