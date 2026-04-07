/**
 * データ配列をCSV文字列に変換してダウンロードする
 * BOM付きUTF-8で出力（Excelで日本語が文字化けしないように）
 */
export function downloadCSV(filename: string, headers: string[], rows: string[][]) {
  const BOM = '\uFEFF'
  const csvContent = [
    headers.join(','),
    ...rows.map(row =>
      row.map(cell => {
        // カンマ、改行、ダブルクォートを含む場合はクォートで囲む
        const escaped = cell.replace(/"/g, '""')
        return /[,\n"\r]/.test(cell) ? `"${escaped}"` : escaped
      }).join(',')
    ),
  ].join('\n')

  const blob = new Blob([BOM + csvContent], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  link.click()
  URL.revokeObjectURL(url)
}
