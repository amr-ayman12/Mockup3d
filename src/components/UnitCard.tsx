import { floorLabel, formatPrice, STATUS_COLOR, type Unit } from '../lib/data';
import { useI18n } from '../lib/i18n';
import { IArea, IBed, IClose, ILayers } from './Icons';

/** Floating unit card (top-end): id + status, type chip, floor / bedrooms / area, price, tour. */
export default function UnitCard({ u, onClose, onTour, onContact, compact }: {
  u: Unit; onClose?: () => void; onTour?: () => void; onContact?: () => void; compact?: boolean;
}) {
  const { lang, t } = useI18n();
  return (
    <div className={`unit-card ${compact ? 'compact' : ''}`} role="dialog" aria-label={`${t('unit')} ${u.id}`}>
      <div className="uc-head">
        <h2>{t('unit')} <bdi dir="ltr">{u.id}</bdi></h2>
        <span className="status" style={{ ['--s' as string]: STATUS_COLOR[u.status] }}>{t(u.status)}</span>
        {onClose && <button className="x" onClick={onClose} aria-label={t('close')}><IClose size={18} /></button>}
      </div>
      <span className="chip">{t(u.type)}</span>
      <dl className="uc-facts">
        <div><dt><ILayers size={16} /> {u.floor === 'G' ? 'G' : u.floor}</dt><dd>{t('floor')}</dd></div>
        <div><dt><IBed size={16} /> {u.beds}</dt><dd>{t('beds')}</dd></div>
        <div><dt><IArea size={16} /> {u.area_m2} {t('m2')}</dt><dd>{t('area')}</dd></div>
      </dl>
      {!compact && (
        <p className="uc-price">
          <span className="muted">{floorLabel(u.floor, lang)} · {t(u.view)}</span>
          <b>{u.status === 'sold' ? '—' : `${formatPrice(u.price, lang)} ${t('aed')}`}</b>
        </p>
      )}
      {onTour && <button className="btn outline block" onClick={onTour}>{t('tour')}</button>}
      {onContact && <button className="btn primary block" onClick={onContact}>{t('callback')}</button>}
    </div>
  );
}
