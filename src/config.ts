/**
 * Impostazioni della società.
 */
export const config = {
  clubName: 'U.S. Riolunato',
  clubShort: 'US',
  season: '2026/27',

  /**
   * Collegamento al Drive del Riolunato tramite lo script Apps Script.
   * - url: l'indirizzo del web app (finisce con /exec). È solo un indirizzo:
   *   senza la chiave risponde "non autorizzato", quindi non è un segreto.
   *   Se vuoto, l'app salva solo nel browser (offline / sviluppo).
   *
   * La CHIAVE (secret) NON sta qui: si inserisce al login come password e
   * resta nel browser del dispositivo. Vedi src/services/driveStore.ts.
   */
  drive: {
    url: (import.meta.env.VITE_DRIVE_URL ??
      'https://script.google.com/macros/s/AKfycbx3YlsHy770N-0ppMC1iB_oBciIi11tiNdUC1TVCj-FWNWKpU9BpUOFBZtUH-Vm96fz/exec') as string,
  },
} as const
