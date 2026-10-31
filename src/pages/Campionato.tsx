import { useCallback, useEffect, useState } from 'react'
import { Alert, App, Button, Card, Collapse, Empty, Form, Input, InputNumber, Modal, Popconfirm, Space, Table, Tabs, Tag } from 'antd'
import { ReloadOutlined } from '@ant-design/icons'
import { PageHeader } from '../components/PageHeader'
import { useManagement } from '../management/useManagement'
import { callDrive, driveAttivo, getSecret } from '../services/driveStore'
import { ESEMPIO_CAMPIONATO, validaCampionato, type DatiCampionato } from '../lib/campionato'
import { useSeason } from '../season/SeasonContext'
import { loadValue, saveValue } from '../services/storage'
export function Campionato() {
  const { sbloccato:admin, request } = useManagement(), { message } = App.useApp(), {attiva} = useSeason()
  const [data,setData] = useState<DatiCampionato>(), [error,setError] = useState(''), [busy,setBusy] = useState(false), [json,setJson] = useState(''), [form] = Form.useForm()
  const [editorOpen, setEditorOpen] = useState(false), [editorForm] = Form.useForm()
  const key = `__campionato/${attiva}`
  const carica = useCallback(async () => {
    setBusy(true); setError('');setData(undefined)
    try {
      const res = driveAttivo() ? await callDrive({action:'campionato',season:attiva,secret:getSecret()}) : {ok:true,dati:JSON.parse(loadValue(key) || 'null')}
      if(!res.ok) throw new Error(res.error === 'azione sconosciuta' ? 'Aggiorna Google Apps Script per attivare il campionato.' : res.error)
      setData(res.dati ? validaCampionato(res.dati) : undefined)
    } catch(e) {setError((e as Error).message)} finally {setBusy(false)}
  },[attiva,key])
  useEffect(() => {void carica()},[carica])
  async function pubblica(raw: unknown) {
    setBusy(true)
    try {
      const dati = {...validaCampionato(raw), aggiornatoIl:new Date().toISOString()}
      if(driveAttivo()) await request('managementCampionatoImporta',{season:attiva,dati})
      else saveValue(key,JSON.stringify(dati))
      setData(dati);setEditorOpen(false);message.success('Campionato aggiornato per tutti')
    } catch(e) {message.error((e as Error).message)} finally {setBusy(false)}
  }
  async function importa() {
    setBusy(true)
    try {
      const dati = {...validaCampionato(JSON.parse(json)),aggiornatoIl:new Date().toISOString()}
      if(driveAttivo()) await request('managementCampionatoImporta',{season:attiva,dati})
      else saveValue(key,JSON.stringify(dati))
      setData(dati);message.success('Classifica e partite aggiornate per tutti')
    } catch(e) {message.error((e as Error).message)} finally {setBusy(false)}
  }
  async function configura(v: {url:string;apiKey?:string;header?:string}) {
    setBusy(true)
    try { await request('managementCampionatoConfigura',{season:attiva,...v});form.resetFields(['apiKey']);message.success('Configurazione salvata. Aggiorna il campionato per verificare la fonte.'); } catch(e) {message.error((e as Error).message)} finally {setBusy(false)}
  }
  async function aggiornaFonte() {
    setBusy(true)
    try { await request('managementCampionatoAggiorna',{season:attiva});await carica();message.success('Dati aggiornati dalla fonte') } catch(e) {message.error((e as Error).message)} finally {setBusy(false)}
  }
  return <>
    <PageHeader titolo="Campionato" sottotitolo="Classifica del girone, risultati e prossime partite." azioni={<Button loading={busy} icon={<ReloadOutlined />} onClick={carica}>Ricarica</Button>} />
    {error && <Alert type="error" showIcon message={error} style={{marginBottom:16}} />}
    {data ? <Card title={data.titolo}>
      <Space wrap style={{marginBottom:16}}>{data.fonte && <Tag>Fonte: {data.fonte}</Tag>}{data.aggiornatoIl && <Tag>Aggiornato: {new Date(data.aggiornatoIl).toLocaleString('it-IT')}</Tag>}</Space>
      {data.note && <p style={{whiteSpace:'pre-wrap'}}>{data.note}</p>}
      <Tabs items={[
        {key:'classifica',label:'Classifica',children:<Table rowKey="squadra" pagination={false} scroll={{x:780}} dataSource={data.classifica} columns={[
          {title:'#',width:55,render:(_,__,i) => i+1},{title:'Squadra',dataIndex:'squadra',width:230},
          ...[{title:'PT',key:'punti'},{title:'G',key:'giocate'},{title:'V',key:'vinte'},{title:'N',key:'pareggiate'},{title:'P',key:'perse'},{title:'GF',key:'golFatti'},{title:'GS',key:'golSubiti'}].map(c=>({title:c.title,dataIndex:c.key,key:c.key,width:65,render:(v:unknown)=>v ?? '—'})),
        ]} />},
        {key:'partite',label:'Risultati e calendario',children:<Table rowKey={(_,i)=>String(i)} dataSource={data.partite} scroll={{x:700}} columns={[{title:'Giornata',dataIndex:'giornata'},{title:'Data',dataIndex:'data'},{title:'Casa',dataIndex:'casa'},{title:'Ospite',dataIndex:'ospite'},{title:'Risultato',dataIndex:'risultato'},{title:'Stato',dataIndex:'stato'}]} />},
      ]} />
    </Card> : !busy && <Empty description="Il campionato non è ancora stato configurato dall’amministratore." />}
    {admin && <Button style={{marginTop:20}} onClick={() => {editorForm.setFieldsValue(data || {titolo:'Campionato',fonte:'Aggiornamento manuale',classifica:[],partite:[]});setEditorOpen(true)}}>Modifica classifica e calendario</Button>}
    {admin && <Modal title="Gestisci campionato" width={1000} open={editorOpen} onCancel={() => !busy && setEditorOpen(false)} onOk={() => editorForm.submit()} okText="Pubblica" cancelText="Annulla" confirmLoading={busy} destroyOnHidden>
      <Form form={editorForm} layout="vertical" onFinish={pubblica}>
        <Form.Item name="titolo" label="Campionato / girone" rules={[{required:true}]}><Input /></Form.Item>
        <Form.Item name="fonte" label="Fonte dei dati"><Input /></Form.Item>
        <Form.Item name="note" label="Note, penalizzazioni e comunicazioni"><Input.TextArea /></Form.Item>
        <h3>Classifica · inserisci le squadre nell’ordine ufficiale</h3>
        <Form.List name="classifica">{(fields,{add,remove}) => <>
          {fields.map(f => <Card size="small" key={f.key} style={{marginBottom:8}}><Space wrap align="start">
            <Form.Item name={[f.name,'squadra']} label="Squadra" rules={[{required:true}]}><Input style={{width:220}} /></Form.Item>
            {[['punti','Punti'],['giocate','Giocate'],['vinte','Vinte'],['pareggiate','Pareggiate'],['perse','Perse'],['golFatti','GF'],['golSubiti','GS']].map(([key,label]) => <Form.Item key={key} name={[f.name,key]} label={label} rules={[{required:key === 'punti' || key === 'giocate'}]}><InputNumber min={key === 'punti' ? undefined : 0} precision={0} style={{width:80}} /></Form.Item>)}
            <Button danger onClick={() => remove(f.name)}>Rimuovi squadra</Button>
          </Space></Card>)}
          <Button onClick={() => add({squadra:'',punti:0,giocate:0})}>Aggiungi squadra</Button>
        </>}</Form.List>
        <h3>Risultati e calendario</h3>
        <Form.List name="partite">{(fields,{add,remove}) => <>
          {fields.map(f => <Card size="small" key={f.key} style={{marginBottom:8}}><Space wrap align="start">
            <Form.Item name={[f.name,'data']} label="Data" rules={[{required:true}]}><Input type="date" /></Form.Item>
            <Form.Item name={[f.name,'casa']} label="Casa" rules={[{required:true}]}><Input /></Form.Item>
            <Form.Item name={[f.name,'ospite']} label="Ospite" rules={[{required:true}]}><Input /></Form.Item>
            <Form.Item name={[f.name,'risultato']} label="Risultato"><Input placeholder="es. 2-1" style={{width:100}} /></Form.Item>
            <Form.Item name={[f.name,'stato']} label="Stato"><Input placeholder="es. Rinviata" /></Form.Item>
            <Form.Item name={[f.name,'giornata']} label="Giornata"><Input style={{width:100}} /></Form.Item>
            <Button danger onClick={() => remove(f.name)}>Rimuovi partita</Button>
          </Space></Card>)}
          <Button onClick={() => add({data:'',casa:'',ospite:''})}>Aggiungi partita</Button>
        </>}</Form.List>
      </Form>
    </Modal>}
    {admin && <Collapse style={{marginTop:20}} items={[{key:'admin',label:'Configurazione campionato · solo Admin',children:<>
      <Alert type="info" showIcon message="Le credenziali restano sul server. Tutti vedono la classifica pubblicata; soltanto chi accede al Management può configurare e aggiornare la fonte." style={{marginBottom:16}} />
      <p>La fonte deve restituire JSON nel formato indicato sotto. Le API dei diversi fornitori richiedono un adattatore a questo formato. In alternativa puoi importare i dati manualmente.</p>
      <Form layout="vertical" form={form} onFinish={configura} initialValues={{header:'Authorization'}}>
        <Form.Item name="url" label="URL HTTPS della fonte JSON" rules={[{required:true,type:'url',message:'Inserisci un URL valido'}]}><Input placeholder="https://…" autoComplete="off" /></Form.Item>
        <Form.Item name="header" label="Header della chiave API"><Input placeholder="Authorization oppure X-API-Key" /></Form.Item>
        <Form.Item name="apiKey" label="Chiave API (vuoto = conserva quella salvata)"><Input.Password autoComplete="new-password" placeholder="Es. Bearer …" /></Form.Item>
        <Space wrap><Button loading={busy} htmlType="submit">Salva configurazione</Button><Button loading={busy} onClick={aggiornaFonte}>Aggiorna dalla fonte</Button><Popconfirm title="Eliminare URL e chiave API salvati?" onConfirm={async()=>{try{await request('managementCampionatoConfigura',{season:attiva,clear:true});form.resetFields();message.success('Configurazione rimossa')}catch(e){message.error((e as Error).message)}}}><Button danger>Rimuovi API</Button></Popconfirm></Space>
      </Form>
      <h3>Importazione manuale / formato JSON della fonte</h3>
      <Button onClick={()=>setJson(ESEMPIO_CAMPIONATO)}>Carica modello da compilare</Button>
      <Input.TextArea aria-label="Dati campionato JSON" rows={12} value={json} onChange={e=>setJson(e.target.value)} style={{margin:'12px 0',fontFamily:'monospace'}} />
      <Button type="primary" loading={busy} onClick={importa}>Pubblica dati del campionato</Button>
    </>}]} />}
  </>
}
