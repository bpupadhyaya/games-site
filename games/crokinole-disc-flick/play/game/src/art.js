// Drawing primitives for the table: the backdrop, the board (baked once into a sprite), pegs, discs, the maple-leaf
// emblem. Pure drawing, no state. Everything is original: a warm wooden board on a plaid cloth.
import { R_DISC, R_POCKET, R_PEG, R_PEG_RING, R_BASE, R_PLAY, R_BOARD, RINGS, PEGS, U_ANGLE, MAX_U } from './sim.js';

export const FONT = "Georgia, 'Times New Roman', serif";
const TAU = Math.PI * 2;
export const TEAM = [
  { face0: '#ee4b3c', face1: '#bf2420', edge: '#5e0d10', mark: '#fff0dc', glow: 'rgba(255,110,90,0.9)', name: 'red' },
  { face0: '#2f86d6', face1: '#16569c', edge: '#0a2848', mark: '#eaf6ff', glow: 'rgba(90,170,255,0.9)', name: 'blue' },
];

// ---- host (off-screen surfaces) ------------------------------------------------------------------
let hostDoc = null;
export function setHost(ctx) {
  if (hostDoc || typeof OffscreenCanvas !== 'undefined') return;
  const d = ctx && ctx.canvas && ctx.canvas.ownerDocument;
  if (d && typeof d.createElement === 'function') hostDoc = d;
}
export const canBake = () => typeof OffscreenCanvas !== 'undefined' || hostDoc !== null;
export function makeCanvas(w, h) {
  if (typeof OffscreenCanvas !== 'undefined') return new OffscreenCanvas(w, h);
  if (hostDoc) { const c = hostDoc.createElement('canvas'); c.width = w; c.height = h; return c; }
  return null;
}

// deterministic pseudo-random for decoration only (never touches the game's rng)
const lcg = (seed) => { let s = seed >>> 0; return () => { s = (Math.imul(s, 1664525) + 1013904223) >>> 0; return s / 4294967296; }; };

// ---- shapes --------------------------------------------------------------------------------------
const LEAF = [[0, -1], [0.17, -0.72], [0.3, -0.8], [0.3, -0.5], [0.52, -0.56], [0.46, -0.36], [0.78, -0.4], [0.66, -0.2], [0.92, -0.1], [0.7, 0.08], [0.8, 0.32], [0.48, 0.26], [0.4, 0.4], [0.1, 0.3], [0.07, 0.5], [0.04, 0.96]];
export function leafPath(ctx, x, y, s, rot = 0) {
  const c = Math.cos(rot), n = Math.sin(rot);
  const P = (px, py) => [x + (px * c - py * n) * s, y + (px * n + py * c) * s];
  const pts = [...LEAF, ...LEAF.slice().reverse().map(([px, py]) => [-px, py])];
  ctx.beginPath();
  pts.forEach(([px, py], i) => { const [qx, qy] = P(px, py); if (i === 0) ctx.moveTo(qx, qy); else ctx.lineTo(qx, qy); });
  ctx.closePath();
}
export function starPath(ctx, x, y, s, rot = 0) {
  ctx.beginPath();
  for (let i = 0; i < 8; i++) {
    const a = rot + (i * Math.PI) / 4 - Math.PI / 2, r = i % 2 ? s * 0.34 : s;
    const px = x + Math.cos(a) * r, py = y + Math.sin(a) * r;
    if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
  }
  ctx.closePath();
}

// ---- the backdrop: a plaid cloth lit from above ----------------------------------------------------
export function drawBackdrop(ctx, W, H) {
  ctx.fillStyle = '#240a0e'; ctx.fillRect(0, 0, W, H);
  const cell = 56;
  ctx.fillStyle = 'rgba(150,26,36,0.62)';
  for (let y = 0; y < H; y += cell * 2) ctx.fillRect(0, y, W, cell);
  for (let x = 0; x < W; x += cell * 2) ctx.fillRect(x, 0, cell, H);
  ctx.fillStyle = 'rgba(8,2,4,0.35)';
  for (let y = cell; y < H; y += cell * 2) ctx.fillRect(0, y, W, cell);
  ctx.strokeStyle = 'rgba(0,0,0,0.22)'; ctx.lineWidth = 1.5;
  ctx.beginPath();
  for (let y = 0; y <= H; y += cell / 2) { ctx.moveTo(0, y); ctx.lineTo(W, y); }
  for (let x = 0; x <= W; x += cell / 2) { ctx.moveTo(x, 0); ctx.lineTo(x, H); }
  ctx.stroke();
  const big = Math.max(W, H), g = ctx.createRadialGradient(W / 2, H * 0.4375, 120, W / 2, H * 0.469, big * 0.703);
  g.addColorStop(0, 'rgba(255,214,150,0.22)'); g.addColorStop(0.45, 'rgba(0,0,0,0)'); g.addColorStop(1, 'rgba(0,0,0,0.72)');
  ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
}

// ---- the board (origin = board centre) ----------------------------------------------------------------
function ringPath(ctx, r) { ctx.beginPath(); ctx.arc(0, 0, r, 0, TAU); }

export const BOARD_STAGES = [
  // 1: table shadow, rim, gutter, playing surface
  (ctx) => {
    let g = ctx.createRadialGradient(8, 14, R_BOARD, 8, 14, R_BOARD + 46);
    g.addColorStop(0, 'rgba(0,0,0,0.55)'); g.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = g; ringPath(ctx, R_BOARD + 46); ctx.fill();
    g = ctx.createLinearGradient(-R_BOARD, -R_BOARD, R_BOARD, R_BOARD);
    g.addColorStop(0, '#9a6738'); g.addColorStop(0.5, '#5e3a1c'); g.addColorStop(1, '#3a210f');
    ctx.fillStyle = g; ringPath(ctx, R_BOARD + 20); ctx.fill();
    ctx.strokeStyle = 'rgba(255,224,170,0.45)'; ctx.lineWidth = 2.5; ringPath(ctx, R_BOARD + 19); ctx.stroke();
    ctx.strokeStyle = 'rgba(0,0,0,0.5)'; ctx.lineWidth = 2; ringPath(ctx, R_BOARD + 1); ctx.stroke();
    // the gutter: a dark groove
    g = ctx.createRadialGradient(0, 0, R_PLAY - 2, 0, 0, R_BOARD);
    g.addColorStop(0, '#1b0e06'); g.addColorStop(0.5, '#33200f'); g.addColorStop(1, '#4a2f18');
    ctx.fillStyle = g; ringPath(ctx, R_BOARD); ctx.fill();
    // playing surface
    g = ctx.createRadialGradient(-60, -80, 20, 0, 0, R_PLAY);
    g.addColorStop(0, '#f6e2b0'); g.addColorStop(0.6, '#ecd198'); g.addColorStop(1, '#d6b072');
    ctx.fillStyle = g; ringPath(ctx, R_PLAY); ctx.fill();
    ctx.strokeStyle = 'rgba(70,40,14,0.55)'; ctx.lineWidth = 3; ringPath(ctx, R_PLAY); ctx.stroke();
    ctx.strokeStyle = 'rgba(255,248,220,0.35)'; ctx.lineWidth = 1.5; ringPath(ctx, R_PLAY - 3); ctx.stroke();
  },
  // 2: grain and zone tints
  (ctx) => {
    ctx.save(); ringPath(ctx, R_PLAY - 1); ctx.clip();
    const r = lcg(11);
    for (let i = 0; i < 120; i++) {
      const x = -R_PLAY + (i / 120) * R_PLAY * 2 + (r() - 0.5) * 10, amp = (r() - 0.5) * 34, w = 0.8 + r() * 2;
      ctx.strokeStyle = r() < 0.6 ? `rgba(120,76,28,${0.05 + r() * 0.08})` : `rgba(255,250,226,${0.1 + r() * 0.12})`;
      ctx.lineWidth = w; ctx.beginPath(); ctx.moveTo(x, -R_PLAY);
      ctx.bezierCurveTo(x + amp, -R_PLAY * 0.35, x - amp, R_PLAY * 0.35, x + amp * 0.4, R_PLAY); ctx.stroke();
    }
    const tints = [[R_PLAY, 'rgba(60,40,10,0)'], [RINGS[2].r, 'rgba(70,120,96,0.12)'], [RINGS[1].r, 'rgba(210,150,60,0.12)'], [RINGS[0].r, 'rgba(210,80,50,0.14)']];
    tints.forEach(([rr, col]) => { ctx.fillStyle = col; ringPath(ctx, rr); ctx.fill(); });
    ctx.restore();
  },
  // 3: ring lines, numerals, leaves, shooting lines, the pocket, the pegs
  (ctx) => {
    ctx.strokeStyle = 'rgba(70,40,14,0.85)'; ctx.lineWidth = 3.2;
    RINGS.forEach((g) => { ringPath(ctx, g.r); ctx.stroke(); });
    ctx.strokeStyle = 'rgba(255,248,224,0.4)'; ctx.lineWidth = 1.2;
    RINGS.forEach((g) => { ringPath(ctx, g.r + 2.5); ctx.stroke(); });
    // numerals on the diagonals
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    const nums = [[RINGS[0].r * 0.72, '15'], [(RINGS[0].r + RINGS[1].r) / 2, '10'], [(RINGS[1].r + RINGS[2].r) / 2, '5']];
    nums.forEach(([rr, t], k) => {
      for (let q = 0; q < 4; q++) {
        const a = Math.PI / 4 + (q * Math.PI) / 2;
        ctx.save(); ctx.translate(Math.cos(a) * rr, Math.sin(a) * rr); ctx.rotate(a + Math.PI / 2 * 0);
        ctx.font = `700 ${k === 0 ? 22 : 26}px ${FONT}`; ctx.fillStyle = 'rgba(255,248,224,0.55)'; ctx.fillText(t, 1, 1.5);
        ctx.fillStyle = 'rgba(92,52,18,0.62)'; ctx.fillText(t, 0, 0);
        ctx.restore();
      }
    });
    // maple leaves on the four axes of the outer ring
    for (let q = 0; q < 4; q++) {
      const a = (q * Math.PI) / 2, rr = (RINGS[1].r + RINGS[2].r) / 2;
      ctx.fillStyle = 'rgba(176,38,36,0.2)'; leafPath(ctx, Math.cos(a) * rr, Math.sin(a) * rr, 24, a + Math.PI / 2 + Math.PI); ctx.fill();
    }
    // shooting lines
    for (let side = 0; side < 2; side++) {
      const c = side === 0 ? Math.PI / 2 : -Math.PI / 2, half = MAX_U * U_ANGLE + 0.12;
      ctx.strokeStyle = 'rgba(70,40,14,0.7)'; ctx.lineWidth = 2.5; ctx.beginPath(); ctx.arc(0, 0, R_BASE + R_DISC + 1, c - half, c + half); ctx.stroke();
      ctx.strokeStyle = side === 0 ? 'rgba(190,40,40,0.35)' : 'rgba(40,110,180,0.35)'; ctx.lineWidth = 9;
      ctx.beginPath(); ctx.arc(0, 0, R_BASE + R_DISC - 4, c - half, c + half); ctx.stroke();
    }
    // the pocket: a deep brass-rimmed hole
    let g = ctx.createRadialGradient(0, 0, 2, 0, 0, R_POCKET + 8);
    g.addColorStop(0, '#080403'); g.addColorStop(0.72, '#1c0f06'); g.addColorStop(1, '#3d2610');
    ctx.fillStyle = g; ringPath(ctx, R_POCKET + 6); ctx.fill();
    ctx.lineWidth = 5; ctx.strokeStyle = '#b98a3c'; ringPath(ctx, R_POCKET + 5); ctx.stroke();
    ctx.lineWidth = 1.6; ctx.strokeStyle = '#fbe39a'; ringPath(ctx, R_POCKET + 7.5); ctx.stroke();
    g = ctx.createRadialGradient(-6, -8, 2, 0, 0, R_POCKET - 2);
    g.addColorStop(0, '#000'); g.addColorStop(1, '#120a04');
    ctx.fillStyle = g; ringPath(ctx, R_POCKET - 2); ctx.fill();
    ctx.font = `700 22px ${FONT}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillStyle = 'rgba(255,220,130,0.8)'; ctx.fillText('20', 0, 1);
    // pegs
    PEGS.forEach((p) => drawPeg(ctx, p.x, p.y, 0));
  },
];

export function drawPeg(ctx, x, y, flash = 0) {
  ctx.save();
  const sg = ctx.createRadialGradient(x + 3.5, y + 5, 1, x + 3.5, y + 5, R_PEG + 5);
  sg.addColorStop(0, 'rgba(30,14,4,0.5)'); sg.addColorStop(1, 'rgba(30,14,4,0)');
  ctx.fillStyle = sg; ctx.beginPath(); ctx.arc(x + 3.5, y + 5, R_PEG + 5, 0, TAU); ctx.fill();
  const g = ctx.createRadialGradient(x - 2, y - 2.5, 0.5, x, y, R_PEG);
  g.addColorStop(0, flash ? '#ffffff' : '#fff0b8'); g.addColorStop(0.45, '#d9a84a'); g.addColorStop(1, '#7a521a');
  ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, R_PEG, 0, TAU); ctx.fill();
  ctx.lineWidth = 1.2; ctx.strokeStyle = 'rgba(70,40,10,0.8)'; ctx.stroke();
  if (flash) { ctx.strokeStyle = `rgba(255,240,170,${flash})`; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(x, y, R_PEG + 5 + (1 - flash) * 8, 0, TAU); ctx.stroke(); }
  ctx.restore();
}

// A board sprite baked in three slices (one per frame). Resolves to a canvas (or null while baking / false when this
// host cannot bake, in which case callers draw the board directly).
const SIZE = (R_BOARD + 70) * 2;
export function startBoardBake(res) {
  const cv = makeCanvas(Math.round(SIZE * res), Math.round(SIZE * res));
  if (!cv) return { failed: true, step: () => false };
  const cx = cv.getContext('2d');
  let i = 0;
  return {
    failed: false,
    step(all) {
      do {
        cx.save(); cx.scale(res, res); cx.translate(SIZE / 2, SIZE / 2);
        BOARD_STAGES[i](cx); cx.restore();
        i++;
      } while (all && i < BOARD_STAGES.length);
      return i >= BOARD_STAGES.length ? cv : null;
    },
  };
}
export const SPRITE_SIZE = SIZE;
export function drawBoardDirect(ctx) { BOARD_STAGES.forEach((s) => s(ctx)); }

// ---- discs -----------------------------------------------------------------------------------------
// One disc: soft shadow, bevelled edge, lit face, groove, emblem. `lift` raises it (shadow moves away), `a` is alpha.
export function drawDisc(ctx, x, y, team, spin = 0, o = {}) {
  const { scale = 1, a = 1, lift = 0, glow = 0, ghost = false } = o;
  const T = TEAM[team], r = R_DISC * scale;
  ctx.save();
  ctx.globalAlpha = a;
  if (!ghost) {
    const sx = x + 3 + lift * 0.5, sy = y + 4.5 + lift * 0.8, sr = r * (1.28 + lift * 0.01);
    const sg = ctx.createRadialGradient(sx, sy, r * 0.4, sx, sy, sr);
    sg.addColorStop(0, `rgba(30,12,4,${0.5 - Math.min(0.2, lift * 0.01)})`); sg.addColorStop(1, 'rgba(30,12,4,0)');
    ctx.fillStyle = sg; ctx.beginPath(); ctx.arc(sx, sy, sr, 0, TAU); ctx.fill();
  }
  if (glow > 0) {
    const gg = ctx.createRadialGradient(x, y, r, x, y, r * 2.3);
    gg.addColorStop(0, T.glow.replace('0.9', String(0.55 * glow))); gg.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = gg; ctx.beginPath(); ctx.arc(x, y, r * 2.3, 0, TAU); ctx.fill();
  }
  // edge
  let g = ctx.createLinearGradient(x - r, y - r, x + r, y + r);
  g.addColorStop(0, T.face0); g.addColorStop(1, T.edge);
  ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.fill();
  // face
  g = ctx.createRadialGradient(x - r * 0.38, y - r * 0.42, r * 0.05, x, y, r * 0.9);
  g.addColorStop(0, T.face0); g.addColorStop(0.7, T.face1); g.addColorStop(1, T.edge);
  ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, r * 0.86, 0, TAU); ctx.fill();
  ctx.lineWidth = Math.max(1, r * 0.07); ctx.strokeStyle = 'rgba(255,255,255,0.28)';
  ctx.beginPath(); ctx.arc(x, y, r * 0.86, Math.PI * 1.05, Math.PI * 1.75); ctx.stroke();
  ctx.strokeStyle = 'rgba(0,0,0,0.3)'; ctx.beginPath(); ctx.arc(x, y, r * 0.86, Math.PI * 0.05, Math.PI * 0.75); ctx.stroke();
  // groove
  ctx.lineWidth = Math.max(0.8, r * 0.05); ctx.strokeStyle = 'rgba(0,0,0,0.25)';
  ctx.beginPath(); ctx.arc(x, y, r * 0.66, 0, TAU); ctx.stroke();
  // emblem
  // Two unmistakable sides even at 20 px: red = a pale medallion with a dark leaf; blue = a dark centre ringed in pale with a pale star.
  if (team === 0) {
    ctx.fillStyle = T.mark; ctx.beginPath(); ctx.arc(x, y, r * 0.62, 0, TAU); ctx.fill();
    ctx.lineWidth = Math.max(1, r * 0.07); ctx.strokeStyle = 'rgba(70,8,12,0.75)'; ctx.stroke();
    ctx.fillStyle = '#8f1218'; leafPath(ctx, x, y + r * 0.02, r * 0.5, spin); ctx.fill();
  } else {
    ctx.fillStyle = '#081f3a'; ctx.beginPath(); ctx.arc(x, y, r * 0.62, 0, TAU); ctx.fill();
    ctx.lineWidth = Math.max(1.4, r * 0.14); ctx.strokeStyle = T.mark; ctx.stroke();
    ctx.fillStyle = T.mark; starPath(ctx, x, y, r * 0.46, spin); ctx.fill();
  }
  ctx.globalAlpha = a;
  // specular
  g = ctx.createRadialGradient(x - r * 0.45, y - r * 0.5, 0, x - r * 0.45, y - r * 0.5, r * 0.5);
  g.addColorStop(0, 'rgba(255,255,255,0.5)'); g.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, r * 0.86, 0, TAU); ctx.fill();
  ctx.restore();
}
