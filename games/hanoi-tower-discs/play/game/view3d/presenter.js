// Tower of Hanoi 3D presenter: a cream marble slab on a bronze plinth, polished steel pegs and glazed stoneware discs in a lamplit
// study (plum wall, oxblood leather desk, warm window light). It READS what the 2D layer published this frame (src/v3.js: slab, pegs,
// discs, positions in virtual screen units) and never writes game state. Every published point is unprojected onto the peg plane of
// the camera, so a disc, a peg and a tap line up exactly with what the 3D scene shows and all hit zones stay in the 2D layer.
// No WebGL, ?flat=1 or a lost context: v3.on = false and every screen draws the flat 2D art; a restored context returns to 3D.
import * as THREE from '../vendor3d/three.js';
import { v3 } from '../src/v3.js';
import { meta } from '../src/layout.js';

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const tick = () => new Promise((r) => setTimeout(r, 0));
const TIERS = [{ name: 'high', dpr: 2, shadow: 2048, seg: 72 }, { name: 'medium', dpr: 1.5, shadow: 1024, seg: 48 }, { name: 'low', dpr: 1, shadow: 0, seg: 32 }];
// glazed stoneware, one soft hue per disc; sizes differ too, so colour is never the only cue
const STONE = ['#f0a79a', '#f2c185', '#e9dc8f', '#b6d98f', '#8fd0bd', '#8fbde6', '#a9a3e6', '#d79ee0', '#ee9fc0', '#d8cfbd', '#9fd6e0', '#c9b08a'];
const TILT = 15 * Math.PI / 180, FOV = 24;

function noiseTex(w, h, base, speck, n, a) {
  const c = document.createElement('canvas'); c.width = w; c.height = h; const x = c.getContext('2d');
  x.fillStyle = base; x.fillRect(0, 0, w, h);
  let s = 7; const rnd = () => (s = (s * 16807) % 2147483647) / 2147483647;
  for (let i = 0; i < n; i++) { x.fillStyle = `rgba(${speck},${a * rnd()})`; x.fillRect(rnd() * w, rnd() * h, 1 + rnd() * 1.6, 1 + rnd() * 1.6); }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = 4; return t;
}
function marbleTex() {
  const c = document.createElement('canvas'); c.width = c.height = 512; const x = c.getContext('2d');
  const g = x.createLinearGradient(0, 0, 512, 512); g.addColorStop(0, '#f3eee4'); g.addColorStop(1, '#e4ddcf'); x.fillStyle = g; x.fillRect(0, 0, 512, 512);
  let s = 11; const rnd = () => (s = (s * 16807) % 2147483647) / 2147483647;
  for (let v = 0; v < 22; v++) {
    x.beginPath(); let px = rnd() * 512, py = rnd() * 512; x.moveTo(px, py);
    for (let i = 0; i < 9; i++) { px += (rnd() - 0.35) * 80; py += (rnd() - 0.5) * 60; x.lineTo(px, py); }
    x.strokeStyle = v % 5 === 0 ? `rgba(196,160,92,${0.25 + 0.2 * rnd()})` : `rgba(110,120,135,${0.1 + 0.14 * rnd()})`; x.lineWidth = 0.6 + rnd() * 1.8; x.stroke();
  }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = 4; return t;
}
function wallTex() {
  const c = document.createElement('canvas'); c.width = 512; c.height = 512; const x = c.getContext('2d');
  const g = x.createLinearGradient(0, 0, 0, 512); g.addColorStop(0, '#23101c'); g.addColorStop(0.55, '#341624'); g.addColorStop(1, '#2a1018'); x.fillStyle = g; x.fillRect(0, 0, 512, 512);
  // daylight falling through a tall window, with its glazing bars
  const rg = x.createRadialGradient(150, 150, 10, 150, 200, 330); rg.addColorStop(0, 'rgba(255,214,160,0.55)'); rg.addColorStop(0.4, 'rgba(240,160,120,0.18)'); rg.addColorStop(1, 'rgba(240,160,120,0)'); x.fillStyle = rg; x.fillRect(0, 0, 512, 512);
  x.fillStyle = 'rgba(255,226,180,0.10)'; for (const [a, b] of [[40, 30], [150, 30], [40, 190], [150, 190]]) x.fillRect(a, b, 100, 150);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}
function digitTex(n) {
  const c = document.createElement('canvas'); c.width = 128; c.height = 128; const x = c.getContext('2d');
  x.font = '800 92px "Palatino Linotype", Palatino, Georgia, serif'; x.textAlign = 'center'; x.textBaseline = 'middle';
  x.fillStyle = 'rgba(255,255,255,0.35)'; x.fillText(String(n), 64, 70);
  x.fillStyle = 'rgba(62,36,40,0.88)'; x.fillText(String(n), 64, 66);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}

// a stoneware ring: rounded rim, a shallow dished top, a central hole for the peg. Origin = centre of the bottom face.
function ringGeo(R, H, hr, seg) {
  const b = Math.min(H * 0.34, R * 0.09), pts = [];
  pts.push(new THREE.Vector2(hr, 0), new THREE.Vector2(R - b, 0));
  for (let i = 1; i <= 5; i++) { const a = (i / 5) * Math.PI / 2; pts.push(new THREE.Vector2(R - b + Math.sin(a) * b, b - Math.cos(a) * b)); }
  pts.push(new THREE.Vector2(R, H - b));
  for (let i = 1; i <= 5; i++) { const a = (i / 5) * Math.PI / 2; pts.push(new THREE.Vector2(R - b + Math.cos(a) * b, H - b + Math.sin(a) * b)); }
  const inner = hr + (R - hr) * 0.16;
  pts.push(new THREE.Vector2(inner + b, H), new THREE.Vector2(inner, H - b * 0.55), new THREE.Vector2(hr, H - b * 0.55), new THREE.Vector2(hr, 0));
  const g = new THREE.LatheGeometry(pts, seg); g.computeVertexNormals(); return g;
}

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
  renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.0;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  let tier = qs.has('tier') ? clamp(Number(qs.get('tier')), 0, 2) : (navigator.hardwareConcurrency || 8) <= 4 ? 1 : 0;

  await tick();
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x1a0b14);
  const camera = new THREE.PerspectiveCamera(FOV, 1, 200, 30000);
  const sun = new THREE.DirectionalLight(0xffe2b8, 2.7); scene.add(sun, sun.target);
  const hemi = new THREE.HemisphereLight(0xffd9c4, 0x3a1424, 0.7); scene.add(hemi);
  const fill = new THREE.DirectionalLight(0xb6c6ff, 0.35); fill.position.set(900, 500, 1200); scene.add(fill);
  const buildEnv = () => { try { const pm = new THREE.PMREMGenerator(renderer); scene.environment = pm.fromScene(new THREE.RoomEnvironment(), 0.04).texture; pm.dispose(); scene.environmentIntensity = 0.9; } catch { /* no IBL */ } };
  buildEnv();
  await tick();

  // ---- room: wall, leather desk
  const wallT = wallTex();
  const wall = new THREE.Mesh(new THREE.PlaneGeometry(9000, 6000), new THREE.MeshBasicMaterial({ map: wallT, fog: false })); wall.position.set(0, 1000, -1500); scene.add(wall);
  const leatherT = noiseTex(256, 256, '#4d1b24', '20,6,10', 2600, 0.5); leatherT.repeat.set(30, 30);
  const desk = new THREE.Mesh(new THREE.PlaneGeometry(9000, 6000), new THREE.MeshStandardMaterial({ map: leatherT, roughness: 0.62, metalness: 0, color: 0xffffff }));
  desk.rotation.x = -Math.PI / 2; desk.receiveShadow = true; scene.add(desk);

  // ---- slab: bronze plinth under a cream marble top
  const marbleT = marbleTex();
  const marbleM = new THREE.MeshPhysicalMaterial({ map: marbleT, roughness: 0.28, clearcoat: 0.7, clearcoatRoughness: 0.2, metalness: 0 });
  const bronzeM = new THREE.MeshStandardMaterial({ color: 0x6b4a2c, roughness: 0.38, metalness: 0.85 });
  const box = new THREE.BoxGeometry(1, 1, 1);
  const top = new THREE.Mesh(box, marbleM), plinth = new THREE.Mesh(box, bronzeM);
  for (const m of [top, plinth]) { m.castShadow = true; m.receiveShadow = true; scene.add(m); }
  // ---- pegs: polished steel with a finial
  const steelM = new THREE.MeshStandardMaterial({ color: 0xeef1f5, roughness: 0.16, metalness: 1 });
  const goldM = new THREE.MeshStandardMaterial({ color: 0xe8c46a, roughness: 0.25, metalness: 1, emissive: 0xffc040, emissiveIntensity: 0 });
  const cyl = new THREE.CylinderGeometry(1, 1, 1, 24), ball = new THREE.SphereGeometry(1, 20, 14);
  const collarG = new THREE.CylinderGeometry(1, 1.12, 1, 28);
  const pegs = Array.from({ length: 4 }, () => {
    const g = new THREE.Group(), shaft = new THREE.Mesh(cyl, steelM), fin = new THREE.Mesh(ball, steelM), col = new THREE.Mesh(collarG, bronzeM);
    for (const m of [shaft, fin, col]) { m.castShadow = true; m.receiveShadow = true; g.add(m); }
    g.userData = { shaft, fin, col }; g.visible = false; scene.add(g); return g;
  });
  const ringM = new THREE.MeshBasicMaterial({ color: 0xffd36a, transparent: true, opacity: 0.8, depthWrite: false, side: THREE.DoubleSide, fog: false });
  const goalRing = new THREE.Mesh(new THREE.RingGeometry(0.86, 1, 56), ringM); goalRing.rotation.x = -Math.PI / 2; goalRing.visible = false; scene.add(goalRing);
  const goalFill = new THREE.Mesh(new THREE.CircleGeometry(0.86, 56), new THREE.MeshBasicMaterial({ color: 0xe8c46a, transparent: true, opacity: 0.2, depthWrite: false, fog: false })); goalFill.rotation.x = -Math.PI / 2; goalFill.visible = false; scene.add(goalFill);

  // ---- discs
  const grain = noiseTex(128, 128, '#ffffff', '150,130,120', 700, 0.5);
  const digits = Array.from({ length: 12 }, (_, i) => digitTex(i + 1));
  const discs = Array.from({ length: 12 }, (_, i) => {
    const mat = new THREE.MeshPhysicalMaterial({ color: new THREE.Color(STONE[i % STONE.length]), map: grain, roughness: 0.42, clearcoat: 0.55, clearcoatRoughness: 0.3, metalness: 0, emissive: 0xffd36a, emissiveIntensity: 0 });
    const mesh = new THREE.Mesh(undefined, mat); mesh.castShadow = true; mesh.receiveShadow = true; mesh.visible = false;
    const decal = new THREE.Mesh(undefined, new THREE.MeshBasicMaterial({ map: digits[i], transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2, fog: false }));
    mesh.add(decal); mesh.userData = { key: '', decal }; scene.add(mesh); return mesh;
  });

  function applyTier() {
    const t = TIERS[tier];
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, t.dpr));
    renderer.shadowMap.enabled = t.shadow > 0; sun.castShadow = t.shadow > 0;
    if (t.shadow) { sun.shadow.mapSize.set(t.shadow, t.shadow); if (sun.shadow.map) { sun.shadow.map.dispose(); sun.shadow.map = null; } sun.shadow.bias = -0.0004; sun.shadow.normalBias = 1.2; }
    for (const d of discs) d.userData.key = '';
    scene.traverse((o) => { if (o.material) [].concat(o.material).forEach((m) => { if (m && m.isMaterial) m.needsUpdate = true; }); });
  }
  applyTier();

  // ---------------------------------------------------------------- camera + unprojection onto the peg plane (z = 0)
  const cssW = () => Math.max(1, window.innerWidth), cssH = () => Math.max(1, window.innerHeight);
  const cpu = () => meta.cssPerUnit || (Math.min(cssW(), cssH()) / 720);
  const offX = () => (cssW() - meta.width * cpu()) / 2, offY = () => (cssH() - meta.height * cpu()) / 2;
  const _a = new THREE.Vector3(), _b = new THREE.Vector3();
  let camKey = '';
  function placeCamera() {
    const k = `${cssW()}x${cssH()}`; if (k === camKey) return; camKey = k;
    const viewH = cssH() / cpu(), D = (viewH / 2) / Math.tan((FOV / 2) * Math.PI / 180);
    camera.aspect = cssW() / cssH(); camera.fov = FOV;
    camera.position.set(0, D * Math.sin(TILT), D * Math.cos(TILT)); camera.lookAt(0, 0, 0);
    camera.updateProjectionMatrix(); camera.updateMatrixWorld(true);
  }
  function unp(vx, vy, out = { x: 0, y: 0 }) {
    const nx = ((vx * cpu() + offX()) / cssW()) * 2 - 1, ny = 1 - ((vy * cpu() + offY()) / cssH()) * 2;
    _a.set(nx, ny, 0.5).unproject(camera); _b.copy(_a).sub(camera.position).normalize();
    const t = -camera.position.z / _b.z; out.x = camera.position.x + _b.x * t; out.y = camera.position.y + _b.y * t; return out;
  }
  const P0 = { x: 0, y: 0 }, P1 = { x: 0, y: 0 };
  const kxAt = (vx, vy) => { unp(vx, vy, P0); unp(vx + 10, vy, P1); return Math.abs(P1.x - P0.x) / 10; };
  const kyAt = (vx, vy) => { unp(vx, vy, P0); unp(vx, vy - 10, P1); return Math.abs(P1.y - P0.y) / 10; };

  // ---------------------------------------------------------------- per frame
  let lost = false, lastNow = 0, frameAvg = 16, slowFrames = 0, fadeIn = 0, clock = 0, slabKey = '';
  function pre() { v3.slab = null; v3.pegs = []; v3.discs = []; v3.mode = 'env'; v3.done = 0; }
  function post() {
    if (lost) return;
    const now = performance.now(), dt = clamp((now - (lastNow || now)) / 1000, 0, 0.1); lastNow = now; clock += dt;
    placeCamera();
    const S = v3.slab, show = v3.mode !== 'env' && S;
    if (S) {
      const a = unp(S.x0, S.y, { x: 0, y: 0 }), b = unp(S.x1, S.y, { x: 0, y: 0 }), ky = kyAt((S.x0 + S.x1) / 2, S.y);
      const sp = v3.pegs.length > 1 ? Math.abs(unp(v3.pegs[1].x, S.y, P0).x - unp(v3.pegs[0].x, S.y, P1).x) : (b.x - a.x) / 3;
      const u = sp / 230;
      const topY = a.y, T = Math.max(14, S.h * 0.5 * ky), Dh = sp * 0.55, W = b.x - a.x, cx = (a.x + b.x) / 2;
      top.position.set(cx, topY - T * 0.3, 0); top.scale.set(W, T * 0.6, Dh * 2);
      plinth.position.set(cx, topY - T * 0.8, 0); plinth.scale.set(W + 22 * u, T * 0.4 + 0.01, Dh * 2 + 22 * u);
      top.visible = plinth.visible = Boolean(show);
      desk.position.set(0, topY - T, 0);
      const key = `${Math.round(W)}|${Math.round(topY)}`;
      if (key !== slabKey) { slabKey = key; const e = Math.max(W * 0.62, 460); const sc = sun.shadow.camera; sc.left = -e; sc.right = e; sc.top = e * 1.1; sc.bottom = -e * 0.5; sc.near = 100; sc.far = 6000; sc.updateProjectionMatrix(); }
      sun.position.set(cx - 1500, topY + 2700, 2200); sun.target.position.set(cx, topY + 200, 0); sun.target.updateMatrixWorld();
      pegs.forEach((g, i) => {
        const p = v3.pegs[i]; g.visible = Boolean(p && show); if (!p) return;
        const f = unp(p.x, p.y, { x: 0, y: 0 }), tp = unp(p.x, p.y - p.len, { x: 0, y: 0 }), kx = kxAt(p.x, p.y), r = Math.max(2, p.r * kx * 0.92);
        const goal = i === v3.goal, h = tp.y - f.y, { shaft, fin, col } = g.userData;
        shaft.scale.set(r, h, r); shaft.position.set(f.x, f.y + h / 2, 0); shaft.material = goal ? goldM : steelM;
        fin.scale.set(r * 1.7, r * 1.7, r * 1.7); fin.position.set(f.x, tp.y + r * 0.9, 0); fin.material = goal ? goldM : steelM;
        col.scale.set(r * 2.5, r * 1.6, r * 2.5); col.position.set(f.x, f.y + r * 0.8, 0);
        if (goal) goldM.emissiveIntensity = clamp(p.glow, 0, 1) * (0.5 + 0.5 * Math.sin(clock * 5)) * 0.9;
      });
      const gp = v3.pegs[v3.goal];
      goalRing.visible = goalFill.visible = Boolean(gp && show);
      if (gp && show) { const f = unp(gp.x, gp.y, P0), R = sp * 0.4, pu = 0.65 + 0.3 * Math.sin(clock * 2.4) + (v3.done ? 0.2 : 0); goalRing.position.set(f.x, f.y + 0.6, 0); goalRing.scale.set(R, R, R); goalFill.position.set(f.x, f.y + 0.4, 0); goalFill.scale.set(R, R, R); ringM.opacity = clamp(pu, 0.3, 1); }
    } else {
      top.visible = plinth.visible = false; pegs.forEach((g) => { g.visible = false; }); goalRing.visible = goalFill.visible = false;
      const q = unp(meta.width / 2, meta.height * 0.78, P0); desk.position.y = q.y - 60;
      sun.position.set(-1500, q.y + 2700, 2200); sun.target.position.set(0, q.y, 0); sun.target.updateMatrixWorld();
    }
    wall.position.y = desk.position.y + 1700;
    discs.forEach((m, i) => {
      const d = v3.discs.find((e) => e.id === i); m.visible = Boolean(d && show);
      if (!d || !show) return;
      const o = unp(d.x, d.y, { x: 0, y: 0 }), kx = kxAt(d.x, d.y), ky = kyAt(d.x, d.y), R = (d.w / 2) * kx, H = d.sh * ky;
      const pr = v3.pegs[0] ? v3.pegs[0].r * kx : 8, hr = Math.min(R * 0.4, Math.max(pr * 1.35, 2));
      const key = `${Math.round(R * 4)}|${Math.round(H * 4)}|${Math.round(hr * 4)}|${TIERS[tier].seg}`;
      if (m.userData.key !== key) {
        m.userData.key = key; m.geometry?.dispose(); m.geometry = ringGeo(R, H, hr, TIERS[tier].seg);
        const dc = m.userData.decal, arc = Math.min(1.5, (H * 0.74) / R); dc.geometry?.dispose();
        dc.geometry = new THREE.CylinderGeometry(R * 1.004, R * 1.004, H * 0.62, 18, 1, true, -arc / 2, arc); dc.position.y = H * 0.48;
      }
      m.userData.decal.visible = Boolean(v3.numbers) && H > 9;
      const sq = d.sq || 0;
      m.position.set(o.x, o.y, 0); m.scale.set(1 + sq * 0.5, 1 - sq, 1 + sq * 0.5);
      m.material.emissiveIntensity = clamp(d.glow || 0, 0, 1) * 0.55;
    });
    if (fadeIn < 1) { fadeIn = Math.min(1, fadeIn + dt / 0.45); v3.fade = fadeIn; }
    renderer.setSize(cssW(), cssH(), false);
    renderer.render(scene, camera);
    const ft = dt * 1000; if (ft > 0) frameAvg = frameAvg * 0.95 + ft * 0.05;
    if (frameAvg > 26 && tier < 2) { if (++slowFrames > 90) { tier++; slowFrames = 0; frameAvg = 16; applyTier(); } } else slowFrames = 0;
  }

  let loseExt = null;
  canvas.addEventListener('webglcontextlost', (e) => { e.preventDefault(); lost = true; v3.on = false; canvas.style.visibility = 'hidden'; });
  canvas.addEventListener('webglcontextrestored', () => {
    lost = false; buildEnv(); applyTier(); fadeIn = 0; v3.fade = 0; v3.on = true; canvas.style.visibility = 'visible'; camKey = '';
  });

  await tick();
  placeCamera(); try { renderer.compile(scene, camera); } catch { /* compiled lazily */ }
  await tick();

  return {
    ok: true, renderer, scene, camera,
    attach() { v3.on = true; v3.fade = 0; fadeIn = 0; canvas.style.visibility = 'visible'; },
    pre, post,
    get tier() { return TIERS[tier].name; },
    loseContext() { loseExt = renderer.getContext().getExtension('WEBGL_lose_context'); loseExt?.loseContext(); return Boolean(loseExt); },
    restoreContext() { loseExt?.restoreContext(); },
  };
}
