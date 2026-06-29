import html2canvas from 'html2canvas'
import { jsPDF } from 'jspdf'
import * as XLSX from 'xlsx'

export async function exportToPDF(
  elementId: string,
  filename: string
): Promise<void> {
  const el = document.getElementById(elementId)
  if (!el) {
    console.warn(`exportToPDF: element #${elementId} not found`)
    return
  }

  const canvas = await html2canvas(el, {
    scale: 2,
    useCORS: true,
    logging: false,
  })

  const imgData = canvas.toDataURL('image/png')
  const imgWidth = canvas.width
  const imgHeight = canvas.height

  const pdfWidth = 297
  const pdfHeight = (imgHeight * pdfWidth) / imgWidth

  const pdf = new jsPDF({
    orientation: pdfWidth > pdfHeight ? 'landscape' : 'portrait',
    unit: 'mm',
    format: [pdfWidth, Math.max(pdfHeight, 210)],
  })

  pdf.addImage(imgData, 'PNG', 0, 0, pdfWidth, pdfHeight)
  pdf.save(filename.endsWith('.pdf') ? filename : `${filename}.pdf`)
}

export function exportToExcel(
  data: Record<string, unknown>[],
  filename: string
): void {
  if (data.length === 0) {
    console.warn('exportToExcel: no data to export')
    return
  }

  const ws = XLSX.utils.json_to_sheet(data)
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, 'Data')
  XLSX.writeFile(wb, filename.endsWith('.xlsx') ? filename : `${filename}.xlsx`)
}

export async function exportToPNG(
  elementId: string,
  filename: string
): Promise<void> {
  const el = document.getElementById(elementId)
  if (!el) {
    console.warn(`exportToPNG: element #${elementId} not found`)
    return
  }

  const canvas = await html2canvas(el, {
    scale: 2,
    useCORS: true,
    logging: false,
  })

  const link = document.createElement('a')
  link.download = filename.endsWith('.png') ? filename : `${filename}.png`
  link.href = canvas.toDataURL('image/png')
  link.click()
}
