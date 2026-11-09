"""TF-IDF retrieval index over word unigrams, word bigrams and character 4-grams.

Same features, weights and scoring as the LexIndex class in the original CareerShield pipeline
(app.py, section 7.1), stored as a sparse matrix so large catalogues fit in memory. The browser
matcher in src/lib/lexindex.ts implements the identical arithmetic.
"""
import math
import re

import numpy as np
from scipy import sparse


def feats(s, char_n=4):
    s = str(s).lower()
    w = re.findall(r'[a-z0-9]+', s)
    f = list(w) + [f'{a}_{b}' for a, b in zip(w, w[1:])]
    c = ' ' + re.sub(r'[^a-z0-9 ]', '', s) + ' '
    f += [c[i:i + char_n] for i in range(max(0, len(c) - char_n + 1))]
    return f


class LexIndex:
    def __init__(self, max_terms=200000, char_n=4):
        self.max_terms, self.char_n = max_terms, char_n

    def fit(self, keys, docs):
        self.keys = list(keys)
        counts, dfreq = [], {}
        for d in docs:
            cc = {}
            for t in feats(d, self.char_n):
                cc[t] = cc.get(t, 0) + 1
            counts.append(cc)
            for t in cc:
                dfreq[t] = dfreq.get(t, 0) + 1
        keep = sorted(dfreq.items(), key=lambda kv: -kv[1])[:self.max_terms]
        self.vocab = {t: i for i, (t, _) in enumerate(keep)}
        n = len(counts)
        self.idf = np.zeros(len(self.vocab), dtype=np.float64)
        for t, i in self.vocab.items():
            self.idf[i] = math.log((1 + n) / (1 + dfreq[t])) + 1
        rows, cols, vals = [], [], []
        for r, cc in enumerate(counts):
            for t, v in cc.items():
                i = self.vocab.get(t)
                if i is not None:
                    rows.append(r); cols.append(i); vals.append((1 + math.log(v)) * self.idf[i])
        M = sparse.csr_matrix((vals, (rows, cols)), shape=(n, len(self.vocab)), dtype=np.float64)
        norms = np.sqrt(np.asarray(M.multiply(M).sum(axis=1)).ravel()) + 1e-9
        self.M = sparse.diags(1.0 / norms) @ M
        self.MT = self.M.T.tocsr()
        return self

    def query_vec(self, text):
        cc = {}
        for t in feats(text, self.char_n):
            cc[t] = cc.get(t, 0) + 1
        ii, vv = [], []
        for t, v in cc.items():
            i = self.vocab.get(t)
            if i is not None:
                ii.append(i); vv.append((1 + math.log(v)) * self.idf[i])
        return ii, vv

    def scores(self, text):
        ii, vv = self.query_vec(text)
        if not ii:
            return np.zeros(len(self.keys))
        v = np.asarray(vv); v /= np.linalg.norm(v) + 1e-9
        return np.asarray(self.M[:, ii] @ v).ravel()

    def scores_many(self, texts):
        """Scores for many queries at once: returns a dense (n_queries, n_docs) array."""
        rows, cols, vals = [], [], []
        for r, t in enumerate(texts):
            ii, vv = self.query_vec(t)
            if not ii:
                continue
            v = np.asarray(vv); v /= np.linalg.norm(v) + 1e-9
            rows += [r] * len(ii); cols += ii; vals += list(v)
        Q = sparse.csr_matrix((vals, (rows, cols)), shape=(len(texts), len(self.vocab)))
        return np.asarray((Q @ self.MT).todense())

    def top(self, text, k=5):
        s = self.scores(text)
        o = np.argsort(-s, kind='stable')[:k]
        return [(self.keys[i], float(s[i])) for i in o]
