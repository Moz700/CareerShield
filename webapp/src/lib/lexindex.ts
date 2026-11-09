// TF-IDF retrieval over word unigrams, word bigrams and character 4-grams with cosine scoring.
// Same features and weights as pipeline/lexindex.py, so the browser ranks occupations exactly as
// the validated matcher does.

export function features(s: string, charN = 4): string[] {
  const low = s.toLowerCase();
  const w = low.match(/[a-z0-9]+/g) ?? [];
  const f: string[] = w.slice();
  for (let i = 0; i + 1 < w.length; i++) f.push(w[i] + '_' + w[i + 1]);
  const c = ' ' + low.replace(/[^a-z0-9 ]/g, '') + ' ';
  for (let i = 0; i <= c.length - charN; i++) f.push(c.slice(i, i + charN));
  return f;
}

function counts(s: string): Map<string, number> {
  const cc = new Map<string, number>();
  for (const t of features(s)) cc.set(t, (cc.get(t) ?? 0) + 1);
  return cc;
}

export class LexIndex {
  private vocab = new Map<string, number>();
  private idf: Float64Array = new Float64Array(0);
  private postDoc: Int32Array[] = [];
  private postVal: Float64Array[] = [];
  n = 0;

  fit(docs: string[]): this {
    // One pass assigns term ids in order of first appearance and counts terms per document in the
    // order they first appear there, so sums run in the same order as with per-document maps.
    const vocab = this.vocab;
    const df: number[] = [];
    const cnt: number[] = [];
    const docTerms: Int32Array[] = [];
    const docCounts: Int32Array[] = [];
    const touched: number[] = [];
    for (const doc of docs) {
      touched.length = 0;
      for (const f of features(doc)) {
        let i = vocab.get(f);
        if (i === undefined) {
          i = df.length;
          vocab.set(f, i);
          df.push(0);
          cnt.push(0);
        }
        if (cnt[i]++ === 0) touched.push(i);
      }
      const terms = Int32Array.from(touched);
      const c = new Int32Array(terms.length);
      for (let k = 0; k < terms.length; k++) {
        c[k] = cnt[terms[k]];
        cnt[terms[k]] = 0;
        df[terms[k]]++;
      }
      docTerms.push(terms);
      docCounts.push(c);
    }
    this.n = docs.length;
    const id = df.length;
    this.idf = new Float64Array(id);
    // postings in one flat array per field (compressed sparse columns): term i owns [off[i], off[i + 1])
    const off = new Int32Array(id + 1);
    for (let i = 0; i < id; i++) {
      this.idf[i] = Math.log((1 + this.n) / (1 + df[i])) + 1;
      off[i + 1] = off[i] + df[i];
    }
    const allDoc = new Int32Array(off[id]);
    const allVal = new Float64Array(off[id]);
    const fill = off.slice(0, id);
    for (let r = 0; r < docTerms.length; r++) {
      const terms = docTerms[r];
      const c = docCounts[r];
      const ws = new Float64Array(terms.length);
      let ss = 0;
      for (let k = 0; k < terms.length; k++) {
        const w = (1 + Math.log(c[k])) * this.idf[terms[k]];
        ws[k] = w;
        ss += w * w;
      }
      const nr = Math.sqrt(ss) + 1e-9;
      for (let k = 0; k < terms.length; k++) {
        const p = fill[terms[k]]++;
        allDoc[p] = r;
        allVal[p] = ws[k] / nr;
      }
    }
    this.postDoc = new Array(id);
    this.postVal = new Array(id);
    for (let i = 0; i < id; i++) {
      this.postDoc[i] = allDoc.subarray(off[i], off[i + 1]);
      this.postVal[i] = allVal.subarray(off[i], off[i + 1]);
    }
    return this;
  }

  scores(text: string): Float64Array {
    const out = new Float64Array(this.n);
    const q: [number, number][] = [];
    let ss = 0;
    for (const [t, v] of counts(text)) {
      const i = this.vocab.get(t);
      if (i === undefined) continue;
      const w = (1 + Math.log(v)) * this.idf[i];
      q.push([i, w]);
      ss += w * w;
    }
    if (!q.length) return out;
    const nr = Math.sqrt(ss) + 1e-9;
    for (const [i, w] of q) {
      const d = this.postDoc[i];
      const v = this.postVal[i];
      const qw = w / nr;
      for (let k = 0; k < d.length; k++) out[d[k]] += v[k] * qw;
    }
    return out;
  }

  top(text: string, k = 5): [number, number][] {
    const s = this.scores(text);
    const idx = Array.from(s.keys());
    idx.sort((a, z) => s[z] - s[a] || a - z);
    return idx.slice(0, k).map((i) => [i, s[i]]);
  }
}
