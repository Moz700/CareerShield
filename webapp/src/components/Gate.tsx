import { ReactNode, useEffect, useState } from 'react';
import { useApp } from '../state/AppState';
import { hasParts, loadBundle, Part } from '../lib/data';

/** Renders its children once the core data and any extra parts they need have loaded. */
export function Gate({ children, need = [], fallback }: { children: ReactNode; need?: Part[]; fallback: ReactNode }) {
  const { data, error, t } = useApp();
  const key = need.join(',');
  // the parts attach to the shared bundle, so readiness is read from it on every render; the state
  // only triggers a render once a load finishes
  const [, setLoaded] = useState('');
  const [failed, setFailed] = useState(false);
  const ready = hasParts(data, need);
  useEffect(() => {
    if (!data || hasParts(data, need)) return;
    let live = true;
    loadBundle(need)
      .then(() => live && setLoaded(key))
      .catch(() => live && setFailed(true));
    return () => {
      live = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data, key]);
  if (error || failed)
    return (
      <div className="mx-auto max-w-xl p-12 text-center" role="alert">
        <p className="text-risk">{t('shell.loadError')}</p>
        <button className="btn-ghost mt-4" onClick={() => window.location.reload()}>
          {t('shell.reload')}
        </button>
      </div>
    );
  if (!data || !ready) return <>{fallback}</>;
  return <>{children}</>;
}
