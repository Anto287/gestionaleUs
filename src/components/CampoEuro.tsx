import { InputNumber, type InputNumberProps } from 'antd'

/**
 * Legge un importo scritto come viene: "12,5", "12.5", "1.200,50" o "€ 30".
 * Il campo numerico di antd, lasciato da solo, scarta la virgola: "12,5"
 * diventava 125 €.
 */
export function leggiImporto(testo?: string): string {
  const t = (testo ?? '').replace(/[^\d,.-]/g, '')
  // con la virgola il punto separa le migliaia ("1.200,50")
  return t.includes(',') ? t.replace(/\./g, '').replace(',', '.') : t
}

// il campo di antd accetta anche un testo dal parser (è quel che fa il suo di serie)
const parser = leggiImporto as unknown as (testo?: string) => number

/** Campo per gli importi in euro: virgola o punto come separatore, due decimali. */
export function CampoEuro(props: InputNumberProps<number>) {
  return (
    <InputNumber<number>
      min={0}
      step={0.01}
      precision={2}
      decimalSeparator=","
      parser={parser}
      inputMode="decimal"
      style={{ width: '100%' }}
      {...props}
    />
  )
}
