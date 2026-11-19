import buildingsJson from '../data/buildings.json';
import shotsJson from '../data/shots.json';
import mediaJson from '../data/media.json';
import siteJson from '../data/site.json';
import spacesAr from '../data/spaces-ar.json';
import unitsJson from '../data/units.json';
import unitShapesJson from '../data/unit-shapes.json';

export type Lang = 'ar' | 'en';
export type Text = { en: string; ar: string };
export type Floor = { id: string; plan: string | null; cropBox?: number[]; use: Text };
export type Building = { id: string; color: string; name: Text; poly: number[][]; label: number[]; floors: Floor[] };
export type Shot = { id: string; plan: string; space: string; fx: number; fy: number; heading: number; fov: number };
type Box = { x: number; y: number; w: number; h: number };
type Media = {
  shots: Record<string, { w: number; h: number }>;
  plans: Record<string, { w: number; h: number; box: Box }>;
  plans2d: Record<string, { w: number; h: number }>;
  master: { w: number; h: number };
};

export const site = siteJson;
export const buildings = buildingsJson.buildings as Building[];
export const shots = shotsJson as Shot[];
export const media = mediaJson as unknown as Media;

export const getBuilding = (id?: string) => buildings.find((b) => b.id === id);
export const getFloor = (b?: Building, id?: string) => b?.floors.find((f) => f.id === id);
export const shotsForPlan = (plan?: string | null) => (plan ? shots.filter((s) => s.plan === plan) : []);
export const shotsForBuilding = (b: Building) => b.floors.flatMap((f) => shotsForPlan(f.plan));
export const getShot = (id?: string | null) => shots.find((s) => s.id === id);

export function shotLocation(s: Shot) {
  for (const b of buildings) for (const f of b.floors) if (f.plan === s.plan) return { b, f };
  return null;
}

export const spaceName = (s: Shot, lang: Lang) =>
  lang === 'ar' ? (spacesAr as Record<string, string>)[s.id] ?? s.space : s.space;

export const shotSrc = (id: string, w: 480 | 960 | 1600) => `/media/shots/${id}-${w}.webp`;
export const shotFallback = (id: string) => `/media/shots/${id}-1600.jpg`;

/** Camera marker position in image pixels: exact on the 2D crop, mapped by building box on the 3D plan. */
export function markerPos(s: Shot, floor: Floor, mode: '3d' | '2d') {
  if (mode === '2d') {
    const m = media.plans2d[s.plan];
    return { x: s.fx * m.w, y: s.fy * m.h, scale: m.w / 1600 };
  }
  const m = media.plans[s.plan];
  const [x0, y0, x1, y1] = floor.cropBox ?? [0, 0, 1, 1];
  const u = (s.fx - x0) / (x1 - x0);
  const v = (s.fy - y0) / (y1 - y0);
  return { x: m.box.x + u * m.box.w, y: m.box.y + v * m.box.h, scale: m.w / 1600 };
}

export function polyBounds(poly: number[][]) {
  const xs = poly.map((p) => p[0]);
  const ys = poly.map((p) => p[1]);
  const x = Math.min(...xs), y = Math.min(...ys);
  return { x, y, w: Math.max(...xs) - x, h: Math.max(...ys) - y };
}

// ---------- units (DEMO data until the owner's list arrives) ----------
export type Status = 'available' | 'reserved' | 'sold';
export type Unit = {
  id: string; building: string; floor: string; plan: string; type: 'Standard' | 'Deluxe' | 'Suite';
  area_m2: number; beds: number; view: 'sea' | 'pool' | 'garden'; status: Status; price: number;
  currency: string; shot: string | null; demo: boolean;
};
export const units = unitsJson.units as Unit[];
export const unitsDemo = units.some((u) => u.demo);
export const getUnit = (id?: string | null) => units.find((u) => u.id === id);
export const unitsForPlan = (plan?: string | null) => units.filter((u) => u.plan === plan);
export const unitsForBuilding = (id: string) => units.filter((u) => u.building === id);
export const STATUS_COLOR: Record<Status, string> = { available: '#2e8b57', reserved: '#d39a2c', sold: '#b4483d' };
export const priceRange = [Math.min(...units.map((u) => u.price)), Math.max(...units.map((u) => u.price))];
export const areaRange = [Math.min(...units.map((u) => u.area_m2)), Math.max(...units.map((u) => u.area_m2))];
/** colour for a group of units: share still available (green / amber / red), grey when there are none */
export function availColor(list: Unit[]) {
  if (!list.length) return '#9aa3a0';
  const r = list.filter((u) => u.status === 'available').length / list.length;
  return r >= 0.6 ? '#2e8b57' : r >= 0.3 ? '#d39a2c' : '#b4483d';
}
export const formatPrice =(n: number, lang: Lang) =>
  new Intl.NumberFormat(lang === 'ar' ? 'ar-EG' : 'en-US', { maximumFractionDigits: 0 }).format(n);

// ---------- floors, unit outlines, breadcrumb ----------
const ORD_EN = ['Ground', 'First', 'Second', 'Third', 'Fourth', 'Fifth'];
const ORD_AR = ['الأرضي', 'الأول', 'الثاني', 'الثالث', 'الرابع', 'الخامس'];
const floorIndex = (id: string) => (id === 'G' ? 0 : +id || 0);
/** "Ground Floor" / "الدور الأرضي" */
export const floorLabel = (id: string, lang: Lang) =>
  lang === 'ar' ? `الدور ${ORD_AR[floorIndex(id)] ?? id}` : `${ORD_EN[floorIndex(id)] ?? id} Floor`;
/** "GF", "1F" (the floor picker) */
export const floorShort = (id: string, lang: Lang) => (id === 'G' ? (lang === 'ar' ? 'أرضي' : 'GF') : `${id}F`);

const unitShapes = unitShapesJson as unknown as Record<string, Record<string, number[][]>>;
/** outline of a unit on its floor's 3D plan (image pixels) */
export const unitShape = (u: Unit) => unitShapes[u.plan]?.[u.id];
export const polyCenter = (poly: number[][]) => [
  poly.reduce((s, p) => s + p[0], 0) / poly.length,
  poly.reduce((s, p) => s + p[1], 0) / poly.length,
];

export type Crumb = { label: string; to: string };
/** the place trail shown in the top dropdown: location > project > building > floor > tour */
export function crumbs(path: string, lang: Lang): Crumb[] {
  const out: Crumb[] = [{ label: site.location.city[lang], to: '/' }, { label: site.name[lang], to: '/master-plan' }];
  const m = path.match(/^\/master-plan\/building\/([^/]+)(?:\/floor\/([^/]+))?(?:\/tour\/([^/]+))?/);
  const b = getBuilding(m?.[1]);
  if (!b) return out;
  out.push({ label: b.name[lang], to: `/master-plan/building/${b.id}` });
  const f = getFloor(b, m?.[2]);
  if (!f) return out;
  out.push({ label: floorLabel(f.id, lang), to: `/master-plan/building/${b.id}/floor/${f.id}` });
  if (m?.[3]) out.push({ label: lang === 'ar' ? 'جولة تفاعلية' : 'Interactive tour', to: path });
  return out;
}

/** WhatsApp link with a pre-filled message, or null while the number is a placeholder. */
export function whatsappLink(text: string) {
  return site.whatsapp ? `https://wa.me/${site.whatsapp.replace(/\D/g, '')}?text=${encodeURIComponent(text)}` : null;
}
