import { useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import dayjs from 'dayjs'
import {
  App,
  Button,
  Card,
  Collapse,
  Form,
  Grid,
  Input,
  List,
  Modal,
  Popconfirm,
  Segmented,
  Select,
  Space,
  Upload,
} from 'antd'
import {
  InstagramOutlined,
  PlusOutlined,
  DeleteOutlined,
  CalendarOutlined,
  PictureOutlined,
} from '@ant-design/icons'
import { useCollection } from '../hooks/useCollection'
import { PageHeader } from '../components/PageHeader'
import { DataPicker, propsCampoData } from '../components/DataPicker'
import { formatData, oggiIso } from '../lib/format'
import {
  etichettaGiorno,
  etichettaMese,
  giornoBreve,
  giornoNum,
  mappaCognomi,
  meseBreve,
  meseNome,
  nomiMarcatori,
  FORMATI_IG,
  type FormatoIG,
} from '../lib/social'
import { useSeason } from '../season/SeasonContext'
import { useAppuntamenti, type Appuntamento } from '../lib/appuntamenti'
import { leggiPrefs } from '../lib/graficaPrefs'
import { preparaLogo } from '../lib/immagine'
import { driveAttivo, uploadGrafica } from '../services/driveStore'
import type { Giocatore, Partita } from '../types'
import { Editor } from './social/editor/Editor'
import type { BuildInput, FixtureRiga, FormazioneGrafica } from './social/editor/scene'

/** Chiave del passaggio dati dalla pagina Formazione (sessionStorage). */
export const CHIAVE_GRAF_FORMAZIONE = 'usriolunato:grafFormazione'

function leggiFormazioneGrafica(): FormazioneGrafica | undefined {
  try {
    const raw = sessionStorage.getItem(CHIAVE_GRAF_FORMAZIONE)
    const obj = raw ? (JSON.parse(raw) as FormazioneGrafica) : undefined
    return obj && Array.isArray(obj.titolari) ? obj : undefined
  } catch {
    return undefined
  }
}

const LOGO = `${import.meta.env.BASE_URL}logo.png`

function slug(s: string) {
  return (
    s
      .toLowerCase()
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '') || 'grafica'
  )
}

/** Da un testo scritto a mano (uno per riga, o separati da virgola) a elenco. */
function righe(testo: string): string[] {
  return testo
    .split(/[\n,;]+/)
    .map((r) => r.trim())
    .filter(Boolean)
}

function doveLabel(inCasa: boolean, luogo?: string) {
  return luogo?.trim() ? luogo.trim().toUpperCase() : inCasa ? 'IN CASA' : 'IN TRASFERTA'
}

function labelAppuntamento(a: Appuntamento) {
  return `${formatData(a.data, true)}${a.ora ? ' ' + a.ora : ''} · ${a.avversario} (${a.inCasa ? 'casa' : 'trasf.'})`
}

type Kind = 'annuncio' | 'risultato' | 'mese' | 'formazione'

export function Social() {
  const { items: partite } = useCollection<Partita>('partite')
  const { items: giocatori } = useCollection<Giocatore>('giocatori')
  const { list: appuntamenti, aggiungi, rimuovi } = useAppuntamenti()
  const { message } = App.useApp()
  const { attiva } = useSeason()
  const screens = Grid.useBreakpoint()
  const affianca = screens.lg
  const [searchParams] = useSearchParams()

  const [kind, setKind] = useState<Kind>(() => {
    const k = searchParams.get('kind')
    return k === 'risultato' || k === 'mese' || k === 'formazione' ? k : 'annuncio'
  })
  const [formatoChiave, setFormatoChiave] = useState<FormatoIG['chiave']>('post')
  // l'undici arriva dalla pagina Formazione (bottone «Grafica IG»)
  const formazioneGrafica = useMemo(() => leggiFormazioneGrafica(), [])

  // annuncio (dati inseriti a mano, mono-uso)
  const [avversario, setAvversario] = useState('')
  const [dataG, setDataG] = useState(oggiIso())
  const [oraG, setOraG] = useState('')
  const [inCasaG, setInCasaG] = useState(true)
  const [luogoG, setLuogoG] = useState('')
  const [notaG, setNotaG] = useState('')

  // stemma della squadra avversaria (caricato a mano, vale per la grafica in corso)
  const [crestAvv, setCrestAvv] = useState<{ src: string; rapporto: number }>()
  // mister e cambi della grafica formazione: la panchina arriva dalla pagina
  // Formazione (undefined = \"quella vera\"), ma si può riscrivere qui
  const [allenatore, setAllenatore] = useState('')
  const [panchinaTxt, setPanchinaTxt] = useState<string>()

  // risultato (da partite giocate)
  const [partitaResId, setPartitaResId] = useState<string>()
  // marcatori scritti a mano: i nostri partono da quelli della partita (undefined
  // = \"usa quelli veri\"), gli avversari l'app non li registra e si scrivono qui
  const [marcatoriNoi, setMarcatoriNoi] = useState<string>()
  const [marcatoriLoro, setMarcatoriLoro] = useState('')

  // mese (appuntamenti mono-uso)
  const [meseSel, setMeseSel] = useState<string>()
  const [modaleAppt, setModaleAppt] = useState(false)
  const [form] = Form.useForm()

  const cognomi = useMemo(() => mappaCognomi(giocatori), [giocatori])
  const formato = FORMATI_IG.find((f) => f.chiave === formatoChiave)!

  const apptOrdinati = useMemo(
    () => [...appuntamenti].sort((a, b) => (a.data + (a.ora ?? '')).localeCompare(b.data + (b.ora ?? ''))),
    [appuntamenti],
  )
  const mesiAppt = useMemo(() => {
    const chiavi = new Set(apptOrdinati.map((a) => a.data.slice(0, 7)))
    return [...chiavi].sort((a, b) => a.localeCompare(b)).map((k) => ({ value: k, label: etichettaMese(k) }))
  }, [apptOrdinati])
  const meseAttivo = meseSel ?? mesiAppt[0]?.value ?? oggiIso().slice(0, 7)

  const partiteGiocate = useMemo(
    () => partite.filter((p) => p.giocata !== false).sort((a, b) => b.data.localeCompare(a.data)),
    [partite],
  )
  const partitaResIdEff = partitaResId ?? partiteGiocate[0]?.id
  const partitaRes = partiteGiocate.find((p) => p.id === partitaResIdEff)

  // la panchina come arriva dalla pagina Formazione, una per riga
  const panchinaDefault = useMemo(() => (formazioneGrafica?.panchina ?? []).join('\n'), [formazioneGrafica])

  // i nostri marcatori come li sa l'app, uno per riga (il minuto lo aggiunge
  // l'utente: nelle partite non lo registriamo)
  const marcatoriDefault = useMemo(
    () => (partitaRes ? nomiMarcatori(partitaRes.marcatori ?? [], cognomi).split(' \u00b7 ').filter(Boolean).join('\n') : ''),
    [partitaRes, cognomi],
  )

  const fixtures: FixtureRiga[] = useMemo(
    () =>
      apptOrdinati
        .filter((a) => a.data.slice(0, 7) === meseAttivo)
        .map((a) => ({
          dow: giornoBreve(a.data),
          gg: giornoNum(a.data),
          mmm: meseBreve(a.data),
          avversario: a.avversario,
          inCasa: a.inCasa,
          ora: a.ora,
          luogo: a.luogo,
        })),
    [apptOrdinati, meseAttivo],
  )

  const piede = leggiPrefs(kind).piede ?? '#FORZARIOLUNATO'

  // dati per l'editor + chiave che, cambiando, rigenera la scena
  const { input, seedKey, nomeFile } = useMemo(() => {
    const base = {
      formato: { w: formato.w, h: formato.h },
      crestSrc: LOGO,
      piede,
      stagione: attiva,
      crestAvversarioSrc: crestAvv?.src,
      crestAvversarioRapporto: crestAvv?.rapporto,
    }
    if (kind === 'annuncio') {
      const inp: BuildInput = {
        ...base,
        kind: 'annuncio',
        giorno: {
          avversario: avversario.trim() || 'AVVERSARIO',
          dataTxt: etichettaGiorno(dataG),
          gg: giornoNum(dataG),
          mese: meseNome(dataG),
          ora: oraG.trim() || undefined,
          dove: doveLabel(inCasaG, luogoG),
          nota: notaG.trim() || undefined,
        },
      }
      return {
        input: inp,
        seedKey: `annuncio|${formatoChiave}|${avversario}|${dataG}|${oraG}|${inCasaG}|${luogoG}|${notaG}`,
        nomeFile: `riolunato-${dataG}-${slug(avversario || 'annuncio')}.png`,
      }
    }
    if (kind === 'risultato') {
      const p = partitaRes
      const inp: BuildInput = {
        ...base,
        kind: 'risultato',
        giorno: p
          ? {
              avversario: p.avversario,
              dataTxt: etichettaGiorno(p.data),
              ora: p.ora,
              dove: doveLabel(p.inCasa),
              inCasa: p.inCasa,
              golFatti: p.golFatti,
              golSubiti: p.golSubiti,
              marcatori: marcatoriNoi ?? marcatoriDefault,
              marcatoriLoro: marcatoriLoro.trim() || undefined,
            }
          : { avversario: 'AVVERSARIO', dataTxt: '', dove: 'IN CASA', golFatti: 0, golSubiti: 0 },
      }
      return {
        input: inp,
        seedKey: `risultato|${formatoChiave}|${p?.id ?? 'none'}|${crestAvv?.src ? 'logo' : ''}|${marcatoriNoi ?? ''}|${marcatoriLoro}`,
        nomeFile: p ? `riolunato-${p.data}-${slug(p.avversario)}.png` : 'riolunato-risultato.png',
      }
    }
    if (kind === 'formazione') {
      const inp: BuildInput = {
        ...base,
        kind: 'formazione',
        formazione: formazioneGrafica && {
          ...formazioneGrafica,
          panchina: righe(panchinaTxt ?? panchinaDefault),
        },
        allenatore: allenatore.trim() || undefined,
      }
      return {
        input: inp,
        seedKey: `formazione|${formatoChiave}|${formazioneGrafica?.creata ?? 'vuota'}|${allenatore}|${panchinaTxt ?? ''}|${crestAvv?.src ? 'logo' : ''}`,
        nomeFile: `riolunato-formazione-${slug(formazioneGrafica?.modulo ?? 'xi')}.png`,
      }
    }
    const inp: BuildInput = {
      ...base,
      kind: 'mese',
      meseTxt: etichettaMese(meseAttivo),
      fixtures,
    }
    return {
      input: inp,
      seedKey: `mese|${formatoChiave}|${meseAttivo}|${fixtures.length}|${apptOrdinati.map((a) => a.id).join(',')}`,
      nomeFile: `riolunato-appuntamenti-${meseAttivo}.png`,
    }
  }, [
    kind,
    formato,
    formatoChiave,
    piede,
    attiva,
    avversario,
    dataG,
    oraG,
    inCasaG,
    luogoG,
    notaG,
    partitaRes,
    marcatoriDefault,
    marcatoriNoi,
    marcatoriLoro,
    crestAvv,
    allenatore,
    panchinaDefault,
    panchinaTxt,
    meseAttivo,
    fixtures,
    apptOrdinati,
    formazioneGrafica,
  ])

  /** Lo stemma avversario: PNG rimpicciolito, con le sue proporzioni. */
  async function caricaCrestAvversario(file: File) {
    try {
      setCrestAvv(await preparaLogo(file))
    } catch {
      message.error('Immagine non valida')
    }
    return false
  }

  function salvaAppuntamento(v: { data: string; ora?: string; avversario: string; inCasa: boolean; luogo?: string }) {
    aggiungi({
      data: v.data,
      ora: v.ora?.trim() || undefined,
      avversario: v.avversario.trim(),
      inCasa: v.inCasa,
      luogo: v.luogo?.trim() || undefined,
    })
    setMeseSel(v.data.slice(0, 7))
    form.resetFields()
    form.setFieldsValue({ data: v.data, inCasa: v.inCasa })
    message.success('Appuntamento aggiunto')
  }
  /** Cambiando partita si riparte dai marcatori veri di quella partita. */
  function cambiaPartita(id: string) {
    setPartitaResId(id)
    setMarcatoriNoi(undefined)
    setMarcatoriLoro('')
  }

  function apriModaleAppt() {
    form.resetFields()
    form.setFieldsValue({ data: oggiIso(), inCasa: true })
    setModaleAppt(true)
  }

  async function salvaSuDrive(dataUrl: string) {
    const base64 = dataUrl.split(',')[1] ?? ''
    try {
      const meta = await uploadGrafica(nomeFile, base64)
      message.success({
        content: (
          <span>
            Salvata nella cartella «Grafica» del Drive.{' '}
            {meta.url && (
              <a href={meta.url} target="_blank" rel="noreferrer">
                Apri
              </a>
            )}
          </span>
        ),
        duration: 6,
      })
    } catch (err) {
      message.error('Salvataggio su Drive non riuscito: ' + String((err as Error)?.message || err))
    }
  }

  const selettori = (
    <>
      <div className="social-campo">
        <span className="social-label">Grafica</span>
        <Segmented
          block
          value={kind}
          onChange={(v) => setKind(v as Kind)}
          options={[
            { value: 'annuncio', label: 'Partita del giorno' },
            { value: 'risultato', label: 'Risultato' },
            { value: 'mese', label: 'Mese' },
            { value: 'formazione', label: 'Formazione' },
          ]}
        />
      </div>

      <div className="social-campo">
        <span className="social-label">Formato</span>
        <Segmented
          block
          value={formatoChiave}
          onChange={(v) => setFormatoChiave(v as FormatoIG['chiave'])}
          options={FORMATI_IG.map((f) => ({ value: f.chiave, label: f.label }))}
        />
      </div>
    </>
  )

  const campiDati = (
    <>
      {kind === 'annuncio' && (
        <>
          <div className="social-campo">
            <span className="social-label">Avversario</span>
            <Input value={avversario} onChange={(e) => setAvversario(e.target.value)} placeholder="es. Pievepelago" />
          </div>
          <div className="social-campo social-due">
            <div>
              <span className="social-label">Data</span>
              <DataPicker
                value={dataG ? dayjs(dataG) : undefined}
                onChange={(d) => setDataG(d ? d.format('YYYY-MM-DD') : '')}
              />
            </div>
            <div>
              <span className="social-label">Ora</span>
              <Input value={oraG} onChange={(e) => setOraG(e.target.value)} placeholder="es. 15:30" />
            </div>
          </div>
          <div className="social-campo social-due">
            <div>
              <span className="social-label">Dove</span>
              <Select
                style={{ width: '100%' }}
                value={inCasaG}
                onChange={setInCasaG}
                options={[
                  { value: true, label: 'In casa' },
                  { value: false, label: 'In trasferta' },
                ]}
              />
            </div>
            <div>
              <span className="social-label">Luogo</span>
              <Input value={luogoG} onChange={(e) => setLuogoG(e.target.value)} placeholder="facoltativo" />
            </div>
          </div>
          <div className="social-campo">
            <span className="social-label">Riga in fondo</span>
            <Input
              value={notaG}
              onChange={(e) => setNotaG(e.target.value)}
              placeholder="es. Amichevole Pre-Campionato"
            />
          </div>
        </>
      )}

      {(kind === 'risultato' || kind === 'formazione') && (
        <div className="social-campo">
          <span className="social-label">Stemma avversario</span>
          <Space wrap>
            <Upload accept="image/*" showUploadList={false} beforeUpload={caricaCrestAvversario}>
              <Button icon={<PictureOutlined />}>{crestAvv ? 'Cambia logo' : 'Carica logo'}</Button>
            </Upload>
            {crestAvv && (
              <>
                <img src={crestAvv.src} alt="" className="social-logo-avv" />
                <Button type="text" onClick={() => setCrestAvv(undefined)}>
                  Togli
                </Button>
              </>
            )}
          </Space>
          <div className="social-suggerimento" style={{ margin: '6px 0 0' }}>
            Va accanto al nostro stemma. Meglio un PNG ritagliato: il fondo trasparente resta tale.
          </div>
        </div>
      )}

      {kind === 'risultato' && (
        <div className="social-campo">
          <span className="social-label">Partita giocata</span>
          {partiteGiocate.length ? (
            <Select
              style={{ width: '100%' }}
              value={partitaResIdEff}
              onChange={cambiaPartita}
              showSearch
              optionFilterProp="label"
              options={partiteGiocate.map((p) => ({
                value: p.id,
                label: `${formatData(p.data, true)} · ${p.avversario} ${p.golFatti}-${p.golSubiti}`,
              }))}
            />
          ) : (
            <div className="social-vuoto">
              Nessuna partita registrata. <Link to="/partite">Vai a Partite</Link>.
            </div>
          )}
        </div>
      )}

      {kind === 'risultato' && partitaRes && (
        <div className="social-campo">
          <span className="social-label">Marcatori</span>
          <div className="social-due">
            <div>
              <span className="social-sotto-label">Nostri</span>
              <Input.TextArea
                rows={3}
                value={marcatoriNoi ?? marcatoriDefault}
                onChange={(e) => setMarcatoriNoi(e.target.value)}
                placeholder={'Rossi 12\'\nBianchi 71\''}
              />
            </div>
            <div>
              <span className="social-sotto-label">Avversari</span>
              <Input.TextArea
                rows={3}
                value={marcatoriLoro}
                onChange={(e) => setMarcatoriLoro(e.target.value)}
                placeholder={'Verdi 25\'\nNeri 88\''}
              />
            </div>
          </div>
          <div className="social-suggerimento" style={{ margin: '6px 0 0' }}>
            Uno per riga, con il minuto se serve. I nostri arrivano dalla partita: puoi
            correggerli qui senza toccare i dati.
          </div>
        </div>
      )}

      {kind === 'formazione' && (
        <div className="social-campo">
          <span className="social-label">Undici titolare</span>
          {formazioneGrafica ? (
            <div className="social-vuoto">
              Modulo <b>{formazioneGrafica.modulo}</b> · {formazioneGrafica.titolari.length} titolari
              {formazioneGrafica.panchina.length ? ` · ${formazioneGrafica.panchina.length} in panchina` : ''}.{' '}
              <Link to="/formazione">Rigenera</Link> per cambiarlo.
            </div>
          ) : (
            <div className="social-vuoto">
              Genera l'undici nella pagina <Link to="/formazione">Formazione</Link> e poi tocca «Grafica IG».
            </div>
          )}
        </div>
      )}

      {kind === 'formazione' && (
        <>
          <div className="social-campo">
            <span className="social-label">Mister</span>
            <Input
              value={allenatore}
              onChange={(e) => setAllenatore(e.target.value)}
              placeholder="chi siede in panchina"
            />
          </div>
          <div className="social-campo">
            <span className="social-label">Cambi (panchina)</span>
            <Input.TextArea
              rows={4}
              value={panchinaTxt ?? panchinaDefault}
              onChange={(e) => setPanchinaTxt(e.target.value)}
              placeholder={'12 Rossi\n13 Bianchi'}
            />
            <div className="social-suggerimento" style={{ margin: '6px 0 0' }}>
              Uno per riga, col numero davanti se vuoi. Arrivano dalla Formazione: correggerli
              qui non cambia l'undici.
            </div>
          </div>
        </>
      )}

      {kind === 'mese' && (
        <div className="social-campo">
          <span className="social-label">Mese</span>
          {mesiAppt.length ? (
            <Select
              style={{ width: '100%' }}
              value={meseAttivo}
              onChange={setMeseSel}
              options={mesiAppt}
              showSearch
              optionFilterProp="label"
            />
          ) : (
            <div className="social-vuoto">Nessun appuntamento: aggiungine uno qui sotto.</div>
          )}
          <Button icon={<CalendarOutlined />} onClick={apriModaleAppt} block style={{ marginTop: 8 }}>
            Gestisci appuntamenti{appuntamenti.length ? ` (${appuntamenti.length})` : ''}
          </Button>
        </div>
      )}

      <div className="social-suggerimento">
        Trascina e modifica gli elementi direttamente sulla tela. Instagram: {formato.w}×{formato.h}px.
      </div>
    </>
  )

  const controlli = (
    <Card size="small" variant="borderless" style={{ boxShadow: 'var(--ombra-card)' }}>
      {selettori}
      {affianca ? (
        campiDati
      ) : (
        <Collapse
          ghost
          size="small"
          defaultActiveKey={['dati']}
          items={[{ key: 'dati', label: 'Dati della grafica', children: campiDati }]}
        />
      )}
    </Card>
  )

  return (
    <>
      <PageHeader
        titolo="Grafiche IG"
        sottotitolo="Crea e personalizza le foto per Instagram, poi scaricale o salvale sul Drive"
        azioni={<InstagramOutlined style={{ fontSize: 24, color: 'var(--rosso)' }} />}
      />

      <div className={affianca ? 'social-griglia' : undefined}>
        <div>{controlli}</div>
        <div className="social-editor">
          <Editor
            input={input}
            seedKey={seedKey}
            nomeFile={nomeFile}
            onSalvaDrive={driveAttivo() ? salvaSuDrive : undefined}
          />
        </div>
      </div>

      <Modal
        title="Appuntamenti"
        open={modaleAppt}
        onCancel={() => setModaleAppt(false)}
        footer={
          <Button type="primary" onClick={() => setModaleAppt(false)}>
            Chiudi
          </Button>
        }
        maskClosable={false}
        forceRender
      >
        <Form form={form} layout="vertical" onFinish={salvaAppuntamento} requiredMark={false}>
          <div className="social-due">
            <Form.Item label="Data" name="data" rules={[{ required: true, message: 'Scegli la data' }]} {...propsCampoData}>
              <DataPicker />
            </Form.Item>
            <Form.Item label="Ora" name="ora">
              <Input placeholder="es. 15:30" autoComplete="off" />
            </Form.Item>
          </div>
          <Form.Item label="Avversario" name="avversario" rules={[{ required: true, message: 'Inserisci l’avversario' }]}>
            <Input placeholder="es. Pievepelago" autoComplete="off" />
          </Form.Item>
          <div className="social-due">
            <Form.Item label="Dove" name="inCasa" initialValue={true}>
              <Select
                options={[
                  { value: true, label: 'In casa' },
                  { value: false, label: 'In trasferta' },
                ]}
              />
            </Form.Item>
            <Form.Item label="Luogo (facoltativo)" name="luogo">
              <Input placeholder="es. Comunale di Riolunato" autoComplete="off" />
            </Form.Item>
          </div>
          <Button type="dashed" icon={<PlusOutlined />} onClick={() => form.submit()} block>
            Aggiungi appuntamento
          </Button>
        </Form>

        <List
          style={{ marginTop: 16 }}
          size="small"
          locale={{ emptyText: 'Ancora nessun appuntamento' }}
          dataSource={apptOrdinati}
          renderItem={(a) => (
            <List.Item
              actions={[
                <Popconfirm
                  key="del"
                  title="Eliminare l’appuntamento?"
                  okText="Elimina"
                  cancelText="Annulla"
                  okButtonProps={{ danger: true }}
                  onConfirm={() => rimuovi(a.id)}
                >
                  <Button type="text" danger icon={<DeleteOutlined />} />
                </Popconfirm>,
              ]}
            >
              {labelAppuntamento(a)}
            </List.Item>
          )}
        />
      </Modal>
    </>
  )
}
