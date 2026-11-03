import { Tooltip } from 'recharts'
import { useEffect, useRef, useState, type ReactNode } from 'react'

export interface DatoGrafico { label: string; valori: Array<{ nome: string; valore: string }> }
/** Il dettaglio occupa sempre lo stesso spazio, anche con nomi lunghi. */
export function GraficoInterattivo({ titolo, descrizione, riepilogo, dati, minWidth = 260, altezza = 260, legenda = [], iniziaDallaFine = false, children }: {
  iniziaDallaFine?: boolean; titolo: string; descrizione: string; riepilogo: string; dati: DatoGrafico[]; minWidth?: number; altezza?: number;
  legenda?: Array<{ nome: string; colore: string }>;
  children: (seleziona: (state: { activeTooltipIndex?: unknown }) => void) => ReactNode;
}) {
  const scrollRef = useRef<HTMLDivElement>(null)
  useEffect(() => { if (iniziaDallaFine && scrollRef.current) scrollRef.current.scrollLeft = scrollRef.current.scrollWidth }, [iniziaDallaFine, dati.length, minWidth])
  const [scelto, setScelto] = useState<number | null>(null)
  if (!dati.length) return <p>Nessun dato nel periodo selezionato.</p>
  const index = Math.min(scelto ?? dati.length - 1, dati.length - 1), punto = dati[index]
  function seleziona(state: { activeTooltipIndex?: unknown }) {
    if (state.activeTooltipIndex == null) return
    const n = Number(state.activeTooltipIndex)
    if (Number.isInteger(n) && n >= 0 && n < dati.length) setScelto(n)
  }
  return <section className="grafico-interattivo" aria-label={titolo}>
    <p className="grafico-spiegazione">{descrizione}</p>
    <p className="grafico-riepilogo">{riepilogo}</p>
    {legenda.length > 0 && <ul className="grafico-legenda">{legenda.map((v) => <li key={v.nome}><i style={{ background: v.colore }} aria-hidden />{v.nome}</li>)}</ul>}
    <div ref={scrollRef} className="grafico-scroll" tabIndex={0} role="region" aria-label={`Disegno: ${titolo}. Scorri orizzontalmente se necessario.`}><div className="grafico-tela" style={{ minWidth, height: altezza }}>{children(seleziona)}</div></div>
    <p className="grafico-istruzione">Tocca una barra o scegli un dato per leggerne i dettagli. Il disegno scorre orizzontalmente quando necessario.</p>
    <div className="grafico-dettaglio">
      <label><span>Dettaglio</span><select aria-label={`Dato del grafico: ${titolo}`} value={index} onChange={(e) => setScelto(Number(e.target.value))}>{dati.map((d, i) => <option value={i} key={i}>{d.label}</option>)}</select></label>
      <div className="grafico-valori" tabIndex={0} role="region" aria-label={`Valori: ${titolo}`}><strong>{punto.label}</strong><dl>{punto.valori.map((v) => <div key={v.nome}><dt>{v.nome}</dt><dd>{v.valore}</dd></div>)}</dl></div>
    </div>
    <details className="grafico-tabella"><summary>Vedi tutti i dati in tabella ({dati.length})</summary><div className="grafico-tabella-scroll"><table><caption>{titolo}</caption><thead><tr><th scope="col">Dato</th>{punto.valori.map((v) => <th scope="col" key={v.nome}>{v.nome}</th>)}</tr></thead><tbody>{dati.map((d, i) => <tr key={i}><th scope="row">{d.label}</th>{d.valori.map((v) => <td key={v.nome}>{v.valore}</td>)}</tr>)}</tbody></table></div></details>
  </section>
}

/** Mantiene la selezione nativa di Recharts, senza disegnare un tooltip mobile. */
export function InterazioneGrafico() {
  return <Tooltip trigger="click" active={false} cursor={false} content={() => null} wrapperStyle={{ display: 'none' }} isAnimationActive={false} />
}
