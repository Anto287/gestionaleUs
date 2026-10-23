import { useEffect, useMemo, useState } from 'react'
import {
  Alert,
  App,
  Button,
  Checkbox,
  Col,
  Input,
  Modal,
  Row,
  Select,
  Space,
  Typography,
} from 'antd'
import { FilePdfOutlined, PrinterOutlined } from '@ant-design/icons'
import { CampoEuro } from '../../components/CampoEuro'
import { DataPicker, propsCampoData } from '../../components/DataPicker'
import { AnteprimaPdf } from '../../components/AnteprimaPdf'
import {
  filtraMovimento,
  totaliReport,
  type FiltriConti,
} from '../../lib/contiReport'
import { formatEuro, oggiIso } from '../../lib/format'
import type { Movimento } from '../../types'

export function EsportaConti({
  items,
  iniziali,
  onClose,
}: {
  items: Movimento[]
  iniziali: FiltriConti
  onClose: () => void
}) {
  const [filtri, setFiltri] = useState(iniziali)
  const [pdf, setPdf] = useState<{
    base64: string
    url: string
    nome: string
  } | null>(null)
  const [generando, setGenerando] = useState(false)
  const { message } = App.useApp()
  const imposta = <K extends keyof FiltriConti>(k: K, v: FiltriConti[K]) =>
    setFiltri((f) => ({ ...f, [k]: v }))
  const selezione = useMemo(
    () => items.filter((m) => filtraMovimento(m, filtri)),
    [items, filtri],
  )
  const totali = totaliReport(selezione)
  const periodoErrato = !!(filtri.da && filtri.a && filtri.da > filtri.a)
  const categorie = [
    ...new Set(
      items.map((m) => m.categoria?.trim()).filter(Boolean) as string[],
    ),
  ]
  const controparti = [
    ...new Set(
      items.map((m) => m.controparte?.trim()).filter(Boolean) as string[],
    ),
  ]
  const opzioni = (valori: string[]) =>
    valori
      .sort((a, b) => a.localeCompare(b))
      .map((v) => ({ value: v, label: v }))
  useEffect(
    () => () => {
      if (pdf) URL.revokeObjectURL(pdf.url)
    },
    [pdf],
  )
  async function genera() {
    setGenerando(true)
    try {
      const { creaReportPdf } = await import('./reportPdf')
      const doc = creaReportPdf(selezione, filtri)
      const base64 = doc.output('datauristring').split(',')[1] ?? ''
      setPdf({
        base64,
        url: URL.createObjectURL(doc.output('blob')),
        nome: `conti-${oggiIso()}.pdf`,
      })
    } catch {
      message.error('Non riesco a generare il PDF. Riprova.')
    } finally {
      setGenerando(false)
    }
  }
  return (
    <Modal
      open
      className="conti-report-modal"
      title={pdf ? 'Anteprima PDF dei conti' : 'Esporta conti in PDF'}
      width={pdf ? 850 : 680}
      onCancel={onClose}
      maskClosable={false}
      footer={
        pdf ? (
          <Space wrap>
            <Button onClick={() => setPdf(null)}>Modifica filtri</Button>
            <Button
              icon={<PrinterOutlined />}
              href={pdf.url}
              target="_blank"
              rel="noopener noreferrer"
            >
              Apri / stampa
            </Button>
            <Button type="primary" href={pdf.url} download={pdf.nome}>
              Scarica PDF
            </Button>
          </Space>
        ) : (
          <Space wrap>
            <Button onClick={() => setFiltri({})}>Azzera filtri</Button>
            <Button onClick={onClose}>Annulla</Button>
            <Button
              type="primary"
              icon={<FilePdfOutlined />}
              disabled={!selezione.length || periodoErrato}
              loading={generando}
              onClick={genera}
            >
              Genera PDF
            </Button>
          </Space>
        )
      }
    >
      {pdf ? (
        <AnteprimaPdf
          base64={pdf.base64}
          onErrore={() =>
            message.warning('Usa Apri / stampa per visualizzare il PDF.')
          }
        />
      ) : (
        <>
          <Typography.Paragraph type="secondary">
            Parto dai filtri della lista. Puoi cambiarli qui prima di creare il
            prospetto.
          </Typography.Paragraph>
          <div className="report-filtri">
            <label>
              Ricerca
              <Input
                value={filtri.q}
                allowClear
                placeholder="Descrizione o controparte"
                onChange={(e) => imposta('q', e.target.value)}
              />
            </label>
            <Row gutter={[16, 12]}>
              <Col xs={24} sm={12}>
                <label>
                  Dal
                  <DataPicker
                    value={propsCampoData.getValueProps(filtri.da).value}
                    onChange={(v) => imposta('da', v?.format('YYYY-MM-DD'))}
                  />
                </label>
              </Col>
              <Col xs={24} sm={12}>
                <label>
                  Al
                  <DataPicker
                    value={propsCampoData.getValueProps(filtri.a).value}
                    onChange={(v) => imposta('a', v?.format('YYYY-MM-DD'))}
                  />
                </label>
              </Col>
              <Col xs={24} sm={12}>
                <label>
                  Tipo
                  <Select
                    allowClear
                    placeholder="Entrate e uscite"
                    value={filtri.tipo}
                    onChange={(v) => imposta('tipo', v)}
                    options={opzioni(['entrata', 'uscita'])}
                  />
                </label>
              </Col>
              <Col xs={24} sm={12}>
                <label>
                  Stato
                  <Select
                    allowClear
                    placeholder="Qualsiasi"
                    value={filtri.stato}
                    onChange={(v) => imposta('stato', v)}
                    options={[
                      { value: 'saldato', label: 'Saldati' },
                      { value: 'aperto', label: 'Da saldare' },
                    ]}
                  />
                </label>
              </Col>
              <Col xs={24} sm={12}>
                <label>
                  Categoria
                  <Select
                    allowClear
                    showSearch
                    placeholder="Tutte"
                    value={filtri.categoria}
                    onChange={(v) => imposta('categoria', v)}
                    options={opzioni([...categorie, 'Senza categoria'])}
                  />
                </label>
              </Col>
              <Col xs={24} sm={12}>
                <label>
                  Controparte
                  <Select
                    allowClear
                    showSearch
                    placeholder="Tutte"
                    value={filtri.controparte}
                    onChange={(v) => imposta('controparte', v)}
                    options={opzioni(controparti)}
                  />
                </label>
              </Col>
              <Col xs={24} sm={12}>
                <label>
                  Anno
                  <Select
                    allowClear
                    placeholder="Tutti"
                    value={filtri.anno}
                    onChange={(v) => {
                      imposta('anno', v)
                      imposta('mese', undefined)
                    }}
                    options={opzioni([
                      ...new Set(items.map((m) => m.data.slice(0, 4))),
                    ])}
                  />
                </label>
              </Col>
              <Col xs={24} sm={12}>
                <label>
                  Mese
                  <Select
                    allowClear
                    placeholder="Tutti"
                    value={filtri.mese}
                    onChange={(v) => imposta('mese', v)}
                    options={opzioni([
                      ...new Set(
                        items
                          .filter(
                            (m) =>
                              !filtri.anno || m.data.startsWith(filtri.anno),
                          )
                          .map((m) => m.data.slice(0, 7)),
                      ),
                    ])}
                  />
                </label>
              </Col>
            </Row>
            <label>
              Importo
              <Space.Compact style={{ width: '100%' }}>
                <Select
                  aria-label="Confronto importo"
                  value={filtri.importoOp ?? 'maggiore'}
                  onChange={(v) => imposta('importoOp', v)}
                  style={{ width: 130 }}
                  options={[
                    { value: 'maggiore', label: 'Minimo ≥' },
                    { value: 'minore', label: 'Massimo ≤' },
                  ]}
                />
                <CampoEuro
                  value={filtri.importo}
                  onChange={(v) => imposta('importo', v)}
                />
              </Space.Compact>
            </label>
            <Checkbox
              checked={filtri.allegati}
              onChange={(e) => imposta('allegati', e.target.checked)}
            >
              Solo movimenti con ricevute
            </Checkbox>
            {periodoErrato && (
              <Alert
                type="error"
                message="La data iniziale deve precedere quella finale."
              />
            )}
            <Alert
              type={selezione.length ? 'info' : 'warning'}
              showIcon
              message={`${selezione.length} movimenti selezionati`}
              description={
                <>
                  <div>
                    Entrate saldate {formatEuro(totali.entrate)} · Uscite
                    saldate {formatEuro(totali.uscite)}
                  </div>
                  <div>
                    Netto selezione {formatEuro(totali.netto)} · Da incassare{' '}
                    {formatEuro(totali.daIncassare)} · Da pagare{' '}
                    {formatEuro(totali.daPagare)}
                  </div>
                </>
              }
            />
          </div>
        </>
      )}
    </Modal>
  )
}
