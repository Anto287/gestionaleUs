import { useId, useState, useSyncExternalStore, type CSSProperties } from 'react'
import { Button, Typography } from 'antd'
import { DownloadOutlined } from '@ant-design/icons'
import {
  appInstallata,
  ascoltaInstallazione,
  chiediInstallazione,
  istruzioniInstallazione,
} from '../lib/installazione'

export function PulsanteInstallaApp({ style }: { style?: CSSProperties }) {
  const installata = useSyncExternalStore(ascoltaInstallazione, appInstallata)
  const [mostraGuida, setMostraGuida] = useState(false)
  const [inCorso, setInCorso] = useState(false)
  const idGuida = useId()

  if (installata) return null

  async function installa() {
    setInCorso(true)
    const aperta = await chiediInstallazione()
    setInCorso(false)
    setMostraGuida((visibile) => !aperta && !visibile)
  }

  return (
    <div style={style}>
      <Button
        icon={<DownloadOutlined />}
        loading={inCorso}
        aria-expanded={mostraGuida}
        aria-controls={mostraGuida ? idGuida : undefined}
        onClick={installa}
      >
        Installa app
      </Button>
      {mostraGuida && (
        <Typography.Paragraph id={idGuida} role="status" type="secondary" style={{ maxWidth: 300, margin: '8px 0 0' }}>
          {istruzioniInstallazione(navigator.userAgent, navigator.maxTouchPoints)}
        </Typography.Paragraph>
      )}
    </div>
  )
}
