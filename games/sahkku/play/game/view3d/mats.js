// Procedural textures and materials: wood grain, woven Sámi band, felt, snow, dice faces. All canvases, no image files.
import * as THREE from '../vendor3d/three.js';

const TAU = Math.PI * 2;
export const BAND = ['#d23a2a', '#ffd24a', '#2f6bd6', '#3fae5c'];
// deterministic noise so renders are repeatable
function rngOf(seed) { let s = seed >>> 0 || 1; return () => { s ^= s << 13; s >>>= 0; s ^= s >> 17; s ^= s << 5; s >>>= 0; return s / 4294967296; }; }

function cv(w, h) { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; }
export function tex(canvas, { repeat, srgb = true, aniso = 8 } = {}) {
  const t = new THREE.CanvasTexture(canvas);
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = aniso;
  if (repeat) { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(repeat[0], repeat[1]); }
  return t;
}

// Wood: base colour ramp + long grain strokes + a few knots. Returns { map, bump } canvases.
export function woodCanvas(size, c0, c1, seed = 3, o = {}) {
  const c = cv(size, size), x = c.getContext('2d'), r = rngOf(seed), b = cv(size, size), bx = b.getContext('2d');
  const g = x.createLinearGradient(0, 0, size, size * 0.3); g.addColorStop(0, c0); g.addColorStop(0.5, c1); g.addColorStop(1, c0);
  x.fillStyle = g; x.fillRect(0, 0, size, size);
  bx.fillStyle = '#808080'; bx.fillRect(0, 0, size, size);
  const lines = o.lines ?? 120, vertical = !!o.vertical;
  for (let i = 0; i < lines; i++) {
    const y = r() * size, amp = 2 + r() * 10, ph = r() * TAU, fr = 0.004 + r() * 0.012, w = 0.5 + r() * 2.2, a = 0.05 + r() * 0.18;
    const dark = r() < 0.7;
    for (const [ctx, col] of [[x, dark ? `rgba(60,30,8,${a})` : `rgba(255,240,200,${a * 0.8})`], [bx, dark ? `rgba(0,0,0,${a * 1.6})` : `rgba(255,255,255,${a})`]]) {
      ctx.strokeStyle = col; ctx.lineWidth = w; ctx.beginPath();
      for (let s = 0; s <= size; s += 8) {
        const yy = y + Math.sin(s * fr + ph) * amp + Math.sin(s * fr * 2.7 + ph * 2) * amp * 0.3;
        if (vertical) { s ? ctx.lineTo(yy, s) : ctx.moveTo(yy, s); } else { s ? ctx.lineTo(s, yy) : ctx.moveTo(s, yy); }
      }
      ctx.stroke();
    }
  }
  for (let k = 0; k < (o.knots ?? 2); k++) {
    const kx = r() * size, ky = r() * size, kr = 8 + r() * 18;
    for (let q = 4; q > 0; q--) {
      x.strokeStyle = `rgba(70,36,12,${0.12 + 0.05 * q})`; x.lineWidth = 1.2; x.beginPath(); x.ellipse(kx, ky, kr * q * 0.5, kr * q * 0.22, 0, 0, TAU); x.stroke();
      bx.strokeStyle = 'rgba(0,0,0,0.18)'; bx.lineWidth = 1.5; bx.beginPath(); bx.ellipse(kx, ky, kr * q * 0.5, kr * q * 0.22, 0, 0, TAU); bx.stroke();
    }
    x.fillStyle = 'rgba(60,28,8,0.5)'; x.beginPath(); x.ellipse(kx, ky, kr * 0.35, kr * 0.15, 0, 0, TAU); x.fill();
  }
  return { map: c, bump: b };
}

// The woven Sámi band as a square ring (transparent middle), for the board frame.
export function bandRingCanvas(size = 1024, ringFrac = 0.935, bandW = 0.034) {
  const c = cv(size, size), x = c.getContext('2d'), mid = size / 2;
  const outer = size * ringFrac, wpx = size * bandW;
  const inset = (size - outer) / 2 + wpx / 2;
  const sq = (lw) => { x.lineWidth = lw; x.strokeRect(inset, inset, size - 2 * inset, size - 2 * inset); };
  x.lineJoin = 'miter';
  x.strokeStyle = '#1b0f06'; sq(wpx * 1.28);
  x.strokeStyle = '#cdb685'; sq(wpx * 1.0);
  // coloured diamonds along the ring
  const L = size - 2 * inset, step = wpx * 1.7, n = Math.floor((4 * L) / step);
  for (let i = 0; i < n; i++) {
    const t = (i / n) * 4 * L, side = Math.floor(t / L), u = t % L;
    let px, py;
    if (side === 0) { px = inset + u; py = inset; } else if (side === 1) { px = inset + L; py = inset + u; } else if (side === 2) { px = inset + L - u; py = inset + L; } else { px = inset; py = inset + L - u; }
    const k = wpx * 0.4;
    x.fillStyle = BAND[i % 4]; x.beginPath(); x.moveTo(px, py - k); x.lineTo(px + k, py); x.lineTo(px, py + k); x.lineTo(px - k, py); x.closePath(); x.fill();
  }
  void mid;
  return c;
}

// Felt well: deep blue/teal wool with a fine weave and quiet gold diamonds in the four inner corners.
export function feltCanvas(size, cols, seed = 7) {
  const c = cv(size, size), x = c.getContext('2d'), r = rngOf(seed);
  const g = x.createRadialGradient(size / 2, size / 2, size * 0.1, size / 2, size / 2, size * 0.75); g.addColorStop(0, cols[0]); g.addColorStop(1, cols[1]);
  x.fillStyle = g; x.fillRect(0, 0, size, size);
  for (let i = 0; i < 9000; i++) { x.fillStyle = r() < 0.5 ? 'rgba(255,255,255,0.035)' : 'rgba(0,0,0,0.07)'; x.fillRect(r() * size, r() * size, 1 + r() * 2, 1 + r() * 2); }
  const cell = size / 7;
  x.strokeStyle = 'rgba(255,214,110,0.30)'; x.lineWidth = Math.max(1.5, cell * 0.022);
  for (const [qr, qc] of [[1.5, 1.5], [1.5, 5.5], [5.5, 1.5], [5.5, 5.5]]) {
    const cx = qc * cell, cy = qr * cell;
    for (const k of [0.66, 0.46, 0.26]) { x.beginPath(); x.moveTo(cx, cy - k * cell); x.lineTo(cx + k * cell, cy); x.lineTo(cx, cy + k * cell); x.lineTo(cx - k * cell, cy); x.closePath(); x.stroke(); }
    x.fillStyle = 'rgba(255,214,110,0.4)'; x.beginPath(); x.arc(cx, cy, cell * 0.05, 0, TAU); x.fill();
  }
  return c;
}

// A die face: 'sun' (Dawn) | 1 | 2 | 3 | '?'
export function dieFaceCanvas(face, size = 256) {
  const c = cv(size, size), x = c.getContext('2d'), s = size;
  const g = x.createLinearGradient(0, 0, s, s); g.addColorStop(0, '#fff8e6'); g.addColorStop(1, '#e7d3a4');
  x.fillStyle = g; x.fillRect(0, 0, s, s);
  const r = rngOf(11);
  for (let i = 0; i < 700; i++) { x.fillStyle = `rgba(120,80,30,${0.03 + r() * 0.04})`; x.fillRect(r() * s, r() * s, 1 + r() * 2, 1 + r() * 8); }
  const engrave = (path) => { x.save(); path(); x.restore(); };
  if (face === 'sun') {
    engrave(() => {
      const cx = s / 2, cy = s / 2;
      const rg = x.createRadialGradient(cx - s * 0.03, cy - s * 0.04, s * 0.01, cx, cy, s * 0.2); rg.addColorStop(0, '#ffc860'); rg.addColorStop(1, '#d9610f');
      x.fillStyle = rg; x.beginPath(); x.arc(cx, cy, s * 0.17, 0, TAU); x.fill();
      x.strokeStyle = '#c24a0c'; x.lineCap = 'round'; x.lineWidth = s * 0.05;
      for (let k = 0; k < 8; k++) { const a = (k / 8) * TAU + 0.2; x.beginPath(); x.moveTo(cx + Math.cos(a) * s * 0.26, cy + Math.sin(a) * s * 0.26); x.lineTo(cx + Math.cos(a) * s * (k % 2 ? 0.34 : 0.4), cy + Math.sin(a) * s * (k % 2 ? 0.34 : 0.4)); x.stroke(); }
    });
  } else if (face === '?') {
    x.fillStyle = 'rgba(120,70,20,0.55)'; x.font = `800 ${s * 0.6}px Georgia, serif`; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText('?', s / 2, s / 2 + s * 0.04);
  } else {
    const spots = face === 1 ? [[0.5, 0.5]] : face === 2 ? [[0.3, 0.3], [0.7, 0.7]] : [[0.27, 0.27], [0.5, 0.5], [0.73, 0.73]];
    for (const [u, v] of spots) {
      const cx = u * s, cy = v * s, rr = s * 0.115;
      const rg = x.createRadialGradient(cx - rr * 0.3, cy - rr * 0.3, rr * 0.1, cx, cy, rr); rg.addColorStop(0, '#6a4020'); rg.addColorStop(1, '#2a160a');
      x.fillStyle = rg; x.beginPath(); x.arc(cx, cy, rr, 0, TAU); x.fill();
      x.strokeStyle = 'rgba(255,255,255,0.5)'; x.lineWidth = 2; x.beginPath(); x.arc(cx, cy + 1.5, rr + 1, 0.1, Math.PI - 0.1); x.stroke();
    }
  }
  // soft inner edge so each face reads as a pillowed bone surface
  const eg = x.createRadialGradient(s / 2, s / 2, s * 0.36, s / 2, s / 2, s * 0.72); eg.addColorStop(0, 'rgba(0,0,0,0)'); eg.addColorStop(1, 'rgba(90,55,20,0.28)');
  x.fillStyle = eg; x.fillRect(0, 0, s, s);
  return c;
}

// Snow: soft blue-white with drifts and sparkle.
export function snowCanvas(size = 512, seed = 5) {
  const c = cv(size, size), x = c.getContext('2d'), r = rngOf(seed);
  x.fillStyle = '#cfe0f2'; x.fillRect(0, 0, size, size);
  for (let i = 0; i < 90; i++) {
    const px = r() * size, py = r() * size, rr = 20 + r() * 90, lt = r() < 0.5;
    const g = x.createRadialGradient(px, py, 0, px, py, rr); g.addColorStop(0, lt ? 'rgba(255,255,255,0.35)' : 'rgba(120,150,200,0.28)'); g.addColorStop(1, 'rgba(255,255,255,0)');
    x.fillStyle = g; x.fillRect(px - rr, py - rr, rr * 2, rr * 2);
  }
  for (let i = 0; i < 500; i++) { x.fillStyle = `rgba(255,255,255,${0.3 + r() * 0.6})`; x.fillRect(r() * size, r() * size, 1.2, 1.2); }
  return c;
}

// Woven rug under the board: wool in deep red with the four-colour Sámi band pattern in rings.
export function rugCanvas(size = 1024) {
  const c = cv(size, size), x = c.getContext('2d'), r = rngOf(21), m = size / 2;
  x.fillStyle = '#6e1a16'; x.fillRect(0, 0, size, size);
  const ringsAt = [[0.98, '#10183a'], [0.93, '#1f2b55'], [0.88, '#d23a2a'], [0.84, '#1b0f06']];
  void ringsAt;
  // concentric squares, outer to inner
  const sqr = (inset, col) => { x.fillStyle = col; x.fillRect(inset, inset, size - 2 * inset, size - 2 * inset); };
  sqr(0, '#2a0d0c'); sqr(size * 0.02, '#8e1d17'); sqr(size * 0.045, '#3a1210'); sqr(size * 0.09, '#d9a52a'); sqr(size * 0.098, '#1b0f06'); sqr(size * 0.115, '#6e1a16');
  // diamond chain
  const n = 32;
  for (let i = 0; i < n; i++) {
    const t = (i + 0.5) / n;
    for (const [px, py] of [[size * t, size * 0.0675], [size * t, size * 0.9325], [size * 0.0675, size * t], [size * 0.9325, size * t]]) {
      const k = size * 0.011; x.fillStyle = BAND[i % 4]; x.beginPath(); x.moveTo(px, py - k); x.lineTo(px + k, py); x.lineTo(px, py + k); x.lineTo(px - k, py); x.closePath(); x.fill();
    }
  }
  for (let i = 0; i < 24000; i++) { x.fillStyle = r() < 0.5 ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.12)'; x.fillRect(r() * size, r() * size, 1 + r() * 2, 1 + r() * 2); }
  void m;
  return c;
}

// Soft radial blob (contact shadow / glow). colour is 'r,g,b'.
export function blobCanvas(rgb = '0,0,0', a = 0.55, size = 128) {
  const c = cv(size, size), x = c.getContext('2d');
  const g = x.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  g.addColorStop(0, `rgba(${rgb},${a})`); g.addColorStop(0.5, `rgba(${rgb},${a * 0.45})`); g.addColorStop(1, `rgba(${rgb},0)`);
  x.fillStyle = g; x.fillRect(0, 0, size, size); return c;
}
export function ringCanvas(rgb = '255,255,255', size = 128, inner = 0.62) {
  const c = cv(size, size), x = c.getContext('2d');
  const g = x.createRadialGradient(size / 2, size / 2, size * 0.5 * inner * 0.8, size / 2, size / 2, size / 2);
  g.addColorStop(0, `rgba(${rgb},0)`); g.addColorStop((inner + 0.04) / 1, `rgba(${rgb},0.95)`); g.addColorStop(Math.min(0.98, inner + 0.2), `rgba(${rgb},0.45)`); g.addColorStop(1, `rgba(${rgb},0)`);
  x.fillStyle = g; x.fillRect(0, 0, size, size); return c;
}
