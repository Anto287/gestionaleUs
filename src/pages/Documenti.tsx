import { useMemo, useState } from 'react'
import { Button, Empty, Input, List, Space, Upload, Popconfirm, Typography } from 'antd'
import {
  UploadOutlined,
  FileOutlined,
  DownloadOutlined,
  DeleteOutlined,
  SearchOutlined,
} from '@ant-design/icons'
import { useCollection } from '../hooks/useCollection'
import { useData } from '../data/DataProvider'
import { PageHeader } from '../components/PageHeader'
import { formatData, formatKB } from '../lib/format'
import type { Documento } from '../types'

export function Documenti() {
  const { items, remove } = useCollection<Documento>('documenti')
  const { uploadDoc } = useData()
  const [caricando, setCaricando] = useState(false)
  const [q, setQ] = useState('')

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
      <Button type="primary" icon={<UploadOutlined />} loading={caricando}>
        Carica documenti
      </Button>
    </Upload>
  )

  return (
    <>
      <PageHeader
        titolo="Documenti"
        sottotitolo="Archivio della società"
        azioni={items.length > 0 && uploadButton}
      />

      {items.length === 0 ? (
        <Empty description="Nessun documento: carica certificati, moduli, verbali. Finiscono nella cartella Documenti sul Drive.">
          {uploadButton}
        </Empty>
      ) : (
        <>
          <Space wrap style={{ marginBottom: 16 }}>
            <Input
              allowClear
              prefix={<SearchOutlined />}
              placeholder="Cerca documento"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              style={{ width: 260 }}
            />
          </Space>
          <List
            bordered
            dataSource={documenti}
          renderItem={(d) => (
            <List.Item
              actions={[
                (d.url || d.dataUrl) && (
                  <Button key="open" type="text" icon={<DownloadOutlined />} onClick={() => apri(d)} />
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
                avatar={<FileOutlined style={{ fontSize: 22, color: '#c22026' }} />}
                title={d.nome}
                description={
                  <Typography.Text type="secondary">
                    {formatKB(d.dimensione)} · caricato il {formatData(d.caricatoIl, true)}
                  </Typography.Text>
                }
              />
            </List.Item>
          )}
          />
        </>
      )}
    </>
  )
}
