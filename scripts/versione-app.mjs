import { execFileSync } from 'node:child_process'

function git(...args) {
  return execFileSync('git', args, { encoding: 'utf8' }).trim()
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

  if (/^[\w-]+(?:\([^)]+\))?!:/.test(titolo) || /^BREAKING[ -]CHANGE:/m.test(messaggio)) {
    major += 1
    minor = 0
    patch = 0
  } else if (/^feat(?:\([^)]+\))?:/.test(titolo)) {
    minor += 1
    patch = 0
  } else {
    patch += 1
  }
}

console.log(`${major}.${minor}.${patch}`)
