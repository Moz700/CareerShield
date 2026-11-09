import { lazy, ReactNode, Suspense, useEffect, useRef } from 'react';
import { HashRouter, Route, Routes, useLocation } from 'react-router-dom';
import { AnimatePresence, m as motion } from 'framer-motion';
import { AppProvider, useApp } from './state/AppState';
import { Layout } from './components/Layout';
import { PageSkeleton } from './components/ui';
import { Part } from './lib/data';
import { Gate } from './components/Gate';
import { Key } from './i18n';
import { Home } from './pages/Home';

// Every page except Home is split into its own chunk.
const Analyse = lazy(() => import('./pages/Analyse').then((m) => ({ default: m.Analyse })));
const Moves = lazy(() => import('./pages/Moves').then((m) => ({ default: m.Moves })));
const Reskill = lazy(() => import('./pages/Reskill').then((m) => ({ default: m.Reskill })));
const Atlas = lazy(() => import('./pages/Atlas').then((m) => ({ default: m.Atlas })));
const Evidence = lazy(() => import('./pages/Evidence').then((m) => ({ default: m.Evidence })));
const Report = lazy(() => import('./pages/Report').then((m) => ({ default: m.Report })));
const Settings = lazy(() => import('./pages/Settings').then((m) => ({ default: m.Settings })));
const Study = lazy(() => import('./pages/Study').then((m) => ({ default: m.Study })));


/**
 * A lazy page: while its code and data load, the placeholder already shows the page's heading,
 * so the first meaningful paint does not wait for the data.
 */
function Page({ children, need, title, lead, core = true }: { children: ReactNode; need?: Part[]; title: Key; lead?: Key; core?: boolean }) {
  const { t } = useApp();
  const fallback = <PageSkeleton label={t('shell.loading')} title={t(title)} lead={lead ? t(lead) : undefined} />;
  return (
    <Suspense fallback={fallback}>
      {core ? (
        <Gate need={need} fallback={fallback}>
          {children}
        </Gate>
      ) : (
        children
      )}
    </Suspense>
  );
}

function Routed() {
  const loc = useLocation();
  const { t, sel } = useApp();
  // pages about the chosen occupation show a prompt without one, and need no extra data for it
  const forOrigin = (need: Part[]): Part[] => (sel.origin != null ? need : []);
  // the first page paints at once; later navigations fade in
  const first = useRef(true);
  useEffect(() => {
    first.current = false;
  }, []);
  return (
    <AnimatePresence mode="wait">
      <motion.div
        key={loc.pathname}
        initial={first.current ? false : { opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -4 }}
        transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
      >
        <Suspense fallback={<PageSkeleton label={t('shell.loading')} />}>
          <Routes location={loc}>
            <Route path="/" element={<Home />} />
            <Route path="/analyse" element={<Page title="an.title" lead="an.lead"><Analyse /></Page>} />
            <Route path="/moves" element={<Page title="mv.title" need={forOrigin(['skills'])}><Moves /></Page>} />
            <Route path="/reskill" element={<Page title="rs.title" need={forOrigin(['courses', 'skills'])}><Reskill /></Page>} />
            <Route path="/atlas" element={<Page title="at.title" lead="at.lead"><Atlas /></Page>} />
            <Route path="/evidence" element={<Page title="ev.title" lead="ev.lead"><Evidence /></Page>} />
            <Route path="/report" element={<Page title="rp.title" need={forOrigin(['courses', 'skills'])}><Report /></Page>} />
            <Route path="/settings" element={<Page title="st.title" core={false}><Settings /></Page>} />
            <Route path="/study" element={<Page title="sd.title" need={['skills', 'desc']}><Study /></Page>} />
            <Route path="*" element={<Home />} />
          </Routes>
        </Suspense>
      </motion.div>
    </AnimatePresence>
  );
}

/** ?study=1 (before or after the hash) switches study mode on; ?study=0 switches it off. */
function StudyParam() {
  const { setResearch } = useApp();
  useEffect(() => {
    try {
      const q = new URLSearchParams(window.location.search);
      const h = window.location.hash.includes('?') ? new URLSearchParams(window.location.hash.split('?')[1]) : null;
      const v = q.get('study') ?? h?.get('study');
      if (v === '1' || v === 'on') setResearch(true);
      if (v === '0' || v === 'off') setResearch(false);
    } catch {
      /* ignore malformed URLs */
    }
  }, [setResearch]);
  return null;
}

export function App() {
  return (
    <AppProvider>
      <HashRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
        <StudyParam />
        <Layout>
          <Routed />
        </Layout>
      </HashRouter>
    </AppProvider>
  );
}
