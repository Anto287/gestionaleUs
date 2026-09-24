/**
 * Niente suggerimenti del browser nei campi dell'app (carte di credito,
 * indirizzi, cronologia): qui nessun campo va compilato in automatico.
 *
 * Chrome ignora autocomplete="off" per le carte: decide che un campo è una
 * carta dall'id (es. "scadenzaCertificato", "numeroMaglia") e dal testo di
 * etichetta e segnaposto ("Scadenza", "N. tessera", "gg/mm/aaaa" somiglia a
 * "mm/aa"). Quindi, su ogni campo che compare:
 * - autocomplete="off" e i segnali per i gestori di password (1Password,
 *   LastPass, Bitwarden, Dashlane);
 * - un id neutro al posto di quello del modulo (l'etichetta si aggiorna);
 * - un carattere invisibile (U+2060) fra le lettere di etichette e
 *   segnaposto: a schermo non cambia niente, ma le parole non si riconoscono.
 * Resta fuori la password d'accesso, che il browser può ricordare.
 */

const INVISIBILE = '\u2060'
const idNuovi = new Map<string, string>()

/**
 * "Scadenza" → le stesse lettere separate da U+2060 (identico a schermo). Solo dentro le parole: il
 * carattere impedisce di andare a capo, accanto agli spazi le etichette lunghe
 * non si spezzerebbero più sul telefono.
 */
function spezza(testo: string): string {
  if (!testo || testo.includes(INVISIBILE)) return testo
  return testo
    .split(/(\s+)/)
    .map((pezzo) => (/\s/.test(pezzo) ? pezzo : [...pezzo].join(INVISIBILE)))
    .join('')
}

function escluso(el: Element): boolean {
  return el.closest('.gate-card') !== null || (el as HTMLInputElement).type === 'password'
}

function sistemaCampo(el: HTMLInputElement | HTMLTextAreaElement) {
  if (escluso(el)) return
  if (el.getAttribute('autocomplete') !== 'off') el.setAttribute('autocomplete', 'off')
  if (!el.hasAttribute('data-1p-ignore')) {
    el.setAttribute('data-1p-ignore', 'true')
    el.setAttribute('data-lpignore', 'true')
    el.setAttribute('data-bwignore', 'true')
    el.setAttribute('data-form-type', 'other')
  }
  const ph = el.getAttribute('placeholder')
  if (ph && !ph.includes(INVISIBILE)) el.setAttribute('placeholder', spezza(ph))

  const id = el.id
  if (id && !id.startsWith('campo-')) {
    let nuovo = idNuovi.get(id)
    if (!nuovo) {
      nuovo = `campo-${idNuovi.size + 1}`
      idNuovi.set(id, nuovo)
    }
    el.id = nuovo
    document.querySelectorAll(`label[for="${CSS.escape(id)}"]`).forEach((l) => l.setAttribute('for', nuovo))
  }
}

function sistemaEtichetta(l: HTMLLabelElement) {
  if (escluso(l)) return
  // un'etichetta arrivata dopo il suo campo: la si collega al nuovo id
  const per = l.getAttribute('for')
  const nuovo = per ? idNuovi.get(per) : undefined
  if (nuovo) l.setAttribute('for', nuovo)
  const titolo = l.getAttribute('title')
  if (titolo && !titolo.includes(INVISIBILE)) l.setAttribute('title', spezza(titolo))
  const walker = document.createTreeWalker(l, NodeFilter.SHOW_TEXT)
  for (let n = walker.nextNode(); n; n = walker.nextNode()) {
    const t = n.nodeValue ?? ''
    if (t.trim() && !t.includes(INVISIBILE)) n.nodeValue = spezza(t)
  }
}

function sistema(radice: ParentNode) {
  if (radice instanceof HTMLInputElement || radice instanceof HTMLTextAreaElement) sistemaCampo(radice)
  else if (radice instanceof HTMLLabelElement) sistemaEtichetta(radice)
  radice.querySelectorAll?.('input, textarea').forEach((el) => sistemaCampo(el as HTMLInputElement))
  radice.querySelectorAll?.('.ant-form-item-label label, label[for]').forEach((l) => sistemaEtichetta(l as HTMLLabelElement))
}

export function avviaSenzaAutofill(): void {
  if (typeof MutationObserver === 'undefined') return
  sistema(document.body)
  new MutationObserver((cambi) => {
    for (const c of cambi) {
      if (c.type === 'childList') c.addedNodes.forEach((n) => n instanceof Element && sistema(n))
      else if (c.type === 'attributes' && c.target instanceof Element) sistema(c.target)
      else if (c.type === 'characterData') {
        // React ha riscritto il testo di un'etichetta
        const l = c.target.parentElement?.closest('label')
        if (l) sistemaEtichetta(l as HTMLLabelElement)
      }
    }
  }).observe(document.body, {
    childList: true,
    subtree: true,
    characterData: true,
    attributes: true,
    attributeFilter: ['id', 'placeholder', 'autocomplete'],
  })
}
