// The carved stone board: geometry helpers and the painter. Pieces and highlights are drawn by view.js using these positions.
import { PAL, SEAT, rr, TAU, drawGlyph } from './art.js';
import { v3 } from './v3.js';
import { GRID, LOOP, HOME, SPINE_FROM, LOOP_XY, SPINE_XY, QUARTER, isEntry, isTrap, isBoost, loopIdx } from './engine.js';

// Frame of a board drawn into a square rect: cell size and origin.
export function frameOf(rect) {
  const side = Math.min(rect.w, rect.h), cell = (side * 0.94) / GRID;
  const ox = rect.x + (rect.w - side) / 2 + side * 0.03, oy = rect.y + (rect.h - side) / 2 + side * 0.03;
  return { x: ox, y: oy, cell, side, rx: rect.x + (rect.w - side) / 2, ry: rect.y + (rect.h - side) / 2 };
}
export const cellXY = (f, gx, gy) => ({ x: f.x + (gx + 0.5) * f.cell, y: f.y + (gy + 0.5) * f.cell });
export const loopXY = (f, idx) => cellXY(f, LOOP_XY[idx][0], LOOP_XY[idx][1]);
export const spineXY = (f, arm, k) => cellXY(f, SPINE_XY[arm][k][0], SPINE_XY[arm][k][1]);
export const centreXY = (f) => (v3.on && v3.cell ? v3.cell(4.5, 4.5, 0.3) : cellXY(f, 4, 4));

// The 3 x 3 corner block that holds an arm's pit and home counters: arm 0 top right, 1 bottom right, 2 bottom left, 3 top left.
const TRAY_CELL = [[6, 0], [6, 6], [0, 6], [0, 0]];
export function trayRect(f, arm) {
  const [gx, gy] = TRAY_CELL[arm];
  return { x: f.x + gx * f.cell + f.cell * 0.08, y: f.y + gy * f.cell + f.cell * 0.08, w: f.cell * 2.84, h: f.cell * 2.84 };
}
export function pitXY(f, arm, j) {
  const T = trayRect(f, arm), c = j % 3, r = Math.floor(j / 3);
  return { x: T.x + (c + 0.5) * T.w / 3, y: T.y + T.h * 0.2 + (r + 0.5) * T.h * 0.3 };
}
export function homeXY(f, arm, j) {
  const T = trayRect(f, arm);
  return { x: T.x + (j + 0.5) * T.w / 6, y: T.y + T.h * 0.9 };
}

function tile(ctx, x, y, s, base, hi, lo, rad) {
  ctx.fillStyle = lo; rr(ctx, x, y + s * 0.04, s, s, rad); ctx.fill();
  const g = ctx.createLinearGradient(x, y, x + s, y + s);
  g.addColorStop(0, hi); g.addColorStop(0.55, base); g.addColorStop(1, lo);
  ctx.fillStyle = g; rr(ctx, x, y, s, s * 0.96, rad); ctx.fill();
  ctx.lineWidth = Math.max(1, s * 0.025); ctx.strokeStyle = 'rgba(60,35,15,0.55)'; rr(ctx, x, y, s, s * 0.96, rad); ctx.stroke();
}

// o: { armSeat: [seat|null x4] (which seat sits at each arm), mini }
export function drawBoard(ctx, rect, o = {}) {
  const f = frameOf(rect), c = f.cell, S = f.side;
  const armSeat = o.armSeat ?? [0, 1, 2, 3];
  // slab
  ctx.save();
  ctx.shadowColor = 'rgba(0,0,0,0.55)'; ctx.shadowBlur = S * 0.04; ctx.shadowOffsetY = S * 0.014;
  const sg = ctx.createLinearGradient(f.rx, f.ry, f.rx + S, f.ry + S);
  sg.addColorStop(0, PAL.clayHi); sg.addColorStop(0.5, PAL.clay); sg.addColorStop(1, PAL.clayDark);
  ctx.fillStyle = sg; rr(ctx, f.rx, f.ry, S, S, S * 0.045); ctx.fill();
  ctx.restore();
  ctx.lineWidth = Math.max(2, S * 0.006); ctx.strokeStyle = 'rgba(20,10,4,0.7)'; rr(ctx, f.rx, f.ry, S, S, S * 0.045); ctx.stroke();
  // pit trays in the four corners
  for (let arm = 0; arm < 4; arm++) {
    const T = trayRect(f, arm), seat = armSeat[arm], col = seat == null ? null : SEAT[seat % 4];
    ctx.fillStyle = 'rgba(25,13,6,0.62)'; rr(ctx, T.x, T.y, T.w, T.h, c * 0.18); ctx.fill();
    ctx.lineWidth = Math.max(2, c * 0.05); ctx.strokeStyle = col ? col.base : 'rgba(255,255,255,0.12)'; rr(ctx, T.x, T.y, T.w, T.h, c * 0.18); ctx.stroke();
    ctx.fillStyle = 'rgba(0,0,0,0.35)';
    for (let j = 0; j < 6; j++) {
      const p = pitXY(f, arm, j);
      ctx.beginPath(); ctx.ellipse(p.x, p.y + c * 0.04, c * 0.36, c * 0.3, 0, 0, TAU); ctx.fill();
    }
    ctx.fillStyle = 'rgba(0,0,0,0.3)'; rr(ctx, T.x + c * 0.1, T.y + T.h * 0.8, T.w - c * 0.2, T.h * 0.17, c * 0.1); ctx.fill();
  }
  // the cross: plate, then squares
  ctx.fillStyle = PAL.clayDark;
  const pad = c * 0.07;
  rr(ctx, f.x + 3 * c - pad, f.y - pad, 3 * c + pad * 2, GRID * c + pad * 2, c * 0.14); ctx.fill();
  rr(ctx, f.x - pad, f.y + 3 * c - pad, GRID * c + pad * 2, 3 * c + pad * 2, c * 0.14); ctx.fill();
  const inset = c * 0.04, s = c - inset * 2;
  const cellAt = (gx, gy) => ({ x: f.x + gx * c + inset, y: f.y + gy * c + inset });
  const loopSet = new Map();
  LOOP_XY.forEach(([gx, gy], i) => loopSet.set(gx * 16 + gy, i));
  for (let gy = 0; gy < GRID; gy++) {
    for (let gx = 0; gx < GRID; gx++) {
      const inPlus = (gx >= 3 && gx <= 5) || (gy >= 3 && gy <= 5);
      if (!inPlus) continue;
      const p = cellAt(gx, gy), li = loopSet.get(gx * 16 + gy);
      if (li !== undefined) {
        const arm = Math.floor(li / QUARTER), entry = isEntry(li);
        const seat = armSeat[arm];
        if (entry && seat != null) { const k = SEAT[seat % 4]; tile(ctx, p.x, p.y, s, k.base, k.hi, k.lo, c * 0.12); }
        else tile(ctx, p.x, p.y, s, PAL.stone, PAL.stoneHi, PAL.stoneLo, c * 0.12);
      } else {
        // centre cross and the four spines: a darker, colour-washed stone
        const spineArm = SPINE_XY.findIndex((sp) => sp.some(([x, y]) => x === gx && y === gy));
        const k = spineArm >= 0 && armSeat[spineArm] != null ? SEAT[armSeat[spineArm] % 4] : null;
        tile(ctx, p.x, p.y, s, k ? k.base : '#9d7a4b', k ? k.hi : '#c4a26f', k ? k.lo : '#6d4f2b', c * 0.12);
        if (k) { ctx.fillStyle = 'rgba(244,236,216,0.38)'; rr(ctx, p.x + s * 0.12, p.y + s * 0.12, s * 0.76, s * 0.7, c * 0.08); ctx.fill(); }
      }
    }
  }
  // direction chevrons on the loop
  if (!o.mini) {
    ctx.save(); ctx.strokeStyle = 'rgba(75,45,20,0.4)'; ctx.lineWidth = Math.max(1.5, c * 0.05); ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    LOOP_XY.forEach((_, i) => {
      if (isEntry(i) || isTrap(i) || isBoost(i)) return;
      const a = loopXY(f, i), b = loopXY(f, (i + 1) % LOOP_XY.length);
      const dx = Math.sign(b.x - a.x), dy = Math.sign(b.y - a.y), L = c * 0.13;
      ctx.beginPath();
      if (dx) { ctx.moveTo(a.x - dx * L, a.y - L); ctx.lineTo(a.x + dx * L, a.y); ctx.lineTo(a.x - dx * L, a.y + L); }
      else { ctx.moveTo(a.x - L, a.y - dy * L); ctx.lineTo(a.x, a.y + dy * L); ctx.lineTo(a.x + L, a.y - dy * L); }
      ctx.stroke();
    });
    ctx.restore();
  }
  // special squares
  LOOP_XY.forEach((_, i) => {
    const p = loopXY(f, i);
    if (isTrap(i)) drawGlyph(ctx, 'trap', p.x, p.y, c * 0.4);
    else if (isBoost(i)) drawGlyph(ctx, 'boost', p.x, p.y, c * 0.36);
  });
  // the centre: concentric stepped squares
  const m = cellXY(f, 4, 4);
  for (let k = 3; k >= 1; k--) {
    const w = c * (0.1 + 0.12 * k);
    ctx.fillStyle = k % 2 ? '#f0dcae' : '#2b1a0d'; rr(ctx, m.x - w, m.y - w, w * 2, w * 2, c * 0.05); ctx.fill();
  }
  ctx.fillStyle = PAL.gold; rr(ctx, m.x - c * 0.12, m.y - c * 0.12, c * 0.24, c * 0.24, c * 0.03); ctx.fill();
  return f;
}

// Where a piece with progress p of an arm stands (piece number j picks its pit / home slot). Flat (2D) position in frame f.
function piecePosFlat(f, arm, j, p) {
  if (p <= 0) return pitXY(f, arm, j);
  if (p <= LOOP) return loopXY(f, loopIdx(arm, p));
  if (p < HOME) return spineXY(f, arm, p - SPINE_FROM);
  return homeXY(f, arm, j);
}
// Position in grid units (cell centres at k + 0.5, board 0..9): the same place seen from above. The 3D presenter uses this.
const F0 = { x: 0, y: 0, cell: 1 };
export const pieceUV = (arm, j, p) => piecePosFlat(F0, arm, j, p);
export const centreUV = { x: 4.5, y: 4.5 };
// With the 3D scene on, positions are projected through the live camera (the mid-height of a standing piece), so hit-testing,
// number tags and pop-ups follow what the player sees; otherwise they are the flat board positions.
export function piecePos(f, arm, j, p) {
  const q = piecePosFlat(f, arm, j, p);
  if (v3.on && v3.cell) return v3.cell((q.x - f.x) / f.cell, (q.y - f.y) / f.cell, p >= HOME ? 0.12 : 0.3);
  return q;
}
