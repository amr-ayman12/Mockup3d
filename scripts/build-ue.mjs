// build-ue.mjs - web media + overlay data from the Unreal renders (C:\UE\ResortViz pipeline).
//   aerial   web_renders/ue_full/LS_WEB_A1_aerial.FinalImage.png      -> public/media/ue/master/aerial.dzi
//   facades  web_renders/ue_full/LS_WEB_A3_<B>_facade-<n>.FinalImage.png -> public/media/ue/facades/<B>-<n>.dzi (+ -thumb.webp)
//   floors   web_renders/ue_floors/<B>-<f>.plan.jpg (plan composited on the site) -> public/media/ue/floors/<B>-<f>.dzi
// and src/data/ue.json with the overlay polygons (image pixels) and each floor's plan->image affine.
// Re-run after re-rendering:  node scripts/build-ue.mjs
import sharp from 'sharp';
import fs from 'node:fs/promises';
import path from 'node:path';

const SITE = path.resolve(import.meta.dirname, '..');
const ROOT = path.resolve(SITE, '..');
const FULL = path.join(ROOT, 'web_renders', 'ue_full');
const FLOORS = path.join(ROOT, 'web_renders', 'ue_floors');
const OUT = path.join(SITE, 'public', 'media', 'ue');
const BUILDINGS = ['B1', 'B2', 'B3', 'B4', 'B5'];
// floors whose composite uses the right plan (B2's second floor has no plan of its own yet)
const FLOOR_PLANS = {
  'B1-0': 'B1-G', 'B1-1': 'B1-1', 'B2-0': 'B2-G', 'B2-1': 'B2-1', 'B3-0': 'B3-G', 'B3-1': 'B3-1', 'B3-2': 'B3-2',
  'B4-0': 'B4-Gw', 'B4-1': 'B4-1', 'B4-2': 'B4-2', 'B5-0': 'B5-G', 'B5-1': 'B5-1',
};

const exists = async (p) => !!(await fs.stat(p).catch(() => null));
const readJson = async (p) => JSON.parse(await fs.readFile(p, 'utf8'));

async function dzi(src, outBase, thumbW) {
  await fs.mkdir(path.dirname(outBase), { recursive: true });
  await fs.rm(`${outBase}_files`, { recursive: true, force: true });
  await sharp(src).jpeg({ quality: 86, mozjpeg: true }).tile({ size: 512, overlap: 1, layout: 'dz' }).toFile(`${outBase}.dz`);
  if (thumbW) await sharp(src).resize({ width: thumbW }).webp({ quality: 74 }).toFile(`${outBase}-thumb.webp`);
  const m = await sharp(src).metadata();
  return { w: m.width, h: m.height };
}

const round = (pts) => pts.map(([x, y]) => [Math.round(x), Math.round(y)]);
const area = (p) => Math.abs(p.reduce((s, [x, y], i) => { const [x2, y2] = p[(i + 1) % p.length]; return s + x * y2 - x2 * y; }, 0)) / 2;

const ue = { master: null, facades: {}, floors: {} };

// ---- aerial: one entry per building, all its parts ----
{
  const src = path.join(FULL, 'LS_WEB_A1_aerial.FinalImage.png');
  const size = await dzi(src, path.join(OUT, 'master', 'aerial'), 960);
  const ov = await readJson(path.join(FULL, 'A1_aerial.overlay.json'));
  const polys = {};
  for (const it of ov.items) (polys[it.building] ??= []).push(round(it.points));
  for (const b of Object.keys(polys)) polys[b].sort((a, c) => area(c) - area(a));
  ue.master = { ...size, polys };
  console.log('aerial', size);
}

// ---- facades: this building's floors only ----
for (const b of BUILDINGS) {
  ue.facades[b] = [];
  for (let n = 1; n <= 3; n++) {
    const src = path.join(FULL, `LS_WEB_A3_${b}_facade-${n}.FinalImage.png`);
    if (!(await exists(src))) continue;
    const size = await dzi(src, path.join(OUT, 'facades', `${b}-${n}`), 240);
    const ov = await readJson(path.join(FULL, `${b}_facade-${n}.overlay.json`));
    const floors = {};
    for (const it of ov.items) if (it.building === b) (floors[it.floor] ??= []).push(round(it.points));
    ue.facades[b].push({ id: `${b}-${n}`, ...size, floors });
    console.log('facade', b, n);
  }
}

// ---- floor plans composited on the site ----
for (const [key, plan] of Object.entries(FLOOR_PLANS)) {
  const src = path.join(FLOORS, `${key}.plan.jpg`);
  if (!(await exists(src))) continue;
  const size = await dzi(src, path.join(OUT, 'floors', key), 480);
  const u = await readJson(path.join(FLOORS, `${key}.units.json`));
  ue.floors[key] = { ...size, plan, affine: u.affine.map((r) => r.map((v) => +v.toFixed(5))) };
  console.log('floor', key);
}

await fs.writeFile(path.join(SITE, 'src', 'data', 'ue.json'), JSON.stringify(ue));
console.log('ue.json written');
