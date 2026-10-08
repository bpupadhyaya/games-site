// The sailing screen furniture drawn in 2D over the 3D sea: top bar, chart, compass dial, sheet slider, action buttons, decision card, star-sight panel.
import { DEG, clamp, lerp, smooth, wrap180, wrap360, bearingOf, compassName, MON3 } from './core.js';
import { PAL, FONT, SANS, rr, textFill, wrapLines, glow } from './art.js';
import { drawButton, drawPill, panel, inRect } from './ui.js';
import { LY } from './layout.js';
import { edgeStroke } from './brand.js';
import { KN, errRadius, idealTrim, idealAngle, sheetAngle, frame as simFrame, canSight, isNight, todOf, COAST_HALF, SIGHT_R, HARBOUR_R, upcomingSquall, calmLevel, squallLevel } from './sim.js';
import { LEVELS, PORTS, PORT_IDX, SEASONS } from './data.js';

const txt = (n) => Math.max(n, LY.minText);
export function fitFont(ctx, text, size, maxW, weight = 600, family = SANS, minSize = null) {
  const lo = minSize ?? Math.min(size, LY.minText);
  let sz = size; ctx.font = `${weight} ${sz}px ${family}`;
  while (sz > lo && ctx.measureText(text).width > maxW) { sz -= 1; ctx.font = `${weight} ${sz}px ${family}`; }
  return sz;
}
const gradTitle = [[0, '#fff6cf'], [0.6, '#ffd05c'], [1, '#f0a02a']];
export const bar = (ctx, x, y, w, h, f, col, back = 'rgba(255,255,255,0.14)') => { rr(ctx, x, y, w, h, h / 2); ctx.fillStyle = back; ctx.fill(); if (f > 0.01) { rr(ctx, x, y, Math.max(h, w * clamp(f, 0, 1)), h, h / 2); ctx.fillStyle = col; ctx.fill(); } };

// ---- top bar ------------------------------------------------------------------------------------------------------------------------------------
export function drawHud(ctx, state, V, zs) {
  const hud = LY.hud, from = PORTS[PORT_IDX[V.from]].name, to = PORTS[PORT_IDX[V.to]].name;
  panel(ctx, { x: hud.x, y: hud.y, w: hud.w, h: hud.h }, { radius: 22, top: 'rgba(8,36,54,0.88)', bottom: 'rgba(5,24,38,0.88)' });
  edgeStroke(ctx, { x: hud.x, y: hud.y, w: hud.w, h: hud.h }, 22, 0.5);
  const pad = 18, mw = hud.textMaxW, compact = hud.h < 100;
  ctx.textBaseline = 'alphabetic';
  const lab = `${from} to ${to}  ·  ${SEASONS[V.season].short}`;
  const f1 = fitFont(ctx, lab, txt(20) * zs, mw, 600); ctx.font = `600 ${f1}px ${SANS}`; ctx.fillStyle = 'rgba(190,240,240,0.95)'; ctx.textAlign = 'left'; ctx.fillText(lab, hud.x + pad, hud.y + 8 + f1);
  const kn = V.ship.v * KN, big = (compact ? Math.min(56, hud.h * 0.42) : clamp(hud.h - 10 - 30 * Math.min(zs, 1.3) - 26 - 16, 30, 56)) * Math.min(zs, 1.15);
  const by = compact ? hud.y + hud.h - 14 : hud.y + 10 + f1 * 1.2 + big * 0.84;
  textFill(ctx, kn.toFixed(1), hud.x + pad, by, big, { align: 'left', grad: gradTitle, stroke: 'rgba(4,24,40,0.55)' });
  ctx.font = `700 ${big}px ${FONT}`; const sw = ctx.measureText(kn.toFixed(1)).width;
  const toGo = Math.max(0, Math.hypot(V.D.x - V.est.x, V.D.y - V.est.y));
  const wk = Math.round(V.wind.speed * KN), tg = Math.round(toGo), room = mw - sw - 20;
  const cands = [`kn    wind ${wk} kn    ${V.landfall ? 'to go' : 'est. to go'} ${tg} m`, `kn   wind ${wk} kn   ${tg} m to go`, `kn  wind ${wk}  ${tg} m`, `kn  ${tg} m`];
  ctx.font = `600 ${txt(18)}px ${SANS}`; const info = cands.find((c) => ctx.measureText(c).width <= room) ?? cands[cands.length - 1];
  const f2 = fitFont(ctx, info, txt(20) * zs, room, 600); ctx.font = `600 ${f2}px ${SANS}`; ctx.fillStyle = '#fff3da'; ctx.textAlign = 'left'; ctx.fillText(info, hud.x + pad + sw + 10, by);
  if (!compact) {
    // hull, sail and water meters
    const mx = hud.x + pad, my = hud.y + hud.h - 12, mwid = Math.min(150 * Math.min(zs, 1.2), (mw - 2 * 16) / 3);
    const items = [['Hull', V.hull / 100, V.hull < 40 ? PAL.coral : '#7fd17f'], ['Sail', V.sail / 100, V.sail < 40 ? PAL.coral : '#e9d9a8'], ['Water', Math.min(1, V.water), V.water < 0.25 ? PAL.coral : '#5ec6f2']];
    ctx.font = `600 ${txt(16)}px ${SANS}`;
    items.forEach(([n, f, c], i) => { const x = mx + i * (mwid + 16); ctx.fillStyle = 'rgba(210,240,240,0.9)'; ctx.textAlign = 'left'; ctx.fillText(n, x, my - 10); bar(ctx, x + ctx.measureText(n).width + 8, my - 22, mwid - ctx.measureText(n).width - 8, 10, f, c); });
  }
  drawPill(ctx, LY.pause, state.paused ? '▶' : 'II', { size: 28 });
  drawPill(ctx, LY.think, '?', { size: 32, disabled: state.scene === 'auto' || (V.phase !== 'sail') || state.hints <= 0 });
  drawPill(ctx, LY.camBtn, '', { size: 24 });
  { const c = LY.camBtn, x = c.x + c.w / 2, y = c.y + c.h / 2, r = Math.min(c.w, c.h) * 0.2; ctx.save(); ctx.strokeStyle = '#fff'; ctx.lineWidth = 3; ctx.fillStyle = '#fff'; rr(ctx, x - r * 1.5, y - r * 0.95, r * 3, r * 1.9, 5); ctx.stroke(); ctx.beginPath(); ctx.arc(x, y, r * 0.55, 0, 7); ctx.fill(); ctx.fillRect(x - r * 0.9, y - r * 1.25, r * 0.7, r * 0.3); ctx.restore(); }
  ctx.font = `700 ${txt(14)}px ${SANS}`; ctx.fillStyle = 'rgba(255,255,255,0.88)'; ctx.textAlign = 'center'; ctx.fillText(String(state.hints), LY.think.x + LY.think.w - 8, LY.think.y + LY.think.h + 14);
}

// ---- chart -----------------------------------------------------------------------------------------------------------------------------------------------
export function drawChart(ctx, state, V) {
  const C = LY.chart, m = 12;
  panel(ctx, C, { radius: 18, top: 'rgba(8,44,66,0.9)', bottom: 'rgba(5,30,48,0.9)' });
  ctx.save(); rr(ctx, C.x, C.y, C.w, C.h, 18); ctx.clip();
  // fit the voyage into the panel
  const pts = [[0, 0], [V.D.x, V.D.y], [V.ship.x, V.ship.y], [V.est.x, V.est.y]];
  let x0 = Math.min(...pts.map((p) => p[0])), x1 = Math.max(...pts.map((p) => p[0])), y0 = Math.min(...pts.map((p) => p[1])), y1 = Math.max(...pts.map((p) => p[1]));
  const padm = 140; x0 -= padm; x1 += padm; y0 -= padm; y1 += padm;
  const iw = C.w - 2 * m, ih = C.h - 2 * m - 18, sc = Math.min(iw / (x1 - x0), ih / (y1 - y0));
  const ox = C.x + m + (iw - (x1 - x0) * sc) / 2, oy = C.y + m + 14 + (ih - (y1 - y0) * sc) / 2;
  const P = (x, y) => [ox + (x - x0) * sc, oy + (y1 - y) * sc];
  // grid
  ctx.strokeStyle = 'rgba(150,230,235,0.1)'; ctx.lineWidth = 1;
  for (let gx = Math.ceil(x0 / 200) * 200; gx < x1; gx += 200) { const [px] = P(gx, 0); ctx.beginPath(); ctx.moveTo(px, C.y); ctx.lineTo(px, C.y + C.h); ctx.stroke(); }
  for (let gy = Math.ceil(y0 / 200) * 200; gy < y1; gy += 200) { const [, py] = P(0, gy); ctx.beginPath(); ctx.moveTo(C.x, py); ctx.lineTo(C.x + C.w, py); ctx.stroke(); }
  // the coast beyond the harbour
  const b = V.bearing, dx = Math.sin(b * DEG), dy = Math.cos(b * DEG), px = Math.cos(b * DEG), py = -Math.sin(b * DEG);
  const cA = P(V.D.x + px * COAST_HALF, V.D.y + py * COAST_HALF), cB = P(V.D.x - px * COAST_HALF, V.D.y - py * COAST_HALF), cA2 = P(V.D.x + px * COAST_HALF + dx * 900, V.D.y + py * COAST_HALF + dy * 900), cB2 = P(V.D.x - px * COAST_HALF + dx * 900, V.D.y - py * COAST_HALF + dy * 900);
  ctx.fillStyle = 'rgba(206,180,120,0.55)'; ctx.beginPath(); ctx.moveTo(...cA); ctx.lineTo(...cB); ctx.lineTo(...cB2); ctx.lineTo(...cA2); ctx.closePath(); ctx.fill();
  ctx.strokeStyle = 'rgba(255,236,180,0.8)'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(...cA); ctx.lineTo(...cB); ctx.stroke();
  const o = P(0, 0), d = P(V.D.x, V.D.y);
  ctx.strokeStyle = 'rgba(79,224,204,0.55)'; ctx.setLineDash([6, 6]); ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(...o); ctx.lineTo(...d); ctx.stroke(); ctx.setLineDash([]);
  // reefs you have seen
  for (const h of V.hazards) if (h.k === 'reef' && h.seen) { const [rx, ry] = P(h.x, h.y); ctx.fillStyle = 'rgba(255,110,90,0.9)'; ctx.beginPath(); ctx.arc(rx, ry, Math.max(4, h.r * sc), 0, 7); ctx.fill(); ctx.strokeStyle = 'rgba(255,230,220,0.9)'; ctx.lineWidth = 1.5; ctx.stroke(); }
  // where you have been (estimated) and where you think you are
  const tr = state.v.trail;
  if (tr.length > 1) { ctx.strokeStyle = 'rgba(255,255,255,0.45)'; ctx.lineWidth = 2; ctx.beginPath(); tr.forEach((p, i) => { const [qx, qy] = P(p[0], p[1]); if (i) ctx.lineTo(qx, qy); else ctx.moveTo(qx, qy); }); ctx.stroke(); }
  const [ex, ey] = P(V.est.x, V.est.y), er = Math.max(9, errRadius(V) * sc);
  ctx.fillStyle = 'rgba(255,208,92,0.14)'; ctx.beginPath(); ctx.arc(ex, ey, er, 0, 7); ctx.fill();
  ctx.strokeStyle = 'rgba(255,208,92,0.75)'; ctx.setLineDash([4, 5]); ctx.lineWidth = 2; ctx.stroke(); ctx.setLineDash([]);
  ctx.save(); ctx.translate(ex, ey); ctx.rotate(V.ship.h * DEG); ctx.fillStyle = '#fff7df'; ctx.strokeStyle = 'rgba(10,30,40,0.9)'; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.moveTo(0, -9); ctx.lineTo(6, 8); ctx.lineTo(0, 4); ctx.lineTo(-6, 8); ctx.closePath(); ctx.fill(); ctx.stroke(); ctx.restore();
  // ports
  ctx.fillStyle = '#ffd05c'; ctx.beginPath(); ctx.arc(o[0], o[1], 5, 0, 7); ctx.fill(); ctx.beginPath(); ctx.arc(d[0], d[1], 6, 0, 7); ctx.fill();
  ctx.restore();
  ctx.font = `700 ${txt(15)}px ${SANS}`; ctx.fillStyle = 'rgba(220,245,245,0.92)'; ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic';
  ctx.fillText(V.landfall ? 'CHART  (land in sight)' : 'CHART  (estimated position)', C.x + 12, C.y + 20);
  ctx.textAlign = 'right'; ctx.fillText('N ↑', C.x + C.w - 12, C.y + 20);
  edgeStroke(ctx, C, 18, 0.3);
}

// ---- compass dial (steering) ---------------------------------------------------------------------------------------------------------------------
const polar = (cx, cy, a, r) => [cx + Math.sin(a * DEG) * r, cy - Math.cos(a * DEG) * r];
export function drawDial(ctx, state, V) {
  const D = LY.dial, { cx, cy, r: R } = D, sh = V.ship, wf = V.wind.from;
  ctx.save();
  // ring
  ctx.shadowColor = 'rgba(0,10,20,0.6)'; ctx.shadowBlur = 16; ctx.shadowOffsetY = 5;
  let g = ctx.createRadialGradient(cx, cy - R * 0.2, R * 0.2, cx, cy, R); g.addColorStop(0, '#12476a'); g.addColorStop(1, '#0a2438');
  ctx.beginPath(); ctx.arc(cx, cy, R, 0, 7); ctx.fillStyle = g; ctx.fill(); ctx.shadowColor = 'transparent'; ctx.shadowBlur = 0; ctx.shadowOffsetY = 0;
  const rg = ctx.createLinearGradient(cx - R, cy - R, cx + R, cy + R); rg.addColorStop(0, '#d9a45a'); rg.addColorStop(0.5, '#8c5a2b'); rg.addColorStop(1, '#c58f48');
  ctx.lineWidth = Math.max(10, R * 0.08); ctx.strokeStyle = rg; ctx.beginPath(); ctx.arc(cx, cy, R - ctx.lineWidth / 2, 0, 7); ctx.stroke();
  const ri = R - Math.max(10, R * 0.08) - 2;
  // no-sail wedge around the wind direction (the lateen cannot sail inside it)
  ctx.beginPath(); ctx.moveTo(cx, cy); ctx.arc(cx, cy, ri, (wf - 34 - 90) * DEG, (wf + 34 - 90) * DEG); ctx.closePath(); ctx.fillStyle = 'rgba(235,80,70,0.26)'; ctx.fill();
  ctx.strokeStyle = 'rgba(255,150,130,0.55)'; ctx.lineWidth = 1.5; ctx.stroke();
  // ticks
  for (let a = 0; a < 360; a += 10) {
    const major = a % 30 === 0, [x1, y1] = polar(cx, cy, a, ri), [x2, y2] = polar(cx, cy, a, ri - (major ? R * 0.1 : R * 0.05));
    ctx.strokeStyle = major ? 'rgba(255,240,200,0.85)' : 'rgba(200,235,240,0.4)'; ctx.lineWidth = major ? 2.2 : 1.2; ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke();
  }
  ctx.font = `700 ${Math.max(16, R * 0.11)}px ${SANS}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  for (const [a, s, c] of [[0, 'N', '#ff8f7a'], [90, 'E', '#e8f6f8'], [180, 'S', '#e8f6f8'], [270, 'W', '#e8f6f8']]) { const [x, y] = polar(cx, cy, a, ri - R * 0.2); ctx.fillStyle = c; ctx.fillText(s, x, y); }
  // wind arrow: it flies in from where the wind comes
  { const [ax, ay] = polar(cx, cy, wf, ri - 2), [bx, by] = polar(cx, cy, wf, ri * 0.52);
    ctx.strokeStyle = 'rgba(255,255,255,0.95)'; ctx.lineWidth = 4; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(ax, ay); ctx.lineTo(bx, by); ctx.stroke();
    const hx = bx - (bx - ax) * 0.0, hy = by;
    ctx.save(); ctx.translate(hx, hy); ctx.rotate((wf + 180) * DEG); ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.moveTo(0, -R * 0.1); ctx.lineTo(R * 0.065, R * 0.03); ctx.lineTo(-R * 0.065, R * 0.03); ctx.closePath(); ctx.fill(); ctx.restore();
    const [lx, ly] = polar(cx, cy, wf, ri * 0.74); ctx.font = `700 ${Math.max(16, R * 0.085)}px ${SANS}`; ctx.fillStyle = '#fff'; ctx.strokeStyle = 'rgba(0,30,50,0.8)'; ctx.lineWidth = 4; ctx.lineJoin = 'round';
    const lab = `${Math.round(V.wind.speed * KN)} kn`; ctx.strokeText(lab, lx + 0, ly + R * 0.1); ctx.fillText(lab, lx, ly + R * 0.1); }
  // the port (from your estimated position), with the width of your doubt
  { const brg = bearingOf(V.D.x - V.est.x, V.D.y - V.est.y), dist = Math.hypot(V.D.x - V.est.x, V.D.y - V.est.y), half = clamp(Math.atan2(errRadius(V), Math.max(40, dist)) / DEG, 3, 60);
    ctx.beginPath(); ctx.arc(cx, cy, ri - 2, (brg - half - 90) * DEG, (brg + half - 90) * DEG); ctx.strokeStyle = 'rgba(79,224,204,0.55)'; ctx.lineWidth = 8; ctx.lineCap = 'butt'; ctx.stroke();
    const [fx, fy] = polar(cx, cy, brg, ri - R * 0.17); ctx.fillStyle = PAL.teal; ctx.strokeStyle = 'rgba(0,40,40,0.8)'; ctx.lineWidth = 2;
    ctx.save(); ctx.translate(fx, fy); ctx.rotate(brg * DEG); ctx.beginPath(); ctx.moveTo(0, -R * 0.09); ctx.lineTo(R * 0.07, R * 0.05); ctx.lineTo(-R * 0.07, R * 0.05); ctx.closePath(); ctx.fill(); ctx.stroke(); ctx.restore(); }
  // chosen heading
  { const [tx, ty] = polar(cx, cy, V.ctl.target, ri - 2); ctx.strokeStyle = PAL.gold; ctx.lineWidth = 3; ctx.setLineDash([3, 7]); ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(tx, ty); ctx.stroke(); ctx.setLineDash([]);
    ctx.fillStyle = PAL.gold; ctx.strokeStyle = 'rgba(40,20,0,0.8)'; ctx.lineWidth = 2; ctx.save(); ctx.translate(tx, ty); ctx.rotate(V.ctl.target * DEG); ctx.beginPath(); ctx.moveTo(0, R * 0.01); ctx.lineTo(R * 0.08, -R * 0.1); ctx.lineTo(-R * 0.08, -R * 0.1); ctx.closePath(); ctx.fill(); ctx.stroke(); ctx.restore(); }
  // the dhow itself, pointing the way she heads
  ctx.save(); ctx.translate(cx, cy); ctx.rotate(sh.h * DEG); const k = R * 0.0125;
  ctx.fillStyle = '#c99a5a'; ctx.strokeStyle = 'rgba(30,14,4,0.9)'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(0, -26 * k); ctx.quadraticCurveTo(10 * k, -6 * k, 8 * k, 14 * k); ctx.lineTo(5 * k, 24 * k); ctx.lineTo(-5 * k, 24 * k); ctx.lineTo(-8 * k, 14 * k); ctx.quadraticCurveTo(-10 * k, -6 * k, 0, -26 * k); ctx.closePath(); ctx.fill(); ctx.stroke();
  // the sail: a line from the mast, swung to the lee side
  ctx.strokeStyle = sh.flap > 0.5 ? '#ffb15a' : sh.stall > 0.5 ? '#8fc4ff' : '#ffffff'; ctx.lineWidth = Math.max(4, k * 2.2); ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(0, -3 * k); const sa = sh.side * sh.sailAng * DEG; ctx.lineTo(Math.sin(sa) * 24 * k, Math.cos(sa) * 24 * k); ctx.stroke();
  ctx.restore();
  // readout
  ctx.font = `700 ${Math.max(18, R * 0.12)}px ${SANS}`; ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic'; ctx.fillStyle = '#fff3da'; ctx.strokeStyle = 'rgba(0,20,36,0.85)'; ctx.lineWidth = 4;
  const hd = `${String(Math.round(sh.h) % 360).padStart(3, '0')}°`; ctx.strokeText(hd, cx, cy + R * 0.62); ctx.fillText(hd, cx, cy + R * 0.62);
  ctx.restore();
}

// ---- sheet slider (sail trim) ------------------------------------------------------------------------------------------------------------------------
export function sailWord(sh) { return sh.dip > 0 ? 'Dipping the yard' : sh.beta < 36 ? 'In irons' : sh.flap > 0.35 ? 'Luffing: sheet in' : sh.stall > 0.35 ? 'Stalled: ease out' : sh.eff > 0.8 ? 'Full and drawing' : 'Almost'; }
export function sailColor(sh) { return sh.dip > 0 ? '#ffd05c' : sh.beta < 36 ? '#ff8f7a' : sh.flap > 0.35 ? '#ffb15a' : sh.stall > 0.35 ? '#8fc4ff' : sh.eff > 0.8 ? '#7fe3a0' : '#e9e9c0'; }
export function drawSheet(ctx, state, V) {
  const S = LY.sheet, sh = V.ship, Lv = LEVELS[V.level];
  const trackX = S.x + S.w / 2 - 14, trackW = 28, y0 = S.y + 44, y1 = S.y + S.h - 36, hgt = y1 - y0;
  panel(ctx, S, { radius: 22, top: 'rgba(8,36,54,0.82)', bottom: 'rgba(5,24,38,0.82)' });
  edgeStroke(ctx, S, 22, 0.35);
  ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic'; ctx.font = `700 ${txt(15)}px ${SANS}`; ctx.fillStyle = 'rgba(210,244,244,0.92)';
  ctx.fillText('SHEET', S.x + S.w / 2, S.y + 22);
  ctx.font = `600 ${txt(14)}px ${SANS}`; ctx.fillText('out', S.x + S.w / 2, S.y + 40); ctx.fillText('in', S.x + S.w / 2, S.y + S.h - 12);
  rr(ctx, trackX, y0, trackW, hgt, trackW / 2); const tg = ctx.createLinearGradient(0, y0, 0, y1); tg.addColorStop(0, '#1b6c85'); tg.addColorStop(1, '#0c3348'); ctx.fillStyle = tg; ctx.fill();
  ctx.strokeStyle = 'rgba(150,235,235,0.5)'; ctx.lineWidth = 2; ctx.stroke();
  const yOf = (u) => y1 - u * hgt;
  if (Lv.hint && !sh.dip && V.phase === 'sail') {
    const u0 = idealTrim(sh.beta), half = (Lv.trimW * 0.55) / 84, a = yOf(clamp(u0 + half, 0, 1)), b = yOf(clamp(u0 - half, 0, 1));
    rr(ctx, trackX - 8, a, trackW + 16, Math.max(8, b - a), 10); ctx.fillStyle = 'rgba(79,224,204,0.35)'; ctx.fill(); ctx.strokeStyle = 'rgba(160,255,240,0.8)'; ctx.lineWidth = 2; ctx.stroke();
  }
  const ty = yOf(V.ctl.trim), pressed = state.touch.mode === 'sheet';
  ctx.shadowColor = 'rgba(0,10,20,0.55)'; ctx.shadowBlur = 8; ctx.shadowOffsetY = 3;
  const kg = ctx.createLinearGradient(0, ty - 20, 0, ty + 20); kg.addColorStop(0, '#ffe08a'); kg.addColorStop(1, '#e09a2c');
  rr(ctx, S.x + 10, ty - 20, S.w - 20, 40, 14); ctx.fillStyle = kg; ctx.fill(); ctx.shadowColor = 'transparent'; ctx.shadowBlur = 0; ctx.shadowOffsetY = 0;
  ctx.strokeStyle = pressed ? '#fff' : 'rgba(80,40,0,0.7)'; ctx.lineWidth = 2; ctx.stroke();
  ctx.fillStyle = 'rgba(70,35,0,0.85)'; ctx.font = `700 ${txt(16)}px ${SANS}`; ctx.textBaseline = 'middle'; ctx.fillText(`${Math.round(sh.sailAng)}°`, S.x + S.w / 2, ty + 1);
  ctx.textBaseline = 'alphabetic';
}
export function drawSailStatus(ctx, state, V) {
  const sh = V.ship, S = LY.sheet, w = sailWord(sh);
  ctx.font = `700 ${txt(18)}px ${SANS}`; const tw = ctx.measureText(w).width + 28, x = S.x + S.w - tw, y = S.y - 0;
  void x; void y;
  // a status chip next to the dial, always readable
  const D = LY.dial, cx = clamp(D.cx, LY.U.x0 + tw / 2 + 8, LY.U.x1 - tw / 2 - 8), y2 = LY.reef.y - 26;
  ctx.fillStyle = 'rgba(6,26,40,0.82)'; rr(ctx, cx - tw / 2, y2 - 20, tw, 36, 18); ctx.fill(); ctx.strokeStyle = sailColor(sh); ctx.lineWidth = 2; ctx.stroke();
  ctx.fillStyle = sailColor(sh); ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(w, cx, y2); ctx.textBaseline = 'alphabetic';
  void V; void state;
}

// ---- action buttons ----------------------------------------------------------------------------------------------------------------------------------
export function drawActions(ctx, state, V) {
  const night = isNight(todOf(V)), can = canSight(V);
  drawButton(ctx, LY.reef, V.ctl.reef ? 'Shake' : 'Reef', { size: 22, active: !!V.ctl.reef, disabled: V.phase !== 'sail' });
  drawButton(ctx, LY.sight, 'Sight', { size: 22, primary: can, disabled: !can, sub: night ? undefined : 'night' });
  drawButton(ctx, LY.sweeps, 'Sweeps', { size: 20, active: V.ctl.sweeps, disabled: V.phase !== 'sail' || V.wind.speed > 6.5 });
}

// ---- decision card --------------------------------------------------------------------------------------------------------------------------------------
export function decisionSpec(V) {
  const d = V.decision; if (!d) return null;
  if (d.type === 'squall') return { title: 'Squall ahead!', text: 'A dark wall of rain and wind is coming. What do you do?', opts: [['reef', 'Reef the sail'], ['run', 'Run before it'], ['press', 'Press on']], left: Math.max(0, d.until - V.t), total: 9 };
  if (d.type === 'calm') return { title: 'Becalmed', text: 'The wind has died. The sails hang slack.', opts: [['sweeps', 'Take the sweeps'], ['wait', 'Wait for the breeze']], left: null };
  if (d.type === 'help') return { title: 'A dhow in need', text: 'A small dhow signals: their water is gone. Share ours?', opts: [['help', 'Share water'], ['pass', 'Sail on']], left: Math.max(0, d.until - V.t), total: 9 };
  return null;
}
export function decisionRects(spec) {
  const C = LY.card, n = spec.opts.length, g = 10, bh = Math.max(72, LY.tap + 12), w = C.w;
  const stack = n === 3 && w < 520;
  const textLines = 3, h = 62 + textLines * 30 + (stack ? n * (bh + g) : bh + g) + 12;
  const y = C.bottom - h, out = [];
  if (stack) spec.opts.forEach((o, i) => out.push({ id: o[0], label: o[1], rect: { x: C.x + 14, y: y + h - 12 - (n - i) * (bh + g) + g, w: w - 28, h: bh } }));
  else { const bw = (w - 28 - g * (n - 1)) / n; spec.opts.forEach((o, i) => out.push({ id: o[0], label: o[1], rect: { x: C.x + 14 + i * (bw + g), y: y + h - 12 - bh, w: bw, h: bh } })); }
  return { box: { x: C.x, y, w, h }, opts: out };
}
export function drawDecision(ctx, state, V) {
  const spec = decisionSpec(V); if (!spec) return;
  const { box, opts } = decisionRects(spec);
  panel(ctx, box, { radius: 24, top: 'rgba(10,40,60,0.95)', bottom: 'rgba(6,26,40,0.95)' }); edgeStroke(ctx, box, 24, 0.6);
  textFill(ctx, spec.title, box.x + 20, box.y + 44, txt(34), { align: 'left', grad: gradTitle, stroke: 'rgba(4,24,40,0.6)' });
  if (spec.left != null) { const f = clamp(spec.left / spec.total, 0, 1); bar(ctx, box.x + box.w - 170, box.y + 24, 150, 12, f, f < 0.3 ? PAL.coral : PAL.teal); }
  ctx.font = `500 ${txt(21)}px ${SANS}`; ctx.fillStyle = '#fff3da'; ctx.textAlign = 'left'; const lines = wrapLines(ctx, spec.text, box.w - 40);
  let y = box.y + 78; for (const l of lines.slice(0, 2)) { ctx.fillText(l, box.x + 20, y); y += 28; }
  for (const o of opts) drawButton(ctx, o.rect, o.label, { size: 24, primary: o.id === 'reef' || o.id === 'help' || o.id === 'sweeps' });
}

// ---- star sight panel (the kamal) ---------------------------------------------------------------------------------------------------------------
export function sightRect() { return LY.sightPanel; }
export function drawSight(ctx, state, V) {
  const sg = V.sight; if (!sg) return;
  const P = LY.sightPanel;
  panel(ctx, P, { radius: 24, top: 'rgba(8,24,52,0.94)', bottom: 'rgba(5,14,36,0.95)' }); edgeStroke(ctx, P, 24, 0.7);
  textFill(ctx, 'Star sight with the kamal', P.x + P.w / 2, P.y + 40, txt(30), { grad: [[0, '#e8f0ff'], [1, '#8fb4ff']], stroke: 'rgba(0,10,40,0.6)' });
  ctx.font = `500 ${txt(19)}px ${SANS}`; ctx.fillStyle = 'rgba(230,240,255,0.92)'; ctx.textAlign = 'center';
  ctx.fillText(sg.done ? (sg.q == null ? 'The star slipped away.' : sg.q > 0.75 ? 'A fine sight! Your latitude is sure.' : sg.q > 0.35 ? 'A fair sight.' : 'A poor sight.') : 'Tap when the star meets the edge of the card.', P.x + P.w / 2, P.y + 72);
  // the card and the horizon
  const gx = P.x + 28, gw = P.w - 56, gy = P.y + 98, gh = 70;
  rr(ctx, gx, gy, gw, gh, 14); ctx.fillStyle = 'rgba(2,10,28,0.85)'; ctx.fill(); ctx.strokeStyle = 'rgba(140,180,255,0.5)'; ctx.lineWidth = 2; ctx.stroke();
  const win = 0.5 + 0.1 * V.crew.navigator + (V.level === 0 ? 0.12 : V.level === 2 ? -0.06 : 0);
  const mid = gx + gw / 2, ww = gw / 2 * clamp(win, 0.2, 1) * 0.6;
  rr(ctx, mid - ww, gy + 6, ww * 2, gh - 12, 10); ctx.fillStyle = 'rgba(79,224,204,0.25)'; ctx.fill();
  rr(ctx, mid - ww * 0.18, gy + 6, ww * 0.36, gh - 12, 8); ctx.fillStyle = 'rgba(160,255,230,0.4)'; ctx.fill();
  ctx.strokeStyle = 'rgba(255,240,200,0.9)'; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(mid, gy + 2); ctx.lineTo(mid, gy + gh - 2); ctx.stroke();
  if (!sg.done) { const sx = mid + clamp(sg.m, -1.1, 1.1) * (gw / 2 - 20); glow(ctx, sx, gy + gh / 2, 34, 'rgba(200,225,255,A)', 0.8); ctx.fillStyle = '#fff'; ctx.beginPath(); for (let i = 0; i < 10; i++) { const a = -Math.PI / 2 + i * Math.PI / 5, rad = i % 2 ? 6 : 14; ctx.lineTo(sx + Math.cos(a) * rad, gy + gh / 2 + Math.sin(a) * rad); } ctx.closePath(); ctx.fill(); }
  else if (sg.q != null) { bar(ctx, gx, gy + gh + 14, gw, 14, sg.q, sg.q > 0.75 ? '#7fe3a0' : sg.q > 0.35 ? '#ffd05c' : PAL.coral); }
  if (!sg.done) drawButton(ctx, { x: gx, y: gy + gh + 16, w: gw, h: Math.max(56, LY.tap) }, 'NOW', { primary: true, size: 30 });
}
export function sightButtonRect() { const P = LY.sightPanel; return { x: P.x + 28, y: P.y + 98 + 70 + 16, w: P.w - 56, h: Math.max(56, LY.tap) }; }
void lerp; void smooth; void wrap180; void wrap360; void compassName; void MON3; void idealAngle; void sheetAngle; void simFrame; void SIGHT_R; void HARBOUR_R; void upcomingSquall; void calmLevel; void squallLevel; void inRect;
