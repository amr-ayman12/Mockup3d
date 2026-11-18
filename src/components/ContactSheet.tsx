import { site, whatsappLink } from '../lib/data';
import { useI18n } from '../lib/i18n';

export default function ContactSheet({ open, onClose, subject }: { open: boolean; onClose: () => void; subject?: string }) {
  const { t, tx } = useI18n();
  if (!open) return null;
  const text = `${t('askAbout')} ${subject ?? tx(site.name)}`;
  const wa = whatsappLink(text);
  const mail = site.email ? `mailto:${site.email}?subject=${encodeURIComponent(text)}` : null;
  return (
    <div className="sheet-back" onClick={onClose}>
      <div className="sheet" role="dialog" aria-modal="true" onClick={(e) => e.stopPropagation()}>
        <h2>{t('contactTitle')}</h2>
        <p className="muted">{text}</p>
        <div className="sheet-actions">
          {wa ? <a className="btn primary" href={wa} target="_blank" rel="noreferrer">{t('whatsapp')}</a>
              : <span className="btn disabled">{t('whatsapp')}</span>}
          {mail ? <a className="btn" href={mail}>{t('email')}</a> : <span className="btn disabled">{t('email')}</span>}
        </div>
        {(!wa || !mail) && <p className="placeholder-note">{t('placeholder')}</p>}
        <button className="btn ghost" onClick={onClose}>{t('close')}</button>
      </div>
    </div>
  );
}
