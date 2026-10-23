/** Le risposte JSON identiche mantengono i riferimenti usati dalle viste e dalle cache. */
export function riusaLista<T>(attuali: T[] | undefined, nuovi: T[]): T[] {
  if (
    attuali &&
    (attuali === nuovi || JSON.stringify(attuali) === JSON.stringify(nuovi))
  ) {
    return attuali
  }
  return nuovi
}
