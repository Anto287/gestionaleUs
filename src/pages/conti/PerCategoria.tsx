import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { COLORI } from '../../lib/chart'
import { formatEuro } from '../../lib/format'

export interface VoceCategoria {
  categoria: string
  importo: number
}

/**
 * Dove vanno (o da dove arrivano) i soldi: barre orizzontali per categoria,
 * ordinate dalla più pesante. Una serie sola per vista, quindi una tinta sola:
 * verde per le entrate, rosso per le uscite (come nel resto dell'app).
 */
export function PerCategoria({ dati, tipo }: { dati: VoceCategoria[]; tipo: 'entrata' | 'uscita' }) {
  const colore = tipo === 'entrata' ? COLORI.verde : COLORI.rosso
  const altezza = Math.max(140, dati.length * 34 + 40)

  return (
    <div style={{ width: '100%', height: altezza }}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={dati} layout="vertical" margin={{ top: 4, right: 24, bottom: 0, left: 8 }}>
          <CartesianGrid horizontal={false} stroke={COLORI.griglia} />
          <XAxis
            type="number"
            tickLine={false}
            axisLine={{ stroke: COLORI.griglia }}
            tick={{ fontSize: 10.5, fill: COLORI.testo }}
            tickFormatter={(v: number) => (v >= 1000 ? `${Math.round(v / 100) / 10}k` : String(v))}
          />
          <YAxis
            type="category"
            dataKey="categoria"
            width={120}
            tickLine={false}
            axisLine={false}
            tick={{ fontSize: 11.5, fill: COLORI.testo }}
          />
          <Tooltip
            formatter={(v) => [formatEuro(Number(v)), tipo === 'entrata' ? 'Entrate' : 'Uscite']}
            contentStyle={{ borderRadius: 10, border: `1px solid ${COLORI.griglia}`, fontSize: 13 }}
            cursor={{ fill: 'rgba(194,32,38,0.06)' }}
          />
          <Bar dataKey="importo" fill={colore} radius={[0, 4, 4, 0]} maxBarSize={18} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}
