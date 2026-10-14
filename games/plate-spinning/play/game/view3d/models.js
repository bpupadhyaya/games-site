// Plate Spinning 3D models: the painted porcelain plate (own lathe with arc-length UVs so the glaze pattern is painted in plate polar space),
// the bamboo pole (a bending tube rebuilt each frame), shards cut from the same plate, lanterns, the lacquered pole foot, verlet silk ribbons.
// Presentation only. Everything is procedural (canvas textures, analytic geometry): no image files.
import * as THREE from '../vendor3d/three.js';

const TAU = Math.PI * 2;
export const PLATE_R = 0.19;                 // metres: a 38 cm display plate (real 25-30 cm; 1.3x for readability)
const hash = (n) => { const s = Math.sin(n * 127.1 + 311.7) * 43758.5453; return s - Math.floor(s); };

// ---- plate profile (r in units of the plate radius, y in the same units; top surface first, then the underside back to the axis)
const PROF = [[0, 0.0], [0.30, 0.0], [0.46, 0.003], [0.58, 0.016], [0.68, 0.042], [0.78, 0.066], [0.88, 0.078], [0.96, 0.082], [0.995, 0.074], [1.0, 0.058],
  [0.985, 0.042], [0.92, 0.024], [0.8, 0.002], [0.64, -0.028], [0.52, -0.052], [0.46, -0.072], [0.40, -0.074], [0.35, -0.056], [0.3, -0.046], [0.0, -0.046]];
const RIM_IDX = 9;                           // the last point of the top surface (rim edge)
const arcs = (() => { const a = [0]; for (let i = 1; i < PROF.length; i++) a.push(a[i - 1] + Math.hypot(PROF[i][0] - PROF[i - 1][0], PROF[i][1] - PROF[i - 1][1])); return a; })();
const ARC_TOTAL = arcs[arcs.length - 1];
export const V_RIM = arcs[RIM_IDX] / ARC_TOTAL;
const rToV = (r) => {                        // top-surface radius -> texture v
  for (let i = 1; i <= RIM_IDX; i++) if (r <= PROF[i][0] + 1e-9) { const f = (r - PROF[i - 1][0]) / Math.max(1e-6, PROF[i][0] - PROF[i - 1][0]); return (arcs[i - 1] + (arcs[i] - arcs[i - 1]) * f) / ARC_TOTAL; }
  return V_RIM;
};

// Rings of the profile as a lathe geometry with analytic normals (no seam artefacts) and v by arc length.
export function plateGeometry(seg = 64) {
  const n = PROF.length, pos = [], nor = [], uv = [], idx = [];
  for (let j = 0; j < n; j++) {
    const a = PROF[Math.max(0, j - 1)], b = PROF[Math.min(n - 1, j + 1)];
    let tx = b[0] - a[0], ty = b[1] - a[1]; const tl = Math.hypot(tx, ty) || 1; tx /= tl; ty /= tl;
    const nr = -ty, ny = tx;                // outward / up for the top (profile runs outwards)
    for (let i = 0; i <= seg; i++) {
      const th = (i / seg) * TAU, c = Math.cos(th), s = Math.sin(th);
      pos.push(PROF[j][0] * c, PROF[j][1], PROF[j][0] * s); nor.push(nr * c, ny, nr * s); uv.push(i / seg, arcs[j] / ARC_TOTAL);
    }
  }
  for (let j = 0; j < n - 1; j++) for (let i = 0; i < seg; i++) { const p = j * (seg + 1) + i, q = p + seg + 1; idx.push(p, p + 1, q, q, p + 1, q + 1); }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx);
  return g;
}

// A shard: a jagged sector of the plate surface (same uv, so it carries the painted pattern), top sheet plus a thin underside skin.
export function shardGeometry(th0, th1, r0, r1, seed) {
  const NT = 4, NR = 4, pos = [], uv = [], idx = [];
  const rr = (k) => r0 + (r1 - r0) * k;
  const surf = (r) => { // y of the top surface at radius r
    for (let i = 1; i <= RIM_IDX; i++) if (r <= PROF[i][0]) { const f = (r - PROF[i - 1][0]) / Math.max(1e-6, PROF[i][0] - PROF[i - 1][0]); return PROF[i - 1][1] + (PROF[i][1] - PROF[i - 1][1]) * f; }
    return PROF[RIM_IDX][1];
  };
  const th = 0.012;
  for (let layer = 0; layer < 2; layer++) {
    for (let a = 0; a <= NT; a++) for (let b = 0; b <= NR; b++) {
      const jx = (hash(seed * 7 + a * 13 + b * 31 + layer) - 0.5) * 0.35, jr = (hash(seed * 5 + a * 17 + b * 3) - 0.5) * 0.35;
      const edge = a === 0 || a === NT || b === 0 || b === NR;
      const t = th0 + (th1 - th0) * (a / NT + (edge ? jx / NT : 0)), r = Math.min(1, Math.max(0.02, rr(b / NR + (edge ? jr / NR : 0))));
      const y = surf(r) - (layer ? th : 0);
      pos.push(Math.cos(t) * r, y, Math.sin(t) * r); uv.push(((t / TAU) % 1 + 1) % 1, rToV(r));
    }
  }
  const W = NR + 1, L2 = (NT + 1) * W;
  for (let a = 0; a < NT; a++) for (let b = 0; b < NR; b++) {
    const p = a * W + b, q = p + W;
    idx.push(p, p + 1, q, q, p + 1, q + 1);
    idx.push(L2 + p, L2 + q, L2 + p + 1, L2 + q, L2 + q + 1, L2 + p + 1);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); g.setIndex(idx);
  g.computeVertexNormals();
  // re-centre on the centroid so the shard tumbles about itself
  g.computeBoundingBox(); const c = new THREE.Vector3(); g.boundingBox.getCenter(c); g.translate(-c.x, -c.y, -c.z); g.userData = { c };
  return g;
}

// ---- painted glaze textures --------------------------------------------------------------------------------------------------------------
const TEXW = 1024, TEXH = 512;
function paintCtx() {
  const c = document.createElement('canvas'); c.width = TEXW; c.height = TEXH;
  return { c, g: c.getContext('2d') };
}
// polar helpers: (r, theta) in plate space -> canvas pixels
const PX = (th) => ((th / TAU) % 1 + 1) % 1 * TEXW;
const PY = (r) => rToV(r) * TEXH;
function ring(g, r, w, col) { g.strokeStyle = col; g.lineWidth = Math.max(1, w * TEXH * 2.3); g.beginPath(); g.moveTo(0, PY(r)); g.lineTo(TEXW, PY(r)); g.stroke(); }
function band(g, r0, r1, col) { g.fillStyle = col; g.fillRect(0, PY(r0), TEXW, PY(r1) - PY(r0)); }
// A closed shape given as [r, theta] samples (drawn as a polygon in canvas space; the seam wrap is handled by drawing it three times)
function shape(g, pts, fill, stroke, lw) {
  for (const off of [-TEXW, 0, TEXW]) {
    g.beginPath();
    let prev = null, offs = 0;
    pts.forEach(([r, th], i) => {
      let x = PX(th) + offs + off;
      if (prev !== null && Math.abs(x - prev) > TEXW * 0.5) { offs += x < prev ? TEXW : -TEXW; x = PX(th) + offs + off; }
      const y = PY(r); if (i === 0) g.moveTo(x, y); else g.lineTo(x, y); prev = x;
    });
    g.closePath(); if (fill) { g.fillStyle = fill; g.fill(); } if (stroke) { g.strokeStyle = stroke; g.lineWidth = lw || 2; g.stroke(); }
  }
}
function petal(g, r0, r1, th, half, fill, stroke, lw, pointy = 0.6) {
  const pts = [], N = 14;
  for (let i = 0; i <= N; i++) { const u = i / N, r = r0 + (r1 - r0) * u, w = half * Math.sin(Math.PI * Math.pow(u, 0.75)) * (1 - pointy * u * u); pts.push([r, th - w]); }
  for (let i = N; i >= 0; i--) { const u = i / N, r = r0 + (r1 - r0) * u, w = half * Math.sin(Math.PI * Math.pow(u, 0.75)) * (1 - pointy * u * u); pts.push([r, th + w]); }
  shape(g, pts, fill, stroke, lw);
}
function dotAt(g, r, th, rad, fill) { const x = PX(th), y = PY(r); g.fillStyle = fill; for (const o of [-TEXW, 0, TEXW]) { g.beginPath(); g.ellipse(x + o, y, rad * (r < 0.3 ? 1 : 1), rad * 0.9, 0, 0, TAU); g.fill(); } }
function glazeNoise(g, seed, amt = 6) {
  const img = g.getImageData(0, 0, TEXW, TEXH), d = img.data; let s = seed * 9301 + 49297;
  for (let i = 0; i < d.length; i += 4) { s = (s * 1664525 + 1013904223) >>> 0; const n = ((s >>> 24) - 128) / 128 * amt; d[i] += n; d[i + 1] += n; d[i + 2] += n; }
  g.putImageData(img, 0, 0);
}

const PATTERNS = {
  // blue and white: lotus petals around a flower medallion, a wave scroll on the rim, fine cobalt lines
  porcelain(g, still) {
    const W = '#f6f7f2', B1 = '#1f4b9e', B2 = '#4b78c8', B3 = '#9db8e6';
    g.fillStyle = W; g.fillRect(0, 0, TEXW, TEXH);
    const lg = g.createLinearGradient(0, 0, 0, TEXH * V_RIM); lg.addColorStop(0, 'rgba(190,206,235,0.4)'); lg.addColorStop(0.6, 'rgba(255,255,255,0)'); g.fillStyle = lg; g.fillRect(0, 0, TEXW, TEXH);
    // rim lines
    ring(g, 0.975, 0.008, B1); ring(g, 0.93, 0.004, B2);
    // wave scroll on the rim (r 0.80 - 0.9)
    if (!still) {
      g.strokeStyle = B1; g.lineWidth = 3.2; g.beginPath();
      for (let i = 0; i <= 480; i++) { const th = (i / 480) * TAU, r = 0.855 + 0.03 * Math.sin(th * 16); const x = PX(th), y = PY(r); if (i === 0) g.moveTo(x, y); else g.lineTo(x, y); }
      g.stroke();
      for (let k = 0; k < 16; k++) { const th = ((k + 0.5) / 16) * TAU; dotAt(g, 0.855, th, 4.5, B2); }
    } else { ring(g, 0.855, 0.014, B2); }
    ring(g, 0.79, 0.006, B1); ring(g, 0.775, 0.003, B3);
    // lotus petals (twelve) in the cavetto, drawn as an outline with a wash
    for (let k = 0; k < 12; k++) {
      const th = (k / 12) * TAU;
      if (still) { petal(g, 0.58, 0.77, th, 0.16, 'rgba(70,110,200,0.75)', null, 0); continue; }
      petal(g, 0.58, 0.77, th, 0.158, 'rgba(160,185,235,0.55)', B1, 2.6);
      petal(g, 0.61, 0.73, th, 0.085, null, B2, 2);
    }
    ring(g, 0.56, 0.005, B1); ring(g, 0.5, 0.003, B2);
    // medallion: eight-petalled flower and a dot centre
    for (let k = 0; k < 8; k++) { const th = (k / 8) * TAU + 0.2; petal(g, 0.05, 0.4, th, 0.38, still ? 'rgba(70,110,200,0.7)' : 'rgba(170,194,238,0.6)', still ? null : B1, 2.4, 0.3); }
    if (!still) for (let k = 0; k < 8; k++) { const th = (k / 8) * TAU + 0.2 + Math.PI / 8; petal(g, 0.18, 0.43, th, 0.13, null, B2, 1.8); }
    band(g, 0, 0.05, B1);
    // underside: a plain foot with one cobalt ring
    ring(g, 0.0, 0, W);
    g.fillStyle = W; g.fillRect(0, TEXH * (V_RIM + 0.02), TEXW, TEXH);
    g.fillStyle = B1; g.fillRect(0, TEXH * (V_RIM + 0.5 * (1 - V_RIM)) - 3, TEXW, 5);
  },
  // red lacquer with gold: cloud scroll, coin ring, gold lotus
  lacquer(g, still) {
    const R0 = '#9c1220', R1 = '#c8202e', GOLD = '#f2c660', GOLD2 = '#ffe29a';
    const lg = g.createLinearGradient(0, 0, 0, TEXH); lg.addColorStop(0, R1); lg.addColorStop(V_RIM, R0); lg.addColorStop(1, '#5a0710'); g.fillStyle = lg; g.fillRect(0, 0, TEXW, TEXH);
    ring(g, 0.975, 0.01, GOLD); ring(g, 0.935, 0.004, GOLD2);
    if (!still) for (let k = 0; k < 20; k++) { const th = ((k + 0.5) / 20) * TAU; dotAt(g, 0.88, th, 6, GOLD); }
    else ring(g, 0.88, 0.016, GOLD);
    ring(g, 0.82, 0.006, GOLD);
    for (let k = 0; k < 10; k++) {                                       // cloud scrolls
      const th = (k / 10) * TAU;
      if (still) { petal(g, 0.58, 0.78, th, 0.2, 'rgba(240,200,100,0.45)', null, 0); continue; }
      petal(g, 0.58, 0.78, th, 0.2, null, GOLD, 3, 0.2); petal(g, 0.64, 0.74, th, 0.1, GOLD, null, 0, 0.1);
    }
    ring(g, 0.55, 0.006, GOLD); ring(g, 0.48, 0.003, GOLD2);
    for (let k = 0; k < 10; k++) { const th = (k / 10) * TAU; petal(g, 0.04, 0.42, th, 0.3, still ? 'rgba(240,200,100,0.45)' : null, still ? null : GOLD, 2.6, 0.3); }
    band(g, 0, 0.05, GOLD);
    g.fillStyle = R0; g.fillRect(0, TEXH * (V_RIM + 0.02), TEXW, TEXH);
  },
  // carved jade: soft green with paler veins and engraved rings
  jade(g, still) {
    const lg = g.createLinearGradient(0, 0, TEXW, TEXH); lg.addColorStop(0, '#5fc79b'); lg.addColorStop(0.5, '#43ad84'); lg.addColorStop(1, '#6fd0a8'); g.fillStyle = lg; g.fillRect(0, 0, TEXW, TEXH);
    for (let i = 0; i < 70; i++) { g.strokeStyle = `rgba(230,255,240,${0.06 + hash(i) * 0.14})`; g.lineWidth = 2 + hash(i + 9) * 8; g.beginPath(); const y0 = hash(i + 3) * TEXH; g.moveTo(0, y0); g.bezierCurveTo(TEXW * 0.3, y0 + hash(i + 5) * 120 - 60, TEXW * 0.6, y0 + hash(i + 8) * 120 - 60, TEXW, y0 + hash(i + 11) * 80 - 40); g.stroke(); }
    ring(g, 0.97, 0.008, '#d8fff0'); ring(g, 0.9, 0.004, '#1f6f55'); ring(g, 0.74, 0.005, '#1f6f55'); ring(g, 0.5, 0.004, '#1f6f55');
    if (!still) for (let k = 0; k < 6; k++) { const th = (k / 6) * TAU; petal(g, 0.06, 0.46, th, 0.45, 'rgba(20,100,70,0.22)', '#1f6f55', 2.4, 0.2); petal(g, 0.76, 0.9, th + TAU / 12, 0.22, null, '#1f6f55', 2); }
    g.fillStyle = '#2c8a68'; g.fillRect(0, TEXH * (V_RIM + 0.02), TEXW, TEXH);
  },
  // gilded: hammered gold with engraved bands
  gold(g, still) {
    const lg = g.createLinearGradient(0, 0, 0, TEXH); lg.addColorStop(0, '#ffe58a'); lg.addColorStop(V_RIM, '#e2a92f'); lg.addColorStop(1, '#8a5a0c'); g.fillStyle = lg; g.fillRect(0, 0, TEXW, TEXH);
    ring(g, 0.975, 0.01, '#fff3bd'); ring(g, 0.93, 0.005, '#9a6a12'); ring(g, 0.8, 0.006, '#9a6a12'); ring(g, 0.55, 0.005, '#9a6a12');
    if (!still) {
      for (let k = 0; k < 48; k++) { const th = (k / 48) * TAU; g.strokeStyle = '#b8821a'; g.lineWidth = 2.5; g.beginPath(); g.moveTo(PX(th), PY(0.82)); g.lineTo(PX(th), PY(0.92)); g.stroke(); }
      for (let k = 0; k < 12; k++) { const th = (k / 12) * TAU; petal(g, 0.58, 0.78, th, 0.14, 'rgba(255,240,170,0.5)', '#9a6a12', 2.4); petal(g, 0.04, 0.5, th, 0.26, null, '#9a6a12', 2); }
    }
    g.fillStyle = '#a8731a'; g.fillRect(0, TEXH * (V_RIM + 0.02), TEXW, TEXH);
  },
};

function tex(type, still) {
  const { c, g } = paintCtx();
  PATTERNS[type](g, still);
  glazeNoise(g, type.length * 7 + (still ? 1 : 0), 5);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.flipY = false; t.wrapS = THREE.RepeatWrapping; t.anisotropy = 8;
  return t;
}

const MATS = {};
export function plateMaterials(type) {
  if (MATS[type]) return MATS[type];
  const base = { porcelain: { rough: 0.16, cc: 1, ccr: 0.04, metal: 0, env: 1.3, glow: '#c8d4ff' }, lacquer: { rough: 0.2, cc: 1, ccr: 0.05, metal: 0, env: 1.2 }, jade: { rough: 0.24, cc: 0.7, ccr: 0.1, metal: 0, env: 1.2 }, gold: { rough: 0.28, cc: 0.2, ccr: 0.2, metal: 0.85, env: 1.5 } }[type];
  const mk = (still, extra = {}) => new THREE.MeshPhysicalMaterial({ map: tex(type, still), roughness: base.rough, metalness: base.metal, clearcoat: base.cc, clearcoatRoughness: base.ccr, envMapIntensity: base.env, emissiveMap: null, emissive: new THREE.Color(base.glow || '#000'), emissiveIntensity: 0.18, ...extra });
  MATS[type] = { sharp: mk(false), still: mk(true, { transparent: true, opacity: 0, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -1 }) };
  return MATS[type];
}
export function disposePlateMaterials() { for (const k of Object.keys(MATS)) { for (const m of Object.values(MATS[k])) { m.map && m.map.dispose(); m.dispose(); } delete MATS[k]; } }

// ---- bamboo pole ---------------------------------------------------------------------------------------------------------------------------
let bambooMat = null;
function bambooTexture() {
  const c = document.createElement('canvas'); c.width = 64; c.height = 256; const g = c.getContext('2d');
  const lg = g.createLinearGradient(0, 0, 64, 0); lg.addColorStop(0, '#9a7a34'); lg.addColorStop(0.3, '#e8cc7c'); lg.addColorStop(0.55, '#f4e0a0'); lg.addColorStop(1, '#8a6a2a');
  g.fillStyle = lg; g.fillRect(0, 0, 64, 256);
  for (let i = 0; i < 120; i++) { g.fillStyle = `rgba(90,60,20,${0.04 + hash(i) * 0.07})`; g.fillRect(hash(i + 1) * 64, 0, 1 + hash(i + 2) * 1.6, 256); }
  g.fillStyle = 'rgba(70,46,14,0.75)'; g.fillRect(0, 0, 64, 7); g.fillStyle = 'rgba(255,235,170,0.35)'; g.fillRect(0, 7, 64, 3);   // node every texture period
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = 4;
  return t;
}
export function bambooMaterial() { return bambooMat || (bambooMat = new THREE.MeshStandardMaterial({ map: bambooTexture(), roughness: 0.55, metalness: 0.04 })); }

// A pole is a tube whose centre line is a polyline we rewrite every frame. pts: N+1 world-local points (relative to the group origin).
export function createPole(height, { sides = 8, rings = 14 } = {}) {
  const geo = new THREE.BufferGeometry(), nv = (rings + 1) * (sides + 1);
  const pos = new Float32Array(nv * 3), nor = new Float32Array(nv * 3), uv = new Float32Array(nv * 2), idx = [];
  for (let k = 0; k <= rings; k++) for (let i = 0; i <= sides; i++) { const v = k * (sides + 1) + i; uv[v * 2] = i / sides; uv[v * 2 + 1] = (k / rings) * height / 0.3; }
  for (let k = 0; k < rings; k++) for (let i = 0; i < sides; i++) { const p = k * (sides + 1) + i, q = p + sides + 1; idx.push(p, p + 1, q, q, p + 1, q + 1); }
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3)); geo.setAttribute('normal', new THREE.BufferAttribute(nor, 3)); geo.setAttribute('uv', new THREE.BufferAttribute(uv, 2)); geo.setIndex(idx);
  geo.boundingSphere = new THREE.Sphere(new THREE.Vector3(0, height / 2, 0), height);
  const mesh = new THREE.Mesh(geo, bambooMaterial()); mesh.castShadow = true; mesh.frustumCulled = false;
  const t = new THREE.Vector3(), up = new THREE.Vector3(), side = new THREE.Vector3(), tipV = new THREE.Vector3();
  // off(s) -> {x, z}: lateral offset of the centre line at s (0 base .. 1 tip); returns the tip position
  function update(off, r0 = 0.0165, r1 = 0.0095) {
    const pts = [];
    for (let k = 0; k <= rings; k++) { const s = k / rings, o = off(s); pts.push([o.x, s * height - (o.sag || 0), o.z]); }
    for (let k = 0; k <= rings; k++) {
      const a = pts[Math.max(0, k - 1)], b = pts[Math.min(rings, k + 1)];
      t.set(b[0] - a[0], b[1] - a[1], b[2] - a[2]).normalize();
      up.set(0, 0, 1); if (Math.abs(t.z) > 0.9) up.set(1, 0, 0);
      side.crossVectors(t, up).normalize(); up.crossVectors(side, t).normalize();
      const r = r0 + (r1 - r0) * (k / rings);
      for (let i = 0; i <= sides; i++) {
        const th = (i / sides) * TAU, c = Math.cos(th), s = Math.sin(th), v = k * (sides + 1) + i;
        const nx = side.x * c + up.x * s, ny = side.y * c + up.y * s, nz = side.z * c + up.z * s;
        pos[v * 3] = pts[k][0] + nx * r; pos[v * 3 + 1] = pts[k][1] + ny * r; pos[v * 3 + 2] = pts[k][2] + nz * r;
        nor[v * 3] = nx; nor[v * 3 + 1] = ny; nor[v * 3 + 2] = nz;
      }
    }
    geo.attributes.position.needsUpdate = true; geo.attributes.normal.needsUpdate = true;
    return tipV.set(pts[rings][0], pts[rings][1], pts[rings][2]);
  }
  return { mesh, update, geo, rings };
}

// ---- pole foot: a lacquered block with a brass collar ---------------------------------------------------------------------------------------
export function createFoot() {
  const g = new THREE.Group();
  const lac = new THREE.MeshPhysicalMaterial({ color: '#7d1019', roughness: 0.3, clearcoat: 1, clearcoatRoughness: 0.1, envMapIntensity: 0.9 });
  const brass = new THREE.MeshStandardMaterial({ color: '#d8aa4a', roughness: 0.32, metalness: 0.9, envMapIntensity: 1.3 });
  const pts = [[0, 0], [0.12, 0], [0.125, 0.012], [0.12, 0.03], [0.1, 0.075], [0.06, 0.1], [0.036, 0.11], [0, 0.11]];
  const body = new THREE.Mesh(new THREE.LatheGeometry(pts.map(([r, y]) => new THREE.Vector2(r, y)), 28), lac); body.castShadow = true; body.receiveShadow = true;
  const collar = new THREE.Mesh(new THREE.CylinderGeometry(0.028, 0.034, 0.05, 16), brass); collar.position.y = 0.12; collar.castShadow = true;
  const ringM = new THREE.Mesh(new THREE.TorusGeometry(0.108, 0.006, 8, 32), brass); ringM.rotation.x = Math.PI / 2; ringM.position.y = 0.045;
  g.add(body, collar, ringM);
  return g;
}

// ---- lantern ---------------------------------------------------------------------------------------------------------------------------------
let glowTex = null;
export function glowTexture() {
  if (glowTex) return glowTex;
  const c = document.createElement('canvas'); c.width = c.height = 64; const g = c.getContext('2d');
  const gr = g.createRadialGradient(32, 32, 0, 32, 32, 32); gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.25, 'rgba(255,255,255,0.45)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = gr; g.fillRect(0, 0, 64, 64); glowTex = new THREE.CanvasTexture(c); glowTex.colorSpace = THREE.SRGBColorSpace; return glowTex;
}
export function createLantern(color = '#e03a20', size = 0.28) {
  const g = new THREE.Group();
  const prof = []; for (let i = 0; i <= 14; i++) { const u = i / 14, a = u * Math.PI; prof.push(new THREE.Vector2(Math.sin(a) * (0.82 + 0.05 * Math.sin(u * 20)), -Math.cos(a))); }
  const bodyM = new THREE.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: 1.1, roughness: 0.6 });
  const body = new THREE.Mesh(new THREE.LatheGeometry(prof, 20), bodyM); body.scale.set(size, size, size);
  const gold = new THREE.MeshStandardMaterial({ color: '#e7bd5a', roughness: 0.35, metalness: 0.8 });
  const capT = new THREE.Mesh(new THREE.CylinderGeometry(size * 0.38, size * 0.3, size * 0.16, 14), gold); capT.position.y = size * 1.0;
  const capB = capT.clone(); capB.position.y = -size * 1.0;
  const tassel = new THREE.Mesh(new THREE.CylinderGeometry(size * 0.04, size * 0.16, size * 0.7, 8), new THREE.MeshStandardMaterial({ color: '#e7bd5a', roughness: 0.6 })); tassel.position.y = -size * 1.5;
  const halo = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTexture(), color, blending: THREE.AdditiveBlending, transparent: true, depthWrite: false, opacity: 0.8, fog: false }));
  halo.scale.setScalar(size * 5.5);
  g.add(body, capT, capB, tassel, halo);
  g.userData = { halo, bodyM, size };
  return g;
}

// ---- verlet silk ribbon ----------------------------------------------------------------------------------------------------------------------
// n points hung from a moving anchor; gravity, air drag, rest-length constraints. width tapers a little. Rendered as a double-sided strip.
export function createRibbon({ n = 7, length = 0.55, width = 0.07, color = '#b3202f', trim = null } = {}) {
  const P = [], Q = [], seg = length / (n - 1);
  for (let i = 0; i < n; i++) { P.push(new THREE.Vector3(0, -i * seg, 0)); Q.push(new THREE.Vector3(0, -i * seg, 0)); }
  const geo = new THREE.BufferGeometry(), pos = new Float32Array(n * 2 * 3), uv = new Float32Array(n * 2 * 2), idx = [];
  for (let i = 0; i < n; i++) { uv.set([0, i / (n - 1), 1, i / (n - 1)], i * 4); }
  for (let i = 0; i < n - 1; i++) { const a = i * 2; idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); }
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3)); geo.setAttribute('uv', new THREE.BufferAttribute(uv, 2)); geo.setIndex(idx); geo.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 50);
  const mat = new THREE.MeshStandardMaterial({ color, roughness: 0.4, metalness: 0.05, side: THREE.DoubleSide, envMapIntensity: 0.8 });
  const mesh = new THREE.Mesh(geo, mat); mesh.frustumCulled = false; mesh.castShadow = false;
  const side = new THREE.Vector3(), tmp = new THREE.Vector3(), dirv = new THREE.Vector3();
  const api = {
    mesh, P,
    // anchor / sideways: world vectors. wind: world acceleration.
    step(dt, anchor, sideways, wind) {
      const h = Math.min(dt, 1 / 30), g = -9.8 * 0.55;
      P[0].copy(anchor); Q[0].copy(anchor);
      for (let i = 1; i < n; i++) {
        tmp.copy(P[i]).sub(Q[i]).multiplyScalar(0.965);          // verlet velocity with drag
        Q[i].copy(P[i]); P[i].add(tmp);
        P[i].y += g * h * h; if (wind) P[i].addScaledVector(wind, h * h);
      }
      for (let it = 0; it < 4; it++) {
        for (let i = 1; i < n; i++) {
          dirv.copy(P[i]).sub(P[i - 1]); const d = dirv.length() || 1e-6, diff = (d - seg) / d;
          if (i === 1) P[i].addScaledVector(dirv, -diff); else { P[i].addScaledVector(dirv, -diff * 0.5); P[i - 1].addScaledVector(dirv, diff * 0.5); }
        }
        P[0].copy(anchor);
      }
      for (let i = 0; i < n; i++) {
        const w = width * (1 - 0.25 * (i / (n - 1))) * 0.5;
        side.copy(sideways); if (i > 0) { dirv.copy(P[i]).sub(P[i - 1]); tmp.crossVectors(dirv, side); side.crossVectors(tmp, dirv).normalize(); if (!isFinite(side.x)) side.copy(sideways); }
        pos[i * 6] = P[i].x - side.x * w; pos[i * 6 + 1] = P[i].y - side.y * w; pos[i * 6 + 2] = P[i].z - side.z * w;
        pos[i * 6 + 3] = P[i].x + side.x * w; pos[i * 6 + 4] = P[i].y + side.y * w; pos[i * 6 + 5] = P[i].z + side.z * w;
      }
      geo.attributes.position.needsUpdate = true; geo.computeVertexNormals();
    },
    reset(anchor) { for (let i = 0; i < n; i++) { P[i].set(anchor.x, anchor.y - i * seg, anchor.z); Q[i].copy(P[i]); } },
  };
  void trim;
  return api;
}

export { THREE, hash, TAU };
