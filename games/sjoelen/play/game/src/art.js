// Drawing of the board, the discs and the arch stacks, all in world units (the caller applies the board transform).
// The still parts of the board are baked once into an offscreen canvas (4 px per unit) and stamped each frame.
import { R, AW, PD, TW, D, TL, BAR, NEAR, LANE_PITCH, ARCH_VALUES, START_Y, laneX, postRect } from './sim.js';

const TAU = Math.PI * 2;
export const DISPLAY = "'Dela Gothic One', 'Avenir Next', 'Trebuchet MS', system-ui, sans-serif";
const UI = "'Avenir Next', 'Trebuchet MS', 'Segoe UI', Roboto, system-ui, sans-serif";
export const WX0 = -16, WX1 = TW + 16, WY0 = -D - BAR, WY1 = TL + NEAR;
const PX = 4;

// Light comes from the top left of the SCREEN, so the shadow offset in world units depends on how the board is turned.
export const LIGHT = { x: 1.5, y: 2.1 };
let ROT = false;
export const setRot = (rot) => { ROT = !!rot; if (rot) { LIGHT.x = 2.1; LIGHT.y = -1.5; } else { LIGHT.x = 1.5; LIGHT.y = 2.1; } };

// a small deterministic hash -> 0..1 (no randomness: art must be reproducible)
const h01 = (n) => { const s = Math.sin(n * 127.1 + 311.7) * 43758.5453; return s - Math.floor(s); };

function rr(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r); ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

// ---- the still board ------------------------------------------------------------------------------------------------
function paintBoard(ctx) {
  // outer frame: dark walnut with a bevel
  let g = ctx.createLinearGradient(WX0, 0, WX1, 0);
  g.addColorStop(0, '#6b3a1a'); g.addColorStop(0.5, '#4a2610'); g.addColorStop(1, '#2f170a');
  rr(ctx, WX0, WY0, WX1 - WX0, WY1 - WY0, 14); ctx.fillStyle = g; ctx.fill();
  ctx.save(); rr(ctx, WX0, WY0, WX1 - WX0, WY1 - WY0, 14); ctx.clip();
  // rail grain
  ctx.lineWidth = 0.5;
  for (let i = 0; i < 70; i++) {
    const x = WX0 + h01(i) * (WX1 - WX0);
    ctx.strokeStyle = `rgba(${h01(i + 9) > 0.5 ? '255,200,140' : '20,8,2'},${0.05 + h01(i + 3) * 0.1})`;
    ctx.beginPath(); ctx.moveTo(x, WY0); ctx.bezierCurveTo(x + 4 * h01(i + 1), WY0 + 160, x - 5 * h01(i + 2), WY0 + 380, x + 2, WY1); ctx.stroke();
  }
  ctx.restore();
  ctx.lineWidth = 1.4; ctx.strokeStyle = 'rgba(255,214,150,0.55)'; rr(ctx, WX0 + 1, WY0 + 1, WX1 - WX0 - 2, WY1 - WY0 - 2, 13); ctx.stroke();

  // playfield: lacquered maple
  const fx0 = 0, fx1 = TW, fy0 = -D, fy1 = TL + NEAR - 8;
  g = ctx.createLinearGradient(fx0, 0, fx1, 0);
  g.addColorStop(0, '#d9a45e'); g.addColorStop(0.18, '#ecc687'); g.addColorStop(0.5, '#f4d9a2'); g.addColorStop(0.82, '#ecc687'); g.addColorStop(1, '#d09a54');
  ctx.fillStyle = g; ctx.fillRect(fx0, fy0, fx1 - fx0, fy1 - fy0);
  ctx.save(); ctx.beginPath(); ctx.rect(fx0, fy0, fx1 - fx0, fy1 - fy0); ctx.clip();
  // long grain
  for (let i = 0; i < 140; i++) {
    const x = h01(i * 3.1) * TW, w = 0.4 + h01(i + 40) * 1.1;
    ctx.lineWidth = w;
    ctx.strokeStyle = h01(i + 7) > 0.45 ? `rgba(150,92,36,${0.05 + h01(i + 2) * 0.12})` : `rgba(255,244,214,${0.08 + h01(i + 5) * 0.14})`;
    ctx.beginPath(); ctx.moveTo(x, fy0);
    ctx.bezierCurveTo(x + 6 * (h01(i + 11) - 0.5), fy0 + 150, x + 8 * (h01(i + 12) - 0.5), fy0 + 330, x + 5 * (h01(i + 13) - 0.5), fy1); ctx.stroke();
  }
  // a couple of soft cathedral figures
  for (let i = 0; i < 4; i++) {
    const cx = 20 + h01(i + 70) * (TW - 40), cy = 60 + h01(i + 80) * (TL - 100);
    for (let k = 1; k <= 4; k++) { ctx.strokeStyle = `rgba(140,86,34,${0.05})`; ctx.lineWidth = 0.8; ctx.beginPath(); ctx.ellipse(cx, cy, 7 * k, 38 * k, 0, 0, TAU); ctx.stroke(); }
  }
  // lacquer sheen: a diagonal soft band
  const sh = ctx.createLinearGradient(fx0, fy0, fx1 + 60, fy0 + 260);
  sh.addColorStop(0, 'rgba(255,255,255,0.0)'); sh.addColorStop(0.45, 'rgba(255,255,255,0.12)'); sh.addColorStop(0.62, 'rgba(255,255,255,0.0)');
  ctx.fillStyle = sh; ctx.fillRect(fx0, fy0, fx1 - fx0, fy1 - fy0);
  // near end: a start line and a darker end rail
  ctx.strokeStyle = 'rgba(120,70,24,0.35)'; ctx.lineWidth = 1.2; ctx.setLineDash([5, 5]);
  ctx.beginPath(); ctx.moveTo(4, START_Y + R + 3); ctx.lineTo(TW - 4, START_Y + R + 3); ctx.stroke(); ctx.setLineDash([]);
  // inner shadow along the rails
  for (const [x0, dir] of [[0, 1], [TW, -1]]) {
    const rs = ctx.createLinearGradient(x0, 0, x0 + dir * 9, 0);
    rs.addColorStop(0, 'rgba(60,28,6,0.4)'); rs.addColorStop(1, 'rgba(60,28,6,0)');
    ctx.fillStyle = rs; ctx.fillRect(Math.min(x0, x0 + dir * 9), fy0, 9, fy1 - fy0);
  }
  ctx.restore();

  // compartments: shaded floors
  for (let k = 0; k < 4; k++) {
    const x0 = k * LANE_PITCH, cg = ctx.createLinearGradient(0, -D, 0, 0);
    cg.addColorStop(0, 'rgba(34,14,2,0.78)'); cg.addColorStop(0.55, 'rgba(60,28,6,0.5)'); cg.addColorStop(1, 'rgba(90,50,14,0.18)');
    ctx.fillStyle = cg; ctx.fillRect(x0, -D, AW, D);
  }
  // posts: raised blocks with a lit top
  for (let k = 0; k < 3; k++) {
    const p = postRect(k), pg = ctx.createLinearGradient(p.x0, 0, p.x1, 0);
    pg.addColorStop(0, '#f2cf93'); pg.addColorStop(0.5, '#e0b06a'); pg.addColorStop(1, '#a87436');
    rr(ctx, p.x0, p.y0 - 2, p.x1 - p.x0, p.y1 - p.y0 + 4, 3.2); ctx.fillStyle = pg; ctx.fill();
    ctx.strokeStyle = 'rgba(70,34,8,0.7)'; ctx.lineWidth = 0.9; ctx.stroke();
    ctx.fillStyle = 'rgba(255,255,255,0.35)'; ctx.fillRect(p.x0 + 1, p.y0 + 1, 1.4, p.y1 - p.y0 - 2);
    // the arch's mouth: a small round cap
    ctx.beginPath(); ctx.arc((p.x0 + p.x1) / 2, p.y1 + 0.5, (p.x1 - p.x0) / 2, 0, TAU); ctx.fillStyle = pg; ctx.fill(); ctx.stroke();
  }
  // the back board with the brass numbers
  g = ctx.createLinearGradient(0, WY0, 0, -D);
  g.addColorStop(0, '#7a4420'); g.addColorStop(0.5, '#a1642f'); g.addColorStop(1, '#6a3817');
  ctx.fillStyle = g; ctx.fillRect(0, WY0 + 5, TW, BAR - 5);
  ctx.strokeStyle = 'rgba(255,220,160,0.4)'; ctx.lineWidth = 1; ctx.strokeRect(0.5, WY0 + 5.5, TW - 1, BAR - 6);
  ctx.fillStyle = 'rgba(0,0,0,0.3)'; ctx.fillRect(0, -D - 2, TW, 2);
}

// main.js hands over a canvas factory (the game code itself never touches the DOM). Without one the board is painted each frame.
let makeCanvas = null, baked = null, bakeTried = false;
export const setCanvasFactory = (f) => { makeCanvas = f; };
function bake() {
  if (bakeTried || !makeCanvas) return baked;
  bakeTried = true;
  try {
    const c = makeCanvas(Math.ceil((WX1 - WX0) * PX), Math.ceil((WY1 - WY0) * PX));
    const x = c && c.getContext('2d');
    if (!x) return null;
    x.scale(PX, PX); x.translate(-WX0, -WY0);
    paintBoard(x);
    baked = c;
  } catch (e) { baked = null; }
  return baked;
}
export function drawBoardStill(ctx) {
  const c = bake();
  if (c) ctx.drawImage(c, WX0, WY0, WX1 - WX0, WY1 - WY0);
  else paintBoard(ctx);
}

// ---- discs ----------------------------------------------------------------------------------------------------------
// side 0: pale birch with a red centre; side 1: dark walnut with a gold centre.
const SKIN = [
  { hi: '#fff3d0', mid: '#f0d28a', lo: '#c99a4e', edge: '#7a4a1c', side: '#a8742f', dot: '#c93a2c', ring: 'rgba(122,74,28,0.55)' },
  { hi: '#8d5c3c', mid: '#5d3520', lo: '#3a1e0e', edge: '#1c0c04', side: '#2a1408', dot: '#f0b83c', ring: 'rgba(255,214,140,0.5)' },
];
export function drawDisc(ctx, x, y, side = 0, o = {}) {
  const k = SKIN[side] ?? SKIN[0], r = o.r ?? R, lift = o.lift ?? 0;
  const lx = LIGHT.x, ly = LIGHT.y;
  ctx.save();
  if (o.alpha !== undefined) ctx.globalAlpha = o.alpha;
  if (o.shadow !== false) {
    ctx.fillStyle = 'rgba(30,12,2,0.34)';
    ctx.beginPath(); ctx.arc(x + lx * (1.5 + lift), y + ly * (1.5 + lift), r * 1.02, 0, TAU); ctx.fill();
  }
  const cx = x - lx * lift * 0.6, cy = y - ly * lift * 0.6;
  // thickness
  ctx.fillStyle = k.side; ctx.beginPath(); ctx.arc(cx + lx * 0.75, cy + ly * 0.75, r, 0, TAU); ctx.fill();
  ctx.fillStyle = k.edge; ctx.beginPath(); ctx.arc(cx + lx * 0.35, cy + ly * 0.35, r + 0.35, 0, TAU); ctx.fill();
  const g = ctx.createRadialGradient(cx - lx * r * 0.35, cy - ly * r * 0.35, r * 0.1, cx, cy, r);
  g.addColorStop(0, k.hi); g.addColorStop(0.55, k.mid); g.addColorStop(1, k.lo);
  ctx.fillStyle = g; ctx.beginPath(); ctx.arc(cx, cy, r, 0, TAU); ctx.fill();
  // turned groove and the centre dot
  ctx.strokeStyle = k.ring; ctx.lineWidth = 0.9; ctx.beginPath(); ctx.arc(cx, cy, r * 0.68, 0, TAU); ctx.stroke();
  ctx.fillStyle = k.dot; ctx.beginPath(); ctx.arc(cx, cy, r * 0.2, 0, TAU); ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,0.5)'; ctx.beginPath(); ctx.arc(cx - lx * r * 0.42, cy - ly * r * 0.42, r * 0.13, 0, TAU); ctx.fill();
  if (o.ring) { ctx.strokeStyle = o.ring; ctx.lineWidth = 1.6; ctx.beginPath(); ctx.arc(cx, cy, r + 2.5, 0, TAU); ctx.stroke(); }
  ctx.restore();
}

// The pile of passed discs in arch k. `n` discs (the top ones drawn), `side` colour.
export function drawPile(ctx, k, n, side, t = 0) {
  if (n <= 0) return;
  const cx = laneX(k), cy = -D / 2 - 1, show = Math.min(n, 7);
  for (let i = 0; i < show; i++) {
    const w = (h01(k * 31 + i * 7) - 0.5) * 3.2, v = (h01(k * 17 + i * 5) - 0.5) * 2.4;
    drawDisc(ctx, cx + w - LIGHT.x * i * 0.55, cy + v - LIGHT.y * i * 0.55, side, { shadow: i === 0 || i === show - 1, lift: 0 });
  }
  void t;
}

// The brass plates: the arch values with the pile counts. `pulse[k]` (0..1) makes a plate glow when a disc has just passed.
export function drawPlates(ctx, counts, pulse) {
  for (let k = 0; k < 4; k++) {
    const x0 = k * LANE_PITCH + 3, w = AW - 6, y0 = WY0 + 9, h = BAR - 13;
    const g = ctx.createLinearGradient(0, y0, 0, y0 + h);
    g.addColorStop(0, '#f7e29a'); g.addColorStop(0.5, '#d9b04a'); g.addColorStop(1, '#a9822a');
    rr(ctx, x0, y0, w, h, 4); ctx.fillStyle = g; ctx.fill();
    ctx.strokeStyle = 'rgba(70,40,6,0.8)'; ctx.lineWidth = 0.9; ctx.stroke();
    const p = pulse ? pulse[k] : 0;
    if (p > 0) { rr(ctx, x0 - 1, y0 - 1, w + 2, h + 2, 5); ctx.strokeStyle = `rgba(255,255,255,${p})`; ctx.lineWidth = 2; ctx.stroke(); }
    ctx.save();
    ctx.translate(x0 + w / 2, y0 + h / 2 + 1);
    if (ROT) ctx.rotate(-Math.PI / 2);
    ctx.fillStyle = '#3a1f06'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    const has = counts && counts[k] > 0;
    ctx.font = `400 17px ${DISPLAY}`;
    ctx.fillText(String(ARCH_VALUES[k]), has && !ROT ? -7 : 0, has && ROT ? -5 : 0);
    if (has) { ctx.font = `700 9px ${UI}`; ctx.fillStyle = '#5a3208'; ctx.fillText(`×${counts[k]}`, ROT ? 0 : 11, ROT ? 8 : 0); }
    ctx.restore();
  }
}
