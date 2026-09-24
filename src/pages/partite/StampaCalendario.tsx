import { useEffect, useMemo, useRef, useState } from 'react'
import {
  App,
  Button,
  Checkbox,
  Col,
  DatePicker,
  Divider,
  Grid,
  Input,
  Modal,
  Row,
  Segmented,
  Select,
  Space,
  Switch,
  Typography,
} from 'antd'
import { FilePdfOutlined, PictureOutlined } from '@ant-design/icons'
import dayjs, { type Dayjs } from 'dayjs'
import { FiltroCampo } from '../../components/FiltriDrawer'
import { formatData, isoDa, oggiIso } from '../../lib/format'
import type { Allenamento, Appuntamento, Partita, Torneo } from '../../types'
import {
  blocchiCalendario,
  esportaCalendarioPdf,
  esportaCalendarioPng,
  htmlFoglio,
  larghezzaFoglio,
  type Colonna,
  type Impaginazione,
  type OpzioniCalendario,
} from './calendarioStampa'

const { Text } = Typography

type Preset = '30g' | 'mese' | 'prossimoMese' | '3m' | 'stagione' | 'personalizzato'

const PRESET: { value: Preset; label: string }[] = [
  { value: '30g', label: 'Prossimi 30 giorni' },
  { value: 'mese', label: 'Questo mese' },
  { value: 'prossimoMese', label: 'Il mese prossimo' },
  { value: '3m', label: 'Prossimi 3 mesi' },
  { value: 'stagione', label: 'Fino a fine stagione' },
  { value: 'personalizzato', label: 'Date a scelta…' },
]

const COLONNE: { value: Colonna; label: string }[] = [
  { value: 'ora', label: 'Orario' },
  { value: 'competizione', label: 'Competizione' },
  { value: 'risultato', label: 'Risultato (partite giocate)' },
  { value: 'note', label: 'Note della partita' },
  { value: 'ritrovo', label: 'Colonna "Ritrovo" da compilare a penna' },
]

/** Fine stagione: il 30 giugno dell'anno dopo ("2026/27" → 2027-06-30). */
function fineStagione(stagione: string): string {
  const anno = Number(stagione.slice(0, 4))
  return Number.isFinite(anno) ? `${anno + 1}-06-30` : dayjs().add(1, 'year').format('YYYY-MM-DD')
}

function intervallo(
  p: Preset,
  stagione: string,
  scelto: [string, string] | null,
  conGiocate: boolean,
): [string, string] {
  const oggi = dayjs()
  switch (p) {
    case '30g':
      return [oggiIso(), oggi.add(30, 'day').format('YYYY-MM-DD')]
    case 'mese':
      return [oggi.startOf('month').format('YYYY-MM-DD'), oggi.endOf('month').format('YYYY-MM-DD')]
    case 'prossimoMese': {
      const m = oggi.add(1, 'month')
      return [m.startOf('month').format('YYYY-MM-DD'), m.endOf('month').format('YYYY-MM-DD')]
    }
    case '3m':
      return [oggiIso(), oggi.add(3, 'month').format('YYYY-MM-DD')]
    case 'stagione':
      // con le partite giocate si parte dal 1° luglio: la stagione intera
      return [conGiocate ? `${Number(stagione.slice(0, 4))}-07-01` : oggiIso(), fineStagione(stagione)]
    case 'personalizzato':
      return scelto ?? [oggiIso(), oggi.add(30, 'day').format('YYYY-MM-DD')]
  }
}

/** Anteprima dal vivo: il foglio vero, rimpicciolito alla larghezza della finestra. */
function Anteprima({ opzioni }: { opzioni: OpzioniCalendario }) {
  const box = useRef<HTMLDivElement>(null)
  const foglio = useRef<HTMLDivElement>(null)
  const [scala, setScala] = useState(0.5)
  const [altezza, setAltezza] = useState(0)
  const larghezza = larghezzaFoglio(opzioni.orizzontale)
  const html = useMemo(() => htmlFoglio(blocchiCalendario(opzioni)), [opzioni])

  useEffect(() => {
    const el = box.current
    if (!el) return
    const ro = new ResizeObserver(() => setScala(Math.min(1, el.clientWidth / larghezza)))
    ro.observe(el)
    return () => ro.disconnect()
  }, [larghezza])

  useEffect(() => {
    const el = foglio.current
    if (!el) return
    const ro = new ResizeObserver(() => setAltezza(el.offsetHeight))
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  return (
    <div ref={box} className="calendario-anteprima" style={{ height: altezza * scala + 2 }}>
      <div
        ref={foglio}
        style={{
          width: larghezza,
          transform: `scale(${scala})`,
          transformOrigin: 'top left',
          padding: '32px 36px',
          boxSizing: 'border-box',
          background: '#fff',
          color: '#000',
          fontFamily: 'Arial, sans-serif',
        }}
        // l'HTML è composto da noi e i testi dell'utente sono già schermati
        dangerouslySetInnerHTML={{ __html: html }}
      />
    </div>
  )
}

export function StampaCalendario({
  open,
  onClose,
  partite,
  tornei,
  stagione,
  allenamenti,
  appuntamenti,
}: {
  open: boolean
  onClose: () => void
  partite: Partita[]
  tornei: Torneo[]
  stagione: string
  /** dal Calendario: si possono mettere nel foglio anche gli allenamenti */
  allenamenti?: Allenamento[]
  /** dal Calendario: gli impegni a mano, stampati come partite in programma */
  appuntamenti?: Appuntamento[]
}) {
  const { message } = App.useApp()
  const daCalendario = !!allenamenti
  const screens = Grid.useBreakpoint()
  const [preset, setPreset] = useState<Preset>('stagione')
  const [scelto, setScelto] = useState<[string, string] | null>(null)
  const [conGiocate, setConGiocate] = useState(false)
  const [torneiF, setTorneiF] = useState<string[]>([])
  const [tipo, setTipo] = useState<'tutte' | 'ufficiali' | 'amichevoli'>('tutte')
  const [dove, setDove] = useState<'tutte' | 'casa' | 'trasferta'>('tutte')
  const [impaginazione, setImpaginazione] = useState<Impaginazione>('elenco')
  const [orizzontale, setOrizzontale] = useState(false)
  const [colonne, setColonne] = useState<Colonna[]>(['ora', 'competizione'])
  const [evidenziaCasa, setEvidenziaCasa] = useState(true)
  const [mesePerPagina, setMesePerPagina] = useState(true)
  const [conAllenamenti, setConAllenamenti] = useState(true)
  const [titolo, setTitolo] = useState(daCalendario ? 'Calendario impegni' : 'Calendario partite')
  const [nota, setNota] = useState('')
  const [esportando, setEsportando] = useState<'pdf' | 'png' | null>(null)

  const [da, a] = intervallo(preset, stagione, scelto, conGiocate)
  const nomeTorneo = (id?: string) => tornei.find((t) => t.id === id)?.nome

  // gli impegni a mano del calendario diventano partite in programma; se uno
  // ha stessa data e avversario di una partita è la stessa gara: resta la partita
  const tutte = useMemo(() => {
    const chiave = (data: string, avv: string) => `${data}|${avv.trim().toLowerCase().replace(/\s+/g, ' ')}`
    const gia = new Set(partite.map((p) => chiave(p.data, p.avversario)))
    return [
      ...partite,
      ...(appuntamenti ?? []).filter((ap) => !gia.has(chiave(ap.data, ap.avversario))).map(
        (ap): Partita => ({
          id: `ap-${ap.id}`,
          data: ap.data,
          ora: ap.ora,
          avversario: ap.avversario,
          inCasa: ap.inCasa,
          giocata: false,
          golFatti: 0,
          golSubiti: 0,
          note: ap.luogo,
          marcatori: [],
          assist: [],
          ammoniti: [],
          espulsi: [],
        }),
      ),
    ]
  }, [partite, appuntamenti])

  const selezionate = useMemo(
    () =>
      tutte.filter((p) => {
        if (p.data < da || p.data > a) return false
        if (!conGiocate && p.giocata !== false) return false
        if (torneiF.length && !torneiF.includes(p.torneoId ?? '')) return false
        if (tipo === 'ufficiali' && p.amichevole) return false
        if (tipo === 'amichevoli' && !p.amichevole) return false
        if (dove === 'casa' && !p.inCasa) return false
        if (dove === 'trasferta' && p.inCasa) return false
        return true
      }),
    [tutte, da, a, conGiocate, torneiF, tipo, dove],
  )

  const seduteSel = useMemo(() => {
    if (!allenamenti || !conAllenamenti) return undefined
    const oggi = oggiIso()
    // senza le "già giocate" restano fuori anche le sedute passate
    return allenamenti.filter((s) => s.data >= da && s.data <= a && (conGiocate || s.data >= oggi))
  }, [allenamenti, conAllenamenti, da, a, conGiocate])

  const sottotitolo = [
    `Stagione ${stagione}`,
    `dal ${formatData(da, true)} al ${formatData(a, true)}`,
    torneiF.length ? torneiF.map((id) => nomeTorneo(id)).filter(Boolean).join(', ') : '',
    tipo === 'ufficiali' ? 'solo ufficiali' : tipo === 'amichevoli' ? 'solo amichevoli' : '',
    dove === 'casa' ? 'solo in casa' : dove === 'trasferta' ? 'solo in trasferta' : '',
  ]
    .filter(Boolean)
    .join(' · ')

  // il risultato ha senso solo se nel foglio ci sono partite già giocate
  const colonneEff = conGiocate ? colonne : colonne.filter((c) => c !== 'risultato')

  const opzioni: OpzioniCalendario = useMemo(
    () => ({
      titolo,
      sottotitolo,
      partite: selezionate,
      allenamenti: seduteSel,
      da,
      a,
      impaginazione,
      orizzontale,
      colonne: colonneEff,
      evidenziaCasa,
      mesePerPagina,
      nota: nota.trim() || undefined,
      nomeTorneo,
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [titolo, sottotitolo, selezionate, seduteSel, da, a, impaginazione, orizzontale, colonneEff.join(), evidenziaCasa, mesePerPagina, nota, tornei],
  )

  function cambiaImpaginazione(v: Impaginazione) {
    setImpaginazione(v)
    // la griglia settimanale respira meglio sul foglio orizzontale
    setOrizzontale(v === 'griglia')
  }

  async function esporta(formato: 'pdf' | 'png') {
    setEsportando(formato)
    try {
      if (formato === 'pdf') await esportaCalendarioPdf(opzioni)
      else await esportaCalendarioPng(opzioni)
    } catch (e) {
      console.error(e)
      message.error('Non sono riuscito a creare il file. Riprova.')
    } finally {
      setEsportando(null)
    }
  }

  return (
    <Modal
      title={daCalendario ? 'Stampa calendario' : 'Stampa calendario partite'}
      open={open}
      onCancel={onClose}
      width={screens.lg ? 1100 : undefined}
      footer={
        <Space wrap style={{ justifyContent: 'flex-end' }}>
          <Button onClick={onClose}>Chiudi</Button>
          <Button icon={<PictureOutlined />} loading={esportando === 'png'} onClick={() => esporta('png')}>
            Immagine (WhatsApp)
          </Button>
          <Button
            type="primary"
            icon={<FilePdfOutlined />}
            loading={esportando === 'pdf'}
            onClick={() => esporta('pdf')}
          >
            Scarica PDF
          </Button>
        </Space>
      }
    >
      <Row gutter={[24, 16]}>
        <Col xs={24} lg={9}>
          <FiltroCampo label="Periodo">
            <Select
              value={preset}
              onChange={setPreset}
              style={{ width: '100%' }}
              options={PRESET.map((o) =>
                o.value === 'stagione' && conGiocate ? { ...o, label: 'Tutta la stagione' } : o,
              )}
            />
          </FiltroCampo>
          {preset === 'personalizzato' && (
            <DatePicker.RangePicker
              format="DD/MM/YYYY"
              style={{ width: '100%', marginTop: 8 }}
              value={scelto ? [dayjs(scelto[0]), dayjs(scelto[1])] : null}
              onChange={(v) =>
                setScelto(v?.[0] && v[1] ? [isoDa((v[0] as Dayjs).toDate()), isoDa((v[1] as Dayjs).toDate())] : null)
              }
            />
          )}
          <Text type="secondary" style={{ fontSize: 12, display: 'block', marginTop: 4 }}>
            Dal {formatData(da, true)} al {formatData(a, true)}
          </Text>

          <div style={{ marginTop: 12 }}>
            <Checkbox checked={conGiocate} onChange={(e) => setConGiocate(e.target.checked)}>
              {daCalendario ? 'Includi anche partite giocate e allenamenti passati' : 'Includi anche le partite già giocate'}
            </Checkbox>
          </div>
          {daCalendario && (
            <div style={{ marginTop: 6 }}>
              <Checkbox checked={conAllenamenti} onChange={(e) => setConAllenamenti(e.target.checked)}>
                Includi gli allenamenti
              </Checkbox>
            </div>
          )}

          {tornei.length > 0 && (
            <div style={{ marginTop: 12 }}>
              <FiltroCampo label="Competizioni">
                <Select
                  mode="multiple"
                  allowClear
                  placeholder="Tutte"
                  value={torneiF}
                  onChange={setTorneiF}
                  style={{ width: '100%' }}
                  options={tornei.map((t) => ({ value: t.id, label: t.nome }))}
                />
              </FiltroCampo>
            </div>
          )}
          <Row gutter={8} style={{ marginTop: 12 }}>
            <Col span={12}>
              <FiltroCampo label="Tipo">
                <Select
                  value={tipo}
                  onChange={setTipo}
                  style={{ width: '100%' }}
                  options={[
                    { value: 'tutte', label: 'Tutte' },
                    { value: 'ufficiali', label: 'Ufficiali' },
                    { value: 'amichevoli', label: 'Amichevoli' },
                  ]}
                />
              </FiltroCampo>
            </Col>
            <Col span={12}>
              <FiltroCampo label="Dove">
                <Select
                  value={dove}
                  onChange={setDove}
                  style={{ width: '100%' }}
                  options={[
                    { value: 'tutte', label: 'Casa e trasferta' },
                    { value: 'casa', label: 'Solo in casa' },
                    { value: 'trasferta', label: 'Solo in trasferta' },
                  ]}
                />
              </FiltroCampo>
            </Col>
          </Row>

          <Divider style={{ margin: '16px 0 12px' }} />

          <FiltroCampo label="Impaginazione">
            <Segmented
              block
              value={impaginazione}
              onChange={(v) => cambiaImpaginazione(v as Impaginazione)}
              options={[
                { value: 'elenco', label: 'Elenco' },
                { value: 'griglia', label: 'Calendario mensile' },
              ]}
            />
          </FiltroCampo>
          <div style={{ marginTop: 10 }}>
            <FiltroCampo label="Foglio">
              <Segmented
                block
                value={orizzontale ? 'o' : 'v'}
                onChange={(v) => setOrizzontale(v === 'o')}
                options={[
                  { value: 'v', label: 'A4 verticale' },
                  { value: 'o', label: 'A4 orizzontale' },
                ]}
              />
            </FiltroCampo>
          </div>

          <div style={{ marginTop: 12 }}>
            <FiltroCampo label="Cosa mostrare">
              <Checkbox.Group
                value={colonne}
                onChange={(v) => setColonne(v as Colonna[])}
                style={{ display: 'flex', flexDirection: 'column', gap: 4 }}
                options={COLONNE.filter((c) => impaginazione === 'elenco' || !['note', 'ritrovo'].includes(c.value)).map(
                  (c) => ({ ...c, disabled: c.value === 'risultato' && !conGiocate }),
                )}
              />
            </FiltroCampo>
          </div>
          <Space direction="vertical" size={6} style={{ marginTop: 12 }}>
            <Space>
              <Switch size="small" checked={evidenziaCasa} onChange={setEvidenziaCasa} />
              <span>Evidenzia le partite in casa</span>
            </Space>
            {impaginazione === 'griglia' && (
              <Space>
                <Switch size="small" checked={mesePerPagina} onChange={setMesePerPagina} />
                <span>Un mese per foglio</span>
              </Space>
            )}
          </Space>

          <Divider style={{ margin: '16px 0 12px' }} />

          <FiltroCampo label="Titolo">
            <Input value={titolo} onChange={(e) => setTitolo(e.target.value)} maxLength={60} />
          </FiltroCampo>
          <div style={{ marginTop: 10 }}>
            <FiltroCampo label="Nota in fondo (facoltativa)">
              <Input.TextArea
                value={nota}
                onChange={(e) => setNota(e.target.value)}
                autoSize={{ minRows: 2, maxRows: 4 }}
                placeholder="es. Ritrovo al campo un'ora prima del fischio d'inizio"
                maxLength={300}
              />
            </FiltroCampo>
          </div>
        </Col>

        <Col xs={24} lg={15}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
            <Text strong>Anteprima</Text>
            <Text type="secondary">
              {selezionate.length === 1 ? '1 partita' : `${selezionate.length} partite`}
              {seduteSel && ` · ${seduteSel.length === 1 ? '1 allenamento' : `${seduteSel.length} allenamenti`}`}
            </Text>
          </div>
          <div className="calendario-anteprima-scroll">
            <Anteprima opzioni={opzioni} />
          </div>
        </Col>
      </Row>
    </Modal>
  )
}
