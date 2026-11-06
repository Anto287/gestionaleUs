import { execFileSync } from 'node:child_process'

function git(...args) {
  return execFileSync('git', args, { encoding: 'utf8' }).trim()
}

function tipoModifica(titolo) {
  const match = /^(fix|feat)(?:\([^)]+\))?(!)?:\s+\S/.exec(titolo)
  if (!match || (match[1] === 'fix' && match[2])) {
    throw new Error(`Titolo o commit non valido: «${titolo}». Inizia con fix:, feat: o feat!: e aggiungi una descrizione.`)
  }
  if (match[2]) return 'major'
  return match[1] === 'feat' ? 'minor' : 'patch'
}

if (process.argv[2] === '--titolo') {
  tipoModifica(process.argv[3] ?? '')
  process.exit(0)
}

// Il commit che introduce questo script sulla linea principale è il rilascio 1.2.0.
const partenza = git('log', '--first-parent', '--diff-filter=A', '--format=%H', '-1', '--', 'scripts/versione-app.mjs')
if (!partenza) throw new Error('Impossibile trovare il commit iniziale della versione dell’app')

let major = 1
let minor = 2
let patch = 0

const messaggi = git('log', '--first-parent', '--reverse', '--format=%B%x00', `${partenza}..HEAD`)
for (const messaggio of messaggi.split('\0').map((testo) => testo.trim()).filter(Boolean)) {
  const [oggetto, ...corpo] = messaggio.split('\n')
  const titolo = /^Merge pull request #\d+ from /.test(oggetto)
    ? corpo.find((riga) => riga.trim())?.trim() ?? oggetto
    : oggetto

  const tipo = tipoModifica(titolo)
  if (tipo === 'major') {
    major += 1
    minor = 0
    patch = 0
  } else if (tipo === 'minor') {
    minor += 1
    patch = 0
  } else {
    patch += 1
  }
}

console.log(`${major}.${minor}.${patch}`)
