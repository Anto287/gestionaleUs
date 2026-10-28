import { useRef, useState } from 'react'
import { App, Button, Modal, Space, Typography } from 'antd'
import {
  CameraOutlined,
  DeleteOutlined,
  PaperClipOutlined,
  UploadOutlined,
} from '@ant-design/icons'
import {
  AnteprimaDocumento,
  anteprimaDi,
} from '../../components/AnteprimaDocumento'
import type { Documento } from '../../types'

export const MAX_ALLEGATI = 10
export function AllegatiMovimento({
  allegati,
  files,
  disabled,
  onAllegati,
  onFiles,
}: {
  allegati: Documento[]
  files: File[]
  disabled: boolean
  onAllegati: (value: Documento[]) => void
  onFiles: (value: File[]) => void
}) {
  const foto = useRef<HTMLInputElement>(null)
  const carica = useRef<HTMLInputElement>(null)
  const [anteprima, setAnteprima] = useState<Documento | null>(null)
  const { message } = App.useApp()
  function seleziona(lista: FileList | null) {
    const validi: File[] = []
    for (const f of Array.from(lista ?? [])) {
      if (!f.type.startsWith('image/') && f.type !== 'application/pdf') {
        message.error(`${f.name}: scegli un’immagine o un PDF.`)
      } else if (f.size > 10 * 1024 * 1024) {
        message.error(`${f.name}: dimensione massima 10 MB.`)
      } else if (
        allegati.length + files.length + validi.length >=
        MAX_ALLEGATI
      ) {
        message.warning(
          `Puoi allegare al massimo ${MAX_ALLEGATI} file per movimento.`,
        )
        break
      } else validi.push(f)
    }
    onFiles([...files, ...validi])
  }
  return (
    <div className="ricevute">
      <Typography.Text strong>Scontrini e ricevute</Typography.Text>
      <Typography.Paragraph type="secondary">
        Immagini o PDF, fino a 10 MB per file. Quando salvi, le foto vengono
        compresse a qualità molto bassa per caricarle più velocemente.
        L’anteprima mostra il file compresso.
      </Typography.Paragraph>
      <input
        ref={foto}
        type="file"
        accept="image/*"
        capture="environment"
        hidden
        disabled={disabled}
        aria-label="Scatta foto scontrino"
        onChange={(e) => {
          seleziona(e.target.files)
          e.target.value = ''
        }}
      />
      <input
        ref={carica}
        type="file"
        accept="image/*,application/pdf"
        multiple
        hidden
        disabled={disabled}
        aria-label="Carica scontrini"
        onChange={(e) => {
          seleziona(e.target.files)
          e.target.value = ''
        }}
      />
      <Space wrap>
        <Button
          icon={<CameraOutlined />}
          disabled={disabled || allegati.length + files.length >= MAX_ALLEGATI}
          onClick={() => foto.current?.click()}
        >
          Scatta foto
        </Button>
        <Button
          icon={<UploadOutlined />}
          disabled={disabled || allegati.length + files.length >= MAX_ALLEGATI}
          onClick={() => carica.current?.click()}
        >
          Carica file
        </Button>
      </Space>
      <ul className="ricevute-list">
        {allegati.map((a) => (
          <li key={a.id}>
            <Button
              type="link"
              icon={<PaperClipOutlined />}
              onClick={() => setAnteprima(a)}
            >
              {a.nome}
            </Button>
            <Button
              type="text"
              danger
              disabled={disabled}
              aria-label={`Scollega ${a.nome}`}
              icon={<DeleteOutlined />}
              onClick={() => onAllegati(allegati.filter((x) => x.id !== a.id))}
            />
          </li>
        ))}
        {files.map((f, i) => (
          <li key={`${f.name}-${i}`}>
            <span>
              <PaperClipOutlined /> {f.name}{' '}
              <Typography.Text type="secondary">· da caricare</Typography.Text>
            </span>
            <Button
              type="text"
              danger
              disabled={disabled}
              aria-label={`Rimuovi ${f.name}`}
              icon={<DeleteOutlined />}
              onClick={() => onFiles(files.filter((_, n) => n !== i))}
            />
          </li>
        ))}
      </ul>
      {allegati.length > 0 && (
        <Typography.Text type="secondary">
          Scollegare una ricevuta la toglie dal movimento; il file resta nei
          Documenti.
        </Typography.Text>
      )}
      <Modal
        open={!!anteprima}
        title={anteprima?.nome}
        width={760}
        destroyOnHidden
        onCancel={() => setAnteprima(null)}
        footer={
          anteprima?.url ? (
            <Button
              href={anteprima.url}
              target="_blank"
              rel="noopener noreferrer"
            >
              Apri sul Drive
            </Button>
          ) : null
        }
      >
        {anteprima &&
          (anteprimaDi(anteprima) ? (
            <AnteprimaDocumento key={anteprima.id} doc={anteprima} />
          ) : (
            <Typography.Text>Anteprima non disponibile.</Typography.Text>
          ))}
      </Modal>
    </div>
  )
}
