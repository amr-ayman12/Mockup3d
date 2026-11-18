// optimize-model.mjs - turn the raw 3ds Max glTF export (../web_export/resort.glb) into a web model:
// public/media/model/resort.glb. Steps: dedupe, merge by material, simplify (meshoptimizer),
// textures to WebP (max 1024 px), meshopt compression. Re-run after a new export from Max.
//   node scripts/optimize-model.mjs [ratio=0.12] [error=0.0015]
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import {
  dedup, flatten, join, weld, simplify, prune, resample, textureCompress, draco, instance, palette, normals,
} from '@gltf-transform/functions';
import { MeshoptEncoder, MeshoptSimplifier } from 'meshoptimizer';
import draco3d from 'draco3dgltf';
import sharp from 'sharp';
import fs from 'node:fs/promises';
import path from 'node:path';

const SITE = path.resolve(import.meta.dirname, '..');
const SRC = path.resolve(SITE, '..', 'web_export', 'resort.glb');
const OUT = path.join(SITE, 'public', 'media', 'model', 'resort.glb');
const ratio = Number(process.argv[2] ?? 0.12);
const error = Number(process.argv[3] ?? 0.0015);

const tris = (doc) => {
  let n = 0;
  for (const m of doc.getRoot().listMeshes()) for (const p of m.listPrimitives()) {
    const i = p.getIndices();
    n += i ? i.getCount() / 3 : p.getAttribute('POSITION').getCount() / 3;
  }
  return Math.round(n);
};

await MeshoptEncoder.ready;
await MeshoptSimplifier.ready;
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({
  'meshopt.encoder': MeshoptEncoder,
  'draco3d.encoder': await draco3d.createEncoderModule(),
  'draco3d.decoder': await draco3d.createDecoderModule(),
});
const doc = await io.read(SRC);
console.log('in :', tris(doc), 'tris,', doc.getRoot().listNodes().length, 'nodes');

// simplify each mesh on its own first (meshopt's error is relative to the mesh's size, so small
// props lose detail in proportion), then merge by material to cut draw calls
// The Max exporter writes a separate normal per face corner (and extra UV sets), so no two
// triangles share a vertex and the simplifier cannot collapse anything. Drop those attributes,
// weld, simplify, then rebuild normals.
const stripForWeld = () => (d) => {
  for (const mesh of d.getRoot().listMeshes()) for (const p of mesh.listPrimitives()) {
    for (const sem of p.listSemantics()) {
      if (sem === 'NORMAL' || /^TEXCOORD_[1-9]$/.test(sem) || sem.startsWith('COLOR_')) {
        const a = p.getAttribute(sem); p.setAttribute(sem, null); if (a && !a.listParents().some((x) => x !== d.getRoot())) a.dispose();
      }
    }
  }
};

await doc.transform(
  dedup(),
  stripForWeld(),
  weld(),
  simplify({ simplifier: MeshoptSimplifier, ratio, error, lockBorder: false }),
  normals({ overwrite: true }),
  instance({ min: 5 }),
  palette({ min: 5 }),
  flatten(),
  join({ keepNamed: false }),
  resample(),
  prune(),
  textureCompress({ encoder: sharp, targetFormat: 'webp', resize: [1024, 1024], quality: 78 }),
  // Draco packs this kind of geometry much tighter than meshopt (UVs here are outside 0..1)
  draco({ method: 'edgebreaker', encodeSpeed: 3, decodeSpeed: 6, quantizePosition: 14, quantizeTexcoord: 12, quantizeNormal: 10 }),
);
console.log('out:', tris(doc), 'tris,', doc.getRoot().listNodes().length, 'nodes,', doc.getRoot().listMaterials().length, 'materials');

await fs.mkdir(path.dirname(OUT), { recursive: true });
await io.write(OUT, doc);
const { size } = await fs.stat(OUT);
console.log('written', OUT, (size / 1e6).toFixed(1), 'MB');
