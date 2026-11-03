import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  ReferenceLine,
  ResponsiveContainer,
  XAxis,
  YAxis,
} from 'recharts'
import { GraficoInterattivo } from '../../components/GraficoInterattivo'
import { COLORI } from '../../lib/chart'

interface Punto {
  label: string
  data?: string
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
  const minWidth = Math.max(260, dati.length * perPunto)

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
    <GraficoInterattivo iniziaDallaFine titolo="Presenze agli allenamenti" descrizione="Presenti per seduta. La linea tratteggiata indica la media del periodo; il confronto usa i giocatori della rosa attuale."
      riepilogo={`${dati.length} sedute · Media ${media.toLocaleString('it-IT', { maximumFractionDigits: 1 })} presenti su ${scala} · Massimo ${Math.max(...dati.map((d) => d.valore))}`}
      dati={dati.map((d) => ({ label: d.data || d.label, valori: [{ nome: 'Presenti', valore: `${d.valore} / ${scala}` }, { nome: 'Partecipazione', valore: scala ? `${Math.round(d.valore / scala * 100)}%` : '—' }, { nome: 'Assenti', valore: String(Math.max(0, scala - d.valore)) }, { nome: 'Scarto dalla media', valore: (d.valore - media).toLocaleString('it-IT', { maximumFractionDigits: 1, signDisplay: 'always' }) }] }))}
      minWidth={minWidth} altezza={H}>
      {(seleziona) => <ResponsiveContainer width="100%" height="100%">
          {tipo === 'linea' ? (
            <AreaChart onClick={seleziona} data={dati} margin={{ top: 16, right: 16, bottom: 4, left: 0 }}>
              {assi}
              <Area isAnimationActive={false}
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
            <BarChart onClick={seleziona} data={dati} margin={{ top: 16, right: 16, bottom: 4, left: 0 }}>
              {assi}
              <Bar isAnimationActive={false} dataKey="valore" fill={COLORI.rosso} radius={[4, 4, 0, 0]} maxBarSize={30} />
            </BarChart>
          )}
        </ResponsiveContainer>}
    </GraficoInterattivo>
  )
}
