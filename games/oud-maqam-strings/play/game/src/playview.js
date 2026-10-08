// Drawing the play screen (Learn / Perform / Watch and Learn) and the free-play screen: the room, the oud, rings, fingers, HUD.
import { PAL, UI, DISPLAY, rgba, drawBackdrop, drawLamps, drawRug, drawOud, drawFinger, drawTarget, drawParticles } from './art.js';
import { txt, wrap, button, panel, rrect, chip } from './ui.js';
import { host, minBtn } from './layout.js';
import { MAQAMAT, IQA, PIECES, FORM, posOfCents, degLabel, nearestDegree, slotDur, LEAD, tendency, JOURNEY } from './music.js';

const TAU = Math.PI * 2;
const GRADE_TEXT = { perfect: 'PERFECT', great: 'GREAT', good: 'GOOD', off: 'OFF', miss: 'MISS' };
const GRADE_COL = { perfect: '#ffe07a', great: '#8ef0dc', good: '#9fc4ff', off: '#d9b3ff', miss: '#ff7d8f' };
export { GRADE_TEXT, GRADE_COL };

export const uOf = (G, c) => posOfCents(Math.min(c, G.span), G.span) * G.Lneck;

// Room + oud + degree labels. Returns the geometry actually used (span set).
function stage(ctx, st, L, G, sess, maqamId, t, lit, pulse) {
  const S = L.S, w = L.w, h = L.h;
  drawBackdrop(ctx, w, h, t, lit, pulse);
  drawLamps(ctx, w, S.y + 4, t, lit, pulse, Math.min(1, w / 760));
  const a = G.area;
  const rug = G.wide ? { x: a.x + 6, y: a.y + 4, w: a.w - 12, h: a.h - 14 } : { x: a.x + 6, y: a.y + 4, w: a.w - 12, h: a.h - 12 };
  drawRug(ctx, rug);
  const vib = sess && sess.fx && sess.fx.vib && !sess.fx.calm ? sess.fx.vib : null;
  drawOud(ctx, G, { t, vib, marks: sess ? sess.marks : true, maqam: maqamId });
  // degree labels beside the neck
  if (sess && sess.marks && sess.labels) {
    const M = MAQAMAT[maqamId], side = -(G.nutW * 0.5 + 34);
    M.deg.forEach((c, i) => {
      if (c > G.span + 1) return;
      const p = G.toScreen(uOf(G, c), side), q = M.q.includes(i);
      txt(ctx, degLabel(maqamId, i), p.x, p.y, 22, q ? PAL.turq : PAL.dim, { align: 'center', weight: 700, stroke: 4 });
    });
  }
}

function pitchBubble(ctx, G, f, maqamId, labels) {
  const p = G.toScreen(uOf(G, f.c), 0), nd = nearestDegree(f.c, maqamId), e = Math.round(f.c - nd.cents);
  drawFinger(ctx, p, Math.max(26, G.nutW * 0.26), 1, false);
  if (!labels) return;
  const off = G.toScreen(uOf(G, f.c), G.nutW * 0.5 + 62);
  const s = `${degLabel(maqamId, nd.idx)}  ${e > 0 ? '+' : ''}${e}`;
  ctx.font = `700 24px ${UI}`; const bw = ctx.measureText(s).width + 26;
  const col = Math.abs(e) <= 22 ? PAL.good : Math.abs(e) <= 45 ? PAL.gold : PAL.bad;
  rrect(ctx, { x: off.x - bw / 2, y: off.y - 20, w: bw, h: 40 }, 20); ctx.fillStyle = 'rgba(8,20,26,0.8)'; ctx.fill();
  txt(ctx, s, off.x, off.y + 1, 24, col, { align: 'center', weight: 700 });
}

// Rings for the notes still to come, slide tracks, and the aftermath of the notes just played.
function targets(ctx, G, pl) {
  const base = Math.max(30, G.nutW * 0.3), t = pl.t;
  const live = [];
  for (let i = pl.np; i < pl.notes.length; i++) { const n = pl.notes[i]; if (n.t - t > LEAD * 1.9) break; if (!n.j || t - n.t < 0.9) live.push(n); }
  for (let i = Math.max(0, pl.np - 6); i < pl.np; i++) { const n = pl.notes[i]; if (n && t - n.t < 0.9 && !live.includes(n)) live.push(n); }
  // contour line over the next few unplayed notes
  const up = live.filter((n) => !n.j).slice(0, 5);
  if (up.length > 1) {
    ctx.save(); ctx.setLineDash([6, 9]); ctx.lineWidth = 2.5; ctx.strokeStyle = 'rgba(255,230,170,0.35)';
    for (let i = 0; i < up.length - 1; i++) {
      const A = G.toScreen(uOf(G, up[i].to ?? up[i].c), 0), B = G.toScreen(uOf(G, up[i + 1].c), 0), M = G.toScreen((uOf(G, up[i].to ?? up[i].c) + uOf(G, up[i + 1].c)) / 2, G.nutW * 0.78);
      ctx.beginPath(); ctx.moveTo(A.x, A.y); ctx.quadraticCurveTo(M.x, M.y, B.x, B.y); ctx.stroke();
    }
    ctx.restore();
  }
  for (const n of live) {
    const dt = n.t - t, p = G.toScreen(uOf(G, n.c), 0);
    if (n.to !== undefined) {                                        // slide track and landing ring
      const q = G.toScreen(uOf(G, n.to), 0), fade = n.j ? Math.max(0, 1 - (t - n.t) / 0.9) : 1;
      ctx.save(); ctx.globalAlpha = 0.85 * fade; ctx.lineCap = 'round'; ctx.lineWidth = base * 0.7; ctx.strokeStyle = 'rgba(53,199,184,0.35)';
      ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.lineTo(q.x, q.y); ctx.stroke(); ctx.lineWidth = 3; ctx.strokeStyle = PAL.turq; ctx.stroke(); ctx.restore();
      const kk = Math.max(0, Math.min(1, 1 - (n.t + n.dur - t) / LEAD));
      if (!n.sl || !n.sl.done) drawTarget(ctx, q, base * 0.85, kk, PAL.turq, fade, n.t + n.dur - t > LEAD);
    }
    if (!n.j) {
      const far = dt > LEAD, k = Math.max(0, Math.min(1, 1 - dt / LEAD)), a = far ? Math.max(0.3, 0.7 - (dt - LEAD) * 0.5) : 1;
      drawTarget(ctx, p, base, k, dt < 0.2 ? '#ffe07a' : PAL.gold, a, far);
    } else {
      const age = t - n.t, col = GRADE_COL[n.j];
      ctx.save(); ctx.globalAlpha = Math.max(0, 1 - age / 0.9);
      ctx.strokeStyle = col; ctx.lineWidth = 4; ctx.beginPath(); ctx.arc(p.x, p.y, base * (1 + age * 1.6), 0, TAU); ctx.stroke();
      if (n.fc !== undefined) {                                      // where the finger really landed
        const f = G.toScreen(uOf(G, n.fc), 0);
        ctx.strokeStyle = col; ctx.lineWidth = 2.5; ctx.setLineDash([4, 5]); ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.lineTo(f.x, f.y); ctx.stroke(); ctx.setLineDash([]);
        ctx.fillStyle = col; ctx.beginPath(); ctx.arc(f.x, f.y, 7, 0, TAU); ctx.fill();
      }
      ctx.restore();
    }
  }
}

function popups(ctx, G, pl) {
  for (const p of pl.fx.pops) {
    const a = 1 - p.age / 1.0, pos = G.toScreen(uOf(G, p.c), G.nutW * 0.5 + 52);
    const dx = G.wide ? 0 : 0, dy = -p.age * 34;
    ctx.save(); ctx.globalAlpha = Math.max(0, a);
    txt(ctx, p.text, pos.x + dx, pos.y + dy - (G.wide ? 24 : 0), p.size, p.col, { align: 'center', weight: 800, stroke: 7, font: DISPLAY });
    if (p.sub) txt(ctx, p.sub, pos.x + dx, pos.y + dy + (G.wide ? 6 : 28) - (G.wide ? 24 : 0) + p.size * 0.2, 22, PAL.text, { align: 'center', weight: 600, stroke: 5 });
    ctx.restore();
  }
}

// The cycle row: eight slots of the rhythm cycle with the current one lit, and a progress line over the whole piece.
function cycleRow(ctx, r, pl, t) {
  const piece = pl.piece, iq = IQA[piece.iqa].slots, sd = slotDur(piece, pl.speed);
  let slot = -1, frac = 0;
  const bar = pl.bars.find((b) => t >= b.t0 && t < b.t1);
  if (bar) slot = Math.floor((t - bar.t0) / sd) % 8;
  const cell = Math.min(r.h * 0.5, (r.w - 120) / 8), x0 = r.x + r.w / 2 - cell * 4;
  for (let i = 0; i < 8; i++) {
    const ch = iq[i], cx = x0 + cell * (i + 0.5), cy = r.y + r.h * 0.4, on = i === slot;
    ctx.fillStyle = ch === 'D' ? PAL.ember : ch === 'T' ? PAL.turq : 'rgba(255,255,255,0.18)';
    ctx.globalAlpha = on ? 1 : 0.55;
    ctx.beginPath(); ctx.arc(cx, cy, (ch === 'D' ? cell * 0.34 : ch === 'T' ? cell * 0.26 : cell * 0.1) * (on ? 1.25 : 1), 0, TAU); ctx.fill();
    ctx.globalAlpha = 1;
    if (on) { ctx.strokeStyle = '#fff3dc'; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(cx, cy, cell * 0.44, 0, TAU); ctx.stroke(); }
  }
  // progress over the form
  const total = pl.formEnd - pl.formStart, pw = Math.min(r.w, 560), px = r.x + r.w / 2 - pw / 2, py = r.y + r.h - 8;
  if (total > 0) {
    ctx.fillStyle = 'rgba(255,240,220,0.14)'; rrect(ctx, { x: px, y: py - 6, w: pw, h: 8 }, 4); ctx.fill();
    frac = Math.max(0, Math.min(1, (t - pl.formStart) / total));
    ctx.fillStyle = PAL.gold; rrect(ctx, { x: px, y: py - 6, w: Math.max(8, pw * frac), h: 8 }, 4); ctx.fill();
  }
}

function lamps(ctx, x, y, n, on) {
  for (let i = 0; i < n; i++) {
    const cx = x + i * 30;
    ctx.fillStyle = i < on ? '#ffd88a' : 'rgba(255,255,255,0.14)';
    ctx.beginPath(); ctx.moveTo(cx - 7, y - 11); ctx.lineTo(cx + 7, y - 11); ctx.lineTo(cx + 11, y); ctx.lineTo(cx + 6, y + 13); ctx.lineTo(cx - 6, y + 13); ctx.lineTo(cx - 11, y); ctx.closePath(); ctx.fill();
  }
}

export const hudHits = [];

export function renderPlay(ctx, st, L, view, pauseItems, menuRects) {
  const pl = st.pl, P = L.play, G = P.inst, t = st.t;
  G.span = pl.span;
  pl.marks = st.prefs.marks; pl.labels = st.prefs.labels; pl.fx.calm = st.prefs.calm;
  const lit = pl.mode === 'auto' ? 0.7 : Math.min(1, pl.ens / 3);
  stage(ctx, st, L, G, pl, pl.piece.maqam, t, lit, pl.fx.pulse);
  const sh = pl.fx.shake > 0 && !st.prefs.calm ? Math.sin(t * 90) * 2 * pl.fx.shake : 0;
  ctx.save(); ctx.translate(sh, 0);
  targets(ctx, G, pl);
  // ghost finger (the computer's hand, or the hint)
  if (pl.ghost && (pl.mode === 'auto' || pl.listening || pl.fx.hint > 0)) {
    const a = pl.mode === 'auto' || pl.listening ? 1 : Math.min(1, pl.fx.hint);
    drawFinger(ctx, G.toScreen(uOf(G, pl.ghost.c), 0), Math.max(26, G.nutW * 0.26), a * (pl.ghost.down ? 1 : 0.7), true);
  }
  // reveal highlight in Watch and Learn
  if (pl.auto && pl.auto.phase !== 'act' && pl.auto.route) {
    const rt = pl.auto.route, show = pl.auto.phase === 'reveal' ? rt.length : Math.min(rt.length, 8);
    rt.slice(0, show).forEach((c, i) => {
      const p = G.toScreen(uOf(G, c), 0), first = i === 0 && pl.auto.phase === 'reveal';
      ctx.save(); ctx.globalAlpha = first ? 1 : 0.55;
      ctx.strokeStyle = first ? '#ffe07a' : PAL.good; ctx.lineWidth = first ? 6 : 3; ctx.beginPath(); ctx.arc(p.x, p.y, Math.max(30, G.nutW * 0.3) * (first ? 1.15 : 0.8), 0, TAU); ctx.stroke();
      txt(ctx, String(i + 1), p.x, p.y, first ? 26 : 20, first ? '#ffe07a' : PAL.good, { align: 'center', weight: 800, stroke: 4 });
      ctx.restore();
    });
  }
  for (const id in pl.fingers) { const f = pl.fingers[id]; if (f.down) pitchBubble(ctx, G, f, pl.piece.maqam, st.prefs.labels); }
  if (pl.fx.pluckAt) { const p = G.toScreen(pl.fx.pluckAt.u, pl.fx.pluckAt.v); if (pl.fx.pluckAt.age < 0.4) { ctx.strokeStyle = rgba('#fff3dc', 0.8 - pl.fx.pluckAt.age * 2); ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(p.x, p.y, 20 + pl.fx.pluckAt.age * 140, 0, TAU); ctx.stroke(); } }
  drawParticles(ctx, pl.fx.parts);
  popups(ctx, G, pl);
  ctx.restore();

  // HUD
  hudHits.length = 0;
  const sc = P.score;
  txt(ctx, String(Math.round(pl.score)).padStart(1, '0'), sc.x + 4, sc.y + (L.wide ? sc.h * 0.36 : sc.h * 0.42), L.wide ? 54 : 50, PAL.gold, { font: DISPLAY, weight: 700, stroke: 6 });
  const sub = pl.combo > 1 ? `Combo ${pl.combo}  ×${(1 + Math.min(4, Math.floor(pl.combo / 10)) * 0.25).toFixed(2)}` : `${pl.piece.title}`;
  txt(ctx, sub, sc.x + 6, sc.y + (L.wide ? sc.h * 0.78 : sc.h * 0.9), 24, pl.combo > 1 ? PAL.good : PAL.dim, { weight: 700, maxW: sc.w - 10 });
  cycleRow(ctx, P.cycle, pl, pl.t);
  button(ctx, P.pause, '', { icon: 'pause', kind: 'quiet' });
  if (pl.mode !== 'auto') button(ctx, P.hint, '', { icon: 'ear', kind: 'quiet' });
  if (pl.mode === 'auto') button(ctx, P.hint, '', { icon: 'restart', kind: 'disabled' });
  if (pl.mode !== 'auto') lamps(ctx, P.cycle.x + 4, P.cycle.y + P.cycle.h * 0.4, 3, pl.ens);
  // phase chip
  let chipText = null, chipCol = null;
  if (pl.mode === 'learn') chipText = pl.learn.final ? 'Final take' : pl.listening ? 'Listen' : pl.counting ? 'Get ready' : `Your turn  (try ${pl.learn.attempt})`;
  else if (pl.mode === 'auto') chipText = pl.auto && pl.auto.phase === 'think' ? 'Think' : pl.auto && pl.auto.phase === 'reveal' ? 'Reveal' : 'Watch';
  else if (pl.counting) chipText = 'Get ready';
  if (chipText) chip(ctx, G.area.x + 16, G.area.y + (L.wide ? 28 : 26), chipText, 26, { align: 'left', fill: 'rgba(8,20,26,0.8)', stroke: pl.listening || pl.mode === 'auto' ? PAL.good : PAL.gold, color: pl.listening || pl.mode === 'auto' ? PAL.good : PAL.gold });
  // caption / think panel
  if (pl.caption && (pl.mode === 'auto' || pl.listening || pl.fx.hint > 0)) captionPanel(ctx, L, G, pl);
  if (pl.auto && pl.auto.phase === 'think') thinkPanel(ctx, L, G, pl);
  if (pl.fx.banner) {
    const b = pl.fx.banner, a = Math.min(1, b.t * 4, (1.6 - b.t) * 3);
    ctx.save(); ctx.globalAlpha = Math.max(0, a);
    txt(ctx, b.text, G.area.x + G.area.w / 2, G.area.y + G.area.h * 0.42, 54 + (1 - Math.min(1, b.t * 3)) * 16, PAL.gold, { align: 'center', font: DISPLAY, weight: 700, stroke: 9, maxW: G.area.w - 40 });
    ctx.restore();
  }
  if (st.toast) toast(ctx, L, st.toast.text);
  if (pl.paused || pl.over) pauseMenu(ctx, st, L, pauseItems(pl), menuRects);
}

function captionPanel(ctx, L, G, pl) {
  const S = L.S, w = Math.min(S.w - 32, 820), fs = 26;
  ctx.font = `600 ${fs}px ${UI}`;
  const lines = wrap(ctx, pl.caption, w - 40), hh = lines.length * fs * 1.3 + 26;
  const x = S.x + (S.w - w) / 2, y = G.area.y + G.area.h - hh - 44;
  const r = { x: L.wide ? Math.min(x, G.area.x + 16) : x, y, w: L.wide ? Math.min(w, G.area.w * 0.42) : w, h: hh };
  if (L.wide) { ctx.font = `600 ${fs}px ${UI}`; const ls = wrap(ctx, pl.caption, r.w - 40); r.h = ls.length * fs * 1.3 + 26; r.y = G.area.y + G.area.h - r.h - 44; panel(ctx, r, { rad: 18 }); ls.forEach((ln, i) => txt(ctx, ln, r.x + 20, r.y + 25 + i * fs * 1.3, fs, PAL.text, { weight: 600 })); return; }
  panel(ctx, r, { rad: 18 });
  lines.forEach((ln, i) => txt(ctx, ln, r.x + 20, r.y + 24 + i * fs * 1.3, fs, PAL.text, { weight: 600 }));
}

function thinkPanel(ctx, L, G, pl) {
  const a = pl.auto, S = L.S, w = Math.min(S.w - 32, 700), h = 150;
  const r = { x: S.x + (S.w - w) / 2, y: G.area.y + G.area.h - h - 44, w, h };
  panel(ctx, r, { rad: 20, fill: 'rgba(8,20,26,0.86)' });
  txt(ctx, a.title, r.x + w / 2, r.y + 32, 30, PAL.gold, { align: 'center', weight: 800, font: DISPLAY, maxW: w - 30 });
  ctx.font = `500 24px ${UI}`;
  const ls = wrap(ctx, a.text, w - 40); ls.slice(0, 3).forEach((ln, i) => txt(ctx, ln, r.x + w / 2, r.y + 72 + i * 30, 24, PAL.text, { align: 'center', weight: 500 }));
  const frac = Math.max(0, Math.min(1, a.pt / a.dur));
  ctx.fillStyle = 'rgba(255,240,220,0.14)'; rrect(ctx, { x: r.x + 20, y: r.y + h - 20, w: w - 40, h: 7 }, 4); ctx.fill();
  ctx.fillStyle = PAL.good; rrect(ctx, { x: r.x + 20, y: r.y + h - 20, w: Math.max(8, (w - 40) * frac), h: 7 }, 4); ctx.fill();
}

export function toast(ctx, L, text) {
  const S = L.S; ctx.font = `700 26px ${UI}`;
  const w = Math.min(S.w - 40, ctx.measureText(text).width + 60), r = { x: S.x + (S.w - w) / 2, y: S.y + S.h - 130, w, h: 56 };
  panel(ctx, r, { rad: 28, fill: 'rgba(8,20,26,0.9)' }); txt(ctx, text, r.x + w / 2, r.y + 29, 26, PAL.text, { align: 'center', weight: 700, maxW: w - 30 });
}

const MENU_TEXT = { resume: 'Resume', restart: 'Restart', quit: 'Back to pieces', listen: 'Listen again', speed: 'Slower', next: 'Next piece', again: 'Play again', exit: 'Back to pieces' };
export function pauseMenu(ctx, st, L, items, menuRects) {
  const pl = st.pl, M = menuRects(L, items.length);
  ctx.fillStyle = 'rgba(2,8,12,0.66)'; ctx.fillRect(0, 0, L.w, L.h);
  panel(ctx, M.panel, { rad: 26, fill: 'rgba(10,26,32,0.96)' });
  txt(ctx, pl.over ? 'Finished' : 'Paused', M.panel.x + M.panel.w / 2, M.panel.y + 54, 46, PAL.gold, { align: 'center', font: DISPLAY, weight: 700 });
  items.forEach((it, i) => button(ctx, M.btns[i], it === 'speed' && st.prefs.autoSlow ? 'Normal speed' : MENU_TEXT[it], { kind: it === 'resume' || it === 'again' ? 'primary' : 'quiet', size: 32 }));
}

// ---- free play ---------------------------------------------------------------------------------------------------------------------------------
export function renderFree(ctx, st, L, view) {
  const f = st.free, F = L.free, G = F.inst, t = st.t, M = MAQAMAT[f.maqam];
  G.span = 1250; f.marks = st.prefs.marks; f.labels = st.prefs.labels; f.fx.calm = st.prefs.calm;
  const lit = Math.min(1, 0.3 + (f.drone ? 0.3 : 0) + (f.stage >= JOURNEY.length ? 0.4 : 0));
  stage(ctx, st, L, G, f, f.maqam, t, lit, f.fx.pulse);
  for (const id in f.fingers) { const fg = f.fingers[id]; if (fg.down) pitchBubble(ctx, G, fg, f.maqam, st.prefs.labels); }
  if (f.ghost) drawFinger(ctx, G.toScreen(uOf(G, f.ghost.c), 0), Math.max(26, G.nutW * 0.26), 0.9, true);
  if (f.fx.pluckAt && f.fx.pluckAt.age < 0.4) { const p = G.toScreen(f.fx.pluckAt.u, f.fx.pluckAt.v); ctx.strokeStyle = rgba('#fff3dc', 0.8 - f.fx.pluckAt.age * 2); ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(p.x, p.y, 20 + f.fx.pluckAt.age * 140, 0, TAU); ctx.stroke(); }
  // journey markers on the neck: the next goal's degrees glow
  if (f.journey && f.stage < JOURNEY.length) for (const d of JOURNEY[f.stage].degs) { const p = G.toScreen(uOf(G, M.deg[d]), 0); drawTarget(ctx, p, Math.max(30, G.nutW * 0.3), 0.9 + 0.1 * Math.sin(t * 5), PAL.good, 0.9); }
  drawParticles(ctx, f.fx.parts);
  // controls
  const on = (b) => (b ? 'on' : 'quiet');
  button(ctx, F.exit, 'Exit', { icon: 'back', kind: 'ghost', size: 26 });
  button(ctx, F.maqam, M.name, { kind: 'quiet', size: 28, sub: 'scale' });
  button(ctx, F.journey, 'Journey', { kind: on(f.journey), size: 26 });
  button(ctx, F.drone, 'Drone', { kind: on(f.drone), size: 26 });
  button(ctx, F.rhythm, IQA[f.iqa].name, { kind: on(f.rhythm), size: 26, sub: `${f.bpm} bpm` });
  button(ctx, F.tdec, '-', { kind: 'quiet', size: 34 }); button(ctx, F.tinc, '+', { kind: 'quiet', size: 34 });
  // info line
  const I = F.info; panel(ctx, I, { rad: 16 });
  const msg = f.journey ? (f.stage >= JOURNEY.length ? 'Taqsim complete. Beautiful. Play on, or choose another scale.' : `Step ${f.stage + 1} of ${JOURNEY.length}: ${JOURNEY[f.stage].goal}`) : `${M.name}: ${M.blurb}`;
  ctx.font = `600 24px ${UI}`;
  const ls = wrap(ctx, msg, I.w - 30);
  ls.slice(0, 2).forEach((ln, i) => txt(ctx, ln, I.x + 16, I.y + (ls.length > 1 ? 20 + i * 28 : I.h / 2), 24, PAL.text, { weight: 600 }));
  if (f.fx.banner) { const b = f.fx.banner, a = Math.min(1, b.t * 4, (1.6 - b.t) * 3); ctx.save(); ctx.globalAlpha = Math.max(0, a); txt(ctx, b.text, G.area.x + G.area.w / 2, G.area.y + G.area.h * 0.4, 52, PAL.gold, { align: 'center', font: DISPLAY, weight: 700, stroke: 9, maxW: G.area.w - 40 }); ctx.restore(); }
  if (st.toast) toast(ctx, L, st.toast.text);
}
void minBtn; void host; void PIECES; void FORM; void tendency; void rgba;
