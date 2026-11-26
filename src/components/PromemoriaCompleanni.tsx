import { useEffect, useRef, useState } from 'react'
import { Alert, Modal } from 'antd'
import { CONFERME_COMPLEANNI } from '../collections'
import { useData } from '../data/DataProvider'
import { compleanniDaVedere, giornoCompleanni } from '../lib/compleanni'
import { formatData } from '../lib/format'
import type { Giocatore } from '../types'

export function PromemoriaCompleanni() {
  const { getItems, confermaCompleanno } = useData()
  const [giorno, setGiorno] = useState(giornoCompleanni)
  const [rimandato, setRimandato] = useState<string>()
  const [salvataggio, setSalvataggio] = useState(false)
  const [errore, setErrore] = useState(false)
  const inCorso = useRef(false)
  const compleanni = compleanniDaVedere(
    getItems<Giocatore>('giocatori'),
    giorno,
    getItems<{ id: string }>(CONFERME_COMPLEANNI),
  )

  useEffect(() => {
    const aggiorna = () => {
      if (document.visibilityState === 'visible') setGiorno(giornoCompleanni())
    }
    const timer = window.setInterval(aggiorna, 30_000)
    document.addEventListener('visibilitychange', aggiorna)
    return () => {
      window.clearInterval(timer)
      document.removeEventListener('visibilitychange', aggiorna)
    }
  }, [])

  async function conferma() {
    if (inCorso.current) return
    inCorso.current = true
    setSalvataggio(true)
    setErrore(false)
    try {
      const esiti = await Promise.allSettled(compleanni.map(({ id }) => confermaCompleanno(id)))
      setErrore(esiti.some(({ status }) => status === 'rejected'))
    } finally {
      inCorso.current = false
      setSalvataggio(false)
    }
  }

  return (
    <Modal
      title="Promemoria compleanni"
      open={compleanni.length > 0 && rimandato !== giorno}
      okText="Conferma di aver visto"
      cancelText="Ricordamelo al prossimo accesso"
      onOk={conferma}
      onCancel={() => {
        if (inCorso.current) return
        setErrore(false)
        setRimandato(giorno)
      }}
      confirmLoading={salvataggio}
      cancelButtonProps={{ disabled: salvataggio }}
      closable={false}
      maskClosable={false}
      styles={{ body: { maxHeight: '50dvh', overflowY: 'auto' } }}
    >
      <ul>{compleanni.map(({ id, nome, data }) => (
        <li key={id}>{nome} · {data === giorno ? 'Oggi' : formatData(data)}</li>
      ))}</ul>
      <p>La conferma chiude questo avviso per tutta la dirigenza.</p>
      {errore && <Alert type="error" showIcon message="Alcune conferme non sono state salvate. Riprova." />}
    </Modal>
  )
}
