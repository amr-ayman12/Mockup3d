import { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { GLTFLoader, type GLTF } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/examples/jsm/libs/meshopt_decoder.module.js';
import { DRACOLoader } from 'three/examples/jsm/loaders/DRACOLoader.js';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { Sky } from 'three/examples/jsm/objects/Sky.js';
import model from '../data/model.json';
import { useI18n } from '../lib/i18n';
import { buildProps, v3, WATER_MATERIALS, waterNormals } from '../lib/props3d';
import { SideControls } from './Chrome';

type Poly = number[][];
// building id -> floor id -> outline (Max metres, x/y)
const FOOTPRINTS = model.footprints as Record<string, Record<string, Poly>>;
// building id -> eye-level viewpoints [azimuth deg (0 = east, 90 = north), distance factor]
const VIEWS = (model as unknown as { views: Record<string, number[][]> }).views ?? {};

// prism from a Max outline between two heights; `grow` pushes the walls out a little so the
// volume wraps the real building instead of z-fighting with it
function extrude(poly: Poly, y0: number, y1: number, grow: number) {
  const cx = poly.reduce((s, p) => s + p[0], 0) / poly.length, cy = poly.reduce((s, p) => s + p[1], 0) / poly.length;
  const pts = poly.map(([x, y]) => {
    const dx = x - cx, dy = y - cy, l = Math.hypot(dx, dy) || 1;
    return new THREE.Vector2(x + (dx / l) * grow, y + (dy / l) * grow);
  });
  const geo = new THREE.ExtrudeGeometry(new THREE.Shape(pts), { depth: y1 - y0, bevelEnabled: false });
  geo.rotateX(-Math.PI / 2); // shape (x, y) + depth z  ->  three (x, z, -y)
  geo.translate(0, y0, 0);
  return geo;
}

export type FloorBand = { id: string; label: string; color: string; enabled: boolean };
type Props = {
  colors: Record<string, string>;   // building id -> tint
  labels: Record<string, string>;   // building id -> tag text ("title\nsub")
  focus?: string;                   // building page: the building shown
  floors?: FloorBand[];             // building page: one band per storey (eye-level view)
  view?: number;                    // building page: which eye-level viewpoint
  onPick?: (id: string) => void;
  onFloor?: (id: string) => void;
  onThumbs?: (urls: string[]) => void; // building page: small pictures of each viewpoint
};

// finished floor levels from the scene (metres): ground, first, second, roof
const LEVELS = [0.55, 3.85, 7.3, 10.45];

// one shared download/parse for every page that shows the model
let gltfPromise: Promise<GLTF> | null = null;
let progressCb: ((p: number) => void) | null = null;
function loadModel(onProgress: (p: number) => void) {
  progressCb = onProgress;
  if (!gltfPromise) {
    const loader = new GLTFLoader();
    loader.setMeshoptDecoder(MeshoptDecoder);
    const draco = new DRACOLoader();
    draco.setDecoderPath('/draco/');
    loader.setDRACOLoader(draco);
    gltfPromise = new Promise((resolve, reject) => loader.load(model.url, resolve,
      (e) => progressCb?.(e.total ? e.loaded / e.total : 0), reject));
  }
  return gltfPromise;
}
const thumbCache = new Map<string, string[]>();

type Api = {
  setColors: (c: Record<string, string>, f?: string) => void; home: () => void; reset: () => void;
  zoom: (k: number) => void; resize: () => void; setFloors: (b?: string, f?: FloorBand[]) => void;
  view: (i: number) => void; thumbs: () => string[]; overlay: (on: boolean) => void;
};

export default function ModelView({ colors, labels, focus, floors, view = 0, onPick, onFloor, onThumbs }: Props) {
  const host = useRef<HTMLDivElement>(null);
  const labelHost = useRef<HTMLDivElement>(null);
  const tagRef = useRef<HTMLButtonElement>(null);
  const api = useRef<Api | null>(null);
  const pickRef = useRef(onPick);
  pickRef.current = onPick;
  const floorRef = useRef(onFloor);
  floorRef.current = onFloor;
  const [progress, setProgress] = useState(0);
  const [ready, setReady] = useState(false);
  const [failed, setFailed] = useState(false);
  const { t, overlays } = useI18n();

  useEffect(() => {
    const el = host.current!;
    const mobile = window.matchMedia('(max-width: 760px)').matches;
    const renderer = new THREE.WebGLRenderer({ antialias: !mobile, powerPreference: 'high-performance' });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, mobile ? 1.5 : 2));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 0.9;
    renderer.shadowMap.enabled = !mobile;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    el.appendChild(renderer.domElement);

    let dirty = true; // set whenever the frame must be redrawn
    const scene = new THREE.Scene();
    scene.fog = new THREE.Fog('#e9dcc8', 320, 1400);
    const pmrem = new THREE.PMREMGenerator(renderer);
    scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    scene.environmentIntensity = 0.55;

    // physical sky with a low late-afternoon sun in the west-south-west (the V-Ray sunset rig)
    const sunDir = v3(-140, -50, 70).normalize();
    const sky = new Sky();
    sky.scale.setScalar(4000);
    sky.material.uniforms.turbidity.value = 5;
    sky.material.uniforms.rayleigh.value = 1.4;
    sky.material.uniforms.mieCoefficient.value = 0.004;
    sky.material.uniforms.mieDirectionalG.value = 0.82;
    sky.material.uniforms.sunPosition.value.copy(sunDir);
    scene.add(sky);

    const sun = new THREE.DirectionalLight('#ffe2bd', 2.6);
    sun.position.copy(v3(78, 48, 0).add(sunDir.clone().multiplyScalar(160)));
    sun.target.position.copy(v3(78, 48, 0));
    sun.castShadow = !mobile;
    sun.shadow.mapSize.set(2048, 2048);
    Object.assign(sun.shadow.camera, { left: -110, right: 110, top: 110, bottom: -110, near: 10, far: 400 });
    sun.shadow.bias = -0.0004;
    sun.shadow.normalBias = 0.04;
    scene.add(sun, sun.target, new THREE.HemisphereLight('#dfeefa', '#b9a27f', 0.9));

    const camera = new THREE.PerspectiveCamera(42, 1, 0.5, 6000);
    const home = { pos: v3(...(model.camera.position as [number, number, number])), target: v3(...(model.camera.target as [number, number, number])) };
    camera.position.copy(home.pos);
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.target.copy(home.target);
    controls.enableDamping = true;
    controls.dampingFactor = 0.08;
    controls.minDistance = 14;
    controls.maxDistance = 320;
    controls.maxPolarAngle = Math.PI * 0.44;
    controls.screenSpacePanning = false;
    controls.update();

    // building volumes: tinted glass over the model (the reference's coloured overlays), clickable
    type Vol = { meshes: THREE.Mesh[]; mat: THREE.MeshBasicMaterial; edgeMat: THREE.LineBasicMaterial; center: THREE.Vector3; c: number[]; size: number; top: number };
    const boxes = new Map<string, Vol>();
    const boxGroup = new THREE.Group();
    scene.add(boxGroup);
    for (const [id, fp] of Object.entries(FOOTPRINTS)) {
      const mat = new THREE.MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0, depthWrite: false });
      const edgeMat = new THREE.LineBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0 });
      const meshes: THREE.Mesh[] = [];
      const keys = Object.keys(fp);
      keys.forEach((k, i) => {
        const geo = extrude(fp[k], LEVELS[i], LEVELS[i + 1] ?? LEVELS[i] + 3.2, 0.25);
        const mesh = new THREE.Mesh(geo, mat);
        mesh.userData.id = id;
        mesh.renderOrder = 1;
        meshes.push(mesh);
        boxGroup.add(mesh, new THREE.LineSegments(new THREE.EdgesGeometry(geo, 30), edgeMat));
      });
      const all = keys.flatMap((k) => fp[k]);
      const xs = all.map((p) => p[0]), ys = all.map((p) => p[1]);
      const cx = (Math.min(...xs) + Math.max(...xs)) / 2, cy = (Math.min(...ys) + Math.max(...ys)) / 2;
      const top = LEVELS[keys.length] ?? LEVELS[LEVELS.length - 1];
      boxes.set(id, { meshes, mat, edgeMat, center: v3(cx, cy, top + 1.5), c: [cx, cy], top,
        size: Math.max(Math.max(...xs) - Math.min(...xs), Math.max(...ys) - Math.min(...ys)) });
    }

    // floor bands of the building page (one per storey)
    const floorGroup = new THREE.Group();
    scene.add(floorGroup);
    type Slab = { mesh: THREE.Mesh; band: FloorBand; anchor: THREE.Vector3 };
    let slabs: Slab[] = [];
    let slabBuilding: string | undefined;
    const clearFloors = () => {
      floorGroup.traverse((o) => {
        const m = o as THREE.Mesh;
        if (m.geometry) m.geometry.dispose();
        if (m.material) (m.material as THREE.Material).dispose();
      });
      floorGroup.clear();
      slabs = [];
    };
    const setFloors = (bid?: string, bands?: FloorBand[]) => {
      clearFloors();
      slabBuilding = bid;
      const fp = bid ? FOOTPRINTS[bid] : undefined;
      if (!fp || !bands?.length) { slabBuilding = undefined; paint(); return; }
      const keys = Object.keys(fp);
      bands.forEach((band, i) => {
        const poly = fp[band.id] ?? fp[keys[Math.min(i, keys.length - 1)]];
        const y0 = LEVELS[i] + 0.05, y1 = (LEVELS[i + 1] ?? LEVELS[i] + 3.2) - 0.05;
        const geo = extrude(poly, y0, y1, 0.45);
        const mesh = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ color: band.color, transparent: true, opacity: 0.46, depthWrite: false, toneMapped: false }));
        mesh.userData.floor = band.id;
        mesh.renderOrder = 2;
        // thin light line at each slab edge, like the reference's floor separations
        const edges = new THREE.LineSegments(new THREE.EdgesGeometry(geo, 30), new THREE.LineBasicMaterial({ color: '#e8f6ff', transparent: true, opacity: 0.55 }));
        floorGroup.add(mesh, edges);
        const c = poly.reduce((a, p) => [a[0] + p[0] / poly.length, a[1] + p[1] / poly.length], [0, 0]);
        slabs.push({ mesh, band, anchor: v3(c[0], c[1], (y0 + y1) / 2) });
      });
      paint();
    };

    let hovered: string | null = null;
    let hoveredFloor: string | null = null;
    let current = { colors: {} as Record<string, string>, focus: undefined as string | undefined };
    const paint = () => {
      const building = !!slabBuilding;
      for (const [id, b] of boxes) {
        const c = new THREE.Color(current.colors[id] ?? '#ffffff');
        const on = hovered === id;
        b.mat.color = c;
        b.mat.opacity = building ? 0 : on ? 0.7 : 0.52;
        b.edgeMat.color = new THREE.Color('#ffffff');
        b.edgeMat.opacity = building ? 0 : on ? 0.9 : 0.35;
      }
      for (const s of slabs) {
        const on = hoveredFloor === s.band.id;
        (s.mesh.material as THREE.MeshBasicMaterial).opacity = !s.band.enabled ? 0.18 : on ? 0.72 : 0.46;
      }
      const tag = tagRef.current;
      const hs = slabs.find((s) => s.band.id === hoveredFloor);
      if (tag) {
        tag.textContent = hs?.band.label ?? '';
        tag.classList.toggle('show', !!hs);
        tag.classList.toggle('off', !!hs && !hs.band.enabled);
      }
      dirty = true;
    };

    // camera flights
    let flight: { from: THREE.Vector3; to: THREE.Vector3; tFrom: THREE.Vector3; tTo: THREE.Vector3; t0: number; dur: number } | null = null;
    const flyTo = (pos: THREE.Vector3, target: THREE.Vector3, dur = 1400) => {
      flight = { from: camera.position.clone(), to: pos, tFrom: controls.target.clone(), tTo: target, t0: performance.now(), dur };
      dirty = true;
    };
    // portrait screens see less of the site sideways: step the camera back
    // portrait screens: step back a little; the visitor drags to see the sides (as on the reference)
    const reach = () => (camera.aspect < 1 ? Math.min(1.45, 0.75 / camera.aspect) : 1);
    const homePos = () => home.target.clone().add(home.pos.clone().sub(home.target).multiplyScalar(reach()));
    let touched = false;
    // eye-level viewpoint i of a building: on the ground, far enough for the whole facade to fit
    const viewPose = (id: string, i: number) => {
      const b = boxes.get(id)!;
      const vs = VIEWS[id] ?? [[270, 1], [300, 1]];
      const [az, k] = vs[((i % vs.length) + vs.length) % vs.length];
      const tanV = Math.tan(THREE.MathUtils.degToRad(camera.fov / 2));
      const fitH = (b.top + 3) / (2 * tanV);
      // on phones the facade may be cropped at the sides rather than shrunk to a sliver
      const fitW = (b.size * 0.62) / (tanV * Math.max(0.8, camera.aspect));
      const d = Math.min(150, Math.max(fitH, fitW) * 1.12 * (k || 1));
      const a = THREE.MathUtils.degToRad(az);
      const target = v3(b.c[0], b.c[1], b.top * 0.48);
      // eye level when close; a little higher when far, so trees in front do not hide the building
      const pos = v3(b.c[0] + Math.cos(a) * d, b.c[1] + Math.sin(a) * d, 2.2 + Math.max(0, d - 40) * 0.06);
      return { pos, target };
    };
    let viewIndex = 0;
    const goView = (i: number) => {
      viewIndex = i;
      if (!current.focus || !slabBuilding) return;
      controls.maxPolarAngle = Math.PI * 0.54;
      const p = viewPose(current.focus, i);
      clearLine(p.pos, p.target);
      flyTo(p.pos, p.target);
    };
    const goHome = () => {
      clearLine();
      controls.maxPolarAngle = Math.PI * 0.44;
      flyTo(homePos(), home.target.clone());
    };

    const resize = () => {
      const w = el.clientWidth, h = el.clientHeight;
      renderer.setSize(w, h, false);
      camera.aspect = w / Math.max(1, h);
      camera.updateProjectionMatrix();
      if (!touched && !flight && !current.focus) { camera.position.copy(homePos()); controls.update(); }
      dirty = true;
    };
    const ro = new ResizeObserver(resize);
    ro.observe(el);
    resize();

    // picking (click vs drag); on touch screens the first tap on a floor only highlights it
    const ray = new THREE.Raycaster();
    const ndc = new THREE.Vector2();
    const pickAt = (cx: number, cy: number) => {
      const r = renderer.domElement.getBoundingClientRect();
      ndc.set(((cx - r.left) / r.width) * 2 - 1, -((cy - r.top) / r.height) * 2 + 1);
      ray.setFromCamera(ndc, camera);
      if (slabs.length) {
        const fh = ray.intersectObjects(slabs.map((s) => s.mesh), false)[0];
        return { floor: (fh?.object.userData.floor as string | undefined) ?? null, id: null };
      }
      const hit = ray.intersectObjects([...boxes.values()].flatMap((b) => b.meshes), false)[0];
      return { floor: null, id: (hit?.object.userData.id as string | undefined) ?? null };
    };
    let down: { x: number; y: number } | null = null;
    const onDown = (e: PointerEvent) => { down = { x: e.clientX, y: e.clientY }; touched = true; };
    const onUp = (e: PointerEvent) => {
      if (down && Math.hypot(e.clientX - down.x, e.clientY - down.y) < 6) {
        const p = pickAt(e.clientX, e.clientY);
        if (p.floor) {
          const band = slabs.find((s) => s.band.id === p.floor)?.band;
          if (e.pointerType !== 'mouse' && hoveredFloor !== p.floor) { hoveredFloor = p.floor; paint(); }
          else if (band?.enabled) floorRef.current?.(p.floor);
        } else if (p.id) pickRef.current?.(p.id);
        else if (hoveredFloor) { hoveredFloor = null; paint(); }
      }
      down = null;
    };
    const onMove = (e: PointerEvent) => {
      if (e.pointerType !== 'mouse' || e.buttons) return;
      const p = pickAt(e.clientX, e.clientY);
      if (p.id !== hovered || p.floor !== hoveredFloor) {
        hovered = p.id; hoveredFloor = p.floor;
        const band = slabs.find((s) => s.band.id === p.floor)?.band;
        renderer.domElement.style.cursor = (band?.enabled || p.id) ? 'pointer' : 'grab';
        paint();
      }
    };
    // moving onto the floor tag itself is not leaving the floor
    const onLeave = (e: PointerEvent) => {
      if (e.relatedTarget === tagRef.current) return;
      if (hovered || hoveredFloor) { hovered = null; hoveredFloor = null; paint(); }
    };
    renderer.domElement.addEventListener('pointerdown', onDown);
    renderer.domElement.addEventListener('pointerup', onUp);
    renderer.domElement.addEventListener('pointermove', onMove);
    renderer.domElement.addEventListener('pointerleave', onLeave);
    renderer.domElement.style.cursor = 'grab';

    // building tags (master plan) and the floor tag (building page) follow the 3D points
    controls.addEventListener('change', () => { dirty = true; });
    const labelEls = new Map<string, HTMLDivElement>();
    const toScreen = (p: THREE.Vector3) => {
      const q = p.clone().project(camera);
      return { x: ((q.x + 1) / 2) * el.clientWidth, y: ((1 - q.y) / 2) * el.clientHeight, vis: q.z < 1 && Math.abs(q.x) < 1.15 && Math.abs(q.y) < 1.15 };
    };
    const placeLabels = () => {
      for (const [id, b] of boxes) {
        const elx = labelEls.get(id);
        if (!elx) continue;
        const s = toScreen(b.center);
        elx.style.transform = `translate(-50%, -100%) translate(${s.x}px, ${s.y}px)`;
        elx.style.opacity = s.vis && !slabBuilding ? '1' : '0';
        elx.style.pointerEvents = s.vis && !slabBuilding ? 'auto' : 'none';
      }
      const tag = tagRef.current;
      const hs = slabs.find((x) => x.band.id === hoveredFloor);
      if (tag && hs) {
        const s = toScreen(hs.anchor);
        tag.style.transform = `translate(-50%, -50%) translate(${s.x}px, ${s.y}px)`;
      }
    };

    // palms, trees, shrubs and cars from the proxy positions
    const props = buildProps();
    scene.add(props);
    // eye-level views: hide the stand-ins standing between the camera and the building
    const hidden: { m: THREE.InstancedMesh; i: number; mat: THREE.Matrix4 }[] = [];
    const ZERO = new THREE.Matrix4().makeScale(0, 0, 0);
    const clearLine = (from?: THREE.Vector3, to?: THREE.Vector3) => {
      for (const h of hidden) { h.m.setMatrixAt(h.i, h.mat); h.m.instanceMatrix.needsUpdate = true; }
      hidden.length = 0;
      dirty = true;
      if (!from || !to) return;
      const a = new THREE.Vector2(from.x, from.z), ab = new THREE.Vector2(to.x - from.x, to.z - from.z);
      const len2 = ab.lengthSq() || 1;
      const m4 = new THREE.Matrix4(), p = new THREE.Vector3(), q = new THREE.Vector2();
      props.traverse((o) => {
        const im = o as THREE.InstancedMesh;
        if (!im.isInstancedMesh) return;
        for (let i = 0; i < im.count; i++) {
          im.getMatrixAt(i, m4);
          p.setFromMatrixPosition(m4);
          q.set(p.x, p.z).sub(a);
          const t = Math.max(0, Math.min(1, q.dot(ab) / len2));
          const d = q.distanceTo(ab.clone().multiplyScalar(t));
          if (t < 0.85 && d < 10) {
            hidden.push({ m: im, i, mat: m4.clone() });
            im.setMatrixAt(i, ZERO);
            im.instanceMatrix.needsUpdate = true;
          }
        }
      });
    };

    // animated water (desktop: ripples move; phone: still, to save battery)
    const ripples = waterNormals();
    const waterMat = new THREE.MeshStandardMaterial({
      color: '#1d5d74', roughness: 0.14, metalness: 0.05, normalMap: ripples, normalScale: new THREE.Vector2(0.3, 0.3),
      envMapIntensity: 1.1,
    });
    ripples.repeat.set(0.08, 0.08);
    let hasWater = false;
    let raf = 0;
    let lastWater = 0;
    const tick = (now: number) => {
      raf = requestAnimationFrame(tick);
      if (flight) {
        const k = Math.min(1, (now - flight.t0) / flight.dur);
        const e = k < 0.5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2;
        camera.position.lerpVectors(flight.from, flight.to, e);
        controls.target.lerpVectors(flight.tFrom, flight.tTo, e);
        if (k >= 1) flight = null;
        dirty = true;
      }
      if (controls.update()) dirty = true;
      if (hasWater && !mobile && !document.hidden) {
        ripples.offset.set(now * 0.0000045, now * 0.0000028);
        if (now - lastWater > 33) { lastWater = now; dirty = true; } // ~30 fps is enough for ripples
      }
      if (!dirty) return;
      dirty = false;
      renderer.render(scene, camera);
      placeLabels();
    };
    raf = requestAnimationFrame(tick);

    // small pictures of the building's viewpoints (for the angle carousel)
    const thumbs = () => {
      const id = current.focus;
      if (!id) return [];
      const key = `${id}:${Math.round(camera.aspect * 10)}`;
      if (thumbCache.has(key)) return thumbCache.get(key)!;
      const save = { pos: camera.position.clone(), target: controls.target.clone() };
      const vs = VIEWS[id] ?? [[270, 1], [300, 1]];
      floorGroup.visible = false;
      const cv = document.createElement('canvas');
      cv.width = 168; cv.height = 112;
      const g = cv.getContext('2d')!;
      const urls = vs.map((_, i) => {
        const p = viewPose(id, i);
        clearLine(p.pos, p.target);
        camera.position.copy(p.pos);
        camera.lookAt(p.target);
        renderer.render(scene, camera);
        const src = renderer.domElement;
        const s = Math.min(src.width / cv.width, src.height / cv.height);
        const sw = cv.width * s, sh = cv.height * s;
        g.drawImage(src, (src.width - sw) / 2, (src.height - sh) / 2, sw, sh, 0, 0, cv.width, cv.height);
        return cv.toDataURL('image/jpeg', 0.75);
      });
      floorGroup.visible = overlaysOn;
      const back = viewPose(id, viewIndex);
      clearLine(back.pos, back.target);
      camera.position.copy(save.pos);
      controls.target.copy(save.target);
      camera.lookAt(save.target);
      dirty = true;
      thumbCache.set(key, urls);
      return urls;
    };

    // model
    let alive = true;
    loadModel((p) => alive && setProgress(p)).then((gltf) => {
      if (!alive) return;
      const root = gltf.scene;
      root.traverse((o) => {
        const m = o as THREE.Mesh;
        if (!m.isMesh) return;
        m.castShadow = true; m.receiveShadow = true; m.frustumCulled = true;
        const mat = m.material as THREE.MeshStandardMaterial;
        if (mat && WATER_MATERIALS.has(mat.name)) {
          // keep the original for the next page that shows the shared model
          m.userData.origMaterial ??= mat;
          m.material = waterMat; m.castShadow = false; hasWater = true;
        }
      });
      scene.add(root);
      setReady(true);
      dirty = true;
    }).catch(() => alive && setFailed(true));

    // building tags: "Building B1" over "4 units"
    if (labelHost.current) {
      for (const id of boxes.keys()) {
        const d = document.createElement('div');
        d.className = 'm3d-tag';
        d.dataset.id = id;
        d.addEventListener('click', () => pickRef.current?.(id));
        d.addEventListener('mouseenter', () => { hovered = id; paint(); });
        d.addEventListener('mouseleave', () => { if (hovered === id) { hovered = null; paint(); } });
        labelHost.current.appendChild(d);
        labelEls.set(id, d);
      }
    }

    let overlaysOn = true;
    api.current = {
      setColors: (c, f) => { current = { colors: c, focus: f }; paint(); },
      home: goHome,
      reset: () => (slabBuilding ? goView(viewIndex) : goHome()),
      resize,
      setFloors,
      view: goView,
      thumbs,
      overlay: (on) => { overlaysOn = on; boxGroup.visible = on; floorGroup.visible = on; dirty = true; },
      zoom: (k) => { const dir = camera.position.clone().sub(controls.target).multiplyScalar(1 / k); camera.position.copy(controls.target.clone().add(dir)); controls.update(); dirty = true; },
    };

    return () => {
      alive = false;
      cancelAnimationFrame(raf);
      ro.disconnect();
      controls.dispose();
      pmrem.dispose();
      if (gltfPromise) gltfPromise.then((g) => scene.remove(g.scene)).catch(() => {});
      renderer.dispose();
      renderer.domElement.remove();
      labelEls.forEach((d) => d.remove());
      clearFloors();
      ripples.dispose();
      api.current = null;
    };
  }, []);

  // colours, tags, floors and viewpoint follow the props
  useEffect(() => { api.current?.setColors(colors, focus); }, [colors, focus]);
  useEffect(() => {
    labelHost.current?.querySelectorAll<HTMLDivElement>('.m3d-tag').forEach((d) => {
      const id = d.dataset.id!;
      const [title, sub] = (labels[id] ?? id).split('\n');
      d.innerHTML = '';
      const b = document.createElement('b'); b.textContent = title; d.appendChild(b);
      if (sub) { const s = document.createElement('span'); s.textContent = sub; d.appendChild(s); }
      d.style.setProperty('--c', colors[id] ?? '#fff');
    });
  }, [labels, colors]);
  const floorKey = floors?.map((f) => `${f.id}:${f.label}:${f.color}:${f.enabled}`).join('|') ?? '';
  useEffect(() => { api.current?.setFloors(floors ? focus : undefined, floors); }, [focus, floorKey]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (!ready) return;
    if (focus && floors) api.current?.view(view); else api.current?.home();
  }, [focus, view, ready, !!floors]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (!ready || !focus || !floors || !onThumbs) return;
    const id = requestAnimationFrame(() => { const u = api.current?.thumbs(); if (u) onThumbs(u); });
    return () => cancelAnimationFrame(id);
  }, [ready, focus]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { api.current?.overlay(overlays); }, [overlays]);

  return (
    <div className={`m3d ${floors ? "m3d--building" : ""}`}>
      <div className="m3d-canvas" ref={host} />
      <div className="m3d-labels" ref={labelHost} style={{ opacity: overlays && ready ? 1 : 0 }}>
        <button ref={tagRef} className="m3d-floortag" onClick={() => {
          const id = tagRef.current?.textContent && floors?.find((f) => f.label === tagRef.current!.textContent);
          if (id && id.enabled) onFloor?.(id.id);
        }} />
      </div>
      {!ready && (
        <div className="m3d-loading">
          {failed ? <span>3D model failed to load.</span> : <>
            <span>{t('loading3d')}</span>
            <div className="bar"><i style={{ width: `${Math.round(progress * 100)}%` }} /></div>
          </>}
        </div>
      )}
      <SideControls onZoom={(k) => api.current?.zoom(k)} onReset={() => api.current?.reset()} />
    </div>
  );
}
