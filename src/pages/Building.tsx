import { useState } from 'react';
import { Navigate, useNavigate, useParams } from 'react-router-dom';
import DeepZoom from '../components/DeepZoom';
import { IArrow } from '../components/Icons';
import { availColor, floorLabel, floorNum, getBuilding, polyBounds, polyCenter, ue, unitsForPlan } from '../lib/data';
import { useI18n } from '../lib/i18n';

const BAND = '#3aa6e6';     // the reference's light-blue floor overlay
const BAND_OFF = '#9aa3a0'; // floors whose plan is still missing

/** Building level: the rendered facade with each floor tinted, plus other camera angles. */
export default function Building() {
  const { id } = useParams();
  const b = getBuilding(id);
  const { lang, t } = useI18n();
  const nav = useNavigate();
  const [view, setView] = useState(0);
  const [hover, setHover] = useState<string | null>(null);
  if (!b) return <Navigate to="/master-plan" replace />;

  const views = ue.facades[b.id] ?? [];
  const n = Math.max(views.length, 1);
  const v = views[Math.min(view, views.length - 1)];
  const go = (d: number) => setView((x) => (x + d + n) % n);
  if (!v) return <Navigate to="/master-plan" replace />;

  // frame the building: bounds of all its floor polygons, with some air around them
  const all = Object.values(v.floors).flat().flat();
  const bb = all.length ? polyBounds(all) : { x: 0, y: 0, w: v.w, h: v.h };
  const m = Math.max(bb.w, bb.h) * 0.12;
  const fit = { x: Math.max(0, bb.x - m), y: Math.max(0, bb.y - m), w: Math.min(v.w, bb.w + m * 2), h: Math.min(v.h, bb.h + m * 2) };

  return (
    <div className="stage">
      <DeepZoom key={v.id} dzi={`/media/ue/facades/${v.id}.dzi`} width={v.w} height={v.h} fit={fit} className="dz-aerial">
        {b.floors.map((f) => {
          const polys = v.floors[String(floorNum(f.id))] ?? [];
          if (!polys.length) return null;
          const list = unitsForPlan(f.plan);
          const color = f.plan ? (list.length ? availColor(list) : BAND) : BAND_OFF;
          const label = f.plan ? floorLabel(f.id, lang) : `${floorLabel(f.id, lang)} · ${t('planPending')}`;
          const sub = list.length ? `${list.filter((u) => u.status === 'available').length}/${list.length} ${t('available')}` : '';
          const big = polys.reduce((a, p) => (polyBounds(p).w * polyBounds(p).h > polyBounds(a).w * polyBounds(a).h ? p : a), polys[0]);
          const [cx, cy] = polyCenter(big);
          const openFloor = () => f.plan && nav(`/master-plan/building/${b.id}/floor/${f.id}`);
          return (
            <g key={f.id} className={`bld ${hover === f.id ? 'hover' : ''} ${f.plan ? '' : 'off'}`} style={{ ['--c' as string]: color }}
               onMouseEnter={() => setHover(f.id)} onMouseLeave={() => setHover(null)} onClick={openFloor}
               role="link" tabIndex={0} aria-label={label} onKeyDown={(e) => e.key === 'Enter' && openFloor()}>
              {polys.map((p, i) => <polygon key={i} points={p.map((q) => q.join(',')).join(' ')} />)}
              {hover === f.id && (
                <g className="svg-tag" style={{ transform: `translate(${cx}px, ${cy}px) scale(var(--k))` }}>
                  <rect x="-62" y="-20" width="124" height={sub ? 38 : 24} rx="6" />
                  <text y={sub ? -5 : -4} textAnchor="middle" className="t1">{label}</text>
                  {sub && <text y="10" textAnchor="middle" className="t2">{sub}</text>}
                </g>
              )}
            </g>
          );
        })}
      </DeepZoom>
      {views.length > 1 && (
        <div className="angles" role="group" aria-label={t('views')}>
          <button className="round" onClick={() => go(-1)} aria-label={t('prev')}><IArrow size={20} /></button>
          {views.map((x, i) => (
            <button key={x.id} className={`angle ${i === view ? 'on' : ''}`} onClick={() => setView(i)} aria-label={`${t('views')} ${i + 1}`}>
              <img src={`/media/ue/facades/${x.id}-thumb.webp`} alt="" width={84} height={56} />
            </button>
          ))}
          <button className="round" onClick={() => go(1)} aria-label={t('next')}><IArrow size={20} /></button>
        </div>
      )}
      <p className="hint">{t('tapFloor')}</p>
    </div>
  );
}
