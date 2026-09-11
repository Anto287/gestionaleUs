import { useMemo, useState } from 'react'
import type { MouseEvent } from 'react'
import {
  App as AntApp,
  AutoComplete,
  Button,
  Card,
  Checkbox,
  Col,
  Empty,
  Form,
  Grid,
  Input,
  InputNumber,
  Modal,
  Popconfirm,
  Row,
  Segmented,
  Select,
  Space,
  Table,
  Tag,
  Tooltip,
  Typography,
  Upload,
} from 'antd'
import {
  CheckOutlined,
  DeleteOutlined,
  FallOutlined,
  FileExcelOutlined,
  PaperClipOutlined,
  PlusOutlined,
  RiseOutlined,
  SearchOutlined,
  SwapOutlined,
  UndoOutlined,
  UploadOutlined,
} from '@ant-design/icons'
import dayjs from 'dayjs'
import { useCollection } from '../hooks/useCollection'
import { useEliminaUndo } from '../hooks/useEliminaUndo'
import { useAggancioLista } from '../hooks/useAggancioLista'
import { useData } from '../data/DataProvider'
import { PageHeader } from '../components/PageHeader'
import { StatCard } from '../components/StatCard'
import { FiltriDrawer, FiltroCampo } from '../components/FiltriDrawer'
import { DataPicker, propsCampoData } from '../components/DataPicker'
import { AnteprimaDocumento, anteprimaDi } from '../components/AnteprimaDocumento'
import { contoSpesa, fraseConto, totaliSpese } from '../lib/spesa'
import { formatData, formatEuro } from '../lib/format'
import { esportaExcel } from '../lib/excel'
import type { Documento, Movimento, SpesaCondivisa } from '../types'

const { Text, Paragraph } = Typography

/** Categorie proposte nel form (si può comunque scrivere qualsiasi testo). */
const CATEGORIE_SUGGERITE = [
  'Campo e spogliatoi',
  'Manutenzione',
  'Utenze',
  'Materiale',
  'Trasferte e pulmino',
  'Tornei',
  'Altro',
]

type Bozza = Pick<
  SpesaCondivisa,
  'data' | 'descrizione' | 'societa' | 'importo' | 'anticipataDa' | 'percentuale' | 'categoria' | 'note'
>

function oggiIso() {
  return new Date().toISOString().slice(0, 10)
}

/** Nome del file dello scontrino sul Drive: si riconosce a colpo d'occhio. */
function nomeScontrino(s: Bozza): string {
  const testo = `Scontrino ${s.data} ${s.societa} ${s.descrizione}`
  return testo.replace(/[\\/:*?"<>|]/g, '-').replace(/\s+/g, ' ').trim().slice(0, 90)
}

/** Colore del conguaglio: verde se entra, rosso se esce. */
function coloreConto(dovuto: number): string | undefined {
  if (dovuto > 0) return '#3f7a52'
  if (dovuto < 0) return '#b1352f'
  return undefined
}

/**
 * Spese condivise con le altre società: quanto è costata una cosa in tutto,
 * chi l'ha anticipata e la fetta a carico nostro. L'app tiene il conto di
 * chi deve dare quanto a chi, finché la spesa non viene saldata.
 */
export function Spese() {
  const spese = useCollection<SpesaCondivisa>('speseCondivise')
  const { items, add, update } = spese
  const conti = useCollection<Movimento>('conti')
  const { uploadDoc } = useData()
  const eliminaConUndo = useEliminaUndo()
  const { message } = AntApp.useApp()
  const screens = Grid.useBreakpoint()
  const isMobile = !screens.sm
  const { toolbarRef, offsetHeader } = useAggancioLista()
  const [form] = Form.useForm<Bozza>()

  const [modale, setModale] = useState(false)
  const [inModifica, setInModifica] = useState<SpesaCondivisa | null>(null)
  const [scontrino, setScontrino] = useState<File | null>(null)
  const [salvando, setSalvando] = useState(false)
  const [daSaldare, setDaSaldare] = useState<SpesaCondivisa | null>(null)
  const [anteprima, setAnteprima] = useState<Documento | null>(null)

  const [q, setQ] = useState('')
  const [societaF, setSocietaF] = useState<string | undefined>()
  const [statoF, setStatoF] = useState<string | undefined>()
  const [anticipoF, setAnticipoF] = useState<string | undefined>()
  const [annoF, setAnnoF] = useState<string | undefined>()

  const societa = useMemo(
    () => [...new Set(items.map((s) => s.societa?.trim()).filter(Boolean))].sort() as string[],
    [items],
  )
  const categorieUsate = useMemo(
    () => [...new Set(items.map((s) => s.categoria?.trim()).filter(Boolean))].sort() as string[],
    [items],
  )
  const opzioniCategoria = useMemo(
    () =>
      [...new Set([...categorieUsate, ...CATEGORIE_SUGGERITE])].map((c) => ({ value: c })),
    [categorieUsate],
  )
  const anni = useMemo(
    () =>
      [...new Set(items.map((s) => s.data?.slice(0, 4)).filter(Boolean))]
        .sort()
        .reverse()
        .map((a) => ({ value: a, label: a })),
    [items],
  )

  const totali = useMemo(() => totaliSpese(items), [items])

  const filtrate = useMemo(() => {
    const testo = q.trim().toLowerCase()
    return [...items]
      .filter((s) => {
        if (testo && !`${s.descrizione} ${s.societa} ${s.note ?? ''}`.toLowerCase().includes(testo))
          return false
        if (societaF && s.societa?.trim() !== societaF) return false
        if (statoF === 'aperta' && s.saldata) return false
        if (statoF === 'saldata' && !s.saldata) return false
        if (anticipoF && s.anticipataDa !== anticipoF) return false
        if (annoF && s.data?.slice(0, 4) !== annoF) return false
        return true
      })
      .sort((a, b) => b.data.localeCompare(a.data))
  }, [items, q, societaF, statoF, anticipoF, annoF])

  // --- form ---

  function apriNuova() {
    setInModifica(null)
    setScontrino(null)
    form.resetFields()
    form.setFieldsValue({ data: oggiIso(), anticipataDa: 'noi', percentuale: 50 })
    setModale(true)
  }

  function apriModifica(s: SpesaCondivisa) {
    setInModifica(s)
    setScontrino(null)
    form.setFieldsValue({ ...s })
    setModale(true)
  }

  async function salva(v: Bozza) {
    const dati: Bozza = {
      ...v,
      importo: Number(v.importo) || 0,
      percentuale: Number(v.percentuale) || 0,
      descrizione: v.descrizione.trim(),
      societa: v.societa.trim(),
      categoria: v.categoria?.trim() || undefined,
      note: v.note?.trim() || undefined,
    }
    setSalvando(true)
    try {
      let allegato = inModifica?.scontrino
      if (scontrino) {
        const meta = await uploadDoc(scontrino, nomeScontrino(dati))
        if (!meta) {
          message.error('Scontrino non caricato: la spesa non è stata salvata.')
          return
        }
        allegato = meta
      }
      if (inModifica) update(inModifica.id, { ...dati, scontrino: allegato })
      else add({ ...dati, scontrino: allegato })
      setModale(false)
      setScontrino(null)
    } finally {
      setSalvando(false)
    }
  }

  // --- saldo ---

  /** Chiude il conto e, se richiesto, registra il movimento gemello nei Conti. */
  function salda(s: SpesaCondivisa, data: string, registra: boolean) {
    const { dovuto } = contoSpesa(s)
    let movimentoId: string | undefined
    if (registra && Math.abs(dovuto) >= 0.005) {
      movimentoId = conti.add({
        data,
        descrizione: `Spesa condivisa: ${s.descrizione}`,
        tipo: dovuto > 0 ? 'entrata' : 'uscita',
        importo: Math.abs(dovuto),
        saldato: true,
        controparte: s.societa,
        categoria: s.categoria?.trim() || 'Spese condivise',
      })
    }
    update(s.id, { saldata: true, dataSaldo: data, movimentoId })
    setDaSaldare(null)
    message.success(movimentoId ? 'Spesa saldata, movimento creato nei Conti.' : 'Spesa saldata.')
  }

  /** Riapre il conto e toglie il movimento gemello, se c'è ancora. */
  function riapri(s: SpesaCondivisa) {
    if (s.movimentoId && conti.items.some((m) => m.id === s.movimentoId)) conti.remove(s.movimentoId)
    update(s.id, { saldata: false, dataSaldo: undefined, movimentoId: undefined })
    message.success('Spesa riaperta.')
  }

  function esporta() {
    esportaExcel('spese-condivise.xlsx', [
      {
        nome: 'Spese condivise',
        righe: filtrate.map((s) => {
          const c = contoSpesa(s)
          return {
            Data: s.data,
            Descrizione: s.descrizione,
            Società: s.societa,
            Categoria: s.categoria ?? '',
            'Totale (€)': s.importo,
            'Anticipata da': s.anticipataDa === 'noi' ? 'Noi' : s.societa,
            '% a noi': s.percentuale,
            'A carico nostro (€)': c.nostra,
            'A carico loro (€)': c.loro,
            Conguaglio: fraseConto(s),
            Stato: s.saldata ? `saldata il ${s.dataSaldo ?? ''}`.trim() : 'aperta',
            Note: s.note ?? '',
          }
        }),
      },
    ])
  }

  // il click sulle azioni non deve aprire la scheda della spesa
  const stopCell = { onCell: () => ({ onClick: (e: MouseEvent) => e.stopPropagation() }) }

  function Azioni({ s }: { s: SpesaCondivisa }) {
    return (
      <Space size={2}>
        {s.scontrino && (
          <Tooltip title="Vedi lo scontrino">
            <Button
              type="text"
              icon={<PaperClipOutlined />}
              onClick={() => setAnteprima(s.scontrino!)}
              aria-label="Vedi lo scontrino"
            />
          </Tooltip>
        )}
        {s.saldata ? (
          <Tooltip title="Riapri il conto">
            <Button type="text" icon={<UndoOutlined />} onClick={() => riapri(s)} aria-label="Riapri" />
          </Tooltip>
        ) : (
          <Tooltip title="Segna come saldata">
            <Button
              type="text"
              icon={<CheckOutlined />}
              onClick={() => setDaSaldare(s)}
              aria-label="Segna come saldata"
            />
          </Tooltip>
        )}
        <Popconfirm
          title="Eliminare questa spesa?"
          description={s.movimentoId ? 'Il movimento nei Conti resta com’è.' : undefined}
          okText="Elimina"
          cancelText="Annulla"
          okButtonProps={{ danger: true }}
          onConfirm={() => eliminaConUndo(spese, s, `«${s.descrizione}» eliminata.`)}
        >
          <Button type="text" danger icon={<DeleteOutlined />} aria-label="Elimina" />
        </Popconfirm>
      </Space>
    )
  }

  const columns = [
    {
      title: 'Data',
      width: 108,
      sorter: (a: SpesaCondivisa, b: SpesaCondivisa) => a.data.localeCompare(b.data),
      render: (_: unknown, s: SpesaCondivisa) => formatData(s.data, true),
    },
    {
      title: 'Spesa',
      width: 260,
      render: (_: unknown, s: SpesaCondivisa) => (
        <span>
          <span className="tronca" style={{ maxWidth: 205 }} title={s.note || s.descrizione}>
            <b>{s.descrizione}</b>
          </span>
          {s.categoria && (
            <Tag bordered={false} style={{ marginLeft: 8 }}>
              {s.categoria}
            </Tag>
          )}
          {s.scontrino && <PaperClipOutlined style={{ marginLeft: 6, color: 'var(--testo-2)' }} />}
        </span>
      ),
    },
    {
      title: 'Società',
      width: 150,
      sorter: (a: SpesaCondivisa, b: SpesaCondivisa) => a.societa.localeCompare(b.societa),
      render: (_: unknown, s: SpesaCondivisa) => s.societa,
    },
    {
      title: 'Totale',
      align: 'right' as const,
      width: 110,
      sorter: (a: SpesaCondivisa, b: SpesaCondivisa) => a.importo - b.importo,
      render: (_: unknown, s: SpesaCondivisa) => formatEuro(s.importo),
    },
    {
      title: 'Divisione',
      width: 190,
      render: (_: unknown, s: SpesaCondivisa) => {
        const c = contoSpesa(s)
        return (
          <span>
            <Text>
              {s.percentuale}% noi · {100 - s.percentuale}% loro
            </Text>
            <br />
            <Text type="secondary" style={{ fontSize: 12.5 }}>
              {formatEuro(c.nostra)} / {formatEuro(c.loro)} · anticipa{' '}
              {s.anticipataDa === 'noi' ? 'noi' : 'loro'}
            </Text>
          </span>
        )
      },
    },
    {
      title: 'Conguaglio',
      align: 'right' as const,
      width: 130,
      render: (_: unknown, s: SpesaCondivisa) => {
        const { dovuto } = contoSpesa(s)
        if (Math.abs(dovuto) < 0.005) return <Text type="secondary">in pari</Text>
        return (
          <b style={{ color: s.saldata ? undefined : coloreConto(dovuto), fontVariantNumeric: 'tabular-nums' }}>
            {dovuto > 0 ? '+ ' : '− '}
            {formatEuro(Math.abs(dovuto))}
          </b>
        )
      },
    },
    {
      title: 'Stato',
      width: 130,
      render: (_: unknown, s: SpesaCondivisa) =>
        s.saldata ? (
          <Tag color="green">Saldata{s.dataSaldo ? ` · ${formatData(s.dataSaldo, true)}` : ''}</Tag>
        ) : (
          <Tag color="warning">Da saldare</Tag>
        ),
    },
    {
      title: '',
      width: 120,
      ...stopCell,
      render: (_: unknown, s: SpesaCondivisa) => <Azioni s={s} />,
    },
  ]

  return (
    <>
      <PageHeader
        titolo="Spese condivise"
        sottotitolo="Spese divise con altre società · tocca una riga per modificarla"
        azioni={
          <Space wrap>
            {items.length > 0 && (
              <Button icon={<FileExcelOutlined />} onClick={esporta}>
                Esporta Excel
              </Button>
            )}
            <Button type="primary" icon={<PlusOutlined />} onClick={apriNuova}>
              Nuova spesa
            </Button>
          </Space>
        }
      />

      <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
        <Col xs={12} sm={8}>
          <StatCard
            icona={<RiseOutlined />}
            titolo="Da ricevere"
            valore={formatEuro(totali.daRicevere)}
            colore={totali.daRicevere > 0 ? '#3f7a52' : undefined}
            sotto="quote che ci devono"
          />
        </Col>
        <Col xs={12} sm={8}>
          <StatCard
            icona={<FallOutlined />}
            titolo="Da versare"
            valore={formatEuro(totali.daVersare)}
            colore={totali.daVersare > 0 ? '#9a6b1e' : undefined}
            sotto="quote che dobbiamo"
          />
        </Col>
        <Col xs={24} sm={8}>
          <StatCard
            icona={<SwapOutlined />}
            titolo="Saldo"
            valore={formatEuro(totali.netto)}
            colore={coloreConto(totali.netto)}
            sotto={totali.netto >= 0 ? 'a conti chiusi ci entra' : 'a conti chiusi ci esce'}
          />
        </Col>
      </Row>

      {totali.perSocieta.length > 1 && (
        <Card title="Come siamo messi, società per società" style={{ marginBottom: 16 }}>
          <div className="spese-societa">
            {totali.perSocieta.map((r) => (
              <div key={r.societa} className="spese-societa-riga">
                <div>
                  <b>{r.societa}</b>
                  <div className="lista-card-meta">
                    {r.aperte > 0 ? `${r.aperte} da saldare` : 'tutto saldato'} · {formatEuro(r.totale)} di
                    spese in tutto
                  </div>
                </div>
                <b className="lista-card-num" style={{ color: coloreConto(r.aperto) }}>
                  {r.aperto === 0
                    ? 'in pari'
                    : `${r.aperto > 0 ? '+ ' : '− '}${formatEuro(Math.abs(r.aperto))}`}
                </b>
              </div>
            ))}
          </div>
        </Card>
      )}

      {items.length === 0 ? (
        <Empty description="Nessuna spesa condivisa registrata">
          <Button type="primary" icon={<PlusOutlined />} onClick={apriNuova}>
            Nuova spesa
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
              placeholder="Cerca spesa o società"
              value={q}
              onChange={(e) => setQ(e.target.value)}
            />
            <FiltriDrawer
              count={[societaF, statoF, anticipoF, annoF].filter(Boolean).length}
              onReset={() => {
                setSocietaF(undefined)
                setStatoF(undefined)
                setAnticipoF(undefined)
                setAnnoF(undefined)
              }}
            >
              {societa.length > 0 && (
                <FiltroCampo label="Società">
                  <Select
                    allowClear
                    showSearch
                    optionFilterProp="label"
                    placeholder="Tutte"
                    value={societaF}
                    onChange={setSocietaF}
                    style={{ width: '100%' }}
                    options={societa.map((s) => ({ value: s, label: s }))}
                  />
                </FiltroCampo>
              )}
              <FiltroCampo label="Stato">
                <Select
                  allowClear
                  placeholder="Qualsiasi"
                  value={statoF}
                  onChange={setStatoF}
                  style={{ width: '100%' }}
                  options={[
                    { value: 'aperta', label: 'Da saldare' },
                    { value: 'saldata', label: 'Saldate' },
                  ]}
                />
              </FiltroCampo>
              <FiltroCampo label="Chi ha anticipato">
                <Select
                  allowClear
                  placeholder="Chiunque"
                  value={anticipoF}
                  onChange={setAnticipoF}
                  style={{ width: '100%' }}
                  options={[
                    { value: 'noi', label: 'Noi' },
                    { value: 'loro', label: "L'altra società" },
                  ]}
                />
              </FiltroCampo>
              <FiltroCampo label="Anno">
                <Select
                  allowClear
                  placeholder="Tutti gli anni"
                  value={annoF}
                  onChange={setAnnoF}
                  style={{ width: '100%' }}
                  options={anni}
                />
              </FiltroCampo>
            </FiltriDrawer>
          </div>

          {isMobile ? (
            <div className="lista-mobile">
              {filtrate.map((s) => {
                const c = contoSpesa(s)
                return (
                  <div key={s.id} className="lista-card" onClick={() => apriModifica(s)}>
                    <div className="lista-card-top">
                      <div>
                        <div className="lista-card-title">{s.descrizione}</div>
                        <div className="lista-card-meta" style={{ marginTop: 5 }}>
                          {formatData(s.data, true)}
                          <span>· {s.societa}</span>
                          {s.categoria && <Tag bordered={false}>{s.categoria}</Tag>}
                          {s.saldata ? <Tag color="green">Saldata</Tag> : <Tag color="warning">Da saldare</Tag>}
                        </div>
                      </div>
                      <span onClick={(e) => e.stopPropagation()}>
                        <Azioni s={s} />
                      </span>
                    </div>
                    <div className="lista-card-meta">
                      <span>
                        {formatEuro(s.importo)} · {s.percentuale}% noi · anticipa{' '}
                        {s.anticipataDa === 'noi' ? 'noi' : 'loro'}
                      </span>
                      <span className="lista-card-fine">
                        <b
                          className="lista-card-num"
                          style={{ color: s.saldata ? undefined : coloreConto(c.dovuto) }}
                        >
                          {Math.abs(c.dovuto) < 0.005
                            ? 'in pari'
                            : `${c.dovuto > 0 ? '+ ' : '− '}${formatEuro(Math.abs(c.dovuto))}`}
                        </b>
                      </span>
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
              onRow={(s) => ({ onClick: () => apriModifica(s), style: { cursor: 'pointer' } })}
            />
          )}
        </>
      )}

      <ModaleSpesa
        form={form}
        aperto={modale}
        inModifica={inModifica}
        salvando={salvando}
        scontrino={scontrino}
        opzioniCategoria={opzioniCategoria}
        societaNote={societa}
        onScontrino={setScontrino}
        onChiudi={() => setModale(false)}
        onSalva={salva}
      />

      <ModaleSaldo spesa={daSaldare} onChiudi={() => setDaSaldare(null)} onConferma={salda} />

      <Modal
        open={!!anteprima}
        onCancel={() => setAnteprima(null)}
        title={anteprima?.nome}
        width={760}
        className="modale-anteprima"
        footer={
          anteprima?.url ? (
            <Button type="primary" href={anteprima.url} target="_blank" rel="noopener">
              Apri sul Drive
            </Button>
          ) : null
        }
        destroyOnHidden
      >
        {anteprima &&
          (anteprimaDi(anteprima) ? (
            <AnteprimaDocumento doc={anteprima} />
          ) : (
            <Text type="secondary">Anteprima non disponibile per questo file.</Text>
          ))}
      </Modal>
    </>
  )
}

/** Il modale con cui si inserisce o si corregge una spesa condivisa. */
function ModaleSpesa({
  form,
  aperto,
  inModifica,
  salvando,
  scontrino,
  opzioniCategoria,
  societaNote,
  onScontrino,
  onChiudi,
  onSalva,
}: {
  form: ReturnType<typeof Form.useForm<Bozza>>[0]
  aperto: boolean
  inModifica: SpesaCondivisa | null
  salvando: boolean
  scontrino: File | null
  opzioniCategoria: { value: string }[]
  societaNote: string[]
  onScontrino: (f: File | null) => void
  onChiudi: () => void
  onSalva: (v: Bozza) => void
}) {
  const importo = Form.useWatch('importo', form)
  const percentuale = Form.useWatch('percentuale', form)
  const anticipataDa = Form.useWatch('anticipataDa', form)
  const societa = Form.useWatch('societa', form)

  const finta: SpesaCondivisa = {
    id: '',
    data: '',
    descrizione: '',
    societa: societa?.trim() || 'loro',
    importo: Number(importo) || 0,
    anticipataDa: anticipataDa ?? 'noi',
    // se il campo è vuoto contoSpesa assume metà per uno
    percentuale: Number(percentuale),
  }
  const conto = contoSpesa(finta)

  return (
    <Modal
      title={inModifica ? 'Modifica spesa condivisa' : 'Nuova spesa condivisa'}
      open={aperto}
      onCancel={onChiudi}
      onOk={() => form.submit()}
      okText={inModifica ? 'Salva' : 'Registra'}
      okButtonProps={{ loading: salvando }}
      cancelText="Annulla"
      maskClosable={false}
      forceRender
    >
      <Form form={form} layout="vertical" onFinish={onSalva} requiredMark={false}>
        <Form.Item label="Data della spesa" name="data" {...propsCampoData}>
          <DataPicker />
        </Form.Item>
        <Form.Item
          label="Descrizione"
          name="descrizione"
          rules={[{ required: true, message: 'Scrivi di che spesa si tratta' }]}
        >
          <Input placeholder="es. Gasolio caldaia spogliatoi" autoComplete="off" />
        </Form.Item>
        <Form.Item
          label="Con quale società"
          name="societa"
          rules={[{ required: true, message: 'Scrivi con chi è divisa' }]}
        >
          <AutoComplete
            options={societaNote.map((s) => ({ value: s }))}
            placeholder="es. Polisportiva Pievepelago"
            filterOption={(input, opt) =>
              String(opt?.value ?? '').toLowerCase().includes(input.toLowerCase())
            }
          />
        </Form.Item>
        <Form.Item
          label="Spesa totale (€)"
          name="importo"
          rules={[{ required: true, message: 'Inserisci quanto è costata in tutto' }]}
        >
          <InputNumber min={0} step={0.01} style={{ width: '100%' }} />
        </Form.Item>
        <Form.Item label="Chi ha anticipato i soldi" name="anticipataDa">
          <Segmented
            block
            options={[
              { value: 'noi', label: 'Noi' },
              { value: 'loro', label: societa?.trim() || "L'altra società" },
            ]}
          />
        </Form.Item>
        <Form.Item
          label="Percentuale a carico nostro"
          name="percentuale"
          rules={[{ required: true, message: 'Inserisci la percentuale' }]}
        >
          <InputNumber min={0} max={100} step={1} addonAfter="%" style={{ width: '100%' }} />
        </Form.Item>
        <Space size={6} wrap style={{ marginTop: -12, marginBottom: 16 }}>
          <Text type="secondary">Al volo:</Text>
          {[50, 33, 25, 75, 100].map((p) => (
            <Button key={p} size="small" onClick={() => form.setFieldValue('percentuale', p)}>
              {p}%
            </Button>
          ))}
        </Space>

        <Card size="small" style={{ marginBottom: 16, background: 'var(--panna)' }}>
          <Paragraph style={{ marginBottom: 4 }}>
            A carico nostro <b>{formatEuro(conto.nostra)}</b> · a carico loro{' '}
            <b>{formatEuro(conto.loro)}</b>
          </Paragraph>
          <Text strong style={{ color: coloreConto(conto.dovuto) }}>
            {fraseConto(finta)}
          </Text>
        </Card>

        <Form.Item label="Categoria (facoltativa)" name="categoria">
          <AutoComplete
            options={opzioniCategoria}
            placeholder="es. Manutenzione, Utenze…"
            allowClear
            filterOption={(input, opt) =>
              String(opt?.value ?? '').toLowerCase().includes(input.toLowerCase())
            }
          />
        </Form.Item>
        <Form.Item label="Note (facoltative)" name="note">
          <Input.TextArea rows={2} placeholder="dettagli, accordi presi…" />
        </Form.Item>

        <Form.Item label="Scontrino o fattura (facoltativo)">
          <Space wrap>
            <Upload
              accept="image/*,application/pdf"
              showUploadList={false}
              beforeUpload={(f) => {
                onScontrino(f as unknown as File)
                return false
              }}
            >
              <Button icon={<UploadOutlined />}>{scontrino ? 'Cambia file' : 'Scegli o scatta'}</Button>
            </Upload>
            {scontrino && (
              <Button type="text" danger onClick={() => onScontrino(null)}>
                Togli
              </Button>
            )}
          </Space>
          {scontrino ? (
            <div style={{ marginTop: 8 }}>
              <Text type="secondary">Verrà caricato in Documenti: </Text>
              <Text code>{scontrino.name}</Text>
            </div>
          ) : (
            inModifica?.scontrino && (
              <div style={{ marginTop: 8 }}>
                <PaperClipOutlined /> <Text type="secondary">{inModifica.scontrino.nome}</Text>
              </div>
            )
          )}
        </Form.Item>
      </Form>
    </Modal>
  )
}

/** Chiusura del conto: data del saldo e movimento gemello nei Conti. */
function ModaleSaldo({
  spesa,
  onChiudi,
  onConferma,
}: {
  spesa: SpesaCondivisa | null
  onChiudi: () => void
  onConferma: (s: SpesaCondivisa, data: string, registra: boolean) => void
}) {
  const [data, setData] = useState(oggiIso())
  const [registra, setRegistra] = useState(true)

  const conto = spesa ? contoSpesa(spesa) : null
  const movimento = conto && conto.dovuto > 0 ? 'entrata' : 'uscita'

  return (
    <Modal
      title="Segnare la spesa come saldata?"
      open={!!spesa}
      onCancel={onChiudi}
      onOk={() => spesa && onConferma(spesa, data, registra)}
      okText="Sì, è saldata"
      cancelText="Annulla"
      afterOpenChange={(aperto) => {
        if (aperto) {
          setData(oggiIso())
          setRegistra(true)
        }
      }}
      destroyOnHidden
    >
      {spesa && conto && (
        <>
          <Paragraph>
            <b>{spesa.descrizione}</b> — {fraseConto(spesa)}.
          </Paragraph>
          <Form layout="vertical">
            <Form.Item label="Quando è stato chiuso il conto">
              <DataPicker
                value={data ? dayjs(data) : undefined}
                onChange={(d) => setData(d ? d.format('YYYY-MM-DD') : oggiIso())}
              />
            </Form.Item>
            <Checkbox checked={registra} onChange={(e) => setRegistra(e.target.checked)}>
              Registra anche nei Conti{' '}
              {Math.abs(conto.dovuto) >= 0.005 && (
                <Text type="secondary">
                  ({movimento} di {formatEuro(Math.abs(conto.dovuto))})
                </Text>
              )}
            </Checkbox>
          </Form>
        </>
      )}
    </Modal>
  )
}
