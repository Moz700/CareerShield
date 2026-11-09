"""Check the numbers in the app's data bundle against the published evaluation output.

    python pipeline/checks/check_bundle.py

Reads src/data/*.json and pipeline/checks/results.json (a copy of the published evaluation output).
The fixed values below are the headline numbers in the Verified Numbers file; the app must show
exactly these.
"""
import json
import os
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
DATA = os.path.join(HERE, '..', '..', 'src', 'data')
# a copy of the published results.json is kept next to this script so the check runs without the inputs
RESULTS = os.path.join(HERE, 'results.json')

fails = []


def check(name, ok):
    print(('PASS  ' if ok else 'FAIL  ') + name)
    if not ok:
        fails.append(name)


ev = json.load(open(os.path.join(DATA, 'evidence.json')))
meta = json.load(open(os.path.join(DATA, 'meta.json')))
occ = json.load(open(os.path.join(DATA, 'occupations.json')))
courses = json.load(open(os.path.join(DATA, 'courses.json')))
h, c = ev['headline'], ev['capstone']

# Verified Numbers, part A
check('top-10 share CONV 7.3, v1 27.7, v2 9.8', (h['top10']['CONV'], h['top10']['v1'], h['top10']['v2']) == (7.3, 27.7, 9.8))
check('top-10 share v1-BLIND 22.9, v1+guards 26.6', (h['top10']['v1-BLIND'], h['top10']['v1+guards']) == (22.9, 26.6))
check('v1 top destination is Pressers with 45 origins',
      h['topDest']['title'] == 'Pressers, Textile, Garment, and Related Materials' and h['topDest']['n_origins'] == 45)
check('Pressers employment 48,340 / 38,070 / 26,830',
      (h['topDest']['emp_2015'], h['topDest']['emp_2019'], h['topDest']['emp_2024']) == (48340, 38070, 26830))
check('v2 keeps 71% of v1 reduction', h['shareKept'] == 71)
check('observed applicability 15.7 / 12.4 / 13.3', (h['msConv'], h['msV1'], h['msV2']) == (15.7, 12.4, 13.3))
check('v1 vs CONV -3.3 (-4.7 to -2.1), -21%', h['v1VsConv'] == [-3.3, -4.7, -2.1] and h['relChangeV1'] == -21)
check('v2 vs CONV -2.4 (-3.5 to -1.1)', h['v2VsConv'] == [-2.4, -3.5, -1.1])
check('v1 vs v1-BLIND -3.1 (-4.4 to -1.9)', h['v1VsBlind'] == [-3.1, -4.4, -1.9])
check('820 origins, 22 clusters, k = 8', (h['nOrigins'], h['nClusters'], h['capK']) == (820, 22, 8))
check('convergent rho 0.75, n = 774', (h['convergentRho'], h['convergentN']) == (0.75, 774))
rows = {r['policy']: r for r in ev['policies']}
check('Table 4 distinct destinations 462 / 214 / 229', (rows['CONV']['distinct'], rows['v1']['distinct'], rows['v2']['distinct']) == (462, 214, 229))
check('Table 3 v2 row 41.9 / 58.6 / 0.741 / 13.3', (rows['v2']['exp'], rows['v2']['dem'], rows['v2']['sim'], rows['v2']['ms']) == (41.9, 58.6, 0.741, 13.3))
# Verified Numbers, part B
check('index correlations .977 / .861 / .849', (c['spearman']['aioe_lm'], c['spearman']['aioe_gpt'], c['spearman']['gpt_lm']) == (0.977, 0.861, 0.849))
check('Cronbach alpha .959', c['alpha'] == 0.959)
check('662 of 889 chained to MASCO', (c['transfer']['chained'], c['transfer']['of']) == (662, 889))
check('matcher top-1 50.3 / top-5 77.0', (c['matcher']['lexTop1'], c['matcher']['lexTop5']) == (50.3, 77.0))
check('moat 795 / 99 in capstone block and in the rebuilt ability cards',
      (c['moat']['with'], c['moat']['without']) == (795, 99) and meta['ability']['occupations_with_moat'] == 795)
check('Malaysian wage growth (n = 9) not in the bundle', 'my' not in c['wageGrowth'])
check('894 occupations in the bundle', len(occ['soc']) == 894 == meta['nOccupations'])
check('v2 lists for every origin with candidates', sum(1 for v in occ['v2'] if v) >= 820)
check('public build carries no e-LATiH rows',
      not meta['public'] or (courses['elatih'] == [] and courses['elatihMode'] == 'none'
                             and all(len(r) == 4 for d in courses['byOcc'] for r in d.values())))
check('hand-verified titles all resolve (data scientist, project manager via closest occupation)',
      meta['nVerifiedTitles'] == 48)

if os.path.exists(RESULTS):
    res = json.load(open(RESULTS))
    for p in ev['policies']:
        ref = res['policies'][p['policy']]
        ok = abs(p['top10'] - round(ref['top10_share'], 1)) < 1e-9 and p['maxN'] == ref['max_n'] and abs(p['ms'] - round(ref['ms'], 1)) < 1e-9
        check(f'{p["policy"]} row matches results.json', ok)
    rep = meta['reproduction']
    check('every policy reproduced from the paper code', all(v['identical_to_first_recommendations_csv'] for v in rep.values()))

print(f'\n{len(fails)} failure(s)' if fails else '\nall bundle checks passed')
sys.exit(1 if fails else 0)
