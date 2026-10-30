// The 3D world for Alquerque, all procedural (no bitmaps): a carved cedar slab with brass set into its channels, a band of bone
// diamonds round the edge, turned bone pieces and lacquered pieces with a brass diamond, two glazed bowls, a brass lantern, a woven
// rug on a terracotta floor, and a courtyard wall of horseshoe arches open to a dusk sky. Units are centimetres; y is up; the board
// top is at y = TOP and row 0 of the board is the far row (-z).
import * as THREE from '../vendor3d/three.js';
import { SEGMENTS, CENTRE } from '../src/rules.js';

export const S = 7;                 // spacing between points (cm)
export const HALF = 20;             // half the slab (40 x 40 cm)
export const THICK = 3.6;
export const TOP = 0.6 + THICK + 0.5; // rug + slab + bevel
export const PR = 2.15;             // piece radius
export const PH = 1.35;             // piece height

const rnd = (s) => { let x = s | 0 || 1; return () => { x ^= x << 13; x ^= x >>> 17; x ^= x << 5; return ((x >>> 0) % 100000) / 100000; }; };
const canvas = (w, h = w) => { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; };
const tex = (c, srgb = true) => { const t = new THREE.CanvasTexture(c); if (srgb) t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8; return t; };

// world position of point i (flip: the board turned half a turn, Dark at the bottom)
export function pointPos(i, flip = false) {
  let c = i % 5, r = (i - c) / 5;
  if (flip) { c = 4 - c; r = 4 - r; }
  return { x: (c - 2) * S, z: (r - 2) * S };
}

export function radialTex(rgb = '255,255,255', a = 1) {
  const c = canvas(128), x = c.getContext('2d'), g = x.createRadialGradient(64, 64, 0, 64, 64, 64);
  g.addColorStop(0, `rgba(${rgb},${a})`); g.addColorStop(0.5, `rgba(${rgb},${a * 0.45})`); g.addColorStop(1, `rgba(${rgb},0)`);
  x.fillStyle = g; x.fillRect(0, 0, 128, 128); return tex(c);
}

// ------------------------------------------------------------------------------------------------ the board
// Face texture: wood grain (or glazed tile / ebony by theme), the bone-diamond border band, and the carved channels; plus a bump map
// for the channels and the band so they catch the light.
function faceMaps(th, size) {
  const W = size, k = W / (2 * HALF), px = (cm) => (cm + HALF) * k;
  const c = canvas(W), x = c.getContext('2d'), b = canvas(W), y = b.getContext('2d'), r = rnd(7);
  // base
  const g = x.createLinearGradient(0, 0, W * 0.3, W);
  g.addColorStop(0, th.slab[0]); g.addColorStop(1, th.slab[1]);
  x.fillStyle = g; x.fillRect(0, 0, W, W);
  y.fillStyle = '#808080'; y.fillRect(0, 0, W, W);
  if (th.kind === 'tile') {
    // glazed tiles: small squares with a darker grout and a slight variation in glaze
    const n = 20, t = W / n;
    for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) {
      x.fillStyle = `rgba(${r() < 0.5 ? '255,255,255' : '0,0,30'},${0.03 + r() * 0.06})`; x.fillRect(i * t, j * t, t, t);
    }
    x.strokeStyle = 'rgba(5,10,30,0.55)'; x.lineWidth = W / 512; y.strokeStyle = '#555'; y.lineWidth = W / 300;
    for (let i = 0; i <= n; i++) { for (const cx of [x, y]) { cx.beginPath(); cx.moveTo(i * t, 0); cx.lineTo(i * t, W); cx.moveTo(0, i * t); cx.lineTo(W, i * t); cx.stroke(); } }
  } else {
    // grain: long wavy strokes across the slab, darker late-wood lines, pores
    for (let i = 0; i < 260; i++) {
      const yy = r() * W, amp = 3 + r() * 9, ph = r() * 6, dark = r() < 0.35;
      x.strokeStyle = dark ? `rgba(30,10,0,${0.08 + r() * 0.14})` : `rgba(255,220,170,${0.03 + r() * 0.05})`;
      if (th.kind === 'ebony') x.strokeStyle = dark ? `rgba(0,0,0,${0.15 + r() * 0.2})` : `rgba(200,180,230,${0.02 + r() * 0.04})`;
      x.lineWidth = (0.6 + r() * (dark ? 2.6 : 1.4)) * W / 1024;
      x.beginPath();
      for (let xx = -10; xx <= W + 10; xx += W / 64) { const v = yy + Math.sin(xx / W * 7 + ph) * amp + Math.sin(xx / W * 23 + ph * 2) * amp * 0.25; xx < 0 ? x.moveTo(xx, v) : x.lineTo(xx, v); }
      x.stroke();
    }
    for (let i = 0; i < 2600; i++) { x.fillStyle = `rgba(20,8,0,${0.05 + r() * 0.1})`; x.fillRect(r() * W, r() * W, (0.6 + r()) * W / 1024, (1 + r() * 2.5) * W / 1024); }
  }
  // border band: a darker inlaid strip between two engraved rules, set with small bone diamonds
  const b0 = 1.6, b1 = 4.6, mid = (b0 + b1) / 2, R = (cm) => cm * k;
  x.fillStyle = th.kind === 'tile' ? 'rgba(4,10,40,0.55)' : 'rgba(20,8,2,0.55)';
  x.beginPath(); x.rect(px(-HALF + b0), px(-HALF + b0), R(2 * HALF - 2 * b0), R(2 * HALF - 2 * b0)); x.rect(px(-HALF + b1), px(-HALF + b1), R(2 * HALF - 2 * b1), R(2 * HALF - 2 * b1)); x.fill('evenodd');
  for (const [cx, w] of [[x, R(0.16)], [y, R(0.3)]]) {
    cx.strokeStyle = cx === x ? th.inlay : '#3a3a3a'; cx.lineWidth = w;
    cx.strokeRect(px(-HALF + b0), px(-HALF + b0), R(2 * HALF - 2 * b0), R(2 * HALF - 2 * b0));
    cx.strokeRect(px(-HALF + b1), px(-HALF + b1), R(2 * HALF - 2 * b1), R(2 * HALF - 2 * b1));
  }
  const n = 14, span = 2 * (HALF - mid), step = span / n, ds = 0.95;
  const dia = (cx, X, Y, s, fill) => { cx.fillStyle = fill; cx.beginPath(); cx.moveTo(X, Y - s); cx.lineTo(X + s * 0.7, Y); cx.lineTo(X, Y + s); cx.lineTo(X - s * 0.7, Y); cx.closePath(); cx.fill(); };
  for (let i = 0; i <= n; i++) {
    const t = -HALF + mid + i * step;
    const spots = [[t, -HALF + mid], [t, HALF - mid]];
    if (i > 0 && i < n) spots.push([-HALF + mid, t], [HALF - mid, t]);
    for (const [u, v] of spots) { dia(x, px(u), px(v), R(ds), th.p.base); dia(x, px(u) - R(0.12), px(v) - R(0.2), R(ds * 0.45), 'rgba(255,255,255,0.35)'); dia(y, px(u), px(v), R(ds), '#a0a0a0'); }
  }
  // the carved channels (the brass sits in them as real metal strips)
  x.lineCap = y.lineCap = 'round';
  const seg = (cx) => { cx.beginPath(); for (const [a, bb] of SEGMENTS) { const p = pointPos(a), q = pointPos(bb); cx.moveTo(px(p.x), px(p.z)); cx.lineTo(px(q.x), px(q.z)); } cx.stroke(); };
  x.strokeStyle = th.groove; x.lineWidth = R(0.95); seg(x);
  x.strokeStyle = 'rgba(0,0,0,0.35)'; x.lineWidth = R(1.25); x.globalAlpha = 0.5; seg(x); x.globalAlpha = 1;
  y.filter = `blur(${R(0.12)}px)`; y.strokeStyle = '#202020'; y.lineWidth = R(1.0); seg(y); y.filter = 'none';
  // cups at the 25 points (bigger where diagonals meet)
  for (let i = 0; i < 25; i++) {
    const p = pointPos(i), big = (((i % 5) + Math.floor(i / 5)) % 2) === 0, rr = big ? 1.25 : 1.0;
    x.fillStyle = th.pit; x.beginPath(); x.arc(px(p.x), px(p.z), R(rr), 0, 7); x.fill();
    y.fillStyle = '#1a1a1a'; y.beginPath(); y.arc(px(p.x), px(p.z), R(rr), 0, 7); y.fill();
  }
  return { map: tex(c), bump: tex(b, false) };
}

function roundedRect(w, h, r) {
  const s = new THREE.Shape(), x = -w / 2, y = -h / 2;
  s.moveTo(x + r, y); s.lineTo(x + w - r, y); s.quadraticCurveTo(x + w, y, x + w, y + r); s.lineTo(x + w, y + h - r); s.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  s.lineTo(x + r, y + h); s.quadraticCurveTo(x, y + h, x, y + h - r); s.lineTo(x, y + r); s.quadraticCurveTo(x, y, x + r, y);
  return s;
}

export function buildBoard(th, texSize = 1024) {
  const grp = new THREE.Group();
  const { map, bump } = faceMaps(th, texSize);
  const shape = roundedRect(2 * HALF - 1, 2 * HALF - 1, 1.6);
  const geo = new THREE.ExtrudeGeometry(shape, { depth: THICK, bevelEnabled: true, bevelThickness: 0.5, bevelSize: 0.5, bevelSegments: 3, curveSegments: 6 });
  geo.rotateX(-Math.PI / 2); geo.translate(0, 0.6, 0);
  // planar UVs from x/z for every face, so the grain wraps the bevel and the edges cleanly
  const pos = geo.attributes.position, uv = geo.attributes.uv;
  for (let i = 0; i < pos.count; i++) uv.setXY(i, (pos.getX(i) + HALF) / (2 * HALF), 1 - (pos.getZ(i) + HALF) / (2 * HALF));
  const wood = th.kind === 'tile';
  const top = new THREE.MeshPhysicalMaterial({ map, color: th.kind === 'wood' ? 0xc89880 : 0xffffff, bumpMap: bump, bumpScale: 1.6, roughness: wood ? 0.22 : th.kind === 'ebony' ? 0.32 : 0.48, clearcoat: wood ? 0.9 : 0.45, clearcoatRoughness: 0.35 });
  const side = new THREE.MeshStandardMaterial({ map, color: 0x9a8a80, roughness: 0.6 });
  const slab = new THREE.Mesh(geo, [top, side]); slab.castShadow = true; slab.receiveShadow = true; grp.add(slab);
  // brass (or bone) strips set into the channels, and rings at the points
  const metal = th.kind === 'wood';
  const inlay = new THREE.MeshStandardMaterial({ color: new THREE.Color(th.inlay), metalness: metal ? 1 : 0.05, roughness: metal ? 0.22 : 0.4, envMapIntensity: metal ? 2.2 : 1 });
  const strips = [];
  for (const [a, b] of SEGMENTS) {
    const p = pointPos(a), q = pointPos(b), L = Math.hypot(q.x - p.x, q.z - p.z);
    const g = new THREE.BoxGeometry(L, 0.18, 0.34);
    g.rotateY(-Math.atan2(q.z - p.z, q.x - p.x)); g.translate((p.x + q.x) / 2, TOP - 0.04, (p.z + q.z) / 2);
    strips.push(g);
  }
  for (let i = 0; i < 25; i++) {
    const p = pointPos(i), big = (((i % 5) + Math.floor(i / 5)) % 2) === 0;
    const t = new THREE.TorusGeometry(big ? 1.2 : 0.95, 0.13, 6, 28); t.rotateX(Math.PI / 2); t.translate(p.x, TOP - 0.02, p.z); strips.push(t);
    if (i === CENTRE) { const d = new THREE.CylinderGeometry(0.62, 0.62, 0.12, 4); d.scale(0.75, 1, 1); d.translate(p.x, TOP - 0.06, p.z); strips.push(d); }
  }
  const merged = mergeGeos(strips);
  const im = new THREE.Mesh(merged, inlay); im.receiveShadow = true; grp.add(im);
  grp.userData.dispose = () => { geo.dispose(); merged.dispose(); map.dispose(); bump.dispose(); top.dispose(); side.dispose(); inlay.dispose(); };
  return grp;
}

// minimal merge (position + normal) for non-indexed/indexed geometries
export function mergeGeos(list) {
  let n = 0; const parts = list.map((g) => { const ng = g.index ? g.toNonIndexed() : g; n += ng.attributes.position.count; return ng; });
  const P = new Float32Array(n * 3), N = new Float32Array(n * 3); let o = 0;
  for (const g of parts) { if (!g.attributes.normal) g.computeVertexNormals(); P.set(g.attributes.position.array, o * 3); N.set(g.attributes.normal.array, o * 3); o += g.attributes.position.count; }
  const out = new THREE.BufferGeometry(); out.setAttribute('position', new THREE.BufferAttribute(P, 3)); out.setAttribute('normal', new THREE.BufferAttribute(N, 3));
  list.forEach((g) => g.dispose()); parts.forEach((g) => g.dispose());
  return out;
}

// ------------------------------------------------------------------------------------------------ pieces
// Light: a turned bone piece with two cut rings on its dome. Dark: a lacquered piece with a flat top that carries a brass diamond.
export function pieceGeos() {
  const ring = (r, d) => (q) => (Math.abs(q - r) < 0.09 ? -d * (1 - Math.abs(q - r) / 0.09) : 0);
  const light = [], dark = [];
  const cut1 = ring(1.45, 0.07), cut2 = ring(0.8, 0.06);
  // profile from the bottom centre outwards and up over the dome
  light.push(new THREE.Vector2(0, 0));
  for (const [r, h] of [[PR - 0.25, 0], [PR - 0.05, 0.08], [PR, 0.3], [PR, 0.72], [PR - 0.08, 0.92]]) light.push(new THREE.Vector2(r, h));
  for (let i = 1; i <= 26; i++) { const q = (PR - 0.08) * (1 - i / 26); const dome = 0.92 + (PH - 0.92) * Math.sqrt(1 - (q / PR) ** 2); light.push(new THREE.Vector2(q, dome + cut1(q) + cut2(q))); }
  dark.push(new THREE.Vector2(0, 0));
  for (const [r, h] of [[PR - 0.25, 0], [PR - 0.05, 0.08], [PR, 0.3], [PR, 0.8], [PR - 0.12, 1.08], [PR - 0.35, 1.2], [PR - 0.55, 1.24]]) dark.push(new THREE.Vector2(r, h));
  for (let i = 1; i <= 6; i++) dark.push(new THREE.Vector2((PR - 0.55) * (1 - i / 6), 1.24));
  const L = new THREE.LatheGeometry(light, 40), D = new THREE.LatheGeometry(dark, 40);
  const dia = new THREE.CylinderGeometry(0.95, 0.95, 0.1, 4); dia.scale(0.72, 1, 1); dia.translate(0, 1.27, 0);
  const diaIn = new THREE.CylinderGeometry(0.48, 0.48, 0.12, 4); diaIn.scale(0.72, 1, 1); diaIn.translate(0, 1.29, 0);
  return { 1: L, 2: D, dia: mergeGeos([dia, diaIn]) };
}

export function pieceMaterials(th) {
  const m1 = new THREE.MeshPhysicalMaterial({ color: new THREE.Color(th.p.base).multiplyScalar(0.86), roughness: 0.38, clearcoat: 0.35, clearcoatRoughness: 0.4, sheen: 0.3, sheenColor: new THREE.Color('#fff4dc') });
  const m2 = new THREE.MeshPhysicalMaterial({ color: new THREE.Color(th.d.base), roughness: 0.32, clearcoat: 1, clearcoatRoughness: 0.12 });
  const md = new THREE.MeshStandardMaterial({ color: new THREE.Color(th.kind === 'wood' ? '#e2b860' : th.inlay), metalness: th.kind === 'wood' ? 1 : 0.1, roughness: 0.25 });
  return { 1: m1, 2: m2, dia: md };
}
export function setPieceTheme(m, th) {
  m[1].color.set(th.p.base).multiplyScalar(0.86); m[2].color.set(th.d.base);
  m.dia.color.set(th.kind === 'wood' ? '#e2b860' : th.inlay); m.dia.metalness = th.kind === 'wood' ? 1 : 0.1;
}

// ------------------------------------------------------------------------------------------------ props
export function buildBowl(glaze = '#1d4f8f') {
  const pts = [];
  for (let i = 0; i <= 14; i++) { const t = i / 14; pts.push(new THREE.Vector2(4 + 8 * Math.sin(t * Math.PI / 2), 5.4 * (1 - Math.cos(t * Math.PI / 2)) + (i === 0 ? 0 : 0.6))); }
  pts.push(new THREE.Vector2(12.4, 6.2)); pts.push(new THREE.Vector2(11.6, 6.2));
  for (let i = 14; i >= 0; i--) { const t = i / 14; pts.push(new THREE.Vector2(3.6 + 7.9 * Math.sin(t * Math.PI / 2) * 0.98, 1.2 + 4.8 * (1 - Math.cos(t * Math.PI / 2)))); }
  pts[0] = new THREE.Vector2(3.4, 0); pts.unshift(new THREE.Vector2(0, 0.01));
  const g = new THREE.LatheGeometry(pts, 48);
  const m = new THREE.MeshPhysicalMaterial({ color: new THREE.Color(glaze), roughness: 0.18, clearcoat: 1, clearcoatRoughness: 0.08, side: THREE.DoubleSide });
  const bowl = new THREE.Mesh(g, m); bowl.castShadow = true; bowl.receiveShadow = true;
  const grp = new THREE.Group(); grp.add(bowl);
  // a pale rim band (unglazed foot and lip)
  const lip = new THREE.Mesh(new THREE.TorusGeometry(12, 0.32, 8, 48), new THREE.MeshStandardMaterial({ color: 0xe8d8b8, roughness: 0.7 }));
  lip.rotation.x = Math.PI / 2; lip.position.y = 6.2; grp.add(lip);
  return grp;
}

export function buildLantern() {
  const grp = new THREE.Group();
  const brass = new THREE.MeshStandardMaterial({ color: 0xc89a48, metalness: 1, roughness: 0.32 });
  const glass = new THREE.MeshStandardMaterial({ color: 0xffd9a0, emissive: 0xffa040, emissiveIntensity: 2.4, roughness: 0.3, transparent: true, opacity: 0.92 });
  const base = new THREE.Mesh(new THREE.CylinderGeometry(6.4, 7.2, 2.2, 6), brass); base.position.y = 1.1; grp.add(base);
  const body = new THREE.Mesh(new THREE.CylinderGeometry(5.4, 5.4, 16, 6, 1, true), glass); body.position.y = 10.2; grp.add(body);
  // brass frame: six posts and two rings of bars
  for (let i = 0; i < 6; i++) { const a = i / 6 * Math.PI * 2 + Math.PI / 6; const p = new THREE.Mesh(new THREE.CylinderGeometry(0.36, 0.36, 16.4, 6), brass); p.position.set(Math.cos(a) * 5.4, 10.2, Math.sin(a) * 5.4); grp.add(p); }
  for (const y of [2.4, 6.4, 14, 18.2]) { const r = new THREE.Mesh(new THREE.TorusGeometry(5.5, 0.3, 6, 6), brass); r.rotation.x = Math.PI / 2; r.rotation.z = Math.PI / 6; r.position.y = y; grp.add(r); }
  const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.4, 6.6, 7, 6), brass); cap.position.y = 21.6; grp.add(cap);
  const knob = new THREE.Mesh(new THREE.SphereGeometry(1.1, 12, 8), brass); knob.position.y = 25.6; grp.add(knob);
  const ring = new THREE.Mesh(new THREE.TorusGeometry(2.2, 0.35, 8, 20), brass); ring.position.y = 28.4; grp.add(ring);
  grp.traverse((o) => { if (o.isMesh && o.material === brass) { o.castShadow = true; } });
  const flame = new THREE.Mesh(new THREE.SphereGeometry(1.5, 12, 8), new THREE.MeshBasicMaterial({ color: 0xfff0c0 })); flame.scale.y = 1.8; flame.position.y = 10; grp.add(flame);
  const light = new THREE.PointLight(0xffa458, 3200, 300, 1.6); light.position.y = 11; grp.add(light);
  const halo = new THREE.Sprite(new THREE.SpriteMaterial({ map: radialTex('255,170,90', 0.55), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
  halo.scale.set(64, 64, 1); halo.position.y = 11; grp.add(halo);
  grp.userData = { light, glass, halo };
  return grp;
}

// ------------------------------------------------------------------------------------------------ the courtyard
function tileTex() {
  const W = 512, c = canvas(W), x = c.getContext('2d'), r = rnd(11), n = 4, t = W / n;
  for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) {
    const l = 0.85 + r() * 0.25; x.fillStyle = `rgb(${Math.round(112 * l)},${Math.round(58 * l)},${Math.round(38 * l)})`; x.fillRect(i * t, j * t, t, t);
    for (let k = 0; k < 120; k++) { x.fillStyle = `rgba(${r() < 0.5 ? '60,20,5' : '230,170,120'},${0.05 + r() * 0.08})`; x.fillRect(i * t + r() * t, j * t + r() * t, 2 + r() * 5, 2 + r() * 5); }
  }
  x.strokeStyle = '#4a3226'; x.lineWidth = 7;
  for (let i = 0; i <= n; i++) { x.beginPath(); x.moveTo(i * t, 0); x.lineTo(i * t, W); x.moveTo(0, i * t); x.lineTo(W, i * t); x.stroke(); }
  const T = tex(c); T.wrapS = T.wrapT = THREE.RepeatWrapping; return T;
}
function rugTex() {
  const W = 512, H = 384, c = canvas(W, H), x = c.getContext('2d');
  const C = { red: '#1c2440', ind: '#4a1e18', ochre: '#6e5226', cream: '#6f604c', dark: '#120f18' };
  x.fillStyle = C.red; x.fillRect(0, 0, W, H);
  const band = (y, h, col) => { x.fillStyle = col; x.fillRect(0, y, W, h); };
  band(0, 26, C.dark); band(H - 26, 26, C.dark); band(26, 10, C.ochre); band(H - 36, 10, C.ochre);
  // rows of stepped diamonds (kilim)
  const dia = (cx, cy, s, col) => { x.fillStyle = col; for (let k = 0; k < s; k += 6) { const w = (s - k) * 1.2; x.fillRect(cx - w, cy - k - 6, 2 * w, 6); x.fillRect(cx - w, cy + k, 2 * w, 6); } };
  for (const [y, s, col, step] of [[78, 24, C.ind, 64], [H - 78, 24, C.ind, 64], [H / 2, 60, C.dark, 170]]) for (let cx = step / 2; cx < W; cx += step) { dia(cx, y, s, col); dia(cx, y, s * 0.45, y === H / 2 ? C.ochre : C.cream); }
  for (let i = 0; i < 4000; i++) { x.fillStyle = `rgba(0,0,0,${Math.random() * 0.08})`; x.fillRect(Math.random() * W, Math.random() * H, 2, 1); }
  return tex(c);
}
function skyTex() {
  const c = canvas(64, 512), x = c.getContext('2d'), g = x.createLinearGradient(0, 0, 0, 512);
  g.addColorStop(0, '#0d1230'); g.addColorStop(0.45, '#2c2c5a'); g.addColorStop(0.7, '#a2506a'); g.addColorStop(0.86, '#f0915a'); g.addColorStop(1, '#ffd08a');
  x.fillStyle = g; x.fillRect(0, 0, 64, 512); return tex(c);
}

export function buildCourtyard(scene) {
  const grp = new THREE.Group(); scene.add(grp);
  const ft = tileTex(); ft.repeat.set(16, 16);
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(1600, 1600), new THREE.MeshStandardMaterial({ map: ft, roughness: 0.88 }));
  floor.rotation.x = -Math.PI / 2; floor.receiveShadow = true; grp.add(floor);
  const rug = new THREE.Mesh(new THREE.BoxGeometry(150, 0.6, 108), [0, 0, new THREE.MeshStandardMaterial({ map: rugTex(), roughness: 1 }), 0, 0, 0].map((m) => m || new THREE.MeshStandardMaterial({ color: 0x3a1810, roughness: 1 })));
  rug.position.set(0, 0.3, 4); rug.receiveShadow = true; grp.add(rug);
  // the courtyard wall: horseshoe arches open to the dusk sky
  const wall = new THREE.Shape(); const WW = 1400, WH = 520, Z = -330;
  wall.moveTo(-WW / 2, 0); wall.lineTo(WW / 2, 0); wall.lineTo(WW / 2, WH); wall.lineTo(-WW / 2, WH); wall.lineTo(-WW / 2, 0);
  const arch = (cx, w, h) => { const p = new THREE.Path(), r = w / 2 * 1.12, cy = h - r; p.moveTo(cx - w / 2, 0); p.lineTo(cx - w / 2, cy - r * 0.35); p.absarc(cx, cy, r, Math.PI + 0.5, -0.5, true); p.lineTo(cx + w / 2, 0); p.lineTo(cx - w / 2, 0); return p; };
  for (const cx of [-420, -140, 140, 420]) wall.holes.push(arch(cx, 150, 330));
  const wm = new THREE.MeshStandardMaterial({ color: 0xc9a27a, roughness: 0.95 });
  const wg = new THREE.ExtrudeGeometry(wall, { depth: 40, bevelEnabled: false, curveSegments: 18 });
  const wallM = new THREE.Mesh(wg, wm); wallM.position.z = Z - 40; wallM.receiveShadow = true; grp.add(wallM);
  // a plaster frieze band along the top
  const fr = new THREE.Mesh(new THREE.BoxGeometry(WW, 22, 46), new THREE.MeshStandardMaterial({ color: 0xa47a52, roughness: 0.9 })); fr.position.set(0, WH - 60, Z - 18); grp.add(fr);
  const sky = new THREE.Mesh(new THREE.PlaneGeometry(4000, 1400), new THREE.MeshBasicMaterial({ map: skyTex(), fog: false }));
  sky.position.set(0, 500, -900); grp.add(sky);
  // garden beyond: dark cypress silhouettes and a low hedge
  const dark = new THREE.MeshBasicMaterial({ color: 0x14121c, fog: false });
  for (const [x, h] of [[-520, 360], [-300, 300], [-60, 380], [210, 330], [470, 390], [700, 300], [-760, 330]]) { const c = new THREE.Mesh(new THREE.CylinderGeometry(0, h * 0.12, h, 8), dark); c.position.set(x, h / 2 + 40, -700); grp.add(c); }
  const hedge = new THREE.Mesh(new THREE.BoxGeometry(4000, 120, 10), dark); hedge.position.set(0, 60, -690); grp.add(hedge);
  return grp;
}

export function buildLights(scene) {
  const hemi = new THREE.HemisphereLight(0x7880b8, 0x3a2016, 0.42); scene.add(hemi);
  const sun = new THREE.DirectionalLight(0xffb27a, 2.6); sun.position.set(-110, 120, 40);
  sun.shadow.camera.left = -70; sun.shadow.camera.right = 70; sun.shadow.camera.top = 70; sun.shadow.camera.bottom = -70; sun.shadow.camera.near = 20; sun.shadow.camera.far = 400;
  sun.shadow.bias = -0.0004; sun.shadow.normalBias = 0.04; sun.shadow.radius = 4;
  scene.add(sun); scene.add(sun.target);
  const rim = new THREE.DirectionalLight(0x8fa4ff, 0.7); rim.position.set(60, 60, -160); scene.add(rim);
  return { hemi, sun, rim };
}
