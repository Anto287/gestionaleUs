interface RichiestaInstallazione extends Event {
  prompt(): Promise<unknown>
}

let richiesta: RichiestaInstallazione | undefined
let appenaInstallata = false
const modoApp = window.matchMedia('(display-mode: standalone)')
const ascoltatori = new Set<() => void>()

// Il browser può inviare l'evento prima dell'accesso o dell'apertura della pagina.
window.addEventListener('beforeinstallprompt', (evento) => {
  const candidato = evento as RichiestaInstallazione
  if (typeof candidato.prompt !== 'function') return
  evento.preventDefault()
  richiesta = candidato
})

window.addEventListener('appinstalled', () => {
  richiesta = undefined
  appenaInstallata = true
  ascoltatori.forEach((ascoltatore) => ascoltatore())
})

export function appInstallata() {
  return appenaInstallata || modoApp.matches ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true
}

export function ascoltaInstallazione(ascoltatore: () => void) {
  ascoltatori.add(ascoltatore)
  modoApp.addEventListener('change', ascoltatore)
  return () => {
    ascoltatori.delete(ascoltatore)
    modoApp.removeEventListener('change', ascoltatore)
  }
}

export async function chiediInstallazione() {
  if (!richiesta) return false
  // Ogni evento può aprire la finestra di installazione una sola volta.
  const evento = richiesta
  richiesta = undefined
  try {
    await evento.prompt()
    return true
  } catch {
    return false
  }
}

export function istruzioniInstallazione(ua: string, tocchi: number) {
  if (/iPhone|iPad|iPod/i.test(ua) || (/Macintosh/i.test(ua) && tocchi > 1)) {
    return 'Apri il menu Condividi e scegli «Aggiungi alla schermata Home». Se compare «Apri come app web», attivalo e tocca «Aggiungi». Se la voce manca, apri la pagina in Safari.'
  }
  if (/Android/i.test(ua)) {
    return 'Apri il menu del browser e cerca «Installa app» o «Aggiungi a schermata Home». Se la voce manca, apri la pagina in Chrome.'
  }
  if (/Firefox\//i.test(ua)) {
    return /Windows/i.test(ua)
      ? 'In Firefox aggiornato, cerca il pulsante delle app web nella barra degli indirizzi. Se manca, apri la pagina in Edge o Chrome.'
      : 'Per installare il gestionale, apri questa pagina in Chrome o Edge. Su Mac puoi anche usare Safari e scegliere «File → Aggiungi al Dock» da macOS Sonoma in poi.'
  }
  if (/Macintosh/i.test(ua) && /Version\/.*Safari\//i.test(ua)) {
    return 'In Safari scegli «File → Aggiungi al Dock» e conferma. Serve macOS Sonoma o successivo. Su versioni precedenti, usa Chrome o Edge se disponibili.'
  }
  if (/Edg\//i.test(ua)) {
    return 'In Edge apri il menu «…», cerca «App» e scegli «Installa il sito come app». Puoi anche usare l’icona di installazione nella barra degli indirizzi, quando compare.'
  }
  return 'Cerca l’icona di installazione nella barra degli indirizzi oppure la voce «Installa pagina come app» nel menu del browser. Se il comando manca, apri questa pagina in Chrome o Edge.'
}
