// Origami 3D presenter. READS what view.js registered this frame in src/v3.js (the faces of the paper and the 2D camera), never writes
// game state. One WebGL canvas sits behind the kit's transparent 2D canvas. The 3D camera is the 2D camera's exact pinhole (same tilt,
// distance, zoom and centre), so the dashed crease guides, the glowing handle and finger hit-testing stay on the paper. Real lit paper
// (printed side or plain back chosen by facing), layer stacking, soft cast shadows on a hinoki desk and a sage folding mat.
// No WebGL, ?flat=1 or a lost context: v3.on = false and every screen draws the software-3D 2D art.
import * as THREE from '../vendor3d/three.js';
import { v3 } from '../src/v3.js';
import { meta } from '../src/layout.js';
import { buildDesk, bakePaperTexture } from './world.js';

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const TIERS = [{ dpr: 2, shadow: 2048, tex: 1024 }, { dpr: 1.5, shadow: 1024, tex: 1024 }, { dpr: 1, shadow: 0, tex: 512 }];
const tick = () => new Promise((r) => setTimeout(r, 0));
const LAYER = 0.0045;          // sheet units between stacked layers
const MAXV = 24;               // vertices per face (convex pieces are small)

export async function createPresenter({ kitCanvas }) {
  const qs = new URLSearchParams(location.search);
  const canvas = document.createElement('canvas');
  canvas.style.cssText = 'position:fixed;inset:0;width:100vw;height:100vh;height:100dvh;display:block;pointer-events:none;z-index:0;visibility:hidden';
  let renderer;
  try { renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false, powerPreference: 'high-performance' }); } catch (e) { console.warn('WebGL unavailable; flat 2D art', e); return { ok: false }; }
  if (!renderer.getContext()) return { ok: false };
  kitCanvas.parentElement.insertBefore(canvas, kitCanvas);
  kitCanvas.style.position = 'relative'; kitCanvas.style.zIndex = '1';
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.NeutralToneMapping; renderer.toneMappingExposure = 1.0;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.setClearColor(0xd9c298, 1);
  let tier = qs.has('tier') ? clamp(Number(qs.get('tier')), 0, 2) : (navigator.hardwareConcurrency || 8) <= 4 ? 1 : 0;

  await tick();
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(30, 1, 0.3, 40);
  camera.matrixAutoUpdate = false; camera.matrixWorldAutoUpdate = false;
  scene.add(new THREE.HemisphereLight(0xfff6e6, 0x9a7a58, 1.2));
  const sun = new THREE.DirectionalLight(0xfff1d6, 1.7); sun.castShadow = true; sun.shadow.bias = -0.0002; sun.shadow.normalBias = 0.0015; sun.shadow.radius = 4; scene.add(sun, sun.target);
  const buildEnv = () => { try { const pm = new THREE.PMREMGenerator(renderer); scene.environment = pm.fromScene(new THREE.RoomEnvironment(), 0.04).texture; pm.dispose(); scene.environmentIntensity = 0.28; } catch { /* no IBL */ } };
  buildEnv();
  const desk = buildDesk(); scene.add(desk);
  await tick();

  // face meshes (pooled): geometry rebuilt per frame, material = printed front or plain back baked with the current creases
  const pool = [];
  const faceGeo = () => {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(MAXV * 3 * 3), 3));
    g.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(MAXV * 3 * 2), 2));
    g.frustumCulled = false; return g;
  };
  const edgeGeo = new THREE.BufferGeometry(); edgeGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(2400 * 3), 3)); edgeGeo.frustumCulled = false;
  const edges = new THREE.LineSegments(edgeGeo, new THREE.LineBasicMaterial({ color: 0x4a3018, transparent: true, opacity: 0.34 })); edges.frustumCulled = false; scene.add(edges);

  const mats = new Map();   // key -> { front, back, texs }
  function matsFor(paper, creases) {
    const ck = creases.map((c) => `${c.p[0].toFixed(3)},${c.p[1].toFixed(3)},${c.q[0].toFixed(3)},${c.q[1].toFixed(3)}`).join('|');
    const key = `${paper.id}|${paper.backColor}|${tier === 2 ? 5 : 10}|${ck}`;
    let m = mats.get(key);
    if (!m) {
      const N = TIERS[tier].tex, mk = (cv, n) => { const t = bakePaperTexture(cv, creases, n); return new THREE.MeshStandardMaterial({ map: t, roughness: 0.86, metalness: 0, side: THREE.FrontSide, shadowSide: THREE.DoubleSide }); };
      m = { front: mk(paper.front, N), back: mk(paper.back, N / 2) };
      mats.set(key, m);
      if (mats.size > 14) { const k0 = mats.keys().next().value, o = mats.get(k0); for (const x of [o.front, o.back]) { x.map.dispose(); x.dispose(); } mats.delete(k0); }
    }
    return m;
  }
  const disposeMats = () => { for (const o of mats.values()) for (const x of [o.front, o.back]) { x.map.dispose(); x.dispose(); } mats.clear(); };

  function applyTier() {
    const t = TIERS[tier];
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, t.dpr));
    renderer.shadowMap.enabled = t.shadow > 0; sun.castShadow = t.shadow > 0;
    if (t.shadow) { sun.shadow.mapSize.set(t.shadow, t.shadow); if (sun.shadow.map) { sun.shadow.map.dispose(); sun.shadow.map = null; } }
    disposeMats();
    scene.traverse((o) => { if (o.material) [].concat(o.material).forEach((m) => { if (m && m.isMaterial) m.needsUpdate = true; }); });
  }
  applyTier();

  const cpu = () => meta.cssPerUnit || (Math.min(window.innerWidth, window.innerHeight) / 720);
  const cssW = () => Math.max(1, window.innerWidth), cssH = () => Math.max(1, window.innerHeight);
  const M4 = new THREE.Matrix4(), M4i = new THREE.Matrix4();
  let lastNow = 0, frameAvg = 16, slow = 0, game = null, lost = false;

  // the 2D pinhole camera as a three.js camera: world = (x, z up, y toward the viewer), see paperview.js project()
  function setCamera(cam, W, H, c, offX, offY) {
    const d = 1 / cam.k, f = cam.S * c * d, px = cam.x * c + offX, py = cam.y * c + offY;
    const ca = cam.cy_ ?? 1, sa = cam.sy_ ?? 0, ct = cam.ct, st = cam.st;
    const L = (x, y, z) => { const z1 = -sa * x + ca * z, x2 = ca * x + sa * z; return [x2, -(ct * y - st * z1), st * y + ct * z1]; };
    const ex = L(1, 0, 0), ey = L(0, 0, 1), ez = L(0, 1, 0);   // world X -> sheet x, world Y -> sheet z, world Z -> sheet y
    const cw = [cam.cx, 0, cam.cy], mc = [ex[0] * cw[0] + ey[0] * cw[1] + ez[0] * cw[2], ex[1] * cw[0] + ey[1] * cw[1] + ez[1] * cw[2], ex[2] * cw[0] + ey[2] * cw[1] + ez[2] * cw[2]];
    M4.set(ex[0], ey[0], ez[0], -mc[0], ex[1], ey[1], ez[1], -mc[1], ex[2], ey[2], ez[2], -mc[2] - d, 0, 0, 0, 1);
    camera.matrixWorldInverse.copy(M4); camera.matrixWorld.copy(M4i.copy(M4).invert());
    const n = 0.3, fa = 40;
    camera.projectionMatrix.set(2 * f / W, 0, -(2 * px / W - 1), 0, 0, 2 * f / H, -(1 - 2 * py / H), 0, 0, 0, -(fa + n) / (fa - n), -2 * fa * n / (fa - n), 0, 0, -1, 0);
    camera.projectionMatrixInverse.copy(camera.projectionMatrix).invert();
  }

  const scr = (cam, p) => { // same projection as paperview.project (virtual units) for winding tests
    let x = p[0] - cam.cx, y = p[1] - cam.cy, z = p[2];
    if (cam.yaw) { const x2 = x * cam.cy_ + z * cam.sy_; z = -x * cam.sy_ + z * cam.cy_; x = x2; }
    const y2 = y * cam.ct - z * cam.st, z2 = y * cam.st + z * cam.ct, w = 1 / (1 - cam.k * z2);
    return [x * w, y2 * w];
  };

  function updatePaper(pp) {
    const { faces, cam, creases, paper, mode = {} } = pp;
    const stat = faces.filter((F) => !F.moving && !F.posed).map((F) => F.z);
    const zs = [...new Set(stat)].sort((a, b) => a - b), rank = new Map(zs.map((z, i) => [z, i]));
    const top = (zs.length + 0.5) * LAYER;
    let minZ = 0; for (const F of faces) for (const p of F.pts3) minZ = Math.min(minZ, p[2]);
    const lift = !mode.fold && !faces.some((F) => F.posed) ? Math.max(0, -minZ) : 0;
    const mm = matsFor(paper, creases || []);
    let ev = 0;
    while (pool.length < faces.length) { const g = faceGeo(), m = new THREE.Mesh(g, mm.front); m.castShadow = true; m.receiveShadow = true; m.frustumCulled = false; scene.add(m); pool.push(m); }
    const ea = edgeGeo.attributes.position.array;
    faces.forEach((F, i) => {
      const mesh = pool[i], n = Math.min(F.pts3.length, MAXV);
      const base = F.posed ? 0 : F.moving ? (mode.kind === 'mountain' ? 0 : top) : (rank.get(F.z) + 1) * LAYER;
      const P = F.pts3.slice(0, n).map((p) => [p[0], p[1], p[2] + base + lift]);
      const sp = F.pts3.slice(0, n).map((p) => scr(cam, p));
      let ar = 0; for (let k = 0; k < n; k++) { const a = sp[k], b = sp[(k + 1) % n]; ar += a[0] * b[1] - b[0] * a[1]; }
      const frontPrinted = ar > 0, order = []; for (let k = 0; k < n; k++) order.push(frontPrinted ? n - 1 - k : k);  // visually CCW = three's front face
      const Eu = F.Eu, Ev = F.Ev, uu = Eu[0] * Eu[0] + Eu[1] * Eu[1] + Eu[2] * Eu[2], vv = Ev[0] * Ev[0] + Ev[1] * Ev[1] + Ev[2] * Ev[2], uvd = Eu[0] * Ev[0] + Eu[1] * Ev[1] + Eu[2] * Ev[2];
      const det = uu * vv - uvd * uvd || 1;
      const UV = F.pts3.slice(0, n).map((p) => { const d0 = [p[0] - F.c3[0], p[1] - F.c3[1], p[2] - F.c3[2]], a = d0[0] * Eu[0] + d0[1] * Eu[1] + d0[2] * Eu[2], b = d0[0] * Ev[0] + d0[1] * Ev[1] + d0[2] * Ev[2]; return [F.uv[0] + (a * vv - b * uvd) / det + 0.5, F.uv[1] + (b * uu - a * uvd) / det + 0.5]; });
      const pos = mesh.geometry.attributes.position, uvA = mesh.geometry.attributes.uv; let vi = 0;
      for (let k = 1; k < n - 1; k++) for (const j of [0, k, k + 1]) {
        const o = order[j], q = P[o]; pos.setXYZ(vi, q[0], q[2], q[1]); uvA.setXY(vi, UV[o][0], UV[o][1]); vi++;
      }
      pos.needsUpdate = true; uvA.needsUpdate = true; mesh.geometry.setDrawRange(0, vi); mesh.geometry.computeVertexNormals();
      mesh.material = frontPrinted ? mm.front : mm.back; mesh.visible = true;
      for (let k = 0; k < n && ev < 790; k++) {
        if (F.skip && F.skip[k]) continue;
        const a = P[k], b = P[(k + 1) % n], e = 0.0009;
        ea.set([a[0], a[2] + e, a[1], b[0], b[2] + e, b[1]], ev * 6); ev++;
      }
    });
    for (let i = faces.length; i < pool.length; i++) pool[i].visible = false;
    edgeGeo.setDrawRange(0, ev * 2); edgeGeo.attributes.position.needsUpdate = true; edges.visible = ev > 0;
  }

  function post() {
    if (!game || lost) return;
    const now = performance.now(), dt = clamp((now - (lastNow || now)) / 1000, 0, 0.1); lastNow = now;
    canvas.style.visibility = 'visible';
    const W = cssW(), H = cssH(), c = cpu(), offX = (W - meta.width * c) / 2, offY = (H - meta.height * c) / 2;
    const pp = v3.paper;
    let cam;
    if (pp) { cam = pp.cam; updatePaper(pp); } else {
      for (const m of pool) m.visible = false; edges.visible = false;
      cam = { x: meta.width / 2, y: meta.height * 0.46, S: Math.min(meta.width, meta.height) * 0.95, cx: 0, cy: 0.1, tilt: 0.42, yaw: 0, k: 0.22, ct: Math.cos(0.42), st: Math.sin(0.42), cy_: 1, sy_: 0 };
    }
    setCamera(cam, W, H, c, offX, offY);
    // the sun: up-left of the viewer, shadows fall down-right; the shadow box follows the paper
    const tx = cam.cx, tz = cam.cy, E = 2.4;
    sun.position.set(tx - 1.3, 4.2, tz - 1.5); sun.target.position.set(tx, 0, tz); sun.target.updateMatrixWorld();
    const sc = sun.shadow.camera; if (sc.right !== E) { sc.left = -E; sc.right = E; sc.top = E; sc.bottom = -E; sc.near = 0.5; sc.far = 9; sc.updateProjectionMatrix(); }
    const mat = desk.children[1], ms = pp ? (pp.title ? 1.3 : 2.7 * Math.max(1, meta.width / meta.height * 1.15)) : 0.001;
    mat.visible = !!pp; mat.scale.set(ms, ms, 1); mat.position.x = pp?.title ? 0 : 0; mat.position.z = pp?.title ? 0.02 : 0;
    renderer.setSize(W, H, false);
    renderer.render(scene, camera);
    const ft = dt * 1000; if (ft > 0) frameAvg = frameAvg * 0.95 + ft * 0.05;
    if (frameAvg > 26 && tier < 2) { if (++slow > 90) { tier++; slow = 0; frameAvg = 16; applyTier(); } } else slow = 0;
  }

  canvas.addEventListener('webglcontextlost', (e) => { e.preventDefault(); lost = true; v3.on = false; canvas.style.visibility = 'hidden'; });
  canvas.addEventListener('webglcontextrestored', () => { lost = false; buildEnv(); disposeMats(); applyTier(); v3.on = true; });
  return { ok: true, attach(g) { game = g; v3.on = true; }, post, get tier() { return tier; } };
}
