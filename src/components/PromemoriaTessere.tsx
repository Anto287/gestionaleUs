import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from 'react'
import { Alert, App, Card, Modal, Space, Switch, Typography } from 'antd'
import { BellOutlined } from '@ant-design/icons'
import { useManagement } from '../management/useManagement'
import { useSeason } from '../season/SeasonContext'
import {
  confermaStampaTessere, driveAttivo, leggiPromemoriaTessere, type StatoPromemoriaTessere,
} from '../services/driveStore'

const INTERVALLO_MS = 2 * 60 * 1000
const PromemoriaContext = createContext<{
  attivo: boolean
  caricamento: boolean
  salvataggio: boolean
  errore?: string
  configura: (attivo: boolean) => void
} | null>(null)

export function PromemoriaTessereProvider({ children }: { children: ReactNode }) {
  const { attiva: stagione } = useSeason()
  const { request } = useManagement()
  const { message } = App.useApp()
  const [lettura, setLettura] = useState<{ stagione: string; stato?: StatoPromemoriaTessere; errore?: string }>()
  const [operazione, setOperazione] = useState<'configura' | 'conferma' | null>(null)
  const [rimandato, setRimandato] = useState(false)
  const scrittura = useRef(false)
  const corrente = lettura?.stagione === stagione ? lettura : undefined
  const stato = corrente?.stato

  useEffect(() => {
    if (!driveAttivo() || operazione) return
    let montato = true
    let inCorso = false

    async function aggiorna() {
      if (inCorso || scrittura.current || document.visibilityState !== 'visible') return
      inCorso = true
      try {
        const dati = await leggiPromemoriaTessere(stagione)
        if (typeof dati.attivo !== 'boolean') throw new Error('azione sconosciuta')
        if (montato && !scrittura.current) setLettura({ stagione, stato: dati })
      } catch (err) {
        if (!montato || scrittura.current) return
        const errore = (err as Error).message === 'azione sconosciuta'
          ? 'Aggiorna e ripubblica Google Apps Script per usare il promemoria.'
          : 'Impossibile verificare il promemoria. L’app riproverà automaticamente.'
        setLettura((prev) => ({ stagione, stato: prev?.stagione === stagione ? prev.stato : undefined, errore }))
      } finally {
        inCorso = false
      }
    }

    void aggiorna()
    const timer = window.setInterval(aggiorna, INTERVALLO_MS)
    document.addEventListener('visibilitychange', aggiorna)
    return () => {
      montato = false
      window.clearInterval(timer)
      document.removeEventListener('visibilitychange', aggiorna)
    }
  }, [stagione, operazione])

  async function salva(tipo: 'configura' | 'conferma', modifica: () => Promise<StatoPromemoriaTessere>) {
    if (scrittura.current) return
    scrittura.current = true
    setOperazione(tipo)
    try {
      setLettura({ stagione, stato: await modifica() })
    } catch (err) {
      message.error((err as Error).message)
    } finally {
      scrittura.current = false
      setOperazione(null)
    }
  }

  const conferma = () => {
    if (stato) return salva('conferma', () => confermaStampaTessere(stagione, stato))
  }
  const rimanda = () => {
    if (!scrittura.current) setRimandato(true)
  }

  return (
    <PromemoriaContext.Provider value={{
      attivo: !!stato?.attivo,
      caricamento: !corrente,
      salvataggio: operazione === 'configura',
      errore: corrente?.errore,
      configura: (attivo) => salva('configura', () => request('configuraPromemoriaTessere', { season: stagione, attivo })),
    }}>
      {children}
      <Modal
        title="Stampa della lista dei tesserini"
        open={!!stato?.nuovi && !rimandato}
        okText="Sì, ho stampato"
        cancelText="Ricordamelo più tardi"
        onOk={conferma}
        onCancel={rimanda}
        confirmLoading={operazione === 'conferma'}
        cancelButtonProps={{ disabled: operazione === 'conferma' }}
        closable={false}
        maskClosable={false}
      >
        <p>{stato?.nuovi === 1 ? 'È stato aggiunto un nuovo tesserato.' : `Sono stati aggiunti ${stato?.nuovi ?? 0} nuovi tesserati.`} Ti sei ricordato di stampare la lista aggiornata dei tesserini?</p>
      </Modal>
    </PromemoriaContext.Provider>
  )
}

export function ImpostazionePromemoriaTessere() {
  const stato = useContext(PromemoriaContext)
  if (!stato || !driveAttivo()) return null

  return (
    <Card title={<h2><BellOutlined aria-hidden="true" /> Promemoria tesserini</h2>}>
      <Space direction="vertical">
        <Space wrap>
          <Switch
            aria-label="Promemoria stampa tesserini"
            checked={stato.attivo}
            loading={stato.caricamento || stato.salvataggio}
            disabled={!!stato.errore}
            onChange={stato.configura}
          />
          <Typography.Text>Ricorda di stampare la lista dei tesserini</Typography.Text>
        </Space>
        <Typography.Text type="secondary">
          Impostazione condivisa. L’avviso compare quando si compila il campo Tessera di una persona che ne era sprovvista.
        </Typography.Text>
        {stato.errore && <Alert type="warning" showIcon message={stato.errore} />}
      </Space>
    </Card>
  )
}
