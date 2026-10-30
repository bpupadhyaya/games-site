// The 3D world for Tab: Stick Race, all procedural. A carved sandstone-and-ebony 4 x 7 board with brass inlay and turquoise star squares sits on a
// woven kilim in a Bedouin goat-hair tent at night: two wooden yard trays with sockets, a felt throwing mat with a brass edge, four real
// half-round sticks, domed ivory and burnt-clay stones, a pierced brass floor lantern, bolster cushions, tent cloth and a dune sky beyond the
// tent opening. Units are centimetres; y is up; the field of the board is at y = TOP; board row 0 is the near row (+z).
import * as THREE from '../vendor3d/three.js';
import { COLS, ROWS } from '../src/rules.js';

export const SQ = 6;                               // square size
export const BM = SQ * 7 * 0.04 / 0.92;            // frame margin (matches the 2D board: m = 4 percent of the width)
export const BW = SQ * COLS + 2 * BM, BH = SQ * ROWS + 2 * BM;
export const TOP = 2.0;                            // top of the playing field
export const FRAME_TOP = TOP + 0.55;
export const SR = 2.15, SH = 1.35;                 // stone radius and height
export const STICK_R = 1.15;
const rnd = (s) => { let x = s | 0 || 1; return () => { x ^= x << 13; x ^= x >>> 17; x ^= x << 5; return ((x >>> 0) % 100000) / 100000; }; };
const canvas = (w, h = w) => { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; };
const tex = (c, srgb = true, rep = null) => { const t = new THREE.CanvasTexture(c); if (srgb) t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8; if (rep) { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(rep[0], rep[1]); } return t; };

export function radialTex(rgb = '255,255,255', a = 1) {
  const c = canvas(128), x = c.getContext('2d'), g = x.createRadialGradient(64, 64, 0, 64, 64, 64);
  g.addColorStop(0, `rgba(${rgb},${a})`); g.addColorStop(0.5, `rgba(${rgb},${a * 0.45})`); g.addColorStop(1, `rgba(${rgb},0)`);
  x.fillStyle = g; x.fillRect(0, 0, 128, 128); return tex(c);
}
export function ringTex() {
  const c = canvas(128), x = c.getContext('2d'), g = x.createRadialGradient(64, 64, 30, 64, 64, 64);
  g.addColorStop(0, 'rgba(255,255,255,0)'); g.addColorStop(0.55, 'rgba(255,255,255,0.15)'); g.addColorStop(0.74, 'rgba(255,255,255,1)'); g.addColorStop(0.86, 'rgba(255,255,255,0.85)'); g.addColorStop(1, 'rgba(255,255,255,0)');
  x.fillStyle = g; x.fillRect(0, 0, 128, 128); return tex(c);
}
export function cellTex() {
  const c = canvas(128), x = c.getContext('2d');
  x.fillStyle = 'rgba(255,255,255,0.55)'; x.beginPath(); x.roundRect(14, 14, 100, 100, 18); x.fill();
  x.strokeStyle = 'rgba(255,255,255,1)'; x.lineWidth = 8; x.beginPath(); x.roundRect(10, 10, 108, 108, 20); x.stroke();
  return tex(c);
}

// ------------------------------------------------------------------------------------------------ geometry helpers
export function roundedBox(w, h, d, r = 0.3, seg = 3) {
  const s = new THREE.Shape(), x = -w / 2, y = -d / 2;
  s.moveTo(x + r, y); s.lineTo(x + w - r, y); s.quadraticCurveTo(x + w, y, x + w, y + r); s.lineTo(x + w, y + d - r); s.quadraticCurveTo(x + w, y + d, x + w - r, y + d);
  s.lineTo(x + r, y + d); s.quadraticCurveTo(x, y + d, x, y + d - r); s.lineTo(x, y + r); s.quadraticCurveTo(x, y, x + r, y);
  const g = new THREE.ExtrudeGeometry(s, { depth: h, bevelEnabled: true, bevelThickness: Math.min(r, h / 3), bevelSize: Math.min(r, h / 3) * 0.7, bevelSegments: seg, curveSegments: 4 });
  g.rotateX(-Math.PI / 2); g.translate(0, 0, 0); return g;      // y from 0 up to h (plus the bevel)
}
const box = (w, h, d) => new THREE.BoxGeometry(w, h, d);

// ------------------------------------------------------------------------------------------------ board
function sandTex(th, k, size = 256) {
  const c = canvas(size), x = c.getContext('2d'), r = rnd(31 + k * 7);
  x.fillStyle = th.sq[k]; x.fillRect(0, 0, size, size);
  for (let i = 0; i < 900; i++) { x.fillStyle = r() > 0.5 ? 'rgba(255,240,200,0.10)' : 'rgba(90,60,20,0.12)'; x.fillRect(r() * size, r() * size, 1 + r() * 2.2, 1 + r() * 2.2); }
  for (let i = 0; i < 14; i++) { x.strokeStyle = 'rgba(120,80,30,0.07)'; x.lineWidth = 1 + r() * 2; x.beginPath(); x.moveTo(0, r() * size); x.bezierCurveTo(size * 0.3, r() * size, size * 0.6, r() * size, size, r() * size); x.stroke(); }
  return c;
}
function star8(x, cx, cy, R, r) { x.beginPath(); for (let i = 0; i < 16; i++) { const a = i * Math.PI / 8 - Math.PI / 2, d = i % 2 ? r : R; x.lineTo(cx + Math.cos(a) * d, cy + Math.sin(a) * d); } x.closePath(); }

// the field: 28 squares painted as one map (+ a height map for the grooves and the inlaid stars)
function fieldMaps(th, cellOf, isSafe, N, px = 220) {
  const W = px * COLS, H = px * ROWS, c = canvas(W, H), x = c.getContext('2d'), b = canvas(W, H), y = b.getContext('2d');
  y.fillStyle = '#9a9a9a'; y.fillRect(0, 0, W, H);
  const sand = [sandTex(th, 0, 256), sandTex(th, 1, 256)];
  for (let sq = 0; sq < N; sq++) {
    const { r, c: cc } = cellOf(sq), X = cc * px, Y = (ROWS - 1 - r) * px, k = (r + cc) % 2;
    x.drawImage(sand[k], X, Y, px, px);
    const g = x.createLinearGradient(X, Y, X + px, Y + px); g.addColorStop(0, 'rgba(255,255,255,0.10)'); g.addColorStop(1, 'rgba(60,30,0,0.16)'); x.fillStyle = g; x.fillRect(X, Y, px, px);
    // carved joint round every square
    x.strokeStyle = th.sqEdge; x.globalAlpha = 0.85; x.lineWidth = 5; x.strokeRect(X + 2.5, Y + 2.5, px - 5, px - 5); x.globalAlpha = 1;
    y.fillStyle = '#b8b8b8'; y.fillRect(X + 6, Y + 6, px - 12, px - 12); y.strokeStyle = '#303030'; y.lineWidth = 10; y.strokeRect(X + 4, Y + 4, px - 8, px - 8);
  }
  // the path: a shallow groove through the middle of every square
  const ctr = (sq) => { const { r, c: cc } = cellOf(sq); return [cc * px + px / 2, (ROWS - 1 - r) * px + px / 2]; };
  for (const [ctx2, col, lw] of [[x, th.groove, 9], [y, '#505050', 12]]) {
    ctx2.save(); ctx2.lineCap = 'round'; ctx2.lineJoin = 'round'; ctx2.strokeStyle = col; ctx2.lineWidth = lw; ctx2.globalAlpha = 0.8; ctx2.beginPath();
    for (let sq = 0; sq < N; sq++) { const [a, b2] = ctr(sq); if (sq === 0) ctx2.moveTo(a, b2); else ctx2.lineTo(a, b2); }
    ctx2.stroke(); ctx2.restore();
  }
  for (let sq = 0; sq < N; sq++) {
    if (!isSafe(sq)) continue;
    const [cx, cy] = ctr(sq);
    x.fillStyle = th.star[0]; star8(x, cx, cy, px * 0.43, px * 0.2); x.fill();
    x.strokeStyle = th.star[1]; x.lineWidth = 6; star8(x, cx, cy, px * 0.43, px * 0.2); x.stroke();
    x.fillStyle = th.star[1]; x.beginPath(); x.arc(cx, cy, px * 0.07, 0, 7); x.fill();
    y.fillStyle = '#e6e6e6'; star8(y, cx, cy, px * 0.43, px * 0.2); y.fill();
  }
  // entry chevrons (where each side's stones come on) and exit arrows, as painted in the flat art
  for (const [sq, side] of [[0, 0], [N - 1, 1]]) {
    const [cx, cy] = ctr(sq); x.save(); x.translate(cx - px * 0.28, cy); x.strokeStyle = side === 0 ? '#f8f0da' : th.dark.base; x.lineWidth = 14; x.lineCap = 'round'; x.lineJoin = 'round';
    x.beginPath(); x.moveTo(-px * 0.12, -px * 0.17); x.lineTo(px * 0.12, 0); x.lineTo(-px * 0.12, px * 0.17); x.stroke(); x.restore();
  }
  return { map: tex(c), bump: tex(b, false) };
}

export function buildBoard(th, rules) {
  const g = new THREE.Group(), { cellOf, isSafe, N } = rules;
  const { map, bump } = fieldMaps(th, cellOf, isSafe, N);
  const r = rnd(5);
  // the ebony frame wood
  const wc = canvas(512, 256), wx = wc.getContext('2d'), wg = wx.createLinearGradient(0, 0, 512, 256); wg.addColorStop(0, th.frame[0]); wg.addColorStop(1, th.frame[1]); wx.fillStyle = wg; wx.fillRect(0, 0, 512, 256);
  for (let i = 0; i < 70; i++) { wx.strokeStyle = r() > 0.5 ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.25)'; wx.lineWidth = 1 + r() * 2; wx.beginPath(); const y0 = r() * 256; wx.moveTo(0, y0); wx.bezierCurveTo(170, y0 + (r() - 0.5) * 12, 340, y0 + (r() - 0.5) * 12, 512, y0 + (r() - 0.5) * 8); wx.stroke(); }
  const wood = new THREE.MeshPhysicalMaterial({ map: tex(wc, true, [1, 1]), roughness: 0.38, clearcoat: 0.55, clearcoatRoughness: 0.3, metalness: 0.05 });
  const brass = new THREE.MeshStandardMaterial({ color: new THREE.Color(th.inlay), metalness: 1, roughness: 0.28 });
  const base = new THREE.Mesh(roundedBox(BW, 0.9, BH, 0.5), wood); base.position.y = 0.5; base.castShadow = base.receiveShadow = true; g.add(base);
  const field = new THREE.Mesh(box(SQ * COLS, 0.5, SQ * ROWS), new THREE.MeshStandardMaterial({ map, bumpMap: bump, bumpScale: 0.35, roughness: 0.8, metalness: 0 }));
  field.position.y = TOP - 0.25; field.receiveShadow = true; g.add(field);
  // raised frame: four bars, a brass inlay line set in each
  const FW = BM, fy = TOP + 0.05 + (FRAME_TOP - TOP) / 2, fh = 0.45;
  const bars = [[BW, FW, 0, (BH - FW) / 2], [BW, FW, 0, -(BH - FW) / 2], [FW, BH - 2 * FW, (BW - FW) / 2, 0], [FW, BH - 2 * FW, -(BW - FW) / 2, 0]];
  for (const [w, d, x, z] of bars) { const m = new THREE.Mesh(roundedBox(w, fh, d, 0.18, 2), wood); m.position.set(x, TOP - 0.12, z); m.castShadow = m.receiveShadow = true; g.add(m); }
  const inl = [[SQ * COLS + 0.6, 0.22, 0, SQ * ROWS / 2 + 0.2], [SQ * COLS + 0.6, 0.22, 0, -SQ * ROWS / 2 - 0.2], [0.22, SQ * ROWS + 0.6, SQ * COLS / 2 + 0.2, 0], [0.22, SQ * ROWS + 0.6, -SQ * COLS / 2 - 0.2, 0]];
  for (const [w, d, x, z] of inl) { const m = new THREE.Mesh(box(w, 0.1, d), brass); m.position.set(x, FRAME_TOP + 0.06, z); g.add(m); }
  // brass studs in the corners of the frame
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) { const s = new THREE.Mesh(new THREE.SphereGeometry(0.34, 12, 8, 0, 7, 0, 1.6), brass); s.position.set(sx * (BW / 2 - BM / 2), FRAME_TOP + 0.02, sz * (BH / 2 - BM / 2)); g.add(s); }
  // exit arrows: small brass chevrons in the frame at the far end of each run (left side)
  for (const row of [0, ROWS - 1]) {
    const sh = new THREE.Shape(); sh.moveTo(0.35, -0.55); sh.lineTo(-0.35, 0); sh.lineTo(0.35, 0.55); sh.closePath();
    const a = new THREE.Mesh(new THREE.ExtrudeGeometry(sh, { depth: 0.12, bevelEnabled: false }), row === 0 ? new THREE.MeshStandardMaterial({ color: 0xf4ead0, roughness: 0.4 }) : new THREE.MeshStandardMaterial({ color: new THREE.Color(th.dark.hi), roughness: 0.4 }));
    a.rotation.x = -Math.PI / 2; a.position.set(-(SQ * COLS / 2 + BM / 2), FRAME_TOP + 0.01, (1.5 - row) * SQ); g.add(a);
  }
  g.userData.dispose = () => { g.traverse((o) => { o.geometry?.dispose?.(); if (o.material) [].concat(o.material).forEach((m) => { m.map?.dispose?.(); m.bumpMap?.dispose?.(); m.dispose(); }); }); };
  return g;
}

// ------------------------------------------------------------------------------------------------ stones
export function stoneGeos() {
  const prof = [[0, 0], [SR * 0.96, 0], [SR, 0.08], [SR * 1.0, SH * 0.42], [SR * 0.93, SH * 0.72], [SR * 0.74, SH * 0.94], [SR * 0.52, SH * 1.0], [SR * 0.34, SH * 0.9], [0.01, SH * 0.84]];
  const pts = prof.map(([x, y]) => new THREE.Vector2(x, y));
  const g = new THREE.LatheGeometry(pts, 40);
  return g;
}
function fluteTex(flutes) { const c = canvas(256, 64), x = c.getContext('2d'); x.fillStyle = '#808080'; x.fillRect(0, 0, 256, 64); for (let i = 0; i < flutes; i++) { const u = (i + 0.5) / flutes * 256, g = x.createLinearGradient(u - 256 / flutes / 2, 0, u + 256 / flutes / 2, 0); g.addColorStop(0, '#404040'); g.addColorStop(0.5, '#d8d8d8'); g.addColorStop(1, '#404040'); x.fillStyle = g; x.fillRect(u - 256 / flutes / 2, 0, 256 / flutes, 64); } const t = tex(c, false); t.wrapS = THREE.RepeatWrapping; return t; }
export function stoneMaterials(th) {
  const ivory = new THREE.MeshPhysicalMaterial({ color: new THREE.Color(th.light.base), roughness: 0.32, clearcoat: 0.7, clearcoatRoughness: 0.25, bumpMap: fluteTex(18), bumpScale: 0.9, sheen: 0.4 });
  const clay = new THREE.MeshPhysicalMaterial({ color: new THREE.Color(th.dark.base), roughness: 0.55, clearcoat: 0.25, clearcoatRoughness: 0.5, bumpMap: fluteTex(9), bumpScale: 0.35 });
  return { 1: ivory, 2: clay };
}
export function setStoneTheme(m, th) { m[1].color.set(th.light.base); m[2].color.set(th.dark.base); }

// ------------------------------------------------------------------------------------------------ sticks
function stickMats(th) {
  const bc = canvas(128, 256), bx = bc.getContext('2d'), r = rnd(3), bg = bx.createLinearGradient(0, 0, 128, 0); bg.addColorStop(0, th.bark[0]); bg.addColorStop(0.5, th.bark[1]); bg.addColorStop(1, th.bark[0]); bx.fillStyle = bg; bx.fillRect(0, 0, 128, 256);
  for (let i = 0; i < 40; i++) { bx.strokeStyle = 'rgba(20,8,0,0.35)'; bx.lineWidth = 1 + r() * 1.5; bx.beginPath(); const u = r() * 128; bx.moveTo(u, 0); bx.bezierCurveTo(u + 6, 80, u - 6, 170, u + 2, 256); bx.stroke(); }
  const fc = canvas(128, 512), fx = fc.getContext('2d'); fx.fillStyle = th.stickFlat; fx.fillRect(0, 0, 128, 512);
  fx.fillStyle = th.notch; for (const t of [0.2, 0.5, 0.8]) { fx.fillRect(14, t * 512 - 12, 100, 6); fx.fillRect(14, t * 512 + 4, 100, 6); }
  fx.globalAlpha = 0.5; fx.fillRect(14, 28, 100, 4); fx.fillRect(14, 480, 100, 4);
  return {
    bark: new THREE.MeshStandardMaterial({ map: tex(bc), roughness: 0.55, metalness: 0 }),
    flat: new THREE.MeshStandardMaterial({ map: tex(fc), roughness: 0.6, metalness: 0 }),
    capm: new THREE.MeshStandardMaterial({ color: new THREE.Color(th.stickFlatLo), roughness: 0.7 }),
  };
}
// one stick of length L (cm): half-round rod with a flat carved face. Round side is +y, the flat face lies in the y = 0 plane (faces down at roll 0).
export function buildStick(L, th) {
  const m = stickMats(th), g = new THREE.Group();
  const body = new THREE.Mesh(new THREE.CylinderGeometry(STICK_R, STICK_R, L, 20, 1, true, -Math.PI / 2, Math.PI), m.bark);   // half cylinder, axis along y
  body.rotation.x = -Math.PI / 2;                                                                                       // axis along z; round side faces +y
  body.castShadow = true; body.receiveShadow = true;
  const flat = new THREE.Mesh(new THREE.PlaneGeometry(STICK_R * 2, L), m.flat); flat.rotation.x = Math.PI / 2; flat.castShadow = true;   // normal -y (faces down at roll 0)
  g.add(body, flat);
  for (const s of [-1, 1]) { const cap = new THREE.Mesh(new THREE.CircleGeometry(STICK_R, 20, 0, Math.PI), m.capm); cap.rotation.y = s > 0 ? 0 : Math.PI; cap.position.z = s * L / 2; g.add(cap); }
  g.userData.mats = m;
  return g;
}
export const axisLift = (roll) => { const p = ((roll % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2), a0 = p, a1 = p + Math.PI; const has = (3 * Math.PI / 2 >= a0 && 3 * Math.PI / 2 <= a1) || (7 * Math.PI / 2 >= a0 && 7 * Math.PI / 2 <= a1); return STICK_R * (has ? 1 : Math.abs(Math.sin(p))); };

// ------------------------------------------------------------------------------------------------ trays and mat
export function buildTray(w, d, th) {
  const g = new THREE.Group(), wood = new THREE.MeshPhysicalMaterial({ color: new THREE.Color(th.frame[0]).multiplyScalar(1.25), roughness: 0.42, clearcoat: 0.4 });
  const brass = new THREE.MeshStandardMaterial({ color: new THREE.Color(th.inlay), metalness: 1, roughness: 0.3 });
  const t = 0.7;
  const tr = new THREE.Mesh(roundedBox(w, 1.2, d, 0.3), new THREE.MeshStandardMaterial({ color: new THREE.Color(th.frame[1]).multiplyScalar(1.1), roughness: 0.75 })); tr.position.y = 0.4; tr.castShadow = tr.receiveShadow = true; g.add(tr);
  for (const [bw, bd, x, z] of [[w, t, 0, (d - t) / 2], [w, t, 0, -(d - t) / 2], [t, d - 2 * t, (w - t) / 2, 0], [t, d - 2 * t, -(w - t) / 2, 0]]) { const b = new THREE.Mesh(roundedBox(bw, 0.5, bd, 0.15, 2), wood); b.position.set(x, 1.8, z); b.castShadow = b.receiveShadow = true; g.add(b); }
  for (const sz of [-1, 1]) { const b = new THREE.Mesh(box(w - 0.6, 0.06, 0.16), brass); b.position.set(0, 2.47, sz * (d / 2 - t / 2)); g.add(b); }
  g.userData.rim = new THREE.Mesh(box(w - 0.2, 0.06, d - 0.2), new THREE.MeshBasicMaterial({ color: new THREE.Color(th.accent), transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false }));
  g.userData.rim.position.y = 1.98; g.add(g.userData.rim);
  return g;
}
export function buildSocketPlate(r) {
  const m = new THREE.Mesh(new THREE.CylinderGeometry(r, r * 0.9, 0.3, 24), new THREE.MeshStandardMaterial({ color: 0x120b07, roughness: 0.9 })); return m;
}
export function buildMat(w, d, th) {
  const g = new THREE.Group(), c = canvas(512, Math.max(64, Math.round(512 * d / w))), x = c.getContext('2d'), r = rnd(9);
  const gr = x.createLinearGradient(0, 0, c.width, c.height); gr.addColorStop(0, th.felt[0]); gr.addColorStop(1, th.felt[1]); x.fillStyle = gr; x.fillRect(0, 0, c.width, c.height);
  for (let i = 0; i < 5000; i++) { x.fillStyle = `rgba(${th.feltFleck},${0.04 + r() * 0.08})`; x.fillRect(r() * c.width, r() * c.height, 1.2, 1.2 + r() * 2); }
  x.strokeStyle = `rgba(${th.feltFleck},0.18)`; x.lineWidth = 2; x.beginPath(); x.ellipse(c.width / 2, c.height / 2, c.height * 0.34, c.height * 0.34, 0, 0, 7); x.stroke();
  const felt = new THREE.MeshStandardMaterial({ map: tex(c), roughness: 1, metalness: 0 });
  const slab = new THREE.Mesh(roundedBox(w, 0.5, d, 0.9), felt); slab.receiveShadow = true; g.add(slab);
  const brass = new THREE.MeshStandardMaterial({ color: new THREE.Color(th.feltEdge), metalness: 1, roughness: 0.32 });
  const e = 0.45; for (const [bw, bd, x0, z0] of [[w, e, 0, d / 2 - e / 2], [w, e, 0, -d / 2 + e / 2], [e, d, w / 2 - e / 2, 0], [e, d, -w / 2 + e / 2, 0]]) { const b = new THREE.Mesh(box(bw, 0.12, bd), brass); b.position.set(x0, 0.8, z0); g.add(b); }
  return g;
}

// ------------------------------------------------------------------------------------------------ environment
function kilimTex() {
  const W = 1024, c = canvas(W), x = c.getContext('2d'), r = rnd(21);
  x.fillStyle = '#6b2a1c'; x.fillRect(0, 0, W, W);
  const cols = ['#b5502c', '#e6c98d', '#1d3a5c', '#2f6a60', '#3a1710'];
  const band = (y0, h, k) => { const n = 22, w = W / n; for (let i = 0; i < n; i++) { x.fillStyle = cols[(i + k) % cols.length]; x.beginPath(); x.moveTo(i * w, y0 + h / 2); x.lineTo(i * w + w / 2, y0); x.lineTo((i + 1) * w, y0 + h / 2); x.lineTo(i * w + w / 2, y0 + h); x.closePath(); x.fill(); } };
  // field medallions
  for (let j = 0; j < 4; j++) for (let i = 0; i < 4; i++) {
    const cx = 128 + i * 256, cy = 128 + j * 256;
    for (const [rad, col] of [[96, '#3a1710'], [78, '#b5502c'], [58, '#e6c98d'], [38, '#1d3a5c'], [18, '#b5502c']]) { x.fillStyle = col; x.beginPath(); for (let k = 0; k < 8; k++) { const a = k * Math.PI / 4 + Math.PI / 8; x.lineTo(cx + Math.cos(a) * rad, cy + Math.sin(a) * rad * (k % 2 ? 1 : 1)); } x.closePath(); x.fill(); }
  }
  band(0, 70, 0); band(W - 70, 70, 2);
  x.save(); x.translate(0, W); x.rotate(-Math.PI / 2); band(0, 70, 1); x.restore(); x.save(); x.translate(W, 0); x.rotate(Math.PI / 2); band(0, 70, 3); x.restore();
  for (let i = 0; i < 26000; i++) { x.fillStyle = r() > 0.5 ? 'rgba(255,230,190,0.08)' : 'rgba(0,0,0,0.12)'; x.fillRect(r() * W, r() * W, 1.5, 1.5 + r() * 3); }
  const b = canvas(256), bx = b.getContext('2d'); bx.fillStyle = '#808080'; bx.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 4000; i++) { bx.fillStyle = r() > 0.5 ? '#a0a0a0' : '#606060'; bx.fillRect(r() * 256, r() * 256, 1.2, 2.5); }
  return { map: tex(c, true, [1, 1]), bump: tex(b, false, [8, 8]) };
}
function tentTex() {
  const c = canvas(512, 256), x = c.getContext('2d'), r = rnd(4);
  x.fillStyle = '#1b1612'; x.fillRect(0, 0, 512, 256);
  for (let i = 0; i < 8; i++) { x.fillStyle = i % 2 ? '#2b221b' : '#14100d'; x.fillRect(i * 64, 0, 64, 256); }
  for (const y of [40, 216]) { x.fillStyle = '#b5502c'; x.fillRect(0, y, 512, 8); x.fillStyle = '#e6c98d'; x.fillRect(0, y + 10, 512, 3); }
  for (let i = 0; i < 9000; i++) { x.fillStyle = `rgba(255,235,200,${r() * 0.05})`; x.fillRect(r() * 512, r() * 256, 1, 3); }
  return tex(c, true, [3, 1]);
}
function skyTex() {
  const c = canvas(1024, 512), x = c.getContext('2d'), g = x.createLinearGradient(0, 0, 0, 512); g.addColorStop(0, '#050a1a'); g.addColorStop(0.6, '#142446'); g.addColorStop(0.9, '#5b3a4a'); g.addColorStop(1, '#8a5a40'); x.fillStyle = g; x.fillRect(0, 0, 1024, 512);
  const r = rnd(77); for (let i = 0; i < 260; i++) { x.fillStyle = `rgba(255,248,225,${0.2 + r() * 0.7})`; const s = r() * 1.8 + 0.4; x.fillRect(r() * 1024, r() * 300, s, s); }
  x.fillStyle = '#f3e6c0'; x.beginPath(); x.arc(780, 110, 26, 0, 7); x.fill(); x.fillStyle = '#142446'; x.beginPath(); x.arc(792, 104, 24, 0, 7); x.fill();
  x.fillStyle = '#2a1c26'; x.beginPath(); x.moveTo(0, 512); for (let i = 0; i <= 64; i++) x.lineTo(i * 16, 420 + Math.sin(i * 0.31) * 26 + Math.sin(i * 0.9) * 8); x.lineTo(1024, 512); x.fill();
  x.fillStyle = '#1a121c'; x.beginPath(); x.moveTo(0, 512); for (let i = 0; i <= 64; i++) x.lineTo(i * 16, 460 + Math.sin(i * 0.23 + 2) * 20); x.lineTo(1024, 512); x.fill();
  return tex(c);
}
export function buildTent(scene) {
  const g = new THREE.Group();
  const { map, bump } = kilimTex();
  const rug = new THREE.Mesh(new THREE.PlaneGeometry(190, 190), new THREE.MeshStandardMaterial({ map, bumpMap: bump, bumpScale: 0.5, roughness: 1, color: 0x8a7a70 }));
  rug.rotation.x = -Math.PI / 2; rug.position.y = 0.01; rug.receiveShadow = true; g.add(rug);
  // fringe
  const fr = new THREE.Mesh(new THREE.PlaneGeometry(196, 196), new THREE.MeshStandardMaterial({ color: 0x120a07, roughness: 1 })); fr.rotation.x = -Math.PI / 2; fr.position.y = -0.02; g.add(fr);
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(1600, 1600), new THREE.MeshStandardMaterial({ color: 0x2a1c16, roughness: 1 })); ground.rotation.x = -Math.PI / 2; ground.position.y = -0.1; g.add(ground);
  const tt = tentTex();
  const cloth = new THREE.MeshStandardMaterial({ map: tt, roughness: 0.95, side: THREE.DoubleSide });
  for (const [x, z, ry, w] of [[-100, -30, Math.PI / 2, 220], [100, -30, -Math.PI / 2, 220]]) { const m = new THREE.Mesh(new THREE.PlaneGeometry(w, 70), cloth); m.position.set(x, 35, z); m.rotation.y = ry; g.add(m); }
  // back wall with an opening on to the night
  const back = [[-95, 0, 84], [95, 0, 84]]; for (const [x, , w] of back) { const m = new THREE.Mesh(new THREE.PlaneGeometry(w, 70), cloth); m.position.set(x * 0.74 - (x < 0 ? 4 : -4), 35, -130); g.add(m); }
  const sky = new THREE.Mesh(new THREE.PlaneGeometry(520, 260), new THREE.MeshBasicMaterial({ map: skyTex(), fog: false })); sky.position.set(0, 110, -420); g.add(sky);
  // roof edge catenary beam and poles
  const poleM = new THREE.MeshStandardMaterial({ color: 0x4a2c18, roughness: 0.6 });
  for (const x of [-90, 90]) { const p = new THREE.Mesh(new THREE.CylinderGeometry(1.6, 1.9, 90, 12), poleM); p.position.set(x, 45, -105); p.castShadow = true; g.add(p); }
  const beam = new THREE.Mesh(new THREE.CylinderGeometry(1.2, 1.2, 140, 10), poleM); beam.rotation.z = Math.PI / 2; beam.position.set(0, 88, -105); g.add(beam);
  // bolster cushions in kilim stripes
  const cc = canvas(256, 128), cx = cc.getContext('2d'); ['#b5502c', '#e6c98d', '#1d3a5c', '#2f6a60'].forEach((c, i) => { cx.fillStyle = c; cx.fillRect(i * 64, 0, 64, 128); cx.fillStyle = 'rgba(0,0,0,0.25)'; cx.fillRect(i * 64 + 28, 0, 8, 128); });
  const cush = new THREE.MeshStandardMaterial({ map: tex(cc), roughness: 0.95 });
  void cush;
  scene.add(g);
  return g;
}
export function buildLantern() {
  const g = new THREE.Group(), brass = new THREE.MeshStandardMaterial({ color: 0xc89a3c, metalness: 1, roughness: 0.3 });
  const body = new THREE.Mesh(new THREE.CylinderGeometry(4.2, 5.2, 13, 8, 1, true), new THREE.MeshStandardMaterial({ color: 0xc89a3c, metalness: 1, roughness: 0.35, side: THREE.DoubleSide, emissive: 0x6a3a08, emissiveIntensity: 0.9 }));
  body.position.y = 12; g.add(body);
  const base = new THREE.Mesh(new THREE.CylinderGeometry(5.6, 6.4, 3.6, 8), brass); base.position.y = 2.4; g.add(base);
  const foot = new THREE.Mesh(new THREE.CylinderGeometry(6.8, 7.2, 0.8, 16), brass); foot.position.y = 0.4; g.add(foot);
  const top = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 5.4, 5, 8), brass); top.position.y = 20.2; g.add(top);
  const ring = new THREE.Mesh(new THREE.TorusGeometry(2, 0.35, 8, 16), brass); ring.position.y = 24; g.add(ring);
  // pierced slots: glowing windows
  const win = new THREE.MeshBasicMaterial({ color: 0xffc070, fog: false });
  for (let i = 0; i < 8; i++) for (const y of [8.6, 12, 15.4]) { const w = new THREE.Mesh(new THREE.PlaneGeometry(1.4, 2.2), win); const a = i / 8 * Math.PI * 2 + Math.PI / 8, r = 4.75 + (y < 10 ? 0.35 : y < 14 ? 0 : -0.25) * -1; w.position.set(Math.cos(a) * r * 0.98, y, Math.sin(a) * r * 0.98); w.rotation.y = -a + Math.PI / 2; g.add(w); }
  const flame = new THREE.Mesh(new THREE.SphereGeometry(1.6, 12, 10), new THREE.MeshBasicMaterial({ color: 0xffd9a0, fog: false })); flame.position.y = 11; flame.scale.set(0.8, 1.6, 0.8); g.add(flame);
  const light = new THREE.PointLight(0xffa850, 2200, 260, 1.6); light.position.y = 12; g.add(light);
  const halo = new THREE.Mesh(new THREE.PlaneGeometry(46, 46), new THREE.MeshBasicMaterial({ map: radialTex('255,200,120', 0.95), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false })); halo.position.y = 12; g.add(halo);
  g.userData = { light, flame, halo };
  g.traverse((o) => { if (o.isMesh && o !== halo && o !== flame) o.castShadow = true; });
  return g;
}
export function buildLights(scene) {
  const hemi = new THREE.HemisphereLight(0x6f86c0, 0x4a2a1a, 0.55); scene.add(hemi);
  const sun = new THREE.DirectionalLight(0xffcf94, 2.3); sun.position.set(-48, 110, 58);
  sun.shadow.camera.left = -42; sun.shadow.camera.right = 42; sun.shadow.camera.top = 56; sun.shadow.camera.bottom = -56; sun.shadow.camera.near = 20; sun.shadow.camera.far = 320;
  sun.shadow.bias = -0.0005; sun.shadow.normalBias = 0.04; sun.shadow.radius = 4; scene.add(sun); scene.add(sun.target);
  const rim = new THREE.DirectionalLight(0x86a6ff, 0.7); rim.position.set(70, 60, -150); scene.add(rim);
  return { hemi, sun, rim };
}
