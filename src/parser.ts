import mammoth from 'mammoth'
import pdfParse from 'pdf-parse'

/**
 * Parse a file buffer into text based on its extension.
 * Supports: .txt, .md, .pdf, .docx
 */
export async function parseFile(buffer: Buffer, filename: string): Promise<string> {
  const ext = filename.toLowerCase().split('.').pop() || ''

  if (ext === 'txt' || ext === 'md' || ext === 'csv' || ext === 'json') {
    return buffer.toString('utf-8')
  }

  if (ext === 'pdf') {
    const result = await pdfParse(buffer)
    return result.text
  }

  if (ext === 'docx') {
    const result = await mammoth.extractRawText({ buffer })
    return result.value
  }

  // Fallback: try reading as text
  return buffer.toString('utf-8')
}

/** Get human-readable file type label */
export function getFileType(filename: string): string {
  const ext = filename.toLowerCase().split('.').pop() || ''
  const map: Record<string, string> = {
    txt: 'TXT', md: 'Markdown', pdf: 'PDF', docx: 'Word',
    csv: 'CSV', json: 'JSON',
  }
  return map[ext] || ext.toUpperCase()
}
