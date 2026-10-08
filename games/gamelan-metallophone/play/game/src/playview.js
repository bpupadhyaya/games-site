// Drawing for the playing screens: the stage (lanes, notes, the instrument, mallets, sparks), the HUD, free play and calibration.
import { PAL, UI, DISPLAY, drawBackdrop, drawFloor, drawFrame, drawBar, drawGong, drawMallet, drawNote, drawPopup, drawParticles, drawLane, drawCycleRing, drawEnsIcon } from './art.js';
import { txt, button, panel, rrect, chip, icon, wrap } from './ui.js';
import { menuRects } from './layout.js';
import { SPEEDS, TUNINGS, I, comboMult, cycleBeat } from './music.js';
import { drawBadgeStack, edgeStroke } from './brand.js';

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

function curBar(pl) {
  for (let i = pl.bars.length - 1; i >= 0; i--) if (pl.bars[i].t0 <= pl.t) return pl.bars[i].t1 > pl.t ? pl.bars[i] : null;
  return null;
}
function lowerBound(ev, t) { let lo = 0, hi = ev.length; while (lo < hi) { const m = (lo + hi) >> 1; if (ev[m].t < t) lo = m + 1; else hi = m; } return lo; }
const laneW = (it) => it.w ?? it.r * 1.7;

// The stage: hall, floor, lanes and falling notes, the instrument with its mallets, sparks and judgement words.
export function drawStage(ctx, st, L, sess, rack, pl) {
  const { w, h } = L, t = sess.t, pulse = sess.pulse;
  ctx.save();
  if (sess.shake > 0.01 && !st.prefs.calm) ctx.translate(Math.sin(st.t * 90) * sess.shake * 4, Math.cos(st.t * 80) * sess.shake * 3);
  drawBackdrop(ctx, w + 20, h + 20, st.t, pulse);
  const floorTop = rack.top - 18;
  drawFloor(ctx, w, h, floorTop, rack.ax + rack.aw / 2, pulse);
  const appr = SPEEDS[st.prefs.speedIdx].approach;
  const lanes = pl ? pl.lanes : [];
  const tun = TUNINGS[pl ? pl.piece.tuning : sess.tuning];

  // lanes + notes
  if (pl) {
    for (const it of rack.items) {
      if (!lanes.includes(it.inst)) continue;
      const wBot = laneW(it), near = sess.ins[it.inst].flash;
      drawLane(ctx, it.cx, rack.laneTop, it.cy, wBot * 0.5, wBot, near, false);
    }
    for (const b of pl.bars) {                                             // beat lines
      if (b.t1 < t - 0.1 || b.t0 > t + appr) continue;
      const bd = (b.t1 - b.t0) / 4;
      for (let j = 0; j < 4; j++) {
        const tb = b.t0 + j * bd, p = 1 - (tb - t) / appr; if (p < 0 || p > 1.05) continue;
        for (const it of rack.items) {
          if (!lanes.includes(it.inst)) continue;
          const y = rack.laneTop + (it.cy - rack.laneTop) * p, ww = laneW(it) * (0.5 + 0.5 * p);
          ctx.strokeStyle = j === 0 ? 'rgba(255,226,170,0.5)' : 'rgba(255,226,170,0.15)'; ctx.lineWidth = j === 0 ? 3 : 1.5;
          ctx.beginPath(); ctx.moveTo(it.cx - ww / 2, y); ctx.lineTo(it.cx + ww / 2, y); ctx.stroke();
        }
      }
    }
  }
  // the instrument
  if (rack.frame) drawFrame(ctx, rack.frame);
  const nextIn = new Map();                                                // 0..1: how close the next note on each lane is
  if (pl) {
    for (const inst of lanes) {
      const arr = pl.nd[inst]; for (let i = pl.np[inst]; i < arr.length && i < pl.np[inst] + 4; i++) { const n = arr[i]; if (n.j) continue; const u = n.t - t; if (u < 0.5 && u > -0.15) nextIn.set(inst, 1 - Math.max(0, u) / 0.5); break; }
    }
  }
  for (const it of rack.items) {
    const s = sess.ins[it.inst], inc = nextIn.get(it.inst) || 0, dim = pl && !lanes.includes(it.inst) ? (it.kind === 'bar' ? 0.5 : 0.35) : 0;
    if (it.kind === 'bar') drawBar(ctx, it, { flash: s.flash, ring: s.ring, inc, dim, ens: s.ens, t: st.t, label: st.prefs.labels ? tun.numerals[it.inst] : null });
    else drawGong(ctx, it, it.kind, { flash: s.flash, ring: s.ring, inc, dim, ens: s.ens, age: s.age, swing: s.flash * Math.sin(st.t * 30) });
  }
  // mallets over the bars
  if (rack.kind === 'bars' || rack.kind === 'free') {
    const bars = rack.items.filter((q) => q.kind === 'bar');
    if (bars.length) {
      const size = Math.max(14, bars[0].w * 0.3);
      sess.hand.forEach((hd, k) => {
        const dir = k === 0 ? 1 : -1, it = bars.find((q) => q.inst === hd.inst);
        const rx = rack.ax + rack.aw / 2 + dir * rack.cell * 0.9, rest = { cx: rx, cy: bars[0].cy, h: bars[0].h };
        const tg = it ?? rest, since = t - hd.t;
        const lift = it ? (since < 0.05 ? 0 : clamp((since - 0.05) / 0.28, 0, 1) * 0.5) : 0.5;
        ctx.save(); ctx.globalAlpha = 0.95;
        drawMallet(ctx, tg.cx + dir * size * 0.5, tg.cy - tg.h * 0.34 - size * 0.5, size, lift, dir, since < 0.1 ? 1 - since / 0.1 : 0);
        ctx.restore();
      });
    }
  }
  // notes fall over the instrument's far edge
  if (pl) {
    const lo = lowerBound(pl.ev, t - 0.3);
    for (let i = lo; i < pl.ev.length; i++) {
      const e = pl.ev[i]; if (e.t > t + appr) break;
      if (!lanes.includes(e.inst)) continue;
      if (e.who !== 'note' && e.who !== 'teach') continue;
      const it = rack.items.find((q) => q.inst === e.inst); if (!it) continue;
      const p = 1 - (e.t - t) / appr, y = rack.laneTop + (it.cy - rack.laneTop) * p, sc = 0.5 + 0.5 * clamp(p, 0, 1);
      const nr = clamp(laneW(it) * 0.36, 22, 58) * sc, shape = it.kind === 'bar' ? 'bar' : 'gong', lab = st.prefs.labels && it.kind === 'bar' ? tun.numerals[it.inst] : null;
      if (e.who === 'note') {
        if (e.j && e.j !== 'miss') continue;
        drawNote(ctx, it.cx, y, nr, shape, lab, e.soft, e.j === 'miss' ? 0.35 : clamp(p * 3, 0, 1));
      } else {
        if (e.t <= t) continue;
        drawNote(ctx, it.cx, y, nr, shape, lab, e.soft, clamp(p * 3, 0, 1), pl.mode !== 'auto');
      }
    }
  }
  drawParticles(ctx, sess.parts);
  for (const p of sess.pops) drawPopup(ctx, p);
  ctx.restore();
}

function ensPips(ctx, x, y, w, level, flash, label = true) {
  if (label) txt(ctx, 'ENSEMBLE', x, y, 20, PAL.gold, { weight: 800 });
  const x0 = x + (label ? 130 : 0), gap = (w - (label ? 130 : 0)) / 4;
  for (let i = 0; i < 4; i++) {
    const on = i <= level, cx = x0 + gap * i + gap / 2 - 10;
    ctx.fillStyle = on ? PAL.gold : 'rgba(255,240,220,0.14)'; rrect(ctx, { x: cx - gap * 0.42, y: y - 10, w: gap * 0.84, h: 20 }, 10); ctx.fill();
    if (on && i === level && flash > 0) { ctx.fillStyle = `rgba(255,255,255,${0.7 * flash})`; rrect(ctx, { x: cx - gap * 0.42, y: y - 10, w: gap * 0.84, h: 20 }, 10); ctx.fill(); }
  }
}

const KIND_LABEL = { count: 'GET READY', listen: 'LISTEN', echo: 'YOUR TURN', play: 'PLAY', auto: 'WATCH' };
const KIND_COL = { count: PAL.dim, listen: PAL.jadeHi, echo: PAL.amberHi, play: PAL.gold, auto: PAL.jadeHi };
const ICON_INST = { kethuk: I.KETHUK, kenong: I.KENONG, kempul: I.KEMPUL, gong: I.GONG, slenthem: I.SLENTHEM, peking: I.PEKING };
const ICON_NAME = { kethuk: 'Kethuk', kenong: 'Kenong', kempul: 'Kempul', gong: 'Gong', slenthem: 'Slenthem', peking: 'Peking' };

// The cycle ring and the ensemble icons.
function drawEnsemble(ctx, st, L, pl, P, labels) {
  const bar = curBar(pl), cyc = pl.piece.cyc;
  let pos = null;
  if (bar && bar.bar >= 0) pos = (((bar.bar * 4 + 4 * (pl.t - bar.t0) / (bar.t1 - bar.t0)) % cyc.beats) + cyc.beats) % cyc.beats / cyc.beats;
  drawCycleRing(ctx, P.ring.x, P.ring.y, P.ring.r, cyc, pos, pl.rf, st.t);
  for (const ic of P.icons) {
    const inst = ICON_INST[ic.key], s = pl.ins[inst], mine = pl.lanes.includes(inst);
    let dim = 0;
    if (ic.key === 'slenthem') dim = (pl.mode === 'learn' && !pl.learn.final) || pl.ens < 1 ? 0.6 : 0;
    if (ic.key === 'peking') dim = (pl.mode === 'learn' && !pl.learn.final) || pl.ens < 2 ? 0.6 : 0;
    if (mine) dim = 0;
    drawEnsIcon(ctx, ic.key, ic.x, ic.y, ic.r, { flash: s.flash, ring: s.ring, dim, hot: s.hot >= 0 ? s.hot % 5 : -1 });
    if (mine) { ctx.strokeStyle = PAL.amber; ctx.lineWidth = 3; ctx.setLineDash([6, 5]); ctx.beginPath(); ctx.arc(ic.x, ic.y, ic.r * 1.22, 0, 6.3); ctx.stroke(); ctx.setLineDash([]); }
    if (labels) txt(ctx, mine ? 'YOU' : ICON_NAME[ic.key], ic.x, ic.y + ic.r * 1.25 + 12, 15, mine ? PAL.amber : PAL.dim, { align: 'center', weight: 700, maxW: ic.r * 2.3 });
  }
}

export function renderPlay(ctx, st, L, view, meta, pauseItems) {
  const pl = st.pl, P = L.play, S = L.S;
  const rack = L.rackFor('play', pl.piece.rack, pl.piece.rack === 'bars' ? pl.piece.tun.n : 3), wide = L.mode === 'wide';
  const showEns = pl.mode === 'perform' || pl.mode === 'auto' || (pl.learn && pl.learn.final);
  drawStage(ctx, st, L, pl, rack, pl);
  const bar = curBar(pl), kind = bar ? bar.kind : pl.t < 0.5 ? 'count' : null;
  const mx = rack.ax + rack.aw / 2, laneMid = rack.laneTop + (rack.top - rack.laneTop) * 0.42;
  meta.previewBadge = wide ? { x: mx, y: S.y + 70, align: 'center' } : { x: S.x + S.w / 2, y: rack.laneTop + 8, align: 'center' };

  // ---- big count-in numbers and banners
  if (bar && bar.kind === 'count') {
    const n = clamp(Math.floor((pl.t - bar.t0) / ((bar.t1 - bar.t0) / 4)) + 1, 1, 4), ph = ((pl.t - bar.t0) / ((bar.t1 - bar.t0) / 4)) % 1;
    ctx.save(); ctx.globalAlpha = 0.9 * (1 - ph * 0.6);
    txt(ctx, String(n), mx, laneMid, 180 * (1 + 0.12 * (1 - ph)), PAL.gold, { align: 'center', font: DISPLAY, weight: 800, stroke: 14 });
    ctx.restore();
  } else if (pl.banner) {
    const k = pl.banner.t / 1.6, a = k < 0.15 ? k / 0.15 : k > 0.7 ? (1 - k) / 0.3 : 1;
    ctx.save(); ctx.globalAlpha = clamp(a, 0, 1);
    txt(ctx, pl.banner.text, mx, laneMid, 58, PAL.gold, { align: 'center', font: DISPLAY, weight: 800, stroke: 10, maxW: rack.aw - 30 });
    ctx.restore();
  }
  if (bar && bar.kind !== 'count' && pl.mode === 'learn' && !pl.learn.final) {
    const k = (pl.t - bar.t0) / (bar.t1 - bar.t0), first = bar.bar % 2 === 0;
    if (first && k < 1) { ctx.save(); ctx.globalAlpha = clamp(1 - k, 0, 1) * 0.9; txt(ctx, KIND_LABEL[bar.kind], mx, laneMid, 72, KIND_COL[bar.kind], { align: 'center', font: DISPLAY, weight: 800, stroke: 10, maxW: rack.aw - 30 }); ctx.restore(); }
  }
  // Why this strike? (Watch and Learn and the Listen half of Learn)
  if (pl.why && (pl.mode === 'auto' || (pl.mode === 'learn' && bar && bar.kind === 'listen'))) {
    const a = clamp(Math.min(pl.why.t / 0.2, (4.5 - pl.why.t) / 0.5), 0, 1), ww = Math.min(rack.aw - 28, 640), size = wide ? 26 : 28;
    ctx.save(); ctx.globalAlpha = a; ctx.font = `600 ${size}px ${UI}`;
    const lines = wrap(ctx, pl.why.text, ww - 40), bh = lines.length * (size * 1.3) + 26, by = rack.laneTop + (wide ? 4 : 6);
    panel(ctx, { x: mx - ww / 2, y: by, w: ww, h: bh }, { fill: 'rgba(26,10,8,0.84)', rad: 18, stroke: 'rgba(242,207,124,0.5)' });
    lines.forEach((ln, i) => txt(ctx, ln, mx, by + 13 + size * 0.65 + i * size * 1.3, size, PAL.text, { align: 'center', weight: 600 }));
    ctx.restore();
  }

  // ---- HUD
  const total = pl.chunks[0] && (pl.mode !== 'learn') ? pl.chunks[0].t1 : 0;
  let prog = 0;
  if (pl.mode === 'learn') prog = (pl.learn.final ? 4 + clamp((pl.t - pl.cur.t0) / (pl.cur.t1 - pl.cur.t0), 0, 1) : pl.learn.phrase) / 5; else if (total) prog = clamp(pl.t / total, 0, 1);
  ctx.fillStyle = 'rgba(255,240,220,0.12)'; ctx.fillRect(S.x, S.y, S.w, 5); ctx.fillStyle = PAL.amber; ctx.fillRect(S.x, S.y, S.w * prog, 5);
  const acc = pl.accN ? pl.accSum / pl.accN : 1;
  const mult = comboMult(pl.combo);
  if (wide) {
    const lc = P.left, rc = P.right;
    panel(ctx, lc); edgeStroke(ctx, lc, 24, 0.35); panel(ctx, rc); edgeStroke(ctx, rc, 24, 0.35);
    txt(ctx, 'SCORE', lc.x + 22, lc.y + 34, 22, PAL.gold, { weight: 800 });
    txt(ctx, String(pl.score), lc.x + 22, lc.y + 82, 54, PAL.text, { font: DISPLAY, weight: 800, maxW: lc.w - 44 });
    txt(ctx, 'COMBO', lc.x + 22, lc.y + 150, 22, PAL.gold, { weight: 800 });
    txt(ctx, String(pl.combo), lc.x + 22, lc.y + 200, 60, pl.combo >= 10 ? PAL.amberHi : PAL.text, { font: DISPLAY, weight: 800 });
    if (mult > 1) chip(ctx, lc.x + lc.w - 18, lc.y + 146, `x${mult}`, 24, { align: 'right', fill: '#c9701f', color: '#fff' });
    txt(ctx, 'ACCURACY', lc.x + 22, lc.y + 262, 22, PAL.gold, { weight: 800 });
    txt(ctx, `${Math.round(acc * 100)}%`, lc.x + 22, lc.y + 306, 46, PAL.text, { font: DISPLAY, weight: 800 });
    let yy = lc.y + 360;
    for (const k of ['perfect', 'great', 'good', 'off', 'miss']) { txt(ctx, (k === 'off' ? 'nearly' : k).toUpperCase(), lc.x + 18, yy, 18, PAL.dim, { weight: 700, maxW: lc.w * 0.55 }); txt(ctx, String(pl.counts[k]), lc.x + lc.w - 18, yy, 20, PAL.text, { align: 'right', weight: 800 }); yy += 34; }
    drawBadgeStack(ctx, lc.x + lc.w / 2, lc.y + lc.h - 14, lc.w - 40);
    drawEnsemble(ctx, st, L, pl, P, true);
    const ens = P.ens;
    if (showEns && ens.h > 80) {
      txt(ctx, 'ENSEMBLE', ens.x + ens.w / 2, ens.y + 14, 18, PAL.gold, { align: 'center', weight: 800 });
      const rh = Math.min(38, (ens.h - 34) / 4);
      ['Cycle', 'Slenthem', 'Peking', 'Shimmer'].forEach((n, i) => {
        const on = i <= pl.ens, y2 = ens.y + 30 + i * (rh + 6);
        ctx.fillStyle = on ? 'rgba(242,207,124,0.28)' : 'rgba(255,240,220,0.07)'; rrect(ctx, { x: ens.x, y: y2, w: ens.w, h: rh }, 10); ctx.fill();
        txt(ctx, n, ens.x + 12, y2 + rh / 2, 19, on ? PAL.text : PAL.dim, { weight: 700 });
      });
    } else if (pl.learn && ens.h > 60) {
      txt(ctx, `PHRASE ${Math.min(pl.learn.phrase + 1, 4)} OF 4`, ens.x + ens.w / 2, ens.y + 20, 22, PAL.gold, { align: 'center', weight: 800 });
      txt(ctx, pl.learn.attempt > 1 ? 'second try' : 'listen, then echo', ens.x + ens.w / 2, ens.y + 54, 20, PAL.dim, { align: 'center', weight: 600 });
    }
    if (pl.mode === 'learn' && !pl.learn.final) button(ctx, P.hint, 'Listen', { icon: 'ear', kind: 'quiet', size: 28 });
    button(ctx, P.pause, 'Pause', { icon: 'pause', kind: 'ghost', size: 28 });
    if (kind) chip(ctx, mx, S.y + 40, KIND_LABEL[kind] + ` · ${pl.piece.name}`, 24, { align: 'center', color: KIND_COL[kind], fill: 'rgba(26,10,8,0.72)' });
  } else {
    const sc = P.score, tall = L.mode === 'tall';
    txt(ctx, 'SCORE', sc.x + 8, sc.y + 18, 20, PAL.gold, { weight: 800 });
    txt(ctx, String(pl.score), sc.x + 8, sc.y + 56, tall ? 54 : 46, PAL.text, { font: DISPLAY, weight: 800, maxW: sc.w * 0.6 });
    txt(ctx, 'COMBO', sc.x + sc.w - 8, sc.y + 18, 20, PAL.gold, { align: 'right', weight: 800 });
    txt(ctx, String(pl.combo), sc.x + sc.w - 8 - (mult > 1 ? 74 : 0), sc.y + 56, tall ? 54 : 46, pl.combo >= 10 ? PAL.amberHi : PAL.text, { align: 'right', font: DISPLAY, weight: 800 });
    if (mult > 1) chip(ctx, sc.x + sc.w - 8, sc.y + 54, `x${mult}`, 24, { align: 'right', fill: '#c9701f', color: '#fff' });
    button(ctx, P.pause, '', { icon: 'pause', kind: 'ghost', rad: 18 });
    if (pl.mode === 'learn' && !pl.learn.final) button(ctx, P.hint, '', { icon: 'ear', kind: 'quiet', rad: 18 });
    const cy = P.chipsY;
    chip(ctx, S.x + 24, cy, `${Math.round(acc * 100)}%`, 22, { fill: 'rgba(26,10,8,0.66)' });
    if (kind) chip(ctx, S.x + S.w - 24, cy, KIND_LABEL[kind], 22, { align: 'right', color: KIND_COL[kind], fill: 'rgba(26,10,8,0.66)' });
    if (pl.mode === 'learn' && !pl.learn.final) txt(ctx, `Phrase ${Math.min(pl.learn.phrase + 1, 4)} of 4`, S.x + S.w / 2, cy, 24, PAL.gold, { align: 'center', weight: 800 });
    else if (pl.mode === 'learn') txt(ctx, 'Final take', S.x + S.w / 2, cy, 24, PAL.gold, { align: 'center', weight: 800 });
    else if (pl.mode === 'perform') ensPips(ctx, S.x + S.w / 2 - 110, cy, 260, pl.ens, pl.layerFlash, false);
    else txt(ctx, 'WATCH AND LEARN' + (pl.speed < 1 ? ' · 75%' : ''), S.x + S.w / 2, cy, 22, PAL.jadeHi, { align: 'center', weight: 800 });
    drawEnsemble(ctx, st, L, pl, P, false);
  }

  // ---- overlays
  if (pl.paused || pl.over) {
    ctx.fillStyle = 'rgba(10,3,2,0.68)'; ctx.fillRect(0, 0, L.w, L.h);
    const items = pauseItems(pl), M = menuRects(L, items.length, 130);
    panel(ctx, M.panel, { fill: 'rgba(32,12,9,0.95)' }); edgeStroke(ctx, M.panel, 24, 0.6);
    txt(ctx, pl.over ? 'Piece finished' : 'Paused', M.panel.x + M.panel.w / 2, M.panel.y + 66, 44, PAL.gold, { align: 'center', font: DISPLAY, weight: 800, stroke: 6 });
    const names = { resume: 'Resume', restart: 'Restart', quit: 'Leave piece', listen: 'Listen to the phrase', speed: pl.speed < 1 ? 'Speed: 75% (tap for 100%)' : 'Speed: 100% (tap for 75%)', next: 'Next piece', again: 'Watch again', exit: 'Back to the piece' };
    items.forEach((it, i) => button(ctx, M.btns[i], names[it], { kind: i === 0 ? 'primary' : 'ghost', size: 30 }));
  }
}

// ---- free play ---------------------------------------------------------------------------------------------------------------------------------------
export function renderFree(ctx, st, L, meta) {
  const f = st.free, F = L.free, S = L.S, rack = L.rackFor('free', 'free', TUNINGS[f.tuning].n);
  meta.previewBadge = { x: S.x + S.w - 12, y: S.y + 16, align: 'right' };
  drawStage(ctx, st, L, f, rack, null);
  button(ctx, F.exit, 'Back', { icon: 'back', kind: 'ghost', size: 28 });
  button(ctx, F.metro, 'Click', { icon: 'metro', kind: f.metro ? 'on' : 'ghost', size: 26 });
  button(ctx, F.tempoDec, '', { icon: 'minus', kind: 'quiet' });
  button(ctx, F.tempoInc, '', { icon: 'plus', kind: 'quiet' });
  txt(ctx, `${f.bpm} bpm`, (F.tempoDec.x + F.tempoInc.x + F.tempoInc.w) / 2, F.tempoDec.y - 18, 22, PAL.gold, { align: 'center', weight: 800 });
  button(ctx, F.echo, 'Echo', { icon: 'echo', kind: f.echo ? 'on' : 'ghost', size: 26 });
  button(ctx, F.tuning, TUNINGS[f.tuning].name, { icon: 'bars', kind: 'quiet', size: 26 });
  if (f.metro) { ctx.save(); ctx.globalAlpha = 0.5 * f.pulse; ctx.fillStyle = PAL.gold; ctx.beginPath(); ctx.arc(F.metro.x + F.metro.w - 24, F.metro.y + 24, 9, 0, 6.3); ctx.fill(); ctx.restore(); }
  if (L.mode === 'wide') {
    const mid = F.left;
    panel(ctx, mid); edgeStroke(ctx, mid, 24, 0.35);
    txt(ctx, 'FREE PLAY', mid.x + mid.w / 2, mid.y + 44, 26, PAL.gold, { align: 'center', font: DISPLAY, weight: 800, maxW: mid.w - 30 });
    const tips = ['Tap the bars to play', 'The gongs sit above', 'Use both thumbs', 'Stop, and the ensemble answers'];
    ctx.font = `500 21px ${UI}`;
    tips.forEach((tp, i) => wrapText(ctx, tp, mid.x + 18, mid.y + 100 + i * 84, mid.w - 36, 26, PAL.text));
    drawBadgeStack(ctx, mid.x + mid.w / 2, mid.y + mid.h - 14, mid.w - 40);
  } else {
    txt(ctx, 'FREE PLAY', S.x + S.w / 2, F.info.y + F.info.h / 2, 34, PAL.gold, { align: 'center', font: DISPLAY, weight: 800, stroke: 6, maxW: S.w * 0.4 });
    txt(ctx, f.echo ? (f.hits ? 'Stop for a moment and the ensemble answers' : 'Tap the bars. The gongs are above them.') : 'Tap the bars. The gongs are above them.', S.x + S.w / 2, F.info.y + F.info.h + 28, 22, PAL.dim, { align: 'center', weight: 600, maxW: S.w - 40 });
  }
}
function wrapText(ctx, s, x, y, maxW, lh, col) {
  ctx.fillStyle = col; ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
  let line = '', yy = y; for (const w of s.split(' ')) { const nx = line ? line + ' ' + w : w; if (line && ctx.measureText(nx).width > maxW) { ctx.fillText(line, x, yy); yy += lh; line = w; } else line = nx; }
  ctx.fillText(line, x, yy);
}

// ---- calibration ------------------------------------------------------------------------------------------------------------------------------------------
export function renderCalib(ctx, st, L) {
  const c = st.cal, C = L.calib, S = L.S;
  drawBackdrop(ctx, L.w + 20, L.h + 20, st.t, c.pulse);
  button(ctx, C.back, 'Back', { icon: 'back', kind: 'ghost', size: 28 });
  txt(ctx, 'Calibrate', S.x + S.w / 2, S.y + 140, 54, PAL.gold, { align: 'center', font: DISPLAY, weight: 800, stroke: 8 });
  const p = C.pad, r = p.r * (1 + 0.06 * c.pulse);
  drawGong(ctx, { cx: p.x, cy: p.y, r }, 'kenong', { flash: c.flash, ring: c.pulse * 0.6 });
  if (c.phase === 'run') {                                                   // a ring that closes on the next beat
    const next = c.T0 + (Math.floor(Math.max(0, (c.t - c.T0)) * c.bpm / 60) + (c.t < c.T0 ? 0 : 1)) * 60 / c.bpm, u = clamp((next - c.t) / (60 / c.bpm), 0, 1);
    ctx.strokeStyle = `rgba(242,217,138,${0.9 - u * 0.5})`; ctx.lineWidth = 6; ctx.beginPath(); ctx.arc(p.x, p.y, r * (1.1 + 0.55 * u), 0, 6.3); ctx.stroke();
  }
  const msg = c.phase === 'run' ? (c.t < c.T0 ? 'Get ready: tap anywhere on every beat' : c.lastBeat < 4 ? 'Keep time, tap on every beat' : `Now counting: ${Math.min(c.taps.length, 99)} taps`) : c.result.ms === null ? 'Not enough taps. Try once more.' : `Your latency: ${c.result.ms} ms`;
  txt(ctx, msg, S.x + S.w / 2, p.y + p.r * 1.62 + 56, 34, c.phase === 'done' ? PAL.gold : PAL.text, { align: 'center', weight: 700, maxW: S.w - 40 });
  if (c.phase === 'done') {
    txt(ctx, c.result.ms === null ? 'Tap along with the pulse, not before it.' : 'Positive means the sound reaches you late; the game now allows for it.', S.x + S.w / 2, p.y + p.r * 1.62 + 100, 22, PAL.dim, { align: 'center', maxW: S.w - 40 });
    button(ctx, C.retry, 'Try again', { kind: 'ghost', size: 30 });
    button(ctx, C.use, c.result.ms === null ? 'Back' : 'Use this', { kind: 'primary', size: 30 });
  }
}
