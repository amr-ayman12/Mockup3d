import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import type { Lang, Text } from './data';

const STRINGS = {
  masterPlan: { en: 'Master plan', ar: 'الماستر بلان' },
  location: { en: 'Location', ar: 'الموقع' },
  enter: { en: 'Explore the resort', ar: 'استكشف المنتجع' },
  buildings: { en: 'Buildings', ar: 'المباني' },
  floors: { en: 'Floors', ar: 'الأدوار' },
  floor: { en: 'Floor', ar: 'الدور' },
  units: { en: 'units', ar: 'وحدة' },
  unit: { en: 'Unit', ar: 'وحدة' },
  spaces: { en: 'Spaces', ar: 'الفراغات' },
  available: { en: 'Available', ar: 'متاحة' },
  reserved: { en: 'Reserved', ar: 'محجوزة' },
  sold: { en: 'Sold', ar: 'مباعة' },
  type: { en: 'Type', ar: 'النوع' },
  byAvail: { en: 'Availability', ar: 'الإتاحة' },
  propertyType: { en: 'Property type', ar: 'نوع الوحدة' },
  view: { en: 'View', ar: 'الإطلالة' },
  viewAll: { en: 'View all', ar: 'الكل' },
  area: { en: 'Area', ar: 'المساحة' },
  areaSqm: { en: 'Area (m²)', ar: 'المساحة (م²)' },
  priceM: { en: 'Price (M AED)', ar: 'السعر (مليون درهم)' },
  price: { en: 'Price', ar: 'السعر' },
  beds: { en: 'Bedrooms', ar: 'غرف النوم' },
  sea: { en: 'Sea', ar: 'البحر' },
  pool: { en: 'Pool', ar: 'حمام السباحة' },
  garden: { en: 'Garden', ar: 'الحديقة' },
  Standard: { en: 'Standard room', ar: 'غرفة ستاندرد' },
  Deluxe: { en: 'Deluxe room', ar: 'غرفة ديلوكس' },
  Suite: { en: 'Suite', ar: 'جناح' },
  m2: { en: 'm²', ar: 'م²' },
  aed: { en: 'AED', ar: 'درهم' },
  search: { en: 'Search', ar: 'بحث' },
  unitFilter: { en: 'Unit filter', ar: 'فلتر الوحدات' },
  showing: { en: 'Showing', ar: 'معروض' },
  of: { en: 'of', ar: 'من' },
  showMore: { en: 'Show more', ar: 'اعرض أكتر' },
  exploreUnit: { en: 'Explore unit', ar: 'استكشف الوحدة' },
  noResults: { en: 'No units match these filters.', ar: 'مفيش وحدات مطابقة للفلتر ده.' },
  tour: { en: 'Interactive tour', ar: 'جولة تفاعلية' },
  backMaster: { en: 'Back to master plan', ar: 'رجوع للماستر بلان' },
  hideMenu: { en: 'Hide menu', ar: 'إخفاء القائمة' },
  showMenu: { en: 'Show menu', ar: 'إظهار القائمة' },
  floorPlan: { en: 'Floor plan', ar: 'بلان الدور' },
  contact: { en: 'Contact', ar: 'تواصل' },
  callback: { en: 'Request a callback', ar: 'اطلب مكالمة' },
  firstName: { en: 'First name', ar: 'الاسم الأول' },
  lastName: { en: 'Last name', ar: 'اسم العيلة' },
  email: { en: 'Email', ar: 'الإيميل' },
  phone: { en: 'Phone', ar: 'الموبايل' },
  nationality: { en: 'Nationality', ar: 'الجنسية' },
  message: { en: 'Message', ar: 'رسالتك' },
  send: { en: 'Send', ar: 'إرسال' },
  sendWa: { en: 'Send on WhatsApp', ar: 'ابعت على واتساب' },
  sendMail: { en: 'Send by email', ar: 'ابعت بالإيميل' },
  askAbout: { en: 'I would like to know more about', ar: 'عايز أعرف أكتر عن' },
  filters: { en: 'Filters', ar: 'الفلاتر' },
  hideOverlay: { en: 'Hide overlay', ar: 'إخفاء العلامات' },
  language: { en: 'Change language', ar: 'تغيير اللغة' },
  fullscreen: { en: 'Fullscreen', ar: 'ملء الشاشة' },
  zoomIn: { en: 'Zoom in', ar: 'تكبير' },
  zoomOut: { en: 'Zoom out', ar: 'تصغير' },
  reset: { en: 'Reset view', ar: 'رجوع للعرض الأصلي' },
  close: { en: 'Close', ar: 'إغلاق' },
  prev: { en: 'Previous', ar: 'السابق' },
  next: { en: 'Next', ar: 'التالي' },
  planPending: { en: 'Plan pending', ar: 'البلان لسه' },
  loading3d: { en: 'Loading the 3D model…', ar: 'بيحمّل المجسم الـ 3D…' },
  model3d: { en: '3D model', ar: 'مجسم 3D' },
  aerialView: { en: 'Aerial render', ar: 'الصورة الجوية' },
  views: { en: 'Views', ar: 'زوايا' },
  placeholder: { en: 'Placeholder: the owner has not supplied this yet.', ar: 'بيانات مؤقتة: لسه المالك ما بعتهاش.' },
  demo: { en: 'Demo data: statuses and prices are placeholders.', ar: 'بيانات ديمو: الحالات والأسعار مؤقتة.' },
  aiNote: { en: 'Concept interior based on the CAD plan.', ar: 'تصوّر داخلي مبني على بلان الكاد.' },
  locPlaceholder: { en: 'Location is a placeholder until the owner confirms it.', ar: 'الموقع مؤقت لحد ما المالك يأكده.' },
  tapFloor: { en: 'Tap a floor to open it', ar: 'اضغط على دور عشان تفتحه' },
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
