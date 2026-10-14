// Drawing for the playing screens: the instrument with arriving notes, the HUD, the teacher's mallets, free play and calibration.
import { PAL, UI, DISPLAY, drawRoom, drawBody, drawLabels, drawCourses, drawBridges, drawSpot, drawNote, drawMallet, drawTouch, drawPopup, drawParticles } from './art.js';
import { txt, button, panel, rrect, chip, wrap, minUnits } from './ui.js';
import { menuRects, host } from './layout.js';
import { NNOTE, PIECES, ENSEMBLE, HANDS, THINK, whyOf, notesUsed, parsePiece, noteName, semiOf, scaleById, sargamOf } from './music.js';
import { edgeStroke } from './brand.js';
import { v3 } from './v3.js';

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const TAU = Math.PI * 2;
function lowerBound(ev, t) { let lo = 0, hi = ev.length; while (lo < hi) { const m = (lo + hi) >> 1; if (ev[m].t < t) lo = m + 1; else hi = m; } return lo; }
const cap1 = (s) => s[0].toUpperCase() + s.slice(1);

// ---- captions: what the teacher tells you ---------------------------------------------------------------------------------------------------------------
function curTeach(pl) {
  let best = null;
  for (let i = Math.max(0, lowerBound(pl.ev, pl.t - 1.8)); i < pl.ev.length; i++) {
    const e = pl.ev[i]; if (e.t > pl.t + 1.2 && best) break;
    if (e.who === 'teach' && !e.tr) { if (e.t <= pl.t + 0.15) best = e; else { if (!best) best = e; break; } }
  }
  return best;
}
function nextNote(pl) {
  for (let i = Math.max(0, lowerBound(pl.ev, pl.t - 0.2)); i < pl.ev.length; i++) { const e = pl.ev[i]; if (e.who === 'note' && !e.j) return e; if (e.t > pl.t + 6) break; }
  return null;
}
function segNow(pl) { for (let i = pl.segs.length - 1; i >= 0; i--) if (pl.segs[i].t0 <= pl.t) return pl.segs[i]; return null; }
function phraseNow(pl) { for (let i = pl.bars.length - 1; i >= 0; i--) if (pl.bars[i].t0 <= pl.t && pl.bars[i].idx >= 0) return pl.bars[i].idx >> 1; return 0; }
const kindWord = (e) => (e.kind === 'roll' ? ' · tremolo' : e.sw ? ' · run' : e.item && e.item.chord ? ' · chord' : '');
export function captionOf(pl) {
  const piece = pl.piece, tips = piece.tips;
  if (pl.auto && pl.auto.phase !== 'act') {
    const k = pl.auto.k, first = parsePiece(piece).items.find((i) => i.bar >= k * 2 && i.kind !== 'rest');
    if (pl.auto.phase === 'think') return { title: `Think · phrase ${k + 1} of 4`, text: `${tips[k]} The spots used in this phrase are lit.`, n: null };
    return { title: `Reveal · phrase ${k + 1}`, text: first ? `First: the ${HANDS[first.side]} mallet on note ${first.n + 1}. ${whyOf(piece, first)}` : tips[k], n: first ? first.n : null };
  }
  if (pl.mode === 'auto' || (pl.mode === 'learn' && segNow(pl) && segNow(pl).kind === 'listen')) {
    const e = curTeach(pl);
    if (e) return { title: `${cap1(HANDS[e.side])} mallet · note ${e.n + 1}${kindWord(e)}`, text: whyOf(piece, e.item), n: e.n };
    return { title: pl.mode === 'auto' ? 'Watch and Learn' : 'Listen', text: 'Watch the mallets and listen.', n: null };
  }
  if (pl.mode === 'learn') {
    const g = segNow(pl), L = pl.learn;
    if (L.final) return { title: g && g.kind === 'count' ? 'Final take' : 'Final take · play it through', text: 'The whole piece, straight through. The drone and the drum join as you play cleanly.', n: null };
    if (!g || g.kind === 'count') return { title: `Phrase ${L.phrase + 1} of 4 · try ${L.attempt}`, text: L.attempt === 1 ? 'Count in. First you hear it, then you play it back from memory.' : 'Count in. This time the notes are shown.', n: null };
    return { title: `Your turn · phrase ${L.phrase + 1}`, text: g.blind && pl.hintT <= 0 ? 'From memory: no notes are shown. Tap Show me for a reminder.' : tips[L.phrase], n: null };
  }
  const nn = pl.hintT > 0 ? nextNote(pl) : null;
  if (nn) return { title: `${cap1(HANDS[nn.side])} mallet · note ${nn.n + 1}${kindWord(nn)}`, text: whyOf(piece, nn.item), n: nn.n };
  const ph = phraseNow(pl);
  return { title: `${piece.name} · phrase ${ph + 1} of 4`, text: tips[ph], n: null };
}

// ---- HUD pieces ----------------------------------------------------------------------------------------------------------------------------------------
function hudScore(ctx, r, st, pl) {
  const big = clamp(r.h * 0.55, 30, 64);
  if (pl.mode === 'auto') { txt(ctx, 'WATCH AND LEARN', r.x, r.y + r.h * 0.3, clamp(r.h * 0.24, 17, 26), PAL.saffron, { weight: 800, maxW: r.w }); txt(ctx, pl.piece.name, r.x, r.y + r.h * 0.72, big * 0.78, PAL.text, { font: DISPLAY, weight: 700, maxW: r.w }); return; }
  txt(ctx, pl.mode === 'learn' && !pl.learn.final ? `LEARN · ${pl.piece.name.toUpperCase()}` : pl.mode === 'learn' ? 'FINAL TAKE' : pl.piece.name.toUpperCase(), r.x, r.y + r.h * 0.16, clamp(r.h * 0.19, 14, 22), PAL.saffron, { weight: 800, maxW: r.w });
  txt(ctx, String(pl.score), r.x, r.y + r.h * 0.58, big * 0.86, PAL.text, { weight: 800, maxW: r.w * 0.62, stroke: 5 });
  if (pl.combo > 1) txt(ctx, `${pl.combo} in a row`, r.x + r.w, r.y + r.h * 0.5, clamp(r.h * 0.26, 16, 26), PAL.tealHi, { align: 'right', weight: 800, maxW: r.w * 0.4 });
  if (pl.combo >= 10) txt(ctx, `x${Math.min(4, 1 + Math.floor(pl.combo / 10))}`, r.x + r.w, r.y + r.h * 0.82, clamp(r.h * 0.28, 18, 30), PAL.gold, { align: 'right', weight: 800 });
}
function hudEns(ctx, r, pl) {
  if (pl.mode === 'auto' || (pl.mode === 'learn' && !pl.learn.final)) { txt(ctx, pl.mode === 'auto' ? 'with drone and drum' : `try ${pl.learn.attempt} of 2`, r.x, r.y + r.h / 2, clamp(r.h * 0.4, 14, 22), PAL.dim, { weight: 600, maxW: r.w }); return; }
  txt(ctx, 'DRONE · DRUM', r.x, r.y + r.h * 0.2, clamp(r.h * 0.26, 11, 17), PAL.dim, { weight: 800, maxW: r.w });
  const rad = clamp(r.h * 0.2, 9, 15);
  for (let i = 1; i <= ENSEMBLE.max; i++) {
    const on = pl.ens >= i, cx = r.x + rad + (i - 1) * (rad * 2.6), cy = r.y + r.h * 0.66;
    ctx.save();
    if (on) { ctx.globalCompositeOperation = 'lighter'; const g = ctx.createRadialGradient(cx, cy, 1, cx, cy, rad * 2.2); g.addColorStop(0, `rgba(255,200,120,${0.55 + 0.4 * pl.layerFlash})`); g.addColorStop(1, 'rgba(255,200,120,0)'); ctx.fillStyle = g; ctx.beginPath(); ctx.arc(cx, cy, rad * 2.2, 0, TAU); ctx.fill(); ctx.globalCompositeOperation = 'source-over'; }
    ctx.fillStyle = on ? '#ffd890' : 'rgba(255,240,220,0.14)'; ctx.beginPath(); ctx.arc(cx, cy, rad, 0, TAU); ctx.fill();
    ctx.strokeStyle = on ? '#fff3c8' : 'rgba(255,240,220,0.3)'; ctx.lineWidth = 2; ctx.stroke(); ctx.restore();
  }
}
function hudProg(ctx, r, pl) {
  let f = pl.endT > 0 ? pl.t / pl.endT : 0;
  if (pl.mode === 'learn' && !pl.learn.final) f = (pl.learn.phrase + clamp(pl.cur ? (pl.t - pl.cur.t0) / Math.max(0.1, pl.cur.t1 - pl.cur.t0) : 0, 0, 1)) / 5;
  if (pl.mode === 'auto') f = (pl.auto.k + (pl.auto.phase === 'act' ? clamp(pl.cur ? (pl.t - pl.cur.t0) / Math.max(0.1, pl.cur.t1 - pl.cur.t0) : 0, 0, 1) : 0)) / 4;
  f = clamp(f, 0, 1);
  const h = Math.min(10, r.h), y = r.y + (r.h - h) / 2;
  ctx.fillStyle = 'rgba(255,240,220,0.14)'; rrect(ctx, { x: r.x, y, w: r.w, h }, h / 2); ctx.fill();
  const g = ctx.createLinearGradient(r.x, 0, r.x + r.w, 0); g.addColorStop(0, '#ff9a3c'); g.addColorStop(1, '#8ef0dc');
  ctx.fillStyle = g; rrect(ctx, { x: r.x, y, w: Math.max(h, r.w * f), h }, h / 2); ctx.fill();
  if (pl.mode === 'learn' && !pl.learn.final) for (let i = 1; i < 5; i++) { ctx.fillStyle = 'rgba(20,10,30,0.6)'; ctx.fillRect(r.x + (r.w * i) / 5 - 1, y, 2, h); }
  if (pl.mode === 'auto') for (let i = 1; i < 4; i++) { ctx.fillStyle = 'rgba(20,10,30,0.6)'; ctx.fillRect(r.x + (r.w * i) / 4 - 1, y, 2, h); }
}
// The caption (what the teacher says). Text zoom grows it as far as the box allows; sizes use the same floor as txt() so wrapping measures what is drawn.
function hudCap(ctx, r, pl, st) {
  const cap = captionOf(pl), fs = (v) => Math.max(v, minUnits());
  panel(ctx, r, { fill: 'rgba(8,20,26,0.76)', rad: 20 });
  const pad = Math.max(10, Math.min(16, r.h * 0.1)), narrow = r.w < 320, strip = r.h < 70 + 0 * st;
  let x = r.x + pad, top0 = r.y + pad;
  if (cap.n !== null && cap.n !== undefined) {
    const bs = narrow ? Math.min(r.w * 0.3, 60) : Math.min(r.h - pad * 1.4, 72), by = narrow ? r.y + pad : r.y + (r.h - bs) / 2, side = cap.n & 1;
    ctx.fillStyle = side === 0 ? 'rgba(255,179,71,0.28)' : 'rgba(53,214,192,0.28)'; rrect(ctx, { x, y: by, w: bs, h: bs }, bs * 0.22); ctx.fill();
    txt(ctx, String(cap.n + 1), x + bs / 2, by + bs / 2, bs * 0.58, '#fff0b8', { align: 'center', weight: 800 });
    if (narrow) top0 = by + bs + 8; else x += bs + pad;
  }
  const w = r.x + r.w - pad - x, zMax = Math.max(1, Math.min(3, host.tz));
  if (strip) {
    let best = null;
    for (let z = zMax; z >= 0.999; z -= 0.1) {
      const ts = fs(clamp(r.h * 0.38, 15, 26) * Math.min(z, 1.4)), bs = fs(ts * 0.84 * (z > 1.4 ? z / 1.4 : 1));
      ctx.font = `500 ${bs}px ${UI}`; const lines = wrap(ctx, cap.text, w * 0.6), room = Math.max(1, Math.floor((r.h - pad) / (bs * 1.25)));
      best = { ts, bs, lines: lines.slice(0, room) };
      if (lines.length <= room) break;
    }
    const { ts, bs, lines } = best, h = lines.length * bs * 1.25, y0 = r.y + (r.h - h) / 2 + bs * 0.62;
    txt(ctx, cap.title, x, r.y + r.h * 0.5, ts, PAL.saffron, { weight: 800, maxW: w * 0.36 });
    lines.forEach((ln, i) => txt(ctx, ln, x + w * 0.4, y0 + i * bs * 1.25, bs, PAL.text, { weight: 500, maxW: w * 0.6 }));
    return;
  }
  const avail = r.y + r.h - pad - top0;
  let best = null;
  for (let z = zMax; z >= 0.999; z -= 0.1) {
    const ts = fs((narrow ? 17 : clamp(r.h * 0.2, 17, 28)) * z), bs = fs((narrow ? clamp(r.w * 0.075, 15, 21) : clamp(r.h * 0.17, 16, 25)) * z);
    ctx.font = `800 ${ts}px ${UI}`; const tl = wrap(ctx, cap.title, w).slice(0, narrow || z > 1.2 ? 3 : 1);
    ctx.font = `500 ${bs}px ${UI}`; const lines = wrap(ctx, cap.text, w), need = tl.length * ts * 1.2 + 6 + lines.length * bs * 1.32;
    best = { ts, bs, tl, lines, need };
    if (need <= avail) break;
  }
  const { ts, bs, tl } = best;
  tl.forEach((ln, i) => txt(ctx, ln, x, top0 + ts * 0.6 + i * ts * 1.2, ts, PAL.saffron, { weight: 800, maxW: w }));
  const y0 = top0 + tl.length * ts * 1.2 + 6;
  const lines = best.lines.slice(0, Math.max(1, Math.floor((r.y + r.h - pad - y0) / (bs * 1.32))));
  lines.forEach((ln, i) => txt(ctx, ln, x, y0 + bs * 0.65 + i * bs * 1.32, bs, PAL.text, { weight: 500, maxW: w }));
}

// ---- mallets -------------------------------------------------------------------------------------------------------------------------------------------
function mallets(ctx, st, pl, inst, thinkingReveal, cap) {
  const grip = { x: -inst.along.x, y: -inst.along.y }, sc = clamp(inst.rh / 110, 0.7, 1.35);
  for (let s = 0; s < 2; s++) {
    const h = pl.hand[s];
    if (thinkingReveal && cap.n !== null && (cap.n & 1) === s) { const p = inst.pt(cap.n); drawMallet(ctx, p.x, p.y, s, grip, inst.across, 0.5 + 0.5 * Math.sin(st.t * 6), 0.6, sc); continue; }
    if (h.on) {
      const p = inst.pt(h.n);
      drawMallet(ctx, p.x, p.y, s, grip, inst.across, h.down, h.down, sc);
    } else if (pl.mal[s] && pl.mode !== 'auto') {
      const m = pl.mal[s], a = clamp(1 - (m.age - 0.5) / 0.7, 0, 1);
      if (a > 0) { ctx.save(); ctx.globalAlpha = a; drawMallet(ctx, m.x, m.y, s, grip, inst.across, m.down, m.down * 0.6, sc); ctx.restore(); }
    }
  }
}

// ---- the stage -------------------------------------------------------------------------------------------------------------------------------------------
export function renderPlay(ctx, st, L, view, meta, pauseItems, X) {
  const pl = st.pl, P = L.play, inst = P.inst, S = L.S, ap = X.approach, r = clamp(Math.min(inst.rh * 0.36, inst.hb * 0.2), 16, 44);
  const sc = scaleById(pl.scale), lm = X.labelMode;
  const modal = v3.on && (pl.paused || pl.over);                           // 3D: the scrim dims what is under the menu, so no text of the screen below
  if (modal) v3.mute = true;
  drawRoom(ctx, L.w + 4, L.h + 4);
  meta.previewBadge = { x: inst.r.x + inst.r.w / 2, y: inst.r.y + 6, align: 'center' };
  if (P.hud === 'side') {
    panel(ctx, P.left, { fill: 'rgba(8,20,26,0.72)' }); edgeStroke(ctx, P.left, 24, 0.3); panel(ctx, P.right, { fill: 'rgba(8,20,26,0.72)' }); edgeStroke(ctx, P.right, 24, 0.3);
    hudScore(ctx, P.score, st, pl); hudEns(ctx, P.ens, pl); hudProg(ctx, P.prog, pl);
    drawStats(ctx, P.stats, pl);
    hudCap(ctx, P.cap, pl, st);
  } else {
    if (v3.on) panel(ctx, { x: S.x, y: S.y, w: S.w, h: (P.cap.y + P.cap.h + 8) - S.y }, { kind: 'band' });
    else { ctx.fillStyle = 'rgba(4,12,16,0.5)'; ctx.fillRect(S.x, S.y, S.w, (P.cap.y + P.cap.h + 8) - S.y); }
    hudScore(ctx, P.score, st, pl); hudEns(ctx, P.ens, pl); hudProg(ctx, P.prog, pl); hudCap(ctx, P.cap, pl, st);
  }
  const hintIcon = pl.mode === 'auto' ? 'skip' : pl.mode === 'learn' && !pl.learn.final ? 'ear' : 'bulb';
  const wideBtn = P.pause.w > P.pause.h * 1.5;
  button(ctx, P.hint, wideBtn ? (pl.mode === 'auto' ? 'Skip wait' : pl.mode === 'learn' && !pl.learn.final ? 'Listen again' : 'Show me') : '', { icon: hintIcon, kind: 'quiet', size: 26 });
  button(ctx, P.pause, wideBtn ? 'Pause' : '', { icon: 'pause', kind: 'quiet', size: 26 });

  // instrument
  drawBody(ctx, inst, 1);
  const cap = captionOf(pl), thinking = pl.auto && pl.auto.phase !== 'act';
  const sv = pl.ss.map((s) => ({ vib: s.vib, ph: s.ph, glow: s.glow }));
  const lo = lowerBound(pl.ev, pl.t - 0.5);
  for (let i = lo; i < pl.ev.length && pl.ev[i].t < pl.t + 0.5; i++) {
    const e = pl.ev[i]; if (e.n < 0 || e.who === 'click' || e.who === 'ens' || e.j || e.blind) continue;
    sv[e.n].glow = Math.max(sv[e.n].glow, 0.5 * (1 - Math.abs(e.t - pl.t) / 0.5));
  }
  let focus = null;
  if (thinking) focus = new Set(notesUsed(pl.piece, pl.auto.k * 2, pl.auto.k * 2 + 2));
  drawCourses(ctx, inst, sv, { focus });
  drawBridges(ctx, inst, { hot: focus });
  for (let n = 0; n < NNOTE; n++) { const p = inst.pt(n); drawSpot(ctx, p.x, p.y, r, n & 1, sv[n].glow * 0.8, pl.ss[n].flash); }

  // arriving notes and the thread that joins them
  const list = [];
  for (let i = lo; i < pl.ev.length; i++) {
    const e = pl.ev[i]; if (e.t > pl.t + ap + 0.2) break;
    if ((e.who !== 'note' && e.who !== 'teach') || e.tr) continue;
    if (e.blind && pl.hintT <= 0 && e.who === 'note') continue;
    if (e.kind === 'roll') { if (e.j && !pl.rolls.includes(e)) continue; if (pl.t > e.t + e.dur + 0.1) continue; }
    else if ((e.j && e.j !== 'miss') || e.t < pl.t - (e.j === 'miss' ? 0.35 : 0.1)) { if (e.t < pl.t - 0.1 || e.j) continue; }
    const p = inst.pt(e.n), k = clamp((e.t - pl.t) / ap, 0, 1);
    list.push({ e, p, k, a: clamp((1 - k) * 6, 0, 1) * (e.j === 'miss' ? 0.3 : 1) });
  }
  for (let i = 0; i + 1 < list.length; i++) {
    const a = list[i], b = list[i + 1];
    if (b.e.t - a.e.t > 1.3 || a.e.n === b.e.n) continue;
    ctx.save(); ctx.globalAlpha = Math.min(a.a, b.a) * (a.e.sw ? 0.55 : 0.32); ctx.strokeStyle = a.e.sw ? '#35c3b0' : 'rgba(255,240,210,0.8)'; ctx.lineWidth = r * (a.e.sw ? 0.6 : 0.2); ctx.lineCap = 'round';
    if (a.e.sw) { ctx.shadowColor = 'rgba(53,214,192,0.8)'; ctx.shadowBlur = 10; }
    ctx.beginPath(); ctx.moveTo(a.p.x, a.p.y); ctx.lineTo(b.p.x, b.p.y); ctx.stroke(); ctx.restore();
  }
  for (const q of list) {
    const e = q.e;
    const hold = e.kind === 'roll' && pl.t >= e.t ? clamp((pl.t - e.t) / e.dur, 0, 1) : 0;
    drawNote(ctx, q.p.x, q.p.y, r, { side: e.side, kind: e.kind, k: q.k, alpha: q.a, flash: Math.max(0, 1 - Math.abs(e.t - pl.t) / 0.06) * 0.3, hold, ghost: e.who === 'teach' });
  }
  // the blind echo shows where a missed note was
  if (pl.showMiss) for (const m of pl.showMiss) { const p = inst.pt(m.n); ctx.save(); ctx.globalAlpha = clamp(1 - m.age / 1.1, 0, 1); drawNote(ctx, p.x, p.y, r, { side: m.n & 1, k: 0, alpha: 1, ghost: true }); ctx.restore(); }

  mallets(ctx, st, pl, inst, thinking && pl.auto.phase === 'reveal', cap);
  drawParticles(ctx, pl.parts);
  for (const p of pl.pops) drawPopup(ctx, p);
  for (const t of st.tv) drawTouch(ctx, t.x, t.y, 26, t.side);
  drawLabels(ctx, inst, clamp(inst.rh * 0.15, 13, 22), pl.scale, lm === 'off' ? null : lm, focus ?? (cap.n !== null ? new Set([cap.n]) : null), r);

  // count-in numerals, banners
  const bar = (() => { for (let i = pl.bars.length - 1; i >= 0; i--) if (pl.bars[i].t0 <= pl.t) return pl.bars[i].t1 > pl.t ? pl.bars[i] : null; return null; })();
  const cx = inst.r.x + inst.r.w / 2, cy = inst.r.y + inst.r.h * 0.42;
  if (bar && bar.idx === -1) {
    const n = clamp(Math.floor((pl.t - bar.t0) / ((bar.t1 - bar.t0) / 4)) + 1, 1, 4), ph = ((pl.t - bar.t0) / ((bar.t1 - bar.t0) / 4)) % 1;
    ctx.save(); ctx.globalAlpha = 0.85 * (1 - ph * 0.6);
    txt(ctx, String(n), cx, cy, 170 * (1 + 0.12 * (1 - ph)), PAL.gold, { align: 'center', weight: 800, stroke: 14 }); ctx.restore();
  }
  const g = segNow(pl);
  if (pl.mode === 'learn' && g && g.kind === 'echo' && g.blind && pl.t - g.t0 < 1.6 && !pl.banner) {
    ctx.save(); ctx.globalAlpha = clamp(1 - (pl.t - g.t0 - 0.9) / 0.7, 0, 1);
    txt(ctx, 'FROM MEMORY', cx, cy, 58, PAL.tealHi, { align: 'center', font: DISPLAY, weight: 700, stroke: 10, maxW: inst.r.w - 30 }); ctx.restore();
  }
  if (pl.banner) {
    const a = clamp(Math.min(pl.banner.t / 0.15, (1.6 - pl.banner.t) / 0.4), 0, 1);
    ctx.save(); ctx.globalAlpha = a;
    txt(ctx, pl.banner.text, cx, cy, 64, PAL.gold, { align: 'center', font: DISPLAY, weight: 700, stroke: 10, maxW: inst.r.w - 30 });
    ctx.restore();
  }
  if (thinking) { const tp = inst.pt(5); drawThink(ctx, st, pl, inst, (tp.x + cx) / 2, (tp.y + cy) / 2 + inst.rh * 0.2); }
  v3.mute = false;
  if (pl.paused || pl.over) drawPauseMenu(ctx, st, L, pl, pauseItems(pl));
}

function drawStats(ctx, r, pl) {
  const rows = [['Perfect', pl.counts.perfect, '#ffe07a'], ['Great', pl.counts.great, '#8ef0dc'], ['Good', pl.counts.good, '#9fc4ff'], ['Near', pl.counts.off, '#d9b3ff'], ['Miss', pl.counts.miss, '#ff7d8f'], ['Rolls', pl.rollOk, '#f6d98a'], ['Runs', pl.runN, '#8ef0dc']];
  const rh = Math.min(40, r.h / rows.length);
  rows.forEach(([n, v, c], i) => { const y = r.y + i * rh + rh / 2; txt(ctx, n, r.x + 4, y, Math.min(20, rh * 0.5), PAL.dim, { weight: 600 }); txt(ctx, String(v), r.x + r.w - 4, y, Math.min(24, rh * 0.6), c, { align: 'right', weight: 800 }); });
}

function drawThink(ctx, st, pl, inst, cx, cy) {
  const A = pl.auto, rad = 62, f = clamp(A.timer / Math.max(0.1, A.total), 0, 1);
  ctx.save();
  ctx.fillStyle = 'rgba(4,12,16,0.66)'; ctx.beginPath(); ctx.arc(cx, cy, rad + 22, 0, TAU); ctx.fill();
  ctx.lineWidth = 9; ctx.strokeStyle = 'rgba(255,240,220,0.16)'; ctx.beginPath(); ctx.arc(cx, cy, rad, 0, TAU); ctx.stroke();
  ctx.strokeStyle = A.phase === 'think' ? '#f6d98a' : '#8ef0dc'; ctx.lineCap = 'round'; ctx.beginPath(); ctx.arc(cx, cy, rad, -Math.PI / 2, -Math.PI / 2 + TAU * f); ctx.stroke();
  txt(ctx, String(Math.max(0, Math.ceil(A.timer))), cx, cy - 6, 56, PAL.text, { align: 'center', weight: 800 });
  txt(ctx, A.phase === 'think' ? 'THINK' : 'REVEAL', cx, cy + 38, 17, A.phase === 'think' ? PAL.saffron : PAL.tealHi, { align: 'center', weight: 800 });
  ctx.restore();
}

function drawPauseMenu(ctx, st, L, pl, items) {
  const M = menuRects(L, items.length, 130);
  if (v3.on) v3.items.push({ t: 'scrim', a: 0.74 }); else { ctx.fillStyle = 'rgba(2,8,12,0.72)'; ctx.fillRect(0, 0, L.w, L.h); }
  panel(ctx, M.panel, { fill: 'rgba(10,26,32,0.96)' }); edgeStroke(ctx, M.panel, 24, 0.6);
  txt(ctx, pl.over ? (pl.mode === 'auto' ? 'That was the piece' : 'Finished') : 'Paused', M.panel.x + M.panel.w / 2, M.panel.y + 64, 52, PAL.gold, { align: 'center', font: DISPLAY, weight: 700, stroke: 7 });
  const label = { resume: 'Resume', restart: 'Restart', again: 'Watch again', next: 'Next piece', exit: 'Back to the piece', quit: 'Leave', listen: 'Listen again', speed: st.prefs.autoSlow ? 'Normal speed' : 'Slower' };
  items.forEach((it, i) => button(ctx, M.btns[i], label[it], { kind: it === 'resume' || it === 'again' ? 'primary' : 'quiet', size: 30 }));
}

// ---- free play ------------------------------------------------------------------------------------------------------------------------------------------
const LABEL_NAMES = { sargam: 'Sargam names', number: 'Note numbers', off: 'No labels' };
export function renderFree(ctx, st, L, meta, X) {
  const f = st.free, F = L.free, inst = F.inst, S = L.S, lm = X.labelMode;
  drawRoom(ctx, L.w + 4, L.h + 4);
  meta.previewBadge = { x: inst.r.x + inst.r.w / 2, y: inst.r.y + 6, align: 'center' };
  const sc = scaleById(f.scale);
  if (F.hud === 'side') { panel(ctx, F.left, { fill: 'rgba(8,20,26,0.72)' }); edgeStroke(ctx, F.left, 24, 0.3); panel(ctx, F.right, { fill: 'rgba(8,20,26,0.72)' }); edgeStroke(ctx, F.right, 24, 0.3); }
  else if (v3.on) panel(ctx, { x: S.x, y: S.y, w: S.w, h: F.cap ? F.cap.y + F.cap.h + 8 - S.y : F.exit.y + F.exit.h + 12 - S.y }, { kind: 'band' });
  else { ctx.fillStyle = 'rgba(4,12,16,0.5)'; ctx.fillRect(S.x, S.y, S.w, F.cap ? F.cap.y + F.cap.h + 8 - S.y : F.exit.y + F.exit.h + 12 - S.y); }
  button(ctx, F.exit, 'Menu', { icon: 'back', kind: 'ghost', size: 26 });
  button(ctx, F.scale, sc.name, { kind: 'primary', size: 28, sub: 'Tap for the next scale' });
  button(ctx, F.labels, LABEL_NAMES[lm], { kind: 'quiet', size: 24 });
  button(ctx, F.reset, 'Reset scale', { kind: 'quiet', size: 24 });
  const infoR = F.info, help = 'Strike a spot with a fingertip, hold it for a tremolo, drag across spots for a run. Left spots are the left mallet, right spots the right.';
  if (F.hud === 'side') {
    const fz = Math.max(21, minUnits()), z = Math.min(1.6, host.tz);
    txt(ctx, 'FREE PLAY', infoR.x, infoR.y + 22, 20 * z, PAL.saffron, { weight: 800 });
    let f2 = fz * z, lines;
    for (; ; f2 *= 0.93) { ctx.font = `500 ${f2}px ${UI}`; lines = wrap(ctx, `${sc.blurb}\n\n${help}`, infoR.w); if (f2 <= fz + 0.1 || 62 * z + lines.length * f2 * 1.35 < infoR.h) break; }
    lines.forEach((ln, i) => txt(ctx, ln, infoR.x, infoR.y + 40 * z + f2 + i * f2 * 1.35, f2, PAL.text, { weight: 500, maxW: infoR.w }));
  } else {
    const r = F.cap ?? infoR;
    if (F.cap) {
      txt(ctx, 'FREE PLAY', infoR.x + infoR.w / 2, infoR.y + infoR.h / 2, 24, PAL.saffron, { align: 'center', weight: 800 });
      const fz = Math.max(21, minUnits()) * Math.min(1.5, host.tz); ctx.font = `500 ${fz}px ${UI}`; const lines = wrap(ctx, `${sc.blurb} Strike a spot, hold for a tremolo, drag for a run.`, r.w - 20).slice(0, Math.max(2, Math.floor(r.h / (fz * 1.25))));
      lines.forEach((ln, i) => txt(ctx, ln, r.x + r.w / 2, r.y + fz * 0.9 + i * fz * 1.25, fz, PAL.text, { align: 'center', weight: 500, maxW: r.w - 20 }));
    } else txt(ctx, `FREE PLAY · ${sc.blurb}`, infoR.x, infoR.y + infoR.h / 2, 21, PAL.text, { weight: 600, maxW: infoR.w });
  }
  drawBody(ctx, inst, 1);
  drawCourses(ctx, inst, f.ss, {});
  drawBridges(ctx, inst, {});
  const r = clamp(Math.min(inst.rh * 0.36, inst.hb * 0.2), 16, 44);
  for (let n = 0; n < NNOTE; n++) {
    const p = inst.pt(n);
    drawSpot(ctx, p.x, p.y, r, n & 1, f.ss[n].glow * 0.8, f.ss[n].flash);
    txt(ctx, noteName(semiOf(sc, n)), p.x, p.y, clamp(r * 0.62, 11, 20), 'rgba(255,240,210,0.85)', { align: 'center', weight: 800, stroke: 3.5 });
  }
  drawParticles(ctx, f.parts);
  const grip = { x: -inst.along.x, y: -inst.along.y }, msc = clamp(inst.rh / 110, 0.7, 1.35);
  for (let s = 0; s < 2; s++) { const m = f.mal[s]; if (m) { ctx.save(); ctx.globalAlpha = clamp(1 - (m.age - 0.5) / 0.7, 0, 1); drawMallet(ctx, m.x, m.y, s, grip, inst.across, m.down, m.down * 0.6, msc); ctx.restore(); } }
  for (const t of st.tv) drawTouch(ctx, t.x, t.y, 26, t.side);
  drawLabels(ctx, inst, clamp(inst.rh * 0.15, 13, 22), f.scale, lm === 'off' ? null : lm, null, r);
}

// ---- calibration ----------------------------------------------------------------------------------------------------------------------------------------------
export function renderCalib(ctx, st, L) {
  const c = st.cal, C = L.calib, S = L.S;
  drawRoom(ctx, L.w + 4, L.h + 4);
  button(ctx, C.back, 'Back', { icon: 'back', kind: 'ghost', size: 28 });
  txt(ctx, 'Calibrate', S.x + S.w / 2, S.y + 140, 58, PAL.gold, { align: 'center', font: DISPLAY, weight: 700, stroke: 8 });
  const p = C.pad, rr = p.r * (1 + 0.05 * c.pulse);
  if (v3.on) v3.items.push({ t: 'pad', x: p.x, y: p.y, r: rr, pulse: c.pulse, flash: c.flash });
  else {
    const g = ctx.createRadialGradient(p.x - rr * 0.2, p.y - rr * 0.25, rr * 0.1, p.x, p.y, rr);
    g.addColorStop(0, '#ffe8b8'); g.addColorStop(0.7, '#d9a054'); g.addColorStop(1, '#8a5428');
    ctx.fillStyle = 'rgba(0,0,0,0.4)'; ctx.beginPath(); ctx.arc(p.x + 4, p.y + 8, rr * 1.04, 0, TAU); ctx.fill();
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(p.x, p.y, rr, 0, TAU); ctx.fill();
    ctx.strokeStyle = 'rgba(60,30,10,0.6)'; ctx.lineWidth = 3; ctx.stroke();
    ctx.save(); ctx.globalCompositeOperation = 'lighter'; const gl = ctx.createRadialGradient(p.x, p.y, 5, p.x, p.y, rr); gl.addColorStop(0, `rgba(255,170,90,${0.6 * c.pulse + 0.7 * c.flash})`); gl.addColorStop(1, 'rgba(255,170,90,0)'); ctx.fillStyle = gl; ctx.beginPath(); ctx.arc(p.x, p.y, rr, 0, TAU); ctx.fill(); ctx.restore();

  }
  txt(ctx, '♪', p.x, p.y, rr * 0.8, 'rgba(60,30,10,0.55)', { align: 'center', weight: 700 });
  if (c.phase === 'run') {
    const next = c.T0 + (Math.floor(Math.max(0, c.t - c.T0) * c.bpm / 60) + (c.t < c.T0 ? 0 : 1)) * 60 / c.bpm, u = clamp((next - c.t) / (60 / c.bpm), 0, 1);
    ctx.strokeStyle = `rgba(246,217,138,${0.9 - u * 0.5})`; ctx.lineWidth = 6; ctx.beginPath(); ctx.arc(p.x, p.y, rr * (1 + 0.55 * u), 0, TAU); ctx.stroke();
  }
  const msg = c.phase === 'run' ? (c.t < c.T0 ? 'Get ready: tap anywhere on every beat' : c.lastBeat < 4 ? 'Keep time, tap on every beat' : `Now counting: ${Math.min(c.taps.length, 99)} taps`) : c.result.ms === null ? 'Not enough taps. Try once more.' : `Your latency: ${c.result.ms} ms`;
  txt(ctx, msg, S.x + S.w / 2, p.y + p.r * 1.62 + 56, 34, c.phase === 'done' ? PAL.gold : PAL.text, { align: 'center', weight: 700, maxW: S.w - 40 });
  if (c.phase === 'done') {
    txt(ctx, c.result.ms === null ? 'Tap along with the pulse, not before it.' : 'Positive means the sound reaches you late; the game now allows for it.', S.x + S.w / 2, p.y + p.r * 1.62 + 100, 22, PAL.dim, { align: 'center', maxW: S.w - 40 });
    button(ctx, C.retry, 'Try again', { kind: 'ghost', size: 30 });
    button(ctx, C.use, c.result.ms === null ? 'Back' : 'Use this', { kind: 'primary', size: 30 });
  }
}
void PIECES; void THINK; void rrect; void chip;
