// Kharbaga 3D models: a hand-carved terracotta-framed sand board, basalt/limestone (or terracotta/cream clay) pucks, Master crowns,
// the market-evening environment (woven rug, brass lanterns, drifting embers). Built on platform/view3d board3d. Pure construction:
// nothing here reads the simulation. Units: one cell = 1.
import { board3d as B, THREE } from '../vendor3d/index.js';

export const NC = 5, FRAME = 0.55, OUT = NC + 2 * FRAME, FH = 0.34, TILE_TOP = FH + 0.075, HALF = OUT / 2;
export const cellX = (i) => (i % NC) - (NC - 1) / 2;
export const cellZ = (i) => Math.floor(i / NC) - (NC - 1) / 2;

const cv = (w, h = w) => { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; };
const lcg = (seed) => { let s = seed >>> 0; return () => ((s = (Math.imul(s, 1664525) + 1013904223) >>> 0) / 4294967296); };
const tex = (c, rep, srgb = true) => { const t = new THREE.CanvasTexture(c); if (srgb) t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8; if (rep) { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(rep[0], rep[1]); } return t; };

// palettes (same keys and look as the 2D art): frame, tile, groove, line, trim
export const PAL3 = {
  sand: { frame: ['#d98a58', '#b4623a'], tile: ['#ecd098', '#c9a165'], groove: '#6e4a26', line: '#5a3217', trim: '#f2cf8c' },
  dusk: { frame: ['#6d83a3', '#475a78'], tile: ['#e3e8ec', '#aab6c4'], groove: '#3a4452', line: '#222c3f', trim: '#e6c88a' },
  rose: { frame: ['#bd5a4c', '#8a342c'], tile: ['#f7dccf', '#d9a08c'], groove: '#6a362c', line: '#4a1a15', trim: '#f4d49a' },
};
export const PIECE3 = {
  stone: { 1: { c: '#5a5046', c2: '#2c2621', ink: 'brass', kind: 'stone' }, 2: { c: '#efe2c0', c2: '#c4b088', ink: 'darkWood', kind: 'ivory' } },
  clay: { 1: { c: '#b9683f', c2: '#6e3016', ink: 'brass', kind: 'clay' }, 2: { c: '#e9e2cf', c2: '#b8ae94', ink: 'darkWood', kind: 'clay' } },
};

const diamond = (r, sq = 1.25) => [[0, -r * sq], [r, 0], [0, r * sq], [-r, 0]];
function frameShape(w, d, rad) { const s = new THREE.Shape(), x = -w / 2, y = -d / 2; s.moveTo(x + rad, y); s.lineTo(x + w - rad, y); s.quadraticCurveTo(x + w, y, x + w, y + rad); s.lineTo(x + w, y + d - rad); s.quadraticCurveTo(x + w, y + d, x + w - rad, y + d); s.lineTo(x + rad, y + d); s.quadraticCurveTo(x, y + d, x, y + d - rad); s.lineTo(x, y + rad); s.quadraticCurveTo(x, y, x + rad, y); return s; }
function ringShape(outer, inner, sq = 1.25) {
  const s = new THREE.Shape(outer.map(([x, z]) => new THREE.Vector2(x, -z)));
  const h = new THREE.Path(inner.map(([x, z]) => new THREE.Vector2(x, -z)).reverse()); s.holes.push(h); return s;
}

// ---------------------------------------------------------------- the board
export function buildBoard(kind) {
  const pal = PAL3[kind] || PAL3.sand, g = new THREE.Group();
  const frameMat = B.material('clay', { color: pal.frame[0], color2: pal.frame[1], repeat: [2, 2], seed: 11, roughness: 0.82 });
  const body = new THREE.Mesh(B.slab(OUT, OUT, FH, 0.2, 0.085, { seg: 4 }), frameMat);
  body.castShadow = body.receiveShadow = true; g.add(body);
  // a deeper foot so the slab reads as a thick carved block
  const foot = new THREE.Mesh(B.slab(OUT - 0.1, OUT - 0.1, 0.1, 0.18, 0.04), B.material('darkWood', { color: '#3a1f10', color2: '#52301a' }));
  foot.position.y = -0.0; foot.castShadow = true; g.add(foot);
  // brass rim line + zig-zag trim carved into the frame
  const brass = B.material('brass');
  const rimGeo = B.inlay(ringShape([[-OUT / 2 + 0.07, -OUT / 2 + 0.07], [OUT / 2 - 0.07, -OUT / 2 + 0.07], [OUT / 2 - 0.07, OUT / 2 - 0.07], [-OUT / 2 + 0.07, OUT / 2 - 0.07]], [[-OUT / 2 + 0.1, -OUT / 2 + 0.1], [OUT / 2 - 0.1, -OUT / 2 + 0.1], [OUT / 2 - 0.1, OUT / 2 - 0.1], [-OUT / 2 + 0.1, OUT / 2 - 0.1]]), 0.02);
  const rim = new THREE.Mesh(rimGeo, brass); rim.position.y = FH - 0.004; g.add(rim);
  const triG = B.inlay([[-0.085, 0.07], [0.085, 0.07], [0, -0.08]], 0.02, { bevel: 0.004 });
  const parts = [], mid = FRAME / 2 + 0.0, n = NC * 3, pitch = NC / n;
  for (let k = 0; k < n; k++) {
    const t = -NC / 2 + (k + 0.5) * pitch;
    for (const side of [0, 1, 2, 3]) {
      const m = new THREE.Matrix4(), ang = side * Math.PI / 2;
      const px = side === 0 ? t : side === 1 ? NC / 2 + mid : side === 2 ? -t : -(NC / 2 + mid);
      const pz = side === 0 ? -(NC / 2 + mid) : side === 1 ? t : side === 2 ? NC / 2 + mid : -t;
      m.makeRotationY(-ang); m.setPosition(px, FH - 0.004, pz); parts.push({ geo: triG, m });
    }
  }
  const trim = new THREE.Mesh(B.mergeGeos(parts), B.material('brass', { color: pal.trim, color2: '#f7e2a8', seed: 4 })); trim.castShadow = false; g.add(trim);
  // sunken playing surface: dark groove bed, then 25 carved tiles
  const bed = new THREE.Mesh(B.slab(NC + 0.2, NC + 0.2, 0.05, 0.05, 0.015), new THREE.MeshStandardMaterial({ color: pal.groove, roughness: 0.9 }));
  bed.position.y = FH; bed.receiveShadow = true; g.add(bed);
  const bedRim = new THREE.Mesh(B.inlay(ringShape([[-NC / 2 - 0.1, -NC / 2 - 0.1], [NC / 2 + 0.1, -NC / 2 - 0.1], [NC / 2 + 0.1, NC / 2 + 0.1], [-NC / 2 - 0.1, NC / 2 + 0.1]], [[-NC / 2 - 0.04, -NC / 2 - 0.04], [NC / 2 + 0.04, -NC / 2 - 0.04], [NC / 2 + 0.04, NC / 2 + 0.04], [-NC / 2 - 0.04, NC / 2 + 0.04]]), 0.04, { bevel: 0.006 }), B.material('darkWood', { color: '#2b160a', color2: '#432611' }));
  bedRim.position.y = FH + 0.03; bedRim.castShadow = true; g.add(bedRim);
  const tileGeo = B.slab(0.9, 0.9, 0.07, 0.085, 0.032);
  const mats = [0, 1, 2].map((k) => B.material('stone', { color: pal.tile[0], color2: pal.tile[1], seed: 21 + k * 7, roughness: 0.86 }));
  const r = lcg(31);
  for (let i = 0; i < NC * NC; i++) {
    const m = new THREE.Mesh(tileGeo, mats[(r() * 3) | 0]); m.position.set(cellX(i), FH + 0.005, cellZ(i)); m.rotation.y = 0;
    m.castShadow = m.receiveShadow = true; g.add(m);
  }
  // carved lozenges (centre, and the four corners)
  const line = B.material('darkWood', { color: pal.line, color2: pal.line, roughness: 0.6 });
  const lz = (cx, cz, ro, ri) => { const mm = new THREE.Mesh(B.inlay(ringShape(diamond(ro).map(([x, z]) => [x + cx, z + cz]), diamond(ri).map(([x, z]) => [x + cx, z + cz])), 0.012, { bevel: 0.003 }), line); mm.position.y = TILE_TOP - 0.006; g.add(mm); };
  lz(0, 0, 0.3, 0.26); lz(0, 0, 0.15, 0.11);
  for (const [i, j] of [[0, 0], [NC - 1, 0], [0, NC - 1], [NC - 1, NC - 1]]) lz(i - 2, j - 2, 0.12, 0.085);
  return g;
}

// ---------------------------------------------------------------- pieces
const PUCK = [[0, 0], [0.37, 0], [0.4, 0.015], [0.425, 0.06], [0.425, 0.15], [0.405, 0.2], [0.37, 0.225], [0.25, 0.235], [0, 0.235]];
export function makePiece(side, style, master) {
  const set = (PIECE3[style] || PIECE3.stone)[side], g = new THREE.Group();
  const mat = set.kind === 'stone' ? B.material('stone', { color: set.c, color2: set.c2, seed: 5 + side, roughness: 0.52, envIntensity: 1.3 })
    : set.kind === 'ivory' ? B.material('ivory', { color: set.c, color2: set.c2, seed: 8, roughness: 0.4 })
      : B.material('clay', { color: set.c, color2: set.c2, seed: 6 + side, roughness: 0.62 });
  const ink = B.material(set.ink, set.ink === 'brass' ? { color: '#e9c987', color2: '#f7e2a8' } : { color: '#4a2a16', color2: '#6a3a1c' });
  const stone = (r, y) => {
    const s = r;
    const prof = PUCK.map(([a, b]) => [a * s, b]);
    const m = B.piece(prof, mat, 36); m.position.y = y; g.add(m);
    // engraved ring + lozenge on the face
    const ring = new THREE.Mesh(B.lathe([[0.3 * s, 0], [0.3 * s, 0.012], [0.335 * s, 0.012], [0.335 * s, 0]], 40), ink); ring.position.y = y + 0.232; g.add(ring);
    return y + 0.235;
  };
  let top;
  if (!master) top = stone(1, 0); else { stone(1, 0); top = stone(0.84, 0.235); }
  const dr = master ? 0.17 : 0.1;
  const d = new THREE.Mesh(B.inlay(diamond(dr, 1.2), 0.016, { bevel: 0.004 }), ink); d.position.y = top - 0.002; g.add(d);
  if (master) { const d2 = new THREE.Mesh(B.inlay(ringShape(diamond(0.24, 1.2), diamond(0.2, 1.2)), 0.014, { bevel: 0.003 }), ink); d2.position.y = top - 0.002; g.add(d2); }
  g.userData.height = top;
  return g;
}

// ---------------------------------------------------------------- environment
function rugCanvas(S = 1024) {
  const c = cv(S), x = c.getContext('2d'), r = lcg(77);
  x.fillStyle = '#3a1410'; x.fillRect(0, 0, S, S);
  const band = (inset, w, col) => { x.strokeStyle = col; x.lineWidth = w; x.strokeRect(inset, inset, S - 2 * inset, S - 2 * inset); };
  const tri = (inset, col, size, n) => {
    x.fillStyle = col;
    for (let k = 0; k < n; k++) {
      const t = inset + (k + 0.5) * ((S - 2 * inset) / n);
      x.beginPath(); x.moveTo(t - size, inset); x.lineTo(t + size, inset); x.lineTo(t, inset + size * 1.6); x.fill();
      x.beginPath(); x.moveTo(t - size, S - inset); x.lineTo(t + size, S - inset); x.lineTo(t, S - inset - size * 1.6); x.fill();
      x.beginPath(); x.moveTo(inset, t - size); x.lineTo(inset, t + size); x.lineTo(inset + size * 1.6, t); x.fill();
      x.beginPath(); x.moveTo(S - inset, t - size); x.lineTo(S - inset, t + size); x.lineTo(S - inset - size * 1.6, t); x.fill();
    }
  };
  band(14, 28, '#141f3a'); band(40, 8, '#9a7434'); tri(52, '#a08a5c', 22, 16); band(100, 10, '#9a7434'); band(118, 36, '#5a2016');
  // field: a lattice of small diamonds
  x.fillStyle = '#22100c'; x.fillRect(160, 160, S - 320, S - 320);
  const cols = ['#6a3220', '#7a5c2c', '#8a7a58', '#26364f'];
  const n = 15, pitch = (S - 320) / n;
  for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) {
    const cx = 160 + (i + 0.5) * pitch, cy = 160 + (j + 0.5) * pitch, rr = pitch * 0.34;
    x.fillStyle = cols[(i + j * 2) % 4]; x.beginPath(); x.moveTo(cx, cy - rr * 1.2); x.lineTo(cx + rr, cy); x.lineTo(cx, cy + rr * 1.2); x.lineTo(cx - rr, cy); x.fill();
    x.fillStyle = '#22100c'; x.beginPath(); x.arc(cx, cy, rr * 0.28, 0, 6.3); x.fill();
  }
  // woven fibre noise
  for (let k = 0; k < 26000; k++) { x.fillStyle = r() < 0.5 ? 'rgba(255,230,190,0.05)' : 'rgba(0,0,0,0.1)'; x.fillRect(r() * S, r() * S, 1 + r() * 3, 1); }
  for (let k = 0; k < 120; k++) { x.fillStyle = 'rgba(0,0,0,0.04)'; x.fillRect(0, k * (S / 120), S, 1); }
  return c;
}
function glowCanvas(rgb, size = 128, a = 1) {
  const c = cv(size), x = c.getContext('2d'), g = x.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  g.addColorStop(0, `rgba(${rgb},${a})`); g.addColorStop(0.35, `rgba(${rgb},${a * 0.4})`); g.addColorStop(1, `rgba(${rgb},0)`);
  x.fillStyle = g; x.fillRect(0, 0, size, size); return c;
}
export const glowTexture = (rgb, a) => tex(glowCanvas(rgb, 128, a));

export function makeLantern() {
  const g = new THREE.Group();
  const brass = B.material('brass', { color: '#b88a30', color2: '#f0cf7a', seed: 9 });
  const body = B.piece([[0, 0], [0.26, 0], [0.3, 0.04], [0.3, 0.1], [0.2, 0.14], [0.2, 0.18], [0, 0.18]], brass, 20); g.add(body);
  const glass = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.17, 0.62, 20, 1, true), new THREE.MeshBasicMaterial({ color: '#ffb257', transparent: true, opacity: 0.9, side: THREE.DoubleSide, fog: false }));
  glass.position.y = 0.5; g.add(glass);
  const core = new THREE.Mesh(new THREE.SphereGeometry(0.12, 16, 12), new THREE.MeshBasicMaterial({ color: '#fff0c4', fog: false })); core.position.y = 0.5; g.add(core);
  for (let k = 0; k < 4; k++) { const p = B.piece([[0, 0], [0.02, 0], [0.02, 0.66], [0, 0.66]], brass, 6); const a = k * Math.PI / 2 + Math.PI / 4; p.position.set(Math.cos(a) * 0.19, 0.18, Math.sin(a) * 0.19); g.add(p); }
  const roof = B.piece([[0, 0], [0.3, 0], [0.31, 0.03], [0.14, 0.14], [0.05, 0.2], [0.07, 0.26], [0, 0.3]], brass, 20); roof.position.y = 0.84; g.add(roof);
  const ring = new THREE.Mesh(new THREE.TorusGeometry(0.07, 0.015, 8, 16), brass); ring.position.y = 1.2; g.add(ring);
  const halo = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTexture('255,170,70', 1), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false }));
  halo.position.y = 0.55; halo.scale.set(2.8, 2.8, 1); halo.material.depthTest = false; halo.renderOrder = 4; g.add(halo);
  g.userData.halo = halo; g.userData.glass = glass; g.userData.core = core;
  return g;
}

export function buildEnvironment() {
  const g = new THREE.Group();
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(120, 120), B.material('cloth', { color: '#1a100b', color2: '#2a1a12', repeat: [40, 40], size: 256, roughness: 1 }));
  floor.rotation.x = -Math.PI / 2; floor.position.y = -0.04; floor.receiveShadow = true; g.add(floor);
  const rugMat = new THREE.MeshStandardMaterial({ map: tex(rugCanvas(1024)), color: '#a89886', roughness: 1 });
  const rug = new THREE.Mesh(new THREE.PlaneGeometry(13, 13), rugMat); rug.rotation.x = -Math.PI / 2; rug.position.y = -0.015; rug.receiveShadow = true; g.add(rug);
  // brass lanterns on the rug (they light the scene and show above the far edge of the board)
  const lanterns = [];
  for (const [x, z, s, ph] of [[-6.0, -4.1, 1.15, 0], [6.1, -4.7, 1.3, 2.1], [-4.6, 0.6, 0.85, 4.2]]) {
    const l = makeLantern(); l.position.set(x, 0, z); l.scale.setScalar(s); g.add(l);
    const pl = new THREE.PointLight(0xffa24a, 7.5, 12, 1.6); pl.position.set(x, 0.7 * s + 0.2, z); g.add(pl);
    lanterns.push({ l, pl, base: 7.5, ph, s });
  }
  // a brass tray with two tea glasses and a bowl of dates, set low beside the board
  const tray = B.piece([[0, 0], [0.9, 0], [0.95, 0.04], [0.95, 0.08], [0.9, 0.06], [0, 0.04]], B.material('brass', { color: '#b88a30', color2: '#e9c470' }), 40);
  tray.position.set(4.0, 0, 2.8); tray.scale.set(1.2, 1, 0.9); g.add(tray);
  for (const [dx, dz] of [[-0.35, -0.1], [0.3, 0.05]]) {
    const gl = new THREE.Mesh(B.lathe([[0.0, 0], [0.13, 0], [0.16, 0.3], [0.17, 0.32], [0.15, 0.31], [0.12, 0.02], [0, 0.02]], 20), B.material('glass', { color: '#ffd9a0' }));
    gl.position.set(4.0 + dx, 0.06, 2.8 + dz); g.add(gl);
  }
  const bowl = B.piece([[0, 0], [0.24, 0], [0.4, 0.2], [0.43, 0.24], [0.4, 0.24], [0.22, 0.04], [0, 0.04]], B.material('clay', { color: '#9c5a34', color2: '#c78856' }), 28); bowl.position.set(-4.0, 0, 3.0); g.add(bowl);
  const dateM = B.material('darkWood', { color: '#3d1f10', color2: '#5a2d16' });
  for (let k = 0; k < 9; k++) { const d = new THREE.Mesh(new THREE.SphereGeometry(0.1, 10, 8), dateM); d.scale.set(1, 0.8, 1.35); const a = k * 2.4; d.position.set(-4.0 + Math.cos(a) * 0.14 * (k % 3 + 0.4), 0.2 + (k % 3) * 0.06, 3.0 + Math.sin(a) * 0.14 * (k % 3 + 0.4)); d.rotation.y = a; g.add(d); }
  // embers / dust motes drifting up through the lamplight
  const N = 70, pos = new Float32Array(N * 3), seeds = [];
  const r = lcg(5);
  for (let i = 0; i < N; i++) { seeds.push({ x: (r() - 0.5) * 12, z: (r() - 0.5) * 10 - 1, y: r() * 4, s: 0.15 + r() * 0.3, ph: r() * 6 }); }
  const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  const pts = new THREE.Points(geo, new THREE.PointsMaterial({ map: glowTexture('255,200,120', 1), color: 0xffd9a0, size: 0.16, transparent: true, opacity: 0.8, depthWrite: false, blending: THREE.AdditiveBlending, sizeAttenuation: true, fog: false }));
  pts.frustumCulled = false; g.add(pts);
  const update = (t, calm) => {
    for (const L of lanterns) {
      const f = calm ? 1 : 0.88 + 0.12 * Math.sin(t * 7.3 + L.ph) * Math.sin(t * 3.1 + L.ph * 2) + 0.05 * Math.sin(t * 13 + L.ph);
      L.pl.intensity = L.base * f; L.l.userData.halo.material.opacity = 0.55 + 0.35 * f; L.l.userData.core.scale.setScalar(0.9 + 0.2 * f);
    }
    const a = geo.attributes.position;
    for (let i = 0; i < N; i++) { const s = seeds[i], y = (s.y + (calm ? 0 : t * s.s)) % 4; a.setXYZ(i, s.x + Math.sin(t * 0.3 + s.ph) * 0.4, 0.2 + y, s.z + Math.cos(t * 0.25 + s.ph) * 0.3); }
    a.needsUpdate = true;
  };
  return { group: g, update, lanterns };
}
