import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useApp, ThemePref } from '../state/AppState';
import { PageHead, Segmented } from '../components/ui';
import { IAlert, IArrow } from '../components/Icons';
import { Lang } from '../i18n';
import { VERSION } from '../config';

export function Settings() {
  const { t, lang, setLang, theme, setTheme, motionPref, setMotionPref, research, setResearch, data, clearAll } = useApp();
  const [cleared, setCleared] = useState(false);
  const row = (label: string, control: JSX.Element, note?: JSX.Element | string) => (
    <div className="flex flex-col gap-3 border-b border-line py-5 last:border-0 sm:flex-row sm:items-start sm:justify-between">
      <div className="max-w-md">
        <div className="font-semibold">{label}</div>
        {note && <div className="mt-1 text-sm text-muted">{note}</div>}
      </div>
      <div className="shrink-0">{control}</div>
    </div>
  );
  return (
    <div className="mx-auto max-w-3xl px-4 py-10 sm:px-6">
      <PageHead title={t('st.title')} />
      <div className="card px-5 sm:px-7">
        {row(
          t('st.language'),
          <Segmented<Lang> label={t('st.language')} value={lang} onChange={setLang} options={[{ value: 'en', label: 'English' }, { value: 'ms', label: 'Bahasa Malaysia' }]} />,
        )}
        {row(
          t('st.theme'),
          <Segmented<ThemePref>
            label={t('st.theme')}
            value={theme}
            onChange={setTheme}
            options={[
              { value: 'system', label: t('st.system') },
              { value: 'light', label: t('st.light') },
              { value: 'dark', label: t('st.dark') },
            ]}
          />,
        )}
        {row(
          t('st.motion'),
          <Segmented<'full' | 'reduced'> label={t('st.motion')} value={motionPref} onChange={setMotionPref} options={[{ value: 'full', label: t('st.motionOn') }, { value: 'reduced', label: t('st.motionOff') }]} />,
        )}
        {row(
          t('st.research'),
          <Segmented<'on' | 'off'> label={t('st.research')} value={research ? 'on' : 'off'} onChange={(v) => setResearch(v === 'on')} options={[{ value: 'off', label: t('st.off') }, { value: 'on', label: t('st.on') }]} />,
          <>
            {t('st.researchLead')}
            <span className="mt-2 flex items-start gap-2 font-semibold text-warn">
              <IAlert size={16} className="mt-0.5 shrink-0" /> {t('st.researchWarn')}
            </span>
            {research && (
              <Link to="/study" className="btn-ghost mt-3">
                {t('nav.study')} <IArrow />
              </Link>
            )}
          </>,
        )}
        {data &&
          row(
            t('st.data'),
            <span className="chip">{data.meta.public ? t('st.dataPublic') : t('st.dataLocal')}</span>,
            `${t('st.version')} ${VERSION} · ${data.meta.built} · ${data.meta.nOccupations} ${t('st.occupations')}`,
          )}
        {row(
          t('st.clear'),
          <button
            className="btn-ghost"
            onClick={() => {
              clearAll();
              setCleared(true);
            }}
          >
            {cleared ? t('st.cleared') : t('st.clear')}
          </button>,
        )}
      </div>
    </div>
  );
}
