/**
 * Compilazione rapida del magazzino: da una frase scritta (o dettata) in
 * italiano — "aggiungi 4 patatine chips che scadono il 28/08/2026" — ricava
 * quantità, nome, data di scadenza e categoria. Funziona tutto in locale,
 * senza servizi esterni: è un piccolo interprete di testo, non una chiamata
 * a un'AI.
 */
import dayjs from 'dayjs'

export interface VoceCompilata {
  nome?: string
  quantita?: number
  /** ISO 'YYYY-MM-DD' */
  scadenza?: string
  categoria?: string
}

/** mesi con abbreviazioni: l'indice+1 è il numero del mese */
const MESI = [
  'gennaio',
  'febbraio',
  'marzo',
  'aprile',
  'maggio',
  'giugno',
  'luglio',
  'agosto',
  'settembre',
  'ottobre',
  'novembre',
  'dicembre',
]
// alternativa regex: nomi interi prima delle abbreviazioni, così "agosto" non lascia "sto" nel nome
const MESE_RE =
  'gennaio|gen|febbraio|feb|marzo|mar|aprile|apr|maggio|mag|giugno|giu|luglio|lug|agosto|ago|settembre|sett|set|ottobre|ott|novembre|nov|dicembre|dic'

function numeroMese(token: string): number {
  const t = token.toLowerCase()
  return MESI.findIndex((m) => m.startsWith(t.slice(0, 3))) + 1
}

/** 'YYYY-MM-DD' se giorno/mese/anno formano una data reale, altrimenti undefined */
function isoData(anno: number, mese: number, giorno: number): string | undefined {
  if (anno < 100) anno += 2000
  if (mese < 1 || mese > 12 || giorno < 1 || giorno > 31) return undefined
  const d = dayjs(new Date(anno, mese - 1, giorno))
  // new Date "normalizza" (31/04 → 01/05): se non torna uguale, la data non esiste
  if (d.date() !== giorno || d.month() !== mese - 1) return undefined
  return d.format('YYYY-MM-DD')
}

/** ultimo giorno del mese: "agosto 2026" su un prodotto vale fino a fine mese */
function fineMese(anno: number, mese: number): string | undefined {
  if (anno < 100) anno += 2000
  if (mese < 1 || mese > 12) return undefined
  return dayjs(new Date(anno, mese - 1, 1)).endOf('month').format('YYYY-MM-DD')
}

/** senza anno scritto: l'anno corrente, o il prossimo se la data è già passata */
function annoAutomatico(mese: number, giorno: number): string | undefined {
  const oggi = dayjs().startOf('day')
  const quest = isoData(oggi.year(), mese, giorno)
  if (!quest) return undefined
  return dayjs(quest).isBefore(oggi) ? isoData(oggi.year() + 1, mese, giorno) : quest
}

function fineMeseAutomatico(mese: number): string | undefined {
  const oggi = dayjs().startOf('day')
  const f = fineMese(oggi.year(), mese)
  if (!f) return undefined
  return dayjs(f).isBefore(oggi) ? fineMese(oggi.year() + 1, mese) : f
}

const NUMERI_PAROLA: Record<string, number> = {
  un: 1,
  uno: 1,
  una: 1,
  due: 2,
  tre: 3,
  quattro: 4,
  cinque: 5,
  sei: 6,
  sette: 7,
  otto: 8,
  nove: 9,
  dieci: 10,
  undici: 11,
  dodici: 12,
  tredici: 13,
  quattordici: 14,
  quindici: 15,
  sedici: 16,
  diciassette: 17,
  diciotto: 18,
  diciannove: 19,
  venti: 20,
  trenta: 30,
  quaranta: 40,
  cinquanta: 50,
  sessanta: 60,
  settanta: 70,
  ottanta: 80,
  novanta: 90,
  cento: 100,
}
// nel regex le parole più lunghe vanno prima ("settanta" prima di "sette")
const PAROLA_NUM_RE = Object.keys(NUMERI_PAROLA)
  .sort((a, b) => b.length - a.length)
  .join('|')

function daParolaONumero(token: string): number {
  const n = Number(token)
  return Number.isNaN(n) ? (NUMERI_PAROLA[token.toLowerCase()] ?? 0) : n
}

// parole che spesso precedono la data ("che scadono nel …", "scadenza: …"):
// si tolgono insieme alla data, così non restano appese nel nome
const PRIMA_DELLA_DATA =
  "(?:(?:che\\s+)?(?:scad\\w*\\.?|in\\s+scadenza|con\\s+scadenza)\\s*:?\\s*)?(?:entro\\s+il\\s+|entro\\s+|il\\s+|nel\\s+|a\\s+|ad\\s+|l')?"

/** i formati di data accettati, in ordine di priorità */
const FORMATI_DATA: { re: RegExp; iso: (m: RegExpMatchArray) => string | undefined }[] = [
  {
    // 28/08/2026, 28-8-26, 28.08.2026
    re: new RegExp(`${PRIMA_DELLA_DATA}(\\d{1,2})[/\\-.](\\d{1,2})[/\\-.](\\d{2,4})(?![\\d/])`, 'i'),
    iso: (m) => isoData(Number(m[3]), Number(m[2]), Number(m[1])),
  },
  {
    // 28 agosto 2026, 28 ago, 28 agosto (anche "1 settembre" da "primo settembre")
    re: new RegExp(`${PRIMA_DELLA_DATA}(\\d{1,2})\\s+(${MESE_RE})\\b\\.?\\s*(\\d{4}|\\d{2}\\b)?`, 'i'),
    iso: (m) =>
      m[3]
        ? isoData(Number(m[3]), numeroMese(m[2]), Number(m[1]))
        : annoAutomatico(numeroMese(m[2]), Number(m[1])),
  },
  {
    // fine agosto, a fine agosto 2027 → ultimo giorno del mese
    re: new RegExp(`${PRIMA_DELLA_DATA}fine\\s+(${MESE_RE})\\b\\.?\\s*(\\d{4}|\\d{2}\\b)?`, 'i'),
    iso: (m) => (m[2] ? fineMese(Number(m[2]), numeroMese(m[1])) : fineMeseAutomatico(numeroMese(m[1]))),
  },
  {
    // agosto 2026 → fine mese
    re: new RegExp(`${PRIMA_DELLA_DATA}(${MESE_RE})\\b\\.?\\s+(\\d{4})`, 'i'),
    iso: (m) => fineMese(Number(m[2]), numeroMese(m[1])),
  },
  {
    // 08/2026 → fine mese
    re: new RegExp(`${PRIMA_DELLA_DATA}(\\d{1,2})[/\\-.](\\d{4})(?!\\d)`, 'i'),
    iso: (m) => fineMese(Number(m[2]), Number(m[1])),
  },
  {
    // tra 3 mesi, fra due settimane, tra un anno, tra 10 giorni
    re: new RegExp(
      `${PRIMA_DELLA_DATA}(?:tra|fra)\\s+(\\d{1,3}|${PAROLA_NUM_RE})\\s+(giorn[oi]|settiman[ae]|mes[ei]|ann[oi])`,
      'i',
    ),
    iso: (m) => {
      const n = daParolaONumero(m[1])
      if (n < 1) return undefined
      const unita = m[2].toLowerCase().startsWith('giorn')
        ? 'day'
        : m[2].toLowerCase().startsWith('settiman')
          ? 'week'
          : m[2].toLowerCase().startsWith('mes')
            ? 'month'
            : 'year'
      return dayjs().add(n, unita).format('YYYY-MM-DD')
    },
  },
  {
    // domani / dopodomani
    re: new RegExp(`${PRIMA_DELLA_DATA}\\b(domani|dopodomani)\\b`, 'i'),
    iso: (m) => dayjs().add(m[1].toLowerCase() === 'domani' ? 1 : 2, 'day').format('YYYY-MM-DD'),
  },
  {
    // "scade nel 2027" (solo anno: serve la parola scadenza) → fine anno
    re: /(?:che\s+)?scad\w*\.?\s*:?\s*(?:il\s+|nel\s+|entro\s+il\s+|entro\s+|a\s+|ad\s+)?(\d{4})(?!\d)/i,
    iso: (m) => fineMese(Number(m[1]), 12),
  },
  {
    // 28/08 senza anno (non seguito da lettere: "1.5L" non è una data)
    re: new RegExp(`${PRIMA_DELLA_DATA}(\\d{1,2})[/\\-.](\\d{1,2})(?![\\dA-Za-z])`, 'i'),
    iso: (m) => annoAutomatico(Number(m[2]), Number(m[1])),
  },
]

const UNITA =
  "(?:x(?=\\s)|×|pz\\.?|pezzi|confezioni|conf\\.?|pacch[io]|pacchett[oi]|scatol[ae]|cass[ae]|flacon[ei]|tub[oi]|buste?|barattol[oi])"

/** quantità: "4 patatine", "4x", "x4", "24 pz", "due casse", "n. 6", "q.tà 3" */
const FORMATI_QUANTITA: { re: RegExp; n: (m: RegExpMatchArray) => number }[] = [
  { re: new RegExp(`^\\s*(\\d{1,4})\\s*${UNITA}\\s*(?:di\\s+|d')?`, 'i'), n: (m) => Number(m[1]) },
  { re: new RegExp(`^\\s*(\\d{1,4})(?!\\w|[.,]\\d)\\s*(?:di\\s+|d')?`, 'i'), n: (m) => Number(m[1]) },
  {
    re: new RegExp(`^\\s*(${PAROLA_NUM_RE})\\s+(?:${UNITA}\\s*)?(?:di\\s+|d')?`, 'i'),
    n: (m) => daParolaONumero(m[1]),
  },
  {
    re: new RegExp(`(?:^|\\s)(?:n|nr|num)\\.?\\s*:?\\s*(\\d{1,4})(?!\\w)`, 'i'),
    n: (m) => Number(m[1]),
  },
  {
    re: new RegExp(`(?:^|\\s)q\\.?t[àa]\\.?\\s*:?\\s*(\\d{1,4})(?!\\w)`, 'i'),
    n: (m) => Number(m[1]),
  },
  { re: /(?:^|\s)[x×]\s*(\d{1,4})(?!\w)/i, n: (m) => Number(m[1]) },
  { re: new RegExp(`\\b(\\d{1,4})\\s*${UNITA}(?!\\w)`, 'i'), n: (m) => Number(m[1]) },
  {
    re: new RegExp(`\\b(${PAROLA_NUM_RE})\\s+${UNITA}(?!\\w)`, 'i'),
    n: (m) => daParolaONumero(m[1]),
  },
]

// verbi e riempitivi di inizio frase (soprattutto quando si detta a voce)
const VERBI_INIZIO =
  /^\s*(?:aggiungi(?:amo)?|metti(?:amo)?|inserisci|registra|segna|annota|scrivi|compra(?:re|to)?|ho\s+comprato|abbiamo\s+comprato|prendi(?:amo)?|ordina(?:re|to)?|servono|serve|mancano|manca|c'è|ci\s+sono)\b[\s:]*/i
const LUOGHI_INIZIO =
  /^\s*(?:al\s+bar|al\s+magazzino|in\s+magazzino|nella\s+borsa(?:\s+medica)?|in\s+dispensa)\b[\s:]*/i

function scappa(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

/**
 * Interpreta la frase e restituisce i campi riconosciuti. `paroleCategoria`
 * (categoria → parole chiave, anche radici tipo "cioccolat") serve a
 * indovinare la categoria; la prima che compare nel testo vince.
 */
export function compilaVoce(
  testo: string,
  paroleCategoria?: Record<string, string[]>,
): VoceCompilata {
  let resto = testo
    .trim()
    // "1°/1º settembre" → "1 settembre"; "primo settembre" → "1 settembre"
    .replace(/(\d{1,2})[°º]/g, '$1')
    .replace(new RegExp(`\\bprimo\\s+(?=${MESE_RE})`, 'i'), '1 ')
    // cortesie in coda (tipiche della dettatura)
    .replace(/[\s,.!]*(grazie|per favore|per piacere)[\s,.!]*$/i, '')
  if (!resto) return {}
  const risultato: VoceCompilata = {}

  // 0) via i verbi/riempitivi di inizio frase ("aggiungi…", "al bar…")
  for (let i = 0; i < 2; i++) resto = resto.replace(VERBI_INIZIO, '').replace(LUOGHI_INIZIO, '')

  // 1) data di scadenza (via per prima: "28/08/2026" contiene numeri che
  //    sembrerebbero quantità)
  for (const f of FORMATI_DATA) {
    const m = resto.match(f.re)
    if (!m) continue
    const iso = f.iso(m)
    if (!iso) continue
    risultato.scadenza = iso
    resto = resto.replace(m[0], ' ')
    break
  }

  // 2) quantità
  for (const f of FORMATI_QUANTITA) {
    const m = resto.match(f.re)
    if (!m) continue
    const n = f.n(m)
    if (n < 1 || n > 9999) continue
    risultato.quantita = n
    resto = resto.replace(m[0], ' ')
    break
  }
  // numero "appeso" in fondo ("patatine 5"), ma non se è una misura ("palloni misura 5")
  if (risultato.quantita == null) {
    const m = resto.match(/(?:^|\s)(\d{1,4})\s*$/)
    if (m && !/(misura|taglia|mis\.?|formato|modello|numero|n°)\s+\d{1,4}\s*$/i.test(resto)) {
      const n = Number(m[1])
      if (n >= 1 && n <= 9999) {
        risultato.quantita = n
        resto = resto.replace(m[0], ' ')
      }
    }
  }

  // 3) categoria, cercando le parole chiave nella frase originale
  if (paroleCategoria) {
    const lc = testo.toLowerCase()
    for (const [categoria, parole] of Object.entries(paroleCategoria)) {
      if (parole.some((p) => new RegExp(`\\b${scappa(p.toLowerCase())}`).test(lc))) {
        risultato.categoria = categoria
        break
      }
    }
  }

  // 4) quel che resta è il nome, ripulito dai connettori rimasti appesi
  const nome = resto
    .replace(/\s{2,}/g, ' ')
    .replace(/^[\s,.;:\-–]+|[\s,.;:\-–]+$/g, '')
    .replace(/\s+(che|con|in|da|entro|per)$/i, '')
    .replace(/^(di|del|della|dei|delle|d'|il|lo|la|le|gli|i)\s+/i, '')
    .trim()
  if (nome) risultato.nome = nome.charAt(0).toUpperCase() + nome.slice(1)

  return risultato
}
