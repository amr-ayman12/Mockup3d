import { Suspense, lazy, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import DeepZoom from '../components/DeepZoom';
import FilterSheet, { type ColorMode } from '../components/FilterSheet';
import { ICube, IImage } from '../components/Icons';
import { availColor, buildings, labelPoint, ue, unitsForBuilding } from '../lib/data';
import { useI18n } from '../lib/i18n';
import { useUi } from '../lib/ui';

// three.js + the model load only when the 3D view is shown
const ModelView = lazy(() => import('../components/ModelView'));

export default function MasterPlan() {
  const { lang, t } = useI18n();
  const nav = useNavigate();
  const ui = useUi();
  const [mode, setMode] = useState<ColorMode>('type');
  // the rendered aerial is the main view; the real-time model stays one tap away
  const [view3d, setView3d] = useState(false);
  const [hover, setHover] = useState<string | null>(null);
  const open = (id: string) => nav(`/master-plan/building/${id}`);

  const colors = Object.fromEntries(buildings.map((b) => [b.id, mode === 'avail' ? availColor(unitsForBuilding(b.id)) : b.color]));
  const tags = Object.fromEntries(buildings.map((b) => {
    const list = unitsForBuilding(b.id);
    const free = list.filter((u) => u.status === 'available').length;
    const title = lang === 'ar' ? `مبنى ${b.id}` : `Building ${b.id}`;
    const sub = mode === 'avail' ? `${free}/${list.length} ${t('available')}` : `${list.length} ${t('units')}`;
    return [b.id, `${title}\n${sub}`];
  }));
  const toggle = (
    <button onClick={() => setView3d((v) => !v)} title={view3d ? t('aerialView') : t('model3d')} aria-label={view3d ? t('aerialView') : t('model3d')}>
      {view3d ? <IImage /> : <ICube />}
    </button>
  );

  return (
    <div className="stage">
      {view3d ? (
        <Suspense fallback={<div className="loading" />}>
          <ModelView colors={colors} labels={tags} onPick={open} />
        </Suspense>
      ) : (
        <DeepZoom dzi="/media/ue/master/aerial.dzi" width={ue.master.w} height={ue.master.h}
                  fit={{ x: 0, y: 0, w: ue.master.w, h: ue.master.h }} className="dz-aerial">
          {buildings.map((b) => {
            const [title, sub] = tags[b.id].split('\n');
            const polys = ue.master.polys[b.id] ?? [];
            if (!polys.length) return null;
            const [lx, ly] = labelPoint(polys);
            return (
              <g key={b.id} className={`bld ${hover === b.id ? 'hover' : ''}`} style={{ ['--c' as string]: colors[b.id] }}
                 onMouseEnter={() => setHover(b.id)} onMouseLeave={() => setHover(null)} onClick={() => open(b.id)}
                 role="link" tabIndex={0} aria-label={title} onKeyDown={(e) => e.key === 'Enter' && open(b.id)}>
                {polys.map((p, i) => <polygon key={i} points={p.map((q) => q.join(',')).join(' ')} />)}
                <g className="svg-tag" style={{ transform: `translate(${lx}px, ${ly}px) scale(var(--k))` }}>
                  <line x1="0" y1="0" x2="0" y2="-18" />
                  <circle r="3" />
                  <rect x="-46" y="-56" width="92" height="38" rx="6" />
                  <text y="-41" textAnchor="middle" className="t1">{title}</text>
                  <text y="-26" textAnchor="middle" className="t2">{sub}</text>
                </g>
              </g>
            );
          })}
        </DeepZoom>
      )}
      <div className="top-end">{toggle}</div>
      {ui.filters && <FilterSheet mode={mode} setMode={setMode} onClose={() => ui.setFilters(false)} />}
    </div>
  );
}
