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
} from 'antd'
import { InstagramOutlined, PlusOutlined, DeleteOutlined, CalendarOutlined } from '@ant-design/icons'
import { useCollection } from '../hooks/useCollection'
import { PageHeader } from '../components/PageHeader'
import { DataPicker, propsCampoData } from '../components/DataPicker'
import { formatData } from '../lib/format'
import {
  etichettaGiorno,
  etichettaMese,
  giornoBreve,
  giornoNum,
  mappaCognomi,
  meseBreve,
  nomiMarcatori,
  FORMATI_IG,
  type FormatoIG,
} from '../lib/social'
import { useAppuntamenti, type Appuntamento } from '../lib/appuntamenti'
import { leggiPrefs } from '../lib/graficaPrefs'
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

function oggiIso() {
  return new Date().toISOString().slice(0, 10)
}

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

  // risultato (da partite giocate)
  const [partitaResId, setPartitaResId] = useState<string>()

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
    const base = { formato: { w: formato.w, h: formato.h }, crestSrc: LOGO, piede }
    if (kind === 'annuncio') {
      const inp: BuildInput = {
        ...base,
        kind: 'annuncio',
        giorno: {
          avversario: avversario.trim() || 'AVVERSARIO',
          dataTxt: etichettaGiorno(dataG),
          ora: oraG.trim() || undefined,
          dove: doveLabel(inCasaG, luogoG),
        },
      }
      return {
        input: inp,
        seedKey: `annuncio|${formatoChiave}|${avversario}|${dataG}|${oraG}|${inCasaG}|${luogoG}`,
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
              golFatti: p.golFatti,
              golSubiti: p.golSubiti,
              marcatori: nomiMarcatori(p.marcatori ?? [], cognomi) || undefined,
            }
          : { avversario: 'AVVERSARIO', dataTxt: '', dove: 'IN CASA', golFatti: 0, golSubiti: 0 },
      }
      return {
        input: inp,
        seedKey: `risultato|${formatoChiave}|${p?.id ?? 'none'}`,
        nomeFile: p ? `riolunato-${p.data}-${slug(p.avversario)}.png` : 'riolunato-risultato.png',
      }
    }
    if (kind === 'formazione') {
      const inp: BuildInput = { ...base, kind: 'formazione', formazione: formazioneGrafica }
      return {
        input: inp,
        seedKey: `formazione|${formatoChiave}|${formazioneGrafica?.creata ?? 'vuota'}`,
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
    avversario,
    dataG,
    oraG,
    inCasaG,
    luogoG,
    partitaRes,
    cognomi,
    meseAttivo,
    fixtures,
    apptOrdinati,
    formazioneGrafica,
  ])

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
        </>
      )}

      {kind === 'risultato' && (
        <div className="social-campo">
          <span className="social-label">Partita giocata</span>
          {partiteGiocate.length ? (
            <Select
              style={{ width: '100%' }}
              value={partitaResIdEff}
              onChange={setPartitaResId}
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
