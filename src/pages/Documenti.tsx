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

export function Documenti() {
  const { items, remove } = useCollection<Documento>('documenti')
  const { uploadDoc, createDoc } = useData()
  const { message } = AntApp.useApp()
  const [caricando, setCaricando] = useState(false)
  const [q, setQ] = useState('')
  // creazione: tipo scelto dal menu, nome chiesto nel modale
  const [tipoNuovo, setTipoNuovo] = useState<TipoNuovo | null>(null)
  const [nomeNuovo, setNomeNuovo] = useState('')
  const [creando, setCreando] = useState(false)

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
                  (d.url || d.dataUrl) && (
                    <Button
                      key="open"
                      type="text"
                      icon={isGoogleFile(d) ? <ExportOutlined /> : <DownloadOutlined />}
                      onClick={() => apri(d)}
                    />
                  ),
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
                  title={d.nome}
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
    </>
  )
}
