// build-images.mjs - turn the source renders into web-ready media.
//   shots     -> public/media/shots/<id>-{480,960,1600}.webp  + <id>-1600.jpg (fallback)
//   3D plans  -> public/media/plans/<code>.dzi (+ _files tiles) + <code>-thumb.webp
//   aerial    -> public/media/master/aerial.dzi + aerial-thumb.webp
// Also writes src/data/media.json with every image's pixel size and the 3D plans' trimmed
// building box (used to place the camera markers). Re-run after adding or replacing a render.
import sharp from 'sharp';
import fs from 'node:fs/promises';
import path from 'node:path';

const SITE = path.resolve(import.meta.dirname, '..');
const ROOT = path.resolve(SITE, '..');
const SHOTS_DIR = path.join(ROOT, 'rander shots', 'shots');
const PLANS_DIR = path.join(ROOT, 'rander shots', '3d-plans');
const AERIAL = path.join(ROOT, 'rander', 'WhatsApp Image 2026-04-23 at 11.04.05 PM.jpeg');
const OUT = path.join(SITE, 'public', 'media');

const exists = async (p) => !!(await fs.stat(p).catch(() => null));
const newer = async (src, dst) => {
  const d = await fs.stat(dst).catch(() => null);
  if (!d) return true;
  return (await fs.stat(src)).mtimeMs > d.mtimeMs;
};

async function shots(media) {
  const out = path.join(OUT, 'shots');
  await fs.mkdir(out, { recursive: true });
  for (const f of (await fs.readdir(SHOTS_DIR)).filter((n) => n.endsWith('.png'))) {
    const id = f.replace(/\.png$/, '');
    const src = path.join(SHOTS_DIR, f);
    const meta = await sharp(src).metadata();
    media.shots[id] = { w: meta.width, h: meta.height };
    if (!(await newer(src, path.join(out, `${id}-1600.jpg`)))) continue;
    for (const w of [480, 960, 1600]) {
      await sharp(src).resize({ width: w, withoutEnlargement: true }).webp({ quality: 80 }).toFile(path.join(out, `${id}-${w}.webp`));
    }
    await sharp(src).resize({ width: 1600, withoutEnlargement: true }).jpeg({ quality: 82, mozjpeg: true }).toFile(path.join(out, `${id}-1600.jpg`));
    console.log('shot', id);
  }
}

async function dzi(src, outBase) {
  await fs.rm(`${outBase}_files`, { recursive: true, force: true });
  await sharp(src).jpeg({ quality: 85 }).tile({ size: 512, overlap: 1, layout: 'dz' }).toFile(`${outBase}.dz`);
  // sharp writes <name>.dzi next to <name>_files
}

async function plans(media) {
  const out = path.join(OUT, 'plans');
  await fs.mkdir(out, { recursive: true });
  for (const f of (await fs.readdir(PLANS_DIR)).filter((n) => n.endsWith('_3dplan.png'))) {
    const code = f.replace(/_3dplan\.png$/, '');
    const src = path.join(PLANS_DIR, f);
    const meta = await sharp(src).metadata();
    // bounding box of the non-white building area
    const { info } = await sharp(src).flatten({ background: '#ffffff' }).trim({ background: '#ffffff', threshold: 30 }).toBuffer({ resolveWithObject: true });
    const box = { x: -(info.trimOffsetLeft ?? 0), y: -(info.trimOffsetTop ?? 0), w: info.width, h: info.height };
    media.plans[code] = { w: meta.width, h: meta.height, box };
    if (!(await newer(src, path.join(out, `${code}.dzi`)))) continue;
    await dzi(src, path.join(out, code));
    await sharp(src).resize({ width: 640 }).webp({ quality: 78 }).toFile(path.join(out, `${code}-thumb.webp`));
    console.log('plan', code, box);
  }
}

async function aerial(media) {
  const out = path.join(OUT, 'master');
  await fs.mkdir(out, { recursive: true });
  const meta = await sharp(AERIAL).metadata();
  media.master = { w: meta.width, h: meta.height };
  if (!(await newer(AERIAL, path.join(out, 'aerial.dzi')))) return;
  await dzi(AERIAL, path.join(out, 'aerial'));
  await sharp(AERIAL).resize({ width: 960 }).webp({ quality: 75 }).toFile(path.join(out, 'aerial-thumb.webp'));
  console.log('aerial', meta.width, meta.height);
}

// 2D plan crops (exact camera positions) and the marked camera plans (mini-map in the shot viewer)
async function plans2d(media) {
  const crops = path.join(ROOT, 'rander shots', 'plans', 'crops');
  const out = path.join(OUT, 'plans2d');
  await fs.mkdir(out, { recursive: true });
  for (const f of (await fs.readdir(crops)).filter((n) => /^B\d-[\w]+\.png$/.test(n))) {
    const code = f.replace(/\.png$/, '');
    const src = path.join(crops, f);
    const meta = await sharp(src).metadata();
    media.plans2d[code] = { w: meta.width, h: meta.height };
    if (!(await newer(src, path.join(out, `${code}.dzi`)))) continue;
    await dzi(src, path.join(out, code));
    console.log('plan2d', code);
  }
  const cams = path.join(ROOT, 'rander shots', 'camera-plans');
  const outc = path.join(OUT, 'camplans');
  await fs.mkdir(outc, { recursive: true });
  for (const f of (await fs.readdir(cams)).filter((n) => n.endsWith('.png'))) {
    const dst = path.join(outc, f.replace(/\.png$/, '.webp'));
    if (!(await newer(path.join(cams, f), dst))) continue;
    await sharp(path.join(cams, f)).resize({ width: 900 }).webp({ quality: 80 }).toFile(dst);
  }
}

// copy the shot index (camera positions on the plans) into the app
async function shotIndex() {
  const j = JSON.parse(await fs.readFile(path.join(ROOT, 'rander shots', 'shots.json'), 'utf8'));
  const shots = j.shots.map(({ id, plan, space, fx, fy, heading, fov }) => ({ id, plan, space, fx, fy, heading, fov }));
  await fs.writeFile(path.join(SITE, 'src', 'data', 'shots.json'), JSON.stringify(shots, null, 2));
}

const media = { shots: {}, plans: {}, plans2d: {}, master: null };
await shots(media);
await plans(media);
await plans2d(media);
await aerial(media);
await shotIndex();
await fs.writeFile(path.join(SITE, 'src', 'data', 'media.json'), JSON.stringify(media, null, 2));
console.log('media.json written:', Object.keys(media.shots).length, 'shots,', Object.keys(media.plans).length, 'plans');
