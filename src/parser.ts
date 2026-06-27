import mammoth from 'mammoth'

let pdfParse: ((buffer: Buffer) => Promise<{ text: string }>) | null = null

async function getPdfParse(): Promise<NonNullable<typeof pdfParse>> {
  if (!pdfParse) {
    const mod = await import('pdf-parse')
    pdfParse = mod.default as any
  }
  return pdfParse!
}

/**
 * 根据文件扩展名解析文件 buffer 为文本。
 * 支持：.txt, .md, .pdf, .docx
 */
export async function parseFile(buffer: Buffer, filename: string): Promise<string> {
  const ext = filename.toLowerCase().split('.').pop() || ''

  if (ext === 'txt' || ext === 'md' || ext === 'csv' || ext === 'json') {
    return buffer.toString('utf-8')
  }

  if (ext === 'pdf') {
    const pdf = await getPdfParse()
    const result = await pdf(buffer)
    return result.text
  }

  if (ext === 'docx') {
    const result = await mammoth.extractRawText({ buffer })
    return result.value
  }

  // 降级：尝试作为文本读取
  return buffer.toString('utf-8')
}

/** 获取人类可读的文件类型标签 */
export function getFileType(filename: string): string {
  const ext = filename.toLowerCase().split('.').pop() || ''
  const map: Record<string, string> = {
    txt: 'TXT', md: 'Markdown', pdf: 'PDF', docx: 'Word',
    csv: 'CSV', json: 'JSON',
  }
  return map[ext] || ext.toUpperCase()
}
