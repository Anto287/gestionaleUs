import { useMemo, useState } from 'react'
import { App, Button, Checkbox, Input, InputNumber, Modal, Space, Typography } from 'antd'
import { CopyOutlined } from '@ant-design/icons'
import { formatData } from '../../lib/format'
import { giorniAllaScadenza } from '../../lib/scadenza'
import { sottoScorta } from '../../lib/scorta'
import type { VoceMagazzino } from '../../types'

const { Text } = Typography

/** Voce senza categoria: opzione a parte nel filtro. */
const SENZA = '__senza__'

/**
 * "Copia lista": trasforma l'inventario in un elenco di testo da incollare in
 * chat (- Nome ×quantità (scade …)), con i suoi filtri: categorie, scadenza,
 * roba da riordinare. Riusato da tutte le sezioni del magazzino.
 */
export function CopiaLista({
  items,
  categorie,
  conQuantita,
  conScadenza,
}: {
  items: VoceMagazzino[]
  categorie?: string[]
  conQuantita?: boolean
  conScadenza?: boolean
}) {
  const { message } = App.useApp()
  const [aperto, setAperto] = useState(false)
  const [catScelte, setCatScelte] = useState<string[]>([])
  const [soloConScadenza, setSoloConScadenza] = useState(false)
  const [entroGiorni, setEntroGiorni] = useState<number | null>(null)
  const [soloDaRiordinare, setSoloDaRiordinare] = useState(false)

  // le opzioni vengono dalle categorie davvero usate (comprese quelle vecchie
  // non più in configurazione), nell'ordine della configurazione
  const opzioniCategorie = useMemo(() => {
    if (!categorie) return []
    const presenti = new Set(
      items.map((a) => a.categoria).filter((c): c is string => !!c),
    )
    const ordinate = [
      ...categorie.filter((c) => presenti.has(c)),
      ...[...presenti].filter((c) => !categorie.includes(c)).sort(),
    ]
    const opts = ordinate.map((c) => ({ value: c, label: c }))
    if (items.some((a) => !a.categoria)) opts.push({ value: SENZA, label: 'Senza categoria' })
    return opts
  }, [categorie, items])

  function apri() {
    setCatScelte(opzioniCategorie.map((o) => o.value))
    setSoloConScadenza(false)
    setEntroGiorni(null)
    setSoloDaRiordinare(false)
    setAperto(true)
  }

  const selezionati = useMemo(
    () =>
      items.filter((a) => {
        if (opzioniCategorie.length > 0 && !catScelte.includes(a.categoria || SENZA)) return false
        if (conScadenza && soloConScadenza && !a.scadenza) return false
        if (conScadenza && entroGiorni != null) {
          const g = giorniAllaScadenza(a.scadenza)
          if (g == null || g > entroGiorni) return false
        }
        if (conQuantita && soloDaRiordinare && (a.quantita ?? 0) > 0 && !sottoScorta(a)) return false
        return true
      }),
    [items, opzioniCategorie, catScelte, soloConScadenza, entroGiorni, soloDaRiordinare, conQuantita, conScadenza],
  )

  const testo = useMemo(
    () =>
      selezionati
        .map((a) => {
          let riga = `- ${a.nome}`
          if (conQuantita && a.quantita != null) riga += ` ×${a.quantita}`
          if (conScadenza && a.scadenza) riga += ` (scade ${formatData(a.scadenza, true)})`
          return riga
        })
        .join('\n'),
    [selezionati, conQuantita, conScadenza],
  )

  async function copia() {
    try {
      await navigator.clipboard.writeText(testo)
      message.success('Lista copiata: incollala pure in chat.')
      setAperto(false)
    } catch {
      message.warning("Non riesco a copiare da solo: seleziona il testo dell'anteprima e copia a mano.")
    }
  }

  return (
    <>
      <Button icon={<CopyOutlined />} onClick={apri}>
        Copia lista
      </Button>
      <Modal
        title="Copia la lista come testo"
        open={aperto}
        onCancel={() => setAperto(false)}
        okText={`Copia (${selezionati.length})`}
        okButtonProps={{ icon: <CopyOutlined />, disabled: selezionati.length === 0 }}
        onOk={copia}
        cancelText="Annulla"
      >
        <Space direction="vertical" size={12} style={{ width: '100%' }}>
          {opzioniCategorie.length > 0 && (
            <div>
              <Text strong style={{ display: 'block', marginBottom: 6 }}>
                Categorie
              </Text>
              <Checkbox.Group
                options={opzioniCategorie}
                value={catScelte}
                onChange={(v) => setCatScelte(v as string[])}
              />
            </div>
          )}
          {(conScadenza || conQuantita) && (
            <Space size={[16, 8]} wrap>
              {conScadenza && (
                <Checkbox
                  checked={soloConScadenza}
                  onChange={(e) => setSoloConScadenza(e.target.checked)}
                >
                  Solo con scadenza
                </Checkbox>
              )}
              {conScadenza && (
                <InputNumber
                  min={0}
                  value={entroGiorni}
                  onChange={setEntroGiorni}
                  placeholder="Scade entro…"
                  addonAfter="gg"
                  style={{ width: 170 }}
                />
              )}
              {conQuantita && (
                <Checkbox
                  checked={soloDaRiordinare}
                  onChange={(e) => setSoloDaRiordinare(e.target.checked)}
                >
                  Solo da riordinare (esauriti o sotto scorta)
                </Checkbox>
              )}
            </Space>
          )}
          <div>
            <Text strong style={{ display: 'block', marginBottom: 6 }}>
              Anteprima ({selezionati.length})
            </Text>
            {selezionati.length === 0 ? (
              <Text type="secondary">Nessuna voce con questi filtri.</Text>
            ) : (
              <Input.TextArea
                readOnly
                value={testo}
                autoSize={{ minRows: 4, maxRows: 12 }}
                style={{ fontSize: 13 }}
              />
            )}
          </div>
        </Space>
      </Modal>
    </>
  )
}
