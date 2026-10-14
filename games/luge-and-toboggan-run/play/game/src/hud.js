// Everything drawn on top of the chute while playing: the strip, gauges, map, start handles, the cards (ready, Think, result) and the Watch & Learn bar.
import { SW, H, host, PLAY_M, THINK_STEPS, hudLayout, inRect, minU, LAND } from './layout.js';
import { FONT, DISPLAY, C, roundPath, drawButton, panel, wrapLines, textShadow, fitPx } from './ui.js';
import { drawWorld } from './render.js';
import { PUSH_T, PUSH_WIN, PUSH_END, LEVELS, MEDALS } from './sim.js';
import { HW, buildTrack } from './track.js';
import { EDGE } from './physics.js';
import { nrefAt, at, nextCurve, SEG } from './track.js';
import { drawBadge } from './brand.js';
import { clamp } from './util.js';

let HITS = [];
export const CARD = { rect: null, max: 0 };
export const hit = (x, y) => { for (let i = HITS.length - 1; i >= 0; i--) { const h = HITS[i]; if (inRect(h.r, x, y)) return h.id; } return null; };
const reg = (id, r) => { HITS.push({ id, r }); return r; };

export const fmtTime = (t) => (t >= 60 ? `${Math.floor(t / 60)}:${(t % 60).toFixed(2).padStart(5, '0')}` : t.toFixed(2));
export const fmtDelta = (d) => `${d <= 0 ? '-' : '+'}${Math.abs(d).toFixed(2)}`;

function chip(ctx, r, bg = 'rgba(8,20,34,0.78)', edge = 'rgba(190,220,245,0.45)') {
  const rad = Math.min(20, r.h / 2);
  ctx.save();
  roundPath(ctx, r.x, r.y + 4, r.w, r.h, rad); ctx.fillStyle = 'rgba(2,6,12,0.35)'; ctx.fill();
  roundPath(ctx, r.x, r.y, r.w, r.h, rad);
  const g = ctx.createLinearGradient(0, r.y, 0, r.y + r.h); g.addColorStop(0, 'rgba(40,64,90,0.92)'); g.addColorStop(0.5, 'rgba(14,28,44,0.90)'); g.addColorStop(1, 'rgba(8,18,30,0.92)');
  ctx.fillStyle = g; ctx.fill();
  ctx.lineWidth = 1.5; ctx.strokeStyle = edge; ctx.stroke();
  roundPath(ctx, r.x + 3, r.y + 3, r.w - 6, r.h - 6, Math.max(2, rad - 3)); ctx.lineWidth = 1; ctx.strokeStyle = 'rgba(255,255,255,0.10)'; ctx.stroke();
  ctx.restore();
}
function txt(ctx, s, x, y, px, color = '#eef4f8', align = 'center', weight = 700, font = FONT) {
  ctx.font = `${weight} ${Math.max(px, minU())}px ${font}`; ctx.fillStyle = color; ctx.textAlign = align; ctx.textBaseline = 'alphabetic';
  ctx.save(); ctx.shadowColor = 'rgba(4,10,20,0.7)'; ctx.shadowBlur = 4; ctx.shadowOffsetY = 1; ctx.fillText(s, x, y); ctx.restore();
}

export function worldView(G) {
  const s = G.sim, T = buildTrack(s ? s.track : G.attr.track);
  if (!s) {
    const a = G.attr;
    // menus: the sled is the hero, big and low on the screen, left of the menu column in landscape
    const land = SW > H, hero = { fixedCam: true, cam: { nc: a.n + (land ? 2.3 : 0.1), roll: land ? -0.1 : -0.05 }, hyFrac: land ? 0.3 : 0.27, sledFrac: land ? 0.8 : 0.82, camBack: land ? 3.6 : 4.2, sledYaw: land ? 0.1 : 0.04 };
    return { ...hero, T, s: a.s, n: a.n, vn: a.vn, v: a.v, u: a.u, t: G.t, line: false, signs: G.signsFor(T), lines: G.linesFor(T), ruts: null, ghost: null, shake: 0, shadow: true, rider: { ph: 'run', pt: 99, lie: 1, u: a.u, v: a.v, ev: [], pulls: 0 } };
  }
  let ghost = null;
  if (s.ghost && s.ph === 'run') {
    const g = s.ghost, i = s.t / 0.1, k = Math.floor(i);
    if (k >= 0 && k + 1 < g.s.length) { const f = i - k; ghost = { s: g.s[k] + (g.s[k + 1] - g.s[k]) * f, n: g.n[k] + (g.n[k + 1] - g.n[k]) * f }; }
  }
  const showLine = !!(G.think || (G.mode === 'watch' && (G.watch.phase === 'reveal' || G.watch.phase === 'think') && s.hold)) || G.settings.line;
  return { cam: G.cam, T, s: s.s, n: s.n, vn: s.vn, v: s.v, u: s.u, t: G.t, line: showLine, signs: G.signsFor(T), lines: G.linesFor(T), ruts: s.ruts, ghost, shake: s.shake, shadow: true, rider: { ph: s.ph, pt: s.pt, u: s.u, v: s.v, ev: s.events, pulls: s.pulls, run: s.run }, hitFlag: s.wallT > s.t - 0.1 && s.ph === 'run', flash: G.flash || 0 };
}

export function renderBackdrop(ctx, G) { drawWorld(ctx, SW, H, worldView(G)); }

export function renderHud(ctx, G) {
  HITS = []; CARD.rect = null; CARD.max = 0;
  const s = G.sim, T = buildTrack(s.track), L = hudLayout(G.settings.textIdx), m0 = L.m0;
  const out = drawWorld(ctx, SW, H, worldView(G));
  G.out = out;
  drawFx(ctx, G);
  const ph = s.ph;
  // ---- top strip
  if (L.land && L.top.w > 640) L.top = { ...L.top, w: 640 };
  chip(ctx, L.top);
  const tPx = Math.round(L.top.h * 0.52);
  const showT = ph === 'run' ? s.t : ph === 'finish' || ph === 'board' ? (s.time || s.t) : 0;
  ctx.font = `800 ${tPx}px ${FONT}`;
  const small = Math.round(Math.max(minU(), L.top.h * 0.2));
  txt(ctx, fmtTime(showT), L.top.x + 18, L.top.y + L.top.h - 12, tPx, '#ffffff', 'left', 800);
  txt(ctx, 'TIME', L.top.x + 20, L.top.y + small + 3, small, 'rgba(220,235,245,0.7)', 'left');
  const kmh = Math.round(s.v * 3.6);
  txt(ctx, `${kmh}`, L.top.x + L.top.w - 18 - small * 2.8, L.top.y + L.top.h * 0.5 + tPx * 0.3, Math.round(tPx * 0.8), '#ffffff', 'right', 800);
  txt(ctx, 'km/h', L.top.x + L.top.w - 14, L.top.y + L.top.h * 0.5 + tPx * 0.3, small, 'rgba(220,235,245,0.8)', 'right');
  // gap to the best run at the last split
  if (s.splits.length && s.bestSplits) {
    const i = s.splits.length - 1, d = s.splits[i] - s.bestSplits[i];
    txt(ctx, fmtDelta(d), L.top.x + L.top.w * 0.47, L.top.y + L.top.h * 0.5 + tPx * 0.3, Math.round(tPx * 0.7), d <= 0 ? '#7fe3a0' : '#ff9a86', 'center', 800);
  } else if (ph === 'run' && s.ghost) {
    txt(ctx, 'vs best', L.top.x + L.top.w * 0.47, L.top.y + L.top.h * 0.5 + tPx * 0.2, small, 'rgba(220,235,245,0.7)', 'center');
  }
  // ---- pause / think
  const live = ph === 'run' || ph === 'ready' || ph === 'push';
  if (G.mode !== 'watch') {
    if (ph !== 'board' && ph !== 'end') drawButton(ctx, reg('pause', L.pause), 'Pause', { dark: true, size: Math.round(24 * Math.min(m0, 1.4)) });
    if (live) drawButton(ctx, reg('think', L.think), 'Think', { dark: true, size: Math.round(24 * Math.min(m0, 1.4)) });
  }
  // ---- the bend chip
  if (ph === 'run') {
    const c = nextCurve(T, s.s);
    if (c) {
      const d = Math.max(0, Math.round(c.s0 - s.s));
      chip(ctx, L.chip);
      const inside = s.s >= c.s0;
      const lab = inside ? `Bend ${c.n}` : `Bend ${c.n}  in ${d} m`;
      const px = fitPx(ctx, lab, 700, Math.round(30 * Math.min(m0, 1.3)), L.chip.w - 74, 14);
      txt(ctx, lab, L.chip.x + L.chip.w / 2 + 20, L.chip.y + L.chip.h / 2 + px * 0.35, px, '#ffffff');
      // arrow
      const ax = L.chip.x + 36, ay = L.chip.y + L.chip.h / 2, as = L.chip.h * 0.24 * c.dir;
      ctx.beginPath(); ctx.moveTo(ax - as, ay - L.chip.h * 0.22); ctx.lineTo(ax + as, ay); ctx.lineTo(ax - as, ay + L.chip.h * 0.22); ctx.closePath(); ctx.fillStyle = c.rad < 38 ? '#ff7a5a' : '#ffd25a'; ctx.fill();
    }
  }
  // ---- lean / line gauge
  if (ph === 'run' || ph === 'push' || ph === 'ready') drawGauge(ctx, L, s, T);
  // ---- map
  if (!(ph === 'ready' && G.mode !== 'watch' && !G.think) && ph !== 'board' && ph !== 'end') drawMap(ctx, L.map, s, T);
  // ---- feedback
  if (G.feedback && ph === 'run' && s.t - G.feedback.t < 1.5) {
    const a = 1 - Math.max(0, (s.t - G.feedback.t - 0.9) / 0.6);
    ctx.save(); ctx.globalAlpha = clamp(a, 0, 1);
    const px = Math.round(46 * Math.min(m0, 1.25) * (LAND ? 0.85 : 1));
    txt(ctx, G.feedback.text, SW / 2, L.chip.y + L.chip.h + px + 18 + (1 - clamp((s.t - G.feedback.t) / 0.15, 0, 1)) * 14, px, G.feedback.col, 'center', 800);
    ctx.restore();
  }
  // ---- phases
  if (ph === 'push') drawPush(ctx, L, s, out);
  if (ph === 'ready' && !G.think && G.mode !== 'watch') drawReady(ctx, G, L);
  if (ph === 'finish') {
    ctx.save();
    const px = Math.round(78 * Math.min(m0, 1.2));
    const a = clamp(s.pt / 0.35, 0, 1);
    ctx.globalAlpha = a;
    txt(ctx, 'FINISH', SW / 2, H * 0.32, Math.round(px * 0.6), '#ffd25a', 'center', 800, DISPLAY);
    txt(ctx, fmtTime(s.time), SW / 2, H * 0.32 + px * 1.05, px, '#ffffff', 'center', 800);
    ctx.restore();
  }
  if (G.mode === 'watch') drawWatchBar(ctx, G, L);
  if (ph === 'board' || ph === 'end') drawBoard(ctx, G, L);
  if (G.think && ph !== 'board') drawThink(ctx, G, L, G.suggest());
  else if (G.mode === 'watch' && s.hold && (G.watch.phase === 'think' || G.watch.phase === 'reveal')) drawThink(ctx, G, L, G.suggest(), true);
}

function drawGauge(ctx, L, s, T) {
  const g = L.lean;
  roundPath(ctx, g.x, g.y, g.w, g.h, g.h / 2); ctx.fillStyle = 'rgba(8,20,34,0.78)'; ctx.fill();
  ctx.save(); roundPath(ctx, g.x, g.y, g.w, g.h, g.h / 2); ctx.clip();
  const ez = (EDGE - 0.3) / HW;
  const lw = g.w * (1 - ez) / 2;
  ctx.fillStyle = 'rgba(214,69,47,0.55)'; ctx.fillRect(g.x, g.y, lw, g.h); ctx.fillRect(g.x + g.w - lw, g.y, lw, g.h);
  ctx.restore();
  ctx.lineWidth = 1.5; ctx.strokeStyle = 'rgba(238,244,248,0.55)'; roundPath(ctx, g.x, g.y, g.w, g.h, g.h / 2); ctx.stroke();
  const X = (n) => g.x + g.w / 2 + clamp(n / HW, -1, 1) * (g.w / 2 - g.h / 2);
  // the line a little way ahead
  const look = nrefAt(T, s.s + 4 + s.v * 0.5);
  const lx = X(look);
  ctx.beginPath(); ctx.moveTo(lx, g.y - 4); ctx.lineTo(lx + 8, g.y + g.h / 2); ctx.lineTo(lx, g.y + g.h + 4); ctx.lineTo(lx - 8, g.y + g.h / 2); ctx.closePath();
  ctx.fillStyle = '#ffe59a'; ctx.fill(); ctx.strokeStyle = 'rgba(20,30,40,0.7)'; ctx.lineWidth = 1.5; ctx.stroke();
  const dx = X(s.n);
  ctx.beginPath(); ctx.arc(dx, g.y + g.h / 2, g.h * 0.46, 0, 6.283); ctx.fillStyle = '#ffffff'; ctx.fill(); ctx.strokeStyle = '#1b3550'; ctx.lineWidth = 2; ctx.stroke();
  // lean arrow
  const ax = g.x + g.w / 2 + s.u * g.w * 0.22;
  ctx.fillStyle = 'rgba(255,255,255,0.35)'; ctx.fillRect(Math.min(ax, g.x + g.w / 2), g.y + g.h + 6, Math.abs(ax - (g.x + g.w / 2)), 5);
}

function drawMap(ctx, r, s0, T) {
  const S = { s: s0 };
  if (!T.mapPts) {
    let minx = 1e9, maxx = -1e9, miny = 1e9, maxy = -1e9;
    for (let i = 0; i <= T.N; i += 2) { minx = Math.min(minx, T.px[i]); maxx = Math.max(maxx, T.px[i]); miny = Math.min(miny, T.py[i]); maxy = Math.max(maxy, T.py[i]); }
    T.mapPts = { minx, maxx, miny, maxy };
  }
  const m = T.mapPts, pad = 14, bw = r.w - pad * 2, bh = r.h - pad * 2;
  const sc = Math.min(bw / Math.max(20, m.maxx - m.minx), bh / Math.max(20, m.maxy - m.miny));
  const ox = r.x + r.w / 2 - ((m.maxx + m.minx) / 2) * sc, oy = r.y + r.h / 2 + ((m.maxy + m.miny) / 2) * sc;
  const P = (i) => [ox + at(T.px, i) * sc, oy - at(T.py, i) * sc];
  roundPath(ctx, r.x, r.y, r.w, r.h, 18); ctx.fillStyle = 'rgba(8,20,34,0.6)'; ctx.fill();
  ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  ctx.strokeStyle = 'rgba(238,244,248,0.4)'; ctx.lineWidth = 5;
  ctx.beginPath(); for (let s = 0; s <= T.L; s += 6) { const p = P(s); s ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1]); } ctx.stroke();
  ctx.strokeStyle = '#ffd25a'; ctx.lineWidth = 5;
  ctx.beginPath(); for (let s = 0; s <= Math.min(S.s.s, T.L); s += 6) { const p = P(s); s ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1]); } ctx.stroke();
  const c = P(S.s.s);
  ctx.beginPath(); ctx.arc(c[0], c[1], 6, 0, 6.283); ctx.fillStyle = '#ffffff'; ctx.fill(); ctx.strokeStyle = '#d6452f'; ctx.lineWidth = 3; ctx.stroke();
  const f = P(T.L); ctx.fillStyle = '#ffffff'; ctx.fillRect(f[0] - 4, f[1] - 4, 8, 8);
  if (s0.ghost && s0.ph === 'run') {
    const g = s0.ghost, k = Math.min(g.s.length - 1, Math.floor(s0.t / 0.1)); const p = P(g.s[k]);
    ctx.beginPath(); ctx.arc(p[0], p[1], 5, 0, 6.283); ctx.fillStyle = 'rgba(140,200,255,0.9)'; ctx.fill();
}
}

function drawPush(ctx, L, s, out) {
  const r0 = Math.round(Math.min(SW, H) * 0.12);
  let cy = H - host.b - Math.max(150, H * 0.18);
  // keep the prompt and dots below the sled on tall / tablet screens
  if (out) cy = Math.min(Math.max(cy, out.y + out.k * 0.35 + 50 + r0 * 1.35 + 22), L.lean.y - r0 - 16);
  const cxL = SW / 2 - r0 * 1.7, cxR = SW / 2 + r0 * 1.7;
  // which ring is next
  let next = -1; for (let i = 0; i < PUSH_T.length; i++) if (s.pushQ[i] === undefined && s.pt < PUSH_T[i] + PUSH_WIN) { next = i; break; }
  [[cxL, 0], [cxR, 1]].forEach(([x, side]) => {
    const active = next >= 0 && next % 2 === side;
    ctx.beginPath(); ctx.arc(x, cy, r0, 0, 6.283); ctx.fillStyle = active ? 'rgba(255,210,90,0.28)' : 'rgba(8,20,34,0.55)'; ctx.fill();
    ctx.lineWidth = 4; ctx.strokeStyle = active ? '#ffd25a' : 'rgba(238,244,248,0.4)'; ctx.stroke();
    if (active) {
      const t = clamp((PUSH_T[next] - s.pt) / 0.7, 0, 1.2);
      ctx.beginPath(); ctx.arc(x, cy, r0 * (1 + t * 1.0), 0, 6.283); ctx.lineWidth = 5; ctx.strokeStyle = `rgba(255,255,255,${0.9 - t * 0.5})`; ctx.stroke();
    }
    txt(ctx, side ? 'R' : 'L', x, cy + r0 * 0.22, Math.round(r0 * 0.7), active ? '#ffffff' : 'rgba(238,244,248,0.5)', 'center', 800);
  });
  // five dots
  PUSH_T.forEach((t, i) => {
    const x = SW / 2 + (i - 2) * 34, q = s.pushQ[i];
    ctx.beginPath(); ctx.arc(x, cy - r0 * 1.35, 10, 0, 6.283);
    ctx.fillStyle = q === undefined ? (s.pt > t + PUSH_WIN ? 'rgba(214,69,47,0.8)' : 'rgba(238,244,248,0.3)') : q > 0.75 ? '#7fe3a0' : '#ffd25a'; ctx.fill();
  });
  txt(ctx, 'Pull the handles: tap as each ring closes', SW / 2, cy - r0 * 1.35 - 24, Math.round(Math.min(34, SW * 0.045)), '#ffffff');
}

function drawReady(ctx, G, L) {
  const s = G.sim, T = buildTrack(s.track);
  const m = Math.min(PLAY_M[G.settings.textIdx], 1.6);
  const pw = Math.min(SW - 40 - host.l - host.r, 620), fs = Math.round(26 * m);
  const cxm = SW / 2;
  const lines = [];
  ctx.font = `400 ${fs}px ${FONT}`;
  const body = G.mode === 'cup' ? `Run ${s.run} of ${s.runs}. Fastest total time wins the cup.` : G.mode === 'daily' ? "Today's ice: the same ruts for everyone." : G.mode === 'watch' ? 'The computer slides; you learn.' : 'A single timed run. Chase your best and the ghost.';
  const hint = G.demo ? 'Drag left or right to lean.' : 'Drag left or right to lean the sled. Take the gold line.';
  const bl = wrapLines(ctx, body, pw - 56), hl = wrapLines(ctx, hint, pw - 56);
  const titlePx = Math.round(40 * m);
  const ph = 40 + titlePx * 1.2 + (bl.length + hl.length) * fs * 1.3 + 30 + 100 + 20;
  const y0 = Math.max(L.chip.y + L.chip.h + 14, Math.min(H * 0.18, H - ph - 160));
  panel(ctx, cxm - pw / 2, y0, pw, ph, { r: 28, fill: 'rgba(10,26,42,0.88)', stroke: 'rgba(238,244,248,0.4)' });
  let y = y0 + 34 + titlePx * 0.8;
  txt(ctx, T.name, cxm, y, fitPx(ctx, T.name, 700, titlePx, pw - 40, 16), '#ffffff', 'center', 700, DISPLAY);
  y += titlePx * 0.5 + 8;
  ctx.font = `400 ${fs}px ${FONT}`;
  [...bl, ...hl].forEach((l, i) => { txt(ctx, l, cxm, y + fs * (1 + i * 1.3) - 6, fs, i < bl.length ? '#ffd98a' : 'rgba(238,244,248,0.92)', 'center', 400); });
  y += (bl.length + hl.length) * fs * 1.3 + 22;
  const br = { x: cxm - pw / 2 + 28, y, w: pw - 56, h: Math.max(84, Math.round(70 * m)) };
  drawButton(ctx, reg('go', br), 'To the start gate', { primary: true, size: Math.round(30 * m) });
}

function drawBoard(ctx, G, L) {
  const s = G.sim, r = s.res, T = buildTrack(s.track);
  if (!r) return;
  const m = Math.min(PLAY_M[G.settings.textIdx], 1.5);
  const pw = Math.min(SW - 30 - host.l - host.r, 640);
  const cx = LAND && SW - host.l - host.r > pw * 1.9 ? SW - host.r - pw / 2 - 28 : SW / 2;   // landscape: card to the right, the sled stays in view
  const fs = Math.round(24 * m), big = Math.round(64 * Math.min(m, 1.25));
  const rows = [];
  const best = G.record.best[T.id];
  const isRec = best == null || r.time <= best + 1e-6;
  if (s.bestSplits || best) rows.push(['Best', best ? fmtTime(Math.min(best, r.time)) : '-']);
  rows.push(['Split 1 / 2', `${fmtTime(r.splits[0])}  /  ${fmtTime(r.splits[1])}`]);
  rows.push(['Clean bends', `${r.clean} of ${r.bends}`]);
  rows.push(['Wall touches', `${r.touches}`]);
  rows.push(['Top speed', `${Math.round(r.top * 3.6)} km/h`]);
  const cup = s.mode === 'cup' || s.mode === 'watch';
  const standings = cup ? s.standings.slice(0, 8) : [];
  const lineH = fs * 1.45;
  const hdr = 46 + big + 30;
  const bodyH = rows.length * lineH + (cup ? 14 + (standings.length + 1) * fs * 1.25 : 0);
  const btnH = Math.max(84, Math.round(70 * m));
  const total = hdr + bodyH + btnH * 1.0 + 40;
  const avail = H - host.t - host.b - 24;
  const ph = Math.min(total, avail);
  const centred = host.t + Math.max(12, (H - host.t - host.b - ph) / 2);
  // portrait: sit just under the time strip so the sled and the finish straight stay in view below the card
  const y0 = LAND ? centred : Math.min(centred, Math.max(12, L.top.y + L.top.h + 14));
  panel(ctx, cx - pw / 2, y0, pw, ph, { r: 28, fill: 'rgba(10,26,42,0.93)', stroke: 'rgba(238,244,248,0.4)' });
  ctx.save(); ctx.beginPath(); ctx.rect(cx - pw / 2, y0, pw, ph - btnH - 26); ctx.clip();
  const maxScroll = Math.max(0, total - ph);
  const scroll = clamp(G.ui.cardScroll || 0, 0, maxScroll);
  CARD.rect = { x: cx - pw / 2, y: y0, w: pw, h: ph - btnH - 26 }; CARD.max = maxScroll;
  let y = y0 + 40 - scroll;
  txt(ctx, s.over ? 'Final' : isRec && s.mode !== 'cup' ? 'New best!' : cup ? `Run ${s.run} of ${s.runs}` : 'Run complete', cx, y, Math.round(34 * Math.min(m, 1.3)), isRec ? '#ffd25a' : '#eef4f8', 'center', 700, DISPLAY);
  y += big * 1.05;
  txt(ctx, fmtTime(s.over && cup ? s.you.times.reduce((a, b) => a + b, 0) : r.time), cx, y, big, '#ffffff', 'center', 800);
  y += 28;
  rows.forEach(([a, b]) => {
    y += lineH;
    txt(ctx, a, cx - pw / 2 + 36, y - 6, fs, 'rgba(220,235,245,0.8)', 'left', 400);
    txt(ctx, b, cx + pw / 2 - 36, y - 6, fs, '#ffffff', 'right', 700);
  });
  if (cup) {
    y += 22;
    txt(ctx, s.over ? 'Cup result' : 'Cup standing', cx, y, Math.round(fs * 1.1), '#ffd98a', 'center', 700);
    standings.forEach((row) => {
      y += fs * 1.25;
      const col = row.you ? '#ffd25a' : '#eef4f8';
      txt(ctx, `${row.rank}.  ${row.name}`, cx - pw / 2 + 36, y, fs * 0.92, col, 'left', row.you ? 800 : 400);
      txt(ctx, fmtTime(row.total), cx + pw / 2 - 36, y, fs * 0.92, col, 'right', row.you ? 800 : 400);
    });
  }
  ctx.restore();
  const by = y0 + ph - btnH - 20;
  if (G.mode === 'watch') {
    drawButton(ctx, reg('menu', { x: cx - pw / 2 + 28, y: by, w: pw - 56, h: btnH }), 'Main menu', { primary: true, size: Math.round(30 * m) });
  } else if (s.over || s.runs === 1) {
    const w1 = (pw - 56 - 16) * 0.6;
    drawButton(ctx, reg('again', { x: cx - pw / 2 + 28, y: by, w: w1, h: btnH }), 'Run again', { primary: true, size: Math.round(28 * m) });
    drawButton(ctx, reg('menu', { x: cx - pw / 2 + 28 + w1 + 16, y: by, w: pw - 56 - w1 - 16, h: btnH }), 'Menu', { dark: true, size: Math.round(26 * m) });
  } else {
    drawButton(ctx, reg('next', { x: cx - pw / 2 + 28, y: by, w: pw - 56, h: btnH }), 'Next run', { primary: true, size: Math.round(30 * m) });
  }
}

function drawThink(ctx, G, L, sug, auto = false) {
  const m = Math.min(PLAY_M[G.settings.textIdx], 1.6);
  const pw = Math.min(SW - 30 - host.l - host.r, 620), fs = Math.round(26 * m), cx = SW / 2;
  const titlePx = Math.round(38 * Math.min(m, 1.3));
  ctx.font = `400 ${fs}px ${FONT}`;
  const lines = [];
  sug.lines.filter(Boolean).forEach((t) => lines.push(...wrapLines(ctx, t, pw - 60), ''));
  const btnH = auto ? 0 : Math.max(76, Math.round(64 * m));
  const total = 30 + titlePx * 1.3 + lines.length * fs * 1.3 + btnH + (auto ? 24 : 50);
  const avail = H * 0.58;
  const ph = Math.min(total, avail);
  const y0 = Math.max(L.chip.y + L.chip.h, L.think.y + L.think.h) + 12;   // clear of Pause / Think / Quit
  panel(ctx, cx - pw / 2, y0, pw, ph, { r: 26, fill: 'rgba(10,26,42,0.9)', stroke: 'rgba(255,217,138,0.7)' });
  const clipH = ph - btnH - (auto ? 0 : 30);
  ctx.save(); ctx.beginPath(); ctx.rect(cx - pw / 2, y0, pw, clipH); ctx.clip();
  const maxScroll = Math.max(0, total - ph);
  const scroll = clamp(G.ui.cardScroll || 0, 0, maxScroll);
  CARD.rect = { x: cx - pw / 2, y: y0, w: pw, h: clipH }; CARD.max = maxScroll;
  let y = y0 + 34 + titlePx * 0.8 - scroll;
  txt(ctx, auto ? `${sug.title}` : `Think: ${sug.title}`, cx, y, fitPx(ctx, sug.title, 700, titlePx, pw - 40, 16), '#ffd98a', 'center', 700);
  y += titlePx * 0.7;
  lines.forEach((l, i) => { txt(ctx, l, cx - pw / 2 + 30, y + fs * (1 + i * 1.3), fs, '#eef4f8', 'left', 400); });
  ctx.restore();
  if (!auto) drawButton(ctx, reg('think-close', { x: cx - pw / 2 + 28, y: y0 + ph - btnH - 16, w: pw - 56, h: btnH }), 'Back to the run', { primary: true, size: Math.round(28 * m) });
}

function drawWatchBar(ctx, G, L) {
  const w = G.watch, m = Math.min(PLAY_M[G.settings.textIdx], 1.5);
  const bh = Math.max(76, Math.round(64 * m)) + 6;
  const y = H - host.b - bh - 70;
  const bw = Math.min(SW - 24 - host.l - host.r, 700), x = SW / 2 - bw / 2;
  chip(ctx, { x, y, w: bw, h: bh }, 'rgba(8,20,34,0.82)', 'rgba(238,244,248,0.35)');
  const names = { think: 'THINK', reveal: 'REVEAL', act: 'ACT' };
  const cols = { think: '#ffd98a', reveal: '#7fd6c2', act: '#ff9a86' };
  const lab = G.sim.hold ? `${names[w.phase]}  ${Math.max(0, Math.ceil(w.timer))}` : G.sim.ph === 'run' ? 'ACT' : G.sim.ph.toUpperCase();
  const px = Math.round(26 * Math.min(m, 1.3));
  txt(ctx, w.paused ? 'PAUSED' : lab, x + 16, y + bh / 2 + px * 0.35, px, w.paused ? '#ffffff' : (cols[w.phase] || '#fff'), 'left', 800);
  const bwid = (bw - 190 - 24) / 3, by = y + 8, bhh = bh - 16;
  drawButton(ctx, reg('w-pause', { x: x + bw - 12 - bwid * 3 - 16, y: by, w: bwid, h: bhh }), w.paused ? 'Resume' : 'Pause', { primary: w.paused, dark: !w.paused, size: Math.round(22 * Math.min(m, 1.3)) });
  drawButton(ctx, reg('w-faster', { x: x + bw - 12 - bwid * 2 - 8, y: by, w: bwid, h: bhh }), 'Shorter', { dark: true, size: Math.round(22 * Math.min(m, 1.3)) });
  drawButton(ctx, reg('w-slower', { x: x + bw - 12 - bwid, y: by, w: bwid, h: bhh }), 'Longer', { dark: true, size: Math.round(22 * Math.min(m, 1.3)) });
  drawButton(ctx, reg('w-quit', { x: SW - host.r - 14 - L.uw, y: L.pause.y, w: L.uw, h: L.uh }), 'Quit', { dark: true, size: Math.round(24 * Math.min(m, 1.4)) });
}

// ---- ice spray and snow dust (screen space, owned by game.js, drawn here) ------------------------------------------------
function drawFx(ctx, G) {
  for (const p of G.fx) {
    const a = clamp(p.life / p.max, 0, 1);
    ctx.globalAlpha = a * 0.9; ctx.fillStyle = p.col;
    ctx.beginPath(); ctx.arc(p.x, p.y, p.r * (0.6 + 0.4 * a), 0, 6.283); ctx.fill();
  }
  ctx.globalAlpha = 1;
}
export function renderFallback() {}
