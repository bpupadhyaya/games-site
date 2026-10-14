// Models + procedural textures for the Tatami room (game-owned). Pure builders: no game state. Units: one tatami cell = 1.0
// (about 0.9 m), so a full mat is 2 x 1, 8.5 cm thick mats are 0.085 (slightly thick for readability, real is 0.06).
import * as THREE from '../vendor3d/three.js';
import * as B from '../vendor3d/board3d.js';

export const TAU = Math.PI * 2;
export const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
export const ease = (t) => t * t * (3 - 2 * t);
export const easeOut = (t) => 1 - (1 - t) * (1 - t) * (1 - t);
export const lerp = (a, b, t) => a + (b - a) * t;
export const hash = (n) => { const x = Math.sin(n * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); };
export function rng(seed = 1) { let s = (seed * 2654435761) >>> 0 || 1; return () => { s ^= s << 13; s >>>= 0; s ^= s >>> 17; s ^= s << 5; s >>>= 0; return s / 4294967296; }; }

export const MAT = { TH: 0.085, GAP: 0.011, FLOOR: 0.04, WALL: 0.34 };

const cv = (w, h = w) => { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; };
const tex = (c, { repeat, srgb = true, aniso = 8 } = {}) => {
  const t = new THREE.CanvasTexture(c);
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = aniso; t.wrapS = t.wrapT = THREE.RepeatWrapping;
  if (repeat) t.repeat.set(repeat[0], repeat[1]);
  return t;
};

export function softCanvas(rgb = '255,255,255', a = 1, ring = false, size = 128) {
  const c = cv(size), x = c.getContext('2d'), g = x.createRadialGradient(size / 2, size / 2, ring ? size * 0.28 : 0, size / 2, size / 2, size / 2);
  if (ring) { g.addColorStop(0, `rgba(${rgb},0)`); g.addColorStop(0.55, `rgba(${rgb},${a})`); g.addColorStop(0.75, `rgba(${rgb},${a * 0.35})`); g.addColorStop(1, `rgba(${rgb},0)`); }
  else { g.addColorStop(0, `rgba(${rgb},${a})`); g.addColorStop(0.45, `rgba(${rgb},${a * 0.4})`); g.addColorStop(1, `rgba(${rgb},0)`); }
  x.fillStyle = g; x.fillRect(0, 0, size, size);
  return tex(c, { aniso: 1 });
}

// ---- igusa (rush) weave: strands run ACROSS the mat's width, so the lines are perpendicular to the long cloth borders --------------
export function strawTextures() {
  const W = 1024, H = 512, c = cv(W, H), x = c.getContext('2d'), b = cv(W, H), bx = b.getContext('2d'), r = rng(7);
  x.fillStyle = '#e8e4cf'; x.fillRect(0, 0, W, H); bx.fillStyle = '#808080'; bx.fillRect(0, 0, W, H);
  let px = 0;
  while (px < W) {
    const w = 2 + r() * 4, tone = 0.86 + r() * 0.14;
    // each strand is made of a few shorter rush lengths with slightly different tone
    for (let y0 = 0; y0 < H; y0 += 64 + r() * 90) {
      const h = 64 + r() * 90, t2 = tone * (0.93 + r() * 0.1), v = Math.round(255 * Math.min(1, t2));
      x.fillStyle = `rgb(${Math.round(v * 0.97)},${Math.round(v * 0.96)},${Math.round(v * 0.88)})`; x.fillRect(px, y0, w, h);
      bx.fillStyle = `rgb(${Math.round(110 + r() * 60)},${Math.round(110 + r() * 60)},${Math.round(110 + r() * 60)})`; bx.fillRect(px, y0, w, h);
    }
    x.fillStyle = 'rgba(70,60,20,0.35)'; x.fillRect(px + w - 0.8, 0, 0.8, H);
    x.fillStyle = 'rgba(255,255,235,0.35)'; x.fillRect(px, 0, 0.8, H);
    bx.fillStyle = 'rgba(0,0,0,0.5)'; bx.fillRect(px + w - 1, 0, 1, H);
    px += w;
  }
  // warp threads (the pale cotton lines that run along the length) every ~48 px, very faint
  x.fillStyle = 'rgba(255,255,255,0.10)';
  for (let y = 40; y < H; y += 56) x.fillRect(0, y, W, 1.5);
  // soft blotches of tone
  for (let i = 0; i < 40; i++) { const g = x.createRadialGradient(r() * W, r() * H, 0, r() * W, r() * H, 60 + r() * 90); g.addColorStop(0, `rgba(${r() > 0.5 ? '255,255,235' : '90,80,30'},0.05)`); g.addColorStop(1, 'rgba(0,0,0,0)'); x.fillStyle = g; x.fillRect(0, 0, W, H); }
  return { map: tex(c), bump: tex(b, { srgb: false }) };
}

// ---- heri (the cloth border), brocade with a small gold diamond chain --------------------------------------------------------------
export function heriTexture(base = '#1d2548', gold = '#d9b24a') {
  const W = 512, H = 64, c = cv(W, H), x = c.getContext('2d');
  const g = x.createLinearGradient(0, 0, 0, H); g.addColorStop(0, base); g.addColorStop(0.5, base); g.addColorStop(1, base);
  x.fillStyle = g; x.fillRect(0, 0, W, H);
  x.fillStyle = 'rgba(255,255,255,0.08)';
  for (let i = 0; i < W; i += 3) x.fillRect(i, 0, 1, H);          // satin twill
  x.strokeStyle = gold; x.lineWidth = 3; x.globalAlpha = 0.9; x.beginPath(); x.moveTo(0, 7); x.lineTo(W, 7); x.moveTo(0, H - 7); x.lineTo(W, H - 7); x.stroke();
  x.lineWidth = 2;
  for (let i = 0; i < W; i += 32) { x.beginPath(); x.moveTo(i, H / 2); x.lineTo(i + 16, H / 2 - 14); x.lineTo(i + 32, H / 2); x.lineTo(i + 16, H / 2 + 14); x.closePath(); x.stroke(); x.fillStyle = gold; x.beginPath(); x.arc(i + 16, H / 2, 3, 0, TAU); x.fill(); }
  x.globalAlpha = 1;
  return tex(c);
}

export function plasterTexture(base = '#d9ccb0') {
  const S = 256, c = cv(S), x = c.getContext('2d'), r = rng(11), b = cv(S), bx = b.getContext('2d');
  x.fillStyle = base; x.fillRect(0, 0, S, S); bx.fillStyle = '#808080'; bx.fillRect(0, 0, S, S);
  for (let i = 0; i < 2500; i++) { const v = r(); x.fillStyle = v > 0.5 ? 'rgba(255,255,240,0.07)' : 'rgba(80,60,30,0.06)'; x.fillRect(r() * S, r() * S, 1 + r() * 3, 1 + r() * 3); bx.fillStyle = v > 0.5 ? 'rgba(255,255,255,0.3)' : 'rgba(0,0,0,0.3)'; bx.fillRect(r() * S, r() * S, 2, 2); }
  return { map: tex(c), bump: tex(b, { srgb: false }) };
}

// ---- shoji screen: translucent paper in a kumiko lattice (columns x rows of panes) --------------------------------------------------
export function shojiTexture(cols = 6, rows = 3, { paper = '#fff6e0', frame = '#4a2d18', lit = 1 } = {}) {
  const W = 1536, H = 768, c = cv(W, H), x = c.getContext('2d'), r = rng(23);
  const g = x.createLinearGradient(0, 0, 0, H); g.addColorStop(0, paper); g.addColorStop(1, paper); x.fillStyle = g; x.fillRect(0, 0, W, H);
  // paper fibre and a soft glow gradient (brighter where the sun comes through)
  for (let i = 0; i < 3000; i++) { x.fillStyle = r() > 0.5 ? 'rgba(255,255,255,0.18)' : 'rgba(150,120,70,0.10)'; x.fillRect(r() * W, r() * H, 2 + r() * 12, 1); }
  const gl = x.createRadialGradient(W * 0.35, H * 0.3, 20, W * 0.35, H * 0.3, W * 0.7); gl.addColorStop(0, `rgba(255,255,255,${0.5 * lit})`); gl.addColorStop(1, 'rgba(255,255,255,0)'); x.fillStyle = gl; x.fillRect(0, 0, W, H);
  x.fillStyle = frame; x.globalAlpha = 0.92;
  const pw = W / cols, ph = H / rows, t = 9;
  for (let i = 0; i <= cols; i++) x.fillRect(i * pw - t / 2, 0, t, H);
  for (let j = 0; j <= rows; j++) x.fillRect(0, j * ph - t / 2, W, t);
  // finer kumiko inside every pane: 3 x 4 lattice
  x.globalAlpha = 0.78;
  for (let i = 0; i < cols; i++) for (let j = 0; j < rows; j++) {
    for (let k = 1; k < 3; k++) x.fillRect(i * pw + (pw * k) / 3 - 2, j * ph, 4, ph);
    for (let k = 1; k < 4; k++) x.fillRect(i * pw, j * ph + (ph * k) / 4 - 2, pw, 4);
  }
  x.globalAlpha = 1;
  return tex(c);
}

// ---- hanging scroll: silk mount, ink-wash mountains, a red sun and a seal --------------------------------------------------------------
export function scrollTexture(silk = '#2a3a5a', sun = '#c22a1c') {
  const W = 256, H = 768, c = cv(W, H), x = c.getContext('2d'), r = rng(5);
  x.fillStyle = silk; x.fillRect(0, 0, W, H);
  x.strokeStyle = 'rgba(255,230,160,0.55)'; x.lineWidth = 3; x.strokeRect(10, 10, W - 20, H - 20);
  const px = 30, py = 70, pw = W - 60, ph = H - 190;
  const g = x.createLinearGradient(0, py, 0, py + ph); g.addColorStop(0, '#f6efdc'); g.addColorStop(1, '#e6dcc0'); x.fillStyle = g; x.fillRect(px, py, pw, ph);
  x.fillStyle = sun; x.beginPath(); x.arc(px + pw * 0.68, py + ph * 0.22, pw * 0.13, 0, TAU); x.fill();
  const ridge = (y0, amp, a, col) => { x.fillStyle = col; x.beginPath(); x.moveTo(px, py + ph); for (let i = 0; i <= 24; i++) { const u = i / 24; x.lineTo(px + u * pw, py + y0 - Math.abs(Math.sin(u * 5 + a)) * amp - Math.sin(u * 13 + a) * amp * 0.25); } x.lineTo(px + pw, py + ph); x.closePath(); x.fill(); };
  ridge(ph * 0.55, ph * 0.22, 0.8, 'rgba(60,60,70,0.35)'); ridge(ph * 0.72, ph * 0.18, 2.1, 'rgba(40,40,50,0.55)'); ridge(ph * 0.92, ph * 0.1, 4, 'rgba(20,20,28,0.85)');
  x.fillStyle = 'rgba(255,255,255,0.45)'; for (let i = 0; i < 4; i++) x.fillRect(px, py + ph * (0.45 + i * 0.1), pw, 8 + r() * 6);
  x.fillStyle = sun; x.fillRect(px + pw - 40, py + ph - 52, 28, 28);
  x.fillStyle = '#f6efdc'; x.fillRect(px + pw - 33, py + ph - 45, 6, 14);
  x.fillStyle = 'rgba(255,230,160,0.9)'; x.fillRect(W / 2 - 3, 0, 6, 22);
  return tex(c);
}

// ---- wood boards (outer floor): long planks running along z ---------------------------------------------------------------------------
export function boardsTexture(c0 = '#6b4527', c1 = '#8a5f37', seed = 3) {
  const S = 512, c = cv(S), x = c.getContext('2d'), r = rng(seed), b = cv(S), bx = b.getContext('2d');
  const n = 8, w = S / n;
  bx.fillStyle = '#808080'; bx.fillRect(0, 0, S, S);
  for (let i = 0; i < n; i++) {
    const g = x.createLinearGradient(i * w, 0, (i + 1) * w, 0), t = r();
    g.addColorStop(0, c0); g.addColorStop(0.5 + (t - 0.5) * 0.3, t > 0.5 ? c1 : c0); g.addColorStop(1, c0);
    x.fillStyle = g; x.fillRect(i * w, 0, w, S);
    for (let k = 0; k < 26; k++) { x.strokeStyle = r() > 0.5 ? 'rgba(255,230,180,0.10)' : 'rgba(20,10,0,0.18)'; x.lineWidth = 0.6 + r() * 1.2; x.beginPath(); const xx = i * w + r() * w; x.moveTo(xx, 0); x.bezierCurveTo(xx + (r() - 0.5) * 8, S * 0.3, xx + (r() - 0.5) * 8, S * 0.7, xx + (r() - 0.5) * 6, S); x.stroke(); }
    x.fillStyle = 'rgba(0,0,0,0.55)'; x.fillRect(i * w, 0, 1.6, S);     // plank joint
    bx.fillStyle = 'rgba(0,0,0,0.7)'; bx.fillRect(i * w, 0, 3, S);
    const cut = r() * S; x.fillStyle = 'rgba(0,0,0,0.45)'; x.fillRect(i * w, cut, w, 1.4);
  }
  return { map: tex(c), bump: tex(b, { srgb: false }) };
}

// ---- geometry ------------------------------------------------------------------------------------------------------------------------
// One mat. kind 'full' is 2 x 1 along x; 'half' is 1 x 1. Everything sits on y = 0 (the mat's underside).
export function makeMatGeos() {
  const g = MAT.GAP, TH = MAT.TH;
  const mk = (w, d) => {
    const core = B.slab(w - 2 * g, d - 2 * g, TH, 0.03, 0.02, { per: 4, seg: 3 });
    return core;
  };
  const stripUv = (geo, su) => { const uv = geo.attributes.uv; for (let i = 0; i < uv.count; i++) uv.setX(i, uv.getX(i) * su); uv.needsUpdate = true; return geo; };
  const heri = (w, d) => {
    const len = w - 2 * g - 0.07, hw = 0.1, off = d / 2 - g - hw / 2 - 0.012;
    const parts = [];
    for (const sd of [-1, 1]) {
      const geo = B.roundedBox(len, 0.014, hw, 0.005, 3);
      parts.push({ geo, m: new THREE.Matrix4().makeTranslation(0, TH + 0.001, sd * off) });
    }
    return B.mergeGeos(parts);
  };
  const emblem = B.inlay([[0, -0.13], [0.11, 0], [0, 0.13], [-0.11, 0]], 0.012, { bevel: 0.003 });
  return { fullCore: mk(2, 1), halfCore: stripUv(mk(1, 1), 0.5), fullHeri: heri(2, 1), halfHeri: stripUv(heri(1, 1), 0.5), emblem };
}

// merged cells for the dark sub-floor (one rounded slab per room cell) and the low walls around the room
export function buildRoomGeos(Bd) {
  const floor = [], walls = [], caps = [];
  const inRoom = (r, c) => r >= 0 && c >= 0 && r < Bd.h && c < Bd.w && Bd.room[r * Bd.w + c];
  const cellSlab = B.slab(0.985, 0.985, MAT.FLOOR, 0.02, 0.012, { per: 3, seg: 2 });
  for (let r = 0; r < Bd.h; r++) for (let c = 0; c < Bd.w; c++) {
    if (inRoom(r, c)) floor.push({ geo: cellSlab, m: new THREE.Matrix4().makeTranslation(c + 0.5 - Bd.w / 2, 0, r + 0.5 - Bd.h / 2) });
  }
  // thin partition walls along every edge between a room cell and the outside (plaster body + a timber cap rail), with square corner posts
  const t = 0.26, hgt = MAT.WALL, ex = (Bd.w + 0) / 2, ez = Bd.h / 2;
  const addSeg = (cx, cz, lx, lz) => {
    walls.push({ geo: new THREE.BoxGeometry(lx, hgt, lz), m: new THREE.Matrix4().makeTranslation(cx, hgt / 2, cz) });
    caps.push({ geo: new THREE.BoxGeometry(lx + 0.05, 0.05, lz + 0.05), m: new THREE.Matrix4().makeTranslation(cx, hgt + 0.02, cz) });
  };
  const corner = new Set();
  for (let r = 0; r < Bd.h; r++) for (let c = 0; c < Bd.w; c++) {
    if (!inRoom(r, c)) continue;
    const x0 = c - ex, z0 = r - ez;
    if (!inRoom(r - 1, c)) { addSeg(x0 + 0.5, z0 - t / 2, 1, t); corner.add(`${c},${r}`); corner.add(`${c + 1},${r}`); }
    if (!inRoom(r + 1, c)) { addSeg(x0 + 0.5, z0 + 1 + t / 2, 1, t); corner.add(`${c},${r + 1}`); corner.add(`${c + 1},${r + 1}`); }
    if (!inRoom(r, c - 1)) { addSeg(x0 - t / 2, z0 + 0.5, t, 1); corner.add(`${c},${r}`); corner.add(`${c},${r + 1}`); }
    if (!inRoom(r, c + 1)) { addSeg(x0 + 1 + t / 2, z0 + 0.5, t, 1); corner.add(`${c + 1},${r}`); corner.add(`${c + 1},${r + 1}`); }
  }
  // corner posts: a post on every lattice point where an exterior edge ends, sized to also fill the outer corner notch
  for (const k of corner) {
    const [c, r] = k.split(',').map(Number);
    // outward diagonals: put the post on the side(s) away from room cells
    const nb = (dr, dc) => inRoom(r + dr, c + dc);
    const sx = (nb(-1, -1) || nb(0, -1)) && !(nb(-1, 0) || nb(0, 0)) ? 1 : (nb(-1, 0) || nb(0, 0)) && !(nb(-1, -1) || nb(0, -1)) ? -1 : 0;
    const sz = (nb(-1, -1) || nb(-1, 0)) && !(nb(0, -1) || nb(0, 0)) ? 1 : (nb(0, -1) || nb(0, 0)) && !(nb(-1, -1) || nb(-1, 0)) ? -1 : 0;
    addSeg(c - ex + sx * t / 2, r - ez + sz * t / 2, t, t);
  }
  return {
    floor: floor.length ? B.mergeGeos(floor) : null,
    walls: walls.length ? B.mergeGeos(walls) : null,
    caps: caps.length ? B.mergeGeos(caps) : null,
  };
}

// ---- props ------------------------------------------------------------------------------------------------------------------------------
const std = (color, o = {}) => new THREE.MeshStandardMaterial({ color, roughness: 0.6, ...o });

export function buildTeaSet() {
  const g = new THREE.Group();
  const clay = std(0x2a2522, { roughness: 0.35, metalness: 0.55 });
  const pot = new THREE.Mesh(B.lathe([[0, 0], [0.09, 0.005], [0.12, 0.05], [0.125, 0.1], [0.1, 0.15], [0.05, 0.175], [0.04, 0.19], [0, 0.19]], 24), clay);
  pot.castShadow = true; g.add(pot);
  const lid = new THREE.Mesh(new THREE.SphereGeometry(0.018, 10, 8), clay); lid.position.y = 0.205; g.add(lid);
  const spout = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.022, 0.12, 8), clay); spout.position.set(0.15, 0.1, 0); spout.rotation.z = -0.9; g.add(spout);
  const handle = new THREE.Mesh(new THREE.TorusGeometry(0.075, 0.009, 6, 16, Math.PI), clay); handle.position.set(0, 0.2, 0); g.add(handle);
  const cupM = std(0xf1ede0, { roughness: 0.25 });
  for (const [x, z] of [[-0.3, 0.12], [0.28, 0.2]]) {
    const cup = new THREE.Mesh(B.lathe([[0, 0], [0.032, 0], [0.045, 0.02], [0.05, 0.06], [0.047, 0.065], [0.04, 0.062], [0.035, 0.03], [0, 0.015]], 18), cupM);
    cup.position.set(x, 0, z); cup.castShadow = true; g.add(cup);
  }
  const tray = new THREE.Mesh(B.slab(0.9, 0.55, 0.025, 0.06, 0.012), B.material('lacquer', { color: '#1a1210', color2: '#2a1c14' }));
  tray.position.y = -0.025; g.add(tray);
  return g;
}

export function buildVase(season = 'spring') {
  const g = new THREE.Group();
  const celadon = new THREE.Mesh(B.lathe([[0, 0], [0.11, 0], [0.17, 0.05], [0.19, 0.16], [0.14, 0.3], [0.07, 0.38], [0.06, 0.45], [0.09, 0.5], [0.075, 0.5], [0.045, 0.45], [0, 0.44]], 24), new THREE.MeshPhysicalMaterial({ color: 0x8fb8a4, roughness: 0.18, clearcoat: 0.7 }));
  celadon.castShadow = true; g.add(celadon);
  const stem = std(0x5a3b22, { roughness: 0.9 });
  const r = rng(4);
  const colors = { spring: 0xffa8c0, summer: 0x5fcf6a, autumn: 0xe0702a, winter: 0xe8f2ff };
  const bl = std(colors[season] ?? colors.spring, { roughness: 0.8 });
  for (let i = 0; i < 3; i++) {
    const br = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.013, 1.05 - i * 0.2, 6), stem);
    br.position.set(-0.12 + i * 0.12, 0.45 + (1.05 - i * 0.2) / 2 - 0.05, 0); br.rotation.z = 0.35 - i * 0.28; br.castShadow = true; g.add(br);
    for (let k = 0; k < 7; k++) {
      const f = new THREE.Mesh(new THREE.SphereGeometry(0.045 + r() * 0.03, 8, 6), bl);
      const u = 0.35 + k * 0.1, ang = 0.35 - i * 0.28;
      f.position.set(br.position.x - Math.sin(ang) * (u - 0.5) * (1.05 - i * 0.2) + (r() - 0.5) * 0.14, br.position.y + Math.cos(ang) * (u - 0.5) * (1.05 - i * 0.2) + (r() - 0.5) * 0.1, (r() - 0.5) * 0.12);
      f.castShadow = true; g.add(f);
    }
  }
  return g;
}

export function buildZabuton(color = 0x7a2a3a) {
  const geo = B.roundedBox(0.62, 0.11, 0.62, 0.05, 4);
  const m = new THREE.Mesh(geo, B.material('cloth', { color: '#' + new THREE.Color(color).getHexString(), color2: '#' + new THREE.Color(color).multiplyScalar(1.25).getHexString() }));
  m.castShadow = true; m.receiveShadow = true;
  return m;
}

export function buildAndon(glowColor = 0xffc070) {
  const g = new THREE.Group();
  const wood = B.material('darkWood', { color: '#2a1810', color2: '#3d2417' });
  const paper = new THREE.MeshBasicMaterial({ color: glowColor, toneMapped: false });
  const body = new THREE.Mesh(new THREE.BoxGeometry(0.46, 0.78, 0.46), paper); body.position.y = 0.55; g.add(body);
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) { const p = new THREE.Mesh(new THREE.BoxGeometry(0.035, 0.84, 0.035), wood); p.position.set(sx * 0.23, 0.55, sz * 0.23); p.castShadow = true; g.add(p); }
  for (const y of [0.13, 0.55, 0.97]) { const rail = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.03, 0.5), wood); rail.position.y = y; g.add(rail); }
  const roof = new THREE.Mesh(B.slab(0.62, 0.62, 0.05, 0.04, 0.02), wood); roof.position.y = 0.98; g.add(roof);
  const foot = new THREE.Mesh(B.slab(0.55, 0.55, 0.12, 0.04, 0.02), wood); g.add(foot);
  return g;
}

// A kimono sleeve (furisode-style: a tapering cuff with a long hanging pouch). Returns { group, pouch } with the pouch for swaying.
export function buildSleeve(color = 0x8a2a4a, lining = 0xf3ead2) {
  const g = new THREE.Group();
  const cloth = B.material('cloth', { color: '#' + new THREE.Color(color).getHexString(), color2: '#' + new THREE.Color(color).multiplyScalar(1.3).getHexString() });
  cloth.side = THREE.DoubleSide;
  // cuff: flared tube from the wrist (z = 0) back along -z; radius grows toward the elbow
  const prof = [];
  for (let i = 0; i <= 8; i++) { const u = i / 8; prof.push([0.052 + u * u * 0.1 + u * 0.03, u * 0.5]); }
  const geo = B.lathe(prof, 24); geo.rotateX(Math.PI / 2);          // lathe axis y -> z
  const cuff = new THREE.Mesh(geo, cloth); cuff.castShadow = true; g.add(cuff);
  // the hanging pouch (tamoto): a soft rounded sack under the forearm
  const pouchGeo = B.roundedBox(0.16, 0.34, 0.34, 0.06, 4);
  const pouch = new THREE.Mesh(pouchGeo, cloth); pouch.castShadow = true;
  pouch.position.set(0, -0.2, 0.28); g.add(pouch);
  const hem = new THREE.Mesh(B.torus ? B.torus(0.05, 0.004) : new THREE.TorusGeometry(0.057, 0.0045, 6, 20), new THREE.MeshStandardMaterial({ color: lining, roughness: 0.7 }));
  hem.rotation.x = 0; hem.position.z = 0.0; g.add(hem);
  return { group: g, pouch };
}
