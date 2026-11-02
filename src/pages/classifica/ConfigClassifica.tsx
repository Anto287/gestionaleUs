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
  const [legacyWidget, setLegacyWidget] = useState(false)
  const [error, setError] = useState('')
  useEffect(() => {
    let active = true
    request<{ config: Record<string, unknown> }>('managementStandingsConfig', { season: stagione }).then((r) => {
      if (active) { const widget = r.config.tipo === 'widget'; setLegacyWidget(widget); form.setFieldsValue(widget ? { tipo: 'api', url: '' } : r.config); setReady(true) }
    }).catch((e: Error) => { if (active) setError(e.message) })
    return () => { active = false }
  }, [request, stagione, form])
  return <>
    <p>Classifica della stagione {stagione}. Ogni nuova stagione richiede il proprio collegamento: lo storico resta separato.</p>
    {legacyWidget && <Alert type="warning" showIcon message="Sostituisci il precedente widget con una fonte API JSON" description="La classifica ora è una tabella interna. Inserisci l’endpoint dati del fornitore: l’URL di una pagina o di un widget non è un’API." style={{ marginBottom: 16 }} />}
    {error && <Alert type="error" message={error} />}
    {!ready ? (error ? <p>Riapri la scheda per riprovare dopo aver aggiornato lo script.</p> : <Skeleton active />) : <Form form={form} layout="vertical" onFinish={async (config) => {
      setBusy(true)
      try { await request('managementSaveStandings', { season: stagione, config }); form.setFieldValue('apiKey', ''); setLegacyWidget(false); message.success('Fonte classifica salvata') }
      catch (e) { message.error((e as Error).message) }
      finally { setBusy(false) }
    }}>
      <Form.Item name="tipo" label="Fonte"><Select options={[{ value: 'nessuna', label: 'Non configurata' }, { value: 'api', label: 'API JSON' }]} /></Form.Item>
      <Form.Item name="url" label="URL HTTPS dell’API" rules={[({ getFieldValue }) => ({ validator: (_, value: string) => {
        if (getFieldValue('tipo') !== 'api') return Promise.resolve()
        try { const url = new URL(value); if (url.protocol !== 'https:' || /\/WidgetV2\//i.test(url.pathname)) throw new Error(); return Promise.resolve() }
        catch { return Promise.reject(new Error('Inserisci un endpoint API HTTPS, non un widget')) }
      } })]} extra="Endpoint dati del fornitore, non una pagina web o un widget. Risposta: { righe: [{ squadra, punti, giocate, vinte, pareggiate, perse, golFatti, golSubiti }] }. Sono accettati anche array di righe."><Input aria-label="URL HTTPS dell’API" maxLength={2000} /></Form.Item>
      <Form.Item name="apiKey" label="Chiave API (facoltativa)" extra="Inviata come Authorization: Bearer dal server. Lascia vuoto per mantenere la chiave salvata; scrivi RIMUOVI per cancellarla. Non viene restituita al browser."><Input.Password autoComplete="new-password" maxLength={500} /></Form.Item>
      <Button type="primary" htmlType="submit" loading={busy}>Salva fonte per {stagione}</Button>
    </Form>}
  </>
}
