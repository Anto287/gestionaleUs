import { Tooltip } from 'antd'
import { formatEuro } from '../../lib/format'

export interface MeseBilancio {
  mese: string
  entrate: number
  uscite: number
}

const VERDE = '#3f7a52'
const ROSSO = '#c22026'

/** Bilancio mensile: barre raggruppate Entrate/Uscite per mese. */
export function BilancioMensile({ dati }: { dati: MeseBilancio[] }) {
  const h = 200
  const max = Math.max(1, ...dati.flatMap((d) => [d.entrate, d.uscite]))

  if (dati.length === 0) {
    return <div style={{ color: '#9a948a', padding: '2rem 0', textAlign: 'center' }}>Nessun movimento</div>
  }

  return (
    <div>
      <div style={{ display: 'flex', gap: 16, justifyContent: 'flex-end', marginBottom: 10, fontSize: 12 }}>
        <span>
          <i style={{ display: 'inline-block', width: 10, height: 10, background: VERDE, borderRadius: 2, marginRight: 5 }} />
          Entrate
        </span>
        <span>
          <i style={{ display: 'inline-block', width: 10, height: 10, background: ROSSO, borderRadius: 2, marginRight: 5 }} />
          Uscite
        </span>
      </div>
      <div style={{ display: 'flex', alignItems: 'flex-end', gap: 14, height: h }}>
        {dati.map((d, i) => (
          <div key={i} style={{ flex: '1 1 0', height: '100%', display: 'flex', gap: 4, alignItems: 'flex-end' }}>
            <Tooltip title={`Entrate: ${formatEuro(d.entrate)}`}>
              <div
                style={{
                  flex: 1,
                  height: `${(d.entrate / max) * 100}%`,
                  minHeight: d.entrate > 0 ? 3 : 0,
                  background: VERDE,
                  borderRadius: '4px 4px 0 0',
                }}
              />
            </Tooltip>
            <Tooltip title={`Uscite: ${formatEuro(d.uscite)}`}>
              <div
                style={{
                  flex: 1,
                  height: `${(d.uscite / max) * 100}%`,
                  minHeight: d.uscite > 0 ? 3 : 0,
                  background: ROSSO,
                  borderRadius: '4px 4px 0 0',
                }}
              />
            </Tooltip>
          </div>
        ))}
      </div>
      <div style={{ display: 'flex', gap: 14, marginTop: 6 }}>
        {dati.map((d, i) => (
          <div key={i} style={{ flex: '1 1 0', textAlign: 'center', fontSize: 11, color: '#9a948a' }}>
            {d.mese}
          </div>
        ))}
      </div>
    </div>
  )
}
