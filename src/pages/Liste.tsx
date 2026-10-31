import { useState } from 'react'
import { App, AutoComplete, Button, Card, Checkbox, Empty, Form, Input, InputNumber, Modal, Popconfirm, Select, Space, Switch, Table, Tag, Typography } from 'antd'
import { ArrowDownOutlined, ArrowUpOutlined, DeleteOutlined, DownloadOutlined, PlusOutlined } from '@ant-design/icons'
import { PageHeader } from '../components/PageHeader'
import { useCollection } from '../hooks/useCollection'
import { useData } from '../data/DataProvider'
import { getDevice } from '../management/device'
import { loadValue, saveValue } from '../services/storage'
import { colonneModello, csvLista, TIPI_COLONNA, validaValori, type ColonnaLista, type Lista, type RigaLista } from '../lib/liste'
import type { Giocatore } from '../types'

export function Liste() {
  const liste = useCollection<Lista>('liste'), righe = useCollection<RigaLista>('righeListe'), rosa = useCollection<Giocatore>('giocatori')
  const { salvaConVersione } = useData(), { message } = App.useApp()
  const [selected, setSelected] = useState<string>(), [q, setQ] = useState(''), [archiviate, setArchiviate] = useState(false)
  const [schemaOpen, setSchemaOpen] = useState(false), [schema, setSchema] = useState<Lista>(), [rowOpen, setRowOpen] = useState(false), [row, setRow] = useState<RigaLista>()
  const [busy, setBusy] = useState(false), [autore, setAutore] = useState(() => loadValue('__liste_autore') || '')
  const [form] = Form.useForm(), [rowForm] = Form.useForm()
  const [draftListaId, setDraftListaId] = useState(''), [draftRigaId, setDraftRigaId] = useState('')
  const lista = liste.items.find(l => l.id === selected)
  const elenco = righe.items.filter(r => r.listaId === lista?.id)
  const visibili = elenco.filter(r => Object.values(r.valori).some(v => String(v).toLocaleLowerCase().includes(q.toLocaleLowerCase())))
  const persone = [...new Set([autore, ...rosa.items.map(g => `${g.nome} ${g.cognome}`), ...righe.items.map(r => r.aggiornatoDa)].filter(Boolean))].map(value => ({ value }))
  function apriSchema(l?: Lista) { setDraftListaId(l?.id || crypto.randomUUID()); setSchema(l); form.setFieldsValue(l || { nome: '', descrizione: '', colonne: colonneModello('libera') }); setSchemaOpen(true) }
  async function salvaSchema(v: Lista) {
    if (!v.colonne?.length || v.colonne.length > 30) { message.error('Usa da 1 a 30 colonne'); return }
    if (new Set(v.colonne.map(c => c.nome.trim().toLowerCase())).size !== v.colonne.length) { message.error('I nomi delle colonne devono essere diversi'); return }
    const colonne = v.colonne.map(c => ({ ...c, id: c.id || crypto.randomUUID(), nome: c.nome.trim(), opzioni: c.tipo === 'scelta' ? (c.opzioni || []).map(o => o.trim()).filter(Boolean) : undefined }))
    if (colonne.some(c => c.tipo === 'scelta' && !c.opzioni?.length)) { message.error('Inserisci le opzioni delle colonne a scelta'); return }
    setBusy(true)
    try {
      const next = await salvaConVersione<Lista>('liste', { ...schema, ...v, id: schema?.id || draftListaId, nome: v.nome.trim(), colonne, revisione: schema?.revisione || 0 })
      setSelected(next.id); setSchemaOpen(false)
    } catch(e) { message.error((e as Error).message) } finally { setBusy(false) }
  }
  function apriRiga(r?: RigaLista) { setDraftRigaId(r?.id || crypto.randomUUID()); setRow(r); rowForm.resetFields(); rowForm.setFieldsValue({ valori: r?.valori || {} }); setRowOpen(true) }
  async function salvaRiga(v: { valori: RigaLista['valori'] }) {
    if (!lista) return
    const err = validaValori(lista.colonne, v.valori || {})
    if (err) { message.error(err); return }
    setBusy(true)
    try {
      await salvaConVersione<RigaLista>('righeListe', { id: row?.id || draftRigaId, revisione: row?.revisione || 0, listaId: lista.id, valori: { ...row?.valori, ...v.valori }, aggiornatoIl: new Date().toISOString(), aggiornatoDa: autore.trim() || `Dispositivo ${getDevice().id.slice(0, 6)}` })
      setRowOpen(false)
    } catch(e) { message.error((e as Error).message + ' I dati inseriti restano aperti: copiali prima di riaprire la riga aggiornata.'); } finally { setBusy(false) }
  }
  async function archivia() {
    if (!lista) return
    setBusy(true)
    try { await salvaConVersione('liste', { ...lista, archiviata: !lista.archiviata }); setSelected(undefined) } catch(e) { message.error((e as Error).message) } finally { setBusy(false) }
  }
  function esporta() {
    if (!lista) return
    const url = URL.createObjectURL(new Blob([csvLista(lista, visibili)], { type: 'text/csv;charset=utf-8' })), a = document.createElement('a')
    a.href = url; a.download = `${lista.nome.replace(/[^\p{L}\p{N} -]/gu, '') || 'lista'}.csv`; a.click(); URL.revokeObjectURL(url)
  }
  const input = (c: ColonnaLista) => {
    if (c.tipo === 'numero' || c.tipo === 'euro') return <InputNumber style={{ width:'100%' }} precision={c.tipo === 'euro' ? 2 : undefined} addonAfter={c.tipo === 'euro' ? '€' : undefined} />
    if (c.tipo === 'siNo') return <Select allowClear options={[{ value: 'si', label: 'Sì' },{ value: 'no', label: 'No' }]} />
    if (c.tipo === 'scelta') return <Select allowClear options={c.opzioni?.map(value => ({ value, label:value }))} />
    if (c.tipo === 'persona') return <AutoComplete options={persone} filterOption={(v,o) => String(o?.value).toLowerCase().includes(v.toLowerCase())}><Input /></AutoComplete>
    if (c.tipo === 'data') return <Input type="date" />
    return <Input.TextArea autoSize={{ minRows:1, maxRows:5 }} />
  }
  return <>
    <PageHeader titolo="Liste" sottotitolo="Uscite, partecipanti, premi e incarichi. Ogni lista ha le sue colonne e si aggiorna fra i dispositivi." azioni={<Button type="primary" icon={<PlusOutlined />} onClick={() => apriSchema()}>Nuova lista</Button>} />
    <div className="liste-scelta">
      <Select aria-label="Scegli lista" placeholder="Scegli una lista" value={selected} onChange={id => { setSelected(id); setQ('') }} options={liste.items.filter(l => !!l.archiviata === archiviate).map(l => ({ value:l.id, label:l.nome }))} />
      <Checkbox checked={archiviate} onChange={e => { setArchiviate(e.target.checked); setSelected(undefined) }}>Archiviate</Checkbox>
    </div>
    {!lista ? <Empty description="Scegli una lista oppure creane una con il modello Mare, Tombola o Libera." /> : <Card>
      <h2>{lista.nome}</h2><p>{lista.descrizione}</p>
      <Space wrap style={{ marginBottom:16 }}>
        <Button type="primary" onClick={() => apriRiga()} disabled={lista.archiviata}>Aggiungi riga</Button>
        <Button onClick={() => apriSchema(lista)}>Personalizza colonne</Button>
        <Button icon={<DownloadOutlined />} onClick={esporta}>Esporta CSV</Button>
        <Button loading={busy} onClick={archivia}>{lista.archiviata ? 'Riattiva' : 'Archivia'}</Button>
      </Space>
      <Input.Search aria-label="Cerca nella lista" placeholder="Cerca in tutti i campi" value={q} onChange={e => setQ(e.target.value)} style={{ display:'block', maxWidth:400, marginBottom:16 }} />
      <Space wrap style={{ marginBottom:12 }}><Tag>{visibili.length} righe</Tag>{lista.colonne.filter(c => c.tipo === 'euro' || c.tipo === 'numero').map(c => <Tag key={c.id}>{c.nome}: {visibili.reduce((sum,r) => sum + (Number(r.valori[c.id]) || 0), 0).toLocaleString('it-IT', { maximumFractionDigits:2 })}{c.tipo === 'euro' ? ' €' : ''}</Tag>)}</Space>
      <Table<RigaLista> rowKey="id" dataSource={visibili} scroll={{ x:Math.max(600, lista.colonne.length * 170) }} pagination={{ pageSize:20, showSizeChanger:true }} columns={[
        ...lista.colonne.map(c => ({ title:c.nome, key:c.id, width:170, render:(_:unknown,r:RigaLista) => {
          const v = r.valori[c.id]
          return <span style={{ whiteSpace:'pre-wrap', overflowWrap:'anywhere' }}>{v === undefined || v === '' ? '—' : c.tipo === 'siNo' ? <Tag color={v ? 'success' : 'default'}>{v ? 'Sì' : 'No'}</Tag> : c.tipo === 'euro' ? `${Number(v).toLocaleString('it-IT', { minimumFractionDigits:2 })} €` : String(v)}</span>
        } })),
        { title:'Ultima modifica', key:'ultima', width:190, render:(_,r) => <Typography.Text type="secondary">{r.aggiornatoDa}<br />{new Date(r.aggiornatoIl).toLocaleString('it-IT')}</Typography.Text> },
        { title:'Azioni', key:'azioni', width:160, render:(_,r) => <Space><Button size="small" disabled={lista.archiviata} onClick={() => apriRiga(r)}>Modifica</Button><Popconfirm title="Eliminare questa riga?" onConfirm={() => righe.remove(r.id)} okText="Elimina" cancelText="Annulla"><Button size="small" disabled={lista.archiviata} danger icon={<DeleteOutlined />} aria-label="Elimina riga" /></Popconfirm></Space> },
      ]} />
    </Card>}
    <Modal className="liste-schema" width={800} title={schema ? 'Personalizza lista' : 'Nuova lista'} open={schemaOpen} onCancel={() => !busy && setSchemaOpen(false)} onOk={() => form.submit()} confirmLoading={busy} okText="Salva lista" cancelText="Annulla" destroyOnHidden>
      <Form form={form} layout="vertical" onFinish={salvaSchema}>
        {!schema && <Form.Item label="Parti da un modello"><Select defaultValue="libera" onChange={v => form.setFieldValue('colonne', colonneModello(v))} options={[{value:'libera',label:'Lista libera'},{value:'mare',label:'Mare / partecipanti'},{value:'tombola',label:'Tombola / premi commercianti'}]} /></Form.Item>}
        <Form.Item name="nome" label="Nome lista" rules={[{required:true,whitespace:true,message:'Scrivi un nome'}]}><Input maxLength={120} /></Form.Item>
        <Form.Item name="descrizione" label="Descrizione"><Input.TextArea /></Form.Item>
        <p>Puoi rinominare, riordinare e aggiungere colonne. Le colonne rimosse restano conservate nei dati, ma non saranno più visibili. Cambiare tipo può richiedere di correggere le righe esistenti.</p>
        <Form.List name="colonne">{(fields,{add,remove,move}) => <>
          {fields.map((field,i) => <Card size="small" key={field.key} style={{marginBottom:10}}>
            <Form.Item name={[field.name,'id']} hidden><Input /></Form.Item>
            <Space wrap align="start">
              <Form.Item name={[field.name,'nome']} label="Nome colonna" rules={[{required:true,whitespace:true,message:'Scrivi un nome'}]}><Input /></Form.Item>
              <Form.Item name={[field.name,'tipo']} label="Tipo" rules={[{required:true}]}><Select style={{width:190}} options={TIPI_COLONNA} /></Form.Item>
              <Form.Item name={[field.name,'obbligatoria']} label="Obbligatoria" valuePropName="checked"><Switch /></Form.Item>
            </Space>
            <Form.Item noStyle shouldUpdate>{() => form.getFieldValue(['colonne',field.name,'tipo']) === 'scelta' && <Form.Item name={[field.name,'opzioni']} label="Opzioni (scrivi e premi Invio)"><Select mode="tags" tokenSeparators={[',']} /></Form.Item>}</Form.Item>
            <Space><Button aria-label="Sposta colonna su" disabled={!i} icon={<ArrowUpOutlined />} onClick={() => move(i,i-1)} /><Button aria-label="Sposta colonna giù" disabled={i === fields.length-1} icon={<ArrowDownOutlined />} onClick={() => move(i,i+1)} /><Button danger onClick={() => remove(field.name)}>Rimuovi colonna</Button></Space>
          </Card>)}
          <Button icon={<PlusOutlined />} onClick={() => add({id:crypto.randomUUID(),nome:'',tipo:'testo'})}>Aggiungi colonna</Button>
        </>}</Form.List>
      </Form>
    </Modal>
    <Modal title={row ? 'Modifica riga' : 'Nuova riga'} open={rowOpen} onCancel={() => !busy && setRowOpen(false)} onOk={() => rowForm.submit()} confirmLoading={busy} okText="Salva riga" cancelText="Annulla" destroyOnHidden>
      <Form layout="vertical" form={rowForm} onFinish={salvaRiga}>
        <Form.Item label="Il tuo nome (per sapere chi aggiorna)"><Input value={autore} onChange={e => {setAutore(e.target.value);saveValue('__liste_autore',e.target.value)}} placeholder="es. Antonio" maxLength={80} /></Form.Item>
        {lista?.colonne.map(c => <Form.Item key={c.id} label={c.nome} name={['valori',c.id]} rules={[{required:c.obbligatoria,message:`Compila ${c.nome}`}]} {...(c.tipo === 'siNo' ? {getValueProps:(v:unknown) => ({value:v === true ? 'si' : v === false ? 'no' : undefined}),normalize:(v:string|undefined) => v === 'si' ? true : v === 'no' ? false : undefined} : {})}>{input(c)}</Form.Item>)}
      </Form>
    </Modal>
  </>
}
