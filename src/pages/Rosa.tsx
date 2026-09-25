import { useMemo, useState } from 'react'
import type { MouseEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  App,
  AutoComplete,
  Avatar,
  Button,
  Card,
  Empty,
  Form,
  Grid,
  Input,
  InputNumber,
  Modal,
  Popconfirm,
  Rate,
  Select,
  Space,
  Switch,
  Table,
  Tag,
} from 'antd'
import {
  PlusOutlined,
  CopyOutlined,
  DeleteOutlined,
  FileExcelOutlined,
  MedicineBoxOutlined,
  SearchOutlined,
  WarningOutlined,
} from '@ant-design/icons'
import { useCollection } from '../hooks/useCollection'
import { useEliminaUndo } from '../hooks/useEliminaUndo'
import { useAggancioLista } from '../hooks/useAggancioLista'
import { useArchivio } from '../data/ArchivioProvider'
import { CampoEuro } from '../components/CampoEuro'
import { PageHeader } from '../components/PageHeader'
import { FiltriDrawer, FiltroCampo } from '../components/FiltriDrawer'
import { DataPicker, propsCampoData } from '../components/DataPicker'
import { coloreRuolo, ordineRuolo, OPZIONI_RUOLI, RUOLO_BY_CODE, type Area } from '../ruoli'
import { statoCertificato } from '../lib/certificato'
import { statoScadenza } from '../lib/scadenza'
import { riepilogoQuote, statoQuota } from '../lib/quota'
import { esportaExcel } from '../lib/excel'
import { seduteSvolte } from '../lib/allenamenti'
import { isDirigente, isExtra, isGiocatore, OPZIONI_CATEGORIA, OPZIONI_RUOLI_DIRIGENZA, ripulisciTesserato, LABEL_CATEGORIA } from '../lib/categoria'
import type { Allenamento, Giocatore, Movimento, Partita } from '../types'
import { formatData, formatEuro, iniziali, plurale } from '../lib/format'

type Bozza = Pick<
  Giocatore,
  | 'nome'
  | 'cognome'
  | 'categoria'
  | 'ruoloDirigenza'
  | 'ruoloPreferito'
  | 'ruoliAdattati'
  | 'bravura'
  | 'numeroMaglia'
  | 'nascita'
  | 'tessera'
  | 'dataRilascio'
  | 'scadenzaDocumento'
  | 'certificatoMedico'
  | 'scadenzaCertificato'
  | 'quotaPagata'
  | 'quotaImporto'
  | 'quotaEsente'
  | 'infortunato'
  | 'rientroInfortunio'
  | 'note'
>

const STATI_QUOTA = [
  { value: 'no', label: 'Da pagare', color: 'red' },
  { value: 'pagata', label: 'Pagata', color: 'green' },
  { value: 'esente', label: 'Esente', color: 'blue' },
] as const

/**
 * La quota nella lista: con l'importo impostato lo stato deriva dai
 * versamenti (si vede e basta, si gestisce nella scheda); altrimenti si
 * sceglie qui fra da pagare, pagata ed esente.
 */
function CellaQuota({ g, onCambia }: { g: Giocatore; onCambia: (patch: Partial<Giocatore>) => void }) {
  const q = statoQuota(g)
  if (q.totale && !q.esente)
    return (
      <Tag color={q.completa ? 'green' : q.parziale ? 'orange' : 'red'} style={{ marginInlineEnd: 0 }}>
        {q.label}
      </Tag>
    )
  const valore = g.quotaEsente ? 'esente' : g.quotaPagata ? 'pagata' : 'no'
  return (
    <Select
      size="small"
      variant="borderless"
      value={valore}
      popupMatchSelectWidth={false}
      style={{ minWidth: 104 }}
      labelRender={({ value }) => {
        const s = STATI_QUOTA.find((x) => x.value === value)
        return <Tag color={s?.color} style={{ marginInlineEnd: 0 }}>{s?.label}</Tag>
      }}
      options={STATI_QUOTA.map((x) => ({ value: x.value, label: x.label }))}
      onChange={(v) =>
        onCambia(
          v === 'esente'
            ? { quotaEsente: true, quotaPagata: undefined }
            : { quotaEsente: undefined, quotaPagata: v === 'pagata' },
        )
      }
    />
  )
}

export function Rosa() {
  const giocatori = useCollection<Giocatore>('giocatori')
  const { items, add, update } = giocatori
  const eliminaConUndo = useEliminaUndo()
  const allenamenti = useCollection<Allenamento>('allenamenti')
  const partite = useCollection<Partita>('partite')
  const conti = useCollection<Movimento>('conti')
  const navigate = useNavigate()
  const screens = Grid.useBreakpoint()
  // la foto dell'archivio sul Drive, quando c'è, fa da avatar
  const archivio = useArchivio()
  const fotoDi = (g: Giocatore) => archivio.miniatura(archivio.scheda(g.id).foto?.id)
  const isMobile = !screens.sm
  const { message } = App.useApp()
  const { toolbarRef, offsetHeader } = useAggancioLista()
  const [modale, setModale] = useState(false)
  const [form] = Form.useForm()
  // chi è SOLO dirigente non ha campi da giocatore (ruoli, certificato, quota)
  const categoriaForm = Form.useWatch('categoria', form)
  const campiGiocatore = categoriaForm !== 'dirigente'
  const campiDirigente = categoriaForm === 'dirigente' || categoriaForm === 'entrambi'
  const infortunatoForm = Form.useWatch('infortunato', form)
  const esenteForm = Form.useWatch('quotaEsente', form)
  const [q, setQ] = useState('')
  const [repartoF, setRepartoF] = useState<Area | undefined>()
  const [ruoloF, setRuoloF] = useState<string | undefined>()
  const [categoriaF, setCategoriaF] = useState<string | undefined>()
  const [certF, setCertF] = useState<string | undefined>()
  const [quotaF, setQuotaF] = useState<string | undefined>()
  const [tesseraF, setTesseraF] = useState<string | undefined>()

  const nFiltri = [repartoF, ruoloF, categoriaF, certF, quotaF, tesseraF].filter(Boolean).length
  function azzeraFiltri() {
    setRepartoF(undefined)
    setRuoloF(undefined)
    setCategoriaF(undefined)
    setCertF(undefined)
    setQuotaF(undefined)
    setTesseraF(undefined)
  }

  /** Può giocare nel reparto? Conta il ruolo preferito e quelli adattati. */
  function inReparto(g: Giocatore, area: Area): boolean {
    return [g.ruoloPreferito, ...(g.ruoliAdattati ?? [])].some(
      (code) => code && RUOLO_BY_CODE[code]?.area === area,
    )
  }

  const presenze = useMemo(() => {
    const conteggio: Record<string, number> = {}
    // le sedute future (create dal calendario) non contano
    for (const a of seduteSvolte(allenamenti.items)) {
      for (const [id, presente] of Object.entries(a.presenze)) {
        if (presente) conteggio[id] = (conteggio[id] ?? 0) + 1
      }
    }
    return conteggio
  }, [allenamenti.items])

  // chi ha gol, assist o presenze in partita: eliminarlo lo toglie da classifiche e albo d'oro
  const conStatistiche = useMemo(() => {
    const ids = new Set<string>()
    for (const p of partite.items) {
      if (p.giocata === false) continue
      for (const m of p.marcatori ?? []) ids.add(m.giocatoreId)
      for (const a of p.assist ?? []) ids.add(a.giocatoreId)
      for (const id of [...(p.titolari ?? []), ...(p.subentrati ?? [])]) ids.add(id)
    }
    return ids
  }, [partite.items])
  const avvisoElimina = (g: Giocatore) =>
    conStatistiche.has(g.id)
      ? 'Ha gol, assist o presenze in partita: sparirà da classifiche e albo d\'oro. Meglio cambiarlo in categoria «Giocatore Extra».'
      : undefined

  const ordinati = useMemo(
    () =>
      [...items].sort(
        (a, b) =>
          ordineRuolo(a.ruoloPreferito) - ordineRuolo(b.ruoloPreferito) ||
          a.cognome.localeCompare(b.cognome),
      ),
    [items],
  )

  const filtrati = useMemo(
    () =>
      ordinati.filter((g) => {
        const nome = `${g.cognome} ${g.nome}`.toLowerCase()
        if (q && !nome.includes(q.toLowerCase())) return false
        if (repartoF && !inReparto(g, repartoF)) return false
        if (ruoloF && g.ruoloPreferito !== ruoloF && !(g.ruoliAdattati ?? []).includes(ruoloF))
          return false
        if (categoriaF === 'giocatore' && !isGiocatore(g)) return false
        if (categoriaF === 'dirigente' && !isDirigente(g)) return false
        if (categoriaF === 'extra' && !isExtra(g)) return false
        if (certF && (!isGiocatore(g) || statoCertificato(g).stato !== certF)) return false
        if (quotaF && !isGiocatore(g)) return false
        if (quotaF === 'pagata' && (!statoQuota(g).completa || g.quotaEsente)) return false
        if (quotaF === 'no' && statoQuota(g).completa) return false
        if (quotaF === 'esente' && !g.quotaEsente) return false
        if (tesseraF === 'si' && !g.tessera) return false
        if (tesseraF === 'no' && g.tessera) return false
        return true
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [ordinati, q, repartoF, ruoloF, categoriaF, certF, quotaF, tesseraF],
  )

  // le quote non passano dai Conti: qui si vede la cifra che a fine anno
  // chi le raccoglie registrerà come unica entrata
  const idMovimenti = useMemo(() => new Set(conti.items.map((m) => m.id)), [conti.items])
  const quote = useMemo(() => riepilogoQuote(items, idMovimenti), [items, idMovimenti])

  /**
   * I versamenti di prima del 2026-09-16 avevano il movimento gemello nei Conti:
   * lo toglie e stacca il collegamento, così tutto torna nel raccolto e a fine
   * anno si registra un'unica entrata.
   */
  function riportaNelRaccolto() {
    let n = 0
    for (const g of items) {
      const vecchi = (g.versamentiQuota ?? []).filter((v) => v.movimentoId)
      if (!vecchi.length) continue
      for (const v of vecchi) {
        if (idMovimenti.has(v.movimentoId!)) {
          conti.remove(v.movimentoId!)
          n++
        }
      }
      update(g.id, {
        versamentiQuota: (g.versamentiQuota ?? []).map((v) => (v.movimentoId ? { ...v, movimentoId: undefined } : v)),
      })
    }
    message.success(`Quote riportate nel raccolto${n ? `, ${plurale(n, 'movimento tolto', 'movimenti tolti')} dai Conti` : ''}.`)
  }

  async function copiaTotaleQuote() {
    try {
      await navigator.clipboard.writeText(String(quote.raccolto))
      message.success('Totale copiato: incollalo nel movimento dei Conti.')
    } catch {
      message.warning('Non riesco a copiare da solo: segnati la cifra a mano.')
    }
  }

  function apriNuovo() {
    form.resetFields()
    form.setFieldsValue({
      certificatoMedico: false,
      quotaPagata: false,
      ruoliAdattati: [],
      categoria: 'giocatore',
    })
    setModale(true)
  }

  function salva(valori: Bozza) {
    valori = ripulisciTesserato(valori)
    // un omonimo si può avere, ma va segnalato: archivio e albo d'oro
    // riconoscono le persone dal nome (e dalla data di nascita, se c'è)
    const stesso = (g: Giocatore) =>
      `${g.cognome} ${g.nome}`.toLowerCase() === `${valori.cognome} ${valori.nome}`.toLowerCase()
    const omonimo = items.find(stesso)
    add(valori)
    setModale(false)
    if (omonimo)
      message.warning(
        `C'era già un ${valori.cognome} ${valori.nome} in rosa: segna la data di nascita a entrambi, così l'archivio li distingue.`,
        6,
      )
  }

  // il click su Elimina (e sul suo Popconfirm) non deve aprire la scheda del giocatore
  const stopCell = { onCell: () => ({ onClick: (e: MouseEvent) => e.stopPropagation() }) }

  const columns = [
    {
      title: 'N.',
      key: 'numero',
      width: 56,
      align: 'center' as const,
      sorter: (a: Giocatore, b: Giocatore) => (a.numeroMaglia ?? 999) - (b.numeroMaglia ?? 999),
      render: (_: unknown, g: Giocatore) =>
        g.numeroMaglia != null ? <b style={{ fontVariantNumeric: 'tabular-nums' }}>{g.numeroMaglia}</b> : '—',
    },
    {
      title: 'Giocatore',
      key: 'nome',
      width: 240,
      sorter: (a: Giocatore, b: Giocatore) =>
        `${a.cognome} ${a.nome}`.localeCompare(`${b.cognome} ${b.nome}`),
      defaultSortOrder: 'ascend' as const,
      render: (_: unknown, g: Giocatore) => (
        <span>
          <Avatar
            src={fotoDi(g)}
            size={26}
            style={{ background: 'var(--rosso)', fontSize: 11, marginRight: 8, flex: 'none' }}
          >
            {iniziali(g)}
          </Avatar>
          <span
            className="tronca"
            style={{ maxWidth: 140, fontWeight: 600 }}
            title={`${g.cognome} ${g.nome}`}
          >
            {g.cognome} {g.nome}
          </span>
          {isDirigente(g) && (
            <Tag color="purple" style={{ marginLeft: 8 }}>
              {g.categoria === 'entrambi' ? 'Gioc. + Dir.' : 'Dirigente'}
            </Tag>
          )}
          {isExtra(g) && (
            <Tag color="cyan" style={{ marginLeft: 8 }}>
              Extra
            </Tag>
          )}
          {isGiocatore(g) && g.infortunato && (
            <Tag color="red" icon={<MedicineBoxOutlined />} style={{ marginLeft: 8 }}>
              Infortunato
            </Tag>
          )}
        </span>
      ),
    },
    {
      title: 'Ruolo',
      key: 'ruolo',
      width: 100,
      sorter: (a: Giocatore, b: Giocatore) =>
        (a.ruoloPreferito ?? '').localeCompare(b.ruoloPreferito ?? ''),
      render: (_: unknown, g: Giocatore) => {
        if (g.ruoloPreferito) return <Tag color={coloreRuolo(g.ruoloPreferito)}>{g.ruoloPreferito}</Tag>
        if (!isGiocatore(g) && g.ruoloDirigenza) return <Tag color="purple">{g.ruoloDirigenza}</Tag>
        return '—'
      },
    },
    {
      title: 'Adattato',
      key: 'adattati',
      width: 150,
      render: (_: unknown, g: Giocatore) =>
        g.ruoliAdattati?.length ? (
          <Space size={[4, 4]} wrap>
            {g.ruoliAdattati.map((r) => (
              <Tag key={r} color={coloreRuolo(r)} style={{ opacity: 0.75 }}>
                {r}
              </Tag>
            ))}
          </Space>
        ) : (
          '—'
        ),
    },
    {
      title: 'Pres.',
      key: 'pres',
      align: 'right' as const,
      width: 80,
      sorter: (a: Giocatore, b: Giocatore) => (presenze[a.id] ?? 0) - (presenze[b.id] ?? 0),
      render: (_: unknown, g: Giocatore) => (isGiocatore(g) ? (presenze[g.id] ?? 0) : '—'),
    },
    {
      title: 'Certificato',
      key: 'cert',
      width: 140,
      sorter: (a: Giocatore, b: Giocatore) =>
        (a.scadenzaCertificato ?? '').localeCompare(b.scadenzaCertificato ?? ''),
      render: (_: unknown, g: Giocatore) => {
        if (!isGiocatore(g)) return '—'
        const s = statoCertificato(g)
        return <Tag color={s.color}>{s.label}</Tag>
      },
    },
    {
      title: 'Tessera',
      key: 'tessera',
      width: 130,
      sorter: (a: Giocatore, b: Giocatore) => (a.tessera ?? '').localeCompare(b.tessera ?? ''),
      render: (_: unknown, g: Giocatore) =>
        g.tessera ? (
          <Tag color="default">{g.tessera}</Tag>
        ) : (
          <Tag color="orange" icon={<WarningOutlined />}>
            Mancante
          </Tag>
        ),
    },
    {
      title: 'Scad. documento',
      key: 'documento',
      width: 170,
      sorter: (a: Giocatore, b: Giocatore) =>
        (a.scadenzaDocumento ?? '').localeCompare(b.scadenzaDocumento ?? ''),
      render: (_: unknown, g: Giocatore) => {
        if (!g.scadenzaDocumento) return '—'
        const s = statoScadenza(g.scadenzaDocumento)
        return (
          <Space size={4}>
            <span style={{ color: s.critico ? 'var(--rosso-testo)' : undefined, fontWeight: s.critico ? 600 : undefined }}>
              {formatData(g.scadenzaDocumento, true)}
            </span>
            {s.label && <Tag color={s.color}>{s.label}</Tag>}
          </Space>
        )
      },
    },
    {
      title: 'Quota',
      key: 'quota',
      width: 124,
      // prima lo stato (saldata o no), poi quanto è stato versato
      sorter: (a: Giocatore, b: Giocatore) => {
        const qa = statoQuota(a)
        const qb = statoQuota(b)
        return Number(qa.completa) - Number(qb.completa) || qa.versato - qb.versato
      },
      ...stopCell,
      render: (_: unknown, g: Giocatore) => {
        if (!isGiocatore(g)) return '—'
        return <CellaQuota g={g} onCambia={(patch) => update(g.id, patch)} />
      },
    },
    {
      title: '',
      key: 'azioni',
      width: 60,
      ...stopCell,
      render: (_: unknown, g: Giocatore) => (
        <Popconfirm
          title={`Eliminare ${g.nome} ${g.cognome}?`}
          description={avvisoElimina(g)}
          okText="Elimina"
          cancelText="Annulla"
          okButtonProps={{ danger: true }}
          onConfirm={() => eliminaConUndo(giocatori, g, `${g.cognome} ${g.nome} eliminato.`)}
        >
          <Button type="text" danger icon={<DeleteOutlined />} />
        </Popconfirm>
      ),
    },
  ]

  /** Scarica la lista visibile (con i filtri applicati) in un foglio Excel. */
  function esporta() {
    esportaExcel('rosa.xlsx', [
      {
        nome: 'Rosa',
        righe: filtrati.map((g) => ({
          Cognome: g.cognome,
          Nome: g.nome,
          Categoria: LABEL_CATEGORIA[g.categoria ?? 'giocatore'],
          'Ruolo dirigenza': g.ruoloDirigenza ?? '',
          Ruolo: g.ruoloPreferito ?? '',
          'Ruoli adattati': (g.ruoliAdattati ?? []).join(', '),
          'N. maglia': g.numeroMaglia ?? '',
          Nascita: g.nascita ?? '',
          Tessera: g.tessera ?? '',
          'Rilascio tessera': g.dataRilascio ?? '',
          'Scadenza documento': g.scadenzaDocumento ?? '',
          Certificato: isGiocatore(g) ? statoCertificato(g).label : '',
          'Scadenza certificato': g.scadenzaCertificato ?? '',
          Quota: isGiocatore(g) ? statoQuota(g).label : '',
          Infortunato: g.infortunato ? 'Sì' : '',
          'Presenze allenamenti': isGiocatore(g) ? (presenze[g.id] ?? 0) : '',
          Note: g.note ?? '',
        })),
      },
    ])
  }

  return (
    <>
      <PageHeader
        titolo="Rosa"
        sottotitolo={`${plurale(items.length, 'tesserato', 'tesserati')} · tocca un nome per la scheda`}
        azioni={
          items.length > 0 && (
            <Space wrap>
              <Button icon={<FileExcelOutlined />} onClick={esporta}>
                Esporta Excel
              </Button>
              <Button type="primary" icon={<PlusOutlined />} onClick={apriNuovo}>
                Aggiungi giocatore
              </Button>
            </Space>
          )
        }
      />

      {items.length === 0 ? (
        <Empty description="Nessun giocatore in rosa">
          <Button type="primary" icon={<PlusOutlined />} onClick={apriNuovo}>
            Aggiungi il primo
          </Button>
        </Empty>
      ) : (
        <>
          {(quote.raccolto > 0 || quote.atteso > 0 || quote.saldati > 0 || quote.giaNeiConti > 0) && (
            <Card size="small" className="quote-riepilogo">
              <div className="quote-riepilogo-cifre">
                <div className="quote-riepilogo-voce">
                  <span className="quote-riepilogo-etichetta">Raccolto finora</span>
                  <b className="quote-riepilogo-num">{formatEuro(quote.raccolto)}</b>
                </div>
                {quote.mancante > 0 && (
                  <div className="quote-riepilogo-voce">
                    <span className="quote-riepilogo-etichetta">Ancora da incassare</span>
                    <b className="quote-riepilogo-num aperto">{formatEuro(quote.mancante)}</b>
                  </div>
                )}
                <div className="quote-riepilogo-voce">
                  <span className="quote-riepilogo-etichetta">Quote saldate</span>
                  <b className="quote-riepilogo-num">
                    {quote.saldati}/{quote.totali}
                  </b>
                  {quote.esenti > 0 && (
                    <span className="quote-riepilogo-etichetta">
                      + {quote.esenti} {quote.esenti === 1 ? 'esente' : 'esenti'}
                    </span>
                  )}
                </div>
                <Button size="small" icon={<CopyOutlined />} onClick={copiaTotaleQuote}>
                  Copia totale
                </Button>
              </div>
              <div className="quote-riepilogo-nota">
                Le quote non entrano nei Conti da sole: a fine anno chi le raccoglie registra il totale
                come unica entrata.
                {quote.soloInterruttore > 0 &&
                  ` Il raccolto esclude i pagati segnati solo con l'interruttore (${quote.soloInterruttore}).`}
                {quote.giaNeiConti > 0 &&
                  ` ${formatEuro(quote.giaNeiConti)} dei versamenti vecchi sono ancora come movimenti nei Conti.`}
                {quote.giaNeiConti > 0 && (
                  <Popconfirm
                    title="Riportare queste quote nel raccolto?"
                    description={`Toglie dai Conti i vecchi movimenti automatici delle quote (${formatEuro(quote.giaNeiConti)}).`}
                    okText="Riporta"
                    cancelText="Annulla"
                    onConfirm={riportaNelRaccolto}
                  >
                    <Button type="link" size="small">
                      Riporta nel raccolto
                    </Button>
                  </Popconfirm>
                )}
              </div>
            </Card>
          )}
          <div className="lista-toolbar" ref={toolbarRef}>
            <Input
              className="lista-cerca"
              allowClear
              autoComplete="off"
              prefix={<SearchOutlined />}
              placeholder="Cerca giocatore"
              value={q}
              onChange={(e) => setQ(e.target.value)}
            />
            <FiltriDrawer count={nFiltri} onReset={azzeraFiltri}>
              <FiltroCampo label="Reparto">
                <Select
                  allowClear
                  placeholder="Tutti i reparti"
                  value={repartoF}
                  onChange={setRepartoF}
                  options={[
                    { value: 'Portiere', label: 'Portieri' },
                    { value: 'Difesa', label: 'Difensori' },
                    { value: 'Centrocampo', label: 'Centrocampisti' },
                    { value: 'Attacco', label: 'Attaccanti' },
                  ]}
                  style={{ width: '100%' }}
                />
              </FiltroCampo>
              <FiltroCampo label="Ruolo">
                <Select
                  allowClear
                  showSearch
                  optionFilterProp="label"
                  placeholder="Tutti i ruoli"
                  value={ruoloF}
                  onChange={setRuoloF}
                  options={OPZIONI_RUOLI}
                  style={{ width: '100%' }}
                />
              </FiltroCampo>
              <FiltroCampo label="Categoria">
                <Select
                  allowClear
                  placeholder="Tutte"
                  value={categoriaF}
                  onChange={setCategoriaF}
                  options={[
                    { value: 'giocatore', label: 'Giocatori' },
                    { value: 'dirigente', label: 'Dirigenti' },
                    { value: 'extra', label: 'Giocatori Extra' },
                  ]}
                  style={{ width: '100%' }}
                />
              </FiltroCampo>
              <FiltroCampo label="Certificato">
                <Select
                  allowClear
                  placeholder="Qualsiasi stato"
                  value={certF}
                  onChange={setCertF}
                  options={[
                    { value: 'valido', label: 'Certificato valido' },
                    { value: 'scadenza', label: 'In scadenza' },
                    { value: 'critico', label: 'Da regolarizzare' },
                  ]}
                  style={{ width: '100%' }}
                />
              </FiltroCampo>
              <FiltroCampo label="Quota">
                <Select
                  allowClear
                  placeholder="Qualsiasi"
                  value={quotaF}
                  onChange={setQuotaF}
                  options={[
                    { value: 'pagata', label: 'Quota pagata' },
                    { value: 'no', label: 'Quota non pagata' },
                    { value: 'esente', label: 'Esenti dalla quota' },
                  ]}
                  style={{ width: '100%' }}
                />
              </FiltroCampo>
              <FiltroCampo label="Tessera">
                <Select
                  allowClear
                  placeholder="Qualsiasi"
                  value={tesseraF}
                  onChange={setTesseraF}
                  options={[
                    { value: 'si', label: 'Con tessera' },
                    { value: 'no', label: 'Senza tessera' },
                  ]}
                  style={{ width: '100%' }}
                />
              </FiltroCampo>
            </FiltriDrawer>
          </div>
          {isMobile ? (
            <div className="lista-mobile">
              {filtrati.map((g) => {
                const cert = statoCertificato(g)
                const doc = statoScadenza(g.scadenzaDocumento)
                return (
                  <div key={g.id} className="lista-card" onClick={() => navigate(`/rosa/${g.id}`)}>
                    <div className="lista-card-top">
                      <div className="lista-card-persona">
                        <Avatar
                          src={fotoDi(g)}
                          size={40}
                          style={{ background: 'var(--rosso)', fontSize: 15, flex: 'none' }}
                        >
                          {iniziali(g)}
                        </Avatar>
                        <div>
                          <div className="lista-card-title">
                            {g.numeroMaglia != null && (
                              <span style={{ color: 'var(--testo-2)', marginRight: 6 }}>{g.numeroMaglia}</span>
                            )}
                            {g.cognome} {g.nome}
                            {isDirigente(g) && (
                              <Tag color="purple" style={{ marginLeft: 6 }}>
                                {g.categoria === 'entrambi' ? 'Gioc. + Dir.' : 'Dirigente'}
                              </Tag>
                            )}
                            {isExtra(g) && (
                              <Tag color="cyan" style={{ marginLeft: 6 }}>
                                Extra
                              </Tag>
                            )}
                            {isGiocatore(g) && g.infortunato && (
                              <Tag color="red" style={{ marginLeft: 6 }}>
                                Infortunato
                              </Tag>
                            )}
                          </div>
                          <div className="lista-card-meta" style={{ marginTop: 5 }}>
                            {g.ruoloPreferito ? (
                              <Tag color={coloreRuolo(g.ruoloPreferito)}>{g.ruoloPreferito}</Tag>
                            ) : !isGiocatore(g) ? (
                              g.ruoloDirigenza && <Tag color="purple">{g.ruoloDirigenza}</Tag>
                            ) : (
                              <span>Ruolo n.d.</span>
                            )}
                            {g.ruoliAdattati?.map((r) => (
                              <Tag key={r} color={coloreRuolo(r)} style={{ opacity: 0.7 }}>
                                {r}
                              </Tag>
                            ))}
                          </div>
                        </div>
                      </div>
                      <span onClick={(e) => e.stopPropagation()}>
                        <Popconfirm
                          title={`Eliminare ${g.nome} ${g.cognome}?`}
                          description={avvisoElimina(g)}
                          okText="Elimina"
                          cancelText="Annulla"
                          okButtonProps={{ danger: true }}
                          onConfirm={() => eliminaConUndo(giocatori, g, `${g.cognome} ${g.nome} eliminato.`)}
                        >
                          <Button type="text" danger icon={<DeleteOutlined />} />
                        </Popconfirm>
                      </span>
                    </div>
                    <div className="lista-card-meta">
                      {isGiocatore(g) && <Tag color={cert.color}>{cert.label}</Tag>}
                      {g.tessera ? (
                        <Tag>{g.tessera}</Tag>
                      ) : (
                        <Tag color="orange" icon={<WarningOutlined />}>
                          Tessera mancante
                        </Tag>
                      )}
                      {doc.label && <Tag color={doc.color}>Documento {doc.label.toLowerCase()}</Tag>}
                      {isGiocatore(g) && <span>· {presenze[g.id] ?? 0} pres.</span>}
                      {isGiocatore(g) && (
                        <span className="lista-card-fine" onClick={(e) => e.stopPropagation()}>
                          Quota <CellaQuota g={g} onCambia={(patch) => update(g.id, patch)} />
                        </span>
                      )}
                    </div>
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
              onRow={(g) => ({ onClick: () => navigate(`/rosa/${g.id}`), style: { cursor: 'pointer' } })}
            />
          )}
        </>
      )}

      <Modal
        title={categoriaForm === 'dirigente' ? 'Nuovo dirigente' : 'Nuovo giocatore'}
        open={modale}
        onCancel={() => setModale(false)}
        onOk={() => form.submit()}
        okText="Aggiungi"
        cancelText="Annulla"
        maskClosable={false}
        forceRender
      >
        <Form form={form} layout="vertical" onFinish={salva} requiredMark={false}>
          <Form.Item label="Nome" name="nome" rules={[{ required: true, whitespace: true, message: 'Inserisci il nome' }]}>
            <Input autoComplete="off" />
          </Form.Item>
          <Form.Item
            label="Cognome"
            name="cognome"
            rules={[{ required: true, whitespace: true, message: 'Inserisci il cognome' }]}
          >
            <Input autoComplete="off" />
          </Form.Item>
          <Form.Item label="Categoria" name="categoria">
            <Select options={OPZIONI_CATEGORIA} />
          </Form.Item>
          {campiDirigente && (
            <Form.Item label="Ruolo in dirigenza (facoltativo)" name="ruoloDirigenza">
              <AutoComplete
                options={OPZIONI_RUOLI_DIRIGENZA}
                placeholder="es. Presidente, Segretario…"
                allowClear
                filterOption={(input, opt) =>
                  String(opt?.value ?? '').toLowerCase().includes(input.toLowerCase())
                }
              />
            </Form.Item>
          )}
          {campiGiocatore && (
            <>
              <Form.Item label="Ruolo preferito" name="ruoloPreferito">
                <Select options={OPZIONI_RUOLI} placeholder="es. DC — Difensore centrale" allowClear showSearch optionFilterProp="label" />
              </Form.Item>
              <Form.Item label="Ruoli adattati" name="ruoliAdattati">
                <Select
                  mode="multiple"
                  options={OPZIONI_RUOLI}
                  placeholder="uno o più ruoli"
                  allowClear
                  showSearch
                  optionFilterProp="label"
                />
              </Form.Item>
              <Form.Item label="Bravura" name="bravura" tooltip="Quanto è forte, da 1 a 5: pesa nel generatore di formazione">
                <Rate />
              </Form.Item>
              <Form.Item
                label="Numero di maglia (facoltativo)"
                name="numeroMaglia"
                tooltip="Precompila la distinta e la grafica della formazione"
              >
                <InputNumber min={1} max={99} style={{ width: '100%' }} placeholder="es. 10" />
              </Form.Item>
            </>
          )}
          <Form.Item label="Data di nascita (gg/mm/aaaa)" name="nascita">
            <Input placeholder="es. 12/03/2001" autoComplete="off" />
          </Form.Item>
          <Form.Item label="N. tessera" name="tessera">
            <Input autoComplete="off" />
          </Form.Item>
          <Form.Item label="Data rilascio tessera" name="dataRilascio">
            <Input placeholder="es. 01/09/2026" autoComplete="off" />
          </Form.Item>
          <Form.Item
            label="Scadenza documento d'identità"
            name="scadenzaDocumento"
            tooltip="Fine validità della carta d'identità (o del documento usato in distinta)"
            {...propsCampoData}
          >
            <DataPicker />
          </Form.Item>
          {campiGiocatore && (
            <>
              <Form.Item label="Certificato medico consegnato" name="certificatoMedico" valuePropName="checked">
                <Switch />
              </Form.Item>
              <Form.Item label="Scadenza certificato" name="scadenzaCertificato" {...propsCampoData}>
                <DataPicker />
              </Form.Item>
              <Form.Item
                label="Esente dalla quota"
                name="quotaEsente"
                valuePropName="checked"
                tooltip="Non deve pagare la quota (es. allenatore che gioca, accordi): non compare fra le quote da incassare"
              >
                <Switch />
              </Form.Item>
              {!esenteForm && (
                <>
                  <Form.Item
                    label="Importo quota (€)"
                    name="quotaImporto"
                    tooltip="Se impostato, lo stato della quota deriva dai versamenti registrati nella scheda"
                  >
                    <CampoEuro placeholder="es. 150" />
                  </Form.Item>
                  <Form.Item label="Quota associativa pagata" name="quotaPagata" valuePropName="checked">
                    <Switch />
                  </Form.Item>
                </>
              )}
              <Form.Item label="Infortunato" name="infortunato" valuePropName="checked">
                <Switch />
              </Form.Item>
              {infortunatoForm && (
                <Form.Item label="Rientro previsto" name="rientroInfortunio" {...propsCampoData}>
                  <DataPicker />
                </Form.Item>
              )}
            </>
          )}
          <Form.Item label="Note" name="note">
            <Input.TextArea rows={3} placeholder="es. taglia maglia, recapiti, incarichi…" autoComplete="off" />
          </Form.Item>
        </Form>
      </Modal>
    </>
  )
}
