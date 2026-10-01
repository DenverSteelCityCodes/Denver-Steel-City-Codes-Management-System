// Minimal RFC 4180 CSV helpers for admin exports.

type Cell = string | number | null | undefined

function escapeCell(v: Cell): string {
  if (v === null || v === undefined) return ''
  const s = String(v)
  return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}

export function toCsv(headers: string[], rows: Cell[][]): string {
  return [headers, ...rows].map(r => r.map(escapeCell).join(',')).join('\r\n')
}

export function downloadCsv(filename: string, csv: string): void {
  // BOM so Excel reads UTF-8 (accents) correctly.
  const blob = new Blob(['﻿', csv], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  URL.revokeObjectURL(url)
}
