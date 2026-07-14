import { useMemo, useRef, useState } from 'react'
import type { MouseEvent } from 'react'
import {
  App as AntApp,
  Button,
  Card,
  Checkbox,
  Col,
  Empty,
  Form,
  Input,
  InputNumber,
  Modal,
  Popconfirm,
  Row,
  Segmented,
  Select,
  Space,
  Statistic,
  Table,
  Tag,
  Typography,
  Upload,
} from 'antd'
import {
  PlusOutlined,
  DeleteOutlined,
  FallOutlined,
  RiseOutlined,
  SearchOutlined,
  UploadOutlined,
  WalletOutlined,
} from '@ant-design/icons'
import { useCollection } from '../hooks/useCollection'
import { PageHeader } from '../components/PageHeader'
import { formatData, formatEuro } from '../lib/format'
import { BilancioMensile, type MeseBilancio, type TipoBilancio } from './conti/BilancioMensile'
import { leggiBilancio } from './conti/importaBilancio'
import type { Movimento } from '../types'

function oggiIso() {
  return new Date().toISOString().slice(0, 10)
}
function labelMese(chiave: string) {
  const [y, m] = chiave.split('-')
  return `${m}/${y.slice(2)}`
}

export function Conti() {
  const { items, add, update, remove, replace } = useCollection<Movimento>('conti')
  const { modal, message } = AntApp.useApp()
  const [modale, setModale] = useState(false)
  const [inModifica, setInModifica] = useState<Movimento | null>(null)
  const [importando, setImportando] = useState(false)
  // l'import resta nascosto: si sblocca con 5 tocchi rapidi sul titolo
  const [importSbloccato, setImportSbloccato] = useState(false)
  const tocchi = useRef({ n: 0, t: 0 })
  const [form] = Form.useForm()

  function tapTitolo() {
    if (importSbloccato) return
    const ora = Date.now()
    if (ora - tocchi.current.t > 1200) tocchi.current.n = 0
    tocchi.current = { n: tocchi.current.n + 1, t: ora }
    if (tocchi.current.n >= 5) {
      setImportSbloccato(true)
      message.success('Import sbloccato: ora puoi caricare il bilancio da file.')
    }
  }

  const [q, setQ] = useState('')
  const [tipo, setTipo] = useState<string | undefined>()
  const [stato, setStato] = useState<string | undefined>()
  const [tipoBilancio, setTipoBilancio] = useState<TipoBilancio>('barre')

  // saldo progressivo su TUTTI i movimenti (i filtri non alterano la cassa)
  const vista = useMemo(() => {
    const chrono = [...items].sort((a, b) => a.data.localeCompare(b.data))
    let cassa = 0
    const conCassa = chrono.map((m) => {
      if (m.saldato) cassa += m.tipo === 'entrata' ? m.importo : -m.importo
      return { m, cassa }
    })
    return conCassa.reverse()
  }, [items])

  const vistaFiltrata = useMemo(
    () =>
      vista.filter(({ m }) => {
        const testo = `${m.descrizione} ${m.controparte ?? ''}`.toLowerCase()
        if (q && !testo.includes(q.toLowerCase())) return false
        if (tipo && m.tipo !== tipo) return false
        if (stato === 'saldato' && !m.saldato) return false
        if (stato === 'aperto' && m.saldato) return false
        return true
      }),
    [vista, q, tipo, stato],
  )

  const saldo = items
    .filter((m) => m.saldato)
    .reduce((s, m) => s + (m.tipo === 'entrata' ? m.importo : -m.importo), 0)
  const daIncassare = items
    .filter((m) => !m.saldato && m.tipo === 'entrata')
    .reduce((s, m) => s + m.importo, 0)
  const daPagare = items
    .filter((m) => !m.saldato && m.tipo === 'uscita')
    .reduce((s, m) => s + m.importo, 0)

  const bilancio: MeseBilancio[] = useMemo(() => {
    const perMese = new Map<string, { entrate: number; uscite: number }>()
    for (const m of items) {
      const k = m.data.slice(0, 7)
      const v = perMese.get(k) ?? { entrate: 0, uscite: 0 }
      if (m.tipo === 'entrata') v.entrate += m.importo
      else v.uscite += m.importo
      perMese.set(k, v)
    }
    return [...perMese.entries()]
      .sort((a, b) => a[0].localeCompare(b[0]))
      .slice(-6)
      .map(([k, v]) => ({ mese: labelMese(k), entrate: v.entrate, uscite: v.uscite }))
  }, [items])

  function apriNuovo() {
    setInModifica(null)
    form.resetFields()
    form.setFieldsValue({ tipo: 'uscita', data: oggiIso(), saldato: true })
    setModale(true)
  }
  function apriModifica(m: Movimento) {
    setInModifica(m)
    form.setFieldsValue(m)
    setModale(true)
  }
  function salva(v: Omit<Movimento, 'id'>) {
    const dati = { ...v, importo: Number(v.importo) }
    if (inModifica) update(inModifica.id, dati)
    else add(dati)
    setModale(false)
  }

  /** Import da Excel/CSV nel formato del bilancio: SOSTITUISCE tutti i movimenti. */
  async function importaFile(file: File) {
    if (!/\.(xlsx|xls|csv)$/i.test(file.name)) {
      message.error('File non valido: servono Excel (.xlsx, .xls) o CSV.')
      return
    }
    setImportando(true)
    try {
      const movimenti = await leggiBilancio(file)
      if (!movimenti.length) {
        message.error(
          'File non valido: nessun movimento riconosciuto. Servono le colonne Data, Nome transazione, Uscita/Entrata.',
        )
        return
      }
      const entrate = movimenti.filter((m) => m.tipo === 'entrata').length
      modal.confirm({
        title: 'Importare il bilancio?',
        content:
          `In "${file.name}" ho trovato ${movimenti.length} movimenti ` +
          `(${entrate} entrate, ${movimenti.length - entrate} uscite). ` +
          (items.length > 0
            ? `L'import sostituisce i ${items.length} movimenti già presenti.`
            : 'Verranno aggiunti ai conti.'),
        okText: items.length > 0 ? 'Sostituisci tutto' : 'Importa',
        okButtonProps: { danger: items.length > 0 },
        cancelText: 'Annulla',
        onOk: () => {
          replace(movimenti.map((m) => ({ ...m, id: crypto.randomUUID() })))
          message.success(`Importati ${movimenti.length} movimenti.`)
        },
      })
    } catch (e) {
      message.error(`Import non riuscito: ${String((e as Error)?.message || e)}`)
    } finally {
      setImportando(false)
    }
  }

  const bottoneImporta = (
    <Upload
      accept=".xlsx,.xls,.csv"
      showUploadList={false}
      beforeUpload={(f) => {
        importaFile(f)
        return false // il file non va caricato da nessuna parte: si legge e basta
      }}
    >
      <Button icon={<UploadOutlined />} loading={importando}>
        Importa
      </Button>
    </Upload>
  )

  const stopCell = { onCell: () => ({ onClick: (e: MouseEvent) => e.stopPropagation() }) }

  const columns = [
    { title: 'Data', width: 110, render: (_: unknown, r: { m: Movimento }) => formatData(r.m.data, true) },
    {
      title: 'Descrizione',
      render: (_: unknown, r: { m: Movimento }) => (
        <span>
          <b>{r.m.descrizione}</b>
          {r.m.controparte && <Typography.Text type="secondary"> · {r.m.controparte}</Typography.Text>}
          {!r.m.saldato && (
            <Tag color="warning" style={{ marginLeft: 8 }}>
              {r.m.tipo === 'entrata' ? 'Da incassare' : 'Da dare'}
            </Tag>
          )}
        </span>
      ),
    },
    {
      title: 'Uscita',
      align: 'right' as const,
      render: (_: unknown, r: { m: Movimento }) =>
        r.m.tipo === 'uscita' ? <span style={{ color: '#b1352f' }}>{formatEuro(r.m.importo)}</span> : '',
    },
    {
      title: 'Entrata',
      align: 'right' as const,
      render: (_: unknown, r: { m: Movimento }) =>
        r.m.tipo === 'entrata' ? <span style={{ color: '#3f7a52' }}>{formatEuro(r.m.importo)}</span> : '',
    },
    {
      title: 'Totale in cassa',
      align: 'right' as const,
      render: (_: unknown, r: { cassa: number }) => (
        <b style={{ fontVariantNumeric: 'tabular-nums' }}>{formatEuro(r.cassa)}</b>
      ),
    },
    {
      title: '',
      width: 50,
      ...stopCell,
      render: (_: unknown, r: { m: Movimento }) => (
        <Popconfirm
          title="Eliminare questo movimento?"
          okText="Elimina"
          cancelText="Annulla"
          okButtonProps={{ danger: true }}
          onConfirm={() => remove(r.m.id)}
        >
          <Button type="text" danger icon={<DeleteOutlined />} />
        </Popconfirm>
      ),
    },
  ]

  return (
    <>
      <PageHeader
        titolo="Conti"
        sottotitolo="Cassa continua (non divisa per stagione) · tocca una riga per modificarla"
        onTitleClick={tapTitolo}
        azioni={
          <Space wrap>
            {importSbloccato && bottoneImporta}
            <Button type="primary" icon={<PlusOutlined />} onClick={apriNuovo}>
              Nuovo movimento
            </Button>
          </Space>
        }
      />

      <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
        <Col xs={24} sm={8}>
          <Card className="stat-card">
            <WalletOutlined className="stat-icon" aria-hidden />
            <Statistic
              title="Totale in cassa"
              value={formatEuro(saldo)}
              valueStyle={{ color: saldo < 0 ? '#b1352f' : undefined }}
            />
          </Card>
        </Col>
        <Col xs={12} sm={8}>
          <Card className="stat-card">
            <RiseOutlined className="stat-icon" aria-hidden />
            <Statistic title="Da incassare" value={formatEuro(daIncassare)} valueStyle={{ color: '#3f7a52' }} />
          </Card>
        </Col>
        <Col xs={12} sm={8}>
          <Card className="stat-card">
            <FallOutlined className="stat-icon" aria-hidden />
            <Statistic
              title="Da dare"
              value={formatEuro(daPagare)}
              valueStyle={{ color: daPagare > 0 ? '#9a6b1e' : undefined }}
            />
          </Card>
        </Col>
      </Row>

      {bilancio.length > 0 && (
        <Card
          title="Bilancio mensile"
          style={{ marginBottom: 16 }}
          extra={
            <Segmented
              size="small"
              value={tipoBilancio}
              onChange={(v) => setTipoBilancio(v as TipoBilancio)}
              options={[
                { label: 'Entrate/Uscite', value: 'barre' },
                { label: 'Saldo', value: 'saldo' },
              ]}
            />
          }
        >
          <BilancioMensile dati={bilancio} tipo={tipoBilancio} />
        </Card>
      )}

      {items.length === 0 ? (
        <Empty description="Nessun movimento registrato">
          <Space wrap style={{ justifyContent: 'center' }}>
            <Button type="primary" icon={<PlusOutlined />} onClick={apriNuovo}>
              Nuovo movimento
            </Button>
            {importSbloccato && bottoneImporta}
          </Space>
        </Empty>
      ) : (
        <>
          <Space wrap style={{ marginBottom: 16 }}>
            <Input
              allowClear
              prefix={<SearchOutlined />}
              placeholder="Cerca descrizione"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              style={{ width: 220 }}
            />
            <Select
              allowClear
              placeholder="Tipo"
              value={tipo}
              onChange={setTipo}
              style={{ width: 140 }}
              options={[
                { value: 'entrata', label: 'Entrate' },
                { value: 'uscita', label: 'Uscite' },
              ]}
            />
            <Select
              allowClear
              placeholder="Stato"
              value={stato}
              onChange={setStato}
              style={{ width: 150 }}
              options={[
                { value: 'saldato', label: 'Saldati' },
                { value: 'aperto', label: 'Da saldare' },
              ]}
            />
          </Space>
          <Table
            rowKey={(r) => r.m.id}
            dataSource={vistaFiltrata}
            columns={columns}
            pagination={false}
            size="middle"
            scroll={{ x: 'max-content' }}
            onRow={(r) => ({ onClick: () => apriModifica(r.m), style: { cursor: 'pointer' } })}
          />
        </>
      )}

      <Modal
        title={inModifica ? 'Modifica movimento' : 'Nuovo movimento'}
        open={modale}
        onCancel={() => setModale(false)}
        onOk={() => form.submit()}
        okText={inModifica ? 'Salva' : 'Registra'}
        cancelText="Annulla"
        maskClosable={false}
        forceRender
      >
        <Form form={form} layout="vertical" onFinish={salva} requiredMark={false}>
          <Form.Item label="Tipo" name="tipo">
            <Select
              options={[
                { value: 'uscita', label: 'Uscita' },
                { value: 'entrata', label: 'Entrata' },
              ]}
            />
          </Form.Item>
          <Form.Item label="Data" name="data">
            <Input type="date" />
          </Form.Item>
          <Form.Item
            label="Descrizione"
            name="descrizione"
            rules={[{ required: true, message: 'Inserisci una descrizione' }]}
          >
            <Input placeholder="es. Sponsor, Pagamento campo…" />
          </Form.Item>
          <Form.Item label="Importo (€)" name="importo" rules={[{ required: true, message: 'Inserisci l’importo' }]}>
            <InputNumber min={0} step={0.01} style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item label="Controparte (facoltativa)" name="controparte">
            <Input placeholder="fornitore, sponsor…" />
          </Form.Item>
          <Form.Item name="saldato" valuePropName="checked">
            <Checkbox>Già saldato (movimento chiuso, incide sulla cassa)</Checkbox>
          </Form.Item>
        </Form>
      </Modal>
    </>
  )
}
