import { useMemo, useState } from 'react'
import {
  App as AntApp,
  Button,
  Dropdown,
  Empty,
  Input,
  List,
  Modal,
  Space,
  Upload,
  Popconfirm,
  Typography,
} from 'antd'
import {
  UploadOutlined,
  FileOutlined,
  FileTextOutlined,
  TableOutlined,
  DownloadOutlined,
  ExportOutlined,
  DeleteOutlined,
  SearchOutlined,
  PlusOutlined,
  EyeOutlined,
  EditOutlined,
} from '@ant-design/icons'
import { useCollection } from '../hooks/useCollection'
import { useData } from '../data/DataProvider'
import { driveAttivo } from '../services/driveStore'
import { PageHeader } from '../components/PageHeader'
import { formatData, formatKB } from '../lib/format'
import type { Documento } from '../types'

type TipoNuovo = 'documento' | 'foglio'

const NOME_TIPO: Record<TipoNuovo, string> = {
  documento: 'documento di testo',
  foglio: 'foglio di calcolo',
}

function isGoogleFile(d: Documento) {
  return d.tipo.startsWith('application/vnd.google-apps')
}

function iconaDoc(d: Documento) {
  const style = { fontSize: 22, color: '#c22026' }
  if (d.tipo === 'application/vnd.google-apps.spreadsheet') return <TableOutlined style={style} />
  if (d.tipo === 'application/vnd.google-apps.document') return <FileTextOutlined style={style} />
  return <FileOutlined style={style} />
}

/**
 * Che anteprima possiamo mostrare senza scaricare: per i file sul Drive
 * l'indirizzo /preview incorporabile (vale per Documenti/Fogli Google e per
 * i file caricati, PDF e immagini compresi); senza Drive, il contenuto
 * locale per immagini e PDF.
 */
type Anteprima = { modo: 'immagine' | 'iframe'; src: string }

function anteprimaDi(d: Documento): Anteprima | null {
  if (d.url) {
    const m = d.url.match(/\/(file|document|spreadsheets|presentation)\/d\/([\w-]+)/)
    if (!m) return null
    const host = m[1] === 'file' ? 'https://drive.google.com' : 'https://docs.google.com'
    return { modo: 'iframe', src: `${host}/${m[1]}/d/${m[2]}/preview` }
  }
  if (d.dataUrl) {
    if (d.tipo.startsWith('image/')) return { modo: 'immagine', src: d.dataUrl }
    if (d.tipo === 'application/pdf') return { modo: 'iframe', src: d.dataUrl }
  }
  return null
}

export function Documenti() {
  const { items, remove } = useCollection<Documento>('documenti')
  const { uploadDoc, createDoc, renameDoc } = useData()
  const { message } = AntApp.useApp()
  const [caricando, setCaricando] = useState(false)
  const [q, setQ] = useState('')
  // creazione: tipo scelto dal menu, nome chiesto nel modale
  const [tipoNuovo, setTipoNuovo] = useState<TipoNuovo | null>(null)
  const [nomeNuovo, setNomeNuovo] = useState('')
  const [creando, setCreando] = useState(false)
  const [anteprima, setAnteprima] = useState<Documento | null>(null)
  const [daRinominare, setDaRinominare] = useState<Documento | null>(null)
  const [nomeRinomina, setNomeRinomina] = useState('')

  const documenti = useMemo(
    () =>
      [...items]
        .filter((d) => !q || d.nome.toLowerCase().includes(q.toLowerCase()))
        .sort((a, b) => b.caricatoIl.localeCompare(a.caricatoIl)),
    [items, q],
  )

  async function carica(file: File) {
    setCaricando(true)
    await uploadDoc(file)
    setCaricando(false)
  }

  async function crea() {
    const nome = nomeNuovo.trim()
    if (!nome || !tipoNuovo) return
    setCreando(true)
    try {
      const meta = await createDoc(nome, tipoNuovo)
      setTipoNuovo(null)
      message.success(`"${meta.nome}" creato: lo trovi qui e sul Drive.`)
      if (meta.url) window.open(meta.url, '_blank', 'noopener')
    } catch (e) {
      message.error(`Creazione non riuscita: ${String((e as Error)?.message || e)}`)
    } finally {
      setCreando(false)
    }
  }

  function apri(d: Documento) {
    if (d.url) window.open(d.url, '_blank', 'noopener')
    else if (d.dataUrl) {
      const a = document.createElement('a')
      a.href = d.dataUrl
      a.download = d.nome
      a.click()
    }
  }

  function rinomina() {
    const nome = nomeRinomina.trim()
    if (!daRinominare || !nome) return
    if (nome !== daRinominare.nome) {
      renameDoc(daRinominare, nome)
      message.success('Nome aggiornato.')
    }
    setDaRinominare(null)
  }

  const uploadButton = (
    <Upload
      multiple
      showUploadList={false}
      beforeUpload={(file) => {
        void carica(file as unknown as File)
        return false
      }}
    >
      <Button icon={<UploadOutlined />} loading={caricando}>
        Carica
      </Button>
    </Upload>
  )

  // creare file Google ha senso solo col Drive collegato
  const creaButton = driveAttivo() && (
    <Dropdown
      menu={{
        items: [
          { key: 'documento', label: 'Documento di testo', icon: <FileTextOutlined /> },
          { key: 'foglio', label: 'Foglio di calcolo', icon: <TableOutlined /> },
        ],
        onClick: ({ key }) => {
          setNomeNuovo('')
          setTipoNuovo(key as TipoNuovo)
        },
      }}
    >
      <Button type="primary" icon={<PlusOutlined />}>
        Crea
      </Button>
    </Dropdown>
  )

  const azioni = (
    <Space wrap>
      {uploadButton}
      {creaButton}
    </Space>
  )

  return (
    <>
      <PageHeader
        titolo="Documenti"
        sottotitolo="Archivio della società · i file creati si aprono in Documenti/Fogli Google"
        azioni={items.length > 0 && azioni}
      />

      {items.length === 0 ? (
        <Empty description="Nessun documento: carica certificati e moduli, o crea un documento nuovo. Tutto finisce nella cartella Documenti sul Drive.">
          {azioni}
        </Empty>
      ) : (
        <>
          <div className="filtri-aggancio">
            <Space wrap className="filtri-inline">
              <Input
                allowClear
                prefix={<SearchOutlined />}
                placeholder="Cerca documento"
                value={q}
                onChange={(e) => setQ(e.target.value)}
                style={{ width: 260 }}
              />
            </Space>
          </div>
          <List
            bordered
            className="documenti-list"
            dataSource={documenti}
            renderItem={(d) => (
              <List.Item
                actions={[
                  anteprimaDi(d) && (
                    <Button
                      key="preview"
                      type="text"
                      icon={<EyeOutlined />}
                      onClick={() => setAnteprima(d)}
                    />
                  ),
                  (d.url || d.dataUrl) && (
                    <Button
                      key="open"
                      type="text"
                      icon={isGoogleFile(d) ? <ExportOutlined /> : <DownloadOutlined />}
                      onClick={() => apri(d)}
                    />
                  ),
                  <Button
                    key="ren"
                    type="text"
                    icon={<EditOutlined />}
                    onClick={() => {
                      setNomeRinomina(d.nome)
                      setDaRinominare(d)
                    }}
                  />,
                  <Popconfirm
                    key="del"
                    title={`Eliminare ${d.nome}?`}
                    okText="Elimina"
                    cancelText="Annulla"
                    okButtonProps={{ danger: true }}
                    onConfirm={() => remove(d.id)}
                  >
                    <Button type="text" danger icon={<DeleteOutlined />} />
                  </Popconfirm>,
                ].filter(Boolean)}
              >
                <List.Item.Meta
                  avatar={iconaDoc(d)}
                  title={
                    anteprimaDi(d) ? (
                      <Typography.Link onClick={() => setAnteprima(d)}>{d.nome}</Typography.Link>
                    ) : d.url || d.dataUrl ? (
                      <Typography.Link onClick={() => apri(d)}>{d.nome}</Typography.Link>
                    ) : (
                      d.nome
                    )
                  }
                  description={
                    <Typography.Text type="secondary">
                      {isGoogleFile(d)
                        ? `${d.tipo.endsWith('spreadsheet') ? 'Foglio Google' : 'Documento Google'} · creato il ${formatData(d.caricatoIl, true)}`
                        : `${formatKB(d.dimensione)} · caricato il ${formatData(d.caricatoIl, true)}`}
                    </Typography.Text>
                  }
                />
              </List.Item>
            )}
          />
        </>
      )}

      <Modal
        title={tipoNuovo ? `Nuovo ${NOME_TIPO[tipoNuovo]}` : ''}
        open={tipoNuovo !== null}
        onCancel={() => setTipoNuovo(null)}
        onOk={crea}
        okText="Crea e apri"
        cancelText="Annulla"
        okButtonProps={{ disabled: !nomeNuovo.trim(), loading: creando }}
        maskClosable={false}
        destroyOnHidden
      >
        <Input
          autoFocus
          placeholder={tipoNuovo === 'foglio' ? 'es. Quote 2026/27' : 'es. Verbale riunione'}
          value={nomeNuovo}
          onChange={(e) => setNomeNuovo(e.target.value)}
          onPressEnter={crea}
        />
      </Modal>

      <Modal
        title="Rinomina documento"
        open={daRinominare !== null}
        onCancel={() => setDaRinominare(null)}
        onOk={rinomina}
        okText="Salva"
        cancelText="Annulla"
        okButtonProps={{ disabled: !nomeRinomina.trim() }}
        maskClosable={false}
        destroyOnHidden
      >
        <Input
          autoFocus
          value={nomeRinomina}
          onChange={(e) => setNomeRinomina(e.target.value)}
          onPressEnter={rinomina}
        />
      </Modal>

      <Modal
        title={
          anteprima && (
            <span style={{ overflowWrap: 'anywhere', paddingRight: 24, display: 'block' }}>
              {anteprima.nome}
            </span>
          )
        }
        open={anteprima !== null}
        onCancel={() => setAnteprima(null)}
        footer={
          anteprima && (
            <Button
              type="primary"
              icon={anteprima.url ? <ExportOutlined /> : <DownloadOutlined />}
              onClick={() => apri(anteprima)}
            >
              {isGoogleFile(anteprima)
                ? 'Apri per modificare'
                : anteprima.url
                  ? 'Apri sul Drive'
                  : 'Scarica'}
            </Button>
          )
        }
        width="min(920px, calc(100vw - 32px))"
        destroyOnHidden
      >
        {anteprima &&
          (() => {
            const vista = anteprimaDi(anteprima)
            if (!vista) return null
            return vista.modo === 'immagine' ? (
              <img
                src={vista.src}
                alt={anteprima.nome}
                style={{ display: 'block', maxWidth: '100%', maxHeight: '70vh', margin: '0 auto' }}
              />
            ) : (
              <iframe
                src={vista.src}
                title={anteprima.nome}
                style={{ width: '100%', height: '70vh', border: 0 }}
                allow="autoplay"
              />
            )
          })()}
      </Modal>
    </>
  )
}
