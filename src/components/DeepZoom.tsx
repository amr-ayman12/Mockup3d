import { useEffect, useRef, type ReactNode } from 'react';
import OpenSeadragon from 'openseadragon';
import { useI18n } from '../lib/i18n';
import { SideControls } from './Chrome';

type Box = { x: number; y: number; w: number; h: number };
type Props = {
  dzi: string;
  width: number;   // image pixel size, so the SVG overlay can use image coordinates
  height: number;
  fit?: Box;       // view to show (image pixels); changing it animates there
  className?: string;
  children?: ReactNode; // SVG content drawn in image pixel coordinates
  corner?: ReactNode;   // extra buttons above the fullscreen button
};

/** Deep-zoom image (OpenSeadragon) with an SVG overlay locked to the image while panning/zooming. */
export default function DeepZoom({ dzi, width, height, fit, className, children, corner }: Props) {
  const host = useRef<HTMLDivElement>(null);
  const layer = useRef<HTMLDivElement>(null);
  const viewer = useRef<OpenSeadragon.Viewer | null>(null);
  const fitRef = useRef(fit);
  fitRef.current = fit;
  const { overlays } = useI18n();
  const fitKey = fit ? `${Math.round(fit.x)},${Math.round(fit.y)},${Math.round(fit.w)},${Math.round(fit.h)}` : '';

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
      animationTime: 1.0,
      springStiffness: 6.5,
      blendTime: 0.2,
      visibilityRatio: 0.5,
      minZoomImageRatio: 0.6,
      maxZoomPixelRatio: 2.4,
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
      // let overlay text keep a constant on-screen size
      el.style.setProperty('--k', String(width / Math.max(1, br.x - tl.x)));
    };
    v.addHandler('open', () => {
      const item = v.world.getItemAt(0);
      const f = fitRef.current;
      if (f && item) v.viewport.fitBounds(item.imageToViewportRectangle(f.x, f.y, f.w, f.h), true);
      sync();
    });
    v.addHandler('update-viewport', sync);
    v.addHandler('resize', sync);
    return v;
  }

  // animate when the requested box changes (e.g. a unit was chosen)
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
    <div className={`dz ${className ?? ''}`}>
      <div className="dz-osd" ref={host} />
      <div className="dz-layer" ref={layer} style={{ opacity: overlays ? 1 : 0, pointerEvents: overlays ? undefined : 'none' }}>
        <svg viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none">{children}</svg>
      </div>
      <SideControls onZoom={zoom} onReset={home}>{corner}</SideControls>
    </div>
  );
}
