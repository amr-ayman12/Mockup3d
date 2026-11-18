import { Link, Navigate, useParams, useSearchParams } from 'react-router-dom';
import CameraMarker from '../components/CameraMarker';
import DeepZoom from '../components/DeepZoom';
import { floorLabel } from '../components/TopBar';
import UnitList from '../components/UnitList';
import { getBuilding, getFloor, markerPos, media, shotsForPlan, shotSrc, spaceName, unitsForPlan } from '../lib/data';
import { useI18n } from '../lib/i18n';
import { withPanel } from '../lib/layout';

export default function Floor() {
  const { id, floor } = useParams();
  const b = getBuilding(id);
  const f = getFloor(b, floor);
  const { lang, t, tx } = useI18n();
  const [params, setParams] = useSearchParams();
  if (!b || !f || !f.plan) return <Navigate to={b ? `/master-plan/building/${b.id}` : '/master-plan'} replace />;

  const mode: '3d' | '2d' = params.get('view') === '2d' ? '2d' : '3d';
  const size = mode === '3d' ? media.plans[f.plan] : media.plans2d[f.plan];
  const area = mode === '3d' ? media.plans[f.plan].box : { x: 0, y: 0, w: size.w, h: size.h };
  const fit = withPanel({ x: area.x - area.w * 0.04, y: area.y - area.h * 0.06, w: area.w * 1.08, h: area.h * 1.12 }, lang === 'ar' ? 'rtl' : 'ltr');
  const list = shotsForPlan(f.plan);
  const floorUnits = unitsForPlan(f.plan);
  const active = params.get('shot');
  const set = (k: string, v: string | null) => { const p = new URLSearchParams(params); if (v) p.set(k, v); else p.delete(k); setParams(p, { replace: k === 'view' }); };

  return (
    <div className="stage">
      <DeepZoom key={`${f.plan}-${mode}`} dzi={`/media/${mode === '3d' ? 'plans' : 'plans2d'}/${f.plan}.dzi`} width={size.w} height={size.h} fit={fit}>
        {list.map((s, i) => {
          const m = markerPos(s, f, mode);
          return <CameraMarker key={s.id} x={m.x} y={m.y} scale={m.scale} heading={s.heading} fov={s.fov} num={i + 1}
                               label={spaceName(s, lang)} active={active === s.id} onClick={() => set('shot', s.id)} />;
        })}
      </DeepZoom>

      <div className="mode-switch" role="tablist">
        <button role="tab" aria-selected={mode === '3d'} className={mode === '3d' ? 'on' : ''} onClick={() => set('view', null)}>{t('view3d')}</button>
        <button role="tab" aria-selected={mode === '2d'} className={mode === '2d' ? 'on' : ''} onClick={() => set('view', '2d')}>{t('view2d')}</button>
      </div>

      <nav className="floor-chips" aria-label={t('floors')}>
        {b.floors.map((x) => x.plan
          ? <Link key={x.id} to={`/master-plan/building/${b.id}/floor/${x.id}${mode === '2d' ? '?view=2d' : ''}`} className={x.id === f.id ? 'on' : ''}>{x.id}</Link>
          : <span key={x.id} className="off" title={t('planPending')}>{x.id}</span>)}
      </nav>

      <aside className="panel">
        <h1>{tx(b.name)}</h1>
        <p className="floor-name">{floorLabel(f.id, lang)} · <span className="muted">{tx(f.use)}</span></p>
        <p className="muted small">{t('hintFloor')}</p>
        <ol className="space-list">
          {list.map((s, i) => (
            <li key={s.id}>
              <button className={active === s.id ? 'on' : ''} onClick={() => set('shot', s.id)}>
                <span className="num">{i + 1}</span>
                <img src={shotSrc(s.id, 480)} alt="" loading="lazy" width={96} height={54} />
                <span>{spaceName(s, lang)}</span>
              </button>
            </li>
          ))}
        </ol>
        {floorUnits.length > 0 && (
          <>
            <h3>{t('units')} · {floorUnits.filter((u) => u.status === 'available').length} {t('availableOf')}</h3>
            <UnitList list={floorUnits} />
          </>
        )}
      </aside>
    </div>
  );
}
