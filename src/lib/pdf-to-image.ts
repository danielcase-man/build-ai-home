/**
 * PDF to Image Converter
 *
 * Converts a PDF buffer to a base64-encoded PNG image using PyMuPDF.
 * Used by the takeoff agent for vision-based extraction when text
 * extraction yields insufficient content (AutoCAD PDFs, image-based plans).
 *
 * Requires: Python with PyMuPDF (fitz) installed.
 */

import { execSync } from 'child_process'
import * as fs from 'fs'
import * as path from 'path'
import * as os from 'os'

export interface PdfImageResult {
  base64: string
  width: number
  height: number
}

/**
 * Convert a PDF buffer's first page to a base64-encoded PNG image.
 *
 * @param pdfBuffer — the PDF file contents
 * @param options.dpi — rendering DPI (default 150, balances quality vs size)
 * @param options.page — page number to render (default 0 = first page)
 */
export async function pdfBufferToBase64Image(
  pdfBuffer: Buffer,
  options: { dpi?: number; page?: number } = {}
): Promise<PdfImageResult> {
  const dpi = options.dpi || 150
  const pageNum = options.page || 0

  // Write PDF to temp file
  const tmpDir = os.tmpdir()
  const tmpPdf = path.join(tmpDir, `takeoff-${Date.now()}.pdf`)
  const tmpPng = path.join(tmpDir, `takeoff-${Date.now()}.png`)

  try {
    fs.writeFileSync(tmpPdf, pdfBuffer)

    // Call Python to render via PyMuPDF
    const script = `
import fitz, json, sys
doc = fitz.open("${tmpPdf.replace(/\\/g, '/')}")
page = doc[${pageNum}]
pix = page.get_pixmap(dpi=${dpi})
pix.save("${tmpPng.replace(/\\/g, '/')}")
print(json.dumps({"width": pix.width, "height": pix.height}))
doc.close()
`
    const result = execSync(`python -c "${script.replace(/"/g, '\\"').replace(/\n/g, ';')}"`, {
      encoding: 'utf-8',
      timeout: 30000,
    })

    const { width, height } = JSON.parse(result.trim())

    // Read the PNG and convert to base64
    const pngBuffer = fs.readFileSync(tmpPng)
    const base64 = pngBuffer.toString('base64')

    return { base64, width, height }
  } finally {
    // Cleanup temp files
    try { fs.unlinkSync(tmpPdf) } catch { /* ignore */ }
    try { fs.unlinkSync(tmpPng) } catch { /* ignore */ }
  }
}
