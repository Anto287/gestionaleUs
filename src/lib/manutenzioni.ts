import dayjs from 'dayjs'

export interface ManutenzionePeriodica {
  id: string
  nome: string
  ultima: string
  intervallo: number
  unita: 'day' | 'week' | 'month' | 'year'
}

export function prossimaManutenzione(voce: ManutenzionePeriodica): string {
  return dayjs(voce.ultima).add(voce.intervallo, voce.unita).format('YYYY-MM-DD')
}
