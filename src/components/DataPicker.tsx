import { DatePicker } from 'antd'
import type { DatePickerProps } from 'antd'
import dayjs, { type Dayjs } from 'dayjs'

/**
 * DatePicker uniforme per tutta l'app: formato italiano gg/mm/aaaa e largo
 * quanto il contenitore. Dentro una <Form.Item> va abbinato a `propsCampoData`
 * (sotto), così il valore resta salvato come stringa ISO 'YYYY-MM-DD'.
 */
export function DataPicker(props: DatePickerProps) {
  return <DatePicker format="DD/MM/YYYY" style={{ width: '100%' }} placeholder="gg/mm/aaaa" {...props} />
}

/**
 * Props da spargere su una <Form.Item> che contiene un <DataPicker />:
 * convertono fra la stringa salvata ('YYYY-MM-DD') e il Dayjs che il
 * DatePicker si aspetta, così il resto del codice continua a lavorare con
 * stringhe senza sapere nulla di dayjs.
 */
export const propsCampoData = {
  getValueProps: (v?: string) => ({ value: v ? dayjs(v) : undefined }),
  normalize: (v: Dayjs | null) => (v ? v.format('YYYY-MM-DD') : undefined),
}
