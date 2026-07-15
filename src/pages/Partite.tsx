import { useMemo, useState } from 'react'
import type { MouseEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Button,
  Empty,
  Form,
  Grid,
  Input,
  InputNumber,
  Modal,
  Popconfirm,
  Select,
  Switch,
  Table,
  Tag,
} from 'antd'
import { PlusOutlined, DeleteOutlined, SearchOutlined } from '@ant-design/icons'
import { useCollection } from '../hooks/useCollection'
import { PageHeader } from '../components/PageHeader'
import { FiltriDrawer, FiltroCampo } from '../components/FiltriDrawer'
import { DataPicker, propsCampoData } from '../components/DataPicker'
import { formatData } from '../lib/format'
import type { Partita } from '../types'

function oggiIso() {
  return new Date().toISOString().slice(0, 10)
}
function labelMese(chiave: string) {
  const [y, m] = chiave.split('-')
  return `${m}/${y}`
}

/** Una partita senza risultato ancora: è solo in programma. */
function inProgramma(p: Partita): boolean {
  return p.giocata === false
}

function esito(p: Partita): { label: string; color: string } {
  if (p.golFatti > p.golSubiti) return { label: 'V', color: 'success' }
  if (p.golFatti < p.golSubiti) return { label: 'S', color: 'error' }
  return { label: 'P', color: 'default' }
}

export function Partite() {
  const { items, add, remove } = useCollection<Partita>('partite')
  const navigate = useNavigate()
  const screens = Grid.useBreakpoint()
  const isMobile = !screens.sm
  const [modale, setModale] = useState(false)
  const [form] = Form.useForm()
  const giocataForm = Form.useWatch('giocata', form)
  const [q, setQ] = useState('')
  const [dove, setDove] = useState<string | undefined>()
  const [esitoF, setEsitoF] = useState<string | undefined>()
  const [meseF, setMeseF] = useState<string | undefined>()
  const [portaF, setPortaF] = useState<string | undefined>()
  const [statoF, setStatoF] = useState<string | undefined>()

  const partite = useMemo(() => [...items].sort((a, b) => b.data.localeCompare(a.data)), [items])

  const mesi = useMemo(() => {
    const chiavi = new Set(partite.map((p) => p.data.slice(0, 7)))
    return [...chiavi]
      .sort((a, b) => b.localeCompare(a))
      .map((k) => ({ value: k, label: labelMese(k) }))
  }, [partite])

  const nFiltri = [dove, esitoF, meseF, portaF, statoF].filter(Boolean).length
  function azzeraFiltri() {
    setDove(undefined)
    setEsitoF(undefined)
    setMeseF(undefined)
    setPortaF(undefined)
    setStatoF(undefined)
  }

  const filtrate = useMemo(
    () =>
      partite.filter((p) => {
        const programma = inProgramma(p)
        if (q && !p.avversario.toLowerCase().includes(q.toLowerCase())) return false
        if (dove === 'casa' && !p.inCasa) return false
        if (dove === 'trasferta' && p.inCasa) return false
        if (statoF === 'giocate' && programma) return false
        if (statoF === 'programma' && !programma) return false
        // esito e porta valgono solo per le partite già giocate
        if (esitoF && (programma || esito(p).label !== esitoF)) return false
        if (portaF && programma) return false
        if (portaF === 'inviolata' && p.golSubiti !== 0) return false
        if (portaF === 'subito' && p.golSubiti === 0) return false
        if (meseF && p.data.slice(0, 7) !== meseF) return false
        return true
      }),
    [partite, q, dove, esitoF, meseF, portaF, statoF],
  )

  function apriNuova() {
    form.resetFields()
    form.setFieldsValue({ data: oggiIso(), inCasa: true, giocata: true, golFatti: 0, golSubiti: 0 })
    setModale(true)
  }

  function salva(v: {
    data: string
    ora?: string
    avversario: string
    inCasa: boolean
    giocata?: boolean
    golFatti: number
    golSubiti: number
    note?: string
  }) {
    const giocata = v.giocata !== false
    add({
      data: v.data,
      ora: v.ora?.trim() || undefined,
      avversario: v.avversario.trim(),
      inCasa: v.inCasa,
      giocata,
      golFatti: giocata ? (v.golFatti ?? 0) : 0,
      golSubiti: giocata ? (v.golSubiti ?? 0) : 0,
      note: v.note?.trim() || undefined,
      marcatori: [],
      assist: [],
      ammoniti: [],
      espulsi: [],
    })
    setModale(false)
  }

  const columns = [
    {
      title: 'Data',
      key: 'data',
      width: 140,
      sorter: (a: Partita, b: Partita) => a.data.localeCompare(b.data),
      defaultSortOrder: 'descend' as const,
      render: (_: unknown, p: Partita) => (
        <span>
          {formatData(p.data, true)}
          {p.ora && <span style={{ color: 'var(--testo-2)' }}> · {p.ora}</span>}
        </span>
      ),
    },
    {
      title: 'Avversario',
      key: 'avv',
      width: 280,
      sorter: (a: Partita, b: Partita) => a.avversario.localeCompare(b.avversario),
      render: (_: unknown, p: Partita) => (
        <span>
          <b className="tronca" style={{ maxWidth: 190 }} title={p.avversario}>
            {p.avversario}
          </b>{' '}
          <Tag>{p.inCasa ? 'Casa' : 'Trasferta'}</Tag>
        </span>
      ),
    },
    {
      title: 'Risultato',
      key: 'ris',
      align: 'center' as const,
      width: 160,
      sorter: (a: Partita, b: Partita) =>
        a.golFatti - a.golSubiti - (b.golFatti - b.golSubiti),
      render: (_: unknown, p: Partita) => {
        if (inProgramma(p)) return <Tag color="gold">In programma</Tag>
        const e = esito(p)
        return (
          <span>
            <b style={{ fontVariantNumeric: 'tabular-nums' }}>
              {p.golFatti} - {p.golSubiti}
            </b>{' '}
            <Tag color={e.color}>{e.label}</Tag>
          </span>
        )
      },
    },
    {
      title: '',
      key: 'azioni',
      width: 60,
      // il click su Elimina (e sul suo Popconfirm) non deve aprire la partita
      onCell: () => ({ onClick: (e: MouseEvent) => e.stopPropagation() }),
      render: (_: unknown, p: Partita) => (
        <Popconfirm
          title={`Eliminare la partita con ${p.avversario}?`}
          okText="Elimina"
          cancelText="Annulla"
          okButtonProps={{ danger: true }}
          onConfirm={() => remove(p.id)}
        >
          <Button type="text" danger icon={<DeleteOutlined />} />
        </Popconfirm>
      ),
    },
  ]

  return (
    <>
      <PageHeader
        titolo="Partite"
        sottotitolo={`${items.length} partite · tocca per marcatori e cartellini`}
        azioni={
          items.length > 0 && (
            <Button type="primary" icon={<PlusOutlined />} onClick={apriNuova}>
              Nuova partita
            </Button>
          )
        }
      />

      {items.length === 0 ? (
        <Empty description="Nessuna partita registrata">
          <Button type="primary" icon={<PlusOutlined />} onClick={apriNuova}>
            Nuova partita
          </Button>
        </Empty>
      ) : (
        <>
          <div className="lista-toolbar">
            <Input
              className="lista-cerca"
              allowClear
              autoComplete="off"
              prefix={<SearchOutlined />}
              placeholder="Cerca avversario"
              value={q}
              onChange={(e) => setQ(e.target.value)}
            />
            <FiltriDrawer count={nFiltri} onReset={azzeraFiltri}>
              <FiltroCampo label="Stato">
                <Select
                  allowClear
                  placeholder="Tutte"
                  value={statoF}
                  onChange={setStatoF}
                  style={{ width: '100%' }}
                  options={[
                    { value: 'giocate', label: 'Già giocate' },
                    { value: 'programma', label: 'In programma' },
                  ]}
                />
              </FiltroCampo>
              <FiltroCampo label="Dove">
                <Select
                  allowClear
                  placeholder="Casa e trasferta"
                  value={dove}
                  onChange={setDove}
                  style={{ width: '100%' }}
                  options={[
                    { value: 'casa', label: 'In casa' },
                    { value: 'trasferta', label: 'In trasferta' },
                  ]}
                />
              </FiltroCampo>
              <FiltroCampo label="Esito">
                <Select
                  allowClear
                  placeholder="Qualsiasi"
                  value={esitoF}
                  onChange={setEsitoF}
                  style={{ width: '100%' }}
                  options={[
                    { value: 'V', label: 'Vittorie' },
                    { value: 'P', label: 'Pareggi' },
                    { value: 'S', label: 'Sconfitte' },
                  ]}
                />
              </FiltroCampo>
              <FiltroCampo label="Periodo">
                <Select
                  allowClear
                  showSearch
                  optionFilterProp="label"
                  placeholder="Tutti i mesi"
                  value={meseF}
                  onChange={setMeseF}
                  style={{ width: '100%' }}
                  options={mesi}
                />
              </FiltroCampo>
              <FiltroCampo label="Porta">
                <Select
                  allowClear
                  placeholder="Qualsiasi"
                  value={portaF}
                  onChange={setPortaF}
                  style={{ width: '100%' }}
                  options={[
                    { value: 'inviolata', label: 'Porta inviolata' },
                    { value: 'subito', label: 'Gol subiti' },
                  ]}
                />
              </FiltroCampo>
            </FiltriDrawer>
          </div>
          {isMobile ? (
            <div className="lista-mobile">
              {filtrate.map((p) => {
                const programma = inProgramma(p)
                const e = esito(p)
                return (
                  <div key={p.id} className="lista-card" onClick={() => navigate(`/partite/${p.id}`)}>
                    <div className="lista-card-top">
                      <div>
                        <div className="lista-card-title">{p.avversario}</div>
                        <div className="lista-card-meta" style={{ marginTop: 5 }}>
                          {formatData(p.data, true)}
                          {p.ora && <span>· {p.ora}</span>}
                          <Tag>{p.inCasa ? 'Casa' : 'Trasferta'}</Tag>
                        </div>
                      </div>
                      <span onClick={(ev) => ev.stopPropagation()}>
                        <Popconfirm
                          title={`Eliminare la partita con ${p.avversario}?`}
                          okText="Elimina"
                          cancelText="Annulla"
                          okButtonProps={{ danger: true }}
                          onConfirm={() => remove(p.id)}
                        >
                          <Button type="text" danger icon={<DeleteOutlined />} />
                        </Popconfirm>
                      </span>
                    </div>
                    <div className="lista-card-meta">
                      {programma ? (
                        <Tag color="gold">In programma</Tag>
                      ) : (
                        <>
                          <span className="lista-card-num" style={{ fontSize: 16, color: 'var(--inchiostro)' }}>
                            {p.golFatti} - {p.golSubiti}
                          </span>
                          <Tag color={e.color}>{e.label}</Tag>
                        </>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          ) : (
            <Table
              rowKey="id"
              dataSource={filtrate}
              columns={columns}
              pagination={false}
              size="middle"
              scroll={{ x: 'max-content' }}
              onRow={(p) => ({ onClick: () => navigate(`/partite/${p.id}`), style: { cursor: 'pointer' } })}
            />
          )}
        </>
      )}

      <Modal
        title="Nuova partita"
        open={modale}
        onCancel={() => setModale(false)}
        onOk={() => form.submit()}
        okText="Crea"
        cancelText="Annulla"
        maskClosable={false}
        forceRender
      >
        <Form form={form} layout="vertical" onFinish={salva} requiredMark={false}>
          <Form.Item
            label="Data"
            name="data"
            rules={[{ required: true, message: 'Scegli la data' }]}
            {...propsCampoData}
          >
            <DataPicker />
          </Form.Item>
          <Form.Item label="Ora (facoltativa)" name="ora">
            <Input placeholder="es. 15:30" autoComplete="off" />
          </Form.Item>
          <Form.Item
            label="Avversario"
            name="avversario"
            rules={[{ required: true, message: 'Inserisci l’avversario' }]}
          >
            <Input placeholder="es. Pievepelago" autoComplete="off" />
          </Form.Item>
          <Form.Item label="Dove" name="inCasa">
            <Select
              options={[
                { value: true, label: 'In casa' },
                { value: false, label: 'In trasferta' },
              ]}
            />
          </Form.Item>
          <Form.Item
            label="Partita già giocata"
            name="giocata"
            valuePropName="checked"
            extra="Spegni per una partita in programma (senza risultato)"
          >
            <Switch />
          </Form.Item>
          {giocataForm !== false && (
            <>
              <Form.Item label="Gol fatti" name="golFatti">
                <InputNumber min={0} style={{ width: '100%' }} />
              </Form.Item>
              <Form.Item label="Gol subiti" name="golSubiti">
                <InputNumber min={0} style={{ width: '100%' }} />
              </Form.Item>
            </>
          )}
          <Form.Item label="Note (facoltative)" name="note">
            <Input autoComplete="off" />
          </Form.Item>
        </Form>
      </Modal>
    </>
  )
}
