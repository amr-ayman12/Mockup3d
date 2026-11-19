// plan-grid.mjs - dev helper: draws a labelled pixel grid (and any unit outlines from
// src/data/unit-shapes.json) over a 3D plan, to place or check unit outlines by eye.
//   node scripts/plan-grid.mjs <plan> <out.png> [step]
import sharp from 'sharp';
import fs from 'node:fs/promises';
import path from 'node:path';

const SITE = path.resolve(import.meta.dirname, '..');
const [plan, out, stepArg] = process.argv.slice(2);
const step = +(stepArg || 100);
const src = path.join(SITE, '..', 'rander shots', '3d-plans', `${plan}_3dplan.png`);
const { width: w, height: h } = await sharp(src).metadata();
const shapes = JSON.parse(await fs.readFile(path.join(SITE, 'src', 'data', 'unit-shapes.json'), 'utf8').catch(() => '{}'));

let svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}">`;
for (let x = 0; x <= w; x += step) svg += `<line x1="${x}" y1="0" x2="${x}" y2="${h}" stroke="red" stroke-width="${x % (step * 5) ? 1 : 3}" opacity=".6"/><text x="${x + 3}" y="22" font-size="22" fill="red" font-family="Arial">${x}</text>`;
for (let y = 0; y <= h; y += step) svg += `<line x1="0" y1="${y}" x2="${w}" y2="${y}" stroke="blue" stroke-width="${y % (step * 5) ? 1 : 3}" opacity=".6"/><text x="3" y="${y - 4}" font-size="22" fill="blue" font-family="Arial">${y}</text>`;
for (const [id, s] of Object.entries(shapes[plan] ?? {})) {
  const pts = s.map((p) => p.join(',')).join(' ');
  const cx = s.reduce((a, p) => a + p[0], 0) / s.length, cy = s.reduce((a, p) => a + p[1], 0) / s.length;
  svg += `<polygon points="${pts}" fill="lime" fill-opacity=".25" stroke="lime" stroke-width="4"/><text x="${cx}" y="${cy}" font-size="30" fill="black" font-weight="bold" text-anchor="middle" font-family="Arial">${id}</text>`;
}
svg += '</svg>';
await sharp(src).flatten({ background: '#fff' }).composite([{ input: Buffer.from(svg) }]).png().toFile(out);
console.log(plan, w, h);
