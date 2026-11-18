type Box = { x: number; y: number; w: number; h: number };

const TOP = () => (window.innerWidth <= 760 ? 54 : 60);

/**
 * Grow a view box so that, after OpenSeadragon centres it, the target sits in the area that the
 * side panel (desktop) or bottom sheet (phone) leaves free. Handles width- and height-limited fits.
 */
export function withPanel(b: Box, dir: 'rtl' | 'ltr'): Box {
  const W = window.innerWidth;
  const H = window.innerHeight - TOP();
  if (W <= 760) {
    const sheet = 0.4 * H;
    const s1 = (sheet * b.w) / W;                 // width-limited fit
    const widthLimited = b.w / W >= (b.h + s1) / H;
    const s = widthLimited ? s1 : (sheet * b.h) / Math.max(1, H - sheet);
    return { x: b.x, y: b.y, w: b.w, h: b.h + s };
  }
  const P = 352;
  const e1 = (P * b.w) / Math.max(1, W - P);      // width-limited fit
  const widthLimited = (b.w + e1) / W >= b.h / H;
  const e = widthLimited ? e1 : (P * b.h) / H;
  return dir === 'rtl' ? { x: b.x, y: b.y, w: b.w + e, h: b.h } : { x: b.x - e, y: b.y, w: b.w + e, h: b.h };
}
