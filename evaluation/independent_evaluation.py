"""
CareerShield: evaluation on outcomes the ranking does not optimise.

Reproduces every number in the paper's Results section from
  artifacts/occupations_master.csv   exported by notebooks/CareerShield_pipeline.ipynb (Part 10)
  artifacts/skill_matrix.csv         exported by the same notebook
  data/raw/onet/Related Occupations.xlsx                      O*NET 30.3
  data/raw/US National Wages/national_M{2015..2024}_dl.xlsx   BLS OEWS national files
  data/third_party/ai_applicability_scores.csv                Tomlinson et al. (2025), CC BY 4.0

Policies (first recommendation for each origin occupation):
  CONV      first O*NET related occupation, Primary-Short tier
  SIM       CareerShield candidates ranked on skill similarity alone
  v1-BLIND  CareerShield v1 with the exposure term removed (weights 0.70, 0, 0.15, 0.15)
  v1        CareerShield v1 as in the capstone (0.45, 0.25, 0.15, 0.15)
  v1+guards v1 with the posting-coverage and trajectory guards, no capacity cap
  v2        v1 + guards + a cap of K origins per destination SOC-6, by deferred acceptance
  v2-BLIND  v2 with the exposure term removed

Run from the repository root:  python evaluation/independent_evaluation.py
"""
import argparse, json, os
import warnings
import numpy as np, pandas as pd
warnings.filterwarnings("ignore", category=RuntimeWarning)   # all-NaN criteria for origins without a score
from scipy.stats import spearmanr

ap = argparse.ArgumentParser()
ap.add_argument('--root', default='.')
ap.add_argument('--boot', type=int, default=5000)
args = ap.parse_args()
R = args.root
ART, RAW = os.path.join(R, 'artifacts'), os.path.join(R, 'data', 'raw')
OUT = os.path.join(R, 'evaluation', 'output'); os.makedirs(OUT, exist_ok=True)
rng = np.random.default_rng(20260929)
B = args.boot

# ------------------------------------------------------------------ inputs
m = pd.read_csv(os.path.join(ART, 'occupations_master.csv'))
skill_mat = pd.read_csv(os.path.join(ART, 'skill_matrix.csv'), index_col=0)
related = pd.read_excel(os.path.join(RAW, 'onet', 'Related Occupations.xlsx'))
msft = (pd.read_csv(os.path.join(R, 'data', 'third_party', 'ai_applicability_scores.csv'))
          .rename(columns={'SOC Code': 'soc6', 'ai_applicability_score': 'ms'}))
OUR_SOC = set(m.soc6)

def to_file_codes(codes, available):
    """Map each of our SOC-6 codes to the code used in an outcome file. A code missing from the file
    inherits the aggregate that replaced it: the one code in the same SOC broad group (first six
    characters) that is not itself one of our occupations; where two qualify, the BLS combined code
    ending in 8 is used. Codes with no such aggregate stay missing."""
    out = {}
    for s in codes:
        if s in available: out[s] = s; continue
        c = sorted(x for x in available if x[:6] == s[:6] and x not in OUR_SOC)
        if len(c) > 1: c = [x for x in c if x.endswith('8')] or c[:1]
        out[s] = c[0] if c else None
    return out

def load_oews(year):
    df = pd.read_excel(os.path.join(RAW, 'US National Wages', f'national_M{year}_dl.xlsx'))
    df.columns = [c.upper() for c in df.columns]
    g = 'O_GROUP' if 'O_GROUP' in df.columns else 'OCC_GROUP'
    d = df[df[g] == 'detailed'][['OCC_CODE', 'TOT_EMP', 'A_MEDIAN']].copy()
    for c in ['TOT_EMP', 'A_MEDIAN']:          # '*' suppressed, '#' top-coded -> missing
        d[c] = pd.to_numeric(d[c].astype(str).str.replace(',', '').str.strip(), errors='coerce')
    return d.set_index('OCC_CODE')

EMP, MED, CODE, remapped = {}, {}, {}, {}
for y in range(2015, 2025):
    d = load_oews(y); mp = to_file_codes(sorted(OUR_SOC), set(d.index))
    remapped[y] = sum(1 for s_, c in mp.items() if c and c != s_)
    CODE[y] = m.soc6.map(mp).values
    EMP[y] = m.soc6.map({s_: d.loc[c, 'TOT_EMP'] if c else np.nan for s_, c in mp.items()}).values.astype(float)
    MED[y] = m.soc6.map({s_: d.loc[c, 'A_MEDIAN'] if c else np.nan for s_, c in mp.items()}).values.astype(float)

def growth(X, a, b):
    """Log-point change from year a to year b, only where both years report the same OEWS code,
    so a split or merged code is never compared with its parent."""
    same = np.array([ca == cb and ca is not None for ca, cb in zip(CODE[a], CODE[b])])
    return np.where(same, np.log(X[b] / X[a]) * 100, np.nan)

ms_map = to_file_codes(sorted(OUR_SOC), set(msft.soc6))
MS = m.soc6.map({s: msft.set_index('soc6').ms.get(c, np.nan) if c else np.nan for s, c in ms_map.items()}).values * 100

# ------------------------------------------------------------------ v1 ranking (capstone notebook cell 7.5)
M_IDX = {s: i for i, s in enumerate(m.onet_soc)}
SM = skill_mat.loc[m.onet_soc].values
SC = SM - SM.mean(axis=0, keepdims=True)
nrm = np.linalg.norm(SC, axis=1, keepdims=True); nrm[nrm == 0] = 1.0
S = (SC / nrm) @ (SC / nrm).T
SAL, DEM, EXP = m.salary_myr.values, m.demand_pctl.values, m.exposure_pctl.values
JZ, SOC6 = m['Job Zone'].values, m.soc6.values
REL = related.groupby('O*NET-SOC Code')['Related O*NET-SOC Code'].apply(set)
FAM = {}
for i, s in enumerate(m.onet_soc): FAM.setdefault(s[:2], []).append(i)
W_V1, W_BLIND, W_SIM = (0.45, 0.25, 0.15, 0.15), (0.70, 0.0, 0.15, 0.15), (1.0, 0.0, 0.0, 0.0)

def _mm(v):
    r = np.nanmax(v) - np.nanmin(v)
    return (v - np.nanmin(v)) / r if r > 0 else np.full(len(v), 0.5)

def build_cache(exp_pctl, glob=False):
    """Candidate sets and normalised criteria. Candidates are sorted by O*NET code, so the choice
    among O*NET codes that share a SOC-6 is deterministic (the notebook's set order was not)."""
    cache, raw, med_sal = {}, {}, np.nanmedian(SAL)
    for i, soc in enumerate(m.onet_soc):
        pool = REL.get(soc, set()); cand = set(FAM.get(soc[:2], []))
        if pool: cand |= {M_IDX[q] for q in pool if q in M_IDX}
        c = np.array(sorted(cand), int)
        if len(c) == 0: continue
        c = c[(SOC6[c] != SOC6[i]) & (np.abs(JZ[c] - JZ[i]) <= 1) & ~np.isnan(exp_pctl[c])]
        if len(c) == 0: continue
        cur = SAL[i] if np.isfinite(SAL[i]) else np.nanmedian(SAL[c])
        if not np.isfinite(cur) or cur <= 0: cur = med_sal
        ratio = np.nan_to_num(np.clip(SAL[c] / cur, 0, 1.5), nan=0.7)   # missing salary -> 0.7, as in the notebook
        Rw = np.c_[S[i][c], np.clip(exp_pctl[i] - exp_pctl[c], 0, None), DEM[c], ratio]
        C = np.c_[[_mm(Rw[:, j]) for j in range(4)]].T
        _, u = np.unique(SOC6[c], return_index=True); u = np.sort(u)
        cache[soc], raw[soc] = (c[u], C[u]), Rw[u]
    if glob:                                  # screened alternative: normalise across all pairs
        allr = np.vstack(list(raw.values())); lo, hi = allr.min(0), allr.max(0)
        cache = {s: (cache[s][0], (raw[s] - lo) / (hi - lo)) for s in cache}
    return cache
CACHE = build_cache(EXP)

# ------------------------------------------------------------------ v2 guards
EVID = ((m.n_us.fillna(0) > 0) | (m.n_my.fillna(0) > 0)).values                 # posting coverage (2023-24 samples)
TREND = growth(EMP, 2015, 2019)                                                   # US employment, 2015-2019
def declining(th=-10.0): return np.nan_to_num(TREND, nan=0.0) < th               # unknown trend is not excluded

def rank(soc, w=W_V1, guards=False, th=-10.0, cache=None):
    c, C = (cache or CACHE)[soc]
    keep = np.ones(len(c), bool)
    if guards:
        if EVID[c].any(): keep &= EVID[c]
        dec = declining(th)[c]
        if (~dec & keep).any(): keep &= ~dec
    sc = C[keep] @ np.asarray(w, float)
    return c[keep][np.argsort(-sc, kind='stable')]

def plan(origins, cap, w=W_V1, th=-10.0, guards=True):
    """Many-to-one deferred acceptance. Origins propose down their ranked lists; each destination
    SOC-6 holds at most cap[soc6] origins and keeps the most skill-similar. Returns destinations and
    the number of origins left unmatched (they would fall back to their first choice)."""
    prefs = {s: list(rank(s, w, guards, th)) for s in origins}
    nxt, held, free = {s: 0 for s in origins}, {}, list(origins)
    while free:
        s = free.pop()
        if nxt[s] >= len(prefs[s]): continue
        c = prefs[s][nxt[s]]; nxt[s] += 1; key = SOC6[c]
        held.setdefault(key, []).append((s, c))
        k = cap(key) if callable(cap) else cap
        if len(held[key]) > k:
            held[key].sort(key=lambda t: -S[M_IDX[t[0]], t[1]]); free.append(held[key].pop()[0])
    assign = {s: c for L in held.values() for s, c in L}
    un = [s for s in origins if s not in assign]
    for s in un: assign[s] = prefs[s][0]
    return np.array([assign[s] for s in origins]), len(un)

# ------------------------------------------------------------------ evaluation sample (capstone Section 4.9)
REL_TOP = related[related['Relatedness Tier'] == 'Primary-Short'].groupby('O*NET-SOC Code')['Related O*NET-SOC Code'].first()
rows = [(s, M_IDX[s], M_IDX[REL_TOP[s]]) for s in m.dropna(subset=['exposure_pctl']).onet_soc
        if s in REL_TOP.index and REL_TOP[s] in M_IDX and not np.isnan(EXP[M_IDX[REL_TOP[s]]]) and s in CACHE]
E = pd.DataFrame(rows, columns=['origin', 'i', 'CONV']); orig = list(E.origin); iv = E.i.values
conv_max = int(pd.Series(SOC6[E.CONV.values]).value_counts().iloc[0])            # CONV's largest SOC-6 inflow
K = conv_max
P = {'CONV': E.CONV.values,
     'SIM': np.array([rank(s, W_SIM)[0] for s in orig]),
     'v1-BLIND': np.array([rank(s, W_BLIND)[0] for s in orig]),
     'v1': np.array([rank(s)[0] for s in orig]),
     'v1+guards': np.array([rank(s, guards=True)[0] for s in orig])}
P['v2'], un_v2 = plan(orig, K)
P['v2-BLIND'], un_b = plan(orig, K, W_BLIND)

# ------------------------------------------------------------------ outcomes and weights
V = {'exp': EXP, 'dem': DEM, 'ms': MS,
     'emp_post': growth(EMP, 2022, 2024), 'wage_post': growth(MED, 2022, 2024),
     'emp_pre': growth(EMP, 2017, 2019), 'wage_pre': growth(MED, 2017, 2019)}
n_onet_per_soc6 = m.soc6.map(m.soc6.value_counts()).values
W_ORIG = np.nan_to_num(EMP[2022] / n_onet_per_soc6, nan=np.nanmedian(EMP[2022] / n_onet_per_soc6))   # US workers per O*NET code
grp = E.origin.str[:2].values; G = np.unique(grp); IDX = {g: np.where(grp == g)[0] for g in G}

def boot(x, w=None, cluster=True):
    x = np.asarray(x, float); w = np.ones(len(x)) if w is None else np.asarray(w, float)
    def stat(ii):
        xx, ww = x[ii], w[ii]; ok = np.isfinite(xx)
        return np.sum(xx[ok] * ww[ok]) / np.sum(ww[ok])
    bs = []
    for _ in range(B):
        ii = np.concatenate([IDX[g] for g in rng.choice(G, len(G))]) if cluster else rng.integers(0, len(x), len(x))
        bs.append(stat(ii))
    return float(np.percentile(bs, 2.5)), float(np.percentile(bs, 97.5)), float(stat(np.arange(len(x))))

def contrast(x, w=None):
    lo, hi, est = boot(x, w); olo, ohi, _ = boot(x, w, cluster=False)
    return {'n': int(np.isfinite(x).sum()), 'diff': est, 'lo': lo, 'hi': hi, 'origin_lo': olo, 'origin_hi': ohi}

def concentration(d):
    k6 = pd.Series(SOC6[d]); vc = k6.value_counts()
    wv = pd.Series(W_ORIG[iv]).groupby(k6.values).sum().sort_values(ascending=False)
    inflow = wv / pd.Series(EMP[2022], index=SOC6).groupby(level=0).first().reindex(wv.index)
    return {'distinct': int(len(vc)), 'top10_share': float(vc.head(10).sum() / len(d) * 100), 'max_n': int(vc.iloc[0]),
            'max_title': m.title.values[d][k6.values == vc.index[0]][0],
            'top10_share_workers': float(wv.head(10).sum() / wv.sum() * 100),
            'inflow_p90': float(np.nanpercentile(inflow.values, 90))}

res = {'n_origins': len(E), 'n_distinct_origin_soc6': int(len(set(SOC6[iv]))), 'n_clusters': len(G), 'cap_K': K,
       'unmatched': {'v2': un_v2, 'v2-BLIND': un_b}, 'oews_codes_remapped': remapped,
       'ms_codes_remapped': sum(1 for s, c in ms_map.items() if c and c != s), 'policies': {}, 'contrasts': {}}
for k, d in P.items():
    r = concentration(d)
    r.update({'skill_sim': float(S[iv, d].mean()), 'declining_pct': float(declining()[d].mean() * 100),
              'unknown_trend_pct': float(np.isnan(TREND[d]).mean() * 100), 'no_postings_pct': float((~EVID[d]).mean() * 100)})
    for v in V: r[v] = float(np.nanmean(V[v][d]))
    res['policies'][k] = r
PAIRS = [('SIM', 'CONV'), ('v1-BLIND', 'CONV'), ('v1', 'CONV'), ('v1+guards', 'CONV'), ('v2-BLIND', 'CONV'), ('v2', 'CONV'),
         ('v1', 'v1-BLIND'), ('v2', 'v2-BLIND'), ('v2', 'v1')]
for a, b in PAIRS:
    for v in ['exp', 'dem', 'ms', 'emp_post', 'wage_post']:
        res['contrasts'][f'{v}|{a}-{b}'] = contrast(V[v][P[a]] - V[v][P[b]])
    res['contrasts'][f'skill_sim|{a}-{b}'] = contrast(S[iv, P[a]] - S[iv, P[b]])
    for post, pre in [('emp_post', 'emp_pre'), ('wage_post', 'wage_pre')]:
        res['contrasts'][f'did_{post}|{a}-{b}'] = contrast((V[post][P[a]] - V[post][P[b]]) - (V[pre][P[a]] - V[pre][P[b]]))
# paired means on the observed-applicability sample
for a in ['v1', 'v2']:
    x, y = V['ms'][P[a]], V['ms'][P['CONV']]; ok = np.isfinite(x) & np.isfinite(y)
    res[f'ms_paired_{a}'] = {'n': int(ok.sum()), 'conv': float(y[ok].mean()), 'policy': float(x[ok].mean()),
                             'rel_change': float(x[ok].mean() / y[ok].mean() - 1), 'share_lower': float((x[ok] < y[ok]).mean()),
                             'share_equal': float((x[ok] == y[ok]).mean())}

# ------------------------------------------------------------------ RQ1 checks
u = pd.DataFrame({'soc6': SOC6, 'exposure': m.exposure, 'pctl': EXP, 'aioe': m.aioe, 'gpt': m.gpt_beta, 'lm': m.lm_aioe,
                  'ms': MS}).drop_duplicates('soc6').dropna(subset=['exposure', 'ms'])
slope = float(np.polyfit(u.pctl, u.ms, 1)[0])
res['convergent'] = {'rho': float(spearmanr(u.exposure, u.ms)[0]), 'n': int(len(u)), 'slope_per_pctl': slope,
                     'rho_aioe': float(spearmanr(u.aioe, u.ms, nan_policy='omit')[0]),
                     'rho_gpt': float(spearmanr(u.gpt, u.ms, nan_policy='omit')[0]),
                     'rho_lm': float(spearmanr(u.lm, u.ms, nan_policy='omit')[0])}
def transfer(a, b):
    de, dm = EXP[P[a]] - EXP[P[b]], V['ms'][P[a]] - V['ms'][P[b]]; ok = np.isfinite(dm)
    f = lambda ii: np.mean(dm[ii][ok[ii]]) / (slope * np.mean(de[ii][ok[ii]]))
    bs = [f(np.concatenate([IDX[g] for g in rng.choice(G, len(G))])) for _ in range(B)]
    return {'ratio': float(f(np.arange(len(dm)))), 'lo': float(np.percentile(bs, 2.5)), 'hi': float(np.percentile(bs, 97.5))}
res['transfer'] = {f'{a}-{b}': transfer(a, b) for a, b in [('v1', 'CONV'), ('v1', 'v1-BLIND'), ('v2', 'CONV'), ('v2', 'v2-BLIND')]}
# composite rebuilt without the GPT index (Eloundou et al.)
z = lambda s: (s - s.mean()) / s.std()
m2 = m.drop_duplicates('soc6').set_index('soc6')[['aioe', 'lm_aioe']]
comp = pd.concat([z(m2.aioe), z(m2.lm_aioe)], axis=1).mean(axis=1, skipna=True)
EXP_noGPT = m.soc6.map(comp.rank(pct=True) * 100).values
EXP_noGPT = np.where(np.isnan(EXP), np.nan, EXP_noGPT)
C2 = build_cache(EXP_noGPT)
d_noGPT = np.array([rank(s, cache=C2)[0] if s in C2 else P['v1'][j] for j, s in enumerate(orig)])
res['ms_v1_noGPT_minus_CONV'] = contrast(V['ms'][d_noGPT] - V['ms'][P['CONV']])
# dropping the origins sent to the most frequent v1 destination
top_d = pd.Series(P['v1']).value_counts().index[0]; keep = P['v1'] != top_d
x = V['ms'][P['v1']] - V['ms'][P['CONV']]
res['ms_v1_minus_CONV_without_top_destination'] = float(np.nanmean(x[keep]))

# ------------------------------------------------------------------ RQ2 checks
uu = pd.DataFrame({'soc6': SOC6, 'pctl': EXP, 'emp': V['emp_post'], 'wage': V['wage_post'], 'dem': DEM}).drop_duplicates('soc6')
res['rq2_implied'] = {}
for v in ['emp', 'wage']:
    ok = uu[['pctl', v]].dropna(); b = float(np.polyfit(ok.pctl, ok[v], 1)[0])
    res['rq2_implied'][v] = {'slope_per_pctl': b, 'implied_v1_vs_CONV': b * float(np.mean(EXP[P['v1']] - EXP[P['CONV']])),
                             'implied_v2_vs_CONV': b * float(np.mean(EXP[P['v2']] - EXP[P['CONV']]))}
ok = uu[['dem', 'emp']].dropna(); res['demand_vs_emp_post_spearman'] = float(spearmanr(ok.dem, ok.emp)[0])
ev = pd.DataFrame({'soc6': SOC6, 'evid': EVID, 'emp': V['emp_post']}).drop_duplicates('soc6')
res['emp_post_by_posting_coverage'] = {'with': float(ev[ev.evid].emp.mean()), 'without': float(ev[~ev.evid].emp.mean())}
# employment-weighted robustness
res['weighted'] = {f'{v}|{a}-CONV': contrast(V[v][P[a]] - V[v][P['CONV']], W_ORIG[iv])
                   for v in ['ms', 'emp_post', 'wage_post'] for a in ['v1', 'v2']}

# ------------------------------------------------------------------ design screening and sensitivity (all reported)
screen = {}
Cg = build_cache(EXP, glob=True)
dg = np.array([rank(s, cache=Cg)[0] for s in orig]); screen['global_normalisation'] = {**concentration(dg), 'exp_reduction': float(-np.mean(EXP[dg] - EXP[P['CONV']]))}
emp_c = pd.Series(EMP[2022], index=SOC6).groupby(level=0).first()
for alpha in [1, 2, 3, 5]:
    tot = emp_c.sum()
    capf = lambda key, a=alpha: max(1, int(np.floor(a * len(orig) * np.nan_to_num(emp_c.get(key, np.nan), nan=emp_c.median()) / tot)))
    dp, un = plan(orig, capf)
    screen[f'employment_proportional_alpha{alpha}'] = {**concentration(dp), 'exp_reduction': float(-np.mean(EXP[dp] - EXP[P['CONV']])), 'unmatched': un}
ds = np.array([rank(s, (0.75, 0.25, 0.0, 0.0))[0] for s in orig])
screen['similarity_and_exposure_only'] = {**concentration(ds), 'exp_reduction': float(-np.mean(EXP[ds] - EXP[P['CONV']]))}
res['screened'] = screen
sens = []
for k in [2, 3, 4, 5, 6, 8, 10, 12, 15, 20, 30]:
    d, un = plan(orig, k); c = concentration(d)
    sens.append({'k': k, 'unmatched': un, 'distinct': c['distinct'], 'top10_share': c['top10_share'],
                 'top10_share_workers': c['top10_share_workers'],
                 'exp_diff': float(np.mean(EXP[d] - EXP[P['CONV']])), 'ms_diff': float(np.nanmean(V['ms'][d] - V['ms'][P['CONV']])),
                 'skill_sim': float(S[iv, d].mean())})
res['capacity_sensitivity'] = sens
res['threshold_sensitivity'] = []
for th in [-5.0, -10.0, -20.0]:
    d, _ = plan(orig, K, th=th)
    res['threshold_sensitivity'].append({'threshold': th, 'ms_diff': float(np.nanmean(V['ms'][d] - V['ms'][P['CONV']])),
                                         'emp_post_diff': float(np.nanmean(V['emp_post'][d] - V['emp_post'][P['CONV']]))})
res['v1_top_destination'] = {'title': m.title.values[top_d], 'n_origins': int((P['v1'] == top_d).sum()),
                             'emp_2015': float(EMP[2015][top_d]), 'emp_2019': float(EMP[2019][top_d]), 'emp_2024': float(EMP[2024][top_d]),
                             'has_postings': bool(EVID[top_d]), 'trend_2015_2019': float(TREND[top_d]), 'exposure_pctl': float(EXP[top_d]),
                             'origin_workers': float(W_ORIG[iv][P['v1'] == top_d].sum())}
ev_d = DEM[EVID]; res['share_with_postings_below_prior'] = float((ev_d < 30).mean())
res['share_declining_all'] = float(declining().mean() * 100); res['share_no_postings_all'] = float((~EVID).mean() * 100)
res['share_unknown_trend_all'] = float(np.isnan(TREND).mean() * 100)
res['postings_matched'] = {'us_total': float(m.n_us.sum()), 'my_total': float(m.n_my.sum()),
                           'us_median': float(m.n_us.median()), 'my_median': float(m.n_my.median())}

json.dump(res, open(os.path.join(OUT, 'results.json'), 'w'), indent=1, default=float)
pd.DataFrame(P).assign(origin=orig).to_csv(os.path.join(OUT, 'first_recommendations.csv'), index=False)
print(json.dumps({k: v for k, v in res.items() if k not in ('contrasts',)}, indent=1, default=float))
