import { useMemo, useState } from 'react'
import type { MouseEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Button,
  Empty,
  Form,
  Input,
  InputNumber,
  Modal,
  Popconfirm,
  Select,
  Space,
  Table,
  Tag,
} from 'antd'
import { PlusOutlined, DeleteOutlined, SearchOutlined } from '@ant-design/icons'
import { useCollection } from '../hooks/useCollection'
import { PageHeader } from '../components/PageHeader'
import { formatData } from '../lib/format'
import type { Partita } from '../types'

function oggiIso() {
  return new Date().toISOString().slice(0, 10)
}

function esito(p: Partita): { label: string; color: string } {
  if (p.golFatti > p.golSubiti) return { label: 'V', color: 'success' }
  if (p.golFatti < p.golSubiti) return { label: 'S', color: 'error' }
  return { label: 'P', color: 'default' }
}

export function Partite() {
  const { items, add, remove } = useCollection<Partita>('partite')
  const navigate = useNavigate()
  const [modale, setModale] = useState(false)
  const [form] = Form.useForm()
  const [q, setQ] = useState('')
  const [dove, setDove] = useState<string | undefined>()
  const [esitoF, setEsitoF] = useState<string | undefined>()

  const partite = useMemo(() => [...items].sort((a, b) => b.data.localeCompare(a.data)), [items])

  const filtrate = useMemo(
    () =>
      partite.filter((p) => {
        if (q && !p.avversario.toLowerCase().includes(q.toLowerCase())) return false
        if (dove === 'casa' && !p.inCasa) return false
        if (dove === 'trasferta' && p.inCasa) return false
        if (esitoF && esito(p).label !== esitoF) return false
        return true
      }),
    [partite, q, dove, esitoF],
  )

  function apriNuova() {
    form.resetFields()
    form.setFieldsValue({ data: oggiIso(), inCasa: true, golFatti: 0, golSubiti: 0 })
    setModale(true)
  }

  function salva(v: {
    data: string
    avversario: string
    inCasa: boolean
    golFatti: number
    golSubiti: number
    note?: string
  }) {
    add({
      data: v.data,
      avversario: v.avversario.trim(),
      inCasa: v.inCasa,
      golFatti: v.golFatti ?? 0,
      golSubiti: v.golSubiti ?? 0,
      note: v.note?.trim() || undefined,
      marcatori: [],
      assist: [],
      ammoniti: [],
      espulsi: [],
    })
    setModale(false)
  }

  const columns = [
    {
      title: 'Data',
      dataIndex: 'data',
      width: 120,
      render: (d: string) => formatData(d, true),
    },
    {
      title: 'Avversario',
      key: 'avv',
      render: (_: unknown, p: Partita) => (
        <span>
          <b>{p.avversario}</b>{' '}
          <Tag>{p.inCasa ? 'Casa' : 'Trasferta'}</Tag>
        </span>
      ),
    },
    {
      title: 'Risultato',
      key: 'ris',
      align: 'center' as const,
      render: (_: unknown, p: Partita) => {
        const e = esito(p)
        return (
          <span>
            <b style={{ fontVariantNumeric: 'tabular-nums' }}>
              {p.golFatti} - {p.golSubiti}
            </b>{' '}
            <Tag color={e.color}>{e.label}</Tag>
          </span>
        )
      },
    },
    {
      title: '',
      key: 'azioni',
      width: 60,
      // il click su Elimina (e sul suo Popconfirm) non deve aprire la partita
      onCell: () => ({ onClick: (e: MouseEvent) => e.stopPropagation() }),
      render: (_: unknown, p: Partita) => (
        <Popconfirm
          title={`Eliminare la partita con ${p.avversario}?`}
          okText="Elimina"
          cancelText="Annulla"
          okButtonProps={{ danger: true }}
          onConfirm={() => remove(p.id)}
        >
          <Button type="text" danger icon={<DeleteOutlined />} />
        </Popconfirm>
      ),
    },
  ]

  return (
    <>
      <PageHeader
        titolo="Partite"
        sottotitolo={`${items.length} partite · tocca per marcatori e cartellini`}
        azioni={
          items.length > 0 && (
            <Button type="primary" icon={<PlusOutlined />} onClick={apriNuova}>
              Nuova partita
            </Button>
          )
        }
      />

      {items.length === 0 ? (
        <Empty description="Nessuna partita registrata">
          <Button type="primary" icon={<PlusOutlined />} onClick={apriNuova}>
            Nuova partita
          </Button>
        </Empty>
      ) : (
        <>
          <Space wrap style={{ marginBottom: 16 }}>
            <Input
              allowClear
              prefix={<SearchOutlined />}
              placeholder="Cerca avversario"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              style={{ width: 220 }}
            />
            <Select
              allowClear
              placeholder="Dove"
              value={dove}
              onChange={setDove}
              style={{ width: 140 }}
              options={[
                { value: 'casa', label: 'In casa' },
                { value: 'trasferta', label: 'In trasferta' },
              ]}
            />
            <Select
              allowClear
              placeholder="Esito"
              value={esitoF}
              onChange={setEsitoF}
              style={{ width: 140 }}
              options={[
                { value: 'V', label: 'Vittorie' },
                { value: 'P', label: 'Pareggi' },
                { value: 'S', label: 'Sconfitte' },
              ]}
            />
          </Space>
          <Table
            rowKey="id"
            dataSource={filtrate}
            columns={columns}
            pagination={false}
            size="middle"
            scroll={{ x: 'max-content' }}
            onRow={(p) => ({ onClick: () => navigate(`/partite/${p.id}`), style: { cursor: 'pointer' } })}
          />
        </>
      )}

      <Modal
        title="Nuova partita"
        open={modale}
        onCancel={() => setModale(false)}
        onOk={() => form.submit()}
        okText="Crea"
        cancelText="Annulla"
        maskClosable={false}
        forceRender
      >
        <Form form={form} layout="vertical" onFinish={salva} requiredMark={false}>
          <Form.Item label="Data" name="data" rules={[{ required: true, message: 'Scegli la data' }]}>
            <Input type="date" />
          </Form.Item>
          <Form.Item
            label="Avversario"
            name="avversario"
            rules={[{ required: true, message: 'Inserisci l’avversario' }]}
          >
            <Input placeholder="es. Pievepelago" />
          </Form.Item>
          <Form.Item label="Dove" name="inCasa">
            <Select
              options={[
                { value: true, label: 'In casa' },
                { value: false, label: 'In trasferta' },
              ]}
            />
          </Form.Item>
          <Form.Item label="Gol fatti" name="golFatti">
            <InputNumber min={0} style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item label="Gol subiti" name="golSubiti">
            <InputNumber min={0} style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item label="Note (facoltative)" name="note">
            <Input />
          </Form.Item>
        </Form>
      </Modal>
    </>
  )
}
