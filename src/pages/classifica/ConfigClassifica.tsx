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
  const [ready, setReady] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  useEffect(() => {
    let active = true
    request<{ config: Record<string, unknown> }>('managementStandingsConfig', { season: stagione }).then((r) => {
      if (active) { form.setFieldsValue(r.config); setReady(true) }
    }).catch((e: Error) => { if (active) setError(e.message) })
    return () => { active = false }
  }, [request, stagione, form])
  return <>
    <p>Classifica della stagione {stagione}. Ogni nuova stagione richiede il proprio collegamento: lo storico resta separato.</p>
    {error && <Alert type="error" message={error} />}
    {!ready ? (error ? <p>Riapri la scheda per riprovare dopo aver aggiornato lo script.</p> : <Skeleton active />) : <Form form={form} layout="vertical" onFinish={async (config) => {
      setBusy(true)
      try { await request('managementSaveStandings', { season: stagione, config }); form.setFieldValue('apiKey', ''); message.success('Fonte classifica salvata') }
      catch (e) { message.error((e as Error).message) }
      finally { setBusy(false) }
    }}>
      <Form.Item name="tipo" label="Fonte"><Select options={[{ value: 'nessuna', label: 'Non configurata' }, { value: 'widget', label: 'Widget ufficiale Tuttocampo' }, { value: 'api', label: 'API JSON' }]} /></Form.Item>
      <Form.Item name="url" label="URL HTTPS del widget o dell’API" extra="Per Tuttocampo inserisci l’URL WidgetV2/Classifica fornito dal servizio. Per API: risposta { righe: [{ squadra, punti, giocate, vinte, pareggiate, perse, golFatti, golSubiti }] }. Sono accettati anche array di righe."><Input maxLength={2000} /></Form.Item>
      <Form.Item name="apiKey" label="Chiave API (facoltativa)" extra="Inviata come Authorization: Bearer dal server. Lascia vuoto per mantenere la chiave salvata; scrivi RIMUOVI per cancellarla. Non viene restituita al browser."><Input.Password autoComplete="new-password" maxLength={500} /></Form.Item>
      <Button type="primary" htmlType="submit" loading={busy}>Salva fonte per {stagione}</Button>
    </Form>}
  </>
}
