import Papa from 'papaparse'
import * as XLSX from 'xlsx'

export interface ParseResult {
  headers: string[]
  rows: Record<string, string>[]
}

export function parseCSV(file: File): Promise<ParseResult> {
  return new Promise((resolve, reject) => {
    Papa.parse<Record<string, string>>(file, {
      header: true,
      skipEmptyLines: true,
      complete: (results) => {
        const headers = results.meta.fields ?? []
        resolve({ headers, rows: results.data })
      },
      error: (err: Error) => reject(err),
    })
  })
}

export async function parseExcel(file: File): Promise<ParseResult> {
  const buffer = await file.arrayBuffer()
  const workbook = XLSX.read(buffer, { type: 'array' })
  const sheetName = workbook.SheetNames[0]
  if (!sheetName) {
    return { headers: [], rows: [] }
  }
  const sheet = workbook.Sheets[sheetName]
  const jsonRows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, {
    defval: '',
  })

  if (jsonRows.length === 0) {
    return { headers: [], rows: [] }
  }

  const headers = Object.keys(jsonRows[0])
  const rows = jsonRows.map((row) => {
    const out: Record<string, string> = {}
    for (const key of headers) {
      out[key] = row[key] === null || row[key] === undefined ? '' : String(row[key])
    }
    return out
  })

  return { headers, rows }
}

export function parseFile(file: File): Promise<ParseResult> {
  const name = file.name.toLowerCase()
  if (name.endsWith('.csv') || name.endsWith('.tsv')) {
    return parseCSV(file)
  }
  if (name.endsWith('.xlsx') || name.endsWith('.xls')) {
    return parseExcel(file)
  }
  return Promise.reject(new Error(`Unsupported file type: ${file.name}`))
}
