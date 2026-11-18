import { Link, useSearchParams } from 'react-router-dom';
import { formatPrice, getBuilding, getUnit, STATUS_COLOR, unitsDemo, whatsappLink } from '../lib/data';
import { useI18n } from '../lib/i18n';
import { floorLabel } from './TopBar';

/** Unit card for ?unit=<id> (status, type, floor, beds, area, view, price, tour, WhatsApp). */
export default function UnitCard({ onContact }: { onContact: (subject: string) => void }) {
  const [params, setParams] = useSearchParams();
  const { lang, t, tx } = useI18n();
  const u = getUnit(params.get('unit'));
  if (!u || params.get('shot')) return null;
  const b = getBuilding(u.building);
  const close = () => { const p = new URLSearchParams(params); p.delete('unit'); setParams(p); };
  const tour = () => { if (!u.shot) return; const p = new URLSearchParams(params); p.set('shot', u.shot); setParams(p); };
  const subject = `${t('unit')} ${u.id} – ${b ? tx(b.name) : ''}`;
  const wa = whatsappLink(`${t('askAbout')} ${subject}`);

  return (
    <div className="unit-card" role="dialog" aria-label={`${t('unit')} ${u.id}`}>
      <div className="viewer-head">
        <div>
          <h2 dir="ltr" className="unit-id">{u.id}</h2>
          <p className="muted small">{b ? tx(b.name) : ''} · {floorLabel(u.floor, lang)}</p>
        </div>
        <button className="icon" onClick={close} aria-label={t('close')}>✕</button>
      </div>
      <span className="pill" style={{ ['--s' as string]: STATUS_COLOR[u.status] }}>{t(u.status)}</span>
      <dl className="facts">
        <div><dt>{t('type')}</dt><dd>{t(u.type)}</dd></div>
        <div><dt>{t('beds')}</dt><dd>{u.beds}</dd></div>
        <div><dt>{t('area')}</dt><dd>{u.area_m2} {t('m2')}</dd></div>
        <div><dt>{t('view')}</dt><dd>{t(u.view)}</dd></div>
        <div className="wide"><dt>{t('price')}</dt><dd className="price">{u.status === 'sold' ? '—' : `${formatPrice(u.price, lang)} ${t('aed')}`}</dd></div>
      </dl>
      <div className="viewer-actions">
        {u.shot && <button className="btn" onClick={tour}>{t('tour')}</button>}
        <Link className="btn" to={`/master-plan/building/${u.building}/floor/${u.floor}?unit=${u.id}`}>{t('goFloor')}</Link>
        {wa ? <a className="btn primary" href={wa} target="_blank" rel="noreferrer">{t('whatsapp')}</a>
            : <button className="btn primary" onClick={() => onContact(subject)}>{t('contact')}</button>}
      </div>
      {unitsDemo && <p className="placeholder-note">{t('demo')}</p>}
    </div>
  );
}
