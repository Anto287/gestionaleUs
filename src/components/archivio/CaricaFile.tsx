import { useEffect, useMemo, useState } from 'react'
import { App, Alert, Button, Form, Grid, Input, Modal, Segmented, Select, Space, Typography, Upload } from 'antd'
import { CameraOutlined, FileAddOutlined } from '@ant-design/icons'
import { useCollection } from '../../hooks/useCollection'
import { useArchivio } from '../../data/ArchivioProvider'
import dayjs from 'dayjs'
import { DataPicker } from '../DataPicker'
import { estensionePrevista } from '../../lib/immagine'
import { chiaveFile, nascitaIso, nomeArchivio, type Cartella, type Faccia } from '../../lib/archivio'
import type { Giocatore } from '../../types'

const { Text } = Typography

/** Cosa si sta caricando: la foto o una delle due facce del documento. */
type Genere = 'foto' | 'fronte' | 'retro'

const ETICHETTA: Record<Genere, string> = {
  foto: 'Foto',
  fronte: 'Documento fronte',
  retro: 'Documento retro',
}

export interface AperturaCarica {
  genere: Genere
  /** id del tesserato, se si parte dalla sua scheda */
  idTesserato?: string
}

/**
 * Carica una foto o un documento nell'archivio. Si scrivono solo nome e
 * cognome (o si sceglie il tesserato) e si dice se è fronte o retro: il
 * nome del file lo compone l'app con la stessa regola dei file già presenti.
 */
export function CaricaFile({
  apertura,
  onChiudi,
}: {
  apertura: AperturaCarica | null
  onChiudi: () => void
}) {
  const { items: rosa } = useCollection<Giocatore>('giocatori')
  const { carica, elimina, scheda, omonimo, documenti, foto } = useArchivio()
  const { message } = App.useApp()
  const screens = Grid.useBreakpoint()

  const [genere, setGenere] = useState<Genere>('foto')
  const [idTesserato, setIdTesserato] = useState<string>('')
  const [nome, setNome] = useState('')
  const [cognome, setCognome] = useState('')
  const [nascita, setNascita] = useState('')
  const [file, setFile] = useState<File | null>(null)
  const [caricando, setCaricando] = useState(false)

  // all'apertura: riparte sempre pulito, con quel che arriva dalla scheda
  useEffect(() => {
    if (!apertura) return
    const t = rosa.find((g) => g.id === apertura.idTesserato)
    setGenere(apertura.genere)
    setIdTesserato(t?.id ?? '')
    setNome(t?.nome ?? '')
    setCognome(t?.cognome ?? '')
    setNascita(t?.nascita ?? '')
    setFile(null)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [apertura])

  const anteprima = useMemo(() => (file ? URL.createObjectURL(file) : ''), [file])
  useEffect(() => () => URL.revokeObjectURL(anteprima), [anteprima])

  // dalla scheda del giocatore il tesserato è già deciso; dalla pagina
  // Archivio si può sceglierlo dalla rosa o scrivere nome e cognome a mano
  const daScheda = !!apertura?.idTesserato
  const tesserato = idTesserato ? rosa.find((g) => g.id === idTesserato) : undefined
  const inRosa = useMemo(
    () =>
      [...rosa]
        .sort((a, b) => `${a.cognome} ${a.nome}`.localeCompare(`${b.cognome} ${b.nome}`))
        .map((g) => ({ value: g.id, label: `${g.cognome} ${g.nome}` })),
    [rosa],
  )
  const nomeUsato = (tesserato?.nome ?? nome).trim()
  const cognomeUsato = (tesserato?.cognome ?? cognome).trim()
  // in rosa la data è testo libero: per il nome del file serve in ISO
  const nascitaUsata = (tesserato ? nascitaIso(tesserato.nascita) : nascita) ?? ''

  // due tesserati con lo stesso nome: la data di nascita nel nome del file
  // è l'unico modo per distinguerli
  const serveNascita = !!nomeUsato && !!cognomeUsato && omonimo({ nome: nomeUsato, cognome: cognomeUsato })
  const cartella: Cartella = genere === 'foto' ? 'foto' : 'documenti'
  const faccia: Faccia | undefined = genere === 'foto' ? undefined : genere

  const base = useMemo(() => {
    if (!nomeUsato || !cognomeUsato) return ''
    return nomeArchivio({
      nome: nomeUsato,
      cognome: cognomeUsato,
      nascita: nascitaUsata,
      cartella,
      faccia,
      estensione: '',
      conNascita: serveNascita,
    })
  }, [nomeUsato, cognomeUsato, nascitaUsata, cartella, faccia, serveNascita])

  const nomeFinale = base && file ? base + estensionePrevista(file) : base

  /**
   * Il file che verrà sostituito, se esiste: si cerca per NOME, non solo fra
   * quelli del tesserato. Così, scrivendo a mano il nome di un omonimo, si
   * vede prima di caricare che si sta per coprire il file di qualcun altro.
   */
  const gia = useMemo(() => {
    if (!base) return undefined
    const elenco = cartella === 'foto' ? foto : documenti
    const cercata = chiaveFile(base)
    return (
      (tesserato ? scheda(tesserato.id)[genere] : undefined) ??
      elenco.find((f) => chiaveFile(f.nome) === cercata)
    )
  }, [base, cartella, foto, documenti, tesserato, scheda, genere])

  async function conferma() {
    if (!base || !file) return
    setCaricando(true)
    try {
      const item = await carica({ cartella, base, file })
      // il Drive sostituisce solo a parità di nome: se quello di prima si
      // chiamava diversamente lo si toglie qui, come promesso dall'avviso
      if (gia && gia.id !== item.id && chiaveFile(gia.nome) !== chiaveFile(item.nome)) {
        try {
          await elimina(gia)
        } catch {
          message.warning(`Caricato, ma "${gia.nome}" è rimasto sul Drive: eliminalo a mano.`)
        }
      }
      message.success(`Caricato come "${item.nome}".`)
      onChiudi()
    } catch (e) {
      message.error(`Caricamento non riuscito: ${String((e as Error)?.message || e)}`)
    } finally {
      setCaricando(false)
    }
  }

  const scegli = (f: File) => {
    setFile(f)
    return false
  }

  return (
    <Modal
      open={!!apertura}
      onCancel={onChiudi}
      title="Aggiungi all'archivio"
      okText="Carica"
      cancelText="Annulla"
      okButtonProps={{ disabled: !base || !file, loading: caricando }}
      onOk={conferma}
      maskClosable={false}
      destroyOnHidden
    >
      <Form layout="vertical" style={{ marginTop: 12 }}>
        <Form.Item label="Che cosa carichi">
          <Segmented
            block
            value={genere}
            onChange={(v) => setGenere(v as Genere)}
            options={(['foto', 'fronte', 'retro'] as Genere[]).map((g) => ({
              value: g,
              label: ETICHETTA[g],
            }))}
          />
        </Form.Item>

        {!daScheda && (
          <Form.Item label="Tesserato" extra="Se non è in rosa, lascia vuoto e scrivi nome e cognome.">
            <Select
              showSearch
              allowClear
              optionFilterProp="label"
              placeholder="Scegli dalla rosa…"
              value={idTesserato || undefined}
              onChange={(v) => setIdTesserato(v ?? '')}
              options={inRosa}
            />
          </Form.Item>
        )}

        {tesserato ? (
          daScheda && (
            <Form.Item label="Tesserato">
              <Text strong style={{ fontSize: 16 }}>
                {tesserato.nome} {tesserato.cognome}
              </Text>
            </Form.Item>
          )
        ) : (
          <Space size={12} style={{ display: 'flex' }} align="start">
            <Form.Item label="Nome" style={{ flex: 1 }}>
              <Input value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Mario" />
            </Form.Item>
            <Form.Item label="Cognome" style={{ flex: 1 }}>
              <Input value={cognome} onChange={(e) => setCognome(e.target.value)} placeholder="Rossi" />
            </Form.Item>
          </Space>
        )}

        {!tesserato && (
          <Form.Item
            label="Data di nascita (facoltativa)"
            extra="Serve solo se c'è un altro tesserato con lo stesso nome e cognome."
          >
            <DataPicker
              value={nascita ? dayjs(nascita) : undefined}
              onChange={(d) => setNascita(d ? d.format('YYYY-MM-DD') : '')}
            />
          </Form.Item>
        )}

        <Form.Item label="File">
          <Space wrap>
            <Upload accept="image/*,application/pdf" showUploadList={false} beforeUpload={scegli}>
              <Button icon={<FileAddOutlined />}>Scegli file</Button>
            </Upload>
            {!screens.md && (
              <Upload accept="image/*" capture="environment" showUploadList={false} beforeUpload={scegli}>
                <Button icon={<CameraOutlined />}>Scatta foto</Button>
              </Upload>
            )}
          </Space>
          {file && (
            <div className="archivio-scelto">
              {file.type.startsWith('image/') ? (
                <img src={anteprima} alt="" className="archivio-scelto-img" />
              ) : (
                <FileAddOutlined style={{ fontSize: 28, color: 'var(--rosso)' }} />
              )}
              <div>
                <div>
                  <Text type="secondary">Verrà salvato come</Text>
                </div>
                <Text code>{nomeFinale}</Text>
              </div>
            </div>
          )}
        </Form.Item>

        {serveNascita && !nascitaUsata && (
          <Alert
            type="warning"
            showIcon
            style={{ marginBottom: 12 }}
            message="C'è un altro tesserato con lo stesso nome"
            description="Aggiungi la data di nascita, altrimenti il file non si riesce ad agganciare alla persona giusta."
          />
        )}
        {gia && (
          <Alert
            type="info"
            showIcon
            message={`Sostituisce "${gia.nome}"`}
            description="Il file di prima finisce nel cestino del Drive: se ne tiene uno solo."
          />
        )}
      </Form>
    </Modal>
  )
}
