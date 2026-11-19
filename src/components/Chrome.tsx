import { useEffect, useRef, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { crumbs, site } from '../lib/data';
import { useI18n } from '../lib/i18n';
import { IChevron, IEye, IEyeOff, IFull, IMail, IMinus, IPlus, IReset, ISliders, Mark } from './Icons';

/** Top-start: logo tile + one dropdown with the place trail (location > project > building > floor). */
export function TopNav() {
  const { lang, tx } = useI18n();
  const loc = useLocation();
  const nav = useNavigate();
  const [open, setOpen] = useState(false);
  const box = useRef<HTMLDivElement>(null);
  const trail = crumbs(loc.pathname, lang);
  // on the location map the current place is the city; elsewhere the deepest step of the trail
  const here = loc.pathname === '/' ? trail[0] : trail[trail.length - 1];
  useEffect(() => setOpen(false), [loc.pathname]);
  useEffect(() => {
    if (!open) return;
    const off = (e: PointerEvent) => { if (!box.current?.contains(e.target as Node)) setOpen(false); };
    window.addEventListener('pointerdown', off);
    return () => window.removeEventListener('pointerdown', off);
  }, [open]);

  return (
    <div className="topnav">
      <Link to="/" className="logo-tile" title={tx(site.name)} aria-label={tx(site.name)}>
        <Mark size={30} />
        <span>{tx(site.short)}</span>
      </Link>
      <div className="crumb" ref={box}>
        <button className="crumb-btn" onClick={() => setOpen((v) => !v)} aria-expanded={open} aria-haspopup="listbox">
          <span>{here.label}</span><IChevron size={20} />
        </button>
        {open && (
          <ul className="crumb-menu" role="listbox">
            {trail.map((c, i) => (
              <li key={c.to + i}>
                <button role="option" aria-selected={c === here} className={c === here ? 'on' : ''}
                        onClick={() => { setOpen(false); nav(c.to); }}>{c.label}</button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

/** Right-hand zoom column (+ / reset / −) and the fullscreen button under it. */
export function SideControls({ onZoom, onReset, children }: { onZoom: (k: number) => void; onReset: () => void; children?: React.ReactNode }) {
  const { t } = useI18n();
  const full = () => {
    if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
    else document.documentElement.requestFullscreen?.().catch(() => {});
  };
  return (
    <>
      <div className="side-ctrl">
        <button onClick={() => onZoom(1.5)} aria-label={t('zoomIn')} title={t('zoomIn')}><IPlus /></button>
        <button onClick={onReset} aria-label={t('reset')} title={t('reset')}><IReset /></button>
        <button onClick={() => onZoom(1 / 1.5)} aria-label={t('zoomOut')} title={t('zoomOut')}><IMinus /></button>
      </div>
      <div className="corner-ctrl">
        {children}
        <button onClick={full} aria-label={t('fullscreen')} title={t('fullscreen')}><IFull /></button>
      </div>
    </>
  );
}

/** Bottom bar: contact, filters (where the page has them), hide overlay, language. */
export function BottomBar({ onContact, onFilters, filtersOpen, contactOpen }: {
  onContact: () => void; onFilters?: () => void; filtersOpen?: boolean; contactOpen?: boolean;
}) {
  const { lang, setLang, t, overlays, setOverlays } = useI18n();
  return (
    <nav className="bottombar" aria-label="tools">
      <button className={contactOpen ? 'on' : ''} onClick={onContact} title={t('contact')} aria-label={t('contact')}>
        <IMail />{contactOpen && <span>{t('contact')}</span>}
      </button>
      {onFilters && (
        <button className={filtersOpen ? 'on' : ''} onClick={onFilters} title={t('filters')} aria-label={t('filters')} aria-pressed={filtersOpen}>
          <ISliders />{filtersOpen && <span>{t('filters')}</span>}
        </button>
      )}
      <button className={!overlays ? 'on' : ''} onClick={() => setOverlays(!overlays)} title={t('hideOverlay')} aria-label={t('hideOverlay')} aria-pressed={!overlays}>
        {overlays ? <IEyeOff /> : <IEye />}
      </button>
      <button className="lang" onClick={() => setLang(lang === 'ar' ? 'en' : 'ar')} title={t('language')} aria-label={t('language')}>
        {lang === 'ar' ? 'EN' : 'ع'}
      </button>
    </nav>
  );
}
