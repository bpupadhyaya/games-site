// The painted wall panel: a lime-washed mud-plaster panel (albedo + bump + roughness canvases, one cell grid), a raised plaster frame with a
// painted triangle band, pigment cells that sit proud of the plaster (matte lime-white, charcoal, red ochre) with a wet-to-dry shift, the
// mirror axis carved as a shallow groove, glowing inlays for hints / verdict / rain rings, and rain-wash streaks that run down the plaster.
// Metres; the panel is centred on the origin, x right, y up, z toward the camera. Reads state only (see presenter.js).
import { THREE } from '../vendor3d/index.js';

export const CELL = 0.2;
const TAU = Math.PI * 2;
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
export const hash = (a, b = 0, c = 0) => { let h = (a | 0) ^ Math.imul((b | 0) + 0x632be5ab, 0x9e3779b1) ^ Math.imul((c | 0) + 0x1b873593, 0x85ebca77); h ^= h >>> 16; h = Math.imul(h, 0x7feb352d); h ^= h >>> 15; h = Math.imul(h, 0x846ca68b); h ^= h >>> 16; return (h >>> 0) / 4294967296; };
const cv = (w, h = w) => { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; };

// pigment looks: dry (chalky) and wet (just applied, darker and saturated)
const PIG = {
  1: { dry: [243, 236, 216], wet: [201, 192, 168], rough: 0.95, bump: 236, rim: 'rgba(120,100,70,0.35)' },     // lime
  2: { dry: [46, 38, 33], wet: [20, 16, 14], rough: 0.8, bump: 206, rim: 'rgba(0,0,0,0.5)' },                  // charcoal / graphite
  3: { dry: [168, 66, 40], wet: [118, 36, 20], rough: 0.88, bump: 218, rim: 'rgba(60,10,2,0.45)' },            // red ochre
};
const rgb = (c, k = 1) => `rgb(${Math.round(c[0] * k)},${Math.round(c[1] * k)},${Math.round(c[2] * k)})`;
const mixC = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
export const PIG_HEX = { 1: '#f3ecd8', 2: '#2c2420', 3: '#b2452a' };

// painted triangle band used on the frame ridge and the title plaque
export function bandCanvas(w = 512, h = 96, seed = 1) {
  const c = cv(w, h), x = c.getContext('2d');
  x.fillStyle = '#d9b27c'; x.fillRect(0, 0, w, h);
  const n = 12, tw = w / n, th = h * 0.5;
  for (let k = 0; k < n; k++) {
    x.fillStyle = k % 3 === 0 ? rgb(PIG[3].dry) : k % 3 === 1 ? rgb(PIG[1].dry) : rgb(PIG[2].dry);
    x.beginPath(); x.moveTo(k * tw, h * 0.78); x.lineTo((k + 0.5) * tw, h * 0.2); x.lineTo((k + 1) * tw, h * 0.78); x.closePath(); x.fill();
  }
  x.fillStyle = rgb(PIG[2].dry); x.fillRect(0, h * 0.04, w, h * 0.08); x.fillRect(0, h * 0.86, w, h * 0.08);
  for (let i = 0; i < w * h / 14; i++) { x.fillStyle = hash(i, seed) < 0.5 ? 'rgba(255,240,210,0.12)' : 'rgba(60,30,10,0.14)'; x.fillRect(hash(i, 1) * w, hash(i, 2) * h, 1 + hash(i, 3) * 2, 1 + hash(i, 4) * 2); }
  return c;
}

export function createWall({ quality = 'high' } = {}) {
  const PXC = quality === 'low' ? 56 : quality === 'medium' ? 76 : 96;
  const group = new THREE.Group(); group.name = 'wall';
  const state = { wall: null, W: 0, H: 0 };
  let A, B, R, baseA, baseB, baseR, ca, cb, cr, texA, texB, texR;
  let shown = null, paintT = null, lastCol = null, stainLen = null, wetTimer = 0;

  // ------------------------------------------------------------ materials and fixed meshes
  const panelMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 1, metalness: 0, bumpScale: 2.4 });
  const panel = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), panelMat);
  panel.receiveShadow = true; panel.position.z = 0.002; group.add(panel);

  const lime = (() => {
    const c = cv(256), x = c.getContext('2d');
    x.fillStyle = '#e9d3ac'; x.fillRect(0, 0, 256, 256);
    for (let i = 0; i < 2600; i++) { const k = hash(i, 9); x.fillStyle = k < 0.5 ? 'rgba(255,248,226,0.16)' : 'rgba(120,80,40,0.14)'; x.fillRect(hash(i, 1) * 256, hash(i, 2) * 256, 1 + hash(i, 3) * 3, 1 + hash(i, 4) * 3); }
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = 4; return t;
  })();
  const ridgeMat = new THREE.MeshStandardMaterial({ map: lime, color: 0xffffff, roughness: 0.92, bumpMap: lime, bumpScale: 1.4 });
  const bandTex = new THREE.CanvasTexture(bandCanvas(1024, 192, 3)); bandTex.colorSpace = THREE.SRGBColorSpace; bandTex.wrapS = THREE.RepeatWrapping; bandTex.anisotropy = 4;
  const bandMat = new THREE.MeshStandardMaterial({ map: bandTex, roughness: 0.9, bumpMap: bandTex, bumpScale: 1.1 });
  let frame = null, bands = [];

  function buildFrame(W, H) {
    if (frame) { group.remove(frame); frame.geometry.dispose(); }
    for (const b of bands) { group.remove(b); b.geometry.dispose(); }
    bands = [];
    const pw = W * CELL, ph = H * CELL, bw = 0.2, r = 0.05;
    const rr = (s, w, h, rad, sign) => { const x0 = -w / 2, y0 = -h / 2; s.moveTo(x0 + rad, y0); s.lineTo(x0 + w - rad, y0); s.quadraticCurveTo(x0 + w, y0, x0 + w, y0 + rad); s.lineTo(x0 + w, y0 + h - rad); s.quadraticCurveTo(x0 + w, y0 + h, x0 + w - rad, y0 + h); s.lineTo(x0 + rad, y0 + h); s.quadraticCurveTo(x0, y0 + h, x0, y0 + h - rad); s.lineTo(x0, y0 + rad); s.quadraticCurveTo(x0, y0, x0 + rad, y0); };
    const shape = new THREE.Shape(); rr(shape, pw + bw * 2, ph + bw * 2, r + 0.05);
    const hole = new THREE.Path(); rr(hole, pw + 0.012, ph + 0.012, 0.012); shape.holes.push(hole);
    const geo = new THREE.ExtrudeGeometry(shape, { depth: 0.04, bevelEnabled: true, bevelThickness: 0.026, bevelSize: 0.024, bevelSegments: 4, curveSegments: 10 });
    // uv in metres so the lime texture tiles at a constant scale
    const uv = geo.attributes.uv, pos = geo.attributes.position;
    for (let i = 0; i < uv.count; i++) uv.setXY(i, pos.getX(i) * 1.3, pos.getY(i) * 1.3);
    frame = new THREE.Mesh(geo, ridgeMat); frame.castShadow = true; frame.receiveShadow = true; frame.position.z = 0.0; group.add(frame);
    // painted band on the ridge's flat top (four strips)
    const zTop = 0.04 + 0.026 + 0.003, bwid = 0.1, off = bw / 2 + pw / 2 + 0.0;
    const strip = (len, x, y, rot, rep) => {
      const g = new THREE.PlaneGeometry(len, bwid); const uvs = g.attributes.uv; for (let i = 0; i < uvs.count; i++) uvs.setX(i, uvs.getX(i) * rep);
      const m = new THREE.Mesh(g, bandMat); m.position.set(x, y, zTop); m.rotation.z = rot; m.receiveShadow = true; group.add(m); bands.push(m);
    };
    const span = bw * 0.5 + 0.0;
    strip(pw + bw * 2 - 0.08, 0, ph / 2 + bw / 2 + 0.0, 0, Math.round((pw + bw * 2) / 0.62));
    strip(pw + bw * 2 - 0.08, 0, -ph / 2 - bw / 2 - 0.0, 0, Math.round((pw + bw * 2) / 0.62));
    strip(ph - 0.0, pw / 2 + bw / 2, 0, Math.PI / 2, Math.round(ph / 0.62));
    strip(ph - 0.0, -pw / 2 - bw / 2, 0, Math.PI / 2, Math.round(ph / 0.62));
    void off; void span;
  }

  // ------------------------------------------------------------ plaster base (grain, trowel sweeps, cracks, handprints)
  function buildBase(wall) {
    const { W, H } = wall, w = W * PXC, h = H * PXC;
    baseA = cv(w, h); baseB = cv(w, h); baseR = cv(w, h);
    const a = baseA.getContext('2d'), b = baseB.getContext('2d'), r = baseR.getContext('2d');
    a.fillStyle = '#c99a68'; a.fillRect(0, 0, w, h); b.fillStyle = '#808080'; b.fillRect(0, 0, w, h); r.fillStyle = '#f2f2f2'; r.fillRect(0, 0, w, h);
    const seed = (wall.cfg.seed | 0) + 7;
    // broad tonal clouds
    for (let i = 0; i < 70; i++) {
      const x = hash(i, seed, 1) * w, y = hash(i, seed, 2) * h, rad = PXC * (0.5 + hash(i, seed, 3) * 1.8), light = hash(i, seed, 4) < 0.5;
      const g = a.createRadialGradient(x, y, 0, x, y, rad);
      g.addColorStop(0, light ? 'rgba(255,226,180,0.16)' : 'rgba(110,60,28,0.17)'); g.addColorStop(1, 'rgba(0,0,0,0)');
      a.fillStyle = g; a.fillRect(x - rad, y - rad, rad * 2, rad * 2);
      const gb = b.createRadialGradient(x, y, 0, x, y, rad); gb.addColorStop(0, light ? 'rgba(200,200,200,0.14)' : 'rgba(40,40,40,0.14)'); gb.addColorStop(1, 'rgba(0,0,0,0)');
      b.fillStyle = gb; b.fillRect(x - rad, y - rad, rad * 2, rad * 2);
    }
    // trowel sweeps (long soft arcs) and straw flecks
    for (let i = 0; i < W * H * 0.7; i++) {
      const x = hash(i, seed, 11) * w, y = hash(i, seed, 12) * h, len = PXC * (0.4 + hash(i, seed, 13) * 0.9), ang = (hash(i, seed, 14) - 0.5) * 0.7;
      b.strokeStyle = hash(i, seed, 15) < 0.5 ? 'rgba(210,210,210,0.06)' : 'rgba(40,40,40,0.06)'; b.lineWidth = 5 + hash(i, seed, 16) * 8;
      b.beginPath(); b.moveTo(x, y); b.quadraticCurveTo(x + len * 0.5, y + len * ang * 0.5 + 6, x + len, y + len * ang); b.stroke();
      a.strokeStyle = hash(i, seed, 17) < 0.5 ? 'rgba(255,230,190,0.07)' : 'rgba(90,50,22,0.07)'; a.lineWidth = 3 + hash(i, seed, 16) * 5;
      a.beginPath(); a.moveTo(x, y); a.quadraticCurveTo(x + len * 0.5, y + len * ang * 0.5 + 6, x + len, y + len * ang); a.stroke();
    }
    for (let i = 0; i < w * h / 7; i++) {
      const x = hash(i, seed, 21) * w, y = hash(i, seed, 22) * h, k = hash(i, seed, 23), s = 1 + hash(i, seed, 24) * 2.4;
      a.fillStyle = k < 0.45 ? `rgba(255,236,200,${0.05 + k * 0.16})` : k < 0.9 ? `rgba(80,40,16,${0.04 + (k - 0.45) * 0.2})` : 'rgba(150,110,60,0.3)';
      a.fillRect(x, y, s, s * (0.6 + hash(i, seed, 25)));
      b.fillStyle = k < 0.5 ? 'rgba(235,235,235,0.22)' : 'rgba(30,30,30,0.22)'; b.fillRect(x, y, s, s);
    }
    // the elder's cells sit on a slightly smoothed, lighter patch
    a.fillStyle = 'rgba(255,240,205,0.17)';
    for (let i = 0; i < wall.N; i++) if (wall.elder[i]) {
      const x = (i % W) * PXC, y = Math.floor(i / W) * PXC;
      a.fillRect(x + 1, y + 1, PXC - 2, PXC - 2);
    }
    // hairline cracks
    const ncr = 3 + Math.floor((W * H) / 14);
    for (let k = 0; k < ncr; k++) {
      let x = hash(k, seed, 31) * w, y = hash(k, seed, 32) * h, ang = hash(k, seed, 33) * TAU;
      a.strokeStyle = 'rgba(50,24,8,0.5)'; a.lineWidth = 1.4; b.strokeStyle = 'rgba(15,15,15,0.9)'; b.lineWidth = 2.2;
      a.beginPath(); b.beginPath(); a.moveTo(x, y); b.moveTo(x, y);
      const steps = 8 + Math.floor(hash(k, seed, 34) * 10);
      for (let s = 0; s < steps; s++) { ang += (hash(k, s, seed) - 0.5) * 1.1; x += Math.cos(ang) * PXC * 0.24; y += Math.sin(ang) * PXC * 0.24; a.lineTo(x, y); b.lineTo(x, y); }
      a.stroke(); b.stroke();
    }
    // the incised cell grid (hair-fine chisel lines)
    a.strokeStyle = 'rgba(86,44,18,0.5)'; a.lineWidth = Math.max(1.3, PXC * 0.022);
    b.strokeStyle = 'rgba(30,30,30,0.95)'; b.lineWidth = Math.max(2, PXC * 0.034);
    a.beginPath(); b.beginPath();
    for (let x = 1; x < W; x++) { a.moveTo(x * PXC, 3); a.lineTo(x * PXC, h - 3); b.moveTo(x * PXC, 3); b.lineTo(x * PXC, h - 3); }
    for (let y = 1; y < H; y++) { a.moveTo(3, y * PXC); a.lineTo(w - 3, y * PXC); b.moveTo(3, y * PXC); b.lineTo(w - 3, y * PXC); }
    a.stroke(); b.stroke();
    // little chisel nicks at the grid crossings so the cells read as squares at a glance
    a.fillStyle = 'rgba(70,34,12,0.55)'; b.fillStyle = 'rgba(20,20,20,0.95)';
    for (let y = 1; y < H; y++) for (let x = 1; x < W; x++) { a.beginPath(); a.arc(x * PXC, y * PXC, PXC * 0.045, 0, TAU); a.fill(); b.beginPath(); b.arc(x * PXC, y * PXC, PXC * 0.05, 0, TAU); b.fill(); }
    marks(wall, a, b);
  }

  // the wall's symmetry carved as a shallow groove (dashed centre lines, a turn medallion, band joints, the diagonal)
  function marks(wall, a, b) {
    const { W, H, kind, p } = wall, w = W * PXC, h = H * PXC;
    const groove = (x1, y1, x2, y2) => {
      for (const [ctx, col, lw] of [[b, 'rgba(10,10,10,1)', PXC * 0.085], [a, 'rgba(70,28,10,0.9)', PXC * 0.06]]) {
        ctx.save(); ctx.strokeStyle = col; ctx.lineWidth = lw; ctx.lineCap = 'round'; ctx.setLineDash([PXC * 0.26, PXC * 0.14]);
        ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke(); ctx.restore();
      }
      // a lit lip on one side of the groove
      b.save(); b.strokeStyle = 'rgba(235,235,235,0.7)'; b.lineWidth = PXC * 0.03; b.setLineDash([PXC * 0.26, PXC * 0.14]); b.lineCap = 'round';
      b.beginPath(); b.moveTo(x1 + PXC * 0.05, y1 + PXC * 0.05); b.lineTo(x2 + PXC * 0.05, y2 + PXC * 0.05); b.stroke(); b.restore();
    };
    if (kind === 'mirrorV' || kind === 'quad') groove(w / 2, 4, w / 2, h - 4);
    if (kind === 'mirrorH' || kind === 'quad') groove(4, h / 2, w - 4, h / 2);
    if (kind === 'diag') groove(4, 4, w - 4, h - 4);
    if (kind === 'repeat' || kind === 'glide') for (let x = p; x < W; x += p) groove(x * PXC, 4, x * PXC, h - 4);
    if (kind === 'rot2' || kind === 'rot4') {
      const cx = w / 2, cy = h / 2, rad = PXC * 0.44;
      for (const [ctx, fill, ring] of [[b, 'rgba(36,36,36,1)', 'rgba(228,228,228,1)'], [a, 'rgba(86,40,16,0.95)', 'rgba(244,226,190,0.95)']]) {
        ctx.save(); ctx.fillStyle = fill; ctx.beginPath(); ctx.arc(cx, cy, rad, 0, TAU); ctx.fill();
        ctx.strokeStyle = ring; ctx.lineWidth = PXC * 0.055; ctx.lineCap = 'round';
        const n = kind === 'rot2' ? 2 : 4;
        for (let k = 0; k < n; k++) { const a0 = (k / n) * TAU + 0.3, a1 = a0 + TAU / n - 0.8; ctx.beginPath(); ctx.arc(cx, cy, rad * 0.58, a0, a1); ctx.stroke(); }
        ctx.restore();
      }
    }
    if (kind === 'glide') for (let x = p; x < W; x += p) {
      for (const [ctx, col] of [[b, 'rgba(20,20,20,1)'], [a, 'rgba(80,34,12,0.9)']]) { ctx.fillStyle = col; ctx.beginPath(); ctx.arc(x * PXC, h - PXC * 0.2, PXC * 0.12, 0, TAU); ctx.fill(); }
    }
    // crumbs of plaster along the groove edge: a few light flecks
    for (let i = 0; i < 40; i++) { a.fillStyle = 'rgba(255,236,200,0.5)'; a.fillRect(hash(i, 5) * w, hash(i, 6) * h, 1.5, 1.5); }
  }

  // ------------------------------------------------------------ one painted cell
  function cellPoly(i, m, jit) {
    const j = (k) => (hash(i, k, 77) - 0.5) * 2 * jit;
    return [[m + j(1), m + j(2)], [PXC - m + j(3), m + j(4)], [PXC - m + j(5), PXC - m + j(6)], [m + j(7), PXC - m + j(8)]];
  }
  function polyPath(ctx, p, ox, oy) {
    const n = p.length, mid = (u, v) => [(u[0] + v[0]) / 2 + ox, (u[1] + v[1]) / 2 + oy];
    const s = mid(p[n - 1], p[0]);
    ctx.beginPath(); ctx.moveTo(s[0], s[1]);
    for (let k = 0; k < n; k++) { const c = [p[k][0] + ox, p[k][1] + oy], e = mid(p[k], p[(k + 1) % n]); ctx.quadraticCurveTo(c[0], c[1], e[0], e[1]); }
    ctx.closePath();
  }
  function drawCell(i, wallObj, o) {
    const W = wallObj.W, x = (i % W) * PXC, y = Math.floor(i / W) * PXC;
    for (const [dst, src] of [[ca, baseA], [cb, baseB], [cr, baseR]]) dst.drawImage(src, x, y, PXC, PXC, x, y, PXC, PXC);
    const c = o.cell;
    if (!c) {
      if (o.guide && wallObj.target[i] > 0 && !wallObj.elder[i]) {
        const col = PIG[wallObj.target[i]].dry;
        ca.fillStyle = rgb(col); ca.globalAlpha = 0.72; ca.beginPath(); ca.arc(x + PXC / 2, y + PXC / 2, PXC * 0.1, 0, TAU); ca.fill(); ca.globalAlpha = 1;
        ca.strokeStyle = 'rgba(40,20,8,0.7)'; ca.lineWidth = 1.5; ca.stroke();
        cb.fillStyle = 'rgba(225,225,225,0.8)'; cb.beginPath(); cb.arc(x + PXC / 2, y + PXC / 2, PXC * 0.1, 0, TAU); cb.fill();
      }
      return;
    }
    const pg = PIG[c], wetK = clamp(1 - o.age / 2.6, 0, 1), col = mixC(pg.dry, pg.wet, wetK * 0.85);
    const poly = cellPoly(i, PXC * 0.075, PXC * 0.032);
    // raised paint: albedo
    ca.save(); ca.beginPath(); ca.rect(x, y, PXC, PXC); ca.clip();
    polyPath(ca, poly, x, y);
    ca.shadowColor = 'rgba(30,12,2,0.55)'; ca.shadowBlur = PXC * 0.05; ca.shadowOffsetX = PXC * 0.018; ca.shadowOffsetY = PXC * 0.025;
    ca.fillStyle = rgb(col); ca.fill();
    ca.shadowColor = 'transparent'; ca.shadowBlur = 0;
    ca.save(); polyPath(ca, poly, x, y); ca.clip();
    // brush marks along the stroke and pigment grain
    const n = 7 + (c === 1 ? 4 : 0);
    for (let k = 0; k < n; k++) {
      const yy = y + PXC * (0.12 + hash(i, k, 5) * 0.76), xx0 = x + PXC * hash(i, k, 6) * 0.25, ln = PXC * (0.5 + hash(i, k, 7) * 0.5);
      ca.strokeStyle = hash(i, k, 8) < 0.5 ? `rgba(255,255,255,${c === 2 ? 0.07 : 0.13})` : 'rgba(0,0,0,0.10)'; ca.lineWidth = 1 + hash(i, k, 9) * 2.2;
      ca.beginPath(); ca.moveTo(xx0, yy); ca.lineTo(xx0 + ln, yy + (hash(i, k, 10) - 0.5) * 3); ca.stroke();
    }
    for (let k = 0; k < 26; k++) { ca.fillStyle = hash(i, k, 11) < 0.5 ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.12)'; ca.fillRect(x + hash(i, k, 12) * PXC, y + hash(i, k, 13) * PXC, 1.6, 1.6); }
    // plaster grain showing through the thin pigment
    for (let k = 0; k < 14; k++) { ca.fillStyle = 'rgba(190,150,100,0.22)'; ca.fillRect(x + hash(i, k, 14) * PXC, y + hash(i, k, 15) * PXC, 2.2, 1.6); }
    ca.restore();
    polyPath(ca, poly, x, y); ca.lineWidth = Math.max(1.2, PXC * 0.022); ca.strokeStyle = pg.rim; ca.stroke();
    if (o.glaze) { polyPath(ca, poly, x, y); ca.fillStyle = 'rgba(255,224,130,0.22)'; ca.fill(); ca.lineWidth = Math.max(2, PXC * 0.04); ca.strokeStyle = 'rgba(255,214,110,0.9)'; ca.stroke(); }
    ca.restore();
    // bump: a proud, soft-shouldered layer
    cb.save(); cb.beginPath(); cb.rect(x, y, PXC, PXC); cb.clip();
    polyPath(cb, poly, x, y); cb.shadowColor = `rgb(${pg.bump},${pg.bump},${pg.bump})`; cb.shadowBlur = PXC * 0.05;
    cb.fillStyle = `rgb(${pg.bump},${pg.bump},${pg.bump})`; cb.fill(); cb.shadowBlur = 0;
    for (let k = 0; k < 30; k++) { cb.fillStyle = hash(i, k, 16) < 0.5 ? 'rgba(255,255,255,0.18)' : 'rgba(0,0,0,0.18)'; cb.fillRect(x + hash(i, k, 17) * PXC, y + hash(i, k, 18) * PXC, 2.4, 1.8); }
    for (let k = 0; k < 6; k++) { cb.strokeStyle = 'rgba(0,0,0,0.12)'; cb.lineWidth = 2; const yy = y + PXC * (0.15 + hash(i, k, 19) * 0.7); cb.beginPath(); cb.moveTo(x + PXC * 0.12, yy); cb.lineTo(x + PXC * 0.88, yy + 2); cb.stroke(); }
    cb.restore();
    // roughness: wet paint and glaze are glossy
    const rough = clamp(pg.rough - wetK * 0.42 - (o.glaze ? 0.6 : 0), 0.12, 1);
    cr.save(); polyPath(cr, poly, x, y); cr.fillStyle = `rgb(${Math.round(rough * 255)},${Math.round(rough * 255)},${Math.round(rough * 255)})`; cr.fill(); cr.restore();
  }

  // ------------------------------------------------------------ rain-wash streaks (permanent run-off stains on the plaster)
  function stain(i, len, col) {
    const W = state.W, x = (i % W) * PXC + PXC / 2, y0 = Math.floor(i / W) * PXC + PXC * 0.55;
    const a = baseA.getContext('2d'), b = baseB.getContext('2d'), r = baseR.getContext('2d');
    const prev = stainLen[i] || 0, from = y0 + prev, to = y0 + len, wd = PXC * (0.2 + hash(i, 3, 88) * 0.12);
    if (to <= from) return;
    const c = PIG[col] ? PIG[col].dry : PIG[1].dry, tint = mixC(c, [110, 70, 40], 0.62);
    const g = a.createLinearGradient(x - wd, 0, x + wd, 0); g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(0.5, `rgba(${tint.map(Math.round).join(',')},0.55)`); g.addColorStop(1, 'rgba(0,0,0,0)');
    a.fillStyle = g; a.fillRect(x - wd, from, wd * 2, to - from);
    const gb = b.createLinearGradient(x - wd, 0, x + wd, 0); gb.addColorStop(0, 'rgba(0,0,0,0)'); gb.addColorStop(0.5, 'rgba(60,60,60,0.25)'); gb.addColorStop(1, 'rgba(0,0,0,0)');
    b.fillStyle = gb; b.fillRect(x - wd, from, wd * 2, to - from);
    r.fillStyle = 'rgba(150,150,150,0.4)'; r.fillRect(x - wd * 0.5, from, wd, to - from);
    // droplet blob at the end of the run
    a.fillStyle = `rgba(${tint.map(Math.round).join(',')},0.6)`; a.beginPath(); a.arc(x, to, wd * 0.5, 0, TAU); a.fill();
    stainLen[i] = len;
  }

  // ------------------------------------------------------------ glow pools (hint squares, wrong marks, rain rings, cursor)
  const sqRing = new THREE.RingGeometry(CELL * 0.4, CELL * 0.49, 4, 1); sqRing.rotateZ(Math.PI / 4);
  const sqFill = new THREE.PlaneGeometry(CELL * 0.86, CELL * 0.86);
  const ringG = new THREE.RingGeometry(0.9, 1.0, 40);
  const barG = new THREE.PlaneGeometry(CELL * 0.62, CELL * 0.07);
  const glowMat = (color, op = 1, add = true) => new THREE.MeshBasicMaterial({ color, transparent: true, opacity: op, depthWrite: false, blending: add ? THREE.AdditiveBlending : THREE.NormalBlending, fog: false });
  const hintRings = [], hintFills = [], wrongs = [], rings = [];
  for (let k = 0; k < 24; k++) {
    const hr = new THREE.Mesh(sqRing, glowMat(0xffc21a, 1, false)); hr.visible = false; group.add(hr); hintRings.push(hr);
    const hf = new THREE.Mesh(sqFill, new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.4, depthWrite: false, fog: false })); hf.visible = false; group.add(hf); hintFills.push(hf);
  }
  for (let k = 0; k < 40; k++) {
    const g = new THREE.Group(), m1 = new THREE.Mesh(barG, glowMat(0xff5a3c)), m2 = new THREE.Mesh(barG, glowMat(0xff5a3c)); m1.rotation.z = Math.PI / 4; m2.rotation.z = -Math.PI / 4;
    const rg = new THREE.Mesh(new THREE.RingGeometry(CELL * 0.4, CELL * 0.46, 28), glowMat(0xffffff)); g.add(m1, m2, rg); g.visible = false; group.add(g); wrongs.push({ g, rg });
  }
  for (let k = 0; k < 14; k++) {
    const g = new THREE.Group(), ring = new THREE.Mesh(ringG, glowMat(0xffd28a)); const core = new THREE.Mesh(new THREE.RingGeometry(CELL * 0.3, CELL * 0.34, 28), glowMat(0xffffff, 0.9));
    g.add(ring, core); g.visible = false; group.add(g); rings.push({ g, ring, core });
  }
  const cursor = new THREE.Mesh(sqRing, glowMat(0xffffff, 0.9)); cursor.visible = false; group.add(cursor);
  const cellPos = (i, W, H, z = 0.012) => ({ x: ((i % W) + 0.5 - W / 2) * CELL, y: (H / 2 - Math.floor(i / W) - 0.5) * CELL, z });

  // ------------------------------------------------------------ public
  function setWall(wall) {
    state.wall = wall; state.W = wall.W; state.H = wall.H;
    buildBase(wall); buildFrame(wall.W, wall.H);
    const w = wall.W * PXC, h = wall.H * PXC;
    A = cv(w, h); B = cv(w, h); R = cv(w, h);
    ca = A.getContext('2d'); cb = B.getContext('2d'); cr = R.getContext('2d');
    ca.drawImage(baseA, 0, 0); cb.drawImage(baseB, 0, 0); cr.drawImage(baseR, 0, 0);
    for (const t of [texA, texB, texR]) if (t) t.dispose();
    texA = new THREE.CanvasTexture(A); texA.colorSpace = THREE.SRGBColorSpace; texA.anisotropy = 8;
    texB = new THREE.CanvasTexture(B); texR = new THREE.CanvasTexture(R);
    panelMat.map = texA; panelMat.bumpMap = texB; panelMat.roughnessMap = texR; panelMat.needsUpdate = true;
    panel.geometry.dispose(); panel.geometry = new THREE.PlaneGeometry(wall.W * CELL, wall.H * CELL);
    shown = new Int32Array(wall.N).fill(-1); paintT = new Float32Array(wall.N).fill(-99); lastCol = new Uint8Array(wall.N); stainLen = new Float32Array(wall.N);
  }
  function rebuildTextures() { if (state.wall) { const w = state.wall; state.wall = null; setWall(w); } }

  // f: { wall, cells, glaze, guide, hintIdx, hintColor, wrong, cursor, drops:[{i, k}], drips:[{i,t}], damp, hold(t) }
  function sync(f, dt, t) {
    const wall = f.wall;
    if (state.wall !== wall) setWall(wall);
    const N = wall.N, W = wall.W, H = wall.H;
    let upd = false;
    const wetNow = [];
    for (let i = 0; i < N; i++) {
      const c = f.cells[i], gl = f.glaze && f.glaze[i] ? 1 : 0, gd = f.guide && !c && !wall.elder[i] && wall.target[i] > 0 ? wall.target[i] : 0;
      const sig = c | (gl << 3) | (gd << 4);
      if (c !== 0) lastCol[i] = c;
      if (sig !== shown[i]) {
        if (c && shown[i] >= 0 && (shown[i] & 7) !== c) paintT[i] = t;
        else if (c && shown[i] < 0) paintT[i] = -99;     // already on the wall when the screen opened: dry
        shown[i] = sig; wetNow.push(i);
      } else if (c && t - paintT[i] < 2.7) wetNow.push(i);
    }
    // wash streaks
    if (f.drips) for (const d of f.drips) {
      const len = clamp(d.t / 1.5, 0, 1) * PXC * 2.2;
      stain(d.i, len, lastCol[d.i] || 1);
      for (let k = 0; k * PXC <= len + PXC * 0.6; k++) { const j = d.i + k * W; if (j < N) wetNow.push(j); }
    }
    wetTimer += dt;
    if (wetNow.length && (wetTimer > 0.09 || wetNow.some((i) => !(t - paintT[i] < 2.7)))) {
      wetTimer = 0;
      const seen = new Set();
      for (const i of wetNow) {
        if (seen.has(i)) continue; seen.add(i);
        drawCell(i, wall, { cell: f.cells[i], age: t - paintT[i], glaze: f.glaze && f.glaze[i], guide: f.guide });
      }
      upd = true;
    }
    if (upd) { texA.needsUpdate = true; texB.needsUpdate = true; texR.needsUpdate = true; }

    // dampness: the whole plaster darkens and glistens while it rains
    const d = clamp(f.damp || 0, 0, 1);
    const k = 1 - 0.34 * d;
    panelMat.color.setRGB(k, k * 0.97, k * 0.94); panelMat.roughness = 1 - 0.25 * d;
    ridgeMat.color.setRGB(k, k * 0.97, k * 0.94);

    // hint squares
    const hi = f.hintIdx || [];
    for (let n = 0; n < hintRings.length; n++) {
      const on = n < hi.length, hr = hintRings[n], hf = hintFills[n];
      hr.visible = hf.visible = on;
      if (!on) continue;
      const p = cellPos(hi[n], W, H), pulse = 0.65 + 0.35 * Math.sin(t * 6);
      hr.position.set(p.x, p.y, 0.016); hf.position.set(p.x, p.y, 0.0145);
      hr.material.opacity = 0.55 + 0.45 * pulse;
      hf.material.color.set(f.hintColor ? PIG_HEX[f.hintColor] : '#ffffff'); hf.material.opacity = 0.34 + 0.2 * pulse;
    }
    // verdict marks
    const wr = f.wrong || [];
    for (let n = 0; n < wrongs.length; n++) {
      const w = wrongs[n], on = n < wr.length; w.g.visible = on;
      if (!on) continue;
      const p = cellPos(wr[n], W, H, 0.018); w.g.position.set(p.x, p.y, p.z);
      const tg = wall.target[wr[n]];
      w.rg.visible = tg > 0; if (tg > 0) w.rg.material.color.set(PIG_HEX[tg]);
      w.g.scale.setScalar(1 + 0.05 * Math.sin(t * 5 + n));
    }
    // cursor (keyboard)
    if (f.cursor) { const p = cellPos(f.cursor.y * W + f.cursor.x, W, H, 0.02); cursor.position.set(p.x, p.y, p.z); cursor.visible = true; } else cursor.visible = false;
    // rain rings
    const drops = f.drops || [];
    for (let n = 0; n < rings.length; n++) {
      const r = rings[n], on = n < drops.length; r.g.visible = on;
      if (!on) continue;
      const dr = drops[n], p = cellPos(dr.i, W, H, 0.02), kk = dr.k, pulse = 0.5 + 0.5 * Math.sin(t * 14);
      r.g.position.set(p.x, p.y, p.z);
      const rad = CELL * (0.78 - 0.3 * kk);
      r.ring.scale.setScalar(rad); r.ring.material.color.setRGB(1, 0.82 - 0.35 * kk, 0.54 - 0.34 * kk); r.ring.material.opacity = 0.7 + 0.3 * pulse;
      r.core.scale.setScalar(0.6 + 0.5 * (1 - kk)); r.core.material.opacity = 0.5 + 0.5 * (1 - kk);
    }
  }

  return { group, sync, setWall, rebuild: rebuildTextures, panel, get PXC() { return PXC; }, cellPos: (i) => cellPos(i, state.W, state.H, 0), get size() { return { W: state.W, H: state.H }; } };
}
