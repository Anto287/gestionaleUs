import { useState } from 'react'
import { Link } from 'react-router-dom'
import { App, Button, Empty, Form, Input, Popconfirm, Select, Space, Table, Upload } from 'antd'
import { UploadOutlined } from '@ant-design/icons'
import { PageHeader } from '../components/PageHeader'
import { useCollection } from '../hooks/useCollection'
import { preparaLogo } from '../lib/immagine'
import { chiaveSquadra } from '../lib/loghi'
import type { Avversario, LogoSquadra } from '../types'
import { config } from '../config'

type Valori = { nome: string; alias?: string[] }
export function Loghi() {
  const loghi = useCollection<LogoSquadra>('loghi')
  const { items: avversari } = useCollection<Avversario>('avversari')
  const { message } = App.useApp()
  const [form] = Form.useForm<Valori>()
  const [editing, setEditing] = useState<string>()
  const [immagine, setImmagine] = useState<{ src: string; rapporto: number }>()
  const [busy, setBusy] = useState(false)
  const [q, setQ] = useState('')
  function reset() { form.resetFields(); setEditing(undefined); setImmagine(undefined) }
  function salva(v: Valori) {
    if (busy) return
    if (!immagine) { message.error('Carica il logo della squadra'); return }
    const nome = v.nome.trim(), alias = (v.alias || []).map((a) => a.trim()).filter(Boolean)
    const nomi = [nome, ...alias]
    if (nomi.some((n) => !chiaveSquadra(n) || n.length > 150) || alias.length > 20) { message.error('Usa nomi validi, massimo 150 caratteri e 20 alias'); return }
    const chiavi = new Set(nomi.map(chiaveSquadra))
    if (loghi.items.some((l) => l.id !== editing && [l.nome, ...l.alias].some((n) => chiavi.has(chiaveSquadra(n))))) { message.error('Una squadra o un alias è già associato a un altro logo'); return }
    const record = { nome, alias, dataUrl: immagine.src, rapporto: immagine.rapporto }
    if (editing) loghi.update(editing, record)
    else loghi.add(record)
    reset()
    message.success('Logo salvato, pronto per la sincronizzazione')
  }
  return <>
    <PageHeader titolo="Loghi squadre" sottotitolo="Archivio condiviso tra tutte le stagioni, per le grafiche e la classifica API." />
    <p>Usa il nome della squadra come nelle partite. Gli alias collegano nomi diversi usati dal fornitore della classifica. <Link to="/social">Apri le grafiche</Link></p>
    <Form form={form} layout="vertical" onFinish={salva} style={{ maxWidth: 640 }}>
      <Form.Item name="nome" label="Squadra" rules={[{ required: true, whitespace: true, message: 'Indica la squadra' }]}>
        <Input aria-label="Squadra del logo" list="squadre-logo" maxLength={150} />
      </Form.Item>
      <datalist id="squadre-logo">{[config.clubName, ...avversari.map((a) => a.nome)].map((nome) => <option key={nome} value={nome} />)}</datalist>
      <Form.Item name="alias" label="Altri nomi della squadra" extra="Scrivi un nome e premi Invio, ad esempio quello esatto della classifica online."><Select aria-label="Alias squadra" mode="tags" open={false} /></Form.Item>
      <Space wrap style={{ marginBottom: 16 }}>
        <Upload accept="image/png,image/jpeg,image/webp" showUploadList={false} beforeUpload={async (file) => {
          setBusy(true)
          try {
            if (!['image/png', 'image/jpeg', 'image/webp'].includes(file.type) || file.size > 10 * 1024 * 1024) throw new Error('Scegli PNG, JPEG o WebP, massimo 10 MB')
            let lato = 512, logo = await preparaLogo(file, lato)
            while (logo.src.length > 36000 && lato > 32) { lato = Math.floor(lato * 0.75); logo = await preparaLogo(file, lato) }
            if (logo.src.length > 36000) throw new Error('Logo troppo complesso: prova una versione più piccola')
            setImmagine(logo)
          } catch (e) { message.error((e as Error).message) }
          finally { setBusy(false) }
          return false
        }}><Button icon={<UploadOutlined />} loading={busy}>Carica immagine logo</Button></Upload>
        {immagine && <img src={immagine.src} alt="Anteprima logo" style={{ width: 64, height: 64, objectFit: 'contain' }} />}
      </Space>
      <Form.Item><Space><Button type="primary" htmlType="submit" disabled={busy}>{editing ? 'Salva modifiche logo' : 'Salva logo'}</Button><Button onClick={reset} disabled={busy}>Annulla</Button></Space></Form.Item>
    </Form>
    <Input aria-label="Cerca logo squadra" placeholder="Cerca squadra o alias" value={q} onChange={(e) => setQ(e.target.value)} allowClear style={{ maxWidth: 360, marginBottom: 16 }} />
    <Table<LogoSquadra> rowKey="id" scroll={{ x: 550 }} dataSource={loghi.items.filter((l) => !q || [l.nome, ...l.alias].some((n) => chiaveSquadra(n).includes(chiaveSquadra(q))))} locale={{ emptyText: <Empty description="Carica il primo logo per riutilizzarlo nelle grafiche e nella classifica API." /> }} columns={[
      { title: 'Logo', render: (_, l) => <img src={l.dataUrl} alt={`Logo ${l.nome}`} style={{ width: 48, height: 48, objectFit: 'contain' }} /> },
      { title: 'Squadra', dataIndex: 'nome' }, { title: 'Alias', render: (_, l) => l.alias.join(', ') || '—' },
      { title: 'Azioni', render: (_, l) => <Space wrap><Button disabled={busy} onClick={() => { setEditing(l.id); form.setFieldsValue({ nome: l.nome, alias: l.alias }); setImmagine({ src: l.dataUrl, rapporto: l.rapporto }); window.scrollTo({ top: 0, behavior: 'smooth' }) }}>Modifica</Button><Popconfirm title={`Eliminare il logo di ${l.nome}?`} onConfirm={() => { loghi.remove(l.id); if (editing === l.id) reset() }} okText="Elimina" cancelText="Annulla"><Button danger>Elimina</Button></Popconfirm></Space> },
    ]} />
  </>
}
