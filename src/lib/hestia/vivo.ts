// La superapp está «viva»: cada acción del sistema se refleja en el núcleo de
// HESTIA. Cualquier componente emite un estado y todos los núcleos visibles
// reaccionan, sin acoplarse entre sí.

export const ESTADOS_NUCLEO = ["reposo", "escuchando", "pensando", "hablando", "exito", "alerta", "desconectada"] as const;
export type EstadoNucleo = (typeof ESTADOS_NUCLEO)[number];

export const EVENTO_HESTIA = "burofast:hestia";

export function emitirHestia(estado: EstadoNucleo) {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent<EstadoNucleo>(EVENTO_HESTIA, { detail: estado }));
}

// Estados que duran un instante y vuelven solos al reposo.
export const ESTADOS_PASAJEROS: Partial<Record<EstadoNucleo, number>> = {
  exito: 2600,
  hablando: 2200,
  alerta: 4200,
};

// Cualquier motor puede pasarle una pregunta a HESTIA: la consola se abre y
// la envía en nombre del usuario.
export const EVENTO_PREGUNTAR = "burofast:preguntar";

export function preguntarHestia(texto: string) {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent<string>(EVENTO_PREGUNTAR, { detail: texto }));
}
