import { useMemo, useState } from 'react'
import type { MouseEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Button,
  Col,
  Empty,
  Form,
  Grid,
  Input,
  InputNumber,
  Modal,
  Popconfirm,
  Row,
  Select,
  Switch,
  Table,
  Tag,
  Typography,
} from 'antd'
import { PlusOutlined, DeleteOutlined, SearchOutlined } from '@ant-design/icons'
import { useCollection } from '../hooks/useCollection'
import { useEliminaUndo } from '../hooks/useEliminaUndo'
import { useAggancioLista } from '../hooks/useAggancioLista'
import { PageHeader } from '../components/PageHeader'
import { FiltriDrawer, FiltroCampo } from '../components/FiltriDrawer'
import { DataPicker, propsCampoData } from '../components/DataPicker'
import { formatData } from '../lib/format'
import { REGEX_ORA } from '../lib/partita'
import type { Partita, Torneo } from '../types'

const { Text } = Typography

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
  const partiteColl = useCollection<Partita>('partite')
  const { items, add } = partiteColl
  const tornei = useCollection<Torneo>('tornei')
  const eliminaConUndo = useEliminaUndo()
  const navigate = useNavigate()
  const screens = Grid.useBreakpoint()
  const { toolbarRef, offsetHeader } = useAggancioLista()
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
  const [torneoF, setTorneoF] = useState<string | undefined>()

  const partite = useMemo(() => [...items].sort((a, b) => b.data.localeCompare(a.data)), [items])

  const mesi = useMemo(() => {
    const chiavi = new Set(partite.map((p) => p.data.slice(0, 7)))
    return [...chiavi]
      .sort((a, b) => b.localeCompare(a))
      .map((k) => ({ value: k, label: labelMese(k) }))
  }, [partite])

  const nFiltri = [dove, esitoF, meseF, portaF, statoF, torneoF].filter(Boolean).length
  function azzeraFiltri() {
    setDove(undefined)
    setEsitoF(undefined)
    setMeseF(undefined)
    setPortaF(undefined)
    setStatoF(undefined)
    setTorneoF(undefined)
  }

  const nomeTorneo = (id?: string) => tornei.items.find((t) => t.id === id)?.nome

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
        if (torneoF && p.torneoId !== torneoF) return false
        return true
      }),
    [partite, q, dove, esitoF, meseF, portaF, statoF, torneoF],
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
    torneoId?: string
    giocata?: boolean
    golFatti: number
    golSubiti: number
    note?: string
  }) {
    const giocata = v.giocata !== false
    const id = add({
      data: v.data,
      ora: v.ora?.trim() || undefined,
      avversario: v.avversario.trim(),
      inCasa: v.inCasa,
      torneoId: v.torneoId || undefined,
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
    // per una partita giocata si passa subito al dettaglio, così formazione,
    // marcatori e cartellini si segnano al volo
    if (giocata) navigate(`/partite/${id}`)
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
          {nomeTorneo(p.torneoId) && <Tag color="geekblue">{nomeTorneo(p.torneoId)}</Tag>}
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
          onConfirm={() => eliminaConUndo(partiteColl, p, `Partita con ${p.avversario} eliminata.`)}
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
          <div className="lista-toolbar" ref={toolbarRef}>
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
              {tornei.items.length > 0 && (
                <FiltroCampo label="Competizione">
                  <Select
                    allowClear
                    placeholder="Tutte"
                    value={torneoF}
                    onChange={setTorneoF}
                    style={{ width: '100%' }}
                    options={tornei.items.map((t) => ({ value: t.id, label: t.nome }))}
                  />
                </FiltroCampo>
              )}
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
                          {nomeTorneo(p.torneoId) && <Tag color="geekblue">{nomeTorneo(p.torneoId)}</Tag>}
                        </div>
                      </div>
                      <span onClick={(ev) => ev.stopPropagation()}>
                        <Popconfirm
                          title={`Eliminare la partita con ${p.avversario}?`}
                          okText="Elimina"
                          cancelText="Annulla"
                          okButtonProps={{ danger: true }}
                          onConfirm={() => eliminaConUndo(partiteColl, p, `Partita con ${p.avversario} eliminata.`)}
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
              sticky={{ offsetHeader }}
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
        okText={giocataForm !== false ? 'Crea e compila' : 'Crea'}
        cancelText="Annulla"
        maskClosable={false}
        forceRender
      >
        <Form form={form} layout="vertical" onFinish={salva} requiredMark={false}>
          <Row gutter={12}>
            <Col span={14}>
              <Form.Item
                label="Data"
                name="data"
                rules={[{ required: true, message: 'Scegli la data' }]}
                {...propsCampoData}
              >
                <DataPicker />
              </Form.Item>
            </Col>
            <Col span={10}>
              <Form.Item
                label="Ora (facoltativa)"
                name="ora"
                rules={[{ pattern: REGEX_ORA, message: 'Usa il formato 15:30' }]}
              >
                <Input placeholder="es. 15:30" autoComplete="off" />
              </Form.Item>
            </Col>
          </Row>
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
          {tornei.items.length > 0 && (
            <Form.Item label="Competizione (facoltativa)" name="torneoId">
              <Select
                allowClear
                placeholder="es. Campionato, Coppa…"
                options={tornei.items.map((t) => ({ value: t.id, label: t.nome }))}
              />
            </Form.Item>
          )}
          <Form.Item
            label="Partita già giocata"
            name="giocata"
            valuePropName="checked"
            extra="Spegni per una partita in programma (senza risultato)"
          >
            <Switch />
          </Form.Item>
          {giocataForm !== false && (
            <Row gutter={12}>
              <Col span={12}>
                <Form.Item label="Gol fatti" name="golFatti">
                  <InputNumber min={0} style={{ width: '100%' }} />
                </Form.Item>
              </Col>
              <Col span={12}>
                <Form.Item label="Gol subiti" name="golSubiti">
                  <InputNumber min={0} style={{ width: '100%' }} />
                </Form.Item>
              </Col>
            </Row>
          )}
          <Form.Item label="Note (facoltative)" name="note">
            <Input autoComplete="off" />
          </Form.Item>
        </Form>
        {giocataForm !== false && (
          <Text type="secondary" style={{ fontSize: 12.5 }}>
            Appena creata si apre il dettaglio, dove segni formazione, marcatori e cartellini.
          </Text>
        )}
      </Modal>
    </>
  )
}
