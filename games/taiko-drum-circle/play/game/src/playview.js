// Drawing for the playing screens: the stage (lanes, notes, drums, sticks, sparks), the HUD, free play and calibration.
import { PAL, UI, DISPLAY, rgba, drawBackdrop, drawFloor, drawDrum, drawSticks, drawBell, drawNote, drawPopup, drawParticles, drawLane } from './art.js';
import { txt, button, panel, rrect, chip, icon } from './ui.js';
import { menuRects } from './layout.js';
import { SPEEDS, DRUMS, PIECES, ENSEMBLE, barDur, comboMult } from './music.js';
import { drawCredit, edgeStroke } from './brand.js';

const prevLifts = [];                                                  // last frame's stick lifts per drum (motion trail only)
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const exp = Math.exp;

function curBar(pl) {
  for (let i = pl.bars.length - 1; i >= 0; i--) if (pl.bars[i].t0 <= pl.t) return pl.bars[i].t1 > pl.t ? pl.bars[i] : null;
  return null;
}
function lowerBound(ev, t) { let lo = 0, hi = ev.length; while (lo < hi) { const m = (lo + hi) >> 1; if (ev[m].t < t) lo = m + 1; else hi = m; } return lo; }
const evOnNow = (pl, e) => (e.on !== undefined ? e.on : e.who === 'ens' ? e.layer <= pl.ens : e.who === 'teach');

// Stick lifts per drum and hand, from the fired and upcoming events plus the player's own strikes.
function lifts(sess, t, d) {
  const dr = sess.dr[d], out = [0.6, 0.6], glow = [0, 0];
  for (let h = 0; h < 2; h++) {
    const since = t - dr.hit[h];
    glow[h] = since >= 0 && since < 0.1 ? 1 - since / 0.1 : 0;
    out[h] = since >= 0 ? 0.6 * (1 - exp(-since / 0.07)) : 0.6;
  }
  return { out, glow };
}
function evLifts(pl, t, info) {
  const lo = lowerBound(pl.ev, t - 0.5);
  for (let i = lo; i < pl.ev.length && pl.ev[i].t < t + 0.45; i++) {
    const e = pl.ev[i];
    if (e.drum < 0 || e.drum > 4 || e.hand === undefined || e.who === 'note' || !evOnNow(pl, e)) continue;
    const slot = info[e.drum];
    if (e.t <= t) slot.prev[e.hand] = Math.max(slot.prev[e.hand], e.t); else slot.next[e.hand] = Math.min(slot.next[e.hand], e.t);
  }
}

export function drawStage(ctx, st, L, sess, G, o) {
  const { w, h } = L, t = sess.t, pulse = sess.pulse;
  const pl = o.pl;
  ctx.save();
  if (sess.shake > 0.01 && !st.prefs.calm) ctx.translate(Math.sin(st.t * 90) * sess.shake * 4, Math.cos(st.t * 80) * sess.shake * 3);
  drawBackdrop(ctx, w + 20, h + 20, st.t, pulse);
  const rowH = G.rowH, floorTop = G.floorTop ?? G.cyBase - rowH * 0.2;
  drawFloor(ctx, w, h, floorTop, G.ax + G.aw / 2, pulse);
  const appr = SPEEDS[st.prefs.speedIdx].approach;
  const info = G.drums.map(() => ({ prev: [-9, -9], next: [99999, 99999] }));
  info[4] = { prev: [-9, -9], next: [99999, 99999] };
  if (pl) evLifts(pl, t, info);

  // lanes + notes
  if (pl) {
    const players = pl.piece.player;
    for (const dr of G.drums) {
      const mine = players.includes(dr.i), wBot = dr.lw, wTop = wBot * 0.5, near = sess.dr[dr.i].flash;
      drawLane(ctx, dr.cx, G.laneTop, dr.cy, wTop, wBot, near, !mine);
    }
    // beat lines
    for (const b of pl.bars) {
      if (b.t1 < t - 0.1 || b.t0 > t + appr) continue;
      const bd = (b.t1 - b.t0) / 4;
      for (let j = 0; j < 4; j++) {
        const tb = b.t0 + j * bd, p = 1 - (tb - t) / appr; if (p < 0 || p > 1.05) continue;
        for (const dr of G.drums) {
          if (!players.includes(dr.i)) continue;
          const y = G.laneTop + (dr.cy - G.laneTop) * p, wk = 0.5 + 0.5 * p, ww = dr.lw * wk;
          ctx.strokeStyle = j === 0 ? 'rgba(255,230,190,0.5)' : 'rgba(255,230,190,0.16)'; ctx.lineWidth = j === 0 ? 3 : 1.5;
          ctx.beginPath(); ctx.moveTo(dr.cx - ww / 2, y); ctx.lineTo(dr.cx + ww / 2, y); ctx.stroke();
        }
      }
    }
    const lo = lowerBound(pl.ev, t - 0.3);
    for (let i = lo; i < pl.ev.length; i++) {
      const e = pl.ev[i]; if (e.t > t + appr) break;
      if (e.drum < 0 || e.drum > 3) continue;
      const dr = G.drums[e.drum], p = 1 - (e.t - t) / appr, y = G.laneTop + (dr.cy - G.laneTop) * p, sc = 0.5 + 0.5 * clamp(p, 0, 1);
      const nr = clamp(dr.rx * 0.5, 24, 58) * sc;
      if (e.who === 'note') {
        if (e.j && e.j !== 'miss') continue;
        drawNote(ctx, dr.cx, y, nr, e.k, e.soft, st.prefs.labels ? (e.k === 'D' ? 'don' : 'ka') : null, e.j === 'miss' ? 0.35 : clamp(p * 3, 0, 1));
      } else if (e.who === 'teach') {
        if (e.t <= t) continue;
        drawNote(ctx, dr.cx, y, nr, e.k, e.soft, null, clamp(p * 3, 0, 1), pl.mode !== 'auto');
      } else if (e.who === 'ens' && !pl.piece.player.includes(e.drum) && evOnNow(pl, e) && e.t > t) {
        drawNote(ctx, dr.cx, y, nr * 0.42, e.k, true, null, 0.45 * clamp(p * 3, 0, 1), true);
      }
    }
  }

  // drums, sticks (back to front, so overlapping drums stack correctly)
  for (const dr of G.drums.slice().sort((a, b) => a.cy - b.cy)) {
    const d = dr.i, s = sess.dr[d], li = lifts(sess, t, d), mine = pl ? pl.piece.player.includes(d) : true;
    const inf = info[d];
    const lv = [0, 1].map((hnd) => {
      const sinceEv = t - inf.prev[hnd], untilEv = inf.next[hnd] - t;
      const a = sinceEv >= 0 ? 0.6 * (1 - exp(-sinceEv / 0.07)) : 0.6, b = 0.6 * clamp(untilEv / 0.16, 0, 1);
      return Math.min(li.out[hnd], a, b) + Math.sin(st.t * 2 + d + hnd * 2) * 0.025;
    });
    let incD = 0, incK = 0;
    if (pl && mine) {
      const arr = pl.nd[d]; for (let i = pl.np[d]; i < arr.length && i < pl.np[d] + 4; i++) { const n = arr[i]; if (n.j) continue; const u = n.t - t; if (u < 0.5 && u > -0.15) { const v = 1 - Math.max(0, u) / 0.5; if (n.k === 'D') incD = Math.max(incD, v); else incK = Math.max(incK, v); } break; }
    }
    const ensOnly = pl && !mine;
    const dim = ensOnly ? clamp((t - s.fireT - 1.4) / 0.8, 0, 1) * 0.5 : 0;
    drawDrum(ctx, dr.cx, dr.cy, dr.rx, d, { flash: s.flash, zone: s.zone, kx: s.kx, ky: s.ky, rip: s.rip, incD, incK, dim, lift: s.flash * 3 });
    drawSticks(ctx, dr, lv, li.glow, prevLifts[d]);
    prevLifts[d] = lv.slice();
  }
  if (o.bell) {
    const b = o.bell, s = sess.dr[4];
    const dim = pl ? clamp((t - s.fireT - 2.0) / 0.8, 0, 1) * 0.5 : 0.5;
    drawBell(ctx, b.x, b.y, b.r, { flash: s.flash, swing: s.flash * Math.sin(st.t * 30), dim });
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
const KIND_COL = { count: PAL.dim, listen: PAL.iceHi, echo: PAL.emberHi, play: PAL.gold, auto: PAL.iceHi };

export function renderPlay(ctx, st, L, view, meta, pauseItems) {
  const pl = st.pl, P = L.play, G = P.stage, S = L.S;
  const showEns = pl.mode === 'perform' || pl.mode === 'auto' || (pl.learn && pl.learn.final);
  drawStage(ctx, st, L, pl, G, { pl, bell: P.bell });
  const bar = curBar(pl), kind = bar ? bar.kind : pl.t < 0.5 ? 'count' : null;
  // preview pill placement (kit): out of the HUD's way
  meta.previewBadge = L.mode === 'wide' ? { x: G.ax + G.aw / 2, y: S.y + 70, align: 'center' } : { x: S.x + S.w / 2, y: G.laneTop + 8, align: 'center' };

  // ---- big count-in numbers and banners
  if (bar && bar.kind === 'count') {
    const n = clamp(Math.floor((pl.t - bar.t0) / ((bar.t1 - bar.t0) / 4)) + 1, 1, 4), ph = ((pl.t - bar.t0) / ((bar.t1 - bar.t0) / 4)) % 1;
    ctx.save(); ctx.globalAlpha = 0.9 * (1 - ph * 0.6);
    txt(ctx, String(n), G.ax + G.aw / 2, G.laneTop + (G.cyBase - G.laneTop) * 0.45, 190 * (1 + 0.12 * (1 - ph)), PAL.gold, { align: 'center', font: DISPLAY, weight: 400, stroke: 14 });
    ctx.restore();
  } else if (pl.banner) {
    const k = pl.banner.t / 1.6, a = k < 0.15 ? k / 0.15 : k > 0.7 ? (1 - k) / 0.3 : 1;
    ctx.save(); ctx.globalAlpha = clamp(a, 0, 1);
    txt(ctx, pl.banner.text, G.ax + G.aw / 2, G.laneTop + (G.cyBase - G.laneTop) * 0.4, 70, PAL.gold, { align: 'center', font: DISPLAY, weight: 400, stroke: 10, maxW: G.aw - 30 });
    ctx.restore();
  }
  if (bar && bar.kind !== 'count' && pl.mode === 'learn' && !pl.learn.final) {
    const k = (pl.t - bar.t0) / (bar.t1 - bar.t0), first = bar.bar % 2 === 0;
    if (first && k < 1) { ctx.save(); ctx.globalAlpha = clamp(1 - k, 0, 1) * 0.9; txt(ctx, KIND_LABEL[bar.kind], G.ax + G.aw / 2, G.laneTop + (G.cyBase - G.laneTop) * 0.4, 84, KIND_COL[bar.kind], { align: 'center', font: DISPLAY, weight: 400, stroke: 10, maxW: G.aw - 30 }); ctx.restore(); }
  }

  // ---- HUD
  const total = pl.chunks[0] && (pl.mode !== 'learn') ? pl.chunks[0].t1 : 0;
  let prog = 0;
  if (pl.mode === 'learn') prog = (pl.learn.final ? 4 + clamp((pl.t - pl.cur.t0) / (pl.cur.t1 - pl.cur.t0), 0, 1) : pl.learn.phrase) / 5; else if (total) prog = clamp(pl.t / total, 0, 1);
  ctx.fillStyle = 'rgba(255,240,220,0.12)'; ctx.fillRect(S.x, S.y, S.w, 5); ctx.fillStyle = PAL.ember; ctx.fillRect(S.x, S.y, S.w * prog, 5);
  const acc = pl.accN ? pl.accSum / pl.accN : 1;
  const mult = comboMult(pl.combo);
  if (L.mode === 'wide') {
    const lc = P.left, rc = P.right;
    panel(ctx, lc); edgeStroke(ctx, lc, 24, 0.35); panel(ctx, rc); edgeStroke(ctx, rc, 24, 0.35);
    txt(ctx, 'SCORE', lc.x + 22, lc.y + 34, 22, PAL.gold, { weight: 800 });
    txt(ctx, String(pl.score), lc.x + 22, lc.y + 82, 54, PAL.text, { font: DISPLAY, weight: 400, maxW: lc.w - 44 });
    txt(ctx, 'COMBO', lc.x + 22, lc.y + 150, 22, PAL.gold, { weight: 800 });
    txt(ctx, String(pl.combo), lc.x + 22, lc.y + 200, 60, pl.combo >= 10 ? PAL.emberHi : PAL.text, { font: DISPLAY, weight: 400 });
    if (mult > 1) chip(ctx, lc.x + lc.w - 18, lc.y + 146, `x${mult}`, 24, { align: 'right', fill: PAL.ember, color: '#fff' });
    txt(ctx, 'ACCURACY', lc.x + 22, lc.y + 262, 22, PAL.gold, { weight: 800 });
    txt(ctx, `${Math.round(acc * 100)}%`, lc.x + 22, lc.y + 306, 46, PAL.text, { font: DISPLAY, weight: 400 });
    let yy = lc.y + 360;
    for (const k of ['perfect', 'great', 'good', 'off', 'miss']) { txt(ctx, k.toUpperCase(), lc.x + 18, yy, 18, PAL.dim, { weight: 700, maxW: lc.w * 0.55 }); txt(ctx, String(pl.counts[k]), lc.x + lc.w - 18, yy, 20, PAL.text, { align: 'right', weight: 800 }); yy += 34; }
    drawCredit(ctx, lc.x + lc.w / 2, lc.y + lc.h - 18, 11.5, { dim: 0.8 });
    // right: bell, layers
    txt(ctx, DRUMS[4].name.toUpperCase(), rc.x + rc.w / 2, rc.y + 34, 20, PAL.gold, { align: 'center', weight: 800 });
    if (showEns) {
      const ys = rc.y + 220, rh = 46;
      ['Base groove', 'Layer 1', 'Layer 2', 'Layer 3'].forEach((n, i) => {
        const on = i <= pl.ens, yy2 = ys + i * (rh + 8);
        ctx.fillStyle = on ? 'rgba(246,217,138,0.28)' : 'rgba(255,240,220,0.07)'; rrect(ctx, { x: rc.x + 14, y: yy2, w: rc.w - 28, h: rh }, 12); ctx.fill();
        txt(ctx, n, rc.x + 28, yy2 + rh / 2, 22, on ? PAL.text : PAL.dim, { weight: 700 });
      });
      txt(ctx, 'ENSEMBLE', rc.x + rc.w / 2, rc.y + 196, 20, PAL.gold, { align: 'center', weight: 800 });
    } else if (pl.learn) {
      txt(ctx, `PHRASE ${Math.min(pl.learn.phrase + 1, 4)} OF 4`, rc.x + rc.w / 2, rc.y + 220, 24, PAL.gold, { align: 'center', weight: 800 });
      txt(ctx, pl.learn.attempt > 1 ? 'second try' : 'listen, then echo', rc.x + rc.w / 2, rc.y + 256, 22, PAL.dim, { align: 'center', weight: 600 });
    }
    if (pl.mode === 'learn' && !pl.learn.final) button(ctx, P.hint, 'Listen', { icon: 'ear', kind: 'quiet', size: 28 });
    button(ctx, P.pause, 'Pause', { icon: 'pause', kind: 'ghost', size: 28 });
    // top strip
    if (kind) chip(ctx, G.ax + G.aw / 2, S.y + 40, KIND_LABEL[kind] + (pl.mode === 'learn' ? ` · ${pl.piece.name}` : ` · ${pl.piece.name}`), 24, { align: 'center', color: KIND_COL[kind], fill: 'rgba(14,10,36,0.7)' });
  } else {
    const sc = P.score, tall = L.mode === 'tall';
    txt(ctx, 'SCORE', sc.x + 8, sc.y + 18, 20, PAL.gold, { weight: 800 });
    txt(ctx, String(pl.score), sc.x + 8, sc.y + 56, tall ? 54 : 46, PAL.text, { font: DISPLAY, weight: 400, maxW: sc.w * 0.6 });
    txt(ctx, 'COMBO', sc.x + sc.w - 8, sc.y + 18, 20, PAL.gold, { align: 'right', weight: 800 });
    txt(ctx, String(pl.combo), sc.x + sc.w - 8 - (mult > 1 ? 74 : 0), sc.y + 56, tall ? 54 : 46, pl.combo >= 10 ? PAL.emberHi : PAL.text, { align: 'right', font: DISPLAY, weight: 400 });
    if (mult > 1) chip(ctx, sc.x + sc.w - 8, sc.y + 54, `x${mult}`, 24, { align: 'right', fill: PAL.ember, color: '#fff' });
    button(ctx, P.pause, '', { icon: 'pause', kind: 'ghost', rad: 18 });
    if (pl.mode === 'learn' && !pl.learn.final) button(ctx, P.hint, '', { icon: 'ear', kind: 'quiet', rad: 18 });
    const cy = P.hudTop.y + 106;
    chip(ctx, S.x + 24 + 0, cy, `${Math.round(acc * 100)}% accuracy`, 22, { fill: 'rgba(14,10,36,0.6)' });
    if (kind) chip(ctx, S.x + S.w - 24, cy, KIND_LABEL[kind], 22, { align: 'right', color: KIND_COL[kind], fill: 'rgba(14,10,36,0.6)' });
    if (pl.mode === 'learn' && !pl.learn.final) txt(ctx, `Phrase ${Math.min(pl.learn.phrase + 1, 4)} of 4`, P.ens.x, P.ens.y + 22, 24, PAL.gold, { weight: 800 });
    else if (pl.mode === 'learn') txt(ctx, 'Final take', P.ens.x, P.ens.y + 22, 24, PAL.gold, { weight: 800 });
    else ensPips(ctx, P.ens.x, P.ens.y + 22, P.ens.w, pl.ens, pl.layerFlash);
    if (showEns && pl.mode === 'learn') ensPips(ctx, P.ens.x + 200, P.ens.y + 22, P.ens.w - 200, pl.ens, pl.layerFlash, false);
  }
  if (pl.mode === 'auto') { const m = L.mode === 'wide' ? { x: G.ax + G.aw / 2, y: S.y + 100 } : { x: S.x + S.w / 2, y: P.hudTop.y + 106 }; chip(ctx, m.x, m.y, `WATCH AND LEARN${pl.speed < 1 ? ' · 75%' : ''}`, 22, { align: 'center', fill: 'rgba(79,195,255,0.25)', color: PAL.iceHi }); }

  // ---- overlays
  if (pl.paused || pl.over) {
    ctx.fillStyle = 'rgba(6,4,18,0.66)'; ctx.fillRect(0, 0, L.w, L.h);
    const items = pauseItems(pl), M = menuRects(L, items.length, 130);
    panel(ctx, M.panel, { fill: 'rgba(18,12,44,0.94)' }); edgeStroke(ctx, M.panel, 24, 0.6);
    txt(ctx, pl.over ? 'Piece finished' : 'Paused', M.panel.x + M.panel.w / 2, M.panel.y + 66, 44, PAL.gold, { align: 'center', font: DISPLAY, weight: 400, stroke: 6 });
    const names = { resume: 'Resume', restart: 'Restart', quit: 'Leave piece', listen: 'Listen to the phrase', speed: pl.speed < 1 ? 'Speed: 75% (tap for 100%)' : 'Speed: 100% (tap for 75%)', next: 'Next piece', again: 'Watch again', exit: 'Back to the piece' };
    items.forEach((it, i) => button(ctx, M.btns[i], names[it], { kind: i === 0 ? 'primary' : 'ghost', size: 30 }));
  }
}

function drawBellLabel(ctx, b) { txt(ctx, 'BELL', b.x - b.r * 2.6, b.y + b.r * 0.2, 16, PAL.dim, { weight: 700, align: 'right' }); }

// ---- free play ---------------------------------------------------------------------------------------------------------------------------------------
export function renderFree(ctx, st, L, meta) {
  const f = st.free, F = L.free, G = F.stage, S = L.S;
  meta.previewBadge = { x: S.x + S.w - 12, y: S.y + 16, align: 'right' };
  drawStage(ctx, st, L, f, G, { pl: null, bell: null });
  const bh = F.exit.h;
  button(ctx, F.exit, 'Back', { icon: 'back', kind: 'ghost', size: 28 });
  button(ctx, F.metro, 'Click', { icon: 'metro', kind: f.metro ? 'on' : 'ghost', size: 26 });
  button(ctx, F.tempoDec, '', { icon: 'minus', kind: 'quiet' });
  button(ctx, F.tempoInc, '', { icon: 'plus', kind: 'quiet' });
  txt(ctx, `${f.bpm} bpm`, (F.tempoDec.x + F.tempoInc.x + F.tempoInc.w) / 2, F.tempoDec.y - 18, 22, PAL.gold, { align: 'center', weight: 800 });
  button(ctx, F.echo, 'Echo', { icon: 'echo', kind: f.echo ? 'on' : 'ghost', size: 26 });
  if (f.metro) { ctx.save(); ctx.globalAlpha = 0.5 * f.pulse; ctx.fillStyle = PAL.gold; ctx.beginPath(); ctx.arc(F.metro.x + F.metro.w - 24, F.metro.y + 24, 9, 0, 6.3); ctx.fill(); ctx.restore(); }
  const mid = L.mode === 'wide' ? F.left : { x: F.info.x, y: F.info.y, w: F.info.w, h: F.info.h };
  if (L.mode === 'wide') {
    panel(ctx, mid); edgeStroke(ctx, mid, 24, 0.35);
    txt(ctx, 'FREE PLAY', mid.x + mid.w / 2, mid.y + 44, 26, PAL.gold, { align: 'center', font: DISPLAY, weight: 400, maxW: mid.w - 30 });
    const tips = ['Middle of a drum: don', 'Rim: ka', 'Use both thumbs', 'Stop, and the circle answers'];
    tips.forEach((tp, i) => { ctx.font = `500 21px ${UI}`; wrapText(ctx, tp, mid.x + 18, mid.y + 100 + i * 84, mid.w - 36, 26, PAL.text); });
    drawCredit(ctx, mid.x + mid.w / 2, mid.y + mid.h - 18, 11.5, { dim: 0.8 });
  } else {
    txt(ctx, 'FREE PLAY', S.x + S.w / 2, mid.y + mid.h / 2, 34, PAL.gold, { align: 'center', font: DISPLAY, weight: 400, stroke: 6, maxW: S.w * 0.4 });
    txt(ctx, f.echo ? (f.hits ? 'Stop for a moment and the circle answers' : 'Middle of a drum = don, rim = ka') : 'Middle of a drum = don, rim = ka', S.x + S.w / 2, mid.y + mid.h + 34, 22, PAL.dim, { align: 'center', weight: 600, maxW: S.w - 40 });
  }
  void bh;
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
  txt(ctx, 'Calibrate', S.x + S.w / 2, S.y + 110 + 30, 54, PAL.gold, { align: 'center', font: DISPLAY, weight: 400, stroke: 8 });
  const p = C.pad;
  // pulsing drum-head circle
  const r = p.r * (1 + 0.06 * c.pulse);
  const g = ctx.createRadialGradient(p.x - r * 0.2, p.y - r * 0.25, r * 0.1, p.x, p.y, r);
  g.addColorStop(0, '#fff1d6'); g.addColorStop(0.7, '#dcc79d'); g.addColorStop(1, '#a88a58');
  ctx.fillStyle = '#4a2a14'; ctx.beginPath(); ctx.arc(p.x, p.y, r * 1.06, 0, 6.3); ctx.fill();
  ctx.fillStyle = g; ctx.beginPath(); ctx.arc(p.x, p.y, r, 0, 6.3); ctx.fill();
  ctx.save(); ctx.globalCompositeOperation = 'lighter'; const gl = ctx.createRadialGradient(p.x, p.y, 5, p.x, p.y, r); gl.addColorStop(0, `rgba(255,140,70,${0.6 * c.pulse + 0.7 * c.flash})`); gl.addColorStop(1, 'rgba(255,140,70,0)'); ctx.fillStyle = gl; ctx.beginPath(); ctx.arc(p.x, p.y, r, 0, 6.3); ctx.fill(); ctx.restore();
  // a ring that closes on the next beat
  if (c.phase === 'run') {
    const next = c.T0 + (Math.floor(Math.max(0, (c.t - c.T0)) * c.bpm / 60) + (c.t < c.T0 ? 0 : 1)) * 60 / c.bpm, u = clamp((next - c.t) / (60 / c.bpm), 0, 1);
    ctx.strokeStyle = `rgba(246,217,138,${0.9 - u * 0.5})`; ctx.lineWidth = 6; ctx.beginPath(); ctx.arc(p.x, p.y, r * (1 + 0.55 * u), 0, 6.3); ctx.stroke();
  }
  const msg = c.phase === 'run' ? (c.t < c.T0 ? 'Get ready: tap anywhere on every beat' : c.lastBeat < 4 ? 'Keep time, tap on every beat' : `Now counting: ${Math.min(c.taps.length, 99)} taps`) : c.result.ms === null ? 'Not enough taps. Try once more.' : `Your latency: ${c.result.ms} ms`;
  txt(ctx, msg, S.x + S.w / 2, p.y + p.r * 1.62 + 56, 34, c.phase === 'done' ? PAL.gold : PAL.text, { align: 'center', weight: 700, maxW: S.w - 40 });
  if (c.phase === 'done') {
    txt(ctx, c.result.ms === null ? 'Tap along with the pulse, not before it.' : 'Positive means the sound reaches you late; the game now allows for it.', S.x + S.w / 2, p.y + p.r * 1.62 + 100, 22, PAL.dim, { align: 'center', maxW: S.w - 40 });
    button(ctx, C.retry, 'Try again', { kind: 'ghost', size: 30 });
    button(ctx, C.use, c.result.ms === null ? 'Back' : 'Use this', { kind: 'primary', size: 30 });
  }
}
