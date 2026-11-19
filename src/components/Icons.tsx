// Small line icons (24px grid, currentColor) used across the chrome.
type P = { size?: number };
const S = ({ size = 22, children }: P & { children: React.ReactNode }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6"
       strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{children}</svg>
);

export const IMail = (p: P) => <S {...p}><rect x="3" y="5" width="18" height="14" rx="2" /><path d="m3.5 6 8.5 7 8.5-7" /></S>;
export const ISliders = (p: P) => <S {...p}><path d="M4 7h10M18 7h2M4 17h4M12 17h8" /><circle cx="16" cy="7" r="2" /><circle cx="10" cy="17" r="2" /></S>;
export const IEyeOff = (p: P) => <S {...p}><path d="M3 3l18 18" /><path d="M10.6 6.1A9.8 9.8 0 0 1 12 6c5 0 8.5 4.2 9.5 6-.4.8-1.3 2-2.6 3.2M6.6 7.6C4.6 8.9 3.2 10.8 2.5 12c1 1.8 4.5 6 9.5 6 1.6 0 3-.4 4.3-1" /><path d="M9.9 10a3 3 0 0 0 4.1 4.1" /></S>;
export const IEye = (p: P) => <S {...p}><path d="M2.5 12C3.5 10.2 7 6 12 6s8.5 4.2 9.5 6c-1 1.8-4.5 6-9.5 6s-8.5-4.2-9.5-6Z" /><circle cx="12" cy="12" r="3" /></S>;
export const IPlus = (p: P) => <S {...p}><path d="M12 5v14M5 12h14" /></S>;
export const IMinus = (p: P) => <S {...p}><path d="M5 12h14" /></S>;
export const IReset = (p: P) => <S {...p}><path d="M4 12a8 8 0 1 0 2.4-5.7" /><path d="M4 4v4h4" /></S>;
export const IFull = (p: P) => <S {...p}><path d="M4 9V5a1 1 0 0 1 1-1h4M15 4h4a1 1 0 0 1 1 1v4M20 15v4a1 1 0 0 1-1 1h-4M9 20H5a1 1 0 0 1-1-1v-4" /></S>;
export const IChevron = (p: P) => <S {...p}><path d="m6 9 6 6 6-6" /></S>;
export const IArrow = (p: P) => <S {...p}><path d="m10 6 6 6-6 6" /></S>;
export const IClose = (p: P) => <S {...p}><path d="M6 6l12 12M18 6 6 18" /></S>;
export const ILayers = (p: P) => <S {...p}><path d="m12 4 8 4-8 4-8-4 8-4Z" /><path d="m4 12 8 4 8-4M4 16l8 4 8-4" /></S>;
export const IBed = (p: P) => <S {...p}><path d="M3 18V7M3 14h18v4M21 14v-3a3 3 0 0 0-3-3h-7v6" /><circle cx="7" cy="11" r="1.6" /></S>;
export const IArea = (p: P) => <S {...p}><rect x="4" y="4" width="16" height="16" rx="1.5" /><path d="M8 16l8-8M12 8h4v4" /></S>;
export const IPlan = (p: P) => <S {...p}><rect x="4" y="4" width="16" height="16" rx="2" /><path d="M4 11h6v9M14 4v7h6M14 15h2" /></S>;
export const ICube = (p: P) => <S {...p}><path d="m12 3 8 4.5v9L12 21l-8-4.5v-9L12 3Z" /><path d="m4 7.5 8 4.5 8-4.5M12 12v9" /></S>;
export const IImage = (p: P) => <S {...p}><rect x="3" y="5" width="18" height="14" rx="2" /><circle cx="9" cy="10" r="1.8" /><path d="m21 16-5-5-9 8" /></S>;
export const ISearch = (p: P) => <S {...p}><circle cx="11" cy="11" r="6" /><path d="m20 20-4.5-4.5" /></S>;
export const ICompass = (p: P) => <S {...p}><circle cx="12" cy="12" r="9" /><path d="m15.5 8.5-2 5-5 2 2-5 5-2Z" /></S>;

/** Placeholder resort mark: sun over waves (swap for the owner's logo). */
export const Mark = ({ size = 34 }: P) => (
  <svg width={size} height={size} viewBox="0 0 40 40" aria-hidden="true">
    <circle cx="20" cy="15" r="7" fill="none" stroke="currentColor" strokeWidth="2" />
    <path d="M4 25c4 0 4-3 8-3s4 3 8 3 4-3 8-3 4 3 8 3M4 31c4 0 4-3 8-3s4 3 8 3 4-3 8-3 4 3 8 3" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
  </svg>
);
