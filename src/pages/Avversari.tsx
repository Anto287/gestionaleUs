import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Button, Card, Col, Empty, Form, Input, Modal, Row, Space, Tag, Typography } from 'antd'
import { PlusOutlined, SearchOutlined, WarningOutlined } from '@ant-design/icons'
import { PageHeader } from '../components/PageHeader'
import { useCollection } from '../hooks/useCollection'
import { useFiltro } from '../hooks/useFiltro'
import { bilancio, normalizzaNome, partiteContro, schedaDi, senzaScheda } from '../lib/avversari'
import type { Avversario, Partita } from '../types'

const { Text } = Typography

/** Le squadre affrontate: come giocano e chi c'è da tenere d'occhio. */
export function Avversari() {
  const avversari = useCollection<Avversario>('avversari')
  const partite = useCollection<Partita>('partite')
  const navigate = useNavigate()
  const [q, setQ] = useFiltro('avversari.q', '')
  const [modale, setModale] = useState(false)
  const [form] = Form.useForm<{ nome: string }>()

  const elenco = useMemo(() => {
    const n = normalizzaNome(q)
    return [...avversari.items]
      .filter((a) => !n || normalizzaNome(a.nome).includes(n))
      .sort((a, b) => a.nome.localeCompare(b.nome))
  }, [avversari.items, q])

  const mancanti = useMemo(() => senzaScheda(avversari.items, partite.items), [avversari.items, partite.items])

  function crea(nome: string) {
    const esistente = schedaDi(avversari.items, nome)
    const id = esistente?.id ?? avversari.add({ nome: nome.trim(), giocatori: [] })
    navigate(`/avversari/${id}`)
  }

  return (
    <>
      <PageHeader
        titolo="Avversari"
        sottotitolo="Le squadre affrontate: come giocano e i loro giocatori. Valgono per tutte le stagioni."
        azioni={
          <Button
            type="primary"
            icon={<PlusOutlined />}
            onClick={() => {
              form.resetFields()
              setModale(true)
            }}
          >
            Nuova squadra
          </Button>
        }
      />

      {mancanti.length > 0 && (
        <Card size="small" style={{ marginBottom: 16 }}>
          <Text type="secondary" style={{ fontSize: 13 }}>
            Dalle partite di questa stagione, ancora senza scheda:
          </Text>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 8 }}>
            {mancanti.map((nome) => (
              <Button key={nome} size="small" icon={<PlusOutlined />} onClick={() => crea(nome)}>
                {nome}
              </Button>
            ))}
          </div>
        </Card>
      )}

      <Input
        allowClear
        prefix={<SearchOutlined />}
        placeholder="Cerca una squadra"
        value={q}
        onChange={(e) => setQ(e.target.value)}
        style={{ marginBottom: 16, maxWidth: 360 }}
      />

      {elenco.length === 0 ? (
        <Empty
          description={
            avversari.items.length
              ? 'Nessuna squadra con questo nome.'
              : 'Nessuna scheda ancora: creane una o aprila dalla partita («Scheda avversario»).'
          }
        />
      ) : (
        <Row gutter={[16, 16]}>
          {elenco.map((a) => {
            const contro = partiteContro(partite.items, a.nome)
            const b = bilancio(contro)
            const giocate = b.vinte + b.pari + b.perse
            const pericolosi = a.giocatori.filter((g) => g.pericoloso).length
            return (
              <Col key={a.id} xs={24} sm={12} lg={8}>
                <Card hoverable size="small" onClick={() => navigate(`/avversari/${a.id}`)} className="avv-card">
                  <div className="avv-card-testa">
                    <span className="avv-card-nome">{a.nome}</span>
                    {a.modulo && <Tag style={{ marginInlineEnd: 0 }}>{a.modulo}</Tag>}
                  </div>
                  {a.stile && (
                    <Text type="secondary" className="avv-card-stile">
                      {a.stile}
                    </Text>
                  )}
                  <Space size={[8, 4]} wrap style={{ marginTop: 8 }}>
                    <Tag>
                      {a.giocatori.length} {a.giocatori.length === 1 ? 'giocatore' : 'giocatori'}
                    </Tag>
                    {pericolosi > 0 && (
                      <Tag color="volcano" icon={<WarningOutlined />}>
                        {pericolosi} da tenere d'occhio
                      </Tag>
                    )}
                    {giocate > 0 && (
                      <Tag color={b.vinte > b.perse ? 'success' : b.perse > b.vinte ? 'error' : 'default'}>
                        {b.vinte}V {b.pari}P {b.perse}S · {b.golFatti}-{b.golSubiti}
                      </Tag>
                    )}
                  </Space>
                </Card>
              </Col>
            )
          })}
        </Row>
      )}

      <Modal
        title="Nuova squadra"
        open={modale}
        onCancel={() => setModale(false)}
        onOk={() => form.submit()}
        okText="Crea"
        cancelText="Annulla"
        forceRender
      >
        <Form form={form} layout="vertical" requiredMark={false} onFinish={(v) => crea(v.nome)}>
          <Form.Item
            label="Nome della squadra"
            name="nome"
            rules={[{ required: true, whitespace: true, message: 'Scrivi il nome' }]}
            extra="Scrivilo come nelle partite: la scheda si aggancia per nome."
          >
            <Input />
          </Form.Item>
        </Form>
      </Modal>
    </>
  )
}
