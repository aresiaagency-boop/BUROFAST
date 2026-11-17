"use client";

import { R0, RadarExtranjeria } from "@/components/holo/RadarExtranjeria";

// Dirección: solo la sede, en oro y gris, con su cerrojo. Sin datos de nadie
// y en su propio archivo: la página de acceso no carga diccionarios ni el
// almacén de la superapp.
export function RadarAcceso({ etiqueta }: { etiqueta: string }) {
  return (
    <div className="rx-acceso">
      <RadarExtranjeria
        variante="acceso"
        etiqueta={etiqueta}
        barrido={{ periodo: 5, estela: 10 }}
        hilo="ninguno"
        instrumento={({ disco }) => (
          <g className="rx-cerrojo" clipPath={`url(#${disco})`}>
            <circle r={R0 * 0.7} className="rx-cerrojo-anillo" vectorEffect="non-scaling-stroke" />
            <circle r={R0 * 0.48} className="rx-cerrojo-anillo rx-cerrojo-anillo--interior" vectorEffect="non-scaling-stroke" />
          </g>
        )}
      />
    </div>
  );
}
