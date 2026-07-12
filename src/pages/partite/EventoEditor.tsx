import { Button, InputNumber, Select, Space, Typography } from 'antd'
import { DeleteOutlined } from '@ant-design/icons'
import type { EventoGol, Giocatore } from '../../types'

/** Attribuisce gol/assist ai giocatori (con quantità). Salva a ogni modifica. */
export function EventoEditor({
  rosa,
  value,
  onChange,
}: {
  rosa: Giocatore[]
  value: EventoGol[]
  onChange: (v: EventoGol[]) => void
}) {
  const nome = (id: string) => {
    const g = rosa.find((x) => x.id === id)
    return g ? `${g.cognome} ${g.nome}` : '—'
  }
  const disponibili = rosa.filter((g) => !value.some((v) => v.giocatoreId === g.id))

  return (
    <Space direction="vertical" style={{ width: '100%' }}>
      {value.map((v) => (
        <div key={v.giocatoreId} style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <span style={{ flex: 1 }}>{nome(v.giocatoreId)}</span>
          <InputNumber
            min={1}
            value={v.quantita}
            onChange={(q) =>
              onChange(
                value.map((x) =>
                  x.giocatoreId === v.giocatoreId ? { ...x, quantita: Math.max(1, q ?? 1) } : x,
                ),
              )
            }
            style={{ width: 72 }}
          />
          <Button
            type="text"
            danger
            icon={<DeleteOutlined />}
            onClick={() => onChange(value.filter((x) => x.giocatoreId !== v.giocatoreId))}
          />
        </div>
      ))}
      {value.length === 0 && <Typography.Text type="secondary">Nessuno</Typography.Text>}
      {disponibili.length > 0 && (
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
    </Space>
  )
}
