import { useState, type FormEvent } from 'react';
import { site, whatsappLink } from '../lib/data';
import { useI18n } from '../lib/i18n';
import { IClose } from './Icons';

/** "Request a callback" form. Until the owner gives a WhatsApp number / email it only prepares the message. */
export default function ContactSheet({ open, onClose, subject }: { open: boolean; onClose: () => void; subject?: string }) {
  const { t, tx } = useI18n();
  const [f, setF] = useState({ first: '', last: '', email: '', phone: '', nationality: '', message: '' });
  if (!open) return null;
  const about = `${t('askAbout')} ${subject ?? tx(site.name)}`;
  const body = [about, '', `${f.first} ${f.last}`.trim(), f.email, f.phone, f.nationality, f.message].filter(Boolean).join('\n');
  const wa = whatsappLink(body);
  const mail = site.email ? `mailto:${site.email}?subject=${encodeURIComponent(about)}&body=${encodeURIComponent(body)}` : null;
  const submit = (e: FormEvent) => {
    e.preventDefault();
    const target = wa ?? mail;
    if (target) window.open(target, '_blank', 'noopener');
  };
  const field = (k: keyof typeof f, label: string, type = 'text') => (
    <label className={k === 'message' ? 'wide' : ''}>
      <span>{label}</span>
      {k === 'message'
        ? <textarea rows={3} value={f[k]} onChange={(e) => setF({ ...f, [k]: e.target.value })} />
        : <input type={type} value={f[k]} onChange={(e) => setF({ ...f, [k]: e.target.value })} autoComplete={type === 'email' ? 'email' : type === 'tel' ? 'tel' : 'off'} />}
    </label>
  );

  return (
    <div className="modal-back" onClick={onClose}>
      <form className="modal" role="dialog" aria-modal="true" aria-label={t('callback')} onClick={(e) => e.stopPropagation()} onSubmit={submit}>
        <div className="modal-head">
          <h2>{t('callback')}</h2>
          <button type="button" className="x" onClick={onClose} aria-label={t('close')}><IClose /></button>
        </div>
        <p className="muted small">{about}</p>
        <div className="form-grid">
          {field('first', t('firstName'))}
          {field('last', t('lastName'))}
          {field('email', t('email'), 'email')}
          {field('phone', t('phone'), 'tel')}
          {field('nationality', t('nationality'))}
          {field('message', t('message'))}
        </div>
        <button className="btn primary block" type="submit" disabled={!wa && !mail}>{wa ? t('sendWa') : mail ? t('sendMail') : t('send')}</button>
        {!wa && !mail && <p className="placeholder-note">{t('placeholder')}</p>}
      </form>
    </div>
  );
}
