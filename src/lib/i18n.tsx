import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import type { Lang, Text } from './data';

const STRINGS = {
  explore: { en: 'Explore the master plan', ar: 'استكشف الماستر بلان' },
  masterPlan: { en: 'Master plan', ar: 'الماستر بلان' },
  project: { en: 'Project', ar: 'المشروع' },
  buildings: { en: 'Buildings', ar: 'المباني' },
  floors: { en: 'Floors', ar: 'الأدوار' },
  floor: { en: 'Floor', ar: 'الدور' },
  spaces: { en: 'Spaces', ar: 'الفراغات' },
  views: { en: 'views', ar: 'لقطة' },
  openFloor: { en: 'Open floor', ar: 'افتح الدور' },
  planPending: { en: 'Plan pending', ar: 'البلان لسه' },
  view3d: { en: '3D plan', ar: '3D' },
  view2d: { en: 'CAD plan', ar: 'الكاد' },
  showOnPlan: { en: 'Location on the plan', ar: 'مكانها على البلان' },
  contact: { en: 'Contact', ar: 'تواصل' },
  contactTitle: { en: 'Talk to sales', ar: 'كلّم المبيعات' },
  whatsapp: { en: 'WhatsApp', ar: 'واتساب' },
  email: { en: 'Email', ar: 'إيميل' },
  placeholder: { en: 'Placeholder: the owner has not supplied this yet.', ar: 'بيانات مؤقتة: لسه المالك ما بعتهاش.' },
  close: { en: 'Close', ar: 'إغلاق' },
  prev: { en: 'Previous', ar: 'السابق' },
  next: { en: 'Next', ar: 'التالي' },
  overlays: { en: 'Show / hide overlays', ar: 'إظهار / إخفاء العلامات' },
  fullscreen: { en: 'Fullscreen', ar: 'ملء الشاشة' },
  zoomIn: { en: 'Zoom in', ar: 'تكبير' },
  zoomOut: { en: 'Zoom out', ar: 'تصغير' },
  reset: { en: 'Reset view', ar: 'رجوع للعرض الأصلي' },
  aiNote: { en: 'Interior visual based on the CAD plan (concept image).', ar: 'تصوّر داخلي مبني على بلان الكاد (صورة تصوّرية).' },
  hint: { en: 'Tap a building to open it', ar: 'اضغط على مبنى عشان تفتحه' },
  hintFloor: { en: 'Tap a camera to see the space', ar: 'اضغط على الكاميرا عشان تشوف الفراغ' },
  location: { en: 'Location', ar: 'الموقع' },
  askAbout: { en: 'I would like to know more about', ar: 'عايز أعرف أكتر عن' },
  units: { en: 'Units', ar: 'الوحدات' },
  unit: { en: 'Unit', ar: 'وحدة' },
  findUnit: { en: 'Find a unit', ar: 'دوّر على وحدة' },
  byType: { en: 'By use', ar: 'حسب الاستخدام' },
  byAvail: { en: 'Availability', ar: 'المتاح' },
  available: { en: 'Available', ar: 'متاحة' },
  reserved: { en: 'Reserved', ar: 'محجوزة' },
  sold: { en: 'Sold', ar: 'مباعة' },
  any: { en: 'Any', ar: 'الكل' },
  type: { en: 'Type', ar: 'النوع' },
  status: { en: 'Status', ar: 'الحالة' },
  view: { en: 'View', ar: 'الإطلالة' },
  area: { en: 'Area', ar: 'المساحة' },
  price: { en: 'Price', ar: 'السعر' },
  maxPrice: { en: 'Max price', ar: 'أقصى سعر' },
  minArea: { en: 'Min area', ar: 'أقل مساحة' },
  beds: { en: 'Bedrooms', ar: 'غرف النوم' },
  results: { en: 'results', ar: 'نتيجة' },
  sea: { en: 'Sea', ar: 'البحر' },
  pool: { en: 'Pool', ar: 'حمام السباحة' },
  garden: { en: 'Garden', ar: 'الحديقة' },
  Standard: { en: 'Standard room', ar: 'غرفة ستاندرد' },
  Deluxe: { en: 'Deluxe room', ar: 'غرفة ديلوكس' },
  Suite: { en: 'Suite', ar: 'جناح' },
  tour: { en: 'Interior view', ar: 'شوف من جوه' },
  goFloor: { en: 'Open floor', ar: 'افتح الدور' },
  demo: { en: 'Demo data: statuses and prices are placeholders.', ar: 'بيانات ديمو: الحالات والأسعار مؤقتة.' },
  m2: { en: 'm²', ar: 'م²' },
  aed: { en: 'AED', ar: 'درهم' },
  availableOf: { en: 'available', ar: 'متاحة' },
  loading3d: { en: 'Loading the 3D model…', ar: 'بيحمّل المجسم الـ 3D…' },
  model3d: { en: '3D model', ar: 'مجسم 3D' },
  aerialView: { en: 'Aerial image', ar: 'صورة جوية' },
  hint3d: { en: 'Drag to orbit, pinch or scroll to zoom, tap a building to open it', ar: 'اسحب عشان تلف، قرّب بالصباعين أو العجلة، واضغط على مبنى عشان تفتحه' },
} satisfies Record<string, Text>;

type Key = keyof typeof STRINGS;
type Ctx = {
  lang: Lang;
  setLang: (l: Lang) => void;
  t: (k: Key) => string;
  tx: (x: Text) => string;
  overlays: boolean;
  setOverlays: (v: boolean) => void;
};
const I18n = createContext<Ctx | null>(null);

function stored(): Lang {
  try {
    const v = localStorage.getItem('lang');
    if (v === 'en' || v === 'ar') return v;
  } catch { /* storage unavailable */ }
  return 'ar';
}

export function I18nProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>(stored);
  const [overlays, setOverlays] = useState(true);
  useEffect(() => {
    document.documentElement.lang = lang;
    document.documentElement.dir = lang === 'ar' ? 'rtl' : 'ltr';
  }, [lang]);
  const value = useMemo<Ctx>(() => ({
    lang,
    setLang: (l) => {
      setLangState(l);
      try { localStorage.setItem('lang', l); } catch { /* ignore */ }
    },
    t: (k) => STRINGS[k][lang],
    tx: (x) => x[lang],
    overlays,
    setOverlays,
  }), [lang, overlays]);
  return <I18n.Provider value={value}>{children}</I18n.Provider>;
}

export function useI18n() {
  const c = useContext(I18n);
  if (!c) throw new Error('I18nProvider missing');
  return c;
}
