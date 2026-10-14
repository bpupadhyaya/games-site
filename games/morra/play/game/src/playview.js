// Drawing of the playing screen (duel and Watch and Learn): the table, two hands, call bubbles, scores, controls, pause menu.
import { PAL, UI, DISPLAY, TAU, drawTable, drawGlow, drawHand, extFor, SKINS, drawParticles, bubbleShape, drawRail } from './art.js';
import { txt, wrap, button, panel, rrect, icon, chip, minUnits } from './ui.js';
import { menuRects } from './layout.js';
import { RIVALS, WORDS, COUNT_BEATS, BEAT_SECONDS, THINK_TIMES, legalCall, callRange } from './engine.js';

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const cap = (s) => s[0].toUpperCase() + s.slice(1);
const PAUSE_LABEL = { resume: 'Resume', restart: 'Restart duel', quit: 'Quit to menu', again: 'Watch again', next: 'Next rival', exit: 'Menu', think: 'Think time: change' };
const PATTERN = { lucia: 'dots', marco: 'stripe' };

export const rivalHand = (r) => ({ skin: r.tone, sleeve: r.sleeve, trim: r.trim, accent: r.accent, ring: r.ring, bracelet: r.bracelet, pattern: PATTERN[r.id] ?? null });
export const youHand = (prefs) => ({ skin: prefs.hand ?? 0, sleeve: '#2f5a6a', trim: '#f2eee2', accent: '#c9a24b', ring: false, bracelet: false, pattern: null });

// Hand geometry for a stage rect: palm width s and the two wrist points.
export function handGeom(stage) {
  const s = clamp(Math.min(stage.w * 0.32, (stage.h - 70) / 4.1), 52, 270);
  const cx = stage.x + stage.w / 2;
  return { s, cx, wrR: stage.y + 0.42 * s, wrY: stage.y + stage.h - 0.42 * s, tipR: stage.y + 0.42 * s + 1.6 * s, tipY: stage.y + stage.h - 0.42 * s - 1.6 * s };
}

export function renderPlay(ctx, st, L, view, meta, helpers) {
  const pl = st.pl, P = L.play, S = L.S, w = L.w, h = L.h, t = st.t;
  const rival = RIVALS[pl.rivalIdx], stage = P.stage, G = handGeom(stage), s = G.s;
  meta.previewBadge = { x: stage.x + stage.w - 8, y: stage.y + 6, align: 'right' };
  ctx.fillStyle = '#1c0e08'; ctx.fillRect(0, 0, w + 20, h + 20);
  drawTable(ctx, stage.w, stage.h, stage.x, stage.y);
  drawGlow(ctx, G.cx, (G.tipR + G.tipY) / 2, Math.min(stage.w, stage.h) * 0.7, 0.18);

  const phase = pl.phase, pt = pl.phaseT, count = phase === 'count';
  const shake = pl.shake > 0 ? Math.sin(pl.shake * 60) * pl.shake * s * 0.05 : 0;
  // ---- hands (clipped to the stage so the arms never cover the controls)
  ctx.save(); ctx.beginPath(); ctx.rect(stage.x, stage.y, stage.w, stage.h); ctx.clip();
  ctx.translate(shake, 0);
  const beatU = count ? (pt / BEAT_SECONDS) % 1 : 0;
  const bob = count ? (1 - Math.cos(beatU * TAU)) / 2 : 0;
  const idle = Math.sin(t * 2.2) * 0.012 * s;
  let kShow = phase === 'show' ? clamp(pt / 0.5, 0, 1) : 0;
  const rExt = phase === 'show' ? extFor(pl.ai.throw, kShow) : [0, 0, 0, 0, 0];
  let yThrow = pl.pick.throw, yExt;
  if (phase === 'show') yExt = extFor(pl.res.pThrow, kShow);
  else if (phase === 'pick' && yThrow !== null) yExt = extFor(yThrow, 1);
  else yExt = [0, 0, 0, 0, 0];
  const slam = phase === 'show' ? (1 - kShow) * 0.1 * s : 0;
  const pump = count ? bob * 0.24 * s : 0;
  const rr = rivalHand(rival), yy = youHand(st.prefs);
  // rival: pointing down from the top, rotated half a turn
  drawHand(ctx, G.cx, G.wrR + pump + slam + idle, s, { ...rr, ext: rExt, rot: Math.PI, mirror: false });
  drawHand(ctx, G.cx, G.wrY - pump - slam - idle, s, { ...yy, ext: yExt, rot: 0, mirror: false });
  ctx.restore();
  if (P.railTop) { drawRail(ctx, P.railTop, 'bottom'); drawRail(ctx, P.railBottom, 'top'); }
  if (P.rail) drawRail(ctx, P.rail.r, P.rail.edge);

  // ---- bubbles and the middle banner
  const mid = (G.tipR + G.tipY) / 2;
  if (phase === 'show' && pt > 0.3) {
    const a = clamp((pt - 0.3) / 0.25, 0, 1), res = pl.res;
    const bwid = clamp(s * 1.05, 150, 260), bht = bwid * 0.5;
    ctx.save(); ctx.globalAlpha = a;
    const bubble = (cx, cy, tx, ty, who, call, ok) => {
      bubbleShape(ctx, cx, cy, bwid, bht, tx, ty, 'rgba(255,248,232,0.96)', ok ? '#4f9a4a' : 'rgba(60,30,40,0.7)');
      txt(ctx, String(call), cx - (st.prefs.words ? bwid * 0.2 : 0), cy - bht * 0.02, bht * 0.62, ok ? '#2f6a2a' : '#3a1c28', { align: 'center', font: DISPLAY, weight: 400, maxW: bwid * 0.34 });
      if (st.prefs.words) txt(ctx, cap(WORDS[call]), cx + bwid * 0.2, cy, bht * 0.26, '#3a1c28', { align: 'center', weight: 700, maxW: bwid * 0.4 });
      txt(ctx, who, cx, cy - bht * 0.5 - 14, 18, PAL.text, { align: 'center', weight: 700, stroke: 5, maxW: bwid + 40 });
    };
    const rx = Math.min(G.cx + s * 0.62 + bwid / 2, stage.x + stage.w - bwid / 2 - 6), lx = Math.max(G.cx - s * 0.62 - bwid / 2, stage.x + bwid / 2 + 6);
    bubble(rx, G.wrR + s * 0.95, G.cx + s * 0.32, G.wrR + s * 0.95, rival.name, pl.ai.call, res.oOk);
    bubble(lx, G.wrY - s * 0.95, G.cx - s * 0.32, G.wrY - s * 0.95, 'You', res.pCall, res.pOk);
    ctx.restore();
    // total and verdict
    const big = clamp(s * 0.46, 36, 92);
    const scale = 0.75 + 0.25 * Math.min(1, (pt - 0.3) / 0.2);
    ctx.save(); ctx.globalAlpha = a;
    txt(ctx, `Total ${res.total}`, G.cx, mid - big * 0.34, big * scale, PAL.gold, { align: 'center', font: DISPLAY, weight: 400, stroke: big * 0.16, maxW: stage.w - 40 });
    const verdict = res.who === 'you' ? 'You score a point!' : res.who === 'rival' ? `${rival.name} scores` : res.who === 'both' ? 'Both right: no point' : 'Nobody is right';
    const vc = res.who === 'you' ? '#9bf08a' : res.who === 'rival' ? '#ff9a8a' : PAL.text;
    txt(ctx, verdict, G.cx, mid + big * 0.5, Math.max(26, big * 0.42), vc, { align: 'center', weight: 800, stroke: 6, maxW: stage.w - 40 });
    ctx.restore();
  } else if (count) {
    const beat = Math.min(COUNT_BEATS, Math.floor(pt / BEAT_SECONDS));
    const word = beat >= COUNT_BEATS ? 'Morra!' : cap(WORDS[beat + 1]);
    const u = beat >= COUNT_BEATS ? 0 : beatU;
    const big = clamp(s * 0.62, 44, 120) * (1 + 0.12 * (1 - u));
    ctx.save(); ctx.globalAlpha = beat >= COUNT_BEATS ? 1 : 0.55 + 0.45 * (1 - u);
    txt(ctx, word, G.cx, mid, big, '#fff1c8', { align: 'center', font: DISPLAY, weight: 400, stroke: big * 0.18, maxW: stage.w - 30 });
    ctx.restore();
  } else if (phase === 'pick') {
    // prompt, hint or the coach's thinking
    const pre = pl.pre, box = { x: stage.x + stage.w * 0.06, w: stage.w * 0.88 };
    let line1 = '', line2 = '', th = 0;
    if (pl.mode === 'auto') {
      if (pre && pre.kind === 'think') { line1 = `Thinking... ${Math.max(1, Math.ceil(pre.dur - pre.t))}`; line2 = 'What will the rival throw?'; th = 1 - pre.t / pre.dur; }
      else if (pre) { line1 = `Throw ${pl.pick.throw}, call ${pl.pick.call}`; line2 = pl.coachWhy; }
    } else if (pl.hint && pl.hintT > 0) { line1 = 'Hint'; line2 = pl.hint.why; }
    else { line1 = pl.pick.throw === null ? 'Choose your throw' : pl.pick.call === null ? 'Now choose your call' : 'Ready: press Throw'; }
    const fs = clamp(s * 0.2, 24, 38);
    const bf = Math.max(fs * 0.72, minUnits()), lhh = bf * 1.32;
    ctx.font = `600 ${bf}px ${UI}`;
    const lines = line2 ? wrap(ctx, line2, box.w - 40).slice(0, 4) : [];
    const bh = fs * 1.6 + lines.length * lhh + 24;
    const by = clamp(mid - bh / 2, G.tipR + 6, Math.max(G.tipR + 6, G.tipY - bh - 6));
    const rect = { x: box.x, y: by, w: box.w, h: bh };
    panel(ctx, rect, { fill: 'rgba(22,10,28,0.8)', rad: 22 });
    txt(ctx, line1, rect.x + rect.w / 2, rect.y + 12 + fs * 0.8, fs, PAL.gold, { align: 'center', font: DISPLAY, weight: 400, maxW: rect.w - 40 });
    lines.forEach((ln, i) => txt(ctx, ln, rect.x + rect.w / 2, rect.y + 16 + fs * 1.6 + i * lhh + bf * 0.45, bf, PAL.text, { align: 'center', weight: 600 }));
    if (th > 0) { ctx.fillStyle = 'rgba(255,211,106,0.9)'; rrect(ctx, { x: rect.x + 20, y: rect.y + rect.h - 8, w: (rect.w - 40) * th, h: 4 }, 2); ctx.fill(); }
  }
  ctx.save(); drawParticles(ctx, pl.parts); ctx.restore();

  // ---- the HUD: title, hint, pause, scores
  drawHud(ctx, st, L, pl, rival, P);
  drawControls(ctx, st, L, pl, P);
  if (pl.paused || pl.over) drawPause(ctx, st, L, pl, helpers);
}

function pips(ctx, r, n, target, col) {
  const d = Math.min(18, (r.w - 24) / target - 6), gap = 7, tw = target * d + (target - 1) * gap;
  let x = r.x + r.w - 14 - tw + d / 2;
  for (let i = 0; i < target; i++) {
    const on = i < n;
    ctx.beginPath(); ctx.arc(x, r.y + r.h * 0.7, d / 2, 0, TAU);
    ctx.fillStyle = on ? col : 'rgba(255,244,222,0.14)'; ctx.fill();
    ctx.lineWidth = 2; ctx.strokeStyle = on ? 'rgba(0,0,0,0.35)' : 'rgba(255,244,222,0.3)'; ctx.stroke();
    x += d + gap;
  }
}

function drawHud(ctx, st, L, pl, rival, P) {
  const modeName = pl.mode === 'auto' ? 'Watch and Learn' : 'Duel';
  txt(ctx, `${modeName} · Round ${pl.round} · first to ${pl.target}`, P.title.x, P.title.y + P.title.h / 2, Math.min(30, P.title.h * 0.46), PAL.text, { weight: 700, stroke: 5, maxW: P.title.w });
  if (pl.mode !== 'auto') {
    button(ctx, P.hint, '', { kind: 'quiet', icon: 'hint', size: 26, noShadow: true });
  }
  button(ctx, P.pause, '', { kind: 'quiet', icon: 'pause', size: 26, noShadow: true });
  for (const [r, name, n, col, you] of [[P.scoreRival, rival.name, pl.score.rival, '#ff8a76', false], [P.scoreYou, 'You', pl.score.you, '#ffd36a', true]]) {
    panel(ctx, r, { fill: 'rgba(22,10,28,0.8)', rad: 20, stroke: you ? 'rgba(255,211,106,0.5)' : 'rgba(255,138,118,0.4)' });
    txt(ctx, name, r.x + 14, r.y + r.h * 0.3, Math.min(26, r.h * 0.34), PAL.text, { weight: 700, maxW: r.w - 80 });
    txt(ctx, String(n), r.x + r.w - 16, r.y + r.h * 0.3, Math.min(34, r.h * 0.46), col, { align: 'right', font: DISPLAY, weight: 400 });
    pips(ctx, r, n, pl.target, col);
    // the last throws of this side, newest at the right
    const arr = you ? pl.mem.pt : pl.mem.ot, d = Math.min(18, r.h * 0.26), pipsW = pl.target * (Math.min(18, (r.w - 24) / pl.target - 6) + 7) + 18;
    const fit = clamp(Math.floor((r.w - 28 - pipsW) / (d * 1.5)), 0, 6), last = arr.slice(-fit);
    last.forEach((v, i) => chip(ctx, r.x + 14 + i * d * 1.5, r.y + r.h * 0.72, String(v), d * 0.9, { fill: 'rgba(255,244,222,0.16)', maxW: d * 1.4 }));
    if (!last.length) txt(ctx, 'no throws yet', r.x + 14, r.y + r.h * 0.72, d * 0.95, PAL.dim, { weight: 600, maxW: r.w - 28 - pipsW });
  }
}

function drawControls(ctx, st, L, pl, P) {
  const live = pl.phase === 'pick' && pl.mode === 'play' && !pl.paused && !pl.over;
  const o = pl.pick.throw, c = pl.pick.call, ts = 1;
  const dim = pl.mode === 'auto' || pl.phase !== 'pick';
  txt(ctx, 'Your throw: fingers out', P.throwCap.x + 4, P.throwCap.y + P.throwCap.h / 2, 21, PAL.dim, { weight: 700, maxW: P.throwCap.w });
  P.throws.forEach((r, i) => {
    const sel = o === i, kind = sel ? 'sel' : dim && !sel ? 'disabled' : 'quiet';
    button(ctx, r, '', { kind, noShadow: !live });
    const hs = i === 5 ? Math.min(r.h * 0.6, r.w * 0.36) : Math.min(r.h * 0.64, r.w * 0.5);
    ctx.save(); ctx.beginPath(); ctx.roundRect(r.x, r.y, r.w, r.h, 18); ctx.clip();
    drawHand(ctx, r.x + r.w * (i === 5 ? 0.56 : 0.46), r.y + r.h + hs * 0.02, hs, { ext: extFor(i, 1), skin: st.prefs.hand ?? 0, sleeve: sel ? '#6a3a14' : '#2f5a6a', trim: '#f2eee2', rot: 0, icon: true });
    if (dim && !sel) { ctx.fillStyle = 'rgba(30,16,8,0.35)'; ctx.fillRect(r.x, r.y, r.w, r.h); }
    ctx.restore();
    txt(ctx, String(i), r.x + r.w * 0.82, r.y + r.h * 0.27, Math.min(30, r.h * 0.34), sel ? '#2a1608' : dim ? 'rgba(255,244,222,0.4)' : PAL.text, { align: 'center', font: DISPLAY, weight: 400 });
  });
  txt(ctx, o === null ? 'Your call: the total of all fingers' : `Your call: ${o} to ${o + 5}`, P.callCap.x + 4, P.callCap.y + P.callCap.h / 2, 21, PAL.dim, { weight: 700, maxW: P.callCap.w });
  P.calls.forEach((r, i) => {
    const ok = o !== null && legalCall(o, i), sel = c === i;
    const kind = sel ? 'sel' : ok && !dim ? 'quiet' : 'disabled';
    button(ctx, r, String(i), { kind, size: Math.min(34, r.h * 0.5), noShadow: !live, font: DISPLAY, sub: st.prefs.words && r.h >= 60 ? WORDS[i] : null });
  });
  // the hint's suggestion
  if (pl.hint && pl.hintT > 0 && live) {
    const k = 0.5 + 0.5 * Math.sin(st.t * 7);
    ctx.save(); ctx.lineWidth = 4; ctx.strokeStyle = `rgba(155,240,138,${0.6 + 0.4 * k})`;
    rrect(ctx, P.throws[pl.hint.throw], 18); ctx.stroke();
    if (o === pl.hint.throw || o === null) rrect(ctx, P.calls[pl.hint.call], 14), ctx.stroke();
    ctx.restore();
  }
  // go
  if (pl.mode === 'auto') {
    panel(ctx, P.go, { fill: 'rgba(22,10,28,0.7)', rad: 20 });
    const msg = pl.pre?.kind === 'think' ? 'Watch and Learn: thinking' : pl.phase === 'pick' ? 'Watch and Learn: here is the choice' : pl.phase === 'count' ? 'Uno, due, tre...' : 'Watch and Learn';
    txt(ctx, msg, P.go.x + P.go.w / 2, P.go.y + P.go.h / 2, Math.min(30, P.go.h * 0.4), PAL.text, { align: 'center', weight: 700, maxW: P.go.w - 30 });
  } else if (pl.phase === 'pick') {
    const ready = o !== null && c !== null;
    button(ctx, P.go, ready ? `Throw ${o}, call ${c}` : 'Throw', { kind: ready ? 'primary' : 'disabled', size: Math.min(38, P.go.h * 0.46), icon: 'play' });
  } else if (pl.phase === 'show') {
    button(ctx, P.go, pl.score.you >= pl.target || pl.score.rival >= pl.target ? 'See the result' : 'Next round', { kind: 'quiet', size: Math.min(34, P.go.h * 0.42) });
  } else {
    button(ctx, P.go, 'Uno... due... tre...', { kind: 'disabled', size: Math.min(34, P.go.h * 0.42) });
  }
}

function drawPause(ctx, st, L, pl, helpers) {
  const items = helpers.pauseItems(pl), M = menuRects(L, items.length);
  ctx.fillStyle = 'rgba(8,3,12,0.62)'; ctx.fillRect(0, 0, L.w, L.h);
  panel(ctx, M.panel, { fill: 'rgba(30,14,34,0.96)', rad: 28 });
  const title = pl.over ? 'Watch and Learn is over' : 'Paused';
  txt(ctx, title, M.panel.x + M.panel.w / 2, M.panel.y + 54, 40, PAL.gold, { align: 'center', font: DISPLAY, weight: 400, stroke: 6, maxW: M.panel.w - 50 });
  const sub = pl.over ? `${pl.score.you > pl.score.rival ? 'The coach won' : 'The rival won'} ${pl.score.you} to ${pl.score.rival}` : pl.mode === 'auto' ? `Think time ${THINK_TIMES[st.prefs.thinkIdx]} s` : `${RIVALS[pl.rivalIdx].name}  ${pl.score.rival} : ${pl.score.you}  You`;
  txt(ctx, sub, M.panel.x + M.panel.w / 2, M.panel.y + 96, 24, PAL.dim, { align: 'center', weight: 600, maxW: M.panel.w - 50 });
  items.forEach((it, i) => button(ctx, M.btns[i], PAUSE_LABEL[it], { kind: i === 0 ? 'primary' : 'quiet', size: 30, icon: it === 'resume' ? 'play' : it === 'restart' || it === 'again' ? 'restart' : null }));
}
