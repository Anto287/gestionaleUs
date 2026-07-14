import { useMemo, useState, useEffect } from 'react'
import { Select, InputNumber, Button, List, Card, Row, Col, Space, Checkbox, Radio, App } from 'antd'
import { PlusOutlined, DeleteOutlined } from '@ant-design/icons'
import { isDirigente, isGiocatore } from '../../lib/categoria'
import type { Categoria, Convocato, RigaConvocato } from '../../types'

export type { Convocato } from '../../types'

/** alias locale di tipo, per non confonderlo con il componente Row di antd */
type Row = RigaConvocato

/**
 * Selezione dei convocati per la distinta (dal repo generatore-distinte,
 * adattato ad Ant Design v5 e alla rosa del gestionale).
 * `rows` = righe con almeno Nome/Cognome (e Categoria). `onListChange` riceve la lista.
 * `initialList` = convocati di partenza (quando si riprende una distinta salvata).
 */

const labelKey1 = 'Nome'
const labelKey2 = 'Cognome'
const CHECKBOX_KEYS = ['C', 'VC', 'Allen', 'VAllen', 'DirAcc'] as const
const CHECKBOX_LABELS: Record<string, string> = {
  C: 'C.',
  VC: 'V.C.',
  Allen: 'Allen.',
  VAllen: 'V.Allen.',
  DirAcc: 'Dir. Acc',
}
const SPECIAL_CHECKBOXES = ['Allen', 'VAllen', 'DirAcc']

/** I ruoli di panchina (Allen./V.Allen./Dir. Acc) spettano ai dirigenti; numero, C. e V.C. ai giocatori. */
function ammessoPerRuolo(raw: Row, role: string | null): boolean {
  const cat = { categoria: raw.Categoria as Categoria | undefined }
  return role && SPECIAL_CHECKBOXES.includes(role) ? isDirigente(cat) : isGiocatore(cat)
}

export function SelectorList({
  rows,
  onListChange,
  initialList,
}: {
  rows: Row[]
  onListChange: (list: Convocato[]) => void
  initialList?: Convocato[]
}) {
  const { message } = App.useApp()

  const options = useMemo(
    () =>
      rows.map((r, idx) => ({
        // chiave stabile sull'id del giocatore, così una distinta ripresa
        // ritrova gli stessi convocati anche se la rosa è cambiata
        key: String(r.Id ?? idx),
        label: `${r[labelKey1] || ''} ${r[labelKey2] || ''}`.trim(),
        raw: r,
      })),
    [rows],
  )

  const [selectedKey, setSelectedKey] = useState<string | undefined>(undefined)
  const [amount, setAmount] = useState(1)
  const [selectedCheckbox, setSelectedCheckbox] = useState<string | null>(null)
  const [list, setList] = useState<Convocato[]>(() => initialList ?? [])
  const [filter, setFilter] = useState('')

  const filteredOptions = useMemo(
    () =>
      options
        .filter((o) => !list.find((it) => it.id === o.key))
        .filter((o) => o.label.toLowerCase().includes(filter.toLowerCase())),
    [options, list, filter],
  )

  const selectedRaw = useMemo(
    () => options.find((o) => o.key === selectedKey)?.raw,
    [options, selectedKey],
  )

  // Scelta la persona, il ruolo si adatta: se quello segnato non è compatibile
  // si deseleziona; per un dirigente puro (che in distinta va solo in panchina)
  // si propone il primo ruolo di panchina ancora libero.
  useEffect(() => {
    if (!selectedRaw) return
    setSelectedCheckbox((cur) => {
      if (cur && !ammessoPerRuolo(selectedRaw, cur)) cur = null
      if (cur === null && !ammessoPerRuolo(selectedRaw, null))
        cur = SPECIAL_CHECKBOXES.find((k) => !list.some((it) => it[k])) ?? null
      return cur
    })
  }, [selectedRaw, list])

  useEffect(() => {
    if (filteredOptions.length === 0) setSelectedKey(undefined)
    else if (!filteredOptions.find((o) => o.key === selectedKey))
      setSelectedKey(filteredOptions[0]?.key)
  }, [filteredOptions])

  function hasSpecialCheckbox(item: Convocato) {
    return SPECIAL_CHECKBOXES.some((key) => item[key])
  }

  const lastUsedNumber = useMemo(() => {
    const numberedItems = list.filter((it) => !hasSpecialCheckbox(it))
    if (numberedItems.length === 0) return 0
    return Math.max(...numberedItems.map((it) => it.amount as number))
  }, [list])

  useEffect(() => {
    if (!selectedCheckbox || !SPECIAL_CHECKBOXES.includes(selectedCheckbox)) {
      setAmount(lastUsedNumber + 1)
    }
  }, [lastUsedNumber, selectedCheckbox])

  useEffect(() => {
    onListChange?.(list)
  }, [list, onListChange])

  function isNumberTaken(num: number) {
    return list.some((it) => it.amount === num && !hasSpecialCheckbox(it))
  }
  function isRoleTaken(role: string) {
    return list.some((it) => it[role])
  }

  function addSelected() {
    if (!selectedKey) return message.warning('Seleziona un giocatore dalla lista')
    if (list.length >= 23) return message.error('Hai raggiunto il limite massimo di 23')

    const selectedOption = options.find((o) => o.key === selectedKey)!
    const isSpecial = selectedCheckbox ? SPECIAL_CHECKBOXES.includes(selectedCheckbox) : false

    if (!ammessoPerRuolo(selectedOption.raw, selectedCheckbox))
      return message.error(
        selectedCheckbox
          ? `${CHECKBOX_LABELS[selectedCheckbox]} è riservato ai ${
              SPECIAL_CHECKBOXES.includes(selectedCheckbox) ? 'dirigenti' : 'giocatori'
            }`
          : `${selectedOption.label} è un dirigente: scegli Allen., V.Allen. o Dir. Acc`,
      )
    if (!isSpecial && isNumberTaken(amount)) return message.error(`Il numero ${amount} è già assegnato`)
    if (selectedCheckbox && isRoleTaken(selectedCheckbox))
      return message.error(`Il ruolo ${CHECKBOX_LABELS[selectedCheckbox]} è già assegnato`)

    const newItem: Convocato = {
      id: selectedKey,
      label: selectedOption.label,
      raw: selectedOption.raw,
      amount: isSpecial ? null : amount,
    }
    CHECKBOX_KEYS.forEach((k) => (newItem[k] = false))
    if (selectedCheckbox) newItem[selectedCheckbox] = true

    setList(sortList([...list, newItem]))
    setSelectedCheckbox(null)
    setFilter('')
    message.success('Convocato aggiunto')
  }

  function toggleCheckbox(id: string, key: string, checked: boolean) {
    if (checked && isRoleTaken(key))
      return message.error(`Il ruolo ${CHECKBOX_LABELS[key]} è già assegnato a un'altra persona`)
    const target = list.find((it) => it.id === id)
    if (checked && target && !ammessoPerRuolo(target.raw, key))
      return message.error(
        SPECIAL_CHECKBOXES.includes(key)
          ? `${CHECKBOX_LABELS[key]} è riservato ai dirigenti`
          : `${CHECKBOX_LABELS[key]} è riservato ai giocatori`,
      )

    setList((prev) => {
      const updated = prev.map((it) => ({ ...it }))
      const idx = updated.findIndex((it) => it.id === id)
      if (idx === -1) return prev
      const wasSpecial = hasSpecialCheckbox(updated[idx])
      if (checked) CHECKBOX_KEYS.forEach((k) => (updated[idx][k] = k === key))
      else updated[idx][key] = false
      const isNowSpecial = hasSpecialCheckbox(updated[idx])
      if (wasSpecial && !isNowSpecial) {
        const numbered = updated.filter((it) => !hasSpecialCheckbox(it) && it.id !== id)
        const maxNum = numbered.length ? Math.max(...numbered.map((it) => it.amount as number)) : 0
        updated[idx].amount = maxNum + 1
      }
      if (!wasSpecial && isNowSpecial) updated[idx].amount = null
      return sortList(updated)
    })
  }

  function sortList(items: Convocato[]) {
    return items.sort((a, b) => {
      const aSpecial = hasSpecialCheckbox(a)
      const bSpecial = hasSpecialCheckbox(b)
      if (!aSpecial && !bSpecial) return (a.amount as number) - (b.amount as number)
      if (!aSpecial && bSpecial) return -1
      if (aSpecial && !bSpecial) return 1
      const orderMap: Record<string, number> = { Allen: 1, VAllen: 2, DirAcc: 3 }
      const aOrder = SPECIAL_CHECKBOXES.find((k) => a[k]) || ''
      const bOrder = SPECIAL_CHECKBOXES.find((k) => b[k]) || ''
      return (orderMap[aOrder] || 999) - (orderMap[bOrder] || 999)
    })
  }

  function updateAmount(id: string, newAmount: number) {
    if (newAmount < 1) return
    setList((prev) => {
      const updated = [...prev]
      const idx = updated.findIndex((it) => it.id === id)
      if (idx === -1 || hasSpecialCheckbox(updated[idx])) return prev
      const conflictIdx = updated.findIndex(
        (it) => it.amount === newAmount && !hasSpecialCheckbox(it) && it.id !== id,
      )
      if (conflictIdx !== -1) {
        const oldAmount = updated[idx].amount
        updated[idx].amount = newAmount
        updated[conflictIdx].amount = oldAmount
        message.info(`Scambiato numero ${newAmount} con ${oldAmount}`)
      } else {
        updated[idx].amount = newAmount
      }
      return sortList(updated)
    })
  }

  function removeItem(id: string) {
    setList((prev) => prev.filter((it) => it.id !== id))
  }

  return (
    <div>
      <Card size="small" style={{ marginBottom: 16 }}>
        <Space direction="vertical" size="middle" style={{ width: '100%' }}>
          <Select
            showSearch
            placeholder="Cerca nome / cognome"
            value={selectedKey}
            style={{ width: '100%' }}
            onChange={(v) => setSelectedKey(v)}
            onSearch={(v) => setFilter(v)}
            filterOption={false}
            options={filteredOptions.map((o) => ({ value: o.key, label: o.label }))}
          />
          <Row gutter={[8, 8]} align="middle">
            <Col xs={12} sm={8}>
              <InputNumber
                min={1}
                value={amount}
                onChange={(v) => setAmount(v ?? 1)}
                disabled={!!selectedCheckbox && SPECIAL_CHECKBOXES.includes(selectedCheckbox)}
                placeholder="Numero"
                style={{ width: '100%' }}
              />
            </Col>
            <Col xs={12} sm={16}>
              <Button
                icon={<PlusOutlined />}
                type="primary"
                onClick={addSelected}
                block
                disabled={list.length >= 23}
              >
                Aggiungi {list.length >= 23 ? '(Max 23)' : ''}
              </Button>
            </Col>
          </Row>
          <div>
            <div style={{ marginBottom: 8, fontSize: 12, color: '#666', fontWeight: 500 }}>
              Ruolo (opzionale):
            </div>
            <Radio.Group
              value={selectedCheckbox}
              onChange={(e) => setSelectedCheckbox(e.target.value)}
              buttonStyle="solid"
              size="small"
              style={{ width: '100%' }}
            >
              <Row gutter={[8, 8]}>
                {CHECKBOX_KEYS.map((k) => (
                  <Col xs={12} sm={8} md={4} key={k}>
                    <Radio.Button
                      value={k}
                      style={{ width: '100%', textAlign: 'center' }}
                      disabled={isRoleTaken(k) || (!!selectedRaw && !ammessoPerRuolo(selectedRaw, k))}
                    >
                      {CHECKBOX_LABELS[k]}
                    </Radio.Button>
                  </Col>
                ))}
                {selectedCheckbox && (
                  <Col xs={12} sm={8} md={4}>
                    <Button
                      size="small"
                      onClick={() => setSelectedCheckbox(null)}
                      disabled={!!selectedRaw && !ammessoPerRuolo(selectedRaw, null)}
                      block
                    >
                      Nessuno
                    </Button>
                  </Col>
                )}
              </Row>
            </Radio.Group>
          </div>
        </Space>
      </Card>

      <List
        bordered
        dataSource={list}
        locale={{ emptyText: 'Nessun convocato' }}
        style={{ maxHeight: '50vh', overflowY: 'auto', overflowX: 'hidden' }}
        renderItem={(item) => {
          const isSpecial = hasSpecialCheckbox(item)
          const activeRole = CHECKBOX_KEYS.find((k) => item[k])
          return (
            <List.Item style={{ padding: 12 }}>
              <Space direction="vertical" size="small" style={{ width: '100%' }}>
                <Row gutter={[8, 8]} align="middle">
                  <Col xs={14} sm={16}>
                    <div style={{ fontWeight: 600, fontSize: 15 }}>{item.label}</div>
                  </Col>
                  <Col xs={10} sm={8} style={{ textAlign: 'right' }}>
                    {!isSpecial ? (
                      <InputNumber
                        min={1}
                        defaultValue={item.amount as number}
                        key={`${item.id}-${item.amount}`}
                        onPressEnter={(e) => {
                          const v = parseInt((e.target as HTMLInputElement).value)
                          if (!isNaN(v) && v !== item.amount) updateAmount(item.id, v)
                          ;(e.target as HTMLInputElement).blur()
                        }}
                        onBlur={(e) => {
                          const v = parseInt(e.target.value)
                          if (!isNaN(v) && v !== item.amount) updateAmount(item.id, v)
                        }}
                        style={{ width: '100%' }}
                        size="small"
                      />
                    ) : (
                      <span style={{ color: '#999', fontSize: 14 }}>Senza numero</span>
                    )}
                  </Col>
                </Row>
                <Row gutter={[8, 8]}>
                  {CHECKBOX_KEYS.map((k) => (
                    <Col xs={12} sm={8} md={4} key={k}>
                      <Checkbox
                        checked={!!item[k]}
                        onChange={(e) => toggleCheckbox(item.id, k, e.target.checked)}
                        disabled={!item[k] && (isRoleTaken(k) || !ammessoPerRuolo(item.raw, k))}
                        style={{ fontSize: 12 }}
                      >
                        {CHECKBOX_LABELS[k]}
                      </Checkbox>
                    </Col>
                  ))}
                  <Col xs={12} sm={8} md={4}>
                    <Button
                      danger
                      size="small"
                      icon={<DeleteOutlined />}
                      onClick={() => removeItem(item.id)}
                      block
                    >
                      Rimuovi
                    </Button>
                  </Col>
                </Row>
                {activeRole && (
                  <div
                    style={{
                      display: 'inline-block',
                      padding: '2px 8px',
                      background: '#c22026',
                      color: 'white',
                      borderRadius: 4,
                      fontSize: 12,
                      fontWeight: 500,
                    }}
                  >
                    {CHECKBOX_LABELS[activeRole]}
                  </div>
                )}
              </Space>
            </List.Item>
          )
        }}
      />

      <Card size="small" style={{ marginTop: 16 }}>
        <Row gutter={[16, 8]}>
          <Col xs={24} sm={8}>
            <div style={{ fontSize: 13 }}>
              Totale: <b>{list.length}/23</b>
            </div>
          </Col>
          {list.filter((it) => !hasSpecialCheckbox(it)).length > 0 && (
            <Col xs={12} sm={8}>
              <div style={{ fontSize: 13 }}>
                Numerati: <b>{list.filter((it) => !hasSpecialCheckbox(it)).length}</b>
              </div>
            </Col>
          )}
          {list.filter((it) => hasSpecialCheckbox(it)).length > 0 && (
            <Col xs={12} sm={8}>
              <div style={{ fontSize: 13 }}>
                Ruoli speciali: <b>{list.filter((it) => hasSpecialCheckbox(it)).length}</b>
              </div>
            </Col>
          )}
        </Row>
      </Card>
    </div>
  )
}
