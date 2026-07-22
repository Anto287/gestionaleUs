import { useMemo, useState } from 'react'
import {
  App as AntApp,
  Button,
  Card,
  Checkbox,
  Col,
  Empty,
  Form,
  Input,
  List,
  Modal,
  Popconfirm,
  Progress,
  Row,
  Segmented,
  Select,
  Space,
  Statistic,
  Typography,
} from 'antd'
import {
  PlusOutlined,
  DeleteOutlined,
  CheckOutlined,
  FilePdfOutlined,
  RetweetOutlined,
  RightOutlined,
  CalendarOutlined,
  TeamOutlined,
  RiseOutlined,
  SearchOutlined,
} from '@ant-design/icons'
import { useCollection } from '../hooks/useCollection'
import { useEliminaUndo } from '../hooks/useEliminaUndo'
import dayjs from 'dayjs'
import { useSeason } from '../season/SeasonContext'
import { PageHeader } from '../components/PageHeader'
import { DataPicker, propsCampoData } from '../components/DataPicker'
import { formatData } from '../lib/format'
import { OPZIONI_PERIODO, mesiPeriodo, type PeriodoChart } from '../lib/periodo'
import { isGiocatore } from '../lib/categoria'
import { coloreAffluenza } from '../lib/chart'
import { AffluenzaChart, type TipoAffluenza } from './allenamenti/AffluenzaChart'
import { ClassificaPresenze, esportaClassificaPdf, type RigaClassifica } from './allenamenti/classifica'
import type { Allenamento, Giocatore } from '../types'

const { Text } = Typography

function oggiIso() {
  return new Date().toISOString().slice(0, 10)
}
function labelBreve(iso: string) {
  const [, m, d] = iso.split('-')
  return d && m ? `${d}/${m}` : iso
}

/** I giorni della settimana per le sedute ricorrenti (day() di dayjs: 0 = domenica). */
const GIORNI_SETTIMANA = [
  { value: 1, label: 'Lun' },
  { value: 2, label: 'Mar' },
  { value: 3, label: 'Mer' },
  { value: 4, label: 'Gio' },
  { value: 5, label: 'Ven' },
  { value: 6, label: 'Sab' },
  { value: 0, label: 'Dom' },
]

export function Allenamenti() {
  const allenamentiColl = useCollection<Allenamento>('allenamenti')
  const { items, add, update } = allenamentiColl
  const eliminaConUndo = useEliminaUndo()
  const giocatori = useCollection<Giocatore>('giocatori')
  const { attiva } = useSeason()
  const { message } = AntApp.useApp()
  const [modaleNuova, setModaleNuova] = useState(false)
  const [modaleRicorrenti, setModaleRicorrenti] = useState(false)
  const [apertaId, setApertaId] = useState<string | null>(null)
  const [esportando, setEsportando] = useState(false)
  const [tipoChart, setTipoChart] = useState<TipoAffluenza>('barre')
  const [periodoChart, setPeriodoChart] = useState<PeriodoChart>('tutto')
  const [ricerca, setRicerca] = useState('')
  const [form] = Form.useForm()
  const [formR] = Form.useForm()

  // agli allenamenti si segnano i giocatori, non i dirigenti puri
  const rosa = useMemo(
    () =>
      giocatori.items
        .filter(isGiocatore)
        .sort((a, b) => `${a.cognome}${a.nome}`.localeCompare(`${b.cognome}${b.nome}`)),
    [giocatori.items],
  )

  const sedute = useMemo(() => [...items].sort((a, b) => b.data.localeCompare(a.data)), [items])

  // al massimo una seduta al giorno: le date già occupate non si possono riusare
  const dateOccupate = useMemo(() => new Set(items.map((s) => s.data)), [items])

  const presenti = (s: Allenamento) => rosa.filter((g) => s.presenze[g.id]).length
  const percSeduta = (s: Allenamento) => (rosa.length ? Math.round((presenti(s) / rosa.length) * 100) : 0)

  const media = sedute.length ? sedute.reduce((tot, s) => tot + presenti(s), 0) / sedute.length : 0
  const mediaPerc = rosa.length ? Math.round((media / rosa.length) * 100) : 0

  // il grafico può restringersi a una finestra recente (le tessere in alto no)
  const seduteChart = useMemo(() => {
    const mesi = mesiPeriodo(periodoChart)
    if (!mesi || sedute.length === 0) return sedute
    const cutoff = dayjs(sedute[0].data).subtract(mesi, 'month').format('YYYY-MM-DD')
    return sedute.filter((s) => s.data >= cutoff)
  }, [sedute, periodoChart])

  const mediaChart = seduteChart.length
    ? seduteChart.reduce((tot, s) => tot + presenti(s), 0) / seduteChart.length
    : 0

  const datiChart = useMemo(
    () =>
      [...seduteChart].reverse().map((s) => ({ label: labelBreve(s.data), valore: presenti(s) })),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [seduteChart, rosa],
  )

  const classifica: RigaClassifica[] = useMemo(
    () =>
      rosa
        .map((g) => {
          const p = sedute.filter((s) => s.presenze[g.id]).length
          return {
            id: g.id,
            nome: `${g.cognome} ${g.nome}`,
            presenze: p,
            perc: sedute.length ? Math.round((p / sedute.length) * 100) : 0,
          }
        })
        .sort((a, b) => b.presenze - a.presenze || a.nome.localeCompare(b.nome)),
    [rosa, sedute],
  )

  const sessioneAperta = apertaId ? items.find((s) => s.id === apertaId) : null

  const rosaModale = useMemo(() => {
    const t = ricerca.trim().toLowerCase()
    if (!t) return rosa
    return rosa.filter((g) => `${g.cognome} ${g.nome}`.toLowerCase().includes(t))
  }, [rosa, ricerca])

  function apriSeduta(id: string) {
    setRicerca('')
    setApertaId(id)
  }

  /** Crea la seduta e apre subito le presenze, così i giocatori si segnano al volo. */
  function creaSeduta(valori: { data: string; note?: string }) {
    const esistente = items.find((s) => s.data === valori.data)
    if (esistente) {
      // una sola seduta al giorno: se esiste già, si apre quella
      message.info(`Per il ${formatData(valori.data, true)} c'è già una seduta: la apro.`)
      setModaleNuova(false)
      apriSeduta(esistente.id)
      return
    }
    const id = add({ data: valori.data, note: valori.note?.trim() || undefined, presenze: {} })
    setModaleNuova(false)
    apriSeduta(id)
  }

  /** Crea in un colpo solo le sedute ricorrenti (es. ogni martedì e giovedì). */
  function creaRicorrenti(v: { dal: string; al: string; giorni: number[]; note?: string }) {
    if (v.al < v.dal) {
      message.error('La data di fine viene prima di quella di inizio.')
      return
    }
    const esistenti = new Set(items.map((s) => s.data))
    const giorni = new Set(v.giorni)
    let create = 0
    let saltate = 0
    for (let d = dayjs(v.dal); !d.isAfter(dayjs(v.al)); d = d.add(1, 'day')) {
      if (!giorni.has(d.day())) continue
      const iso = d.format('YYYY-MM-DD')
      if (esistenti.has(iso)) {
        saltate++
        continue
      }
      add({ data: iso, note: v.note?.trim() || undefined, presenze: {} })
      create++
    }
    setModaleRicorrenti(false)
    if (create === 0) message.warning('Nessuna seduta creata: le date erano già tutte presenti.')
    else
      message.success(
        `Create ${create} sedute${saltate ? ` (${saltate} saltate perché già presenti)` : ''}.`,
      )
  }

  function togglePresenza(s: Allenamento, giocatoreId: string) {
    update(s.id, { presenze: { ...s.presenze, [giocatoreId]: !s.presenze[giocatoreId] } })
  }
  function segnaTutti(s: Allenamento, presente: boolean) {
    update(s.id, {
      presenze: presente ? Object.fromEntries(rosa.map((g) => [g.id, true])) : {},
    })
  }

  async function esporta() {
    setEsportando(true)
    try {
      await esportaClassificaPdf(classifica, attiva, sedute.length)
    } finally {
      setEsportando(false)
    }
  }

  if (giocatori.items.length === 0) {
    return (
      <>
        <PageHeader titolo="Allenamenti" />
        <Empty description="Aggiungi prima i giocatori nella sezione Rosa: qui segnerai chi c'è a ogni seduta." />
      </>
    )
  }

  return (
    <>
      <PageHeader
        titolo="Allenamenti"
        sottotitolo={sedute.length ? `${sedute.length} sedute registrate` : 'Nessuna seduta ancora'}
        azioni={
          <Space wrap>
            <Button
              icon={<RetweetOutlined />}
              onClick={() => {
                formR.resetFields()
                formR.setFieldsValue({ dal: oggiIso(), giorni: [] })
                setModaleRicorrenti(true)
              }}
            >
              Più sedute
            </Button>
            <Button
              type="primary"
              icon={<PlusOutlined />}
              onClick={() => {
                form.resetFields()
                form.setFieldsValue({ data: oggiIso() })
                setModaleNuova(true)
              }}
            >
              Nuova seduta
            </Button>
          </Space>
        }
      />

      {/* Riepilogo in tre tessere, come nel resto dell'app */}
      <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
        <Col xs={12} sm={8}>
          <Card className="stat-card">
            <CalendarOutlined className="stat-icon" aria-hidden />
            <Statistic title="Sedute" value={sedute.length} />
          </Card>
        </Col>
        <Col xs={12} sm={8}>
          <Card className="stat-card">
            <TeamOutlined className="stat-icon" aria-hidden />
            <Statistic title="Affluenza media" value={media.toFixed(1)} suffix={`/ ${rosa.length}`} />
          </Card>
        </Col>
        <Col xs={24} sm={8}>
          <Card className="stat-card">
            <RiseOutlined className="stat-icon" aria-hidden />
            <Statistic title="Presenze medie" value={mediaPerc} suffix="%" />
          </Card>
        </Col>
      </Row>

      {/* Grafico e classifica affiancati sui grandi schermi; la classifica scorre
          dentro la sua card così la pagina non si allunga con tanti giocatori */}
      {sedute.length > 0 && (
        <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
          <Col xs={24} lg={14}>
            <Card
              title="Affluenza per seduta"
              style={{ height: '100%' }}
              extra={
                <Space wrap>
                  <Select
                    size="small"
                    value={periodoChart}
                    onChange={(v) => setPeriodoChart(v as PeriodoChart)}
                    options={OPZIONI_PERIODO}
                    style={{ width: 150 }}
                  />
                  <Segmented
                    size="small"
                    value={tipoChart}
                    onChange={(v) => setTipoChart(v as TipoAffluenza)}
                    options={[
                      { label: 'Barre', value: 'barre' },
                      { label: 'Andamento', value: 'linea' },
                    ]}
                  />
                </Space>
              }
            >
              <AffluenzaChart dati={datiChart} media={mediaChart} scala={rosa.length} tipo={tipoChart} />
            </Card>
          </Col>
          <Col xs={24} lg={10}>
            <Card
              title="Classifica presenze"
              style={{ height: '100%' }}
              styles={{ body: { maxHeight: 308, overflowY: 'auto' } }}
              extra={
                <Button size="small" icon={<FilePdfOutlined />} onClick={esporta} loading={esportando}>
                  PDF
                </Button>
              }
            >
              <ClassificaPresenze righe={classifica} totale={sedute.length} />
            </Card>
          </Col>
        </Row>
      )}

      <Card title="Sedute" styles={{ body: { padding: 0 } }}>
        {sedute.length === 0 ? (
          <div style={{ padding: 24 }}>
            <Empty description="Nessuna seduta registrata. Creane una per iniziare a segnare le presenze." />
          </div>
        ) : (
          <List
            dataSource={sedute}
            renderItem={(s) => {
              const p = presenti(s)
              const perc = percSeduta(s)
              return (
                <List.Item
                  onClick={() => apriSeduta(s.id)}
                  style={{ cursor: 'pointer', padding: '14px 24px' }}
                  extra={<RightOutlined style={{ color: '#c9bfad' }} />}
                >
                  <List.Item.Meta title={formatData(s.data)} description={s.note || undefined} />
                  <Space size={12} align="center">
                    <div className="mini-bar" title={`${perc}%`}>
                      <i style={{ width: `${perc}%`, background: coloreAffluenza(perc) }} />
                    </div>
                    <Text style={{ minWidth: 52, textAlign: 'right', whiteSpace: 'nowrap' }}>
                      <b>{p}</b>
                      <Text type="secondary">/{rosa.length}</Text>
                    </Text>
                  </Space>
                </List.Item>
              )
            }}
          />
        )}
      </Card>

      {/* Nuova seduta */}
      <Modal
        title="Nuova seduta"
        open={modaleNuova}
        onCancel={() => setModaleNuova(false)}
        onOk={() => form.submit()}
        okText="Crea e segna presenze"
        cancelText="Annulla"
        maskClosable={false}
        forceRender
      >
        <Form form={form} layout="vertical" onFinish={creaSeduta} requiredMark={false}>
          <Form.Item
            label="Data"
            name="data"
            rules={[{ required: true, message: 'Scegli la data' }]}
            {...propsCampoData}
          >
            <DataPicker disabledDate={(d) => dateOccupate.has(d.format('YYYY-MM-DD'))} />
          </Form.Item>
          <Form.Item label="Note (facoltative)" name="note">
            <Input placeholder="es. amichevole, seduta atletica…" autoComplete="off" />
          </Form.Item>
        </Form>
        <Text type="secondary" style={{ fontSize: 12.5 }}>
          Appena creata si apre l'elenco dei giocatori per segnare chi c'è. Si può fare una sola
          seduta al giorno: le date già occupate sono disabilitate.
        </Text>
      </Modal>

      {/* Sedute ricorrenti */}
      <Modal
        title="Crea più sedute"
        open={modaleRicorrenti}
        onCancel={() => setModaleRicorrenti(false)}
        onOk={() => formR.submit()}
        okText="Crea le sedute"
        cancelText="Annulla"
        maskClosable={false}
        forceRender
      >
        <Form form={formR} layout="vertical" onFinish={creaRicorrenti} requiredMark={false}>
          <Row gutter={12}>
            <Col span={12}>
              <Form.Item
                label="Dal"
                name="dal"
                rules={[{ required: true, message: 'Scegli la data di inizio' }]}
                {...propsCampoData}
              >
                <DataPicker />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item
                label="Al"
                name="al"
                rules={[{ required: true, message: 'Scegli la data di fine' }]}
                {...propsCampoData}
              >
                <DataPicker />
              </Form.Item>
            </Col>
          </Row>
          <Form.Item
            label="Nei giorni"
            name="giorni"
            rules={[{ required: true, message: 'Scegli almeno un giorno della settimana' }]}
          >
            <Checkbox.Group options={GIORNI_SETTIMANA} />
          </Form.Item>
          <Form.Item label="Note per tutte le sedute (facoltative)" name="note">
            <Input placeholder="es. seduta serale" autoComplete="off" />
          </Form.Item>
        </Form>
        <Text type="secondary" style={{ fontSize: 12.5 }}>
          Le date in cui esiste già una seduta vengono saltate; le presenze si segnano poi seduta per
          seduta.
        </Text>
      </Modal>

      {/* Presenze della seduta */}
      <Modal
        title={sessioneAperta ? `Presenze · ${formatData(sessioneAperta.data)}` : ''}
        open={!!sessioneAperta}
        onCancel={() => setApertaId(null)}
        footer={null}
        maskClosable={false}
        width={640}
      >
        {sessioneAperta && (
          <>
            <Space wrap className="filtri-inline" style={{ marginBottom: 14 }}>
              <DataPicker
                allowClear={false}
                value={sessioneAperta.data ? dayjs(sessioneAperta.data) : null}
                disabledDate={(d) => {
                  const iso = d.format('YYYY-MM-DD')
                  return iso !== sessioneAperta.data && dateOccupate.has(iso)
                }}
                onChange={(d) => {
                  if (!d) return
                  const iso = d.format('YYYY-MM-DD')
                  if (iso !== sessioneAperta.data && dateOccupate.has(iso)) {
                    message.error(`Per il ${formatData(iso, true)} c'è già una seduta.`)
                    return
                  }
                  update(sessioneAperta.id, { data: iso })
                }}
                style={{ width: 170 }}
              />
              <Input
                key={sessioneAperta.id}
                placeholder="Note della seduta"
                autoComplete="off"
                defaultValue={sessioneAperta.note}
                onBlur={(e) => update(sessioneAperta.id, { note: e.target.value.trim() || undefined })}
                style={{ width: 260 }}
              />
            </Space>

            <div className="presenze-toolbar">
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'baseline',
                  marginBottom: 8,
                }}
              >
                <Text strong>
                  {presenti(sessioneAperta)} di {rosa.length} presenti
                </Text>
                <Text type="secondary">{percSeduta(sessioneAperta)}%</Text>
              </div>
              <Progress
                percent={percSeduta(sessioneAperta)}
                showInfo={false}
                strokeColor={coloreAffluenza(percSeduta(sessioneAperta))}
                trailColor="#eee4d3"
              />
              <Space style={{ marginTop: 10 }}>
                <Button size="small" onClick={() => segnaTutti(sessioneAperta, true)}>
                  Tutti presenti
                </Button>
                <Button size="small" onClick={() => segnaTutti(sessioneAperta, false)}>
                  Azzera
                </Button>
              </Space>
            </div>

            <Input
              allowClear
              autoComplete="off"
              prefix={<SearchOutlined />}
              placeholder="Cerca giocatore"
              value={ricerca}
              onChange={(e) => setRicerca(e.target.value)}
              style={{ marginBottom: 12 }}
            />

            <div style={{ marginBottom: 16 }}>
              {rosaModale.length === 0 ? (
                <Text type="secondary">Nessun giocatore trovato.</Text>
              ) : (
                <Space size={[8, 8]} wrap>
                  {rosaModale.map((g) => {
                    const presente = !!sessioneAperta.presenze[g.id]
                    return (
                      <button
                        key={g.id}
                        type="button"
                        className={`presenza-chip${presente ? ' on' : ''}`}
                        aria-pressed={presente}
                        onClick={() => togglePresenza(sessioneAperta, g.id)}
                      >
                        {presente && <CheckOutlined />}
                        {g.cognome} {g.nome}
                      </button>
                    )
                  })}
                </Space>
              )}
            </div>

            <Popconfirm
              title="Eliminare questa seduta?"
              okText="Elimina"
              cancelText="Annulla"
              okButtonProps={{ danger: true }}
              onConfirm={() => {
                eliminaConUndo(
                  allenamentiColl,
                  sessioneAperta,
                  `Seduta del ${formatData(sessioneAperta.data, true)} eliminata.`,
                )
                setApertaId(null)
              }}
            >
              <Button type="text" danger icon={<DeleteOutlined />} size="small">
                Elimina seduta
              </Button>
            </Popconfirm>
          </>
        )}
      </Modal>
    </>
  )
}
