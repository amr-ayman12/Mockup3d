import { Suspense, lazy, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import DeepZoom from '../components/DeepZoom';
import UnitList from '../components/UnitList';
import { areaRange, availColor, buildings, formatPrice, media, priceRange, shotsForBuilding, unitsDemo, units, unitsForBuilding } from '../lib/data';
import { useI18n } from '../lib/i18n';
import { withPanel } from '../lib/layout';

// three.js + the model load only when the 3D view is shown
const ModelView = lazy(() => import('../components/ModelView'));

type Tab = 'buildings' | 'find';
type Mode = 'type' | 'avail';


export default function MasterPlan() {
  const { lang, t, tx } = useI18n();
  const nav = useNavigate();
  const [hover, setHover] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>('buildings');
  const [mode, setMode] = useState<Mode>('type');
  const [type, setType] = useState('');
  const [status, setStatus] = useState('available');
  const [view, setView] = useState('');
  const [maxPrice, setMaxPrice] = useState(priceRange[1]);
  const [minArea, setMinArea] = useState(areaRange[0]);
  const [view3d, setView3d] = useState(true);
  const open = (id: string) => nav(`/master-plan/building/${id}`);
  const fit = withPanel({ x: 0, y: 0, w: media.master.w, h: media.master.h }, lang === 'ar' ? 'rtl' : 'ltr');

  const results = useMemo(() => units.filter((u) =>
    (!type || u.type === type) && (!status || u.status === status) && (!view || u.view === view) &&
    u.price <= maxPrice && u.area_m2 >= minArea), [type, status, view, maxPrice, minArea]);
  const hits = new Set(results.map((u) => u.building));

  const colors = Object.fromEntries(buildings.map((b) => [b.id, mode === 'avail' ? availColor(unitsForBuilding(b.id)) : b.color]));
  const labels = Object.fromEntries(buildings.map((b) => {
    const list = unitsForBuilding(b.id);
    const free = list.filter((u) => u.status === 'available').length;
    return [b.id, mode === 'avail' && list.length ? `${b.id} · ${free}/${list.length}` : tx(b.name)];
  }));

  return (
    <div className="stage">
      <div className="view-switch" role="tablist">
        <button role="tab" aria-selected={view3d} className={view3d ? 'on' : ''} onClick={() => setView3d(true)}>{t('model3d')}</button>
        <button role="tab" aria-selected={!view3d} className={!view3d ? 'on' : ''} onClick={() => setView3d(false)}>{t('aerialView')}</button>
      </div>
      {view3d ? (
        <Suspense fallback={<div className="loading" />}>
          <ModelView colors={colors} labels={labels} onPick={open} />
        </Suspense>
      ) : (
      <DeepZoom dzi="/media/master/aerial.dzi" width={media.master.w} height={media.master.h} fit={fit}>
        {buildings.map((b) => {
          const list = unitsForBuilding(b.id);
          const free = list.filter((u) => u.status === 'available').length;
          const color = mode === 'avail' ? availColor(list) : b.color;
          const dim = tab === 'find' && !hits.has(b.id);
          return (
            <g key={b.id} className={`bld ${hover === b.id ? 'hover' : ''} ${dim ? 'dim' : ''}`} style={{ ['--c' as string]: color }}
               onMouseEnter={() => setHover(b.id)} onMouseLeave={() => setHover(null)} onClick={() => open(b.id)}
               role="link" tabIndex={0} aria-label={tx(b.name)} onKeyDown={(e) => e.key === 'Enter' && open(b.id)}>
              <polygon points={b.poly.map((p) => p.join(',')).join(' ')} />
              <g className="bld-label" transform={`translate(${b.label[0]},${b.label[1]})`}>
                <rect x={mode === 'avail' ? -62 : -34} y={-16} width={mode === 'avail' ? 124 : 68} height={32} rx={16} />
                <text textAnchor="middle" dominantBaseline="central">{mode === 'avail' ? `${b.id} · ${free}/${list.length}` : b.id}</text>
              </g>
            </g>
          );
        })}
      </DeepZoom>
      )}

      <div className="mode-switch" role="tablist">
        <button role="tab" aria-selected={mode === 'type'} className={mode === 'type' ? 'on' : ''} onClick={() => setMode('type')}>{t('byType')}</button>
        <button role="tab" aria-selected={mode === 'avail'} className={mode === 'avail' ? 'on' : ''} onClick={() => setMode('avail')}>{t('byAvail')}</button>
      </div>

      <aside className="panel">
        <div className="tabs" role="tablist">
          <button role="tab" aria-selected={tab === 'buildings'} className={tab === 'buildings' ? 'on' : ''} onClick={() => setTab('buildings')}>{t('buildings')}</button>
          <button role="tab" aria-selected={tab === 'find'} className={tab === 'find' ? 'on' : ''} onClick={() => setTab('find')}>{t('findUnit')}</button>
        </div>

        {tab === 'buildings' ? (
          <>
            <p className="muted small">{view3d ? t('hint3d') : t('hint')}</p>
            <ul className="bld-list">
              {buildings.map((b) => {
                const list = unitsForBuilding(b.id);
                const free = list.filter((u) => u.status === 'available').length;
                return (
                  <li key={b.id}>
                    <button className={`bld-card ${hover === b.id ? 'hover' : ''}`} style={{ ['--c' as string]: mode === 'avail' ? availColor(list) : b.color }}
                            onMouseEnter={() => setHover(b.id)} onMouseLeave={() => setHover(null)} onClick={() => open(b.id)}>
                      <span className="swatch" />
                      <span className="bld-name">{tx(b.name)}</span>
                      <span className="bld-meta">
                        {b.floors.length} {t('floors')} · {shotsForBuilding(b).length} {t('views')}
                        {list.length > 0 && ` · ${free}/${list.length} ${t('availableOf')}`}
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          </>
        ) : (
          <div className="filters">
            <label>{t('type')}
              <select value={type} onChange={(e) => setType(e.target.value)}>
                <option value="">{t('any')}</option>
                {(['Standard', 'Deluxe', 'Suite'] as const).map((x) => <option key={x} value={x}>{t(x)}</option>)}
              </select>
            </label>
            <label>{t('status')}
              <select value={status} onChange={(e) => setStatus(e.target.value)}>
                <option value="">{t('any')}</option>
                {(['available', 'reserved', 'sold'] as const).map((x) => <option key={x} value={x}>{t(x)}</option>)}
              </select>
            </label>
            <label>{t('view')}
              <select value={view} onChange={(e) => setView(e.target.value)}>
                <option value="">{t('any')}</option>
                {(['sea', 'pool', 'garden'] as const).map((x) => <option key={x} value={x}>{t(x)}</option>)}
              </select>
            </label>
            <label>{t('maxPrice')}: <b>{formatPrice(maxPrice, lang)} {t('aed')}</b>
              <input type="range" min={priceRange[0]} max={priceRange[1]} step={10000} value={maxPrice} onChange={(e) => setMaxPrice(+e.target.value)} />
            </label>
            <label>{t('minArea')}: <b>{minArea} {t('m2')}</b>
              <input type="range" min={areaRange[0]} max={areaRange[1]} step={1} value={minArea} onChange={(e) => setMinArea(+e.target.value)} />
            </label>
            <h3>{results.length} {t('results')}</h3>
            <UnitList list={results} />
            {unitsDemo && <p className="placeholder-note">{t('demo')}</p>}
          </div>
        )}
      </aside>
    </div>
  );
}
