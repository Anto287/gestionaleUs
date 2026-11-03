import { Button, Drawer, Form, Input, InputNumber, Select, Space } from 'antd'
import { DataPicker, propsCampoData } from '../../components/DataPicker'
import type { ListaPersonalizzata, RigaLista } from './model'

export function EditorVoce({ lista, riga, onSave, onClose }: {
  lista: ListaPersonalizzata
  riga?: RigaLista
  onSave: (valori: RigaLista['valori']) => void
  onClose: () => void
}) {
  const [form] = Form.useForm()
  return <Drawer title={riga ? 'Modifica voce' : 'Nuova voce'} open onClose={onClose} width={520} extra={<Space><Button onClick={onClose}>Annulla</Button><Button type="primary" onClick={() => form.submit()}>Salva voce</Button></Space>}>
    <Form form={form} layout="vertical" initialValues={riga?.valori} onFinish={(values) => {
      // null esplicito permette di svuotare un valore anche dopo il salvataggio JSON.
      onSave(Object.fromEntries(lista.campi.map((c) => [c.id, values[c.id] ?? null])))
    }}>
      {lista.campi.map((c) => {
        const precedente = riga?.valori[c.id]
        const opzioni = c.tipo === 'scelta' && typeof precedente === 'string' && precedente && !c.opzioni.includes(precedente) ? [...c.opzioni, precedente] : c.opzioni
        return <Form.Item key={c.id} name={c.id} label={c.nome} rules={[{ type: c.tipo === 'booleano' ? 'boolean' : c.tipo === 'numero' ? 'number' : 'string', required: c.obbligatorio, whitespace: c.tipo === 'testo' || c.tipo === 'note', message: `Compila «${c.nome}»` }]} {...(c.tipo === 'data' ? propsCampoData : c.tipo === 'booleano' ? { getValueProps: (v: boolean | null | undefined) => ({ value: v === true ? 'si' : v === false ? 'no' : undefined }), normalize: (v: string | undefined) => v === 'si' ? true : v === 'no' ? false : null } : {})}>
          {c.tipo === 'numero' ? <InputNumber aria-label={c.nome} style={{ width: '100%' }} /> :
            c.tipo === 'data' ? <DataPicker aria-label={c.nome} /> :
            c.tipo === 'booleano' ? <Select aria-label={c.nome} allowClear placeholder="Non indicato" options={[{ value: 'si', label: 'Sì' }, { value: 'no', label: 'No' }]} /> :
            c.tipo === 'scelta' ? <Select aria-label={c.nome} allowClear options={opzioni.map((value) => ({ value, label: value }))} /> :
            c.tipo === 'note' ? <Input.TextArea aria-label={c.nome} autoSize={{ minRows: 3, maxRows: 8 }} /> : <Input aria-label={c.nome} />}
        </Form.Item>
      })}
    </Form>
  </Drawer>
}
