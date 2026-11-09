"""Run the paper's evaluation code unchanged and compare its output with the published output.

    python pipeline/checks/reproduce_paper.py            full run, 5,000 bootstrap replications (about 40 s)

The script links the inputs into a scratch folder, runs evaluation/independent_evaluation.py there
and requires every value in results.json, confidence intervals included, and every row of
first_recommendations.csv to match the published files.
"""
import json
import os
import shutil
import subprocess
import sys
import tempfile

HERE = os.path.dirname(os.path.abspath(__file__))
REPO = os.path.join(HERE, '..', 'inputs', 'CareerShield')
PUB = os.path.join(REPO, 'evaluation', 'output')


def compare(a, b, path=''):
    """Return a list of paths where two JSON trees differ (floats compared to 1e-9)."""
    out = []
    if isinstance(b, dict):
        for k in b:
            if k not in a:
                out.append(path + k + ' (missing)')
            else:
                out += compare(a[k], b[k], f'{path}{k}.')
    elif isinstance(b, list):
        if len(a) != len(b):
            out.append(path + ' (length)')
        for i, (x, y) in enumerate(zip(a, b)):
            out += compare(x, y, f'{path}{i}.')
    elif isinstance(b, float) or isinstance(a, float):
        if abs(float(a) - float(b)) > 1e-9:
            out.append(f'{path} {a} != {b}')
    elif a != b:
        out.append(f'{path} {a!r} != {b!r}')
    return out


def main():
    root = tempfile.mkdtemp(prefix='cs-repro-')
    try:
        for d in ('artifacts', 'data'):
            os.symlink(os.path.abspath(os.path.join(REPO, d)), os.path.join(root, d))
        script = os.path.join(REPO, 'evaluation', 'independent_evaluation.py')
        subprocess.run([sys.executable, script, '--root', root, '--boot', '5000'], check=True,
                       stdout=subprocess.DEVNULL)
        out = os.path.join(root, 'evaluation', 'output')
        diffs = compare(json.load(open(os.path.join(out, 'results.json'))),
                        json.load(open(os.path.join(PUB, 'results.json'))))
        same_csv = open(os.path.join(out, 'first_recommendations.csv')).read() == \
            open(os.path.join(PUB, 'first_recommendations.csv')).read()
    finally:
        shutil.rmtree(root, ignore_errors=True)
    if diffs or not same_csv:
        print('REPRODUCTION FAILED')
        for d in diffs[:20]:
            print('  ', d)
        if not same_csv:
            print('   first_recommendations.csv differs')
        sys.exit(1)
    print('PASS  paper code reproduces every value in results.json and first_recommendations.csv')


if __name__ == '__main__':
    main()
