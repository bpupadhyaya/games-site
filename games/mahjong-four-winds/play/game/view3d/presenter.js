// Mahjong 3D presenter. READS the game state (game.getState()) and the tiles the 2D layer handed over this frame (src/v3.js), never
// writes game state. One WebGL canvas sits behind the kit's transparent 2D canvas: a midnight-blue velvet mat in a brass-edged rosewood
// table lit by two paper lanterns, with real tile geometry (bevelled slabs, ivory faces, bamboo backs). The tiles on the table (walls,
// discards, opponents' hands, melds) live on the table plane under a tilted perspective camera; YOUR hand is a second pass with an
// orthographic camera in the 2D layer's own units (so taps land exactly where the tiles are) standing in a rosewood rack.
// No WebGL, ?flat=1 or a lost context: v3.on = false and every screen draws the flat 2D art; a restored context rebuilds the scene.
import * as THREE from '../vendor3d/three.js';
import { v3 } from '../src/v3.js';
import { meta } from '../src/game.js';
import { GEO, HAND_Y, HANDZONE_Y, riverPos, oppHandPos, wallPos, flowerPos, meldOrigin } from '../src/layout.js';
import { tileSprite, FW, FH, PAD, getLang } from '../src/tiles.js';

const D2R = Math.PI / 180;
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const TIERS = [{ name: 'high', dpr: 2, tex: 1024 }, { name: 'medium', dpr: 1.5, tex: 512 }, { name: 'low', dpr: 1, tex: 512 }];
const tick = () => new Promise((r) => setTimeout(r, 0));
const TH = 0.56;                // tile thickness as a multiple of its face width
const IVORY = '#f3e8cb', BAMBOO = '#c98f34';

// ------------------------------------------------------------------------------------------------ tile geometry (unit face width)
function makeTileGeo() {
  const w = 1, h = 4 / 3, bt = 0.05, r = 0.13, dep = TH - 2 * bt, x = w / 2 - bt, y = h / 2 - bt;
  const sh = new THREE.Shape();
  sh.moveTo(-x + r, -y); sh.lineTo(x - r, -y); sh.quadraticCurveTo(x, -y, x, -y + r); sh.lineTo(x, y - r); sh.quadraticCurveTo(x, y, x - r, y);
  sh.lineTo(-x + r, y); sh.quadraticCurveTo(-x, y, -x, y - r); sh.lineTo(-x, -y + r); sh.quadraticCurveTo(-x, -y, -x + r, -y);
  const g = new THREE.ExtrudeGeometry(sh, { depth: dep, bevelEnabled: true, bevelThickness: bt, bevelSize: bt, bevelSegments: 2, steps: 8, curveSegments: 5 });
  g.translate(0, 0, -dep / 2);
  const P = g.attributes.position, N = g.attributes.normal, tri = P.count / 3, cls = [[], [], []];
  for (let t = 0; t < tri; t++) { const nz = N.getZ(t * 3); cls[nz > 0.9 ? 0 : nz < -0.9 ? 1 : 2].push(t); }
  const order = [...cls[0], ...cls[1], ...cls[2]], pos = new Float32Array(P.count * 3), nor = new Float32Array(P.count * 3), uv = new Float32Array(P.count * 2), col = new Float32Array(P.count * 3);
  const ivory = new THREE.Color(IVORY), bamboo = new THREE.Color(BAMBOO), c = new THREE.Color();
  order.forEach((t, j) => {
    for (let v = 0; v < 3; v++) {
      const si = t * 3 + v, di = j * 3 + v, px = P.getX(si), py = P.getY(si), pz = P.getZ(si), nz = N.getZ(si);
      pos[di * 3] = px; pos[di * 3 + 1] = py; pos[di * 3 + 2] = pz; nor[di * 3] = N.getX(si); nor[di * 3 + 1] = N.getY(si); nor[di * 3 + 2] = nz;
      uv[di * 2] = nz < -0.9 ? 0.5 - px / w : px / w + 0.5; uv[di * 2 + 1] = py / h + 0.5;
      const k = (pz + TH / 2) / TH; if (k > 0.74) c.copy(ivory); else if (k > 0.66) c.copy(bamboo).lerp(ivory, (k - 0.66) / 0.08); else c.copy(bamboo);
      col[di * 3] = c.r; col[di * 3 + 1] = c.g; col[di * 3 + 2] = c.b;
    }
  });
  const out = new THREE.BufferGeometry();
  out.setAttribute('position', new THREE.BufferAttribute(pos, 3)); out.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
  out.setAttribute('uv', new THREE.BufferAttribute(uv, 2)); out.setAttribute('color', new THREE.BufferAttribute(col, 3));
  out.addGroup(0, cls[0].length * 3, 0); out.addGroup(cls[0].length * 3, cls[1].length * 3, 1); out.addGroup((cls[0].length + cls[1].length) * 3, cls[2].length * 3, 2);
  return out;
}

// ------------------------------------------------------------------------------------------------ textures
const cvs = (w, h) => { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; };
function tex(c, rep) { const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8; if (rep) { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(rep[0], rep[1]); } return t; }
function faceCanvas(kind, style) {
  const ss = 3, c = cvs(FW * 3, FH * 3), g = c.getContext('2d'), spr = tileSprite(kind, style, ss);
  g.fillStyle = IVORY; g.fillRect(0, 0, c.width, c.height);
  if (spr) g.drawImage(spr, PAD * ss, PAD * ss, FW * ss, FH * ss, 0, 0, c.width, c.height);
  return c;
}
function bambooCanvas() {
  const c = cvs(180, 240), g = c.getContext('2d');
  const gr = g.createLinearGradient(0, 0, 180, 240); gr.addColorStop(0, '#e9b95c'); gr.addColorStop(1, '#bd8228'); g.fillStyle = gr; g.fillRect(0, 0, 180, 240);
  let s = 7; const rnd = () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296);
  for (let i = 0; i < 240; i++) { g.strokeStyle = rnd() < 0.5 ? `rgba(120,70,10,${0.05 + rnd() * 0.12})` : `rgba(255,230,160,${0.05 + rnd() * 0.12})`; g.lineWidth = 0.6 + rnd() * 1.4; const x = rnd() * 180; g.beginPath(); g.moveTo(x, 0); g.lineTo(x + (rnd() - 0.5) * 8, 240); g.stroke(); }
  g.strokeStyle = 'rgba(110,60,8,0.55)'; g.lineWidth = 3; g.beginPath(); g.roundRect(14, 14, 152, 212, 14); g.stroke();
  g.strokeStyle = 'rgba(255,236,180,0.5)'; g.lineWidth = 1.5; g.beginPath(); g.roundRect(18, 18, 144, 204, 11); g.stroke();
  g.strokeStyle = 'rgba(110,60,8,0.28)'; g.lineWidth = 2; g.beginPath(); g.moveTo(34, 120); g.lineTo(146, 120); g.stroke(); // a node line across the bamboo
  return c;
}
function rosewoodCanvas(n) {
  const c = cvs(n, n), g = c.getContext('2d'); g.fillStyle = '#4a1b13'; g.fillRect(0, 0, n, n);
  let s = 99; const rnd = () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296);
  for (let i = 0; i < n / 2; i++) { const y = rnd() * n, a = 0.05 + rnd() * 0.22; g.strokeStyle = rnd() < 0.6 ? `rgba(20,6,2,${a})` : `rgba(150,70,40,${a * 0.6})`; g.lineWidth = 0.6 + rnd() * 2.6; g.beginPath(); g.moveTo(0, y); g.bezierCurveTo(n * 0.3, y + rnd() * 10 - 5, n * 0.7, y + rnd() * 10 - 5, n, y + rnd() * 6 - 3); g.stroke(); }
  return c;
}
function velvetCanvas(n) {
  const c = cvs(n, n), g = c.getContext('2d');
  const gr = g.createRadialGradient(n / 2, n / 2, n * 0.05, n / 2, n / 2, n * 0.72); gr.addColorStop(0, '#26468a'); gr.addColorStop(0.6, '#182f60'); gr.addColorStop(1, '#0c1a3a'); g.fillStyle = gr; g.fillRect(0, 0, n, n);
  let s = 5; const rnd = () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296);
  for (let i = 0; i < n * 14; i++) { const a = rnd() * 0.07; g.fillStyle = rnd() < 0.5 ? `rgba(180,200,255,${a})` : `rgba(0,0,20,${a * 1.5})`; g.fillRect(rnd() * n, rnd() * n, 1.6, 1.6); }
  return c;
}
const radialC = (rgb, a) => { const c = cvs(64, 64), g = c.getContext('2d'), gr = g.createRadialGradient(32, 32, 0, 32, 32, 32); gr.addColorStop(0, `rgba(${rgb},${a})`); gr.addColorStop(1, `rgba(${rgb},0)`); g.fillStyle = gr; g.fillRect(0, 0, 64, 64); return c; };

// ------------------------------------------------------------------------------------------------ a set of tile instances (one InstancedMesh per kind)
class TileSet {
  constructor(scene, geo, mats, cap) { this.scene = scene; this.geo = geo; this.mats = mats; this.cap = cap; this.e = new Map(); }
  entry(kind) {
    let e = this.e.get(kind);
    if (!e) {
      const m = new THREE.InstancedMesh(this.geo, this.mats.get(kind), kind < 0 ? this.cap.back : this.cap.kind); m.frustumCulled = false; m.count = 0;
      this.scene.add(m); e = { m, n: 0 }; this.e.set(kind, e);
    }
    return e;
  }
  begin() { for (const e of this.e.values()) e.n = 0; }
  put(kind, mat) { const e = this.entry(kind); if (e.n < e.m.instanceMatrix.count) e.m.setMatrixAt(e.n++, mat); }
  end() { for (const e of this.e.values()) { e.m.count = e.n; e.m.instanceMatrix.needsUpdate = true; } }
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
  renderer.outputColorSpace = THREE.SRGBColorSpace; renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.0; renderer.autoClear = false;
  let tier = qs.has('tier') ? clamp(Number(qs.get('tier')), 0, 2) : (navigator.hardwareConcurrency || 8) <= 4 ? 1 : 0;
  await tick();

  const scene = new THREE.Scene(); scene.background = new THREE.Color(0x0a0604);
  const camera = new THREE.PerspectiveCamera(28, 1, 5, 8000);
  const buildEnv = () => { try { const pm = new THREE.PMREMGenerator(renderer); scene.environment = pm.fromScene(new THREE.RoomEnvironment(), 0.04).texture; pm.dispose(); scene.environmentIntensity = 0.55; } catch { /* no IBL */ } };
  buildEnv();

  // ---- lights: a warm key, a cool fill and two paper lanterns
  scene.add(new THREE.HemisphereLight(0xffe9c8, 0x1a0d08, 0.7));
  const key = new THREE.DirectionalLight(0xffdca8, 2.1); key.position.set(-380, 900, 520); scene.add(key);
  const fill = new THREE.DirectionalLight(0x9db4ff, 0.55); fill.position.set(500, 500, -300); scene.add(fill);
  const lanterns = [];
  for (const sx of [-1, 1]) {
    const grp = new THREE.Group();
    const body = new THREE.Mesh(new THREE.SphereGeometry(30, 20, 14), new THREE.MeshStandardMaterial({ color: 0xff7a2a, emissive: 0xff6a1a, emissiveIntensity: 1.6, roughness: 0.9 }));
    body.scale.set(1, 1.2, 1); grp.add(body);
    for (const yy of [-38, 38]) { const cap = new THREE.Mesh(new THREE.CylinderGeometry(15, 15, 6, 16), new THREE.MeshStandardMaterial({ color: 0x2a1408, roughness: 0.6 })); cap.position.y = yy; grp.add(cap); }
    const pl = new THREE.PointLight(0xff9a4a, 130000, 0, 2); grp.add(pl); grp.userData.light = pl; grp.userData.sx = sx;
    scene.add(grp); lanterns.push(grp);
  }

  // ---- table: rosewood top, big velvet mat with a brass edge
  const wood = tex(rosewoodCanvas(512), [6, 6]);
  const woodMat = new THREE.MeshStandardMaterial({ map: wood, roughness: 0.5, metalness: 0.05 });
  const top = new THREE.Mesh(new THREE.BoxGeometry(4200, 80, 4200), woodMat); top.position.y = -40.6; scene.add(top);
  const velv = tex(velvetCanvas(TIERS[tier].tex)); velv.wrapS = velv.wrapT = THREE.ClampToEdgeWrapping;
  const mat = new THREE.Mesh(new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2), new THREE.MeshStandardMaterial({ map: velv, roughness: 1, metalness: 0 })); mat.position.y = 0.2; scene.add(mat);
  const brassMat = new THREE.MeshStandardMaterial({ color: 0xd9a940, metalness: 0.9, roughness: 0.3 });
  const edge = [0, 1, 2, 3].map(() => { const m = new THREE.Mesh(new THREE.BoxGeometry(1, 3.2, 1), brassMat); scene.add(m); return m; });
  function setMat(cx, cz, w, h) {
    mat.position.set(cx, 0.2, cz); mat.scale.set(w, 1, h);
    const t = 6; edge[0].position.set(cx, 1.2, cz - h / 2); edge[0].scale.set(w + t, 1, t); edge[1].position.set(cx, 1.2, cz + h / 2); edge[1].scale.set(w + t, 1, t);
    edge[2].position.set(cx - w / 2, 1.2, cz); edge[2].scale.set(t, 1, h); edge[3].position.set(cx + w / 2, 1.2, cz); edge[3].scale.set(t, 1, h);
    const lx = Math.min(w / 2 - 20, 270); lanterns[0].position.set(cx - lx, 46, cz - h / 2 - 34); lanterns[1].position.set(cx + lx, 46, cz - h / 2 - 34);
  }

  // ---- tiles
  const geo = makeTileGeo();
  const bambooT = tex(bambooCanvas());
  const sideMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.4, metalness: 0 });
  const bambooMat = new THREE.MeshStandardMaterial({ map: bambooT, roughness: 0.42, metalness: 0 });
  const faceMats = new Map(); let texKey = '', curStyle = 'traditional';
  const MATS = { get(kind) { if (kind < 0) return [bambooMat, bambooMat, sideMat]; let f = faceMats.get(kind); if (!f) { f = new THREE.MeshStandardMaterial({ map: tex(faceCanvas(kind, curStyle)), roughness: 0.34, metalness: 0 }); faceMats.set(kind, f); } return [f, bambooMat, sideMat]; } };
  function refreshFaces(style) {
    curStyle = style;
    for (const [kind, f] of faceMats) { f.map?.dispose(); f.map = tex(faceCanvas(kind, style)); f.needsUpdate = true; }
  }
  const tableSet = new TileSet(scene, geo, MATS, { back: 160, kind: 8 });
  const flatQuad = new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2);
  const blobs = new THREE.InstancedMesh(flatQuad, new THREE.MeshBasicMaterial({ map: tex(radialC('4,2,10', 0.9)), transparent: true, depthWrite: false, opacity: 0.55, fog: false }), 200);
  blobs.renderOrder = 1; blobs.frustumCulled = false; blobs.count = 0; scene.add(blobs);
  const glowTex = tex(radialC('255,225,130', 1));
  const glows = new THREE.InstancedMesh(flatQuad, new THREE.MeshBasicMaterial({ map: glowTex, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false }), 24);
  glows.renderOrder = 3; glows.frustumCulled = false; glows.count = 0; scene.add(glows);
  const hubTex = new THREE.CanvasTexture(cvs(256, 256)); hubTex.colorSpace = THREE.SRGBColorSpace; hubTex.anisotropy = 8;
  const hubMesh = new THREE.Mesh(flatQuad, new THREE.MeshBasicMaterial({ map: hubTex, transparent: true, depthWrite: false, toneMapped: false, fog: false })); hubMesh.renderOrder = 2; hubMesh.visible = false; scene.add(hubMesh);
  let hubVer = -1;

  // ---- hand pass: its own scene (rosewood rack + hand tiles), orthographic camera in the 2D layer's units
  const hscene = new THREE.Scene();
  hscene.add(new THREE.HemisphereLight(0xfff0d8, 0x2a1810, 1.0));
  const hkey = new THREE.DirectionalLight(0xffe2b4, 2.6); hkey.position.set(-200, 600, 700); hscene.add(hkey);
  const hfill = new THREE.DirectionalLight(0xa8bcff, 0.5); hfill.position.set(300, 100, 500); hscene.add(hfill);
  const hcam = new THREE.OrthographicCamera(-1, 1, 1, -1, 1, 4000);
  const handSet = new TileSet(hscene, geo, MATS, { back: 20, kind: 6 });
  const rack = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshStandardMaterial({ map: wood, roughness: 0.45, metalness: 0.05 })); hscene.add(rack);
  const rackLip = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), brassMat); hscene.add(rackLip);
  const quad = new THREE.PlaneGeometry(1, 1);
  const hBlobs = new THREE.InstancedMesh(quad, new THREE.MeshBasicMaterial({ map: tex(radialC('2,1,6', 0.9)), transparent: true, depthWrite: false, opacity: 0.6, fog: false }), 24);
  hBlobs.frustumCulled = false; hBlobs.count = 0; hBlobs.renderOrder = 1; hscene.add(hBlobs);
  const hGlows = new THREE.InstancedMesh(quad, new THREE.MeshBasicMaterial({ map: glowTex, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false }), 24);
  hGlows.frustumCulled = false; hGlows.count = 0; hGlows.renderOrder = 3; hscene.add(hGlows);

  // ---------------------------------------------------------------- camera
  const cur = { yaw: 0, tilt: 64, fov: 28, dist: 1000, ox: 0, oy: 0, tx: 0, ty: 0, tz: 0 };
  let snap = true, viewKey = '';
  const _v = new THREE.Vector3(), _t = new THREE.Vector3(), cssW = () => Math.max(1, window.innerWidth), cssH = () => Math.max(1, window.innerHeight);
  function place(cam, p) {
    const W = cssW(), Hh = cssH(), dir = _v.set(Math.sin(p.yaw * D2R) * Math.cos(p.tilt * D2R), Math.sin(p.tilt * D2R), Math.cos(p.yaw * D2R) * Math.cos(p.tilt * D2R));
    cam.fov = p.fov; cam.aspect = W / Hh; _t.set(p.tx, p.ty, p.tz);
    cam.position.copy(_t).addScaledVector(dir, p.dist); cam.up.set(0, 1, 0); cam.lookAt(_t);
    if (p.ox || p.oy) cam.setViewOffset(W, Hh, p.ox, p.oy, W, Hh); else cam.clearViewOffset();
    cam.updateProjectionMatrix(); cam.updateMatrixWorld(true);
  }
  const fitCam = new THREE.PerspectiveCamera();
  const toCss = (cam, x, y, z, out = { x: 0, y: 0 }) => { _v.set(x, y, z).project(cam); out.x = (_v.x + 1) / 2 * cssW(); out.y = (1 - _v.y) / 2 * cssH(); return out; };
  function fit(rc, pts, base) {
    const p = { ...base, ox: 0, oy: 0, dist: 1000 }, q = { x: 0, y: 0 }; let bb = null;
    for (let it = 0; it < 10; it++) {
      place(fitCam, p); bb = { x0: 1e9, y0: 1e9, x1: -1e9, y1: -1e9 };
      for (const [x, y, z] of pts) { toCss(fitCam, x, y, z, q); bb.x0 = Math.min(bb.x0, q.x); bb.x1 = Math.max(bb.x1, q.x); bb.y0 = Math.min(bb.y0, q.y); bb.y1 = Math.max(bb.y1, q.y); }
      const s = Math.min(rc.w / Math.max(1, bb.x1 - bb.x0), rc.h / Math.max(1, bb.y1 - bb.y0));
      if (Math.abs(s - 1) < 0.002) break; p.dist /= s;
    }
    p.ox = (bb.x0 + bb.x1) / 2 - (rc.x + rc.w / 2); p.oy = (bb.y0 + bb.y1) / 2 - (rc.y + rc.h / 2);
    p.bbw = bb.x1 - bb.x0; return p;
  }
  const cpu = () => meta.cssPerUnit || (Math.min(cssW(), cssH()) / 720);
  const offX = () => (cssW() - meta.width * cpu()) / 2, offY = () => (cssH() - meta.height * cpu()) / 2;
  const rectCss = (r) => ({ x: r.x * cpu() + offX(), y: r.y * cpu() + offY(), w: r.w * cpu(), h: r.h * cpu() });
  const WX = (x) => x - meta.width / 2, WZ = (y) => y - meta.height / 2;

  // The part of the table the 2D layout uses (walls, discard pools, opponents' hands), in the 2D layer's units.
  let rk = '', R = { x: 0, y: 0, w: 720, h: 900 };
  function clusterRect() {
    const k = `${GEO.key}|${meta.width}x${meta.height}`; if (k === rk) return R; rk = k;
    const pts = [], add = (p, hw, hh = hw) => pts.push([p.x - hw, p.y - hh], [p.x + hw, p.y + hh]), kk = GEO.k, cols = GEO.cols, rows = GEO.rows;
    for (let s = 0; s < 4; s++) for (const i of [0, cols - 1, cols * (rows - 1), cols * rows - 1]) add(riverPos(s, i), 26 * kk);
    for (const s of [1, 2, 3]) for (const i of [0, 13]) add(oppHandPos(s, i, 13, i > 12), 28 * kk);
    for (const i of [0, 35, 71, 107, 143]) add(wallPos(i), 12 * kk);
    for (let sd = 0; sd < 4; sd++) { for (const i of [0, 3]) { const f = flowerPos(sd, i); add({ x: f.x + (f.ox || 0), y: f.y }, 14 * kk); } for (const [mi, used] of [[0, 0], [3, 12]]) { const o = meldOrigin(sd, mi, used); add({ x: o.x + o.dx * 3, y: o.y + o.dy * 3 }, 18 * kk); add(o, 18 * kk); } }
    let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9; for (const [x, y] of pts) { x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y); }
    R = { x: x0 - 6, y: y0 - 6, w: x1 - x0 + 12, h: y1 - y0 + 12 }; return R;
  }
  const corners = (r, y) => [[WX(r.x), y, WZ(r.y)], [WX(r.x + r.w), y, WZ(r.y)], [WX(r.x), y, WZ(r.y + r.h)], [WX(r.x + r.w), y, WZ(r.y + r.h)]];
  const playCache = new Map();
  function playCam() {
    const r = clusterRect(), land = cssW() > cssH(), key = `${rk}|${cssW()}x${cssH()}|${cpu().toFixed(4)}`;
    let p = playCache.get(key);
    if (!p) {
      const full = meta.width > meta.height ? r : { x: Math.min(r.x, meta.width * 0.025), w: Math.max(r.w, meta.width * 0.95), h: 0, y: 0 }, rc = { x: full.x, w: full.w, y: r.y - 14, h: Math.max(r.h, HANDZONE_Y - 20 - (r.y - 14)) };
      const rcc = rectCss(rc);
      for (const tilt of land ? [60, 66, 72] : [58, 62, 66, 72]) {
        p = fit(rcc, corners(r, 0), { yaw: 0, tilt, fov: 36, tx: WX(r.x + r.w / 2), ty: 0, tz: WZ(r.y + r.h / 2) });
        if (p.bbw >= rcc.w * 0.985) break;   // the most tilted view that still fills the width
      }
      playCache.set(key, p); if (playCache.size > 16) playCache.delete(playCache.keys().next().value);
    }
    return { m: 'play', p, mat: [WX(r.x + r.w / 2), WZ(r.y + r.h / 2) - 15, r.w + 200, r.h + 520] };
  }
  function envCam(t) {
    const U = { x: meta.width * 0.04, y: meta.height * 0.2, w: meta.width * 0.92, h: meta.height * 0.6 }, half = 215, c = [[-half, 0, -half], [half, 0, -half], [-half, 0, half], [half, 0, half]];
    const base = { yaw: -8 + 5 * Math.sin(t * Math.PI * 2 / 40), tilt: 46 + 2 * Math.sin(t * Math.PI * 2 / 23), fov: 30, tx: 0, ty: 0, tz: 0 };
    return { m: 'env', p: fit(rectCss(U), c, base), mat: [0, 0, 900, 900] };
  }

  // ---------------------------------------------------------------- tiles per frame
  const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _qa = new THREE.Quaternion(), _qb = new THREE.Quaternion(), _s = new THREE.Vector3(), _p = new THREE.Vector3();
  const Y = new THREE.Vector3(0, 1, 0), QF = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), -Math.PI / 2);
  let nBlob = 0, nGlow = 0, nhB = 0, nhG = 0;
  function putTable(t, wx, wz, hgt, w, rot, kindOrBack) {
    const flip = t && t.f > 0 && t.f < 1 ? Math.max(0.06, Math.abs(1 - 2 * t.f)) : 1;
    _qa.setFromAxisAngle(Y, -rot); _q.multiplyQuaternions(_qa, QF);
    _p.set(wx, hgt, wz); _s.set(w * flip, w, w); tableSet.put(kindOrBack, _m.compose(_p, _q, _s));
    if (nBlob < 200) { _qb.setFromAxisAngle(Y, -rot); _p.set(wx + w * 0.07, 0.5, wz + w * 0.1); _s.set(w * 1.45 * flip, 1, w * 1.9); blobs.setMatrixAt(nBlob++, _m.compose(_p, _qb, _s)); }
  }
  function drawTable(list, mode) {
    tableSet.begin(); nBlob = 0; nGlow = 0;
    if (mode === 'env') {
    } else {
      const lift = (GEO.hr / 120) * GEO.k * 3.2;
      for (const t of list) {
        if (t.hand) continue;
        const face = t.f > 0.5, wx = WX(t.x), wz = WZ(t.y + (t.wall ? t.level * lift : 0));
        const hgt = t.w * TH * (0.5 + (t.wall ? t.level : 0)) + t.lift * t.w * 0.9;
        putTable(t, wx, wz, hgt, t.w, t.rot, face ? t.kind : -1);
        if (t.glow > 0 && nGlow < 24) { _qb.identity(); _p.set(wx, 0.9, wz); _s.set(t.w * 3.2, 1, t.w * 3.6); glows.setMatrixAt(nGlow++, _m.compose(_p, _qb, _s)); }
      }
    }
    tableSet.end(); blobs.count = nBlob; blobs.instanceMatrix.needsUpdate = true; glows.count = nGlow; glows.instanceMatrix.needsUpdate = true;
  }
  // YOUR hand: orthographic, tiles stand facing the camera in a rack. World = (x, -y) in the 2D layer's units.
  function drawHand(list) {
    handSet.begin(); nhB = 0; nhG = 0; let minX = 1e9, maxX = -1e9, wmax = 0;
    for (const t of list) {
      if (!t.hand) continue;
      const face = t.f > 0.5, flip = t.f > 0 && t.f < 1 ? Math.max(0.06, Math.abs(1 - 2 * t.f)) : 1, w = t.w * (1 + t.lift * 0.1);
      _q.identity(); _p.set(t.x, -t.y, t.lift * 20); _s.set(w * flip, w, w); handSet.put(face ? t.kind : -1, _m.compose(_p, _q, _s));
      if (nhB < 24) { _p.set(t.x + w * 0.06, -t.y - w * 0.12, -w * 0.3); _s.set(w * 1.2, w * 1.65, 1); _qb.identity(); hBlobs.setMatrixAt(nhB++, _m.compose(_p, _qb, _s)); }
      if ((t.glow > 0 || t.sel) && nhG < 24) { _p.set(t.x, -t.y, -w * 0.2); _s.set(w * 2.1, w * 2.7, 1); _qb.identity(); hGlows.setMatrixAt(nhG++, _m.compose(_p, _qb, _s)); }
      minX = Math.min(minX, t.x - w / 2); maxX = Math.max(maxX, t.x + w / 2); wmax = Math.max(wmax, w);
    }
    handSet.end(); hBlobs.count = nhB; hBlobs.instanceMatrix.needsUpdate = true; hGlows.count = nhG; hGlows.instanceMatrix.needsUpdate = true;
    return { minX, maxX, wmax };
  }

  // ---------------------------------------------------------------- per frame
  let game = null, lost = false, lastNow = 0, clock = 0, fadeIn = 0, mode = '', frameAvg = 16, slowFrames = 0;
  function applyTier() {
    const t = TIERS[tier]; renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, t.dpr));
    scene.traverse((o) => { if (o.material) [].concat(o.material).forEach((m) => { if (m && m.isMaterial) m.needsUpdate = true; }); });
  }
  applyTier();
  function pre() {
    if (!game || lost) return;
    const state = game.getState(), lang = getLang(), style = state.prefs.style, tk = `${style}|${lang}`;
    if (tk !== texKey) { texKey = tk; refreshFaces(style); }
    const vk = `${cssW()}x${cssH()}|${meta.width}x${meta.height}|${GEO.key}`; if (vk !== viewKey) { viewKey = vk; snap = true; }
    v3.tiles.length = 0; v3.mode = 'env';
  }
  const lerpKeys = ['yaw', 'tilt', 'fov', 'dist', 'ox', 'oy', 'tx', 'ty', 'tz'];
  function post() {
    if (!game || lost) return;
    const now = performance.now(), dt = clamp((now - (lastNow || now)) / 1000, 0, 0.1); lastNow = now; clock += dt;
    const goal = v3.mode === 'play' ? playCam() : envCam(clock);
    if (goal.m !== mode) { mode = goal.m; snap = true; }
    const k = snap || goal.m === 'play' ? 1 : 1 - Math.exp(-dt * 4);
    for (const key of lerpKeys) cur[key] += (goal.p[key] - cur[key]) * k;
    snap = false; place(camera, cur); setMat(...goal.mat);
    drawTable(v3.tiles, mode);
    let hv = null;
    if (mode === 'play') hv = drawHand(v3.tiles); else { handSet.begin(); handSet.end(); hBlobs.count = 0; hGlows.count = 0; }
    const hb = v3.hub;
    if (mode === 'play' && hb) { if (hb.ver !== hubVer) { hubVer = hb.ver; hubTex.image = hb.canvas; hubTex.needsUpdate = true; } hubMesh.visible = true; hubMesh.position.set(WX(hb.cx), 1.1, WZ(hb.cy)); hubMesh.scale.set(256 * hb.s, 1, 256 * hb.s); } else hubMesh.visible = false;
    for (const l of lanterns) { const fl = 1 + 0.06 * Math.sin(clock * 8.3 + l.userData.sx) + 0.04 * Math.sin(clock * 14.1 + 1.3 * l.userData.sx); l.userData.light.intensity = 130000 * fl; }
    if (fadeIn < 1) { fadeIn = Math.min(1, fadeIn + dt / 0.3); canvas.style.opacity = String(fadeIn); }
    renderer.setSize(cssW(), cssH(), false);
    renderer.clear(); renderer.render(scene, camera);
    if (hv && hv.wmax > 0) {
      const cw = cssW(), ch = cssH(), c = cpu(), x0 = -offX() / c, x1 = (cw - offX()) / c, y0 = -offY() / c, y1 = (ch - offY()) / c;
      const tx = (x0 + x1) / 2, ty = -HAND_Y, pitch = 24 * D2R;
      hcam.left = x0 - tx; hcam.right = x1 - tx; hcam.top = -y0 - ty; hcam.bottom = -y1 - ty; hcam.updateProjectionMatrix();
      hcam.position.set(tx, ty + Math.sin(pitch) * 1500, Math.cos(pitch) * 1500); hcam.lookAt(tx, ty, 0); hcam.updateMatrixWorld(true);
      // the rack: a rosewood ledge the tiles lean on, brass lip along its top
      const w = hv.wmax, rx0 = x0 - 20, rx1 = x1 + 20, ry = -HAND_Y - w * 0.42, rh = w * 0.5;
      rack.position.set((rx0 + rx1) / 2, ry - rh / 2, -w * 0.1); rack.scale.set(rx1 - rx0, rh, w * 0.7);
      rackLip.position.set((rx0 + rx1) / 2, ry + 1.5, w * 0.27); rackLip.scale.set(rx1 - rx0, 3.2, 3);
      renderer.clearDepth(); renderer.render(hscene, hcam);
    }
    const ft = dt * 1000; if (ft > 0) frameAvg = frameAvg * 0.95 + ft * 0.05;
    if (frameAvg > 26 && tier < 2) { if (++slowFrames > 90) { tier++; slowFrames = 0; frameAvg = 16; applyTier(); } } else slowFrames = 0;
  }

  let loseExt = null;
  canvas.addEventListener('webglcontextlost', (e) => { e.preventDefault(); lost = true; v3.on = false; canvas.style.visibility = 'hidden'; });
  canvas.addEventListener('webglcontextrestored', () => { lost = false; buildEnv(); applyTier(); fadeIn = 0; canvas.style.opacity = '0'; v3.on = true; canvas.style.visibility = 'visible'; snap = true; playCache.clear(); });

  await tick();
  place(camera, cur); try { renderer.compile(scene, camera); } catch { /* compiled lazily */ }
  await tick();

  return {
    ok: true, renderer, scene, camera,
    attach(g) { game = g; v3.on = true; fadeIn = 0; canvas.style.opacity = '0'; canvas.style.visibility = 'visible'; snap = true; },
    pre, post,
    get tier() { return TIERS[tier].name; },
    loseContext() { loseExt = renderer.getContext().getExtension('WEBGL_lose_context'); loseExt?.loseContext(); return Boolean(loseExt); },
    restoreContext() { loseExt?.restoreContext(); },
  };
}
