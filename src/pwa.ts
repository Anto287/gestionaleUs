import { registerSW } from 'virtual:pwa-register'

/**
 * Aggiornamento automatico dell'app.
 *
 * Ogni build produce un service worker con l'impronta dei nuovi file: è già
 * il "numero di versione" che serviva. Qui lo si registra col modulo del
 * plugin PWA che, in modalità autoUpdate, RICARICA la pagina da solo appena
 * la versione nuova prende il controllo (prima la registrazione iniettata
 * era muta e bisognava ricaricare a mano).
 *
 * Il browser controlla gli aggiornamenti a ogni apertura; in più qui si
 * ricontrolla ogni volta che si RIENTRA nell'app (tab o PWA riportata in
 * primo piano), così dopo una pubblicazione basta tornare sulla pagina.
 */
registerSW({
  immediate: true,
  onRegisteredSW(_url, registrazione) {
    if (!registrazione) return
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') registrazione.update().catch(() => undefined)
    })
  },
})
