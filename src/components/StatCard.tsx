import type { KeyboardEvent, ReactNode } from 'react'
import { Card, Statistic } from 'antd'
import { RightOutlined } from '@ant-design/icons'

/**
 * Tessera statistica (icona in filigrana oro + numero). Con `onApri` diventa
 * un bottone: si apre col tocco/click e da tastiera (Invio o Spazio), e nel
 * titolo compare una freccina che segnala che c'è un dettaglio da vedere.
 */
export function StatCard({
  icona,
  titolo,
  valore,
  colore,
  sotto,
  onApri,
  apriLabel,
}: {
  icona: ReactNode
  titolo: string
  valore: string | number
  /** colore del numero (es. rosso se il saldo è negativo) */
  colore?: string
  /** riga secondaria sotto il numero (es. "3 su 10 sedute") */
  sotto?: ReactNode
  /** se presente, la card è cliccabile e apre il dettaglio */
  onApri?: () => void
  /** cosa succede aprendo, per screen reader: es. "vedi gli ultimi movimenti" */
  apriLabel?: string
}) {
  function daTastiera(e: KeyboardEvent<HTMLDivElement>) {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault()
      onApri?.()
    }
  }
  return (
    <Card
      className={onApri ? 'stat-card stat-card-azione' : 'stat-card'}
      onClick={onApri}
      onKeyDown={onApri ? daTastiera : undefined}
      role={onApri ? 'button' : undefined}
      tabIndex={onApri ? 0 : undefined}
      aria-label={onApri ? `${titolo}: ${apriLabel ?? 'vedi il dettaglio'}` : undefined}
    >
      <span className="stat-icon" aria-hidden>
        {icona}
      </span>
      <div className="stat-corpo">
        <Statistic
          title={
            onApri ? (
              <>
                {titolo} <RightOutlined className="stat-freccia" aria-hidden />
              </>
            ) : (
              titolo
            )
          }
          value={valore}
          valueStyle={colore ? { color: colore } : undefined}
        />
        {sotto && <div className="stat-sotto">{sotto}</div>}
      </div>
    </Card>
  )
}
