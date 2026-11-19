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

type Poly = number[][];
// building id -> floor id -> outline (Max metres, x/y)
const FOOTPRINTS = model.footprints as Record<string, Record<string, Poly>>;

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
  labels: Record<string, string>;   // building id -> label text
  focus?: string;                   // building to fly to
  dimOthers?: boolean;
  floors?: FloorBand[];             // clickable floor slabs for the focused building
  onPick?: (id: string) => void;
  onFloor?: (id: string) => void;
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

export default function ModelView({ colors, labels, focus, dimOthers, floors, onPick, onFloor }: Props) {
  const host = useRef<HTMLDivElement>(null);
  const labelHost = useRef<HTMLDivElement>(null);
  const api = useRef<{
    setColors: (c: Record<string, string>, f?: string, dim?: boolean) => void; fly: (id?: string) => void;
    reset: () => void; zoom: (k: number) => void; resize: () => void; setFloors: (b?: string, f?: FloorBand[]) => void;
  } | null>(null);
  const pickRef = useRef(onPick);
  pickRef.current = onPick;
  const floorRef = useRef(onFloor);
  floorRef.current = onFloor;
  const [progress, setProgress] = useState(0);
  const [ready, setReady] = useState(false);
  const [failed, setFailed] = useState(false);
  const { t, lang, overlays } = useI18n();

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
    Object.assign(sky.material.uniforms, {});
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
    controls.minDistance = 18;
    controls.maxDistance = 320;
    controls.maxPolarAngle = Math.PI * 0.44;
    controls.screenSpacePanning = false;
    controls.update();

    // clickable building volumes
    type Vol = { meshes: THREE.Mesh[]; mat: THREE.MeshBasicMaterial; edgeMat: THREE.LineBasicMaterial; center: THREE.Vector3; mid: THREE.Vector3; size: number };
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
        meshes.push(mesh);
        boxGroup.add(mesh, new THREE.LineSegments(new THREE.EdgesGeometry(geo, 30), edgeMat));
      });
      const all = keys.flatMap((k) => fp[k]);
      const xs = all.map((p) => p[0]), ys = all.map((p) => p[1]);
      const cx = (Math.min(...xs) + Math.max(...xs)) / 2, cy = (Math.min(...ys) + Math.max(...ys)) / 2;
      const top = LEVELS[keys.length] ?? LEVELS[LEVELS.length - 1];
      boxes.set(id, { meshes, mat, edgeMat, center: v3(cx, cy, top + 2), mid: v3(cx, cy, 3),
        size: Math.max(Math.max(...xs) - Math.min(...xs), Math.max(...ys) - Math.min(...ys)) });
    }

    // clickable floor slabs of the focused building (one per storey, coloured by availability)
    const floorGroup = new THREE.Group();
    scene.add(floorGroup);
    type Slab = { mesh: THREE.Mesh; edges: THREE.LineSegments; band: FloorBand; corners: THREE.Vector3[]; label: HTMLDivElement };
    let slabs: Slab[] = [];
    const clearFloors = () => {
      for (const s of slabs) {
        s.mesh.geometry.dispose(); s.edges.geometry.dispose();
        (s.mesh.material as THREE.Material).dispose(); (s.edges.material as THREE.Material).dispose();
        s.label.remove();
      }
      floorGroup.clear();
      slabs = [];
    };
    const setFloors = (bid?: string, bands?: FloorBand[]) => {
      clearFloors();
      const fp = bid ? FOOTPRINTS[bid] : undefined;
      if (!fp || !bands?.length) { dirty = true; return; }
      bands.forEach((band, i) => {
        const poly = fp[band.id] ?? fp[Object.keys(fp)[Math.min(i, Object.keys(fp).length - 1)]];
        const y0 = LEVELS[i] + 0.06, y1 = (LEVELS[i + 1] ?? LEVELS[i] + 3.2) - 0.06;
        const geo = extrude(poly, y0, y1, 0.55);
        const mesh = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ color: band.color, transparent: true, opacity: 0.2, depthWrite: false }));
        mesh.userData.floor = band.id;
        mesh.renderOrder = 2;
        const edges = new THREE.LineSegments(new THREE.EdgesGeometry(geo, 30), new THREE.LineBasicMaterial({ color: band.color, transparent: true, opacity: 0.9 }));
        floorGroup.add(mesh, edges);
        const label = document.createElement('div');
        label.className = `m3d-label floor ${band.enabled ? '' : 'off'}`;
        label.textContent = band.label;
        label.style.setProperty('--c', band.color);
        if (band.enabled) label.addEventListener('click', () => floorRef.current?.(band.id));
        label.addEventListener('mouseenter', () => { hoveredFloor = band.id; paint(); });
        label.addEventListener('mouseleave', () => { if (hoveredFloor === band.id) { hoveredFloor = null; paint(); } });
        labelHost.current?.appendChild(label);
        const mid = (y0 + y1) / 2;
        slabs.push({ mesh, edges, band, corners: poly.map((p) => new THREE.Vector3(p[0], mid, -p[1])), label });
      });
      paint();
    };

    let hovered: string | null = null;
    let hoveredFloor: string | null = null;
    let current = { colors: {} as Record<string, string>, focus: undefined as string | undefined, dim: false };
    const paint = () => {
      const withFloors = slabs.length > 0;
      for (const [id, b] of boxes) {
        const c = new THREE.Color(current.colors[id] ?? '#ffffff');
        const on = hovered === id || current.focus === id;
        const dim = current.dim && current.focus && current.focus !== id;
        b.mat.color = c;
        b.mat.opacity = withFloors && current.focus === id ? 0 : on ? 0.32 : dim ? 0 : 0.12;
        b.edgeMat.color = on ? new THREE.Color('#ffffff') : c;
        b.edgeMat.opacity = withFloors && current.focus === id ? 0 : on ? 1 : dim ? 0.15 : 0.7;
      }
      for (const s of slabs) {
        const on = hoveredFloor === s.band.id;
        (s.mesh.material as THREE.MeshBasicMaterial).opacity = !s.band.enabled ? 0.06 : on ? 0.55 : 0.22;
        s.label.classList.toggle('on', on);
      }
      dirty = true;
    };

    // camera flights
    let flight: { from: THREE.Vector3; to: THREE.Vector3; tFrom: THREE.Vector3; tTo: THREE.Vector3; t0: number; dur: number } | null = null;
    const flyTo = (pos: THREE.Vector3, target: THREE.Vector3, dur = 1200) => {
      flight = { from: camera.position.clone(), to: pos, tFrom: controls.target.clone(), tTo: target, t0: performance.now(), dur };
      dirty = true;
    };
    // portrait screens see less of the site sideways: step the camera back
    const reach = () => (camera.aspect < 1 ? Math.min(2.3, 0.95 / camera.aspect) : 1);
    const homePos = () => home.target.clone().add(home.pos.clone().sub(home.target).multiplyScalar(reach()));
    let touched = false;
    const fly = (id?: string) => {
      const b = id ? boxes.get(id) : undefined;
      if (!b) return flyTo(homePos(), home.target.clone());
      const size = b.size;
      const target = b.mid.clone();
      const dir = home.pos.clone().sub(home.target).normalize();
      flyTo(target.clone().add(dir.multiplyScalar((size * 2.1 + 25) * reach())), target);
    };

    // sizing: shift the projection centre so the model sits in the area the side panel
    // (desktop) or bottom sheet (phone) leaves free
    const resize = () => {
      const w = el.clientWidth, h = el.clientHeight;
      renderer.setSize(w, h, false);
      camera.aspect = w / Math.max(1, h);
      const rtl = document.documentElement.dir === 'rtl';
      if (w <= 760) {
        const s = Math.round(h * 0.4);
        camera.setViewOffset(w, h + s, 0, s, w, h);
      } else {
        const p = 352;
        camera.setViewOffset(w + p, h, rtl ? p : 0, 0, w, h);
      }
      camera.updateProjectionMatrix();
      if (!touched && !flight && !current.focus) { camera.position.copy(homePos()); controls.update(); }
      dirty = true;
    };
    const ro = new ResizeObserver(resize);
    ro.observe(el);
    resize();

    // picking (click vs drag)
    const ray = new THREE.Raycaster();
    const ndc = new THREE.Vector2();
    const pickAt = (cx: number, cy: number) => {
      const r = renderer.domElement.getBoundingClientRect();
      ndc.set(((cx - r.left) / r.width) * 2 - 1, -((cy - r.top) / r.height) * 2 + 1);
      ray.setFromCamera(ndc, camera);
      // floor slabs of the focused building win over the building volumes
      const fh = ray.intersectObjects(slabs.filter((s) => s.band.enabled).map((s) => s.mesh), false)[0];
      if (fh) return { floor: fh.object.userData.floor as string, id: null };
      const hit = ray.intersectObjects([...boxes.values()].flatMap((b) => b.meshes), false)[0];
      return { floor: null, id: (hit?.object.userData.id as string | undefined) ?? null };
    };
    let down: { x: number; y: number } | null = null;
    const onDown = (e: PointerEvent) => { down = { x: e.clientX, y: e.clientY }; touched = true; };
    const onUp = (e: PointerEvent) => {
      if (down && Math.hypot(e.clientX - down.x, e.clientY - down.y) < 6) {
        const p = pickAt(e.clientX, e.clientY);
        if (p.floor) floorRef.current?.(p.floor);
        else if (p.id && p.id !== current.focus) pickRef.current?.(p.id);
      }
      down = null;
    };
    const onMove = (e: PointerEvent) => {
      if (e.pointerType !== 'mouse' || e.buttons) return;
      const p = pickAt(e.clientX, e.clientY);
      const id = p.floor ? null : p.id;
      if (id !== hovered || p.floor !== hoveredFloor) {
        hovered = id; hoveredFloor = p.floor;
        renderer.domElement.style.cursor = p.floor || (id && id !== current.focus) ? 'pointer' : 'grab';
        paint();
      }
    };
    renderer.domElement.addEventListener('pointerdown', onDown);
    renderer.domElement.addEventListener('pointerup', onUp);
    renderer.domElement.addEventListener('pointermove', onMove);
    renderer.domElement.style.cursor = 'grab';

    // render loop: only draws when something changed (saves battery on phones)
    controls.addEventListener('change', () => { dirty = true; });
    const labelEls = new Map<string, HTMLDivElement>();
    const placeLabels = () => {
      const w = el.clientWidth, h = el.clientHeight;
      for (const [id, b] of boxes) {
        const elx = labelEls.get(id);
        if (!elx) continue;
        const p = b.center.clone().project(camera);
        const vis = p.z < 1 && Math.abs(p.x) < 1.1 && Math.abs(p.y) < 1.1;
        elx.style.transform = `translate(-50%, -100%) translate(${((p.x + 1) / 2) * w}px, ${((1 - p.y) / 2) * h}px)`;
        elx.style.opacity = vis && !(slabs.length && id === current.focus) ? '1' : '0';
      }
      // floor labels: one column beside the building, each at its storey's height,
      // pushed apart so they never overlap (top floor first)
      if (slabs.length) {
        const rtl = document.documentElement.dir === 'rtl';
        let minX = Infinity, maxX = -Infinity;
        const rows = slabs.map((s) => {
          let sy = 0, n = 0, inFront = true;
          for (const c of s.corners) {
            const p = c.clone().project(camera);
            if (p.z >= 1) inFront = false;
            const x = ((p.x + 1) / 2) * w;
            minX = Math.min(minX, x); maxX = Math.max(maxX, x);
            sy += ((1 - p.y) / 2) * h; n++;
          }
          return { s, y: sy / n, inFront };
        }).reverse();
        const gap = 30;
        for (let i = 1; i < rows.length; i++) rows[i].y = Math.max(rows[i].y, rows[i - 1].y + gap);
        // keep the column inside the canvas
        const overflow = rows[rows.length - 1].y - (h - 20);
        if (overflow > 0) rows.forEach((r) => (r.y -= overflow));
        // free strip of the canvas: the side panel covers 352px on desktop
        const panel = w > 760 ? 352 : 0;
        const left = 8 + (rtl ? 0 : panel), right = w - 8 - (rtl ? panel : 0);
        const lw = Math.max(...rows.map((r) => r.s.label.offsetWidth));
        const fitsL = minX - 14 - lw >= left, fitsR = maxX + 14 + lw <= right;
        // prefer the side away from the panel, then whichever side fits, then clamp
        let x = (rtl ? fitsL : !fitsR && fitsL) ? minX - 14 - lw : maxX + 14;
        if (!fitsL && !fitsR) x = Math.max(left, Math.min(right - lw, minX - left > right - maxX ? minX - 14 - lw : maxX + 14));
        if (w <= 760) {
          // phone: no room beside the building, so pin the list in the top corner under the view switch
          rows.forEach((r, i) => {
            const lx = rtl ? w - 8 - r.s.label.offsetWidth : 8;
            r.s.label.style.transform = `translate(0, -50%) translate(${lx}px, ${128 + i * 34}px)`;
            r.s.label.style.opacity = '1';
          });
          return;
        }
        for (const r of rows) {
          // left of the building: right-align the column so every label ends next to it
          const lx = x < minX ? x + lw - r.s.label.offsetWidth : x;
          r.s.label.style.transform = `translate(0, -50%) translate(${lx}px, ${r.y}px)`;
          r.s.label.style.opacity = r.inFront ? '1' : '0';
        }
      }
    };

    // palms, trees, shrubs and cars from the proxy positions
    scene.add(buildProps());

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

    // labels
    if (labelHost.current) {
      for (const id of boxes.keys()) {
        const d = document.createElement('div');
        d.className = 'm3d-label';
        d.dataset.id = id;
        d.addEventListener('click', () => pickRef.current?.(id));
        labelHost.current.appendChild(d);
        labelEls.set(id, d);
      }
    }

    api.current = {
      setColors: (c, f, dim) => { current = { colors: c, focus: f, dim: !!dim }; paint(); },
      fly,
      reset: () => fly(current.focus),
      resize,
      setFloors,
      zoom: (k) => { const dir = camera.position.clone().sub(controls.target).multiplyScalar(k); camera.position.copy(controls.target.clone().add(dir)); controls.update(); dirty = true; },
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

  // colours, labels and focus follow the props
  useEffect(() => { api.current?.setColors(colors, focus, dimOthers); }, [colors, focus, dimOthers]);
  useEffect(() => {
    labelHost.current?.querySelectorAll<HTMLDivElement>('.m3d-label').forEach((d) => {
      const id = d.dataset.id!;
      const short = window.matchMedia('(max-width: 760px)').matches && !(focus === id);
      d.textContent = short ? (labels[id]?.includes('/') ? labels[id] : id) : labels[id] ?? id;
      d.style.setProperty('--c', colors[id] ?? '#fff');
      d.classList.toggle('dim', !!(dimOthers && focus && focus !== id));
    });
  }, [labels, colors, focus, dimOthers]);
  useEffect(() => { if (ready) api.current?.fly(focus); }, [focus, ready]);
  const floorKey = floors?.map((f) => `${f.id}:${f.label}:${f.color}:${f.enabled}`).join('|') ?? '';
  useEffect(() => { api.current?.setFloors(focus, floors); }, [focus, floorKey]); // eslint-disable-line react-hooks/exhaustive-deps
  // the panel changes sides with the language
  useEffect(() => { requestAnimationFrame(() => api.current?.resize()); }, [lang]);

  return (
    <div className="m3d">
      <div className="m3d-canvas" ref={host} />
      <div className="m3d-labels" ref={labelHost} style={{ opacity: overlays && ready ? 1 : 0 }} />
      {!ready && (
        <div className="m3d-loading">
          {failed ? <span>3D model failed to load.</span> : <>
            <span>{t('loading3d')}</span>
            <div className="bar"><i style={{ width: `${Math.round(progress * 100)}%` }} /></div>
          </>}
        </div>
      )}
      <div className="dz-ctrl">
        <button aria-label={t('zoomIn')} title={t('zoomIn')} onClick={() => api.current?.zoom(0.7)}>+</button>
        <button aria-label={t('zoomOut')} title={t('zoomOut')} onClick={() => api.current?.zoom(1.4)}>−</button>
        <button aria-label={t('reset')} title={t('reset')} onClick={() => api.current?.reset()}>⤢</button>
      </div>
    </div>
  );
}
