import { Link } from 'react-router-dom';
import { buildings, shots, site } from '../lib/data';
import { useI18n } from '../lib/i18n';

export default function Home() {
  const { t, tx } = useI18n();
  const { lat, lng } = site.location;
  const osm = `https://www.openstreetmap.org/?mlat=${lat}&mlon=${lng}#map=15/${lat}/${lng}`;
  return (
    <div className="home">
      <img className="home-bg" src="/media/master/aerial-thumb.webp" alt="" fetchPriority="high" />
      <div className="home-card">
        <h1>{tx(site.name)}</h1>
        <p>{tx(site.tagline)}</p>
        <p className="muted small">{buildings.length} {t('buildings')} · {shots.length} {t('views')}</p>
        <Link className="btn primary big" to="/master-plan">{t('explore')}</Link>
        <a className="loc" href={osm} target="_blank" rel="noreferrer">📍 {t('location')}: {tx(site.location.label)}</a>
        {site.placeholder && <p className="placeholder-note">{t('placeholder')}</p>}
      </div>
    </div>
  );
}
