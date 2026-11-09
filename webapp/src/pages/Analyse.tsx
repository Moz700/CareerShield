import { useRef } from 'react';
import { useApp } from '../state/AppState';
import { PageHead } from '../components/ui';
import { Finder } from '../components/Finder';
import { MatchHit } from '../lib/matcher';
import { Results } from './Results';
import { Gate } from '../components/Gate';

export function Analyse() {
  const { data, t, sel, selectOrigin } = useApp();
  const resultsRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLDivElement>(null);

  const choose = (h: MatchHit, query: string, confirm: boolean) => {
    selectOrigin(h.i, h.path, query);
    if (confirm) window.setTimeout(() => resultsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 120);
  };

  if (!data) return null;
  return (
    <div className="mx-auto max-w-page px-4 py-10 sm:px-6">
      <PageHead title={t('an.title')} lead={t('an.lead')} />
      <div ref={inputRef} className="card p-5 sm:p-7">
        <Finder selected={sel.origin} onSelect={choose} />
      </div>

      <div ref={resultsRef} className="scroll-mt-24">
        {sel.origin != null && (
          <Gate need={['skills']} fallback={<div className="card skel mt-10 h-72" role="status" aria-label={t('shell.loading')} />}>
            <Results
              onChange={() => {
                inputRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
                (document.getElementById('title-input') as HTMLInputElement | null)?.focus();
              }}
            />
          </Gate>
        )}
      </div>
    </div>
  );
}
