import { Button, Popover, Rate, Tag } from 'antd'
import { RUOLO_BY_CODE, type Area } from '../../ruoli'
import {
  candidatiPerSlot,
  etichettaFit,
  type Formazione,
  type Modulo,
} from '../../lib/formazione'
import type { Giocatore } from '../../types'

const AREA_HEX: Record<Area, string> = {
  Portiere: '#d99a00',
  Difesa: '#2b6cb0',
  Centrocampo: '#3f7a52',
  Attacco: '#c22026',
}

function areaHex(role: string): string {
  const a = RUOLO_BY_CODE[role]?.area
  return a ? AREA_HEX[a] : '#6b6b6b'
}

function cognomeBreve(g?: Giocatore): string {
  if (!g) return ''
  return g.cognome || g.nome || '—'
}

/** Campo verticale con i titolari sui loro slot e gli slot vuoti da assegnare. */
export function Campo({
  modulo,
  formazione,
  byId,
  presenze,
  onRimuovi,
  onAssegna,
}: {
  modulo: Modulo
  formazione: Formazione
  byId: Map<string, Giocatore>
  presenze: Record<string, number>
  onRimuovi: (slot: number) => void
  onAssegna: (slot: number, id: string) => void
}) {
  return (
    <div className="campo">
      <svg className="campo-erba" viewBox="0 0 100 150" preserveAspectRatio="none" aria-hidden>
        <rect x="0" y="0" width="100" height="150" fill="#2f8f4e" />
        {/* fasce d'erba alternate */}
        {[0, 1, 2, 3, 4, 5].map((i) => (
          <rect key={i} x="0" y={i * 25} width="100" height="12.5" fill="#2b8549" opacity="0.55" />
        ))}
        <g stroke="#ffffff" strokeWidth="0.5" fill="none" opacity="0.8">
          <rect x="3" y="3" width="94" height="144" />
          <line x1="3" y1="75" x2="97" y2="75" />
          <circle cx="50" cy="75" r="11" />
          <circle cx="50" cy="75" r="0.8" fill="#fff" />
          {/* area in basso (porta nostra) */}
          <rect x="22" y="123" width="56" height="24" />
          <rect x="37" y="139" width="26" height="8" />
          {/* area in alto */}
          <rect x="22" y="3" width="56" height="24" />
          <rect x="37" y="3" width="26" height="8" />
        </g>
      </svg>

      <div className="campo-slots">
        {modulo.slots.map((s, i) => {
          const a = formazione.titolari[i]
          const left = `${5 + s.x * 90}%`
          const top = `${5 + (1 - s.y) * 90}%`
          const colore = areaHex(s.role)
          const ruoloLabel = RUOLO_BY_CODE[s.role]?.label ?? s.role

          if (!a) {
            const candidati = candidatiPerSlot(s.role, formazione.panchina, byId, presenze)
            return (
              <Popover
                key={i}
                trigger="click"
                title={`Chi gioca ${s.role}?`}
                content={
                  <div className="campo-pop">
                    <div style={{ color: '#75695a', marginBottom: 8, fontSize: 12 }}>{ruoloLabel}</div>
                    {candidati.length === 0 ? (
                      <div style={{ color: '#75695a' }}>Nessuno in panchina per questo ruolo.</div>
                    ) : (
                      <div className="campo-pop-lista">
                        {candidati.map((c) => {
                          const g = byId.get(c.id)
                          const et = etichettaFit(c.fit)
                          return (
                            <Button key={c.id} size="small" block onClick={() => onAssegna(i, c.id)}>
                              <span className="campo-pop-nome">{cognomeBreve(g)}</span>
                              {et && (
                                <Tag color={c.fit === 'emergenza' ? 'red' : 'orange'} style={{ marginInlineStart: 6 }}>
                                  {et}
                                </Tag>
                              )}
                            </Button>
                          )
                        })}
                      </div>
                    )}
                  </div>
                }
              >
                <button className="campo-token campo-token-vuoto" style={{ left, top }} type="button">
                  <span className="token-disc vuoto" style={{ borderColor: colore, color: colore }}>
                    +
                  </span>
                  <span className="token-nome vuoto">{s.role}</span>
                </button>
              </Popover>
            )
          }

          const g = byId.get(a.giocatoreId)
          const et = etichettaFit(a.fit)
          return (
            <Popover
              key={i}
              trigger="click"
              title={g ? `${g.cognome} ${g.nome}` : 'Giocatore'}
              content={
                <div className="campo-pop">
                  <div style={{ marginBottom: 6 }}>
                    <Tag color="default">{s.role}</Tag>
                    <span style={{ color: '#75695a', fontSize: 12 }}>{ruoloLabel}</span>
                  </div>
                  <Rate disabled value={g?.bravura ?? 0} style={{ fontSize: 15 }} />
                  {et && (
                    <div style={{ marginTop: 6, fontSize: 12, color: a.fit === 'emergenza' ? '#b1352f' : '#9a6b1e' }}>
                      Fuori ruolo ({et}) — ruolo naturale {g?.ruoloPreferito ?? '—'}
                    </div>
                  )}
                  <Button size="small" block style={{ marginTop: 10 }} onClick={() => onRimuovi(i)}>
                    Sposta in panchina
                  </Button>
                </div>
              }
            >
              <button className="campo-token" style={{ left, top }} type="button">
                <span className="token-disc" style={{ background: colore }}>
                  {s.role}
                </span>
                <span className="token-nome">{cognomeBreve(g)}</span>
                {et && (
                  <span
                    className="token-adatt"
                    style={{ background: a.fit === 'emergenza' ? '#b1352f' : '#e5a800' }}
                    title={`Adattato (${et})`}
                  />
                )}
              </button>
            </Popover>
          )
        })}
      </div>
    </div>
  )
}
