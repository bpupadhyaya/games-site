// Baloot 3D world (presentation only; no game logic). Units are centimetres, y up, the player sits on the +z side looking toward -z.
// A night diwaniya: a low date-palm table with a recessed indigo Sadu-woven cloth, lit by hanging brass lanterns, on an indigo and ochre rug;
// floor cushions and bolsters, a brass dallah with finjan cups on a tray, an incense burner. Everything is procedural (canvas textures,
// lathe / extrude geometry), no image files. Props are about 0.6 of real size next to the cards (the cards are drawn about 1.8x real
// size so they stay readable at phone size).
import * as THREE from '../vendor3d/three.js';

export const CARD_W = 11, CARD_H = 15.4, CARD_T = 0.16;
export const CLOTH_Y = 7.34, RIM_TOP = 8.6;
const TAU = Math.PI * 2;
export const hash = (a, b = 0) => { let h = (Math.imul(a | 0, 374761393) + Math.imul(b | 0, 668265263)) | 0; h = Math.imul(h ^ (h >>> 13), 1274126177); return ((h ^ (h >>> 16)) >>> 0) / 4294967295; };
const lcg = (seed) => { let s = seed >>> 0; return () => ((s = (Math.imul(s, 1664525) + 1013904223) >>> 0) / 4294967296); };
const cv = (w, h = w) => { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; };
const texOf = (c, srgb = true, rep = null) => { const t = new THREE.CanvasTexture(c); if (srgb) t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8; if (rep) { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(rep[0], rep[1]); } return t; };

export const PAL = { indigo: '#16275a', indigoD: '#0c1633', indigoL: '#2b4690', ochre: '#d9a441', ivory: '#f1e6c8', crimson: '#a3262f', teal: '#2a8c8a', wood: '#3a2212', woodL: '#6a4425', brass: '#d6a64a' };

// ------------------------------------------------------------------------------------------ textures
export function radialTex(rgb, a = 1, size = 128) {
  const c = cv(size), x = c.getContext('2d'), g = x.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  g.addColorStop(0, `rgba(${rgb},${a})`); g.addColorStop(0.45, `rgba(${rgb},${a * 0.5})`); g.addColorStop(1, `rgba(${rgb},0)`);
  x.fillStyle = g; x.fillRect(0, 0, size, size); return texOf(c);
}
function grain(x, w, h, c0, c1, seed, lines) {
  const r = lcg(seed); x.fillStyle = c0; x.fillRect(0, 0, w, h);
  for (let i = 0; i < lines; i++) {
    const p = r() * h, amp = 2 + r() * 8, f = 0.002 + r() * 0.008, ph = r() * TAU;
    x.strokeStyle = r() < 0.55 ? c1 : 'rgba(0,0,0,0.25)'; x.globalAlpha = 0.07 + r() * 0.2; x.lineWidth = 0.6 + r() * 2.4; x.beginPath();
    for (let t = 0; t <= w; t += 10) x.lineTo(t, p + Math.sin(t * f + ph) * amp + Math.sin(t * f * 3.3 + ph) * amp * 0.3);
    x.stroke();
  }
  x.globalAlpha = 1;
}
// a Sadu-style woven band: a row of triangles / diamonds between pin-stripes. (x, y, w, h) in px; cell = tooth width
function saduBand(g, x, y, w, h, cell, cols) {
  g.save(); g.beginPath(); g.rect(x, y, w, h); g.clip();
  g.fillStyle = cols[0]; g.fillRect(x, y, w, h);
  const n = Math.ceil(w / cell) + 1;
  for (let i = 0; i < n; i++) {
    const cx = x + i * cell; g.fillStyle = cols[1];
    g.beginPath(); g.moveTo(cx - cell / 2, y + h); g.lineTo(cx, y + h * 0.12); g.lineTo(cx + cell / 2, y + h); g.closePath(); g.fill();
    g.fillStyle = cols[2 + (i & 1)]; g.beginPath(); g.moveTo(cx - cell * 0.22, y + h); g.lineTo(cx, y + h * 0.48); g.lineTo(cx + cell * 0.22, y + h); g.closePath(); g.fill();
  }
  g.fillStyle = cols[4]; g.fillRect(x, y, w, h * 0.09); g.fillRect(x, y + h * 0.91, w, h * 0.09);
  g.restore();
}
// the indigo cloth on the table (px per cm = k): tone-on-tone diamond lattice, a woven Sadu border, pin-stripe, light weave
function clothCanvas(tw, tl, k) {
  const w = Math.round(tw * k), h = Math.round(tl * k), c = cv(w, h), x = c.getContext('2d'), r = lcg(5);
  const g = x.createRadialGradient(w / 2, h / 2, Math.min(w, h) * 0.08, w / 2, h / 2, Math.max(w, h) * 0.62); g.addColorStop(0, '#223a82'); g.addColorStop(0.6, '#172a60'); g.addColorStop(1, '#0d1840');
  x.fillStyle = g; x.fillRect(0, 0, w, h);
  // diamond lattice
  const step = 5.2 * k; x.strokeStyle = 'rgba(150,170,255,0.07)'; x.lineWidth = 0.16 * k;
  for (let i = -h; i < w + h; i += step) { x.beginPath(); x.moveTo(i, 0); x.lineTo(i + h, h); x.stroke(); x.beginPath(); x.moveTo(i, h); x.lineTo(i + h, 0); x.stroke(); }
  // central lozenge chain (very quiet: the trick cards lie on it)
  x.save(); x.translate(w / 2, h / 2); x.strokeStyle = 'rgba(217,164,65,0.20)'; x.lineWidth = 0.28 * k;
  for (const s of [0.5, 0.38, 0.26]) { x.beginPath(); x.moveTo(0, -h * s); x.lineTo(w * s * 0.92, 0); x.lineTo(0, h * s); x.lineTo(-w * s * 0.92, 0); x.closePath(); x.stroke(); }
  x.restore();
  // weave
  x.globalAlpha = 0.07; for (let i = 0; i < h; i += 2) { x.fillStyle = (i & 2) ? '#fff' : '#000'; x.fillRect(0, i, w, 1); }
  for (let i = 0; i < w; i += 2) { x.fillStyle = (i & 2) ? '#fff' : '#000'; x.fillRect(i, 0, 1, h); }
  x.globalAlpha = 1; for (let i = 0; i < 2400; i++) { x.fillStyle = `rgba(${r() < 0.5 ? '255,255,255' : '0,0,0'},0.04)`; x.fillRect(r() * w, r() * h, 3, 1); }
  // border: pin-stripe + Sadu band on all four sides
  const m = 2.2 * k, bh = 3.2 * k, cell = 2.4 * k, cols = ['#0e1736', PAL.ochre, PAL.crimson, PAL.ivory, '#e9d7a0'];
  const side = (len, draw) => draw(len);
  void side;
  const band = (len) => { saduBand(x, 0, 0, len, bh, cell, cols); x.fillStyle = 'rgba(241,230,200,0.7)'; x.fillRect(0, bh + 0.5 * k, len, 0.22 * k); };
  x.save(); x.translate(m, m); band(w - 2 * m); x.restore();
  x.save(); x.translate(w - m, h - m); x.rotate(Math.PI); band(w - 2 * m); x.restore();
  x.save(); x.translate(w - m, m); x.rotate(Math.PI / 2); band(h - 2 * m); x.restore();
  x.save(); x.translate(m, h - m); x.rotate(-Math.PI / 2); band(h - 2 * m); x.restore();
  x.strokeStyle = 'rgba(241,230,200,0.5)'; x.lineWidth = 0.2 * k; x.strokeRect(m + bh + 1.4 * k, m + bh + 1.4 * k, w - 2 * (m + bh + 1.4 * k), h - 2 * (m + bh + 1.4 * k));
  const v = x.createRadialGradient(w / 2, h / 2, Math.min(w, h) * 0.25, w / 2, h / 2, Math.max(w, h) * 0.75); v.addColorStop(0, 'rgba(0,0,0,0)'); v.addColorStop(1, 'rgba(0,0,8,0.35)'); x.fillStyle = v; x.fillRect(0, 0, w, h);
  return c;
}
function rimCanvas(W, L, k, R) {
  const w = Math.round(W * k), h = Math.round(L * k), c = cv(w, h), x = c.getContext('2d');
  grain(x, w, h, PAL.wood, PAL.woodL, 11, 260);
  x.strokeStyle = PAL.brass; x.lineWidth = 0.36 * k; x.strokeRect(R * 0.42 * k, R * 0.42 * k, w - 2 * R * 0.42 * k, h - 2 * R * 0.42 * k);
  x.strokeStyle = 'rgba(214,166,74,0.55)'; x.lineWidth = 0.14 * k; x.strokeRect(R * 0.66 * k, R * 0.66 * k, w - 2 * R * 0.66 * k, h - 2 * R * 0.66 * k);
  // mother-of-pearl pins along the brass line
  x.fillStyle = 'rgba(245,238,220,0.85)'; const pin = (px, py) => { x.beginPath(); x.arc(px, py, 0.34 * k, 0, TAU); x.fill(); };
  const o = R * 0.42 * k; for (let t = 6 * k; t < w - 5 * k; t += 6 * k) { pin(t, o); pin(t, h - o); } for (let t = 6 * k; t < h - 5 * k; t += 6 * k) { pin(o, t); pin(w - o, t); }
  return c;
}
function rugCanvas() {
  const S = 1024, c = cv(S), x = c.getContext('2d'), r = lcg(9);
  x.fillStyle = '#8a5b2c'; x.fillRect(0, 0, S, S);
  for (let i = 0; i < 9000; i++) { x.fillStyle = `rgba(${r() < 0.5 ? '255,214,150' : '20,6,0'},0.07)`; x.fillRect(r() * S, r() * S, 4, 1.4); }
  // lattice field
  x.strokeStyle = 'rgba(255,226,160,0.16)'; x.lineWidth = 2; for (let i = -S; i < S * 2; i += 64) { x.beginPath(); x.moveTo(i, 0); x.lineTo(i + S, S); x.stroke(); x.beginPath(); x.moveTo(i, S); x.lineTo(i + S, 0); x.stroke(); }
  // concentric woven borders
  const cols = ['#101a44', '#2b4690', PAL.crimson, PAL.ivory, '#e4cf94'];
  const ring = (inset, bh, cell) => {
    x.save(); x.translate(inset, inset); saduBand(x, 0, 0, S - 2 * inset, bh, cell, cols); x.restore();
    x.save(); x.translate(S - inset, S - inset); x.rotate(Math.PI); saduBand(x, 0, 0, S - 2 * inset, bh, cell, cols); x.restore();
    x.save(); x.translate(S - inset, inset); x.rotate(Math.PI / 2); saduBand(x, 0, 0, S - 2 * inset, bh, cell, cols); x.restore();
    x.save(); x.translate(inset, S - inset); x.rotate(-Math.PI / 2); saduBand(x, 0, 0, S - 2 * inset, bh, cell, cols); x.restore();
  };
  ring(26, 52, 44); ring(96, 28, 24);
  x.strokeStyle = 'rgba(16,26,68,0.6)'; x.lineWidth = 5; x.strokeRect(160, 160, S - 320, S - 320);
  // central diamonds
  x.save(); x.translate(S / 2, S / 2); for (const [s, a] of [[330, 0.2], [250, 0.16], [170, 0.14]]) { x.strokeStyle = `rgba(16,26,68,${a + 0.4})`; x.lineWidth = 4; x.beginPath(); x.moveTo(0, -s); x.lineTo(s, 0); x.lineTo(0, s); x.lineTo(-s, 0); x.closePath(); x.stroke(); } x.restore();
  const v = x.createRadialGradient(S / 2, S / 2, S * 0.2, S / 2, S / 2, S * 0.72); v.addColorStop(0, 'rgba(0,0,0,0)'); v.addColorStop(1, 'rgba(0,0,6,0.35)'); x.fillStyle = v; x.fillRect(0, 0, S, S);
  return c;
}
function wallCanvas() {
  const w = 1024, h = 512, c = cv(w, h), x = c.getContext('2d'), r = lcg(4);
  const g = x.createLinearGradient(0, 0, 0, h); g.addColorStop(0, '#3a2a3c'); g.addColorStop(0.55, '#6a4a40'); g.addColorStop(1, '#9a7452'); x.fillStyle = g; x.fillRect(0, 0, w, h);
  for (let i = 0; i < 6000; i++) { x.fillStyle = `rgba(${r() < 0.5 ? '255,235,200' : '0,0,0'},0.03)`; x.fillRect(r() * w, r() * h, 6 + r() * 14, 2); }
  // three pointed arches with a lit shelf in each
  for (const cx of [170, 512, 854]) {
    x.beginPath(); x.moveTo(cx - 92, h); x.lineTo(cx - 92, 230); x.quadraticCurveTo(cx - 92, 110, cx, 66); x.quadraticCurveTo(cx + 92, 110, cx + 92, 230); x.lineTo(cx + 92, h); x.closePath();
    const gi = x.createLinearGradient(0, 60, 0, h); gi.addColorStop(0, '#1a1426'); gi.addColorStop(1, '#4b2e22'); x.fillStyle = gi; x.fill(); x.strokeStyle = 'rgba(217,164,65,0.7)'; x.lineWidth = 4; x.stroke();
    x.fillStyle = 'rgba(255,190,100,0.16)'; x.beginPath(); x.ellipse(cx, 380, 70, 110, 0, 0, TAU); x.fill();
    x.fillStyle = PAL.brass; x.fillRect(cx - 60, 392, 120, 8);
  }
  // woven hanging band at the foot of the wall
  const cols = ['#0d1535', PAL.ochre, PAL.crimson, PAL.ivory, '#e4cf94']; saduBand(x, 0, h - 64, w, 64, 40, cols);
  return c;
}
const stripeCanvas = (c0, c1, c2, seed) => {
  const S = 256, c = cv(S), x = c.getContext('2d'), r = lcg(seed); x.fillStyle = c0; x.fillRect(0, 0, S, S);
  for (let i = 0; i < S; i += 32) { x.fillStyle = c1; x.fillRect(i, 0, 12, S); x.fillStyle = c2; x.fillRect(i + 13, 0, 2, S); }
  for (let j = 0; j < S; j += 4) { x.fillStyle = 'rgba(0,0,0,0.08)'; x.fillRect(0, j, S, 1); }
  for (let i = 0; i < 900; i++) { x.fillStyle = 'rgba(255,255,255,0.05)'; x.fillRect(r() * S, r() * S, 3, 1); }
  return c;
};
function lanternCanvas() {
  const w = 256, h = 256, c = cv(w, h), x = c.getContext('2d');
  const g = x.createLinearGradient(0, 0, 0, h); g.addColorStop(0, '#ffe39a'); g.addColorStop(1, '#ffb347'); x.fillStyle = g; x.fillRect(0, 0, w, h);
  x.fillStyle = '#4a2a0a'; // pierced pattern: dark brass web with glowing holes
  for (let j = 0; j < 6; j++) for (let i = 0; i < 8; i++) {
    const cx = i * 32 + (j & 1 ? 16 : 0), cy = j * 42 + 21; x.beginPath(); x.moveTo(cx - 16, cy); x.lineTo(cx, cy - 20); x.lineTo(cx + 16, cy); x.lineTo(cx, cy + 20); x.closePath();
    x.lineWidth = 5; x.strokeStyle = '#5a3410'; x.stroke();
  }
  x.fillStyle = '#5a3410'; for (let j = 0; j < 6; j++) for (let i = 0; i < 8; i++) { x.beginPath(); x.arc(i * 32 + (j & 1 ? 16 : 0), j * 42 + 21, 3, 0, TAU); x.fill(); }
  x.fillRect(0, 0, w, 10); x.fillRect(0, h - 10, w, 10);
  return c;
}

// ------------------------------------------------------------------------------------------ materials
export function makeMats() {
  const M = {};
  M.wood = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.62, metalness: 0.05, map: null });
  M.brass = new THREE.MeshStandardMaterial({ color: 0xd6a64a, roughness: 0.3, metalness: 0.92, envMapIntensity: 1.2 });
  M.brassD = new THREE.MeshStandardMaterial({ color: 0x9a6a24, roughness: 0.4, metalness: 0.85 });
  M.porcelain = new THREE.MeshStandardMaterial({ color: 0xf4ead4, roughness: 0.25, metalness: 0.0 });
  M.lantern = new THREE.MeshBasicMaterial({ map: texOf(lanternCanvas()), side: THREE.DoubleSide, fog: false });
  M.copper = new THREE.MeshStandardMaterial({ color: 0xb8683a, roughness: 0.34, metalness: 0.9 });
  M.dark = new THREE.MeshStandardMaterial({ color: 0x1a1210, roughness: 0.7 });
  return M;
}
// ------------------------------------------------------------------------------------------ geometry helpers
function rrShape(w, l, r) {
  const s = new THREE.Shape(), x = -w / 2, y = -l / 2; s.moveTo(x + r, y); s.lineTo(x + w - r, y); s.absarc(x + w - r, y + r, r, -Math.PI / 2, 0); s.lineTo(x + w, y + l - r); s.absarc(x + w - r, y + l - r, r, 0, Math.PI / 2);
  s.lineTo(x + r, y + l); s.absarc(x + r, y + l - r, r, Math.PI / 2, Math.PI); s.lineTo(x, y + r); s.absarc(x + r, y + r, r, Math.PI, Math.PI * 1.5); return s;
}
function rrPath(w, l, r) { const p = new THREE.Path(), x = -w / 2, y = -l / 2; p.moveTo(x + r, y); p.lineTo(x + w - r, y); p.absarc(x + w - r, y + r, r, -Math.PI / 2, 0); p.lineTo(x + w, y + l - r); p.absarc(x + w - r, y + l - r, r, 0, Math.PI / 2); p.lineTo(x + r, y + l); p.absarc(x + r, y + l - r, r, Math.PI / 2, Math.PI); p.lineTo(x, y + r); p.absarc(x + r, y + r, r, Math.PI, Math.PI * 1.5); return p; }
// remap extrude UVs (shape cm) to 0..1 over (W, L) so one canvas texture covers the whole top
function uvBox(geo, W, L) { const uv = geo.attributes.uv, p = geo.attributes.position; for (let i = 0; i < uv.count; i++) uv.setXY(i, p.getX(i) / W + 0.5, p.getY(i) / L + 0.5); uv.needsUpdate = true; }
const lathe = (pts, seg = 40) => new THREE.LatheGeometry(pts.map(([r, y]) => new THREE.Vector2(r, y)), seg);
const shadowed = (m, cast = true, recv = true) => { m.castShadow = cast; m.receiveShadow = recv; return m; };

// ------------------------------------------------------------------------------------------ the table (per orientation)
export function makeTable(tw, tl, M) {
  const g = new THREE.Group(), R = 5.6, W = tw + 2 * R, L = tl + 2 * R, k = 7, BODY = 4.3, Y0 = 3;
  const rimTex = texOf(rimCanvas(W, L, k, R)), clothTex = texOf(clothCanvas(tw, tl, 9)); rimTex.anisotropy = clothTex.anisotropy = 12;
  const rimMat = new THREE.MeshStandardMaterial({ map: rimTex, roughness: 0.5, metalness: 0.05 });
  const sideMat = new THREE.MeshStandardMaterial({ color: 0x2c180c, roughness: 0.55 });
  // body + rim ring
  const outer = rrShape(W, L, 7), bodyGeo = new THREE.ExtrudeGeometry(outer, { depth: BODY, bevelEnabled: false, curveSegments: 14 }); bodyGeo.rotateX(-Math.PI / 2); bodyGeo.translate(0, Y0, 0);
  g.add(shadowed(new THREE.Mesh(bodyGeo, [sideMat, sideMat])));
  const ringShape = rrShape(W, L, 7); ringShape.holes.push(rrPath(tw, tl, 2.4));
  const ringGeo = new THREE.ExtrudeGeometry(ringShape, { depth: RIM_TOP - Y0 - BODY, bevelEnabled: true, bevelThickness: 0.25, bevelSize: 0.25, bevelSegments: 2, curveSegments: 14 }); uvBox(ringGeo, W, L); ringGeo.rotateX(-Math.PI / 2); ringGeo.translate(0, Y0 + BODY, 0);
  g.add(shadowed(new THREE.Mesh(ringGeo, [rimMat, sideMat])));
  // the cloth, recessed
  const clothGeo = new THREE.ShapeGeometry(rrShape(tw, tl, 2.4), 14); uvBox(clothGeo, tw, tl); clothGeo.rotateX(-Math.PI / 2); clothGeo.translate(0, CLOTH_Y, 0);
  const cloth = new THREE.Mesh(clothGeo, new THREE.MeshStandardMaterial({ map: clothTex, roughness: 0.96, metalness: 0 })); cloth.receiveShadow = true; g.add(cloth);
  // brass corner caps and four short turned feet
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
    const cap = shadowed(new THREE.Mesh(new THREE.CylinderGeometry(2.6, 3.0, 1.4, 20), M.brass)); cap.position.set(sx * (W / 2 - 4.6), RIM_TOP + 0.55, sz * (L / 2 - 4.6)); g.add(cap);
    const dome = shadowed(new THREE.Mesh(new THREE.SphereGeometry(1.3, 16, 10, 0, TAU, 0, Math.PI / 2), M.brass)); dome.position.set(cap.position.x, RIM_TOP + 1.2, cap.position.z); g.add(dome);
    const foot = shadowed(new THREE.Mesh(lathe([[0, 0], [3.2, 0], [3.6, 0.6], [2.6, 1.6], [2.2, 3.0]], 18), M.dark)); foot.position.set(sx * (W / 2 - 7), 0, sz * (L / 2 - 7)); g.add(foot);
  }
  g.userData = { W, L };
  return g;
}

// ------------------------------------------------------------------------------------------ props
export function makeDallah(M, s = 1) {
  const g = new THREE.Group();
  const body = shadowed(new THREE.Mesh(lathe([[0, 0], [6.6, 0], [7.2, 0.5], [7.0, 1.6], [5.8, 4.2], [4.7, 7.2], [4.2, 10.5], [4.9, 13.5], [4.6, 15.4], [3.2, 17.0], [2.6, 18.2], [2.9, 18.8], [0, 18.8]], 36), M.brass)); g.add(body);
  for (const [y, r] of [[1.2, 7.1], [10.2, 4.45], [15.4, 4.75]]) { const ring = shadowed(new THREE.Mesh(new THREE.TorusGeometry(r, 0.34, 8, 36), M.brassD)); ring.rotation.x = Math.PI / 2; ring.position.y = y; g.add(ring); }
  const lid = shadowed(new THREE.Mesh(lathe([[0, 18.7], [3.0, 18.7], [2.8, 19.5], [1.8, 20.3], [0.9, 20.8], [0, 20.9]], 24), M.brass)); g.add(lid);
  const fin = shadowed(new THREE.Mesh(new THREE.SphereGeometry(0.85, 14, 10), M.brass)); fin.position.y = 21.5; g.add(fin);
  const spout = new THREE.CatmullRomCurve3([new THREE.Vector3(4.6, 3.8, 0), new THREE.Vector3(8.6, 6.4, 0), new THREE.Vector3(11.8, 12.5, 0), new THREE.Vector3(13.2, 19.8, 0)]);
  g.add(shadowed(new THREE.Mesh(new THREE.TubeGeometry(spout, 20, 1.35, 12), M.brass)));
  const tip = shadowed(new THREE.Mesh(new THREE.CylinderGeometry(1.25, 0.7, 1.8, 14), M.brassD)); tip.position.set(13.25, 20.4, 0); tip.rotation.z = -0.12; g.add(tip);
  const handle = new THREE.CatmullRomCurve3([new THREE.Vector3(-4.1, 15.2, 0), new THREE.Vector3(-8.8, 14.2, 0), new THREE.Vector3(-9.6, 8.5, 0), new THREE.Vector3(-5.2, 4.4, 0)]);
  g.add(shadowed(new THREE.Mesh(new THREE.TubeGeometry(handle, 16, 0.7, 8), M.brassD)));
  g.scale.setScalar(s); return g;
}
export function makeCup(M, s = 1) {
  const g = new THREE.Group();
  g.add(shadowed(new THREE.Mesh(lathe([[0, 0], [1.2, 0], [1.5, 0.5], [2.1, 2.4], [2.3, 3.6], [2.2, 3.6], [2.0, 2.6], [0, 1.0]], 24), M.porcelain)));
  const band = shadowed(new THREE.Mesh(new THREE.TorusGeometry(2.25, 0.16, 6, 28), M.brass)); band.rotation.x = Math.PI / 2; band.position.y = 3.55; g.add(band);
  g.scale.setScalar(s); return g;
}
export function makeTray(M, s = 1, withSet = true) {
  const g = new THREE.Group();
  g.add(shadowed(new THREE.Mesh(lathe([[0, 0], [13.5, 0], [14.2, 0.5], [14.4, 1.6], [13.6, 1.6], [13.2, 0.9], [0, 0.9]], 48), M.brass)));
  if (withSet) {
    const d = makeDallah(M, 0.78); d.position.set(-3.5, 0.9, -1); d.rotation.y = 0.5; g.add(d);
    [[8, 5.6], [8.4, -1], [4, -7.2]].forEach(([x, z], i) => { const c = makeCup(M, 1); c.position.set(x, 0.9, z); c.rotation.y = i; g.add(c); });
  }
  g.scale.setScalar(s); return g;
}
export function makeIncense(M, s = 1) {
  const g = new THREE.Group();
  g.add(shadowed(new THREE.Mesh(lathe([[0, 0], [3.6, 0], [4.0, 0.5], [2.0, 1.4], [1.6, 4.4], [2.6, 5.0], [4.4, 6.6], [4.8, 8.4], [3.6, 9.4], [3.9, 9.9], [0, 9.9]], 28), M.copper)));
  const dome = shadowed(new THREE.Mesh(new THREE.SphereGeometry(3.7, 24, 12, 0, TAU, 0, Math.PI / 2), M.copper)); dome.position.y = 9.9; g.add(dome);
  const fin = shadowed(new THREE.Mesh(new THREE.SphereGeometry(0.55, 10, 8), M.brass)); fin.position.y = 13.8; g.add(fin);
  const ember = new THREE.Mesh(new THREE.SphereGeometry(0.5, 8, 6), new THREE.MeshBasicMaterial({ color: 0xff7a30, fog: false })); ember.position.set(1.2, 9.4, 0); g.add(ember);
  g.scale.setScalar(s); return g;
}
export function makeCushion(w, d, h, c0, c1, c2, seed) {
  const tex = texOf(stripeCanvas(c0, c1, c2, seed), true, [Math.max(1, Math.round(w / 40)), 1]);
  const geo = new THREE.ExtrudeGeometry(rrShape(w, d, Math.min(w, d) * 0.22), { depth: h * 0.6, bevelEnabled: true, bevelThickness: h * 0.22, bevelSize: h * 0.22, bevelSegments: 5, curveSegments: 10 });
  const p = geo.attributes.position, uv = geo.attributes.uv; for (let i = 0; i < uv.count; i++) uv.setXY(i, p.getX(i) / 40, p.getY(i) / 40);
  geo.rotateX(-Math.PI / 2); geo.translate(0, h * 0.22, 0);
  return shadowed(new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ map: tex, roughness: 0.92, metalness: 0 })));
}
export function makeBolster(len, rad, c0, c1, c2, seed) {
  const tex = texOf(stripeCanvas(c0, c1, c2, seed), true, [Math.max(1, Math.round(len / 36)), 1]);
  const m = new THREE.MeshStandardMaterial({ map: tex, roughness: 0.92 });
  const geo = new THREE.CylinderGeometry(rad, rad, len, 28, 1, false); geo.rotateZ(Math.PI / 2);
  const g = new THREE.Group(); g.add(shadowed(new THREE.Mesh(geo, m)));
  for (const sx of [-1, 1]) { const e = shadowed(new THREE.Mesh(new THREE.SphereGeometry(rad, 20, 12, 0, TAU, 0, Math.PI / 2), m)); e.rotation.z = -sx * Math.PI / 2; e.position.x = sx * len / 2; e.scale.set(0.45, 1, 1); g.add(e); }
  return g;
}
export function makeLantern(M, glowTex, s = 1) {
  const g = new THREE.Group();
  const body = new THREE.Mesh(new THREE.CylinderGeometry(4.4, 5.8, 15, 12, 1, true), M.lantern); g.add(body);
  g.add(shadowed(new THREE.Mesh(lathe([[0, 15], [6.0, 15], [5.4, 16.2], [3.6, 18.2], [1.2, 20], [0, 21]], 20), M.brass), true, false));
  const base = shadowed(new THREE.Mesh(lathe([[0, -7.6], [5.6, -7.6], [6.0, -7.0], [4.2, -6.4], [0.8, -9.5], [0, -10.5]], 20), M.brass), true, false); g.add(base);
  const chain = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.2, 80, 6), M.brassD); chain.position.y = 61; g.add(chain);
  const glow = new THREE.Mesh(new THREE.PlaneGeometry(60, 60), new THREE.MeshBasicMaterial({ map: glowTex, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false, opacity: 0.55 })); glow.userData.glow = true; glow.position.y = 7; g.add(glow);
  body.position.y = 7.5; g.userData.glow = glow; g.scale.setScalar(s); return g;
}

// ------------------------------------------------------------------------------------------ room (shared) + lights
export function buildRoom(M) {
  const g = new THREE.Group();
  const rugTex = texOf(rugCanvas()); rugTex.wrapS = rugTex.wrapT = THREE.ClampToEdgeWrapping;
  const rug = new THREE.Mesh(new THREE.PlaneGeometry(760, 760), new THREE.MeshStandardMaterial({ map: rugTex, roughness: 1 })); rug.rotation.x = -Math.PI / 2; rug.receiveShadow = true; g.add(rug);
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(3000, 3000), new THREE.MeshStandardMaterial({ color: 0x1a1008, roughness: 1 })); floor.rotation.x = -Math.PI / 2; floor.position.y = -0.3; floor.receiveShadow = true; g.add(floor);
  const wallTex = texOf(wallCanvas()), wall = new THREE.Mesh(new THREE.PlaneGeometry(900, 450), new THREE.MeshStandardMaterial({ map: wallTex, roughness: 0.95 }));
  wall.position.set(0, 225, -250); wall.receiveShadow = true; g.add(wall);
  const side = new THREE.MeshStandardMaterial({ map: wallTex, roughness: 0.95 });
  for (const sx of [-1, 1]) { const w2 = new THREE.Mesh(new THREE.PlaneGeometry(900, 450), side); w2.position.set(sx * 380, 225, 100); w2.rotation.y = -sx * Math.PI / 2; g.add(w2); }
  void M; return g;
}
export function buildLights(scene) {
  const hemi = new THREE.HemisphereLight(0x8fa6ff, 0x3a2418, 0.38); scene.add(hemi);
  const key = new THREE.SpotLight(0xffc27a, 6200, 600, 0.82, 0.9, 1.6); key.position.set(10, 190, 60); key.target.position.set(0, 0, 0); key.castShadow = true;
  key.shadow.mapSize.set(2048, 2048); key.shadow.camera.near = 40; key.shadow.camera.far = 420; key.shadow.bias = -0.0004; key.shadow.normalBias = 0.4; key.shadow.radius = 3;
  scene.add(key); scene.add(key.target);
  const rim = new THREE.DirectionalLight(0x6f8cff, 1.3); rim.position.set(-120, 140, -160); scene.add(rim);
  const fill = new THREE.PointLight(0xffa860, 600, 380, 1.6); fill.position.set(0, 60, 130); scene.add(fill);
  return { hemi, key, rim, fill };
}

// ------------------------------------------------------------------------------------------ cards
const rrCard = (w, h, r) => { const s = rrShape(w, h, r); return s; };
let slabGeo = null, planeGeo = null;
export function cardGeos() {
  if (!slabGeo) {
    slabGeo = new THREE.ExtrudeGeometry(rrCard(CARD_W - 0.15, CARD_H - 0.15, 0.85), { depth: CARD_T, bevelEnabled: false, curveSegments: 5 }); slabGeo.rotateX(-Math.PI / 2);
    planeGeo = new THREE.PlaneGeometry(CARD_W, CARD_H); planeGeo.rotateX(-Math.PI / 2);
  }
  return { slabGeo, planeGeo };
}
// one card: a thin paper slab (casts the shadow, gives the edge), the face on top and the back underneath (alpha-cut rounded corners)
export function makeCardMesh(faceTex, backTex) {
  const { slabGeo: sg, planeGeo: pg } = cardGeos(), g = new THREE.Group();
  const slab = new THREE.Mesh(sg, new THREE.MeshStandardMaterial({ color: 0xe9ddc0, roughness: 0.7 })); slab.castShadow = true; slab.receiveShadow = true; g.add(slab);
  const top = new THREE.Mesh(pg, new THREE.MeshStandardMaterial({ map: faceTex, roughness: 0.55, metalness: 0, alphaTest: 0.5, transparent: false })); top.position.y = CARD_T + 0.012; top.receiveShadow = true; g.add(top);
  const under = new THREE.Mesh(pg, new THREE.MeshStandardMaterial({ map: backTex, roughness: 0.6, alphaTest: 0.5 })); under.rotation.x = Math.PI; under.position.y = -0.012; g.add(under);
  g.userData = { top, under, slab }; return g;
}
export { texOf, cv };
