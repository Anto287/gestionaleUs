import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import {
  Button,
  Card,
  Col,
  Empty,
  Form,
  Input,
  InputNumber,
  Modal,
  Popconfirm,
  Result,
  Row,
  Select,
  Space,
  Switch,
  Tag,
  Typography,
} from 'antd'
import { ArrowLeftOutlined, DeleteOutlined, EditOutlined, PlusOutlined, WarningOutlined } from '@ant-design/icons'
import { useCollection } from '../hooks/useCollection'
import { useEliminaUndo } from '../hooks/useEliminaUndo'
import { ErbaCampo, posizioneSlot } from '../components/ErbaCampo'
import { MODULI } from '../lib/formazione'
import { moduloDa } from '../lib/formazionePartita'
import { CARATTERISTICHE, bilancio, partiteContro } from '../lib/avversari'
import { formatData } from '../lib/format'
import { OPZIONI_RUOLI, RUOLO_BY_CODE, areaHex, coloreRuolo, ordineRuolo } from '../ruoli'
import type { Avversario, GiocatoreAvversario, Partita } from '../types'

const { Text, Title } = Typography

function nuovoId() {
  return `ga-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`
}

/** Area di testo che salva quando si esce dal campo (non a ogni lettera). */
function TestoScheda({
  etichetta,
  valore,
  segnaposto,
  onSalva,
}: {
  etichetta: string
  valore?: string
  segnaposto: string
  onSalva: (v: string | undefined) => void
}) {
  const [testo, setTesto] = useState(valore ?? '')
  useEffect(() => setTesto(valore ?? ''), [valore])
  return (
    <div style={{ marginBottom: 12 }}>
      <Text type="secondary" style={{ fontSize: 12 }}>
        {etichetta}
      </Text>
      <Input.TextArea
        autoSize={{ minRows: 2, maxRows: 8 }}
        placeholder={segnaposto}
        value={testo}
        onChange={(e) => setTesto(e.target.value)}
        onBlur={() => {
          const v = testo.trim() || undefined
          if (v !== (valore || undefined)) onSalva(v)
        }}
      />
    </div>
  )
}

type Aperto = { tipo: 'posto'; indice: number } | { tipo: 'giocatore'; g: GiocatoreAvversario | null } | null

export function AvversarioDettaglio() {
  const { id } = useParams()
  const navigate = useNavigate()
  const coll = useCollection<Avversario>('avversari')
  const partite = useCollection<Partita>('partite')
  const eliminaConUndo = useEliminaUndo()
  const [aperto, setAperto] = useState<Aperto>(null)
  const [nuovoNome, setNuovoNome] = useState('')
  const [form] = Form.useForm()

  const a = coll.items.find((x) => x.id === id)
  const contro = useMemo(() => (a ? partiteContro(partite.items, a.nome) : []), [a, partite.items])

  if (!a) {
    return (
      <Result
        status="404"
        title="Squadra non trovata"
        extra={
          <Button type="primary" onClick={() => navigate('/avversari')}>
            Torna agli avversari
          </Button>
        }
      />
    )
  }

  const modulo = moduloDa(a.modulo)
  const giocatori = [...a.giocatori].sort(
    (x, y) =>
      (x.posto ?? 99) - (y.posto ?? 99) ||
      ordineRuolo(x.ruolo) - ordineRuolo(y.ruolo) ||
      (x.numero ?? 99) - (y.numero ?? 99) ||
      x.nome.localeCompare(y.nome),
  )
  const nelPosto = (i: number) => a.giocatori.find((g) => g.posto === i)
  const b = bilancio(contro)

  function patch(p: Partial<Avversario>) {
    coll.update(a!.id, p)
  }

  /** Salva un giocatore; se prende un posto già occupato, l'altro lo lascia. */
  function salvaGiocatore(g: GiocatoreAvversario) {
    const altri = a!.giocatori
      .filter((x) => x.id !== g.id)
      .map((x) => (g.posto !== undefined && x.posto === g.posto ? { ...x, posto: undefined } : x))
    const esiste = a!.giocatori.some((x) => x.id === g.id)
    const lista = esiste
      ? a!.giocatori.map((x) => (x.id === g.id ? g : altri.find((y) => y.id === x.id)!))
      : [...altri, g]
    patch({ giocatori: lista })
  }

  function mettiNelPosto(indice: number, gid: string) {
    const g = a!.giocatori.find((x) => x.id === gid)
    if (!g) return
    // chi non ha ancora un ruolo prende quello del posto
    salvaGiocatore({ ...g, posto: indice, ruolo: g.ruolo ?? modulo.slots[indice].role })
    setAperto(null)
  }

  function aggiungiNelPosto(indice: number) {
    const nome = nuovoNome.trim()
    if (!nome) return
    salvaGiocatore({ id: nuovoId(), nome, posto: indice, ruolo: modulo.slots[indice].role })
    setNuovoNome('')
    setAperto(null)
  }

  function apriGiocatore(g: GiocatoreAvversario | null) {
    form.resetFields()
    form.setFieldsValue(g ?? { caratteristiche: [] })
    setAperto({ tipo: 'giocatore', g })
  }

  function salvaForm(v: Omit<GiocatoreAvversario, 'id'>) {
    const prima = aperto?.tipo === 'giocatore' ? aperto.g : null
    salvaGiocatore({
      ...v,
      id: prima?.id ?? nuovoId(),
      nome: v.nome.trim(),
      numero: v.numero ?? undefined,
      posto: v.posto ?? undefined,
      ruolo: v.ruolo || undefined,
      note: v.note?.trim() || undefined,
      pericoloso: v.pericoloso || undefined,
      caratteristiche: v.caratteristiche?.length ? v.caratteristiche : undefined,
    })
    setAperto(null)
  }

  function contenutoPosto(indice: number) {
    const slot = modulo.slots[indice]
    const occupante = nelPosto(indice)
    const candidati = giocatori.filter((g) => g.id !== occupante?.id)
    return (
      <Space direction="vertical" size={12} style={{ width: '100%' }}>
        <Text type="secondary">{RUOLO_BY_CODE[slot.role]?.label ?? slot.role}</Text>
        {occupante && (
          <Card size="small">
            <Space direction="vertical" size={4} style={{ width: '100%' }}>
              <Text strong>
                {occupante.numero ? `${occupante.numero} · ` : ''}
                {occupante.nome}
              </Text>
              {occupante.caratteristiche?.length ? (
                <div>
                  {occupante.caratteristiche.map((c) => (
                    <Tag key={c}>{c}</Tag>
                  ))}
                </div>
              ) : null}
              {occupante.note && <Text type="secondary">{occupante.note}</Text>}
              <Space>
                <Button size="small" icon={<EditOutlined />} onClick={() => apriGiocatore(occupante)}>
                  Modifica
                </Button>
                <Button
                  size="small"
                  onClick={() => {
                    salvaGiocatore({ ...occupante, posto: undefined })
                    setAperto(null)
                  }}
                >
                  Togli dal posto
                </Button>
              </Space>
            </Space>
          </Card>
        )}
        {candidati.length > 0 && (
          <Select
            style={{ width: '100%' }}
            placeholder={occupante ? 'Metti qui un altro' : 'Scegli fra i giocatori segnati'}
            showSearch
            optionFilterProp="label"
            options={candidati.map((g) => ({
              value: g.id,
              label: `${g.numero ? `${g.numero} · ` : ''}${g.nome}${g.ruolo ? ` (${g.ruolo})` : ''}`,
            }))}
            onChange={(gid) => mettiNelPosto(indice, gid)}
          />
        )}
        <Space.Compact style={{ width: '100%' }}>
          <Input
            placeholder="…oppure scrivi un nome nuovo"
            value={nuovoNome}
            onChange={(e) => setNuovoNome(e.target.value)}
            onPressEnter={() => aggiungiNelPosto(indice)}
          />
          <Button type="primary" disabled={!nuovoNome.trim()} onClick={() => aggiungiNelPosto(indice)}>
            Aggiungi
          </Button>
        </Space.Compact>
      </Space>
    )
  }

  return (
    <>
      <Button
        type="text"
        icon={<ArrowLeftOutlined />}
        onClick={() => navigate('/avversari')}
        style={{ marginBottom: 12, paddingLeft: 0 }}
      >
        Avversari
      </Button>

      <Card style={{ marginBottom: 16 }}>
        <div className="avv-testa">
          <Title level={3} style={{ margin: 0 }} editable={{ onChange: (v) => v.trim() && patch({ nome: v.trim() }) }}>
            {a.nome}
          </Title>
          <Popconfirm
            title="Eliminare la scheda di questa squadra?"
            okText="Elimina"
            cancelText="Annulla"
            okButtonProps={{ danger: true }}
            onConfirm={() => {
              eliminaConUndo(coll, a, `Scheda di ${a.nome} eliminata.`)
              navigate('/avversari')
            }}
          >
            <Button danger icon={<DeleteOutlined />} />
          </Popconfirm>
        </div>
        {b.vinte + b.pari + b.perse > 0 && (
          <Text type="secondary">
            In questa stagione: {b.vinte} vinte, {b.pari} pari, {b.perse} perse · gol {b.golFatti}-{b.golSubiti}
          </Text>
        )}
      </Card>

      <Row gutter={[16, 16]}>
        <Col xs={24} lg={12}>
          <Card
            title="Come si schierano"
            size="small"
            extra={
              <Select
                size="small"
                style={{ width: 104 }}
                placeholder="Modulo"
                value={a.modulo}
                options={MODULI.map((m) => ({ value: m.id, label: m.label }))}
                onChange={(m) => patch({ modulo: m })}
              />
            }
          >
            <div className="campo">
              <ErbaCampo />
              <div className="campo-slots">
                {modulo.slots.map((s, i) => {
                  const g = nelPosto(i)
                  const { left, top } = posizioneSlot(s)
                  return (
                    <button
                      key={i}
                      type="button"
                      className={`campo-token${g ? '' : ' campo-token-vuoto'}`}
                      style={{ left, top }}
                      onClick={() => setAperto({ tipo: 'posto', indice: i })}
                    >
                      <span className="pt-disc-wrap">
                        <span
                          className={`token-disc${g ? '' : ' vuoto'}`}
                          style={g ? { background: areaHex(s.role) } : { borderColor: areaHex(s.role), color: '#fff' }}
                        >
                          {g ? (g.numero ?? s.role) : '+'}
                        </span>
                        {g?.pericoloso && (
                          <span className="avv-pericolo" title="Da tenere d'occhio">
                            !
                          </span>
                        )}
                      </span>
                      <span className={`token-nome${g ? '' : ' vuoto'}`}>{g ? g.nome : s.role}</span>
                    </button>
                  )
                })}
              </div>
            </div>
            <Text type="secondary" style={{ fontSize: 12, display: 'block', marginTop: 8, textAlign: 'center' }}>
              Tocca un posto per metterci un giocatore. Il «!» segna chi è da tenere d'occhio.
            </Text>
          </Card>
        </Col>

        <Col xs={24} lg={12}>
          <Card title="Come giocano" size="small" style={{ marginBottom: 16 }}>
            <TestoScheda
              etichetta="Stile di gioco"
              valore={a.stile}
              segnaposto="es. pressing alto, palla lunga sulla punta, ripartenze sugli esterni"
              onSalva={(v) => patch({ stile: v })}
            />
            <TestoScheda
              etichetta="Punti di forza"
              valore={a.puntiForza}
              segnaposto="es. forti sulle palle inattive, centrocampo fisico"
              onSalva={(v) => patch({ puntiForza: v })}
            />
            <TestoScheda
              etichetta="Punti deboli"
              valore={a.puntiDeboli}
              segnaposto="es. difesa lenta, calano nel secondo tempo"
              onSalva={(v) => patch({ puntiDeboli: v })}
            />
          </Card>

          <Card title="Partite contro di loro" size="small">
            {contro.length === 0 ? (
              <Text type="secondary">Nessuna partita in questa stagione con questo nome.</Text>
            ) : (
              <ul className="avv-partite">
                {contro.map((p) => {
                  const programma = p.giocata === false
                  const colore = programma
                    ? 'gold'
                    : p.golFatti > p.golSubiti
                      ? 'success'
                      : p.golFatti < p.golSubiti
                        ? 'error'
                        : 'default'
                  return (
                    <li key={p.id} onClick={() => navigate(`/partite/${p.id}`)}>
                      <span>
                        {formatData(p.data)} · {p.inCasa ? 'in casa' : 'in trasferta'}
                      </span>
                      <Tag color={colore} style={{ marginInlineEnd: 0 }}>
                        {programma ? 'In programma' : `${p.golFatti}-${p.golSubiti}`}
                      </Tag>
                    </li>
                  )
                })}
              </ul>
            )}
          </Card>
        </Col>

        <Col span={24}>
          <Card
            title={`Giocatori${a.giocatori.length ? ` (${a.giocatori.length})` : ''}`}
            size="small"
            extra={
              <Button size="small" icon={<PlusOutlined />} onClick={() => apriGiocatore(null)}>
                Aggiungi
              </Button>
            }
          >
            {giocatori.length === 0 ? (
              <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="Segna chi hai visto giocare e come." />
            ) : (
              <div className="avv-giocatori">
                {giocatori.map((g) => (
                  <div key={g.id} className="avv-giocatore" onClick={() => apriGiocatore(g)}>
                    <span className="token-disc avv-disc" style={{ background: areaHex(g.ruolo) }}>
                      {g.numero ?? g.ruolo ?? '?'}
                    </span>
                    <div className="avv-giocatore-corpo">
                      <div className="avv-giocatore-nome">
                        <Text strong>{g.nome}</Text>
                        {g.ruolo && (
                          <Tag color={coloreRuolo(g.ruolo)} style={{ marginInlineEnd: 0 }}>
                            {g.ruolo}
                          </Tag>
                        )}
                        {g.posto !== undefined && (
                          <Text type="secondary" style={{ fontSize: 12 }}>
                            titolare
                          </Text>
                        )}
                        {g.pericoloso && (
                          <Tag color="volcano" icon={<WarningOutlined />} style={{ marginInlineEnd: 0 }}>
                            occhio
                          </Tag>
                        )}
                      </div>
                      {g.caratteristiche?.length ? (
                        <div className="avv-giocatore-tag">
                          {g.caratteristiche.map((c) => (
                            <Tag key={c}>{c}</Tag>
                          ))}
                        </div>
                      ) : null}
                      {g.note && (
                        <Text type="secondary" style={{ fontSize: 13 }}>
                          {g.note}
                        </Text>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Card>
        </Col>
      </Row>

      <Modal
        open={aperto?.tipo === 'posto'}
        title={aperto?.tipo === 'posto' ? modulo.slots[aperto.indice].role : ''}
        onCancel={() => {
          setAperto(null)
          setNuovoNome('')
        }}
        footer={null}
        width={400}
        destroyOnHidden
      >
        {aperto?.tipo === 'posto' && contenutoPosto(aperto.indice)}
      </Modal>

      <Modal
        open={aperto?.tipo === 'giocatore'}
        title={aperto?.tipo === 'giocatore' && aperto.g ? aperto.g.nome : 'Nuovo giocatore'}
        onCancel={() => setAperto(null)}
        onOk={() => form.submit()}
        okText="Salva"
        cancelText="Annulla"
        forceRender
        footer={(_, { OkBtn, CancelBtn }) => (
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
            {aperto?.tipo === 'giocatore' && aperto.g ? (
              <Popconfirm
                title="Togliere questo giocatore?"
                okText="Togli"
                cancelText="Annulla"
                okButtonProps={{ danger: true }}
                onConfirm={() => {
                  const via = aperto.g!
                  patch({ giocatori: a.giocatori.filter((x) => x.id !== via.id) })
                  setAperto(null)
                }}
              >
                <Button danger icon={<DeleteOutlined />} />
              </Popconfirm>
            ) : (
              <span />
            )}
            <Space>
              <CancelBtn />
              <OkBtn />
            </Space>
          </div>
        )}
      >
        <Form form={form} layout="vertical" requiredMark={false} onFinish={salvaForm}>
          <Row gutter={12}>
            <Col span={16}>
              <Form.Item label="Nome" name="nome" rules={[{ required: true, whitespace: true, message: 'Scrivi il nome' }]}>
                <Input placeholder="es. Rossi, o «il 10 mancino»" />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item label="Numero" name="numero">
                <InputNumber min={1} max={99} style={{ width: '100%' }} />
              </Form.Item>
            </Col>
          </Row>
          <Row gutter={12}>
            <Col span={12}>
              <Form.Item label="Ruolo" name="ruolo">
                <Select allowClear showSearch optionFilterProp="label" options={OPZIONI_RUOLI} />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item label="Posto nel modulo" name="posto">
                <Select
                  allowClear
                  placeholder="In panchina / non so"
                  options={modulo.slots.map((s, i) => {
                    const chi = nelPosto(i)
                    return { value: i, label: `${s.role}${chi ? ` · ora ${chi.nome}` : ''}` }
                  })}
                />
              </Form.Item>
            </Col>
          </Row>
          <Form.Item label="Caratteristiche" name="caratteristiche" extra="Scegline o scrivine di nuove">
            <Select mode="tags" options={CARATTERISTICHE.map((c) => ({ value: c, label: c }))} />
          </Form.Item>
          <Form.Item label="Da tenere d'occhio" name="pericoloso" valuePropName="checked">
            <Switch />
          </Form.Item>
          <Form.Item label="Come gioca" name="note">
            <Input.TextArea autoSize={{ minRows: 2, maxRows: 6 }} placeholder="es. parte largo e rientra sul destro, tira spesso" />
          </Form.Item>
        </Form>
      </Modal>
    </>
  )
}
