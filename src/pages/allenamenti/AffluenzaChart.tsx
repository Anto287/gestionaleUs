import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { COLORI } from '../../lib/chart'

interface Punto {
  label: string
  valore: number
}

export type TipoAffluenza = 'barre' | 'linea'

const H = 260

/**
 * Affluenza per seduta (Recharts). Due viste: barre (magnitudine per seduta) o
 * andamento (area+linea, per il trend). In entrambe: griglia recessiva, asse dei
 * valori, linea della media e tooltip per seduta. Con molte sedute il grafico
 * mantiene una larghezza minima per punto e scorre in orizzontale.
 */
export function AffluenzaChart({
  dati,
  media,
  scala,
  tipo = 'barre',
}: {
  dati: Punto[]
  media: number
  scala: number
  tipo?: TipoAffluenza
}) {
  if (dati.length === 0) {
    return <div style={{ color: COLORI.testo, padding: '2rem 0', textAlign: 'center' }}>Nessuna seduta</div>
  }

  const yMax = Math.max(1, scala, ...dati.map((d) => d.valore))
  const perPunto = tipo === 'linea' ? 46 : 40
  const minWidth = Math.max(320, dati.length * perPunto)

  const assi = (
    <>
      <CartesianGrid vertical={false} stroke={COLORI.griglia} />
      <XAxis dataKey="label" tickLine={false} axisLine={{ stroke: COLORI.griglia }} tick={{ fontSize: 11, fill: COLORI.testo }} />
      <YAxis
        domain={[0, yMax]}
        allowDecimals={false}
        width={28}
        tickLine={false}
        axisLine={false}
        tick={{ fontSize: 10, fill: COLORI.testo }}
      />
      <Tooltip
        formatter={(v) => [`${v} / ${scala}`, 'Presenti']}
        contentStyle={{ borderRadius: 10, border: `1px solid ${COLORI.griglia}`, fontSize: 13 }}
        cursor={{ fill: 'rgba(194,32,38,0.06)' }}
      />
      {media > 0 && (
        <ReferenceLine
          y={media}
          stroke={COLORI.asse}
          strokeDasharray="5 4"
          label={{ value: `media ${media.toFixed(1)}`, position: 'insideTopRight', fill: COLORI.testo, fontSize: 10 }}
        />
      )}
    </>
  )

  return (
    <div style={{ overflowX: 'auto' }}>
      <div style={{ minWidth, height: H }}>
        <ResponsiveContainer width="100%" height="100%">
          {tipo === 'linea' ? (
            <AreaChart data={dati} margin={{ top: 16, right: 16, bottom: 4, left: 0 }}>
              {assi}
              <Area
                type="monotone"
                dataKey="valore"
                stroke={COLORI.rosso}
                strokeWidth={2}
                fill={COLORI.rossoTenue}
                dot={{ r: 3, fill: '#fff', stroke: COLORI.rosso, strokeWidth: 2 }}
                activeDot={{ r: 5 }}
              />
            </AreaChart>
          ) : (
            <BarChart data={dati} margin={{ top: 16, right: 16, bottom: 4, left: 0 }}>
              {assi}
              <Bar dataKey="valore" fill={COLORI.rosso} radius={[4, 4, 0, 0]} maxBarSize={30} />
            </BarChart>
          )}
        </ResponsiveContainer>
      </div>
    </div>
  )
}
