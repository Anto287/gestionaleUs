import { useState } from 'react'
import { App, Button, Form, Input, InputNumber, Popconfirm, Select, Space } from 'antd'
import type { Allenamento } from '../../types'
import { generaProgramma } from '../../lib/programma'

export function ProgrammaSeduta({ seduta, salva }: { seduta: Allenamento; salva: (patch: Partial<Allenamento>) => void }) {
  const { message } = App.useApp()
  const [programma, setProgramma] = useState(seduta.programma || '')
  const [svolto, setSvolto] = useState(seduta.svolto || '')
  const [durata, setDurata] = useState(90)
  const [obiettivo, setObiettivo] = useState('Possesso')
  const [numero, setNumero] = useState(Math.max(4, Object.values(seduta.presenze).filter(Boolean).length || 16))
  const genera = () => setProgramma(generaProgramma(durata, numero, obiettivo))
  return <Form layout="vertical">
    <Space wrap>
      <Form.Item label="Obiettivo"><Select value={obiettivo} onChange={setObiettivo} options={['Possesso', 'Finalizzazione', 'Difesa'].map((value) => ({ value, label: value }))} style={{ width: 155 }} /></Form.Item>
      <Form.Item label="Minuti"><InputNumber min={30} max={150} value={durata} onChange={(v) => setDurata(v || 90)} /></Form.Item>
      <Form.Item label="Giocatori previsti"><InputNumber min={4} max={40} value={numero} onChange={(v) => setNumero(v || 16)} /></Form.Item>
    </Space>
    <Form.Item label="Programma di allenamento" extra="La proposta usa una libreria di esercizi, senza API o costi. Adatta carichi, spazi e gruppi alla squadra.">
      <Input.TextArea aria-label="Programma di allenamento" value={programma} onChange={(e) => setProgramma(e.target.value)} autoSize={{ minRows: 4, maxRows: 14 }} maxLength={20000} />
    </Form.Item>
    {programma ? <Popconfirm title="Sostituire il programma con una nuova proposta?" onConfirm={genera} okText="Genera" cancelText="Annulla"><Button>Genera esercizi</Button></Popconfirm> : <Button onClick={genera}>Genera esercizi</Button>}
    <Form.Item label="Attività svolta e osservazioni" style={{ marginTop: 16 }}><Input.TextArea aria-label="Attività svolta e osservazioni" value={svolto} onChange={(e) => setSvolto(e.target.value)} autoSize={{ minRows: 3 }} maxLength={20000} /></Form.Item>
    <Button type="primary" style={{ marginBottom: 24 }} onClick={() => { salva({ programma: programma.trim(), svolto: svolto.trim() }); message.success('Programma e resoconto salvati') }}>Salva programma e resoconto</Button>
  </Form>
}
