import { Button, InputNumber, Select, Space, Typography } from 'antd'
import { DeleteOutlined } from '@ant-design/icons'
import { isGiocatore } from '../../lib/categoria'
import type { EventoGol, Giocatore } from '../../types'

/**
 * Attribuisce gol/assist ai giocatori (con quantità). Salva a ogni modifica.
 * Con `max` (i gol fatti della partita) la somma non può superarlo: le
 * quantità si fermano al tetto e, raggiunto il totale, non si aggiungono
 * altri giocatori. Dati vecchi oltre il tetto vengono segnalati in rosso.
 */
export function EventoEditor({
  rosa,
  value,
  onChange,
  max,
}: {
  rosa: Giocatore[]
  value: EventoGol[]
  onChange: (v: EventoGol[]) => void
  max?: number
}) {
  const nome = (id: string) => {
    const g = rosa.find((x) => x.id === id)
    return g ? `${g.cognome} ${g.nome}` : '—'
  }
  const disponibili = rosa.filter(
    (g) => isGiocatore(g) && !value.some((v) => v.giocatoreId === g.id),
  )
  const somma = value.reduce((tot, v) => tot + v.quantita, 0)
  const restanti = max === undefined ? Infinity : max - somma

  return (
    <Space direction="vertical" style={{ width: '100%' }}>
      {value.map((v) => {
        // ogni riga può salire solo dei gol non ancora attribuiti agli altri
        const maxRiga = max === undefined ? undefined : v.quantita + Math.max(0, restanti)
        return (
          <div key={v.giocatoreId} style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <span style={{ flex: 1 }}>{nome(v.giocatoreId)}</span>
            <InputNumber
              min={1}
              max={maxRiga}
              value={v.quantita}
              onChange={(q) => {
                let quantita = Math.max(1, q ?? 1)
                if (maxRiga !== undefined) quantita = Math.min(maxRiga, quantita)
                onChange(
                  value.map((x) => (x.giocatoreId === v.giocatoreId ? { ...x, quantita } : x)),
                )
              }}
              style={{ width: 72 }}
            />
            <Button
              type="text"
              danger
              icon={<DeleteOutlined />}
              onClick={() => onChange(value.filter((x) => x.giocatoreId !== v.giocatoreId))}
            />
          </div>
        )
      })}
      {value.length === 0 && <Typography.Text type="secondary">Nessuno</Typography.Text>}
      {max !== undefined && somma > max && (
        <Typography.Text type="danger" style={{ fontSize: 12.5 }}>
          In totale fanno {somma}, ma i gol fatti sono {max}: togli quelli di troppo.
        </Typography.Text>
      )}
      {disponibili.length > 0 && restanti > 0 && (
        <Select<string>
          showSearch
          optionFilterProp="label"
          placeholder="Aggiungi giocatore"
          value={undefined}
          style={{ width: '100%' }}
          options={disponibili.map((g) => ({ value: g.id, label: `${g.cognome} ${g.nome}` }))}
          onChange={(id) => onChange([...value, { giocatoreId: id, quantita: 1 }])}
        />
      )}
      {max !== undefined && max > 0 && somma === max && (
        <Typography.Text type="secondary" style={{ fontSize: 12.5 }}>
          Raggiunto il totale dei gol fatti ({max}).
        </Typography.Text>
      )}
    </Space>
  )
}
