import { Tooltip } from 'antd'
import { COLORI, useLarghezza, tacche, barraArrotondata } from '../../lib/chart'

interface Punto {
  label: string
  valore: number
}

export type TipoAffluenza = 'barre' | 'linea'

const H = 240
const M = { top: 16, right: 14, bottom: 24, left: 30 }

/**
 * Affluenza per seduta. Due viste: barre (magnitudine per seduta) o andamento
 * (linea+area, per leggere il trend). In entrambe: griglia recessiva, asse dei
 * valori, linea della media e tooltip per seduta.
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
  const [ref, w] = useLarghezza<HTMLDivElement>()

  if (dati.length === 0) {
    return <div style={{ color: COLORI.testo, padding: '2rem 0', textAlign: 'center' }}>Nessuna seduta</div>
  }

  const n = dati.length
  const yMax = Math.max(1, scala, ...dati.map((d) => d.valore))
  const ticks = tacche(yMax)
  const plotW = Math.max(0, w - M.left - M.right)
  const plotH = H - M.top - M.bottom
  const base = M.top + plotH

  const y = (v: number) => M.top + plotH * (1 - v / yMax)
  const band = n > 0 ? plotW / n : plotW
  const cx = (i: number) => M.left + band * (i + 0.5)

  const passo = Math.max(1, Math.ceil(n / Math.max(4, Math.floor(plotW / 40))))

  const punti = dati.map((d, i) => ({ x: cx(i), y: y(d.valore), d }))
  const linea = punti.map((p, i) => `${i ? 'L' : 'M'}${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ')
  const area =
    punti.length > 0
      ? `M${punti[0].x.toFixed(1)},${base} ` +
        punti.map((p) => `L${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ') +
        ` L${punti[n - 1].x.toFixed(1)},${base} Z`
      : ''

  const barW = Math.min(band * 0.62, 26)

  return (
    <div ref={ref} style={{ width: '100%' }}>
      {w > 0 && (
        <svg width={w} height={H} role="img" aria-label="Affluenza per seduta">
          {/* griglia + asse dei valori */}
          {ticks.map((t) => (
            <g key={t}>
              <line x1={M.left} y1={y(t)} x2={M.left + plotW} y2={y(t)} stroke={COLORI.griglia} strokeWidth={1} />
              <text x={M.left - 6} y={y(t)} textAnchor="end" dominantBaseline="middle" fontSize={10} fill={COLORI.testo}>
                {t}
              </text>
            </g>
          ))}

          {tipo === 'linea' && punti.length > 0 && (
            <>
              <path d={area} fill={COLORI.rossoTenue} />
              <path d={linea} fill="none" stroke={COLORI.rosso} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
              {punti.map((p, i) => (
                <circle key={i} cx={p.x} cy={p.y} r={4} fill="#fff" stroke={COLORI.rosso} strokeWidth={2} />
              ))}
            </>
          )}

          {tipo === 'barre' &&
            dati.map((d, i) => {
              const h = Math.max(d.valore > 0 ? 2 : 0, base - y(d.valore))
              if (h <= 0) return null
              return <path key={i} d={barraArrotondata(cx(i) - barW / 2, base - h, barW, h, 4)} fill={COLORI.rosso} />
            })}

          {/* linea della media */}
          {media > 0 && media <= yMax && (
            <>
              <line
                x1={M.left}
                y1={y(media)}
                x2={M.left + plotW}
                y2={y(media)}
                stroke={COLORI.asse}
                strokeWidth={1.5}
                strokeDasharray="5 4"
              />
              <text
                x={M.left + plotW}
                y={y(media) - 4}
                textAnchor="end"
                fontSize={10}
                fill={COLORI.testo}
                style={{ paintOrder: 'stroke', stroke: '#fff', strokeWidth: 3 }}
              >
                media {media.toFixed(1)}
              </text>
            </>
          )}

          {/* etichette date */}
          {dati.map((d, i) =>
            i % passo === 0 || i === n - 1 ? (
              <text key={i} x={cx(i)} y={base + 15} textAnchor="middle" fontSize={10} fill={COLORI.testo}>
                {d.label}
              </text>
            ) : null,
          )}

          {/* aree di hover (una per seduta) */}
          {dati.map((d, i) => (
            <Tooltip key={i} title={`${d.label}: ${d.valore} presenti`}>
              <rect x={M.left + band * i} y={M.top} width={band} height={plotH} fill="transparent" style={{ pointerEvents: 'all' }} />
            </Tooltip>
          ))}
        </svg>
      )}
    </div>
  )
}
