import { useSearchParams } from 'react-router-dom';
import { formatPrice, STATUS_COLOR, type Unit } from '../lib/data';
import { useI18n } from '../lib/i18n';

/** Compact list of units; a click opens the unit card (?unit=<id>). */
export default function UnitList({ list }: { list: Unit[] }) {
  const [params, setParams] = useSearchParams();
  const { lang, t } = useI18n();
  const open = (id: string) => { const p = new URLSearchParams(params); p.set('unit', id); p.delete('shot'); setParams(p); };
  const active = params.get('unit');
  return (
    <ul className="unit-list">
      {list.map((u) => (
        <li key={u.id}>
          <button className={active === u.id ? 'on' : ''} onClick={() => open(u.id)}>
            <span className="dot" style={{ background: STATUS_COLOR[u.status] }} aria-hidden />
            <span className="unit-id" dir="ltr">{u.id}</span>
            <span className="muted small">{t(u.type)} · {u.area_m2} {t('m2')}</span>
            <span className="small price">{u.status === 'sold' ? t('sold') : formatPrice(u.price, lang)}</span>
          </button>
        </li>
      ))}
    </ul>
  );
}
