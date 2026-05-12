export type ParsedFile = {
  name: string
  type: string
  content: string
  size: number
}

export async function parseFile(file: File): Promise<ParsedFile> {
  const ext = file.name.split('.').pop()?.toLowerCase() || ''

  // Archivos de texto plano y codigo
  const textTypes = ['txt', 'md', 'csv', 'json', 'js', 'ts', 'tsx', 'jsx', 'py', 'java', 'c', 'cpp', 'cs', 'php', 'rb', 'go', 'rs', 'swift', 'kt', 'html', 'css', 'xml', 'yaml', 'yml', 'sql', 'sh', 'bash']

  if (textTypes.includes(ext)) {
    const content = await file.text()
    return { name: file.name, type: ext, content, size: file.size }
  }

  if (ext === 'pdf') {
    return await parsePDF(file)
  }

  if (ext === 'docx') {
    return await parseWord(file)
  }

  throw new Error(`Tipo de archivo no soportado: .${ext}`)
}

async function parsePDF(file: File): Promise<ParsedFile> {
  const formData = new FormData()
  formData.append('file', file)

  const res = await fetch('/api/parse-file', {
    method: 'POST',
    body: formData,
  })

  const data = await res.json()
  if (!res.ok) throw new Error(data?.detail || data?.error || 'Error procesando PDF')
  return { name: file.name, type: 'pdf', content: data.content, size: file.size }
}

async function parseWord(file: File): Promise<ParsedFile> {
  const formData = new FormData()
  formData.append('file', file)

  const res = await fetch('/api/parse-file', {
    method: 'POST',
    body: formData,
  })

  const data = await res.json()
  if (!res.ok) throw new Error(data?.detail || data?.error || 'Error procesando Word')
  return { name: file.name, type: 'docx', content: data.content, size: file.size }
}

export function formatFileForPrompt(parsed: ParsedFile): string {
  return `[Archivo adjunto: ${parsed.name}]\n\`\`\`\n${parsed.content.slice(0, 12000)}\n\`\`\``
}

export function getSupportedExtensions(): string {
  return '.txt,.md,.csv,.json,.js,.ts,.tsx,.jsx,.py,.java,.c,.cpp,.cs,.php,.rb,.go,.rs,.swift,.kt,.html,.css,.xml,.yaml,.yml,.sql,.sh,.pdf,.docx'
}
