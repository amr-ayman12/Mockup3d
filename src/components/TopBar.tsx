import { Link, useLocation, useNavigate } from 'react-router-dom';
import { buildings, getBuilding, site } from '../lib/data';
import { useI18n } from '../lib/i18n';

const floorLabel = (id: string, lang: 'ar' | 'en') =>
  id === 'G' ? (lang === 'ar' ? 'الأرضي' : 'Ground') : lang === 'ar' ? `الدور ${id}` : `Floor ${id}`;
export { floorLabel };

export default function TopBar({ onContact }: { onContact: () => void }) {
  const { lang, setLang, t, tx, overlays, setOverlays } = useI18n();
  const loc = useLocation();
  const nav = useNavigate();
  const m = loc.pathname.match(/\/master-plan(?:\/building\/([^/]+)(?:\/floor\/([^/]+))?)?/);
  const b = getBuilding(m?.[1]);
  const floorId = m?.[2];

  const full = () => {
    if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
    else document.documentElement.requestFullscreen?.().catch(() => {});
  };

  return (
    <header className="topbar">
      <Link to="/" className="logo" title={tx(site.name)}>
        <span className="logo-mark" aria-hidden>◐</span>
        <span className="logo-text">{tx(site.name)}</span>
      </Link>

      <nav className="crumbs" aria-label="breadcrumb">
        <Link to="/master-plan">{t('masterPlan')}</Link>
        {m && (
          <>
            <span className="sep">›</span>
            <select
              aria-label={t('buildings')}
              value={b?.id ?? ''}
              onChange={(e) => nav(e.target.value ? `/master-plan/building/${e.target.value}` : '/master-plan')}
            >
              <option value="">{t('buildings')}</option>
              {buildings.map((x) => <option key={x.id} value={x.id}>{tx(x.name)}</option>)}
            </select>
          </>
        )}
        {b && (
          <>
            <span className="sep">›</span>
            <select
              aria-label={t('floor')}
              value={floorId ?? ''}
              onChange={(e) => nav(e.target.value ? `/master-plan/building/${b.id}/floor/${e.target.value}` : `/master-plan/building/${b.id}`)}
            >
              <option value="">{t('floors')}</option>
              {b.floors.map((f) => <option key={f.id} value={f.id} disabled={!f.plan}>{floorLabel(f.id, lang)}</option>)}
            </select>
          </>
        )}
      </nav>

      <div className="tools">
        <button className="icon" onClick={onContact} title={t('contact')} aria-label={t('contact')}>✉</button>
        <button className={`icon ${overlays ? '' : 'off'}`} onClick={() => setOverlays(!overlays)} title={t('overlays')} aria-label={t('overlays')} aria-pressed={overlays}>👁</button>
        <button className="icon lang" onClick={() => setLang(lang === 'ar' ? 'en' : 'ar')} aria-label="language">{lang === 'ar' ? 'EN' : 'ع'}</button>
        <button className="icon" onClick={full} title={t('fullscreen')} aria-label={t('fullscreen')}>⛶</button>
      </div>
    </header>
  );
}
