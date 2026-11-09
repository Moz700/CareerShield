import { ReactNode, useEffect, useRef, useState } from 'react';
import { Link, NavLink, useLocation } from 'react-router-dom';
import { AnimatePresence, m as motion } from 'framer-motion';
import { useApp } from '../state/AppState';
import { Logo } from './ui';
import { IClose, IGear, IGithub, ILinkedin, IMail, IMenu, IMoon, ISun } from './Icons';
import { Key } from '../i18n';

import { AUTHOR, EMAIL, GITHUB_PROFILE, LINKEDIN, REPO, REPO_SHORT, VERSION } from '../config';

const LINKS: [string, Key][] = [
  ['/analyse', 'nav.analyse'],
  ['/moves', 'nav.moves'],
  ['/reskill', 'nav.reskill'],
  ['/atlas', 'nav.atlas'],
  ['/evidence', 'nav.evidence'],
  ['/report', 'nav.report'],
];

function Header() {
  const { t, lang, setLang, dark, setTheme, research } = useApp();
  const [open, setOpen] = useState(false);
  const loc = useLocation();
  useEffect(() => setOpen(false), [loc.pathname]);
  const links: [string, Key][] = research ? [...LINKS, ['/study', 'nav.study']] : LINKS;
  const item = ({ isActive }: { isActive: boolean }) =>
    `relative flex h-14 items-center px-3 text-sm font-medium transition-colors ${isActive ? 'text-ink' : 'text-muted hover:text-ink'}`;
  const tool = 'inline-flex h-9 items-center justify-center rounded-md border border-line bg-surface text-ink hover:bg-raised';
  return (
    <header className="site sticky top-0 z-40 border-b border-line bg-surface/95 backdrop-blur-sm">
      <div className="mx-auto flex h-14 max-w-page items-center gap-3 px-4 sm:px-6">
        <Link to="/" className="flex items-center gap-2.5 rounded-md" aria-label={t('nav.homeAria')}>
          <Logo size={26} />
          <span className="font-display text-[1.06rem] font-semibold tracking-tight">CareerShield</span>
        </Link>
        <nav className="ml-6 hidden items-center lg:flex" aria-label={t('nav.main')}>
          {links.map(([to, k]) => (
            <NavLink key={to} to={to} className={item}>
              {({ isActive }) => (
                <>
                  {t(k)}
                  {isActive && <motion.span layoutId="nav-mark" className="absolute inset-x-3 bottom-0 h-0.5 bg-brand" transition={{ type: 'spring', stiffness: 500, damping: 40 }} />}
                </>
              )}
            </NavLink>
          ))}
        </nav>
        <div className="ml-auto flex items-center gap-1.5">
          <button onClick={() => setLang(lang === 'en' ? 'ms' : 'en')} className={`${tool} px-2.5 font-mono text-xs`} title={t('shell.lang')}>
            <span aria-hidden="true">{t('shell.langShort')}</span>
            <span className="sr-only" lang={lang === 'en' ? 'ms' : 'en'}>
              {t('shell.lang')}
            </span>
          </button>
          <button onClick={() => setTheme(dark ? 'light' : 'dark')} className={`${tool} w-9`} aria-label={t('shell.theme')} title={t('shell.theme')}>
            {dark ? <ISun size={16} /> : <IMoon size={16} />}
          </button>
          <Link to="/settings" className={`${tool} hidden w-9 sm:inline-flex`} aria-label={t('nav.settings')} title={t('nav.settings')}>
            <IGear size={16} />
          </Link>
          <button className={`${tool} w-9 lg:hidden`} onClick={() => setOpen((o) => !o)} aria-expanded={open} aria-controls="mobile-nav" aria-label={open ? t('nav.close') : t('nav.menu')}>
            {open ? <IClose size={16} /> : <IMenu size={16} />}
          </button>
        </div>
      </div>
      <AnimatePresence>
        {open && (
          <motion.nav
            id="mobile-nav"
            aria-label={t('nav.main')}
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden border-t border-line bg-surface lg:hidden"
          >
            <div className="mx-auto grid max-w-page gap-0.5 px-4 py-3">
              {[...links, ['/settings', 'nav.settings'] as [string, Key]].map(([to, k]) => (
                <NavLink key={to} to={to} className={({ isActive }) => `rounded-md border-l-2 px-3 py-2.5 text-base font-medium ${isActive ? 'border-brand bg-raised text-ink' : 'border-transparent text-muted'}`}>
                  {t(k)}
                </NavLink>
              ))}
            </div>
          </motion.nav>
        )}
      </AnimatePresence>
      {research && (
        <div className="border-t border-warn/30 bg-warn/10 px-4 py-1.5 text-center text-xs font-semibold text-warn" role="note">
          {t('shell.researchBanner')}
        </div>
      )}
    </header>
  );
}

function Footer() {
  const { t } = useApp();
  const row = 'flex items-center gap-2 text-ink hover:text-brand';
  return (
    <footer className="site mt-24 border-t border-line bg-surface">
      <div className="mx-auto grid max-w-page gap-10 px-4 py-12 sm:px-6 md:grid-cols-[1.3fr_1fr_1fr]">
        <div>
          <div className="flex items-center gap-2.5">
            <Logo size={24} />
            <span className="font-display text-base font-semibold tracking-tight">CareerShield</span>
          </div>
          <p className="mt-3 max-w-sm text-sm text-muted">{t('footer.tagline')}</p>
          <p className="mt-3 max-w-sm text-xs leading-relaxed text-muted">{t('footer.disclaimer')}</p>
        </div>
        <div className="text-sm">
          <div className="eyebrow mb-3">{t('footer.researchHead')}</div>
          <p className="text-muted">{t('footer.research')}</p>
          <p className="mt-2 text-muted">{t('footer.authors')}</p>
          <p className="mt-2 text-muted">{t('footer.paper')}</p>
          <a href={REPO} target="_blank" rel="noreferrer" className={`${row} mt-3`}>
            <IGithub size={16} /> {REPO_SHORT}
          </a>
        </div>
        <div className="text-sm">
          <div className="eyebrow mb-3">{t('footer.builtBy')}</div>
          <p className="font-semibold text-ink">{AUTHOR}</p>
          <p className="mt-1 text-muted">{t('footer.role')}</p>
          <div className="mt-3 grid gap-2">
            <a href={GITHUB_PROFILE} target="_blank" rel="noreferrer" className={row}>
              <IGithub size={16} /> github.com/Moz700
            </a>
            <a href={LINKEDIN} target="_blank" rel="noreferrer" className={row}>
              <ILinkedin size={16} /> LinkedIn
            </a>
            <a href={`mailto:${EMAIL}`} className={`${row} break-all`}>
              <IMail size={16} /> {EMAIL}
            </a>
          </div>
        </div>
      </div>
      <div className="border-t border-line">
        <div className="mx-auto flex max-w-page flex-col gap-2 px-4 py-4 text-xs text-muted sm:flex-row sm:items-center sm:justify-between sm:px-6">
          <span>{t('footer.licence')}</span>
          <span className="font-mono">CareerShield {VERSION}</span>
        </div>
      </div>
    </footer>
  );
}

export function Layout({ children }: { children: ReactNode }) {
  const { t } = useApp();
  const loc = useLocation();
  const first = useRef(true);
  useEffect(() => {
    window.scrollTo({ top: 0 });
    // after an in-app navigation, move keyboard and screen-reader focus to the new page
    if (first.current) first.current = false;
    else document.getElementById('main')?.focus({ preventScroll: true });
  }, [loc.pathname]);
  return (
    <div className="flex min-h-screen flex-col">
      <a href="#main" className="skip-link btn-primary" onClick={(e) => { e.preventDefault(); document.getElementById('main')?.focus(); }}>
        {t('nav.skip')}
      </a>
      <Header />
      {/* at least one screen tall, so the footer never jumps into view while a page loads */}
      <main id="main" tabIndex={-1} className="min-h-[calc(100vh-3.5rem)] flex-1 outline-none">
        {children}
      </main>
      <Footer />
    </div>
  );
}
