// The in-play screen on the 2D canvas: top strip, the take-off / landing ring, the angle and level gauges, the gate / result / standings cards, the
// Watch & Learn panel and the flat fallback picture used when WebGL is missing. Pure drawing from game state; game.js owns state.
import { SW, H, host, minU, hudLayout, PLAY_M } from './layout.js';
import { FONT, roundPath, drawButton, panel, wrapLines, fitPx } from './ui.js';
import { hillById, GATES, groundY, inrunAt } from './hills.js';
import { ZONE, levelById } from './jump.js';
import { MEDALS } from './sim.js';

const TAU = Math.PI * 2, RAD = Math.PI / 180;
export const CARD = { rect: null, max: 0, view: 0 };
let RECTS = [];                         // clickable overlay buttons of this frame: { id, x, y, w, h }
export const hit = (x, y) => { for (let i = RECTS.length - 1; i >= 0; i--) { const r = RECTS[i]; if (x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h) return r.id; } return null; };
const addRect = (id, r) => { RECTS.push({ id, x: r.x, y: r.y, w: r.w, h: r.h }); return r; };

const ink = '#eef3f7';
const gold = '#f2c14e', ice = '#8fd3e6', coral = '#ff8f7a', moss = '#58c28f';
const font = (px, w = 700) => `${w} ${Math.max(Math.round(px), minU())}px ${FONT}`;
const clamp = (x, a, b) => Math.max(a, Math.min(b, x));

function chip(ctx, x, y, w, h, fill = 'rgba(10,20,32,0.74)', edge = 'rgba(238,243,247,0.22)') {
  roundPath(ctx, x, y, w, h, Math.min(18, h / 2)); ctx.fillStyle = fill; ctx.fill(); ctx.lineWidth = 1.5; ctx.strokeStyle = edge; ctx.stroke();
}
export const windText = (w) => `${Math.abs(w.head).toFixed(1)} m/s ${w.head >= 0 ? 'head' : 'tail'}  ·  ${Math.abs(w.cross).toFixed(1)} cross`;

// ---------------------------------------------------------------------------------------------------------------------------------
export function renderHud(ctx, G, v) {
  RECTS = [];
  const s = G.sim; if (!s) return;
  const M = PLAY_M[G.settings.textIdx];
  const L = hudLayout(G.settings.textIdx);
  G.lay = L;
  const watch = G.mode === 'watch';
  drawTop(ctx, G, s, L, M);
  if (!watch) drawPauseThink(ctx, G, L, s.ph === 'gate' || s.ph === 'run');
  if (s.ph === 'gate') drawGate(ctx, G, s, L, M, watch);
  else if (s.ph === 'run') { drawInfo(ctx, G, s, L, M); drawControls(ctx, G, s, L, M, watch); }
  else if (s.ph === 'judge') { if (s.replay) drawReplayBadge(ctx, G, s, L); else drawResult(ctx, G, s, L, M, watch); }
  else if (s.ph === 'board') drawBoard(ctx, G, s, L, M, watch);
  if (watch) drawWatch(ctx, G, s, L, M);
  else if (G.think) drawThink(ctx, G, s, L, M);
  drawFeedback(ctx, G, s, L, M);
}

function drawTop(ctx, G, s, L, M) {
  const t = L.top, hill = hillById(s.hill);
  chip(ctx, t.x, t.y, t.w, t.h);
  ctx.textBaseline = 'middle';
  const pad = 16, mid = t.y + t.h / 2, two = t.h > 70;
  const fsA = fitPx(ctx, hill.name, 700, 30 * Math.min(M, 1.4), t.w * (L.land ? 0.4 : 0.52) - pad, 13);
  ctx.font = font(fsA); ctx.fillStyle = gold; ctx.textAlign = 'left';
  ctx.fillText(hill.name, t.x + pad, mid - (two ? 14 : 8));
  ctx.font = font(Math.max(15, fsA * 0.72), 500); ctx.fillStyle = 'rgba(238,243,247,0.82)';
  const rnd = s.mode === 'practice' ? `Practice  ·  K ${hill.k}` : `Round ${Math.min(s.round + 1, s.rounds)} of ${s.rounds}  ·  K ${hill.k}`;
  ctx.fillText(rnd, t.x + pad, mid + (two ? 16 : 14));
  ctx.textAlign = 'right';
  ctx.font = font(Math.max(15, fsA * 0.72), 500); ctx.fillStyle = 'rgba(238,243,247,0.82)';
  ctx.fillText(s.mode === 'practice' ? 'Last jump' : 'Total points', t.x + t.w - pad, mid + (two ? 16 : 14));
  ctx.font = font(fsA * 1.15); ctx.fillStyle = ink;
  const val = s.mode === 'practice' ? (s.you.jumps.length ? s.you.jumps[s.you.jumps.length - 1].pts.toFixed(1) : '-') : s.you.total.toFixed(1);
  ctx.fillText(val, t.x + t.w - pad, mid - (two ? 14 : 8));
  ctx.textBaseline = 'alphabetic';
}

function drawPauseThink(ctx, G, L, withThink = true) {
  drawButton(ctx, addRect('pause', L.pause), 'Pause', { dark: true, size: Math.round(L.uh * 0.4) });
  if (withThink) drawButton(ctx, addRect('think', L.think), 'Think', { dark: true, size: Math.round(L.uh * 0.4) });
}

// speed, distance so far, wind
function drawInfo(ctx, G, s, L, M) {
  const j = s.jump; if (!j) return;
  const f = L.info; const w = f.w * Math.min(1.25, M);
  const hill = hillById(s.hill);
  const km = j.ph === 'ready' ? 0 : (j.ph === 'slide' ? j.v : Math.hypot(j.vx, j.vy)) * 3.6;
  const px = Math.max(16, 21 * Math.min(M, 1.3));
  chip(ctx, f.x, f.y, w, px * 3.9);
  ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
  ctx.font = font(px * 1.5); ctx.fillStyle = ink;
  const dist = j.ph === 'air' || j.ph === 'land' || j.ph === 'done' ? `${(j.x * 1.06).toFixed(0)} m` : `K ${hill.k}`;
  ctx.fillText(`${km.toFixed(0)} km/h`, f.x + 14, f.y + px * 1.1);
  ctx.font = font(px, 500); ctx.fillStyle = gold; ctx.fillText(dist, f.x + 14, f.y + px * 2.55);
  ctx.textBaseline = 'alphabetic';
  // wind arrow
  const wc = { x: f.x + w - px * 1.6, y: f.y + px * 1.95 };
  drawWindArrow(ctx, wc.x, wc.y, px * 1.3, s.wind);
}
function drawWindArrow(ctx, cx, cy, r, w) {
  // the arrow points where the wind blows to: head wind blows up the hill (screen: toward the athlete, drawn pointing down), cross wind sideways
  const ax = w.cross * 0.5, ay = -w.head * 0.5 * -1;       // screen y grows downward: head wind (positive) points down, toward you
  const len = clamp(Math.hypot(ax, ay) / 1.6, 0.25, 1) * r;
  const a = Math.atan2(ay, ax);
  ctx.save(); ctx.translate(cx, cy);
  ctx.beginPath(); ctx.arc(0, 0, r, 0, TAU); ctx.fillStyle = 'rgba(238,243,247,0.1)'; ctx.fill(); ctx.strokeStyle = 'rgba(238,243,247,0.5)'; ctx.lineWidth = 2; ctx.stroke();
  ctx.rotate(a); ctx.strokeStyle = ice; ctx.fillStyle = ice; ctx.lineWidth = 4; ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(-len, 0); ctx.lineTo(len * 0.7, 0); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(len, 0); ctx.lineTo(len * 0.55, -7); ctx.lineTo(len * 0.55, 7); ctx.closePath(); ctx.fill();
  ctx.restore();
}

// ---------------------------------------------------------------------------------------------------------------------------------
function ringWidget(ctx, L, f, label, hot) {
  const R = L.ring;
  ctx.save();
  const outer = R.r * (1 + 1.0 * f);
  ctx.beginPath(); ctx.arc(R.x, R.y, R.r, 0, TAU); ctx.fillStyle = hot ? 'rgba(242,193,78,0.28)' : 'rgba(10,20,32,0.55)'; ctx.fill();
  ctx.lineWidth = 4; ctx.strokeStyle = hot ? gold : 'rgba(238,243,247,0.7)'; ctx.stroke();
  ctx.beginPath(); ctx.arc(R.x, R.y, outer, 0, TAU); ctx.lineWidth = 7 - 3 * f; ctx.strokeStyle = hot ? gold : ice; ctx.globalAlpha = 0.35 + 0.65 * (1 - f); ctx.stroke(); ctx.globalAlpha = 1;
  ctx.fillStyle = ink; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.font = font(R.r * 0.34, 800); ctx.fillText(label, R.x, R.y + 1);
  ctx.restore();
}

function drawControls(ctx, G, s, L, M, watch) {
  const j = s.jump; if (!j) return;
  const lv = levelById(s.level);
  const lbl = (txt, x, y, col = ink, px = 24 * Math.min(M, 1.3), al = 'center') => { ctx.save(); ctx.shadowColor = 'rgba(0,0,0,0.65)'; ctx.shadowBlur = 5; ctx.fillStyle = col; ctx.font = font(px, 700); ctx.textAlign = al; ctx.fillText(txt, x, y); ctx.restore(); };
  const mid = L.mid;
  if (j.ph === 'ready') {
    lbl('HOLD to crouch', mid.x, mid.y, ink, 36 * Math.min(M, 1.2));
    lbl(G.keyboardHint ? 'or hold Space' : 'keep your finger down', mid.x, mid.y + 38 * Math.min(M, 1.2), 'rgba(238,243,247,0.8)', 20 * Math.min(M, 1.2));
  } else if (j.ph === 'slide') {
    const open = j.zone;
    if (j.tl < 1.1) ringWidget(ctx, L, clamp(j.tl / 1.1, 0, 1), open ? 'JUMP' : 'WAIT', open);
    if (!open) lbl('stay crouched', mid.x, mid.y, 'rgba(238,243,247,0.9)', 26 * Math.min(M, 1.2));
    else lbl('LIFT NOW', mid.x, mid.y, gold, 38 * Math.min(M, 1.2));
    if (j.tuck < 0.7 && j.t > 1.8 && !watch) lbl('Crouch! Hold the screen', mid.x, mid.y + 44, coral, 24 * Math.min(M, 1.2));
  } else if (j.ph === 'air' || j.ph === 'land') {
    drawAngleGauge(ctx, G, s, L, M);
    drawLeanGauge(ctx, G, s, L, M);
    if (j.ph === 'air') {
      if (j.tg < 1.0 && j.air > 0.6) ringWidget(ctx, L, clamp(j.tg / 1.0, 0, 1), 'LAND', j.tg < 0.26);
      if (j.air < 1.6 && !watch) lbl('DRAG up and down to follow the band', mid.x, mid.y, 'rgba(238,243,247,0.92)', 24 * Math.min(M, 1.2));
      if (G.ctl && G.ctl.drag && !watch) drawStick(ctx, G);
    }
  }
}

function drawStick(ctx, G) {
  const c = G.ctl; if (!c.origin) return;
  ctx.save();
  ctx.beginPath(); ctx.arc(c.origin.x, c.origin.y, 70, 0, TAU); ctx.strokeStyle = 'rgba(238,243,247,0.35)'; ctx.lineWidth = 3; ctx.stroke();
  const kx = c.origin.x + clamp(c.sx, -1, 1) * 70, ky = c.origin.y - clamp(c.sy, -1, 1) * 70;
  ctx.beginPath(); ctx.arc(kx, ky, 22, 0, TAU); ctx.fillStyle = 'rgba(238,243,247,0.85)'; ctx.fill();
  ctx.restore();
}

function drawAngleGauge(ctx, G, s, L, M) {
  const j = s.jump, g = L.ang, lo = 5, hi = 60;
  const yOf = (deg) => g.y + g.h - ((deg - lo) / (hi - lo)) * g.h;
  ctx.save();
  chip(ctx, g.x - 22, g.y - 44, g.w + 44, g.h + 88, 'rgba(10,20,32,0.5)', 'rgba(238,243,247,0.18)');
  roundPath(ctx, g.x, g.y, g.w, g.h, g.w / 2); ctx.fillStyle = 'rgba(5,11,20,0.82)'; ctx.fill(); ctx.lineWidth = 2; ctx.strokeStyle = 'rgba(238,243,247,0.4)'; ctx.stroke();
  const bc = j.band / RAD, half = j.bandHalf / RAD;
  const y1 = yOf(clamp(bc + half, lo, hi)), y2 = yOf(clamp(bc - half, lo, hi));
  roundPath(ctx, g.x + 3, y1, g.w - 6, Math.max(8, y2 - y1), (g.w - 6) / 2); ctx.fillStyle = 'rgba(88,194,143,0.88)'; ctx.fill();
  roundPath(ctx, g.x + 3, yOf(bc) - 2, g.w - 6, 4, 2); ctx.fillStyle = '#c9ffe4'; ctx.fill();
  const a = clamp(j.alpha / RAD, lo, hi), my = yOf(a), inb = Math.abs(j.alpha - j.band) <= j.bandHalf;
  ctx.beginPath(); ctx.moveTo(g.x - 14, my - 13); ctx.lineTo(g.x + g.w + 14, my); ctx.lineTo(g.x - 14, my + 13); ctx.closePath();
  ctx.fillStyle = inb ? '#fff' : coral; ctx.fill(); ctx.lineWidth = 2; ctx.strokeStyle = '#08141f'; ctx.stroke();
  ctx.fillStyle = 'rgba(238,243,247,0.85)'; ctx.font = font(Math.max(14, 16 * Math.min(M, 1.3)), 700); ctx.textAlign = 'center';
  ctx.fillText('ANGLE', g.x + g.w / 2, g.y - 16);
  ctx.fillText(`${Math.round(a)}°`, g.x + g.w / 2, g.y + g.h + 30);
  ctx.restore();
}

function drawLeanGauge(ctx, G, s, L, M) {
  const j = s.jump, g = L.lean;
  ctx.save();
  roundPath(ctx, g.x, g.y, g.w, g.h, g.h / 2); ctx.fillStyle = 'rgba(5,11,20,0.82)'; ctx.fill(); ctx.lineWidth = 2; ctx.strokeStyle = 'rgba(238,243,247,0.4)'; ctx.stroke();
  const cx = g.x + g.w / 2, zw = g.w * 0.07;
  roundPath(ctx, cx - zw, g.y + 3, zw * 2, g.h - 6, (g.h - 6) / 2); ctx.fillStyle = 'rgba(88,194,143,0.85)'; ctx.fill();
  const f = clamp(j.beta / 0.45, -1, 1), mx = cx + f * (g.w / 2 - 14), ok = Math.abs(j.beta) < 0.07;
  ctx.beginPath(); ctx.moveTo(mx, g.y - 12); ctx.lineTo(mx + 13, g.y + g.h + 8); ctx.lineTo(mx - 13, g.y + g.h + 8); ctx.closePath(); ctx.fillStyle = ok ? '#fff' : coral; ctx.fill(); ctx.lineWidth = 2; ctx.strokeStyle = '#08141f'; ctx.stroke();
  ctx.fillStyle = 'rgba(238,243,247,0.85)'; ctx.font = font(Math.max(14, 16 * Math.min(M, 1.3)), 700); ctx.textAlign = 'center';
  ctx.fillText('LEVEL', cx, g.y - 18);
  ctx.restore();
}

// ---------------------------------------------------------------------------------------------------------------------------------
function centerPanel(ctx, w, h, y0) {
  const x = SW / 2 - w / 2;
  panel(ctx, x, y0, w, h, { r: 26, fill: 'rgba(10,22,36,0.92)', stroke: 'rgba(238,243,247,0.4)' });
  return { x, y: y0, w, h };
}

function drawGate(ctx, G, s, L, M, watch) {
  const hill = hillById(s.hill);
  const w = Math.min(SW - 40 - host.l - host.r, 600);
  const top = L.pause.y + L.pause.h + 14;
  const avail = H - host.b - top - 12;
  let mm = Math.min(M, 1.8);
  const dims = (m) => { const rh = Math.round(86 * m), hd = Math.round(150 * m); return { rowH: rh, head: hd, h: hd + 3 * (rh + 10) + Math.round(86 * m) + 30 }; };
  while (mm > 0.75 && dims(mm).h > avail) mm -= 0.05;
  const { rowH, head, h } = dims(mm);
  const y0 = L.land ? Math.max(top, (H - h) / 2) : Math.max(top, H * 0.34 - h / 2 + 0);
  const hh = Math.min(h, H - host.b - y0 - 12);
  const p = centerPanel(ctx, w, hh, y0);
  ctx.textAlign = 'center'; ctx.fillStyle = gold; ctx.font = font(30 * mm, 800);
  ctx.fillText('Choose your gate', p.x + w / 2, p.y + 44 * mm);
  ctx.fillStyle = ink; ctx.font = font(19 * mm, 500);
  ctx.fillText(`${hill.name}  ·  K ${hill.k}`, p.x + w / 2, p.y + 78 * mm);
  ctx.fillStyle = ice; ctx.font = font(19 * mm, 700);
  ctx.fillText(`Wind ${windText(s.wind)}`, p.x + w / 2, p.y + 108 * mm);
  const notes = ['-4.2 points, faster, longer', 'safe choice', '+4.2 points, slower'];
  const rec = s.wind.head < -0.6 ? 2 : s.wind.head > 1.2 ? 0 : 1;
  for (let i = 0; i < 3; i++) {
    const g = [2, 1, 0][i];
    const r = { x: p.x + 18, y: p.y + head + i * (rowH + 10), w: w - 36, h: rowH };
    addRect(`gate:${g}`, r);
    drawButton(ctx, r, GATES[g].name, { active: s.gate === g, sub: notes[i] + (g === rec ? '  ·  suggested' : ''), size: Math.round(26 * mm) });
  }
  if (!watch) {
    const by = p.y + head + 3 * (rowH + 10) + 4;
    drawButton(ctx, addRect('go', { x: p.x + 18, y: by, w: w - 36, h: Math.round(80 * mm) }), 'Jump!', { primary: true, size: Math.round(32 * mm) });
  }
}

function drawResult(ctx, G, s, L, M, watch) {
  const res = s.res; if (!res) return;
  const hill = hillById(s.hill);
  const w = Math.min(SW - 36 - host.l - host.r, L.land ? 560 : 640);
  const availH = H - host.b - (L.land ? L.top.y + L.top.h + 12 : L.pause.y + L.pause.h + 18) - 12;
  let mm = Math.min(M, 1.8), big, sm, h;
  const meas = (m) => { big = 64 * m; sm = 21 * m; h = 40 + big + sm * 1.4 + 5 * sm * 1.4 + 4 * sm * 1.4 + sm * 3.4 + (watch ? 0 : 92); return h; };
  while (mm > 0.72 && meas(mm) > availH) mm -= 0.05;
  meas(mm);
  const x = L.land ? SW - host.r - 24 - w : SW / 2 - w / 2;
  const y0 = L.land ? Math.max(L.top.y + L.top.h + 12, (H - h) / 2 - 20) : Math.max(L.pause.y + L.pause.h + 18, H * 0.2);
  const p = { x, y: y0, w, h: Math.min(h, H - host.b - y0 - 8) };
  panel(ctx, p.x, p.y, p.w, p.h, { r: 26, fill: 'rgba(10,22,36,0.92)', stroke: 'rgba(238,243,247,0.4)' });
  ctx.textAlign = 'center';
  ctx.fillStyle = res.fall ? coral : gold; ctx.font = font(fitPx(ctx, `${res.dist.toFixed(1)} m`, 800, big, w - 40, 20), 800);
  ctx.fillText(`${res.dist.toFixed(1)} m`, p.x + w / 2, p.y + 30 + big * 0.85);
  let y = p.y + 40 + big;
  ctx.font = font(sm * 1.1, 700); ctx.fillStyle = res.kind === 'telemark' ? moss : res.kind === 'fall' ? coral : ink;
  y += sm * 1.0; ctx.fillText(res.kindText, p.x + w / 2, y);
  // the five marks, the dropped two dimmed
  const mk = res.marks; const cw = (w - 60) / 5;
  y += sm * 1.7;
  ctx.font = font(sm * 1.15, 800);
  mk.marks.forEach((m, i) => {
    const dropped = i === mk.drop.lo || i === mk.drop.hi;
    ctx.fillStyle = dropped ? 'rgba(238,243,247,0.35)' : ink; ctx.fillText(m.toFixed(1), p.x + 30 + cw * (i + 0.5), y);
    if (dropped) { ctx.fillRect(p.x + 30 + cw * (i + 0.5) - 20, y - sm * 0.4, 40, 2); }
  });
  ctx.font = font(sm * 0.78, 500); ctx.fillStyle = 'rgba(238,243,247,0.7)'; ctx.fillText('judges', p.x + w / 2, y + sm * 1.0);
  y += sm * 2.2;
  ctx.font = font(sm, 500); ctx.fillStyle = ink;
  const rows = [['Distance points', res.distPts.toFixed(1)], ['Style marks', res.style.toFixed(1)], ['Wind', (res.windPts >= 0 ? '+' : '') + res.windPts.toFixed(1)], ['Gate', (res.gatePts >= 0 ? '+' : '') + res.gatePts.toFixed(1)]];
  for (const [a, b] of rows) { ctx.textAlign = 'left'; ctx.fillText(a, p.x + 34, y); ctx.textAlign = 'right'; ctx.fillText(b, p.x + w - 34, y); y += sm * 1.4; }
  ctx.textAlign = 'center'; ctx.fillStyle = gold; ctx.font = font(sm * 1.5, 800); ctx.fillText(`${res.total.toFixed(1)} points`, p.x + w / 2, y + sm * 0.4);
  if (!watch) {
    const bw = (w - 54) / 2, by = p.y + p.h - 84;
    drawButton(ctx, addRect('replay', { x: p.x + 18, y: by, w: bw, h: 68 }), 'Slow-mo replay', { dark: true, size: 24 });
    drawButton(ctx, addRect('next', { x: p.x + 36 + bw, y: by, w: bw, h: 68 }), s.mode === 'practice' ? 'Finish' : 'Standings', { primary: true, size: 26 });
  }
}

function drawBoard(ctx, G, s, L, M, watch) {
  const rows = s.board || [];
  const w = Math.min(SW - 36 - host.l - host.r, 580);
  const availE = H - host.b - (L.pause.y + L.pause.h + 12) - 12;
  let mm = Math.min(M, 1.8);
  while (mm > 0.62 && 140 + rows.length * Math.round(44 * mm) + 100 > availE) mm -= 0.05;
  const rh = Math.round(44 * mm);
  const h = 140 + rows.length * rh + 100;
  const y0 = Math.max(L.pause.y + L.pause.h + 12, (H - h) / 2);
  const p = { x: SW / 2 - w / 2, y: y0, w, h: Math.min(h, H - host.b - y0 - 10) };
  panel(ctx, p.x, p.y, p.w, p.h, { r: 26, fill: 'rgba(10,22,36,0.94)', stroke: 'rgba(238,243,247,0.4)' });
  ctx.textAlign = 'center'; ctx.fillStyle = gold; ctx.font = font(32 * mm, 800); ctx.fillText(`After round ${s.round + 1} of ${s.rounds}`, p.x + w / 2, p.y + 50);
  ctx.fillStyle = 'rgba(238,243,247,0.75)'; ctx.font = font(17 * mm, 500); ctx.fillText('total points, last jump in metres', p.x + w / 2, p.y + 84);
  rows.forEach((r, i) => {
    const y = p.y + 106 + i * rh;
    if (r.you) { roundPath(ctx, p.x + 16, y, w - 32, rh - 6, 12); ctx.fillStyle = 'rgba(242,193,78,0.22)'; ctx.fill(); }
    ctx.textAlign = 'left'; ctx.fillStyle = r.you ? gold : ink; ctx.font = font(21 * mm, r.you ? 800 : 500);
    ctx.fillText(`${r.rank}.  ${r.name}`, p.x + 34, y + rh * 0.62);
    const last = r.jumps[r.jumps.length - 1];
    ctx.textAlign = 'right'; ctx.fillText(`${last ? last.dist.toFixed(1) : '-'} m`, p.x + w - 150, y + rh * 0.62);
    ctx.fillText(r.total.toFixed(1), p.x + w - 34, y + rh * 0.62);
  });
  if (!watch) {
    const bt = addRect('next', { x: p.x + 24, y: p.y + p.h - 84, w: w - 48, h: 68 });
    drawButton(ctx, bt, s.round + 1 < s.rounds ? 'Next round' : 'See the results', { primary: true, size: 28 });
  }
}

function drawReplayBadge(ctx, G, s, L) {
  const r = { x: SW / 2 - 120, y: L.pause.y + 4, w: 240, h: 44 };
  chip(ctx, r.x, r.y, r.w, r.h, 'rgba(10,20,32,0.8)');
  ctx.fillStyle = gold; ctx.font = font(20, 800); ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('SLOW-MO REPLAY', r.x + r.w / 2, r.y + r.h / 2 + 1); ctx.textBaseline = 'alphabetic';
  drawButton(ctx, addRect('skipreplay', { x: SW / 2 - 100, y: r.y + r.h + 8, w: 200, h: 54 }), 'Skip', { dark: true, size: 22 });
}

// ---------------------------------------------------------------------------------------------------------------------------------
function textBlock(ctx, text, x, y, w, px, lh) {
  ctx.font = font(px, 400);
  for (const l of wrapLines(ctx, text, w)) { ctx.fillText(l, x, y); y += lh; }
  return y;
}

function drawThink(ctx, G, s, L, M) {
  const t = G.think; if (!t) return;
  const w = Math.min(SW - 36 - host.l - host.r, 620), px = 21 * Math.min(M, 1.4);
  ctx.font = font(px, 400); const lines = wrapLines(ctx, t.reason, w - 40);
  const h = 140 + lines.length * px * 1.3;
  const y0 = Math.max(L.pause.y + L.pause.h + 12, 0), hh = Math.min(h, H * 0.62);
  const p = { x: SW / 2 - w / 2, y: y0, w, h: hh };
  panel(ctx, p.x, p.y, p.w, p.h, { r: 22, fill: 'rgba(10,22,36,0.95)', stroke: 'rgba(238,243,247,0.45)' });
  ctx.textAlign = 'left'; ctx.fillStyle = gold; ctx.font = font(26 * Math.min(M, 1.3), 800); ctx.fillText(t.summary, p.x + 20, p.y + 44);
  ctx.fillStyle = ink;
  ctx.save(); ctx.beginPath(); ctx.rect(p.x, p.y + 56, p.w, p.h - 130); ctx.clip();
  const sc = G.ui.cardScroll || 0;
  textBlock(ctx, t.reason, p.x + 20, p.y + 84 - sc, w - 40, px, px * 1.3);
  ctx.restore();
  CARD.rect = { x: p.x, y: p.y + 56, w: p.w, h: p.h - 130 }; CARD.view = p.h - 130; CARD.max = Math.max(0, lines.length * px * 1.3 + 40 - CARD.view);
  drawButton(ctx, addRect('think-close', { x: p.x + 20, y: p.y + p.h - 68, w: w - 40, h: 54 }), 'Got it', { primary: true, size: 24 });
}

function drawWatch(ctx, G, s, L, M) {
  const W2 = G.watch;
  const hold = s.hold;
  const w = Math.min(SW - 24 - host.l - host.r, L.land ? 640 : 660);
  const px = Math.max(20 * Math.min(M, 1.4), Math.min(28, Math.ceil(14 / Math.max(0.2, host.px))));
  const x = L.land ? host.l + 14 : SW / 2 - w / 2;
  let y = L.top.y + L.top.h + 10;
  const ph = W2.phase;
  const tapH = Math.max(40, Math.min(92, Math.ceil(46 / Math.max(0.2, host.px)))), btnF = Math.max(18, Math.min(30, Math.ceil(13 / Math.max(0.2, host.px))));   // 46 css px tap targets, 13 css px text
  const hdrH = tapH + 16;
  chip(ctx, x, y, w, hdrH, 'rgba(10,20,32,0.82)');
  ctx.textAlign = 'left'; ctx.textBaseline = 'middle'; ctx.fillStyle = gold; ctx.font = font(Math.max(20, btnF) * Math.min(M, 1.2), 800);
  ctx.fillText(W2.paused ? 'PAUSED' : hold ? (ph === 'think' ? 'THINK' : 'REVEAL') : 'ACT', x + 16, y + hdrH / 2);
  const bw = Math.round(btnF * 4.6), bh = tapH, bx = x + w - 16 - bw * 3 - 16 - 8, by = y + (hdrH - bh) / 2;
  const btn = (id, label, i, o = {}) => { const r = addRect(id, { x: bx + i * (bw + 8), y: by, w: bw, h: bh }); drawButton(ctx, r, label, { dark: true, size: btnF, ...o }); };
  btn('w-pause', W2.paused ? 'Resume' : 'Pause', 0);
  btn('w-faster', 'Shorter', 1); btn('w-slower', 'Longer', 2);
  drawButton(ctx, addRect('w-quit', { x: bx - 8 - Math.round(btnF * 3.4) - 8, y: by, w: Math.round(btnF * 3.4), h: bh }), 'Quit', { dark: true, size: btnF });
  ctx.textBaseline = 'alphabetic';
  y += hdrH + 8;
  if (hold) {
    ctx.font = font(px, 400); const lines = wrapLines(ctx, hold.reason, w - 36);
    const h = 70 + lines.length * px * 1.3 + 22;
    const hh = Math.min(h, H * (L.land ? 0.5 : 0.36));
    panel(ctx, x, y, w, hh, { r: 20, fill: 'rgba(10,22,36,0.9)', stroke: 'rgba(238,243,247,0.35)' });
    ctx.textAlign = 'left'; ctx.fillStyle = ink; ctx.font = font(24 * Math.min(M, 1.3), 800); ctx.fillText(hold.summary, x + 18, y + 38);
    ctx.save(); ctx.beginPath(); ctx.rect(x, y + 48, w, hh - 74); ctx.clip();
    const sc = G.ui.cardScroll || 0;
    ctx.fillStyle = 'rgba(238,243,247,0.92)';
    textBlock(ctx, hold.reason, x + 18, y + 74 - sc, w - 36, px, px * 1.3);
    ctx.restore();
    CARD.rect = { x, y: y + 48, w, h: hh - 74 }; CARD.view = hh - 74; CARD.max = Math.max(0, lines.length * px * 1.3 + 30 - CARD.view);
    const tw = w - 36, total = W2.phase === 'think' ? G.thinkTotal : 2;
    roundPath(ctx, x + 18, y + hh - 18, tw, 8, 4); ctx.fillStyle = 'rgba(238,243,247,0.2)'; ctx.fill();
    roundPath(ctx, x + 18, y + hh - 18, Math.max(8, tw * (1 - W2.timer / Math.max(0.1, total))), 8, 4); ctx.fillStyle = W2.phase === 'think' ? gold : ice; ctx.fill();
  }
}

function drawFeedback(ctx, G, s, L, M) {
  const f = G.feedback;
  if (!f || s.t - f.t > 1.3) return;
  const a = 1 - Math.max(0, (s.t - f.t - 0.7) / 0.6);
  ctx.save(); ctx.globalAlpha = Math.max(0, a); ctx.textAlign = 'center';
  ctx.font = font(46 * Math.min(M, 1.2), 800); ctx.fillStyle = f.col;
  ctx.shadowColor = 'rgba(0,0,0,0.7)'; ctx.shadowBlur = 8;
  ctx.fillText(f.text, SW / 2, L.mid.y + 90 - (s.t - f.t) * 36); ctx.restore();
}

// ---------------------------------------------------------------------------------------------------------------------------------
// Flat picture used when WebGL is not available: sky, the fjord, the hill in profile and a jumper.
export function renderFallback(ctx, G) {
  const s = G.sim;
  const g = ctx.createLinearGradient(0, 0, 0, H); g.addColorStop(0, '#6aa3d8'); g.addColorStop(0.6, '#cfe3ee'); g.addColorStop(1, '#eaf2f6');
  ctx.fillStyle = g; ctx.fillRect(0, 0, SW, H);
  ctx.fillStyle = '#5d7f9c'; ctx.beginPath(); ctx.moveTo(0, H * 0.7); for (let i = 0; i <= 8; i++) ctx.lineTo((SW / 8) * i, H * 0.7 - 70 - 70 * Math.abs(Math.sin(i * 1.9))); ctx.lineTo(SW, H * 0.7); ctx.fill();
  const hill = hillById(s ? s.hill : 'fjord'), j = s && s.jump;
  const sc = Math.min(SW, H) / (hill.k * 1.5);                    // pixels per metre
  const ox = SW * 0.28 + (j && j.ph !== 'ready' && j.ph !== 'slide' ? -Math.min(j.x, hill.k * 0.8) * sc * 0.4 : 0), oy = H * 0.38;
  ctx.fillStyle = '#f4f8fb'; ctx.beginPath(); ctx.moveTo(ox - 40 * sc, oy - 25 * sc);
  for (let x = 0; x <= hill.k * 1.6; x += 4) ctx.lineTo(ox + x * sc, oy - groundY(hill, x) * sc);
  ctx.lineTo(ox + hill.k * 1.6 * sc, H); ctx.lineTo(ox - 40 * sc, H); ctx.fill();
  if (j) {
    let px = ox + (j.x || 0) * sc, py = oy - (j.y || 0) * sc;
    if (j.ph === 'ready' || j.ph === 'slide') { const p = inrunAt(hill, j.s); px = ox + p.x * sc; py = oy - p.y * sc; }
    ctx.fillStyle = '#d6422f'; ctx.beginPath(); ctx.arc(px, py - 6 * sc, 5 * sc, 0, TAU); ctx.fill();
    ctx.strokeStyle = '#142a3b'; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(px - 12 * sc, py); ctx.lineTo(px + 12 * sc, py - 3 * sc); ctx.stroke();
  }
}
