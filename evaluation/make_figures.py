"""Figures 1-4 of the paper. Figure 1 is the research framework; Figures 2-4 are drawn from
evaluation/output/results.json and evaluation/output/first_recommendations.csv."""
import json, os, sys
import numpy as np, pandas as pd, matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt
ROOT = sys.argv[1] if len(sys.argv) > 1 else '.'
OUTD = os.path.join(ROOT, 'evaluation', 'output')
RES = json.load(open(os.path.join(OUTD, 'results.json')))
C = RES['contrasts']
INK, INK2, GRID, SURF = '#0b0b0b', '#52514e', '#e4e3df', '#ffffff'
BLUE, ORANGE, AQUA, GREY = '#2a78d6', '#eb6834', '#1baf7a', '#8a8984'
plt.rcParams.update({'font.family': 'DejaVu Sans', 'font.size': 8.5, 'axes.edgecolor': INK2, 'axes.labelcolor': INK,
                     'xtick.color': INK2, 'ytick.color': INK, 'axes.linewidth': 0.6, 'xtick.major.width': 0.6,
                     'figure.facecolor': SURF, 'axes.facecolor': SURF, 'savefig.dpi': 600, 'pdf.fonttype': 42})


# ---------------- Figure 1: research framework (design science research process, Peffers et al., 2007)
import textwrap
from matplotlib.patches import FancyBboxPatch
NAVY, PALE, LIGHT, EDGE = '#1f3864', '#dde6f0', '#f3f3f2', '#6b6a66'
stages = [
    ('1.  Problem identification and motivation',
     'Exposure-aware career advice is judged only on the scores it optimises; its effect on independent outcomes, and where it sends workers, are untested',
     'Sections 1–2', False),
    ('2.  Objectives of a solution',
     'Advice that lowers exposure as measured from observed AI use (RQ1), carries no labour-market cost (RQ2) and does not crowd workers into a few destinations (RQ3)',
     'Section 1', False),
    ('3.  Design and development',
     'CareerShield v1: composite exposure measure, MASCO crosswalk and four-criterion transition ranking. CareerShield v2: data guards and a deferred-acceptance capacity cap',
     'Sections 3.3–3.4, 3.7', True),
    ('4.  Demonstration',
     'First recommendation for each of 820 origin occupations under seven policies, including conventional O*NET advice and exposure-blind versions',
     'Section 3.6', False),
    ('5.  Evaluation',
     'Observed AI applicability, employment and wage change after ChatGPT, and concentration of advice across destinations, with cluster-bootstrap intervals',
     'Section 4', True),
    ('6.  Communication',
     'This article and an open repository holding the code, derived data and prototype',
     'Sections 5–6', False)]
fig, ax = plt.subplots(figsize=(6.6, 7.4)); ax.set_xlim(0, 100); ax.set_ylim(-1.5, 100); ax.axis('off')
H, GAP, TOP, X0, X1 = 12.8, 2.8, 99.0, 10, 82
ax.text(X1 + 2.5, TOP + 0.2, 'Reported in', fontsize=7.4, color=INK2, style='italic', va='bottom')
centres = []
for i, (head, body, sec, hi) in enumerate(stages):
    y1 = TOP - i * (H + GAP); y0 = y1 - H; centres.append((y0, y1))
    ax.add_patch(FancyBboxPatch((X0, y0), X1 - X0, H, boxstyle='round,pad=0,rounding_size=1.2',
                                fc=PALE if hi else LIGHT, ec=NAVY if hi else EDGE, lw=1.5 if hi else 0.8))
    ax.text((X0 + X1) / 2, y1 - 2.3, head, ha='center', va='center', fontsize=8.6, fontweight='bold', color=INK)
    ax.text((X0 + X1) / 2, y1 - 4.3, '\n'.join(textwrap.wrap(body, 66, break_on_hyphens=False)), ha='center', va='top', fontsize=7.1,
            color=INK, linespacing=1.3)
    ax.text(X1 + 2.5, (y0 + y1) / 2, sec, ha='left', va='center', fontsize=7.4, color=NAVY)
    if i:
        ax.annotate('', xy=((X0 + X1) / 2, y1), xytext=((X0 + X1) / 2, y1 + GAP),
                    arrowprops=dict(arrowstyle='-|>', color=EDGE, lw=1.0, mutation_scale=9))
(d0, d1), (e0, e1) = centres[2], centres[4]
xl = X0 - 4
ax.plot([X0, xl, xl], [(e0 + e1) / 2, (e0 + e1) / 2, (d0 + d1) / 2], color=NAVY, lw=1.2)
ax.annotate('', xy=(X0, (d0 + d1) / 2), xytext=(xl, (d0 + d1) / 2),
            arrowprops=dict(arrowstyle='-|>', color=NAVY, lw=1.2, mutation_scale=10))
ax.text(xl - 1.6, ((d0 + d1) / 2 + (e0 + e1) / 2) / 2, 'v1 evaluation leads to v2 design',
        rotation=90, ha='center', va='center', fontsize=7.2, color=NAVY, style='italic')
fy1 = centres[-1][0] - 2.4
ax.add_patch(FancyBboxPatch((3, fy1 - 6.0), 94, 6.0, boxstyle='round,pad=0,rounding_size=1.2', fc=PALE, ec=NAVY, lw=1.3))
ax.text(50, fy1 - 3.0, 'Evaluation strategy (Venable et al., 2016): v1 summative, against conventional advice;\n'
        'v2 formative, designed after inspecting v1 on the same origins', ha='center', va='center', fontsize=7.4,
        color=INK, linespacing=1.35)
fig.savefig(os.path.join(OUTD, 'Figure1_research_framework.png'), bbox_inches='tight')
fig.savefig(os.path.join(OUTD, 'Figure1_research_framework.pdf'), bbox_inches='tight')
plt.close(fig)

# ---------------- Figure 2: paired differences from conventional advice
rows = [('SIM', 'Skill similarity only', AQUA, True), ('v1-BLIND', 'v1, exposure term removed', BLUE, False),
        ('v1', 'CareerShield v1', BLUE, True), ('v2-BLIND', 'v2, exposure term removed', ORANGE, False),
        ('v2', 'CareerShield v2', ORANGE, True)]
panels = [('exp', '(a) Composite exposure', 'ranking objective', 'percentile points'),
          ('ms', '(b) Observed AI applicability', 'not used in ranking', 'score × 100'),
          ('emp_post', '(c) Employment 2022–24', 'not used in ranking', 'log points'),
          ('wage_post', '(d) Median wage 2022–24', 'not used in ranking', 'log points')]
fig, axes = plt.subplots(1, 4, figsize=(7.8, 2.8), sharey=True, gridspec_kw={'wspace': 0.22})
y = np.arange(len(rows))[::-1]
for ax, (v, title, tag, unit) in zip(axes, panels):
    ax.axvline(0, color=GREY, lw=0.8, zorder=1)
    for yy, (k, lab, col, filled) in zip(y, rows):
        c = C[f'{v}|{k}-CONV']
        ax.plot([c['lo'], c['hi']], [yy, yy], color=col, lw=2, solid_capstyle='round', zorder=2)
        ax.plot(c['diff'], yy, 'o', ms=6.5, mfc=col if filled else SURF, mec=col, mew=1.6, zorder=3)
    ax.set_title(title, fontsize=7.7, color=INK, loc='left', pad=14)
    ax.text(0, 1.015, tag, transform=ax.transAxes, fontsize=7.2, color=INK2, style='italic', va='bottom')
    ax.set_xlabel(unit, fontsize=7.5, color=INK2)
    ax.grid(axis='x', color=GRID, lw=0.6); ax.set_axisbelow(True)
    for s in ['top', 'right', 'left']: ax.spines[s].set_visible(False)
    ax.tick_params(axis='y', length=0); ax.set_ylim(-0.6, len(rows) - 0.4)
axes[0].set_yticks(y); axes[0].set_yticklabels([r[1] for r in rows])
fig.text(0.60, -0.09, 'Paired difference from conventional O*NET advice across 820 origin occupations (95% cluster-bootstrap intervals)',
         ha='center', fontsize=7.8, color=INK2)
fig.savefig(os.path.join(OUTD, 'Figure2_independent_outcomes.png'), bbox_inches='tight')
fig.savefig(os.path.join(OUTD, 'Figure2_independent_outcomes.pdf'), bbox_inches='tight')

P = RES['policies']; K = RES['cap_K']

# ---------------- Figure 3: share of origins taken by the most frequent destinations
m = pd.read_csv(os.path.join(ROOT, 'artifacts', 'occupations_master.csv'), usecols=['soc6'])
FR = pd.read_csv(os.path.join(OUTD, 'first_recommendations.csv'))
fig, ax = plt.subplots(figsize=(4.7, 3.3))
N = 40; xs = np.arange(1, N + 1)
for key, lab, col, ls in [('v1', 'CareerShield v1', BLUE, '-'), ('v1-BLIND', 'v1, exposure term removed', BLUE, '--'),
                          ('v2', f'CareerShield v2 (cap {K})', ORANGE, '-'), ('CONV', 'Conventional O*NET advice', GREY, '-')]:
    vc = pd.Series(m.soc6.values[FR[key].values]).value_counts().values
    cum = np.cumsum(vc)[:N] / len(FR) * 100
    assert abs(cum[9] - P[key]['top10_share']) < 1e-6
    ax.step(xs, cum, where='post', color=col, lw=2, ls=ls, label=lab)
ax.axvline(10, color=GREY, lw=0.8, ls=':', zorder=0)
ax.text(10.6, 1.5, 'ten destinations', fontsize=7, color=INK2)
ax.set_xlabel('Destinations, ranked by number of origin occupations received', color=INK)
ax.set_ylabel('Cumulative share of the 820 origins (%)', color=INK)
ax.set_xlim(0.5, N + 0.5); ax.set_ylim(0, 64)
ax.grid(color=GRID, lw=0.6); ax.set_axisbelow(True)
for s in ['top', 'right']: ax.spines[s].set_visible(False)
ax.legend(frameon=False, fontsize=7.2, loc='upper left', handlelength=2.6)
fig.savefig(os.path.join(OUTD, 'Figure3_concentration_curves.png'), bbox_inches='tight')
fig.savefig(os.path.join(OUTD, 'Figure3_concentration_curves.pdf'), bbox_inches='tight')
plt.close(fig)

# ---------------- Figure 4: concentration against the reduction in observed applicability
P = RES['policies']; K = RES['cap_K']
fig, ax = plt.subplots(figsize=(4.7, 3.4))
sens = pd.DataFrame(RES['capacity_sensitivity'])
ax.plot(sens.top10_share, sens.ms_diff, '-', color=ORANGE, lw=1.6, alpha=0.5, zorder=1)
ax.plot(sens.top10_share, sens.ms_diff, 'o', ms=4, color=ORANGE, alpha=0.5, zorder=2)
for k, off, ha in [(2, (-6, -1), 'right'), (30, (0, -11), 'center')]:
    r = sens[sens.k == k].iloc[0]
    ax.annotate(f'cap {k}', (r.top10_share, r.ms_diff), xytext=off, textcoords='offset points', fontsize=7, color=INK2, ha=ha)
def pt(key, lab, col, filled, off, marker='o', ci=False):
    x = P[key]['top10_share']; yv = 0.0 if key == 'CONV' else C[f'ms|{key}-CONV']['diff']
    if ci:
        c = C[f'ms|{key}-CONV']; ax.plot([x, x], [c['lo'], c['hi']], color=col, lw=1.6, zorder=3)
    ax.plot(x, yv, marker, ms=7 if key in ('v1', 'v2') else 6, mfc=col if filled else SURF,
            mec=col if key != 'CONV' else INK2, mew=1.6, zorder=4)
    ha = 'right' if off[0] < -3 else ('center' if off[0] <= 0 else 'left')
    ax.annotate(lab, (x, yv), xytext=off, textcoords='offset points', fontsize=7.2, color=INK, ha=ha, va='center')
pt('CONV', 'Conventional O*NET advice', GREY, True, (0, 13))
pt('SIM', 'Skill similarity\nonly', AQUA, True, (-2, -17))
pt('v1-BLIND', 'v1, exposure\nterm removed', BLUE, False, (9, 0))
pt('v1', 'CareerShield v1', BLUE, True, (-9, -12), ci=True)
pt('v1+guards', 'v1 + guards (no cap)', BLUE, True, (-7, 10), marker='D')
pt('v2-BLIND', 'v2, exposure\nterm removed', ORANGE, False, (9, -9))
pt('v2', f'CareerShield v2 (cap {K})', ORANGE, True, (-9, -9), ci=True)
ax.axhline(0, color=GREY, lw=0.8, zorder=0)
ax.set_xlabel('Origins sent to the 10 most-recommended destinations (%)', color=INK)
ax.set_ylabel('Difference in observed AI applicability\nfrom conventional advice (score × 100)', color=INK)
ax.grid(color=GRID, lw=0.6); ax.set_axisbelow(True)
for s in ['top', 'right']: ax.spines[s].set_visible(False)
ax.set_xlim(0, 32); ax.set_ylim(-5.2, 1.3)
fig.savefig(os.path.join(OUTD, 'Figure4_concentration_tradeoff.png'), bbox_inches='tight')
fig.savefig(os.path.join(OUTD, 'Figure4_concentration_tradeoff.pdf'), bbox_inches='tight')
print('figures written')
