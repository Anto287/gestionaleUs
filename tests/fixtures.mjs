// Dati fittizi: nessuna informazione dei tesserati o richiesta al Drive reale.
export function fixtures() {
  const giocatori = Array.from({ length: 16 }, (_, i) => ({
    id: `g${i}`, nome: i === 0 ? 'Gianmarco Alessandro' : ['Luca', 'Marco', 'Andrea', 'Matteo'][i % 4],
    cognome: i === 0 ? 'Cognome Composto Molto Lungo' : `Rossi di Prova ${i}`,
    categoria: i > 13 ? 'dirigente' : 'giocatore', ruoloDirigenza: i > 13 ? 'Responsabile organizzazione e attività sportive' : undefined,
    ruoloPreferito: ['POR', 'DC', 'TD', 'TS', 'CC', 'COC', 'ATT'][i % 7], numeroMaglia: i + 1,
    nascita: '2000-01-10', tessera: `TEST${i}`, documento: 'DOC123456',
    scadenzaDocumento: '2030-01-01', certificatoMedico: i % 4 !== 0, scadenzaCertificato: '2027-06-01',
    quotaImporto: 150, quotaPagata: i % 3 === 0, bravura: 3, infortunato: i === 9,
    versamentiQuota: i % 3 === 0 ? [{ id: `v${i}`, data: '2026-10-01', importo: 150 }] : [],
    note: 'Dati dimostrativi per verificare la leggibilità della scheda e delle azioni.',
  }))
  const partite = Array.from({ length: 5 }, (_, i) => ({ id: `p${i}`, data: `2026-10-${String(i * 3 + 2).padStart(2, '0')}`,
    ora: '15:00', avversario: i === 0 ? 'Associazione Sportiva San Damaso e San Paolo' : i === 1 ? 'Unione Sportiva San Giovanni e San Bartolomeo della Montagna' : `Squadra di prova ${i}`,
    inCasa: i % 2 === 0, torneoId: 'torneo', giocata: true, golFatti: i + 1, golSubiti: 1,
    marcatori: [{ giocatoreId: 'g1', quantita: i + 1 }], assist: [{ giocatoreId: 'g3', quantita: 1 }],
    ammoniti: ['g4'], espulsi: [], titolari: giocatori.slice(0, 11).map((g) => g.id), subentrati: ['g11'],
    formazione: { modulo: '4-3-3', posti: giocatori.slice(0, 11).map((g) => g.id), cambi: [{ esce: 'g2', entra: 'g11', minuto: 65 }] },
  }))
  const stock = (id) => Array.from({ length: 7 }, (_, i) => ({ id: `${id}${i}`, nome: i === 0 ? 'Materiale di ricambio con una descrizione particolarmente lunga' : `Articolo di prova ${i}`,
    categoria: i % 2 === 0 ? 'Materiale' : 'Bevande', quantita: i + 1, scortaMinima: 4, scadenza: '2026-11-01', note: 'Da verificare prima della prossima partita.' }))
  return {
    giocatori, partite,
    allenamenti: [1, 7, 14, 21].map((d) => ({ id: `a${d}`, data: `2026-10-${String(d).padStart(2, '0')}`,
      note: 'Riscaldamento, tecnica e partita finale.', presenze: Object.fromEntries(giocatori.slice(0, 13).map((g, i) => [g.id, i % 3 !== 0])) })),
    appuntamenti: [{ id: 'app', data: '2026-10-28', ora: '21:00', avversario: 'Associazione Sportiva San Damaso e San Paolo', inCasa: true, luogo: 'Campo comunale di Riolunato' }],
    promemoria: [{ id: 'todo', testo: 'Verificare materiale, scorte del bar e disponibilità per la prossima partita', entro: '2026-10-28', urgente: true, fatto: false, assegnatoA: 'Responsabile organizzazione' }],
    distinte: [{ id: 'distinta', data: '2026-10-28', creata: '2026-10-23T12:00:00Z', avversario: 'Associazione Sportiva San Damaso e San Paolo', testata: { dataGara: '2026-10-28', oraGara: '21:00', avversario: 'San Damaso', torneo: 'Campionato amatori', campo: 'Campo comunale' }, convocati: [] }],
    tornei: [{ id: 'torneo', nome: 'Campionato amatori provinciale', girone: 'Girone A' }],
    divise: [{ id: 'divisa', nome: 'Prima divisa giallorossa', coloreMaglia: 'Rosso', colorePantaloncini: 'Giallo', coloreCalzettoni: 'Rosso' }],
    calciPiazzati: [{ id: 'piazzati', incarichi: {}, note: 'Indicazioni per la partita e assegnazioni da confermare', aggiornato: '2026-10-23' }],
    conti: Array.from({ length: 12 }, (_, i) => ({ id: `m${i}`, data: `2026-10-${String(i + 1).padStart(2, '0')}`, descrizione: i === 0 ? 'Pagamento manutenzione ordinaria del campo e dei locali dell’associazione' : `Movimento di prova ${i}`, controparte: 'Fornitore e partner dell’associazione', categoria: ['Bar', 'Manutenzione', 'Sponsor'][i % 3], tipo: i % 3 === 0 ? 'entrata' : 'uscita', importo: i === 0 ? 12345.67 : 123.45, saldato: i % 4 !== 1 })),
    speseCondivise: [0, 1, 2].map((i) => ({ id: `s${i}`, data: '2026-10-20', descrizione: 'Spesa condivisa per manutenzione e attrezzature del campo', societa: 'Associazione Sportiva San Damaso e San Paolo', importo: 1250.75, anticipataDa: 'noi', percentuale: 50, saldata: i === 2, categoria: 'Manutenzione' })),
    avversari: [{ id: 'avv', nome: 'Associazione Sportiva San Damaso e San Paolo', modulo: '4-3-3', stile: 'Pressing alto e gioco sulle fasce', puntiForza: 'Organizzazione e calci piazzati', puntiDeboli: 'Spazi alle spalle della difesa', giocatori: [{ id: 'ag', nome: 'Giocatore avversario con nome composto', ruolo: 'ATT', numero: 9, pericoloso: true, caratteristiche: ['veloce'], posto: 10 }] }],
    magazzino: stock('bar'), materiale: stock('mat'), manutenzione: stock('man'), borsaMedica: stock('med'),
    documenti: [{ id: 'doc', nome: 'Verbale assemblea e rendiconto economico annuale dell’associazione.pdf', tipo: 'application/pdf', dimensione: 16384, caricatoIl: '2026-10-20', url: 'https://drive.google.com/file/d/test-documento/view' }],
  }
}
export async function mockDrive(page, data = fixtures()) {
  await page.addInitScript(() => { localStorage.setItem('usriolunato:__secret', 'test-only') })
  await page.route('https://script.google.com/**', async (route) => {
    const b = route.request().postDataJSON(), response = { ok: true }
    if (b.action === 'seasons') Object.assign(response, { stagioni: ['2025/26', '2026/27'], attiva: '2026/27' })
    else if (b.action === 'listAll') response.liste = b.richieste.map((r) => ({ collection: r.collection, items: data[r.collection] ?? [] }))
    else if (b.action === 'list') response.items = data[b.collection] ?? []
    else if (b.action === 'archivioList') Object.assign(response, { documenti: [], foto: [] })
    else if (b.action === 'archivioThumbs') response.thumbs = []
    await route.fulfill({ json: response })
  })
}
