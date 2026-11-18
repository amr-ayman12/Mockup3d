import { useEffect, useRef, type ReactNode } from 'react';
import OpenSeadragon from 'openseadragon';
import { useI18n } from '../lib/i18n';

type Box = { x: number; y: number; w: number; h: number };
type Props = {
  dzi: string;
  width: number;   // image pixel size, so the SVG overlay can use image coordinates
  height: number;
  fit?: Box;       // initial view (image pixels); defaults to the whole image
  children?: ReactNode; // SVG content drawn in image pixel coordinates
};

/** Deep-zoom image (OpenSeadragon) with an SVG overlay locked to the image while panning/zooming. */
export default function DeepZoom({ dzi, width, height, fit, children }: Props) {
  const host = useRef<HTMLDivElement>(null);
  const layer = useRef<HTMLDivElement>(null);
  const viewer = useRef<OpenSeadragon.Viewer | null>(null);
  const { t, overlays } = useI18n();
  const fitKey = fit ? `${fit.x},${fit.y},${fit.w},${fit.h}` : '';

  useEffect(() => {
    if (!host.current) return;
    let v: OpenSeadragon.Viewer | null = null;
    // create on the next tick so a mount/unmount pair (React StrictMode, fast route changes)
    // never leaves a half-opened viewer behind
    const timer = window.setTimeout(() => { v = create(); }, 0);
    return () => { window.clearTimeout(timer); v?.destroy(); viewer.current = null; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dzi, width, height]);

  function create() {
    const v = OpenSeadragon({
      element: host.current!,
      tileSources: dzi,
      showNavigationControl: false,
      animationTime: 0.7,
      springStiffness: 8,
      blendTime: 0.2,
      visibilityRatio: 0.5,
      minZoomImageRatio: 0.7,
      maxZoomPixelRatio: 2.2,
      imageLoaderLimit: 6,
      gestureSettingsMouse: { clickToZoom: false, dblClickToZoom: true, scrollToZoom: true },
      gestureSettingsTouch: { pinchRotate: false, flickEnabled: true },
    });
    viewer.current = v;

    const sync = () => {
      const item = v.world.getItemAt(0);
      const el = layer.current;
      if (!item || !el) return;
      const tl = item.imageToViewerElementCoordinates(new OpenSeadragon.Point(0, 0));
      const br = item.imageToViewerElementCoordinates(new OpenSeadragon.Point(width, height));
      el.style.transform = `translate3d(${tl.x}px, ${tl.y}px, 0)`;
      el.style.width = `${br.x - tl.x}px`;
      el.style.height = `${br.y - tl.y}px`;
    };
    v.addHandler('open', () => {
      const item = v.world.getItemAt(0);
      if (fit && item) v.viewport.fitBounds(item.imageToViewportRectangle(fit.x, fit.y, fit.w, fit.h), true);
      sync();
    });
    v.addHandler('update-viewport', sync);
    v.addHandler('resize', sync);
    return v;
  }

  // smooth re-fit when the requested box changes (e.g. switching building)
  useEffect(() => {
    const v = viewer.current;
    const item = v?.world.getItemAt(0);
    if (v && item && fit) v.viewport.fitBounds(item.imageToViewportRectangle(fit.x, fit.y, fit.w, fit.h));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fitKey]);

  const zoom = (f: number) => viewer.current?.viewport.zoomBy(f).applyConstraints();
  const home = () => {
    const v = viewer.current;
    const item = v?.world.getItemAt(0);
    if (v && item && fit) v.viewport.fitBounds(item.imageToViewportRectangle(fit.x, fit.y, fit.w, fit.h));
    else v?.viewport.goHome();
  };

  return (
    <div className="dz">
      <div className="dz-osd" ref={host} />
      <div className="dz-layer" ref={layer} style={{ opacity: overlays ? 1 : 0 }}>
        <svg viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none">{children}</svg>
      </div>
      <div className="dz-ctrl">
        <button aria-label={t('zoomIn')} title={t('zoomIn')} onClick={() => zoom(1.5)}>+</button>
        <button aria-label={t('zoomOut')} title={t('zoomOut')} onClick={() => zoom(1 / 1.5)}>−</button>
        <button aria-label={t('reset')} title={t('reset')} onClick={home}>⤢</button>
      </div>
    </div>
  );
}
