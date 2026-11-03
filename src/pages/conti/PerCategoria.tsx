import { Bar, BarChart, CartesianGrid, ResponsiveContainer, XAxis, YAxis } from 'recharts'
import { GraficoInterattivo, InterazioneGrafico } from '../../components/GraficoInterattivo'
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
  const altezza = Math.max(140, dati.length * 42 + 40)
  const totale = dati.reduce((s, d) => s + d.importo, 0)

  return (
    <GraficoInterattivo titolo={`Categorie: ${tipo === 'entrata' ? 'entrate' : 'uscite'}`} descrizione="Importi per categoria, inclusi i movimenti da saldare. Le barre sono ordinate dall’importo maggiore; k indica migliaia di euro. Il nome completo è nel dettaglio e nella tabella."
      riepilogo={`Totale ${formatEuro(totale)} · ${dati.length} categorie`}
      dati={dati.map((d) => ({ label: d.categoria, valori: [{ nome: 'Importo', valore: formatEuro(d.importo) }, { nome: 'Quota sul totale', valore: totale ? `${(d.importo / totale * 100).toLocaleString('it-IT', { maximumFractionDigits: 1 })}%` : '—' }] }))}
      minWidth={260} altezza={altezza}>
      {(seleziona) => <ResponsiveContainer width="100%" height="100%">
        <BarChart onClick={seleziona} data={dati} layout="vertical" margin={{ top: 4, right: 24, bottom: 0, left: 8 }}>
          <InterazioneGrafico />
          <CartesianGrid horizontal={false} stroke={COLORI.griglia} />
          <XAxis
            type="number"
            tickLine={false}
            axisLine={{ stroke: COLORI.griglia }}
            tick={{ fontSize: 10.5, fill: COLORI.testo }}
            tickFormatter={(v: number) =>
              // come nel Bilancio mensile: "1,4k" con la virgola
              v >= 1000 ? `${(v / 1000).toLocaleString('it-IT', { maximumFractionDigits: 1 })}k` : String(v)
            }
          />
          <YAxis
            type="category"
            dataKey="categoria"
            width={95}
            tickLine={false}
            axisLine={false}
            tick={{ fontSize: 11.5, fill: COLORI.testo }} tickFormatter={(s: string) => s.length > 14 ? s.slice(0, 13) + '…' : s} interval={0}
          />
          <Bar isAnimationActive={false} dataKey="importo" fill={colore} radius={[0, 4, 4, 0]} maxBarSize={18} />
        </BarChart>
      </ResponsiveContainer>}
    </GraficoInterattivo>
  )
}
