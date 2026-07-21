import { useEffect, useRef } from 'react'
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { formatEuro } from '../../lib/format'
import { COLORI } from '../../lib/chart'

export interface MeseBilancio {
  mese: string
  entrate: number
  uscite: number
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
  const scatola = useRef<HTMLDivElement>(null)

  // all'apertura parte scorso in fondo: i mesi più recenti, non i più vecchi
  // (ri-ancorato anche quando cambiano i mesi o la vista, che cambia larghezza)
  useEffect(() => {
    const el = scatola.current
    if (el) el.scrollLeft = el.scrollWidth
  }, [dati.length, tipo])

  if (dati.length === 0) {
    return <div style={{ color: COLORI.testo, padding: '2rem 0', textAlign: 'center' }}>Nessun movimento</div>
  }

  const datiSaldo = dati.map((d) => ({ mese: d.mese, saldo: d.entrate - d.uscite }))
  const perMese = tipo === 'saldo' ? 56 : 72
  const minWidth = Math.max(320, dati.length * perMese)

  const assi = (
    <>
      <CartesianGrid vertical={false} stroke={COLORI.griglia} />
      <XAxis dataKey="mese" tickLine={false} axisLine={{ stroke: COLORI.griglia }} tick={{ fontSize: 11, fill: COLORI.testo }} />
      <YAxis
        width={44}
        tickFormatter={asseEuro}
        tickLine={false}
        axisLine={false}
        tick={{ fontSize: 10, fill: COLORI.testo }}
      />
      <Tooltip
        formatter={(v, name) => [formatEuro(Number(v)), name]}
        contentStyle={{ borderRadius: 10, border: `1px solid ${COLORI.griglia}`, fontSize: 13 }}
        cursor={{ fill: 'rgba(36,29,22,0.04)' }}
      />
    </>
  )

  return (
    <div ref={scatola} style={{ overflowX: 'auto' }}>
      <div style={{ minWidth, height: H }}>
        <ResponsiveContainer width="100%" height="100%">
          {tipo === 'saldo' ? (
            <BarChart data={datiSaldo} margin={{ top: 16, right: 16, bottom: 4, left: 0 }}>
              {assi}
              <ReferenceLine y={0} stroke={COLORI.asse} strokeWidth={1.5} />
              <Bar dataKey="saldo" name="Saldo" radius={[4, 4, 0, 0]} maxBarSize={48}>
                {datiSaldo.map((d, i) => (
                  <Cell key={i} fill={d.saldo >= 0 ? COLORI.verde : COLORI.rosso} />
                ))}
              </Bar>
            </BarChart>
          ) : (
            <BarChart data={dati} margin={{ top: 16, right: 16, bottom: 4, left: 0 }}>
              {assi}
              <Legend verticalAlign="top" align="right" iconType="circle" wrapperStyle={{ fontSize: 12, paddingBottom: 8 }} />
              <Bar dataKey="entrate" name="Entrate" fill={COLORI.verde} radius={[4, 4, 0, 0]} maxBarSize={28} />
              <Bar dataKey="uscite" name="Uscite" fill={COLORI.rosso} radius={[4, 4, 0, 0]} maxBarSize={28} />
            </BarChart>
          )}
        </ResponsiveContainer>
      </div>
    </div>
  )
}
