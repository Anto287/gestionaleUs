import { useMemo, useState } from 'react'
import {
  Button,
  Card,
  Col,
  Empty,
  Form,
  Input,
  List,
  Modal,
  Popconfirm,
  Row,
  Space,
  Statistic,
  Tag,
  Typography,
} from 'antd'
import { PlusOutlined, DeleteOutlined, CheckOutlined, FilePdfOutlined, RightOutlined } from '@ant-design/icons'
import { useCollection } from '../hooks/useCollection'
import { useSeason } from '../season/SeasonContext'
import { PageHeader } from '../components/PageHeader'
import { formatData } from '../lib/format'
import { AffluenzaChart } from './allenamenti/AffluenzaChart'
import { ClassificaPresenze, esportaClassificaPdf, type RigaClassifica } from './allenamenti/classifica'
import type { Allenamento, Giocatore } from '../types'

const { CheckableTag } = Tag
const { Text } = Typography

function oggiIso() {
  return new Date().toISOString().slice(0, 10)
}
function labelBreve(iso: string) {
  const [, m, d] = iso.split('-')
  return d && m ? `${d}/${m}` : iso
}

export function Allenamenti() {
  const { items, add, update, remove } = useCollection<Allenamento>('allenamenti')
  const giocatori = useCollection<Giocatore>('giocatori')
  const { attiva } = useSeason()
  const [modaleNuova, setModaleNuova] = useState(false)
  const [apertaId, setApertaId] = useState<string | null>(null)
  const [esportando, setEsportando] = useState(false)
  const [form] = Form.useForm()

  const rosa = useMemo(
    () =>
      [...giocatori.items].sort((a, b) =>
        `${a.cognome}${a.nome}`.localeCompare(`${b.cognome}${b.nome}`),
      ),
    [giocatori.items],
  )

  const sedute = useMemo(() => [...items].sort((a, b) => b.data.localeCompare(a.data)), [items])

  const presenti = (s: Allenamento) => rosa.filter((g) => s.presenze[g.id]).length

  const media = sedute.length
    ? sedute.reduce((tot, s) => tot + presenti(s), 0) / sedute.length
    : 0
  const mediaPerc = rosa.length ? Math.round((media / rosa.length) * 100) : 0

  const datiChart = useMemo(
    () =>
      [...sedute]
        .slice(0, 16)
        .reverse()
        .map((s) => ({ label: labelBreve(s.data), valore: presenti(s) })),
    [sedute, rosa],
  )

  const classifica: RigaClassifica[] = useMemo(
    () =>
      rosa
        .map((g) => {
          const p = sedute.filter((s) => s.presenze[g.id]).length
          return {
            id: g.id,
            nome: `${g.cognome} ${g.nome}`,
            presenze: p,
            perc: sedute.length ? Math.round((p / sedute.length) * 100) : 0,
          }
        })
        .sort((a, b) => b.presenze - a.presenze || a.nome.localeCompare(b.nome)),
    [rosa, sedute],
  )

  const sessioneAperta = apertaId ? items.find((s) => s.id === apertaId) : null

  function creaSeduta(valori: { data: string; note?: string }) {
    add({ data: valori.data, note: valori.note?.trim() || undefined, presenze: {} })
    setModaleNuova(false)
  }

  function togglePresenza(s: Allenamento, giocatoreId: string) {
    update(s.id, { presenze: { ...s.presenze, [giocatoreId]: !s.presenze[giocatoreId] } })
  }

  async function esporta() {
    setEsportando(true)
    try {
      await esportaClassificaPdf(classifica, attiva, sedute.length)
    } finally {
      setEsportando(false)
    }
  }

  if (giocatori.items.length === 0) {
    return (
      <>
        <PageHeader titolo="Allenamenti" />
        <Empty description="Aggiungi prima i giocatori nella sezione Rosa: qui segnerai chi c'è a ogni seduta." />
      </>
    )
  }

  return (
    <>
      <PageHeader
        titolo="Allenamenti"
        sottotitolo={`${sedute.length} sedute`}
        azioni={
          <Button
            type="primary"
            icon={<PlusOutlined />}
            onClick={() => {
              form.resetFields()
              form.setFieldsValue({ data: oggiIso() })
              setModaleNuova(true)
            }}
          >
            Nuova seduta
          </Button>
        }
      />

      <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
        <Col xs={24} md={8}>
          <Card style={{ height: '100%' }}>
            <Space direction="vertical" size="large" style={{ width: '100%' }}>
              <Statistic
                title="Affluenza media"
                value={media.toFixed(1)}
                suffix={`/ ${rosa.length}`}
              />
              <Statistic title="Media presenze" value={mediaPerc} suffix="%" />
              <Statistic title="Sedute totali" value={sedute.length} />
            </Space>
          </Card>
        </Col>
        <Col xs={24} md={16}>
          <Card title="Affluenza per seduta" style={{ height: '100%' }}>
            <AffluenzaChart dati={datiChart} media={media} scala={rosa.length} />
          </Card>
        </Col>
      </Row>

      <Card
        title="Classifica presenze"
        style={{ marginBottom: 16 }}
        extra={
          <Button
            icon={<FilePdfOutlined />}
            onClick={esporta}
            loading={esportando}
            disabled={sedute.length === 0}
          >
            Esporta PDF
          </Button>
        }
      >
        <ClassificaPresenze righe={classifica} />
      </Card>

      <Card title="Sedute" styles={{ body: { padding: 0 } }}>
        {sedute.length === 0 ? (
          <div style={{ padding: 24 }}>
            <Empty description="Nessuna seduta registrata" />
          </div>
        ) : (
          <List
            dataSource={sedute}
            renderItem={(s) => (
              <List.Item
                onClick={() => setApertaId(s.id)}
                style={{ cursor: 'pointer', padding: '12px 24px' }}
                extra={<RightOutlined style={{ color: '#bbb' }} />}
              >
                <List.Item.Meta
                  title={formatData(s.data)}
                  description={s.note || undefined}
                />
                <Text type="secondary">
                  <b>{presenti(s)}</b>/{rosa.length} presenti
                </Text>
              </List.Item>
            )}
          />
        )}
      </Card>

      {/* Nuova seduta */}
      <Modal
        title="Nuova seduta"
        open={modaleNuova}
        onCancel={() => setModaleNuova(false)}
        onOk={() => form.submit()}
        okText="Crea seduta"
        cancelText="Annulla"
        maskClosable={false}
        forceRender
      >
        <Form form={form} layout="vertical" onFinish={creaSeduta} requiredMark={false}>
          <Form.Item label="Data" name="data" rules={[{ required: true, message: 'Scegli la data' }]}>
            <Input type="date" />
          </Form.Item>
          <Form.Item label="Note (facoltative)" name="note">
            <Input placeholder="es. amichevole, seduta atletica…" />
          </Form.Item>
        </Form>
      </Modal>

      {/* Modifica presenze seduta */}
      <Modal
        title={sessioneAperta ? `Presenze · ${formatData(sessioneAperta.data)}` : ''}
        open={!!sessioneAperta}
        onCancel={() => setApertaId(null)}
        footer={null}
        maskClosable={false}
        width={640}
      >
        {sessioneAperta && (
          <>
            <Space wrap style={{ marginBottom: 12 }}>
              <Input
                type="date"
                value={sessioneAperta.data}
                onChange={(e) => update(sessioneAperta.id, { data: e.target.value })}
                style={{ width: 170 }}
              />
              <Input
                key={sessioneAperta.id}
                placeholder="Note"
                defaultValue={sessioneAperta.note}
                onBlur={(e) => update(sessioneAperta.id, { note: e.target.value.trim() || undefined })}
                style={{ width: 260 }}
              />
            </Space>
            <br />
            <Text type="secondary">
              Tocca i giocatori presenti · <b>{presenti(sessioneAperta)}</b>/{rosa.length}
            </Text>
            <div style={{ margin: '12px 0' }}>
              <Space size={[8, 8]} wrap>
                {rosa.map((g) => {
                  const presente = !!sessioneAperta.presenze[g.id]
                  return (
                    <CheckableTag
                      key={g.id}
                      checked={presente}
                      onChange={() => togglePresenza(sessioneAperta, g.id)}
                      style={{ padding: '4px 10px', fontSize: 14, border: '1px solid #ddd6ca' }}
                    >
                      {presente && <CheckOutlined style={{ marginRight: 4 }} />}
                      {g.cognome} {g.nome}
                    </CheckableTag>
                  )
                })}
              </Space>
            </div>
            <Popconfirm
              title="Eliminare questa seduta?"
              okText="Elimina"
              cancelText="Annulla"
              okButtonProps={{ danger: true }}
              onConfirm={() => {
                remove(sessioneAperta.id)
                setApertaId(null)
              }}
            >
              <Button type="text" danger icon={<DeleteOutlined />} size="small">
                Elimina seduta
              </Button>
            </Popconfirm>
          </>
        )}
      </Modal>
    </>
  )
}
