import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { getShot, shotFallback, shotLocation, shots, shotSrc, spaceName } from '../lib/data';
import { useI18n } from '../lib/i18n';
import { floorLabel } from './TopBar';

/** Full-screen viewer for the interior shot named in ?shot=<id>. Arrow keys move, Esc closes. */
export default function ShotViewer({ onContact }: { onContact: (subject: string) => void }) {
  const [params, setParams] = useSearchParams();
  const { lang, t, tx } = useI18n();
  const shot = getShot(params.get('shot'));
  const [showPlan, setShowPlan] = useState(false);
  const [loaded, setLoaded] = useState(false);

  const list = shot ? shots.filter((s) => s.id.split('-')[0] === shot.id.split('-')[0]) : [];
  const idx = shot ? list.findIndex((s) => s.id === shot.id) : -1;
  const go = (id?: string) => {
    const p = new URLSearchParams(params);
    if (id) p.set('shot', id); else p.delete('shot');
    setParams(p, { replace: !!id && !!shot });
  };

  useEffect(() => { setLoaded(false); setShowPlan(false); }, [shot?.id]);
  useEffect(() => {
    if (!shot) return;
    const prevKey = lang === 'ar' ? 'ArrowRight' : 'ArrowLeft';
    const nextKey = lang === 'ar' ? 'ArrowLeft' : 'ArrowRight';
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') go();
      if (e.key === nextKey && idx < list.length - 1) go(list[idx + 1].id);
      if (e.key === prevKey && idx > 0) go(list[idx - 1].id);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });
  // warm the neighbours so next/previous feel instant
  useEffect(() => {
    for (const n of [list[idx + 1], list[idx - 1]]) if (n) { const i = new Image(); i.src = shotSrc(n.id, 1600); }
  }, [shot?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!shot) return null;
  const where = shotLocation(shot);
  const name = spaceName(shot, lang);
  const subtitle = where ? `${tx(where.b.name)} · ${floorLabel(where.f.id, lang)}` : '';

  return (
    <div className="viewer" role="dialog" aria-modal="true" aria-label={name}>
      <picture className={`viewer-img ${loaded ? 'in' : ''}`}>
        <source type="image/webp"
          srcSet={`${shotSrc(shot.id, 480)} 480w, ${shotSrc(shot.id, 960)} 960w, ${shotSrc(shot.id, 1600)} 1600w`}
          sizes="100vw" />
        <img src={shotFallback(shot.id)} alt={name} onLoad={() => setLoaded(true)} decoding="async" />
      </picture>

      <div className="viewer-card">
        <div className="viewer-head">
          <div>
            <h2>{name}</h2>
            <p className="muted">{subtitle}</p>
          </div>
          <button className="icon" onClick={() => go()} aria-label={t('close')}>✕</button>
        </div>
        <p className="ai-note">{t('aiNote')}</p>
        <div className="viewer-actions">
          <button className="btn" onClick={() => setShowPlan((v) => !v)}>{t('showOnPlan')}</button>
          <button className="btn primary" onClick={() => onContact(`${name} – ${subtitle}`)}>{t('contact')}</button>
        </div>
        {showPlan && <img className="viewer-plan" src={`/media/camplans/${shot.id}.webp`} alt={t('showOnPlan')} loading="lazy" />}
      </div>

      {idx > 0 && <button className="nav prev" onClick={() => go(list[idx - 1].id)} aria-label={t('prev')}>‹</button>}
      {idx < list.length - 1 && <button className="nav next" onClick={() => go(list[idx + 1].id)} aria-label={t('next')}>›</button>}
      <div className="viewer-count" dir="ltr">{idx + 1} / {list.length}</div>
    </div>
  );
}
