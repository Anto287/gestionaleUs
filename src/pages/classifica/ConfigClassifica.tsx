import { useEffect, useState } from 'react'
import { Alert, App, Button, Form, Input, Select, Skeleton } from 'antd'
import { useManagement } from '../../management/useManagement'
import { useSeason } from '../../season/SeasonContext'

export function ConfigClassifica() {
  const { attiva } = useSeason()
  return <Configurazione key={attiva} stagione={attiva} />
}
function Configurazione({ stagione }: { stagione: string }) {
  const { request } = useManagement()
  const { message } = App.useApp()
  const [form] = Form.useForm()
  const tipo = Form.useWatch('tipo', form)
  const [ready, setReady] = useState(false)
  const [busy, setBusy] = useState(false)
  const [legacyWidget, setLegacyWidget] = useState(false)
  const [error, setError] = useState('')
  useEffect(() => {
    let active = true
    request<{ config: Record<string, unknown> }>('managementStandingsConfig', { season: stagione }).then((r) => {
      if (active) { const widget = r.config.tipo === 'widget'; setLegacyWidget(widget); form.setFieldsValue(widget ? { tipo: 'uisp', categoria: '3', girone: 'B' } : { categoria: '3', girone: 'B', ...r.config }); setReady(true) }
    }).catch((e: Error) => { if (active) setError(e.message) })
    return () => { active = false }
  }, [request, stagione, form])
  return <>
    <p>Classifica della stagione {stagione}. Ogni nuova stagione richiede il proprio collegamento: lo storico resta separato.</p>
    {legacyWidget && <Alert type="warning" showIcon message="Sostituisci il precedente widget con una fonte dati" description="Scegli UISP Modena per i comunicati settimanali gratuiti oppure configura un’API autorizzata." style={{ marginBottom: 16 }} />}
    {error && <Alert type="error" message={error} />}
    {!ready ? (error ? <p>Riapri la scheda per riprovare dopo aver aggiornato lo script.</p> : <Skeleton active />) : <Form form={form} layout="vertical" onFinish={async (config) => {
      setBusy(true)
      try { await request('managementSaveStandings', { season: stagione, config }); form.setFieldValue('apiKey', ''); setLegacyWidget(false); message.success('Fonte classifica salvata') }
      catch (e) { message.error((e as Error).message) }
      finally { setBusy(false) }
    }}>
      <Form.Item name="tipo" label="Fonte"><Select aria-label="Fonte classifica" options={[{ value: 'nessuna', label: 'Non configurata' }, { value: 'uisp', label: 'UISP Modena · gratuita, settimanale' }, { value: 'api', label: 'API JSON · configurazione avanzata' }]} /></Form.Item>
      {tipo === 'uisp' && <>
        <Alert type="info" showIcon message="Classifica e risultati dai comunicati ufficiali UISP Modena" description="Nessun account o chiave API. L’app cerca l’ultimo comunicato della stagione: i dati sono settimanali, non in tempo reale. Per il girone del link Riolunato seleziona Categoria 3, Girone B." style={{ marginBottom: 16 }} />
        <Form.Item name="categoria" label="Categoria" rules={[{ required: true }]}><Select aria-label="Categoria UISP" options={['1', '2', '3'].map((value) => ({ value, label: `Categoria ${value}` }))} /></Form.Item>
        <Form.Item name="girone" label="Girone" rules={[{ required: true }]}><Select aria-label="Girone UISP" options={'ABCDEFGHIJKL'.split('').map((value) => ({ value, label: `Girone ${value}` }))} /></Form.Item>
      </>}
      {tipo === 'api' && <>
      <Form.Item name="url" label="URL HTTPS dell’API" rules={[{ required: true, message: 'Inserisci l’URL dell’API' }, { validator: (_, value: string) => {
        try { const url = new URL(value); if (url.protocol !== 'https:' || /\/WidgetV2\//i.test(url.pathname)) throw new Error(); return Promise.resolve() }
        catch { return Promise.reject(new Error('Inserisci un endpoint API HTTPS, non un widget')) }
      } }]} extra="Endpoint dati del fornitore. Risposta: { righe: [{ squadra, punti, giocate, vinte, pareggiate, perse, golFatti, golSubiti }] }."><Input aria-label="URL HTTPS dell’API" maxLength={2000} /></Form.Item>
      <Form.Item name="apiKey" label="Chiave API (facoltativa)" extra="Conservata sul server. Lascia vuoto per mantenere la chiave salvata; scrivi RIMUOVI per cancellarla."><Input.Password autoComplete="new-password" maxLength={500} /></Form.Item>
      </>}
      <Button type="primary" htmlType="submit" loading={busy}>Salva fonte per {stagione}</Button>
    </Form>}
  </>
}
