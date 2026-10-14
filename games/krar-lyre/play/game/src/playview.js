// Drawing for the playing screens: the lyre with its approach rings, the HUD, the Echo Duel, Compose and calibration.
import { PAL, UI, DISPLAY, WRAPS, CUE, drawBackdrop, drawLyre, drawCue, drawStrumCue, drawDampCue, drawTip, drawPopup, drawParticles } from './art.js';
import { txt, button, panel, rrect, chip, wrap } from './ui.js';
import { menuRects, lyreXAt } from './layout.js';
import { SPEEDS, QENETS, DUEL, STRING_COUNT, comboMult, soundName } from './music.js';
import { drawCredit, edgeStroke } from './brand.js';

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const TAU = Math.PI * 2;

function curBar(pl) {
  for (let i = pl.bars.length - 1; i >= 0; i--) if (pl.bars[i].t0 <= pl.t) return pl.bars[i].t1 > pl.t ? pl.bars[i] : null;
  return null;
}
const usedCache = new WeakMap();
function usedStrings(piece) {                                     // the strings a piece asks for: the others are drawn quiet
  let u = usedCache.get(piece);
  if (!u) {
    u = new Set();
    for (const part of piece.parts.player) for (const pat of Object.values(part.pat)) for (const c of pat) {
      if (c >= '1' && c <= '6') u.add(+c); else if (c >= 'a' && c <= 'f') u.add(c.charCodeAt(0) - 96);
      else if ('^v~=%$'.includes(c)) ({ '^': [1, 2, 3, 4], v: [4, 3, 2, 1], '~': [2, 3, 4, 5], '=': [5, 4, 3, 2], '%': [3, 4, 5, 6], $: [6, 5, 4, 3] })[c].forEach((k) => u.add(k));
    }
    usedCache.set(piece, u);
  }
  return u;
}

// The lyre, cues, tips, sparks, popups for a play session or the compose state.
function drawStage(ctx, st, L, sess, G, o) {
  const { w, h } = L, t = st.t, pl = o.pl;
  drawBackdrop(ctx, w + 20, h + 20, t, sess.pulse, 0.32);
  const qi = pl ? pl.piece.qenet : sess.qi;
  const labels = st.prefs.labels ? [1, 2, 3, 4, 5, 6].map((k) => soundName(k, qi)) : null;
  const dimStrings = pl && pl.mode !== 'duel' ? [1, 2, 3, 4, 5, 6].filter((k) => !usedStrings(pl.piece).has(k)) : [];
  const vib = sess.sv.map((s) => s.amp);
  drawLyre(ctx, G, { vib, t, glow: sess.glow || 0, damp: sess.damp || 0, labels: null, dimStrings });
  const cr = G.cueR;
  // standing targets on the strings (so the player sees where the rings will close)
  for (let i = 0; i < STRING_COUNT; i++) {
    const x = lyreXAt(G, i, G.pluckY), dim = dimStrings.includes(i + 1);
    ctx.save(); ctx.strokeStyle = `rgba(255,240,200,${dim ? 0.1 : 0.3})`; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(x, G.pluckY, cr * 0.8, 0, TAU); ctx.stroke(); ctx.restore();
    if (labels) txt(ctx, labels[i], x, G.pluckY, Math.max(14, cr * 0.62), dim ? 'rgba(255,247,230,0.28)' : PAL.cream, { align: 'center', weight: 800 });
  }
  if (pl) {
    const appr = SPEEDS[st.prefs.speedIdx].approach, hide = pl.mode === 'duel';
    const tgtY = G.pluckY;
    if (!hide) {
      // far first, nearest on top
      const vis = [];
      for (let i = pl.np; i < pl.notes.length; i++) {
        const n = pl.notes[i]; if (n.t > pl.t + appr) break;
        if (n.j && n.j !== 'miss') continue;
        vis.push(n);
      }
      for (let i = vis.length - 1; i >= 0; i--) {
        const n = vis[i], k = 1 - (n.t - pl.t) / appr, a = n.j === 'miss' ? 0.3 : clamp(k * 3, 0, 1);
        if (n.kind === 'p') drawCue(ctx, lyreXAt(G, n.k - 1, tgtY), tgtY, cr * (n.soft ? 0.8 : 1), k, n.soft ? 'soft' : 'p', { alpha: a, label: labels ? labels[n.k - 1] : null });
        else if (n.kind === 's') drawStrumCue(ctx, lyreXAt(G, n.ks[0] - 1, tgtY), lyreXAt(G, n.ks[n.ks.length - 1] - 1, tgtY), tgtY, cr * 0.8, k, { alpha: a });
        else if (n.kind === 'd') drawDampCue(ctx, G.cx, G.bowlCy + G.ry * 0.08, Math.min(G.ry * 0.42, cr * 1.3), k, { alpha: a });
      }
    }
    // the teacher's fingertips: light where a string was just played by the azmari or the accompaniment
    for (let k = 1; k <= STRING_COUNT; k++) {
      const sv = pl.sv[k]; if (!sv.teach) continue;
      const age = pl.t - sv.fireT; if (age > 0.5 || age < 0) continue;
      drawTip(ctx, lyreXAt(G, k - 1, G.pluckY + cr * 0.9), G.pluckY + cr * 0.9, cr, 1 - age / 0.5);
    }
  } else {
    for (let k = 1; k <= STRING_COUNT; k++) {
      const sv = sess.sv[k]; const age = sess.t - sv.fireT; if (age > 0.4 || age < 0) continue;
      drawTip(ctx, lyreXAt(G, k - 1, G.pluckY + cr * 0.9), G.pluckY + cr * 0.9, cr * 0.9, (1 - age / 0.4) * (sv.teach ? 1 : 0.6));
    }
  }
  drawParticles(ctx, sess.parts);
  for (const p of sess.pops) drawPopup(ctx, p);
}

function ensPips(ctx, x, y, w, level, flash, label = true) {
  if (label) txt(ctx, 'VOICES', x, y, 20, PAL.gold, { weight: 800 });
  const x0 = x + (label ? 110 : 0), gap = (w - (label ? 110 : 0)) / 4;
  for (let i = 0; i < 4; i++) {
    const on = i <= level, cx = x0 + gap * i + gap / 2 - 10;
    ctx.fillStyle = on ? PAL.gold : 'rgba(255,247,230,0.15)'; rrect(ctx, { x: cx - gap * 0.42, y: y - 10, w: gap * 0.84, h: 20 }, 10); ctx.fill();
    if (on && i === level && flash > 0) { ctx.fillStyle = `rgba(255,255,255,${0.7 * flash})`; rrect(ctx, { x: cx - gap * 0.42, y: y - 10, w: gap * 0.84, h: 20 }, 10); ctx.fill(); }
  }
}
function hearts(ctx, x, y, n, total, size) {
  for (let i = 0; i < total; i++) {
    ctx.fillStyle = i < n ? PAL.coral : 'rgba(255,255,255,0.16)';
    const cx = x + i * size * 1.3, s = size * 0.5;
    ctx.beginPath(); ctx.moveTo(cx, y + s * 0.55); ctx.bezierCurveTo(cx - s * 0.9, y - s * 0.05, cx - s * 0.5, y - s * 0.75, cx, y - s * 0.25); ctx.bezierCurveTo(cx + s * 0.5, y - s * 0.75, cx + s * 0.9, y - s * 0.05, cx, y + s * 0.55); ctx.fill();
  }
}

const KIND_LABEL = { count: 'GET READY', listen: 'LISTEN', echo: 'YOUR TURN', play: 'PLAY', auto: 'WATCH' };
const KIND_COL = { count: PAL.dim, listen: PAL.mint, echo: PAL.sun, play: PAL.gold, auto: PAL.mint };

// A caption panel across the top of the stage: what the music is doing and why.
function caption(ctx, C, text, tag, y) {
  const pad = 18, size = 24, w = Math.min(C.w, 760), x = C.x + (C.w - w) / 2;
  ctx.font = `600 ${size}px ${UI}`;
  const lines = wrap(ctx, text, w - pad * 2).slice(0, 5), h = pad * 1.6 + 24 + lines.length * size * 1.35;
  const r = { x, y, w, h };
  ctx.save(); ctx.globalAlpha = 0.94; panel(ctx, r, { fill: 'rgba(3,24,22,0.86)', rad: 18 }); ctx.restore();
  txt(ctx, tag, r.x + pad, r.y + pad + 4, 19, PAL.mint, { weight: 800 });
  lines.forEach((ln, i) => txt(ctx, ln, r.x + pad, r.y + pad + 34 + i * size * 1.35, size, PAL.text, { weight: 500 }));
}

export function renderPlay(ctx, st, L, view, meta, pauseItems) {
  const pl = st.pl, P = L.play, S = L.S, capMode = pl.mode === 'auto' && L.mode !== 'wide', G = capMode ? P.stageCap : P.stage;
  const duel = pl.mode === 'duel';
  const showEns = pl.mode === 'perform' || pl.mode === 'auto' || (pl.learn && pl.learn.final);
  const bar = curBar(pl), kind = bar ? bar.kind : pl.t < 0.5 ? 'count' : null;
  drawStage(ctx, st, L, pl, G, { pl });
  meta.previewBadge = L.mode === 'wide' ? { x: P.left.x + P.left.w / 2, y: P.left.y + P.left.h - 150, align: 'center' } : { x: S.x + S.w / 2, y: P.hudTop.y + P.hudTop.h + 12, align: 'center' };

  // ---- big count-in numbers and banners
  const midY = G.barY + (G.bridgeY - G.barY) * 0.5;
  if (bar && bar.kind === 'count') {
    const n = clamp(Math.floor((pl.t - bar.t0) / ((bar.t1 - bar.t0) / 4)) + 1, 1, 4), ph = ((pl.t - bar.t0) / ((bar.t1 - bar.t0) / 4)) % 1;
    ctx.save(); ctx.globalAlpha = 0.9 * (1 - ph * 0.6);
    txt(ctx, String(n), G.cx, midY, 190 * (1 + 0.12 * (1 - ph)), PAL.gold, { align: 'center', font: DISPLAY, weight: 400, stroke: 14 });
    ctx.restore();
  } else if (pl.banner) {
    const k = pl.banner.t / 1.6, a = k < 0.15 ? k / 0.15 : k > 0.7 ? (1 - k) / 0.3 : 1;
    ctx.save(); ctx.globalAlpha = clamp(a, 0, 1);
    txt(ctx, pl.banner.text, G.cx, midY - 30, 58, PAL.gold, { align: 'center', font: DISPLAY, weight: 400, stroke: 10, maxW: G.aw - 30 });
    ctx.restore();
  }
  if (bar && (bar.kind === 'listen' || bar.kind === 'echo') && (duel || (pl.mode === 'learn' && !pl.learn.final))) {
    const k = (pl.t - bar.t0) / (bar.t1 - bar.t0), first = (bar.bar % 2 === 0) || duel;
    if (first && k < 1 && !pl.banner) { ctx.save(); ctx.globalAlpha = clamp(1 - k, 0, 1) * 0.9; txt(ctx, KIND_LABEL[bar.kind], G.cx, midY, 74, KIND_COL[bar.kind], { align: 'center', font: DISPLAY, weight: 400, stroke: 10, maxW: G.aw - 30 }); ctx.restore(); }
  }
  const total = pl.chunks[0] && pl.mode !== 'learn' && pl.mode !== 'duel' ? pl.chunks[0].t1 : 0;
  if (capMode && total) {
    const idx = clamp(Math.floor(clamp(pl.t / total, 0, 0.999) * pl.piece.why.length), 0, pl.piece.why.length - 1);
    caption(ctx, P.cap, pl.piece.why[idx], `WHY THE MUSIC DOES THIS  ·  ${idx + 1} OF ${pl.piece.why.length}`, P.cap.y);
  }

  // ---- HUD
  let prog = 0;
  if (pl.mode === 'learn') prog = (pl.learn.final ? 4 + clamp((pl.t - pl.cur.t0) / (pl.cur.t1 - pl.cur.t0), 0, 1) : pl.learn.phrase) / 5;
  else if (duel) prog = clamp((pl.duel.round - 1) / DUEL.rounds, 0, 1);
  else if (total) prog = clamp(pl.t / total, 0, 1);
  ctx.fillStyle = 'rgba(255,247,230,0.12)'; ctx.fillRect(S.x, S.y, S.w, 5); ctx.fillStyle = PAL.saffron; ctx.fillRect(S.x, S.y, S.w * prog, 5);
  const acc = pl.accN ? pl.accSum / pl.accN : 1, mult = comboMult(pl.combo);
  const hintOn = (pl.mode === 'learn' && !pl.learn.final) || duel;
  const scoreVal = duel ? pl.duel.score : pl.score;
  if (L.mode === 'wide') {
    const lc = P.left, rc = P.right;
    panel(ctx, lc); edgeStroke(ctx, lc, 24, 0.35); panel(ctx, rc); edgeStroke(ctx, rc, 24, 0.35);
    txt(ctx, 'SCORE', lc.x + 22, lc.y + 34, 22, PAL.gold, { weight: 800 });
    txt(ctx, String(scoreVal), lc.x + 22, lc.y + 82, 54, PAL.text, { weight: 800, maxW: lc.w - 44 });
    txt(ctx, 'COMBO', lc.x + 22, lc.y + 150, 22, PAL.gold, { weight: 800 });
    txt(ctx, String(pl.combo), lc.x + 22, lc.y + 200, 60, pl.combo >= 10 ? PAL.sun : PAL.text, { weight: 800 });
    if (mult > 1) chip(ctx, lc.x + lc.w - 18, lc.y + 200, `x${mult}`, 24, { align: 'right', fill: PAL.saffron, color: '#241404' });
    txt(ctx, 'ACCURACY', lc.x + 22, lc.y + 262, 22, PAL.gold, { weight: 800 });
    txt(ctx, `${Math.round(acc * 100)}%`, lc.x + 22, lc.y + 306, 46, PAL.text, { weight: 800 });
    let yy = lc.y + 360;
    if (pl.mode === 'auto' && total) {
      yy = lc.y + 392;
      const idx = clamp(Math.floor(clamp(pl.t / total, 0, 0.999) * pl.piece.why.length), 0, pl.piece.why.length - 1);
      txt(ctx, `WHY  ${idx + 1} OF ${pl.piece.why.length}`, lc.x + 18, yy - 16, 18, PAL.mint, { weight: 800 });
      const fs = Math.max(16, Math.min(20, (lc.y + lc.h - 40 - yy) / 11 / 1.3)); ctx.font = `500 ${fs}px ${UI}`; wrap(ctx, pl.piece.why[idx], lc.w - 36).slice(0, 14).forEach((ln, i) => txt(ctx, ln, lc.x + 18, yy + 16 + i * fs * 1.3, fs, PAL.text, { weight: 500 }));
      yy = 1e9;
    }
    for (const k of yy > 1e8 ? [] : ['perfect', 'great', 'good', 'miss']) { txt(ctx, k.toUpperCase(), lc.x + 18, yy, 18, PAL.dim, { weight: 700, maxW: lc.w * 0.55 }); txt(ctx, String(pl.counts[k]), lc.x + lc.w - 18, yy, 20, PAL.text, { align: 'right', weight: 800 }); yy += 34; }
    drawCredit(ctx, lc.x + lc.w / 2, lc.y + lc.h - 18, 11.5, { dim: 0.8 });
    txt(ctx, pl.piece.name.toUpperCase(), rc.x + rc.w / 2, rc.y + 34, 20, PAL.gold, { align: 'center', weight: 800, maxW: rc.w - 24 });
    txt(ctx, QENETS[pl.piece.qenet].name, rc.x + rc.w / 2, rc.y + 66, 20, PAL.dim, { align: 'center', weight: 600, maxW: rc.w - 24 });
    if (showEns) {
      const ys = rc.y + 120, rh = 46;
      txt(ctx, 'ACCOMPANIMENT', rc.x + rc.w / 2, rc.y + 96, 20, PAL.gold, { align: 'center', weight: 800, maxW: rc.w - 20 });
      ['Base layer', 'Layer 1', 'Layer 2', 'Layer 3'].forEach((n, i) => {
        const on = i <= pl.ens, yy2 = ys + i * (rh + 8);
        ctx.fillStyle = on ? 'rgba(255,216,105,0.28)' : 'rgba(255,247,230,0.07)'; rrect(ctx, { x: rc.x + 14, y: yy2, w: rc.w - 28, h: rh }, 12); ctx.fill();
        txt(ctx, n, rc.x + 28, yy2 + rh / 2, 22, on ? PAL.text : PAL.dim, { weight: 700 });
      });
    } else if (duel) {
      txt(ctx, `ROUND ${Math.min(pl.duel.round, DUEL.rounds)} OF ${DUEL.rounds}`, rc.x + rc.w / 2, rc.y + 120, 24, PAL.gold, { align: 'center', weight: 800, maxW: rc.w - 20 });
      hearts(ctx, rc.x + rc.w / 2 - (DUEL.lives - 1) * 20 * 1.3 / 2 * 2 / 2 - 6, rc.y + 168, pl.duel.lives, DUEL.lives, 44);
      txt(ctx, 'answer from memory', rc.x + rc.w / 2, rc.y + 218, 20, PAL.dim, { align: 'center', weight: 600, maxW: rc.w - 24 });
    } else if (pl.learn) {
      txt(ctx, `PHRASE ${Math.min(pl.learn.phrase + 1, 4)} OF 4`, rc.x + rc.w / 2, rc.y + 120, 24, PAL.gold, { align: 'center', weight: 800 });
      txt(ctx, pl.learn.attempt > 1 ? 'second try' : 'listen, then answer', rc.x + rc.w / 2, rc.y + 156, 22, PAL.dim, { align: 'center', weight: 600 });
    }
    if (hintOn) button(ctx, P.hint, 'Listen', { icon: 'ear', kind: 'quiet', size: 28 });
    button(ctx, P.pause, 'Pause', { icon: 'pause', kind: 'ghost', size: 28 });
    if (kind) chip(ctx, G.cx, S.y + 38, KIND_LABEL[kind] + ` · ${pl.piece.name}`, 24, { align: 'center', color: KIND_COL[kind], fill: 'rgba(3,24,22,0.75)' });
  } else {
    const sc = P.score, tall = L.mode === 'tall';
    txt(ctx, 'SCORE', sc.x + 8, sc.y + 18, 20, PAL.gold, { weight: 800 });
    txt(ctx, String(scoreVal), sc.x + 8, sc.y + 56, tall ? 54 : 46, PAL.text, { weight: 800, maxW: sc.w * 0.6 });
    txt(ctx, 'COMBO', sc.x + sc.w - 8, sc.y + 18, 20, PAL.gold, { align: 'right', weight: 800 });
    txt(ctx, String(pl.combo), sc.x + sc.w - 8 - (mult > 1 ? 74 : 0), sc.y + 56, tall ? 54 : 46, pl.combo >= 10 ? PAL.sun : PAL.text, { align: 'right', weight: 800 });
    if (mult > 1) chip(ctx, sc.x + sc.w - 8, sc.y + 54, `x${mult}`, 24, { align: 'right', fill: PAL.saffron, color: '#241404' });
    button(ctx, P.pause, '', { icon: 'pause', kind: 'ghost', rad: 18 });
    if (hintOn) button(ctx, P.hint, '', { icon: 'ear', kind: 'quiet', rad: 18 });
    const cy = P.hudTop.y + 100;
    chip(ctx, S.x + 24, cy, `${Math.round(acc * 100)}% accuracy`, 22, { fill: 'rgba(3,24,22,0.7)' });
    if (kind) chip(ctx, S.x + S.w - 24, cy, KIND_LABEL[kind] + (pl.mode === 'auto' && pl.speed < 1 ? ' 75%' : ''), 22, { align: 'right', color: KIND_COL[kind], fill: 'rgba(3,24,22,0.7)' });
    if (duel) { txt(ctx, `Round ${Math.min(pl.duel.round, DUEL.rounds)} of ${DUEL.rounds}`, P.ens.x, P.ens.y + 22, 24, PAL.gold, { weight: 800 }); hearts(ctx, P.ens.x + P.ens.w - 20 - (DUEL.lives - 1) * 44 * 1.3 + 8, P.ens.y + 22, pl.duel.lives, DUEL.lives, 44); }
    else if (pl.mode === 'learn' && !pl.learn.final) txt(ctx, `Phrase ${Math.min(pl.learn.phrase + 1, 4)} of 4`, P.ens.x, P.ens.y + 22, 24, PAL.gold, { weight: 800 });
    else if (pl.mode === 'learn') txt(ctx, 'Final take', P.ens.x, P.ens.y + 22, 24, PAL.gold, { weight: 800 });
    else ensPips(ctx, P.ens.x, P.ens.y + 22, P.ens.w, pl.ens, pl.layerFlash);
    if (showEns && pl.mode === 'learn') ensPips(ctx, P.ens.x + 200, P.ens.y + 22, P.ens.w - 200, pl.ens, pl.layerFlash, false);
  }

  // ---- overlays
  if (pl.paused || pl.over) {
    ctx.fillStyle = 'rgba(2,14,12,0.7)'; ctx.fillRect(0, 0, L.w, L.h);
    const items = pauseItems(pl), M = menuRects(L, items.length, 130);
    panel(ctx, M.panel, { fill: 'rgba(4,28,26,0.95)' }); edgeStroke(ctx, M.panel, 24, 0.6);
    txt(ctx, pl.over ? 'Piece finished' : 'Paused', M.panel.x + M.panel.w / 2, M.panel.y + 66, 44, PAL.gold, { align: 'center', font: DISPLAY, weight: 400, stroke: 6 });
    const names = { resume: 'Resume', restart: 'Restart', quit: 'Leave piece', listen: 'Listen to the phrase', speed: pl.speed < 1 ? 'Speed: 75% (tap for 100%)' : 'Speed: 100% (tap for 75%)', next: 'Next piece', again: 'Watch again', exit: 'Back to the piece' };
    items.forEach((it, i) => button(ctx, M.btns[i], names[it], { kind: i === 0 ? 'primary' : 'ghost', size: 30 }));
  }
}

// ---- compose (free play) -------------------------------------------------------------------------------------------------------------------------
export function renderFree(ctx, st, L, meta) {
  const f = st.free, F = L.free, G = F.stage, S = L.S;
  meta.previewBadge = F.badge;
  drawStage(ctx, st, L, f, G, { pl: null });
  button(ctx, F.exit, 'Back', { icon: 'back', kind: 'ghost', size: 28 });
  const q = QENETS[f.qi];
  panel(ctx, F.info, { fill: 'rgba(3,24,22,0.7)', rad: 18 });
  txt(ctx, `${q.name}  ·  ${f.bpm} bpm`, F.info.x + F.info.w * 0.42, F.info.y + F.info.h / 2, 26, PAL.gold, { align: 'center', weight: 800, maxW: F.info.w - 24 });
  // the grid
  const gr = F.grid, cw = gr.w / 12, rh = gr.h / STRING_COUNT;
  panel(ctx, { x: gr.x - 6, y: gr.y - 6, w: gr.w + 12, h: gr.h + 12 }, { fill: 'rgba(3,24,22,0.72)', rad: 16 });
  for (let r = 0; r < STRING_COUNT; r++) {
    const k = STRING_COUNT - r, y = gr.y + r * rh;
    ctx.fillStyle = WRAPS[k - 1]; ctx.beginPath(); ctx.arc(F.rowLabelX + 24, y + rh / 2, Math.min(18, rh * 0.36), 0, TAU); ctx.fill();
    txt(ctx, soundName(k, f.qi), F.rowLabelX + 24, y + rh / 2 + 1, Math.min(18, rh * 0.34), '#14100a', { align: 'center', weight: 800 });
    for (let c = 0; c < 12; c++) {
      const on = (f.cells[f.page * 12 + c] >> (k - 1)) & 1, cell = { x: gr.x + c * cw + 2, y: y + 2, w: cw - 4, h: rh - 4 };
      ctx.fillStyle = on ? WRAPS[k - 1] : c % 3 === 0 ? 'rgba(255,247,230,0.13)' : 'rgba(255,247,230,0.07)'; rrect(ctx, cell, Math.min(10, rh * 0.2)); ctx.fill();
      if (on) { ctx.strokeStyle = 'rgba(255,255,255,0.6)'; ctx.lineWidth = 2; rrect(ctx, cell, Math.min(10, rh * 0.2)); ctx.stroke(); }
    }
  }
  if (f.playing && Math.floor(f.pos / 12) === f.page) {
    const c = f.pos % 12; ctx.strokeStyle = PAL.sun; ctx.lineWidth = 4; rrect(ctx, { x: gr.x + c * cw, y: gr.y - 2, w: cw, h: gr.h + 4 }, 8); ctx.stroke();
  }
  const c = F.ctrl;
  button(ctx, c[0], f.playing ? 'Stop' : 'Play', { kind: f.playing ? 'on' : 'primary', icon: f.playing ? 'pause' : 'play', size: 26 });
  button(ctx, c[1], 'Slower', { kind: 'quiet', icon: 'minus', size: 24 });
  button(ctx, c[2], 'Faster', { kind: 'quiet', icon: 'plus', size: 24 });
  button(ctx, c[3], `Bar ${f.page + 1}`, { kind: 'ghost', icon: 'grid', size: 26 });
  button(ctx, c[4], 'Mode: ' + q.name, { kind: 'ghost', size: 22 });
  button(ctx, c[5], f.groove ? 'Groove on' : 'Groove off', { kind: f.groove ? 'on' : 'ghost', size: 24 });
  button(ctx, c[6], 'Azmari answers', { kind: 'quiet', size: 22 });
  button(ctx, c[7], 'Clear', { kind: 'ghost', size: 24 });
  if (L.mode === 'wide') drawCredit(ctx, F.stage.cx, S.y + S.h - 14, 11.5, { dim: 0.8 });
}

// ---- calibration ------------------------------------------------------------------------------------------------------------------------------------------
export function renderCalib(ctx, st, L) {
  const c = st.cal, C = L.calib, S = L.S;
  drawBackdrop(ctx, L.w + 20, L.h + 20, st.t, c.pulse, 0.3);
  button(ctx, C.back, 'Back', { icon: 'back', kind: 'ghost', size: 28 });
  txt(ctx, 'Calibrate', S.x + S.w / 2, S.y + 140, 58, PAL.gold, { align: 'center', font: DISPLAY, weight: 400, stroke: 8 });
  const p = C.pad, r = p.r * (1 + 0.06 * c.pulse);
  ctx.strokeStyle = 'rgba(255,248,226,0.85)'; ctx.lineWidth = 4; ctx.beginPath(); ctx.moveTo(p.x, p.y - r * 2.4); ctx.lineTo(p.x, p.y + r * 2.4); ctx.stroke();
  const g = ctx.createRadialGradient(p.x - r * 0.3, p.y - r * 0.35, r * 0.1, p.x, p.y, r);
  g.addColorStop(0, '#fff6dc'); g.addColorStop(0.5, '#ffc94a'); g.addColorStop(1, '#b87a1a');
  ctx.fillStyle = g; ctx.beginPath(); ctx.arc(p.x, p.y, r, 0, TAU); ctx.fill(); ctx.lineWidth = 6; ctx.strokeStyle = 'rgba(255,250,235,0.9)'; ctx.stroke();
  ctx.save(); ctx.globalCompositeOperation = 'lighter'; const gl = ctx.createRadialGradient(p.x, p.y, 5, p.x, p.y, r * 1.6); gl.addColorStop(0, `rgba(255,200,90,${0.6 * c.pulse + 0.7 * c.flash})`); gl.addColorStop(1, 'rgba(255,200,90,0)'); ctx.fillStyle = gl; ctx.beginPath(); ctx.arc(p.x, p.y, r * 1.6, 0, TAU); ctx.fill(); ctx.restore();
  if (c.phase === 'run') {
    const next = c.T0 + (Math.floor(Math.max(0, (c.t - c.T0)) * c.bpm / 60) + (c.t < c.T0 ? 0 : 1)) * 60 / c.bpm, u = clamp((next - c.t) / (60 / c.bpm), 0, 1);
    ctx.strokeStyle = `rgba(255,240,170,${0.9 - u * 0.5})`; ctx.lineWidth = 6; ctx.beginPath(); ctx.arc(p.x, p.y, r * (1 + 0.55 * u), 0, TAU); ctx.stroke();
  }
  const msg = c.phase === 'run' ? (c.t < c.T0 ? 'Get ready: tap anywhere on every beat' : c.lastBeat < 4 ? 'Keep time, tap on every beat' : `Now counting: ${Math.min(c.taps.length, 99)} taps`) : c.result.ms === null ? 'Not enough taps. Try again.' : `Your device sounds ${c.result.ms} ms late`;
  txt(ctx, msg, S.x + S.w / 2, p.y + p.r * 1.62 + 56, 34, c.phase === 'done' ? PAL.gold : PAL.text, { align: 'center', weight: 700, maxW: S.w - 40 });
  if (c.phase === 'done') {
    txt(ctx, c.result.ms === null ? 'Tap along with the pulse, not before it.' : 'Positive means the sound reaches you late; the game now allows for it.', S.x + S.w / 2, p.y + p.r * 1.62 + 100, 22, PAL.dim, { align: 'center', maxW: S.w - 40 });
    button(ctx, C.retry, 'Try again', { kind: 'ghost', size: 30 });
    button(ctx, C.use, c.result.ms === null ? 'Back' : 'Use this', { kind: 'primary', size: 30 });
  }
}
void CUE;
