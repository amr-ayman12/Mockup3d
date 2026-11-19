import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { areaRange, priceRange, STATUS_COLOR, units, unitsDemo, type Unit } from '../lib/data';
import { useI18n } from '../lib/i18n';
import { IArea, IBed, IClose, ILayers, ISearch, ISliders } from './Icons';

export type ColorMode = 'type' | 'avail';

/** Two thumbs on one track, with the values in small boxes at each end. */
function DualRange({ min, max, step, value, onChange, fmt }: {
  min: number; max: number; step: number; value: [number, number]; onChange: (v: [number, number]) => void; fmt: (n: number) => string;
}) {
  const pct = (n: number) => ((n - min) / (max - min || 1)) * 100;
  return (
    <div className="dual" dir="ltr">
      <output>{fmt(value[0])}</output>
      <div className="dual-track" style={{ ['--a' as string]: `${pct(value[0])}%`, ['--b' as string]: `${pct(value[1])}%` }}>
        <input type="range" min={min} max={max} step={step} value={value[0]} aria-label="min"
               onChange={(e) => onChange([Math.min(+e.target.value, value[1]), value[1]])} />
        <input type="range" min={min} max={max} step={step} value={value[1]} aria-label="max"
               onChange={(e) => onChange([value[0], Math.max(+e.target.value, value[0])])} />
      </div>
      <output>{fmt(value[1])}</output>
    </div>
  );
}

export function UnitResult({ u, onOpen }: { u: Unit; onOpen: () => void }) {
  const { t } = useI18n();
  return (
    <li className="result">
      <span className="status" style={{ ['--s' as string]: STATUS_COLOR[u.status] }}>{t(u.status)}</span>
      <b>{t('unit')} <bdi dir="ltr">{u.id}</bdi></b>
      <dl className="uc-facts">
        <div><dt><ILayers size={15} /> {u.floor}</dt><dd>{t('floor')}</dd></div>
        <div><dt><IBed size={15} /> {u.beds}</dt><dd>{t('beds')}</dd></div>
        <div><dt><IArea size={15} /> {u.area_m2} {t('m2')}</dt><dd>{t('area')}</dd></div>
      </dl>
      <button className="btn outline block" onClick={onOpen}>{t('exploreUnit')}</button>
    </li>
  );
}

/** Bottom-centre filter sheet of the master plan (reference: "Unit Filter"). */
export default function FilterSheet({ mode, setMode, onClose }: { mode: ColorMode; setMode: (m: ColorMode) => void; onClose: () => void }) {
  const { t } = useI18n();
  const nav = useNavigate();
  const [type, setType] = useState('');
  const [status, setStatus] = useState('');
  const [area, setArea] = useState<[number, number]>([areaRange[0], areaRange[1]]);
  const [price, setPrice] = useState<[number, number]>([priceRange[0], priceRange[1]]);
  const [showing, setShowing] = useState(false);
  const [limit, setLimit] = useState(10);
  const hits = useMemo(() => units.filter((u) =>
    (!type || u.type === type) && (!status || u.status === status) &&
    u.area_m2 >= area[0] && u.area_m2 <= area[1] && u.price >= price[0] && u.price <= price[1]), [type, status, area, price]);
  const open = (u: Unit) => nav(`/master-plan/building/${u.building}/floor/${u.floor}?unit=${u.id}`);

  return (
    <div className="filter-sheet" role="dialog" aria-label={t('unitFilter')}>
      <button className="x" onClick={onClose} aria-label={t('close')}><IClose size={18} /></button>
      <button className="search-btn" onClick={() => { setShowing((v) => !v); setLimit(10); }}>
        <span><ISearch size={18} /> {t('search')}</span>
        <span><ISliders size={18} /> ({hits.length})</span>
      </button>
      {showing ? (
        <>
          <p className="muted small">{t('showing')} {Math.min(limit, hits.length)} {t('of')} {hits.length}</p>
          {hits.length ? (
            <ul className="results">{hits.slice(0, limit).map((u) => <UnitResult key={u.id} u={u} onOpen={() => open(u)} />)}</ul>
          ) : <p className="muted">{t('noResults')}</p>}
          {limit < hits.length && <button className="btn outline block" onClick={() => setLimit(limit + 10)}>{t('showMore')}</button>}
        </>
      ) : (
        <div className="filter-body">
          <h3>{t('unitFilter')}</h3>
          <div className="seg" role="tablist">
            <button role="tab" aria-selected={mode === 'type'} className={mode === 'type' ? 'on' : ''} onClick={() => setMode('type')}>{t('type')}</button>
            <button role="tab" aria-selected={mode === 'avail'} className={mode === 'avail' ? 'on' : ''} onClick={() => setMode('avail')}>{t('byAvail')}</button>
          </div>
          <label>{t('propertyType')}
            <select value={type} onChange={(e) => setType(e.target.value)}>
              <option value="">{t('viewAll')}</option>
              {(['Standard', 'Deluxe', 'Suite'] as const).map((x) => <option key={x} value={x}>{t(x)}</option>)}
            </select>
          </label>
          <label>{t('byAvail')}
            <select value={status} onChange={(e) => setStatus(e.target.value)}>
              <option value="">{t('viewAll')}</option>
              {(['available', 'reserved', 'sold'] as const).map((x) => <option key={x} value={x}>{t(x)}</option>)}
            </select>
          </label>
          <div className="range-field"><span>{t('areaSqm')}</span>
            <DualRange min={areaRange[0]} max={areaRange[1]} step={1} value={area} onChange={setArea} fmt={(n) => n.toFixed(2)} />
          </div>
          <div className="range-field"><span>{t('priceM')}</span>
            <DualRange min={priceRange[0]} max={priceRange[1]} step={5000} value={price} onChange={setPrice} fmt={(n) => (n / 1e6).toFixed(2)} />
          </div>
          {unitsDemo && <p className="placeholder-note">{t('demo')}</p>}
        </div>
      )}
    </div>
  );
}
