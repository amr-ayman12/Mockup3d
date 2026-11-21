import { useEffect, useRef, useState } from 'react';
import OpenSeadragon from 'openseadragon';
import { useNavigate } from 'react-router-dom';
import { SideControls } from '../components/Chrome';
import { Mark } from '../components/Icons';
import { site } from '../lib/data';
import landmarksJson from '../data/landmarks.json';
import { useI18n } from '../lib/i18n';

// Satellite basemap (Esri World Imagery, XYZ tiles) shown through OpenSeadragon as one huge
// Web-Mercator image: OSD level L == map zoom L - 8.
const Z = 19;
const W = 256 * 2 ** Z;
const merc = (lat: number, lng: number) => {
  const s = Math.sin((lat * Math.PI) / 180);
  return { x: ((lng + 180) / 360) * W, y: (0.5 - Math.log((1 + s) / (1 - s)) / (4 * Math.PI)) * W };
};
const zoomBox = (p: { x: number; y: number }, z: number, cw: number, ch: number) => {
  const k = 2 ** (Z - z);
  return { x: p.x - (cw * k) / 2, y: p.y - (ch * k) / 2, w: cw * k, h: ch * k };
};

type Cat = 'landmarks' | 'education' | 'health' | 'transport';
type Place = { id: string; cat: Cat; name: { en: string; ar: string }; lat: number; lng: number; minutes: number | null; km: number | null };
// baked by scripts/make-landmarks.mjs (OpenStreetMap places + OSRM driving times), so the page needs no live lookup
const places = landmarksJson.places as Place[];
const CATS: { id: Cat | 'all'; en: string; ar: string; icon: string }[] = [
  { id: 'all', en: 'Show all', ar: 'الكل', icon: '◎' },
  { id: 'landmarks', en: 'Landmarks', ar: 'معالم', icon: '⌂' },
  { id: 'transport', en: 'Transport', ar: 'مواصلات', icon: '✈' },
  { id: 'education', en: 'Education', ar: 'تعليم', icon: '✎' },
  { id: 'health', en: 'Health', ar: 'صحة', icon: '✚' },
];

const WMO: [number, string, string][] = [
  [0, 'Clear sky', 'سما صافية'], [3, 'Partly cloudy', 'غيوم متفرقة'], [48, 'Fog', 'شبورة'], [67, 'Rain', 'مطر'],
  [77, 'Snow', 'تلج'], [82, 'Showers', 'زخات مطر'], [99, 'Thunderstorm', 'عواصف رعدية'],
];

function Weather({ lat, lng }: { lat: number; lng: number }) {
  const { lang } = useI18n();
  const [w, setW] = useState<{ temp: number; code: number; tz: string } | null>(null);
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = window.setInterval(() => setNow(new Date()), 30000);
    fetch(`https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lng}&current=temperature_2m,weather_code&timezone=auto`)
      .then((r) => r.json()).then((j) => setW({ temp: j.current.temperature_2m, code: j.current.weather_code, tz: j.timezone }))
      .catch(() => {});
    return () => window.clearInterval(id);
  }, [lat, lng]);
  if (!w) return null;
  const desc = WMO.find(([c]) => w.code <= c) ?? WMO[WMO.length - 1];
  const loc = lang === 'ar' ? 'ar-EG' : 'en-GB';
  const time = new Intl.DateTimeFormat(loc, { hour: '2-digit', minute: '2-digit', timeZone: w.tz }).format(now);
  const date = new Intl.DateTimeFormat(loc, { weekday: 'short', day: 'numeric', month: 'short', timeZone: w.tz }).format(now);
  return (
    <div className="weather">
      <b>{Math.round(w.temp)}°</b>
      <span>{lang === 'ar' ? desc[2] : desc[1]}</span>
      <small><span>{time}</span><span>{date}</span></small>
    </div>
  );
}

export default function Location() {
  const { lang, t, tx } = useI18n();
  const nav = useNavigate();
  const host = useRef<HTMLDivElement>(null);
  const pinRef = useRef<HTMLButtonElement>(null);
  const layer = useRef<HTMLDivElement>(null);
  const viewer = useRef<OpenSeadragon.Viewer | null>(null);
  const [cat, setCat] = useState<Cat | 'all'>('all');
  const [leaving, setLeaving] = useState(false);
  const { lat, lng } = site.location;
  const pin = merc(lat, lng);

  useEffect(() => {
    let v: OpenSeadragon.Viewer | null = null;
    const timer = window.setTimeout(() => {
      const el = host.current!;
      v = OpenSeadragon({
        element: el,
        tileSources: {
          // maxLevel must be the full-size level (8 + Z) so level L maps to map zoom L - 8
          width: W, height: W, tileSize: 256, tileOverlap: 0, minLevel: 8 + 5, maxLevel: 8 + Z,
          getTileUrl: (l: number, x: number, y: number) => `https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/${l - 8}/${y}/${x}`,
        } as unknown as OpenSeadragon.TileSourceOptions,
        crossOriginPolicy: 'Anonymous',
        showNavigationControl: false,
        animationTime: 1.6,
        springStiffness: 5,
        immediateRender: false,
        visibilityRatio: 1,
        minZoomLevel: (256 * 2 ** 9) / Math.max(1, el.clientWidth),
        maxZoomPixelRatio: 0.5, // stop at map zoom 18 (19 is missing in many places)
        gestureSettingsMouse: { clickToZoom: false, dblClickToZoom: true },
      });
      viewer.current = v;
      const place = () => {
        const item = v!.world.getItemAt(0);
        if (!item) return;
        const set = (node: HTMLElement | null, x: number, y: number) => {
          if (!node) return;
          const p = item.imageToViewerElementCoordinates(new OpenSeadragon.Point(x, y));
          node.style.transform = `translate(${p.x}px, ${p.y}px)`;
        };
        set(pinRef.current, pin.x, pin.y);
        layer.current?.querySelectorAll<HTMLElement>('[data-x]').forEach((n) => set(n, +n.dataset.x!, +n.dataset.y!));
      };
      v.addHandler('open', () => {
        const item = v!.world.getItemAt(0);
        const b = zoomBox(pin, 11, el.clientWidth, el.clientHeight);
        v!.viewport.fitBounds(item.imageToViewportRectangle(b.x, b.y, b.w, b.h), true);
        // gentle zoom in once the first tiles are there
        window.setTimeout(() => {
          const b2 = zoomBox(pin, 13, el.clientWidth, el.clientHeight);
          v?.viewport.fitBounds(item.imageToViewportRectangle(b2.x, b2.y, b2.w, b2.h));
        }, 900);
        place();
      });
      v.addHandler('update-viewport', place);
      v.addHandler('resize', place);
    }, 0);
    return () => { window.clearTimeout(timer); v?.destroy(); viewer.current = null; };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // after new places render, put them in place
  useEffect(() => { viewer.current?.raiseEvent('update-viewport', {}); }, [cat, lang]);

  const zoomTo = (z: number) => {
    const v = viewer.current, item = v?.world.getItemAt(0), el = host.current;
    if (!v || !item || !el) return;
    const b = zoomBox(pin, z, el.clientWidth, el.clientHeight);
    v.viewport.fitBounds(item.imageToViewportRectangle(b.x, b.y, b.w, b.h));
  };
  const enter = () => {
    if (leaving) return;
    setLeaving(true);
    zoomTo(17);
    window.setTimeout(() => nav('/master-plan'), 1500);
  };
  const shown = places.filter((p) => cat === 'all' || p.cat === cat);

  return (
    <div className={`location ${leaving ? 'leaving' : ''}`}>
      <div className="map" ref={host} />
      <div className="map-layer" ref={layer}>
        {shown.map((p) => {
          const m = merc(p.lat, p.lng);
          return (
            <div key={p.id} className="poi" data-x={m.x} data-y={m.y}>
              <i /><span>{tx(p.name)}</span><em>{CATS.find((c) => c.id === p.cat)?.icon}</em>
              {p.minutes != null && <small className="eta" title={`${p.km} km`}>{p.minutes} {lang === 'ar' ? 'د' : 'min'}</small>}
            </div>
          );
        })}
        <button ref={pinRef} className="project-pin" onClick={enter} aria-label={t('enter')}>
          <span className="pin-card"><Mark size={34} /><b>{tx(site.name)}</b><small>{t('enter')}</small></span>
          <i />
        </button>
      </div>
      <div className="clouds" aria-hidden="true">{Array.from({ length: 7 }, (_, i) => <span key={i} />)}</div>

      {places.length > 0 && (
        <div className="map-filter" role="group" aria-label="map filter">
          <b>{lang === 'ar' ? 'فلتر الخريطة' : 'Map filter'}</b>
          {CATS.filter((c) => c.id === 'all' || places.some((p) => p.cat === c.id)).map((c) => (
            <button key={c.id} className={cat === c.id ? 'on' : ''} onClick={() => setCat(c.id)}>
              <em>{c.icon}</em><span>{lang === 'ar' ? c.ar : c.en}</span>
            </button>
          ))}
        </div>
      )}
      <Weather lat={lat} lng={lng} />
      <SideControls onZoom={(k) => viewer.current?.viewport.zoomBy(k).applyConstraints()} onReset={() => zoomTo(13)} />
      <p className="map-credit">Imagery © Esri, Maxar · Places © OpenStreetMap contributors · {lang === 'ar' ? 'أوقات السواقة: OSRM من غير زحمة' : 'Drive times: OSRM, no traffic'}{site.location.placeholder ? ` · ${t('locPlaceholder')}` : ''}</p>
    </div>
  );
}
