import { useState } from 'react'
import { App, Button, Card, Empty, Form, Input, Modal, Popconfirm, Space, Upload } from 'antd'
import { DeleteOutlined, PlusOutlined } from '@ant-design/icons'
import { PageHeader } from '../components/PageHeader'
import { useCollection } from '../hooks/useCollection'
import { preparaLogo } from '../lib/immagine'
import { caricaLogo, type LogoSquadra } from '../lib/loghi'
import { normalizzaNome } from '../lib/avversari'
import { LogoMiniatura } from '../components/LogoMiniatura'
export function Loghi() {
  const loghi = useCollection<LogoSquadra>('loghi')
  const { message } = App.useApp()
  const [aperto, setAperto] = useState(false), [busy, setBusy] = useState(false), [q, setQ] = useState('')
  const [editing, setEditing] = useState<LogoSquadra>(), [pronto, setPronto] = useState<{ src: string; rapporto: number }>()
  const [form] = Form.useForm()
  async function salva({ nome }: { nome: string }) {
    if (!pronto && !editing) { message.error('Carica un logo'); return }
    if (loghi.items.some(l => l.id !== editing?.id && normalizzaNome(l.nome) === normalizzaNome(nome))) { message.error('Questa squadra ha già un logo: modificalo dalla sua scheda.'); return }
    setBusy(true)
    try {
      const image = pronto ? { ...await caricaLogo(pronto.src), rapporto: pronto.rapporto } : {}
      if (editing) loghi.update(editing.id, { nome: nome.trim(), ...image })
      else loghi.add({ nome: nome.trim(), rapporto: pronto!.rapporto, ...image })
      setAperto(false)
    } catch (e) { message.error((e as Error).message) } finally { setBusy(false) }
  }
  function apri(l?: LogoSquadra) { setEditing(l); setPronto(undefined); form.setFieldsValue({ nome: l?.nome || '' }); setAperto(true) }
  return <>
    <PageHeader titolo="Loghi squadre" sottotitolo="Caricali una volta e ritrovali nelle grafiche. L’archivio è condiviso fra tutte le stagioni." azioni={<Button type="primary" icon={<PlusOutlined />} onClick={() => apri()}>Aggiungi logo</Button>} />
    <Input.Search aria-label="Cerca logo" placeholder="Cerca una squadra" value={q} onChange={e => setQ(e.target.value)} style={{ maxWidth: 400, marginBottom: 20 }} />
    {!loghi.items.length && <Empty description="Carica il primo stemma della squadra" />}
    <div className="loghi-grid">{loghi.items.filter(l => normalizzaNome(l.nome).includes(normalizzaNome(q))).sort((a,b) => a.nome.localeCompare(b.nome)).map(l => <Card key={l.id} size="small">
      <LogoMiniatura logo={l} /><h3>{l.nome}</h3><Space wrap><Button onClick={() => apri(l)}>Modifica</Button>
        <Popconfirm title="Rimuovere il logo dall’archivio?" onConfirm={() => loghi.remove(l.id)} okText="Rimuovi" cancelText="Annulla"><Button aria-label={`Elimina ${l.nome}`} danger icon={<DeleteOutlined />} /></Popconfirm>
      </Space></Card>)}</div>
    <Modal title={editing ? 'Modifica logo' : 'Aggiungi logo'} open={aperto} onCancel={() => !busy && setAperto(false)} onOk={() => form.submit()} confirmLoading={busy} okText="Salva" cancelText="Annulla" destroyOnHidden>
      <Form form={form} layout="vertical" onFinish={salva}><Form.Item name="nome" label="Squadra" rules={[{ required: true, whitespace: true, message: 'Scrivi il nome della squadra' }]}><Input maxLength={120} /></Form.Item>
        <Upload accept="image/png,image/jpeg,image/webp" showUploadList={false} beforeUpload={async f => { try { setPronto(await preparaLogo(f)) } catch { message.error('Immagine non valida') }; return false }}><Button disabled={busy}>Carica immagine</Button></Upload>
        {pronto ? <img src={pronto.src} alt="Anteprima logo" style={{ display:'block', maxWidth:180, height:150, objectFit:'contain', marginTop:16 }} /> : editing && <LogoMiniatura logo={editing} />}
      </Form>
    </Modal>
  </>
}
