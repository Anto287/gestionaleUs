import { useEffect, useState } from 'react'
import { Alert, Button, Card, Space, Tag, Tooltip, Typography } from 'antd'
import {
  CameraOutlined,
  FileImageOutlined,
  IdcardOutlined,
  PlusOutlined,
  SwapOutlined,
} from '@ant-design/icons'
import { useArchivio } from '../../data/ArchivioProvider'
import { AnteprimaFile } from './AnteprimaFile'
import { CaricaFile, type AperturaCarica } from './CaricaFile'
import { nascitaIso, type FileArchivio } from '../../lib/archivio'
import type { Giocatore } from '../../types'

const { Text } = Typography

type Genere = 'foto' | 'fronte' | 'retro'

const CASELLE: { genere: Genere; titolo: string; vuoto: string }[] = [
  { genere: 'foto', titolo: 'Foto', vuoto: 'Nessuna foto' },
  { genere: 'fronte', titolo: 'Documento · fronte', vuoto: 'Manca il fronte' },
  { genere: 'retro', titolo: 'Documento · retro', vuoto: 'Manca il retro' },
]

function Casella({
  titolo,
  vuoto,
  file,
  miniatura,
  onApri,
  onCarica,
}: {
  titolo: string
  vuoto: string
  file?: FileArchivio
  miniatura?: string
  onApri: () => void
  onCarica: () => void
}) {
  return (
    <div className="archivio-casella">
      {file ? (
        <button type="button" className="archivio-tile" onClick={onApri} title={file.nome}>
          {miniatura ? (
            <img src={miniatura} alt={titolo} />
          ) : (
            <FileImageOutlined className="archivio-tile-icona" />
          )}
        </button>
      ) : (
        <button type="button" className="archivio-tile archivio-tile-vuota" onClick={onCarica}>
          <PlusOutlined />
          <span>{vuoto}</span>
        </button>
      )}
      <div className="archivio-casella-piede">
        <Text className="archivio-casella-titolo">{titolo}</Text>
        {file && (
          <Tooltip title="Sostituisci">
            <Button type="text" size="small" icon={<SwapOutlined />} onClick={onCarica} />
          </Tooltip>
        )}
      </div>
    </div>
  )
}

/**
 * I documenti e la foto del tesserato, presi dalle due cartelle
 * dell'archivio sul Drive e agganciati per nome e cognome.
 */
export function ArchivioTesserato({ giocatore }: { giocatore: Giocatore }) {
  const { stato, scheda, miniatura, chiediMiniature, omonimo } = useArchivio()
  const [anteprima, setAnteprima] = useState<FileArchivio | null>(null)
  const [carica, setCarica] = useState<AperturaCarica | null>(null)

  const files = scheda(giocatore.id)
  const idFoto = files.foto?.id
  const idFronte = files.fronte?.id
  const idRetro = files.retro?.id

  useEffect(() => {
    chiediMiniature([idFoto, idFronte, idRetro])
  }, [idFoto, idFronte, idRetro, chiediMiniature])

  // lo script del Drive non conosce ancora l'archivio: sezione nascosta
  if (stato === 'assente') return null

  const ambiguo = omonimo(giocatore) && !nascitaIso(giocatore.nascita)

  return (
    <Card
      title={
        <Space>
          <IdcardOutlined />
          Documenti e foto
        </Space>
      }
      style={{ marginTop: 16 }}
      extra={
        <Button
          size="small"
          type="primary"
          icon={<CameraOutlined />}
          onClick={() => setCarica({ genere: 'foto', idTesserato: giocatore.id })}
        >
          Aggiungi
        </Button>
      }
      loading={stato === 'carico'}
    >
      {stato === 'errore' && (
        <Alert
          type="warning"
          showIcon
          style={{ marginBottom: 12 }}
          message="Non riesco a leggere l'archivio sul Drive"
        />
      )}
      {ambiguo && (
        <Alert
          type="warning"
          showIcon
          style={{ marginBottom: 12 }}
          message="C'è un altro tesserato con lo stesso nome e cognome"
          description="Compila la data di nascita qui e nel nome dei file (Nome_Cognome_gg-mm-aaaa_fronte) per tenerli distinti."
        />
      )}
      <div className="archivio-caselle">
        {CASELLE.map((c) => (
          <Casella
            key={c.genere}
            titolo={c.titolo}
            vuoto={c.vuoto}
            file={files[c.genere]}
            miniatura={miniatura(files[c.genere]?.id)}
            onApri={() => setAnteprima(files[c.genere] ?? null)}
            onCarica={() => setCarica({ genere: c.genere, idTesserato: giocatore.id })}
          />
        ))}
      </div>
      {files.altri.length > 0 && (
        <div style={{ marginTop: 12 }}>
          <Text type="secondary">Altri file suoi in archivio: </Text>
          <Space size={[6, 6]} wrap style={{ marginTop: 6 }}>
            {files.altri.map((f) => (
              <Tag key={f.id} style={{ cursor: 'pointer' }} onClick={() => setAnteprima(f)}>
                {f.nome}
              </Tag>
            ))}
          </Space>
        </div>
      )}

      <AnteprimaFile file={anteprima} onChiudi={() => setAnteprima(null)} />
      <CaricaFile apertura={carica} onChiudi={() => setCarica(null)} />
    </Card>
  )
}
