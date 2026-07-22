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
import {
  PlusOutlined,
  MinusOutlined,
  DeleteOutlined,
  FileExcelOutlined,
  SearchOutlined,
  ThunderboltOutlined,
  AudioOutlined,
} from '@ant-design/icons'
import { useCollection } from '../../hooks/useCollection'
import { useEliminaUndo } from '../../hooks/useEliminaUndo'
import { useAggancioLista } from '../../hooks/useAggancioLista'
import { useDettatura } from '../../hooks/useDettatura'
import { DataPicker, propsCampoData } from '../../components/DataPicker'
import { formatData } from '../../lib/format'
import { statoScadenza, giorniAllaScadenza, GIORNI_ALLARME } from '../../lib/scadenza'
import { sottoScorta } from '../../lib/scorta'
import { esportaExcel } from '../../lib/excel'
import { compilaVoce } from '../../lib/compilaVoce'
import { CopiaLista } from './CopiaLista'
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
  /** campo "scrivi e compilo io" nella modale di aggiunta (frase libera in italiano) */
  conCompilazione?: boolean
  /** esempio mostrato nel campo di compilazione rapida */
  esempioCompilazione?: string
  /** parole chiave per indovinare la categoria dalla frase (categoria → parole/radici) */
  paroleCategoria?: Record<string, string[]>
}

type Bozza = Omit<VoceMagazzino, 'id'>

export function InventarioTab({ config }: { config: ConfigInventario }) {
  const { collezione, nuovoLabel, singolare, plurale, categorie, conQuantita, conScadenza, conNote } =
    config
  const coll = useCollection<VoceMagazzino>(collezione)
  const { items, add, update } = coll
  const eliminaConUndo = useEliminaUndo()
  const screens = Grid.useBreakpoint()
  const { toolbarRef, offsetHeader } = useAggancioLista()
  const isMobile = !screens.sm
  const [modale, setModale] = useState(false)
  const [inModifica, setInModifica] = useState<VoceMagazzino | null>(null)
  const [rapida, setRapida] = useState('')
  const [form] = Form.useForm()
  const dettatura = useDettatura((testo) => aggiornaRapida(testo))

  const [q, setQ] = useState('')
  const [cat, setCat] = useState<string | undefined>()
  const [entroGiorni, setEntroGiorni] = useState<number | null>(null)
  const [soloEsauriti, setSoloEsauriti] = useState(false)
  const [soloSottoScorta, setSoloSottoScorta] = useState(false)

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
        if (conQuantita && soloSottoScorta && !sottoScorta(a)) return false
        return true
      }),
    [ordinati, q, cat, entroGiorni, soloEsauriti, soloSottoScorta, categorie, conScadenza, conQuantita, conNote],
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

  const nSottoScorta = useMemo(
    () => (conQuantita ? items.filter(sottoScorta).length : 0),
    [items, conQuantita],
  )

  function adegua(a: VoceMagazzino, delta: number) {
    update(a.id, { quantita: Math.max(0, (a.quantita ?? 0) + delta) })
  }
  function apriNuovo() {
    setInModifica(null)
    setRapida('')
    form.resetFields()
    form.setFieldsValue({
      ...(categorie ? { categoria: categorie[0] } : {}),
      ...(conQuantita ? { quantita: 1 } : {}),
    })
    setModale(true)
  }

  /** compilazione rapida: interpreta la frase e riempie i campi del form */
  function aggiornaRapida(testo: string) {
    setRapida(testo)
    if (!testo.trim()) return
    const r = compilaVoce(testo, config.paroleCategoria)
    form.setFieldsValue({
      nome: r.nome ?? '',
      ...(conQuantita ? { quantita: r.quantita ?? 1 } : {}),
      ...(conScadenza ? { scadenza: r.scadenza } : {}),
      ...(r.categoria && categorie ? { categoria: r.categoria } : {}),
    })
  }

  const anteprimaRapida = rapida.trim() ? compilaVoce(rapida, config.paroleCategoria) : null

  function chiudiModale() {
    dettatura.ferma()
    setModale(false)
  }

  const cosaCapisco = [
    conQuantita && 'quantità',
    'nome',
    conScadenza && 'scadenza',
    categorie && 'categoria',
  ]
    .filter(Boolean)
    .join(', ')
  function apriModifica(a: VoceMagazzino) {
    setInModifica(a)
    form.setFieldsValue(a)
    setModale(true)
  }
  function salva(valori: Bozza) {
    if (inModifica) update(inModifica.id, valori)
    else add(valori)
    dettatura.ferma()
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
    width: 190,
    sorter: (a: VoceMagazzino, b: VoceMagazzino) => (a.quantita ?? 0) - (b.quantita ?? 0),
    ...stopCell,
    render: (_: unknown, a: VoceMagazzino) => (
      <Space size={6}>
        <Space.Compact>
          <Button icon={<MinusOutlined />} onClick={() => adegua(a, -1)} disabled={(a.quantita ?? 0) <= 0} />
          <Button style={{ pointerEvents: 'none', minWidth: 56 }}>
            <b
              style={{
                color:
                  (a.quantita ?? 0) === 0 ? '#b1352f' : sottoScorta(a) ? '#9a6b1e' : undefined,
              }}
            >
              {a.quantita ?? 0}
            </b>
          </Button>
          <Button icon={<PlusOutlined />} onClick={() => adegua(a, +1)} />
        </Space.Compact>
        {sottoScorta(a) && (
          <Tag color="gold" style={{ marginInlineEnd: 0 }} title={`Scorta minima: ${a.scortaMinima}`}>
            Riordina
          </Tag>
        )}
      </Space>
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
        onConfirm={() => eliminaConUndo(coll, a, `${a.nome} eliminato.`)}
      >
        <Button type="text" danger icon={<DeleteOutlined />} />
      </Popconfirm>
    ),
  }

  /** Scarica la lista visibile (con i filtri applicati) in un foglio Excel. */
  function esporta() {
    esportaExcel(`${collezione}.xlsx`, [
      {
        nome: plurale[0].toUpperCase() + plurale.slice(1),
        righe: filtrati.map((a) => ({
          Nome: a.nome,
          ...(categorie ? { Categoria: a.categoria ?? '' } : {}),
          ...(conQuantita ? { Quantità: a.quantita ?? 0, 'Scorta minima': a.scortaMinima ?? '' } : {}),
          ...(conScadenza ? { Scadenza: a.scadenza ?? '' } : {}),
          ...(conNote ? { Note: a.note ?? '' } : {}),
        })),
      },
    ])
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
          {nSottoScorta > 0 && <Tag color="gold">{nSottoScorta} sotto scorta</Tag>}
        </Space>
        {items.length > 0 && (
          <Space wrap>
            <CopiaLista
              items={ordinati}
              categorie={categorie}
              conQuantita={conQuantita}
              conScadenza={conScadenza}
            />
            <Button icon={<FileExcelOutlined />} onClick={esporta}>
              Esporta Excel
            </Button>
            <Button type="primary" icon={<PlusOutlined />} onClick={apriNuovo}>
              {nuovoLabel}
            </Button>
          </Space>
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
          <div className="filtri-aggancio" ref={toolbarRef}>
          <Space wrap className="filtri-inline">
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
            {conQuantita && nSottoScorta > 0 && (
              <Checkbox checked={soloSottoScorta} onChange={(e) => setSoloSottoScorta(e.target.checked)}>
                Solo sotto scorta
              </Checkbox>
            )}
          </Space>
          </div>

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
                          onConfirm={() => eliminaConUndo(coll, a, `${a.nome} eliminato.`)}
                        >
                          <Button type="text" danger icon={<DeleteOutlined />} />
                        </Popconfirm>
                      </span>
                    </div>
                    {conQuantita && (
                      <div className="lista-card-meta" onClick={(e) => e.stopPropagation()}>
                        <span>Quantità</span>
                        {sottoScorta(a) && <Tag color="gold">Riordina</Tag>}
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
              sticky={{ offsetHeader }}
              scroll={{ x: 'max-content' }}
              rowClassName={(a) =>
                conScadenza && statoScadenza(a.scadenza).critico
                  ? 'riga-scadenza-allarme'
                  : conQuantita && sottoScorta(a)
                    ? 'riga-scorta-bassa'
                    : ''
              }
              onRow={(a) => ({ onClick: () => apriModifica(a), style: { cursor: 'pointer' } })}
            />
          )}
        </>
      )}

      <Modal
        title={inModifica ? `Modifica ${singolare}` : nuovoLabel}
        open={modale}
        onCancel={chiudiModale}
        onOk={() => form.submit()}
        okText={inModifica ? 'Salva' : 'Aggiungi'}
        cancelText="Annulla"
        maskClosable={false}
        forceRender
      >
        {config.conCompilazione && !inModifica && (
          <div className="compila-box">
            <Text strong style={{ display: 'block', marginBottom: 6 }}>
              <ThunderboltOutlined style={{ color: 'var(--oro)' }} /> Scrivi (o detta) e compilo io
            </Text>
            <Space.Compact style={{ width: '100%' }}>
              <Input
                allowClear
                autoComplete="off"
                placeholder={
                  dettatura.ascolto
                    ? 'Parla pure, ti ascolto…'
                    : (config.esempioCompilazione ?? 'es. "4 patatine chips che scadono il 28/08/2026"')
                }
                value={rapida}
                onChange={(e) => aggiornaRapida(e.target.value)}
              />
              {dettatura.supportata && (
                <Button
                  icon={<AudioOutlined />}
                  danger={dettatura.ascolto}
                  type={dettatura.ascolto ? 'primary' : 'default'}
                  className={dettatura.ascolto ? 'mic-attivo' : undefined}
                  onClick={() => (dettatura.ascolto ? dettatura.ferma() : dettatura.avvia(rapida))}
                  aria-label={dettatura.ascolto ? 'Ferma la dettatura' : 'Detta a voce'}
                  title={
                    dettatura.ascolto
                      ? 'Sto ascoltando: tocca per fermare'
                      : rapida.trim()
                        ? 'Detta a voce: si aggiunge a quello che c’è già'
                        : 'Detta a voce'
                  }
                />
              )}
            </Space.Compact>
            {dettatura.errore && (
              <Text type="danger" style={{ display: 'block', marginTop: 6, fontSize: 12.5 }}>
                {dettatura.errore}
              </Text>
            )}
            {anteprimaRapida && (
              <Space wrap size={4} style={{ marginTop: 8 }}>
                {anteprimaRapida.nome ||
                anteprimaRapida.quantita != null ||
                anteprimaRapida.scadenza ||
                anteprimaRapida.categoria ? (
                  <>
                    <Text type="secondary" style={{ fontSize: 13 }}>
                      Ho capito:
                    </Text>
                    {conQuantita && anteprimaRapida.quantita != null && (
                      <Tag>{anteprimaRapida.quantita} pz</Tag>
                    )}
                    {anteprimaRapida.nome && <Tag>{anteprimaRapida.nome}</Tag>}
                    {conScadenza && anteprimaRapida.scadenza && (
                      <Tag color="gold">scade {formatData(anteprimaRapida.scadenza, true)}</Tag>
                    )}
                    {anteprimaRapida.categoria && (
                      <Tag color={coloreCategoria(anteprimaRapida.categoria)}>
                        {anteprimaRapida.categoria}
                      </Tag>
                    )}
                  </>
                ) : (
                  <Text type="secondary" style={{ fontSize: 13 }}>
                    Non ho riconosciuto niente: compila i campi qui sotto.
                  </Text>
                )}
              </Space>
            )}
            <Text type="secondary" style={{ display: 'block', marginTop: 6, fontSize: 12 }}>
              Capisco {cosaCapisco}; puoi sempre correggere i campi a mano. Se ridetti col
              microfono, quello che dici si aggiunge in coda.
            </Text>
          </div>
        )}
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
          {conQuantita && (
            <Form.Item
              label="Scorta minima (facoltativa)"
              name="scortaMinima"
              tooltip="Quando la quantità scende a questa soglia l'articolo viene segnalato da riordinare"
            >
              <InputNumber min={1} style={{ width: '100%' }} placeholder="es. 5" />
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
