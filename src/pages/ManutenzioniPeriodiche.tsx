import { useState } from 'react'
import { Button, Empty, Form, Input, InputNumber, Table, Modal, Popconfirm, Select, Space, Tag } from 'antd'
import { PageHeader } from '../components/PageHeader'
import { DataPicker, propsCampoData } from '../components/DataPicker'
import { useCollection } from '../hooks/useCollection'
import { formatData, oggiIso } from '../lib/format'
import { prossimaManutenzione, type ManutenzionePeriodica } from '../lib/manutenzioni'

type Campi = Omit<ManutenzionePeriodica, 'id'>

export function ManutenzioniPeriodiche() {
  const { items, add, update, remove } = useCollection<ManutenzionePeriodica>('manutenzioniPeriodiche')
  const [form] = Form.useForm<Campi>()
  const [editor, setEditor] = useState<string | null>(null)
  const oggi = oggiIso()
  const voci = items.map((voce) => ({ voce, prossima: prossimaManutenzione(voce) }))
    .sort((a, b) => a.prossima.localeCompare(b.prossima))

  function apri(voce?: ManutenzionePeriodica) {
    form.resetFields()
    form.setFieldsValue(voce ?? { nome: '', ultima: oggi, intervallo: 1, unita: 'month' })
    setEditor(voce?.id ?? '')
  }

  function salva(campi: Campi) {
    const record = { ...campi, nome: campi.nome.trim() }
    if (editor) update(editor, record)
    else add(record)
    setEditor(null)
  }

  return (
    <>
      <PageHeader
        titolo="Manutenzioni periodiche"
        sottotitolo="Programma gli interventi e controlla le prossime scadenze."
        azioni={<Button type="primary" onClick={() => apri()}>Aggiungi manutenzione</Button>}
      />
      <Table
        dataSource={voci}
        rowKey={({ voce }) => voce.id}
        pagination={false}
        size="small"
        locale={{ emptyText: <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="Nessuna manutenzione programmata" /> }}
        columns={[
          { title: 'Attività', key: 'nome', render: (_, { voce }) => <strong>{voce.nome}</strong> },
          { title: 'Frequenza', key: 'frequenza', responsive: ['md'], render: (_, { voce }) =>
            new Intl.NumberFormat('it', { style: 'unit', unit: voce.unita, unitDisplay: 'long' }).format(voce.intervallo) },
          { title: 'Ultima esecuzione o partenza', key: 'ultima', responsive: ['lg'], render: (_, { voce }) => formatData(voce.ultima) },
          { title: 'Prossima scadenza', key: 'scadenza', render: (_, { prossima }) => (
            <Space direction="vertical" size={2}>
              {formatData(prossima, true)}
              {prossima <= oggi && <Tag color="orange">Da fare</Tag>}
            </Space>
          ) },
          { title: 'Azioni', key: 'azioni', render: (_, { voce }) => (
            <Space wrap size={4}>
              <Button size="small" onClick={() => update(voce.id, { ultima: oggi })}>Fatta oggi</Button>
              <Button size="small" onClick={() => apri(voce)}>Modifica</Button>
              <Popconfirm title="Eliminare questa manutenzione?" onConfirm={() => remove(voce.id)}>
                <Button size="small" danger>Elimina</Button>
              </Popconfirm>
            </Space>
          ) },
        ]}
      />
      <Modal title={editor ? 'Modifica manutenzione' : 'Nuova manutenzione'} open={editor !== null}
        onCancel={() => setEditor(null)} onOk={() => form.submit()} okText="Salva" forceRender>
        <Form form={form} layout="vertical" onFinish={salva}>
          <Form.Item name="nome" label="Attività" rules={[{ required: true, whitespace: true }]}>
            <Input maxLength={160} />
          </Form.Item>
          <Form.Item name="ultima" label="Ultima esecuzione o data di partenza" rules={[{ required: true }]} {...propsCampoData}>
            <DataPicker />
          </Form.Item>
          <Form.Item name="intervallo" label="Ripeti ogni" rules={[{ required: true, type: 'integer', min: 1, max: 3650 }]}>
            <InputNumber min={1} max={3650} precision={0} />
          </Form.Item>
          <Form.Item name="unita" label="Unità" rules={[{ required: true }]}>
            <Select options={[
              { value: 'day', label: 'Giorni' }, { value: 'week', label: 'Settimane' },
              { value: 'month', label: 'Mesi' }, { value: 'year', label: 'Anni' },
            ]} />
          </Form.Item>
        </Form>
      </Modal>
    </>
  )
}
