import { useState } from 'react'
import { Button, Card, Form, Input, List, Modal, Popconfirm, Space, Typography } from 'antd'
import { DeleteOutlined, EditOutlined, PlusOutlined } from '@ant-design/icons'
import { useCollection } from '../../hooks/useCollection'
import { useEliminaUndo } from '../../hooks/useEliminaUndo'
import type { Giocatore } from '../../types'

type Nominativo = Pick<Giocatore, 'nome' | 'cognome'>

export function OspitiAllenamento() {
  const ospiti = useCollection<Giocatore>('giocatori', 'ospiti')
  const eliminaConUndo = useEliminaUndo()
  const [form] = Form.useForm<Nominativo>()
  const [editor, setEditor] = useState<{ id?: string } | null>(null)

  function apri(ospite?: Giocatore) {
    form.setFieldsValue({ nome: ospite?.nome ?? '', cognome: ospite?.cognome ?? '' })
    setEditor({ id: ospite?.id })
  }

  function salva({ nome, cognome }: Nominativo) {
    const nominativo = { nome: nome.trim(), cognome: cognome.trim() }
    if (editor?.id) ospiti.update(editor.id, nominativo)
    else ospiti.add({ ...nominativo, soloAllenamento: true })
    setEditor(null)
  }

  return (
    <Card title="Solo allenamento" size="small" style={{ marginBottom: 16 }}>
      <Typography.Paragraph type="secondary">
        Ospiti occasionali, disponibili solo quando segni le presenze agli allenamenti.
      </Typography.Paragraph>
      <Button icon={<PlusOutlined aria-hidden />} onClick={() => apri()}>Aggiungi ospite</Button>
      {ospiti.items.length > 0 && (
        <List
          rowKey="id"
          dataSource={[...ospiti.items].sort((a, b) =>
            `${a.cognome} ${a.nome}`.localeCompare(`${b.cognome} ${b.nome}`, 'it'),
          )}
          renderItem={(g) => (
            <List.Item>
              <span>{g.cognome} {g.nome}</span>
              <Space>
                <Button type="text" icon={<EditOutlined />} aria-label={`Modifica ${g.nome} ${g.cognome}`} onClick={() => apri(g)} />
                <Popconfirm
                  title={`Eliminare ${g.nome} ${g.cognome}?`}
                  okText="Elimina"
                  cancelText="Annulla"
                  onConfirm={() => eliminaConUndo(ospiti, g, `${g.cognome} ${g.nome} eliminato.`)}
                >
                  <Button type="text" danger icon={<DeleteOutlined />} aria-label={`Elimina ${g.nome} ${g.cognome}`} />
                </Popconfirm>
              </Space>
            </List.Item>
          )}
        />
      )}
      <Modal
        title={editor?.id ? 'Modifica ospite' : 'Aggiungi ospite'}
        open={editor !== null}
        onCancel={() => setEditor(null)}
        onOk={() => form.submit()}
        okText={editor?.id ? 'Salva' : 'Aggiungi'}
        cancelText="Annulla"
        forceRender
      >
        <Form form={form} layout="vertical" onFinish={salva} requiredMark={false}>
          <Form.Item label="Nome" name="nome" rules={[{ required: true, whitespace: true, message: 'Inserisci il nome' }]}>
            <Input autoComplete="off" />
          </Form.Item>
          <Form.Item label="Cognome" name="cognome" rules={[{ required: true, whitespace: true, message: 'Inserisci il cognome' }]}>
            <Input autoComplete="off" />
          </Form.Item>
        </Form>
      </Modal>
    </Card>
  )
}
