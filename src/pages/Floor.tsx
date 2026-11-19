import { Link, Navigate, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import DeepZoom from '../components/DeepZoom';
import UnitCard from '../components/UnitCard';
import { floorShort, getBuilding, getFloor, getUnit, markerPos, media, polyBounds, polyCenter, shotsForPlan, spaceName, STATUS_COLOR, unitShape, unitsForPlan } from '../lib/data';
import { useI18n } from '../lib/i18n';
import { useUi } from '../lib/ui';

export default function Floor() {
  const { id, floor } = useParams();
  const b = getBuilding(id);
  const f = getFloor(b, floor);
  const { lang, t, tx } = useI18n();
  const ui = useUi();
  const nav = useNavigate();
  const [params, setParams] = useSearchParams();
  if (!b || !f || !f.plan) return <Navigate to={b ? `/master-plan/building/${b.id}` : '/master-plan'} replace />;

  const plan = f.plan;
  const size = media.plans[plan];
  const area = size.box;
  const list = unitsForPlan(plan).filter((u) => unitShape(u));
  const shots = shotsForPlan(plan);
  const sel = getUnit(params.get('unit'));
  const selShape = sel && sel.plan === plan ? unitShape(sel) : undefined;
  const pick = (uid: string | null) => {
    const p = new URLSearchParams(params);
    if (uid) p.set('unit', uid); else p.delete('unit');
    setParams(p, { replace: true });
  };
  // whole floor, or zoomed onto the chosen unit (with room for its card)
  // (on phones the card covers the lower half, so the unit is framed in the upper half)
  const phone = window.matchMedia('(max-width: 760px)').matches;
  const fit = selShape
    ? (() => {
        const bb = polyBounds(selShape); const m = Math.max(bb.w, bb.h) * 0.35;
        const h = bb.h + m * 2;
        return { x: bb.x - m, y: bb.y - m, w: bb.w + m * 2, h: phone ? h * 2.1 : h };
      })()
    : { x: area.x - area.w * 0.08, y: area.y - area.h * 0.1, w: area.w * 1.16, h: area.h * 1.2 };
  const tourUrl = (shotId: string, unit?: string) => `/master-plan/building/${b.id}/floor/${f.id}/tour/${shotId}${unit ? `?unit=${unit}` : ''}`;

  return (
    <div className="stage">
      <DeepZoom key={plan} dzi={`/media/plans/${plan}.dzi`} width={size.w} height={size.h} fit={fit} className="dz-floor">
        {list.map((u) => {
          const shape = unitShape(u)!;
          const [cx, cy] = polyCenter(shape);
          return (
            <g key={u.id} className={`unit ${sel?.id === u.id ? 'on' : ''}`} style={{ ['--s' as string]: STATUS_COLOR[u.status] }}
               onClick={() => pick(sel?.id === u.id ? null : u.id)} role="button" tabIndex={0} aria-label={`${t('unit')} ${u.id}`}
               onKeyDown={(e) => e.key === 'Enter' && pick(u.id)}>
              <polygon points={shape.map((p) => p.join(',')).join(' ')} />
              <g className="unit-tag" style={{ transform: `translate(${cx}px, ${cy}px) scale(var(--k))` }}>
                <rect x="-30" y="-10" width="60" height="20" rx="4" />
                <text textAnchor="middle" dominantBaseline="central">{u.id.replace(/^B\d-\d-/, `${b.id}-`)}</text>
              </g>
            </g>
          );
        })}
        {shots.map((s) => {
          const m = markerPos(s, f, '3d');
          return (
            <g key={s.id} className="space-tag" style={{ transform: `translate(${m.x}px, ${m.y}px) scale(var(--k))` }}
               onClick={() => nav(tourUrl(s.id))} role="link" tabIndex={0} aria-label={spaceName(s, lang)}
               onKeyDown={(e) => e.key === 'Enter' && nav(tourUrl(s.id))}>
              <circle r="11" />
              <path d="M-5 -2.5h2l1.2-2h3.6l1.2 2h2v6.5h-10z" />
              <text x="16" dominantBaseline="central">{spaceName(s, lang)}</text>
            </g>
          );
        })}
      </DeepZoom>

      <nav className="floor-pick" aria-label={t('floors')}>
        <b>{t('floor')}</b>
        {b.floors.map((x) => x.plan
          ? <Link key={x.id} to={`/master-plan/building/${b.id}/floor/${x.id}`} className={x.id === f.id ? 'on' : ''}>{floorShort(x.id, lang)}</Link>
          : <span key={x.id} className="off" title={t('planPending')}>{floorShort(x.id, lang)}</span>)}
      </nav>

      {sel && (
        <UnitCard u={sel} onClose={() => pick(null)}
                  onTour={sel.shot || shots[0] ? () => nav(tourUrl(sel.shot ?? shots[0].id, sel.id)) : undefined}
                  onContact={() => ui.contact(`${t('unit')} ${sel.id} – ${tx(b.name)}`)} />
      )}
    </div>
  );
}
