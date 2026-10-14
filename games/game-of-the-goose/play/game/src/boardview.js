// Drawing the sheet with its spiral of 63 spaces; also used small in the Rules figures and the title screen.
import { FINAL, ROADS, kindOf } from './engine.js';
import { SPOT, TILE_W, TILE_H, GARDEN_R } from './board.js';
import { PAL, DISPLAY, UI, drawSheet, drawTile, drawPicture, drawGarden, drawFlag, drawGoose } from './art.js';
import { v3 } from './v3.js';

const TAU = Math.PI * 2;

// Where space n is, in screen units, for a board drawn in `rect`.
export function frameOf(rect) {
  return { cx: rect.x + rect.w / 2, cy: rect.y + rect.h / 2, R: rect.w * 0.455, w: rect.w };
}
export const spotXY = (f, n) => ({ x: f.cx + SPOT[n].x * f.R, y: f.cy + SPOT[n].y * f.R });
export const tileSize = (f) => ({ tw: TILE_W * f.R, th: TILE_H * f.R });

function roadCurve(f, from, to) {
  const a = spotXY(f, from), b = spotXY(f, to);
  const mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2;
  let dx = b.x - a.x, dy = b.y - a.y;
  const len = Math.hypot(dx, dy) || 1;
  // bulge away from the centre of the board so the road arcs over the spaces between
  let nx = -dy / len, ny = dx / len;
  if ((mx - f.cx) * nx + (my - f.cy) * ny < 0) { nx = -nx; ny = -ny; }
  return { a, b, cx: mx + nx * len * 0.32, cy: my + ny * len * 0.32 };
}

// opts: { roads: bool, hi: [{ n, color, strong }], t: seconds (for gentle motion), mini: bool, numbers: bool, activeRoad: from-space or null,
//         flap: 0..1 }
export function drawBoard(ctx, rect, o = {}) {
  const f = frameOf(rect), { tw, th } = tileSize(f), mini = !!o.mini;
  const base = !!o.base;                     // 3D: the painted board plate only (sheet, cartouche, garden, start), drawn once to a texture
  const live3 = v3.on && !base;              // 3D live: spaces/pictures/pawns are 3D meshes; the 2D layer only adds the numbers
  if (live3) {
    const ts3 = Math.min(tw, th);
    for (let n = 1; n < FINAL; n++) {
      const kind = kindOf(n), big = kind === 'plain' || (kind === 'road' && !o.roads);
      if (o.noNumbers || mini) break;
      const q = v3.sq ? v3.sq(n, big ? 0 : -0.27, big ? 0 : -0.3) : null;
      if (!q) continue;
      const fs = q.k * 0.75 * (big ? 0.42 : 0.28);
      ctx.save(); ctx.textBaseline = 'middle'; ctx.textAlign = 'center'; ctx.font = `700 ${fs}px ${DISPLAY}`;
      ctx.lineJoin = 'round'; ctx.lineWidth = fs * 0.22; ctx.strokeStyle = 'rgba(250,240,208,0.85)'; ctx.strokeText(String(n), q.x, q.y);
      ctx.fillStyle = kind === 'skeleton' || kind === 'prison' ? PAL.oxblood : PAL.ink; ctx.fillText(String(n), q.x, q.y);
      ctx.restore();
    }
    void ts3;
    return f;
  }
  if (!o.noSheet) drawSheet(ctx, rect, 3);
  // corner furniture: title cartouche and a few engraved ornaments
  if (!mini && !o.bare) {
    const m = rect.w * 0.045, fs = rect.w * 0.034;
    ctx.save(); ctx.fillStyle = PAL.ink; ctx.textBaseline = 'middle';
    ctx.font = `700 ${fs}px ${DISPLAY}`; ctx.textAlign = 'left';
    ctx.fillText('GAME OF', rect.x + m + 6, rect.y + m + fs * 0.9);
    ctx.fillText('THE GOOSE', rect.x + m + 6, rect.y + m + fs * 2.2);
    ctx.font = `700 ${fs * 0.62}px ${UI}`; ctx.fillStyle = PAL.sepia;
    ctx.fillText("il gioco dell'oca", rect.x + m + 6, rect.y + m + fs * 3.3);
    ctx.textAlign = 'right'; ctx.font = `700 ${fs * 0.8}px ${DISPLAY}`; ctx.fillStyle = PAL.ink;
    ctx.fillText('63', rect.x + rect.w - m - 6, rect.y + rect.h - m - fs * 1.9);
    ctx.font = `700 ${fs * 0.62}px ${UI}`; ctx.fillStyle = PAL.sepia;
    ctx.fillText('exactly', rect.x + rect.w - m - 6, rect.y + rect.h - m - fs * 0.9);
    ctx.restore();
    // compass-like star top right, a goose at bottom left
    const sx = rect.x + rect.w - m - rect.w * 0.07, sy = rect.y + m + rect.w * 0.07, sr = rect.w * 0.055;
    ctx.save(); ctx.strokeStyle = PAL.ink; ctx.lineWidth = 1.4; ctx.beginPath();
    for (let i = 0; i < 8; i++) { const a = (i / 8) * TAU, r = i % 2 ? sr * 0.55 : sr; ctx.moveTo(sx, sy); ctx.lineTo(sx + Math.cos(a) * r, sy + Math.sin(a) * r); }
    ctx.stroke(); ctx.beginPath(); ctx.arc(sx, sy, sr * 0.3, 0, TAU); ctx.stroke(); ctx.restore();
    drawGoose(ctx, rect.x + m + rect.w * 0.07, rect.y + rect.h - m - rect.w * 0.07, rect.w * 0.045, { flip: 1, flap: o.flap ?? 0 });
  }
  // garden disc (the finish)
  ctx.save();
  const gx = f.cx, gy = f.cy, gr = GARDEN_R * f.R;
  const gg = ctx.createRadialGradient(gx, gy, gr * 0.1, gx, gy, gr);
  gg.addColorStop(0, '#f1f1c8'); gg.addColorStop(1, '#bcd88e');
  ctx.fillStyle = gg; ctx.beginPath(); ctx.arc(gx, gy, gr, 0, TAU); ctx.fill();
  ctx.strokeStyle = PAL.ink; ctx.lineWidth = Math.max(1.5, f.R * 0.012); ctx.stroke();
  ctx.restore();
  drawGarden(ctx, gx, gy, gr * 0.9, o.t ?? 0, base);

  // the spaces 1..62
  if (base) {
    const p0 = spotXY(f, 0), ts0 = Math.min(tw, th);
    ctx.save(); ctx.translate(p0.x, p0.y);
    ctx.fillStyle = 'rgba(250,240,208,0.5)'; ctx.beginPath(); ctx.arc(0, 0, ts0 * 0.46, 0, TAU); ctx.fill();
    ctx.strokeStyle = PAL.ink; ctx.lineWidth = 1.5; ctx.setLineDash([4, 4]); ctx.stroke(); ctx.setLineDash([]);
    ctx.font = `700 ${ts0 * 0.2}px ${DISPLAY}`; ctx.textAlign = 'center'; ctx.fillStyle = PAL.ink; ctx.fillText('START', 0, ts0 * 0.62);
    ctx.restore();
    return f;
  }
  const ts = Math.min(tw, th);
  for (let n = 1; n < FINAL; n++) {
    const p = spotXY(f, n), kind = kindOf(n);
    drawTile(ctx, n, p.x, p.y, tw, th, SPOT[n].ang, kind);
  }
  // pictures and numbers on top (upright)
  for (let n = 1; n < FINAL; n++) {
    const p = spotXY(f, n), kind = kindOf(n);
    const drawKind = kind === 'road' && !o.roads ? 'plain' : kind;
    if (drawKind !== 'plain') drawPicture(ctx, drawKind, p.x, p.y + ts * 0.04, ts * 0.5, { flap: o.flap ?? 0 });
    if (!o.noNumbers && !mini) {
      ctx.save();
      ctx.textBaseline = 'middle'; ctx.textAlign = 'center';
      const big = drawKind === 'plain';
      const fs = ts * (big ? 0.42 : 0.28);
      ctx.font = `700 ${fs}px ${DISPLAY}`;
      const nx = big ? p.x : p.x - ts * 0.27, ny = big ? p.y : p.y - ts * 0.3;
      ctx.lineJoin = 'round'; ctx.lineWidth = fs * 0.22; ctx.strokeStyle = 'rgba(250,240,208,0.85)'; ctx.strokeText(String(n), nx, ny);
      ctx.fillStyle = drawKind === 'skeleton' || drawKind === 'prison' ? PAL.oxblood : PAL.ink; ctx.fillText(String(n), nx, ny);
      ctx.restore();
    }
  }
  // start marker
  {
    const p = spotXY(f, 0);
    if (!mini) {
      ctx.save(); ctx.translate(p.x, p.y);
      ctx.fillStyle = 'rgba(250,240,208,0.5)'; ctx.beginPath(); ctx.arc(0, 0, ts * 0.46, 0, TAU); ctx.fill();
      ctx.strokeStyle = PAL.ink; ctx.lineWidth = 1.5; ctx.setLineDash([4, 4]); ctx.stroke(); ctx.setLineDash([]);
      ctx.restore();
      drawFlag(ctx, p.x, p.y - ts * 0.04, ts * 0.34);
      ctx.save(); ctx.font = `700 ${ts * 0.2}px ${DISPLAY}`; ctx.textAlign = 'center'; ctx.fillStyle = PAL.ink; ctx.fillText('START', p.x, p.y + ts * 0.62); ctx.restore();
    }
  }
  // roads (variant)
  if (o.roads) {
    for (const r of ROADS) {
      const c = roadCurve(f, r.from, r.to), act = o.activeRoad === r.from;
      ctx.save();
      ctx.lineCap = 'round';
      ctx.globalAlpha = act ? 1 : 0.6; ctx.strokeStyle = 'rgba(250,240,208,0.9)'; ctx.lineWidth = ts * (act ? 0.2 : 0.12);
      ctx.beginPath(); ctx.moveTo(c.a.x, c.a.y); ctx.quadraticCurveTo(c.cx, c.cy, c.b.x, c.b.y); ctx.stroke();
      ctx.strokeStyle = act ? PAL.oxblood : PAL.sepia; ctx.lineWidth = ts * (act ? 0.11 : 0.06); ctx.setLineDash([ts * 0.2, ts * 0.14]);
      ctx.beginPath(); ctx.moveTo(c.a.x, c.a.y); ctx.quadraticCurveTo(c.cx, c.cy, c.b.x, c.b.y); ctx.stroke(); ctx.setLineDash([]);
      // arrowhead at the destination
      const tx = c.b.x - c.cx, ty = c.b.y - c.cy, tl = Math.hypot(tx, ty) || 1, ux = tx / tl, uy = ty / tl, hs = ts * 0.2;
      ctx.fillStyle = act ? PAL.oxblood : PAL.sepia; ctx.beginPath();
      ctx.moveTo(c.b.x - ux * hs * 0.2, c.b.y - uy * hs * 0.2);
      ctx.lineTo(c.b.x - ux * hs * 1.4 - uy * hs * 0.75, c.b.y - uy * hs * 1.4 + ux * hs * 0.75);
      ctx.lineTo(c.b.x - ux * hs * 1.4 + uy * hs * 0.75, c.b.y - uy * hs * 1.4 - ux * hs * 0.75);
      ctx.closePath(); ctx.fill();
      ctx.restore();
    }
    // signposts again on top of the road start so they stay readable
    for (const r of ROADS) { const p = spotXY(f, r.from); drawPicture(ctx, 'road', p.x, p.y + ts * 0.04, ts * 0.5); }
  }
  // highlights
  if (o.hi) {
    const t = o.t ?? 0;
    for (const h of o.hi) {
      const p = spotXY(f, h.n === FINAL ? 1 : h.n);
      const pulse = 0.5 + 0.5 * Math.sin(t * 6 + h.n);
      ctx.save(); ctx.strokeStyle = h.color ?? PAL.goldHi; ctx.lineWidth = ts * (h.strong ? 0.14 : 0.09);
      ctx.globalAlpha = 0.65 + 0.35 * pulse; ctx.shadowColor = h.color ?? PAL.goldHi; ctx.shadowBlur = ts * 0.4;
      ctx.beginPath();
      if (h.n === FINAL) ctx.arc(f.cx, f.cy, GARDEN_R * f.R * 1.02, 0, TAU);
      else ctx.arc(p.x, p.y, ts * (0.52 + 0.04 * pulse), 0, TAU);
      ctx.stroke(); ctx.restore();
    }
  }
  return f;
}
