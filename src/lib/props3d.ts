import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import veg from '../data/vegetation.json';

// Max metres (x east, y north, z up) -> three.js (X = x, Y = z, Z = -y)
export const v3 = (x: number, y: number, z: number) => new THREE.Vector3(x, z, -y);

/** small deterministic random so every visit looks the same */
function rng(seed: number) {
  let s = seed >>> 0;
  return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296);
}

// ---------- geometry builders (unit sizes, scaled per instance) ----------

function palmTrunk() {
  const g = new THREE.CylinderGeometry(0.17, 0.27, 1, 8, 6, true);
  g.translate(0, 0.5, 0);
  const p = g.attributes.position;
  for (let i = 0; i < p.count; i++) {        // gentle curve and ring bumps
    const y = p.getY(i);
    p.setX(i, p.getX(i) + 0.18 * y * y);
    const ring = 1 + 0.06 * Math.sin(y * 60);
    p.setX(i, p.getX(i) * ring); p.setZ(i, p.getZ(i) * ring);
  }
  g.computeVertexNormals();
  return g;
}

function palmCrown() {
  const fronds: THREE.BufferGeometry[] = [];
  const r = rng(7);
  const n = 11;
  for (let k = 0; k < n; k++) {
    const len = 2.8 + r() * 0.8;
    const g = new THREE.PlaneGeometry(len, 0.7, 8, 2);
    g.translate(len / 2, 0, 0);
    const p = g.attributes.position;
    for (let i = 0; i < p.count; i++) {
      const x = p.getX(i), z = p.getY(i);
      const t = x / len;
      const width = Math.sin(Math.PI * Math.min(1, t * 1.15)) * (0.35 + 0.1 * (1 - t));
      p.setXYZ(i, x, -0.9 * t * t * len * 0.45 + Math.abs(z) * 0.35, Math.sign(z) * width);
    }
    g.computeVertexNormals();
    const tilt = -0.35 + r() * 0.5;
    g.rotateZ(tilt);
    g.rotateY((k / n) * Math.PI * 2 + r() * 0.3);
    fronds.push(g);
  }
  const crown = mergeGeometries(fronds)!;
  crown.translate(0.18, 0, 0); // follow the trunk curve
  return crown;
}

function blob(seed: number, detail = 1) {
  const g = new THREE.IcosahedronGeometry(1, detail);
  const p = g.attributes.position;
  const r = rng(seed);
  const jitter = new Map<string, number>();
  for (let i = 0; i < p.count; i++) {
    const key = `${p.getX(i).toFixed(3)},${p.getY(i).toFixed(3)},${p.getZ(i).toFixed(3)}`;
    if (!jitter.has(key)) jitter.set(key, 0.82 + r() * 0.3);
    const k = jitter.get(key)!;
    p.setXYZ(i, p.getX(i) * k, p.getY(i) * k, p.getZ(i) * k);
  }
  g.computeVertexNormals();
  return g;
}

function carBody() {
  const body = new THREE.BoxGeometry(4.5, 0.75, 1.8); body.translate(0, 0.55, 0);
  const cabin = new THREE.BoxGeometry(2.4, 0.6, 1.6); cabin.translate(-0.2, 1.2, 0);
  return mergeGeometries([body, cabin])!;
}

// ---------- instancing ----------

type Item = { pos: THREE.Vector3; rot: number; scale: THREE.Vector3; color?: THREE.Color };

function instanced(geo: THREE.BufferGeometry, mat: THREE.Material, items: Item[]) {
  const mesh = new THREE.InstancedMesh(geo, mat, items.length);
  const m = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  items.forEach((it, i) => {
    q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), it.rot);
    m.compose(it.pos, q, it.scale);
    mesh.setMatrixAt(i, m);
    if (it.color) mesh.setColorAt(i, it.color);
  });
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  return mesh;
}

/** Palms, trees, shrubs and cars at the positions of the V-Ray proxies in the Max scene. */
export function buildProps() {
  const group = new THREE.Group();
  const r = rng(42);
  const deg = THREE.MathUtils.degToRad;

  const trunkMat = new THREE.MeshStandardMaterial({ color: '#8a6a4a', roughness: 0.95 });
  const frondMat = new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 0.8, side: THREE.DoubleSide });
  const leafMat = new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 0.9, flatShading: true });
  const carMat = new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 0.35, metalness: 0.4 });

  // palms: trunk scaled to height, crown kept at real size on top
  const palms = veg.palm as number[][];
  group.add(instanced(palmTrunk(), trunkMat, palms.map(([x, y, z, rz, h]) => ({ pos: v3(x, y, z), rot: deg(rz), scale: new THREE.Vector3(1, h, 1) }))));
  group.add(instanced(palmCrown(), frondMat, palms.map(([x, y, z, rz, h]) => ({
    pos: v3(x, y, z + h),
    rot: deg(rz), scale: new THREE.Vector3(1, 1, 1).multiplyScalar(0.9 + h / 40),
    color: new THREE.Color().setHSL(0.27 + r() * 0.04, 0.45, 0.32 + r() * 0.06),
  }))));

  // trees: trunk + rounded crown
  const trees = veg.tree as number[][];
  group.add(instanced(new THREE.CylinderGeometry(0.12, 0.18, 1, 6).translate(0, 0.5, 0), trunkMat,
    trees.map(([x, y, z, , h]) => ({ pos: v3(x, y, z), rot: 0, scale: new THREE.Vector3(1, h * 0.45, 1) }))));
  group.add(instanced(blob(3), leafMat, trees.map(([x, y, z, rz, h]) => ({
    pos: v3(x, y, z + h * 0.62), rot: deg(rz) + r() * 3, scale: new THREE.Vector3(h * 0.38, h * 0.42, h * 0.38),
    color: new THREE.Color().setHSL(0.24 + r() * 0.06, 0.4, 0.28 + r() * 0.08),
  }))));

  // shrubs and planters
  const shrubs = veg.shrub as number[][];
  group.add(instanced(blob(9, 0), leafMat, shrubs.map(([x, y, z, , h]) => ({
    pos: v3(x, y, z + h * 0.4), rot: r() * 6, scale: new THREE.Vector3(h * 0.5, h * 0.45, h * 0.5),
    color: new THREE.Color().setHSL(0.26 + r() * 0.05, 0.45, 0.3 + r() * 0.08),
  }))));

  // cars on the roads
  const palette = ['#e9e9e6', '#1d1f22', '#8e959b', '#f3f1ea', '#5a6670', '#7c1f22'];
  const cars = veg.car as number[][];
  group.add(instanced(carBody(), carMat, cars.map(([x, y, z, rz]) => ({
    pos: v3(x, y, z), rot: deg(rz), scale: new THREE.Vector3(1, 1, 1), color: new THREE.Color(palette[Math.floor(r() * palette.length)]),
  }))));

  return group;
}

/** Procedural ripple normal map for the water surfaces. */
export function waterNormals(size = 256) {
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const ctx = c.getContext('2d')!;
  const img = ctx.createImageData(size, size);
  const h = (x: number, y: number) =>
    Math.sin((x / size) * Math.PI * 2 * 3 + Math.sin((y / size) * Math.PI * 2 * 2) * 1.5) * 0.5 +
    Math.sin((y / size) * Math.PI * 2 * 5 + (x / size) * Math.PI * 2 * 2) * 0.35 +
    Math.sin(((x + y) / size) * Math.PI * 2 * 7) * 0.15;
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const dx = h(x + 1, y) - h(x - 1, y);
    const dy = h(x, y + 1) - h(x, y - 1);
    const n = new THREE.Vector3(-dx * 2, -dy * 2, 1).normalize();
    const i = (y * size + x) * 4;
    img.data[i] = (n.x * 0.5 + 0.5) * 255;
    img.data[i + 1] = (n.y * 0.5 + 0.5) * 255;
    img.data[i + 2] = (n.z * 0.5 + 0.5) * 255;
    img.data[i + 3] = 255;
  }
  ctx.putImageData(img, 0, 0);
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  return t;
}

export const WATER_MATERIALS = new Set<string>(veg.water as string[]);
