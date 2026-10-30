// The 3D world for Surakarta, all procedural (no bitmaps): a carved teak slab with the two looped circuits set in as brass and jade
// inlay (the outer circuit in brass, the inner one in jade enamel, four loops at every corner), fluted shell stones and gold-banded
// lacquer stones, two carved capture rails with twelve sockets each, a brass oil lamp, a batik cloth on a woven mat on a teak
// pendopo floor, a carved balustrade between teak pillars, and a moonlit garden beyond. Units are centimetres; y is up; the board
// top is at y = TOP; grid row 0 is the far row (-z).
import * as THREE from '../vendor3d/three.js';

export const S = 4;                 // spacing between points (cm)
export const HALF = 22;             // half the slab (44 x 44 cm); the loops reach 18 cm from the centre
export const THICK = 3.4;
export const BASE = 0.95;           // mat + cloth
export const TOP = BASE + THICK + 0.5;
export const PR = 1.5;              // stone radius
export const PH = 1.02;             // stone height
export const RAIL_Z = HALF + 4.2;   // the capture rails stand just outside the near and far edges
export const RAIL_TOP = 2.6;
export const SLOT = 3.5;            // spacing of the twelve sockets in a rail

const CORNERS = [[0, 0, Math.PI / 2], [5, 0, Math.PI], [0, 5, 0], [5, 5, Math.PI * 1.5]];
const rnd = (s) => { let x = s | 0 || 1; return () => { x ^= x << 13; x ^= x >>> 17; x ^= x << 5; return ((x >>> 0) % 100000) / 100000; }; };
const canvas = (w, h = w) => { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; };
const tex = (c, srgb = true) => { const t = new THREE.CanvasTexture(c); if (srgb) t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8; return t; };
const hexRgb = (h) => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
const shade = (h, f) => { const [r, g, b] = hexRgb(h); return `rgb(${Math.min(255, Math.round(r * f))},${Math.min(255, Math.round(g * f))},${Math.min(255, Math.round(b * f))})`; };

// world position of grid coordinate (gx, gy) (fractional is fine: loops and trails); flip: the board turned half a turn
export function gridPos(gx, gy, flip = false) {
  const x = (gx - 2.5) * S, z = (gy - 2.5) * S;
  return flip ? { x: -x, z: -z } : { x, z };
}
export function pointPos(i, flip = false) { return gridPos(i % 6, Math.floor(i / 6), flip); }

export function radialTex(rgb = '255,255,255', a = 1) {
  const c = canvas(128), x = c.getContext('2d'), g = x.createRadialGradient(64, 64, 0, 64, 64, 64);
  g.addColorStop(0, `rgba(${rgb},${a})`); g.addColorStop(0.5, `rgba(${rgb},${a * 0.45})`); g.addColorStop(1, `rgba(${rgb},0)`);
  x.fillStyle = g; x.fillRect(0, 0, 128, 128); return tex(c);
}

// ------------------------------------------------------------------------------------------------ the board
const KIND = {
  teak: { top: ['#a9692f', '#6e3d18'], grain: 'rgba(40,16,2,', pale: 'rgba(255,214,160,', rough: 0.34, clear: 0.9, groove: '#1c0d04' },
  batik: { top: ['#274a96', '#162a62'], grain: 'rgba(240,226,190,', pale: 'rgba(160,190,255,', rough: 0.5, clear: 0.35, groove: '#070e26' },
  lacquer: { top: ['#2c2634', '#15111b'], grain: 'rgba(200,170,255,', pale: 'rgba(210,190,255,', rough: 0.22, clear: 1, groove: '#030206' },
};

function kawung(cx, X, Y, s, col, lw) {
  cx.strokeStyle = col; cx.lineWidth = lw;
  for (let i = 0; i < 4; i++) { cx.save(); cx.translate(X, Y); cx.rotate(i * Math.PI / 2 + Math.PI / 4); cx.beginPath(); cx.ellipse(s * 0.5, 0, s * 0.5, s * 0.26, 0, 0, 7); cx.stroke(); cx.restore(); }
  cx.fillStyle = col; cx.beginPath(); cx.arc(X, Y, s * 0.1, 0, 7); cx.fill();
}

function faceMaps(th, size) {
  const K = KIND[th.kind] || KIND.teak, W = size, k = W / (2 * HALF), px = (cm) => (cm + HALF) * k, R = (cm) => cm * k;
  const c = canvas(W), x = c.getContext('2d'), b = canvas(W), y = b.getContext('2d'), r = rnd(11);
  const g = x.createLinearGradient(0, 0, W * 0.35, W);
  g.addColorStop(0, K.top[0]); g.addColorStop(1, K.top[1]);
  x.fillStyle = g; x.fillRect(0, 0, W, W);
  y.fillStyle = '#808080'; y.fillRect(0, 0, W, W);
  if (th.kind === 'teak') {
    for (let i = 0; i < 300; i++) {
      const yy = r() * W, amp = 3 + r() * 10, ph = r() * 6, dark = r() < 0.4;
      x.strokeStyle = dark ? `${K.grain}${0.10 + r() * 0.16})` : `${K.pale}${0.03 + r() * 0.05})`;
      x.lineWidth = (0.6 + r() * (dark ? 2.8 : 1.5)) * W / 1024;
      x.beginPath();
      for (let xx = -10; xx <= W + 10; xx += W / 64) { const v = yy + Math.sin(xx / W * 6 + ph) * amp + Math.sin(xx / W * 21 + ph * 2) * amp * 0.28; xx < 0 ? x.moveTo(xx, v) : x.lineTo(xx, v); }
      x.stroke();
    }
    for (let i = 0; i < 3200; i++) { x.fillStyle = `rgba(20,8,0,${0.05 + r() * 0.1})`; x.fillRect(r() * W, r() * W, (0.6 + r()) * W / 1024, (1 + r() * 3) * W / 1024); }
  } else if (th.kind === 'batik') {
    const sp = R(1.15);
    x.fillStyle = `${K.grain}0.26)`;
    for (let j = 0; j * sp < W; j++) for (let i = 0; i * sp < W; i++) { x.beginPath(); x.arc(i * sp + (j % 2 ? sp / 2 : 0), j * sp, R(0.12), 0, 7); x.fill(); }
    for (let i = 0; i < 90; i++) { x.fillStyle = `rgba(5,10,40,${0.05 + r() * 0.08})`; x.fillRect(r() * W, r() * W, R(3), R(0.1)); }
  } else {
    const sg = x.createLinearGradient(0, 0, W, W);
    sg.addColorStop(0, 'rgba(210,180,255,0.20)'); sg.addColorStop(0.5, 'rgba(210,180,255,0)'); sg.addColorStop(1, 'rgba(160,110,255,0.12)');
    x.fillStyle = sg; x.fillRect(0, 0, W, W);
    for (let i = 0; i < 160; i++) { x.fillStyle = `rgba(200,170,255,${0.03 + r() * 0.07})`; x.beginPath(); x.arc(r() * W, r() * W, R(0.05 + r() * 0.1), 0, 7); x.fill(); }
  }
  // border band: two engraved rules with a run of kawung rosettes between them
  const rIn = HALF - 3.6, rOut = HALF - 0.9, mid = (rIn + rOut) / 2;
  x.fillStyle = 'rgba(8,3,0,0.42)';
  x.beginPath(); x.rect(px(-rOut), px(-rOut), R(2 * rOut), R(2 * rOut)); x.rect(px(-rIn), px(-rIn), R(2 * rIn), R(2 * rIn)); x.fill('evenodd');
  for (const [cx, w, col] of [[x, R(0.14), th.outer.line], [y, R(0.28), '#303030']]) {
    cx.strokeStyle = col; cx.lineWidth = w; cx.globalAlpha = cx === x ? 0.8 : 1;
    cx.strokeRect(px(-rIn), px(-rIn), R(2 * rIn), R(2 * rIn)); cx.strokeRect(px(-rOut), px(-rOut), R(2 * rOut), R(2 * rOut)); cx.globalAlpha = 1;
  }
  const n = 17, span = 2 * mid, step = span / n, ks = 2.1;
  for (let i = 0; i <= n; i++) {
    const t = -mid + i * step, spots = [[t, -mid], [t, mid]];
    if (i > 0 && i < n) spots.push([-mid, t], [mid, t]);
    for (const [u, v] of spots) { kawung(x, px(u), px(v), R(ks * 0.5), th.outer.line, R(0.09)); kawung(y, px(u), px(v), R(ks * 0.5), '#9a9a9a', R(0.2)); }
  }
  // thin engraved grid (the edge lines 0 and 5 are on no circuit; the rest lie under the circuits)
  const gp = (v) => px((v - 2.5) * S);
  x.lineCap = y.lineCap = 'round';
  x.strokeStyle = 'rgba(10,4,0,0.55)'; x.lineWidth = R(0.1);
  x.beginPath(); for (let q = 0; q < 6; q++) { x.moveTo(gp(0), gp(q)); x.lineTo(gp(5), gp(q)); x.moveTo(gp(q), gp(0)); x.lineTo(gp(q), gp(5)); } x.stroke();
  y.strokeStyle = '#4a4a4a'; y.lineWidth = R(0.14);
  y.beginPath(); for (let q = 0; q < 6; q++) { y.moveTo(gp(0), gp(q)); y.lineTo(gp(5), gp(q)); y.moveTo(gp(q), gp(0)); y.lineTo(gp(q), gp(5)); } y.stroke();
  // the carved channels of both circuits
  const circuit = (cx, kk) => {
    cx.beginPath();
    for (const q of [kk, 5 - kk]) { cx.moveTo(gp(0), gp(q)); cx.lineTo(gp(5), gp(q)); cx.moveTo(gp(q), gp(0)); cx.lineTo(gp(q), gp(5)); }
    for (const [ccx, ccy, a0] of CORNERS) { const X = gp(ccx), Y = gp(ccy), rad = R(kk * S); cx.moveTo(X + rad * Math.cos(a0), Y + rad * Math.sin(a0)); cx.arc(X, Y, rad, a0, a0 + Math.PI * 1.5); }
    cx.stroke();
  };
  for (const kk of [2, 1]) {
    x.lineJoin = 'round';
    x.strokeStyle = 'rgba(255,225,170,0.22)'; x.lineWidth = R(0.95); x.save(); x.translate(0, R(0.1)); circuit(x, kk); x.restore();
    x.strokeStyle = K.groove; x.lineWidth = R(0.78); circuit(x, kk);
    y.filter = `blur(${R(0.1)}px)`; y.strokeStyle = '#1a1a1a'; y.lineWidth = R(0.85); circuit(y, kk); y.filter = 'none';
  }
  // a rosette in the middle of the board and a pit at every point
  kawung(x, gp(2.5), gp(2.5), R(1.7), th.outer.line, R(0.12)); kawung(y, gp(2.5), gp(2.5), R(1.7), '#a0a0a0', R(0.24));
  for (let i = 0; i < 36; i++) {
    const X = gp(i % 6), Y = gp(Math.floor(i / 6));
    x.fillStyle = 'rgba(8,3,0,0.7)'; x.beginPath(); x.arc(X, Y, R(0.62), 0, 7); x.fill();
    x.strokeStyle = th.outer.line; x.globalAlpha = 0.55; x.lineWidth = R(0.08); x.beginPath(); x.arc(X, Y, R(0.62), 0, 7); x.stroke(); x.globalAlpha = 1;
    y.fillStyle = '#1c1c1c'; y.beginPath(); y.arc(X, Y, R(0.62), 0, 7); y.fill();
  }
  return { map: tex(c), bump: tex(b, false) };
}

function roundedRect(w, h, r) {
  const s = new THREE.Shape(), x = -w / 2, y = -h / 2;
  s.moveTo(x + r, y); s.lineTo(x + w - r, y); s.quadraticCurveTo(x + w, y, x + w, y + r); s.lineTo(x + w, y + h - r); s.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  s.lineTo(x + r, y + h); s.quadraticCurveTo(x, y + h, x, y + h - r); s.lineTo(x, y + r); s.quadraticCurveTo(x, y, x + r, y);
  return s;
}

// minimal merge (position + normal)
export function mergeGeos(list) {
  let n = 0; const parts = list.map((g) => { const ng = g.index ? g.toNonIndexed() : g; n += ng.attributes.position.count; return ng; });
  const P = new Float32Array(n * 3), N = new Float32Array(n * 3); let o = 0;
  for (const g of parts) { if (!g.attributes.normal) g.computeVertexNormals(); P.set(g.attributes.position.array, o * 3); N.set(g.attributes.normal.array, o * 3); o += g.attributes.position.count; }
  const out = new THREE.BufferGeometry(); out.setAttribute('position', new THREE.BufferAttribute(P, 3)); out.setAttribute('normal', new THREE.BufferAttribute(N, 3));
  list.forEach((g) => g.dispose()); parts.forEach((g) => g.dispose());
  return out;
}

// the polylines of one circuit in world coordinates: four lines edge to edge and four three-quarter loops round the corners
function circuitLines(k) {
  const out = [];
  for (const q of [k, 5 - k]) {
    out.push([gridPos(0, q), gridPos(5, q)]); out.push([gridPos(q, 0), gridPos(q, 5)]);
  }
  for (const [cx, cy, a0] of CORNERS) {
    const pts = [];
    for (let i = 0; i <= 72; i++) { const a = a0 + Math.PI * 1.5 * (i / 72); pts.push(gridPos(cx + k * Math.cos(a), cy + k * Math.sin(a))); }
    out.push(pts);
  }
  return out;
}
function inlayGeo(k, rad) {
  const list = [];
  for (const pts of circuitLines(k)) {
    const v = pts.map((p) => new THREE.Vector3(p.x, 0, p.z));
    const curve = new THREE.CatmullRomCurve3(v, false, 'centripetal');
    const g = new THREE.TubeGeometry(curve, v.length === 2 ? 2 : 96, rad, 6, false);
    g.scale(1, 0.5, 1); g.translate(0, TOP + 0.01, 0); list.push(g);
    // round caps at the free ends of a line so a loop and its line read as one continuous strip
  }
  return mergeGeos(list);
}

export function buildBoard(th, texSize = 1024) {
  const grp = new THREE.Group(), K = KIND[th.kind] || KIND.teak;
  const { map, bump } = faceMaps(th, texSize);
  const shape = roundedRect(2 * HALF - 1, 2 * HALF - 1, 1.8);
  const geo = new THREE.ExtrudeGeometry(shape, { depth: THICK, bevelEnabled: true, bevelThickness: 0.5, bevelSize: 0.5, bevelSegments: 3, curveSegments: 6 });
  geo.rotateX(-Math.PI / 2); geo.translate(0, BASE, 0);
  const pos = geo.attributes.position, uv = geo.attributes.uv;
  for (let i = 0; i < pos.count; i++) uv.setXY(i, (pos.getX(i) + HALF) / (2 * HALF), 1 - (pos.getZ(i) + HALF) / (2 * HALF));
  const top = new THREE.MeshPhysicalMaterial({ map, color: 0xffffff, bumpMap: bump, bumpScale: 1.5, roughness: K.rough, clearcoat: K.clear, clearcoatRoughness: 0.32 });
  const side = new THREE.MeshStandardMaterial({ map, color: 0x8a7468, roughness: 0.55 });
  const slab = new THREE.Mesh(geo, [top, side]); slab.castShadow = true; slab.receiveShadow = true; grp.add(slab);
  const outer = new THREE.MeshStandardMaterial({ color: new THREE.Color(th.outer.line), metalness: 1, roughness: 0.2, envMapIntensity: 2.4 });
  const inner = new THREE.MeshPhysicalMaterial({ color: new THREE.Color(th.inner.line), metalness: th.kind === 'batik' ? 0.7 : 0.25, roughness: 0.2, clearcoat: 1, clearcoatRoughness: 0.1, envMapIntensity: 1.6 });
  const g1 = inlayGeo(1, 0.19), g2 = inlayGeo(2, 0.19);
  const m1 = new THREE.Mesh(g1, outer), m2 = new THREE.Mesh(g2, inner); m1.receiveShadow = m2.receiveShadow = true; m1.castShadow = m2.castShadow = false;
  m2.position.y = 0.02; grp.add(m1, m2);
  grp.userData.dispose = () => { geo.dispose(); g1.dispose(); g2.dispose(); map.dispose(); bump.dispose(); top.dispose(); side.dispose(); outer.dispose(); inner.dispose(); };
  return grp;
}

// ------------------------------------------------------------------------------------------------ stones
// Light: a pale shell stone, its side cut with fourteen flutes, a shallow dish in the top and a small pearl at the centre.
// Dark: a red lacquer stone with a stepped top, a gold band round its waist and a gold knob (the band and knob are a separate mesh).
export function pieceGeos() {
  const light = [new THREE.Vector2(0, 0)];
  for (const [r, h] of [[PR - 0.22, 0], [PR - 0.04, 0.07], [PR + 0.02, 0.24], [PR + 0.02, 0.62], [PR - 0.06, 0.82], [PR - 0.26, 0.9], [PR - 0.5, 0.86], [PR - 0.78, 0.8], [0.58, 0.82], [0.34, 0.9], [0.14, 1.02], [0, 1.04]]) light.push(new THREE.Vector2(r, h));
  const L = new THREE.LatheGeometry(light, 56);
  const lp = L.attributes.position;
  for (let i = 0; i < lp.count; i++) {
    const x = lp.getX(i), z = lp.getZ(i), y = lp.getY(i), rr = Math.hypot(x, z);
    if (y > 0.1 && y < 0.8 && rr > PR * 0.85) { const a = Math.atan2(z, x), f = 1 - 0.06 * (0.5 + 0.5 * Math.cos(a * 14)) * Math.min(1, (y - 0.1) / 0.15, (0.8 - y) / 0.15); lp.setXYZ(i, x * f, y, z * f); }
  }
  L.computeVertexNormals();
  const dark = [new THREE.Vector2(0, 0)];
  for (const [r, h] of [[PR - 0.2, 0], [PR - 0.02, 0.1], [PR, 0.3], [PR, 0.66], [PR - 0.1, 0.84], [PR - 0.32, 0.92], [PR - 0.5, 0.92], [PR - 0.62, 0.86], [PR - 0.78, 0.9], [0.5, 0.96], [0.3, 1.0], [0, 1.04]]) dark.push(new THREE.Vector2(r, h));
  const D = new THREE.LatheGeometry(dark, 56);
  const band = new THREE.TorusGeometry(PR + 0.005, 0.075, 8, 56); band.rotateX(Math.PI / 2); band.translate(0, 0.46, 0);
  const band2 = new THREE.TorusGeometry(PR - 0.62, 0.05, 8, 40); band2.rotateX(Math.PI / 2); band2.translate(0, 0.9, 0);
  const knob = new THREE.SphereGeometry(0.26, 14, 10); knob.scale(1, 0.7, 1); knob.translate(0, 1.04, 0);
  return { 1: L, 2: D, gold: mergeGeos([band, band2, knob]) };
}
export function pieceMaterials(th) {
  const m1 = new THREE.MeshPhysicalMaterial({ color: new THREE.Color(th.light.base).multiplyScalar(0.9), roughness: 0.34, clearcoat: 0.5, clearcoatRoughness: 0.35, sheen: 0.4, sheenColor: new THREE.Color('#fff4dc') });
  const m2 = new THREE.MeshPhysicalMaterial({ color: new THREE.Color(th.dark.base), roughness: 0.28, clearcoat: 1, clearcoatRoughness: 0.1 });
  const mg = new THREE.MeshStandardMaterial({ color: new THREE.Color(th.accent.length === 7 ? th.accent : '#e8c46a'), metalness: 1, roughness: 0.24, envMapIntensity: 2 });
  return { 1: m1, 2: m2, gold: mg };
}
export function setPieceTheme(m, th) {
  m[1].color.set(th.light.base).multiplyScalar(0.9); m[2].color.set(th.dark.base); m.gold.color.set(th.accent.length === 7 ? th.accent : '#e8c46a');
}

// ------------------------------------------------------------------------------------------------ rails and the lamp
// A capture rail: a carved teak bar with twelve round sockets edged in brass. Local x runs along it; slot j is at x = (j - 5.5) * SLOT.
export function buildRail() {
  const grp = new THREE.Group(), W = 12 * SLOT + 3.4, D = 6, Hh = RAIL_TOP;
  const c = canvas(1024, 192), x = c.getContext('2d'), r = rnd(5);
  const g = x.createLinearGradient(0, 0, 0, 192); g.addColorStop(0, '#5a3016'); g.addColorStop(1, '#3a1d0c'); x.fillStyle = g; x.fillRect(0, 0, 1024, 192);
  for (let i = 0; i < 70; i++) { x.strokeStyle = `rgba(20,8,0,${0.1 + r() * 0.18})`; x.lineWidth = 1 + r() * 2; const yy = r() * 192; x.beginPath(); x.moveTo(0, yy); x.bezierCurveTo(300, yy + 8, 700, yy - 8, 1024, yy + 3); x.stroke(); }
  const kx = 1024 / W, kz = 192 / D;
  for (let j = 0; j < 12; j++) { const X = (W / 2 + (j - 5.5) * SLOT) * kx, Y = 96; x.fillStyle = '#120804'; x.beginPath(); x.ellipse(X, Y, 1.7 * kx, 1.7 * kz, 0, 0, 7); x.fill(); const gg = x.createRadialGradient(X, Y - 3, 2, X, Y, 1.7 * kx); gg.addColorStop(0, 'rgba(0,0,0,0)'); gg.addColorStop(1, 'rgba(0,0,0,0.5)'); x.fillStyle = gg; x.beginPath(); x.ellipse(X, Y, 1.7 * kx, 1.7 * kz, 0, 0, 7); x.fill(); }
  const t = tex(c);
  const box = new THREE.BoxGeometry(W, Hh, D);
  const top = new THREE.MeshPhysicalMaterial({ map: t, roughness: 0.4, clearcoat: 0.7, clearcoatRoughness: 0.3 });
  const sideM = new THREE.MeshStandardMaterial({ color: 0x4a2610, roughness: 0.55 });
  const mesh = new THREE.Mesh(box, [sideM, sideM, top, sideM, sideM, sideM]); mesh.position.y = Hh / 2; mesh.castShadow = true; mesh.receiveShadow = true; grp.add(mesh);
  const brass = new THREE.MeshStandardMaterial({ color: 0xd9a84e, metalness: 1, roughness: 0.25, envMapIntensity: 2 });
  const tori = [];
  for (let j = 0; j < 12; j++) { const tg = new THREE.TorusGeometry(1.7, 0.1, 6, 28); tg.rotateX(Math.PI / 2); tg.translate((j - 5.5) * SLOT, Hh + 0.02, 0); tori.push(tg); }
  const tm = new THREE.Mesh(mergeGeos(tori), brass); tm.receiveShadow = true; grp.add(tm);
  return grp;
}

export function buildLamp() {
  const grp = new THREE.Group();
  const brass = new THREE.MeshStandardMaterial({ color: 0xcf9a45, metalness: 1, roughness: 0.28, envMapIntensity: 2 });
  const prof = [[0, 0], [6.4, 0], [6.6, 0.5], [6, 1.1], [3.2, 1.7], [1.5, 2.6], [1.1, 4], [1.9, 5.2], [1.3, 6.2], [1.0, 9], [1.9, 10.4], [1.2, 11.4], [1.0, 13.6], [2.4, 14.6], [4.4, 15.6], [5.3, 17], [5.2, 17.5], [4.5, 17.2], [3.2, 16.4], [0, 16.2]].map(([a, b]) => new THREE.Vector2(a, b));
  const lathe = new THREE.Mesh(new THREE.LatheGeometry(prof, 40), brass); lathe.castShadow = true; lathe.receiveShadow = true; grp.add(lathe);
  const oil = new THREE.Mesh(new THREE.CircleGeometry(4.4, 28), new THREE.MeshStandardMaterial({ color: 0x4a2a06, roughness: 0.15, metalness: 0.2 })); oil.rotation.x = -Math.PI / 2; oil.position.y = 16.6; grp.add(oil);
  const wick = new THREE.Mesh(new THREE.CylinderGeometry(0.25, 0.3, 1.5, 6), new THREE.MeshStandardMaterial({ color: 0x2a1a10 })); wick.position.set(3.2, 17.2, 0); grp.add(wick);
  const spout = new THREE.Mesh(new THREE.CylinderGeometry(0, 0.9, 2.6, 8), brass); spout.rotation.z = -Math.PI / 2.4; spout.position.set(4.4, 17.3, 0); grp.add(spout);
  const flame = new THREE.Mesh(new THREE.SphereGeometry(0.9, 12, 10), new THREE.MeshBasicMaterial({ color: 0xfff0b8 })); flame.scale.set(0.8, 1.9, 0.8); flame.position.set(3.2, 19, 0); grp.add(flame);
  const halo = new THREE.Sprite(new THREE.SpriteMaterial({ map: radialTex('255,176,92', 0.6), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
  halo.scale.set(48, 48, 1); halo.position.set(3.2, 19, 0); grp.add(halo);
  const light = new THREE.PointLight(0xffa04a, 2600, 280, 1.6); light.position.set(3.2, 20, 0); grp.add(light);
  grp.userData = { light, flame, halo };
  return grp;
}

// ------------------------------------------------------------------------------------------------ the pendopo at night
function floorTex() {
  const W = 1024, c = canvas(W), x = c.getContext('2d'), r = rnd(21), n = 8, pw = W / n;
  for (let i = 0; i < n; i++) {
    const l = 0.8 + r() * 0.35; x.fillStyle = `rgb(${Math.round(92 * l)},${Math.round(52 * l)},${Math.round(28 * l)})`; x.fillRect(i * pw, 0, pw, W);
    for (let k = 0; k < 40; k++) { x.strokeStyle = `rgba(${r() < 0.5 ? '30,12,2' : '190,130,80'},${0.05 + r() * 0.1})`; x.lineWidth = 1 + r() * 2.5; const xx = i * pw + r() * pw; x.beginPath(); x.moveTo(xx, 0); x.bezierCurveTo(xx + 5, W * 0.3, xx - 6, W * 0.7, xx + 2, W); x.stroke(); }
    x.fillStyle = 'rgba(12,5,0,0.7)'; x.fillRect(i * pw, 0, 3, W);
  }
  for (let j = 1; j < 3; j++) { x.fillStyle = 'rgba(12,5,0,0.6)'; x.fillRect(0, (j * W) / 3 + (r() - 0.5) * 30, W, 3); }
  const T = tex(c); T.wrapS = T.wrapT = THREE.RepeatWrapping; return T;
}
function matTex() {
  const W = 512, H = 384, c = canvas(W, H), x = c.getContext('2d'), r = rnd(31);
  x.fillStyle = '#8c7442'; x.fillRect(0, 0, W, H);
  for (let i = 0; i < H; i += 5) for (let j = 0; j < W; j += 5) { const o = ((i + j) / 5) % 2; x.fillStyle = `rgba(${o ? '40,28,8' : '210,184,118'},${0.1 + r() * 0.14})`; x.fillRect(j, i, 5, 5); }
  x.fillStyle = 'rgba(30,18,4,0.55)'; x.fillRect(0, 0, W, 10); x.fillRect(0, H - 10, W, 10); x.fillRect(0, 0, 10, H); x.fillRect(W - 10, 0, 10, H);
  const T = tex(c); return T;
}
// batik cloth: indigo ground, rows of cream kawung rosettes, a border of the diagonal parang wave in sogan brown
function clothTex() {
  const W = 768, c = canvas(W), x = c.getContext('2d');
  x.fillStyle = '#16204a'; x.fillRect(0, 0, W, W);
  const bd = 92;
  x.save(); x.beginPath(); x.rect(bd, bd, W - 2 * bd, W - 2 * bd); x.clip();
  const n = 8, st = (W - 2 * bd) / n;
  for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) kawung(x, bd + (i + 0.5) * st, bd + (j + 0.5) * st, st * 0.44, 'rgba(226,210,170,0.26)', 3);
  x.fillStyle = 'rgba(226,210,170,0.16)';
  for (let j = 0; j <= n; j++) for (let i = 0; i <= n; i++) { x.beginPath(); x.arc(bd + i * st, bd + j * st, 4, 0, 7); x.fill(); }
  x.restore();
  x.fillStyle = '#5a3418'; x.fillRect(0, 0, W, bd); x.fillRect(0, W - bd, W, bd); x.fillRect(0, 0, bd, W); x.fillRect(W - bd, 0, bd, W);
  const parang = (x0, y0, w, h, vert) => {
    x.save(); x.beginPath(); x.rect(x0, y0, w, h); x.clip(); x.strokeStyle = '#b8a47a'; x.lineWidth = 6;
    const L = vert ? h : w, P = 38;
    for (let q = -2; q < L / P + 3; q++) {
      x.beginPath();
      for (let s = 0; s <= 12; s++) { const t = s / 12, u = q * P + t * P * 1.4, v = Math.sin(t * Math.PI) * 18 + t * 10 - 4; const px = vert ? x0 + (v + 40) : x0 + u, py = vert ? y0 + u : y0 + (v + 40); s ? x.lineTo(px, py) : x.moveTo(px, py); }
      x.stroke();
    }
    x.restore();
  };
  parang(0, 14, W, bd - 28, false); parang(0, W - bd + 14, W, bd - 28, false); parang(14, 0, bd - 28, W, true); parang(W - bd + 14, 0, bd - 28, W, true);
  x.strokeStyle = '#e4d3a4'; x.lineWidth = 4; x.strokeRect(bd - 3, bd - 3, W - 2 * bd + 6, W - 2 * bd + 6); x.strokeRect(8, 8, W - 16, W - 16);
  for (let i = 0; i < 9000; i++) { x.fillStyle = `rgba(0,0,0,${Math.random() * 0.07})`; x.fillRect(Math.random() * W, Math.random() * W, 3, 1); }
  return tex(c);
}
function skyTex() {
  const c = canvas(512, 512), x = c.getContext('2d'), r = rnd(3), g = x.createLinearGradient(0, 0, 0, 512);
  g.addColorStop(0, '#050a1c'); g.addColorStop(0.5, '#0e2036'); g.addColorStop(0.8, '#1b4046'); g.addColorStop(1, '#3a6a5c');
  x.fillStyle = g; x.fillRect(0, 0, 512, 512);
  for (let i = 0; i < 90; i++) { x.fillStyle = `rgba(255,248,225,${0.2 + r() * 0.6})`; x.fillRect(r() * 512, r() * 300, 1.3, 1.3); }
  return tex(c);
}
function wallTex() {
  const W = 512, H = 256, c = canvas(W, H), x = c.getContext('2d'), r = rnd(9);
  x.fillStyle = '#2f1809'; x.fillRect(0, 0, W, H);
  for (let i = 0; i < 80; i++) { x.strokeStyle = `rgba(0,0,0,${0.1 + r() * 0.2})`; x.lineWidth = 1 + r() * 2; const xx = r() * W; x.beginPath(); x.moveTo(xx, 0); x.lineTo(xx + 4, H); x.stroke(); }
  x.strokeStyle = 'rgba(210,150,70,0.5)'; x.lineWidth = 2;
  for (let i = 0; i < 4; i++) for (let j = 0; j < 2; j++) { const cx = 64 + i * 128, cy = 64 + j * 128; x.beginPath(); x.moveTo(cx - 40, cy); x.lineTo(cx, cy - 40); x.lineTo(cx + 40, cy); x.lineTo(cx, cy + 40); x.closePath(); x.stroke(); kawung(x, cx, cy, 28, 'rgba(210,150,70,0.55)', 2); }
  return tex(c);
}

export function buildPendopo(scene) {
  const grp = new THREE.Group(); scene.add(grp);
  const ft = floorTex(); ft.repeat.set(10, 10);
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(1800, 1800), new THREE.MeshStandardMaterial({ map: ft, roughness: 0.7 }));
  floor.rotation.x = -Math.PI / 2; floor.receiveShadow = true; grp.add(floor);
  const mat = new THREE.Mesh(new THREE.BoxGeometry(196, 0.5, 152), [0, 0, new THREE.MeshStandardMaterial({ map: matTex(), roughness: 1 }), 0, 0, 0].map((m) => m || new THREE.MeshStandardMaterial({ color: 0x4a3a1a, roughness: 1 })));
  mat.position.set(0, 0.25, 2); mat.receiveShadow = true; grp.add(mat);
  const cloth = new THREE.Mesh(new THREE.BoxGeometry(124, 0.4, 124), [0, 0, new THREE.MeshStandardMaterial({ map: clothTex(), roughness: 0.95 }), 0, 0, 0].map((m) => m || new THREE.MeshStandardMaterial({ color: 0x16204a, roughness: 1 })));
  cloth.position.set(0, 0.5 + 0.2, 0); cloth.rotation.y = 0.05; cloth.receiveShadow = true; grp.add(cloth);
  // teak pillars on stone bases and a carved balustrade between them
  const teak = new THREE.MeshStandardMaterial({ color: 0x3f2110, roughness: 0.6 });
  const wt = wallTex(); wt.wrapS = wt.wrapT = THREE.RepeatWrapping; wt.repeat.set(1, 1);
  const carved = new THREE.MeshStandardMaterial({ map: wt, roughness: 0.65 });
  const stone = new THREE.MeshStandardMaterial({ color: 0x6d655c, roughness: 0.95 });
  for (const x of [-190, 190, -440, 440]) {
    const b = new THREE.Mesh(new THREE.BoxGeometry(46, 22, 46), stone); b.position.set(x, 11, -150); grp.add(b);
    const p = new THREE.Mesh(new THREE.BoxGeometry(32, 420, 32), teak); p.position.set(x, 232, -150); p.castShadow = false; grp.add(p);
    const band = new THREE.Mesh(new THREE.BoxGeometry(35, 14, 35), carved); band.position.set(x, 80, -150); grp.add(band);
  }
  const rail = new THREE.Mesh(new THREE.BoxGeometry(1000, 12, 16), teak); rail.position.set(0, 74, -150); grp.add(rail);
  const sill = new THREE.Mesh(new THREE.BoxGeometry(1000, 12, 20), teak); sill.position.set(0, 28, -150); grp.add(sill);
  const balusters = [];
  for (let x = -470; x <= 470; x += 12) { const g = new THREE.CylinderGeometry(2.2, 3, 44, 8); g.translate(x, 51, -150); balusters.push(g); }
  grp.add(new THREE.Mesh(mergeGeos(balusters), teak));
  const lintel = new THREE.Mesh(new THREE.BoxGeometry(1000, 26, 30), carved); lintel.position.set(0, 400, -150); grp.add(lintel);
  // the night garden: sky with a moon, dark banana-leaf fans and a low hedge, and a few lit windows far off
  const sky = new THREE.Mesh(new THREE.PlaneGeometry(4200, 1500), new THREE.MeshBasicMaterial({ map: skyTex(), fog: false }));
  sky.position.set(0, 480, -900); grp.add(sky);
  const moon = new THREE.Sprite(new THREE.SpriteMaterial({ map: radialTex('225,240,255', 1), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false })); moon.scale.set(240, 240, 1); moon.position.set(-330, 360, -880); grp.add(moon);
  const moonCore = new THREE.Mesh(new THREE.CircleGeometry(34, 32), new THREE.MeshBasicMaterial({ color: 0xf6f4e6, fog: false })); moonCore.position.set(-330, 360, -879); grp.add(moonCore);
  const dark = new THREE.MeshBasicMaterial({ color: 0x07121a, fog: false, side: THREE.DoubleSide });
  const leaf = new THREE.Shape(); leaf.moveTo(0, 0); leaf.quadraticCurveTo(26, 80, 6, 230); leaf.quadraticCurveTo(0, 250, -6, 230); leaf.quadraticCurveTo(-26, 80, 0, 0);
  const lg = new THREE.ShapeGeometry(leaf, 8);
  for (const [x, n, s] of [[-560, 7, 1.5], [-120, 8, 1.8], [380, 7, 1.6], [720, 8, 1.4], [-860, 6, 1.5]]) for (let i = 0; i < n; i++) { const m = new THREE.Mesh(lg, dark); const a = (i / (n - 1) - 0.5) * 2.4; m.position.set(x + i * 4, 0, -700 - (i % 3) * 30); m.rotation.z = -a; m.scale.set(s * 1.3, s * (0.8 + (i % 3) * 0.18), 1); grp.add(m); }
  const hedge = new THREE.Mesh(new THREE.BoxGeometry(4400, 150, 10), dark); hedge.position.set(0, 75, -690); grp.add(hedge);
  // far lanterns: soft bokeh in the dark
  const bk = radialTex('255,176,90', 0.8);
  for (const [x, y, z, s] of [[-300, 150, -520, 54], [-110, 118, -560, 38], [210, 180, -500, 60], [420, 130, -580, 44], [-540, 200, -600, 70], [640, 210, -620, 66]]) { const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: bk, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false, opacity: 0.8 })); sp.scale.set(s, s, 1); sp.position.set(x, y, z); grp.add(sp); }
  // two hanging brass lamps by the pillars
  const brass = new THREE.MeshStandardMaterial({ color: 0xc89a48, metalness: 1, roughness: 0.3 });
  for (const x of [-190, 190]) {
    const hang = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.5, 120, 6), brass); hang.position.set(x * 0.92, 340, -118); grp.add(hang);
    const shade2 = new THREE.Mesh(new THREE.CylinderGeometry(0, 14, 16, 12, 1, true), brass); shade2.position.set(x * 0.92, 272, -118); shade2.material.side = THREE.DoubleSide; grp.add(shade2);
    const glow = new THREE.Mesh(new THREE.SphereGeometry(4, 12, 8), new THREE.MeshBasicMaterial({ color: 0xffe0a0 })); glow.position.set(x * 0.92, 266, -118); grp.add(glow);
    const halo = new THREE.Sprite(new THREE.SpriteMaterial({ map: radialTex('255,190,100', 0.7), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false })); halo.scale.set(120, 120, 1); halo.position.set(x * 0.92, 266, -118); grp.add(halo);
  }
  return grp;
}

export function buildLights(scene) {
  const hemi = new THREE.HemisphereLight(0x5a74a8, 0x3a2012, 0.5); scene.add(hemi);
  const sun = new THREE.DirectionalLight(0xffc27e, 2.5); sun.position.set(-70, 130, 80);
  sun.shadow.camera.left = -44; sun.shadow.camera.right = 44; sun.shadow.camera.top = 44; sun.shadow.camera.bottom = -44; sun.shadow.camera.near = 20; sun.shadow.camera.far = 400;
  sun.shadow.bias = -0.0004; sun.shadow.normalBias = 0.04; sun.shadow.radius = 4;
  scene.add(sun); scene.add(sun.target);
  const rim = new THREE.DirectionalLight(0x7fa6ff, 0.8); rim.position.set(80, 70, -170); scene.add(rim);
  return { hemi, sun, rim };
}
