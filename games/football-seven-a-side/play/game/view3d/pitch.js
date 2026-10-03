// The scene around the match, built from two meshes only (two draw calls):
//   1. the ground: pitch + surround in ONE canvas texture (mowing stripes and every line are painted into it)
//   2. the scenery: goals with nets, ad boards, stands with a crowd, floodlight masts and a sky backdrop, all merged into one mesh that shares one
//      texture atlas (vertex colours add shading). Nothing here moves: the camera is fixed and so is everything it looks at.
import { HL, HW, GOAL_HW, GOAL_H, GOAL_D, POST_R, BOX_HW, BOX_D, SPOT, CIRCLE_R } from '../src/consts.js';

const TAU = Math.PI * 2;
// deterministic noise (no Math.random: the picture is reproducible)
const rng = (seed) => { let s = seed >>> 0; return () => ((s = (Math.imul(s, 1664525) + 1013904223) >>> 0) / 4294967296); };

// ---- ground texture ----------------------------------------------------------------------------------------------------------------------
export const GROUND = { x0: -HW - 7, x1: HW + 7, z0: -HL - 8, z1: HL + 8 };   // metres covered by the detailed texture
export function paintGround(doc, ppm = 40) {
  const W = Math.round((GROUND.x1 - GROUND.x0) * ppm), H = Math.round((GROUND.z1 - GROUND.z0) * ppm);
  const c = doc.createElement('canvas'); c.width = W; c.height = H;
  const g = c.getContext('2d');
  // texture u runs with -x (the plane is mapped so that world +z is up the screen): X(x) = (x1 - x) * ppm, Z(z) = (z - z0) * ppm in image rows from the top = far
  const X = (x) => (GROUND.x1 - x) * ppm, Z = (z) => (GROUND.z1 - z) * ppm;
  g.fillStyle = '#2f7d3c'; g.fillRect(0, 0, W, H);
  // surround: slightly darker, mowed across
  for (let i = 0; i < 40; i++) { g.fillStyle = i % 2 ? 'rgba(0,0,0,0.045)' : 'rgba(255,255,255,0.025)'; g.fillRect(0, i * H / 40, W, H / 40 + 1); }
  // pitch stripes across the length (8 bands)
  const bands = 8, bh = (2 * HL) * ppm / bands;
  for (let i = 0; i < bands; i++) { g.fillStyle = i % 2 ? '#3d9a4a' : '#47a853'; g.fillRect(X(HW), Z(HL) + i * bh, 2 * HW * ppm, bh + 1); }
  // grass grain: fine deterministic noise
  const r = rng(77);
  for (let i = 0; i < 26000; i++) { const x = r() * W, y = r() * H; g.fillStyle = r() < 0.5 ? 'rgba(255,255,255,0.05)' : 'rgba(0,30,0,0.06)'; g.fillRect(x, y, 2 + r() * 3, 1); }
  // a soft darker rim around the pitch where players do not run
  const grd = g.createLinearGradient(0, 0, 0, H); void grd;
  // lines
  g.strokeStyle = 'rgba(250,252,250,0.96)'; g.fillStyle = 'rgba(250,252,250,0.96)'; g.lineWidth = 0.1 * ppm; g.lineJoin = 'miter';
  g.strokeRect(X(HW), Z(HL), 2 * HW * ppm, 2 * HL * ppm);
  g.beginPath(); g.moveTo(X(HW), Z(0)); g.lineTo(X(-HW), Z(0)); g.stroke();
  g.beginPath(); g.arc(X(0), Z(0), CIRCLE_R * ppm, 0, TAU); g.stroke();
  g.beginPath(); g.arc(X(0), Z(0), 0.16 * ppm, 0, TAU); g.fill();
  for (const sg of [-1, 1]) {
    g.strokeRect(X(BOX_HW), sg > 0 ? Z(HL) : Z(-HL + BOX_D), 2 * BOX_HW * ppm, BOX_D * ppm);
    g.beginPath(); g.arc(X(0), Z(sg * (HL - SPOT)), 0.16 * ppm, 0, TAU); g.fill();
    // goal mouth marks and the net's footprint are drawn by the scenery mesh
    // corner arcs
    for (const sx of [-1, 1]) { g.beginPath(); g.arc(X(sx * HW), Z(sg * HL), 0.6 * ppm, 0, TAU); g.stroke(); }
  }
  // the penalty arc (3 m radius from the spot, outside the box)
  for (const sg of [-1, 1]) {
    g.save(); g.beginPath(); g.rect(X(HW), sg > 0 ? Z(HL - BOX_D) - 4 * ppm : Z(-HL + BOX_D), 2 * HW * ppm, 4 * ppm); g.clip();
    g.beginPath(); g.arc(X(0), Z(sg * (HL - SPOT)), CIRCLE_R * ppm * 0.85, 0, TAU); g.stroke(); g.restore();
  }
  return c;
}

// ---- scenery atlas ---------------------------------------------------------------------------------------------------------------------------
export const ATLAS = { W: 2048, H: 1024 };
// regions in pixels (x0, y0, x1, y1), top-left origin
export const REG = {
  crowdRear: [0, 0, 1024, 320], crowdSide: [1024, 0, 2048, 320], sky: [0, 330, 400, 730], net: [410, 330, 922, 586], solid: [930, 330, 960, 360], steel: [960, 330, 990, 360],
  boards: [1000, 600, 2040, 760], concrete: [1000, 380, 1030, 410], roofTop: [1040, 380, 1070, 410], dark: [1080, 380, 1110, 410], light: [1120, 380, 1150, 410],
};
export function paintAtlas(doc) {
  const c = doc.createElement('canvas'); c.width = ATLAS.W; c.height = ATLAS.H;
  const g = c.getContext('2d');
  g.fillStyle = '#000'; g.fillRect(0, 0, c.width, c.height);
  const fillR = (r, col) => { g.fillStyle = col; g.fillRect(r[0], r[1], r[2] - r[0], r[3] - r[1]); };
  // crowds: rows of seated people (dots) on dark seating, brighter near the top rows
  const crowd = (r, seed, cols) => {
    const w = r[2] - r[0], h = r[3] - r[1], rn = rng(seed);
    g.fillStyle = '#26303d'; g.fillRect(r[0], r[1], w, h);
    const rows = 22;
    for (let row = 0; row < rows; row++) {
      const y = r[1] + (row + 0.5) * h / rows;
      g.fillStyle = row % 2 ? 'rgba(0,0,0,0.18)' : 'rgba(255,255,255,0.05)'; g.fillRect(r[0], y - h / rows / 2, w, h / rows);
      const n = 70;
      for (let i = 0; i < n; i++) {
        const x = r[0] + (i + 0.5 + (rn() - 0.5) * 0.5) * w / n, rad = (h / rows) * (0.34 + rn() * 0.1);
        const col = cols[Math.floor(rn() * cols.length)];
        g.fillStyle = col; g.beginPath(); g.arc(x, y + 2, rad, 0, TAU); g.fill();
        g.fillStyle = '#d9b79b'; g.beginPath(); g.arc(x, y - rad * 0.9, rad * 0.55, 0, TAU); g.fill();
      }
    }
  };
  crowd(REG.crowdRear, 5, ['#d9534a', '#e8c84a', '#3d7fc4', '#e6e6ea', '#4fa37a', '#8a5fc2', '#e08a3a', '#2d3b57']);
  crowd(REG.crowdSide, 9, ['#e8c84a', '#d9534a', '#e6e6ea', '#3d7fc4', '#2d3b57', '#4fa37a', '#e08a3a', '#8a5fc2']);
  // sky: blue to pale horizon, a few soft clouds
  { const r = REG.sky, gr = g.createLinearGradient(0, r[1], 0, r[3]); gr.addColorStop(0, '#5c9bd6'); gr.addColorStop(0.7, '#a9cdee'); gr.addColorStop(1, '#d8e8f4'); g.fillStyle = gr; g.fillRect(r[0], r[1], r[2] - r[0], r[3] - r[1]);
    const rn = rng(3); for (let i = 0; i < 9; i++) { const cx = r[0] + 30 + rn() * 340, cy = r[1] + 40 + rn() * 190; for (let k = 0; k < 6; k++) { g.fillStyle = 'rgba(255,255,255,0.20)'; g.beginPath(); g.ellipse(cx + k * 18 - 40, cy + (k % 2) * 6, 30 + rn() * 20, 10 + rn() * 6, 0, 0, TAU); g.fill(); } } }
  // nets: a white mesh on a transparent background (alpha-tested)
  { const r = REG.net; g.clearRect(r[0], r[1], r[2] - r[0], r[3] - r[1]); g.strokeStyle = 'rgba(255,255,255,1)'; g.lineWidth = 3.2;
    const w = r[2] - r[0], h = r[3] - r[1], nx = 40, ny = 20;
    for (let i = 0; i <= nx; i++) { const x = r[0] + 2 + i * (w - 4) / nx; g.beginPath(); g.moveTo(x, r[1] + 2); g.lineTo(x, r[3] - 2); g.stroke(); }
    for (let j = 0; j <= ny; j++) { const y = r[1] + 2 + j * (h - 4) / ny; g.beginPath(); g.moveTo(r[0] + 2, y); g.lineTo(r[2] - 2, y); g.stroke(); } }
  fillR(REG.solid, '#f6f7f4'); fillR(REG.steel, '#8d98a4'); fillR(REG.concrete, '#9aa0a8'); fillR(REG.roofTop, '#c9ced4'); fillR(REG.dark, '#2a313b'); fillR(REG.light, '#fffbe8');
  // ad boards: plain colour panels with simple geometric marks (no text, no logos)
  { const r = REG.boards, cols = ['#1f9d8f', '#f2f2f2', '#e2503c', '#1c3c58', '#e8c84a', '#8a5fc2', '#2b6fd6', '#f2f2f2'], w = r[2] - r[0], h = r[3] - r[1];
    cols.forEach((col, i) => { const x = r[0] + i * w / cols.length; g.fillStyle = col; g.fillRect(x, r[1], w / cols.length, h); g.fillStyle = 'rgba(255,255,255,0.35)'; g.beginPath(); g.moveTo(x + 20, r[1] + h - 20); g.lineTo(x + w / cols.length / 2, r[1] + 22); g.lineTo(x + w / cols.length - 20, r[1] + h - 20); g.closePath(); g.fill(); }); }
  return c;
}

// ---- geometry builder -------------------------------------------------------------------------------------------------------------------------
function builder() {
  const P = [], U = [], C = [], I = [];
  const B = {
    // a quad given four corners in order (p0 p1 p2 p3), a UV rect (pixels, top-left origin) and a shade
    quad(p0, p1, p2, p3, reg, shade = 1, uv = null) {
      const n = P.length / 3;
      for (const p of [p0, p1, p2, p3]) P.push(p[0], p[1], p[2]);
      const [x0, y0, x1, y1] = reg;
      const u0 = (x0 + 1) / ATLAS.W, u1 = (x1 - 1) / ATLAS.W, v0 = 1 - (y1 - 1) / ATLAS.H, v1 = 1 - (y0 + 1) / ATLAS.H;
      const uu = uv || [[0, 0], [1, 0], [1, 1], [0, 1]];
      for (const q of uu) U.push(u0 + (u1 - u0) * q[0], v0 + (v1 - v0) * q[1]);
      const s = Array.isArray(shade) ? shade : [shade, shade, shade, shade];
      for (let i = 0; i < 4; i++) C.push(s[i], s[i], s[i]);
      I.push(n, n + 1, n + 2, n, n + 2, n + 3);
    },
    // axis-aligned box (6 quads) with one region
    box(x0, y0, z0, x1, y1, z1, reg, shade = 1) {
      const q = (a, b, c, d, s) => B.quad(a, b, c, d, reg, shade * s);
      q([x0, y0, z1], [x1, y0, z1], [x1, y1, z1], [x0, y1, z1], 0.95); q([x1, y0, z0], [x0, y0, z0], [x0, y1, z0], [x1, y1, z0], 0.8);
      q([x0, y0, z0], [x0, y0, z1], [x0, y1, z1], [x0, y1, z0], 0.85); q([x1, y0, z1], [x1, y0, z0], [x1, y1, z0], [x1, y1, z1], 0.9);
      q([x0, y1, z1], [x1, y1, z1], [x1, y1, z0], [x0, y1, z0], 1.0);
    },
    arrays: () => ({ P, U, C, I }),
  };
  return B;
}

export function buildScenery(THREE) {
  const B = builder();
  const R = REG;
  // ---- goals: posts, crossbar, nets (both ends) --------------------------------------------------------------------------------------------
  for (const s of [-1, 1]) {
    const gz = s * HL, r = POST_R, d = GOAL_D, bz = gz + s * d;
    // frame
    B.box(-GOAL_HW - r, 0, gz - r, -GOAL_HW + r, GOAL_H + r, gz + r, R.solid);
    B.box(GOAL_HW - r, 0, gz - r, GOAL_HW + r, GOAL_H + r, gz + r, R.solid);
    B.box(-GOAL_HW - r, GOAL_H - r, gz - r, GOAL_HW + r, GOAL_H + r, gz + r, R.solid);
    // net: back, top, sides (a box that follows the sim's net volume), with uv tiling over one mesh texture
    const nr = R.net;
    B.quad([GOAL_HW, 0, bz], [-GOAL_HW, 0, bz], [-GOAL_HW, GOAL_H, bz], [GOAL_HW, GOAL_H, bz], nr, 0.92);
    B.quad([GOAL_HW, GOAL_H, gz], [-GOAL_HW, GOAL_H, gz], [-GOAL_HW, GOAL_H, bz], [GOAL_HW, GOAL_H, bz], nr, 1.0, [[0, 0], [1, 0], [1, 0.6], [0, 0.6]]);
    B.quad([GOAL_HW, 0, gz], [GOAL_HW, 0, bz], [GOAL_HW, GOAL_H, bz], [GOAL_HW, GOAL_H, gz], nr, 0.88, [[0, 0], [0.5, 0], [0.5, 1], [0, 1]]);
    B.quad([-GOAL_HW, 0, bz], [-GOAL_HW, 0, gz], [-GOAL_HW, GOAL_H, gz], [-GOAL_HW, GOAL_H, bz], nr, 0.88, [[0, 0], [0.5, 0], [0.5, 1], [0, 1]]);
    // rear support bars
    B.box(-GOAL_HW - 0.04, 0, bz - 0.04, -GOAL_HW + 0.04, GOAL_H, bz + 0.04, R.steel, 0.9);
    B.box(GOAL_HW - 0.04, 0, bz - 0.04, GOAL_HW + 0.04, GOAL_H, bz + 0.04, R.steel, 0.9);
  }
  // ---- ad boards: low panels around the far half (the near side is left open so the HUD end stays clean) -----------------------------------
  const bh = 0.8, gap = 1.6;
  const bx = HW + gap, bzF = HL + gap;
  // far end
  const bu = (i, n) => [[i / n, 0], [(i + 1) / n, 0], [(i + 1) / n, 1], [i / n, 1]];
  const nF = 8;
  for (let i = 0; i < nF; i++) { const x0 = bx - (2 * bx) * i / nF, x1 = bx - (2 * bx) * (i + 1) / nF; B.quad([x0, 0, bzF], [x1, 0, bzF], [x1, bh, bzF], [x0, bh, bzF], R.boards, 0.98, bu(i, nF)); }
  // sides
  const zl = -HL - gap, nS = 14;
  for (let i = 0; i < nS; i++) { const z0 = zl + (bzF - zl) * i / nS, z1 = zl + (bzF - zl) * (i + 1) / nS; B.quad([bx, 0, z1], [bx, 0, z0], [bx, bh, z0], [bx, bh, z1], R.boards, 0.98, bu(i % 8, 8)); B.quad([-bx, 0, z0], [-bx, 0, z1], [-bx, bh, z1], [-bx, bh, z0], R.boards, 0.98, bu((i + 3) % 8, 8)); }
  // ---- stands ----------------------------------------------------------------------------------------------------------------------------------------
  // rear stand: a raked crowd face, a concrete base, side walls, roof
  { const z0 = HL + 4.2, z1 = HL + 17, y0 = 0.6, y1 = 11.5, xw = 27;
    B.quad([xw, y0, z0], [-xw, y0, z0], [-xw, y1, z1], [xw, y1, z1], R.crowdRear, [0.85, 0.85, 0.34, 0.34], [[0, 0], [1, 0], [1, 1], [0, 1]]);
    B.quad([xw, 0, z0], [-xw, 0, z0], [-xw, y0, z0], [xw, y0, z0], R.concrete, 0.8);
    B.quad([xw, y1, z1], [-xw, y1, z1], [-xw, y1 + 2.2, z1], [xw, y1 + 2.2, z1], R.dark, 0.75);           // rear wall
    // a slim canopy lip along the top edge
    B.quad([xw, y1 + 2.2, z1 - 2.2], [-xw, y1 + 2.2, z1 - 2.2], [-xw, y1 + 2.2, z1 + 0.4], [xw, y1 + 2.2, z1 + 0.4], R.roofTop, 0.95);
    B.quad([-xw, y1 + 2.0, z1 - 2.2], [xw, y1 + 2.0, z1 - 2.2], [xw, y1 + 2.0, z1 + 0.4], [-xw, y1 + 2.0, z1 + 0.4], R.dark, 0.6);
    // side walls of the stand
    B.quad([xw, y0, z0], [xw, y1, z1], [xw, y1 + 2.2, z1], [xw, y0, z1], R.dark, 0.7); B.quad([-xw, y0, z1], [-xw, y1 + 2.2, z1], [-xw, y1, z1], [-xw, y0, z0], R.dark, 0.7);
  }
  // side stands along the touchlines (both sides), from behind the near goal to the rear stand
  for (const s of [-1, 1]) {
    const x0 = s * (HW + 3.4), x1 = s * (HW + 15), z0 = -HL - 10, z1 = HL + 4.2, y0 = 0.6, y1 = 10;
    if (s > 0) B.quad([x0, y0, z1], [x0, y0, z0], [x1, y1, z0], [x1, y1, z1], R.crowdSide, [0.8, 0.8, 0.4, 0.4], [[0, 0], [1, 0], [1, 1], [0, 1]]);
    else B.quad([x0, y0, z0], [x0, y0, z1], [x1, y1, z1], [x1, y1, z0], R.crowdSide, [0.8, 0.8, 0.4, 0.4], [[0, 0], [1, 0], [1, 1], [0, 1]]);
    // concrete base wall and a back wall
    if (s > 0) { B.quad([x0, 0, z1], [x0, 0, z0], [x0, y0, z0], [x0, y0, z1], R.concrete, 0.8); B.quad([x1, y1, z1], [x1, y1, z0], [x1, y1 + 4, z0], [x1, y1 + 4, z1], R.dark, 0.8); }
    else { B.quad([x0, 0, z0], [x0, 0, z1], [x0, y0, z1], [x0, y0, z0], R.concrete, 0.8); B.quad([x1, y1, z0], [x1, y1, z1], [x1, y1 + 4, z1], [x1, y1 + 4, z0], R.dark, 0.8); }
  }
  // ---- floodlight masts at the four corners -------------------------------------------------------------------------------------------------------
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
    const x = sx * (HW + 5.5), z = sz * (HL + 6), h = 24;
    B.box(x - 0.18, 0, z - 0.18, x + 0.18, h, z + 0.18, R.steel, 0.9);
    // lamp panel facing the pitch centre
    B.box(x - 1.6, h, z - 0.25, x + 1.6, h + 2.2, z + 0.25, R.light, 1.0);
    B.box(x - 1.7, h - 0.2, z - 0.35, x + 1.7, h, z + 0.35, R.dark, 0.9);
  }
  // ---- the sky: a big backdrop beyond the stand, and a horizon haze strip ------------------------------------------------------------------------------
  B.quad([260, -5, HL + 45], [-260, -5, HL + 45], [-260, 160, HL + 45], [260, 160, HL + 45], R.sky, 1.0, [[0, 0], [1, 0], [1, 1], [0, 1]]);
  const { P, U, C, I } = B.arrays();
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(P, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(U, 2));
  geo.setAttribute('color', new THREE.Float32BufferAttribute(C, 3));
  geo.setIndex(I);
  return geo;
}

// the ground mesh: the textured inner rectangle plus a large outer rectangle sampling one flat texel of the same texture
export function buildGround(THREE, tex) {
  const P = [], U = [], I = [];
  const add = (x0, x1, z0, z1, uvf) => {
    const n = P.length / 3;
    P.push(x0, 0, z0, x1, 0, z0, x1, 0, z1, x0, 0, z1);
    for (const [x, z] of [[x0, z0], [x1, z0], [x1, z1], [x0, z1]]) U.push(...uvf(x, z));
    I.push(n, n + 2, n + 1, n, n + 3, n + 2);
  };
  const g = GROUND, w = g.x1 - g.x0, h = g.z1 - g.z0;
  add(g.x0, g.x1, g.z0, g.z1, (x, z) => [(g.x1 - x) / w, 1 - (g.z1 - z) / h]);
  // the outer ring samples a flat patch: bottom-left texel region is plain surround
  const flat = [0.012, 0.012];
  const O = 160;
  add(-O, O, -O, g.z0, () => flat); add(-O, O, g.z1, HL + 45, () => flat); add(-O, g.x0, g.z0, g.z1, () => flat); add(g.x1, O, g.z0, g.z1, () => flat);
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(P, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(U, 2));
  geo.setIndex(I);
  geo.computeVertexNormals();
  return geo;
}
