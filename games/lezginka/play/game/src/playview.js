// The play screen (Learn, Dance, Watch and Learn) and the calibration screen.
import { PAL, UI, DISPLAY, PADCOL, drawBackdrop, drawRug, drawPad, drawRing, drawParticles, drawDancer, drawShadow, drawSpinTrail, poseAt, LOOKS, glyph, rgba, MOVE_DUR } from './art.js';
import { drawPeople } from './figure.js';
import { txt, button, panel, rrect, chip } from './ui.js';
import { SPEEDS, bpmAt, figureAt, PADS, PAD_ID, FLOOR } from './music.js';
import { menuRects } from './layout.js';

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const MIRROR = { L: 'R', R: 'L', A: 'A', S: 'S' };
// Chorus slots: u = across the rug (-1..1), d = depth (0 front .. 1 back), k = size relative to the lead, look = costume.
const SLOTS = [
  { u: -0.58, d: 0.5, k: 0.72, look: 'woman', mir: true, lag: 0.05 }, { u: 0.58, d: 0.5, k: 0.72, look: 'man2', mir: false, lag: 0.03 },
  { u: -0.86, d: 0.22, k: 0.8, look: 'woman2', mir: false, lag: 0.08 }, { u: 0.86, d: 0.22, k: 0.8, look: 'man3', mir: true, lag: 0.02 },
  { u: -0.3, d: 0.95, k: 0.6, look: 'woman', mir: false, lag: 0.1 }, { u: 0.3, d: 0.95, k: 0.6, look: 'man2', mir: true, lag: 0.06 },
];

function barAt(pl, t) {
  for (let i = pl.bars.length - 1; i >= 0; i--) if (t >= pl.bars[i].t0 - 1e-6) return t < pl.bars[i].t1 ? pl.bars[i] : null;
  return null;
}

// The dancers and the rug. `pl` carries moves (the player's), tm (the choreography), ens (how many groups have joined).
export function drawFloor(ctx, pl, F, t, o = {}) {
  const calm = o.calm;
  const bar = barAt(pl, t);
  const bd = bar ? bar.t1 - bar.t0 : 1;
  const beatPh = bar ? ((t - bar.t0) / (bd / 4)) % 1 : (t * 2) % 1;
  const beatPulse = Math.max(0, 1 - beatPh * 2.2);
  drawRug(ctx, F.rug, t, beatPulse, pl.ens / 3);
  const lead = F.dancer;
  const choreo = pl.tm.filter((m) => m.ti > t - 1.0 && m.ti < t + 0.45);
  // chorus, back to front, then the lead (everything is drawn in one batch so the 3D people share one render)
  const nCh = Math.min(SLOTS.length, pl.ens * 2);
  const order = SLOTS.slice(0, nCh).map((s, i) => ({ s, i })).sort((a, b) => b.s.d - a.s.d);
  const people = [];
  for (const { s, i } of order) {
    const x = F.rug.x + s.u * F.rug.rx * 0.95, fy = F.rug.y - F.rug.ry * (0.15 + s.d * 0.62);
    const moves = choreo.map((m) => ({ pad: s.mir ? MIRROR[m.pad] : m.pad, ti: m.ti + s.lag }));
    const P = poseAt(moves, t, beatPh + i * 0.13, { calm });
    people.push({ x, footY: fy, H: lead.h * s.k, k: s.k, look: s.look, P, ph: i, sh: 0.2, sa: 0.28 });
  }
  const mine = pl.mode === 'auto' || (pl.learn && !pl.learn.final && barKind(bar) === 'listen') ? choreo.filter((m) => m.who === 'teach') : pl.moves;
  const P = poseAt(mine, t, beatPh, { calm });
  if (pl.stumble > 0) { P.lean += 0.12 * Math.sin(t * 38) * pl.stumble; P.squash += 0.25 * pl.stumble; P.head += 0.15 * pl.stumble; P.a1L -= 0.3 * pl.stumble; P.a1R -= 0.3 * pl.stumble; }
  people.push({ x: lead.x, footY: lead.footY, H: lead.h, k: 1, look: 'man', P, ph: 0, sh: 0.22, sa: 0.38 });
  drawPeople(ctx, people, t, calm);
  if (P.spin > 0.05 && !calm) drawSpinTrail(ctx, lead.x, lead.footY, lead.h, Math.sin(Math.min(P.spin / (Math.PI * 2), 1) * Math.PI));
  return { beatPh, bar };
}
const barKind = (b) => (b ? b.kind : null);

function drawRings(ctx, pl, F, speedIdx) {
  const appr = SPEEDS[speedIdx].approach, t = pl.t, rings = [];
  for (let d = 0; d < 4; d++) {
    const arr = pl.nd[d];
    for (let k = pl.np[d]; k < arr.length && arr[k].t <= t + appr; k++) if (!arr[k].j) rings.push(arr[k]);
  }
  for (let i = pl.fi; i < pl.ev.length && pl.ev[i].t <= t + appr; i++) { const e = pl.ev[i]; if (e.who === 'teach' && e.on !== false) rings.push(e); }
  rings.sort((a, b) => b.t - a.t);                    // far ones first so the near ones are on top
  for (const e of rings) drawRing(ctx, F.pads[e.pad], e.pad, clamp(1 - (e.t - t) / appr, 0, 1.12), e.who === 'teach');
}

export function renderPlay(ctx, st, L, view, meta, pauseItems) {
  const pl = st.pl, P = L.play, S = L.S, F = P.floor, wide = L.mode === 'wide';
  if (!pl) return;
  const t = pl.t;
  meta.previewBadge = { x: S.x + S.w / 2, y: S.y + S.h - 50, align: 'center' };
  const light = clamp(pl.ens / 3, 0, 1);
  drawBackdrop(ctx, L.w + 20, L.h + 20, st.t, light * 0.8, false);
  ctx.save();
  if (pl.shake > 0 && !st.prefs.calm) ctx.translate(Math.sin(st.t * 70) * pl.shake * 3.2, Math.cos(st.t * 53) * pl.shake * 2.2);
  const info = drawFloor(ctx, pl, F, t, { calm: st.prefs.calm });
  // pads, rings, pops
  PADS.forEach((_, i) => drawPad(ctx, F.pads[i], i, pl.fx[i], true));
  drawRings(ctx, pl, F, st.prefs.speedIdx);
  drawParticles(ctx, pl.parts);
  for (const p of pl.pops) {
    const k = p.age / 0.8, a = 1 - k * k;
    ctx.save(); ctx.globalAlpha = a; txt(ctx, p.text, p.x, p.y - k * 40, p.size * (1.1 - 0.1 * k), p.col, { align: 'center', weight: 900, stroke: 6 }); ctx.restore();
  }
  ctx.restore();
  // ---- HUD
  const pc = pl.piece;
  const bar = info.bar, figName = bar && bar.bar >= 0 ? (figureAt(pc, bar.bar)?.name ?? '') : '';
  const bpm = Math.round(bpmAt(pc, bar && bar.bar >= 0 ? bar.bar : 0, pl.speed));
  const phase = !bar ? '' : bar.kind === 'count' ? 'GET READY' : bar.kind === 'listen' ? 'WATCH THE STEPS' : bar.kind === 'echo' ? 'YOUR TURN' : pl.mode === 'auto' ? 'WATCH AND LEARN' : pl.learn ? 'FINAL TAKE' : 'DANCE';
  // score card
  const sc = P.score;
  if (wide) {
    panel(ctx, P.left, { fill: 'rgba(14,10,36,0.6)' });
    txt(ctx, 'SCORE', sc.x + sc.w / 2, sc.y + 22, 20, PAL.gold, { align: 'center', weight: 800 });
    txt(ctx, String(pl.score), sc.x + sc.w / 2, sc.y + 66, 44, PAL.text, { align: 'center', weight: 800, maxW: sc.w });
    chip(ctx, sc.x + sc.w / 2, sc.y + 112, `COMBO ${pl.combo}   x${Math.min(4, 1 + Math.floor(pl.combo / 10))}`, 20, { align: 'center', fill: pl.combo >= 10 ? 'rgba(255,106,60,0.5)' : undefined });
    const stt = P.stats; let y = stt.y + 12;
    txt(ctx, pc.name, stt.x + stt.w / 2, y + 16, 28, PAL.gold, { align: 'center', font: DISPLAY, weight: 700, maxW: stt.w });
    y += 54; txt(ctx, `${bpm} bpm`, stt.x + stt.w / 2, y, 26, PAL.text, { align: 'center', weight: 700 });
    y += 44; txt(ctx, phase, stt.x + stt.w / 2, y, 18, PAL.dim, { align: 'center', weight: 800, maxW: stt.w });
    y += 44;
    for (const k of ['perfect', 'great', 'good', 'off', 'miss']) { txt(ctx, k.toUpperCase(), stt.x + 6, y, 17, PAL.dim, { weight: 700 }); txt(ctx, String(pl.counts[k]), stt.x + stt.w - 6, y, 22, PAL.text, { align: 'right', weight: 800 }); y += 34; }
  } else {
    txt(ctx, String(pl.score), sc.x + 6, sc.y + 34, 50, PAL.text, { weight: 800, stroke: 7, maxW: sc.w * 0.6 });
    chip(ctx, sc.x + sc.w - 4, sc.y + 30, `COMBO ${pl.combo}  x${Math.min(4, 1 + Math.floor(pl.combo / 10))}`, 20, { align: 'right', fill: pl.combo >= 10 ? 'rgba(255,106,60,0.55)' : undefined });
    txt(ctx, `${pc.name}   ${bpm} bpm`, sc.x + 6, sc.y + sc.h - 6, 22, PAL.dim, { weight: 700, maxW: sc.w });
  }
  // figure banner
  const B = P.banner;
  panel(ctx, B, { fill: 'rgba(14,10,36,0.55)', rad: 22 });
  txt(ctx, phase, B.x + 18, B.y + B.h * 0.3, Math.min(20, B.h * 0.3), PAL.gold, { weight: 800, maxW: B.w * 0.5 });
  txt(ctx, figName || pc.name, B.x + B.w / 2, B.y + B.h * (phase ? 0.66 : 0.5), Math.min(34, B.h * 0.5), PAL.text, { align: 'center', font: DISPLAY, weight: 700, maxW: B.w - 36 });
  if (bar && bar.kind === 'count') {
    const k = Math.floor(clamp(((t - bar.t0) / (bar.t1 - bar.t0)) * 4, 0, 3.999)) + 1;
    ctx.save(); ctx.globalAlpha = 0.9; txt(ctx, String(k), F.cx, F.cy, F.dancer.h * 0.5, 'rgba(255,244,224,0.95)', { align: 'center', weight: 800, stroke: 12 }); ctx.restore();
  }
  // floor meter (the band filling up)
  const M = P.meter;
  if (M) {
    if (wide) {
      txt(ctx, 'THE FLOOR', M.x + M.w / 2, M.y + 14, 18, PAL.gold, { align: 'center', weight: 800 });
      const segH = 34, gap = 8; let yy = M.y + 40;
      for (let i = FLOOR.max; i >= 1; i--) {
        const on = pl.ens >= i;
        ctx.fillStyle = on ? PADCOL[(i + 1) % 4] : 'rgba(255,240,220,0.1)'; rrect(ctx, { x: M.x + 14, y: yy, w: M.w - 28, h: segH }, 12); ctx.fill();
        txt(ctx, ['', 'The tune', 'Hand claps', 'High tune'][i], M.x + M.w / 2, yy + segH / 2, 17, on ? '#1a0f24' : PAL.dim, { align: 'center', weight: 800, maxW: M.w - 40 });
        yy += segH + gap;
      }
    } else {
      const segW = (M.w - 8 * (FLOOR.max - 1)) / FLOOR.max;
      for (let i = 0; i < FLOOR.max; i++) {
        const on = pl.ens > i;
        ctx.fillStyle = on ? PADCOL[(i + 2) % 4] : 'rgba(255,240,220,0.12)'; rrect(ctx, { x: M.x + i * (segW + 8), y: M.y, w: segW, h: M.h }, M.h / 2); ctx.fill();
      }
      if (pl.layerFlash > 0) { ctx.save(); ctx.globalAlpha = pl.layerFlash * 0.6; ctx.strokeStyle = '#fff'; ctx.lineWidth = 3; rrect(ctx, { x: M.x - 3, y: M.y - 3, w: M.w + 6, h: M.h + 6 }, M.h / 2 + 3); ctx.stroke(); ctx.restore(); }
    }
  }
  // buttons
  button(ctx, P.pause, '', { kind: 'quiet', icon: 'pause' });
  const learnListen = pl.mode === 'learn' && !pl.learn.final;
  button(ctx, P.hint, '', { kind: pl.steps ? 'on' : 'quiet', icon: learnListen ? 'ear' : 'bulb' });
  if (wide) {
    txt(ctx, 'Pause', P.pause.x + P.pause.w / 2 + 18, P.pause.y + P.pause.h / 2, 26, PAL.text, { align: 'center', weight: 700 });
    txt(ctx, learnListen ? 'Listen again' : 'Steps', P.hint.x + P.hint.w / 2 + 18, P.hint.y + P.hint.h / 2, 26, PAL.text, { align: 'center', weight: 700, maxW: P.hint.w - 80 });
  }
  // banner event
  if (pl.banner) {
    const a = clamp(Math.min(pl.banner.t / 0.15, (1.6 - pl.banner.t) / 0.3), 0, 1);
    ctx.save(); ctx.globalAlpha = a;
    txt(ctx, pl.banner.text, F.cx, F.cy - F.dy * 0.45, Math.min(46, F.rect.w * 0.075), PAL.gold, { align: 'center', font: DISPLAY, weight: 700, stroke: 9, maxW: F.rect.w - 40 });
    ctx.restore();
  }
  // steps card (hint)
  if (pl.steps && !pl.paused && !pl.over) drawStepsCard(ctx, pl, L, P, bar);
  if (pl.paused || pl.over) drawPauseMenu(ctx, st, L, pauseItems(pl), pl);
}

function drawStepsCard(ctx, pl, L, P, bar) {
  const pc = pl.piece, b = bar && bar.bar >= 0 ? bar.bar : 0, S = L.S;
  const F = P.floor, h = 150;
  // The card sits on the dancer, between the arms pad and the foot pads, so it never covers a pad.
  const w = F.side ? Math.max(260, Math.min(560, 2 * (F.dx - F.pr) - 16)) : Math.min(S.w - 40, 560);
  const x = F.cx - w / 2;
  let y = F.side ? F.cy - F.dy - F.pr + 4 : F.cy - F.dy + F.pr + 10;
  if (!F.side) y = Math.min(y, F.cy + F.dy * 0.22 - F.pr - 8 - h);
  y = Math.max(y, S.y + 4);
  const r = { x, y, w, h };
  panel(ctx, r, { fill: 'rgba(14,10,36,0.88)' });
  txt(ctx, 'THINK AHEAD', x + 18, y + 22, 18, PAL.gold, { weight: 800 });
  const rows = [b, b + 1].filter((bb) => bb < pc.bars);
  rows.forEach((bb, ri) => {
    const fig = figureAt(pc, bb); if (!fig) return;
    const yy = y + 62 + ri * 52;
    txt(ctx, fig.name, x + 18, yy, 22, ri ? PAL.dim : PAL.text, { weight: 700, maxW: w * 0.34 });
    // beat cells with glyphs
    const cx0 = x + w * 0.4, cw = (w * 0.58) / 4;
    const toks = fig.pat.split(' ');
    toks.forEach((tk, bi) => {
      ctx.fillStyle = 'rgba(255,240,220,0.08)'; rrect(ctx, { x: cx0 + bi * cw + 2, y: yy - 20, w: cw - 4, h: 40 }, 8); ctx.fill();
      const n = tk.length;
      for (let i = 0; i < n; i++) {
        const ch = tk[i]; if (ch === '.') continue;
        const id = PAD_ID[ch]; if (id === undefined) continue;
        glyph(ctx, id, cx0 + bi * cw + 2 + (cw - 4) * (i + 0.5) / n, yy, Math.min(15, (cw - 4) / n * 0.5), PADCOL[id], 2.5);
      }
    });
  });
}

function drawPauseMenu(ctx, st, L, items, pl) {
  ctx.fillStyle = 'rgba(6,4,18,0.72)'; ctx.fillRect(0, 0, L.w, L.h);
  const M = menuRects(L, items.length, 130);
  panel(ctx, M.panel, { fill: 'rgba(20,12,44,0.96)' });
  const title = pl.over ? (pl.mode === 'auto' ? 'That was the dance' : 'Done') : 'Paused';
  txt(ctx, title, M.panel.x + M.panel.w / 2, M.panel.y + 54, 44, PAL.gold, { align: 'center', font: DISPLAY, weight: 700, stroke: 6 });
  txt(ctx, pl.piece.name, M.panel.x + M.panel.w / 2, M.panel.y + 100, 24, PAL.dim, { align: 'center', weight: 700, maxW: M.panel.w - 40 });
  const names = {
    resume: 'Resume', restart: 'Restart', quit: 'Leave', listen: 'Listen again', next: 'Next dance', again: pl.mode === 'auto' ? 'Watch again' : 'Dance again', exit: 'Leave',
    speed: st.prefs.autoSlow ? 'Speed: slow (tap for normal)' : 'Speed: normal (tap for slow)',
  };
  items.forEach((it, i) => button(ctx, M.btns[i], names[it], { kind: it === 'resume' || it === 'again' ? 'primary' : 'quiet', size: 30 }));
}

export function renderCalib(ctx, st, L) {
  const c = st.cal, C = L.calib, S = L.S;
  drawBackdrop(ctx, L.w + 20, L.h + 20, st.t, 0.2, false);
  button(ctx, C.back, 'Back', { icon: 'back', kind: 'ghost', size: 28 });
  txt(ctx, 'Calibrate', S.x + S.w / 2, S.y + 12 + C.back.h / 2, 40, PAL.gold, { align: 'center', font: DISPLAY, weight: 700, stroke: 6, maxW: S.w - 2 * (C.back.w + 30) });
  const r = C.pad.r * (1 + 0.06 * c.pulse);
  drawPad(ctx, { x: C.pad.x, y: C.pad.y, r }, 0, { flash: c.flash, glow: c.pulse });
  const msg = c.phase === 'run' ? (c.t < c.T0 ? 'Get ready. Tap the pad exactly on each beat.' : `Tap on every beat (${Math.min(c.taps.length, c.n)}/${c.n - 4} counted after the first four)`) : c.result.ms === null ? 'Not enough taps. Try again.' : `Your device is about ${c.result.ms} ms late`;
  txt(ctx, msg, S.x + S.w / 2, C.pad.y + C.pad.r + 70, 28, PAL.text, { align: 'center', weight: 600, maxW: S.w - 40 });
  if (c.phase === 'done') {
    button(ctx, C.retry, 'Try again', { kind: c.result.ms === null ? 'primary' : 'quiet', size: 30 });
    if (c.result.ms !== null) button(ctx, C.use, 'Use this', { kind: 'primary', size: 32 });
  }
}
export { MOVE_DUR, rgba, UI };
