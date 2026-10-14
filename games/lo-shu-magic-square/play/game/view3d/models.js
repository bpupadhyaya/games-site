// Lo Shu 3D models (procedural, deterministic): the turtle-shell board with carved sockets, jade / cinnabar tablets with engraved
// numerals, sum gauges, the riverside terrace, ink-wash mountains, the willow and lanterns. No image files.
import * as THREE from '../vendor3d/three.js';
import * as B from '../vendor3d/board3d.js';
import { LOOKS, mix } from '../src/ui.js';
import { stoneLabel } from '../src/stones.js';

const TAU = Math.PI * 2;
const rng = (seed) => { let s = seed >>> 0 || 1; return () => { s ^= s << 13; s >>>= 0; s ^= s >> 17; s ^= s << 5; s >>>= 0; return s / 4294967296; }; };
const cv = (w, h = w) => { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; };
const tex = (c, { repeat, srgb = true, wrap = false } = {}) => {
  const t = new THREE.CanvasTexture(c); if (srgb) t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4;
  if (repeat || wrap) { t.wrapS = t.wrapT = THREE.RepeatWrapping; if (repeat) t.repeat.set(repeat[0], repeat[1]); }
  return t;
};
export const STONE_R = 0.42, STONE_H = 0.3, TOP_Y = 0.62;   // tablet radius / height, and the height of the grid plate top (cell units)
export const SEAT_Y = 0.49;                                  // the floor of a socket

// ---------------------------------------------------------------- stones
const mottleCache = new Map();
function mottle(c0, c1, seed) {
  const key = c0 + c1 + seed; if (mottleCache.has(key)) return mottleCache.get(key);
  const c = cv(256), g = c.getContext('2d'), r = rng(seed);
  g.fillStyle = c0; g.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 70; i++) {
    const x = r() * 256, y = r() * 256, rad = 20 + r() * 60, gr = g.createRadialGradient(x, y, 0, x, y, rad);
    gr.addColorStop(0, c1); gr.addColorStop(1, 'rgba(0,0,0,0)'); g.globalAlpha = 0.12 + r() * 0.16; g.fillStyle = gr; g.fillRect(x - rad, y - rad, rad * 2, rad * 2);
  }
  g.globalAlpha = 0.07; g.strokeStyle = '#ffffff';
  for (let i = 0; i < 26; i++) { g.beginPath(); let x = r() * 256, y = r() * 256; g.moveTo(x, y); for (let k = 0; k < 5; k++) { x += (r() - 0.5) * 70; y += (r() - 0.5) * 70; g.lineTo(x, y); } g.stroke(); }
  const t = tex(c); mottleCache.set(key, t); return t;
}
let stoneGeo = null;
function stoneGeometry() {
  if (stoneGeo) return stoneGeo;
  const R = STONE_R, H = STONE_H;
  const prof = [[0, 0], [0.86, 0], [0.92, 0.03], [1, 0.1], [1, 0.44], [0.96, 0.58], [0.88, 0.65], [0.86, 0.62], [0.8, 0.62], [0.78, 0.66], [0.78, 0.66], [0, 0.66]];
  stoneGeo = B.lathe(prof.map(([r, y]) => [r * R, y * H]), 56);
  return stoneGeo;
}
const labelCache = new Map();
export function labelTexture(v, style, ink, dark) {
  const key = `${v}|${style}|${ink}|${dark}`; let t = labelCache.get(key); if (t) return t;
  const S = 192, c = cv(S), g = c.getContext('2d');
  stoneLabel(g, v, S / 2, S / 2, S * 0.5 * 0.9, ink, style);
  t = tex(c); t.anisotropy = 8; labelCache.set(key, t); return t;
}
const stoneMats = new Map();
function stoneMaterial(kind, lookId) {
  const key = kind + '|' + lookId; let m = stoneMats.get(key); if (m) return m;
  const T = LOOKS[lookId], pal = kind === 'given' ? T.given : T.stone;
  const map = mottle(mix(pal[1], pal[2], 0.45), mix(pal[1], pal[0], 0.3), kind === 'given' ? 5 : 9);
  m = new THREE.MeshPhysicalMaterial({ color: 0xffffff, map, roughness: kind === 'given' ? 0.26 : 0.34, metalness: 0, clearcoat: 1, clearcoatRoughness: 0.1, envMapIntensity: 0.75,
    emissive: new THREE.Color(pal[2]), emissiveIntensity: 0.2 });
  stoneMats.set(key, m); return m;
}
export const lookInk = (kind, lookId) => { const T = LOOKS[lookId]; return kind === 'given' ? T.givenInk : T.stoneInk; };

/** One tablet: a Group with .body, .decal, .ring (glow), .shadow. Origin at the base. kind 'stone' | 'given'. */
export function makeStone(blob) {
  const g = new THREE.Group();
  const body = new THREE.Mesh(stoneGeometry(), stoneMaterial('stone', 'jade')); body.castShadow = true; body.receiveShadow = true;
  const decalGeo = new THREE.CircleGeometry(STONE_R * 0.76, 40); decalGeo.rotateX(-Math.PI / 2);
  const decal = new THREE.Mesh(decalGeo, new THREE.MeshStandardMaterial({ transparent: true, roughness: 0.45, metalness: 0.2, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2, envMapIntensity: 0.6 }));
  decal.position.y = STONE_H * 0.66 + 0.003; decal.renderOrder = 2;
  const ringGeo = new THREE.RingGeometry(STONE_R * 1.0, STONE_R * 1.22, 56); ringGeo.rotateX(-Math.PI / 2);
  const ring = new THREE.Mesh(ringGeo, new THREE.MeshBasicMaterial({ color: 0xffd36b, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending, fog: false }));
  ring.position.y = 0.01; ring.renderOrder = 3;
  const sh = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ map: blob, transparent: true, opacity: 0.6, depthWrite: false, color: 0x000000 }));
  sh.rotation.x = -Math.PI / 2; sh.renderOrder = 1;
  const pivot = new THREE.Group(); pivot.add(body, decal, ring);
  g.add(sh, pivot);
  g.userData = { body, decal, ring, shadow: sh, pivot, kind: null, look: null, v: -1, style: null };
  return g;
}
export function styleStone(g, v, kind, lookId, style) {
  const u = g.userData;
  if (u.kind !== kind || u.look !== lookId) { u.body.material = stoneMaterial(kind, lookId); u.kind = kind; u.look = lookId; u.v = -1; }
  if (u.v !== v || u.style !== style) {
    const ink = lookInk(kind, lookId), T = LOOKS[lookId];
    const t = labelTexture(v, style, ink, T.dark);
    u.decal.material.map = t; u.decal.material.emissive = new THREE.Color(ink); u.decal.material.emissiveMap = t; u.decal.material.emissiveIntensity = 0.18; u.decal.material.needsUpdate = true;
    u.v = v; u.style = style;
  }
}

// ---------------------------------------------------------------- gauge faces
const gaugeCache = new Map();
export function gaugeMaterial(k, state, hot) {
  const step = Math.round(Math.max(0, Math.min(1, k)) * 36), key = `${step}|${state}|${hot ? 1 : 0}`;
  let m = gaugeCache.get(key); if (m) return m;
  const S = 160, c = cv(S), g = c.getContext('2d');
  const col = state === 'ok' ? '#ffd36b' : state === 'over' ? '#ff6b57' : '#5fe3ab';
  g.beginPath(); g.arc(S / 2, S / 2, S * 0.48, 0, TAU); const bg = g.createRadialGradient(S * 0.4, S * 0.35, 4, S / 2, S / 2, S * 0.5); bg.addColorStop(0, '#26302e'); bg.addColorStop(1, '#070b0a'); g.fillStyle = bg; g.fill();
  g.lineWidth = S * 0.1; g.strokeStyle = 'rgba(255,255,255,0.10)'; g.beginPath(); g.arc(S / 2, S / 2, S * 0.34, 0, TAU); g.stroke();
  if (step > 0) { g.strokeStyle = col; g.lineCap = 'round'; g.beginPath(); g.arc(S / 2, S / 2, S * 0.34, -Math.PI / 2, -Math.PI / 2 + (step / 36) * TAU); g.stroke(); }
  if (state === 'ok' || hot) { g.lineWidth = S * 0.035; g.strokeStyle = hot && state !== 'ok' ? '#eec766' : col; g.beginPath(); g.arc(S / 2, S / 2, S * 0.46, 0, TAU); g.stroke(); }
  const t = tex(c); t.anisotropy = 4;
  m = new THREE.MeshStandardMaterial({ map: t, roughness: 0.4, metalness: 0.1, emissive: new THREE.Color(col), emissiveMap: t, emissiveIntensity: state === 'ok' ? 0.5 : 0.18 });
  gaugeCache.set(key, m); return m;
}

// ---------------------------------------------------------------- board
function rrPath(path, cx, cz, w, d, r) {   // clockwise-ish rounded rect into a THREE.Path / Shape; z is shape-y (flipped by rotateX)
  const x0 = cx - w / 2, x1 = cx + w / 2, y0 = -cz - d / 2, y1 = -cz + d / 2; r = Math.min(r, w / 2, d / 2);
  path.moveTo(x0 + r, y0); path.lineTo(x1 - r, y0); path.quadraticCurveTo(x1, y0, x1, y0 + r); path.lineTo(x1, y1 - r); path.quadraticCurveTo(x1, y1, x1 - r, y1);
  path.lineTo(x0 + r, y1); path.quadraticCurveTo(x0, y1, x0, y1 - r); path.lineTo(x0, y0 + r); path.quadraticCurveTo(x0, y0, x0 + r, y0);
  return path;
}
function scuteTexture(look) {
  const s = 0.5, W = Math.sqrt(3) * s, H = 3 * s, PX = 120, c = cv(Math.round(W * PX * 2), Math.round(H * PX * 2) / 1), g = c.getContext('2d'), k = c.width / W, r = rng(21);
  g.fillStyle = mix(look.bg0, '#000000', look.dark ? 0.35 : 0.0); g.fillRect(0, 0, c.width, c.height);
  const hex = (cx, cy) => { g.beginPath(); for (let i = 0; i < 6; i++) { const a = Math.PI / 6 + (i * Math.PI) / 3; const x = cx + Math.cos(a) * s * k * 0.97, y = cy + Math.sin(a) * s * k * 0.97; if (i) g.lineTo(x, y); else g.moveTo(x, y); } g.closePath(); };
  const centres = []; for (let row = -1; row <= 3; row++) for (let col = -1; col <= 2; col++) centres.push([(col + (row & 1 ? 0.5 : 0)) * W * k, row * 1.5 * s * k]);
  for (const [x, y] of centres) { hex(x, y); g.fillStyle = `rgba(255,255,255,${0.01 + r() * 0.05})`; g.fill(); g.lineWidth = 7; g.strokeStyle = 'rgba(0,0,0,0.55)'; g.stroke(); g.translate(0, -2); hex(x, y); g.lineWidth = 3.4; g.strokeStyle = look.rim; g.globalAlpha = 0.85; g.stroke(); g.globalAlpha = 1; g.translate(0, 2); }
  const t = tex(c, { wrap: true, repeat: [1 / W, 1 / H] }); return t;
}
const boardMats = {};
const lookMats = (lookId) => {
  if (boardMats[lookId]) return boardMats[lookId];
  const T = LOOKS[lookId];
  const m = {
    mat: B.material('cloth', { color: mix(T.bg0, '#000000', 0.35), color2: T.bg0, repeat: [3, 3], size: 256 }),
    shell: new THREE.MeshPhysicalMaterial({ map: scuteTexture(T), color: 0xffffff, roughness: 0.42, clearcoat: 0.6, clearcoatRoughness: 0.3, metalness: 0, envMapIntensity: 0.5 }),
    frame: new THREE.MeshPhysicalMaterial({ color: new THREE.Color(mix(T.frame, '#ffffff', T.dark ? 0.04 : 0.0)), roughness: 0.18, clearcoat: 1, clearcoatRoughness: 0.06, envMapIntensity: 1.1 }),
    plate: B.material('darkWood', { color: mix(T.frame, '#000000', T.dark ? 0.2 : 0.0), color2: mix(T.frame, '#ffffff', 0.12), repeat: [0.4, 0.4], size: 512 }),
    brass: B.material('brass', { envIntensity: 2.4 }),
    felt: B.material('felt', { color: T.socket, color2: mix(T.socket, '#000000', 0.4), repeat: [2, 2], size: 256 }),
    slate: new THREE.MeshStandardMaterial({ color: new THREE.Color(mix('#10201d', T.frame, 0.4)), roughness: 0.5, metalness: 0.1 }),
  };
  m.plate.color = new THREE.Color(0xffffff);
  return (boardMats[lookId] = m);
};
/** dims: { fw, fd, n, pan, grid: {cx, cz, size}, banner: {x, z, w, d} | null, gauges: [{id, x, z, r}] } in cell units, board centre at the origin. */
export function buildBoard(dims, lookId) {
  const m = lookMats(lookId), T = LOOKS[lookId], g = new THREE.Group(), { fw, fd, n } = dims;
  const add = (geo, mat, y, o = {}) => { const mesh = new THREE.Mesh(geo, mat); mesh.position.set(o.x ?? 0, y, o.z ?? 0); mesh.castShadow = o.cast !== false; mesh.receiveShadow = true; g.add(mesh); return mesh; };
  // silk mat and the shell-shaped plate (a chamfered octagon with hexagonal scutes engraved on the top)
  add(B.slab(fw + 1.0, fd + 1.0, 0.05, 0.5, 0.02), m.mat, 0, { cast: false });
  const sw = fw + 0.9, sd = fd + 0.9, ch = Math.min(sw, sd) * 0.18, shape = new THREE.Shape();
  shape.moveTo(-sw / 2 + ch, -sd / 2); shape.lineTo(sw / 2 - ch, -sd / 2); shape.lineTo(sw / 2, -sd / 2 + ch); shape.lineTo(sw / 2, sd / 2 - ch); shape.lineTo(sw / 2 - ch, sd / 2);
  shape.lineTo(-sw / 2 + ch, sd / 2); shape.lineTo(-sw / 2, sd / 2 - ch); shape.lineTo(-sw / 2, -sd / 2 + ch); shape.closePath();
  const shellGeo = new THREE.ExtrudeGeometry(shape, { depth: 0.1, bevelEnabled: true, bevelThickness: 0.04, bevelSize: 0.05, bevelSegments: 3, curveSegments: 6 });
  shellGeo.rotateX(-Math.PI / 2); add(shellGeo, m.shell, 0.05);
  // brass rim under the frame, lacquer frame
  add(B.slab(fw + 0.1, fd + 0.1, 0.12, 0.3, 0.03), m.brass, 0.17);
  add(B.slab(fw, fd, 0.3, 0.24, 0.07), m.frame, 0.19);
  // carved plate with n x n sockets cut through
  const G = dims.grid, gs = G.size + 0.07, gshape = new THREE.Shape();
  rrPath(gshape, G.cx, G.cz, gs, gs, 0.2);
  const hole = 0.94, sc = G.size / n;
  for (let i = 0; i < n * n; i++) { const cx = G.cx - G.size / 2 + (i % n + 0.5) * sc, cz = G.cz - G.size / 2 + (Math.floor(i / n) + 0.5) * sc; const p = new THREE.Path(); rrPath(p, cx, cz, hole * sc, hole * sc, 0.16); gshape.holes.push(p); }
  const plateGeo = new THREE.ExtrudeGeometry(gshape, { depth: 0.1, bevelEnabled: true, bevelThickness: 0.015, bevelSize: 0.015, bevelSegments: 2, curveSegments: 6 });
  plateGeo.rotateX(-Math.PI / 2);
  // top-face UVs in world units suit the wood texture; fine for this plate
  add(plateGeo, m.plate, SEAT_Y + 0.015);
  const feltGeo = B.slab(gs - 0.04, gs - 0.04, 0.03, 0.18, 0.01); add(feltGeo, m.felt, SEAT_Y - 0.025, { x: G.cx, z: G.cz, cast: false });
  // thin gold line around the plate
  const ring = new THREE.Shape(); rrPath(ring, G.cx, G.cz, gs + 0.1, gs + 0.1, 0.24); const hp = new THREE.Path(); rrPath(hp, G.cx, G.cz, gs + 0.02, gs + 0.02, 0.2); ring.holes.push(hp);
  const ringGeo = B.inlay(ring, 0.03, { bevel: 0.004 }); add(ringGeo, m.brass, SEAT_Y + 0.01, { cast: false });
  // the banner plaque (slate, brass edged) in the top band
  if (dims.banner) { const b = dims.banner; add(B.slab(b.w + 0.08, b.d + 0.08, 0.05, 0.14, 0.02), m.brass, SEAT_Y - 0.02, { x: b.x, z: b.z }); add(B.slab(b.w, b.d, 0.06, 0.12, 0.02), m.slate, SEAT_Y - 0.02, { x: b.x, z: b.z }); }
  // gauge seats: brass bezels, the lit faces are dynamic (presenter)
  for (const gg of dims.gauges) {
    const bezel = add(B.lathe([[0, 0], [gg.r * 1.18, 0], [gg.r * 1.18, 0.04], [gg.r * 1.1, 0.07], [gg.r * 1.0, 0.07], [gg.r * 1.0, 0.03], [0, 0.03]], 40), m.brass, SEAT_Y - 0.0, { x: gg.x, z: gg.z });
    bezel.castShadow = false;
  }
  g.userData.dims = dims; g.userData.top = TOP_Y;
  return g;
}
export function disposeGroup(grp) { grp.traverse((o) => { if (o.geometry) o.geometry.dispose(); }); }

// ---------------------------------------------------------------- environment: terrace, parapet, river, mountains, willow
function paving() {
  const c = cv(512), g = c.getContext('2d'), r = rng(17);
  g.fillStyle = '#22262a'; g.fillRect(0, 0, 512, 512);
  const slabs = [[0, 0, 256, 170], [256, 0, 256, 170], [0, 170, 170, 172], [170, 170, 342, 172], [0, 342, 300, 170], [300, 342, 212, 170]];
  for (const [x, y, w, h] of slabs) {
    const v = 30 + r() * 22; g.fillStyle = `rgb(${v + 4},${v + 7},${v + 12})`; g.fillRect(x + 3, y + 3, w - 6, h - 6);
    for (let i = 0; i < 160; i++) { g.fillStyle = `rgba(${r() > 0.5 ? 255 : 0},${r() > 0.5 ? 255 : 0},${r() > 0.5 ? 255 : 0},0.04)`; g.fillRect(x + r() * w, y + r() * h, 2 + r() * 10, 1 + r() * 3); }
    g.strokeStyle = 'rgba(0,0,0,0.65)'; g.lineWidth = 4; g.strokeRect(x + 2, y + 2, w - 4, h - 4);
    g.strokeStyle = 'rgba(255,255,255,0.05)'; g.lineWidth = 1.5; g.strokeRect(x + 5, y + 5, w - 10, h - 10);
  }
  return tex(c, { wrap: true, repeat: [9, 9] });
}
function waterTexture() {
  const c = cv(512, 512), g = c.getContext('2d'), r = rng(3);
  const gr = g.createLinearGradient(0, 0, 0, 512); gr.addColorStop(0, '#f2b98a'); gr.addColorStop(0.35, '#7d6f95'); gr.addColorStop(1, '#16273a');
  g.fillStyle = gr; g.fillRect(0, 0, 512, 512);
  g.strokeStyle = 'rgba(255,255,255,0.10)'; g.lineWidth = 1.2;
  for (let i = 0; i < 160; i++) { const y = r() * 512, x = r() * 512, w = 20 + r() * 90; g.beginPath(); g.moveTo(x, y); g.lineTo(x + w, y + (r() - 0.5) * 2); g.stroke(); }
  return tex(c, { wrap: true, repeat: [6, 3] });
}
function mountainTexture() {
  const W = 2048, Hh = 640, c = cv(W, Hh), g = c.getContext('2d'), r = rng(44);
  const layers = [{ base: 430, amp: 300, a: 0.34, col: [96, 112, 140], n: 7 }, { base: 500, amp: 240, a: 0.5, col: [66, 82, 112], n: 9 }, { base: 575, amp: 170, a: 0.72, col: [40, 56, 84], n: 11 }];
  for (const L of layers) {
    const peaks = []; for (let i = 0; i < L.n; i++) peaks.push({ x: (i + 0.2 + r() * 0.6) * (W / L.n), h: L.amp * (0.45 + r() * 0.55), w: 90 + r() * 120 });
    g.beginPath(); g.moveTo(0, Hh);
    for (let x = 0; x <= W; x += 8) {
      let y = L.base - 30 * Math.sin(x * 0.004 + L.n) - 10 * Math.sin(x * 0.013);
      for (const p of peaks) { const d = (x - p.x) / p.w; y -= p.h * Math.exp(-d * d * 1.4) * (1 + 0.15 * Math.sin(x * 0.07)); }
      g.lineTo(x, y);
    }
    g.lineTo(W, Hh); g.closePath();
    const gr = g.createLinearGradient(0, L.base - L.amp, 0, Hh); gr.addColorStop(0, `rgba(${L.col},${L.a})`); gr.addColorStop(0.7, `rgba(${L.col.map((v) => v + 40)},${L.a * 0.5})`); gr.addColorStop(1, `rgba(${L.col.map((v) => v + 70)},0)`);
    g.fillStyle = gr; g.fill();
    for (let i = 0; i < 3; i++) { const y = L.base - r() * L.amp * 0.4, gm = g.createLinearGradient(0, y - 30, 0, y + 30); gm.addColorStop(0, 'rgba(255,225,200,0)'); gm.addColorStop(0.5, `rgba(255,225,200,${0.2 + r() * 0.15})`); gm.addColorStop(1, 'rgba(255,225,200,0)'); g.fillStyle = gm; g.fillRect(0, y - 30, W, 60); }
  }
  return tex(c);
}
function willowTexture() {
  const c = cv(64, 256), g = c.getContext('2d'), r = rng(8);
  g.strokeStyle = '#7f9d4a'; g.lineWidth = 2.2; g.beginPath(); g.moveTo(32, 0); for (let y = 0; y <= 256; y += 16) g.lineTo(32 + Math.sin(y * 0.06) * 3, y); g.stroke();
  for (let y = 14; y < 250; y += 9) for (const sd of [-1, 1]) {
    const x = 32 + Math.sin(y * 0.06) * 3, len = 11 + r() * 8 - y * 0.012; g.save(); g.translate(x, y); g.rotate(sd * (0.9 + r() * 0.3)); g.fillStyle = `rgb(${110 + r() * 50},${150 + r() * 40},${60 + r() * 30})`;
    g.beginPath(); g.ellipse(len / 2, 0, len / 2, 2.2, 0, 0, TAU); g.fill(); g.restore();
  }
  return tex(c);
}
function haloTexture(rgb = '255,255,255', size = 128) {
  const c = cv(size), g = c.getContext('2d'), gr = g.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  gr.addColorStop(0, `rgba(${rgb},1)`); gr.addColorStop(0.35, `rgba(${rgb},0.35)`); gr.addColorStop(1, `rgba(${rgb},0)`);
  g.fillStyle = gr; g.fillRect(0, 0, size, size); return tex(c);
}
export const halo = haloTexture;

export function buildLantern(color = 0xd8321c) {
  const g = new THREE.Group();
  const body = new THREE.Mesh(B.lathe([[0, 0], [0.12, 0], [0.2, 0.08], [0.26, 0.22], [0.27, 0.34], [0.24, 0.48], [0.14, 0.58], [0.1, 0.6], [0, 0.6]], 24), new THREE.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: 0.9, roughness: 0.6 }));
  const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.12, 0.06, 16), new THREE.MeshStandardMaterial({ color: 0x2a1a0c, roughness: 0.6 }));
  cap.position.y = 0.63; const cap2 = cap.clone(); cap2.position.y = -0.03;
  const cord = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.008, 1.6, 6), new THREE.MeshBasicMaterial({ color: 0x3a2a18 })); cord.position.y = 1.4;
  g.add(body, cap, cap2, cord); body.position.y = 0; return g;
}

/** The terrace by the river at dusk. Everything is in cell units (a board is 3 to 6 units across). Returns { group, update(t, calm) }. */
export function buildTerrace() {
  const group = new THREE.Group();
  // terrace floor
  const floorMat = new THREE.MeshStandardMaterial({ map: paving(), roughness: 0.82, metalness: 0, color: 0xcfc8c0, envMapIntensity: 0.5 });
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(120, 74), floorMat); floor.rotation.x = -Math.PI / 2; floor.position.set(0, -0.001, 21); floor.receiveShadow = true; group.add(floor);
  // parapet along the river edge with lanterns
  const stone = B.material('stone', { color: '#5d625f', color2: '#8a8d88', repeat: [8, 1], size: 256 });
  const para = new THREE.Mesh(B.slab(70, 0.9, 1.0, 0.1, 0.05), stone); para.position.set(0, 0, -9.5); para.castShadow = true; para.receiveShadow = true; group.add(para);
  for (const x of [-9, -3, 3, 9]) { const p = new THREE.Mesh(B.slab(0.9, 1.1, 1.5, 0.1, 0.06), stone); p.position.set(x, 0, -9.5); p.castShadow = true; group.add(p); }
  // river
  const wm = new THREE.MeshStandardMaterial({ map: waterTexture(), roughness: 0.12, metalness: 0.2, envMapIntensity: 1.2 });
  const water = new THREE.Mesh(new THREE.PlaneGeometry(260, 140), wm); water.rotation.x = -Math.PI / 2; water.position.set(0, -2.2, -78); group.add(water);
  // mountains (ink wash) and the moon
  const mm = new THREE.MeshBasicMaterial({ map: mountainTexture(), transparent: true, fog: false, depthWrite: false });
  const mount = new THREE.Mesh(new THREE.PlaneGeometry(330, 100), mm); mount.position.set(0, 24, -150); group.add(mount);
  const moon = new THREE.Sprite(new THREE.SpriteMaterial({ map: haloTexture('255,240,205', 256), color: 0xfff2d0, transparent: true, opacity: 0.95, fog: false, depthWrite: false })); moon.scale.set(26, 26, 1); moon.position.set(46, 52, -148); group.add(moon);
  // willow: trunk, boughs, hanging strands that sway
  const willow = new THREE.Group(); willow.position.set(-11.5, 0, -11.5); group.add(willow);
  const bark = new THREE.MeshStandardMaterial({ color: 0x2a1f16, roughness: 0.95 });
  const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.75, 7.5, 12), bark); trunk.position.y = 3.6; trunk.rotation.z = -0.1; trunk.castShadow = true; willow.add(trunk);
  const strandTex = willowTexture(), strandMat = new THREE.MeshLambertMaterial({ map: strandTex, transparent: true, alphaTest: 0.35, side: THREE.DoubleSide, color: 0xb8c880 });
  const r = rng(6), strands = [];
  for (let b = 0; b < 7; b++) {
    const a = -0.3 + (b / 6) * 3.4 + r() * 0.2, len = 4 + r() * 3, bx = Math.cos(a) * len, bz = Math.sin(a) * len * 0.8 + 0.5, by = 7.2 + r() * 1.2;
    const curve = new THREE.CatmullRomCurve3([new THREE.Vector3(0, 6.4, 0), new THREE.Vector3(bx * 0.4, by + 0.9, bz * 0.4), new THREE.Vector3(bx, by, bz)]);
    const bough = new THREE.Mesh(new THREE.TubeGeometry(curve, 10, 0.14, 6), bark); bough.castShadow = true; willow.add(bough);
    for (let k = 0; k < 7; k++) {
      const u = 0.25 + (k / 6) * 0.75, p = curve.getPoint(u), L = 3.6 + r() * 3.2;
      const geo = new THREE.PlaneGeometry(0.5, L, 1, 8); geo.translate(0, -L / 2, 0);
      const pivot = new THREE.Group(); pivot.position.copy(p); pivot.rotation.y = r() * TAU;
      const m = new THREE.Mesh(geo, strandMat); pivot.add(m); willow.add(pivot); strands.push({ pivot, ph: r() * TAU, amp: 0.05 + r() * 0.05, sp: 0.5 + r() * 0.5 });
    }
  }
  // two bundles of willow strands hang in from above at the sides of the table: they frame every board scene and sway in the breeze
  const framing = [];
  for (const side of [-1, 1]) for (let k = 0; k < 9; k++) {
    const L = 3.4 + r() * 3.2, geo = new THREE.PlaneGeometry(0.42, L, 1, 8); geo.translate(0, -L / 2, 0);
    const pivot = new THREE.Group(); pivot.position.set(side * (3.9 + r() * 2.6), 6.4 + r() * 1.4, -1.5 + r() * 3.5); pivot.rotation.y = r() * TAU;
    pivot.add(new THREE.Mesh(geo, strandMat)); group.add(pivot); framing.push({ pivot, ph: r() * TAU, amp: 0.05 + r() * 0.06, sp: 0.5 + r() * 0.5 });
  }
  // lanterns hanging from the willow and standing at the parapet
  const lanterns = [];
  for (const [x, y, z, c] of [[-6.2, 5.4, -9.0, 0xd8321c], [-8.0, 4.6, -8.2, 0xf09a2a], [6.5, 3.2, -9.5, 0xd8321c], [10.8, 3.8, -9.3, 0xf09a2a]]) {
    const l = buildLantern(c); l.position.set(x, y, z); l.userData.base = y; group.add(l); lanterns.push(l);
    const h = new THREE.Sprite(new THREE.SpriteMaterial({ map: haloTexture('255,170,80', 128), color: 0xffa860, transparent: true, opacity: 0.6, blending: THREE.AdditiveBlending, depthWrite: false, fog: false })); h.scale.set(2.6, 2.6, 1); h.position.set(0, 0.3, 0); l.add(h);
  }
  // fireflies
  const nf = 46, fa = new Float32Array(nf * 3), base = new Float32Array(nf * 3), rr = rng(12);
  for (let i = 0; i < nf; i++) { base[i * 3] = (rr() - 0.5) * 30; base[i * 3 + 1] = 0.5 + rr() * 5; base[i * 3 + 2] = -12 + rr() * 18; }
  const ffGeo = new THREE.BufferGeometry(); ffGeo.setAttribute('position', new THREE.BufferAttribute(fa, 3));
  const flies = new THREE.Points(ffGeo, new THREE.PointsMaterial({ map: haloTexture('220,255,160', 64), size: 0.5, color: 0xdfff9a, transparent: true, opacity: 0.9, blending: THREE.AdditiveBlending, depthWrite: false, sizeAttenuation: true }));
  flies.frustumCulled = false; group.add(flies);
  // falling willow leaves
  const nl = 26, leaves = new THREE.InstancedMesh(new THREE.CircleGeometry(0.1, 8).scale(2.2, 0.55, 1), new THREE.MeshBasicMaterial({ color: 0x9db85a, side: THREE.DoubleSide, transparent: true, opacity: 0.9 }), nl);
  leaves.frustumCulled = false; group.add(leaves);
  const lv = Array.from({ length: nl }, (_, i) => ({ x: (rr() - 0.5) * 14 - 1, z: -6 + rr() * 11, ph: rr() * TAU, sp: 0.35 + rr() * 0.4, o: rr() }));
  const dummy = new THREE.Object3D();
  function update(t, calm) {
    const tt = calm ? 0 : t;
    for (const s of strands.concat(framing)) { s.pivot.rotation.z = Math.sin(tt * s.sp + s.ph) * s.amp; s.pivot.rotation.x = Math.cos(tt * s.sp * 0.8 + s.ph) * s.amp * 0.6; }
    lanterns.forEach((l, i) => { l.rotation.z = Math.sin(tt * 0.7 + i * 1.3) * 0.05; l.rotation.x = Math.cos(tt * 0.5 + i) * 0.03; });
    for (let i = 0; i < nf; i++) { fa[i * 3] = base[i * 3] + Math.sin(tt * 0.3 + i * 1.7) * 0.9; fa[i * 3 + 1] = base[i * 3 + 1] + Math.sin(tt * 0.5 + i * 2.3) * 0.5; fa[i * 3 + 2] = base[i * 3 + 2] + Math.cos(tt * 0.27 + i) * 0.8; }
    ffGeo.attributes.position.needsUpdate = true; flies.material.opacity = 0.55 + 0.4 * Math.sin(tt * 1.7);
    for (let i = 0; i < nl; i++) {
      const p = lv[i], f = ((tt * p.sp * 0.06 + p.o) % 1), y = 8 - f * 8.4;
      dummy.position.set(p.x + Math.sin(tt * 0.6 + p.ph) * 1.1 + f * 3, y, p.z + Math.cos(tt * 0.5 + p.ph) * 0.8);
      dummy.rotation.set(tt * 0.9 + p.ph, tt * 0.7, tt * 1.1); dummy.updateMatrix(); leaves.setMatrixAt(i, dummy.matrix);
    }
    leaves.instanceMatrix.needsUpdate = true;
    water.material.map.offset.x = (tt * 0.004) % 1;
  }
  return { group, update, water, lanterns };
}

function paintScreen() {
  const W = 2400, H = 1260, c = cv(W, H), g = c.getContext('2d'), r = rng(31);
  const sky = g.createLinearGradient(0, 0, 0, H * 0.62);
  sky.addColorStop(0, '#171a48'); sky.addColorStop(0.4, '#4d3f7e'); sky.addColorStop(0.72, '#c9808a'); sky.addColorStop(0.9, '#f4c996'); sky.addColorStop(1, '#f9e2b0');
  g.fillStyle = sky; g.fillRect(0, 0, W, H);
  for (let i = 0; i < 120; i++) { g.fillStyle = `rgba(255,248,225,${0.2 + r() * 0.6})`; g.fillRect(r() * W, r() * H * 0.35, 1.6, 1.6); }
  const mx = W * 0.7, my = H * 0.19, mg = g.createRadialGradient(mx, my, 10, mx, my, 240);
  mg.addColorStop(0, 'rgba(255,246,220,0.95)'); mg.addColorStop(0.25, 'rgba(255,240,205,0.5)'); mg.addColorStop(1, 'rgba(255,240,205,0)'); g.fillStyle = mg; g.fillRect(mx - 260, my - 260, 520, 520);
  g.beginPath(); g.arc(mx, my, 78, 0, TAU); g.fillStyle = '#fff6dc'; g.fill();
  const layers = [{ base: 0.58, amp: 0.34, col: [150, 120, 160], a: 0.6, n: 9 }, { base: 0.63, amp: 0.3, col: [96, 84, 132], a: 0.75, n: 11 }, { base: 0.69, amp: 0.25, col: [48, 54, 98], a: 0.92, n: 13 }];
  for (const L of layers) {
    const peaks = Array.from({ length: L.n }, (_, i) => ({ x: (i + 0.2 + r() * 0.6) * (W / L.n), h: L.amp * H * (0.4 + r() * 0.6), w: 70 + r() * 120 }));
    g.beginPath(); g.moveTo(0, H);
    for (let x = 0; x <= W; x += 6) { let y = L.base * H - 14 * Math.sin(x * 0.006 + L.n); for (const p of peaks) { const d = (x - p.x) / p.w; y -= p.h * Math.exp(-d * d * 1.5); } g.lineTo(x, y); }
    g.lineTo(W, H); g.closePath();
    const gr = g.createLinearGradient(0, (L.base - L.amp) * H, 0, H * 0.78); gr.addColorStop(0, `rgba(${L.col},${L.a})`); gr.addColorStop(1, `rgba(${L.col.map((v) => Math.min(255, v + 90))},${L.a * 0.15})`);
    g.fillStyle = gr; g.fill();
    for (let i = 0; i < 2; i++) { const y = (L.base - 0.03 - r() * 0.1) * H, mg2 = g.createLinearGradient(0, y - 30, 0, y + 30); mg2.addColorStop(0, 'rgba(255,230,210,0)'); mg2.addColorStop(0.5, 'rgba(255,230,210,0.34)'); mg2.addColorStop(1, 'rgba(255,230,210,0)'); g.fillStyle = mg2; g.fillRect(0, y - 30, W, 60); }
  }
  const rv = g.createLinearGradient(0, H * 0.72, 0, H); rv.addColorStop(0, '#7a74a0'); rv.addColorStop(1, '#141a38'); g.fillStyle = rv; g.fillRect(0, H * 0.72, W, H * 0.28);
  g.fillStyle = 'rgba(255,240,205,0.28)'; for (let i = 0; i < 34; i++) { const y = H * 0.73 + i * 9, w = 150 - i * 2.8; g.fillRect(mx - w / 2 + (r() - 0.5) * 36, y, w, 3.2); }
  g.strokeStyle = 'rgba(255,255,255,0.13)'; g.lineWidth = 1.8; for (let i = 0; i < 120; i++) { const y = H * 0.72 + r() * H * 0.28, x = r() * W; g.beginPath(); g.moveTo(x, y); g.lineTo(x + 30 + r() * 90, y); g.stroke(); }
  g.fillStyle = 'rgba(28,24,58,0.92)'; const px = W * 0.34, py = H * 0.675;
  g.fillRect(px - 30, py - 26, 60, 26); g.beginPath(); g.moveTo(px - 54, py - 26); g.quadraticCurveTo(px - 12, py - 34, px, py - 58); g.quadraticCurveTo(px + 12, py - 34, px + 54, py - 26); g.closePath(); g.fill();
  const strand = (x0, y0, len, sway) => {
    g.beginPath(); g.moveTo(x0, y0); g.quadraticCurveTo(x0 + sway, y0 + len * 0.5, x0 + sway * 0.6, y0 + len); g.lineWidth = 2.6; g.strokeStyle = 'rgba(26,40,22,0.9)'; g.stroke();
    for (let k = 0; k < 16; k++) { const u = 0.1 + k / 17, x = x0 + sway * u * (1.2 - u * 0.6), y = y0 + len * u; g.save(); g.translate(x, y); g.rotate(0.5 + r() * 0.5); g.fillStyle = `rgba(${90 + r() * 40},${130 + r() * 50},${50 + r() * 30},0.95)`; g.beginPath(); g.ellipse(8, 0, 10, 3, 0, 0, TAU); g.fill(); g.restore(); }
  };
  g.beginPath(); g.moveTo(0, 0); g.bezierCurveTo(260, 60, 560, 40, 820, 170); g.lineWidth = 14; g.strokeStyle = '#1a1410'; g.stroke();
  for (let i = 0; i < 30; i++) { const t = i / 29, x = t * 800, y = 6 + 164 * Math.pow(t, 1.7); strand(x, y, 220 + r() * 330, (r() - 0.5) * 60); }
  g.fillStyle = '#b3261e'; g.fillRect(W - 170, H - 130, 70, 70); g.fillStyle = '#f7e8d0'; g.font = '700 30px serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('洛', W - 135, H - 108); g.fillText('书', W - 135, H - 76);
  return tex(c);
}
export function buildScreen() {
  const group = new THREE.Group(), map = paintScreen(), fw = 3.3, fh = 5.2, pw = fw - 0.34, ph = fh - 0.34;
  const wood = new THREE.MeshPhysicalMaterial({ color: 0x1c0d09, roughness: 0.3, clearcoat: 1, clearcoatRoughness: 0.1, envMapIntensity: 0.8 });
  const gold = new THREE.MeshStandardMaterial({ color: 0xd9b45a, metalness: 1, roughness: 0.35, envMapIntensity: 1.4 });
  for (let i = 0; i < 3; i++) {
    const p = new THREE.Group();
    const frame = new THREE.Mesh(B.roundedBox(fw, fh, 0.14, 0.05, 3), wood); frame.position.set(0, fh / 2 + 0.08, 0); frame.castShadow = true; frame.receiveShadow = true; p.add(frame);
    const trim = new THREE.Mesh(B.roundedBox(fw - 0.18, fh - 0.18, 0.05, 0.02, 2), gold); trim.position.set(0, fh / 2 + 0.08, 0.06); p.add(trim);
    const geo = new THREE.PlaneGeometry(pw, ph), uv = geo.attributes.uv;
    for (let k = 0; k < uv.count; k++) uv.setX(k, (i + uv.getX(k)) / 3);
    const pm = new THREE.MeshStandardMaterial({ map, emissive: 0xffffff, emissiveMap: map, emissiveIntensity: 0.55, roughness: 0.8, metalness: 0 });
    const paint = new THREE.Mesh(geo, pm); paint.position.set(0, fh / 2 + 0.08, 0.1); p.add(paint);
    for (const sx of [-1, 1]) { const foot = new THREE.Mesh(B.roundedBox(0.34, 0.16, 0.5, 0.05, 2), wood); foot.position.set(sx * (fw / 2 - 0.3), 0.08, 0.05); p.add(foot); }
    p.position.set((i - 1) * (fw - 0.12) * 0.94, 0, i === 1 ? 0 : 0.42); p.rotation.y = (1 - i) * 0.36 * -1;
    group.add(p);
  }
  return group;
}
