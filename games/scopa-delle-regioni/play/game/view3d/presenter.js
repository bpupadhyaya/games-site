// Scopa 3D presenter. READS what the 2D layer handed over this frame (src/v3.js: the cloth rectangle and every card, in the 2D layer's virtual
// units) and never writes game state. One WebGL canvas sits behind the kit's transparent 2D canvas (HUD, buttons, text, rings stay 2D and keep
// all input). The scene is a candle-lit trattoria table: walnut planks, a gingham cloth slab with a stitched hem, and lacquered card slabs
// that stack, cast soft contact shadows and lift when selected or in flight.
// Taps stay exact: the camera is orthographic and pitched, and the table plane is stretched by 1/sin(pitch) so that a point at (x, y) in the
// 2D layer lands on screen at exactly (x, y); a card at height h is shifted by h*cos(pitch) so its centre stays put as well.
// No WebGL, ?flat=1 or a lost context: v3.on = false and every screen draws the flat 2D art; a restored context rebuilds the scene.
import * as THREE from '../vendor3d/three.js';
import { v3 } from '../src/v3.js';
import { meta } from '../src/game.js';
import { cardImage, CW, CH } from '../src/art.js';

const D2R = Math.PI / 180;
const PITCH = 50 * D2R, SIN = Math.sin(PITCH), COS = Math.cos(PITCH);
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const TIERS = [{ name: 'high', dpr: 2, tex: 1 }, { name: 'medium', dpr: 1.5, tex: 1 }, { name: 'low', dpr: 1, tex: 0.5 }];
const tick = () => new Promise((r) => setTimeout(r, 0));
const RATIO = CH / CW, THK = 0.034, BT = 0.006, CT = 8;   // card height/width, slab thickness (x width), cloth thickness (units)
const CAP = 72;

const cvs = (w, h) => { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; };
function tex(c, rep, srgb = true) { const t = new THREE.CanvasTexture(c); if (srgb) t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8; if (rep) { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(rep[0], rep[1]); } return t; }
let rs = 1; const rnd = () => ((rs = (Math.imul(rs, 1664525) + 1013904223) >>> 0) / 4294967296);

// ------------------------------------------------------------------------------------------------ textures
function woodCanvas(k) {
  rs = 41; const W = 512 * k, H = 1024 * k, c = cvs(W, H), g = c.getContext('2d'); g.scale(k, k);
  const cols = [['#7d4725', '#6a3a1c'], ['#6f3f20', '#5b3018']];
  for (let p = 0; p < 2; p++) {
    const x0 = p * 256, gr = g.createLinearGradient(0, 0, 0, 1024); gr.addColorStop(0, cols[p][0]); gr.addColorStop(0.5, cols[p][1]); gr.addColorStop(1, cols[p][0]);
    g.fillStyle = gr; g.fillRect(x0, 0, 256, 1024);
    for (let i = 0; i < 150; i++) { const x = x0 + 4 + rnd() * 248, y = rnd() * 1024, l = 120 + rnd() * 500, a = 0.05 + rnd() * 0.13; g.strokeStyle = rnd() < 0.55 ? `rgba(28,10,2,${a})` : `rgba(255,196,140,${a * 0.7})`; g.lineWidth = 0.6 + rnd() * 2.2; g.beginPath(); g.moveTo(x, y); g.bezierCurveTo(x + 3 * (rnd() - 0.5), y + l * 0.3, x + 4 * (rnd() - 0.5), y + l * 0.6, x + 2 * (rnd() - 0.5), y + l); g.stroke(); }
    const kx = x0 + 60 + rnd() * 136, ky = 100 + rnd() * 800;
    for (let r = 26; r > 3; r -= 5) { g.strokeStyle = `rgba(30,10,2,${0.1 + (26 - r) * 0.012})`; g.lineWidth = 2; g.beginPath(); g.ellipse(kx, ky, r * 0.55, r * 1.3, 0, 0, Math.PI * 2); g.stroke(); }
    g.fillStyle = 'rgba(0,0,0,0.5)'; g.fillRect(x0 + 252, 0, 4, 1024); g.fillStyle = 'rgba(255,214,160,0.16)'; g.fillRect(x0, 0, 3, 1024);
  }
  return c;
}
function ginghamCanvas(k) {
  rs = 7; const N = 256 * k, h = N / 2, c = cvs(N, N), g = c.getContext('2d');
  g.fillStyle = '#f4e8cc'; g.fillRect(0, 0, N, N);
  g.fillStyle = 'rgba(184,30,40,0.64)'; g.fillRect(0, 0, h, N); g.fillRect(0, 0, N, h);
  const th = 3 * k;   // woven threads
  for (let y = 0; y < N; y += th) { g.fillStyle = (y / th) % 2 ? 'rgba(255,248,230,0.10)' : 'rgba(40,6,6,0.10)'; g.fillRect(0, y, N, th / 2); }
  for (let x = 0; x < N; x += th) { g.fillStyle = (x / th) % 2 ? 'rgba(255,248,230,0.08)' : 'rgba(40,6,6,0.09)'; g.fillRect(x, 0, th / 2, N); }
  for (let i = 0; i < N * 6; i++) { g.fillStyle = rnd() < 0.5 ? 'rgba(0,0,0,0.05)' : 'rgba(255,255,255,0.06)'; g.fillRect(rnd() * N, rnd() * N, 1.5 * k, 1.5 * k); }
  return c;
}
function hemCanvas(w, h, k) {
  const c = cvs(Math.max(8, Math.round(w * k)), Math.max(8, Math.round(h * k))), g = c.getContext('2d'); g.scale(k, k);
  g.strokeStyle = 'rgba(122,20,28,0.92)'; g.lineWidth = 3.5; g.beginPath(); g.roundRect(12, 12, w - 24, h - 24, 16); g.stroke();
  g.strokeStyle = 'rgba(255,240,210,0.78)'; g.lineWidth = 1.5; g.beginPath(); g.roundRect(18, 18, w - 36, h - 36, 12); g.stroke();
  g.setLineDash([5, 4]); g.strokeStyle = 'rgba(122,20,28,0.5)'; g.lineWidth = 1.1; g.beginPath(); g.roundRect(24, 24, w - 48, h - 48, 9); g.stroke();
  return c;
}
function softCanvas() {   // a soft rounded-rect shadow: concentric translucent rounded rects (no ctx.filter: Safari lacks it)
  const c = cvs(128, 160), g = c.getContext('2d');
  for (let i = 0; i < 22; i++) { const m = 6 + i * 2.6; g.fillStyle = 'rgba(8,2,0,0.07)'; g.beginPath(); g.roundRect(m, m * 1.25, 128 - 2 * m, 160 - 2.5 * m, Math.max(2, 22 - i)); g.fill(); }
  return c;
}
function roundedShape(w, h, r) {
  const s = new THREE.Shape(), x = -w / 2, y = -h / 2;
  s.moveTo(x + r, y); s.lineTo(x + w - r, y); s.quadraticCurveTo(x + w, y, x + w, y + r); s.lineTo(x + w, y + h - r); s.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  s.lineTo(x + r, y + h); s.quadraticCurveTo(x, y + h, x, y + h - r); s.lineTo(x, y + r); s.quadraticCurveTo(x, y, x + r, y); return s;
}
// A card: a rounded slab of unit width lying on the table (+y up), face texture on the top, cream paper edge with a bevel.
function makeCardGeo() {
  const w = 1, h = RATIO, x = w - 2 * BT, y = h - 2 * BT, dep = THK - 2 * BT;
  const g = new THREE.ExtrudeGeometry(roundedShape(x, y, 0.075), { depth: dep, bevelEnabled: true, bevelThickness: BT, bevelSize: BT, bevelSegments: 2, steps: 1, curveSegments: 6 });
  g.translate(0, 0, -dep / 2); g.rotateX(-Math.PI / 2);
  const P = g.attributes.position, N = g.attributes.normal, UV = g.attributes.uv;
  for (let i = 0; i < P.count; i++) if (Math.abs(N.getY(i)) > 0.9) UV.setXY(i, P.getX(i) / x + 0.5, 0.5 - P.getZ(i) / y);
  return g;
}
function makeClothGeo(w, h) {
  const g = new THREE.ExtrudeGeometry(roundedShape(w - 8, h - 8, 22), { depth: CT - 4, bevelEnabled: true, bevelThickness: 2, bevelSize: 4, bevelSegments: 3, steps: 1, curveSegments: 8 });
  g.translate(0, 0, -(CT - 4) / 2); g.rotateX(-Math.PI / 2); g.translate(0, (CT - 4) / 2 + 2, 0);
  return g;
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
  renderer.outputColorSpace = THREE.SRGBColorSpace; renderer.toneMapping = THREE.NoToneMapping; renderer.setClearColor(0x1a0a12, 1);
  let tier = qs.has('tier') ? clamp(Number(qs.get('tier')), 0, 2) : (navigator.hardwareConcurrency || 8) <= 4 ? 1 : 0;
  await tick();

  const scene = new THREE.Scene();
  const cam = new THREE.OrthographicCamera(-1, 1, 1, -1, 1, 9000);
  scene.add(new THREE.HemisphereLight(0xfff0d6, 0x3a2012, 0.75));
  const key = new THREE.DirectionalLight(0xffe0b4, 1.5); scene.add(key); scene.add(key.target);
  const lamp = new THREE.PointLight(0xffa860, 1, 0, 2); scene.add(lamp);

  // everything on the table lives in G: z is the 2D layer's y, stretched by 1/sin(pitch) so the pitched ortho view maps it 1:1 to the screen
  const G = new THREE.Group(); G.scale.set(1, 1, 1 / SIN); scene.add(G);
  const k = TIERS[tier].tex;
  const woodT = tex(woodCanvas(k > 0.9 ? 1 : 0.5), [1, 1]);
  const woodMat = new THREE.MeshStandardMaterial({ map: woodT, bumpMap: woodT, bumpScale: 1.4, roughness: 0.58, metalness: 0.02 });
  const wood = new THREE.Mesh(new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2), woodMat); G.add(wood);
  const ginT = tex(ginghamCanvas(k > 0.9 ? 1 : 0.5), [1 / 76, 1 / 76]);
  const clothMat = new THREE.MeshStandardMaterial({ map: ginT, bumpMap: ginT, bumpScale: 1.1, roughness: 0.95, metalness: 0 });
  const clothEdge = new THREE.MeshStandardMaterial({ color: 0xe7dcc0, roughness: 0.95 });
  const cloth = new THREE.Mesh(new THREE.BufferGeometry(), [clothMat, clothEdge]); G.add(cloth);
  const hem = new THREE.Mesh(new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ transparent: true, depthWrite: false, toneMapped: false })); hem.renderOrder = 2; G.add(hem);
  const soft = tex(softCanvas());
  const blobMat = new THREE.MeshBasicMaterial({ map: soft, transparent: true, depthWrite: false, opacity: 0.62, toneMapped: false });
  const flat = new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2);
  const clothShadow = new THREE.Mesh(flat, blobMat.clone()); clothShadow.material.opacity = 0.8; clothShadow.renderOrder = 1; G.add(clothShadow);
  const blobs = new THREE.InstancedMesh(flat, blobMat, CAP); blobs.frustumCulled = false; blobs.count = 0; blobs.renderOrder = 3; G.add(blobs);

  const geo = makeCardGeo();
  const sideMat = new THREE.MeshStandardMaterial({ color: 0xe9dcb6, roughness: 0.6, metalness: 0 });
  const faceMats = new Map();
  // emissive on the face keeps the printed art as bright and legible as the flat deck
  const matFor = (id, french) => {
    const kk = id < 0 ? 'b' : (french ? 'f' : 'i') + id; let m = faceMats.get(kk);
    if (!m) { const img = cardImage(id, french); const t = img ? tex(img) : null; m = new THREE.MeshStandardMaterial({ map: t, emissive: 0xffffff, emissiveMap: t, emissiveIntensity: 0.5, color: img ? 0xffffff : 0xf6e8c4, roughness: 0.36, metalness: 0 }); faceMats.set(kk, m); }
    return m;
  };
  const pool = [];
  const meshAt = (i) => { let m = pool[i]; if (!m) { m = new THREE.Mesh(geo, [matFor(-1), sideMat]); m.userData.key = 'b'; G.add(m); pool[i] = m; } return m; };

  let clothKey = '';
  function setCloth(c) {
    const kk = `${Math.round(c.x)},${Math.round(c.y)},${Math.round(c.w)},${Math.round(c.h)}`; if (kk === clothKey) return; clothKey = kk;
    cloth.geometry.dispose(); cloth.geometry = makeClothGeo(c.w, c.h);
    cloth.position.set(c.x + c.w / 2, 0, c.y + c.h / 2);
    hem.material.map?.dispose(); hem.material.map = tex(hemCanvas(c.w, c.h, 1)); hem.material.needsUpdate = true;
    hem.scale.set(c.w, 1, c.h); hem.position.set(c.x + c.w / 2, CT + 0.25, c.y + c.h / 2);
    clothShadow.scale.set(c.w + 70, 1, c.h + 70); clothShadow.position.set(c.x + c.w / 2 + 8, 0.35, c.y + c.h / 2 + 18);
  }

  // ---------------------------------------------------------------- per frame
  const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _p = new THREE.Vector3(), _s = new THREE.Vector3(), Y = new THREE.Vector3(0, 1, 0);
  let lost = false, lastNow = 0, clock = 0, fadeIn = 0, shown = false, frameAvg = 16, slowFrames = 0, sizeKey = '';
  const cssW = () => Math.max(1, window.innerWidth), cssH = () => Math.max(1, window.innerHeight);
  const cpu = () => meta.cssPerUnit || Math.min(cssW(), cssH()) / 720;
  function applyTier() { renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, TIERS[tier].dpr)); sizeKey = ''; }
  applyTier();
  const hold = [];   // per card: resting height and stack info of this frame
  function layout(list) {
    hold.length = 0;
    const c = v3.cloth;
    for (let i = 0; i < list.length; i++) {
      const a = list[i], cs = Math.abs(Math.cos(a.rot)), sn = Math.abs(Math.sin(a.rot)), hw = (cs * a.w + sn * a.w * RATIO) / 2 * 0.92, hh = (sn * a.w + cs * a.w * RATIO) / 2 * 0.92, t = THK * a.w;
      let rest = 0;
      if (c) { const d = Math.min(a.x - c.x, c.x + c.w - a.x, a.y - c.y, c.y + c.h - a.y); rest = CT * clamp((d + 24) / 48, 0, 1); }
      for (let j = 0; j < i; j++) { const b = hold[j]; if (Math.abs(a.x - b.x) < hw + b.hw && Math.abs(a.y - b.y) < hh + b.hh) rest = Math.max(rest, b.top + 0.4); }
      hold.push({ x: a.x, y: a.y, hw, hh, rest, top: rest + t });
    }
  }
  function render() {
    const list = v3.cards, W = cssW(), Hh = cssH(), c = cpu();
    const offX = (W - meta.width * c) / 2, offY = (Hh - meta.height * c) / 2, x0 = -offX / c, x1 = (W - offX) / c, y0 = -offY / c, y1 = (Hh - offY) / c, cx = (x0 + x1) / 2, yc = (y0 + y1) / 2;
    const sk = `${W}x${Hh}|${c.toFixed(4)}|${tier}`; if (sk !== sizeKey) { sizeKey = sk; renderer.setSize(W, Hh, false); }
    cam.left = -(x1 - x0) / 2; cam.right = (x1 - x0) / 2; cam.top = (y1 - y0) / 2; cam.bottom = -(y1 - y0) / 2; cam.updateProjectionMatrix();
    const tz = yc / SIN; cam.position.set(cx, SIN * 3000, tz + COS * 3000); cam.up.set(0, 1, 0); cam.lookAt(cx, 0, tz); cam.updateMatrixWorld(true);
    key.position.set(cx - 420, 900, tz + 520); key.target.position.set(cx, 0, tz); key.target.updateMatrixWorld();
    const fl = 1 + 0.035 * Math.sin(clock * 7.1) + 0.025 * Math.sin(clock * 12.7 + 1.3);
    lamp.position.set(cx, 520, tz - 60); lamp.intensity = 0.8e6 * fl;
    const sky = v3.sky, wt = sky - 20, wb = y1 + 200;
    wood.position.set(cx, 0, (wt + wb) / 2); wood.scale.set(x1 - x0 + 200, 1, wb - wt);
    woodT.repeat.set((x1 - x0 + 200) / 260, (wb - wt) / 520);
    const hasCloth = !!v3.cloth; cloth.visible = hem.visible = clothShadow.visible = hasCloth; if (hasCloth) setCloth(v3.cloth);
    layout(list);
    const n = Math.min(list.length, CAP); let nb = 0;
    for (let i = 0; i < n; i++) {
      const a = list[i], h = hold[i], m = meshAt(i), lift = a.lift ? 22 : 0;
      const kk = a.id < 0 ? 'b' : (a.french ? 'f' : 'i') + a.id;
      if (m.userData.key !== kk) { m.userData.key = kk; m.material = [matFor(a.id, a.french), sideMat]; }
      const hy = h.rest + THK * a.w / 2 + lift;
      m.visible = true; m.position.set(a.x, hy, a.y + hy * COS); m.rotation.set(0, -a.rot, 0); m.scale.set(a.w, a.w, a.w);
      _q.setFromAxisAngle(Y, -a.rot); const sp = 0.06 * a.w + lift * 0.45, spy = 0.085 * a.w + lift * 0.8, by = h.rest - 0.15;
      _p.set(a.x + sp, by, a.y + spy + by * COS); const sc = 1.12 + lift * 0.004; _s.set(a.w * sc, 1, a.w * RATIO * sc); blobs.setMatrixAt(nb++, _m.compose(_p, _q, _s));
    }
    for (let i = n; i < pool.length; i++) if (pool[i]) pool[i].visible = false;
    blobs.count = nb; blobs.instanceMatrix.needsUpdate = true;
    renderer.render(scene, cam);
  }
  function post() {
    if (lost) return;
    const now = performance.now(), dt = clamp((now - (lastNow || now)) / 1000, 0, 0.1); lastNow = now; clock += dt;
    if (!v3.active) { if (shown) { shown = false; canvas.style.visibility = 'hidden'; } return; }
    if (!shown) { shown = true; canvas.style.visibility = 'visible'; }
    if (fadeIn < 1) { fadeIn = Math.min(1, fadeIn + dt / 0.25); canvas.style.opacity = String(fadeIn); }
    render();
    const ft = dt * 1000; if (ft > 0) frameAvg = frameAvg * 0.95 + ft * 0.05;
    if (frameAvg > 26 && tier < 2) { if (++slowFrames > 90) { tier++; slowFrames = 0; frameAvg = 16; applyTier(); } } else slowFrames = 0;
  }

  canvas.addEventListener('webglcontextlost', (e) => { e.preventDefault(); lost = true; v3.on = false; shown = false; canvas.style.visibility = 'hidden'; });
  canvas.addEventListener('webglcontextrestored', () => { lost = false; fadeIn = 0; canvas.style.opacity = '0'; sizeKey = ''; applyTier(); v3.on = true; });

  await tick();
  return {
    ok: true, renderer, scene, camera: cam,
    attach() { v3.on = true; fadeIn = 0; canvas.style.opacity = '0'; },
    pre() {}, post,
    get tier() { return TIERS[tier].name; },
  };
}
