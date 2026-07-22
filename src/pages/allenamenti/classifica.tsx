import { coloreAffluenza } from '../../lib/chart'

export interface RigaClassifica {
  id: string
  nome: string
  presenze: number
  perc: number
}

/** oro, argento, bronzo per i primi tre posti */
const MEDAGLIE = ['#e5a800', '#b6b0a3', '#c8823c']

/** Classifica presenze: barre orizzontali ordinate, colorate come l'affluenza. */
export function ClassificaPresenze({ righe, totale }: { righe: RigaClassifica[]; totale?: number }) {
  const max = Math.max(1, ...righe.map((r) => r.presenze))
  if (righe.length === 0) {
    return <div style={{ color: 'var(--testo-2)' }}>Nessun giocatore</div>
  }
  return (
    <div>
      {righe.map((r, i) => {
        const medaglia = i < 3 && r.presenze > 0 ? MEDAGLIE[i] : null
        return (
          <div key={r.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '5px 0' }}>
            <span
              style={{
                width: 24,
                height: 24,
                flexShrink: 0,
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                borderRadius: '50%',
                fontSize: 12,
                fontWeight: 700,
                fontVariantNumeric: 'tabular-nums',
                background: medaglia ?? 'transparent',
                color: medaglia ? '#fff' : 'var(--testo-2)',
              }}
            >
              {i + 1}
            </span>
            <span
              style={{
                flex: 1,
                minWidth: 0,
                fontWeight: 500,
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}
            >
              {r.nome}
            </span>
            <div style={{ flex: 1, background: 'var(--linea)', borderRadius: 6, height: 18, minWidth: 40 }}>
              <div
                style={{
                  width: `${(r.presenze / max) * 100}%`,
                  minWidth: r.presenze > 0 ? 6 : 0,
                  height: '100%',
                  background: coloreAffluenza(r.perc),
                  borderRadius: 6,
                }}
              />
            </div>
            <span
              style={{
                width: 92,
                flexShrink: 0,
                textAlign: 'right',
                whiteSpace: 'nowrap',
                fontVariantNumeric: 'tabular-nums',
              }}
            >
              <b>{r.presenze}</b>
              <span style={{ color: 'var(--testo-2)' }}>
                {totale ? `/${totale}` : ''} ({r.perc}%)
              </span>
            </span>
          </div>
        )
      })}
    </div>
  )
}

/** Esporta la classifica presenze in PDF (jspdf/html2canvas caricati al momento). */
export async function esportaClassificaPdf(
  righe: RigaClassifica[],
  stagione: string,
  totaleSedute: number,
): Promise<void> {
  const [{ default: jsPDF }, { default: html2canvas }] = await Promise.all([
    import('jspdf'),
    import('html2canvas'),
  ])

  const box = document.createElement('div')
  // color esplicito: senza, il foglio eredita l'inchiostro del tema attivo
  // (in tema scuro è panna e sulla carta bianca il testo sparisce)
  box.style.cssText =
    'padding:40px;background:#fff;position:absolute;left:-9999px;top:0;width:210mm;font-family:Arial,sans-serif;color:#000;'
  box.innerHTML = `
    <div style="position:relative;text-align:center;margin-bottom:22px;">
      <img src="${import.meta.env.BASE_URL}logo.png" alt="" style="position:absolute;top:0;right:0;height:64px;" />
      <h2 style="font-size:22px;font-weight:bold;margin:0 0 6px;">CLASSIFICA PRESENZE ALLENAMENTI</h2>
      <div style="font-size:13px;">U.S. RIOLUNATO · Stagione ${stagione} · ${totaleSedute} sedute</div>
    </div>
    <table cellpadding="6" cellspacing="0" style="border-collapse:collapse;width:100%;font-size:13px;">
      <thead>
        <tr style="background:#d9d9d9;">
          <th style="border:1px solid #000;padding:6px;width:40px;text-align:center;">#</th>
          <th style="border:1px solid #000;padding:6px;text-align:left;">Giocatore</th>
          <th style="border:1px solid #000;padding:6px;width:110px;text-align:center;">Presenze</th>
          <th style="border:1px solid #000;padding:6px;width:90px;text-align:center;">%</th>
        </tr>
      </thead>
      <tbody>
        ${righe
          .map(
            (r, i) => `<tr>
              <td style="border:1px solid #000;padding:6px;text-align:center;">${i + 1}</td>
              <td style="border:1px solid #000;padding:6px;">${r.nome}</td>
              <td style="border:1px solid #000;padding:6px;text-align:center;">${r.presenze} / ${totaleSedute}</td>
              <td style="border:1px solid #000;padding:6px;text-align:center;">${r.perc}%</td>
            </tr>`,
          )
          .join('')}
      </tbody>
    </table>
  `
  document.body.appendChild(box)
  try {
    const img = box.querySelector('img')
    if (img && !img.complete) await new Promise((res) => ((img.onload = res), (img.onerror = res)))
    const canvas = await html2canvas(box, { scale: 2, useCORS: true, backgroundColor: '#ffffff' })
    const imgData = canvas.toDataURL('image/png')
    const pdf = new jsPDF('p', 'mm', 'a4')
    const w = pdf.internal.pageSize.getWidth()
    const hgt = (canvas.height * w) / canvas.width
    let left = hgt
    let pos = 0
    pdf.addImage(imgData, 'PNG', 0, pos, w, hgt)
    left -= pdf.internal.pageSize.getHeight()
    while (left > 0) {
      pos = left - hgt
      pdf.addPage()
      pdf.addImage(imgData, 'PNG', 0, pos, w, hgt)
      left -= pdf.internal.pageSize.getHeight()
    }
    const oggi = new Date().toLocaleDateString('it-IT').replace(/\//g, '-')
    pdf.save(`classifica-presenze-${oggi}.pdf`)
  } finally {
    box.remove()
  }
}
