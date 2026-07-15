import { useMemo, useState } from 'react'
import type { MouseEvent } from 'react'
import {
  Button,
  Checkbox,
  Empty,
  Flex,
  Form,
  Grid,
  Input,
  InputNumber,
  Modal,
  Popconfirm,
  Select,
  Space,
  Table,
  Tag,
  Typography,
} from 'antd'
import { PlusOutlined, MinusOutlined, DeleteOutlined, SearchOutlined } from '@ant-design/icons'
import { useCollection } from '../../hooks/useCollection'
import { DataPicker, propsCampoData } from '../../components/DataPicker'
import { formatData } from '../../lib/format'
import { statoScadenza, giorniAllaScadenza, GIORNI_ALLARME } from '../../lib/scadenza'
import type { VoceMagazzino } from '../../types'

const { Text } = Typography

/** Colori dei tag categoria, assegnati in ordine così ogni sezione è coerente. */
const PALETTE = ['blue', 'volcano', 'gold', 'purple', 'green', 'magenta', 'cyan', 'geekblue']

/** Configura una sezione di magazzino: quali campi mostra, filtra e stampa. */
export interface ConfigInventario {
  collezione: string
  /** testo del pulsante di aggiunta, es. "Nuovo articolo" (gestisce il genere) */
  nuovoLabel: string
  /** parola singolare per il titolo della modale, es. "articolo" → "Modifica articolo" */
  singolare: string
  /** parola plurale per il conteggio, es. "articoli" */
  plurale: string
  placeholderNome?: string
  /** se presente: campo + filtro + tag colorati per la categoria */
  categorie?: string[]
  /** stepper della quantità + filtro "solo esauriti" */
  conQuantita?: boolean
  /** data di scadenza + filtro + righe rosse + conteggio in scadenza */
  conScadenza?: boolean
  /** campo note (mostrato sotto il nome e incluso nella ricerca) */
  conNote?: boolean
  /** testo dello stato vuoto */
  vuotoText?: string
}

type Bozza = Omit<VoceMagazzino, 'id'>

export function InventarioTab({ config }: { config: ConfigInventario }) {
  const { collezione, nuovoLabel, singolare, plurale, categorie, conQuantita, conScadenza, conNote } =
    config
  const { items, add, update, remove } = useCollection<VoceMagazzino>(collezione)
  const screens = Grid.useBreakpoint()
  const isMobile = !screens.sm
  const [modale, setModale] = useState(false)
  const [inModifica, setInModifica] = useState<VoceMagazzino | null>(null)
  const [form] = Form.useForm()

  const [q, setQ] = useState('')
  const [cat, setCat] = useState<string | undefined>()
  const [entroGiorni, setEntroGiorni] = useState<number | null>(null)
  const [soloEsauriti, setSoloEsauriti] = useState(false)

  function coloreCategoria(c?: string): string {
    const i = categorie?.indexOf(c ?? '') ?? -1
    return i >= 0 ? PALETTE[i % PALETTE.length] : 'default'
  }

  const ordinati = useMemo(() => {
    const arr = [...items]
    if (conScadenza) {
      arr.sort((a, b) => {
        if (!a.scadenza && !b.scadenza) return a.nome.localeCompare(b.nome)
        if (!a.scadenza) return 1
        if (!b.scadenza) return -1
        return a.scadenza.localeCompare(b.scadenza) || a.nome.localeCompare(b.nome)
      })
    } else {
      arr.sort(
        (a, b) => (a.categoria ?? '').localeCompare(b.categoria ?? '') || a.nome.localeCompare(b.nome),
      )
    }
    return arr
  }, [items, conScadenza])

  const filtrati = useMemo(
    () =>
      ordinati.filter((a) => {
        const testo = `${a.nome} ${conNote ? (a.note ?? '') : ''}`.toLowerCase()
        if (q && !testo.includes(q.toLowerCase())) return false
        if (categorie && cat && a.categoria !== cat) return false
        if (conScadenza && entroGiorni != null) {
          const g = giorniAllaScadenza(a.scadenza)
          if (g == null || g > entroGiorni) return false
        }
        if (conQuantita && soloEsauriti && (a.quantita ?? 0) > 0) return false
        return true
      }),
    [ordinati, q, cat, entroGiorni, soloEsauriti, categorie, conScadenza, conQuantita, conNote],
  )

  const { scaduti, inScadenzaSoon } = useMemo(() => {
    let scaduti = 0
    let inScadenzaSoon = 0
    if (conScadenza)
      for (const a of items) {
        const g = giorniAllaScadenza(a.scadenza)
        if (g == null) continue
        if (g < 0) scaduti++
        else if (g <= GIORNI_ALLARME) inScadenzaSoon++
      }
    return { scaduti, inScadenzaSoon }
  }, [items, conScadenza])

  function adegua(a: VoceMagazzino, delta: number) {
    update(a.id, { quantita: Math.max(0, (a.quantita ?? 0) + delta) })
  }
  function apriNuovo() {
    setInModifica(null)
    form.resetFields()
    form.setFieldsValue({
      ...(categorie ? { categoria: categorie[0] } : {}),
      ...(conQuantita ? { quantita: 1 } : {}),
    })
    setModale(true)
  }
  function apriModifica(a: VoceMagazzino) {
    setInModifica(a)
    form.setFieldsValue(a)
    setModale(true)
  }
  function salva(valori: Bozza) {
    if (inModifica) update(inModifica.id, valori)
    else add(valori)
    setModale(false)
  }

  const stopCell = { onCell: () => ({ onClick: (e: MouseEvent) => e.stopPropagation() }) }

  const nomeCol = {
    title: 'Nome',
    key: 'nome',
    width: 280,
    sorter: (a: VoceMagazzino, b: VoceMagazzino) => (a.nome ?? '').localeCompare(b.nome ?? ''),
    render: (_: unknown, a: VoceMagazzino) => (
      <div style={{ maxWidth: 260 }}>
        <div className="tronca" style={{ maxWidth: 260, fontWeight: 600 }} title={a.nome}>
          {a.nome}
        </div>
        {conNote && a.note && (
          <div className="tronca" style={{ maxWidth: 260, fontSize: 12, color: '#8a7d6b' }} title={a.note}>
            {a.note}
          </div>
        )}
      </div>
    ),
  }
  const catCol = {
    title: 'Categoria',
    dataIndex: 'categoria',
    width: 160,
    sorter: (a: VoceMagazzino, b: VoceMagazzino) => (a.categoria ?? '').localeCompare(b.categoria ?? ''),
    render: (c: string) => (c ? <Tag color={coloreCategoria(c)}>{c}</Tag> : <Text type="secondary">—</Text>),
  }
  const scadenzaCol = {
    title: 'Scadenza',
    key: 'scadenza',
    width: 180,
    sorter: (a: VoceMagazzino, b: VoceMagazzino) => (a.scadenza ?? '').localeCompare(b.scadenza ?? ''),
    render: (_: unknown, a: VoceMagazzino) => {
      if (!a.scadenza) return <Text type="secondary">—</Text>
      const s = statoScadenza(a.scadenza)
      return (
        <Space>
          <span style={{ color: s.critico ? '#b1352f' : undefined, fontWeight: s.critico ? 600 : undefined }}>
            {formatData(a.scadenza, true)}
          </span>
          {s.label && <Tag color={s.color}>{s.label}</Tag>}
        </Space>
      )
    },
  }
  const quantitaCol = {
    title: 'Quantità',
    align: 'center' as const,
    width: 170,
    sorter: (a: VoceMagazzino, b: VoceMagazzino) => (a.quantita ?? 0) - (b.quantita ?? 0),
    ...stopCell,
    render: (_: unknown, a: VoceMagazzino) => (
      <Space.Compact>
        <Button icon={<MinusOutlined />} onClick={() => adegua(a, -1)} disabled={(a.quantita ?? 0) <= 0} />
        <Button style={{ pointerEvents: 'none', minWidth: 56 }}>
          <b style={{ color: (a.quantita ?? 0) === 0 ? '#b1352f' : undefined }}>{a.quantita ?? 0}</b>
        </Button>
        <Button icon={<PlusOutlined />} onClick={() => adegua(a, +1)} />
      </Space.Compact>
    ),
  }
  const azioniCol = {
    title: '',
    key: 'azioni',
    width: 50,
    ...stopCell,
    render: (_: unknown, a: VoceMagazzino) => (
      <Popconfirm
        title={`Eliminare ${a.nome}?`}
        okText="Elimina"
        cancelText="Annulla"
        okButtonProps={{ danger: true }}
        onConfirm={() => remove(a.id)}
      >
        <Button type="text" danger icon={<DeleteOutlined />} />
      </Popconfirm>
    ),
  }

  const columns = [
    nomeCol,
    ...(categorie ? [catCol] : []),
    ...(conScadenza ? [scadenzaCol] : []),
    ...(conQuantita ? [quantitaCol] : []),
    azioniCol,
  ]

  return (
    <>
      <Flex justify="space-between" align="center" wrap gap={12} style={{ marginBottom: 16 }}>
        <Space size={[8, 8]} wrap>
          <Text>
            <b>{items.length}</b> {plurale}
          </Text>
          {scaduti > 0 && <Tag color="red">{scaduti} scadut{scaduti > 1 ? 'i' : 'o'}</Tag>}
          {inScadenzaSoon > 0 && <Tag color="gold">{inScadenzaSoon} in scadenza</Tag>}
        </Space>
        {items.length > 0 && (
          <Button type="primary" icon={<PlusOutlined />} onClick={apriNuovo}>
            {nuovoLabel}
          </Button>
        )}
      </Flex>

      {items.length === 0 ? (
        <Empty description={config.vuotoText ?? `Ancora niente qui: aggiungi ${plurale}.`}>
          <Button type="primary" icon={<PlusOutlined />} onClick={apriNuovo}>
            {nuovoLabel}
          </Button>
        </Empty>
      ) : (
        <>
          <Space wrap className="filtri-inline" style={{ marginBottom: 16 }}>
            <Input
              allowClear
              prefix={<SearchOutlined />}
              placeholder={conNote ? 'Cerca nome o note' : 'Cerca'}
              value={q}
              onChange={(e) => setQ(e.target.value)}
              style={{ width: 220 }}
            />
            {categorie && (
              <Select
                allowClear
                placeholder="Categoria"
                value={cat}
                onChange={setCat}
                options={categorie.map((c) => ({ value: c, label: c }))}
                style={{ width: 180 }}
              />
            )}
            {conScadenza && (
              <InputNumber
                min={0}
                value={entroGiorni}
                onChange={setEntroGiorni}
                placeholder="Scade entro…"
                addonAfter="gg"
                style={{ width: 190 }}
              />
            )}
            {conQuantita && (
              <Checkbox checked={soloEsauriti} onChange={(e) => setSoloEsauriti(e.target.checked)}>
                Solo esauriti
              </Checkbox>
            )}
          </Space>

          {filtrati.length === 0 ? (
            <Empty description="Nessun risultato con questi filtri" />
          ) : isMobile ? (
            <div className="lista-mobile">
              {filtrati.map((a) => {
                const s = conScadenza && a.scadenza ? statoScadenza(a.scadenza) : null
                return (
                  <div
                    key={a.id}
                    className={`lista-card${s?.critico ? ' card-allarme' : ''}`}
                    onClick={() => apriModifica(a)}
                  >
                    <div className="lista-card-top">
                      <div>
                        <div className="lista-card-title">{a.nome}</div>
                        {conNote && a.note && (
                          <div style={{ fontSize: 12, color: '#8a7d6b', marginTop: 2 }}>{a.note}</div>
                        )}
                        {(categorie || s) && (
                          <div className="lista-card-meta" style={{ marginTop: 6 }}>
                            {categorie && a.categoria && (
                              <Tag color={coloreCategoria(a.categoria)}>{a.categoria}</Tag>
                            )}
                            {s && a.scadenza && (
                              <span style={{ color: s.critico ? '#b1352f' : 'var(--testo-2)' }}>
                                {formatData(a.scadenza, true)}
                                {s.label && (
                                  <Tag color={s.color} style={{ marginLeft: 6 }}>
                                    {s.label}
                                  </Tag>
                                )}
                              </span>
                            )}
                          </div>
                        )}
                      </div>
                      <span onClick={(e) => e.stopPropagation()}>
                        <Popconfirm
                          title={`Eliminare ${a.nome}?`}
                          okText="Elimina"
                          cancelText="Annulla"
                          okButtonProps={{ danger: true }}
                          onConfirm={() => remove(a.id)}
                        >
                          <Button type="text" danger icon={<DeleteOutlined />} />
                        </Popconfirm>
                      </span>
                    </div>
                    {conQuantita && (
                      <div className="lista-card-meta" onClick={(e) => e.stopPropagation()}>
                        <span>Quantità</span>
                        <span className="lista-card-fine">
                          <Space.Compact>
                            <Button
                              icon={<MinusOutlined />}
                              onClick={() => adegua(a, -1)}
                              disabled={(a.quantita ?? 0) <= 0}
                            />
                            <Button style={{ pointerEvents: 'none', minWidth: 56 }}>
                              <b style={{ color: (a.quantita ?? 0) === 0 ? '#b1352f' : undefined }}>
                                {a.quantita ?? 0}
                              </b>
                            </Button>
                            <Button icon={<PlusOutlined />} onClick={() => adegua(a, +1)} />
                          </Space.Compact>
                        </span>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          ) : (
            <Table
              rowKey="id"
              dataSource={filtrati}
              columns={columns}
              pagination={false}
              size="middle"
              scroll={{ x: 'max-content' }}
              rowClassName={(a) =>
                conScadenza && statoScadenza(a.scadenza).critico ? 'riga-scadenza-allarme' : ''
              }
              onRow={(a) => ({ onClick: () => apriModifica(a), style: { cursor: 'pointer' } })}
            />
          )}
        </>
      )}

      <Modal
        title={inModifica ? `Modifica ${singolare}` : nuovoLabel}
        open={modale}
        onCancel={() => setModale(false)}
        onOk={() => form.submit()}
        okText={inModifica ? 'Salva' : 'Aggiungi'}
        cancelText="Annulla"
        maskClosable={false}
        forceRender
      >
        <Form form={form} layout="vertical" onFinish={salva} requiredMark={false}>
          <Form.Item label="Nome" name="nome" rules={[{ required: true, message: 'Inserisci il nome' }]}>
            <Input placeholder={config.placeholderNome} />
          </Form.Item>
          {categorie && (
            <Form.Item label="Categoria" name="categoria">
              <Select options={categorie.map((c) => ({ value: c, label: c }))} allowClear />
            </Form.Item>
          )}
          {conQuantita && (
            <Form.Item label="Quantità" name="quantita">
              <InputNumber min={0} style={{ width: '100%' }} />
            </Form.Item>
          )}
          {conScadenza && (
            <Form.Item label="Data di scadenza (facoltativa)" name="scadenza" {...propsCampoData}>
              <DataPicker />
            </Form.Item>
          )}
          {conNote && (
            <Form.Item label="Note (facoltative)" name="note">
              <Input.TextArea rows={2} placeholder="es. dettagli, posizione, marca…" />
            </Form.Item>
          )}
        </Form>
      </Modal>
    </>
  )
}
