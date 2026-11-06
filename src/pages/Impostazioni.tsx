import { useState } from 'react'
import {
  Button,
  Card,
  Checkbox,
  Input,
  List,
  Popconfirm,
  Space,
  Tag,
  Typography,
  App,
  Tabs,
} from 'antd'
import { PlusOutlined, DeleteOutlined, CalendarOutlined, CheckOutlined } from '@ant-design/icons'
import { useManagement } from '../management/useManagement'
import { ConfigClassifica } from './classifica/ConfigClassifica'
import { config } from '../config'
import { useSeason } from '../season/SeasonContext'
import { useCollection } from '../hooks/useCollection'
import * as store from '../services/driveStore'
import { PulsanteInstallaApp } from '../components/PulsanteInstallaApp'
import { PageHeader } from '../components/PageHeader'
import { TorneiManager } from './impostazioni/TorneiManager'
import type { Giocatore, Divisa, Torneo } from '../types'
import { plurale } from '../lib/format'

const { Text } = Typography

function prossimaStagione(stagione: string): string {
  const m = stagione.match(/^(\d{4})\/(\d{2})$/)
  if (!m) return ''
  const anno = Number(m[1]) + 1
  const anno2 = String((anno + 1) % 100).padStart(2, '0')
  return `${anno}/${anno2}`
}

function StagioniManager() {
  const { message } = App.useApp()
  const { sbloccato: admin } = useManagement()
  const { stagioni, attiva, cambia, crea, elimina } = useSeason()
  const rosa = useCollection<Giocatore>('giocatori')
  const tornei = useCollection<Torneo>('tornei')
  const divise = useCollection<Divisa>('divise')

  const [nuova, setNuova] = useState(() => prossimaStagione(attiva))
  const [copiaRosa, setCopiaRosa] = useState(true)
  const [creando, setCreando] = useState(false)

  async function creaStagione() {
    const nome = nuova.trim()
    if (!admin || !nome || creando) return
    if (!/^\d{4}\/\d{2}$/.test(nome) || Number(nome.slice(5)) !== (Number(nome.slice(0, 4)) + 1) % 100) {
      message.error('Usa una stagione nel formato 2027/28, con anni consecutivi.')
      return
    }
    if (stagioni.includes(nome)) {
      message.error('Questa stagione esiste già.')
      return
    }
    setCreando(true)
    try {
      if (copiaRosa && rosa.items.length > 0) {
        // le statistiche derivano dalle partite: la nuova stagione riparte da 0 da sola.
        // Non si portano avanti: la tessera (si rinnova ogni anno), la quota e i
        // suoi VERSAMENTI (sono soldi della stagione vecchia, già nei Conti di
        // allora) e gli infortuni, che a stagione nuova sono acqua passata.
        // L'esenzione dalla quota (quotaEsente) invece resta: di solito vale anche l'anno dopo.
        await Promise.all(
          rosa.items.map((g) => {
            const {
              tessera: _t,
              dataRilascio: _d,
              versamentiQuota: _v,
              infortunato: _i,
              rientroInfortunio: _r,
              ...resto
            } = g
            return store.put('giocatori', nome, { ...resto, quotaPagata: false })
          }),
        )
      }
      // tornei e tute da gara sono impostazioni della società: le portiamo
      // avanti nella nuova stagione (restano modificabili lì dentro).
      await Promise.all([
        ...tornei.items.map((t) => store.put('tornei', nome, t)),
        ...divise.items.map((d) => store.put('divise', nome, d)),
      ])
      crea(nome)
      setNuova('')
      message.success(`Stagione ${nome} creata`)
    } catch (err) {
      message.error('Errore nel creare la stagione: ' + String((err as Error)?.message || err))
    } finally {
      setCreando(false)
    }
  }

  return (
    <>


      <Card title="Stagioni" style={{ marginBottom: 16 }}>
        <List
          dataSource={stagioni}
          renderItem={(s) => {
            const isAttiva = s === attiva
            return (
              <List.Item
                actions={[
                  isAttiva ? (
                    <Tag key="a" color="red" icon={<CheckOutlined />}>
                      Attiva
                    </Tag>
                  ) : (
                    <Button key="a" size="small" onClick={() => cambia(s)}>
                      Rendi attiva
                    </Button>
                  ),
                  <Popconfirm
                    key="d"
                    title={`Togliere la stagione ${s} dall'elenco?`}
                    // lo script riceve solo il nuovo elenco: non è garantito che cancelli la cartella
                    description={
                      <div style={{ maxWidth: 300 }}>
                        La stagione sparisce dall'elenco e dalle copie su questo dispositivo. La sua
                        cartella sul Drive non viene cancellata dall'app: se non serve più, eliminala a
                        mano dal Drive.
                      </div>
                    }
                    okText="Togli"
                    cancelText="Annulla"
                    okButtonProps={{ danger: true }}
                    disabled={stagioni.length <= 1}
                    onConfirm={() => elimina(s)}
                  >
                    <Button
                      type="text"
                      danger
                      icon={<DeleteOutlined />}
                      aria-label={`Togli stagione ${s}`}
                      disabled={stagioni.length <= 1}
                    />
                  </Popconfirm>,
                ]}
              >
                <List.Item.Meta avatar={<CalendarOutlined />} title={`Stagione ${s}`} />
              </List.Item>
            )
          }}
        />
      </Card>

      <Card title="Nuova stagione" style={{ marginBottom: 16 }}>
        <Space direction="vertical" size="middle" style={{ width: '100%' }}>
          <Text type="secondary">
            La nuova stagione parte con le sue cartelle vuote: allenamenti, partite, distinte,
            magazzino e documenti ricominciano da zero. Conti e spese condivise restano come sono:
            non sono divisi per stagione. Tornei e tute da gara vengono portati avanti.
          </Text>
          <Input
            style={{ maxWidth: 260 }}
            value={nuova}
            aria-label="Nuova stagione"
            placeholder="es. 2027/28"
            onChange={(e) => setNuova(e.target.value)}
            onPressEnter={creaStagione}
          />
          <Checkbox checked={copiaRosa} onChange={(e) => setCopiaRosa(e.target.checked)}>
            Copia la rosa dalla stagione attiva ({plurale(rosa.items.length, 'tesserato', 'tesserati')}) — statistiche,
            tessera, quota (e versamenti) e infortuni ripartono da zero; chi è esente dalla quota resta esente
          </Checkbox>
          <Button type="primary" icon={<PlusOutlined />} loading={creando} onClick={creaStagione}>
            Crea stagione
          </Button>
        </Space>
      </Card>


      <Card title="Dati e Drive">
        <Text type="secondary">
          Ogni stagione tiene i suoi dati separati: sul Drive è una cartella dedicata (es. «
          {config.clubName} / {attiva}») con un file per ogni sezione. L'elenco stagioni è nel foglio
          «Stagioni»: puoi cambiare la stagione mostrata anche a mano, mettendo una «x» nella colonna
          Attiva. La password d'accesso è la chiave del Drive, inserita al login.
        </Text>
      </Card>
    </>
  )
}

export function Impostazioni() {
  const { sbloccato: admin } = useManagement()
  return <>
    <PageHeader titolo="Impostazioni" sottotitolo="Preferenze della società" />
    <Tabs items={[
      {
        key: 'generali',
        label: 'Generali',
        children: <>
          <PulsanteInstallaApp style={{ marginBottom: 16 }} />
          <TorneiManager />
        </>,
      },
      {
        key: 'info',
        label: 'Info',
        children: (
          <Card title="Versione dell’app">
            <Text code>{import.meta.env.VITE_APP_VERSION || 'Sviluppo locale'}</Text>
          </Card>
        ),
      },
      ...(admin ? [
        { key: 'stagioni', label: 'Stagioni', children: <StagioniManager /> },
        { key: 'classifica', label: 'Classifica', children: <ConfigClassifica /> },
      ] : []),
    ]} />
  </>
}
