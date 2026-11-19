import { useEffect, useRef, useState } from 'react';
import { Navigate, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { IPlan } from '../components/Icons';
import UnitCard from '../components/UnitCard';
import { floorLabel, getBuilding, getShot, getUnit, shotFallback, shotLocation, shotsForBuilding, shotSrc, spaceName } from '../lib/data';
import { useI18n } from '../lib/i18n';
import { useUi } from '../lib/ui';
import { SideControls } from '../components/Chrome';

/** Interactive tour: full-screen interior, drag to look around, room pills along the bottom. */
export default function Tour() {
  const { id, shot: shotId } = useParams();
  const b = getBuilding(id);
  const shot = getShot(shotId);
  const [params] = useSearchParams();
  const { lang, t, tx } = useI18n();
  const ui = useUi();
  const nav = useNavigate();
  // phones start with the menu folded so the picture gets the screen
  const [menu, setMenu] = useState(() => !window.matchMedia('(max-width: 760px)').matches);
  const [plan, setPlan] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [pan, setPan] = useState({ x: 50, zoom: 1 });
  const drag = useRef<{ x: number; start: number } | null>(null);
  const pills = useRef<HTMLDivElement>(null);
  useEffect(() => { setLoaded(false); setPan({ x: 50, zoom: 1 }); }, [shotId]);
  useEffect(() => { pills.current?.querySelector('.on')?.scrollIntoView({ inline: 'center', block: 'nearest', behavior: 'smooth' }); }, [shotId]);
  if (!b || !shot) return <Navigate to={b ? `/master-plan/building/${b.id}` : '/master-plan'} replace />;

  const where = shotLocation(shot);
  const unit = getUnit(params.get('unit'));
  const all = shotsForBuilding(b);
  const go = (sid: string) => nav(`/master-plan/building/${b.id}/floor/${shotLocation(getShot(sid)!)!.f.id}/tour/${sid}${unit ? `?unit=${unit.id}` : ''}`, { replace: true });
  const name = spaceName(shot, lang);

  // drag sideways to look around the (wider than the screen) picture
  const onDown = (e: React.PointerEvent) => { drag.current = { x: e.clientX, start: pan.x }; (e.target as HTMLElement).setPointerCapture(e.pointerId); };
  const onMove = (e: React.PointerEvent) => {
    if (!drag.current) return;
    const dx = ((e.clientX - drag.current.x) / window.innerWidth) * 100 * (lang === 'ar' ? 1 : 1);
    setPan((p) => ({ ...p, x: Math.min(100, Math.max(0, drag.current!.start - dx * 1.4)) }));
  };
  const onUp = () => { drag.current = null; };

  return (
    <div className="stage tour">
      <div className="tour-img" onPointerDown={onDown} onPointerMove={onMove} onPointerUp={onUp} onPointerCancel={onUp}>
        <picture className={loaded ? 'in' : ''}>
          <source type="image/webp" srcSet={`${shotSrc(shot.id, 960)} 960w, ${shotSrc(shot.id, 1600)} 1600w`} sizes="100vw" />
          <img src={shotFallback(shot.id)} alt={name} onLoad={() => setLoaded(true)} draggable={false}
               style={{ objectPosition: `${pan.x}% 50%`, transform: `scale(${pan.zoom})` }} />
        </picture>
      </div>

      <div className="tour-title">
        <h1>{name}</h1>
        <p>{tx(b.name)} · {where ? floorLabel(where.f.id, lang) : ''}</p>
      </div>

      <div className="pills" ref={pills} role="tablist">
        {all.map((s) => (
          <button key={s.id} role="tab" aria-selected={s.id === shot.id} className={s.id === shot.id ? 'on' : ''} onClick={() => go(s.id)}>
            {spaceName(s, lang)}
          </button>
        ))}
      </div>

      <div className={`tour-menu ${menu ? '' : 'closed'}`}>
        <button className="menu-toggle" onClick={() => setMenu((v) => !v)}>{menu ? t('hideMenu') : t('showMenu')}<span>{menu ? '⇥' : '⇤'}</span></button>
        {menu && (
          <>
            {unit ? <UnitCard u={unit} compact /> : (
              <div className="tour-info"><b>{name}</b><span className="muted small">{tx(b.name)}</span></div>
            )}
            <p className="ai-note">{t('aiNote')}</p>
            <button className="btn outline block" onClick={() => nav('/master-plan')}>{t('backMaster')}</button>
            <button className="btn primary block" onClick={() => ui.contact(`${unit ? `${t('unit')} ${unit.id}` : name} – ${tx(b.name)}`)}>{t('callback')}</button>
          </>
        )}
      </div>

      {plan && <img className="tour-plan" src={`/media/camplans/${shot.id}.webp`} alt={t('floorPlan')} onClick={() => setPlan(false)} />}
      <SideControls onZoom={(k) => setPan((p) => ({ ...p, zoom: Math.min(2.2, Math.max(1, p.zoom * k)) }))} onReset={() => setPan({ x: 50, zoom: 1 })}>
        <button className={plan ? 'on' : ''} onClick={() => setPlan((v) => !v)} aria-label={t('floorPlan')} title={t('floorPlan')}><IPlan /></button>
      </SideControls>
    </div>
  );
}
