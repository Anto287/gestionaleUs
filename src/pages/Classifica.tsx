import { useEffect, useState } from 'react'
import { Alert, Button, Empty, Skeleton, Table } from 'antd'
import { useCollection } from '../hooks/useCollection'
import { logoSquadra } from '../lib/loghi'
import type { LogoSquadra } from '../types'
import { PageHeader } from '../components/PageHeader'
import { useSeason } from '../season/SeasonContext'
import { callDrive, getSecret } from '../services/driveStore'
type Riga = { squadra: string; punti: number; giocate?: number; vinte?: number; pareggiate?: number; perse?: number; golFatti?: number; golSubiti?: number }
type Risposta = { tipo: string; righe?: Riga[]; aggiornato?: string }
export function Classifica() {
  const { attiva } = useSeason()
  return <ClassificaStagione key={attiva} stagione={attiva} />
}
function ClassificaStagione({ stagione }: { stagione: string }) {
  const { items: loghi } = useCollection<LogoSquadra>('loghi')
  const [data, setData] = useState<Risposta>()
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(true)
  const [refresh, setRefresh] = useState(0)
  useEffect(() => {
    let active = true
    async function carica() {
      setBusy(true)
      try {
        const r = await callDrive({ action: 'standings', season: stagione, secret: getSecret() })
        if (!r.ok) throw new Error(r.error || 'Classifica non disponibile')
        if (active) { setData(r); setError('') }
      } catch (e) { if (active) { setData(undefined); setError((e as Error).message) } }
      finally { if (active) setBusy(false) }
    }
    void carica()
    const timer = window.setInterval(() => { if (document.visibilityState === 'visible') void carica() }, 300000)
    return () => { active = false; window.clearInterval(timer) }
  }, [stagione, refresh])
  return <>
    <PageHeader titolo="Classifica" sottotitolo={`Campionato · ${stagione}`} azioni={<Button loading={busy} onClick={() => setRefresh((n) => n + 1)}>Aggiorna</Button>} />
    {busy && !data ? <Skeleton active /> : error ? <Alert type="error" message="Impossibile caricare la classifica" description={error} /> : data?.tipo === 'widget' ? <Alert type="warning" showIcon message="La fonte di questa stagione usa ancora un widget" description="Per visualizzare la classifica interna con i loghi, configura una fonte API JSON in Management → Classifica. Un collegamento al widget non fornisce i dati della tabella." />
    : data?.tipo === 'api' ? <>
      <p>Ultima lettura: {new Date(data.aggiornato!).toLocaleString('it-IT', { timeZone: 'Europe/Rome' })} · Aggiornamento automatico ogni 5 minuti</p>
      <Table<Riga> rowKey="squadra" dataSource={data.righe} pagination={false} scroll={{ x: 650 }} columns={[
        { title: '#', render: (_, _r, i) => i + 1 }, { title: 'Squadra', dataIndex: 'squadra', render: (nome: string) => { const logo = logoSquadra(loghi, nome); return <span style={{ display: 'inline-flex', alignItems: 'center', gap: 10 }}>{logo && <img src={logo.dataUrl} alt={`Logo ${nome}`} style={{ width: 32, height: 32, objectFit: 'contain' }} />}{nome}</span> } },
        ...[['punti', 'Pt'], ['giocate', 'G'], ['vinte', 'V'], ['pareggiate', 'N'], ['perse', 'P'], ['golFatti', 'GF'], ['golSubiti', 'GS']].map(([dataIndex, title]) => ({ title, dataIndex, render: (v: number | undefined) => v ?? '—' })),
      ]} />
    </> : <Empty description="Fonte non configurata per questa stagione. Un amministratore può aggiungerla in Management → Classifica." />}
  </>
}
