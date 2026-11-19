import { Suspense, lazy, useState } from 'react';
import { Link, Navigate, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import DeepZoom from '../components/DeepZoom';
import { floorLabel } from '../components/TopBar';
import UnitList from '../components/UnitList';
import { availColor, buildings, getBuilding, media, polyBounds, shotsForBuilding, shotsForPlan, shotSrc, spaceName, STATUS_COLOR, unitsForBuilding, unitsForPlan } from '../lib/data';
import { useI18n } from '../lib/i18n';
import { withPanel } from '../lib/layout';

const ModelView = lazy(() => import('../components/ModelView'));
type FloorBand = import('../components/ModelView').FloorBand;

export default function Building() {
  const { id } = useParams();
  const b = getBuilding(id);
  const { lang, t, tx } = useI18n();
  const [params, setParams] = useSearchParams();
  const nav = useNavigate();
  const [view3d, setView3d] = useState(true);
  if (!b) return <Navigate to="/master-plan" replace />;

  const bUnits = unitsForBuilding(b.id);
  const bb = polyBounds(b.poly);
  const pad = Math.max(bb.w, bb.h) * 0.6;
  const fit = withPanel({ x: bb.x - pad, y: bb.y - pad * 0.7, w: bb.w + pad * 2, h: bb.h + pad * 1.4 }, lang === 'ar' ? 'rtl' : 'ltr');
  const openShot = (sid: string) => { const p = new URLSearchParams(params); p.set('shot', sid); setParams(p); };

  const colors = Object.fromEntries(buildings.map((x) => [x.id, x.color]));
  const labels = Object.fromEntries(buildings.map((x) => [x.id, x.id === b.id ? tx(x.name) : x.id]));
  // one clickable slab per storey: availability colour where the floor has units, building colour otherwise
  const bands: FloorBand[] = b.floors.map((f) => {
    const fu = unitsForPlan(f.plan);
    const free = fu.filter((u) => u.status === 'available').length;
    const name = floorLabel(f.id, lang);
    return {
      id: f.id,
      enabled: !!f.plan,
      color: fu.length ? availColor(fu) : b.color,
      label: !f.plan ? `${name} · ${t('planPending')}` : fu.length ? `${name} · ${free}/${fu.length} ${t('availableOf')}` : `${name} · ${tx(f.use)}`,
    };
  });

  return (
    <div className="stage">
      <div className="view-switch" role="tablist">
        <button role="tab" aria-selected={view3d} className={view3d ? 'on' : ''} onClick={() => setView3d(true)}>{t('model3d')}</button>
        <button role="tab" aria-selected={!view3d} className={!view3d ? 'on' : ''} onClick={() => setView3d(false)}>{t('aerialView')}</button>
      </div>
      {view3d ? (
        <Suspense fallback={<div className="loading" />}>
          <ModelView colors={colors} labels={labels} focus={b.id} dimOthers floors={bands}
                     onPick={(x) => nav(`/master-plan/building/${x}`)} onFloor={(f) => nav(`/master-plan/building/${b.id}/floor/${f}`)} />
        </Suspense>
      ) : (
        <DeepZoom dzi="/media/master/aerial.dzi" width={media.master.w} height={media.master.h} fit={fit}>
          {buildings.map((x) => (
            <g key={x.id} className={`bld ${x.id === b.id ? 'selected' : 'dim'}`} style={{ ['--c' as string]: x.color }}>
              <polygon points={x.poly.map((p) => p.join(',')).join(' ')} />
            </g>
          ))}
        </DeepZoom>
      )}

      <aside className="panel">
        <h1>{tx(b.name)}</h1>
        <h3>{t('floors')}</h3>
        <ul className="floor-cards">
          {b.floors.map((f) => {
            const n = shotsForPlan(f.plan).length;
            const body = (
              <>
                {f.plan ? <img src={`/media/plans/${f.plan}-thumb.webp`} alt="" loading="lazy" width={320} height={200} />
                        : <div className="thumb-empty">{t('planPending')}</div>}
                <span className="floor-name">{floorLabel(f.id, lang)}</span>
                <span className="muted small">{tx(f.use)}{n ? ` · ${n} ${t('views')}` : ''}</span>
              </>
            );
            return <li key={f.id}>{f.plan ? <Link className="floor-card" to={`/master-plan/building/${b.id}/floor/${f.id}`}>{body}</Link>
                                         : <div className="floor-card disabled">{body}</div>}</li>;
          })}
        </ul>
        {bUnits.length > 0 && (
          <>
            <h3>{t('units')}</h3>
            <div className="counts">
              {(['available', 'reserved', 'sold'] as const).map((s) => (
                <span key={s} className="pill" style={{ ['--s' as string]: STATUS_COLOR[s] }}>{t(s)} {bUnits.filter((u) => u.status === s).length}</span>
              ))}
            </div>
            <UnitList list={bUnits} />
          </>
        )}
        <h3>{t('spaces')}</h3>
        <div className="shot-strip">
          {shotsForBuilding(b).map((s) => (
            <button key={s.id} className="shot-thumb" onClick={() => openShot(s.id)}>
              <img src={shotSrc(s.id, 480)} alt="" loading="lazy" width={240} height={135} />
              <span>{spaceName(s, lang)}</span>
            </button>
          ))}
        </div>
      </aside>
    </div>
  );
}
