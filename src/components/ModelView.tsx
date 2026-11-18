import { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { GLTFLoader, type GLTF } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/examples/jsm/libs/meshopt_decoder.module.js';
import { DRACOLoader } from 'three/examples/jsm/loaders/DRACOLoader.js';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import model from '../data/model.json';
import { useI18n } from '../lib/i18n';

type BoxDef = { c: number[]; w: number; d: number; h: number; rot: number };
type Props = {
  colors: Record<string, string>;   // building id -> tint
  labels: Record<string, string>;   // building id -> label text
  focus?: string;                   // building to fly to
  dimOthers?: boolean;
  onPick?: (id: string) => void;
};

// Max metres (x east, y north, z up) -> three.js (X = x, Y = z, Z = -y)
const v3 = (x: number, y: number, z: number) => new THREE.Vector3(x, z, -y);

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

export default function ModelView({ colors, labels, focus, dimOthers, onPick }: Props) {
  const host = useRef<HTMLDivElement>(null);
  const labelHost = useRef<HTMLDivElement>(null);
  const api = useRef<{ setColors: (c: Record<string, string>, f?: string, dim?: boolean) => void; fly: (id?: string) => void; reset: () => void; zoom: (k: number) => void; resize: () => void } | null>(null);
  const pickRef = useRef(onPick);
  pickRef.current = onPick;
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
    scene.background = new THREE.Color('#d9e6ea');
    scene.fog = new THREE.Fog('#d9e6ea', 260, 900);
    const pmrem = new THREE.PMREMGenerator(renderer);
    scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    scene.environmentIntensity = 0.55;

    // warm late-afternoon sun from the west-south-west, like the V-Ray sunset rig
    const sun = new THREE.DirectionalLight('#ffe2bd', 2.6);
    sun.position.copy(v3(78 - 140, 48 - 50, 70));
    sun.target.position.copy(v3(78, 48, 0));
    sun.castShadow = !mobile;
    sun.shadow.mapSize.set(2048, 2048);
    Object.assign(sun.shadow.camera, { left: -110, right: 110, top: 110, bottom: -110, near: 10, far: 400 });
    sun.shadow.bias = -0.0004;
    sun.shadow.normalBias = 0.04;
    scene.add(sun, sun.target, new THREE.HemisphereLight('#dfeefa', '#b9a27f', 0.9));

    const camera = new THREE.PerspectiveCamera(42, 1, 0.5, 2000);
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
    const boxes = new Map<string, { mesh: THREE.Mesh; edges: THREE.LineSegments; center: THREE.Vector3; def: BoxDef }>();
    const boxGroup = new THREE.Group();
    scene.add(boxGroup);
    for (const [id, def] of Object.entries(model.boxes as Record<string, BoxDef>)) {
      const geo = new THREE.BoxGeometry(def.w, def.h, def.d);
      geo.translate(0, def.h / 2, 0);
      const mat = new THREE.MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0, depthWrite: false });
      const mesh = new THREE.Mesh(geo, mat);
      mesh.position.copy(v3(def.c[0], def.c[1], 0));
      mesh.rotation.y = THREE.MathUtils.degToRad(def.rot);
      mesh.userData.id = id;
      const edges = new THREE.LineSegments(new THREE.EdgesGeometry(geo), new THREE.LineBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0 }));
      edges.position.copy(mesh.position); edges.rotation.copy(mesh.rotation);
      boxGroup.add(mesh, edges);
      boxes.set(id, { mesh, edges, center: v3(def.c[0], def.c[1], def.h + 2), def });
    }

    let hovered: string | null = null;
    let current = { colors: {} as Record<string, string>, focus: undefined as string | undefined, dim: false };
    const paint = () => {
      for (const [id, b] of boxes) {
        const c = new THREE.Color(current.colors[id] ?? '#ffffff');
        const on = hovered === id || current.focus === id;
        const dim = current.dim && current.focus && current.focus !== id;
        (b.mesh.material as THREE.MeshBasicMaterial).color = c;
        (b.mesh.material as THREE.MeshBasicMaterial).opacity = on ? 0.32 : dim ? 0 : 0.12;
        (b.edges.material as THREE.LineBasicMaterial).color = on ? new THREE.Color('#ffffff') : c;
        (b.edges.material as THREE.LineBasicMaterial).opacity = on ? 1 : dim ? 0.15 : 0.7;
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
      const size = Math.max(b.def.w, b.def.d);
      const target = v3(b.def.c[0], b.def.c[1], 3);
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
      const hit = ray.intersectObjects([...boxes.values()].map((b) => b.mesh), false)[0];
      return (hit?.object.userData.id as string | undefined) ?? null;
    };
    let down: { x: number; y: number } | null = null;
    const onDown = (e: PointerEvent) => { down = { x: e.clientX, y: e.clientY }; touched = true; };
    const onUp = (e: PointerEvent) => {
      if (down && Math.hypot(e.clientX - down.x, e.clientY - down.y) < 6) {
        const id = pickAt(e.clientX, e.clientY);
        if (id) pickRef.current?.(id);
      }
      down = null;
    };
    const onMove = (e: PointerEvent) => {
      if (e.pointerType !== 'mouse' || e.buttons) return;
      const id = pickAt(e.clientX, e.clientY);
      if (id !== hovered) { hovered = id; renderer.domElement.style.cursor = id ? 'pointer' : 'grab'; paint(); }
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
        elx.style.opacity = vis ? '1' : '0';
      }
    };
    let raf = 0;
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
        if (m.isMesh) { m.castShadow = true; m.receiveShadow = true; m.frustumCulled = true; }
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
