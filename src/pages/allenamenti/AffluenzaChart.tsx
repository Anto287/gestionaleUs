import { Tooltip } from 'antd'

interface Punto {
  label: string
  valore: number
}

/**
 * Affluenza per seduta: grafico a barre a singola serie (rosso sociale),
 * con linea della media. Barre sottili, estremità arrotondate, hover per barra.
 */
export function AffluenzaChart({
  dati,
  media,
  scala,
}: {
  dati: Punto[]
  media: number
  scala: number
}) {
  const h = 200
  const den = Math.max(1, scala)

  if (dati.length === 0) {
    return <div style={{ color: '#9a948a', padding: '2rem 0', textAlign: 'center' }}>Nessuna seduta</div>
  }

  return (
    <div>
      <div style={{ position: 'relative', height: h }}>
        {/* linea media */}
        {media > 0 && (
          <div
            style={{
              position: 'absolute',
              left: 0,
              right: 0,
              bottom: `${(media / den) * 100}%`,
              borderTop: '2px dashed #b8b1a5',
              pointerEvents: 'none',
              zIndex: 1,
            }}
          >
            <span
              style={{
                position: 'absolute',
                right: 0,
                top: -16,
                fontSize: 11,
                color: '#6f695f',
                background: '#fff',
                padding: '0 4px',
              }}
            >
              media {media.toFixed(1)}
            </span>
          </div>
        )}
        <div style={{ display: 'flex', alignItems: 'flex-end', gap: 6, height: '100%' }}>
          {dati.map((d, i) => (
            <Tooltip key={i} title={`${d.label}: ${d.valore} presenti`}>
              <div
                style={{
                  flex: '1 1 0',
                  minWidth: 10,
                  height: '100%',
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'flex-end',
                }}
              >
                <div
                  style={{
                    height: `${(d.valore / den) * 100}%`,
                    minHeight: d.valore > 0 ? 4 : 0,
                    background: '#c22026',
                    borderRadius: '4px 4px 0 0',
                  }}
                />
              </div>
            </Tooltip>
          ))}
        </div>
      </div>
      <div style={{ display: 'flex', gap: 6, marginTop: 6 }}>
        {dati.map((d, i) => (
          <div
            key={i}
            style={{
              flex: '1 1 0',
              minWidth: 10,
              textAlign: 'center',
              fontSize: 10,
              color: '#9a948a',
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
            }}
          >
            {d.label}
          </div>
        ))}
      </div>
    </div>
  )
}
