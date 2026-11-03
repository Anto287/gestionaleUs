import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ReferenceLine,
  ResponsiveContainer,
  XAxis,
  YAxis,
} from 'recharts'
import { GraficoInterattivo, InterazioneGrafico } from '../../components/GraficoInterattivo'
import { formatEuro } from '../../lib/format'
import { COLORI } from '../../lib/chart'

export interface MeseBilancio {
  mese: string
  entrate: number
  uscite: number
  movimenti?: number
  daIncassare?: number
  daPagare?: number
}

export type TipoBilancio = 'barre' | 'saldo'

const H = 260

/** Numero compatto per l'asse: 1.234 → "1,2k". */
function asseEuro(v: number): string {
  const a = Math.abs(v)
  if (a >= 1000) return `${(v / 1000).toLocaleString('it-IT', { maximumFractionDigits: 1 })}k`
  return String(Math.round(v))
}

/**
 * Bilancio mensile (Recharts), due viste: barre raggruppate Entrate/Uscite
 * (confronto) oppure saldo del mese (entrate − uscite) come barre divergenti
 * dallo zero, verde se attivo e rosso se passivo. Con molti mesi mantiene una
 * larghezza minima per mese e scorre in orizzontale.
 */
export function BilancioMensile({ dati, tipo = 'barre' }: { dati: MeseBilancio[]; tipo?: TipoBilancio }) {
  if (dati.length === 0) {
    return <div style={{ color: COLORI.testo, padding: '2rem 0', textAlign: 'center' }}>Nessun movimento</div>
  }

  const datiSaldo = dati.map((d) => ({ mese: d.mese, saldo: d.entrate - d.uscite }))
  const perMese = tipo === 'saldo' ? 56 : 72
  const minWidth = Math.max(260, dati.length * perMese)

  const assi = (
    <>
      <InterazioneGrafico />
      <CartesianGrid vertical={false} stroke={COLORI.griglia} />
      <XAxis dataKey="mese" tickLine={false} axisLine={{ stroke: COLORI.griglia }} tick={{ fontSize: 11, fill: COLORI.testo }} />
      <YAxis
        width={44}
        tickFormatter={asseEuro}
        tickLine={false}
        axisLine={false}
        tick={{ fontSize: 10, fill: COLORI.testo }}
      />
    </>
  )

  return (
    <GraficoInterattivo iniziaDallaFine titolo="Bilancio mensile" descrizione="Entrate e uscite registrate, incluse quelle ancora da saldare. Il saldo del mese è entrate meno uscite, non il saldo di cassa. Importi in euro; k indica migliaia."
      riepilogo={`${dati.length} mesi · Entrate ${formatEuro(dati.reduce((s, d) => s + d.entrate, 0))} · Uscite ${formatEuro(dati.reduce((s, d) => s + d.uscite, 0))}`}
      legenda={tipo === 'saldo' ? [{ nome: 'Saldo positivo', colore: COLORI.verde }, { nome: 'Saldo negativo', colore: COLORI.rosso }] : [{ nome: 'Entrate', colore: COLORI.verde }, { nome: 'Uscite', colore: COLORI.rosso }]}
      dati={dati.map((d) => ({ label: d.mese, valori: [{ nome: 'Entrate', valore: formatEuro(d.entrate) }, { nome: 'Uscite', valore: formatEuro(d.uscite) }, { nome: 'Saldo del mese', valore: formatEuro(d.entrate - d.uscite) }, { nome: 'Movimenti', valore: String(d.movimenti ?? '—') }, { nome: 'Da incassare', valore: formatEuro(d.daIncassare ?? 0) }, { nome: 'Da pagare', valore: formatEuro(d.daPagare ?? 0) }] }))}
      minWidth={minWidth} altezza={H}>
      {(seleziona) => <ResponsiveContainer width="100%" height="100%">
          {tipo === 'saldo' ? (
            <BarChart onClick={seleziona} data={datiSaldo} margin={{ top: 16, right: 16, bottom: 4, left: 0 }}>
              {assi}
              <ReferenceLine y={0} stroke={COLORI.asse} strokeWidth={1.5} />
              <Bar isAnimationActive={false} dataKey="saldo" name="Saldo" radius={[4, 4, 0, 0]} maxBarSize={48}>
                {datiSaldo.map((d, i) => (
                  <Cell key={i} fill={d.saldo >= 0 ? COLORI.verde : COLORI.rosso} />
                ))}
              </Bar>
            </BarChart>
          ) : (
            <BarChart onClick={seleziona} data={dati} margin={{ top: 16, right: 16, bottom: 4, left: 0 }}>
              {assi}
              <Bar isAnimationActive={false} dataKey="entrate" name="Entrate" fill={COLORI.verde} radius={[4, 4, 0, 0]} maxBarSize={28} />
              <Bar isAnimationActive={false} dataKey="uscite" name="Uscite" fill={COLORI.rosso} radius={[4, 4, 0, 0]} maxBarSize={28} />
            </BarChart>
          )}
        </ResponsiveContainer>}
    </GraficoInterattivo>
  )
}
