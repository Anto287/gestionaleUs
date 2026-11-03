import { useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { Button, Descriptions, Empty, Grid, Input, List, Popconfirm, Result, Space, Table, Typography } from 'antd'
import { ArrowLeftOutlined, DeleteOutlined, EditOutlined, PlusOutlined } from '@ant-design/icons'
import { PageHeader } from '../components/PageHeader'
import { useCollection } from '../hooks/useCollection'
import { useSeason } from '../season/SeasonContext'
import { EditorLista } from './liste/EditorLista'
import { EditorVoce } from './liste/EditorVoce'
import { filtraRighe, valoreTesto } from './liste/model'
import type { ListaPersonalizzata, RigaLista } from './liste/model'
import '../styles/liste.css'

export function Liste() {
  const { id } = useParams()
  // Cambiare lista chiude editor e ricerca della lista precedente.
  return <ListePronte key={id || 'indice'} id={id} />
}
function ListePronte({ id }: { id?: string }) {
  const liste = useCollection<ListaPersonalizzata>('liste')
  const voci = useCollection<RigaLista>('righeLista')
  const { attiva } = useSeason()
  const navigate = useNavigate()
  const screens = Grid.useBreakpoint()
  const [editor, setEditor] = useState(false)
  const [voce, setVoce] = useState<RigaLista | 'nuova' | null>(null)
  const [ricerca, setRicerca] = useState('')
  const lista = liste.items.find((l) => l.id === id)
  const righe = voci.items.filter((r) => r.listaId === id)
  const risultati = lista ? filtraRighe(righe, lista.campi, ricerca) : []
  function eliminaLista(target: ListaPersonalizzata) {
    voci.items.filter((r) => r.listaId === target.id).forEach((r) => voci.remove(r.id))
    liste.remove(target.id)
    if (id === target.id) navigate('/liste')
  }
  const eliminaButton = (target: ListaPersonalizzata) => <Popconfirm title={`Eliminare «${target.nome}»?`} description="Verranno eliminate anche tutte le voci di questa lista." okText="Elimina lista" cancelText="Annulla" okButtonProps={{ danger: true }} onConfirm={() => eliminaLista(target)}><Button danger icon={<DeleteOutlined />} aria-label={`Elimina lista ${target.nome}`}>Elimina lista</Button></Popconfirm>
  const azioniVoce = (r: RigaLista) => <Space wrap>
    <Button icon={<EditOutlined />} onClick={() => setVoce(r)}>Modifica voce</Button>
    <Popconfirm title="Eliminare questa voce?" okText="Elimina voce" cancelText="Annulla" okButtonProps={{ danger: true }} onConfirm={() => voci.remove(r.id)}><Button danger icon={<DeleteOutlined />}>Elimina voce</Button></Popconfirm>
  </Space>
  if (id && !lista) return <Result status="404" title="Lista non disponibile" subTitle="La lista potrebbe essere stata eliminata o appartenere a un’altra stagione." extra={<Link to="/liste"><Button>Torna alle liste</Button></Link>} />
  if (editor) return <>
    <PageHeader titolo={lista ? 'Modifica lista' : 'Nuova lista'} sottotitolo={`Stagione ${attiva}`} />
    <EditorLista lista={lista} righe={righe} onCancel={() => setEditor(false)} onSave={(dati) => {
      if (lista) { liste.update(lista.id, dati); setEditor(false) }
      else { const nuovaId = liste.add(dati); navigate(`/liste/${nuovaId}`) }
    }} />
  </>
  if (!lista) {
    const filtrate = liste.items.filter((l) => `${l.nome} ${l.descrizione}`.toLocaleLowerCase('it').includes(ricerca.trim().toLocaleLowerCase('it')))
    return <>
      <PageHeader titolo="Liste" sottotitolo={`Liste personalizzate · Stagione ${attiva}`} azioni={<Button type="primary" icon={<PlusOutlined />} onClick={() => setEditor(true)}>Nuova lista</Button>} />
      <Input.Search aria-label="Cerca liste" placeholder="Cerca liste" allowClear value={ricerca} onChange={(e) => setRicerca(e.target.value)} style={{ maxWidth: 480, marginBottom: 16 }} />
      {!liste.items.length ? <Empty description={<><Typography.Paragraph>Crea una lista e scegli quali informazioni raccogliere.</Typography.Paragraph><Typography.Text type="secondary">Ogni lista ha i propri campi e le proprie voci, modificabili in qualsiasi momento.</Typography.Text></>} /> : <List dataSource={filtrate} locale={{ emptyText: 'Nessuna lista trovata' }} renderItem={(l) => <List.Item className="liste-indice-riga">
        <div className="liste-indice-testo"><Link to={`/liste/${l.id}`}><Typography.Text strong>{l.nome}</Typography.Text></Link>{l.descrizione && <Typography.Paragraph className="liste-descrizione" type="secondary">{l.descrizione}</Typography.Paragraph>}<Typography.Text type="secondary">{l.campi.length} campi · {voci.items.filter((r) => r.listaId === l.id).length} voci</Typography.Text></div>
        <Space wrap><Link to={`/liste/${l.id}`}><Button>Apri lista</Button></Link>{eliminaButton(l)}</Space>
      </List.Item>} />}
    </>
  }
  return <>
    <Link to="/liste"><Button type="link" icon={<ArrowLeftOutlined />} style={{ paddingLeft: 0 }}>Tutte le liste</Button></Link>
    <PageHeader titolo={lista.nome} sottotitolo={lista.descrizione || `Stagione ${attiva}`} azioni={<Space wrap><Button icon={<EditOutlined />} onClick={() => setEditor(true)}>Modifica lista</Button><Button type="primary" icon={<PlusOutlined />} onClick={() => setVoce('nuova')}>Aggiungi voce</Button></Space>} />
    <div className="liste-toolbar"><Input.Search aria-label="Cerca nelle voci" placeholder="Cerca in tutti i campi" allowClear value={ricerca} onChange={(e) => setRicerca(e.target.value)} style={{ maxWidth: 480 }} /><Typography.Text type="secondary">{risultati.length} di {righe.length} voci</Typography.Text></div>
    {!righe.length ? <Empty description="Nessuna voce. Aggiungi la prima voce compilando i campi della lista." /> : screens.md ? <Table<RigaLista> rowKey="id" dataSource={risultati} scroll={{ x: Math.max(700, lista.campi.length * 180 + 280) }} pagination={{ pageSize: 25, showSizeChanger: true }} locale={{ emptyText: 'Nessuna voce trovata' }} columns={[
      ...lista.campi.map((c) => ({ key: c.id, title: c.nome, width: 180, render: (_: unknown, r: RigaLista) => <span className="liste-valore">{valoreTesto(c, r.valori[c.id]) || '—'}</span> })),
      { key: 'azioni', title: 'Azioni', width: 280, render: (_, r) => azioniVoce(r) },
    ]} /> : <List dataSource={risultati} pagination={{ pageSize: 10, showSizeChanger: false }} locale={{ emptyText: 'Nessuna voce trovata' }} renderItem={(r) => <List.Item className="liste-voce-mobile"><Descriptions column={1} size="small" items={lista.campi.map((c) => ({ key: c.id, label: c.nome, children: <span className="liste-valore">{valoreTesto(c, r.valori[c.id]) || '—'}</span> }))} />{azioniVoce(r)}</List.Item>} />}
    <div style={{ marginTop: 24 }}>{eliminaButton(lista)}</div>
    {voce && <EditorVoce key={voce === 'nuova' ? 'nuova' : voce.id} lista={lista} riga={voce === 'nuova' ? undefined : voce} onClose={() => setVoce(null)} onSave={(valori) => {
      if (voce === 'nuova') voci.add({ listaId: lista.id, valori })
      else voci.update(voce.id, { valori })
      setVoce(null)
    }} />}
  </>
}
