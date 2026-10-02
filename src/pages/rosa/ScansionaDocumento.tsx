import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { Alert, App, Button, Collapse, Form, Input, Modal, Progress, Segmented, Select, Space, Typography } from 'antd'
import {
  CameraOutlined,
  CloseOutlined,
  IdcardOutlined,
  LoadingOutlined,
  MedicineBoxOutlined,
  PictureOutlined,
  CarOutlined,
} from '@ant-design/icons'
import { useCollection } from '../../hooks/useCollection'
import { DataPicker, propsCampoData } from '../../components/DataPicker'
import { leggiFoto, chiudiLettore } from '../../lib/ocr'
import {
  leggiDocumento,
  trovaTesserato,
  unisciLetture,
  type DatiLetti,
  type TipoDocumento,
} from '../../lib/scansione'
import { formatData } from '../../lib/format'
import type { Giocatore } from '../../types'

const { Text } = Typography

const NUOVO = '__nuovo'
const MAX_FOTO = 3

const TIPI: { value: TipoDocumento; label: string; icon: ReactNode; consiglio: string }[] = [
  {
    value: 'visita',
    label: 'Visita medica',
    icon: <MedicineBoxOutlined />,
    consiglio:
      'Fotografa il certificato intero, dritto e ben illuminato: servono il nome e le date (visita o scadenza).',
  },
  {
    value: 'identita',
    label: "Carta d'identità",
    icon: <IdcardOutlined />,
    consiglio:
      'Sulla carta elettronica fotografa prima il RETRO: le tre righe con i «<<<» in basso si leggono quasi sempre giuste. Poi, se vuoi, anche il fronte.',
  },
  {
    value: 'patente',
    label: 'Patente',
    icon: <CarOutlined />,
    consiglio: 'Fotografa il fronte della patente (i campi numerati 1, 2, 3, 4b, 5), riempiendo quasi tutta la foto.',
  },
]

interface Foto {
  id: string
  url: string
  file: File
  stato: 'attesa' | 'lettura' | 'fatta' | 'errore'
  testo?: string
  fiducia?: number
}

type Campi = Pick<Giocatore, 'nome' | 'cognome' | 'nascita' | 'documento' | 'scadenzaDocumento' | 'scadenzaCertificato'>

const CAMPI_DOC = ['nascita', 'documento', 'scadenzaDocumento'] as const
const NOMI_CAMPO: Record<keyof Campi, string> = {
  nome: 'Nome',
  cognome: 'Cognome',
  nascita: 'Data di nascita',
  documento: 'N. documento',
  scadenzaDocumento: 'Scadenza documento',
  scadenzaCertificato: 'Scadenza certificato',
}

/**
 * Scansione di un documento con la fotocamera: legge il testo nel telefono
 * (vedi lib/ocr.ts), ne ricava i campi (lib/scansione.ts) e li propone in
 * un modulo da controllare prima di salvarli sul tesserato. Con
 * `giocatore` il tesserato è già scelto (dalla sua scheda); altrimenti lo
 * si riconosce dal nome letto, o se ne crea uno nuovo.
 */
export function ScansionaDocumento({
  open,
  onClose,
  giocatore,
}: {
  open: boolean
  onClose: () => void
  giocatore?: Giocatore
}) {
  const { message } = App.useApp()
  const { items, add, update } = useCollection<Giocatore>('giocatori')
  const [form] = Form.useForm<Campi>()
  const valoriForm = Form.useWatch([], form) as Partial<Campi> | undefined
  const [tipo, setTipo] = useState<TipoDocumento>('visita')
  const [foto, setFoto] = useState<Foto[]>([])
  const [avanzamento, setAvanzamento] = useState<{ fase: string; percento: number } | null>(null)
  const [scelto, setScelto] = useState<string | undefined>(giocatore?.id)
  const sceltoAMano = useRef(!!giocatore)
  const inputCamera = useRef<HTMLInputElement>(null)
  const inputGalleria = useRef<HTMLInputElement>(null)
  const inLettura = useRef(false)

  const tesserati = useMemo(
    () => [...items].sort((a, b) => `${a.cognome} ${a.nome}`.localeCompare(`${b.cognome} ${b.nome}`)),
    [items],
  )
  const fatte = foto.filter((f) => f.stato === 'fatta')
  const testi = fatte.map((f) => f.testo ?? '')
  const letti: DatiLetti | null = useMemo(
    () => (testi.length ? unisciLetture(testi.map((t) => leggiDocumento(tipo, t))) : null),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [tipo, testi.join('\u0000')],
  )
  const daPersona = scelto && scelto !== NUOVO ? items.find((g) => g.id === scelto) : undefined
  const nuovo = scelto === NUOVO

  // coda di lettura: una foto alla volta (il lettore è uno solo)
  useEffect(() => {
    if (inLettura.current) return
    const prossima = foto.find((f) => f.stato === 'attesa')
    if (!prossima) return
    inLettura.current = true
    setFoto((fs) => fs.map((f) => (f.id === prossima.id ? { ...f, stato: 'lettura' } : f)))
    leggiFoto(prossima.file, (fase, percento) => setAvanzamento({ fase, percento }), { mrz: tipo === 'identita' })
      .then((r) =>
        setFoto((fs) =>
          fs.map((f) => (f.id === prossima.id ? { ...f, stato: 'fatta', testo: r.testo, fiducia: r.fiducia } : f)),
        ),
      )
      .catch((e) => {
        console.error(e)
        message.error('Non riesco a leggere la foto. Serve la connessione la prima volta (si scarica il lettore).')
        setFoto((fs) => fs.map((f) => (f.id === prossima.id ? { ...f, stato: 'errore' } : f)))
      })
      .finally(() => {
        inLettura.current = false
        setAvanzamento(null)
      })
  }, [foto, message, tipo])

  // a ogni lettura nuova: riconosce il tesserato e riempie i campi non toccati a mano
  useEffect(() => {
    if (!letti) return
    if (!sceltoAMano.current) {
      const chi = trovaTesserato(testi.join('\n'), items, letti)
      setScelto(chi ? chi.id : tipo !== 'visita' && letti.cognome && letti.nome ? NUOVO : undefined)
    }
    const valori: Partial<Campi> = {}
    for (const k of Object.keys(NOMI_CAMPO) as (keyof Campi)[]) {
      const v = letti[k as keyof DatiLetti]
      if (typeof v === 'string' && !form.isFieldTouched(k)) (valori as Record<string, string>)[k] = v
    }
    form.setFieldsValue(valori)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [letti])

  function aggiungiFile(lista: FileList | null) {
    if (!lista) return
    const nuove = [...lista]
      .filter((f) => f.type.startsWith('image/') || /\.(heic|heif|jpe?g|png|webp)$/i.test(f.name))
      .slice(0, MAX_FOTO - foto.length)
      .map<Foto>((file) => ({ id: crypto.randomUUID(), url: URL.createObjectURL(file), file, stato: 'attesa' }))
    setFoto((fs) => [...fs, ...nuove])
  }

  function togliFoto(id: string) {
    setFoto((fs) => {
      const f = fs.find((x) => x.id === id)
      if (f) URL.revokeObjectURL(f.url)
      return fs.filter((x) => x.id !== id)
    })
  }

  function cambiaTipo(t: TipoDocumento) {
    setTipo(t)
    // i campi del tipo di prima non valgono più: si ripartono dalla lettura
    form.resetFields()
  }

  function azzera() {
    foto.forEach((f) => URL.revokeObjectURL(f.url))
    setFoto([])
    setTipo('visita')
    setScelto(giocatore?.id)
    sceltoAMano.current = !!giocatore
    setAvanzamento(null)
    form.resetFields()
  }

  async function salva() {
    const v = await form.validateFields()
    const pulito = (s?: string) => (s && s.trim() ? s.trim() : undefined)
    const patch: Partial<Giocatore> = {}
    if (tipo === 'visita') {
      if (!v.scadenzaCertificato) {
        message.warning('Manca la scadenza del certificato.')
        return
      }
      patch.certificatoMedico = true
      patch.scadenzaCertificato = v.scadenzaCertificato
    } else {
      for (const k of CAMPI_DOC) {
        const val = pulito(v[k])
        if (val) patch[k] = k === 'documento' ? val.toUpperCase() : val
      }
    }
    if (nuovo) {
      const nome = pulito(v.nome)
      const cognome = pulito(v.cognome)
      if (!nome || !cognome) return
      add({
        nome,
        cognome,
        categoria: 'giocatore',
        certificatoMedico: false,
        quotaPagata: false,
        ruoliAdattati: [],
        ...patch,
      })
      message.success(`${cognome} ${nome} aggiunto alla rosa.`)
    } else if (daPersona) {
      if (!Object.keys(patch).length) {
        message.warning('Non c’è niente da salvare: compila almeno un campo.')
        return
      }
      update(daPersona.id, patch)
      message.success(`Dati salvati su ${daPersona.cognome} ${daPersona.nome}.`)
    } else return
    onClose()
  }

  /** Sotto al campo: se è dedotto, e cosa c'è adesso sul tesserato se è diverso. */
  function aiuto(k: keyof Campi, data = false) {
    const pezzi: string[] = []
    if (letti?.dedotti.includes(k as keyof DatiLetti))
      pezzi.push(
        k === 'scadenzaCertificato' && letti.dataVisita
          ? `Ricavata dalla visita del ${formatData(letti.dataVisita, true)} + 1 anno: controlla`
          : 'Ricavato per deduzione: controlla',
      )
    const attuale = daPersona?.[k]
    if (attuale && typeof attuale === 'string' && attuale !== valoriForm?.[k])
      pezzi.push(`ora in scheda: ${data ? formatData(attuale, true) : attuale}`)
    return pezzi.length ? pezzi.join(' · ') : undefined
  }

  const tipoInfo = TIPI.find((t) => t.value === tipo)!
  const leggendo = foto.some((f) => f.stato === 'attesa' || f.stato === 'lettura')
  const nienteLetto = fatte.length > 0 && letti && !Object.keys(NOMI_CAMPO).some((k) => letti[k as keyof DatiLetti])
  // con la scheda già scelta, avvisa se il documento sembra di qualcun altro
  const altraPersona =
    giocatore && letti?.cognome && letti.nome && !trovaTesserato(testi.join('\n'), [giocatore], letti)
      ? `${letti.cognome} ${letti.nome}`
      : null

  return (
    <Modal
      title="Scansiona documento"
      open={open}
      onCancel={onClose}
      afterClose={() => {
        azzera()
        void chiudiLettore()
      }}
      maskClosable={false}
      destroyOnHidden
      footer={
        <Space>
          <Button onClick={onClose}>Annulla</Button>
          <Button type="primary" onClick={salva} disabled={!letti || leggendo || (!daPersona && !nuovo)}>
            {nuovo ? 'Aggiungi alla rosa' : 'Salva'}
          </Button>
        </Space>
      }
    >
      <div className="scansione">
        <div>
          <Text strong>Che documento è?</Text>
          <Segmented
            block
            className="scansione-tipo"
            value={tipo}
            onChange={(t) => cambiaTipo(t as TipoDocumento)}
            options={TIPI.map((t) => ({
              value: t.value,
              label: (
                <span className="scansione-tipo-opt">
                  {t.icon}
                  <span>{t.label}</span>
                </span>
              ),
            }))}
          />
          <Text type="secondary" className="scansione-consiglio">
            {tipoInfo.consiglio}
          </Text>
        </div>

        <input
          ref={inputCamera}
          type="file"
          accept="image/*"
          capture="environment"
          hidden
          onChange={(e) => {
            aggiungiFile(e.target.files)
            e.target.value = ''
          }}
        />
        <input
          ref={inputGalleria}
          type="file"
          accept="image/*"
          multiple
          hidden
          onChange={(e) => {
            aggiungiFile(e.target.files)
            e.target.value = ''
          }}
        />

        {foto.length < MAX_FOTO && (
          <div className="scansione-bottoni">
            <Button type="primary" icon={<CameraOutlined />} onClick={() => inputCamera.current?.click()}>
              {foto.length ? 'Un’altra foto' : 'Scatta foto'}
            </Button>
            <Button icon={<PictureOutlined />} onClick={() => inputGalleria.current?.click()}>
              Dalla galleria
            </Button>
          </div>
        )}

        {foto.length > 0 && (
          <div className="scansione-foto">
            {foto.map((f) => (
              <div key={f.id} className={`scansione-miniatura stato-${f.stato}`}>
                <img src={f.url} alt="" />
                {(f.stato === 'attesa' || f.stato === 'lettura') && (
                  <span className="scansione-miniatura-stato">
                    <LoadingOutlined />
                  </span>
                )}
                {f.stato === 'errore' && <span className="scansione-miniatura-stato">!</span>}
                <button
                  type="button"
                  className="scansione-miniatura-togli"
                  aria-label="Togli la foto"
                  onClick={() => togliFoto(f.id)}
                  disabled={f.stato === 'lettura'}
                >
                  <CloseOutlined />
                </button>
              </div>
            ))}
          </div>
        )}

        {avanzamento && (
          <div>
            <Text type="secondary">{avanzamento.fase}…</Text>
            <Progress percent={avanzamento.percento} size="small" showInfo={false} />
          </div>
        )}

        <Text type="secondary" className="scansione-privacy">
          La foto viene letta qui sul telefono e non viene salvata né inviata da nessuna parte.
        </Text>

        {nienteLetto && !leggendo && (
          <Alert
            type="warning"
            showIcon
            message="Non ho trovato i dati"
            description="Riprova con una foto più vicina, dritta e senza riflessi, oppure scrivili qui sotto a mano."
          />
        )}

        {letti && (
          <>
            {letti.mrzValido && (
              <Alert type="success" showIcon message="Codice in basso letto e verificato: i dati sono affidabili." />
            )}
            {altraPersona && (
              <Alert
                type="warning"
                showIcon
                message={`Il documento sembra di ${altraPersona}, non di ${giocatore!.cognome} ${giocatore!.nome}.`}
              />
            )}

            {!giocatore && (
              <div>
                <Text strong>Di chi è?</Text>
                <Select
                  showSearch
                  style={{ width: '100%', marginTop: 6 }}
                  placeholder="Scegli il tesserato"
                  value={scelto}
                  optionFilterProp="label"
                  onChange={(v) => {
                    sceltoAMano.current = true
                    setScelto(v)
                  }}
                  options={[
                    { value: NUOVO, label: '+ Nuovo tesserato' },
                    ...tesserati.map((g) => ({ value: g.id, label: `${g.cognome} ${g.nome}` })),
                  ]}
                />
                {!scelto && (
                  <Text type="secondary" className="scansione-consiglio">
                    Non ho riconosciuto il nome: scegli tu dall’elenco.
                  </Text>
                )}
              </div>
            )}

            <Form form={form} layout="vertical" requiredMark={false} className="scansione-campi">
              {nuovo && (
                <div className="scansione-riga">
                  <Form.Item label="Nome" name="nome" rules={[{ required: true, whitespace: true, message: 'Inserisci il nome' }]}>
                    <Input />
                  </Form.Item>
                  <Form.Item
                    label="Cognome"
                    name="cognome"
                    rules={[{ required: true, whitespace: true, message: 'Inserisci il cognome' }]}
                  >
                    <Input />
                  </Form.Item>
                </div>
              )}
              {tipo === 'visita' ? (
                <Form.Item
                  label={NOMI_CAMPO.scadenzaCertificato}
                  name="scadenzaCertificato"
                  extra={aiuto('scadenzaCertificato', true)}
                  {...propsCampoData}
                >
                  <DataPicker />
                </Form.Item>
              ) : (
                <>
                  <Form.Item label={NOMI_CAMPO.documento} name="documento" extra={aiuto('documento')}>
                    <Input style={{ textTransform: 'uppercase' }} />
                  </Form.Item>
                  <div className="scansione-riga">
                    <Form.Item
                      label={NOMI_CAMPO.nascita}
                      name="nascita"
                      extra={aiuto('nascita', true)}
                      {...propsCampoData}
                    >
                      <DataPicker />
                    </Form.Item>
                    <Form.Item
                      label={NOMI_CAMPO.scadenzaDocumento}
                      name="scadenzaDocumento"
                      extra={aiuto('scadenzaDocumento', true)}
                      {...propsCampoData}
                    >
                      <DataPicker />
                    </Form.Item>
                  </div>
                </>
              )}
            </Form>

            <Collapse
              size="small"
              ghost
              items={[
                {
                  key: 'testo',
                  label: 'Testo letto dalla foto',
                  children: <pre className="scansione-testo">{testi.map((t) => t.replace(/\n{2,}/g, '\n').trim()).join('\n— — —\n') || '(niente)'}</pre>,
                },
              ]}
            />
          </>
        )}
      </div>
    </Modal>
  )
}
