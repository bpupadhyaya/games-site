// Drawing of the stage: the singing screen (Sing / Learn / Watch and Learn) and the Harmony Lab.
import { PAL, UI, DISPLAY, rgba, clamp, drawHall, drawBead, drawNoteBar, drawParticles } from './art.js';
import { txt, wrap, button, panel, rrect, minUnits } from './ui.js';
import { menuRects, pitchY, FIELD_PAD } from './layout.js';
import { PARTS, PXPS, RESONANCE, buildRun, phraseBeats, beatSec, ladderLines, scaleOf, LAB_WIN } from './music.js';
import { v3, flatAlpha } from './v3.js';

const TAU = Math.PI * 2;

// ---- the ladder and the now line ----------------------------------------------------------------------------------------------------
function drawLadder(ctx, F, win, lines, P, glow) {
  ctx.save();
  if (v3.on) v3.panels.push({ r: { x: F.x, y: F.y, w: F.w, h: F.h }, rad: 20, kind: 'glass' });
  const fa = flatAlpha();
  if (fa > 0.01) { ctx.globalAlpha = fa; ctx.fillStyle = 'rgba(8,3,4,0.34)'; rrect(ctx, F, 20); ctx.fill(); ctx.globalAlpha = 1; }
  ctx.beginPath(); ctx.roundRect(F.x, F.y, F.w, F.h, 20); ctx.clip();
  for (const l of lines) {
    const y = pitchY(F, win, l.c);
    ctx.strokeStyle = l.tonic ? `rgba(255,214,130,${0.5 + 0.2 * glow})` : 'rgba(255,225,170,0.15)'; ctx.lineWidth = l.tonic ? 2.5 : 1.5;
    ctx.beginPath(); ctx.moveTo(F.x + 6, y); ctx.lineTo(F.x + F.w - 6, y); ctx.stroke();
    txt(ctx, String(((l.d % 7) + 7) % 7 + 1), F.x + 18, y - 12, 16, l.tonic ? PAL.gold : 'rgba(251,240,218,0.4)', { weight: 700, align: 'center' });
  }
  // the now line
  const g = ctx.createLinearGradient(P.playX - 40, 0, P.playX + 40, 0);
  g.addColorStop(0, 'rgba(255,230,170,0)'); g.addColorStop(0.5, `rgba(255,236,190,${0.1 + 0.18 * glow})`); g.addColorStop(1, 'rgba(255,230,170,0)');
  ctx.fillStyle = g; ctx.fillRect(P.playX - 40, F.y, 80, F.h);
  ctx.strokeStyle = `rgba(255,244,214,${0.5 + 0.35 * glow})`; ctx.lineWidth = 2.5; ctx.setLineDash([9, 8]);
  ctx.beginPath(); ctx.moveTo(P.playX, F.y + 4); ctx.lineTo(P.playX, F.y + F.h - 4); ctx.stroke(); ctx.setLineDash([]);
  ctx.restore();
}

// Trails: where each voice has been in the last seconds (left of the now line).
function drawTrails(ctx, trail, F, win, P, now) {
  for (let p = 0; p < trail.length; p++) {
    const tr = trail[p]; if (tr.length < 2) continue;
    ctx.save(); ctx.lineWidth = 4; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    for (let i = 1; i < tr.length; i++) {
      const a = tr[i - 1], b = tr[i];
      if (b.t - a.t > 0.12) continue;
      const age = clamp((now - b.t) / 1.6, 0, 1);
      ctx.strokeStyle = rgba(PARTS[p].col, 0.65 * (1 - age));
      ctx.beginPath(); ctx.moveTo(P.playX - (now - a.t) * PXPS, pitchY(F, win, a.c)); ctx.lineTo(P.playX - (now - b.t) * PXPS, pitchY(F, win, b.c)); ctx.stroke();
    }
    ctx.restore();
  }
}

function fmtScore(n) { return String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, ','); }

// ---- HUD ----------------------------------------------------------------------------------------------------------------------------------
function drawHud(ctx, st, L, pl, P) {
  const mult = RESONANCE.mult(pl.res);
  const S = L.S;
  if (v3.on) v3.panels.push({ r: { x: S.x - 2, y: S.y - 40, w: S.w + 4, h: P.hudBottom + 6 - S.y + 40 }, rad: 0, kind: 'bar' });
  const fa = flatAlpha();
  if (fa > 0.01) { const pg = ctx.createLinearGradient(0, S.y, 0, P.hudBottom + 6); pg.addColorStop(0, 'rgba(10,4,5,0.82)'); pg.addColorStop(1, 'rgba(10,4,5,0.55)'); ctx.globalAlpha = fa; ctx.fillStyle = pg; ctx.fillRect(S.x, S.y, S.w, P.hudBottom + 6 - S.y); ctx.globalAlpha = 1; }
  button(ctx, P.pause, '', { icon: 'pause', kind: 'quiet', size: 26 });
  if (pl.mode === 'auto') button(ctx, P.hint, '', { icon: 'bulb', kind: pl.auto.phase === 'think' ? 'primary' : 'quiet', size: 26 });
  else button(ctx, P.hint, '', { icon: pl.mode === 'learn' && !pl.learn.final ? 'ear' : 'bulb', kind: 'quiet', size: 26 });
  if (pl.mode !== 'auto') {
    const s = P.score;
    txt(ctx, 'SCORE', s.x + 4, s.y + 16, 15, PAL.dim, { weight: 800 });
    txt(ctx, fmtScore(pl.score), s.x + 4, s.y + s.h * 0.62, Math.min(46, s.h * 0.66), PAL.text, { weight: 800, font: DISPLAY, maxW: s.w - 8 });
  } else {
    const s = P.score;
    txt(ctx, 'WATCH AND LEARN', s.x + 4, s.y + 16, 15, PAL.gold, { weight: 800, maxW: s.w - 8 });
    txt(ctx, `${pl.piece.name}`, s.x + 4, s.y + s.h * 0.62, Math.min(34, s.h * 0.5), PAL.text, { weight: 700, font: DISPLAY, maxW: s.w - 8 });
  }
  // resonance meter
  const r = P.res, pad = 6, ry = r.y + r.h / 2;
  if (L.vert || r.w > 360) {
    const lf = Math.max(14, minUnits());
    ctx.font = `800 ${lf}px ${UI}`; const lw = ctx.measureText('RESONANCE').width;
    txt(ctx, 'RESONANCE', r.x + 4, ry, 14, PAL.dim, { weight: 800 });
    const x0 = r.x + 4 + lw + 12, segW = Math.max(10, (r.x + r.w - 76 - x0 - pad * 4) / 5);
    for (let i = 0; i < RESONANCE.max; i++) {
      const on = i < pl.res, partial = i === pl.res - 1 ? 1 : 0; void partial;
      const bx = x0 + i * (segW + pad), bh = r.h * 0.5 + i * 3;
      const g = ctx.createLinearGradient(0, ry + 14 - bh, 0, ry + 14);
      g.addColorStop(0, on ? '#fff0b0' : 'rgba(255,255,255,0.1)'); g.addColorStop(1, on ? '#d98f2a' : 'rgba(255,255,255,0.05)');
      ctx.fillStyle = g; rrect(ctx, { x: bx, y: ry + 14 - bh, w: segW, h: bh }, 6); ctx.fill();
      if (on && pl.locked) { ctx.fillStyle = 'rgba(255,255,210,0.25)'; rrect(ctx, { x: bx, y: ry + 14 - bh, w: segW, h: bh }, 6); ctx.fill(); }
    }
    txt(ctx, `x${mult}`, r.x + r.w - 6, ry, Math.min(34, r.h * 0.7), pl.locked ? PAL.lock : PAL.gold, { align: 'right', weight: 800, font: DISPLAY });
  }
  // legend
  P.legend.forEach((q, i) => {
    const part = PARTS[i], mine = pl.mode === 'auto' ? false : pl.can[i], sounding = !!pl.now[i];
    ctx.fillStyle = mine ? rgba(part.col, 0.2) : 'rgba(255,240,220,0.06)'; rrect(ctx, q, 14); ctx.fill();
    ctx.lineWidth = mine ? 3 : 1.5; ctx.strokeStyle = mine ? part.col : 'rgba(255,230,200,0.2)'; rrect(ctx, q, 14); ctx.stroke();
    ctx.fillStyle = part.col; ctx.beginPath(); ctx.arc(q.x + 22, q.y + q.h / 2, 9 + (sounding ? 2 : 0), 0, TAU); ctx.fill();
    txt(ctx, part.name, q.x + 40, q.y + q.h * 0.36, Math.min(24, q.h * 0.4), PAL.text, { weight: 800, maxW: q.w - 48 });
    txt(ctx, pl.mode === 'auto' ? 'teacher' : mine ? 'YOU' : 'friend', q.x + 40, q.y + q.h * 0.74, Math.min(17, q.h * 0.3), mine ? part.hi : PAL.dim, { weight: 700, maxW: q.w - 48 });
  });
}

// ---- notes ---------------------------------------------------------------------------------------------------------------------------------
const GOOD = { perfect: 1, great: 1, good: 1 };
function drawNotes(ctx, pl, F, win, P, tolHalf, mode) {
  const past = (n) => n.t + n.dur < pl.t;
  const list = mode === 'preview' ? pl.previewNotes : pl.notes;
  const T = mode === 'preview' ? pl.previewT0 : pl.t;
  ctx.save(); ctx.beginPath(); ctx.rect(F.x, F.y, F.w, F.h); ctx.clip();
  // breaths first, behind
  if (mode !== 'preview') {
    for (const r of pl.rests) {
      const x0 = P.playX + (r.t - pl.t) * PXPS, x1 = x0 + r.dur * PXPS;
      if (x1 < F.x || x0 > F.x + F.w) continue;
      const g = ctx.createLinearGradient(0, F.y, 0, F.y + F.h); g.addColorStop(0, rgba(PARTS[r.part].col, 0.0)); g.addColorStop(0.5, rgba(PARTS[r.part].col, 0.14)); g.addColorStop(1, rgba(PARTS[r.part].col, 0.0));
      ctx.fillStyle = g; ctx.fillRect(x0, F.y, x1 - x0, F.h);
      ctx.fillStyle = 'rgba(210,235,255,0.5)'; ctx.fillRect(x0, F.y, 2, F.h); ctx.fillRect(x1 - 2, F.y, 2, F.h);
      txt(ctx, 'breath', (x0 + x1) / 2, F.y + F.h * 0.5, 22, 'rgba(220,238,255,0.8)', { align: 'center', weight: 800, font: DISPLAY, maxW: x1 - x0 - 8 });
    }
    for (const b of pl.bars) {
      const x = P.playX + (b.t - pl.t) * PXPS;
      if (x < F.x || x > F.x + F.w) continue;
      ctx.fillStyle = 'rgba(255,225,170,0.1)'; ctx.fillRect(x - 1, F.y, 2, F.h);
    }
  }
  const order = [...list].sort((a, b) => (a.who === 'ens' ? 0 : 1) - (b.who === 'ens' ? 0 : 1));
  for (const n of order) {
    const sc = mode === 'preview' ? pl.previewScale : PXPS, base = mode === 'preview' ? P.playX + 20 : P.playX;
    const x0 = base + (n.t - T) * sc, x1 = x0 + n.dur * sc;
    if (x1 < F.x - 4 || x0 > F.x + F.w + 4) continue;
    const y = pitchY(F, win, n.c), act = mode !== 'preview' && n.t <= pl.t && n.t + n.dur > pl.t;
    const friend = mode === 'preview' ? !n.mine : n.who === 'ens' && !n.mine;
    const dim = mode === 'preview' ? (pl.auto.phase === 'think' ? 0.38 : 1) : past(n) ? 0.5 : 1;
    drawNoteBar(ctx, x0, x1, y, n.who === 'note' || n.mine ? tolHalf : Math.min(tolHalf, 16), n.part, { friend, active: act, alpha: dim, judged: !!n.j, good: GOOD[n.j] });
    if (x1 - x0 > 46 && !(mode === 'preview' && pl.auto.phase === 'think')) {
      txt(ctx, n.syl, x0 + 12, y, Math.min(22, tolHalf * 1.1), friend ? 'rgba(255,245,230,0.8)' : 'rgba(30,10,6,0.85)', { weight: 800, maxW: x1 - x0 - 16 });
    }
  }
  ctx.restore();
}

// ---- the beads, the lock ring, pops ---------------------------------------------------------------------------------------------------------
function drawBeads(ctx, pl, F, win, P, tol, upc, tv) {
  const pts = [];
  for (let p = 0; p < 3; p++) {
    const vs = pl.vs[p]; if (vs.disp === null || vs.disp === undefined) continue;
    const n = pl.now[p], mine = pl.mode !== 'auto' && pl.can[p], y = pitchY(F, win, vs.disp);
    const err = vs.err !== null && vs.err !== undefined ? Math.abs(vs.err) : 0, wob = mine && vs.on && n && n.who === 'note' ? clamp((err - tol.lock) / 70, 0, 1) : 0;
    // the thread from the bead to its target
    if (mine && vs.on && n && n.who === 'note') {
      const ty = pitchY(F, win, n.c);
      ctx.strokeStyle = vs.ok ? 'rgba(160,255,220,0.7)' : 'rgba(255,150,130,0.8)'; ctx.lineWidth = 3;
      ctx.beginPath(); ctx.moveTo(P.playX, y); ctx.lineTo(P.playX, ty); ctx.stroke();
    }
    const lockK = pl.locked && n ? 1 : 0;
    drawBead(ctx, P.playX, y, 20, p, { amp: vs.amp, lock: lockK * pl.glow, ghost: !mine, wob, beat: 6 + err * 0.1, t: pl.t * 1.0, label: mine ? '' : '' });
    if (n) pts.push({ x: P.playX, y, p });
  }
  void upc; void tv;
  return pts;
}
function drawPops(ctx, pl, F, win, P) {
  for (const q of pl.pops) {
    const vs = pl.vs[q.p], y0 = vs.disp !== null && vs.disp !== undefined ? pitchY(F, win, vs.disp) : F.y + F.h / 2;
    const k = q.age / 0.9, a = clamp(1 - k * k, 0, 1);
    ctx.save(); ctx.globalAlpha = a;
    txt(ctx, q.text, P.playX + 36 + q.p * 8, y0 - 34 - k * 36, q.size * 0.72, q.col, { weight: 800, stroke: 5, align: 'left', font: DISPLAY });
    ctx.restore();
  }
}

// ---- the caption -----------------------------------------------------------------------------------------------------------------------
function drawCaption(ctx, st, L, pl, P) {
  const c = P.cap; panel(ctx, c, { fill: 'rgba(14,6,8,0.78)', rad: 18 });
  const pad = 16, size = Math.min(26, 20 + L.mb * 0 + (st.prefs.textIdx > 0 ? 6 : 0));
  const ts = [1, 1.25, 1.5, 2, 2.5, 3][st.prefs.textIdx] ?? 1;
  const f = Math.min(54, 21 * ts), lines = [];
  const seg = pl.segs.find((g) => pl.t >= g.t0 && pl.t < g.t1) ?? pl.segs[pl.segs.length - 1];
  const phraseNo = (pl.cur && pl.cur.phrase !== undefined ? pl.cur.phrase + 1 : seg && seg.b0 !== undefined ? Math.floor(seg.b0 / phraseBeats(pl.piece)) + 1 : 1);
  let head = '', body = '', accent = PAL.gold;
  if (pl.mode === 'auto') {
    const a = pl.auto;
    if (a.phase === 'think') { head = `Phrase ${a.k + 1} of 4: think`; body = 'Look at the ladder. Which voice starts lowest, which leaps? Tap the lamp when you are ready.'; }
    else if (a.phase === 'reveal') { head = `Phrase ${a.k + 1} of 4: here it comes`; body = a.lines.map((l) => l.text).slice(0, 2).join(' '); }
    else { head = `Phrase ${a.k + 1} of 4`; body = a.lines.map((l) => l.text).join(' '); }
  } else if (pl.mode === 'learn' && !pl.learn.final) {
    const L2 = pl.learn;
    if (seg && seg.kind === 'listen') { head = `Phrase ${L2.phrase + 1} of 4: listen`; body = 'The whole ensemble sings it, your voices included.'; }
    else if (seg && seg.kind === 'echo') { head = `Phrase ${L2.phrase + 1} of 4: your turn`; body = L2.attempt > 1 ? 'One more try. Keep the bead on the bar.' : 'Sing your voices. Friends sing the rest.'; accent = '#9ff0d8'; }
    else { head = `Phrase ${L2.phrase + 1} of 4`; body = 'Get ready.'; }
  } else if (seg && seg.kind === 'count') { head = pl.mode === 'learn' ? 'The whole song' : pl.piece.name; body = 'Get ready: touch and hold to sing your voices.'; }
  else { head = `${pl.piece.name}: phrase ${Math.min(4, phraseNo)} of 4`; body = pl.locked ? 'Locked. Hold the chord.' : 'Keep every bead on its bar to lock the chord.'; accent = pl.locked ? PAL.lock : PAL.gold; }
  txt(ctx, head, c.x + pad, c.y + pad + f * 0.55, f * 1.08, accent, { weight: 800, maxW: c.w - pad * 2, font: DISPLAY });
  // body text: shrink until it fits the strip (never below 15 units)
  let bf = Math.max(f * 0.88, minUnits()), wl = [], lh = 0;
  for (;;) {
    ctx.font = `500 ${bf}px ${UI}`; wl = wrap(ctx, body, c.w - pad * 2); lh = bf * 1.24;
    if (wl.length * lh <= c.h - pad - f * 1.45 - 6 || bf <= Math.max(15, minUnits())) break;
    bf -= 1;
  }
  // Still too long at the smallest legible size: drop whole trailing sentences (Watch and Learn captions) rather than overflow the panel.
  const room = c.h - pad - f * 1.45 - 6;
  if (wl.length * lh > room && pl.mode === 'auto' && pl.auto.phase !== 'think') {
    const parts = body.split(/(?<=[.!?])\s+/);
    while (parts.length > 1 && wl.length * lh > room) { parts.pop(); wl = wrap(ctx, parts.join(' '), c.w - pad * 2); }
  }
  wl.slice(0, Math.max(1, Math.floor(room / lh))).forEach((ln, i) => txt(ctx, ln, c.x + pad, c.y + pad + f * 1.45 + i * lh + lh * 0.45, bf, PAL.text, { weight: 500 }));
  void size; void lines;
}

// ---- the pause menu --------------------------------------------------------------------------------------------------------------------------
function drawMenu(ctx, st, L, pl, pauseItems) {
  const items = pauseItems(pl), M = menuRects(L, items.length);
  ctx.fillStyle = 'rgba(6,2,3,0.72)'; ctx.fillRect(0, 0, L.w, L.h);
  panel(ctx, M.panel, { fill: 'rgba(24,10,12,0.96)', rad: 26, flat: true });
  ctx.save(); ctx.strokeStyle = 'rgba(244,210,124,0.55)'; ctx.lineWidth = 3; ctx.beginPath(); ctx.roundRect(M.panel.x + 6, M.panel.y + 6, M.panel.w - 12, M.panel.h - 12, 21); ctx.stroke(); ctx.restore();
  txt(ctx, pl.over ? 'That was the song' : 'Paused', M.panel.x + M.panel.w / 2, M.panel.y + 60, 50, PAL.gold, { align: 'center', font: DISPLAY, weight: 700, stroke: 6 });
  const label = { resume: 'Resume', restart: 'Start again', again: 'Watch again', next: 'Next song', exit: 'Back to the song', quit: 'Leave', listen: 'Listen again' };
  items.forEach((it, i) => button(ctx, M.btns[i], label[it], { kind: i === 0 ? 'primary' : 'ghost', size: 30, flat: true }));
}

// ---- the singing screen ---------------------------------------------------------------------------------------------------------------------
export function renderPlay(ctx, st, L, view, meta, pauseItems, X) {
  const pl = st.pl, P = L.play, F = P.field, win = pl.win;
  meta.previewBadge = { x: F.x + F.w - 10, y: F.y + 8, align: 'right' };
  drawHall(ctx, L.w + 4, L.h + 4, pl.glow, st.t);
  v3.choirRect = P.choir;
  if (!v3.on || v3.mix < 1) drawChoirFlat(ctx, P.choir, st, pl);
  const upc = (F.h - 2 * FIELD_PAD) / (win.hi - win.lo), tol = X.tolerance(win);
  const tolHalf = clamp(tol.lock * upc, 15, 32);
  drawLadder(ctx, F, win, pl.lines, P, pl.glow);
  if (pl.mode === 'auto' && pl.auto.phase !== 'act') {
    const pv = previewFor(pl, pl.auto.k);
    drawNotes(ctx, { ...pl, previewNotes: pv.list, previewT0: pv.t0, previewScale: (P.right - P.playX - 50) / pv.secs }, F, win, P, tolHalf, 'preview');
  } else drawNotes(ctx, pl, F, win, P, tolHalf, 'live');
  drawTrails(ctx, pl.trail ?? [[], [], []], F, win, P, pl.t);
  const pts = drawBeads(ctx, pl, F, win, P, tol, upc, st.tv);
  if (pl.locked && pts.length >= 2) {                                    // the lock: a light joining the sounding beads
    ctx.save(); ctx.strokeStyle = `rgba(255,244,190,${0.25 + 0.5 * pl.glow})`; ctx.lineWidth = 5; ctx.lineJoin = 'round';
    const s = [...pts].sort((a, b) => a.y - b.y);
    ctx.beginPath(); s.forEach((q, i) => (i ? ctx.lineTo(q.x, q.y) : ctx.moveTo(q.x, q.y))); ctx.stroke(); ctx.restore();
  }
  drawParticles(ctx, pl.parts);
  drawPops(ctx, pl, F, win, P);
  // hint: a ring on the next target of each voice you sing
  if (pl.hintT > 0 && pl.mode !== 'auto') {
    ctx.save(); ctx.globalAlpha = clamp(pl.hintT, 0, 1);
    for (let p = 0; p < 3; p++) {
      if (!pl.can[p]) continue;
      const arr = pl.nd[p]; let n = null;
      for (let i = pl.np[p]; i < arr.length; i++) if (arr[i].t + arr[i].dur > pl.t) { n = arr[i]; break; }
      if (!n) continue;
      const x = Math.max(P.playX, P.playX + (n.t - pl.t) * PXPS), y = pitchY(F, win, n.c);
      ctx.strokeStyle = PARTS[p].hi; ctx.lineWidth = 4; ctx.setLineDash([8, 6]); ctx.beginPath(); ctx.arc(x + 6, y, tolHalf + 12, 0, TAU); ctx.stroke(); ctx.setLineDash([]);
      txt(ctx, 'sing here', x + 6, y - tolHalf - 26, 20, PARTS[p].hi, { align: 'center', weight: 800, stroke: 4 });
    }
    ctx.restore();
  }
  // fingers
  for (const t of st.tv) { ctx.strokeStyle = rgba(PARTS[t.part].hi, 0.7); ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(t.x, t.y, 30, 0, TAU); ctx.stroke(); }
  drawHud(ctx, st, L, pl, P);
  drawCaption(ctx, st, L, pl, P);
  if (pl.banner) {
    const k = pl.banner.t / 1.7, a = clamp(Math.min(pl.banner.t / 0.15, 1 - k), 0, 1);
    ctx.save(); ctx.globalAlpha = a;
    txt(ctx, pl.banner.text, L.S.x + L.S.w / 2, F.y + F.h * 0.22 - k * 30, Math.min(64, L.S.w * 0.085), PAL.lock, { align: 'center', weight: 700, font: DISPLAY, stroke: 8, maxW: L.S.w - 40 });
    ctx.restore();
  }
  if (pl.paused || pl.over) drawMenu(ctx, st, L, pl, pauseItems);
  if (pl.mode === 'auto' && pl.auto.phase === 'think' && !pl.paused) drawThinkRing(ctx, pl, P);
}
// The 2D fallback of the choir band: three singers as warm head-and-shoulders silhouettes with a mouth that opens with the voice.
function drawChoirFlat(ctx, R, st, pl) {
  const fa = flatAlpha(); if (fa <= 0.01 || R.h < 40) return;
  const lab = !pl, src = pl ?? st.lab;
  ctx.save(); ctx.globalAlpha = fa; ctx.beginPath(); ctx.roundRect(R.x, R.y, R.w, R.h, 18); ctx.clip();
  const g = ctx.createLinearGradient(0, R.y, 0, R.y + R.h); g.addColorStop(0, 'rgba(60,24,22,0.55)'); g.addColorStop(1, 'rgba(20,8,8,0.6)'); ctx.fillStyle = g; ctx.fillRect(R.x, R.y, R.w, R.h);
  const n = 3, gap = R.w / (n + 0.4), r = Math.min(R.h * 0.2, gap * 0.26);
  for (let p = 0; p < n; p++) {
    const cx = R.x + R.w / 2 + (p - 1) * gap, cy = R.y + R.h * 0.5, amp = src && src.vs ? src.vs[p].amp : 0, col = PARTS[p].col;
    ctx.fillStyle = rgba(col, 0.55); ctx.beginPath(); ctx.ellipse(cx, R.y + R.h + r * 0.4, r * 1.9, r * 2.2, 0, Math.PI, 0); ctx.fill();
    ctx.fillStyle = '#d9a67c'; ctx.beginPath(); ctx.arc(cx, cy, r, 0, TAU); ctx.fill();
    ctx.fillStyle = '#2a1410'; ctx.beginPath(); ctx.ellipse(cx, cy + r * 0.42, r * 0.28, r * (0.06 + 0.2 * amp), 0, 0, TAU); ctx.fill();
  }
  ctx.restore();
  void lab;
}
function drawThinkRing(ctx, pl, P) {
  const a = pl.auto, k = clamp(a.timer / a.total, 0, 1), c = P.hint, cx = c.x + c.w / 2, cy = c.y + c.h / 2;
  ctx.save(); ctx.strokeStyle = PAL.gold; ctx.lineWidth = 5; ctx.beginPath(); ctx.arc(cx, cy, c.w * 0.62, -Math.PI / 2, -Math.PI / 2 + TAU * k); ctx.stroke(); ctx.restore();
}
// The upcoming phrase of Watch and Learn, laid out so that it starts a short way right of the now line.
const previewCache = new Map();
function previewFor(pl, k) {
  const key = `${pl.piece.id}|${k}|${pl.can.join('')}`;
  let list = previewCache.get(key);
  if (!list) {
    const bpp = phraseBeats(pl.piece);
    list = buildRun(pl.piece, [{ kind: 'auto', b0: k * bpp, b1: (k + 1) * bpp }], 0.9, { parts: pl.can }).notes;
    if (previewCache.size > 24) previewCache.clear();
    previewCache.set(key, list);
  }
  return { list, t0: 0.9, secs: phraseBeats(pl.piece) * beatSec(pl.piece, pl.speed) };
}

// ---- the Harmony Lab -----------------------------------------------------------------------------------------------------------------
export function renderLab(ctx, st, L, meta, X) {
  const lab = st.lab, P = L.lab, F = P.field, win = LAB_WIN, sc = scaleOf(lab.scale);
  meta.previewBadge = { x: F.x + F.w - 10, y: F.y + 8, align: 'right' };
  drawHall(ctx, L.w + 4, L.h + 4, lab.glow, st.t);
  v3.choirRect = P.choir;
  if (!v3.on || v3.mix < 1) drawChoirFlat(ctx, P.choir, st, null);
  drawLadder(ctx, F, win, ladderLines(sc, win.lo, win.hi), P, lab.glow);
  drawTrails(ctx, lab.trail ?? [[], [], []], F, win, P, lab.t);
  const pts = [];
  for (let p = 0; p < 3; p++) {
    const vs = lab.vs[p]; if (!vs.on) continue;
    const y = pitchY(F, win, vs.c);
    pts.push({ x: P.playX, y, p });
  }
  // interval chips between neighbouring voices
  lab.info.forEach((q, i) => {
    const a = pts.find((o) => o.p === q.lo), b = pts.find((o) => o.p === q.hi); if (!a || !b) return;
    const my = (a.y + b.y) / 2, bx = P.playX + 70 + i * 6;
    ctx.strokeStyle = q.pure ? 'rgba(255,244,190,0.8)' : 'rgba(255,170,130,0.6)'; ctx.lineWidth = q.pure ? 5 : 3;
    ctx.beginPath(); ctx.moveTo(P.playX + 24, a.y); ctx.lineTo(bx - 10, my); ctx.lineTo(P.playX + 24, b.y); ctx.stroke();
    const label = `${q.name} ${q.ratio}`, sub = q.pure ? 'pure: no beating' : q.ok ? `${q.off > 0 ? '+' : ''}${Math.round(q.off)} cents, beating ${q.beat.toFixed(1)} per second` : 'between intervals';
    const w = Math.min(F.x + F.w - bx - 8, 440);
    ctx.fillStyle = 'rgba(14,6,8,0.82)'; rrect(ctx, { x: bx, y: my - 34, w, h: 68 }, 14); ctx.fill();
    ctx.lineWidth = 2; ctx.strokeStyle = q.pure ? PAL.lock : 'rgba(255,170,130,0.5)'; rrect(ctx, { x: bx, y: my - 34, w, h: 68 }, 14); ctx.stroke();
    txt(ctx, label, bx + 14, my - 11, 26, q.pure ? PAL.lock : PAL.text, { weight: 800, maxW: w - 24, font: DISPLAY });
    txt(ctx, sub, bx + 14, my + 17, 19, q.pure ? '#bff0e0' : '#ffd0b8', { weight: 600, maxW: w - 24 });
  });
  for (let p = 0; p < 3; p++) {
    const vs = lab.vs[p]; if (!vs.on && vs.disp === null) continue;
    const y = pitchY(F, win, vs.disp ?? win.lo), beating = lab.info.some((q) => (q.lo === p || q.hi === p) && q.ok && !q.pure);
    drawBead(ctx, P.playX, y, 20, p, { amp: vs.on ? vs.amp : 0.0, lock: lab.locked ? lab.glow : 0, wob: beating ? 1 : 0, beat: 8, t: st.t, ghost: p === 0 && lab.drone });
  }
  drawParticles(ctx, lab.parts);
  for (const t of st.tv) { ctx.strokeStyle = rgba(PARTS[t.part].hi, 0.7); ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(t.x, t.y, 30, 0, TAU); ctx.stroke(); }
  button(ctx, P.exit, 'Exit', { icon: 'back', kind: 'ghost', size: 26 });
  button(ctx, P.drone, lab.drone ? 'Drone on' : 'Drone off', { kind: lab.drone ? 'on' : 'quiet', size: 24 });
  button(ctx, P.scale, sc.name, { kind: 'quiet', size: 26, sub: 'tap to change' });
  const c = P.cap; panel(ctx, c, { fill: 'rgba(14,6,8,0.78)', rad: 18 });
  const ts = [1, 1.25, 1.5, 2, 2.5, 3][st.prefs.textIdx] ?? 1, f = Math.min(54, 21 * ts);
  const head = lab.locked ? 'Pure chord. Hear how still it is.' : lab.info.length ? 'Slide until the beating slows and stops.' : 'Harmony Lab';
  txt(ctx, head, c.x + 16, c.y + 16 + f * 0.55, f * 1.08, lab.locked ? PAL.lock : PAL.gold, { weight: 800, maxW: c.w - 32, font: DISPLAY });
  ctx.font = `500 ${Math.max(f * 0.88, minUnits())}px ${UI}`;
  const body = lab.info.length ? 'Each chip names the interval between two voices, its pure ratio, and how fast they beat.' : `Touch and hold with one or two fingers to sing the middle and top voices over the drone. Scale: ${sc.name}, ${sc.blurb}.`;
  wrap(ctx, body, c.w - 32).slice(0, Math.max(1, Math.floor((c.h - f * 1.9) / (f * 1.18)))).forEach((ln, i) => txt(ctx, ln, c.x + 16, c.y + 16 + f * 1.45 + i * f * 1.18 + f * 0.5, f * 0.88, PAL.text, { weight: 500 }));
}

