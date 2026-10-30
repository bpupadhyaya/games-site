// Peg Solitaire 3D presenter. READS what the 2D layer handed over this frame (src/v3.js: the board pose and every marble, in screen units) and never
// writes game state. One WebGL canvas sits behind the kit's transparent 2D canvas (HUD, buttons, target glows, text stay 2D and keep all input).
// The room: a sunlit terrace table of glazed teal tiles; a thick turned board of light wood with a raised rim, a brass inlay ring and deep carved wells;
// round glass marbles with swirled cores and real reflections that cast soft shadows. A clearly different place from the Salon (dark leather, lamp, pegs).
// Taps stay exact: the camera is orthographic and pitched, and the table plane is stretched by 1/sin(pitch), so a point of the playing surface lands on screen
// at exactly the (x, y) the 2D layer computed (the surface is lifted into place so heights never shift a tap).
// No WebGL, ?flat=1 or a lost context: v3.on = false and every screen draws the flat 2D art; a restored context rebuilds the scene.
import * as THREE from '../vendor3d/three.js';
import { v3 } from '../src/v3.js';
import { meta } from '../src/game.js';
import { boardShape, WOODS, PEGS } from '../src/art.js';

const PITCH = 52 * Math.PI / 180, SIN = Math.sin(PITCH), COS = Math.cos(PITCH);
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const TIERS = [{ name: 'high', dpr: 2, shadow: 2048, tex: 1 }, { name: 'medium', dpr: 1.5, shadow: 1024, tex: 1 }, { name: 'low', dpr: 1, shadow: 0, tex: 0.5 }];
const tick = () => new Promise((r) => setTimeout(r, 0));
// board-local units = one hole pitch. surface height HS, well depth WD, rim width RW, marble radius RM
const HS = 0.74, WD = 0.4, RW = 0.26, RM = 0.4, CAP = 52;

const cvs = (w, h) => { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; };
function tex(c, rep, srgb = true) { const t = new THREE.CanvasTexture(c); if (srgb) t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8; if (rep) { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(rep[0], rep[1]); } return t; }
let rs = 1; const rnd = () => ((rs = (Math.imul(rs, 1664525) + 1013904223) >>> 0) / 4294967296);
const rgb = (c, k = 1) => `rgb(${Math.min(255, c[0] * k) | 0},${Math.min(255, c[1] * k) | 0},${Math.min(255, c[2] * k) | 0})`;

// ---- procedural textures (no assets) ------------------------------------------------------------------------------------------------
function tileCanvas(k) {   // glazed teal tiles with a cream lattice ornament and hair-crackle; two tiles per side
  rs = 11; const N = 512 * k, c = cvs(N, N), g = c.getContext('2d'); g.scale(k, k);
  for (let ty = 0; ty < 2; ty++) for (let tx = 0; tx < 2; tx++) {
    const x = tx * 256, y = ty * 256, v = 0.92 + rnd() * 0.16;
    const gr = g.createLinearGradient(x, y, x + 256, y + 256); gr.addColorStop(0, `rgb(${34 * v | 0},${112 * v | 0},${124 * v | 0})`); gr.addColorStop(1, `rgb(${20 * v | 0},${80 * v | 0},${96 * v | 0})`);
    g.fillStyle = gr; g.fillRect(x, y, 256, 256);
    g.strokeStyle = 'rgba(238,226,190,0.32)'; g.lineWidth = 3; g.beginPath(); g.moveTo(x + 128, y + 30); g.lineTo(x + 226, y + 128); g.lineTo(x + 128, y + 226); g.lineTo(x + 30, y + 128); g.closePath(); g.stroke();
    g.lineWidth = 1.5; g.strokeStyle = 'rgba(238,226,190,0.2)'; g.beginPath(); g.arc(x + 128, y + 128, 44, 0, 6.3); g.stroke();
    g.fillStyle = 'rgba(238,226,190,0.3)'; for (const [dx, dy] of [[30, 30], [226, 30], [30, 226], [226, 226]]) { g.beginPath(); g.arc(x + dx, y + dy, 7, 0, 6.3); g.fill(); }
    g.fillStyle = 'rgba(244,236,206,0.35)'; g.beginPath(); g.arc(x + 128, y + 128, 9, 0, 6.3); g.fill();
    for (let i = 0; i < 14; i++) { g.strokeStyle = 'rgba(255,255,255,0.05)'; g.lineWidth = 1; g.beginPath(); const a = rnd() * 256, b = rnd() * 256; g.moveTo(x + a, y + b); g.lineTo(x + a + (rnd() - 0.5) * 60, y + b + (rnd() - 0.5) * 60); g.stroke(); }
  }
  g.fillStyle = '#cdbf9d'; for (const p of [0, 256]) { g.fillRect(p - 2, 0, 4, 512); g.fillRect(0, p - 2, 512, 4); } g.fillRect(510, 0, 2, 512); g.fillRect(0, 510, 512, 2);
  return c;
}
function woodCanvas(base, k, seed) {   // base: { top, mid, dark, grain } (art.js WOODS shape)
  rs = seed; const N = 512 * k, c = cvs(N, N), g = c.getContext('2d'); g.scale(k, k);
  const gr = g.createLinearGradient(0, 0, 512, 512); gr.addColorStop(0, base.top); gr.addColorStop(0.5, base.mid); gr.addColorStop(1, base.dark); g.fillStyle = gr; g.fillRect(0, 0, 512, 512);
  for (let i = 0; i < 150; i++) {
    const y0 = rnd() * 512, amp = 2 + rnd() * 10, ph = rnd() * 6.3, a = 0.05 + rnd() * 0.16; g.strokeStyle = `rgba(${base.grain[0]},${base.grain[1]},${base.grain[2]},${a})`; g.lineWidth = 0.6 + rnd() * 2.2; g.beginPath();
    for (let x = 0; x <= 512; x += 16) { const y = y0 + Math.sin(ph + x * 0.012) * amp + (x / 512) * 14; if (x === 0) g.moveTo(x, y); else g.lineTo(x, y); } g.stroke();
  }
  for (let i = 0; i < 5; i++) { const x = rnd() * 512, y = rnd() * 512; for (let r = 4; r < 30; r += 5) { g.strokeStyle = `rgba(${base.grain[0]},${base.grain[1]},${base.grain[2]},0.14)`; g.lineWidth = 1.2; g.beginPath(); g.ellipse(x, y, r * 2.2, r * 0.7, 0, 0, 6.3); g.stroke(); } }
  return c;
}
function marbleCanvas(S, k, boxwood) {   // equirect-ish swirl texture for a sphere
  rs = 7; const W = 512 * k, H = 256 * k, c = cvs(W, H), g = c.getContext('2d'); g.scale(k, k);
  if (boxwood) { g.drawImage(woodCanvas({ top: '#f2d9a2', mid: '#d6a25a', dark: '#a8742f', grain: [120, 78, 28] }, 1, 21), 0, 0, 512, 256); return c; }
  const gr = g.createLinearGradient(0, 0, 0, 256); gr.addColorStop(0, rgb(S.mid, 0.75)); gr.addColorStop(0.5, rgb(S.mid, 1.0)); gr.addColorStop(1, rgb(S.mid, 0.7)); g.fillStyle = gr; g.fillRect(0, 0, 512, 256);
  const ribbons = [[S.light, 0.85, 34], [[250, 246, 232], 0.9, 22], [S.dark, 0.9, 38], [S.light, 0.6, 24], [[255, 255, 255], 0.6, 14], [S.dark, 0.7, 26]];
  ribbons.forEach(([col, a, w], i) => {
    const y0 = 30 + i * 36 + rnd() * 10, ph = rnd() * 6.3, amp = 8 + rnd() * 14, fq = 0.004 + rnd() * 0.004;
    g.strokeStyle = `rgba(${col[0]},${col[1]},${col[2]},${a})`; g.lineWidth = w; g.lineCap = 'round'; g.beginPath();
    for (let x = -10; x <= 522; x += 8) { const y = y0 + Math.sin(ph + x * fq * 6.28) * amp + Math.sin(x * 0.02 + i) * 3; if (x === -10) g.moveTo(x, y); else g.lineTo(x, y); } g.stroke();
  });
  g.fillStyle = 'rgba(255,255,255,0.18)'; for (let i = 0; i < 40; i++) g.fillRect(rnd() * 512, rnd() * 256, 2, 2);
  return c;
}
const soft = (c0, c1, n = 64) => { const c = cvs(n, n), g = c.getContext('2d'), gr = g.createRadialGradient(n / 2, n / 2, 0, n / 2, n / 2, n / 2); gr.addColorStop(0, c0); gr.addColorStop(1, c1); g.fillStyle = gr; g.fillRect(0, 0, n, n); return c; };

// ---- board geometry, built once per board shape in hole-pitch units (shape y = -screen y, so that rotateX(-90deg) lands it on +z = screen down) -------
function outline(b, inset) {   // polygon of the board outline in unit pitch, shrunk by `inset` (same rounded shapes as art.js)
  const s = boardShape(b, 1), pts = [];
  if (s.round) { const R = s.R - inset; for (let i = 0; i < 96; i++) { const a = i / 96 * 6.2832; pts.push(new THREE.Vector2(Math.cos(a) * R, -Math.sin(a) * R)); } return pts; }
  const cx = s.pts.reduce((a, p) => a + p.x, 0) / 3, cy = s.pts.reduce((a, p) => a + p.y, 0) / 3;
  const q = s.pts.map((p) => { const d = Math.hypot(p.x - cx, p.y - cy); return { x: p.x - ((p.x - cx) / d) * inset * 1.9, y: p.y - ((p.y - cy) / d) * inset * 1.9 }; });
  const rad = s.R * 0.16;
  for (let i = 0; i < 3; i++) {
    const A = q[(i + 2) % 3], B = q[i], C = q[(i + 1) % 3], la = Math.hypot(A.x - B.x, A.y - B.y), lc = Math.hypot(C.x - B.x, C.y - B.y), t = rad * 1.73;
    const ta = Math.min(0.45, t / la), tc = Math.min(0.45, t / lc), P0 = { x: B.x + (A.x - B.x) * ta, y: B.y + (A.y - B.y) * ta }, P1 = { x: B.x + (C.x - B.x) * tc, y: B.y + (C.y - B.y) * tc };
    for (let k = 0; k <= 10; k++) { const u = k / 10, x = (1 - u) * (1 - u) * P0.x + 2 * u * (1 - u) * B.x + u * u * P1.x, y = (1 - u) * (1 - u) * P0.y + 2 * u * (1 - u) * B.y + u * u * P1.y; pts.push(new THREE.Vector2(x, -y)); }
  }
  return pts;
}
function extrude(shape, depth, bevel) {
  const g = new THREE.ExtrudeGeometry(shape, { depth, bevelEnabled: bevel > 0, bevelThickness: bevel, bevelSize: bevel, bevelSegments: 2, steps: 1, curveSegments: 10 });
  g.rotateX(-Math.PI / 2);
  const P = g.attributes.position, N = g.attributes.normal, UV = g.attributes.uv; g.computeBoundingBox(); const bb = g.boundingBox, S = Math.max(bb.max.x - bb.min.x, bb.max.z - bb.min.z);
  for (let i = 0; i < P.count; i++) if (Math.abs(N.getY(i)) > 0.9) UV.setXY(i, (P.getX(i) - bb.min.x) / S, 1 - (P.getZ(i) - bb.min.z) / S);
  return g;
}
function boardGeos(b) {
  const out = outline(b, 0), inner = outline(b, RW);
  const slab = new THREE.Shape(inner); for (const p of b.pos) { const h = new THREE.Path(); h.absarc(p.x, -p.y, 0.43, 0, Math.PI * 2, true); slab.holes.push(h); }
  const ring = new THREE.Shape(out); ring.holes.push(new THREE.Path(inner.slice().reverse()));
  const brass = new THREE.Shape(outline(b, RW + 0.06)); brass.holes.push(new THREE.Path(outline(b, RW + 0.15).reverse()));
  return { body: extrude(new THREE.Shape(out), HS - WD - 0.02, 0.02), slab: extrude(slab, WD, 0.03), ring: extrude(ring, HS + 0.07, 0.04), brass: extrude(brass, 0.03, 0.01), wells: b.pos.map((p) => [p.x, p.y]) };
}

export async function createPresenter({ kitCanvas }) {
  if (typeof OffscreenCanvas === 'undefined') return { ok: false };
  const qs = new URLSearchParams(location.search);
  const canvas = document.createElement('canvas');
  canvas.style.cssText = 'position:fixed;inset:0;width:100vw;height:100vh;height:100dvh;display:block;pointer-events:none;z-index:0;visibility:hidden';
  let renderer;
  try { renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false, powerPreference: 'high-performance' }); } catch (e) { console.warn('WebGL unavailable; flat 2D art', e); return { ok: false }; }
  if (!renderer.getContext()) return { ok: false };
  kitCanvas.parentElement.insertBefore(canvas, kitCanvas);
  kitCanvas.style.position = 'relative'; kitCanvas.style.zIndex = '1';
  renderer.outputColorSpace = THREE.SRGBColorSpace; renderer.toneMapping = THREE.NoToneMapping; renderer.setClearColor(0x0e3a44, 1);
  let tier = qs.has('tier') ? clamp(Number(qs.get('tier')), 0, 2) : (navigator.hardwareConcurrency || 8) <= 4 ? 1 : 0;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  await tick();

  const scene = new THREE.Scene();
  // an environment for the glass: bright windows and a warm sky over a teal floor (PMREM, built once)
  {
    const es = new THREE.Scene(), sky = cvs(8, 256), g = sky.getContext('2d'), gr = g.createLinearGradient(0, 0, 0, 256);
    gr.addColorStop(0, '#fff6dc'); gr.addColorStop(0.45, '#bcd9e0'); gr.addColorStop(0.5, '#3d7f88'); gr.addColorStop(1, '#10353c'); g.fillStyle = gr; g.fillRect(0, 0, 8, 256);
    es.add(new THREE.Mesh(new THREE.SphereGeometry(50, 32, 16), new THREE.MeshBasicMaterial({ map: tex(sky), side: THREE.BackSide })));
    const win = new THREE.Mesh(new THREE.PlaneGeometry(30, 20), new THREE.MeshBasicMaterial({ color: new THREE.Color(9, 9, 8.2), side: THREE.DoubleSide })); win.position.set(-26, 28, -22); win.lookAt(0, 0, 0); es.add(win);
    const win2 = new THREE.Mesh(new THREE.PlaneGeometry(16, 10), new THREE.MeshBasicMaterial({ color: new THREE.Color(5, 4.6, 4), side: THREE.DoubleSide })); win2.position.set(30, 22, 18); win2.lookAt(0, 0, 0); es.add(win2);
    const pm = new THREE.PMREMGenerator(renderer); scene.environment = pm.fromScene(es, 0.03).texture; pm.dispose();
  }
  scene.environmentIntensity = 0.9;
  const cam = new THREE.OrthographicCamera(-1, 1, 1, -1, 1, 9000);
  scene.add(new THREE.HemisphereLight(0xfff4de, 0x1a4650, 0.7));
  const key = new THREE.DirectionalLight(0xfff1d6, 2.1); key.shadow.bias = -0.0006; key.shadow.normalBias = 0.6; key.shadow.radius = 3; scene.add(key); scene.add(key.target);
  const applyShadowSize = () => { const s = TIERS[tier].shadow; renderer.shadowMap.enabled = s > 0; key.castShadow = s > 0; if (s > 0) { key.shadow.mapSize.set(s, s); key.shadow.map?.dispose(); key.shadow.map = null; } };
  applyShadowSize();

  const G = new THREE.Group(); G.scale.set(1, 1, 1 / SIN); scene.add(G);   // z is the 2D layer's y, stretched so the pitched ortho view maps it 1:1
  const k = TIERS[tier].tex;
  const tiles = tex(tileCanvas(k > 0.9 ? 1 : 0.5), [1, 1]);
  const table = new THREE.Mesh(new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2), new THREE.MeshStandardMaterial({ map: tiles, roughness: 0.32, metalness: 0.05, envMapIntensity: 0.55 })); table.receiveShadow = true; G.add(table);
  const flat = new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2);
  const vign = new THREE.Mesh(flat, new THREE.MeshBasicMaterial({ map: tex(soft('rgba(0,0,0,0)', 'rgba(2,12,16,0.78)', 128)), transparent: true, depthWrite: false, toneMapped: false })); vign.renderOrder = 5; G.add(vign);

  // ---- the board (unit pitch; the group is scaled by the hole pitch P and lifted so the playing surface sits at its 2D place)
  const B = new THREE.Group(); G.add(B); B.visible = false;
  let wood = '', geoKey = '';
  const mkMat = (o) => new THREE.MeshStandardMaterial({ roughness: 0.5, metalness: 0.02, envMapIntensity: 0.5, ...o });
  const slabMat = mkMat({ roughness: 0.42 }), ringMat = mkMat({ roughness: 0.38 }), wallMat = mkMat({ color: 0x3a2412, roughness: 0.7 }), floorMat = mkMat({ color: 0x2a190b, roughness: 0.8 }), sideMat = mkMat({ color: 0x4a2a14, roughness: 0.5 });
  const brassMat = mkMat({ color: 0xd7a94a, metalness: 0.9, roughness: 0.3, envMapIntensity: 1.3, emissive: 0x5a3a08, emissiveIntensity: 0.6 });
  const meshes = { body: new THREE.Mesh(undefined, [floorMat, sideMat]), slab: new THREE.Mesh(undefined, [slabMat, wallMat]), ring: new THREE.Mesh(undefined, [ringMat, sideMat]), brass: new THREE.Mesh(undefined, brassMat) };
  meshes.slab.position.y = HS - WD; meshes.brass.position.y = HS + 0.004;
  for (const m of Object.values(meshes)) { m.castShadow = true; m.receiveShadow = true; B.add(m); }
  const wells = new THREE.InstancedMesh(new THREE.CircleGeometry(0.43, 32).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ map: tex(soft('rgba(8,3,0,0.92)', 'rgba(8,3,0,0.0)')), transparent: true, depthWrite: false, toneMapped: false }), 48); wells.renderOrder = 2; wells.frustumCulled = false; B.add(wells);
  const _m = new THREE.Matrix4(), _p = new THREE.Vector3(), _s = new THREE.Vector3(1, 1, 1), _q = new THREE.Quaternion();
  function setBoard(b) {
    if (geoKey === b.id) return; geoKey = b.id; const gs = boardGeos(b);
    for (const n of ['body', 'slab', 'ring', 'brass']) { meshes[n].geometry?.dispose(); meshes[n].geometry = gs[n]; }
    gs.wells.forEach(([x, y], i) => wells.setMatrixAt(i, _m.compose(_p.set(x, HS - WD + 0.03, y), _q, _s))); wells.count = gs.wells.length; wells.instanceMatrix.needsUpdate = true;
  }
  function setWood(w) {
    if (w === wood) return; wood = w; const W = WOODS[w] ?? WOODS.maple;
    slabMat.map?.dispose(); ringMat.map?.dispose();
    slabMat.map = tex(woodCanvas(W, k > 0.9 ? 1 : 0.5, 5)); ringMat.map = tex(woodCanvas({ top: W.mid, mid: W.rim[0], dark: W.rim[1], grain: [30, 14, 6] }, k > 0.9 ? 1 : 0.5, 9));
    wallMat.color.set(W.well); sideMat.color.set(W.rim[0]); floorMat.color.set(W.well); slabMat.needsUpdate = ringMat.needsUpdate = true;
  }

  // ---- marbles
  const sphere = new THREE.SphereGeometry(RM, 40, 28), marbleMats = {};
  function marbleMat(set) {
    if (marbleMats[set]) return marbleMats[set]; const S = PEGS[set] ?? PEGS.sapphire;
    return (marbleMats[set] = new THREE.MeshPhysicalMaterial({ map: tex(marbleCanvas(S, k > 0.9 ? 1 : 0.5, !S.glass)), roughness: S.glass ? 0.07 : 0.4, metalness: 0, clearcoat: S.glass ? 1 : 0.3, clearcoatRoughness: 0.04, envMapIntensity: S.glass ? 1.7 : 0.7 }));
  }
  const pool = [];
  const take = (n) => { let o = pool[n]; if (!o) { o = new THREE.Group(); const m = new THREE.Mesh(sphere, null); m.castShadow = true; m.receiveShadow = true; m.rotation.set(rnd() * 6.28, rnd() * 6.28, Math.PI / 2 + (rnd() - 0.5) * 0.5, 'YXZ'); o.add(m); o.userData.m = m; B.add(o); pool[n] = o; } return o; };

  // ---------------------------------------------------------------- per frame
  let lost = false, lastNow = 0, fadeIn = 0, shown = false, frameAvg = 16, slowFrames = 0, sizeKey = '';
  const cssW = () => Math.max(1, window.innerWidth), cssH = () => Math.max(1, window.innerHeight);
  const cpu = () => meta.cssPerUnit || Math.min(cssW(), cssH()) / 720;
  function applyTier() { renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, TIERS[tier].dpr)); applyShadowSize(); sizeKey = ''; }
  applyTier();
  function render() {
    const P = v3.pose, W = cssW(), Hh = cssH(), c = cpu();
    const offX = (W - meta.width * c) / 2, offY = (Hh - meta.height * c) / 2, x0 = -offX / c, x1 = (W - offX) / c, y0 = -offY / c, y1 = (Hh - offY) / c, cx = (x0 + x1) / 2, yc = (y0 + y1) / 2;
    const sk = `${W}x${Hh}|${c.toFixed(4)}|${tier}`; if (sk !== sizeKey) { sizeKey = sk; renderer.setSize(W, Hh, false); }
    cam.left = -(x1 - x0) / 2; cam.right = (x1 - x0) / 2; cam.top = (y1 - y0) / 2; cam.bottom = -(y1 - y0) / 2; cam.updateProjectionMatrix();
    const tz = yc / SIN; cam.position.set(cx, SIN * 3000, tz + COS * 3000); cam.up.set(0, 1, 0); cam.lookAt(cx, 0, tz); cam.updateMatrixWorld(true);
    const tw = x1 - x0 + 200, th = (y1 - y0) / SIN + 200;
    table.position.set(cx, 0, tz); table.scale.set(tw, 1, th); tiles.repeat.set(tw / 380, th / 380);
    vign.position.set(cx, 0.4, tz); vign.scale.set(tw, 1, th);
    const fx = P ? P.cx : cx, fz = (P ? P.cy : yc) / SIN;
    key.position.set(fx - 700, 1300, fz - 900); key.target.position.set(fx, 0, fz); key.target.updateMatrixWorld();
    const sc = key.shadow.camera, ext = (P ? boardShape(P.b, P.P).R * P.P * 1.15 : 420) / SIN * 1.3; sc.left = -ext; sc.right = ext; sc.top = ext; sc.bottom = -ext; sc.near = 100; sc.far = 3500; sc.updateProjectionMatrix();
    if (!P) { B.visible = false; for (const o of pool) if (o) o.visible = false; renderer.render(scene, cam); return; }
    setBoard(P.b); setWood(P.wood); B.visible = true;
    const f = P.P;
    // 2D (cx, cy) is where the surface centre must land: the board sits in G with z = cy and is lifted by the surface height so heights do not shift taps
    B.scale.set(f, f, f); B.position.set(P.cx, 0, P.cy + HS * f * COS);
    const mat = marbleMat(P.set); let n = 0;
    for (const a of v3.pegs) {
      if (a.alpha < 0.06 || n >= CAP) continue;
      const o = take(n++), al = a.alpha, sq = 1 - Math.min(0.12, (a.sq || 0) * 0.02), s2 = a.s * (0.55 + 0.45 * al);
      o.userData.m.material = mat; o.visible = true; o.position.set((a.x - P.cx) / f, HS + a.lift * 0.5 - (1 - al) * 0.1, (a.y - P.cy) / f); o.scale.set(s2, s2 * sq, s2 * SIN);   // z scale cancels the group's stretch: a true sphere
    }
    for (let i = n; i < pool.length; i++) if (pool[i]) pool[i].visible = false;
    renderer.render(scene, cam);
  }
  function post() {
    if (lost) return;
    const now = performance.now(), dt = clamp((now - (lastNow || now)) / 1000, 0, 0.1); lastNow = now;
    if (!shown) { shown = true; canvas.style.visibility = 'visible'; }
    if (fadeIn < 1) { fadeIn = Math.min(1, fadeIn + dt / 0.25); canvas.style.opacity = String(fadeIn); }
    render();
    const ft = dt * 1000; if (ft > 0) frameAvg = frameAvg * 0.95 + ft * 0.05;
    if (frameAvg > 26 && tier < 2) { if (++slowFrames > 90) { tier++; slowFrames = 0; frameAvg = 16; applyTier(); } } else slowFrames = 0;
  }

  canvas.addEventListener('webglcontextlost', (e) => { e.preventDefault(); lost = true; v3.on = false; shown = false; canvas.style.visibility = 'hidden'; });
  canvas.addEventListener('webglcontextrestored', () => { lost = false; fadeIn = 0; canvas.style.opacity = '0'; sizeKey = ''; wood = ''; geoKey = ''; for (const m of Object.values(marbleMats)) m.needsUpdate = true; for (const m of [slabMat, ringMat, wallMat, floorMat, sideMat, brassMat, table.material]) m.needsUpdate = true; applyTier(); v3.on = true; });

  await tick();
  return { ok: true, renderer, scene, camera: cam, attach() { v3.on = true; fadeIn = 0; canvas.style.opacity = '0'; }, pre() {}, post, get tier() { return TIERS[tier].name; } };
}
