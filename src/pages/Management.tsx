import { useEffect, useState } from 'react'
import { Navigate } from 'react-router-dom'
import { Alert, App, Button, Empty, Form, Input, Select, Skeleton, Space, Table, Tabs, Tag, Typography } from 'antd'
import { LockOutlined, ReloadOutlined } from '@ant-design/icons'
import { PageHeader } from '../components/PageHeader'
import { useManagement } from '../management/useManagement'
import { getDevice } from '../management/device'
import type { Activity, ActivityFilters, Device } from '../management/types'

const { Text, Paragraph } = Typography
const date = (value: string) => value ? new Date(value).toLocaleString('it-IT', { timeZone: 'Europe/Rome' }) : 'Mai'
const sectionNames: Record<string, string> = { giocatori: 'Rosa', allenamenti: 'Allenamenti', partite: 'Partite', appuntamenti: 'Calendario', promemoria: 'Promemoria', distinte: 'Distinte', calciPiazzati: 'Calci piazzati', magazzino: 'Bar', materiale: 'Materiale', manutenzione: 'Manutenzione', borsaMedica: 'Borsa medica', divise: 'Divise', tornei: 'Tornei', conti: 'Conti', speseCondivise: 'Spese condivise', avversari: 'Avversari', documenti: 'Documenti', archivio: 'Archivio', stagioni: 'Stagioni', grafica: 'Grafiche', accessi: 'Accessi', management: 'Management' }

export function Management() {
  const { sbloccato } = useManagement()
  return sbloccato ? <ManagementPronto /> : <Navigate to="/" replace />
}

function ManagementPronto() {
  const { request, chiudi } = useManagement()
  const { message } = App.useApp()
  const [devices, setDevices] = useState<Device[]>([])
  const [activities, setActivities] = useState<Activity[]>([])
  const [filters, setFilters] = useState<ActivityFilters>({})
  const [page, setPage] = useState(1)
  const [total, setTotal] = useState(0)
  const [busy, setBusy] = useState(true)
  const [ready, setReady] = useState(false)
  const [error, setError] = useState('')
  const [refresh, setRefresh] = useState(0)
  const [editing, setEditing] = useState('')
  const [name, setName] = useState('')
  const [saving, setSaving] = useState(false)
  const [updated, setUpdated] = useState('')
  const currentDevice = getDevice().id

  useEffect(() => {
    let active = true
    setBusy(true)
    setError('')
    void Promise.all([
      request<{ devices: Device[] }>('managementDevices'),
      request<{ activities: Activity[]; total: number }>('managementActivities', { filters: { ...filters, offset: (page - 1) * 25 } }),
    ]).then(([d, a]) => {
      if (!active) return
      setDevices(d.devices)
      setActivities(a.activities)
      setTotal(a.total)
      setUpdated(new Date().toISOString())
      setReady(true)
    }).catch((e: Error) => { if (active) setError(e.message) })
      .finally(() => { if (active) setBusy(false) })
    return () => { active = false }
  }, [request, filters, page, refresh])

  async function rename(id: string) {
    setSaving(true)
    try {
      const res = await request<{ device: Device }>('managementRenameDevice', { id, nome: name.trim() })
      setDevices((items) => items.map((d) => d.id === id ? res.device : d))
      setEditing('')
      setRefresh((n) => n + 1)
      message.success('Nome dispositivo aggiornato')
    } catch (e) { message.error((e as Error).message) }
    finally { setSaving(false) }
  }

  const deviceName = (id: string) => devices.find((d) => d.id === id)?.nome || (id === 'legacy' ? 'Dispositivo non identificato' : `Dispositivo ${id.slice(0, 8)}`)
  const activityTable = <>
    <Form layout="vertical" className="management-filters" onFinish={(values) => { setPage(1); setFilters(values) }}>
      <Form.Item name="ricerca" label="Cerca attività"><Input placeholder="Operazione o elemento" allowClear maxLength={100} /></Form.Item>
      <Form.Item name="deviceId" label="Dispositivo"><Select allowClear placeholder="Tutti" options={devices.map((d) => ({ value: d.id, label: deviceName(d.id) }))} /></Form.Item>
      <Form.Item name="dal" label="Dal"><Input type="date" /></Form.Item>
      <Form.Item name="al" label="Al"><Input type="date" /></Form.Item>
      <Form.Item name="sezione" label="Sezione"><Select allowClear placeholder="Tutte" options={Object.entries(sectionNames).map(([value, label]) => ({ value, label }))} /></Form.Item>
      <Form.Item name="stagione" label="Stagione"><Input placeholder="Es. 2026/27" maxLength={30} /></Form.Item>
      <Form.Item name="esito" label="Esito"><Select allowClear placeholder="Tutti" options={[{ value: 'riuscita', label: 'Riuscita' }, { value: 'fallita', label: 'Fallita' }, { value: 'in_corso', label: 'Da verificare' }]} /></Form.Item>
      <Form.Item label=" "><Button htmlType="submit" type="primary" loading={busy}>Applica filtri</Button></Form.Item>
    </Form>
    <Table<Activity> rowKey="id" dataSource={error ? [] : activities} loading={busy} scroll={{ x: 850 }}
      locale={{ emptyText: <Empty description="Nessuna attività per i filtri selezionati" image={Empty.PRESENTED_IMAGE_SIMPLE} /> }}
      pagination={{ current: page, pageSize: 25, total, showSizeChanger: false, onChange: setPage, showTotal: (n) => `${n} attività` }}
      columns={[
        { title: 'Quando', dataIndex: 'data', width: 170, render: date },
        { title: 'Dispositivo', dataIndex: 'deviceId', render: deviceName },
        { title: 'Operazione', dataIndex: 'azione' },
        { title: 'Sezione', dataIndex: 'sezione', render: (s: string) => sectionNames[s] || s },
        { title: 'Elemento', dataIndex: 'elemento', ellipsis: true },
        { title: 'Stagione', dataIndex: 'stagione', render: (s: string) => s && s !== 'globale' ? s.replace(/^(\d{4})-(\d{2})$/, '$1/$2') : 'Generale' },
        { title: 'Esito', dataIndex: 'esito', render: (s: string) => <Tag color={s === 'riuscita' ? 'success' : s === 'fallita' ? 'error' : 'warning'}>{s === 'riuscita' ? 'Riuscita' : s === 'fallita' ? 'Fallita' : 'Da verificare'}</Tag> },
      ]}
      expandable={{ expandedRowRender: (a) => <div className="management-detail">
        <Paragraph type="secondary">Richiesta: {a.id}{a.tentativi && a.tentativi > 1 ? ` · ${a.tentativi} tentativi` : ''}</Paragraph>
        {a.esito === 'in_corso' && <Alert type="warning" message="Operazione avviata: l’esito non è stato confermato. Verifica i dati prima di ripeterla." />}
        {a.errore && <Alert type="error" message={a.errore} />}
        {a.dettagli.length ? <Table rowKey="campo" size="small" pagination={false} dataSource={a.dettagli} columns={[
          { title: 'Campo', dataIndex: 'campo' }, { title: 'Prima', dataIndex: 'prima', render: (s: string) => <span className="management-value">{s || '—'}</span> }, { title: 'Dopo', dataIndex: 'dopo', render: (s: string) => <span className="management-value">{s || '—'}</span> },
        ]} /> : <Text type="secondary">Nessun dettaglio aggiuntivo.</Text>}
      </div> }} />
  </>

  return <>
    <PageHeader titolo="Management" sottotitolo="Dispositivi e registro delle attività" azioni={<Space wrap>
      <Button icon={<ReloadOutlined />} loading={busy} onClick={() => setRefresh((n) => n + 1)}>Aggiorna</Button>
      <Button icon={<LockOutlined />} onClick={chiudi}>Disconnetti Management</Button>
    </Space>} />
    <div className="management-overview">
      <Text strong>{devices.length} {devices.length === 1 ? 'dispositivo registrato' : 'dispositivi registrati'}</Text>
      <Text type="secondary">{updated ? `Aggiornato il ${date(updated)} · Orari di Roma` : 'Caricamento del registro'}</Text>
    </div>
    {error && <Alert type="error" showIcon message="Impossibile aggiornare il Management" description={error} action={<Button onClick={() => setRefresh((n) => n + 1)}>Riprova</Button>} style={{ marginBottom: 16 }} />}
    {!ready && busy ? <Skeleton active paragraph={{ rows: 8 }} /> : <Tabs items={[
      { key: 'attivita', label: 'Registro attività', children: activityTable },
      { key: 'dispositivi', label: 'Dispositivi', children: <>
        <Paragraph type="secondary">Ogni browser ha un identificativo proprio. Cancellando i dati del browser verrà registrato un nuovo dispositivo. L’ultimo contatto può aggiornarsi con alcuni minuti di ritardo.</Paragraph>
        <Table<Device> rowKey="id" dataSource={devices} loading={busy} scroll={{ x: 800 }} pagination={{ pageSize: 15, showSizeChanger: false }} locale={{ emptyText: 'I dispositivi compariranno al primo utilizzo dell’app aggiornata.' }} columns={[
          { title: 'Nome', key: 'nome', width: 280, render: (_, d) => editing === d.id ? <Space direction="vertical">
            <Input aria-label="Nome dispositivo" value={name} maxLength={80} onChange={(e) => setName(e.target.value)} onPressEnter={() => { if (!saving) void rename(d.id) }} disabled={saving} />
            <Space><Button size="small" type="primary" loading={saving} onClick={() => rename(d.id)}>Salva</Button><Button size="small" disabled={saving} onClick={() => setEditing('')}>Annulla</Button></Space>
          </Space> : <><Text strong>{deviceName(d.id)}</Text> {d.id === currentDevice && <Tag>Questo dispositivo</Tag>}<br /><Button type="link" size="small" onClick={() => { setEditing(d.id); setName(d.nome) }}>Rinomina</Button></> },
          { title: 'Browser / sistema', key: 'browser', render: (_, d) => `${d.browser} · ${d.sistema}` },
          { title: 'Primo contatto', dataIndex: 'primoAccesso', render: date },
          { title: 'Ultimo contatto', dataIndex: 'ultimoAccesso', render: date },
          { title: 'Identificativo', dataIndex: 'id', render: (s: string) => <Text copyable={{ text: s }}>{s.slice(0, 8)}…</Text> },
        ]} />
      </> },
    ]} />}
    <Paragraph type="secondary" className="management-note">Lo storico parte dall’attivazione dello script aggiornato. Registra le operazioni passate dall’app; le modifiche dirette ai fogli Google e le esportazioni locali non sono incluse. L’accesso al Management resta attivo su questo browser fino alla disconnessione.</Paragraph>
  </>
}
