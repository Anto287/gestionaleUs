/**
 * Dal testo letto (OCR) sulla foto di un documento ai campi del tesserato.
 *
 * Il testo che arriva dal riconoscimento è sporco: lettere al posto di
 * cifre (O/0, I/1, S/5), etichette spezzate, righe fuori ordine. Qui si
 * cerca di cavarne il massimo con regole semplici, ma ogni campo va
 * comunque fatto controllare a chi scansiona: il modale mostra i valori in
 * un modulo modificabile prima di salvare.
 *
 * Tre tipi di documento:
 * - carta d'identità: la CIE ha sul retro il codice MRZ (le 3 righe con i
 *   "<<<"), che porta cifre di controllo ed è la lettura più affidabile; in
 *   mancanza si leggono le etichette del fronte (COGNOME, NOME, SCADENZA…),
 *   che valgono anche per la vecchia carta di carta;
 * - patente: campi numerati (1. cognome, 2. nome, 3. nascita, 4b. scadenza,
 *   5. numero), date con l'anno a due cifre;
 * - visita medica sportiva: testo libero, interessa la scadenza (o, se non
 *   è scritta, la data della visita + un anno).
 */

import { parole } from './archivio'
import { isoDa } from './format'

export type TipoDocumento = 'visita' | 'identita' | 'patente'

export interface DatiLetti {
  nome?: string
  cognome?: string
  /** 'YYYY-MM-DD' */
  nascita?: string
  documento?: string
  /** 'YYYY-MM-DD' */
  scadenzaDocumento?: string
  /** 'YYYY-MM-DD' */
  scadenzaCertificato?: string
  /** solo visita: la data della visita, se trovata (serve a dedurre la scadenza) */
  dataVisita?: string
  /** campi ricavati per deduzione invece che letti (es. scadenza = visita + 1 anno) */
  dedotti: (keyof DatiLetti)[]
  /** la lettura viene dal codice MRZ con le cifre di controllo giuste */
  mrzValido?: boolean
}

// ---------- date ----------

const ANNO_OGGI = new Date().getFullYear()

/** Una data vera del calendario (niente 31/02), in 'YYYY-MM-DD'. */
function dataValida(a: number, m: number, g: number): string | undefined {
  if (m < 1 || m > 12 || g < 1 || g > 31) return undefined
  const d = new Date(a, m - 1, g)
  if (d.getFullYear() !== a || d.getMonth() !== m - 1 || d.getDate() !== g) return undefined
  return isoDa(d)
}

/**
 * Anno a due cifre: per una nascita è nel passato (90 → 1990, 08 → 2008),
 * per una scadenza o un rilascio è dal 2000 in poi.
 */
function annoPieno(aa: number, tipo: 'nascita' | 'futura'): number {
  if (tipo === 'futura') return 2000 + aa
  return 2000 + aa > ANNO_OGGI ? 1900 + aa : 2000 + aa
}

/** Rimette le cifre dove l'OCR ha visto lettere simili, solo accanto ad altre cifre. */
function cifreDaLettere(testo: string): string {
  const mappa: Record<string, string> = { O: '0', o: '0', D: '0', Q: '0', I: '1', l: '1', '|': '1', S: '5', B: '8', Z: '2' }
  let t = testo
  // due passate: "1O.O5" ha lettere in fila
  for (let i = 0; i < 2; i++)
    t = t.replace(/(?<=\d)[OoDQIl|SBZ]|[OoDQIl|SBZ](?=\d)/g, (c) => mappa[c] ?? c)
  return t
}

export interface DataTrovata {
  iso: string
  /** posizione nel testo, per capire a quale etichetta è vicina */
  pos: number
  /** era scritta con l'anno a due cifre */
  breve: boolean
}

/** Tutte le date nel testo: 12/05/1999, 12.05.99, 12-5-1999, 12 05 1999. */
export function trovaDate(testo: string, annoBreve: 'nascita' | 'futura' = 'futura'): DataTrovata[] {
  const t = cifreDaLettere(testo)
  const re = /(?<!\d)(\d{1,2})\s?[./\-\s]\s?(\d{1,2})\s?[./\-\s]\s?(\d{4}|\d{2})(?!\d)/g
  const out: DataTrovata[] = []
  for (const m of t.matchAll(re)) {
    const breve = m[3].length === 2
    const anno = breve ? annoPieno(+m[3], annoBreve) : +m[3]
    if (anno < 1900 || anno > ANNO_OGGI + 30) continue
    const iso = dataValida(anno, +m[2], +m[1])
    if (iso) out.push({ iso, pos: m.index ?? 0, breve })
  }
  return out
}

/**
 * La data scritta dopo una delle etichette (entro `raggio` caratteri): la
 * più vicina, oppure con `piuTarda` la più lontana nel tempo fra quelle nel
 * raggio — sulla CIE "EMISSIONE / SCADENZA" stanno sulla stessa riga e le
 * due date sotto, la scadenza è la seconda.
 */
function dataDopo(
  testo: string,
  etichetta: RegExp,
  date: DataTrovata[],
  raggio = 90,
  piuTarda = false,
): DataTrovata | undefined {
  let migliore: DataTrovata | undefined
  let distanza = Infinity
  for (const m of testo.matchAll(new RegExp(etichetta.source, 'gi'))) {
    const fine = (m.index ?? 0) + m[0].length
    for (const d of date) {
      const dist = d.pos - fine
      if (dist < -2 || dist > raggio) continue
      if (piuTarda ? !migliore || d.iso > migliore.iso : dist < distanza) {
        migliore = d
        distanza = dist
      }
    }
  }
  return migliore
}

function piuUnAnno(iso: string): string {
  const [a, m, g] = iso.split('-').map(Number)
  // 29/02 + un anno → 28/02
  return dataValida(a + 1, m, g) ?? dataValida(a + 1, m, g - 1)!
}

const OGGI = () => isoDa(new Date())

// ---------- nomi ----------

/** "ROSSI" → "Rossi", "DE LUCA" → "De Luca", "D'AMICO" → "D'Amico". */
export function maiuscoleNome(testo: string): string {
  return testo
    .toLowerCase()
    .replace(/(^|[\s'’-])(\p{L})/gu, (_, sep: string, l: string) => sep + l.toUpperCase())
    .trim()
}

/** Ripulisce un nome letto: solo lettere, apostrofi e spazi; via le etichette inglesi rimaste attaccate. */
function pulisciNome(testo: string): string | undefined {
  const t = testo
    .replace(/\b(SURNAME|NAME|NOME|COGNOME|GIVEN|NAMES?)\b/gi, ' ')
    .replace(/[^\p{L}'’\s]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim()
  // almeno due lettere, e non una riga di sole parole di una lettera (rumore)
  if (t.replace(/[^\p{L}]/gu, '').length < 2) return undefined
  return maiuscoleNome(t)
}

const righe = (testo: string) =>
  testo
    .split(/\r?\n/)
    .map((r) => r.trim())
    .filter(Boolean)

/**
 * Il valore di un campo con etichetta: il resto della riga dopo l'etichetta,
 * o la riga successiva (la CIE stampa "COGNOME / SURNAME" sopra il valore).
 */
function valoreEtichetta(elenco: string[], etichetta: RegExp, non?: RegExp): string | undefined {
  for (let i = 0; i < elenco.length; i++) {
    const r = elenco[i]
    const m = r.match(etichetta)
    if (!m || (non && non.test(r))) continue
    const resto = r.slice((m.index ?? 0) + m[0].length).replace(/^[\s/:.,-]*(SURNAME|NAME|GIVEN NAMES?)?[\s/:.,-]*/i, '')
    const sulPosto = pulisciNome(resto)
    if (sulPosto) return sulPosto
    for (let j = i + 1; j < Math.min(i + 3, elenco.length); j++) {
      // la riga dopo non deve essere a sua volta un'etichetta
      if (/COGNOME|SURNAME|NASCITA|BIRTH|SESSO|SEX|CITTADIN|NATIONALITY|SCADENZA|EXPIRY|EMISSIONE|ISSUE|STATURA|HEIGHT|\bNOME\b|\bNAME\b/i.test(elenco[j]))
        continue
      const dopo = pulisciNome(elenco[j])
      if (dopo) return dopo
    }
  }
  return undefined
}

// ---------- MRZ (retro della CIE e dei documenti "da viaggio") ----------

const PESI = [7, 3, 1]

function valoreMrz(c: string): number {
  if (/\d/.test(c)) return +c
  if (c === '<') return 0
  return c.charCodeAt(0) - 55 // A=10 … Z=35
}

function cifraControllo(campo: string): number {
  let somma = 0
  for (let i = 0; i < campo.length; i++) somma += valoreMrz(campo[i]) * PESI[i % 3]
  return somma % 10
}

/** Una riga candidata MRZ: maiuscole, i "<" che l'OCR rende in mille modi, niente spazi. */
function rigaMrz(r: string): string {
  return r
    .replace(/g/g, '9')
    .toUpperCase()
    .replace(/[«‹]/g, '<<')
    .replace(/[\s»›]/g, '')
    .replace(/[^A-Z0-9<]/g, '<')
}

/** Nei campi solo numerici dell'MRZ: lettere che somigliano a cifre. */
function soloCifre(s: string): string {
  return s.replace(/[OQD]/g, '0').replace(/[IL]/g, '1').replace(/Z/g, '2').replace(/S/g, '5').replace(/B/g, '8').replace(/G/g, '6')
}

/** Cosa può esserci davvero al posto di un carattere letto, in un punto dove va una cifra. */
const ALTERNATIVE: Record<string, string> = {
  B: '8356', S: '58', G: '69', O: '0', D: '0', Q: '0', I: '1', L: '1', Z: '2', T: '7', A: '4',
  '8': '8356', '5': '568', '6': '658', '3': '38', '0': '08', '1': '17', '7': '71',
}
/** …e dove va una lettera (le ultime due del numero CIE). */
const LETTERE: Record<string, string> = { '8': 'B', '0': 'O', '1': 'I', '5': 'S', '2': 'Z', '6': 'G', '4': 'A', '7': 'T' }

/**
 * Corregge un campo dell'MRZ con la sua cifra di controllo. `schema` dice
 * cosa va in ogni posizione: N cifra, A lettera, * qualunque. Fra tutte le
 * letture plausibili (B al posto di 8, 5 al posto di 6…) tiene quella che
 * torna col controllo cambiando meno caratteri; se due diverse tornano
 * entrambe col minimo dei cambi non si sceglie a caso: si restituisce null.
 */
function correggiConControllo(
  campo: string,
  ctrl: string,
  schema: string,
  valida: (s: string) => boolean = () => true,
): string | null {
  // la lettura "ovvia" (B→8 dove va una cifra, 8→B dove va una lettera) non costa nulla
  const ovvie = [...campo].map((c, i) =>
    schema[i] === 'N' ? soloCifre(c) : schema[i] === 'A' ? LETTERE[c] ?? c : c,
  )
  const opzioni = ovvie.map((c, i) => (schema[i] === 'N' ? [...new Set([c, ...(ALTERNATIVE[campo[i]] ?? '')])].join('') : c))
  const ctrlOvvio = soloCifre(ctrl)
  const opzioniCtrl = [...new Set([ctrlOvvio, ...(ALTERNATIVE[ctrl] ?? '')])].join('')
  // troppe combinazioni = lettura troppo sporca per fidarsi
  if (opzioni.reduce((n, o) => n * o.length, opzioniCtrl.length) > 20000) return null
  let migliori: string[] = []
  let cambiMin = Infinity
  const prova = (i: number, pezzo: string, cambi: number) => {
    if (cambi > cambiMin) return
    if (i === campo.length) {
      const atteso = String(cifraControllo(pezzo))
      if (!opzioniCtrl.includes(atteso) || !valida(pezzo)) return
      const tot = cambi + (atteso === ctrlOvvio ? 0 : 1)
      if (tot < cambiMin) {
        cambiMin = tot
        migliori = [pezzo]
      } else if (tot === cambiMin && !migliori.includes(pezzo)) migliori.push(pezzo)
      return
    }
    for (const c of opzioni[i]) prova(i + 1, pezzo + c, cambi + (c === ovvie[i] ? 0 : 1))
  }
  prova(0, '', 0)
  return migliori.length === 1 ? migliori[0] : null
}

/** "YYMMDD" che sia una data vera. */
const dataMrzValida = (tipo: 'nascita' | 'futura') => (s: string) =>
  !!dataValida(annoPieno(+s.slice(0, 2), tipo), +s.slice(2, 4), +s.slice(4, 6))

interface Mrz {
  documento?: string
  nascita?: string
  scadenza?: string
  cognome?: string
  nome?: string
  valido: boolean
}

/**
 * Legge l'MRZ a tre righe (formato TD1, quello delle carte d'identità):
 *   C<ITACA00000AA4<<<<<<<<<<<<<<<
 *   9001017M3101012ITA<<<<<<<<<<<0
 *   ROSSI<<MARIO<<<<<<<<<<<<<<<<<<
 */
export function leggiMrz(testo: string): Mrz | null {
  const candidate = righe(testo)
    .map(rigaMrz)
    .filter((r) => r.length >= 20 && (r.match(/</g)?.length ?? 0) >= 2)
  let r1: string | undefined
  let r2: string | undefined
  let r3: string | undefined
  for (const r of candidate) {
    if (!r1 && /^[CI1][A-Z<]ITA/.test(r)) r1 = r
    else if (!r2 && /^[\dOQDILZSBG]{6}.[MF<].{7}ITA/.test(r)) r2 = r
    else if (!r3 && /^[A-Z]+(<[A-Z]+)*<<[A-Z]/.test(r) && !/\d/.test(r)) r3 = r
  }
  if (!r1 && !r2 && !r3) return null

  const out: Mrz = { valido: true }
  if (r1) {
    const grezzo = r1.slice(5, 14)
    const ctrl = r1[14] ?? ''
    // numero CIE: due lettere, cinque cifre, due lettere (CA00000AA)
    const corretto = correggiConControllo(grezzo, ctrl, 'AANNNNNAA')
    const doc = (corretto ?? grezzo).replace(/</g, '')
    if (doc.length >= 7) {
      out.documento = doc
      if (!corretto) out.valido = false
    }
  }
  if (r2) {
    const nas = correggiConControllo(r2.slice(0, 6), r2[6], 'NNNNNN', dataMrzValida('nascita'))
    const scad = correggiConControllo(r2.slice(8, 14), r2[14] ?? '', 'NNNNNN', dataMrzValida('futura'))
    if (!nas || !scad) out.valido = false
    const n = nas ?? soloCifre(r2.slice(0, 6))
    const sc = scad ?? soloCifre(r2.slice(8, 14))
    out.nascita = dataValida(annoPieno(+n.slice(0, 2), 'nascita'), +n.slice(2, 4), +n.slice(4, 6))
    out.scadenza = dataValida(annoPieno(+sc.slice(0, 2), 'futura'), +sc.slice(2, 4), +sc.slice(4, 6))
  } else out.valido = false
  if (r3) {
    const [cogn, ...resto] = r3.split('<<')
    const nome = resto.join(' ').replace(/</g, ' ').trim()
    out.cognome = cogn ? maiuscoleNome(cogn.replace(/</g, ' ')) : undefined
    out.nome = nome ? maiuscoleNome(nome) : undefined
  }
  return out
}

// ---------- numeri di documento ----------

/** CIE: CA00000AA · carta di carta: AA1234567 / AA 1234567. */
function numeroCartaIdentita(testo: string): string | undefined {
  const t = testo.toUpperCase()
  const cie = t.match(/\b([A-Z]{2})\s?([0-9OIS]{5})\s?([A-Z]{2})\b/)
  // almeno tre cifre vere: "CA0OS1AB" sì, una parola come "ROSSI" no
  const cifreVere = (s: string) => (s.match(/\d/g)?.length ?? 0) >= 3
  if (cie && cifreVere(cie[2])) return cie[1] + soloCifre(cie[2]) + cie[3]
  const carta = t.match(/\b([A-Z]{2})\s?([0-9OIS]{7})\b/)
  if (carta && cifreVere(carta[2])) return carta[1] + soloCifre(carta[2])
  return undefined
}

// ---------- i tre documenti ----------

export function leggiCartaIdentita(testo: string): DatiLetti {
  const out: DatiLetti = { dedotti: [] }
  const mrz = leggiMrz(testo)
  if (mrz) {
    Object.assign(out, {
      nome: mrz.nome,
      cognome: mrz.cognome,
      nascita: mrz.nascita,
      documento: mrz.documento,
      scadenzaDocumento: mrz.scadenza,
      mrzValido: mrz.valido,
    })
  }

  const elenco = righe(testo)
  out.cognome ??= valoreEtichetta(elenco, /COGNOME|SURNAME/i)
  out.nome ??= valoreEtichetta(elenco, /(?<!COG)\bNOME\b|(?<!SUR)\bNAME\b/i, /COGNOME|SURNAME/i)

  const date = trovaDate(testo, 'nascita')
  out.nascita ??= dataDopo(testo, /NASCITA|BIRTH|NAT[OA]\s+IL/, date, 120)?.iso
  out.scadenzaDocumento ??= dataDopo(testo, /SCADENZA|EXPIRY|VALIDA\s+FINO/, date, 90, true)?.iso
  out.documento ??= numeroCartaIdentita(testo.replace(/^.*(<<).*$/gm, ''))

  // senza etichette leggibili: la data più vecchia è la nascita, la più lontana nel futuro la scadenza
  const ordinate = [...new Set(date.map((d) => d.iso))].sort()
  if (!out.nascita) {
    const vecchia = ordinate.find((d) => d < `${ANNO_OGGI - 5}`)
    if (vecchia) {
      out.nascita = vecchia
      out.dedotti.push('nascita')
    }
  }
  if (!out.scadenzaDocumento) {
    const futura = ordinate.filter((d) => d > OGGI()).pop()
    if (futura) {
      out.scadenzaDocumento = futura
      out.dedotti.push('scadenzaDocumento')
    }
  }
  return out
}

/** Le righe della patente che cominciano col numero del campo: "4b. 01/01/2030". */
function campoPatente(elenco: string[], numero: string): string | undefined {
  const re = new RegExp(`^\\W{0,2}${numero}\\s*[.,:;]\\s*(.+)$`, 'i')
  for (const r of elenco) {
    const m = r.match(re)
    if (m) return m[1].trim()
  }
  // l'OCR a volte stacca il numero ("4b" e la data su due colonne): cerca anche a metà riga
  const dentro = new RegExp(`(?:^|\\s)${numero}\\s*[.,:;]\\s*(\\S.+)$`, 'i')
  for (const r of elenco) {
    const m = r.match(dentro)
    if (m) return m[1].trim()
  }
  return undefined
}

export function leggiPatente(testo: string): DatiLetti {
  const out: DatiLetti = { dedotti: [] }
  const elenco = righe(testo)

  const c1 = campoPatente(elenco, '1')
  const c2 = campoPatente(elenco, '2')
  if (c1) out.cognome = pulisciNome(c1)
  if (c2) out.nome = pulisciNome(c2)

  const c3 = campoPatente(elenco, '3')
  if (c3) out.nascita = trovaDate(c3, 'nascita')[0]?.iso
  const c4b = campoPatente(elenco, '4\\s?[bB8]')
  if (c4b) out.scadenzaDocumento = trovaDate(c4b, 'futura')[0]?.iso

  const c5 = campoPatente(elenco, '5')
  if (c5) {
    const num = c5.toUpperCase().replace(/[^A-Z0-9]/g, '')
    if (num.length >= 8) out.documento = num.slice(0, 10)
  }
  if (!out.documento) {
    // numero di patente: MO1234567X (vecchio) o U1 + 8 caratteri (nuovo)
    const m = testo.toUpperCase().match(/\b([A-Z]{2}\d{7}[A-Z]|U1[A-Z0-9]{8})\b/)
    if (m) out.documento = m[1]
  }

  if (!out.nascita || !out.scadenzaDocumento) {
    const date = trovaDate(testo, 'nascita')
    const ordinate = [...new Set(date.map((d) => d.iso))].sort()
    if (!out.nascita) {
      const vecchia = ordinate.find((d) => d < `${ANNO_OGGI - 14}`)
      if (vecchia) {
        out.nascita = vecchia
        out.dedotti.push('nascita')
      }
    }
    if (!out.scadenzaDocumento) {
      // nella patente le scadenze hanno l'anno a due cifre: rileggile come future
      const future = trovaDate(testo, 'futura')
        .map((d) => d.iso)
        .filter((d) => d > OGGI())
        .sort()
      const futura = future.pop()
      if (futura) {
        out.scadenzaDocumento = futura
        out.dedotti.push('scadenzaDocumento')
      }
    }
  }
  return out
}

export function leggiVisita(testo: string): DatiLetti {
  const out: DatiLetti = { dedotti: [] }
  const date = trovaDate(testo, 'nascita')

  const nascita = dataDopo(testo, /NAT[OA]\s*(?:A\b[^\n]{0,40}?)?\s*IL|NASCITA/, date, 60)
  if (nascita) out.nascita = nascita.iso
  const visita = dataDopo(testo, /DATA\s*(?:DELLA\s*)?VISITA|VISITATO|RILASCIAT\w*|EMESSO|IN\s*DATA|\bDATA\b|\bLÌ\b|\bLI\b|ADDÌ/, date, 40)
  if (visita && visita.iso !== out.nascita) out.dataVisita = visita.iso
  // "validità annuale" da sola non è una scadenza: servono parole come "scade", "fino al"
  const scritta = dataDopo(testo, /SCADENZA|SCADE|FINO\s*AL|SINO\s*AL|VALEVOLE\s*FINO/, date, 70)
  if (scritta && scritta.iso !== out.nascita && scritta.iso !== out.dataVisita) out.scadenzaCertificato = scritta.iso

  const altre = [...new Set(date.map((d) => d.iso))].filter(
    (d) => d !== out.nascita && d > `${ANNO_OGGI - 3}`,
  )
  if (!out.dataVisita) {
    // l'ultima data già passata (e recente) è con ogni probabilità il giorno della visita
    const passata = altre.filter((d) => d <= OGGI()).sort().pop()
    if (passata && passata !== out.scadenzaCertificato) out.dataVisita = passata
  }
  if (!out.scadenzaCertificato) {
    const futura = altre.filter((d) => d > OGGI()).sort().pop()
    if (futura) {
      out.scadenzaCertificato = futura
      out.dedotti.push('scadenzaCertificato')
    } else if (out.dataVisita) {
      // il certificato sportivo vale un anno dalla visita
      out.scadenzaCertificato = piuUnAnno(out.dataVisita)
      out.dedotti.push('scadenzaCertificato')
    }
  }
  return out
}

export function leggiDocumento(tipo: TipoDocumento, testo: string): DatiLetti {
  if (tipo === 'visita') return leggiVisita(testo)
  if (tipo === 'patente') return leggiPatente(testo)
  return leggiCartaIdentita(testo)
}

/**
 * Unisce le letture di più foto (es. fronte e retro): vince il primo valore
 * trovato, ma un valore letto batte uno dedotto e l'MRZ valido batte tutto.
 */
export function unisciLetture(letture: DatiLetti[]): DatiLetti {
  const ordinate = [...letture].sort((a, b) => Number(!!b.mrzValido) - Number(!!a.mrzValido))
  const out: DatiLetti = { dedotti: [] }
  const campi = ['nome', 'cognome', 'nascita', 'documento', 'scadenzaDocumento', 'scadenzaCertificato', 'dataVisita'] as const
  for (const c of campi) {
    const lette = ordinate.find((l) => l[c] && !l.dedotti.includes(c))
    const dedotte = ordinate.find((l) => l[c])
    const fonte = lette ?? dedotte
    if (fonte?.[c]) {
      out[c] = fonte[c]
      if (!lette) out.dedotti.push(c)
    }
  }
  out.mrzValido = ordinate.some((l) => l.mrzValido)
  return out
}

/**
 * Chi è sul documento? Si cercano nel testo le parole di nome e cognome di
 * ogni tesserato: vince chi le ha tutte (o la maggior parte), a pari merito
 * chi ha il nome più lungo (più parole combaciano davvero).
 */
export function trovaTesserato<T extends { id: string; nome: string; cognome: string; nascita?: string }>(
  testo: string,
  tesserati: T[],
  letti?: Pick<DatiLetti, 'nome' | 'cognome' | 'nascita'>,
): T | undefined {
  const nelTesto = new Set(parole(`${testo} ${letti?.cognome ?? ''} ${letti?.nome ?? ''}`))
  let migliore: T | undefined
  let punti = 0
  for (const t of tesserati) {
    const sue = parole(`${t.nome} ${t.cognome}`)
    if (!sue.length) continue
    const trovate = sue.filter((p) => nelTesto.has(p)).length
    // serve almeno il cognome e il nome (o tutte le parole se sono più di due)
    if (trovate < Math.min(2, sue.length)) continue
    let p = trovate / sue.length + trovate * 0.01
    if (letti?.nascita && t.nascita === letti.nascita) p += 1
    if (p > punti) {
      punti = p
      migliore = t
    }
  }
  return migliore
}
