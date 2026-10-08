// Drawing for the playing screens: the stage (strings, notes, bridge, calabash, fingers, sparks), the HUD, free play and calibration.
import { PAL, UI, DISPLAY, drawBackdrop, drawMat, drawString, drawNote, drawCalabash, drawBridge, drawPost, drawFinger, drawPopup, drawParticles, handColor, handRGB } from './art.js';
import { txt, button, panel, rrect, chip, wrap } from './ui.js';
import { menuRects, stringMap, xAt } from './layout.js';
import { SPEEDS, ENSEMBLE, STRING_COUNT, barDur, comboMult, handOf, stringName, FINGER_NAMES } from './music.js';
import { drawCredit, edgeStroke } from './brand.js';

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const TAU = Math.PI * 2;

function curBar(pl) {
  for (let i = pl.bars.length - 1; i >= 0; i--) if (pl.bars[i].t0 <= pl.t) return pl.bars[i].t1 > pl.t ? pl.bars[i] : null;
  return null;
}
function lowerBound(ev, t) { let lo = 0, hi = ev.length; while (lo < hi) { const m = (lo + hi) >> 1; if (ev[m].t < t) lo = m + 1; else hi = m; } return lo; }
const evOnNow = (pl, e) => (e.on !== undefined ? e.on : e.who === 'ens' ? e.layer <= pl.ens : e.who === 'teach');

// The instrument geometry for the current stage: where the calabash face sits.
function bodyGeo(G, wide) {
  const bh = G.bottom - G.bridgeY, ry = bh * 0.66, rx = Math.min(G.aw * (wide ? 0.495 : 0.56), ry * 2.25);
  return { cx: G.cx, cy: G.bridgeY + ry * 0.86, rx, ry };
}

// The stage. `sess` is the play session or the free-play state, `pl` the play session (null in free play).
export function drawStage(ctx, st, L, sess, G, o) {
  const { w, h } = L, t = sess.t, pulse = sess.pulse, pl = o.pl, free = !pl;
  ctx.save();
  drawBackdrop(ctx, w + 20, h + 20, st.t, pulse);
  const B = bodyGeo(G, L.mode === 'wide'), map = stringMap(G, pl ? pl.piece : null);
  drawMat(ctx, w, h, G.bridgeY - 20, G.cx, pulse);
  const appr = SPEEDS[st.prefs.speedIdx].approach;
  const lanes = pl ? G.lanesFor(pl.piece.lanes.length) : null;

  // ---- the board the strings run over: a dark, softly lit perspective strip
  {
    const xl = G.ax + 8, xr = G.ax + G.aw - 8, far = G.far, cx = G.cx;
    const g = ctx.createLinearGradient(0, G.laneTop - 40, 0, G.bridgeY);
    g.addColorStop(0, 'rgba(12,5,12,0)'); g.addColorStop(0.18, 'rgba(18,7,14,0.55)'); g.addColorStop(1, 'rgba(26,10,14,0.78)');
    ctx.fillStyle = g; ctx.beginPath();
    ctx.moveTo(cx + (xl - cx) * far, G.laneTop - 40); ctx.lineTo(cx + (xr - cx) * far, G.laneTop - 40); ctx.lineTo(xr, G.bridgeY); ctx.lineTo(xl, G.bridgeY); ctx.closePath(); ctx.fill();
    ctx.strokeStyle = 'rgba(255,214,160,0.16)'; ctx.lineWidth = 2; ctx.beginPath();
    ctx.moveTo(cx + (xl - cx) * far, G.laneTop - 40); ctx.lineTo(xl, G.bridgeY); ctx.moveTo(cx + (xr - cx) * far, G.laneTop - 40); ctx.lineTo(xr, G.bridgeY); ctx.stroke();
  }
  // lane bands (only the strings you play)
  if (lanes) for (const ln of lanes) {
    const hand = handOf(pl.piece.lanes[ln.i]), rgb = handRGB(hand), wTop = ln.lw * G.far * 0.9, wBot = ln.lw * 0.9, str = pl.piece.lanes[ln.i], amp = sess.sv[str].amp;
    const g = ctx.createLinearGradient(0, G.laneTop, 0, G.bridgeY); g.addColorStop(0, `rgba(${rgb},0)`); g.addColorStop(1, `rgba(${rgb},${0.1 + 0.16 * amp})`);
    ctx.fillStyle = g; ctx.beginPath(); ctx.moveTo(ln.cxTop - wTop / 2, G.laneTop); ctx.lineTo(ln.cxTop + wTop / 2, G.laneTop); ctx.lineTo(ln.cx + wBot / 2, G.bridgeY); ctx.lineTo(ln.cx - wBot / 2, G.bridgeY); ctx.closePath(); ctx.fill();
  }
  // beat lines
  if (pl) {
    for (const b of pl.bars) {
      if (b.t1 < t - 0.1 || b.t0 > t + appr) continue;
      const bd = (b.t1 - b.t0) / 4;
      for (let j = 0; j < 4; j++) {
        const tb = b.t0 + j * bd, p = 1 - (tb - t) / appr; if (p < 0 || p > 1.05) continue;
        const y = G.laneTop + (G.bridgeY - G.laneTop) * p, kx = G.far + (1 - G.far) * p, xl = G.cx - (G.cx - (G.ax + 8)) * kx, xr = G.cx + (G.ax + G.aw - 8 - G.cx) * kx;
        ctx.strokeStyle = j === 0 ? 'rgba(255,226,170,0.42)' : 'rgba(255,226,170,0.13)'; ctx.lineWidth = j === 0 ? 3 : 1.5;
        ctx.beginPath(); ctx.moveTo(xl, y); ctx.lineTo(xr, y); ctx.stroke();
      }
    }
  }
  // all 21 strings, running from the far end to the bridge; the ones you play are bright
  for (let i = 0; i < STRING_COUNT; i++) {
    const lane = map.lane[i], mine = lane >= 0, sv = sess.sv[i];
    drawString(ctx, map.xt[i], G.laneTop - 40, map.x[i], G.bridgeY, i, sv.amp, st.t, { thick: mine ? 4.2 : 2.6, dim: mine || free ? 1 : 0.22 });
  }
  // ---- calabash, bridge, hand posts (kept inside the stage so side panels stay clean)
  ctx.save(); ctx.beginPath(); ctx.rect(G.ax, G.laneTop - 60, G.aw, h); ctx.clip();
  drawCalabash(ctx, B.cx, B.cy, B.rx, B.ry, sess.glow || 0);
  const bx0 = Math.min(...map.x) - 14, bx1 = Math.max(...map.x) + 14;
  drawBridge(ctx, Math.max(G.ax + 20, bx0), Math.min(G.ax + G.aw - 20, bx1), G.bridgeY + 8, Math.max(22, B.ry * 0.11), sess.glow || 0);
  const postY0 = B.cy + B.ry * 0.7, postTop = G.bridgeY - 30;
  drawPost(ctx, B.cx - B.rx * 0.9, postY0, G.ax + 2, postTop + 40, Math.max(14, B.rx * 0.05));
  drawPost(ctx, B.cx + B.rx * 0.9, postY0, G.ax + G.aw - 2, postTop + 40, Math.max(14, B.rx * 0.05));

  // targets on the bridge
  if (lanes) for (const ln of lanes) {
    const str = pl.piece.lanes[ln.i], amp = sess.sv[str].amp, nr = clamp(ln.lw * 0.36, 22, 58), hand = handOf(str), rgb = handRGB(hand);
    ctx.save();
    ctx.strokeStyle = `rgba(255,248,230,${0.45 + 0.4 * amp})`; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(ln.cx, G.bridgeY, nr * 1.08, 0, TAU); ctx.stroke();
    ctx.strokeStyle = `rgba(${rgb},${0.7})`; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(ln.cx, G.bridgeY, nr * 1.28, 0, TAU); ctx.stroke();
    if (amp > 0.02) { ctx.globalCompositeOperation = 'lighter'; const gg = ctx.createRadialGradient(ln.cx, G.bridgeY, 2, ln.cx, G.bridgeY, nr * 2.4); gg.addColorStop(0, `rgba(${rgb},${0.6 * amp})`); gg.addColorStop(1, `rgba(${rgb},0)`); ctx.fillStyle = gg; ctx.beginPath(); ctx.arc(ln.cx, G.bridgeY, nr * 2.4, 0, TAU); ctx.fill(); }
    ctx.restore();
  }
  // notes
  if (pl) {
    const lo = lowerBound(pl.ev, t - 0.3);
    for (let i = lo; i < pl.ev.length; i++) {
      const e = pl.ev[i]; if (e.t > t + appr) break;
      if (e.str < 0) continue;
      const lane = e.lane, p = 1 - (e.t - t) / appr, y = G.laneTop + (G.bridgeY - G.laneTop) * p, sc = 0.5 + 0.5 * clamp(p, 0, 1);
      const hand = handOf(e.str), label = st.prefs.labels ? stringName(e.str) : null;
      if (e.who === 'note') {
        if (e.j && e.j !== 'miss') continue;
        const ln = lanes[lane], nr = clamp(ln.lw * 0.36, 22, 58) * sc;
        drawNote(ctx, xAt(ln, G, y), y, nr, hand, e.soft, label, e.j === 'miss' ? 0.35 : clamp(p * 3, 0, 1));
      } else if (e.who === 'teach') {
        if (e.t <= t) continue;
        const ln = lanes[lane]; if (!ln) continue;
        const nr = clamp(ln.lw * 0.36, 22, 58) * sc;
        drawNote(ctx, xAt(ln, G, y), y, nr, hand, e.soft, null, clamp(p * 3, 0, 1), pl.mode !== 'auto');
      } else if (e.who === 'ens' && evOnNow(pl, e) && e.t > t && lane < 0) {          // the accompaniment on strings you do not play: a quiet twinkle on that string
        const x = map.xt[e.str] + (map.x[e.str] - map.xt[e.str]) * clamp(p, 0, 1);
        drawNote(ctx, x, y, 7 * sc, hand, true, null, 0.55 * clamp(p * 3, 0, 1), true);
      }
    }
  }

  // ---- the four fingers (still inside the stage clip)
  const size = clamp(G.aw * 0.07, 28, 54), restY = G.bridgeY + (G.bottom - G.bridgeY) * 0.5, defaults = [G.cx - G.aw * 0.3, G.cx - G.aw * 0.13, G.cx + G.aw * 0.13, G.cx + G.aw * 0.3];
  const order = [0, 3, 1, 2];                                                                 // draw order (outer fingers first)
  for (const f of order) {
    const fg = sess.fg[f], kind = f % 2 === 0 ? 'thumb' : 'index', hand = f < 2 ? 'L' : 'R';
    const x = fg.x === null ? defaults[f] : fg.x;
    const tipY = restY - clamp(fg.lift, 0, 1) * (restY - (G.bridgeY + 16));
    drawFinger(ctx, x, tipY, size * (kind === 'thumb' ? 1.05 : 0.8), kind, hand, G.bottom + 20, fg.glow);
    if (o.fingerNames) txt(ctx, ['L thumb', 'L index', 'R thumb', 'R index'][f], x, tipY - 18 - (f % 2) * 22, 17, handColor(hand), { align: 'center', weight: 800, stroke: 5 });
  }
  ctx.restore();
  drawParticles(ctx, sess.parts);
  for (const p of sess.pops) drawPopup(ctx, p);
  ctx.restore();
  return B;
}

function ensPips(ctx, x, y, w, level, flash, label = true) {
  if (label) txt(ctx, 'VOICES', x, y, 20, PAL.gold, { weight: 800 });
  const x0 = x + (label ? 110 : 0), gap = (w - (label ? 110 : 0)) / 4;
  for (let i = 0; i < 4; i++) {
    const on = i <= level, cx = x0 + gap * i + gap / 2 - 10;
    ctx.fillStyle = on ? PAL.gold : 'rgba(255,240,220,0.14)'; rrect(ctx, { x: cx - gap * 0.42, y: y - 10, w: gap * 0.84, h: 20 }, 10); ctx.fill();
    if (on && i === level && flash > 0) { ctx.fillStyle = `rgba(255,255,255,${0.7 * flash})`; rrect(ctx, { x: cx - gap * 0.42, y: y - 10, w: gap * 0.84, h: 20 }, 10); ctx.fill(); }
  }
}

const KIND_LABEL = { count: 'GET READY', listen: 'LISTEN', echo: 'YOUR TURN', play: 'PLAY', auto: 'WATCH' };
const KIND_COL = { count: PAL.dim, listen: PAL.iceHi, echo: PAL.emberHi, play: PAL.gold, auto: PAL.iceHi };

// A caption panel at the top of the stage: what the hands are doing and why.
function caption(ctx, G, text, tag) {
  const pad = 18, size = 24, w = Math.min(G.aw - 24, 760), x = G.ax + (G.aw - w) / 2;
  ctx.font = `600 ${size}px ${UI}`;
  const lines = wrap(ctx, text, w - pad * 2).slice(0, 4), h = pad * 1.6 + 24 + lines.length * size * 1.35;
  const r = { x, y: G.laneTop + 10, w, h };
  ctx.save(); ctx.globalAlpha = 0.94; panel(ctx, r, { fill: 'rgba(22,9,20,0.84)', rad: 18 }); ctx.restore();
  txt(ctx, tag, r.x + pad, r.y + pad + 4, 19, PAL.iceHi, { weight: 800 });
  lines.forEach((ln, i) => txt(ctx, ln, r.x + pad, r.y + pad + 34 + i * size * 1.35, size, PAL.text, { weight: 500 }));
}

export function renderPlay(ctx, st, L, view, meta, pauseItems) {
  const pl = st.pl, P = L.play, G = P.stage, S = L.S;
  const showEns = pl.mode === 'perform' || pl.mode === 'auto' || (pl.learn && pl.learn.final);
  const bar = curBar(pl), kind = bar ? bar.kind : pl.t < 0.5 ? 'count' : null;
  const showFingers = pl.mode === 'auto' || (pl.mode === 'learn' && kind === 'listen');
  drawStage(ctx, st, L, pl, G, { pl, fingerNames: showFingers });
  // preview pill placement (kit): out of the HUD's way
  meta.previewBadge = L.mode === 'wide' ? { x: G.ax + G.aw / 2, y: S.y + 70, align: 'center' } : { x: S.x + S.w / 2, y: G.laneTop + 8, align: 'center' };

  // ---- big count-in numbers and banners
  const midY = G.laneTop + (G.bridgeY - G.laneTop) * 0.45;
  if (bar && bar.kind === 'count') {
    const n = clamp(Math.floor((pl.t - bar.t0) / ((bar.t1 - bar.t0) / 4)) + 1, 1, 4), ph = ((pl.t - bar.t0) / ((bar.t1 - bar.t0) / 4)) % 1;
    ctx.save(); ctx.globalAlpha = 0.9 * (1 - ph * 0.6);
    txt(ctx, String(n), G.ax + G.aw / 2, midY, 200 * (1 + 0.12 * (1 - ph)), PAL.gold, { align: 'center', font: DISPLAY, weight: 700, stroke: 14 });
    ctx.restore();
  } else if (pl.banner) {
    const k = pl.banner.t / 1.6, a = k < 0.15 ? k / 0.15 : k > 0.7 ? (1 - k) / 0.3 : 1;
    ctx.save(); ctx.globalAlpha = clamp(a, 0, 1);
    txt(ctx, pl.banner.text, G.ax + G.aw / 2, midY - 30, 76, PAL.gold, { align: 'center', font: DISPLAY, weight: 700, stroke: 10, maxW: G.aw - 30 });
    ctx.restore();
  }
  if (bar && bar.kind !== 'count' && pl.mode === 'learn' && !pl.learn.final) {
    const k = (pl.t - bar.t0) / (bar.t1 - bar.t0), first = bar.bar % 2 === 0;
    if (first && k < 1) { ctx.save(); ctx.globalAlpha = clamp(1 - k, 0, 1) * 0.9; txt(ctx, KIND_LABEL[bar.kind], G.ax + G.aw / 2, midY, 92, KIND_COL[bar.kind], { align: 'center', font: DISPLAY, weight: 700, stroke: 10, maxW: G.aw - 30 }); ctx.restore(); }
  }
  // watch and learn: the caption that explains what the hands are doing and why
  const total = pl.chunks[0] && (pl.mode !== 'learn') ? pl.chunks[0].t1 : 0;
  if (pl.mode === 'auto' && total && L.mode !== 'wide') {
    const idx = clamp(Math.floor(clamp(pl.t / total, 0, 0.999) * pl.piece.why.length), 0, pl.piece.why.length - 1);
    caption(ctx, G, pl.piece.why[idx], `WHY THE HANDS DO THIS  ·  ${idx + 1} OF ${pl.piece.why.length}`);
  } else if (pl.mode === 'learn' && !pl.learn.final && kind === 'listen' && bar && bar.bar % 2 === 0) {
    caption(ctx, G, pl.piece.roles, 'LISTEN AND WATCH THE FINGERS');
  }

  // ---- HUD
  let prog = 0;
  if (pl.mode === 'learn') prog = (pl.learn.final ? 4 + clamp((pl.t - pl.cur.t0) / (pl.cur.t1 - pl.cur.t0), 0, 1) : pl.learn.phrase) / 5; else if (total) prog = clamp(pl.t / total, 0, 1);
  ctx.fillStyle = 'rgba(255,240,220,0.12)'; ctx.fillRect(S.x, S.y, S.w, 5); ctx.fillStyle = PAL.ember; ctx.fillRect(S.x, S.y, S.w * prog, 5);
  const acc = pl.accN ? pl.accSum / pl.accN : 1;
  const mult = comboMult(pl.combo);
  if (L.mode === 'wide') {
    const lc = P.left, rc = P.right;
    panel(ctx, lc); edgeStroke(ctx, lc, 24, 0.35); panel(ctx, rc); edgeStroke(ctx, rc, 24, 0.35);
    txt(ctx, 'SCORE', lc.x + 22, lc.y + 34, 22, PAL.gold, { weight: 800 });
    txt(ctx, String(pl.score), lc.x + 22, lc.y + 82, 54, PAL.text, { weight: 800, maxW: lc.w - 44 });
    txt(ctx, 'COMBO', lc.x + 22, lc.y + 150, 22, PAL.gold, { weight: 800 });
    txt(ctx, String(pl.combo), lc.x + 22, lc.y + 200, 60, pl.combo >= 10 ? PAL.emberHi : PAL.text, { weight: 800 });
    if (mult > 1) chip(ctx, lc.x + lc.w - 18, lc.y + 200, `x${mult}`, 24, { align: 'right', fill: PAL.ember, color: '#fff' });
    txt(ctx, 'ACCURACY', lc.x + 22, lc.y + 262, 22, PAL.gold, { weight: 800 });
    txt(ctx, `${Math.round(acc * 100)}%`, lc.x + 22, lc.y + 306, 46, PAL.text, { weight: 800 });
    let yy = lc.y + 360;
    if (pl.mode === 'auto' && total) {
      yy = lc.y + 392;
      const idx = clamp(Math.floor(clamp(pl.t / total, 0, 0.999) * pl.piece.why.length), 0, pl.piece.why.length - 1);
      txt(ctx, `WHY  ${idx + 1} OF ${pl.piece.why.length}`, lc.x + 18, yy - 16, 18, PAL.iceHi, { weight: 800 });
      const fs = Math.max(16, Math.min(20, (lc.y + lc.h - 40 - yy) / 11 / 1.3)); ctx.font = `500 ${fs}px ${UI}`; wrap(ctx, pl.piece.why[idx], lc.w - 36).slice(0, 14).forEach((ln, i) => txt(ctx, ln, lc.x + 18, yy + 16 + i * fs * 1.3, fs, PAL.text, { weight: 500 }));
      yy = 1e9;
    }
    for (const k of yy > 1e8 ? [] : ['perfect', 'great', 'good', 'miss']) { txt(ctx, k.toUpperCase(), lc.x + 18, yy, 18, PAL.dim, { weight: 700, maxW: lc.w * 0.55 }); txt(ctx, String(pl.counts[k]), lc.x + lc.w - 18, yy, 20, PAL.text, { align: 'right', weight: 800 }); yy += 34; }
    drawCredit(ctx, lc.x + lc.w / 2, lc.y + lc.h - 18, 11.5, { dim: 0.8 });
    txt(ctx, pl.piece.name.toUpperCase(), rc.x + rc.w / 2, rc.y + 34, 20, PAL.gold, { align: 'center', weight: 800, maxW: rc.w - 24 });
    if (showEns) {
      const ys = rc.y + 120, rh = 46;
      txt(ctx, 'ACCOMPANIMENT', rc.x + rc.w / 2, rc.y + 96, 20, PAL.gold, { align: 'center', weight: 800, maxW: rc.w - 20 });
      ['Base layer', 'Layer 1', 'Layer 2', 'Layer 3'].forEach((n, i) => {
        const on = i <= pl.ens, yy2 = ys + i * (rh + 8);
        ctx.fillStyle = on ? 'rgba(246,217,138,0.28)' : 'rgba(255,240,220,0.07)'; rrect(ctx, { x: rc.x + 14, y: yy2, w: rc.w - 28, h: rh }, 12); ctx.fill();
        txt(ctx, n, rc.x + 28, yy2 + rh / 2, 22, on ? PAL.text : PAL.dim, { weight: 700 });
      });
    } else if (pl.learn) {
      txt(ctx, `PHRASE ${Math.min(pl.learn.phrase + 1, 4)} OF 4`, rc.x + rc.w / 2, rc.y + 120, 24, PAL.gold, { align: 'center', weight: 800 });
      txt(ctx, pl.learn.attempt > 1 ? 'second try' : 'listen, then echo', rc.x + rc.w / 2, rc.y + 156, 22, PAL.dim, { align: 'center', weight: 600 });
    }
    if (pl.mode === 'learn' && !pl.learn.final) button(ctx, P.hint, 'Listen', { icon: 'ear', kind: 'quiet', size: 28 });
    button(ctx, P.pause, 'Pause', { icon: 'pause', kind: 'ghost', size: 28 });
    if (kind) chip(ctx, G.ax + G.aw / 2, S.y + 40, KIND_LABEL[kind] + ` · ${pl.piece.name}`, 24, { align: 'center', color: KIND_COL[kind], fill: 'rgba(14,10,36,0.7)' });
  } else {
    const sc = P.score, tall = L.mode === 'tall';
    txt(ctx, 'SCORE', sc.x + 8, sc.y + 18, 20, PAL.gold, { weight: 800 });
    txt(ctx, String(pl.score), sc.x + 8, sc.y + 56, tall ? 54 : 46, PAL.text, { weight: 800, maxW: sc.w * 0.6 });
    txt(ctx, 'COMBO', sc.x + sc.w - 8, sc.y + 18, 20, PAL.gold, { align: 'right', weight: 800 });
    txt(ctx, String(pl.combo), sc.x + sc.w - 8 - (mult > 1 ? 74 : 0), sc.y + 56, tall ? 54 : 46, pl.combo >= 10 ? PAL.emberHi : PAL.text, { align: 'right', weight: 800 });
    if (mult > 1) chip(ctx, sc.x + sc.w - 8, sc.y + 54, `x${mult}`, 24, { align: 'right', fill: PAL.ember, color: '#fff' });
    button(ctx, P.pause, '', { icon: 'pause', kind: 'ghost', rad: 18 });
    if (pl.mode === 'learn' && !pl.learn.final) button(ctx, P.hint, '', { icon: 'ear', kind: 'quiet', rad: 18 });
    const cy = P.hudTop.y + 106;
    chip(ctx, S.x + 24 + 0, cy, `${Math.round(acc * 100)}% accuracy`, 22, { fill: 'rgba(14,10,36,0.6)' });
    if (kind) chip(ctx, S.x + S.w - 24, cy, KIND_LABEL[kind] + (pl.mode === 'auto' && pl.speed < 1 ? ' 75%' : ''), 22, { align: 'right', color: KIND_COL[kind], fill: 'rgba(14,10,36,0.6)' });
    if (pl.mode === 'learn' && !pl.learn.final) txt(ctx, `Phrase ${Math.min(pl.learn.phrase + 1, 4)} of 4`, P.ens.x, P.ens.y + 22, 24, PAL.gold, { weight: 800 });
    else if (pl.mode === 'learn') txt(ctx, 'Final take', P.ens.x, P.ens.y + 22, 24, PAL.gold, { weight: 800 });
    else ensPips(ctx, P.ens.x, P.ens.y + 22, P.ens.w, pl.ens, pl.layerFlash);
    if (showEns && pl.mode === 'learn') ensPips(ctx, P.ens.x + 200, P.ens.y + 22, P.ens.w - 200, pl.ens, pl.layerFlash, false);
  }

  // ---- overlays
  if (pl.paused || pl.over) {
    ctx.fillStyle = 'rgba(10,4,16,0.66)'; ctx.fillRect(0, 0, L.w, L.h);
    const items = pauseItems(pl), M = menuRects(L, items.length, 130);
    panel(ctx, M.panel, { fill: 'rgba(26,10,24,0.94)' }); edgeStroke(ctx, M.panel, 24, 0.6);
    txt(ctx, pl.over ? 'Piece finished' : 'Paused', M.panel.x + M.panel.w / 2, M.panel.y + 66, 48, PAL.gold, { align: 'center', font: DISPLAY, weight: 700, stroke: 6 });
    const names = { resume: 'Resume', restart: 'Restart', quit: 'Leave piece', listen: 'Listen to the phrase', speed: pl.speed < 1 ? 'Speed: 75% (tap for 100%)' : 'Speed: 100% (tap for 75%)', next: 'Next piece', again: 'Watch again', exit: 'Back to the piece' };
    items.forEach((it, i) => button(ctx, M.btns[i], names[it], { kind: i === 0 ? 'primary' : 'ghost', size: 30 }));
  }
}

// ---- free play ---------------------------------------------------------------------------------------------------------------------------------------
export function renderFree(ctx, st, L, meta) {
  const f = st.free, F = L.free, G = F.stage, S = L.S;
  meta.previewBadge = { x: S.x + S.w - 12, y: S.y + 16, align: 'right' };
  drawStage(ctx, st, L, f, G, { pl: null, fingerNames: false });
  // names of a few strings so the scale can be read
  const map = stringMap(G, null);
  for (let i = 0; i < STRING_COUNT; i += 1) if (i % 7 === 0 || i === 4 || i === 11 || i === 18) txt(ctx, stringName(i), map.x[i], G.bridgeY - 20, Math.min(18, G.aw / 40), handColor(handOf(i)), { align: 'center', weight: 800, stroke: 4 });
  button(ctx, F.exit, 'Back', { icon: 'back', kind: 'ghost', size: 28 });
  button(ctx, F.metro, 'Click', { icon: 'metro', kind: f.metro ? 'on' : 'ghost', size: 26 });
  button(ctx, F.tempoDec, '', { icon: 'minus', kind: 'quiet' });
  button(ctx, F.tempoInc, '', { icon: 'plus', kind: 'quiet' });
  txt(ctx, `${f.bpm} bpm`, (F.tempoDec.x + F.tempoInc.x + F.tempoInc.w) / 2, F.tempoDec.y - 18, 22, PAL.gold, { align: 'center', weight: 800, stroke: 6 });
  button(ctx, F.echo, 'Echo', { icon: 'echo', kind: f.echo ? 'on' : 'ghost', size: 26 });
  if (f.metro) { ctx.save(); ctx.globalAlpha = 0.5 * f.pulse; ctx.fillStyle = PAL.gold; ctx.beginPath(); ctx.arc(F.metro.x + F.metro.w - 24, F.metro.y + 24, 9, 0, 6.3); ctx.fill(); ctx.restore(); }
  const mid = L.mode === 'wide' ? F.left : { x: F.info.x, y: F.info.y, w: F.info.w, h: F.info.h };
  if (L.mode === 'wide') {
    panel(ctx, mid); edgeStroke(ctx, mid, 24, 0.35);
    txt(ctx, 'FREE PLAY', mid.x + mid.w / 2, mid.y + 44, 30, PAL.gold, { align: 'center', font: DISPLAY, weight: 700, maxW: mid.w - 30 });
    const tips = ['Tap a string to pluck it', 'Slide a finger across to strum', 'Amber: left hand. Teal: right hand', 'Stop, and a partner answers'];
    tips.forEach((tp, i) => { ctx.font = `500 21px ${UI}`; wrapText(ctx, tp, mid.x + 18, mid.y + 100 + i * 84, mid.w - 36, 26, PAL.text); });
    drawCredit(ctx, mid.x + mid.w / 2, mid.y + mid.h - 18, 11.5, { dim: 0.8 });
  } else {
    txt(ctx, 'FREE PLAY', S.x + S.w / 2, mid.y + mid.h / 2, 40, PAL.gold, { align: 'center', font: DISPLAY, weight: 700, stroke: 6, maxW: S.w * 0.4 });
    txt(ctx, f.echo ? (f.hits ? 'Stop for a moment and a partner answers' : 'Tap a string, or slide across them') : 'Tap a string, or slide across them', S.x + S.w / 2, mid.y + mid.h + 30, 22, PAL.dim, { align: 'center', weight: 600, maxW: S.w - 40 });
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
  txt(ctx, 'Calibrate', S.x + S.w / 2, S.y + 110 + 30, 62, PAL.gold, { align: 'center', font: DISPLAY, weight: 700, stroke: 8 });
  const p = C.pad;
  // a pulsing bead on a string
  const r = p.r * (1 + 0.06 * c.pulse);
  ctx.strokeStyle = 'rgba(255,248,226,0.8)'; ctx.lineWidth = 4; ctx.beginPath(); ctx.moveTo(p.x, p.y - r * 2.4); ctx.lineTo(p.x, p.y + r * 2.4); ctx.stroke();
  const g = ctx.createRadialGradient(p.x - r * 0.3, p.y - r * 0.35, r * 0.1, p.x, p.y, r);
  g.addColorStop(0, '#fff6dc'); g.addColorStop(0.5, '#ffb347'); g.addColorStop(1, '#b8661a');
  ctx.fillStyle = g; ctx.beginPath(); ctx.arc(p.x, p.y, r, 0, 6.3); ctx.fill(); ctx.lineWidth = 6; ctx.strokeStyle = 'rgba(255,250,235,0.9)'; ctx.stroke();
  ctx.save(); ctx.globalCompositeOperation = 'lighter'; const gl = ctx.createRadialGradient(p.x, p.y, 5, p.x, p.y, r * 1.6); gl.addColorStop(0, `rgba(255,170,70,${0.6 * c.pulse + 0.7 * c.flash})`); gl.addColorStop(1, 'rgba(255,170,70,0)'); ctx.fillStyle = gl; ctx.beginPath(); ctx.arc(p.x, p.y, r * 1.6, 0, 6.3); ctx.fill(); ctx.restore();
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
void barDur; void ENSEMBLE; void FINGER_NAMES;
