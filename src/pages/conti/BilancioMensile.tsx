import { Tooltip } from 'antd'
import { formatEuro } from '../../lib/format'
import { COLORI, useLarghezza, tacche, barraArrotondata } from '../../lib/chart'

export interface MeseBilancio {
  mese: string
  entrate: number
  uscite: number
}

export type TipoBilancio = 'barre' | 'saldo'

const H = 240
const M = { top: 16, right: 14, bottom: 24, left: 48 }

/** Numero compatto per l'asse: 1.234 → "1,2k". */
function asseEuro(v: number): string {
  const a = Math.abs(v)
  if (a >= 1000) return `${(v / 1000).toLocaleString('it-IT', { maximumFractionDigits: 1 })}k`
  return String(Math.round(v))
}

function Legenda({ voci }: { voci: { colore: string; label: string }[] }) {
  return (
    <div style={{ display: 'flex', gap: 16, justifyContent: 'flex-end', marginBottom: 10, fontSize: 12 }}>
      {voci.map((v) => (
        <span key={v.label}>
          <i style={{ display: 'inline-block', width: 10, height: 10, background: v.colore, borderRadius: 2, marginRight: 5 }} />
          {v.label}
        </span>
      ))}
    </div>
  )
}

/**
 * Bilancio mensile, due viste: barre raggruppate Entrate/Uscite (confronto)
 * oppure saldo del mese (entrate − uscite) come barre divergenti dallo zero,
 * verde se attivo e rosso se passivo. Griglia recessiva, asse in € e tooltip.
 */
export function BilancioMensile({ dati, tipo = 'barre' }: { dati: MeseBilancio[]; tipo?: TipoBilancio }) {
  const [ref, w] = useLarghezza<HTMLDivElement>()

  if (dati.length === 0) {
    return <div style={{ color: COLORI.testo, padding: '2rem 0', textAlign: 'center' }}>Nessun movimento</div>
  }

  const n = dati.length
  const saldi = dati.map((d) => d.entrate - d.uscite)

  const yMax = tipo === 'saldo' ? Math.max(0, ...saldi) : Math.max(1, ...dati.flatMap((d) => [d.entrate, d.uscite]))
  const yMin = tipo === 'saldo' ? Math.min(0, ...saldi) : 0
  const span = Math.max(1, yMax - yMin)

  const plotW = Math.max(0, w - M.left - M.right)
  const plotH = H - M.top - M.bottom
  const y = (v: number) => M.top + plotH * (1 - (v - yMin) / span)

  // tacche: per il saldo includono lo zero e i valori negativi
  const ticks =
    tipo === 'saldo'
      ? (() => {
          const base = tacche(Math.max(yMax, -yMin, 1))
          const passo = base.length > 1 ? base[1] - base[0] : Math.max(yMax, -yMin, 1)
          const out: number[] = []
          for (let v = Math.ceil(yMin / passo) * passo; v <= yMax + 1e-9; v += passo) out.push(Math.round(v))
          return out.length ? out : [0]
        })()
      : tacche(yMax)

  const band = n > 0 ? plotW / n : plotW
  const cx = (i: number) => M.left + band * (i + 0.5)

  const gruppoW = Math.min(band * 0.7, 64)
  const barW = (gruppoW - 2) / 2 // 2px di stacco fra le due barre

  return (
    <div>
      <Legenda
        voci={
          tipo === 'saldo'
            ? [
                { colore: COLORI.verde, label: 'Mese in attivo' },
                { colore: COLORI.rosso, label: 'Mese in passivo' },
              ]
            : [
                { colore: COLORI.verde, label: 'Entrate' },
                { colore: COLORI.rosso, label: 'Uscite' },
              ]
        }
      />
      <div ref={ref} style={{ width: '100%' }}>
        {w > 0 && (
          <svg width={w} height={H} role="img" aria-label="Bilancio mensile">
            {/* griglia + asse in € */}
            {ticks.map((t) => (
              <g key={t}>
                <line
                  x1={M.left}
                  y1={y(t)}
                  x2={M.left + plotW}
                  y2={y(t)}
                  stroke={t === 0 && tipo === 'saldo' ? COLORI.asse : COLORI.griglia}
                  strokeWidth={t === 0 && tipo === 'saldo' ? 1.5 : 1}
                />
                <text x={M.left - 6} y={y(t)} textAnchor="end" dominantBaseline="middle" fontSize={10} fill={COLORI.testo}>
                  {asseEuro(t)}
                </text>
              </g>
            ))}

            {tipo === 'barre'
              ? dati.map((d, i) => {
                  const xE = cx(i) - gruppoW / 2
                  const xU = xE + barW + 2
                  const hE = Math.max(d.entrate > 0 ? 2 : 0, y(0) - y(d.entrate))
                  const hU = Math.max(d.uscite > 0 ? 2 : 0, y(0) - y(d.uscite))
                  return (
                    <g key={i}>
                      {hE > 0 && <path d={barraArrotondata(xE, y(0) - hE, barW, hE, 4)} fill={COLORI.verde} />}
                      {hU > 0 && <path d={barraArrotondata(xU, y(0) - hU, barW, hU, 4)} fill={COLORI.rosso} />}
                    </g>
                  )
                })
              : dati.map((_, i) => {
                  const s = saldi[i]
                  const yv = y(s)
                  const y0 = y(0)
                  const top = Math.min(yv, y0)
                  const h = Math.max(2, Math.abs(y0 - yv))
                  return (
                    <rect
                      key={i}
                      x={cx(i) - gruppoW / 2}
                      y={top}
                      width={gruppoW}
                      height={h}
                      rx={3}
                      fill={s >= 0 ? COLORI.verde : COLORI.rosso}
                    />
                  )
                })}

            {/* etichette mesi */}
            {dati.map((d, i) => (
              <text key={i} x={cx(i)} y={H - M.bottom + 15} textAnchor="middle" fontSize={11} fill={COLORI.testo}>
                {d.mese}
              </text>
            ))}

            {/* aree di hover (una per mese) */}
            {dati.map((d, i) => (
              <Tooltip
                key={i}
                title={
                  tipo === 'saldo'
                    ? `${d.mese} · saldo ${formatEuro(saldi[i])}`
                    : `${d.mese} · Entrate ${formatEuro(d.entrate)} · Uscite ${formatEuro(d.uscite)}`
                }
              >
                <rect x={M.left + band * i} y={M.top} width={band} height={plotH} fill="transparent" style={{ pointerEvents: 'all' }} />
              </Tooltip>
            ))}
          </svg>
        )}
      </div>
    </div>
  )
}
