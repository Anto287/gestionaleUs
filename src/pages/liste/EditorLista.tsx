import { useState } from 'react'
import { Alert, Button, Checkbox, Form, Input, Popconfirm, Select, Space, Typography } from 'antd'
import { ArrowDownOutlined, ArrowUpOutlined, DeleteOutlined, PlusOutlined } from '@ant-design/icons'
import { erroreSchema, nuovoCampo, tipiCampo } from './model'
import type { CampoLista, ListaPersonalizzata, RigaLista } from './model'

export function EditorLista({ lista, righe, onSave, onCancel }: {
  lista?: ListaPersonalizzata
  righe: RigaLista[]
  onSave: (lista: Omit<ListaPersonalizzata, 'id'>) => void
  onCancel: () => void
}) {
  const [nome, setNome] = useState(lista?.nome || '')
  const [descrizione, setDescrizione] = useState(lista?.descrizione || '')
  const [campi, setCampi] = useState<CampoLista[]>(() => lista?.campi.map((c) => ({ ...c, opzioni: [...c.opzioni] })) || [nuovoCampo()])
  const [errore, setErrore] = useState('')
  const cambia = (id: string, patch: Partial<CampoLista>) => setCampi((items) => items.map((c) => c.id === id ? { ...c, ...patch } : c))
  const rimuovi = (id: string) => setCampi((items) => items.filter((c) => c.id !== id))
  const haDati = (id: string) => righe.some((r) => r.valori[id] !== undefined && r.valori[id] !== null && r.valori[id] !== '')
  function sposta(index: number, delta: number) {
    setCampi((items) => { const next = [...items]; [next[index], next[index + delta]] = [next[index + delta], next[index]]; return next })
  }
  return <Form layout="vertical" onFinish={() => {
    const dati = { nome: nome.trim(), descrizione: descrizione.trim(), campi: campi.map((c) => ({ ...c, nome: c.nome.trim() })) }
    const error = erroreSchema(dati)
    if (error) { setErrore(error); return }
    onSave(dati)
  }}>
    <Form.Item label="Nome lista" required><Input aria-label="Nome lista" value={nome} maxLength={120} onChange={(e) => setNome(e.target.value)} autoFocus /></Form.Item>
    <Form.Item label="Descrizione"><Input.TextArea aria-label="Descrizione lista" value={descrizione} maxLength={2000} autoSize={{ minRows: 2, maxRows: 5 }} onChange={(e) => setDescrizione(e.target.value)} /></Form.Item>
    <Typography.Title level={4}>Campi della lista</Typography.Title>
    <Typography.Paragraph type="secondary">Scegli quali informazioni raccogliere. Puoi aggiungere, rinominare e riordinare i campi anche dopo aver inserito le voci. Il tipo dei campi già compilati resta fisso per conservare i dati.</Typography.Paragraph>
    <div className="liste-campi">
      {campi.map((c, index) => <section className="liste-campo" key={c.id} aria-label={`Campo ${index + 1}`}>
        <div className="liste-campo-inputs">
          <Form.Item label={`Nome campo ${index + 1}`} required><Input aria-label={`Nome campo ${index + 1}`} value={c.nome} maxLength={100} onChange={(e) => cambia(c.id, { nome: e.target.value })} /></Form.Item>
          <Form.Item label="Tipo"><Select aria-label={`Tipo campo ${index + 1}`} value={c.tipo} options={tipiCampo} disabled={haDati(c.id)} onChange={(tipo) => cambia(c.id, { tipo })} /></Form.Item>
        </div>
        {c.tipo === 'scelta' && <Form.Item label="Scelte disponibili" required extra="Scrivi una scelta e premi Invio. Le scelte già usate restano nei dati anche se le togli dall’elenco."><Select aria-label={`Scelte campo ${index + 1}`} mode="tags" value={c.opzioni} tokenSeparators={[';']} onChange={(values: string[]) => cambia(c.id, { opzioni: [...new Set(values.map((v) => v.trim()).filter(Boolean))] })} /></Form.Item>}
        <Space wrap>
          <Checkbox checked={c.obbligatorio} onChange={(e) => cambia(c.id, { obbligatorio: e.target.checked })}>Obbligatorio</Checkbox>
          <Button aria-label={`Sposta su campo ${index + 1}`} icon={<ArrowUpOutlined />} disabled={index === 0} onClick={() => sposta(index, -1)} />
          <Button aria-label={`Sposta giù campo ${index + 1}`} icon={<ArrowDownOutlined />} disabled={index === campi.length - 1} onClick={() => sposta(index, 1)} />
          {haDati(c.id) ? <Popconfirm title={`Rimuovere il campo «${c.nome}»?`} description="I valori di questo campo non saranno più visibili nelle voci." okText="Rimuovi campo" cancelText="Annulla" okButtonProps={{ danger: true }} onConfirm={() => rimuovi(c.id)}><Button danger icon={<DeleteOutlined />}>Rimuovi campo</Button></Popconfirm> : <Button danger icon={<DeleteOutlined />} onClick={() => rimuovi(c.id)}>Rimuovi campo</Button>}
        </Space>
      </section>)}
    </div>
    <Button icon={<PlusOutlined />} onClick={() => setCampi((items) => [...items, nuovoCampo()])}>Aggiungi campo</Button>
    {errore && <Alert style={{ marginTop: 16 }} type="error" showIcon message={errore} />}
    <Space wrap style={{ marginTop: 24, display: 'flex' }}><Button type="primary" htmlType="submit">Salva lista</Button><Button onClick={onCancel}>Annulla</Button></Space>
  </Form>
}
