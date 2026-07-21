import { useMemo, useRef, useState } from 'react'
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
  Typography,
  Upload,
} from 'antd'
import {
  PlusOutlined,
  DeleteOutlined,
  FallOutlined,
  FileExcelOutlined,
  RiseOutlined,
  SearchOutlined,
  UploadOutlined,
  WalletOutlined,
} from '@ant-design/icons'
import { useCollection } from '../hooks/useCollection'
import { useEliminaUndo } from '../hooks/useEliminaUndo'
import { useAggancioLista } from '../hooks/useAggancioLista'
import { PageHeader } from '../components/PageHeader'
import { FiltriDrawer, FiltroCampo } from '../components/FiltriDrawer'
import { StatCard } from '../components/StatCard'
import { DettaglioMovimenti, type VistaDettaglio } from '../components/DettaglioMovimenti'
import dayjs from 'dayjs'
import { DataPicker, propsCampoData } from '../components/DataPicker'
import { formatData, formatEuro } from '../lib/format'
import { esportaExcel } from '../lib/excel'
import { OPZIONI_PERIODO, mesiPeriodo, type PeriodoChart } from '../lib/periodo'
import { BilancioMensile, type MeseBilancio, type TipoBilancio } from './conti/BilancioMensile'
import { PerCategoria, type VoceCategoria } from './conti/PerCategoria'
import { leggiBilancio } from './conti/importaBilancio'
import type { Movimento } from '../types'

/** Categorie proposte nel form (si può comunque scrivere qualsiasi testo). */
const CATEGORIE_SUGGERITE = [
  'Quote',
  'Bar',
  'Sponsor',
  'Arbitri',
  'Iscrizioni e tesseramenti',
  'Materiale',
  'Manutenzione campo',
  'Trasferte',
  'Utenze',
  'Altro',
]

const SENZA_CATEGORIA = 'Senza categoria'

function oggiIso() {
  return new Date().toISOString().slice(0, 10)
}
function labelMese(chiave: string) {
  const [y, m] = chiave.split('-')
  return `${m}/${y.slice(2)}`
}

export function Conti() {
  const conti = useCollection<Movimento>('conti')
  const { items, add, update, replace } = conti
  const eliminaConUndo = useEliminaUndo()
  const { modal, message } = AntApp.useApp()
  const screens = Grid.useBreakpoint()
  const { toolbarRef, offsetHeader } = useAggancioLista()
  const isMobile = !screens.sm
  const [modale, setModale] = useState(false)
  const [inModifica, setInModifica] = useState<Movimento | null>(null)
  const [dettaglio, setDettaglio] = useState<VistaDettaglio | null>(null)
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
  const [annoF, setAnnoF] = useState<string | undefined>()
  const [meseF, setMeseF] = useState<string | undefined>()
  const [categoriaF, setCategoriaF] = useState<string | undefined>()
  const [controparteF, setControparteF] = useState<string | undefined>()
  // filtro importo: soglia + verso (≥ dalla soglia in su, ≤ dalla soglia in giù)
  const [importoF, setImportoF] = useState<number | null>(null)
  const [importoOp, setImportoOp] = useState<'maggiore' | 'minore'>('maggiore')
  const [tipoBilancio, setTipoBilancio] = useState<TipoBilancio>('barre')
  const [periodoBilancio, setPeriodoBilancio] = useState<PeriodoChart>('tutto')
  const [tipoCategorie, setTipoCategorie] = useState<'uscita' | 'entrata'>('uscita')
  const [periodoCategorie, setPeriodoCategorie] = useState<PeriodoChart>('tutto')

  const anni = useMemo(() => {
    const chiavi = new Set(items.map((m) => m.data.slice(0, 4)))
    return [...chiavi].sort((a, b) => b.localeCompare(a)).map((y) => ({ value: y, label: y }))
  }, [items])

  // i mesi disponibili si restringono all'anno scelto
  const mesi = useMemo(() => {
    const chiavi = new Set(
      items.filter((m) => !annoF || m.data.slice(0, 4) === annoF).map((m) => m.data.slice(0, 7)),
    )
    return [...chiavi]
      .sort((a, b) => b.localeCompare(a))
      .map((k) => ({ value: k, label: labelMese(k) }))
  }, [items, annoF])

  const nFiltri =
    [tipo, stato, annoF, meseF, categoriaF, controparteF].filter(Boolean).length +
    (importoF != null ? 1 : 0)
  function azzeraFiltri() {
    setTipo(undefined)
    setStato(undefined)
    setAnnoF(undefined)
    setMeseF(undefined)
    setCategoriaF(undefined)
    setControparteF(undefined)
    setImportoF(null)
    setImportoOp('maggiore')
  }

  // le controparti già usate, per il filtro a tendina
  const controparti = useMemo(() => {
    const usate = new Set(items.map((m) => m.controparte?.trim()).filter(Boolean) as string[])
    return [...usate].sort((a, b) => a.localeCompare(b))
  }, [items])

  // le categorie già usate, per filtro e suggerimenti del form
  const categorieUsate = useMemo(() => {
    const usate = new Set(items.map((m) => m.categoria?.trim()).filter(Boolean) as string[])
    return [...usate].sort((a, b) => a.localeCompare(b))
  }, [items])

  const opzioniCategoria = useMemo(() => {
    const tutte = [...new Set([...categorieUsate, ...CATEGORIE_SUGGERITE])]
    return tutte.map((c) => ({ value: c }))
  }, [categorieUsate])

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
        if (annoF && m.data.slice(0, 4) !== annoF) return false
        if (meseF && m.data.slice(0, 7) !== meseF) return false
        if (categoriaF === SENZA_CATEGORIA && m.categoria?.trim()) return false
        if (categoriaF && categoriaF !== SENZA_CATEGORIA && m.categoria?.trim() !== categoriaF) return false
        if (controparteF && m.controparte?.trim() !== controparteF) return false
        if (importoF != null && (importoOp === 'maggiore' ? m.importo < importoF : m.importo > importoF))
          return false
        return true
      }),
    [vista, q, tipo, stato, annoF, meseF, categoriaF, controparteF, importoF, importoOp],
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
    const ordinati = [...perMese.entries()].sort((a, b) => a[0].localeCompare(b[0]))
    // restringe alla finestra scelta (di default 'tutto' = tutti i mesi)
    const mesi = mesiPeriodo(periodoBilancio)
    const sel =
      mesi && ordinati.length
        ? (() => {
            const ultimo = ordinati[ordinati.length - 1][0]
            const cutoff = dayjs(ultimo + '-01').subtract(mesi - 1, 'month').format('YYYY-MM')
            return ordinati.filter(([k]) => k >= cutoff)
          })()
        : ordinati
    return sel.map(([k, v]) => ({ mese: labelMese(k), entrate: v.entrate, uscite: v.uscite }))
  }, [items, periodoBilancio])

  // dove vanno (o da dove arrivano) i soldi, raggruppati per categoria
  const perCategoria: VoceCategoria[] = useMemo(() => {
    const mesi = mesiPeriodo(periodoCategorie)
    const cutoff = mesi ? dayjs().subtract(mesi, 'month').format('YYYY-MM-DD') : ''
    const somme = new Map<string, number>()
    for (const m of items) {
      if (m.tipo !== tipoCategorie) continue
      if (cutoff && m.data < cutoff) continue
      const k = m.categoria?.trim() || SENZA_CATEGORIA
      somme.set(k, (somme.get(k) ?? 0) + m.importo)
    }
    return [...somme.entries()]
      .map(([categoria, importo]) => ({ categoria, importo }))
      .sort((a, b) => b.importo - a.importo)
  }, [items, tipoCategorie, periodoCategorie])

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
    const dati = { ...v, importo: Number(v.importo), categoria: v.categoria?.trim() || undefined }
    if (inModifica) update(inModifica.id, dati)
    else add(dati)
    setModale(false)
  }

  /** Scarica i movimenti visibili (con i filtri applicati) in un foglio Excel. */
  function esporta() {
    esportaExcel('conti.xlsx', [
      {
        nome: 'Conti',
        righe: [...vistaFiltrata].reverse().map((r) => ({
          Data: r.m.data,
          Descrizione: r.m.descrizione,
          Controparte: r.m.controparte ?? '',
          Categoria: r.m.categoria ?? '',
          Tipo: r.m.tipo,
          'Importo (€)': r.m.importo,
          Stato: r.m.saldato ? 'saldato' : r.m.tipo === 'entrata' ? 'da incassare' : 'da dare',
          'Totale in cassa (€)': r.cassa,
        })),
      },
    ])
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
    {
      title: 'Data',
      width: 110,
      sorter: (a: { m: Movimento }, b: { m: Movimento }) => a.m.data.localeCompare(b.m.data),
      render: (_: unknown, r: { m: Movimento }) => formatData(r.m.data, true),
    },
    {
      title: 'Descrizione',
      width: 380,
      render: (_: unknown, r: { m: Movimento }) => (
        <span>
          <span
            className="tronca"
            style={{ maxWidth: 300 }}
            title={r.m.controparte ? `${r.m.descrizione} · ${r.m.controparte}` : r.m.descrizione}
          >
            <b>{r.m.descrizione}</b>
            {r.m.controparte && <Typography.Text type="secondary"> · {r.m.controparte}</Typography.Text>}
          </span>
          {r.m.categoria && (
            <Tag style={{ marginLeft: 8 }} bordered={false}>
              {r.m.categoria}
            </Tag>
          )}
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
          onConfirm={() => eliminaConUndo(conti, r.m, `«${r.m.descrizione}» eliminato.`)}
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
            {items.length > 0 && (
              <Button icon={<FileExcelOutlined />} onClick={esporta}>
                Esporta Excel
              </Button>
            )}
            <Button type="primary" icon={<PlusOutlined />} onClick={apriNuovo}>
              Nuovo movimento
            </Button>
          </Space>
        }
      />

      <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
        <Col xs={24} sm={8}>
          <StatCard
            icona={<WalletOutlined />}
            titolo="Totale in cassa"
            valore={formatEuro(saldo)}
            colore={saldo < 0 ? '#b1352f' : undefined}
            onApri={() => setDettaglio('cassa')}
            apriLabel="vedi gli ultimi movimenti"
          />
        </Col>
        <Col xs={12} sm={8}>
          <StatCard
            icona={<RiseOutlined />}
            titolo="Da incassare"
            valore={formatEuro(daIncassare)}
            colore="#3f7a52"
            onApri={() => setDettaglio('daIncassare')}
            apriLabel="vedi da chi dobbiamo ricevere soldi"
          />
        </Col>
        <Col xs={12} sm={8}>
          <StatCard
            icona={<FallOutlined />}
            titolo="Da dare"
            valore={formatEuro(daPagare)}
            colore={daPagare > 0 ? '#9a6b1e' : undefined}
            onApri={() => setDettaglio('daPagare')}
            apriLabel="vedi a chi dobbiamo dare soldi"
          />
        </Col>
      </Row>

      {items.length > 0 && (
        <Card
          title="Bilancio mensile"
          style={{ marginBottom: 16 }}
          extra={
            <Space wrap>
              <Select
                size="small"
                value={periodoBilancio}
                onChange={(v) => setPeriodoBilancio(v as PeriodoChart)}
                options={OPZIONI_PERIODO}
                style={{ width: 150 }}
              />
              <Segmented
                size="small"
                value={tipoBilancio}
                onChange={(v) => setTipoBilancio(v as TipoBilancio)}
                options={[
                  { label: 'Entrate/Uscite', value: 'barre' },
                  { label: 'Saldo', value: 'saldo' },
                ]}
              />
            </Space>
          }
        >
          <BilancioMensile dati={bilancio} tipo={tipoBilancio} />
        </Card>
      )}

      {categorieUsate.length > 0 && (
        <Card
          title="Per categoria"
          style={{ marginBottom: 16 }}
          extra={
            <Space wrap>
              <Select
                size="small"
                value={periodoCategorie}
                onChange={(v) => setPeriodoCategorie(v as PeriodoChart)}
                options={OPZIONI_PERIODO}
                style={{ width: 150 }}
              />
              <Segmented
                size="small"
                value={tipoCategorie}
                onChange={(v) => setTipoCategorie(v as 'uscita' | 'entrata')}
                options={[
                  { label: 'Uscite', value: 'uscita' },
                  { label: 'Entrate', value: 'entrata' },
                ]}
              />
            </Space>
          }
        >
          {perCategoria.length === 0 ? (
            <Typography.Text type="secondary">
              Nessun movimento di questo tipo nel periodo scelto.
            </Typography.Text>
          ) : (
            <PerCategoria dati={perCategoria} tipo={tipoCategorie} />
          )}
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
          <div className="lista-toolbar" ref={toolbarRef}>
            <Input
              className="lista-cerca"
              allowClear
              autoComplete="off"
              prefix={<SearchOutlined />}
              placeholder="Cerca descrizione"
              value={q}
              onChange={(e) => setQ(e.target.value)}
            />
            <FiltriDrawer count={nFiltri} onReset={azzeraFiltri}>
              <FiltroCampo label="Tipo">
                <Select
                  allowClear
                  placeholder="Entrate e uscite"
                  value={tipo}
                  onChange={setTipo}
                  style={{ width: '100%' }}
                  options={[
                    { value: 'entrata', label: 'Entrate' },
                    { value: 'uscita', label: 'Uscite' },
                  ]}
                />
              </FiltroCampo>
              <FiltroCampo label="Stato">
                <Select
                  allowClear
                  placeholder="Qualsiasi"
                  value={stato}
                  onChange={setStato}
                  style={{ width: '100%' }}
                  options={[
                    { value: 'saldato', label: 'Saldati' },
                    { value: 'aperto', label: 'Da saldare' },
                  ]}
                />
              </FiltroCampo>
              {categorieUsate.length > 0 && (
                <FiltroCampo label="Categoria">
                  <Select
                    allowClear
                    showSearch
                    optionFilterProp="label"
                    placeholder="Tutte"
                    value={categoriaF}
                    onChange={setCategoriaF}
                    style={{ width: '100%' }}
                    options={[
                      ...categorieUsate.map((c) => ({ value: c, label: c })),
                      { value: SENZA_CATEGORIA, label: SENZA_CATEGORIA },
                    ]}
                  />
                </FiltroCampo>
              )}
              {controparti.length > 0 && (
                <FiltroCampo label="Controparte">
                  <Select
                    allowClear
                    showSearch
                    optionFilterProp="label"
                    placeholder="Tutte"
                    value={controparteF}
                    onChange={setControparteF}
                    style={{ width: '100%' }}
                    options={controparti.map((c) => ({ value: c, label: c }))}
                  />
                </FiltroCampo>
              )}
              <FiltroCampo label="Importo (entrate e uscite)">
                <Space.Compact style={{ width: '100%' }}>
                  <Select
                    value={importoOp}
                    onChange={setImportoOp}
                    style={{ width: 90 }}
                    options={[
                      { value: 'maggiore', label: '≥' },
                      { value: 'minore', label: '≤' },
                    ]}
                  />
                  <InputNumber
                    min={0}
                    step={0.01}
                    placeholder="es. 100 o 130,40"
                    value={importoF}
                    onChange={setImportoF}
                    style={{ width: '100%' }}
                  />
                </Space.Compact>
              </FiltroCampo>
              <FiltroCampo label="Anno">
                <Select
                  allowClear
                  placeholder="Tutti gli anni"
                  value={annoF}
                  onChange={(v) => {
                    setAnnoF(v)
                    setMeseF(undefined)
                  }}
                  style={{ width: '100%' }}
                  options={anni}
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
            </FiltriDrawer>
          </div>
          {isMobile ? (
            <div className="lista-mobile">
              {vistaFiltrata.map((r) => (
                <div key={r.m.id} className="lista-card" onClick={() => apriModifica(r.m)}>
                  <div className="lista-card-top">
                    <div>
                      <div className="lista-card-title">{r.m.descrizione}</div>
                      <div className="lista-card-meta" style={{ marginTop: 5 }}>
                        {formatData(r.m.data, true)}
                        {r.m.controparte && <span>· {r.m.controparte}</span>}
                        {r.m.categoria && <Tag bordered={false}>{r.m.categoria}</Tag>}
                        {!r.m.saldato && (
                          <Tag color="warning">{r.m.tipo === 'entrata' ? 'Da incassare' : 'Da dare'}</Tag>
                        )}
                      </div>
                    </div>
                    <span onClick={(e) => e.stopPropagation()}>
                      <Popconfirm
                        title="Eliminare questo movimento?"
                        okText="Elimina"
                        cancelText="Annulla"
                        okButtonProps={{ danger: true }}
                        onConfirm={() => eliminaConUndo(conti, r.m, `«${r.m.descrizione}» eliminato.`)}
                      >
                        <Button type="text" danger icon={<DeleteOutlined />} />
                      </Popconfirm>
                    </span>
                  </div>
                  <div className="lista-card-meta">
                    <span
                      className="lista-card-num"
                      style={{ fontSize: 15, color: r.m.tipo === 'entrata' ? '#3f7a52' : '#b1352f' }}
                    >
                      {r.m.tipo === 'entrata' ? '+ ' : '− '}
                      {formatEuro(r.m.importo)}
                    </span>
                    <span className="lista-card-fine">
                      cassa <b className="lista-card-num">{formatEuro(r.cassa)}</b>
                    </span>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <Table
              rowKey={(r) => r.m.id}
              dataSource={vistaFiltrata}
              columns={columns}
              pagination={false}
              size="middle"
              sticky={{ offsetHeader }}
              scroll={{ x: 'max-content' }}
              onRow={(r) => ({ onClick: () => apriModifica(r.m), style: { cursor: 'pointer' } })}
            />
          )}
        </>
      )}

      <DettaglioMovimenti
        vista={dettaglio}
        movimenti={items}
        onClose={() => setDettaglio(null)}
        onApriMovimento={(m) => {
          setDettaglio(null)
          apriModifica(m)
        }}
      />

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
          <Form.Item label="Data" name="data" {...propsCampoData}>
            <DataPicker />
          </Form.Item>
          <Form.Item
            label="Descrizione"
            name="descrizione"
            rules={[{ required: true, message: 'Inserisci una descrizione' }]}
          >
            <Input placeholder="es. Sponsor, Pagamento campo…" autoComplete="off" />
          </Form.Item>
          <Form.Item label="Importo (€)" name="importo" rules={[{ required: true, message: 'Inserisci l’importo' }]}>
            <InputNumber min={0} step={0.01} style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item label="Controparte (facoltativa)" name="controparte">
            <Input placeholder="fornitore, sponsor…" autoComplete="off" />
          </Form.Item>
          <Form.Item
            label="Categoria (facoltativa)"
            name="categoria"
            tooltip="Serve per il grafico «Per categoria»: scegline una o scrivine una nuova"
          >
            <AutoComplete
              options={opzioniCategoria}
              placeholder="es. Quote, Bar, Arbitri…"
              allowClear
              filterOption={(input, opt) =>
                String(opt?.value ?? '').toLowerCase().includes(input.toLowerCase())
              }
            />
          </Form.Item>
          <Form.Item name="saldato" valuePropName="checked">
            <Checkbox>Già saldato (movimento chiuso, incide sulla cassa)</Checkbox>
          </Form.Item>
        </Form>
      </Modal>
    </>
  )
}
