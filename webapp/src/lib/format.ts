export const fmtRM = (v: number | null | undefined) =>
  v == null || !Number.isFinite(v) ? 'n/a' : 'RM ' + Math.round(v).toLocaleString('en-MY');

export const fmt = (v: number | null | undefined, d = 0) =>
  v == null || !Number.isFinite(v) ? 'n/a' : v.toLocaleString('en-MY', { minimumFractionDigits: d, maximumFractionDigits: d });

export const signed = (v: number, d = 1) => (v > 0 ? '+' : v < 0 ? '−' : '') + Math.abs(v).toFixed(d);

export const clamp = (v: number, lo = 0, hi = 1) => Math.min(hi, Math.max(lo, v));

export const ordinal = (n: number) => {
  const r = Math.round(n);
  const s = ['th', 'st', 'nd', 'rd'];
  const v = r % 100;
  return r + (s[(v - 20) % 10] || s[v] || s[0]);
};
