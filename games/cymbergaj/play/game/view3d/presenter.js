// Cymbergaj 3D presenter. READS the simulation state (game.getState()), never writes it. One WebGL canvas sits behind the kit's
// transparent 2D canvas: a lit lounge scene (lacquered table, brass paddles, coin puck, real hands, patrons, pendant lamps) with a
// perspective camera fitted to the layout's table rectangle, and a screen-space HUD scene (walnut plaques, lacquered buttons)
// drawn in the same frame. Fallbacks: no WebGL / context lost -> v3.on = false and every screen draws with the flat 2D art;
// context restored -> back to 3D without a reload (the environment map is rebuilt).
import { THREE, board3d as B } from '../vendor3d/index.js';
import * as V3D from '../vendor3d/index.js';
import { v3 } from '../src/v3.js';
import { syncSize, W as LW, H as LH } from '../src/layout.js';
import { layoutOf } from '../src/view.js';
import { HW, HH, R_PAD, R_PUCK } from '../src/sim.js';
import { S, OW, OH, RAIL_H, FLOOR_Y, buildTable, buildPaddle, buildPuck, buildLounge, buildEnvScene, textures, glowTexture, SIDE3, PATRON_SPOTS } from './models.js';
import { createHand } from './hand3d.js';

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const lerp = (a, b, t) => a + (b - a) * t;
const TIERS = [
  { name: 'high', dpr: 2, shadow: 2048, crowd: 14 },
  { name: 'medium', dpr: 1.5, shadow: 1024, crowd: 8 },
  { name: 'low', dpr: 1, shadow: 0, crowd: 0 },
];

export async function createPresenter({ kitCanvas, quality = 'high' }) {
  const canvas = document.createElement('canvas');
  canvas.style.cssText = 'position:fixed;inset:0;width:100vw;height:100dvh;display:block;pointer-events:none;z-index:0';
  const noop = { wrap: (g) => g, ok: false };
  let renderer;
  try { renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false, powerPreference: 'high-performance', preserveDrawingBuffer: false }); }
  catch (e) { console.warn('WebGL unavailable; 2D fallback', e); return noop; }
  kitCanvas.parentElement.insertBefore(canvas, kitCanvas);
  kitCanvas.style.position = 'relative'; kitCanvas.style.zIndex = '1';
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 0.95;
  renderer.autoClear = false;
  renderer.localClippingEnabled = true;
  renderer.setClearColor(0x120904, 1);
  renderer.shadowMap.type = THREE.PCFShadowMap;

  const qs = new URLSearchParams(location.search);
  let tier = Math.max(0, TIERS.findIndex((t) => t.name === quality));
  if (qs.has('tier')) tier = clamp(Number(qs.get('tier')), 0, TIERS.length - 1);

  // ------------------------------------------------------------------ the scene
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x120904);
  scene.fog = new THREE.Fog(0x1a0c06, 3.4, 8.5);
  const camera = new THREE.PerspectiveCamera(30, 1, 0.05, 40);
  const table = buildTable(); scene.add(table);
  const lounge = buildLounge(); scene.add(lounge);
  const paddles = [buildPaddle(0), buildPaddle(1)];
  const puck = buildPuck();
  const worldRoot = new THREE.Group(); scene.add(worldRoot);
  for (const p of paddles) worldRoot.add(p);
  worldRoot.add(puck);
  const blobT = glowTexture();
  const mkBlob = (r, o) => { const m = new THREE.Mesh(new THREE.PlaneGeometry(r * 2, r * 2), new THREE.MeshBasicMaterial({ map: blobT, color: 0x000000, transparent: true, opacity: o, depthWrite: false })); m.rotation.x = -Math.PI / 2; m.position.y = 0.0012; m.renderOrder = 1; worldRoot.add(m); return m; };
  const blobs = [mkBlob(R_PAD * S * 1.5, 0.45), mkBlob(R_PAD * S * 1.5, 0.45), mkBlob(R_PUCK * S * 1.7, 0.5)];

  // lights: the pendant lamps over the table (warm key with soft shadows), a teal rim from the back, a warm fill
  const hemi = new THREE.HemisphereLight(0xffe2b8, 0x3a2414, 0.4);
  const key = new THREE.SpotLight(0xffe2b4, 30, 9, 0.5, 0.9, 1.6);
  key.position.set(0.25, 2.1, 0.45); key.target.position.set(0, 0, 0.0);
  key.castShadow = true; key.shadow.bias = -0.0003; key.shadow.normalBias = 0.002; key.shadow.radius = 3; key.shadow.camera.near = 0.8; key.shadow.camera.far = 5;
  const rim = new THREE.DirectionalLight(0x8fe8d8, 0.9); rim.position.set(-2, 2.2, -3);
  const fill = new THREE.DirectionalLight(0xffc88a, 0.45); fill.position.set(2.4, 1.2, 2.6);
  const goalLight = new THREE.PointLight(0xffb060, 0, 1.2, 1.6); goalLight.position.set(0, 0.08, 0);
  scene.add(hemi, key, key.target, rim, fill, goalLight);

  // HUD scene (virtual units), drawn after the world
  const hud = new THREE.Scene();
  const hudCam = new THREE.PerspectiveCamera();
  const hudKey = new THREE.DirectionalLight(0xfff0d8, 1.7); hudKey.position.set(-500, 800, 1000);
  const hudFill = new THREE.DirectionalLight(0xffd0a0, 0.45); hudFill.position.set(700, -300, 600);
  hud.add(new THREE.HemisphereLight(0xffe8cc, 0x2a1408, 0.6), hudKey, hudFill);

  const envScene = buildEnvScene();
  function buildEnvMap() {
    const pm = new THREE.PMREMGenerator(renderer);
    const t = pm.fromScene(envScene, 0.03).texture;
    pm.dispose();
    scene.environment = t; scene.environmentIntensity = 0.7;
    hud.environment = t; hud.environmentIntensity = 0.45;
    // three applies a material's own envMapIntensity only when it holds its own envMap: give those materials the texture
    scene.traverse((o) => { if (o.material) for (const mt of [].concat(o.material)) if (mt.isMeshStandardMaterial && mt.envMapIntensity !== 1) mt.envMap = t; });
  }
  function setHudProjection(Wp, Hp) {
    const n = 1, f = 2200, m = hudCam.projectionMatrix;
    m.set(2 / Wp, 0, 0, -1, 0, 2 / Hp, 0, 1, 0, 0, -2 / (f - n), -(f + n) / (f - n), 0, 0, 0, 1);
    hudCam.projectionMatrixInverse.copy(m).invert();
  }

  // ------------------------------------------------------------------ air cushion: dots that glow around the puck and paddles
  const airUni = { uObj: { value: [new THREE.Vector4(), new THREE.Vector4(), new THREE.Vector4(), new THREE.Vector4()] } };
  const air = new THREE.Mesh(new THREE.PlaneGeometry(2 * HW * S, 2 * HH * S), new THREE.ShaderMaterial({
    uniforms: airUni, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    vertexShader: 'varying vec2 vP; void main(){ vP = position.xy; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
    fragmentShader: `varying vec2 vP; uniform vec4 uObj[4];
      void main(){
        float sp = ${(24 * S).toFixed(6)};
        vec2 g0 = vec2(${((-HW + 20) * S).toFixed(6)}, ${((-HH + 20) * S).toFixed(6)});
        vec2 p = vec2(vP.x, -vP.y);
        vec2 c = floor((p - g0) / sp + 0.5) * sp + g0;
        float a = 0.0;
        for (int i = 0; i < 4; i++) { float d = length(c - uObj[i].xy); float k = clamp(1.0 - d / uObj[i].z, 0.0, 1.0); a += k * k * uObj[i].w; }
        float r = length(p - c);
        float dd = smoothstep(0.0034, 0.0016, r);
        gl_FragColor = vec4(0.24, 0.85, 0.92, dd * min(a, 1.0) * 0.9);
      }`,
  }));
  air.rotation.x = -Math.PI / 2; air.position.y = 0.0007; air.renderOrder = 2; air.frustumCulled = false; worldRoot.add(air);

  // ------------------------------------------------------------------ puck trail, particles, rings, coach marks
  const discGeo = new THREE.CircleGeometry(1, 20); discGeo.rotateX(-Math.PI / 2);
  const ringGeo = new THREE.RingGeometry(0.82, 1, 40); ringGeo.rotateX(-Math.PI / 2);
  const addMat = (c, o = 1) => new THREE.MeshBasicMaterial({ color: c, transparent: true, opacity: o, blending: THREE.AdditiveBlending, depthWrite: false, fog: false });
  const trailMesh = new THREE.InstancedMesh(discGeo, addMat(0xffc860, 0.5), 10); trailMesh.frustumCulled = false; trailMesh.renderOrder = 3; worldRoot.add(trailMesh);
  const sparkMesh = new THREE.InstancedMesh(new THREE.SphereGeometry(1, 6, 5), addMat(0xfff0b0, 1), 120); sparkMesh.frustumCulled = false; worldRoot.add(sparkMesh);
  const puffMesh = new THREE.InstancedMesh(new THREE.SphereGeometry(1, 8, 6), new THREE.MeshBasicMaterial({ color: 0xfff4dc, transparent: true, opacity: 0.35, depthWrite: false }), 120); puffMesh.frustumCulled = false; worldRoot.add(puffMesh);
  const ringMesh = new THREE.InstancedMesh(ringGeo, addMat(0xfff3c0, 0.9), 24); ringMesh.frustumCulled = false; ringMesh.renderOrder = 3; worldRoot.add(ringMesh);
  const petalMesh = new THREE.InstancedMesh(new THREE.PlaneGeometry(1, 0.6), new THREE.MeshBasicMaterial({ side: THREE.DoubleSide, color: 0xffffff }), 120); petalMesh.frustumCulled = false; worldRoot.add(petalMesh);
  petalMesh.setColorAt(0, new THREE.Color(1, 1, 1));
  const coachDots = new THREE.InstancedMesh(discGeo, addMat(0xffd24a, 0.95), 80); coachDots.frustumCulled = false; coachDots.renderOrder = 4; worldRoot.add(coachDots);
  const stand = new THREE.Mesh(ringGeo, addMat(0xffffff, 0.9)); stand.renderOrder = 4; stand.visible = false; worldRoot.add(stand);
  const serve = new THREE.Mesh(ringGeo, addMat(0xfff0aa, 0.8)); serve.renderOrder = 4; serve.visible = false; worldRoot.add(serve);
  const padRings = [0, 1].map(() => { const m = new THREE.Mesh(ringGeo, addMat(0xffffff, 0)); m.renderOrder = 4; m.visible = false; worldRoot.add(m); return m; });

  const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _s = new THREE.Vector3(), _p = new THREE.Vector3(), _e = new THREE.Euler(), _c = new THREE.Color();
  const ZERO = new THREE.Matrix4().makeScale(0, 0, 0);
  const wx = (x) => x * S, wz = (y) => y * S;

  // ------------------------------------------------------------------ hands (real, from the shared hand rig)
  const hands = [null, null];
  const handClip = [0, 1].map(() => [0, 1, 2, 3, 4, 5].map(() => new THREE.Plane()));
  // The sleeve is a short, softly tapered forearm sleeve with a rolled cuff, an elbow, and an upper arm that bends away toward the
  // shoulder: it reads as a real arm in a jumper instead of one long pipe. `m` (forearm) is what the existing code positions;
  // the elbow and upper arm are placed from it in updateHands.
  const sleeves = [0, 1].map((i) => {
    const cuffMat = new THREE.MeshStandardMaterial({ color: i === 0 ? '#3d5a73' : '#27313c', roughness: 0.9, side: THREE.DoubleSide });
    const rollMat = new THREE.MeshStandardMaterial({ color: i === 0 ? '#5d7f9c' : '#3a4756', roughness: 0.8 });
    const m = new THREE.Mesh(new THREE.CylinderGeometry(0.058, 0.043, 0.30, 24, 1, true), cuffMat); m.castShadow = true; m.visible = false; scene.add(m);
    const cuff = new THREE.Mesh(new THREE.TorusGeometry(0.0455, 0.0105, 10, 28), rollMat); cuff.visible = false; scene.add(cuff);
    const elbow = new THREE.Mesh(new THREE.SphereGeometry(0.06, 16, 12), cuffMat); elbow.castShadow = true; elbow.visible = false; scene.add(elbow);
    const upper = new THREE.Mesh(new THREE.CylinderGeometry(0.075, 0.06, 0.62, 24, 1, true), cuffMat); upper.castShadow = true; upper.visible = false; scene.add(upper);
    return { m, cuff, elbow, upper };
  });
  const skins = ['tan', 'light'];
  async function loadHands() {
    for (let i = 0; i < 2; i++) {
      try {
        const h = await createHand(V3D, { side: 'R', skin: skins[i], character: i === 0 ? 'athlete_f' : 'athlete_m', preset: 'cup', ...(i === 1 ? { kit: { top: '#1d6f66', bottoms: '#232a33', socks: '#1a1a1a' }, hair: 'brown' } : {}) });
        h.object.visible = false; scene.add(h.object);
        h.human.root.traverse((o) => {
          if (o.isMesh) { for (const mt of [].concat(o.material)) { if (i === 0) { mt.clippingPlanes = handClip[i]; mt.clipShadows = true; mt.needsUpdate = true; } } o.frustumCulled = false; }
        });
        h.human.play('idle', { loop: true });
        h.iters = 24; h.root = { x: 0, y: 0, z: 0, ready: false };
        const z0 = i === 0 ? 0.9 : -0.9;
        if (i === 1) h.human.root.scale.setScalar(1.12);   // the rival is a touch taller: his arm reaches every spot of his half
        h.human.setFacing(i === 0 ? Math.PI : 0, { snap: true });
        h.human.setPosition(0, FLOOR_Y, z0); h.human.update(0); h.human.root.updateMatrixWorld(true);
        const sh = h.human.bonePosition('R_UpperArm', new THREE.Vector3());
        h.shoulderOffset = sh.clone().sub(new THREE.Vector3(0, FLOOR_Y, z0));
        hands[i] = h;
      } catch (e) { console.warn('hand load failed', e); }
    }
  }

  // ------------------------------------------------------------------ patrons
  let crowd = null;
  function buildCrowd() {
    if (crowd) { try { crowd.dispose?.(); } catch { /* ignore */ } crowd = null; }
    const n = TIERS[tier].crowd;
    if (!n) return;
    const pts = [];
    for (let i = 0; i < Math.min(n, PATRON_SPOTS.length); i++) {
      const { x, z, seated } = PATRON_SPOTS[i];
      pts.push({ x, y: FLOOR_Y + (seated ? 0.23 : 0), z, yaw: Math.atan2(-x, -z) + (i % 2 ? 0.25 : -0.25) + (z < -3.5 ? Math.PI * 0.05 : 0), seated });
    }
    try {
      crowd = V3D.createCrowd3d({ scene, camera }, { points: pts, seed: 11, culture: ['european_village', 'mediterranean'], quality: tier === 0 ? 'medium' : 'low', cold: false, excitement: 0.25, camera });
    } catch (e) { console.warn('crowd failed', e); crowd = null; }
  }

  // ------------------------------------------------------------------ HUD plaques and buttons
  const hudPanels = [], hudButtons = [];
  const geoCache = new Map();
  const slabG = (w, d, h, rad, bev) => {
    const k = `${Math.round(w)}|${Math.round(d)}|${h}|${Math.round(rad)}|${bev}`; let g = geoCache.get(k);
    if (!g) { if (geoCache.size > 150) { for (const v of geoCache.values()) v.dispose(); geoCache.clear(); } g = B.slab(w, d, h, rad, bev, { seg: 3, per: 5 }); geoCache.set(k, g); }
    return g;
  };
  const M = {};
  const mats = () => {
    if (M.walnut) return M;
    M.walnut = B.material('wood', { color: '#7a4421', color2: '#3a1c0b', seed: 4, repeat: [3, 3], roughness: 0.4 });
    M.brass = new THREE.MeshStandardMaterial({ color: '#d9a73a', metalness: 0.95, roughness: 0.28 });
    M.leather = new THREE.MeshStandardMaterial({ color: '#241108', roughness: 0.7, metalness: 0.05 });
    M.paper = new THREE.MeshStandardMaterial({ color: '#fbf1d8', roughness: 0.9, metalness: 0 });
    M.toast = new THREE.MeshStandardMaterial({ color: '#2a140a', roughness: 0.6 });
    M.plateIn = new THREE.MeshStandardMaterial({ color: '#2d1608', roughness: 0.55, metalness: 0.1 });
    M.red = new THREE.MeshPhysicalMaterial({ color: '#d63a22', roughness: 0.3, clearcoat: 1, clearcoatRoughness: 0.08 });
    M.teal = new THREE.MeshPhysicalMaterial({ color: '#1f8a7c', roughness: 0.3, clearcoat: 1, clearcoatRoughness: 0.08 });
    M.dark = new THREE.MeshPhysicalMaterial({ color: '#5a2f16', roughness: 0.4, clearcoat: 0.7, clearcoatRoughness: 0.2 });
    M.plain = new THREE.MeshPhysicalMaterial({ color: '#f4e4bd', roughness: 0.4, clearcoat: 0.8, clearcoatRoughness: 0.15 });
    M.off = new THREE.MeshStandardMaterial({ color: '#8a7a62', roughness: 0.8 });
    return M;
  };
  const scrim = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ color: 0x0a0402, transparent: true, opacity: 0, depthWrite: false }));
  hud.add(scrim);
  const ROT = Math.PI / 2;
  function panelAt(i) {
    let p = hudPanels[i];
    if (!p) { const g = new THREE.Group(), o = new THREE.Mesh(), t = new THREE.Mesh(), n = new THREE.Mesh(); g.add(o, t, n); hud.add(g); p = { g, o, t, n }; hudPanels.push(p); }
    return p;
  }
  function placePanel(i, r, rad, kind) {
    const m = mats(), p = panelAt(i); p.g.visible = true;
    const cx = r.x + r.w / 2, cy = -(r.y + r.h / 2), z = -700, dep = kind === 'toast' ? 8 : 14, ins = kind === 'toast' ? 5 : 8;
    p.o.geometry = slabG(r.w, r.h, dep, rad, 5); p.o.material = m.walnut; p.o.rotation.x = ROT; p.o.position.set(cx, cy, z);
    p.t.geometry = slabG(r.w - ins * 1.1, r.h - ins * 1.1, dep + 1.5, Math.max(4, rad - ins * 0.5), 1.6); p.t.material = m.brass; p.t.rotation.x = ROT; p.t.position.set(cx, cy, z);
    p.n.geometry = slabG(r.w - ins * 2.2, r.h - ins * 2.2, dep + 2.5, Math.max(3, rad - ins), 2.2);
    p.n.material = kind === 'paper' ? m.paper : kind === 'toast' ? m.toast : kind === 'wood' ? m.leather : m.plateIn;
    p.n.rotation.x = ROT; p.n.position.set(cx, cy, z);
  }
  function buttonAt(i) {
    let b = hudButtons[i];
    if (!b) { const g = new THREE.Group(), rim = new THREE.Mesh(), body = new THREE.Mesh(); g.add(rim, body); hud.add(g); b = { g, rim, body }; hudButtons.push(b); }
    return b;
  }
  function placeButton(i, bt) {
    const m = mats(), b = buttonAt(i), r = bt.r; b.g.visible = true;
    const cx = r.x + r.w / 2, cy = -(r.y + r.h / 2), rad = Math.min(18, r.h / 3), z = -400, dep = bt.pressed ? 8 : 18;
    b.rim.geometry = slabG(r.w, r.h, dep - 3, rad, 4); b.rim.material = bt.kind === 'disabled' ? m.off : m.brass; b.rim.rotation.x = ROT; b.rim.position.set(cx, cy, z);
    b.body.geometry = slabG(r.w - 8, r.h - 8, dep, rad - 2, 6);
    b.body.material = bt.kind === 'primary' ? m.red : bt.kind === 'active' ? m.teal : bt.kind === 'dark' ? m.dark : bt.kind === 'plain' ? m.plain : m.off;
    b.body.rotation.x = ROT; b.body.position.set(cx, cy, z);
    b.g.position.set(0, bt.pressed ? -3 : 0, 0);
  }

  // ------------------------------------------------------------------ camera fitting and picking
  let W = 1, H = 1, dprNow = 1, Lw = 720, Lh = 1280, hudW = 0, hudH = 0;
  function resize() {
    const w = Math.max(1, Math.floor(window.innerWidth)), h = Math.max(1, Math.floor(window.innerHeight));
    const dpr = Math.min(window.devicePixelRatio || 1, TIERS[tier].dpr);
    if (w !== W || h !== H || dpr !== dprNow) { W = w; H = h; dprNow = dpr; renderer.setPixelRatio(dpr); renderer.setSize(w, h, false); camera.aspect = w / h; }
  }
  const corners = [];
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) for (const y of [-0.01, RAIL_H]) corners.push(new THREE.Vector3(sx * OW * S, y, sz * (OH + 2) * S));
  const tmp = new THREE.Vector3();
  // Fit the whole table (frame included) into the virtual rectangle { cx, cy, w, h }, looking from the +Z end (portrait) or the +X
  // side (landscape: the table is turned a quarter), pitch/fov in degrees.
  function fitCamera(rect, yawDeg, pitchDeg, fov, lookX = 0, lookY = 0.0, extraYaw = 0) {
    const k = W / Lw, tw = rect.w * k, th = rect.h * k, p = (pitchDeg * Math.PI) / 180, yaw = ((yawDeg + extraYaw) * Math.PI) / 180;
    camera.fov = fov; camera.clearViewOffset(); camera.aspect = W / H; camera.updateProjectionMatrix();
    let d = 2.6;
    const place = () => {
      camera.position.set(lookX + Math.sin(yaw) * Math.cos(p) * d, lookY + Math.sin(p) * d, Math.cos(yaw) * Math.cos(p) * d);
      camera.lookAt(lookX, lookY, 0); camera.updateMatrixWorld(); camera.updateProjectionMatrix();
    };
    let x0 = 0, x1 = 0, y0 = 0, y1 = 0;
    const bbox = () => {
      x0 = y0 = 1e9; x1 = y1 = -1e9;
      for (const c of corners) { tmp.copy(c).project(camera); const px = (tmp.x + 1) / 2 * W, py = (1 - tmp.y) / 2 * H; x0 = Math.min(x0, px); x1 = Math.max(x1, px); y0 = Math.min(y0, py); y1 = Math.max(y1, py); }
    };
    for (let it = 0; it < 6; it++) { place(); bbox(); d *= Math.max((x1 - x0) / tw, (y1 - y0) / th); }
    place(); bbox();
    camera.setViewOffset(W, H, (x0 + x1) / 2 - rect.cx * k, (y0 + y1) / 2 - rect.cy * k, W, H);
    camera.updateProjectionMatrix(); camera.updateMatrixWorld(true);
  }
  const ray = new THREE.Vector3(), orig = new THREE.Vector3(), hit = new THREE.Vector3();
  function installProjection(L) {
    v3.project = (x, y, lift = 0) => {
      tmp.set(wx(x), lift, wz(y)).project(camera);
      return { x: ((tmp.x + 1) / 2) * Lw, y: ((1 - tmp.y) / 2) * Lh };
    };
    v3.unproject = (px, py) => {
      const nx = (px / Lw) * 2 - 1, ny = 1 - (py / Lh) * 2;
      orig.copy(camera.position); ray.set(nx, ny, 0.5).unproject(camera).sub(orig).normalize();
      if (Math.abs(ray.y) < 1e-4) return null;
      const t = (0.01 - orig.y) / ray.y; if (t < 0) return null;
      hit.copy(orig).addScaledVector(ray, t);
      return { x: hit.x / S, y: hit.z / S };
    };
    v3.fitKey = L ? L.key : '';
  }

  // ------------------------------------------------------------------ per-frame world sync
  let clock = 0, lastGoalT = 0;
  const vel = [{ x: 0, y: 0 }, { x: 0, y: 0 }], lastPad = [null, null], tilt = [{ x: 0, z: 0 }, { x: 0, z: 0 }];
  function syncWorld(w, o = {}) {
    const dt = o.dt || 0.016;
    for (let i = 0; i < 2; i++) {
      const p = w.pads[i], g = paddles[i], hitK = p.hit || 0;
      const lp = lastPad[i];
      if (lp && dt > 0) { const ix = (p.x - lp.x) / dt, iy = (p.y - lp.y) / dt; vel[i].x = lerp(vel[i].x, ix, 0.3); vel[i].y = lerp(vel[i].y, iy, 0.3); }
      lastPad[i] = { x: p.x, y: p.y };
      const tx = clamp(vel[i].y * 0.00028, -0.16, 0.16), tz = clamp(-vel[i].x * 0.00028, -0.16, 0.16);
      tilt[i].x = lerp(tilt[i].x, tx, 0.25); tilt[i].z = lerp(tilt[i].z, tz, 0.25);
      g.position.set(wx(p.x), 0.0008 + hitK * 0.0006, wz(p.y));
      g.rotation.set(tilt[i].x, 0, tilt[i].z);
      g.scale.set(1 + hitK * 0.02, 1 - hitK * 0.03, 1 + hitK * 0.02);
      blobs[i].position.set(wx(p.x) + 0.004, 0.0012, wz(p.y) + 0.006);
      const rr = padRings[i];
      if (hitK > 0.02) { rr.visible = true; rr.material.opacity = hitK * 0.9; rr.material.color.set(SIDE3[i].glow); const sc = (R_PAD + 4 + (1 - hitK) * 26) * S; rr.scale.set(sc, 1, sc); rr.position.set(wx(p.x), 0.002, wz(p.y)); } else rr.visible = false;
    }
    const u = w.puck, ps = u.scale ?? 1;
    puck.visible = ps > 0.02;
    puck.position.set(wx(u.x), 0.002, wz(u.y)); puck.rotation.y = -(u.ang || 0); puck.scale.setScalar(Math.max(0.01, ps));
    blobs[2].position.set(wx(u.x) + 0.003, 0.0012, wz(u.y) + 0.005); blobs[2].scale.setScalar(Math.max(0.01, ps));
    const U = airUni.uObj.value;
    U[0].set(wx(u.x), wz(u.y), 110 * S, ps);
    for (let i = 0; i < 2; i++) U[1 + i].set(wx(w.pads[i].x), wz(w.pads[i].y), (R_PAD + 46) * S, 0.55);
    U[3].set(0, 0, 1, 0);
    const tr = o.trail || [];
    for (let i = 0; i < 10; i++) {
      const q = tr[i];
      if (!q) { trailMesh.setMatrixAt(i, ZERO); continue; }
      const k = (i + 1) / tr.length, r = R_PUCK * (0.25 + 0.5 * k) * S * 1.15;
      _p.set(wx(q.x), 0.0018, wz(q.y)); _s.set(r, 1, r); _m.compose(_p, _q.identity(), _s); trailMesh.setMatrixAt(i, _m);
    }
    trailMesh.instanceMatrix.needsUpdate = true;
    trailMesh.material.opacity = 0.18 + 0.4 * (tr.length ? tr[tr.length - 1].a : 0);
  }
  function syncParts(parts) {
    let ns = 0, np = 0, nr = 0, nl = 0;
    for (const q of parts || []) {
      const k = q.t / q.max, a = Math.max(0, 1 - k);
      if (q.kind === 0 && np < 120) {
        const r = (q.size * (0.7 + k * 0.6)) * S * 0.9; _p.set(wx(q.x), 0.012 + k * 0.04, wz(q.y)); _s.setScalar(r); _m.compose(_p, _q.identity(), _s); puffMesh.setMatrixAt(np++, _m);
      } else if (q.kind === 1 && ns < 120) {
        const r = 2.6 * S * a; _p.set(wx(q.x), 0.012 + k * 0.05 - k * k * 0.04, wz(q.y)); _s.setScalar(Math.max(0.0004, r)); _m.compose(_p, _q.identity(), _s); sparkMesh.setMatrixAt(ns++, _m);
      } else if (q.kind === 2 && nr < 24) {
        const r = q.size * (0.4 + k) * S; _p.set(wx(q.x), 0.003, wz(q.y)); _s.set(r, 1, r); _m.compose(_p, _q.identity(), _s); ringMesh.setMatrixAt(nr++, _m);
      } else if (q.kind === 3 && nl < 120) {
        const r = q.size * S * 0.9, h = 0.02 + Math.sin(Math.min(1, k) * Math.PI) * 0.22;
        _p.set(wx(q.x), h, wz(q.y)); _e.set(q.rot + k * 6, q.rot * 2 + k * 5, k * 4); _q.setFromEuler(_e); _s.set(r, r, r); _m.compose(_p, _q, _s);
        petalMesh.setMatrixAt(nl, _m); _c.set(q.col); petalMesh.setColorAt(nl, _c); nl++;
      }
    }
    for (let i = np; i < 120; i++) puffMesh.setMatrixAt(i, ZERO);
    for (let i = ns; i < 120; i++) sparkMesh.setMatrixAt(i, ZERO);
    for (let i = nr; i < 24; i++) ringMesh.setMatrixAt(i, ZERO);
    for (let i = nl; i < 120; i++) petalMesh.setMatrixAt(i, ZERO);
    puffMesh.instanceMatrix.needsUpdate = sparkMesh.instanceMatrix.needsUpdate = ringMesh.instanceMatrix.needsUpdate = petalMesh.instanceMatrix.needsUpdate = true;
    if (petalMesh.instanceColor) petalMesh.instanceColor.needsUpdate = true;
  }
  function syncCoach(coach, t) {
    let n = 0;
    if (coach && coach.line && coach.line.length > 1) {
      const pts = coach.line;
      coachDots.material.color.setHex(coach.kind === 'strike' ? 0xffd24a : 0x8ff0e0);
      let acc = -((t * 60) % 26);
      for (let i = 1; i < pts.length && n < 79; i++) {
        const a = pts[i - 1], b = pts[i], len = Math.hypot(b.x - a.x, b.y - a.y);
        for (let s = Math.max(0, acc); s < len && n < 79; s += 26) {
          const f = s / len; _p.set(wx(a.x + (b.x - a.x) * f), 0.003, wz(a.y + (b.y - a.y) * f)); _s.set(4.6 * S, 1, 4.6 * S); _m.compose(_p, _q.identity(), _s); coachDots.setMatrixAt(n++, _m);
        }
        acc = acc + Math.ceil((len - acc) / 26) * 26 - len;
      }
      const e = pts[pts.length - 1]; _p.set(wx(e.x), 0.003, wz(e.y)); _s.set(12 * S, 1, 12 * S); _m.compose(_p, _q.identity(), _s); coachDots.setMatrixAt(n++, _m);
    }
    for (let i = n; i < 80; i++) coachDots.setMatrixAt(i, ZERO);
    coachDots.instanceMatrix.needsUpdate = true;
    if (coach && coach.stand) { stand.visible = true; const pulse = 0.5 + 0.5 * Math.sin(t * 6), r = (R_PAD + 4 + 3 * pulse) * S; stand.scale.set(r, 1, r); stand.position.set(wx(coach.stand.x), 0.003, wz(coach.stand.y)); stand.material.opacity = 0.7 + 0.25 * pulse; } else stand.visible = false;
  }

  // ------------------------------------------------------------------ hands follow the paddles
  const _w = new THREE.Vector3(), _f = new THREE.Vector3(), _el = new THREE.Vector3(), _a = new THREE.Vector3(), _b = new THREE.Vector3(), _up = new THREE.Vector3(0, 1, 0), _fw = new THREE.Vector3(0, 0, 1);
  function updateHands(w, dt, grip, play = true) {
    for (let i = 0; i < 2; i++) {
      const h = hands[i]; if (!h) continue;
      if (!play && i === 0) { h.object.visible = false; sleeves[0].m.visible = sleeves[0].cuff.visible = sleeves[0].elbow.visible = sleeves[0].upper.visible = false; continue; }
      const p = w.pads[i], dir = i === 0 ? 1 : -1;       // +1: the hand comes from the +Z end (the camera side)
      const kx = wx(p.x), kz = wz(p.y), knobY = 0.0008 + 0.045;
      const sway = Math.sin(clock * 1.7 + i) * 0.0018;
      _w.set(kx, knobY + 0.042 + sway, kz + dir * 0.062);
      _f.set(0, -0.36, -dir * 0.93).normalize();
      // the opponent grips the knob from above: wrist right over it, fingers pointing steeply down so they curl round the handle
      if (i === 1) { _w.set(kx, knobY + 0.05 + sway, kz + dir * 0.03); _f.set(0, -0.72, -dir * 0.69).normalize(); }
      _el.set(kx + 0.16, 0.30, kz + dir * 0.45);
      h.setPose({ thumb: 0.6, index: 0.85 + 0.1 * grip, middle: 0.9 + 0.08 * grip, ring: 0.92 + 0.06 * grip, pinky: 0.92 + 0.06 * grip, spread: 0.1, thumbOut: 0.1 });
      h.place({ wrist: _w, palmDown: true, fingers: _f, elbowHint: _el });
      if (i === 1) { _a.set(_w.x - 0.1, _w.y + 0.32, Math.min(-0.66, _w.z - 0.3)); _el.set(_a.x + 0.22, _w.y + 0.14, (_a.z + _w.z) * 0.5); } else _a.set(_w.x + 0.17, _w.y + 0.2, _w.z + dir * 0.44);
      const rt = h.root, kf = rt.ready ? 1 - Math.pow(0.0005, Math.max(dt, 0.001)) : 1;
      rt.x = lerp(rt.x, _a.x - h.shoulderOffset.x, kf); rt.y = lerp(rt.y, _a.y - h.shoulderOffset.y, kf); rt.z = lerp(rt.z, _a.z - h.shoulderOffset.z, kf); rt.ready = true;
      h.human.setPosition(rt.x, rt.y, rt.z);
      if (i === 1 && w.puck) h.human.lookAt({ x: wx(w.puck.x), y: 0.03, z: wz(w.puck.y) }, { weight: 0.8, maxYaw: 1.0, maxPitch: 0.8 });
      h.update(dt || 0.016, h.iters); h.iters = 4;
      if (i === 1) { h.object.visible = true; sleeves[1].m.visible = sleeves[1].cuff.visible = sleeves[1].elbow.visible = sleeves[1].upper.visible = false; continue; }
      h.human.bonePosition('R_Hand', _a);
      h.human.bonePosition('R_Forearm', _b);
      _el.copy(_b).sub(_a).normalize();                      // from the wrist toward the elbow
      // keep only a box around the hand and the first 15 cm of forearm: the rest of the body stays out of the picture
      const uA = _f.set(1, 0, 0); if (Math.abs(_el.x) > 0.9) uA.set(0, 0, 1);
      uA.addScaledVector(_el, -uA.dot(_el)).normalize();
      const vA = _b.crossVectors(_el, uA).normalize();
      const hc = handClip[i], HWd = 0.1;
      hc[0].setFromNormalAndCoplanarPoint(_up.copy(_el).negate(), _w.copy(_a).addScaledVector(_el, 0.16));
      hc[1].setFromNormalAndCoplanarPoint(_up.copy(_el), _w.copy(_a).addScaledVector(_el, -0.24));
      hc[2].setFromNormalAndCoplanarPoint(_up.copy(uA), _w.copy(_a).addScaledVector(uA, -HWd));
      hc[3].setFromNormalAndCoplanarPoint(_up.copy(uA).negate(), _w.copy(_a).addScaledVector(uA, HWd));
      hc[4].setFromNormalAndCoplanarPoint(_up.copy(vA), _w.copy(_a).addScaledVector(vA, -HWd));
      hc[5].setFromNormalAndCoplanarPoint(_up.copy(vA).negate(), _w.copy(_a).addScaledVector(vA, HWd));
      _up.set(0, 1, 0);
      const sl = sleeves[i];
      sl.m.visible = sl.cuff.visible = sl.elbow.visible = sl.upper.visible = true;
      // forearm: from just behind the wrist, 0.30 m toward the elbow
      sl.m.position.copy(_a).addScaledVector(_el, 0.07 + 0.15);
      sl.m.quaternion.setFromUnitVectors(_up, _el);
      sl.cuff.position.copy(_a).addScaledVector(_el, 0.072); sl.cuff.quaternion.setFromUnitVectors(_fw, _el);
      // elbow, then an upper arm that swings away from the body line and rises toward the shoulder (off screen)
      const eb = _w.copy(_a).addScaledVector(_el, 0.37);
      sl.elbow.position.copy(eb);
      const ud = _b.copy(_el).multiplyScalar(0.72); ud.x += 0.45; ud.y += 0.55; ud.normalize();
      sl.upper.position.copy(eb).addScaledVector(ud, 0.31);
      sl.upper.quaternion.setFromUnitVectors(_up, ud);
      h.object.visible = true;
    }
  }

  // ------------------------------------------------------------------ frame
  let lastT = 0, frames = 0, ema = 16;
  function applyTier() {
    const t = TIERS[tier];
    renderer.shadowMap.enabled = t.shadow > 0; key.castShadow = t.shadow > 0;
    if (t.shadow) { key.shadow.mapSize.set(t.shadow, t.shadow); if (key.shadow.map) { key.shadow.map.dispose(); key.shadow.map = null; } }
    W = 0;
    scene.traverse((o) => { if (o.material) for (const mt of [].concat(o.material)) mt.needsUpdate = true; });
    buildCrowd();
  }

  const prep = { r: null, L: null };
  let devCam = null;
  function frameScene(state, L) {
    const sc = state.scene;
    v3.scene = sc;
    let world = null, parts = null, trail = null, coach = null;
    const mode = sc === 'play' && state.m && state.w ? 'play' : 'menu';
    if (mode === 'play') {
      world = state.w; parts = state.parts; trail = state.trail; coach = state.freeze && state.freeze.coach ? state.freeze.coach : null;
      const land = L.land, s = L.s;
      const ext = { cx: L.cx, cy: L.cy, w: (land ? 2 * OH : 2 * OW) * s, h: (land ? 2 * OW : 2 * OH) * s };
      fitCamera(ext, land ? 90 : 0, land ? 46 : 54, 28);
      installProjection(L);
    } else {
      v3.fitKey = ''; v3.project = v3.unproject = null;
      const a = v3.attract && v3.attract.L0, att = state.att;
      world = att ? att.w : null; parts = att ? att.parts : null; trail = att ? att.trail : null;
      const land = Lw > Lh;
      const drift = state.settings && state.settings.calm ? 0 : Math.sin(clock * 0.21) * 6;
      // hero composition (title, setup, pages): the table sits in the middle of the lounge, seen low from the player's end
      const rect = land ? (state.scene === 'title' ? { cx: Lw * 0.31, cy: Lh * 0.64, w: Lw * 0.5, h: Lh * 0.62 } : { cx: Lw * 0.5, cy: Lh * 0.56, w: Lw * 0.6, h: Lh * 0.9 }) : { cx: Lw / 2, cy: Lh * 0.54, w: Lw * 0.92, h: Lh * 0.62 };
      fitCamera(rect, land ? 90 : 0, land ? 24 : 27, 30, 0, 0.08, drift);
      void a;
    }
    if (devCam) { camera.clearViewOffset(); camera.fov = devCam.fov || 30; camera.aspect = W / H; camera.position.set(...devCam.pos); camera.lookAt(...devCam.look); camera.updateProjectionMatrix(); camera.updateMatrixWorld(true); }
    return { world, parts, trail, coach, mode };
  }
  function prepare(state) {
    resize();
    syncSize();
    const L = layoutOf(state);
    Lw = LW; Lh = LH;
    if (hudW !== Lw || hudH !== Lh) { hudW = Lw; hudH = Lh; setHudProjection(Lw, Lh); }
    v3.panels.length = 0; v3.buttons.length = 0; v3.scrim = 0; v3.attract = null;
    prep.L = L;
    prep.r = frameScene(state, L);
  }
  function present(state, dt) {
    const { r } = prep;
    clock += dt;
    const w = r.world;
    if (w) {
      syncWorld(w, { dt, trail: r.trail });
      syncParts(r.parts);
      syncCoach(r.coach, state.t || clock);
      const m = state.m, play = r.mode === 'play';
      const goalK = play && m && m.phase === 'goal' ? Math.max(0, 1 - (state.goalT || 0) / 1.6) : 0;
      goalLight.intensity = goalK * 2.2; goalLight.position.set(0, 0.08, (state.pocket > 0 ? 1 : -1) * (HH + 20) * S);
      for (const o of table.children) if (o.name === 'spillN' || o.name === 'spillF') o.material.opacity = ((o.name === 'spillN') === (state.pocket > 0) ? goalK : 0) * 0.75;
      const ready = play && m && (m.phase === 'ready' || (m.phase === 'live' && w.rallyHits === 0 && Math.hypot(w.puck.vx, w.puck.vy) < 5));
      serve.visible = !!ready;
      if (ready) { const rr = (R_PUCK + 10 + 2 * Math.sin(clock * 8)) * S; serve.scale.set(rr, 1, rr); serve.position.set(wx(w.puck.x), 0.003, wz(w.puck.y)); serve.material.opacity = 0.5 + 0.35 * Math.sin(clock * 8); }
      if (play && m && m.phase === 'goal' && lastGoalT !== state.goalT && (state.goalT || 0) < 0.05 && crowd) { try { crowd.react('cheer', { origin: [0, 0, 0], radius: 12, intensity: 1 }); } catch { /* ignore */ } }
      lastGoalT = state.goalT;
      updateHands(w, dt, Math.min(1, Math.hypot(vel[0].x, vel[0].y) / 400), play);
    } else { for (const h of hands) if (h) h.object.visible = false; for (const sl of sleeves) sl.m.visible = sl.cuff.visible = sl.elbow.visible = sl.upper.visible = false; }
    lounge.userData.update(clock, state.settings && state.settings.calm);
    if (crowd) crowd.update(dt);
    mats();
    let n = 0;
    for (const p of v3.panels) placePanel(n++, p.r, p.rad, p.kind);
    for (let i = n; i < hudPanels.length; i++) hudPanels[i].g.visible = false;
    n = 0;
    for (const b of v3.buttons) placeButton(n++, b);
    for (let i = n; i < hudButtons.length; i++) hudButtons[i].g.visible = false;
    scrim.visible = v3.scrim > 0; scrim.material.opacity = v3.scrim; scrim.scale.set(Lw * 2, Lh * 2, 1); scrim.position.set(Lw / 2, -Lh / 2, -1100);
    renderer.setViewport(0, 0, W, H);
    renderer.clear(true, true, true);
    renderer.render(scene, camera);
    renderer.clearDepth();
    renderer.render(hud, hudCam);
  }

  canvas.addEventListener('webglcontextlost', (e) => { e.preventDefault(); v3.on = false; });
  canvas.addEventListener('webglcontextrestored', () => {
    try { buildEnvMap(); } catch (e) { /* no reflections, still playable */ }
    W = 0; resize(); v3.on = true;
  });

  try {
    textures(); buildEnvMap(); applyTier(); resize();
  } catch (e) { console.warn('3D init failed; 2D fallback', e); canvas.remove(); v3.on = false; return noop; }
  v3.on = true;
  loadHands();
  if (qs.has('dev')) window.__p3 = { renderer, scene, camera, hands, paddles, puck, key, setTier: (t) => { tier = t; applyTier(); }, setCam: (c) => { devCam = c; }, get crowd() { return crowd; } };

  return {
    ok: true, renderer, scene, camera,
    wrap(game) {
      return Object.assign({}, game, {
        update(dt, input) {
          const p = input.pointer; v3.pressed = p && p.down ? { x: p.x, y: p.y } : null;
          return game.update(dt, input);
        },
        render(ctx, view) {
          const state = game.getState();
          if (!v3.on) { game.render(ctx, view); return; }
          const now = performance.now(), dt = Math.min(0.1, Math.max(0, (now - lastT) / 1000)); lastT = now;
          ema = ema * 0.95 + dt * 1000 * 0.05; frames++;
          if (frames > 120 && ema > 30 && tier < TIERS.length - 1) { tier++; applyTier(); frames = 0; ema = 16; }
          ctx.save(); ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height); ctx.restore();
          try { prepare(state); } catch (e) { console.warn('3D prepare failed', e); v3.on = false; game.render(ctx, view); return; }
          game.render(ctx, view);
          try { present(state, state.paused ? 0 : dt); } catch (e) { console.warn('3D present failed', e); v3.on = false; }
        },
      });
    },
  };
}
