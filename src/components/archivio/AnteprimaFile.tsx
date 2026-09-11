import { useEffect, useState } from 'react'
import { App, Alert, Button, Modal, Space, Typography } from 'antd'
import { DeleteOutlined, DownloadOutlined, ExportOutlined } from '@ant-design/icons'
import { AnteprimaPdf } from '../AnteprimaPdf'
import { PalloneSpinner } from '../PalloneSpinner'
import { useArchivio } from '../../data/ArchivioProvider'
import { formatData, formatKB } from '../../lib/format'
import type { FileArchivio } from '../../lib/archivio'

/**
 * Guarda un file dell'archivio (documento o foto). Il contenuto non è
 * pubblico sul Drive: lo chiede lo script e arriva qui in base64, quindi si
 * disegna come immagine o, per i PDF, con l'anteprima di stampa.
 */
export function AnteprimaFile({
  file,
  onChiudi,
}: {
  file: FileArchivio | null
  onChiudi: () => void
}) {
  const { contenuto, elimina } = useArchivio()
  const { message, modal } = App.useApp()
  const [dati, setDati] = useState<{ tipo: string; dataBase64: string } | null>(null)
  const [errore, setErrore] = useState('')

  useEffect(() => {
    if (!file) return
    let vivo = true
    setDati(null)
    setErrore('')
    contenuto(file.id)
      .then((c) => vivo && setDati(c))
      .catch((e) => vivo && setErrore(String((e as Error)?.message || e)))
    return () => {
      vivo = false
    }
  }, [file, contenuto])

  function scarica() {
    if (!file || !dati) return
    const a = document.createElement('a')
    a.href = `data:${dati.tipo};base64,${dati.dataBase64}`
    a.download = file.nome
    a.click()
  }

  function chiediElimina() {
    if (!file) return
    modal.confirm({
      title: 'Eliminare questo file?',
      content: (
        <>
          <Typography.Paragraph style={{ marginBottom: 4 }}>
            <b>{file.nome}</b>
          </Typography.Paragraph>
          <Typography.Text type="secondary">
            Finisce nel cestino del Drive, da dove si può ancora recuperare per 30 giorni.
          </Typography.Text>
        </>
      ),
      okText: 'Elimina',
      okButtonProps: { danger: true },
      cancelText: 'Annulla',
      onOk: async () => {
        await elimina(file)
        message.success('File eliminato.')
        onChiudi()
      },
    })
  }

  return (
    <Modal
      open={!!file}
      onCancel={onChiudi}
      title={file?.nome}
      width={760}
      className="modale-anteprima"
      footer={
        <Space wrap>
          <Button danger icon={<DeleteOutlined />} onClick={chiediElimina}>
            Elimina
          </Button>
          {file?.url && (
            <Button icon={<ExportOutlined />} href={file.url} target="_blank" rel="noopener">
              Apri sul Drive
            </Button>
          )}
          <Button type="primary" icon={<DownloadOutlined />} disabled={!dati} onClick={scarica}>
            Scarica
          </Button>
        </Space>
      }
      destroyOnHidden
    >
      {file && (
        <Typography.Paragraph type="secondary" style={{ marginBottom: 12 }}>
          {formatKB(file.dimensione)} · sul Drive dal {formatData(file.caricatoIl, true)}
        </Typography.Paragraph>
      )}
      {errore && (
        <Alert
          type="warning"
          showIcon
          message="Non riesco a mostrare questo file"
          description={`${errore}. Puoi aprirlo direttamente sul Drive.`}
        />
      )}
      {!errore && !dati && (
        <div className="anteprima-caricamento">
          <PalloneSpinner />
          <Typography.Text type="secondary">Scarico il file dal Drive…</Typography.Text>
        </div>
      )}
      {dati?.tipo === 'application/pdf' ? (
        <AnteprimaPdf
          base64={dati.dataBase64}
          onErrore={() => setErrore('anteprima del PDF non riuscita')}
        />
      ) : (
        dati && (
          <div className="anteprima-doc">
            <img
              src={`data:${dati.tipo};base64,${dati.dataBase64}`}
              alt={file?.nome}
              className="archivio-anteprima-img"
            />
          </div>
        )
      )}
    </Modal>
  )
}
