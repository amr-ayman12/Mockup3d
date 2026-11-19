import { Suspense, lazy, useState } from 'react';
import { Navigate, useNavigate, useParams } from 'react-router-dom';
import { IArrow } from '../components/Icons';
import { buildings, floorLabel, getBuilding } from '../lib/data';
import { useI18n } from '../lib/i18n';

const ModelView = lazy(() => import('../components/ModelView'));
type FloorBand = import('../components/ModelView').FloorBand;
const BAND = '#3aa6e6';     // the reference's light-blue floor overlay
const BAND_OFF = '#9aa3a0'; // floors whose plan is still missing

export default function Building() {
  const { id } = useParams();
  const b = getBuilding(id);
  const { lang, t } = useI18n();
  const nav = useNavigate();
  const [view, setView] = useState(0);
  const [thumbs, setThumbs] = useState<string[]>([]);
  if (!b) return <Navigate to="/master-plan" replace />;

  const colors = Object.fromEntries(buildings.map((x) => [x.id, x.color]));
  const bands: FloorBand[] = b.floors.map((f) => ({
    id: f.id, enabled: !!f.plan, color: f.plan ? BAND : BAND_OFF,
    label: f.plan ? floorLabel(f.id, lang) : `${floorLabel(f.id, lang)} · ${t('planPending')}`,
  }));
  const n = Math.max(thumbs.length, 1);
  const go = (d: number) => setView((v) => (v + d + n) % n);

  return (
    <div className="stage">
      <Suspense fallback={<div className="loading" />}>
        <ModelView key={b.id} colors={colors} labels={{}} focus={b.id} floors={bands} view={view}
                   onThumbs={setThumbs} onFloor={(f) => nav(`/master-plan/building/${b.id}/floor/${f}`)} />
      </Suspense>
      {thumbs.length > 1 && (
        <div className="angles" role="group" aria-label={t('views')}>
          <button className="round" onClick={() => go(-1)} aria-label={t('prev')}><IArrow size={20} /></button>
          {thumbs.map((src, i) => (
            <button key={i} className={`angle ${i === view ? 'on' : ''}`} onClick={() => setView(i)} aria-label={`${t('views')} ${i + 1}`}>
              <img src={src} alt="" width={84} height={56} />
            </button>
          ))}
          <button className="round" onClick={() => go(1)} aria-label={t('next')}><IArrow size={20} /></button>
        </div>
      )}
      <p className="hint">{t('tapFloor')}</p>
    </div>
  );
}
