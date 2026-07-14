import { useState } from 'react'
import { Col, DatePicker, Form, Input, Row, Select, TimePicker } from 'antd'
import dayjs, { type Dayjs } from 'dayjs'
import type { Divisa, TestataDistinta, Torneo } from '../../types'

/** Ripulisce una stringa: vuota/spazi → undefined (così non finisce nel PDF). */
function pulisci(v?: string): string | undefined {
  const t = v?.trim()
  return t ? t : undefined
}

/** 'HH:mm' → orario dayjs (per il TimePicker). */
function parseOra(hhmm?: string): Dayjs | undefined {
  if (!hhmm) return undefined
  const [h, m] = hhmm.split(':').map(Number)
  if (Number.isNaN(h)) return undefined
  return dayjs().hour(h).minute(m || 0).second(0)
}

interface Valori {
  torneo?: string
  girone?: string
  coloreMaglia?: string
  colorePantaloncini?: string
  coloreCalzettoni?: string
  dataGara?: Dayjs
  oraGara?: Dayjs
  avversario?: string
  campo?: string
  orarioRitrovo?: string
}

/**
 * Form facoltativo della testata della distinta. Tutti i campi possono
 * restare vuoti: in quel caso la distinta si stampa con le righe da compilare
 * a mano. I menu a tendina di torneo e divisa compilano i campi sottostanti,
 * che restano modificabili — così una distinta ripresa si ricompila tutta.
 */
export function TestataForm({
  tornei,
  divise,
  onChange,
  initialTestata,
}: {
  tornei: Torneo[]
  divise: Divisa[]
  onChange: (t: TestataDistinta) => void
  initialTestata?: TestataDistinta
}) {
  const [form] = Form.useForm<Valori>()
  const [divisaId, setDivisaId] = useState<string | undefined>()

  const iniz: Valori = {
    torneo: initialTestata?.torneo,
    girone: initialTestata?.girone,
    coloreMaglia: initialTestata?.coloreMaglia,
    colorePantaloncini: initialTestata?.colorePantaloncini,
    coloreCalzettoni: initialTestata?.coloreCalzettoni,
    avversario: initialTestata?.avversario,
    campo: initialTestata?.campo,
    orarioRitrovo: initialTestata?.orarioRitrovo,
    dataGara: initialTestata?.dataGara ? dayjs(initialTestata.dataGara) : undefined,
    oraGara: parseOra(initialTestata?.oraGara),
  }

  function emit() {
    const v = form.getFieldsValue()
    onChange({
      coloreMaglia: pulisci(v.coloreMaglia),
      colorePantaloncini: pulisci(v.colorePantaloncini),
      coloreCalzettoni: pulisci(v.coloreCalzettoni),
      torneo: pulisci(v.torneo),
      girone: pulisci(v.girone),
      dataGara: v.dataGara ? v.dataGara.format('YYYY-MM-DD') : undefined,
      oraGara: v.oraGara ? v.oraGara.format('HH:mm') : undefined,
      orarioRitrovo: pulisci(v.orarioRitrovo),
      avversario: pulisci(v.avversario),
      campo: pulisci(v.campo),
    })
  }

  // scelto un torneo, il girone si compila da solo (resta modificabile)
  function onTorneoChange(nome?: string) {
    const t = tornei.find((x) => x.nome === nome)
    form.setFieldsValue({ girone: t?.girone })
    emit()
  }

  // scelta una divisa, i tre colori si compilano da soli (restano modificabili)
  function onDivisaChange(id?: string) {
    setDivisaId(id)
    const d = divise.find((x) => x.id === id)
    if (d)
      form.setFieldsValue({
        coloreMaglia: d.coloreMaglia,
        colorePantaloncini: d.colorePantaloncini,
        coloreCalzettoni: d.coloreCalzettoni,
      })
    emit()
  }

  return (
    <Form form={form} layout="vertical" initialValues={iniz} onValuesChange={emit} requiredMark={false}>
      <Row gutter={16}>
        <Col xs={24} sm={12}>
          <Form.Item label="Torneo" name="torneo">
            <Select
              allowClear
              showSearch
              optionFilterProp="label"
              onChange={onTorneoChange}
              placeholder={tornei.length ? 'Scegli il torneo' : 'Nessun torneo (aggiungili in Impostazioni)'}
              options={tornei.map((t) => ({
                value: t.nome,
                label: t.girone ? `${t.nome} · ${t.girone}` : t.nome,
              }))}
            />
          </Form.Item>
        </Col>
        <Col xs={24} sm={12}>
          <Form.Item label="Girone" name="girone">
            <Input placeholder="es. Girone B" />
          </Form.Item>
        </Col>
      </Row>

      <Row gutter={16}>
        <Col xs={24} sm={8}>
          <Form.Item label="Divisa (compila i colori)">
            <Select
              allowClear
              value={divisaId}
              onChange={onDivisaChange}
              placeholder={divise.length ? 'Scegli la divisa' : 'Nessuna divisa (aggiungile nel Magazzino)'}
              options={divise.map((d) => ({ value: d.id, label: d.nome }))}
            />
          </Form.Item>
        </Col>
        <Col xs={24} sm={8}>
          <Form.Item label="Colore maglia" name="coloreMaglia">
            <Input placeholder="es. Giallorossa" />
          </Form.Item>
        </Col>
        <Col xs={12} sm={4}>
          <Form.Item label="Pantaloncini" name="colorePantaloncini">
            <Input placeholder="es. Rossi" />
          </Form.Item>
        </Col>
        <Col xs={12} sm={4}>
          <Form.Item label="Calzettoni" name="coloreCalzettoni">
            <Input placeholder="es. Gialli" />
          </Form.Item>
        </Col>
      </Row>

      <Row gutter={16}>
        <Col xs={12} sm={8}>
          <Form.Item label="Data gara" name="dataGara">
            <DatePicker format="DD/MM/YYYY" style={{ width: '100%' }} placeholder="gg/mm/aaaa" />
          </Form.Item>
        </Col>
        <Col xs={12} sm={8}>
          <Form.Item label="Ora gara" name="oraGara">
            <TimePicker format="HH:mm" minuteStep={5} style={{ width: '100%' }} placeholder="hh:mm" />
          </Form.Item>
        </Col>
        <Col xs={24} sm={8}>
          <Form.Item label="Avversario" name="avversario">
            <Input placeholder="es. Polisportiva X" />
          </Form.Item>
        </Col>
      </Row>

      <Row gutter={16}>
        <Col xs={24} sm={12}>
          <Form.Item label="Campo" name="campo">
            <Input placeholder="es. Comunale di Riolunato" />
          </Form.Item>
        </Col>
        <Col xs={24} sm={12}>
          <Form.Item label="Orario ritrovo / note" name="orarioRitrovo">
            <Input placeholder="es. ritrovo ore 14:00" />
          </Form.Item>
        </Col>
      </Row>
    </Form>
  )
}
