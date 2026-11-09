import { createContext, ReactNode, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { LazyMotion, MotionConfig } from 'framer-motion';

// Components use framer-motion's lightweight m elements (imported as motion); the animation
// features they need arrive in a separate chunk after the first paint.
const motionFeatures = () => import('../lib/motionFeatures').then((r) => r.default);
import { Bundle, loadBundle } from '../lib/data';
import { Key, Lang, translate } from '../i18n';
import { MatchPath } from '../lib/matcher';
import { W_V1, Weights } from '../lib/ranking';
import { readStore, removeStore, writeStore } from '../lib/storage';
import { Session, ACTIVE_KEY } from '../lib/research';

export type ThemePref = 'system' | 'light' | 'dark';
export type Policy = 'v2' | 'v1' | 'CONV';

interface Selection {
  origin: number | null;
  path: MatchPath | null;
  query: string;
  dest: number | null;
}

interface Ctx {
  data: Bundle | null;
  error: boolean;
  lang: Lang;
  setLang: (l: Lang) => void;
  t: (k: Key, v?: Record<string, string | number>) => string;
  theme: ThemePref;
  setTheme: (t: ThemePref) => void;
  dark: boolean;
  reduced: boolean;
  motionPref: 'full' | 'reduced';
  setMotionPref: (m: 'full' | 'reduced') => void;
  sel: Selection;
  selectOrigin: (i: number, path: MatchPath, query?: string) => void;
  selectDest: (j: number | null) => void;
  policy: Policy;
  setPolicy: (p: Policy) => void;
  weights: Weights;
  setWeights: (w: Weights) => void;
  research: boolean;
  setResearch: (on: boolean) => void;
  study: Session | null;
  setStudy: (s: Session | null) => void;
  clearAll: () => void;
}

const AppCtx = createContext<Ctx | null>(null);

function systemDark() {
  try {
    return window.matchMedia('(prefers-color-scheme: dark)').matches;
  } catch {
    return false;
  }
}

function systemReduced() {
  try {
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  } catch {
    return false;
  }
}

const EMPTY: Selection = { origin: null, path: null, query: '', dest: null };

export function AppProvider({ children }: { children: ReactNode }) {
  const [data, setData] = useState<Bundle | null>(null);
  const [error, setError] = useState(false);
  const [lang, setLangS] = useState<Lang>(() => readStore<Lang>('cs.lang', 'en'));
  // black is the default; light and the system setting are choices in Settings
  const [theme, setThemeS] = useState<ThemePref>(() => readStore<ThemePref>('cs.themePref', 'dark'));
  const [sysDark, setSysDark] = useState(systemDark);
  const [motionPref, setMotionPrefS] = useState<'full' | 'reduced'>(() => readStore('cs.motion', systemReduced() ? 'reduced' : 'full'));
  const [sel, setSel] = useState<Selection>(() => readStore<Selection>('cs.selection', EMPTY));
  const [policy, setPolicyS] = useState<Policy>(() => readStore<Policy>('cs.policy', 'v2'));
  const [weights, setWeightsS] = useState<Weights>(() => readStore<Weights>('cs.weights', W_V1));
  const [research, setResearchS] = useState<boolean>(() => readStore('cs.research', false));
  const [study, setStudyS] = useState<Session | null>(() => readStore<Session | null>(ACTIVE_KEY, null));

  useEffect(() => {
    // the data starts loading once the first frame has painted, so the page's own code, styles and
    // fonts get the network first
    let live = true;
    const start = () =>
      loadBundle()
        .then((b) => {
          if (!live) return;
          setData(b);
          setSel((s) => (s.origin != null && (s.origin < 0 || s.origin >= b.occ.length) ? EMPTY : s));
        })
        .catch(() => live && setError(true));
    const raf = typeof requestAnimationFrame === 'function' ? requestAnimationFrame(() => window.setTimeout(start, 0)) : (start(), 0);
    return () => {
      live = false;
      if (raf) cancelAnimationFrame(raf);
    };
  }, []);

  useEffect(() => {
    try {
      const mq = window.matchMedia('(prefers-color-scheme: dark)');
      const on = () => setSysDark(mq.matches);
      mq.addEventListener('change', on);
      return () => mq.removeEventListener('change', on);
    } catch {
      return undefined;
    }
  }, []);

  const dark = theme === 'dark' || (theme === 'system' && sysDark);
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', dark ? 'dark' : 'light');
    writeStore('cs.theme', theme);
  }, [dark, theme]);

  useEffect(() => {
    document.documentElement.lang = lang === 'ms' ? 'ms' : 'en';
  }, [lang]);

  const setLang = useCallback((l: Lang) => {
    setLangS(l);
    writeStore('cs.lang', l);
  }, []);
  const setTheme = useCallback((tp: ThemePref) => {
    setThemeS(tp);
    writeStore('cs.themePref', tp);
  }, []);
  const setMotionPref = useCallback((m: 'full' | 'reduced') => {
    setMotionPrefS(m);
    writeStore('cs.motion', m);
  }, []);
  const selectOrigin = useCallback((i: number, path: MatchPath, query = '') => {
    const s = { origin: i, path, query, dest: null };
    setSel(s);
    writeStore('cs.selection', s);
  }, []);
  const selectDest = useCallback((j: number | null) => {
    setSel((s) => {
      const n = { ...s, dest: j };
      writeStore('cs.selection', n);
      return n;
    });
  }, []);
  const setPolicy = useCallback((p: Policy) => {
    setPolicyS(p);
    writeStore('cs.policy', p);
  }, []);
  const setWeights = useCallback((w: Weights) => {
    setWeightsS(w);
    writeStore('cs.weights', w);
  }, []);
  const setResearch = useCallback((on: boolean) => {
    setResearchS(on);
    writeStore('cs.research', on);
  }, []);
  const setStudy = useCallback((s: Session | null) => {
    setStudyS(s);
    if (s) writeStore(ACTIVE_KEY, s);
    else removeStore(ACTIVE_KEY);
  }, []);
  const clearAll = useCallback(() => {
    ['cs.lang', 'cs.themePref', 'cs.theme', 'cs.motion', 'cs.selection', 'cs.policy', 'cs.weights', 'cs.research'].forEach(removeStore);
    setSel(EMPTY);
    setPolicyS('v2');
    setWeightsS(W_V1);
    setResearchS(false);
    setThemeS('dark');
    setLangS('en');
  }, []);

  const t = useCallback((k: Key, v?: Record<string, string | number>) => translate(lang, k, v), [lang]);
  const reduced = motionPref === 'reduced';

  const value = useMemo<Ctx>(
    () => ({
      data,
      error,
      lang,
      setLang,
      t,
      theme,
      setTheme,
      dark,
      reduced,
      motionPref,
      setMotionPref,
      sel,
      selectOrigin,
      selectDest,
      policy,
      setPolicy,
      weights,
      setWeights,
      research,
      setResearch,
      study,
      setStudy,
      clearAll,
    }),
    [data, error, lang, setLang, t, theme, setTheme, dark, reduced, motionPref, setMotionPref, sel, selectOrigin, selectDest, policy, setPolicy, weights, setWeights, research, setResearch, study, setStudy, clearAll],
  );

  return (
    <AppCtx.Provider value={value}>
      <LazyMotion features={motionFeatures}>
        <MotionConfig reducedMotion={reduced ? 'always' : 'never'}>{children}</MotionConfig>
      </LazyMotion>
    </AppCtx.Provider>
  );
}

export function useApp() {
  const c = useContext(AppCtx);
  if (!c) throw new Error('useApp outside provider');
  return c;
}
