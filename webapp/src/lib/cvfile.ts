// Text extraction from an uploaded CV. Runs entirely in the browser; the file never leaves the device.

async function pdfText(buf: ArrayBuffer): Promise<string> {
  const pdfjs = await import('pdfjs-dist');
  if (!pdfjs.GlobalWorkerOptions.workerPort && !pdfjs.GlobalWorkerOptions.workerSrc && !(globalThis as { pdfjsWorker?: unknown }).pdfjsWorker) {
    if (__OFFLINE__) {
      // A file opened from disk cannot start a module worker, so pdf.js runs its worker code on
      // the main thread: it picks up the handler from globalThis.pdfjsWorker.
      const w = await import('pdfjs-dist/build/pdf.worker.min.mjs');
      (globalThis as unknown as { pdfjsWorker: unknown }).pdfjsWorker = w;
    } else {
      pdfjs.GlobalWorkerOptions.workerSrc = (await import('pdfjs-dist/build/pdf.worker.min.mjs?url')).default;
    }
  }
  const doc = await pdfjs.getDocument({ data: new Uint8Array(buf), isEvalSupported: false }).promise;
  const pages: string[] = [];
  for (let p = 1; p <= Math.min(doc.numPages, 12); p++) {
    const page = await doc.getPage(p);
    const content = await page.getTextContent();
    let lastY: number | null = null;
    let line = '';
    const lines: string[] = [];
    for (const it of content.items as { str: string; transform: number[]; hasEOL?: boolean }[]) {
      const y = Math.round(it.transform[5]);
      if (lastY !== null && Math.abs(y - lastY) > 2) {
        lines.push(line);
        line = '';
      }
      line += (line && !line.endsWith(' ') && it.str && !it.str.startsWith(' ') ? ' ' : '') + it.str;
      lastY = y;
      if (it.hasEOL) {
        lines.push(line);
        line = '';
        lastY = null;
      }
    }
    if (line) lines.push(line);
    pages.push(lines.join('\n'));
  }
  await doc.destroy();
  return pages.join('\n');
}

/**
 * Text of a CV file. pdf.js parses PDFs in its own worker; Word documents go to `docx`, which the
 * caller points at the match worker when there is one.
 */
export async function extractFileText(file: File, docx: (buf: ArrayBuffer) => Promise<string>): Promise<string> {
  const name = file.name.toLowerCase();
  const buf = await file.arrayBuffer();
  if (name.endsWith('.pdf') || file.type === 'application/pdf') return pdfText(buf);
  if (name.endsWith('.docx')) return docx(buf);
  if (name.endsWith('.txt') || name.endsWith('.md') || file.type.startsWith('text/')) return new TextDecoder().decode(buf);
  throw new Error('unsupported');
}
