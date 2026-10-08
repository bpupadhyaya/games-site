// The in-play screen on the 2D canvas: top strip, plan map, gauges, the five command buttons, gate button, think / Watch & Learn cards, training card,
// shouts and judge's notes, plus the flat plan-view fallback used when WebGL is missing. Pure drawing from game state; game.js owns state.
import { SW, H, host, minU, hudLayout, PLAY_M } from './layout.js';
import { FONT, DISPLAY, roundPath, drawButton, wrapLines, fitPx } from './ui.js';
import { drawCmdIcon, CMD_LABEL, CMD_ORDER, CMD_KEYS } from './icons.js';
import { COURSES } from './courses.js';
import { WEATHER } from './sim.js';

const TAU = Math.PI * 2;
export const CARD = { rect: null, max: 0, view: 0 };
let RECTS = [];
export const hit = (x, y) => { for (let i = RECTS.length - 1; i >= 0; i--) { const r = RECTS[i]; if (x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h) return r.id; } return null; };
const addRect = (id, r) => { RECTS.push({ id, x: r.x, y: r.y, w: r.w, h: r.h }); return r; };

const ink = '#f6f0e2', gold = '#f2c35b', teal = '#9fdcc8', coral = '#ff9a86', moss = '#6fbf7d';
const font = (px, w = 700) => `${w} ${Math.max(Math.round(px), minU())}px ${FONT}`;
const mmss = (t) => { t = Math.max(0, Math.ceil(t)); return `${Math.floor(t / 60)}:${String(t % 60).padStart(2, '0')}`; };
const STAGE_NAME = { outrun: 'Outrun', lift: 'Lift', fetch: 'Fetch', drive1: 'Drive: first gate', drive2: 'Drive: second gate', pen: 'Pen', training: 'Training' };
const STAGE_TASK = {
  outrun: 'Send the dog wide round the flock',
  lift: 'Start the flock moving, calmly',
  fetch: 'Bring the flock through the gate to the handler',
  drive1: 'Drive the flock through the first gate',
  drive2: 'Drive the flock across the second gate',
  pen: 'Pen all the sheep, then shut the gate',
};
export const stageName = (s) => STAGE_NAME[s.phase] || s.phase;

function chip(ctx, x, y, w, h, fill = 'rgba(14,22,20,0.74)', edge = 'rgba(246,240,226,0.22)') {
  roundPath(ctx, x, y, w, h, Math.min(18, h / 2)); ctx.fillStyle = fill; ctx.fill(); ctx.lineWidth = 1.5; ctx.strokeStyle = edge; ctx.stroke();
}

// ---- plan map (also the whole screen when WebGL is missing) ------------------------------------------------------------------
export function drawPlan(ctx, G, r, big) {
  const s = G.sim, c = COURSES[s.course], b = c.b;
  const sc = Math.min((r.w - 8) / (b.x1 - b.x0), (r.h - 8) / (b.z1 - b.z0));
  const mx = (x) => r.x + r.w / 2 + (x - (b.x0 + b.x1) / 2) * sc, mz = (z) => r.y + r.h / 2 - (z - (b.z0 + b.z1) / 2) * sc;
  ctx.save();
  roundPath(ctx, r.x, r.y, r.w, r.h, big ? 0 : 14); ctx.fillStyle = big ? '#3f7a45' : 'rgba(46,84,52,0.82)'; ctx.fill();
  ctx.save(); roundPath(ctx, r.x, r.y, r.w, r.h, big ? 0 : 14); ctx.clip();
  ctx.strokeStyle = 'rgba(246,240,226,0.65)'; ctx.lineWidth = 2; ctx.strokeRect(mx(b.x0), mz(b.z1), (b.x1 - b.x0) * sc, (b.z1 - b.z0) * sc);
  for (const [x, z, rr] of c.rocks) { ctx.beginPath(); ctx.arc(mx(x), mz(z), Math.max(2, rr * sc), 0, TAU); ctx.fillStyle = '#8c8a80'; ctx.fill(); }
  for (const [x, z, rr] of c.gorse) { ctx.beginPath(); ctx.arc(mx(x), mz(z), Math.max(2, rr * sc), 0, TAU); ctx.fillStyle = 'rgba(190,170,50,0.8)'; ctx.fill(); }
  // gates
  for (const g of s.gates) {
    const ax = -g.dz * g.w / 2, az = g.dx * g.w / 2;
    ctx.strokeStyle = g.resolved ? (g.passed ? moss : coral) : g.id === 'fetch' ? teal : gold; ctx.lineWidth = Math.max(2.5, 0.9 * sc);
    ctx.beginPath(); ctx.moveTo(mx(g.cx - ax), mz(g.cz - az)); ctx.lineTo(mx(g.cx + ax), mz(g.cz + az)); ctx.stroke();
    const px = mx(g.cx), pz = mz(g.cz), dxn = g.dx, dzn = -g.dz, len = Math.max(8, 5 * sc);
    ctx.fillStyle = ctx.strokeStyle; ctx.beginPath(); ctx.moveTo(px + dxn * len * 1.5, pz + dzn * len * 1.5); ctx.lineTo(px + dxn * len * 0.4 - dzn * len * 0.5, pz + dzn * len * 0.4 + dxn * len * 0.5); ctx.lineTo(px + dxn * len * 0.4 + dzn * len * 0.5, pz + dzn * len * 0.4 - dxn * len * 0.5); ctx.closePath(); ctx.fill();
  }
  if (s.pen) {
    const p = s.pen;
    ctx.strokeStyle = '#d9b07a'; ctx.lineWidth = Math.max(2, 0.6 * sc);
    ctx.strokeRect(mx(p.x0), mz(p.z1), (p.x1 - p.x0) * sc, (p.z1 - p.z0) * sc);
    ctx.fillStyle = p.open ? 'rgba(111,191,125,0.55)' : 'rgba(217,176,122,0.3)'; ctx.fillRect(mx(p.x0), mz(p.z1), (p.x1 - p.x0) * sc, (p.z1 - p.z0) * sc);
  }
  // task target and the balance point
  if (s.dest && !s.over) { ctx.beginPath(); ctx.arc(mx(s.dest.x), mz(s.dest.z), Math.max(3, 1.6 * sc), 0, TAU); ctx.strokeStyle = teal; ctx.lineWidth = 2; ctx.stroke(); }
  if (s.bal && s.bal.on && !s.over) { ctx.setLineDash([4, 3]); ctx.beginPath(); ctx.arc(mx(s.bal.x), mz(s.bal.z), Math.max(4, 2.4 * sc), 0, TAU); ctx.strokeStyle = gold; ctx.lineWidth = 2.5; ctx.stroke(); ctx.setLineDash([]); }
  if (s.training && s.lesson && s.lesson.ring) { const rg = s.lesson.ring; ctx.beginPath(); ctx.arc(mx(rg.x), mz(rg.z), rg.r * sc, 0, TAU); ctx.strokeStyle = teal; ctx.lineWidth = 2.5; ctx.stroke(); }
  // handler
  ctx.beginPath(); ctx.arc(mx(s.hand.x), mz(s.hand.z), Math.max(4, 1.2 * sc), 0, TAU); ctx.fillStyle = '#d98a3a'; ctx.fill(); ctx.lineWidth = 1.5; ctx.strokeStyle = ink; ctx.stroke();
  // sheep
  for (const a of s.sheep) {
    const x = mx(a.x), z = mz(a.z), rr = Math.max(3.2, 0.95 * sc);
    ctx.beginPath(); ctx.arc(x, z, rr, 0, TAU); ctx.fillStyle = '#f4f0e4'; ctx.fill();
    if (a.thr > 0.1) { ctx.lineWidth = 1.6; ctx.strokeStyle = coral; ctx.stroke(); }
    if (a.lead) { ctx.lineWidth = 1.6; ctx.strokeStyle = gold; ctx.beginPath(); ctx.arc(x, z, rr + 2, 0, TAU); ctx.stroke(); }
  }
  // dog
  const d = s.dog, dx = mx(d.x), dz = mz(d.z), dr = Math.max(4.5, 1.3 * sc);
  ctx.save(); ctx.translate(dx, dz); ctx.rotate(d.h);
  ctx.beginPath(); ctx.moveTo(0, -dr * 1.9); ctx.lineTo(dr * 0.95, dr * 0.9); ctx.lineTo(-dr * 0.95, dr * 0.9); ctx.closePath(); ctx.fillStyle = '#17171c'; ctx.fill(); ctx.lineWidth = 1.8; ctx.strokeStyle = ink; ctx.stroke();
  ctx.restore();
  ctx.restore();
  if (!big) { roundPath(ctx, r.x, r.y, r.w, r.h, 14); ctx.lineWidth = 2; ctx.strokeStyle = 'rgba(246,240,226,0.5)'; ctx.stroke(); }
  ctx.restore();
}

// ---------------------------------------------------------------------------------------------------------------------------------
export function renderHud(ctx, G, v) {
  RECTS = [];
  const s = G.sim; if (!s) return;
  const M = PLAY_M[G.settings.textIdx];
  const L = hudLayout(G.settings.textIdx);
  G.lay = L;
  const watch = G.mode === 'watch';
  drawTop(ctx, G, s, L, M);
  const cardOpen = !!G.think || (watch && G.watch);
  if (!watch && !cardOpen) drawButtons(ctx, G, L);
  drawPlan(ctx, G, addRect('map', L.map), false);
  drawGauges(ctx, G, s, L, M);
  drawCommands(ctx, G, s, L, M, watch);
  if (s.pen && s.phase === 'pen' && !s.over && !watch) drawGate(ctx, G, s, L);
  drawFeedback(ctx, G, s, L, M);
  if (s.training) drawLesson(ctx, G, s, L, M);
  if (G.think) drawThink(ctx, G, s, L, M);
  if (watch) drawWatch(ctx, G, s, L, M);
  if (G.toast && G.t - G.toast.t < 3) drawToast(ctx, G, L, M);
}
export function renderFallback(ctx, G, v) {
  const s = G.sim;
  ctx.fillStyle = '#2f5d3a'; ctx.fillRect(0, 0, SW, H);
  if (s) { const L = hudLayout(G.settings.textIdx); drawPlan(ctx, G, { x: 0, y: L.top.y + L.top.h + 8, w: SW, h: L.gauges.y - 16 - (L.top.y + L.top.h + 8) }, true); }
}

function drawTop(ctx, G, s, L, M) {
  const t = L.top;
  chip(ctx, t.x, t.y, t.w, t.h);
  ctx.textBaseline = 'middle';
  const pad = 16, mid = t.y + t.h / 2, two = t.h > 66;
  const name = s.training ? s.lesson.title : stageName(s);
  const rightW = s.training ? 0 : t.w * 0.3;
  const fsA = fitPx(ctx, name, 700, 30 * Math.min(M, 1.4), t.w - rightW - pad * 2, 13);
  ctx.font = font(fsA); ctx.fillStyle = gold; ctx.textAlign = 'left';
  ctx.fillText(name, t.x + pad, mid - (two ? 14 : 8));
  const task = s.training ? `Lesson ${s.lesson.idx + 1} of 6` : (STAGE_TASK[s.phase] || '');
  const fsB = fitPx(ctx, task, 500, Math.max(15, fsA * 0.72), t.w - rightW - pad * 2, 12);
  ctx.font = font(fsB, 500); ctx.fillStyle = 'rgba(246,240,226,0.85)';
  ctx.fillText(task, t.x + pad, mid + (two ? 16 : 14));
  if (!s.training) {
    ctx.textAlign = 'right';
    const left = Math.max(0, COURSES[s.course].time - s.t);
    ctx.font = font(fsA * 1.15); ctx.fillStyle = left < 45 ? coral : ink;
    ctx.fillText(mmss(left), t.x + t.w - pad, mid - (two ? 14 : 8));
    const sofar = Math.round(Object.values(s.pts).reduce((q, x) => q + x, 0));
    ctx.font = font(Math.max(14, fsA * 0.66), 500); ctx.fillStyle = 'rgba(246,240,226,0.82)';
    ctx.fillText(`${sofar} pts`, t.x + t.w - pad, mid + (two ? 16 : 14));
  }
  ctx.textBaseline = 'alphabetic';
}

function drawButtons(ctx, G, L) {
  const sz = Math.round(L.uh * 0.4);
  drawButton(ctx, addRect('pause', L.pause), 'Pause', { dark: true, size: sz });
  drawButton(ctx, addRect('think', L.think), 'Think', { dark: true, size: sz });
  drawButton(ctx, addRect('cam', L.cam), G.settings.cam === 'chase' ? 'Close' : 'Auto', { dark: true, size: sz, sub: null });
}

function bar(ctx, x, y, w, h, v, col, label) {
  roundPath(ctx, x, y, w, h, h / 2); ctx.fillStyle = 'rgba(14,22,20,0.78)'; ctx.fill();
  const inner = Math.max(0, (w - 4) * Math.max(0, Math.min(1, v)));
  if (inner > 0) { roundPath(ctx, x + 2, y + 2, Math.max(h - 4, inner), h - 4, (h - 4) / 2); ctx.fillStyle = col; ctx.fill(); }
  roundPath(ctx, x, y, w, h, h / 2); ctx.lineWidth = 1.5; ctx.strokeStyle = 'rgba(246,240,226,0.3)'; ctx.stroke();
  ctx.font = font(Math.max(13, h * 0.5)); ctx.textAlign = 'left'; ctx.textBaseline = 'middle'; ctx.fillStyle = '#10201a';
  ctx.fillStyle = 'rgba(246,240,226,0.95)'; ctx.shadowColor = 'rgba(0,0,0,0.7)'; ctx.shadowBlur = 3;
  ctx.fillText(label, x + 14, y + h / 2 + 1); ctx.shadowBlur = 0; ctx.textBaseline = 'alphabetic';
}
function drawGauges(ctx, G, s, L, M) {
  const g = L.gauges, d = s.dog, half = (g.w - 12) / 2;
  const low = d.stamina < 0.25;
  bar(ctx, g.x, g.y, half, g.h, d.stamina, low ? coral : moss, `Stamina ${Math.round(d.stamina * 100)}%`);
  bar(ctx, g.x + half + 12, g.y, half, g.h, d.eye, gold, `Eye ${Math.round(d.eye * 100)}%`);
}

function drawCommands(ctx, G, s, L, M, watch) {
  const cur = s.dog.cmd, pend = watch && G.watch && G.watch.pending ? G.watch.pending.cmd : null;
  const reveal = watch && G.watch && G.watch.phase === 'reveal';
  CMD_ORDER.forEach((c, i) => {
    const r = L.cmds[i];
    const active = cur === c && !(watch && pend && reveal);
    const glow = pend === c && (reveal || G.watch.phase === 'think');
    const pulse = glow && reveal ? 0.5 + 0.5 * Math.sin(G.t * 9) : 0;
    const pressed = false;
    if (!watch) addRect(`cmd:${c}`, r);
    const lab = CMD_LABEL[c];
    ctx.save();
    roundPath(ctx, r.x, r.y + 5, r.w, r.h, 18); ctx.fillStyle = 'rgba(7,13,12,0.4)'; ctx.fill();
    roundPath(ctx, r.x, r.y, r.w, r.h, 18);
    ctx.fillStyle = active ? '#d98a3a' : glow ? `rgba(242,195,91,${0.55 + pulse * 0.4})` : 'rgba(22,34,30,0.88)'; ctx.fill();
    ctx.lineWidth = glow ? 3.5 : 2; ctx.strokeStyle = active ? '#ffe2a8' : glow ? '#f2c35b' : 'rgba(246,240,226,0.32)'; ctx.stroke();
    const ir = Math.min(r.w * 0.26, r.h * 0.26);
    drawCmdIcon(ctx, c, r.x + r.w / 2, r.y + r.h * 0.4, ir, active || glow ? '#1d1308' : '#f2c35b');
    ctx.fillStyle = active || glow ? '#1d1308' : ink; ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
    const fs = fitPx(ctx, lab, 700, Math.min(r.h * 0.19 * Math.min(M, 1.25), 28), r.w - 10, 11);
    ctx.font = font(fs); ctx.fillText(lab, r.x + r.w / 2, r.y + r.h - 14 - (L.land ? 0 : 4));
    ctx.restore();
  });
}

function drawGate(ctx, G, s, L) {
  const r = L.gate, ok = s.hand.arrived;
  const label = !ok ? 'Handler walking to the pen...' : s.pen.open ? 'Shut the gate' : 'Open the gate';
  if (ok) addRect('gate', r);
  drawButton(ctx, r, label, { primary: ok && !s.pen.open, active: ok && s.pen.open, disabled: !ok, size: Math.round(L.uh * 0.4) });
}

function drawFeedback(ctx, G, s, L, M) {
  const f = G.feedback;
  if (f && s.t - f.t < 1.6) {
    const k = (s.t - f.t) / 1.6, a = Math.min(1, (1 - k) * 2.2);
    ctx.save(); ctx.globalAlpha = a; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    const fs = Math.round(52 * Math.min(M, 1.3));
    ctx.font = `italic 700 ${fs}px ${DISPLAY}`;
    const y = L.top.y + L.top.h + 70 + (L.land ? 0 : 0) - k * 18;
    ctx.lineWidth = 7; ctx.strokeStyle = 'rgba(8,16,12,0.8)'; ctx.lineJoin = 'round';
    ctx.strokeText(f.text, SW / 2, y); ctx.fillStyle = f.col || gold; ctx.fillText(f.text, SW / 2, y);
    ctx.restore();
  }
  // the judge's latest note
  const n = G.note;
  if (n && s.t - n.t < 4.5) {
    ctx.save(); ctx.globalAlpha = Math.min(1, (4.5 - (s.t - n.t)) * 1.2);
    const w = Math.min(SW - 40, 640 * Math.min(M, 1.3)), h = Math.round(46 * Math.min(M, 1.4)), x = SW / 2 - w / 2, y = L.gauges.y - 14 - h - (s.pen && s.phase === 'pen' ? L.uh * 1.1 + 14 : 0);
    chip(ctx, x, y, w, h, 'rgba(60,20,14,0.86)', 'rgba(255,154,134,0.6)');
    ctx.font = font(fitPx(ctx, n.text, 600, 22 * Math.min(M, 1.3), w - 28, 12), 600); ctx.fillStyle = '#ffd2c6'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(n.text, SW / 2, y + h / 2 + 1); ctx.restore();
  }
}
function drawToast(ctx, G, L, M) {
  const k = G.t - G.toast.t, a = Math.min(1, (3 - k) * 1.4, k * 6);
  ctx.save(); ctx.globalAlpha = a;
  const w = Math.min(SW - 40, 600 * Math.min(M, 1.3)), h = Math.round(54 * Math.min(M, 1.4)), x = SW / 2 - w / 2, y = L.top.y + L.top.h + 120;
  chip(ctx, x, y, w, h, 'rgba(14,22,20,0.86)', 'rgba(242,195,91,0.6)');
  ctx.font = font(fitPx(ctx, G.toast.text, 700, 24 * Math.min(M, 1.3), w - 28, 12)); ctx.fillStyle = gold; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText(G.toast.text, SW / 2, y + h / 2 + 1); ctx.restore();
}

// ---- panels: the Think hint, Watch & Learn, the training card ------------------------------------------------------------
function panelRect(L, M, want) {
  // portrait: a card above the gauges; landscape: a column on the left under the score strip
  if (L.land) {
    const x = L.left, y = L.top.y + L.top.h + 8, w = Math.min(Math.max(360, SW * 0.34), 460 * Math.min(M, 1.4)), h = L.gauges.y - 12 - y;
    return { x, y, w: Math.max(260, w), h };
  }
  const h = Math.min(want, L.gauges.y - 12 - (L.map.y + L.map.h + 10));
  return { x: L.left, y: L.gauges.y - 12 - h, w: L.right - L.left, h };
}
function cardHeight(ctx, w, title, why, M, extra) {
  const pad = 18, sc = Math.min(M, 1.8), tfs = Math.round(30 * sc), bfs = Math.round(22 * sc);
  ctx.font = font(tfs); const tl = wrapLines(ctx, title, w - pad * 2).length;
  ctx.font = font(bfs, 500); const bl = wrapLines(ctx, why, w - pad * 2).length;
  return pad * 2 + (extra || 0) + tl * tfs * 1.15 + 8 + bl * bfs * 1.28 + 10;
}
function drawCardText(ctx, r, title, why, M, extra, titleCol = gold) {
  const pad = 18;
  chip(ctx, r.x, r.y, r.w, r.h, 'rgba(14,22,20,0.92)', 'rgba(242,195,91,0.5)');
  ctx.save(); ctx.beginPath(); ctx.rect(r.x + 4, r.y + 4, r.w - 8, r.h - 8); ctx.clip();
  const sc = Math.min(M, 1.8);
  let y = r.y + pad + (extra || 0) - (CARD.scroll || 0);
  ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic';
  const tfs = Math.round(30 * sc); ctx.font = font(tfs); ctx.fillStyle = titleCol;
  wrapLines(ctx, title, r.w - pad * 2).forEach((l) => { y += tfs * 1.05; ctx.fillText(l, r.x + pad, y); y += tfs * 0.1; });
  y += 8;
  const bfs = Math.round(22 * sc); ctx.font = font(bfs, 500); ctx.fillStyle = 'rgba(246,240,226,0.94)';
  wrapLines(ctx, why, r.w - pad * 2).forEach((l) => { y += bfs * 1.28; ctx.fillText(l, r.x + pad, y); });
  y += 10;
  ctx.restore();
  return y + (CARD.scroll || 0) - r.y;
}
function drawThink(ctx, G, s, L, M) {
  const a = G.think;
  const r0 = panelRect(L, M, 330 * Math.min(M, 1.8));
  const bh = Math.round(L.uh * 0.9);
  const need = cardHeight(ctx, r0.w, a.title, a.why, M, 0) + bh + 26;
  const r = L.land ? { ...r0, h: Math.min(r0.h, need) } : { ...r0, y: r0.y + r0.h - Math.min(r0.h, need), h: Math.min(r0.h, need) };
  const view = r.h - bh - 20;
  CARD.rect = { x: r.x, y: r.y, w: r.w, h: view };
  CARD.scroll = G.ui.cardScroll || 0;
  const total = drawCardText(ctx, { x: r.x, y: r.y, w: r.w, h: r.h - bh - 12 }, a.title, a.why, M, 0);
  CARD.max = Math.max(0, total - view + 10); CARD.view = view; G.ui.cardScroll = Math.min(G.ui.cardScroll || 0, CARD.max);
  drawButton(ctx, addRect('think-close', { x: r.x + 10, y: r.y + r.h - bh - 4, w: r.w - 20, h: bh }), 'Got it', { primary: true, size: Math.round(bh * 0.42) });
}
function drawWatch(ctx, G, s, L, M) {
  const w = G.watch;
  const hold = w.pending, ph = w.phase;
  const r0 = panelRect(L, M, 340 * Math.min(M, 1.8));
  const bh = Math.round(L.uh * 0.9), sc0 = Math.min(M, 1.8);
  const need = cardHeight(ctx, r0.w, hold ? hold.title : 'Watching the dog work', hold ? hold.why : 'The handler lets the dog work until the next decision.', M, Math.round(34 * sc0) + 6) + bh + 26;
  const r = L.land ? { ...r0, h: Math.min(r0.h, need) } : { ...r0, y: r0.y + r0.h - Math.min(r0.h, need), h: Math.min(r0.h, need) };
  const view = r.h - bh - 20;
  const badge = ph === 'think' ? `THINK ${Math.max(0, Math.ceil(w.timer))}s` : ph === 'reveal' ? 'REVEAL' : 'ACT';
  const col = ph === 'think' ? '#f0d890' : ph === 'reveal' ? teal : coral;
  const title = hold ? hold.title : (ph === 'act' ? 'Watching the dog work' : '');
  const why = hold ? hold.why : 'The handler lets the dog work until the next decision.';
  G.ui.cardScroll = G.ui.cardScroll || 0; CARD.scroll = G.ui.cardScroll;
  CARD.rect = { x: r.x, y: r.y, w: r.w, h: view };
  const sc = Math.min(M, 1.8);
  // badge row on top of the card
  const badgeH = Math.round(34 * sc);
  const total = drawCardText(ctx, { x: r.x, y: r.y, w: r.w, h: r.h - bh - 12 }, title, why, M, badgeH + 6);
  CARD.max = Math.max(0, total - view + 10); CARD.view = view; G.ui.cardScroll = Math.min(G.ui.cardScroll, CARD.max);
  roundPath(ctx, r.x + 12, r.y + 12, Math.round(150 * sc), badgeH, badgeH / 2); ctx.fillStyle = col; ctx.fill();
  ctx.fillStyle = '#1d1308'; ctx.font = font(Math.round(20 * sc), 800); ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText(badge, r.x + 12 + Math.round(75 * sc), r.y + 12 + badgeH / 2 + 1); ctx.textBaseline = 'alphabetic';
  // timer bar
  if (ph === 'think' && G.thinkTotal) { const bw = r.w - 24 - Math.round(160 * sc), p = Math.max(0, Math.min(1, w.timer / G.thinkTotal)); roundPath(ctx, r.x + 24 + Math.round(150 * sc), r.y + 12 + badgeH / 2 - 4, bw, 8, 4); ctx.fillStyle = 'rgba(255,255,255,0.15)'; ctx.fill(); roundPath(ctx, r.x + 24 + Math.round(150 * sc), r.y + 12 + badgeH / 2 - 4, Math.max(8, bw * p), 8, 4); ctx.fillStyle = '#f0d890'; ctx.fill(); }
  // controls
  const y = r.y + r.h - bh - 4, gap = 8, n = 4, cw = (r.w - 20 - gap * (n - 1)) / n;
  const names = [[w.paused ? 'Resume' : 'Pause', 'w-pause', true], ['Slower', 'w-slower', false], ['Faster', 'w-faster', false], ['Quit', 'w-quit', false]];
  names.forEach(([lb, id, prim], i) => drawButton(ctx, addRect(id, { x: r.x + 10 + i * (cw + gap), y, w: cw, h: bh }), lb, { primary: prim && w.paused, dark: !(prim && w.paused), size: Math.round(bh * 0.38) }));
  // the dog\'s shout, as it will be given
  if (w.paused) { ctx.font = font(26 * Math.min(M, 1.4)); ctx.fillStyle = gold; ctx.textAlign = 'center'; ctx.fillText('Paused', SW / 2, L.top.y + L.top.h + 56); }
}
function drawLesson(ctx, G, s, L, M) {
  const les = s.lesson;
  const sc = Math.min(M, 1.6);
  const r = L.land
    ? { x: L.left + L.uw + 12, y: L.top.y + L.top.h + 8, w: Math.min(SW * 0.4, 520 * sc), h: 0 }
    : { x: L.left + L.uw + 12, y: L.top.y + L.top.h + 8, w: L.map.x - (L.left + L.uw + 12) - 10, h: 0 };
  ctx.font = font(Math.round(21 * sc), 500);
  const lines = wrapLines(ctx, les.done ? 'Well done! The young dog has learned this command.' : les.note ? les.note : les.goal, r.w - 28);
  const lh = Math.round(21 * sc * 1.28);
  r.h = Math.min(L.gauges.y - r.y - 80, 28 + lines.length * lh + 30);
  chip(ctx, r.x, r.y, r.w, r.h, 'rgba(14,22,20,0.82)', 'rgba(159,220,200,0.5)');
  ctx.fillStyle = 'rgba(246,240,226,0.95)'; ctx.textAlign = 'left';
  lines.forEach((l, i) => ctx.fillText(l, r.x + 14, r.y + 20 + (i + 1) * lh * 0.98));
  const py = r.y + r.h - 18;
  roundPath(ctx, r.x + 14, py, r.w - 28, 9, 4.5); ctx.fillStyle = 'rgba(255,255,255,0.15)'; ctx.fill();
  roundPath(ctx, r.x + 14, py, Math.max(9, (r.w - 28) * les.prog), 9, 4.5); ctx.fillStyle = les.done ? moss : gold; ctx.fill();
  if (les.done && les.doneT > 0.8) {
    const w = Math.min(SW - 40, 560), h = 230, x = SW / 2 - w / 2, y = (L.top.y + L.gauges.y) / 2 - h / 2;
    chip(ctx, x, y, w, h, 'rgba(14,22,20,0.94)', 'rgba(242,195,91,0.7)');
    ctx.font = `italic 700 54px ${DISPLAY}`; ctx.fillStyle = gold; ctx.textAlign = 'center'; ctx.fillText('Lesson complete', SW / 2, y + 74);
    drawButton(ctx, addRect('lesson-next', { x: x + 20, y: y + 110, w: w - 40, h: 84 }), G.lessonIdx < 5 ? 'Next lesson' : 'Finish training', { primary: true, size: 32 });
  }
}
