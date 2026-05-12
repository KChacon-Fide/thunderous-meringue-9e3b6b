import { createFileRoute } from '@tanstack/react-router'

let pdfjsPromise: Promise<typeof import('pdfjs-dist/legacy/build/pdf.mjs')> | null = null
let pdfWorkerPromise: Promise<typeof import('pdfjs-dist/legacy/build/pdf.worker.mjs')> | null = null

function ensurePdfRuntimePolyfills() {
    const globalScope = globalThis as any

    if (!globalScope.DOMMatrix) {
        globalScope.DOMMatrix = class DOMMatrix {
            a = 1
            b = 0
            c = 0
            d = 1
            e = 0
            f = 0

            constructor(init?: number[] | string) {
                if (Array.isArray(init)) {
                    this.a = init[0] ?? this.a
                    this.b = init[1] ?? this.b
                    this.c = init[2] ?? this.c
                    this.d = init[3] ?? this.d
                    this.e = init[4] ?? this.e
                    this.f = init[5] ?? this.f
                }
            }

            multiplySelf() { return this }
            preMultiplySelf() { return this }
            translateSelf(x = 0, y = 0) {
                this.e += x
                this.f += y
                return this
            }
            scaleSelf(x = 1, y = x) {
                this.a *= x
                this.d *= y
                return this
            }
            rotateSelf() { return this }
            invertSelf() { return this }
            transformPoint(point: unknown) { return point }
        }
    }

    if (!globalScope.ImageData) {
        globalScope.ImageData = class ImageData {
            data: Uint8ClampedArray
            width: number
            height: number

            constructor(data: Uint8ClampedArray, width: number, height: number) {
                this.data = data
                this.width = width
                this.height = height
            }
        }
    }

    if (!globalScope.Path2D) {
        globalScope.Path2D = class Path2D {}
    }
}

async function getPdfjs() {
    ensurePdfRuntimePolyfills()
    pdfjsPromise ??= import('pdfjs-dist/legacy/build/pdf.mjs')
    pdfWorkerPromise ??= import('pdfjs-dist/legacy/build/pdf.worker.mjs')

    const [pdfjs, pdfWorker] = await Promise.all([pdfjsPromise, pdfWorkerPromise])
    ;(globalThis as any).pdfjsWorker = pdfWorker
    return pdfjs
}

async function extractPdfText(arrayBuffer: ArrayBuffer) {
    const pdfjs = await getPdfjs()
    const loadingTask = pdfjs.getDocument({
        data: new Uint8Array(arrayBuffer),
        disableFontFace: true,
        isEvalSupported: false,
        useSystemFonts: false,
    })
    const pdf = await loadingTask.promise
    const pages: string[] = []

    for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber += 1) {
        const page = await pdf.getPage(pageNumber)
        const textContent = await page.getTextContent()
        const text = textContent.items
            .map((item) => 'str' in item ? item.str : '')
            .join(' ')
            .replace(/\s+/g, ' ')
            .trim()

        if (text) pages.push(text)
        page.cleanup()
    }

    await pdf.destroy()
    return pages.join('\n\n').trim()
}

export const Route = createFileRoute('/api/parse-file')({
    server: {
        handlers: {
            POST: async ({ request }) => {
                try {
                    const formData = await request.formData()
                    const file = formData.get('file') as File

                    if (!file) {
                        return new Response(
                            JSON.stringify({ error: 'No file provided' }),
                            { status: 400, headers: { 'Content-Type': 'application/json' } }
                        )
                    }

                    const ext = file.name.split('.').pop()?.toLowerCase()
                    const arrayBuffer = await file.arrayBuffer()
                    const buffer = Buffer.from(arrayBuffer)
                    let content = ''

                    if (ext === 'pdf') {
                        content = await extractPdfText(arrayBuffer)
                    } else if (ext === 'docx') {
                        const mammoth = await import('mammoth')
                        const result = await mammoth.extractRawText({ buffer })
                        content = result.value
                    } else {
                        content = buffer.toString('utf-8')
                    }

                    if (!content.trim()) {
                        return new Response(
                            JSON.stringify({ error: 'No se pudo extraer texto del archivo. Si es un PDF escaneado, conviertelo con OCR primero.' }),
                            { status: 422, headers: { 'Content-Type': 'application/json' } }
                        )
                    }

                    return new Response(
                        JSON.stringify({ content: content.trim() }),
                        { status: 200, headers: { 'Content-Type': 'application/json' } }
                    )
                } catch (error: any) {
                    console.error('Parse error:', error)
                    return new Response(
                        JSON.stringify({ error: 'Error procesando archivo', detail: error.message }),
                        { status: 500, headers: { 'Content-Type': 'application/json' } }
                    )
                }
            }
        }
    }
})
