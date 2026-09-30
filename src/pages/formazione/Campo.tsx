import { Button, Popover, Rate, Tag } from 'antd'
import { RUOLO_BY_CODE, areaHex } from '../../ruoli'
import {
  candidatiPerSlot,
  etichettaFit,
  type Formazione,
  type Modulo,
} from '../../lib/formazione'
import type { Giocatore } from '../../types'
import { ErbaCampo, posizioneSlot } from '../../components/ErbaCampo'

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
      <ErbaCampo />

      <div className="campo-slots">
        {modulo.slots.map((s, i) => {
          const a = formazione.titolari[i]
          const { left, top } = posizioneSlot(s)
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
                    <div style={{ color: 'var(--testo-2)', marginBottom: 8, fontSize: 12 }}>{ruoloLabel}</div>
                    {candidati.length === 0 ? (
                      <div style={{ color: 'var(--testo-2)' }}>Nessuno in panchina per questo ruolo.</div>
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
                    <span style={{ color: 'var(--testo-2)', fontSize: 12 }}>{ruoloLabel}</span>
                  </div>
                  <Rate disabled value={g?.bravura ?? 0} style={{ fontSize: 15 }} />
                  {et && (
                    <div style={{ marginTop: 6, fontSize: 12, color: a.fit === 'emergenza' ? 'var(--rosso-testo)' : 'var(--ocra)' }}>
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
