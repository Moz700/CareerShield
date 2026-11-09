// Plain text of a Word document. Used by the match worker, and on the main thread where there is
// no worker (the offline single file).
export async function docxText(buf: ArrayBuffer): Promise<string> {
  const mod: any = await import('mammoth');
  const mammoth = mod.default ?? mod;
  const res = await mammoth.extractRawText({ arrayBuffer: buf });
  return res.value as string;
}
