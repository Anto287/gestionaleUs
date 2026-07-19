/**
 * Esporta gli impegni (partite, allenamenti, appuntamenti) in formato ICS
 * (iCalendar), importabile in Google Calendar / Apple Calendar. Gli eventi con
 * orario durano ~1h45 (partite) o 1h30; senza orario sono "tutto il giorno".
 */

export interface EventoCal {
  id: string
  /** 'YYYY-MM-DD' */
  data: string
  /** 'HH:mm' (facoltativo → evento di tutto il giorno) */
  ora?: string
  titolo: string
  luogo?: string
  descrizione?: string
  tipo: 'partita' | 'allenamento' | 'appuntamento'
}

/** Durata in minuti per tipo di evento con orario. */
const DURATA: Record<EventoCal['tipo'], number> = {
  partita: 105,
  allenamento: 90,
  appuntamento: 105,
}

function escapeIcs(s: string): string {
  return s.replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\n/g, '\\n')
}

/** '2026-09-21' → '20260921'; con ora '15:30' → '20260921T153000' */
function dtLocale(data: string, ora?: string): string {
  const d = data.replace(/-/g, '')
  if (!ora) return d
  const [h, m] = ora.split(':')
  return `${d}T${(h ?? '00').padStart(2, '0')}${(m ?? '00').padStart(2, '0')}00`
}

function aggiungiMinuti(data: string, ora: string, minuti: number): { data: string; ora: string } {
  const d = new Date(`${data}T${ora}:00`)
  d.setMinutes(d.getMinutes() + minuti)
  const pad = (n: number) => String(n).padStart(2, '0')
  return {
    data: `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`,
    ora: `${pad(d.getHours())}:${pad(d.getMinutes())}`,
  }
}

function giornoDopo(data: string): string {
  const d = new Date(`${data}T00:00:00`)
  d.setDate(d.getDate() + 1)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

/** Fuso di casa: regole standard Europe/Rome (CET/CEST). */
const VTIMEZONE = [
  'BEGIN:VTIMEZONE',
  'TZID:Europe/Rome',
  'BEGIN:DAYLIGHT',
  'TZOFFSETFROM:+0100',
  'TZOFFSETTO:+0200',
  'TZNAME:CEST',
  'DTSTART:19700329T020000',
  'RRULE:FREQ=YEARLY;BYMONTH=3;BYDAY=-1SU',
  'END:DAYLIGHT',
  'BEGIN:STANDARD',
  'TZOFFSETFROM:+0200',
  'TZOFFSETTO:+0100',
  'TZNAME:CET',
  'DTSTART:19701025T030000',
  'RRULE:FREQ=YEARLY;BYMONTH=10;BYDAY=-1SU',
  'END:STANDARD',
  'END:VTIMEZONE',
].join('\r\n')

export function generaIcs(eventi: EventoCal[], nomeCalendario: string): string {
  const stamp = new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '')
  const righe: string[] = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//US Riolunato//Gestionale//IT',
    'CALSCALE:GREGORIAN',
    `X-WR-CALNAME:${escapeIcs(nomeCalendario)}`,
    'X-WR-TIMEZONE:Europe/Rome',
    VTIMEZONE,
  ]

  for (const e of eventi) {
    righe.push('BEGIN:VEVENT')
    righe.push(`UID:${e.id}@usriolunato`)
    righe.push(`DTSTAMP:${stamp}`)
    if (e.ora) {
      const fine = aggiungiMinuti(e.data, e.ora, DURATA[e.tipo])
      righe.push(`DTSTART;TZID=Europe/Rome:${dtLocale(e.data, e.ora)}`)
      righe.push(`DTEND;TZID=Europe/Rome:${dtLocale(fine.data, fine.ora)}`)
    } else {
      righe.push(`DTSTART;VALUE=DATE:${dtLocale(e.data)}`)
      righe.push(`DTEND;VALUE=DATE:${dtLocale(giornoDopo(e.data))}`)
    }
    righe.push(`SUMMARY:${escapeIcs(e.titolo)}`)
    if (e.luogo) righe.push(`LOCATION:${escapeIcs(e.luogo)}`)
    if (e.descrizione) righe.push(`DESCRIPTION:${escapeIcs(e.descrizione)}`)
    righe.push('END:VEVENT')
  }

  righe.push('END:VCALENDAR')
  return righe.join('\r\n')
}

/** Fa scaricare il file .ics al browser. */
export function scaricaIcs(eventi: EventoCal[], nomeCalendario: string, nomeFile: string): void {
  const blob = new Blob([generaIcs(eventi, nomeCalendario)], { type: 'text/calendar;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = nomeFile
  document.body.appendChild(a)
  a.click()
  a.remove()
  URL.revokeObjectURL(url)
}
