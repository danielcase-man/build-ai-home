import PDFDocument from 'pdfkit'

export function createPdfDocument(): typeof PDFDocument.prototype {
  const doc = new PDFDocument({
    size: 'LETTER',
    margins: { top: 50, bottom: 50, left: 50, right: 50 },
  })
  return doc
}

export function addHeader(doc: typeof PDFDocument.prototype, title: string, subtitle?: string) {
  doc.fontSize(20).font('Helvetica-Bold').text(title, { align: 'left' })
  if (subtitle) {
    doc.fontSize(10).font('Helvetica').fillColor('#666').text(subtitle)
    doc.fillColor('#000')
  }
  doc.moveDown(0.5)
  // Horizontal rule
  doc.moveTo(50, doc.y).lineTo(562, doc.y).strokeColor('#ccc').stroke()
  doc.moveDown(0.5)
}

export function addSectionTitle(doc: typeof PDFDocument.prototype, title: string) {
  doc.fontSize(14).font('Helvetica-Bold').text(title)
  doc.moveDown(0.3)
}

export function addParagraph(doc: typeof PDFDocument.prototype, text: string) {
  doc.fontSize(10).font('Helvetica').text(text, { lineGap: 3 })
  doc.moveDown(0.3)
}

export function addBulletList(doc: typeof PDFDocument.prototype, items: string[]) {
  for (const item of items) {
    doc.fontSize(10).font('Helvetica').text(`  \u2022  ${item}`, { lineGap: 2 })
  }
  doc.moveDown(0.3)
}

export function addTable(
  doc: typeof PDFDocument.prototype,
  headers: string[],
  rows: string[][],
  colWidths?: number[]
) {
  const startX = 50
  const pageWidth = 512
  const widths = colWidths || headers.map(() => Math.floor(pageWidth / headers.length))

  // Header row
  doc.font('Helvetica-Bold').fontSize(9)
  let x = startX
  for (let i = 0; i < headers.length; i++) {
    doc.text(headers[i], x, doc.y, { width: widths[i], continued: i < headers.length - 1 })
    x += widths[i]
  }
  doc.moveDown(0.2)

  // Separator
  doc.moveTo(startX, doc.y).lineTo(startX + pageWidth, doc.y).strokeColor('#ddd').stroke()
  doc.moveDown(0.2)

  // Data rows
  doc.font('Helvetica').fontSize(9)
  for (const row of rows) {
    x = startX
    const rowY = doc.y
    for (let i = 0; i < row.length; i++) {
      doc.text(row[i] || '-', x, rowY, { width: widths[i] })
      x += widths[i]
    }
    doc.moveDown(0.1)
  }
  doc.moveDown(0.3)
}

export function addFooter(doc: typeof PDFDocument.prototype) {
  doc.moveDown(1)
  doc.fontSize(8).font('Helvetica').fillColor('#999')
    .text(`Generated ${new Date().toLocaleDateString()} by UBuildIt Manager`, { align: 'center' })
  doc.fillColor('#000')
}

export function docToBuffer(doc: typeof PDFDocument.prototype): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = []
    doc.on('data', (chunk: Buffer) => chunks.push(chunk))
    doc.on('end', () => resolve(Buffer.concat(chunks)))
    doc.on('error', reject)
    doc.end()
  })
}
