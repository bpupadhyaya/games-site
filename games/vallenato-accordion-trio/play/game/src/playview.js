// Drawing of the play screen: header, seat dock, the score ribbon and the instrument for the part in play.
// It only READS the session (st.pl); every position is a function of the live layout, so a resize or a rotation keeps the state.
import { PAL, UI, DISPLAY, rgba, drawBackdrop, drawKeyboard, drawBellowsPad, drawCaja, drawGuacharaca, drawAccNote, drawCajaNote, drawGuaNote, drawParticles, drawPartIcon } from './art.js';
import { txt, button, panel, rrect, chip } from './ui.js';
import { accGeom, cajaGeom, guaGeom, ribbonGeom } from './layout.js';
import { PART, PARTS, SEE_AHEAD, comboMult, focusPart, roleOf } from './music.js';
import { v3 } from './v3.js';

const GRADE_TEXT = { perfect: 'PERFECT', great: 'GREAT', good: 'GOOD', off: 'NEARLY', miss: 'MISS' };
const GRADE_COL = { perfect: '#ffe07a', great: '#8ef0dc', good: '#9fc4ff', off: '#e0b3ff', miss: '#ff7d8f' };
export { GRADE_TEXT, GRADE_COL };

const bandOf = (G, part) => G[part];

export function drawPlay(ctx, st, L, tm) {
  const pl = st.pl, P = L.play, t = pl.t, calm = st.prefs.calm;
  ctx.save();
  if (!calm && pl.shake > 0) ctx.translate(Math.sin(tm * 90) * pl.shake * 5, Math.cos(tm * 70) * pl.shake * 4);
  drawBackdrop(ctx, L.w, L.h, tm, { dim: 0.12, calm });
  drawHud(ctx, st, L, pl, tm);
  drawDock(ctx, st, L, pl, tm);
  drawRibbon(ctx, st, P.ribbon, pl, tm);
  drawInstrument(ctx, st, P.inst, pl, tm);
  drawParticles(ctx, pl.parts);
  drawOverlays(ctx, st, L, pl, tm);
  ctx.restore();
}

function drawHud(ctx, st, L, pl, tm) {
  const P = L.play, wide = L.mode === 'wide';
  if (wide) panel(ctx, P.left, { rad: 26 });
  v3.dock = P.inst;
  // score
  txt(ctx, 'SCORE', P.score.x + 4, P.score.y + 12, 18, PAL.dim, { weight: 700 });
  txt(ctx, String(Math.round(pl.score)), P.score.x + 2, P.score.y + 50, 52, PAL.gold, { font: DISPLAY, weight: 400, stroke: 7, maxW: P.score.w * (wide ? 1 : 0.55) });
  const mult = comboMult(pl.combo);
  if (pl.combo > 1) chip(ctx, P.score.x + P.score.w - 4, P.score.y + (wide ? 92 : 64), `${pl.combo} in a row  x${mult}`, 22, { align: 'right', fill: mult > 1 ? 'rgba(255,176,46,0.92)' : 'rgba(255,244,224,0.14)', color: mult > 1 ? '#1c0a04' : PAL.text });
  // progress
  const m = P.meter, prog = Math.max(0, Math.min(1, (pl.t - pl.tl.T0) / (pl.tl.end - pl.tl.T0)));
  if (v3.on) v3.panels.push({ r: { x: m.x - 3, y: m.y - 4, w: m.w + 6, h: m.h + 8 }, rad: (m.h + 8) / 2, kind: 'ribbon' }); else { ctx.fillStyle = 'rgba(255,244,224,0.13)'; rrect(ctx, m, m.h / 2); ctx.fill(); }
  if (prog > 0) { ctx.fillStyle = PAL.mint; rrect(ctx, { x: m.x, y: m.y, w: Math.max(m.h, m.w * prog), h: m.h }, m.h / 2); ctx.fill(); }
  if (pl.mode === 'live' || pl.mode === 'auto' || pl.mode === 'replay') {
    for (const s of pl.tl.sections.slice(1)) { const x = m.x + m.w * ((s.t0 - pl.tl.T0) / (pl.tl.end - pl.tl.T0)); ctx.fillStyle = 'rgba(6,26,32,0.8)'; ctx.fillRect(x - 1.5, m.y - 3, 3, m.h + 6); }
  }
  // buttons
  const auto = pl.mode === 'auto' || pl.mode === 'replay';
  button(ctx, P.pause, '', { icon: 'pause', kind: 'quiet' });
  button(ctx, P.hint, '', { icon: auto ? 'restart' : 'bulb', kind: auto ? 'quiet' : (pl.hintOn ? 'on' : 'quiet') });
  if (wide) {
    txt(ctx, pl.mode === 'take' ? `Take: ${PART[pl.seat].name}` : pl.mode === 'live' ? 'Live Trio' : pl.mode === 'auto' ? 'Watch and Learn' : 'Your trio', P.left.x + P.left.w / 2, P.meter.y + 38, 24, PAL.text, { align: 'center', weight: 800, maxW: P.left.w - 24 });
  }
}

function drawDock(ctx, st, L, pl, tm) {
  const P = L.play, focus = focusPart(pl, pl.t);
  PARTS.forEach((part, i) => {
    const r = P.dock[i], info = PART[part], role = roleOf(pl, part, pl.t), on = focus === part;
    const mine = role === 'you';
    const flash = pl.fx[part === 'acc' ? 'accAny' : part] || 0;
    if (v3.on) {
      v3.panels.push({ r: { x: r.x, y: r.y, w: r.w, h: r.h }, rad: 18, kind: 'part', col: mine ? '#fff4e0' : info.col, fill: mine ? info.col : on ? '#2a5a5e' : '#0a2c32' });
      if (flash > 0) { ctx.fillStyle = rgba('#ffffff', 0.28 * flash); rrect(ctx, r, 18); ctx.fill(); }
    } else {
      ctx.fillStyle = mine ? rgba(info.col, 0.9) : on ? 'rgba(255,244,224,0.2)' : 'rgba(5,24,30,0.7)'; rrect(ctx, r, 18); ctx.fill();
      ctx.lineWidth = mine ? 4 : 2; ctx.strokeStyle = mine ? '#fff4e0' : rgba(info.col, 0.7); rrect(ctx, r, 18); ctx.stroke();
      if (flash > 0) { ctx.fillStyle = rgba(info.col, 0.35 * flash); rrect(ctx, r, 18); ctx.fill(); }
    }
    const small = r.w < 200, ic = Math.min(r.h * 0.34, 30);
    const textCol = mine ? '#1c0a04' : PAL.text;
    drawPartIcon(ctx, part, r.x + r.h * 0.46, r.y + r.h / 2, ic, mine ? '#1c0a04' : info.col);
    const tx = r.x + r.h * 0.92;
    txt(ctx, info.name, tx, r.y + r.h * 0.36, Math.min(26, r.h * 0.3), textCol, { weight: 800, maxW: r.x + r.w - tx - 8 });
    const label = role === 'you' ? 'YOU' : role === 'rec' ? 'YOUR TAKE' : pl.mode === 'auto' && on ? 'LEADS' : 'BAND';
    txt(ctx, small && label === 'YOUR TAKE' ? 'TAKE' : label, tx, r.y + r.h * 0.7, Math.min(20, r.h * 0.24), mine ? '#1c0a04' : rgba(info.col, 1), { weight: 800, maxW: r.x + r.w - tx - 8 });
  });
}

// ---- the ribbon ---------------------------------------------------------------------------------------------------------------------------
function drawRibbon(ctx, st, rect, pl, tm) {
  const G = ribbonGeom(rect), t = pl.t, tl = pl.tl;
  panel(ctx, rect, { fill: 'rgba(3,16,21,0.82)', rad: 22, kind: 'ribbon' });
  ctx.save(); rrect(ctx, rect, 22); ctx.clip();
  const focus = focusPart(pl, t);
  for (const part of PARTS) {
    const b = G[part], on = focus === part;
    ctx.fillStyle = on ? rgba(PART[part].col, 0.12) : 'rgba(255,244,224,0.025)'; ctx.fillRect(b.x, b.y, b.w, b.h);
    ctx.strokeStyle = 'rgba(255,238,210,0.1)'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(b.x, b.y + b.h); ctx.lineTo(b.x + b.w, b.y + b.h); ctx.stroke();
  }
  // bar lines and beat ticks
  const x0 = rect.x, x1 = rect.x + rect.w;
  const tMin = t - (G.playX - x0) / G.pxPerSec, tMax = t + (x1 - G.playX) / G.pxPerSec;
  for (const bar of tl.bars) {
    if (bar.t0 < tMin - 0.1 || bar.t0 > tMax) continue;
    const x = G.playX + (bar.t0 - t) * G.pxPerSec;
    ctx.strokeStyle = 'rgba(255,238,210,0.28)'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(x, rect.y + 6); ctx.lineTo(x, rect.y + rect.h - 6); ctx.stroke();
    for (let k = 1; k < 4; k++) { const bx = x + (bar.t1 - bar.t0) * k / 4 * G.pxPerSec; ctx.strokeStyle = 'rgba(255,238,210,0.1)'; ctx.beginPath(); ctx.moveTo(bx, rect.y + 6); ctx.lineTo(bx, rect.y + rect.h - 6); ctx.stroke(); }
  }
  // lane guides: the accordion button rows and the two caja rows
  ctx.strokeStyle = 'rgba(255,238,210,0.07)'; ctx.lineWidth = 1;
  for (let i = 0; i < 7; i++) { const y = rowY(G, 'acc', i); ctx.beginPath(); ctx.moveTo(x0 + 6, y); ctx.lineTo(x1 - 6, y); ctx.stroke(); }
  const r0 = Math.max(10, Math.min(G.acc.h / 7 * 0.46, 26));
  // notes
  const rBig = r0, rSmall = r0 * 0.62;
  for (const part of PARTS) {
    for (const n of tl.notes[part]) {
      if (n.t < tMin - 0.2 || n.t > tMax + 0.1) continue;
      const x = G.playX + (n.t - t) * G.pxPerSec, mine = n.mine;
      if (n.j && n.j !== 'miss') { if (t - n.t < 0.25 && mine) drawHitFlash(ctx, x, rowYFor(G, n), rBig, (0.25 - (t - n.t)) / 0.25, GRADE_COL[n.j]); continue; }
      const past = x < G.playX - 6, y = rowYFor(G, n);
      const miss = n.j === 'miss', alpha = miss ? 0.35 : mine ? 1 : past ? 0.18 : 0.5, r = mine ? rBig : rSmall;
      const o = { alpha, glow: mine && Math.abs(x - G.playX) < 90 };
      if (part === 'acc') drawAccNote(ctx, x, y, r, n, o);
      else if (part === 'caja') drawCajaNote(ctx, x, y, r * 0.95, n, o);
      else drawGuaNote(ctx, x, y, r * 0.9, n, o);
      if (miss) { ctx.strokeStyle = '#ff7d8f'; ctx.lineWidth = 4; ctx.beginPath(); ctx.moveTo(x - r * 0.6, y - r * 0.6); ctx.lineTo(x + r * 0.6, y + r * 0.6); ctx.moveTo(x + r * 0.6, y - r * 0.6); ctx.lineTo(x - r * 0.6, y + r * 0.6); ctx.stroke(); }
    }
  }
  // playhead
  const pg = ctx.createLinearGradient(G.playX - 30, 0, G.playX + 30, 0);
  pg.addColorStop(0, 'rgba(255,209,102,0)'); pg.addColorStop(0.5, `rgba(255,209,102,${0.25 + 0.4 * pl.pulse})`); pg.addColorStop(1, 'rgba(255,209,102,0)');
  ctx.fillStyle = pg; ctx.fillRect(G.playX - 30, rect.y, 60, rect.h);
  ctx.strokeStyle = PAL.gold; ctx.lineWidth = 4; ctx.beginPath(); ctx.moveTo(G.playX, rect.y + 4); ctx.lineTo(G.playX, rect.y + rect.h - 4); ctx.stroke();
  // band labels
  for (const part of PARTS) txt(ctx, PART[part].name.toUpperCase(), rect.x + rect.w - 12, G[part].y + 14, 13, rgba(PART[part].col, 0.7), { weight: 800, align: 'right' });
  ctx.restore();
  // pops
  for (const p of pl.pops) {
    const b = G[p.part], k = p.age / 0.8, y = b.y + b.h / 2 - 22 - k * 26;
    ctx.globalAlpha = Math.max(0, 1 - k * k);
    txt(ctx, p.text, G.playX + 14, y, 26, p.col, { weight: 900, stroke: 6, align: 'left' });
    ctx.globalAlpha = 1;
  }
}
const rowY = (G, part, i) => { const b = G[part], m = Math.min(24, b.h * 0.1); return b.y + b.h - m - (i / 6) * (b.h - 2 * m); };
function rowYFor(G, n) {
  if (n.part === 'acc') return rowY(G, 'acc', n.btn);
  if (n.part === 'caja') return G.caja.y + G.caja.h * (n.kind === 'tum' ? 0.7 : 0.3);
  return G.gua.y + G.gua.h * 0.5;
}
function drawHitFlash(ctx, x, y, r, k, col) {
  ctx.save(); ctx.globalAlpha = k * 0.8; ctx.strokeStyle = col; ctx.lineWidth = 5;
  ctx.beginPath(); ctx.arc(x, y, r * (1 + (1 - k) * 1.1), 0, Math.PI * 2); ctx.stroke(); ctx.restore();
}

// ---- the instrument ---------------------------------------------------------------------------------------------------------------------
function drawInstrument(ctx, st, a, pl, tm) {
  const focus = focusPart(pl, pl.t), fx = pl.fx, t = pl.t;
  const mine = roleOf(pl, focus, t) === 'you';
  if (v3.on) v3.inst = { focus, acc: null, bell: null, caja: null, gua: null };
  ctx.save();
  if (focus === 'acc') {
    const G = accGeom(a);
    const next = nextNote(pl, 'acc', t);
    if (v3.on) { v3.inst.acc = { G, flash: fx.acc || [], want: mine && next && next.t - t < 0.9 ? next.btn : -1, wantPull: next ? next.pull : false }; v3.inst.bell = { pad: G.pad, pull: fx.bell, held: fx.held, auto: st.prefs.bellows === 'auto' }; }
    drawKeyboard(ctx, G, { flash: fx.acc, pull: fx.bell > 0.5, want: mine && next && next.t - t < 0.9 ? next.btn : -1, wantPull: next ? next.pull : false, labels: st.prefs.labels }, tm);
    const mode = st.prefs.bellows;
    if (mode !== 'auto') drawBellowsPad(ctx, G.pad, { pull: fx.bell, held: fx.held, hint: mine && next && next.t - t < 1.1 && next.pull !== (fx.bell > 0.5) ? next.pull : null }, tm);
    else { if (v3.on) v3.panels.push({ r: G.pad, rad: 22, kind: 'ribbon' }); else { ctx.fillStyle = 'rgba(5,24,30,0.7)'; rrect(ctx, G.pad, 22); ctx.fill(); } txt(ctx, 'Bellows: automatic', G.pad.x + G.pad.w / 2, G.pad.y + G.pad.h / 2, 28, PAL.dim, { align: 'center', weight: 700 }); }
    if (mode === 'toggle') txt(ctx, fx.bell > 0.5 ? 'PULL  (tap to switch)' : 'PUSH  (tap to switch)', G.pad.x + G.pad.w / 2, G.pad.y + G.pad.h / 2, 28, '#fff', { align: 'center', weight: 900, stroke: 7 });
    else if (mode === 'hold') txt(ctx, fx.held ? 'PULLING' : 'HOLD TO PULL', G.pad.x + G.pad.w / 2, G.pad.y + G.pad.h / 2, 28, '#fff', { align: 'center', weight: 900, stroke: 7 });
  } else if (focus === 'caja') {
    const CG = cajaGeom(a);
    if (v3.on) v3.inst.caja = { G: CG, tum: fx.tum, tak: fx.tak };
    drawCaja(ctx, CG, { tum: fx.tum, tak: fx.tak }, tm);
  } else {
    const GG = guaGeom(a);
    if (v3.on) v3.inst.gua = { G: GG, fork: fx.guaV?.fork, lean: fx.guaV?.lean, glow: fx.guaV?.glow };
    drawGuacharaca(ctx, GG, fx.guaV, tm);
    if (mine) txt(ctx, 'Scrape across the tube, left and right', a.x + a.w / 2, a.y + a.h - 22, 22, PAL.dim, { align: 'center', weight: 600, maxW: a.w - 30 });
  }
  ctx.restore();
}
function nextNote(pl, part, t) {
  for (const n of pl.tl.notes[part]) if (n.t >= t - 0.12 && !n.j && n.mine) return n;
  return null;
}

// ---- overlays: count-in, banners, hints, captions ------------------------------------------------------------------------------------------
function drawOverlays(ctx, st, L, pl, tm) {
  const P = L.play, rect = P.ribbon, tl = pl.tl;
  // count-in
  if (pl.t < tl.T0 - 0.02 && !pl.over) {
    const k = Math.floor((pl.t - (tl.T0 - tl.bar)) / tl.beat);
    if (k >= 0 && k < 4) {
      const f = ((pl.t - (tl.T0 - tl.bar)) / tl.beat) % 1;
      ctx.save(); ctx.globalAlpha = 1 - f * 0.7;
      txt(ctx, String(k + 1), rect.x + rect.w / 2, rect.y + rect.h / 2, 150 - f * 20, PAL.gold, { font: DISPLAY, weight: 400, align: 'center', stroke: 12 });
      ctx.restore();
    }
  }
  if (pl.banner) {
    const k = pl.banner.t / 1.6, a = k < 0.15 ? k / 0.15 : k > 0.8 ? (1 - k) / 0.2 : 1;
    ctx.save(); ctx.globalAlpha = Math.max(0, a);
    const bw = Math.min(rect.w - 40, 560), br = { x: rect.x + (rect.w - bw) / 2, y: rect.y + rect.h * 0.38, w: bw, h: 74 };
    ctx.fillStyle = pl.banner.col ? rgba(pl.banner.col, 0.95) : 'rgba(255,176,46,0.95)'; rrect(ctx, br, 37); ctx.fill();
    txt(ctx, pl.banner.text, br.x + br.w / 2, br.y + br.h / 2, 34, '#1c0a04', { font: DISPLAY, weight: 400, align: 'center', maxW: br.w - 40 });
    ctx.restore();
  }
  // hint / caption strip between the ribbon and the instrument
  const cap = pl.mode === 'auto' ? pl.caption : pl.hintOn ? pl.hintText : null, C = P.cap;
  if (cap) {
    if (v3.on) v3.panels.push({ r: C, rad: 20, kind: 'part', col: pl.mode === 'auto' ? '#7fe3c2' : '#ffb02e', fill: '#04181d' });
    else { ctx.fillStyle = 'rgba(4,20,26,0.92)'; rrect(ctx, C, 20); ctx.fill(); ctx.strokeStyle = pl.mode === 'auto' ? PAL.mint : PAL.mango; ctx.lineWidth = 3; rrect(ctx, C, 20); ctx.stroke(); }
    ctx.font = `700 25px ${UI}`;
    const words = cap.split(' '); const lines = []; let line = '';
    for (const w of words) { const n = line ? line + ' ' + w : w; if (line && ctx.measureText(n).width > C.w - 36) { lines.push(line); line = w; } else line = n; }
    lines.push(line);
    const lh = Math.min(32, (C.h - 14) / Math.max(1, lines.length)), y0 = C.y + C.h / 2 - ((lines.length - 1) * lh) / 2;
    lines.slice(0, 3).forEach((ln, i) => txt(ctx, ln, C.x + C.w / 2, y0 + i * lh, Math.min(25, lh * 0.8), PAL.text, { align: 'center', weight: 700, maxW: C.w - 24 }));
  } else if (pl.mode === 'take' || pl.mode === 'live') {
    txt(ctx, 'Tap the bulb for a hint', C.x + C.w / 2, C.y + C.h / 2, 22, 'rgba(255,238,210,0.4)', { align: 'center', weight: 600 });
  }
  if (pl.paused) { if (v3.on) { v3.scrim = 0.55; v3.scrimTop = true; } else { ctx.fillStyle = 'rgba(2,10,14,0.55)'; ctx.fillRect(0, 0, L.w, L.h); } }
}
