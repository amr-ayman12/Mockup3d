type Props = {
  x: number; y: number; heading: number; fov: number; scale: number;
  num: number; label: string; active?: boolean; onClick: () => void;
};

/** Numbered camera marker with its view cone, drawn in image pixel coordinates. */
export default function CameraMarker({ x, y, heading, fov, scale, num, label, active, onClick }: Props) {
  const r = 22 * scale;
  const len = 120 * scale;
  const a0 = ((heading - fov / 2) * Math.PI) / 180;
  const a1 = ((heading + fov / 2) * Math.PI) / 180;
  const p = (a: number) => `${x + Math.sin(a) * len},${y - Math.cos(a) * len}`;
  return (
    <g className={`cam ${active ? 'active' : ''}`} onClick={onClick} role="button" tabIndex={0} aria-label={label}
       onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && onClick()}>
      <path className="cam-cone" d={`M${x},${y} L${p(a0)} A${len},${len} 0 0 1 ${p(a1)} Z`} />
      <circle className="cam-dot" cx={x} cy={y} r={r} />
      <text className="cam-num" x={x} y={y} fontSize={r * 1.1} dominantBaseline="central" textAnchor="middle">{num}</text>
      <title>{label}</title>
    </g>
  );
}
