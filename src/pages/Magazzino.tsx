import { useMemo, useState } from 'react'
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
  Typography,
} from 'antd'
import { PlusOutlined, MinusOutlined, DeleteOutlined, SearchOutlined } from '@ant-design/icons'
import { useCollection } from '../hooks/useCollection'
import { PageHeader } from '../components/PageHeader'
import { formatData } from '../lib/format'
import { statoScadenza } from '../lib/scadenza'
import type { Articolo } from '../types'

const CATEGORIE = ['Bevande', 'Cibo', 'Caffetteria', 'Materiale', 'Altro']

export function Magazzino() {
  const { items, add, update, remove } = useCollection<Articolo>('magazzino')
  const [modale, setModale] = useState(false)
  const [inModifica, setInModifica] = useState<Articolo | null>(null)
  const [form] = Form.useForm()

  const [q, setQ] = useState('')
  const [cat, setCat] = useState<string | undefined>()

  const ordinati = useMemo(
    () =>
      [...items].sort((a, b) => {
        if (!a.scadenza && !b.scadenza) return a.nome.localeCompare(b.nome)
        if (!a.scadenza) return 1
        if (!b.scadenza) return -1
        return a.scadenza.localeCompare(b.scadenza) || a.nome.localeCompare(b.nome)
      }),
    [items],
  )

  const filtrati = useMemo(
    () =>
      ordinati.filter(
        (a) =>
          (!q || a.nome.toLowerCase().includes(q.toLowerCase())) && (!cat || a.categoria === cat),
      ),
    [ordinati, q, cat],
  )

  const inScadenza = items.filter((a) => statoScadenza(a.scadenza).critico).length

  function adegua(a: Articolo, delta: number) {
    update(a.id, { quantita: Math.max(0, a.quantita + delta) })
  }

  function apriNuovo() {
    setInModifica(null)
    form.resetFields()
    form.setFieldsValue({ categoria: 'Bevande', quantita: 1 })
    setModale(true)
  }
  function apriModifica(a: Articolo) {
    setInModifica(a)
    form.setFieldsValue(a)
    setModale(true)
  }
  function salva(valori: Omit<Articolo, 'id'>) {
    if (inModifica) update(inModifica.id, valori)
    else add(valori)
    setModale(false)
  }

  const stopCell = { onCell: () => ({ onClick: (e: React.MouseEvent) => e.stopPropagation() }) }

  const columns = [
    {
      title: 'Articolo',
      dataIndex: 'nome',
      render: (nome: string) => <span style={{ fontWeight: 600 }}>{nome}</span>,
    },
    { title: 'Categoria', dataIndex: 'categoria', render: (c: string) => <Tag>{c}</Tag> },
    {
      title: 'Scadenza',
      key: 'scadenza',
      render: (_: unknown, a: Articolo) => {
        if (!a.scadenza) return <Typography.Text type="secondary">—</Typography.Text>
        const s = statoScadenza(a.scadenza)
        return (
          <Space>
            <span style={{ color: s.color === 'red' ? '#b1352f' : undefined }}>
              {formatData(a.scadenza, true)}
            </span>
            {s.label && <Tag color={s.color}>{s.label}</Tag>}
          </Space>
        )
      },
    },
    {
      title: 'Quantità',
      align: 'center' as const,
      width: 170,
      ...stopCell,
      render: (_: unknown, a: Articolo) => (
        <Space.Compact>
          <Button icon={<MinusOutlined />} onClick={() => adegua(a, -1)} />
          <Button style={{ pointerEvents: 'none', minWidth: 56 }}>
            <b>{a.quantita}</b>
          </Button>
          <Button icon={<PlusOutlined />} onClick={() => adegua(a, +1)} />
        </Space.Compact>
      ),
    },
    {
      title: '',
      key: 'azioni',
      width: 50,
      ...stopCell,
      render: (_: unknown, a: Articolo) => (
        <Popconfirm
          title={`Eliminare ${a.nome}?`}
          okText="Elimina"
          cancelText="Annulla"
          okButtonProps={{ danger: true }}
          onConfirm={() => remove(a.id)}
        >
          <Button type="text" danger icon={<DeleteOutlined />} />
        </Popconfirm>
      ),
    },
  ]

  return (
    <>
      <PageHeader
        titolo="Magazzino"
        sottotitolo={
          items.length > 0
            ? `${items.length} articoli${inScadenza > 0 ? ` · ${inScadenza} in scadenza` : ''}`
            : 'Scorte del bar'
        }
        azioni={
          items.length > 0 && (
            <Button type="primary" icon={<PlusOutlined />} onClick={apriNuovo}>
              Nuovo articolo
            </Button>
          )
        }
      />

      {items.length === 0 ? (
        <Empty description="Magazzino vuoto">
          <Button type="primary" icon={<PlusOutlined />} onClick={apriNuovo}>
            Nuovo articolo
          </Button>
        </Empty>
      ) : (
        <>
          <Space wrap style={{ marginBottom: 16 }}>
            <Input
              allowClear
              prefix={<SearchOutlined />}
              placeholder="Cerca articolo"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              style={{ width: 220 }}
            />
            <Select
              allowClear
              placeholder="Categoria"
              value={cat}
              onChange={setCat}
              options={CATEGORIE.map((c) => ({ value: c, label: c }))}
              style={{ width: 170 }}
            />
          </Space>
          <Table
            rowKey="id"
            dataSource={filtrati}
            columns={columns}
            pagination={false}
            size="middle"
            scroll={{ x: 'max-content' }}
            onRow={(a) => ({ onClick: () => apriModifica(a), style: { cursor: 'pointer' } })}
          />
        </>
      )}

      <Modal
        title={inModifica ? 'Modifica articolo' : 'Nuovo articolo'}
        open={modale}
        onCancel={() => setModale(false)}
        onOk={() => form.submit()}
        okText={inModifica ? 'Salva' : 'Aggiungi'}
        cancelText="Annulla"
        maskClosable={false}
        forceRender
      >
        <Form form={form} layout="vertical" onFinish={salva} requiredMark={false}>
          <Form.Item label="Nome" name="nome" rules={[{ required: true, message: 'Inserisci il nome' }]}>
            <Input placeholder="es. Acqua naturale 0,5L" />
          </Form.Item>
          <Form.Item label="Categoria" name="categoria">
            <Select options={CATEGORIE.map((c) => ({ value: c, label: c }))} />
          </Form.Item>
          <Form.Item label="Quantità" name="quantita">
            <InputNumber min={0} style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item label="Data di scadenza (facoltativa)" name="scadenza">
            <Input type="date" />
          </Form.Item>
        </Form>
      </Modal>
    </>
  )
}
