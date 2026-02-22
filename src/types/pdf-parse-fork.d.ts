declare module 'pdf-parse-fork' {
  interface PDFData {
    numpages: number
    numrender: number
    info: Record<string, unknown>
    metadata: unknown
    text: string
    version: string
  }

  function pdf(dataBuffer: Buffer): Promise<PDFData>
  export default pdf
}
