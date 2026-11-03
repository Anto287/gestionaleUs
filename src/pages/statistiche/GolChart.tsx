import { Bar, BarChart, CartesianGrid, ResponsiveContainer, XAxis, YAxis } from 'recharts'
import { GraficoInterattivo, InterazioneGrafico } from '../../components/GraficoInterattivo'
import { COLORI } from '../../lib/chart'
export interface DatoGol { label: string; data: string; inCasa: boolean; avversario: string; fatti: number; subiti: number }
export function GolChart({ dati }: { dati: DatoGol[] }) {
  return (
        <GraficoInterattivo iniziaDallaFine titolo="Gol per partita" descrizione="Gol segnati e subiti nelle partite giocate della selezione corrente. Tocca una coppia di barre per vedere avversario, risultato ed esito."
          riepilogo={`${dati.length} partite · ${dati.reduce((s, d) => s + d.fatti, 0)} gol fatti · ${dati.reduce((s, d) => s + d.subiti, 0)} gol subiti`}
          legenda={[{ nome: 'Gol fatti', colore: COLORI.verde }, { nome: 'Gol subiti', colore: COLORI.rosso }]}
          dati={dati.map((d) => ({ label: `${d.data} · ${d.avversario}`, valori: [{ nome: 'Campo', valore: d.inCasa ? 'In casa' : 'In trasferta' }, { nome: 'Gol fatti', valore: String(d.fatti) }, { nome: 'Gol subiti', valore: String(d.subiti) }, { nome: 'Esito', valore: d.fatti > d.subiti ? 'Vittoria' : d.fatti === d.subiti ? 'Pareggio' : 'Sconfitta' }, { nome: 'Differenza reti', valore: (d.fatti - d.subiti).toLocaleString('it-IT', { signDisplay: 'always' }) }] }))}
          minWidth={Math.max(260, dati.length * 56)}>
          {(seleziona) => <ResponsiveContainer width="100%" height="100%">
              <BarChart onClick={seleziona} data={dati} margin={{ top: 8, right: 16, bottom: 4, left: 0 }}>
                <InterazioneGrafico />
          <CartesianGrid vertical={false} stroke={COLORI.griglia} />
                <XAxis
                  dataKey="label"
                  tickLine={false}
                  axisLine={{ stroke: COLORI.griglia }}
                  tick={{ fontSize: 11, fill: COLORI.testo }}
                />
                <YAxis
                  allowDecimals={false}
                  width={28}
                  tickLine={false}
                  axisLine={false}
                  tick={{ fontSize: 10, fill: COLORI.testo }}
                />
                <Bar isAnimationActive={false} dataKey="fatti" name="Gol fatti" fill={COLORI.verde} radius={[4, 4, 0, 0]} maxBarSize={22} />
                <Bar isAnimationActive={false} dataKey="subiti" name="Gol subiti" fill={COLORI.rosso} radius={[4, 4, 0, 0]} maxBarSize={22} />
              </BarChart>
            </ResponsiveContainer>}
        </GraficoInterattivo>
  )
}
