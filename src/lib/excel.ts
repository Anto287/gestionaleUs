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
    const ws = XLSX.utils.json_to_sheet(f.righe)
    XLSX.utils.book_append_sheet(wb, ws, f.nome.slice(0, 31))
  }
  XLSX.writeFile(wb, nomeFile)
}
