// check-markers.mjs - draw every camera marker onto its 3D plan (same maths as the app) and
// tile the results into one sheet, so marker placement can be checked at a glance.
// Output: ../rander shots/_checks/markers-on-3d.jpg
import sharp from 'sharp';
import fs from 'node:fs/promises';
import path from 'node:path';

const SITE = path.resolve(import.meta.dirname, '..');
const ROOT = path.resolve(SITE, '..');
const read = async (p) => JSON.parse(await fs.readFile(path.join(SITE, 'src', 'data', p), 'utf8'));
const { buildings } = await read('buildings.json');
const shots = await read('shots.json');
const media = await read('media.json');

const tiles = [];
for (const b of buildings) for (const f of b.floors) {
  if (!f.plan) continue;
  const m = media.plans[f.plan];
  const [x0, y0, x1, y1] = f.cropBox;
  const s = m.w / 1600;
  const marks = shots.filter((x) => x.plan === f.plan).map((x, i) => {
    const X = m.box.x + ((x.fx - x0) / (x1 - x0)) * m.box.w;
    const Y = m.box.y + ((x.fy - y0) / (y1 - y0)) * m.box.h;
    const L = 120 * s, a0 = ((x.heading - x.fov / 2) * Math.PI) / 180, a1 = ((x.heading + x.fov / 2) * Math.PI) / 180;
    const p = (a) => `${X + Math.sin(a) * L},${Y - Math.cos(a) * L}`;
    return `<path d="M${X},${Y} L${p(a0)} A${L},${L} 0 0 1 ${p(a1)} Z" fill="rgba(220,30,30,.35)" stroke="#d00" stroke-width="${3 * s}"/>
            <circle cx="${X}" cy="${Y}" r="${22 * s}" fill="#d00" stroke="#fff" stroke-width="${3 * s}"/>
            <text x="${X}" y="${Y + 8 * s}" font-size="${24 * s}" text-anchor="middle" fill="#fff" font-family="Arial" font-weight="700">${i + 1}</text>`;
  }).join('');
  const box = `<rect x="${m.box.x}" y="${m.box.y}" width="${m.box.w}" height="${m.box.h}" fill="none" stroke="#06c" stroke-width="${4 * s}" stroke-dasharray="${20 * s}"/>`;
  const svg = Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${m.w}" height="${m.h}">${box}${marks}
    <text x="${20 * s}" y="${60 * s}" font-size="${50 * s}" font-family="Arial" font-weight="700" fill="#06c">${f.plan}</text></svg>`);
  const src = path.join(ROOT, 'rander shots', '3d-plans', `${f.plan}_3dplan.png`);
  const full = await sharp(src).composite([{ input: svg }]).png().toBuffer(); // sharp resizes before compositing, so two steps
  tiles.push(await sharp(full).resize({ width: 640, height: 420, fit: 'contain', background: '#fff' }).png().toBuffer());
}
const cols = 4, rows = Math.ceil(tiles.length / cols);
await sharp({ create: { width: 640 * cols, height: 420 * rows, channels: 3, background: '#ffffff' } })
  .composite(tiles.map((t, i) => ({ input: t, left: (i % cols) * 640, top: Math.floor(i / cols) * 420 })))
  .jpeg({ quality: 82 })
  .toFile(path.join(ROOT, 'rander shots', '_checks', 'markers-on-3d.jpg'));
console.log('written', tiles.length, 'plans');
