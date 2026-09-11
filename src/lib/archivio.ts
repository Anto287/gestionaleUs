/**
 * Archivio tesserati: le due cartelle del Drive con i documenti
 * (fronte/retro) e le foto, tenute fuori dalla cartella del gestionale.
 *
 * Qui sta la parte "di testa": leggere il nome di un file per capire di chi
 * è, agganciarlo al tesserato giusto e comporre il nome dei file nuovi con
 * la stessa regola di quelli già presenti:
 *
 *   documenti → Nome_Cognome_fronte.jpg   (o _retro)
 *   foto      → NOME COGNOME.jpg
 *
 * Gli omonimi si distinguono con la data di nascita dentro il nome
 * (Nome_Cognome_12-05-1999_fronte.jpg): l'app la mette da sola quando in
 * rosa c'è più di un tesserato con lo stesso nome.
 */

export type Cartella = 'documenti' | 'foto'
export type Faccia = 'fronte' | 'retro'

/** Un file dell'archivio, così come lo descrive lo script del Drive. */
export interface FileArchivio {
  id: string
  nome: string
  tipo: string
  dimensione: number
  caricatoIl: string
  url?: string
  /** solo senza Drive (sviluppo in locale): il contenuto salvato nel browser */
  dataUrl?: string
}

/** Quel poco che serve di un tesserato per agganciarlo ai suoi file. */
export interface Tesserato {
  id: string
  nome: string
  cognome: string
  nascita?: string
}

/** Cosa si ricava dal nome di un file. */
export interface NomeLetto {
  /** le parole del nome, ripulite (niente accenti, maiuscole, "fronte"…) */
  parole: string[]
  /** le stesse parole ordinate: due file della stessa persona hanno la stessa chiave */
  chiave: string
  faccia?: Faccia
  /** data di nascita trovata nel nome, in formato ISO */
  nascita?: string
}

/** Parole che nel nome del file non fanno parte del nome della persona. */
const RUMORE = new Set([
  'fronte', 'front', 'davanti', 'retro', 'dietro', 'back',
  'doc', 'documento', 'documenti', 'foto', 'photo', 'img', 'image', 'scan', 'copia',
])
const PAROLE_FRONTE = new Set(['fronte', 'front', 'davanti'])
const PAROLE_RETRO = new Set(['retro', 'dietro', 'back'])

const ESTENSIONE = /\.[a-z0-9]{1,5}$/i

function senzaAccenti(testo: string): string {
  return testo
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/['’`]/g, '') // D'Amico → damico
}

function spezza(testo: string): string[] {
  return senzaAccenti(testo).split(/[^a-z0-9]+/).filter(Boolean)
}

/**
 * Le parole "buone" di un nome: via accenti, maiuscole, numeri e parole di
 * servizio. Una lettera sola si attacca a quella dopo, così "D_Amico"
 * scritto separato torna a essere "damico" come "D'Amico".
 */
export function parole(testo: string): string[] {
  const grezze = spezza(testo)
  const buone: string[] = []
  for (let i = 0; i < grezze.length; i++) {
    let p = grezze[i]
    while (p.length === 1 && /[a-z]/.test(p) && i + 1 < grezze.length) p += grezze[++i]
    if (/^\d+$/.test(p)) continue
    if (RUMORE.has(p)) continue
    buone.push(p)
  }
  return buone
}

/** Chiave di confronto: le parole ordinate, così l'ordine nome/cognome non conta. */
export function chiaveDi(elenco: string[]): string {
  return [...new Set(elenco)].sort().join(' ')
}

export function chiaveTesserato(t: { nome: string; cognome: string }): string {
  return chiaveDi(parole(`${t.nome} ${t.cognome}`))
}

function iso(anno: string, mese: string, giorno: string): string {
  return `${anno}-${mese.padStart(2, '0')}-${giorno.padStart(2, '0')}`
}

/** Cerca una data nel nome del file (12-05-1999, 12.05.1999, 1999-05-12). */
function estraiNascita(testo: string): { resto: string; nascita?: string } {
  const isoRe = /(\d{4})[-_./](\d{1,2})[-_./](\d{1,2})/
  const itaRe = /(\d{1,2})[-_./](\d{1,2})[-_./](\d{4})/
  const a = testo.match(isoRe)
  if (a) return { resto: testo.replace(isoRe, ' '), nascita: iso(a[1], a[2], a[3]) }
  const b = testo.match(itaRe)
  if (b) return { resto: testo.replace(itaRe, ' '), nascita: iso(b[3], b[2], b[1]) }
  return { resto: testo }
}

export function leggiNomeFile(nome: string): NomeLetto {
  const { resto, nascita } = estraiNascita(nome.replace(ESTENSIONE, ''))
  const grezze = spezza(resto)
  const faccia = grezze.some((p) => PAROLE_FRONTE.has(p))
    ? 'fronte'
    : grezze.some((p) => PAROLE_RETRO.has(p))
      ? 'retro'
      : undefined
  const buone = parole(resto)
  return { parole: buone, chiave: chiaveDi(buone), faccia, nascita }
}

/** I file di un tesserato: foto, documento fronte e retro, più gli altri. */
export interface SchedaArchivio {
  foto?: FileArchivio
  fronte?: FileArchivio
  retro?: FileArchivio
  /** file agganciati alla persona ma senza un posto preciso (doppioni, nomi fuori regola) */
  altri: FileArchivio[]
}

export interface Orfano {
  file: FileArchivio
  cartella: Cartella
  letto: NomeLetto
  /** il nome corrisponde a più tesserati e manca la data di nascita per scegliere */
  omonimia?: boolean
}

export interface Aggancio {
  /** id del tesserato → i suoi file */
  per: Record<string, SchedaArchivio>
  /** file che non corrispondono a nessuno in rosa (gente di altri anni, ecc.) */
  orfani: Orfano[]
  /** chiavi con più tesserati dallo stesso nome: lì serve la data di nascita */
  omonimi: Set<string>
}

const VUOTA: SchedaArchivio = { altri: [] }

/**
 * Aggancia i file delle due cartelle ai tesserati in rosa. Chi non
 * corrisponde a nessuno resta fra gli "orfani": i file non si toccano, sono
 * solo dati che l'app non sa a chi mostrare.
 */
export function agganciaArchivio(
  tesserati: Tesserato[],
  documenti: FileArchivio[],
  foto: FileArchivio[],
): Aggancio {
  const paroleDi = new Map<string, string[]>()
  const perChiave = new Map<string, Tesserato[]>()
  for (const t of tesserati) {
    const ps = parole(`${t.nome} ${t.cognome}`)
    paroleDi.set(t.id, ps)
    const k = chiaveDi(ps)
    const gruppo = perChiave.get(k)
    if (gruppo) gruppo.push(t)
    else perChiave.set(k, [t])
  }
  const omonimi = new Set<string>()
  for (const [k, gruppo] of perChiave) if (gruppo.length > 1) omonimi.add(k)

  const per: Record<string, SchedaArchivio> = {}
  const orfani: Orfano[] = []

  function assegna(file: FileArchivio, cartella: Cartella) {
    const letto = leggiNomeFile(file.nome)
    let candidati = perChiave.get(letto.chiave) ?? []
    if (!candidati.length) {
      // nome con qualcosa in più (es. un secondo nome): vale solo se porta
      // a una persona sola, altrimenti si rischia di sbagliare tesserato
      const dentro = tesserati.filter((t) => {
        const ps = paroleDi.get(t.id) ?? []
        return ps.length > 0 && ps.every((p) => letto.parole.includes(p))
      })
      if (dentro.length === 1) candidati = dentro
    }
    let omonimia = false
    if (candidati.length > 1) {
      omonimia = true
      if (letto.nascita) candidati = candidati.filter((t) => t.nascita === letto.nascita)
    }
    if (candidati.length !== 1) {
      orfani.push({ file, cartella, letto, omonimia: omonimia || undefined })
      return
    }
    const id = candidati[0].id
    const scheda = (per[id] ??= { altri: [] })
    const posto: keyof SchedaArchivio | undefined = cartella === 'foto' ? 'foto' : letto.faccia
    if (posto && !scheda[posto]) scheda[posto] = file
    else scheda.altri.push(file)
  }

  documenti.forEach((f) => assegna(f, 'documenti'))
  foto.forEach((f) => assegna(f, 'foto'))
  return { per, orfani, omonimi }
}

export function schedaDi(aggancio: Aggancio | null, id: string): SchedaArchivio {
  return aggancio?.per[id] ?? VUOTA
}

/** '1999-05-12' → '12-05-1999' (come si scrive nei nomi dei file). */
export function nascitaNelNome(iso: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso)
  return m ? `${m[3]}-${m[2]}-${m[1]}` : ''
}

/**
 * Il nome con cui salvare un file nuovo, nello stesso stile di quelli già
 * in archivio. `conNascita` serve quando in rosa c'è un omonimo.
 */
export function nomeArchivio(opzioni: {
  nome: string
  cognome: string
  nascita?: string
  cartella: Cartella
  faccia?: Faccia
  estensione: string
  conNascita?: boolean
}): string {
  const nome = opzioni.nome.trim().replace(/\s+/g, ' ')
  const cognome = opzioni.cognome.trim().replace(/\s+/g, ' ')
  const data = opzioni.conNascita && opzioni.nascita ? nascitaNelNome(opzioni.nascita) : ''
  if (opzioni.cartella === 'foto') {
    const testa = `${nome} ${cognome}`.trim().toUpperCase()
    return `${data ? `${testa} ${data}` : testa}${opzioni.estensione}`
  }
  const pezzi = [nome, cognome]
  if (data) pezzi.push(data)
  if (opzioni.faccia) pezzi.push(opzioni.faccia)
  return `${pezzi.join('_').replace(/\s+/g, '_')}${opzioni.estensione}`
}

/** L'estensione da dare al file caricato (dal nome, o dal tipo se manca). */
export function estensioneDa(nomeFile: string, tipo: string): string {
  const m = nomeFile.match(ESTENSIONE)
  if (m) return m[0].toLowerCase()
  if (tipo === 'image/png') return '.png'
  if (tipo === 'application/pdf') return '.pdf'
  if (tipo === 'image/heic' || tipo === 'image/heif') return '.heic'
  return '.jpg'
}
