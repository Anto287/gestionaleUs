/** Conteggio sempre visibile; l'elenco completo si apre soltanto su richiesta. */
export function ElencoCompatto({ titolo, voci }: { titolo: string; voci: string[] }) {
  if (!voci.length) return null
  return <details className="elenco-compatto"><summary><span>{titolo}</span><b>{voci.length}</b><span className="elenco-invito"><span className="elenco-mostra">Mostra elenco</span><span className="elenco-nascondi">Nascondi</span></span></summary><ul>{voci.map((v, i) => <li key={i}>{v}</li>)}</ul></details>
}
