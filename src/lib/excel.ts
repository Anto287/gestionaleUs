/**
 * Export di una lista in un file Excel. La libreria xlsx si carica solo
 * quando serve (stesso approccio dell'import del bilancio).
 */
export async function esportaExcel(
  nomeFile: string,
  fogli: Array<{ nome: string; righe: Array<Record<string, unknown>> }>,
): Promise<void> {
  const XLSX = await import('xlsx')
  const wb = XLSX.utils.book_new()
  for (const f of fogli) {
    // le date ISO diventano date vere di Excel (ordinabili e filtrabili), a
    // mezzogiorno così il fuso non sposta il giorno
    const righe = f.righe.map((r) =>
      Object.fromEntries(
        Object.entries(r).map(([k, v]) => [
          k,
          typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v) ? new Date(`${v}T12:00:00`) : v,
        ]),
      ),
    )
    const ws = XLSX.utils.json_to_sheet(righe, { cellDates: true, dateNF: 'dd/mm/yyyy' })
    XLSX.utils.book_append_sheet(wb, ws, f.nome.slice(0, 31))
  }
  XLSX.writeFile(wb, nomeFile)
}
