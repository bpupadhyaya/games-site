// Drawing of the board, the coins and the chalk tallies, all in world units (the caller applies the board transform).
// The still parts of the board (oak, slate, brass lines, slots) are baked once into an offscreen canvas (4 px per unit) and
// stamped each frame; the lamp light, coins and chalks are drawn live on top.
import { v3 } from './v3.js';
import { R, TW, BED_H, BEDS, BEDS_H, NEAR_Y, FAR_EDGE, LINE, WX0, WX1, WY0, WY1, CHALKS } from './sim.js';

const TAU = Math.PI * 2;
export const DISPLAY = "'Barlow Condensed', 'Avenir Next Condensed', 'Arial Narrow', 'Trebuchet MS', system-ui, sans-serif";
const UI = "'Avenir Next', 'Trebuchet MS', 'Segoe UI', Roboto, system-ui, sans-serif";
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

// Where the chalk slots are: side 0 in the left margin, side 1 in the right. k = bed (0 nearest), j = 0..2.
export const slotXY = (side, k, j) => ({ x: side === 0 ? -34 + j * 11 : TW + 12 + j * 11, y: (BEDS - 1 - k + 0.5) * BED_H });

// ---- the still board ------------------------------------------------------------------------------------------------
function paintBoard(ctx) {
  // oak surround: warm, dark, with long grain and a bevel
  let g = ctx.createLinearGradient(WX0, WY0, WX1, WY1);
  g.addColorStop(0, '#8a5628'); g.addColorStop(0.5, '#5a3317'); g.addColorStop(1, '#3a1f0c');
  rr(ctx, WX0, WY0, WX1 - WX0, WY1 - WY0, 16); ctx.fillStyle = g; ctx.fill();
  ctx.save(); rr(ctx, WX0, WY0, WX1 - WX0, WY1 - WY0, 16); ctx.clip();
  for (let i = 0; i < 90; i++) {
    const x = WX0 + h01(i) * (WX1 - WX0);
    ctx.lineWidth = 0.35 + h01(i + 4) * 0.8;
    ctx.strokeStyle = `rgba(${h01(i + 9) > 0.5 ? '255,196,130' : '20,8,2'},${0.05 + h01(i + 3) * 0.12})`;
    ctx.beginPath(); ctx.moveTo(x, WY0); ctx.bezierCurveTo(x + 6 * h01(i + 1), WY0 + 120, x - 7 * h01(i + 2), WY0 + 260, x + 3, WY1); ctx.stroke();
  }
  ctx.restore();
  ctx.lineWidth = 1.5; ctx.strokeStyle = 'rgba(255,208,140,0.5)'; rr(ctx, WX0 + 1, WY0 + 1, WX1 - WX0 - 2, WY1 - WY0 - 2, 15); ctx.stroke();
  ctx.lineWidth = 1; ctx.strokeStyle = 'rgba(10,4,0,0.55)'; rr(ctx, WX0 + 3.5, WY0 + 3.5, WX1 - WX0 - 7, WY1 - WY0 - 7, 13); ctx.stroke();

  // chalk margins: a darker inlaid strip for each side with the slots
  for (const [side, x0] of [[0, -40], [1, TW + 6]]) {
    const w = 34;
    const mg = ctx.createLinearGradient(x0, 0, x0 + w, 0);
    mg.addColorStop(0, 'rgba(14,6,0,0.55)'); mg.addColorStop(1, 'rgba(30,14,4,0.4)');
    rr(ctx, x0, FAR_EDGE, w, NEAR_Y - FAR_EDGE, 5); ctx.fillStyle = mg; ctx.fill();
    ctx.strokeStyle = 'rgba(255,208,140,0.28)'; ctx.lineWidth = 0.8; ctx.stroke();
    for (let k = 0; k < BEDS; k++) for (let j = 0; j < CHALKS; j++) {
      const s = slotXY(side, k, j);
      ctx.fillStyle = 'rgba(0,0,0,0.45)'; ctx.beginPath(); ctx.arc(s.x, s.y, 4.4, 0, TAU); ctx.fill();
      ctx.strokeStyle = 'rgba(255,220,170,0.28)'; ctx.lineWidth = 0.7; ctx.beginPath(); ctx.arc(s.x, s.y, 4.4, 0, TAU); ctx.stroke();
    }
  }

  // slate playfield
  const fx0 = 0, fx1 = TW, fy0 = FAR_EDGE, fy1 = NEAR_Y;
  // front edge thickness (the board edge seen from above)
  g = ctx.createLinearGradient(0, fy1, 0, fy1 + 9);
  g.addColorStop(0, '#6f7c88'); g.addColorStop(1, '#232a31');
  ctx.fillStyle = g; ctx.fillRect(fx0, fy1, fx1 - fx0, 9);
  g = ctx.createLinearGradient(0, fy0, 0, fy1);
  g.addColorStop(0, '#47525e'); g.addColorStop(0.5, '#38424d'); g.addColorStop(1, '#2d353e');
  ctx.fillStyle = g; ctx.fillRect(fx0, fy0, fx1 - fx0, fy1 - fy0);
  ctx.save(); ctx.beginPath(); ctx.rect(fx0, fy0, fx1 - fx0, fy1 - fy0); ctx.clip();
  // mottled slate: soft blotches and fine speckle, then a polish sheen
  for (let i = 0; i < 60; i++) {
    const cx = h01(i * 2.3) * TW, cy = fy0 + h01(i * 3.7 + 1) * (fy1 - fy0), r = 14 + h01(i + 30) * 40;
    const bl = ctx.createRadialGradient(cx, cy, 0, cx, cy, r);
    const lite = h01(i + 60) > 0.5;
    bl.addColorStop(0, lite ? 'rgba(130,150,170,0.10)' : 'rgba(10,16,24,0.14)'); bl.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = bl; ctx.fillRect(cx - r, cy - r, 2 * r, 2 * r);
  }
  for (let i = 0; i < 420; i++) {
    ctx.fillStyle = h01(i + 500) > 0.5 ? 'rgba(190,205,220,0.10)' : 'rgba(0,0,0,0.16)';
    ctx.fillRect(h01(i * 1.7) * TW, fy0 + h01(i * 2.9 + 4) * (fy1 - fy0), 0.7, 0.7);
  }
  // fine scratches from many games
  ctx.lineWidth = 0.35;
  for (let i = 0; i < 40; i++) {
    const x = h01(i + 900) * TW, y = fy0 + h01(i + 950) * (fy1 - fy0);
    ctx.strokeStyle = 'rgba(210,225,240,0.10)';
    ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + 3 + 20 * h01(i + 20) * (h01(i) > 0.5 ? 1 : -1), y - 26 * h01(i + 6)); ctx.stroke();
  }
  // bed numerals, faint, painted on the slate
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.font = `800 17px ${DISPLAY}`;
  for (let k = 0; k < BEDS; k++) {
    const y = (BEDS - 1 - k + 0.5) * BED_H;
    ctx.fillStyle = 'rgba(205,220,235,0.16)';
    ctx.fillText(String(k + 1), TW / 2, y + 1);
  }
  // the blank run: a brass start mark where the heel strikes
  ctx.strokeStyle = 'rgba(214,170,80,0.5)'; ctx.lineWidth = 1; ctx.setLineDash([2.5, 4]);
  ctx.beginPath(); ctx.moveTo(6, NEAR_Y - 1.5); ctx.lineTo(TW - 6, NEAR_Y - 1.5); ctx.stroke(); ctx.setLineDash([]);
  ctx.restore();

  // brass lines (inlaid): ten lines across, two edges along the sides
  for (let j = 0; j <= BEDS; j++) {
    const y = j * BED_H;
    const bg = ctx.createLinearGradient(0, y - LINE / 2, 0, y + LINE / 2);
    bg.addColorStop(0, '#f6dc8a'); bg.addColorStop(0.5, '#cfa23c'); bg.addColorStop(1, '#8d6a1c');
    ctx.fillStyle = bg; ctx.fillRect(0, y - LINE / 2, TW, LINE);
    ctx.fillStyle = 'rgba(0,0,0,0.35)'; ctx.fillRect(0, y + LINE / 2, TW, 0.8);
  }
  // board edge: a thin brass binding
  ctx.strokeStyle = '#b98a30'; ctx.lineWidth = 2; ctx.strokeRect(-1, fy0 - 1, TW + 2, fy1 - fy0 + 2);
  ctx.strokeStyle = 'rgba(255,240,180,0.55)'; ctx.lineWidth = 0.7; ctx.strokeRect(-1.8, fy0 - 1.8, TW + 3.6, fy1 - fy0 + 3.6);
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
export const bakedBoard = () => bake();
export function drawBoardStill(ctx) {
  const c = bake();
  if (c) ctx.drawImage(c, WX0, WY0, WX1 - WX0, WY1 - WY0);
  else paintBoard(ctx);
}

// The lamp: a warm pool of light on the slate that drifts a little as the lamp sways, plus a soft vignette. t in seconds.
export function drawLamp(ctx, t = 0) {
  const cx = TW * (0.5 + 0.07 * Math.sin(t * 0.37)), cy = BEDS_H * (0.42 + 0.05 * Math.cos(t * 0.29));
  ctx.save();
  ctx.beginPath(); ctx.rect(0, FAR_EDGE, TW, NEAR_Y - FAR_EDGE); ctx.clip();
  ctx.globalCompositeOperation = 'lighter';
  const g = ctx.createRadialGradient(cx, cy, 8, cx, cy, 190);
  g.addColorStop(0, 'rgba(255,205,130,0.20)'); g.addColorStop(0.5, 'rgba(255,170,90,0.08)'); g.addColorStop(1, 'rgba(255,150,70,0)');
  ctx.fillStyle = g; ctx.fillRect(0, FAR_EDGE, TW, NEAR_Y - FAR_EDGE);
  ctx.globalCompositeOperation = 'source-over';
  const v = ctx.createLinearGradient(0, FAR_EDGE, 0, NEAR_Y);
  v.addColorStop(0, 'rgba(0,0,0,0.22)'); v.addColorStop(0.3, 'rgba(0,0,0,0)'); v.addColorStop(0.8, 'rgba(0,0,0,0)'); v.addColorStop(1, 'rgba(0,0,0,0.2)');
  ctx.fillStyle = v; ctx.fillRect(0, FAR_EDGE, TW, NEAR_Y - FAR_EDGE);
  ctx.restore();
}

// ---- coins ------------------------------------------------------------------------------------------------------------------
// side 0: copper with a rosette; side 1: silver with a ring of beads. Both are original generic coins (no real currency).
const SKIN = [
  { hi: '#ffd9a8', mid: '#d98f55', lo: '#8a4220', edge: '#4a1f0a', side: '#6b3012', fine: 'rgba(70,28,8,0.6)', lite: 'rgba(255,225,185,0.55)', chalk: '#ffb36b' },
  { hi: '#ffffff', mid: '#cfd8e0', lo: '#7d8a97', edge: '#34404c', side: '#56626e', fine: 'rgba(40,52,64,0.6)', lite: 'rgba(255,255,255,0.7)', chalk: '#d6ecff' },
];
export const chalkColor = (side) => SKIN[side].chalk;
export function drawCoin(ctx, x, y, side = 0, o = {}) {
  const k = SKIN[side] ?? SKIN[0], r = o.r ?? R, lift = o.lift ?? 0;
  const lx = LIGHT.x, ly = LIGHT.y;
  ctx.save();
  if (o.alpha !== undefined) ctx.globalAlpha = o.alpha;
  const spr = v3.coinSprite[side];
  if (spr) {
    // the 3D coin, baked once by the presenter: the same pennies in the menu art, the HUD cards and the Rules illustrations
    if (o.shadow !== false) { ctx.fillStyle = 'rgba(0,0,0,0.38)'; ctx.beginPath(); ctx.arc(x + lx * (0.9 + lift), y + ly * (0.9 + lift), r * 1.02, 0, TAU); ctx.fill(); }
    const sz = r * 2 / 0.86;
    ctx.drawImage(spr, x - sz / 2 - lx * lift * 0.5, y - sz / 2 - ly * lift * 0.5, sz, sz);
    if (o.ring) { ctx.strokeStyle = o.ring; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.arc(x - lx * lift * 0.5, y - ly * lift * 0.5, r + 2.4, 0, TAU); ctx.stroke(); }
    ctx.restore();
    return;
  }
  if (o.shadow !== false) {
    ctx.fillStyle = 'rgba(0,0,0,0.38)';
    ctx.beginPath(); ctx.arc(x + lx * (0.9 + lift), y + ly * (0.9 + lift), r * 1.02, 0, TAU); ctx.fill();
  }
  const cx = x - lx * lift * 0.5, cy = y - ly * lift * 0.5;
  ctx.fillStyle = k.side; ctx.beginPath(); ctx.arc(cx + lx * 0.5, cy + ly * 0.5, r, 0, TAU); ctx.fill();
  ctx.fillStyle = k.edge; ctx.beginPath(); ctx.arc(cx + lx * 0.22, cy + ly * 0.22, r + 0.3, 0, TAU); ctx.fill();
  const g = ctx.createRadialGradient(cx - lx * r * 0.35, cy - ly * r * 0.35, r * 0.1, cx, cy, r);
  g.addColorStop(0, k.hi); g.addColorStop(0.55, k.mid); g.addColorStop(1, k.lo);
  ctx.fillStyle = g; ctx.beginPath(); ctx.arc(cx, cy, r, 0, TAU); ctx.fill();
  // raised rim
  ctx.strokeStyle = k.fine; ctx.lineWidth = r * 0.07; ctx.beginPath(); ctx.arc(cx, cy, r * 0.86, 0, TAU); ctx.stroke();
  ctx.strokeStyle = k.lite; ctx.lineWidth = r * 0.05; ctx.beginPath(); ctx.arc(cx - lx * 0.2, cy - ly * 0.2, r * 0.92, Math.PI * 0.9, Math.PI * 1.6); ctx.stroke();
  if (side === 0) {
    // rosette: eight petals
    ctx.strokeStyle = k.fine; ctx.lineWidth = r * 0.08;
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * TAU;
      ctx.beginPath(); ctx.ellipse(cx + Math.cos(a) * r * 0.36, cy + Math.sin(a) * r * 0.36, r * 0.24, r * 0.12, a, 0, TAU); ctx.stroke();
    }
    ctx.fillStyle = k.lite; ctx.beginPath(); ctx.arc(cx, cy, r * 0.13, 0, TAU); ctx.fill();
  } else {
    // ring of beads and a six-point star
    ctx.fillStyle = k.fine;
    for (let i = 0; i < 12; i++) { const a = (i / 12) * TAU; ctx.beginPath(); ctx.arc(cx + Math.cos(a) * r * 0.7, cy + Math.sin(a) * r * 0.7, r * 0.065, 0, TAU); ctx.fill(); }
    ctx.strokeStyle = k.fine; ctx.lineWidth = r * 0.08; ctx.beginPath();
    for (let i = 0; i < 6; i++) { const a = (i / 6) * TAU - Math.PI / 2, a2 = a + TAU / 12; ctx.lineTo(cx + Math.cos(a) * r * 0.46, cy + Math.sin(a) * r * 0.46); ctx.lineTo(cx + Math.cos(a2) * r * 0.2, cy + Math.sin(a2) * r * 0.2); }
    ctx.closePath(); ctx.stroke();
  }
  ctx.fillStyle = 'rgba(255,255,255,0.5)'; ctx.beginPath(); ctx.arc(cx - lx * r * 0.42, cy - ly * r * 0.42, r * 0.12, 0, TAU); ctx.fill();
  if (o.ring) { ctx.strokeStyle = o.ring; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.arc(cx, cy, r + 2.4, 0, TAU); ctx.stroke(); }
  ctx.restore();
}

// Chalk slots filled so far: chalks[side][bed]. `pulse[side][bed]` (0..1) glows a slot that has just been won. A filled bed
// lights its whole strip in the side's colour.
export function drawChalks(ctx, chalks, pulse, sides = 2) {
  for (let side = 0; side < sides; side++) {
    for (let k = 0; k < BEDS; k++) {
      const n = Math.min(CHALKS, chalks[side][k]), full = n >= CHALKS;
      if (full) {
        const s0 = slotXY(side, k, 0), s2 = slotXY(side, k, 2);
        rr(ctx, s0.x - 7, s0.y - 9, s2.x - s0.x + 14, 18, 6);
        ctx.fillStyle = side === 0 ? 'rgba(255,150,70,0.30)' : 'rgba(180,225,255,0.30)'; ctx.fill();
        ctx.strokeStyle = side === 0 ? 'rgba(255,190,120,0.85)' : 'rgba(210,240,255,0.9)'; ctx.lineWidth = 0.9; ctx.stroke();
      }
      for (let j = 0; j < n; j++) {
        const s = slotXY(side, k, j), p = pulse && pulse[side] ? pulse[side][k] : 0;
        const live = p > 0 && j === n - 1;
        drawCoin(ctx, s.x, s.y, side, { r: 4 + (live ? 1.4 * p : 0), shadow: false });
        if (live) { ctx.strokeStyle = `rgba(255,255,255,${p})`; ctx.lineWidth = 1.2; ctx.beginPath(); ctx.arc(s.x, s.y, 7 + 5 * (1 - p), 0, TAU); ctx.stroke(); }
      }
    }
  }
}
void UI; void ROT; void NEAR_Y;
