"""Build the data bundle used by the CareerShield web app.

Reads the public CareerShield repository (artifacts, O*NET files, BLS OEWS files, evaluation
output) and the two course catalogues, and writes compact JSON files to src/data/.

    python pipeline/build_data.py            local build with e-LATiH and Coursera courses
    python pipeline/build_data.py --public   public build: Coursera courses only

The e-LATiH catalogue was compiled by the research team from HRD Corp's platform and is not
redistributed, so the public build (the one committed to the repository and deployed online)
leaves every e-LATiH row out. Run the public build before committing src/data.

Paths default to pipeline/inputs/CareerShield (a clone of github.com/Moz700/CareerShield with the
raw data in place) and pipeline/inputs/courses (elatih_courses.csv and Coursera.csv).
"""
import argparse
import contextlib
import io
import json
import os
import re
import runpy
import shutil
import sys
import tempfile
import time
import warnings

import numpy as np
import pandas as pd

warnings.filterwarnings('ignore')
HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
from lexindex import LexIndex  # noqa: E402
from titles_my import APP_PROXY, HAND_VERIFIED, MALAYSIAN_TITLES, PROXY  # noqa: E402

ap = argparse.ArgumentParser()
ap.add_argument('--repo', default=os.path.join(HERE, 'inputs', 'CareerShield'))
ap.add_argument('--courses', default=os.path.join(HERE, 'inputs', 'courses'))
ap.add_argument('--third-party', default=os.path.join(HERE, 'inputs', 'third_party'))
ap.add_argument('--out', default=os.path.join(HERE, '..', 'src', 'data'))
ap.add_argument('--public', action='store_true', help='public build: no e-LATiH rows (Coursera only)')
ap.add_argument('--no-elatih', action='store_true', help='leave the e-LATiH catalogue out of a local build')
ap.add_argument('--boot', type=int, default=2, help='bootstrap replications for the paper code run')
ap.add_argument('--lexical', action='store_true', help='force lexical course matching')
args = ap.parse_args()

R = args.repo
ART, RAW = os.path.join(R, 'artifacts'), os.path.join(R, 'data', 'raw')
OD = os.path.join(RAW, 'onet')
OUT = os.path.abspath(args.out)
CHECK = os.path.join(HERE, 'checks')
os.makedirs(OUT, exist_ok=True); os.makedirs(CHECK, exist_ok=True)
T0 = time.time()


def log(*a):
    print(f'[{time.time() - T0:6.1f}s]', *a, flush=True)


def norm_title(s):
    """Title normaliser of the original pipeline (app.py, section 5.1)."""
    s = str(s).lower().strip()
    s = re.sub(r'\s*[-(,/|@].*', '', s)
    s = re.sub(r'\b(senior|junior|lead|principal|assistant|associate|sr|jr|ii|iii|iv|executive)\b', '', s)
    return re.sub(r'\s+', ' ', s).strip()


def rnd(v, d):
    if v is None or (isinstance(v, float) and not np.isfinite(v)):
        return None
    return round(float(v), d)


def dump(name, obj):
    p = os.path.join(OUT, name)
    with open(p, 'w', encoding='utf-8') as f:
        json.dump(obj, f, ensure_ascii=False, separators=(',', ':'), allow_nan=False)
    log(f'wrote {name:22s} {os.path.getsize(p) / 1024:8.1f} KB')


# ====================================================================== inputs
log('reading inputs from', R)
m = pd.read_csv(os.path.join(ART, 'occupations_master.csv'))
skill_mat = pd.read_csv(os.path.join(ART, 'skill_matrix.csv'), index_col=0)
related = pd.read_excel(os.path.join(OD, 'Related Occupations.xlsx'))
abil_raw = pd.read_excel(os.path.join(OD, 'Abilities.xlsx'))
tasks = pd.read_excel(os.path.join(OD, 'Task Statements.xlsx'))
alt = pd.read_excel(os.path.join(OD, 'Sample of Reported Titles.xlsx'))
jt = pd.read_excel(os.path.join(OD, 'Job Titles.xlsx'))
results = json.load(open(os.path.join(R, 'evaluation', 'output', 'results.json')))
first_rec = pd.read_csv(os.path.join(R, 'evaluation', 'output', 'first_recommendations.csv'))
msft = (pd.read_csv(os.path.join(R, 'data', 'third_party', 'ai_applicability_scores.csv'))
        .rename(columns={'SOC Code': 'soc6', 'ai_applicability_score': 'ms'}))
N = len(m)
M_IDX = {s: i for i, s in enumerate(m.onet_soc)}
OUR_SOC = set(m.soc6)
log(f'master table {N} occupations, skill matrix {skill_mat.shape}')

# ====================================================================== the paper's own evaluation code
# evaluation/independent_evaluation.py is executed unchanged in a scratch root that links to the
# inputs, so the v1 ranking, the guards and the deferred-acceptance plan used by the app are the
# paper's functions, not a re-implementation. Bootstrap replications only affect confidence
# intervals, which the app reads from the published results.json, so a short run is enough here;
# pipeline/checks/reproduce_paper.py runs the full 5,000 replications and compares every value.
PAPER = os.path.join(R, 'evaluation', 'independent_evaluation.py')


def run_paper(boot):
    root = tempfile.mkdtemp(prefix='cs-paper-')
    for d in ('artifacts', 'data'):
        os.symlink(os.path.abspath(os.path.join(R, d)), os.path.join(root, d))
    argv = sys.argv
    sys.argv = [PAPER, '--root', root, '--boot', str(boot)]
    try:
        with contextlib.redirect_stdout(io.StringIO()):
            g = runpy.run_path(PAPER, run_name='paper_evaluation')
    finally:
        sys.argv = argv
    shutil.rmtree(root, ignore_errors=True)
    return g


G = run_paper(args.boot)
log(f'paper evaluation code executed ({args.boot} bootstrap replications)')
M_IDX, CACHE, S, SOC6 = G['M_IDX'], G['CACHE'], G['S'], G['SOC6']
EXP, MS, EMP, TREND, EVID = G['EXP'], G['MS'], G['EMP'], G['TREND'], G['EVID']
REL, REL_TOP, orig, K, P = G['REL'], G['REL_TOP'], G['orig'], G['K'], G['P']
rank, declining, W_V1 = G['rank'], G['declining'], G['W_V1']
SM = skill_mat.loc[m.onet_soc].values


def top10_share(d):
    vc = pd.Series(SOC6[d]).value_counts()
    return float(vc.head(10).sum() / len(d) * 100), int(vc.iloc[0]), m.title.values[d][SOC6[d] == vc.index[0]][0]


# ---- reproduction checks against the published output
checks = {}
assert len(orig) == results['n_origins'] == 820, 'evaluation sample differs from results.json'
assert K == results['cap_K'] == 8
for k, d in P.items():
    share, mx, mt = top10_share(d)
    ref = results['policies'][k]
    checks[k] = {'top10_share': round(share, 2), 'published': round(ref['top10_share'], 2),
                 'largest_group': mx, 'published_largest': ref['max_n'],
                 'distinct': int(pd.Series(SOC6[d]).nunique()), 'published_distinct': ref['distinct'],
                 'identical_to_first_recommendations_csv': bool((first_rec[k].values == d).all())}
    assert abs(share - ref['top10_share']) < 1e-9, f'{k}: top-10 share {share} vs {ref["top10_share"]}'
    assert mx == ref['max_n'] and checks[k]['distinct'] == ref['distinct']
    assert checks[k]['identical_to_first_recommendations_csv'], f'{k} differs from first_recommendations.csv'
    for v, arr in [('exp', EXP), ('ms', MS)]:
        assert abs(float(np.nanmean(arr[d])) - ref[v]) < 1e-9, f'{k}: {v} mean differs'
assert top10_share(P['v1'])[2] == 'Pressers, Textile, Garment, and Related Materials'
assert top10_share(P['v1'])[1] == 45
log('reproduction check passed: ' + ', '.join(f'{k} {v["top10_share"]:.1f}%' for k, v in checks.items()))
json.dump(checks, open(os.path.join(CHECK, 'v2_reproduction.json'), 'w'), indent=1)

# ---- v2 advice per origin for the app
held_count = pd.Series(SOC6[P['v2']]).value_counts().to_dict()  # origins held per destination in the joint plan
v2_first = dict(zip(orig, P['v2']))
v2_lists, v2_kind = {}, {}
for soc in m.onet_soc:
    if soc not in CACHE:
        continue
    guarded = list(rank(soc, guards=True))
    if soc in v2_first:
        first = int(v2_first[soc]); kind = 'plan'
    else:
        # origins outside the evaluation sample: first guarded option whose destination still has room
        room = [c for c in guarded if held_count.get(SOC6[c], 0) < K]
        first = int((room or guarded)[0]); kind = 'residual'
    alts = [int(c) for c in guarded if c != first and held_count.get(SOC6[c], 0) < K and SOC6[c] != SOC6[first]]
    v2_lists[soc] = [first] + alts[:7]
    v2_kind[soc] = kind
log(f'v2 lists: {sum(1 for k in v2_kind.values() if k == "plan")} from the joint plan, '
    f'{sum(1 for k in v2_kind.values() if k == "residual")} residual origins')

# v1 top-10 per origin, used to test the browser port of the ranking
v1_top = {soc: [int(x) for x in rank(soc)[:10]] for soc in CACHE}
json.dump(v1_top, open(os.path.join(CHECK, 'v1_top10.json'), 'w'))

# ====================================================================== ability exposure
# Ability-level AI exposure from Felten, Raj and Seamans (2021), Appendix E of the AIOE data
# appendix, joined to O*NET ability importance by ability name exactly as in app.py section 7.4.
# If the appendix is missing, the 52 scores are recovered by a regularised least-squares fit of
# occupation AIOE on O*NET ability weights (level x importance) and the build says so.
AIOE_X = os.path.join(args.third_party, 'AIOE_DataAppendix.xlsx')
fam_map = (abil_raw[['Element ID', 'Element Name']].drop_duplicates().set_index('Element Name')['Element ID']
           .str[:5].map({'1.A.1': 'Cognitive', '1.A.2': 'Psychomotor', '1.A.3': 'Physical', '1.A.4': 'Sensory'}))
if os.path.exists(AIOE_X):
    ae = pd.read_excel(AIOE_X, sheet_name='Appendix E', header=None, skiprows=1, names=['ability', 'x'])
    abil_exp = ae.set_index('ability').x
    ability_source, fit_r2 = 'published', None
else:
    imp = abil_raw[abil_raw['Scale ID'] == 'IM'].pivot_table(index='O*NET-SOC Code', columns='Element Name', values='Data Value')
    lvl = abil_raw[abil_raw['Scale ID'] == 'LV'].pivot_table(index='O*NET-SOC Code', columns='Element Name', values='Data Value')
    Wab = imp * lvl; Wab = Wab.div(Wab.sum(axis=1), axis=0); Wab['soc6'] = Wab.index.str[:7]
    W6 = Wab.groupby('soc6').mean()
    yA = m.drop_duplicates('soc6').set_index('soc6').aioe.dropna()
    ix = yA.index.intersection(W6.index)
    Xa, Ya = W6.loc[ix].values, yA.loc[ix].values
    coef = np.linalg.solve(Xa.T @ Xa + 1e-3 * np.eye(Xa.shape[1]), Xa.T @ Ya)
    fit_r2 = round(float(1 - ((Ya - Xa @ coef) ** 2).sum() / ((Ya - Ya.mean()) ** 2).sum()), 4)
    abil_exp = pd.Series(coef, index=W6.columns)
    abil_exp = (abil_exp - abil_exp.mean()) / abil_exp.std()
    ability_source = 'reconstructed'
    log('WARNING: AIOE_DataAppendix.xlsx not found, ability exposure reconstructed (fit R2', fit_r2, ')')
neg = abil_exp[abil_exp < 0]
imL = abil_raw[abil_raw['Scale ID'] == 'IM'][['O*NET-SOC Code', 'Element Name', 'Data Value']]
imL = imL.assign(e=imL['Element Name'].map(abil_exp))
moat_occ = set(imL[(imL['Data Value'] >= 3.0) & (imL.e < 0)]['O*NET-SOC Code'])
n_moat = sum(s in moat_occ for s in m.onet_soc)
ability_meta = {'source': ability_source, 'fit_r2': fit_r2, 'n_scored': int(abil_exp.notna().sum()),
                'n_resistant': int(len(neg)),
                'resistant_by_family': {k: int(v) for k, v in neg.index.map(fam_map).value_counts().items()},
                'occupations_with_moat': int(n_moat), 'occupations_without_moat': int(N - n_moat)}
if ability_source == 'published':
    # capstone, Verified Numbers part B: 795 of 894 occupations show at least one genuine moat
    assert n_moat == 795, f'moat count {n_moat}, expected 795'
log('ability exposure', ability_meta)

# ====================================================================== skills and abilities
elements = list(skill_mat.columns)
ab_names = set(abil_raw['Element Name'])
element_family = []
ks = set(pd.read_excel(os.path.join(OD, 'Knowledge.xlsx'))['Element Name'])
for e in elements:
    element_family.append('ability' if e in ab_names else 'knowledge' if e in ks else 'skill')
teachable = [f != 'ability' for f in element_family]
skills_out = {
    'elements': elements,
    'family': element_family,
    'abilityExposure': [rnd(abil_exp.get(e), 3) if f == 'ability' else None for e, f in zip(elements, element_family)],
    'abilityFamily': [fam_map.get(e) if f == 'ability' else None for e, f in zip(elements, element_family)],
}
# Importance x 1000 is stored element by element (all occupations for the first element, then the
# next), as steps above the smallest value. The browser rebuilds the exact integers; this layout
# compresses about a fifth better than occupation-major raw values.
_imp = np.rint(SM * 1000).astype(np.int64)
_base = int(_imp.min())
_step = int(np.gcd.reduce((_imp - _base).ravel())) or 1
_q = (_imp - _base) // _step
assert np.array_equal(_base + _step * _q, _imp)
skills_out.update({
    'impLayout': 'element-major',
    'impBase': _base,
    'impStep': _step,
    'importance': [int(v) for v in _q.T.ravel()],
})

# ====================================================================== conventional lists and crowding
# Conventional advice as a ranked list: O*NET related occupations in O*NET's own order (Primary-Short
# first). The first entry is the paper's CONV recommendation; later entries skip the origin's own
# SOC-6, repeated SOC-6 codes and occupations without an exposure score.
rel_sorted = related.sort_values(['O*NET-SOC Code', 'Index'])
conv_lists = {}
for soc, g in rel_sorted.groupby('O*NET-SOC Code'):
    if soc not in M_IDX:
        continue
    i, out, seen = M_IDX[soc], [], set()
    if soc in REL_TOP.index and REL_TOP[soc] in M_IDX:
        j = M_IDX[REL_TOP[soc]]; out.append(j); seen.add(SOC6[j])
    for q in g['Related O*NET-SOC Code']:
        j = M_IDX.get(q)
        if j is None or np.isnan(EXP[j]) or SOC6[j] == SOC6[i] or SOC6[j] in seen:
            continue
        out.append(int(j)); seen.add(SOC6[j])
        if len(out) >= 8:
            break
    conv_lists[soc] = [int(x) for x in out]


def inflow(d):
    """Evaluation origins whose first recommendation lands on each SOC-6 code."""
    vc = pd.Series(SOC6[d]).value_counts()
    return [int(vc.get(s, 0)) for s in m.soc6]


# ====================================================================== occupations
grp = {1.0: 1, 2.0: 2, 3.0: 3, 4.0: 4, 5.0: 5, 6.0: 6, 7.0: 7, 8.0: 8, 9.0: 9, 0.0: 0}
rel_ps = related[related['Relatedness Tier'] == 'Primary-Short']
occ = {
    'soc': m.onet_soc.tolist(), 'soc6': m.soc6.tolist(), 'title': m.title.tolist(),
    'exp': [rnd(v, 3) for v in m.exposure], 'pctl': [rnd(v, 4) for v in m.exposure_pctl],
    'aioe': [rnd(v, 3) for v in m.aioe], 'gpt': [rnd(v, 3) for v in m.gpt_beta], 'lm': [rnd(v, 3) for v in m.lm_aioe],
    'isco4': [None if pd.isna(v) else int(v) for v in m.isco4], 'iscoTitle': [None if pd.isna(v) else v for v in m.isco_title],
    'isco1': [grp.get(v) if not pd.isna(v) else None for v in m.isco1],
    'jz': [int(v) for v in m['Job Zone']],
    'nUs': [None if pd.isna(v) else int(v) for v in m.n_us], 'nMy': [None if pd.isna(v) else int(v) for v in m.n_my],
    'sal': [rnd(v, 2) for v in m.salary_myr], 'salObs': [1 if s == 'JobStreet median' else 0 for s in m.salary_source],
    'rmN': [None if pd.isna(v) else int(v) for v in m.rm_n],
    'dem': [rnd(v, 4) for v in m.demand_pctl], 'demMy': [rnd(v, 1) for v in m.demand_my_pctl],
    'demUs': [rnd(v, 1) for v in m.demand_us_pctl],
    'tier': [None if pd.isna(v) else v for v in m.growth_tier], 'moat': [rnd(v, 1) for v in m.moat_pctl],
    'evid': [int(v) for v in EVID], 'dec': [int(v) for v in declining()], 'trend': [rnd(v, 1) for v in TREND],
    'emp24': [None if not np.isfinite(v) else int(v) for v in EMP[2024]],
    'ms': [rnd(v, 1) for v in MS],
    'related': [[M_IDX[q] for q in sorted(REL.get(s, set())) if q in M_IDX] for s in m.onet_soc],
    'conv': [int(M_IDX[REL_TOP[s]]) if s in REL_TOP.index and REL_TOP[s] in M_IDX else None for s in m.onet_soc],
    'v2': [v2_lists.get(s) for s in m.onet_soc],
    'convList': [conv_lists.get(s) for s in m.onet_soc],
    'inConv': inflow(P['CONV']), 'inV1': inflow(P['v1']), 'inV2': inflow(P['v2']),
    'v2kind': [v2_kind.get(s) for s in m.onet_soc],
    'inSample': [1 if s in v2_first else 0 for s in m.onet_soc],
}

# O*NET descriptions are only needed by the title matcher, the atlas detail panel and the study, so
# they live in their own file and stay out of the data every page loads.
descriptions = {'desc': m.description.fillna('').tolist()}

# ====================================================================== matcher text and dictionaries
alt_g = alt.groupby('O*NET-SOC Code')['Reported Job Title'].apply(lambda s: [str(x) for x in s])
jt_g = jt.groupby('O*NET-SOC Code')['Job Title'].apply(lambda s: [str(x) for x in s.head(60)])
task_g = tasks.groupby('O*NET-SOC Code')['Task'].apply(lambda s: [str(x) for x in s.head(8)])
matcher = {
    'alt': [alt_g.get(s, []) for s in m.onet_soc],
    'jt': [jt_g.get(s, []) for s in m.onet_soc],
    'tasks': [task_g.get(s, []) for s in m.onet_soc],
}

verified, approx, dropped = {}, {}, []
for k, v in HAND_VERIFIED.items():
    key = norm_title(k)
    if not key:
        continue
    if v in M_IDX:
        verified[key] = [M_IDX[v], k]
    elif v in PROXY and PROXY[v][0] in M_IDX:
        verified[key] = [M_IDX[PROXY[v][0]], k]; approx[key] = PROXY[v][1]
    elif v in APP_PROXY and APP_PROXY[v][0] in M_IDX:
        verified[key] = [M_IDX[APP_PROXY[v][0]], k]; approx[key] = APP_PROXY[v][1]
    else:
        dropped.append(k)
malay, collisions, bad = {}, [], []
for k, v in MALAYSIAN_TITLES.items():
    key = norm_title(k)
    if len(key) < 3:
        bad.append(k); continue
    if v not in M_IDX:
        bad.append(k); continue
    if key in verified:
        if verified[key][0] != M_IDX[v]:
            collisions.append((k, key))
        continue
    if key in malay and malay[key][0] != M_IDX[v]:
        collisions.append((k, key)); continue
    malay.setdefault(key, [M_IDX[v], k])
log(f'hand-verified titles {len(verified)} ({len(approx)} via proxy), dropped {len(dropped)}: {", ".join(dropped)}')
log(f'Malaysian title dictionary {len(malay)} keys; unusable {bad}; shadowed {collisions}')
matcher['verified'] = verified
matcher['approx'] = approx
matcher['malay'] = malay

# the documents the lexical index is built on, so the browser port can be checked
occ_docs = [f"{t} {' '.join(a)} {' '.join(j)} {d} {' '.join(tk)}"
            for t, a, j, d, tk in zip(m.title, matcher['alt'], matcher['jt'], m.description.fillna(''), matcher['tasks'])]
OCC_LEX = LexIndex().fit(m.onet_soc.tolist(), occ_docs)
probe = ['accountant preparing financial statements', 'business analyst building Power BI dashboards and forecasts',
         'lorry driver', 'data analyst', 'registered nurse in a hospital ward', 'kerani', 'chef', 'teacher']
json.dump({q: [[M_IDX[s], round(v, 4)] for s, v in OCC_LEX.top(q, 5)] for q in probe},
          open(os.path.join(CHECK, 'matcher_probe.json'), 'w'), indent=1)
log(f'lexical occupation index {OCC_LEX.M.shape}')

# ====================================================================== courses
CR = args.courses
USE_MY = not (args.no_elatih or args.public)
my_cat = pd.read_csv(os.path.join(CR, 'elatih_courses.csv')) if USE_MY else pd.DataFrame(columns=['Course Name', 'Category'])
my_cat['Category'] = my_cat['Category'].fillna('')
my_cat['doc'] = (my_cat['Course Name'].fillna('') + '. ' + my_cat['Category']).str.strip()
cr = pd.read_csv(os.path.join(CR, 'Coursera.csv'))
cr['doc'] = (cr['Course Name'].fillna('') + '. ' + cr['Skills'].fillna(''))
log(f'course catalogues: {len(my_cat)} e-LATiH, {len(cr)} Coursera')

queries, qkeys = [], []
for i, soc in enumerate(m.onet_soc):
    for j, e in enumerate(elements):
        if teachable[j] and SM[i, j] >= 3.0:
            queries.append(f'{e} skills for {m.title.iloc[i]}'); qkeys.append((i, j))
log(f'{len(queries)} course queries (teachable elements rated 3 or more, per destination)')

method = 'lexical'
if not args.lexical:
    try:
        from sentence_transformers import SentenceTransformer
        st = SentenceTransformer('paraphrase-multilingual-MiniLM-L12-v2')
        method = 'semantic'
    except Exception as ex:  # pragma: no cover
        log('sentence encoder unavailable, using the lexical index:', type(ex).__name__)


CACHE_DIR = os.path.join(HERE, '.cache'); os.makedirs(CACHE_DIR, exist_ok=True)


def encode(texts, tag):
    import hashlib
    h = hashlib.sha1(('\n'.join(texts)).encode('utf-8')).hexdigest()[:16]
    p = os.path.join(CACHE_DIR, f'{tag}_{h}.npy')
    if os.path.exists(p):
        return np.load(p)
    E_ = st.encode(texts, normalize_embeddings=True, batch_size=256, show_progress_bar=False).astype(np.float32)
    np.save(p, E_)
    return E_


QE = encode(queries, 'queries') if method == 'semantic' else None


def best_matches(docs, tag, k=2):
    if method == 'semantic':
        D = encode(docs, tag)
        top_i, top_s = [], []
        for a in range(0, len(QE), 4096):
            sc = QE[a:a + 4096] @ D.T
            o = np.argsort(-sc, axis=1)[:, :k]
            top_i.append(o); top_s.append(np.take_along_axis(sc, o, axis=1))
        return np.vstack(top_i), np.vstack(top_s)
    lex = LexIndex(max_terms=120000).fit(list(range(len(docs))), docs)
    top_i, top_s = [], []
    for a in range(0, len(queries), 2000):
        sc = lex.scores_many(queries[a:a + 2000])
        o = np.argsort(-sc, axis=1)[:, :k]
        top_i.append(o); top_s.append(np.take_along_axis(sc, o, axis=1))
    return np.vstack(top_i), np.vstack(top_s)


cr_i, cr_s = best_matches(cr.doc.tolist(), 'coursera')
log(f'Coursera matched ({method})')
if USE_MY:
    my_i, my_s = best_matches(my_cat.doc.tolist(), 'elatih')
    log(f'e-LATiH matched ({method})')

used_my, used_cr = {}, {}


def cid(store, i):
    if i not in store:
        store[i] = len(store)
    return store[i]


by_occ = [dict() for _ in range(N)]
for q, (i, j) in enumerate(qkeys):
    rec = [cid(used_cr, int(cr_i[q, 0])), rnd(cr_s[q, 0], 3), cid(used_cr, int(cr_i[q, 1])), rnd(cr_s[q, 1], 3)]
    if USE_MY:
        rec += [cid(used_my, int(my_i[q, 0])), rnd(my_s[q, 0], 3), cid(used_my, int(my_i[q, 1])), rnd(my_s[q, 1], 3)]
    by_occ[i][j] = rec


def course_rows(df, store, cols):
    inv = sorted(store.items(), key=lambda kv: kv[1])
    return [[str(df.iloc[i][c]) if not pd.isna(df.iloc[i][c]) else '' for c in cols] for i, _ in inv]


courses = {
    'method': method, 'public': bool(args.public), 'elatihMode': 'full' if USE_MY else 'none',
    'coursera': course_rows(cr, used_cr, ['Course Name', 'University', 'Course URL', 'Difficulty Level']),
    'elatih': [] if not USE_MY else course_rows(my_cat, used_my, ['Course Name', 'url', 'Category', 'Price']),
    'byOcc': [{str(j): r for j, r in d.items()} for d in by_occ],
    'minRel': 0.10, 'myBonus': 0.05, 'kGaps': 5,
}

# ====================================================================== evaluation data for the Evidence page
pol = results['policies']
order = ['CONV', 'SIM', 'v1-BLIND', 'v1', 'v1+guards', 'v2-BLIND', 'v2']


def curve(d, n=40):
    vc = pd.Series(SOC6[d]).value_counts().values
    return [round(float(vc[:k].sum() / len(d) * 100), 2) for k in range(1, n + 1)]


ct = results['contrasts']
forest = {}
for v in ['exp', 'ms', 'emp_post', 'wage_post']:
    forest[v] = [{'policy': a, **{kk: round(ct[f'{v}|{a}-CONV'][kk], 3) for kk in ['diff', 'lo', 'hi']}}
                 for a in ['SIM', 'v1-BLIND', 'v1', 'v1+guards', 'v2-BLIND', 'v2']]
evid = {
    'policies': [{'policy': k, 'exp': round(pol[k]['exp'], 1), 'dem': round(pol[k]['dem'], 1),
                  'sim': round(pol[k]['skill_sim'], 3), 'ms': round(pol[k]['ms'], 1),
                  'emp': round(pol[k]['emp_post'], 1), 'wage': round(pol[k]['wage_post'], 1),
                  'distinct': pol[k]['distinct'], 'top10': round(pol[k]['top10_share'], 1), 'maxN': pol[k]['max_n'],
                  'maxTitle': pol[k]['max_title'], 'top10w': round(pol[k]['top10_share_workers'], 1),
                  'noPost': round(pol[k]['no_postings_pct'], 1), 'declined': round(pol[k]['declining_pct'], 1)}
                 for k in order],
    'curves': {k: curve(P[k]) for k in ['CONV', 'v1-BLIND', 'v1', 'v2']},
    'forest': forest,
    'capacity': [{'k': r['k'], 'top10': round(r['top10_share'], 1), 'msReduction': round(-r['ms_diff'], 2),
                  'distinct': r['distinct']} for r in results['capacity_sensitivity']],
    'headline': {
        'nOrigins': results['n_origins'], 'nClusters': results['n_clusters'], 'capK': results['cap_K'],
        'msConv': round(results['ms_paired_v1']['conv'], 1), 'msV1': round(pol['v1']['ms'], 1), 'msV2': round(pol['v2']['ms'], 1),
        'v1VsConv': [round(ct['ms|v1-CONV'][k], 1) for k in ['diff', 'lo', 'hi']],
        'v2VsConv': [round(ct['ms|v2-CONV'][k], 1) for k in ['diff', 'lo', 'hi']],
        'v1VsBlind': [round(ct['ms|v1-v1-BLIND'][k], 1) for k in ['diff', 'lo', 'hi']],
        'empV1VsConv': [round(ct['emp_post|v1-CONV'][k], 1) for k in ['diff', 'lo', 'hi']],
        'wageV1VsConv': [round(ct['wage_post|v1-CONV'][k], 1) for k in ['diff', 'lo', 'hi']],
        'relChangeV1': round(results['ms_paired_v1']['rel_change'] * 100),
        'relChangeV2': round(results['ms_paired_v2']['rel_change'] * 100),
        'shareKept': round(ct['ms|v2-CONV']['diff'] / ct['ms|v1-CONV']['diff'] * 100),
        'shareLowerV1': round(results['ms_paired_v1']['share_lower'] * 100),
        'top10': {k: round(pol[k]['top10_share'], 1) for k in order},
        'topDest': results['v1_top_destination'],
        'convergentRho': round(results['convergent']['rho'], 2), 'convergentN': results['convergent']['n'],
        'transferV1Blind': [round(results['transfer']['v1-v1-BLIND'][k], 2) for k in ['ratio', 'lo', 'hi']],
    },
    # Capstone validation numbers (Verified Numbers, Part B); these come from the full pipeline run
    'capstone': {
        'coverage': {'aioe': 773, 'gpt': 798, 'lm': 774, 'all3': 682, 'composite': 889, 'master': 894},
        'spearman': {'aioe_lm': 0.977, 'aioe_gpt': 0.861, 'gpt_lm': 0.849, 'n': 682}, 'alpha': 0.959,
        'looMin': 0.978,
        'construct': {'Verbal': 0.817, 'Cognitive': 0.393, 'Sensory': -0.604, 'Psychomotor': -0.868, 'Physical': -0.906, 'n': 774},
        'transfer': {'chained': 662, 'of': 889, 'pct': 74.5, 'ambiguous': 137, 'ambOf': 698, 'tieAgree': 91.8},
        'payLevel': {'us': 0.511, 'usN': 756, 'my': 0.433, 'myN': 232},
        # Malaysian wage growth (n = 9 major groups, not significant) is deliberately left out
        'wageGrowth': {'us': -0.491, 'usN': 669},
        'demand': {'us': 0.306, 'usN': 728, 'my': 0.390, 'myN': 539, 'agree': 0.655, 'agreeN': 512},
        'salaryModel': {'r2': 0.381, 'mae': 16.8, 'n': 232, 'heurR2': -0.042, 'heurMae': 28.8, 'heurN': 178},
        'matcher': {'lexTop1': 50.3, 'lexTop5': 77.0, 'semTop1': 30.9, 'semTop5': 55.4},
        'moat': {'with': 795, 'without': 99},
        'tierAuc': 0.835,
        'prePost': {'expFrom': 50.0, 'expTo': 37.5, 'demFrom': 41.8, 'demTo': 56.9, 'lessExposed': 80.0, 'both': 52.4, 'n': 820},
        'courses': {'elatih': 2127},
        'postings': {'jobstreet': 69024, 'linkedin': 123849}, 'msCodes': 785,
    },
}

meta = {
    'built': time.strftime('%Y-%m-%d'), 'public': bool(args.public), 'courseMethod': method,
    'nOccupations': N, 'ability': ability_meta, 'reproduction': checks,
    'nMalayTitles': len(malay), 'nVerifiedTitles': len(verified), 'elatihMode': courses['elatihMode'],
    'iscoNames': {'1': 'Managers', '2': 'Professionals', '3': 'Technicians and associate professionals',
                  '4': 'Clerical support workers', '5': 'Service and sales workers',
                  '6': 'Skilled agricultural, forestry and fishery workers', '7': 'Craft and related trades workers',
                  '8': 'Plant and machine operators and assemblers', '9': 'Elementary occupations', '0': 'Armed forces'},
}

dump('occupations.json', occ)
dump('descriptions.json', descriptions)
dump('skills.json', skills_out)
dump('matcher.json', matcher)
dump('courses.json', courses)
dump('evidence.json', evid)
dump('meta.json', meta)
total = sum(os.path.getsize(os.path.join(OUT, f)) for f in os.listdir(OUT) if f.endswith('.json'))
log(f'bundle total {total / 1024 / 1024:.2f} MB')
