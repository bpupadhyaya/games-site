// The play screen: the lane scene, the scoreboard, the controls, banners and cards on top.
// Pure drawing and pure layout; game.js owns the state. computeLayout() is called by game.js for hit-testing (no canvas, text
// widths estimated) and by render (real text widths), and gives the same rectangles to both.
// Three shapes (see layout.js): tall / compact portrait (scoreboard on top, controls at the bottom) and wide landscape (scoreboard and
// status on the left, the lane in the middle, every control on the right).
import { W, SW, SH, syncSize, isWide, host, minUnits, tapUnits, backBox, TEXT_SCALES, COMPACT, SCENE_Y0, sceneLayout, trayGeom, toScene } from './layout.js';
import { FONT, NUM, C, roundPath, drawButton, paintButton, panel, wrapLines, textShadow, ease } from './ui.js';
import { sceneInfo, drawRoom, drawLane, drawActors, drawPath, drawTarget, drawParts, proj, scaleAt, pipCam, interpSim, TAU } from './scene.js';
import { PROFILES } from './ai.js';
import { POWERS, pathPoints, PIN_Z0 } from './phys.js';
import { totals, phaseName, throwNo } from './engine.js';

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
export const HOOK_NAMES = ['big hook left', 'medium hook left', 'gentle hook left', 'straight, no hook', 'gentle hook right', 'medium hook right', 'big hook right'];
export const sideName = (S, side) => {
  const c = S.m.cfg;
  if (c.mode === 'two') return side === 0 ? 'Player 1' : 'Player 2';
  if (c.mode === 'watch') return PROFILES[side === 0 ? c.watchA : c.opp].name;
  if (c.mode === 'learn') return 'You';
  return side === 0 ? 'You' : PROFILES[c.opp].name;
};

const estCtx = { font: '', measureText(t) { const m = /(\d+)px/.exec(this.font); return { width: String(t).length * (m ? +m[1] : 20) * 0.54 }; } };
const zOf = (S) => TEXT_SCALES[S.settings.textIdx];

// ---- the status line: what to do now ------------------------------------------------------------------------------------
export function phaseLine(S) {
  const m = S.m;
  if (m.cfg.mode === 'learn') return `Lesson ${m.lesson.idx + 1}: ${m.lesson.title}`;
  const who = sideName(S, m.turn), you = who === 'You';
  const n = throwNo(m);
  return `${phaseName(m.phase)}, throw ${Math.min(n, m.each)} of ${m.each}. ${you ? 'Your turn' : `${who}${who.endsWith('s') ? "'" : "'s"} turn`}`;
}
export function statusText(S) {
  const m = S.m;
  switch (S.ph) {
    case 'aim': return S.hint && !S.hint.busy ? S.hint.text : `${HOOK_NAMES[S.plan.hook + 3]}, ${POWERS[S.plan.power].name} weight`;
    case 'think': return S.think && S.think.text && S.think.phase !== 'think' ? S.think.text : 'Thinking about the line...';
    case 'rolling': return '';
    case 'result': return '';
    case 'replay': return 'Replay in slow motion';
    default: return m && m.over ? 'Match over' : '';
  }
}
export function resultText(r) {
  if (r.pudel) return 'Pudel: the ball left the lane. No pins.';
  if (r.alle) return 'Alle Neune: all nine pins down!';
  if (r.kranz) return 'Kranz: the King stands in a ring of fallen pins.';
  if (r.cleared) return `${r.pins} down: cleared, the pins are set up again.`;
  return `${r.pins} ${r.pins === 1 ? 'pin' : 'pins'} down`;
}

// ---- layout ------------------------------------------------------------------------------------------------------------------
export function hudMetrics(S, ctx) {
  const z = zOf(S), cx = ctx ?? estCtx, bb = backBox();
  if (z <= COMPACT) {
    const cardH = Math.round(20 + 24 * z * 1.1 + 18 * z * 1.2 + 12), fs = Math.round(24 * z), y = Math.max(44, host.t + 6);
    // a floating host back button takes the top-left corner: the two scores start to its right
    const x0 = bb ? bb.x + bb.w + 6 : Math.max(14, host.l + 8), x1 = SW - Math.max(14, host.r + 8), cw = (x1 - x0 - 4) / 2;
    return { compact: true, z, cardH, y, h: y + cardH + 8 + Math.round(fs * 1.35) + 10, fs, x0, cw };
  }
  const fs = Math.round(26 * z), lines = [];
  cx.font = `700 ${fs}px ${FONT}`;
  const m = S.m;
  const pushWrapped = (text, o) => { cx.font = `${o.bold ? 700 : 400} ${fs}px ${FONT}`; wrapLines(cx, text, W - 72).forEach((l) => lines.push({ text: l, ...o })); };
  if (m.cfg.mode === 'learn') { const li = lessonInfo(S); pushWrapped(`Throws left: ${li.left}`, { active: true, bold: true }); pushWrapped(`${li.goalName}: ${li.goalScore}`, { bold: true }); }
  else [0, 1].forEach((sd) => { const t = totals(m, sd); pushWrapped(`${sideName(S, sd)}: ${t.total}`, { active: m.turn === sd, bold: true }); });
  pushWrapped(phaseLine(S), {});
  const y = bb ? bb.y + bb.h + 6 : Math.max(40, host.t + 4);
  return { compact: false, z, fs, lines, y, h: y + lines.length * fs * 1.22 + 20 };
}

// Wraps the status text into at most `maxLines` lines. When it does not fit, the last line ends in "..." and `more` is true:
// the text is then tappable and opens the full-screen "Why?" reader (text never gets cut off without a way to read all of it).
export function fitStatus(cx, text, fs, maxW, maxLines) {
  cx.font = `400 ${fs}px ${FONT}`;
  let lines = wrapLines(cx, text, maxW), more = false;
  if (lines.length > maxLines) { more = true; lines = lines.slice(0, maxLines); lines[maxLines - 1] = lines[maxLines - 1].replace(/[ ,.;:]*$/, '') + '...'; }
  return { lines, more };
}
export const whyTitle = (S) => (S.m.cfg.mode === 'watch' || S.ph === 'think' ? 'Why this line?' : 'The suggested line');

// Sizes of the bottom controls for the larger text sizes (portrait).
function trayMetrics(S, ctx) {
  const z = zOf(S), cx = ctx ?? estCtx;
  const fs = Math.round(24 * z);
  const maxLines = S.m.cfg.mode === 'watch' ? 2 : Math.max(2, Math.floor((SH * 0.24) / (fs * 1.22)));
  const { lines, more } = fitStatus(cx, statusText(S), fs, W - 110, maxLines);
  const mfs = Math.round(fs * 0.8), moreH = more ? mfs * 1.3 : 0;
  const bh = Math.round(26 * z * 1.15 + 38), rows = S.m.cfg.mode === 'watch' ? 2 : 1;
  return { fs, lines, more, mfs, bh, rows, h: 24 + lines.length * fs * 1.22 + moreH + 16 + rows * bh + (rows - 1) * 12 + 28 };
}
// The compact (100 to 150 percent) status box above the controls (portrait).
function compactStatus(S, ctx, z, tg) {
  if (S.ph === 'aim' || !S.m) return null;
  const text = statusText(S);
  if (!text) return null;
  const cx = ctx ?? estCtx, fs = Math.max(Math.round(22 * z), Math.round(minUnits(11)));
  const { lines, more } = fitStatus(cx, text, fs, W - 70, 4);
  const mfs = Math.round(fs * 0.8), h = lines.length * fs * 1.25 + (more ? mfs * 1.3 : 0) + 18;
  const y = (S.m.cfg.mode === 'watch' ? tg.watchTop - 16 : tg.act.y - 106) - h;
  return { fs, lines, more, mfs, h, y, rect: { x: 24, y, w: SW - 48, h } };
}

export function computeLayout(S, ctx) {
  syncSize();
  const z = zOf(S);
  if (isWide()) return computeWide(S, ctx, z);
  const hud = hudMetrics(S, ctx), tight = SH < 1200, tg = trayGeom(tight);
  const watchH = tight ? 60 : SH >= 1480 ? 82 : 72;
  tg.watchH = watchH; tg.watchTop = tg.bottom - 2 * watchH - 12;
  let tray = null, trayH = SH - tg.top;
  if (z > COMPACT) { tray = trayMetrics(S, ctx); trayH = tray.h; }
  const lay = sceneLayout(z, hud.h, trayH, null);
  lay.wide = false; lay.mode = tight ? 'compact' : 'tall'; lay.tight = tight; lay.tg = tg;
  lay.compact = z <= COMPACT;
  lay.trayTop = z <= COMPACT ? tg.top : SH - Math.min(trayH + 36, 600);
  lay.hud = hud; lay.tray = tray; lay.z = z; lay.cx = SW / 2;
  lay.sceneRect = { x: 0, y: hud.h - 20, w: SW, h: lay.trayTop - 4 - (hud.h - 20) };
  lay.status = z <= COMPACT ? compactStatus(S, ctx, z, tg) : null;
  lay.bannerY = lay.vy + 550 * lay.s;
  lay.toastY = hud.h + 18;
  lay.rects = rectsFor(S, lay);
  return lay;
}

const row = (y, h, items, x0 = 16, w = SW - 32, gap = 10) => {
  const total = items.reduce((a, it) => a + it.w, 0), avail = w - gap * (items.length - 1), out = {};
  let x = x0;
  items.forEach((it) => { const ww = (it.w / total) * avail; out[it.id] = { x, y, w: ww, h }; x += ww + gap; });
  return out;
};

// ---- wide (landscape): left column = scoreboard + status, right column = controls --------------------------------------------
function computeWide(S, ctx, z) {
  const cx = ctx ?? estCtx, m = S.m, bb = backBox();
  const U = { x0: host.l, x1: SW - host.r, y0: host.t, y1: SH - host.b };
  // the side columns want at least 250 units: a narrow landscape screen (4:3) shrinks the lane picture a little to make room
  const sc = sceneLayout(z, 0, 0, { cx: (U.x0 + U.x1) / 2, sMax: clamp((U.x1 - U.x0 - 500) / 550, 0.72, 1) });
  const P = clamp((U.x1 - U.x0 - 2 * 275 * sc.s) / 2, 200, 420);
  const top = U.y0 + 10, bot = U.y1 - 10;
  const LP = { x: U.x0 + 8, y: bb ? Math.max(top, bb.y + bb.h + 6) : top, w: P - 16 }; LP.h = bot - LP.y;
  const RP = { x: U.x1 - P + 8, y: top, w: P - 16, h: bot - top };
  const lay = { ...sc, wide: true, mode: 'wide', compact: z <= COMPACT, z, LP, RP, P, U, cx: (U.x0 + U.x1) / 2, tight: false };
  lay.bars = { l: { x: 0, y: 0, w: U.x0 + P, h: SH }, r: { x: U.x1 - P, y: 0, w: SW - (U.x1 - P), h: SH } };
  lay.hud = { h: 0, y: 0, compact: true, z };
  lay.trayTop = SH; lay.tray = null;
  lay.sceneRect = { x: U.x0 + P, y: 0, w: U.x1 - U.x0 - 2 * P, h: SH };
  lay.bannerY = lay.vy + 550 * lay.s;
  lay.toastY = 56;
  // left column
  const cz = Math.min(z, z > COMPACT ? 1 : 1.5), gap = 10;
  const cardH = Math.round(14 + 46 * cz * 0.95 + 8 + 2 * 19 * cz * 1.25 + 12);
  lay.cards = [{ x: LP.x, y: LP.y, w: LP.w, h: cardH }, { x: LP.x, y: LP.y + cardH + gap, w: LP.w, h: cardH }];
  let y = LP.y + 2 * cardH + 2 * gap;
  const minF = Math.round(minUnits(11));
  let pfs = Math.max(Math.round(21 * Math.min(z, 2)), minF), pl;
  for (;;) {   // large text must leave room for the status box: shrink the phase line until it takes at most about a third of the column
    cx.font = `400 ${pfs}px ${FONT}`; pl = wrapLines(cx, phaseLine(S), LP.w - 8);
    if (pl.length * pfs * 1.25 <= LP.h * 0.34 || pfs <= minF) break;
    pfs -= 2;
  }
  lay.phase = { x: LP.x + 4, y, fs: pfs, lines: pl, h: pl.length * pfs * 1.25 };
  y += lay.phase.h + 10;
  // the status or Think hint box takes what is left
  const left = LP.y + LP.h - y;
  const hintOn = S.ph === 'aim' && S.humanTurn && S.hint && !S.hint.busy, busy = S.ph === 'aim' && S.hint && S.hint.busy;
  const text = hintOn ? S.hint.text : (z > COMPACT || S.ph !== 'aim') ? statusText(S) : busy ? 'Testing lines with real rolls...' : '';
  lay.box = null;
  if (text && left > 60) {
    const fs = Math.max(Math.round((hintOn ? 19 : 21) * Math.min(z, hintOn ? 1.5 : 2.2)), Math.round(minUnits(11)));
    const useH = hintOn ? tapUnits(44, 54, 70) + 10 : 0;
    const maxLines = Math.max(1, Math.floor((left - 24 - useH) / (fs * 1.25)) - 1);
    const f = fitStatus(cx, text, fs, LP.w - 24, maxLines);
    const mfs = Math.round(fs * 0.85), h = clamp(f.lines.length * fs * 1.25 + (f.more ? mfs * 1.4 : 0) + 22 + useH, 40, left);
    lay.box = { x: LP.x, y, w: LP.w, h, fs, lines: f.lines, more: f.more, mfs, hint: hintOn, useH };
  }
  lay.rects = wideRects(S, lay);
  return lay;
}

// The right column: a vertical stack of button rows, centred in the column, scaled down only if the column is short.
function wideRects(S, lay) {
  const R = {}, RP = lay.RP, m = S.m, ph = S.ph, mode = m.cfg.mode, z = lay.z;
  const humanAim = ph === 'aim' && S.humanTurn, big = z > COMPACT;
  const rows = [];   // { k: height in tap units, cells: [{ id, w }], hookRow? }
  if (mode === 'watch') rows.push({ k: 1.3, cells: [{ id: 'wpause', w: 1 }] }, { k: 1, cells: [{ id: 'wdec', w: 1 }, { id: 'winc', w: 1 }] }, { k: 0.75, cells: [{ id: 'wlabel', w: 1 }] }, { k: 1, cells: [{ id: 'wexit', w: 1 }] });
  else if (humanAim && !big) {
    rows.push({ k: 1, cells: [0, 1, 2, 3].map((i) => ({ id: `hook${i}`, w: 1 })) }, { k: 1, cells: [4, 5, 6].map((i) => ({ id: `hook${i}`, w: 1 })), center: 4 });
    rows.push({ k: 1, cells: [{ id: 'pow0', w: 1 }, { id: 'pow1', w: 1 }, { id: 'pow2', w: 1 }] });
    rows.push({ k: 1, cells: [{ id: 'think', w: 2 }, { id: 'left', w: 1 }, { id: 'right', w: 1 }] });
    rows.push({ k: 1.5, cells: [{ id: 'roll', w: 1 }] }, { k: 0.9, cells: [{ id: 'menu', w: 1 }] });
  } else if (humanAim) rows.push({ k: 1.1, cells: [{ id: 'setup', w: 1 }] }, { k: 1.5, cells: [{ id: 'roll', w: 1 }] });
  else if (ph === 'result') rows.push({ k: 1, cells: [{ id: 'replay', w: 1 }] }, { k: 1.4, cells: [{ id: 'next', w: 1 }] }, { k: 0.9, cells: [{ id: 'menu', w: 1 }] });
  else if (ph === 'replay') rows.push({ k: 1.2, cells: [{ id: 'skip', w: 1 }] });
  else if (ph === 'rolling') rows.push({ k: 1.3, cells: [{ id: 'skip', w: 1 }] }, { k: 0.9, cells: [{ id: 'menu', w: 1 }] });
  else rows.push({ k: 1, cells: [{ id: 'menu', w: 1 }] });
  const g = 8, hs0 = tapUnits(44, 58, 92) * (big ? 1 + (Math.min(z, 3) - 1) * 0.3 : 1);
  const sumK = rows.reduce((a, r) => a + r.k, 0);
  const hs = Math.min(hs0, (RP.h - g * (rows.length - 1)) / sumK);
  const total = sumK * hs + g * (rows.length - 1);
  let y = RP.y + Math.max(0, (RP.h - total) / 2);
  for (const r of rows) {
    const h = r.k * hs, n = r.cells.length, sumW = r.cells.reduce((a, c) => a + c.w, 0), gx = 5;
    let cw = (RP.w - gx * (n - 1)) / sumW, x = RP.x;
    if (r.center) { const base = (RP.w - gx * (r.center - 1)) / r.center; cw = base; x = RP.x + (RP.w - (n * base + gx * (n - 1))) / 2; }
    for (const c of r.cells) { R[c.id] = { x, y, w: c.w * cw, h }; x += c.w * cw + gx; }
    y += h + g;
  }
  if (humanAim && lay.box && lay.box.hint) { const b = lay.box; R.use = { x: b.x + 12, y: b.y + b.h - b.useH, w: b.w - 24, h: b.useH - 10 }; }
  if (lay.box && lay.box.more) { const b = lay.box; R.more = { x: b.x, y: b.y, w: b.w, h: Math.max(30, b.h - b.useH - 4) }; }
  return R;
}

// All the buttons of the portrait play screen for the current phase, as { id: rect } (scene-independent screen coordinates).
function rectsFor(S, lay) {
  if (lay.wide) return lay.rects;
  const R = {};
  const m = S.m, ph = S.ph, mode = m.cfg.mode, tg = lay.tg;
  const humanAim = ph === 'aim' && S.humanTurn;
  if (mode === 'watch') {
    const h = lay.compact ? tg.watchH : lay.tray.bh, y = lay.compact ? tg.watchTop : SH - Math.max(28, host.b + 8) - 2 * h - 12;
    Object.assign(R, row(y, h, [{ id: 'wdec', w: 1 }, { id: 'wlabel', w: 3 }, { id: 'winc', w: 1 }]));
    Object.assign(R, row(y + h + 12, h, [{ id: 'wpause', w: 2 }, { id: 'wexit', w: 1 }]));
    addMore(R, lay, y);
    return R;
  }
  if (lay.compact) {
    if (humanAim) {
      const hk = tg.hook;
      for (let i = 0; i < 7; i++) R[`hook${i}`] = { x: hk.x + i * (hk.bw + hk.gap), y: hk.y, w: hk.bw, h: hk.h };
      Object.assign(R, row(tg.power.y, tg.power.h, [{ id: 'pow0', w: 1 }, { id: 'pow1', w: 1 }, { id: 'pow2', w: 1 }]));
      Object.assign(R, row(tg.act.y, tg.act.h, [{ id: 'think', w: 132 }, { id: 'left', w: 80 }, { id: 'roll', w: 240 }, { id: 'right', w: 80 }, { id: 'menu', w: 116 }], 16, SW - 32, 10));
    } else if (ph === 'result') Object.assign(R, row(tg.act.y, tg.act.h, [{ id: 'replay', w: 1 }, { id: 'next', w: 1.6 }, { id: 'menu', w: 0.9 }]));
    else if (ph === 'replay') Object.assign(R, row(tg.act.y, tg.act.h, [{ id: 'skip', w: 1 }]));
    else if (ph === 'rolling') Object.assign(R, row(tg.act.y, tg.act.h, [{ id: 'skip', w: 1.6 }, { id: 'menu', w: 0.9 }]));
    else Object.assign(R, row(tg.act.y, tg.act.h, [{ id: 'menu', w: 1 }]));
    if (humanAim && S.hint && !S.hint.busy) R.use = hintGeom(S, lay).use;
    addMore(R, lay, 0);
    return R;
  }
  // large text: the status text, then one or two big buttons
  const t = lay.tray, y = SH - Math.max(28, host.b + 8) - t.bh;
  const ids = humanAim ? [{ id: 'setup', w: 1 }, { id: 'roll', w: 1 }] : ph === 'result' ? [{ id: 'replay', w: 1 }, { id: 'next', w: 1 }] : ph === 'replay' || ph === 'rolling' ? [{ id: 'skip', w: 1 }, { id: 'menu', w: 1 }] : [{ id: 'menu', w: 1 }];
  Object.assign(R, row(y, t.bh, ids));
  addMore(R, lay, y);
  return R;
}
// The tappable status text (only when it had to be shortened). Added last so every button wins a tie.
function addMore(R, lay, btnTop) {
  if (lay.compact) { if (lay.status && lay.status.more) R.more = lay.status.rect; return; }
  const t = lay.tray;
  if (t && t.more) R.more = { x: 0, y: lay.trayTop, w: SW, h: Math.max(40, btnTop - lay.trayTop - 4) };
}

// The Think hint card sits under the scoreboard (so it never covers the ball or the controls), with the button inside it. (portrait)
export function hintGeom(S, lay) {
  const z = Math.min(lay.z, COMPACT), fs = Math.max(Math.round(19 * z), Math.round(minUnits(11)));
  estCtx.font = `400 ${fs}px ${FONT}`;
  const lines = wrapLines(estCtx, S.hint.text, SW - 80);
  const uh = Math.round(tapUnits(44, 54, 78)), y = lay.hud.h + 6, h = 16 + lines.length * fs * 1.25 + 14 + uh + 4;
  return { y, h, fs, lines, use: { x: SW / 2 - 130, y: y + h - uh - 10, w: 260, h: uh } };
}

// ---- drawing -----------------------------------------------------------------------------------------------------------------
function fitFont(ctx, text, size, maxW, weight = 700, family = FONT) {
  let px = size;
  ctx.font = `${weight} ${px}px ${family}`;
  while (ctx.measureText(text).width > maxW && px > 11) { px -= 1; ctx.font = `${weight} ${px}px ${family}`; }
  return px;
}

function drawCardRaw(ctx, x, y, w, h, z, name, score, sub, active) {
  panel(ctx, x, y, w, h, { r: 18, fill: active ? 'rgba(48,32,18,0.9)' : 'rgba(22,15,10,0.82)', stroke: active ? 'rgba(240,200,100,0.95)' : 'rgba(217,174,82,0.35)', lw: active ? 3 : 2, shadow: true });
  ctx.textBaseline = 'alphabetic';
  fitFont(ctx, String(score), 46 * z, w * 0.4, 800, NUM);
  ctx.textAlign = 'right'; ctx.fillStyle = '#ffe7a8'; ctx.fillText(String(score), x + w - 14, y + h * 0.62);
  const sw = ctx.measureText(String(score)).width;
  const np = fitFont(ctx, name, 24 * z, w - sw - 40, 700);
  ctx.textAlign = 'left'; ctx.fillStyle = active ? '#fff3d6' : 'rgba(255,243,214,0.75)'; ctx.fillText(name, x + 14, y + 14 + np * 0.95);
  fitFont(ctx, sub, Math.max(17 * z, minUnits(11)), w - 28, 400);
  ctx.fillStyle = 'rgba(255,233,191,0.72)'; ctx.fillText(sub, x + 14, y + h - 14);
}
// The landscape scoreboard card: the name and the big score on top, the two part scores stacked below.
function drawCardWide(ctx, r, z, name, score, subs, active) {
  panel(ctx, r.x, r.y, r.w, r.h, { r: 16, fill: active ? 'rgba(48,32,18,0.92)' : 'rgba(22,15,10,0.86)', stroke: active ? 'rgba(240,200,100,0.95)' : 'rgba(217,174,82,0.35)', lw: active ? 3 : 2, shadow: false });
  ctx.textBaseline = 'alphabetic';
  fitFont(ctx, String(score), 46 * z, r.w * 0.42, 800, NUM);
  ctx.textAlign = 'right'; ctx.fillStyle = '#ffe7a8'; ctx.fillText(String(score), r.x + r.w - 12, r.y + 14 + 46 * z * 0.85);
  const sw = ctx.measureText(String(score)).width;
  const np = fitFont(ctx, name, Math.max(24 * z, minUnits(11)), r.w - sw - 34, 700);
  ctx.textAlign = 'left'; ctx.fillStyle = active ? '#fff3d6' : 'rgba(255,243,214,0.78)'; ctx.fillText(name, r.x + 12, r.y + 14 + np * 0.95);
  const sfs = Math.max(19 * z, minUnits(11)), at = r.y + 14 + 46 * z * 0.95 + 8;
  ctx.fillStyle = 'rgba(255,233,191,0.8)';
  subs.forEach((t, i) => { fitFont(ctx, t, sfs, r.w - 24, 400); ctx.fillText(t, r.x + 12, at + sfs * (1 + i * 1.25) - 2); });
}
function drawCard(ctx, S, x, y, w, h, side, z) {
  const m = S.m, t = totals(m, side);
  drawCardRaw(ctx, x, y, w, h, z, sideName(S, side), t.total, `Volle ${t.volle} · Abräumen ${t.abr}`, m.turn === side && !m.over);
}
export function lessonInfo(S) {
  const L = S.m.lesson, left = L.tries - L.used;
  const standing = L.standing.filter(Boolean).length;
  return { left, tries: L.tries, goalName: L.carry ? 'Pins left' : 'Goal', goalScore: L.carry ? standing : `${L.goal}+`, goalSub: L.carry ? 'clear them all' : 'pins in one throw' };
}

function drawHookBtn(ctx, r, i, active) {
  const { dy } = paintButton(ctx, r, { active, dark: !active });
  const h = i - 3, cx = r.x + r.w / 2, mag = Math.abs(h) / 3, dir = Math.sign(h);
  const y1 = r.y + dy + r.h - 12, y0 = r.y + dy + 14;
  ctx.save();
  ctx.strokeStyle = '#fff7e6'; ctx.fillStyle = '#fff7e6'; ctx.lineWidth = 4; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  const sx = cx - dir * mag * r.w * 0.2, ex = cx + dir * mag * r.w * 0.2, cxm = cx + dir * mag * r.w * 0.48;
  ctx.beginPath(); ctx.moveTo(sx, y1); ctx.quadraticCurveTo(cxm, (y0 + y1) / 2 + 6, ex, y0 + 6); ctx.stroke();
  // arrow head pointing along the end of the curve
  const tx = ex - cxm, ty = (y0 + 6) - ((y0 + y1) / 2 + 6), tl = Math.hypot(tx, ty) || 1, ux = tx / tl, uy = ty / tl;
  ctx.beginPath(); ctx.moveTo(ex + ux * 8, y0 + 6 + uy * 8); ctx.lineTo(ex - uy * 8 - ux * 4, y0 + 6 + ux * 8 - uy * 4); ctx.lineTo(ex + uy * 8 - ux * 4, y0 + 6 - ux * 8 - uy * 4); ctx.closePath(); ctx.fill();
  ctx.restore();
}

export function drawLaneScene(ctx, S, pipX = 22) {
  const cam = S.cam, t = S.t;
  drawRoom(ctx, cam, t);
  drawLane(ctx, cam, t);
  const ov = S.overlay;
  if (ov) {
    if (ov.last) drawPath(ctx, cam, ov.last, 'rgba(130,190,255,0.8)', t, 0.03, 0.8);
    if (ov.hint) { drawPath(ctx, cam, ov.hint.pts, '#7de8ff', t, 0.04, 0.95); drawTarget(ctx, cam, ov.hint.aimX, PIN_Z0, '#7de8ff', t, ''); }
    if (ov.plan) { drawPath(ctx, cam, ov.plan.pts, ov.plan.col ?? '#ffe08a', t, 0.05, 1); drawTarget(ctx, cam, ov.plan.aimX, PIN_Z0, ov.plan.col ?? '#ffe08a', t, ov.plan.label); }
  }
  const replaying = !!S.final;   // while the replay inset plays, the main view keeps showing the finished throw
  const iv = replaying ? null : interpSim(S.sim, S.alpha);
  drawActors(ctx, cam, replaying ? S.final.pins : iv.pins, replaying ? null : (S.ballShow === S.sim.ball ? iv.ball : S.ballShow), {
    alphaOf: (p) => (S.fade && p.st >= 0 && (p.st > 0 || Math.abs(p.x) > 0.67) ? Math.max(0, 1 - S.fade) : 1),
    dropOf: (p) => (S.drops ? Math.max(0, S.drops[p.id] ?? 0) : 0),
    ballOpts: S.ballOpts,
  });
  drawParts(ctx, cam, S.parts);
  if (replaying) drawReplayInset(ctx, S, pipX);
}

// Replay as a small picture-in-picture: a static close-up of the pin deck, in the wall space above the lane (it never covers the
// lane). The main view does not move.
const PIP = { x: 22, y: 192, w: 196, h: 150 };
function drawReplayInset(ctx, S, pipX) {
  const { y, w, h } = PIP, x = pipX, cam = pipCam();
  ctx.save();
  roundPath(ctx, x, y, w, h, 14); ctx.clip();
  ctx.fillStyle = '#120a06'; ctx.fillRect(x, y, w, h);
  ctx.translate(x + w / 2, y + h / 2); ctx.scale(0.5, 0.5); ctx.translate(-360, -500);
  drawLane(ctx, cam, S.t);
  const iv = interpSim(S.sim, S.alpha);
  drawActors(ctx, cam, iv.pins, iv.ball.on ? iv.ball : null, { pinK: 1 });
  drawParts(ctx, cam, S.pipParts);
  ctx.restore();
  roundPath(ctx, x, y, w, h, 14); ctx.strokeStyle = '#e9c15f'; ctx.lineWidth = 3; ctx.stroke();
  const rfs = Math.max(20, sceneInfo.minU / sceneInfo.s);
  ctx.font = `700 ${rfs}px ${FONT}`; ctx.textAlign = 'left'; ctx.textBaseline = "bottom";
  if (ctx.measureText('Replay').width < w - 20) { ctx.fillStyle = "#ffe9bf"; ctx.fillText("Replay", x + 10, y + h - 6); }
}

function drawBanner(ctx, S, lay) {
  const b = S.banner;
  if (!b) return;
  const k = Math.min(1, b.t / 0.28), e = ease.outBack(k), fade = b.dur - b.t < 0.3 ? Math.max(0, (b.dur - b.t) / 0.3) : 1;
  const z = lay.z, cy = lay.bannerY;
  ctx.save();
  ctx.globalAlpha = fade;
  const pw = Math.min(640, SW - 60), size = Math.round((b.size ?? 76) * Math.min(1.3, 0.85 + z * 0.2));
  ctx.font = `800 ${size}px ${NUM}`;
  const px = fitFont(ctx, b.text, size, pw - 60, 800, NUM);
  const subSize = Math.round(26 * Math.min(z, 2.2));
  ctx.font = `400 ${subSize}px ${FONT}`;
  const subLines = b.sub ? wrapLines(ctx, b.sub, pw - 60) : [];
  const ph = px * 1.3 + subLines.length * subSize * 1.25 + 34;
  ctx.translate(lay.cx, cy); ctx.scale(0.8 + 0.2 * e, 0.8 + 0.2 * e);
  roundPath(ctx, -pw / 2, -ph / 2, pw, ph, 26); ctx.fillStyle = 'rgba(18,11,6,0.9)'; ctx.fill();
  ctx.lineWidth = 3; ctx.strokeStyle = b.kind === 'bad' ? '#d96a5a' : '#e9c15f'; ctx.stroke();
  ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
  ctx.font = `800 ${px}px ${NUM}`; ctx.fillStyle = b.kind === 'bad' ? '#ffb4a0' : '#ffe08a';
  ctx.fillText(b.text, 0, -ph / 2 + 20 + px * 0.9);
  ctx.font = `400 ${subSize}px ${FONT}`; ctx.fillStyle = '#fff3d6';
  subLines.forEach((l, i) => ctx.fillText(l, 0, -ph / 2 + 20 + px * 1.25 + subSize * (1 + i * 1.25)));
  ctx.restore();
}

function drawHud(ctx, S, lay) {
  const hud = lay.hud, m = S.m;
  const g = ctx.createLinearGradient(0, 0, 0, hud.h + 30);
  g.addColorStop(0, 'rgba(8,5,3,0.92)'); g.addColorStop(0.85, 'rgba(8,5,3,0.6)'); g.addColorStop(1, 'rgba(8,5,3,0)');
  ctx.fillStyle = g; ctx.fillRect(0, 0, SW, hud.h + 30);
  ctx.textBaseline = 'alphabetic';
  if (hud.compact) {
    const { x0, cw } = hud;
    if (m.cfg.mode === 'learn') {
      const li = lessonInfo(S);
      drawCardRaw(ctx, x0, hud.y, cw, hud.cardH, hud.z, 'Throws left', li.left, `Lesson ${m.lesson.idx + 1} of 4`, true);
      drawCardRaw(ctx, x0 + cw + 4, hud.y, cw, hud.cardH, hud.z, li.goalName, li.goalScore, li.goalSub, false);
    } else {
      drawCard(ctx, S, x0, hud.y, cw, hud.cardH, 0, hud.z);
      drawCard(ctx, S, x0 + cw + 4, hud.y, cw, hud.cardH, 1, hud.z);
    }
    ctx.textAlign = 'center'; ctx.fillStyle = 'rgba(255,243,214,0.95)';
    fitFont(ctx, phaseLine(S), hud.fs, SW - 40, 400);
    textShadow(ctx, phaseLine(S), SW / 2, hud.y + hud.cardH + 8 + hud.fs, '#fff3d6', 6);
  } else {
    let y = hud.y;
    ctx.textAlign = 'left';
    hud.lines.forEach((l) => {
      ctx.font = `${l.bold ? 700 : 400} ${hud.fs}px ${FONT}`;
      textShadow(ctx, l.text, 36, y + hud.fs, l.active ? '#ffe08a' : '#fff3d6', 6);
      y += hud.fs * 1.22;
    });
  }
}

function drawTrayText(ctx, lay) {
  const t = lay.tray;
  ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
  t.lines.forEach((l, i) => { ctx.font = `400 ${t.fs}px ${FONT}`; textShadow(ctx, l, SW / 2, lay.trayTop + 16 + t.fs * (1 + i * 1.22), '#fff3d6', 6); });
  if (t.more) { ctx.font = `700 ${t.mfs}px ${FONT}`; textShadow(ctx, 'Tap here to read it all', SW / 2, lay.trayTop + 16 + t.fs * (1 + t.lines.length * 1.22) + t.mfs * 0.2, '#7de8ff', 6); }
}
// Every button of the current phase (whichever are in lay.rects), shared by the portrait tray and the landscape right column.
function drawControls(ctx, S, lay) {
  const R = lay.rects, z = lay.z, m = S.m, ph = S.ph;
  const big = z > COMPACT, wide = lay.wide;
  const size = Math.round(26 * Math.min(z, 3)), humanAim = ph === 'aim' && S.humanTurn;
  const btn = (id, label, o = {}) => { if (R[id]) drawButton(ctx, R[id], label, { size, ...o }); };
  if (m.cfg.mode === 'watch') {
    const small = wide || !big;
    btn('wdec', small ? 'Faster' : '−', { dark: true, disabled: S.settings.thinkIdx === 0, size: small ? Math.round(size * 0.85) : size });
    btn('winc', small ? 'Slower' : '+', { dark: true, disabled: S.settings.thinkIdx === 3, size: small ? Math.round(size * 0.85) : size });
    if (R.wlabel) { const r = R.wlabel, txt = small ? `Thinking time ${S.thinkSecs} s` : `Think ${S.thinkSecs} s`; ctx.fillStyle = '#ffe9bf'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; fitFont(ctx, txt, Math.round(24 * z), r.w - 8, 700); ctx.fillText(txt, r.x + r.w / 2, r.y + r.h / 2); }
    btn('wpause', S.paused ? 'Resume' : 'Pause', { primary: true });
    btn('wexit', 'Exit', { dark: true });
    return;
  }
  if (humanAim && !big) {
    for (let i = 0; i < 7; i++) drawHookBtn(ctx, R[`hook${i}`], i, S.plan.hook === i - 3);
    POWERS.forEach((p, i) => btn(`pow${i}`, p.name, { active: S.plan.power === i, dark: S.plan.power !== i, size: Math.round(26 * z) }));
    btn('think', S.hint && S.hint.busy ? 'Think...' : 'Think', { dark: true, size: Math.round(24 * z) });
    btn('left', '◄', { dark: true, size: 30 }); btn('right', '►', { dark: true, size: 30 });
    btn('roll', 'Roll', { primary: true, size: Math.round(34 * Math.min(z, 1.4)) });
    btn('menu', 'Menu', { dark: true, size: Math.round(22 * z) });
    return;
  }
  if (!big) {
    btn('replay', 'Replay', { dark: true }); btn('next', ph === 'result' && m.over ? 'See result' : 'Next', { primary: true });
    btn('skip', ph === 'replay' ? 'Skip replay' : 'Skip', { dark: true }); btn('menu', 'Menu', { dark: true, size: Math.round(22 * z) });
    return;
  }
  btn('setup', 'Set up'); btn('roll', 'Roll', { primary: true });
  btn('replay', 'Replay', { dark: true }); btn('next', 'Next', { primary: true });
  btn('skip', 'Skip', { dark: true }); btn('menu', 'Menu', { dark: true });
}
function drawTray(ctx, S, lay) {
  const big = lay.z > COMPACT;
  const bar = ctx.createLinearGradient(0, lay.trayTop - 24, 0, SH);
  bar.addColorStop(0, 'rgba(8,5,3,0)'); bar.addColorStop(0.2, 'rgba(8,5,3,0.82)'); bar.addColorStop(1, 'rgba(8,5,3,0.96)');
  ctx.fillStyle = bar; ctx.fillRect(0, lay.trayTop - 24, SW, SH - lay.trayTop + 24);
  if (big) drawTrayText(ctx, lay);
  drawControls(ctx, S, lay);
}

// The landscape side columns: scoreboard + status on the left, the buttons on the right.
function drawSideBar(ctx, r, edgeX) {
  const g = ctx.createLinearGradient(r.x, 0, r.x + r.w, 0);
  const left = edgeX > r.x + r.w / 2;   // the lane-side edge is the right edge of the left bar
  g.addColorStop(0, left ? 'rgba(8,5,3,0.94)' : 'rgba(8,5,3,0.78)'); g.addColorStop(1, left ? 'rgba(8,5,3,0.78)' : 'rgba(8,5,3,0.94)');
  ctx.fillStyle = g; ctx.fillRect(r.x, r.y, r.w, r.h);
  ctx.fillStyle = 'rgba(217,174,82,0.35)'; ctx.fillRect(left ? r.x + r.w - 2 : r.x, 0, 2, SH);
}
function drawWideSides(ctx, S, lay) {
  const m = S.m;
  drawSideBar(ctx, lay.bars.l, lay.bars.l.x + lay.bars.l.w); drawSideBar(ctx, lay.bars.r, lay.bars.r.x);
  const cz = Math.min(lay.z, lay.z > COMPACT ? 1 : 1.5), [c0, c1] = lay.cards;
  if (m.cfg.mode === 'learn') {
    const li = lessonInfo(S);
    drawCardWide(ctx, c0, cz, 'Throws left', li.left, [`Lesson ${m.lesson.idx + 1} of 4`], true);
    drawCardWide(ctx, c1, cz, li.goalName, li.goalScore, [li.goalSub], false);
  } else {
    [c0, c1].forEach((c, side) => { const t = totals(m, side); drawCardWide(ctx, c, cz, sideName(S, side), t.total, [`Volle ${t.volle}`, `Abräumen ${t.abr}`], m.turn === side && !m.over); });
  }
  const ph = lay.phase;
  ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic'; ctx.font = `400 ${ph.fs}px ${FONT}`;
  ph.lines.forEach((l, i) => textShadow(ctx, l, ph.x, ph.y + ph.fs * (1 + i * 1.25) - 4, '#fff3d6', 6));
  const b = lay.box;
  if (b) {
    roundPath(ctx, b.x, b.y, b.w, b.h, 14); ctx.fillStyle = b.hint ? 'rgba(14,9,5,0.92)' : 'rgba(18,11,6,0.86)'; ctx.fill();
    ctx.strokeStyle = b.hint ? 'rgba(125,232,255,0.6)' : 'rgba(125,232,255,0.5)'; ctx.lineWidth = 2; ctx.stroke();
    ctx.fillStyle = '#e8fbff'; ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic'; ctx.font = `400 ${b.fs}px ${FONT}`;
    b.lines.forEach((l, i) => ctx.fillText(l, b.x + 12, b.y + 10 + b.fs * (1 + i * 1.25) - 4));
    if (b.more) { ctx.font = `700 ${b.mfs}px ${FONT}`; ctx.fillStyle = '#7de8ff'; ctx.fillText('Tap to read it all', b.x + 12, b.y + 10 + b.fs * (1 + b.lines.length * 1.25) + b.mfs * 0.2); }
    if (b.hint && lay.rects.use) drawButton(ctx, lay.rects.use, 'Use this line', { primary: true, size: 22 });
  }
  drawControls(ctx, S, lay);
}

// Whole play screen.
export function renderPlay(ctx, S) {
  const lay = computeLayout(S, ctx);
  ctx.fillStyle = '#0b0705'; ctx.fillRect(0, 0, SW, SH);
  ctx.save();
  ctx.translate(lay.vx, lay.vy - SCENE_Y0 * lay.s); ctx.scale(lay.s, lay.s);
  sceneInfo.s = lay.s; sceneInfo.minU = minUnits(11);
  drawLaneScene(ctx, S, lay.wide ? 262 : 22);
  ctx.restore();
  // vignette for focus
  const vx = lay.cx, vy = SH * 0.44, vr = Math.max(SW, SH) * 0.64;
  const vg = ctx.createRadialGradient(vx, vy, vr * 0.32, vx, vy, vr); vg.addColorStop(0, 'rgba(0,0,0,0)'); vg.addColorStop(1, 'rgba(0,0,0,0.38)');
  ctx.fillStyle = vg; ctx.fillRect(0, 0, SW, SH);
  if (lay.wide) drawWideSides(ctx, S, lay); else drawHud(ctx, S, lay);
  if (!(S.m.cfg.mode === 'learn' && S.ph === 'intro')) drawBanner(ctx, S, lay);
  if (!lay.wide) { drawTray(ctx, S, lay); drawStatus(ctx, S, lay); }
  else if (S.m.cfg.mode === 'learn' && S.ph === 'intro') drawLessonIntro(ctx, S, lay);
  if (S.toastT > 0 && S.toast) {
    const zt = Math.min(lay.z, 2), fs = Math.max(Math.round(22 * zt), Math.round(minUnits(11)));
    ctx.font = `700 ${fs}px ${FONT}`; const tw = Math.min(SW - 60, ctx.measureText(S.toast).width + 44), th = fs * 2.4;
    roundPath(ctx, lay.cx - tw / 2, lay.toastY, tw, th, 16); ctx.fillStyle = 'rgba(18,11,6,0.92)'; ctx.fill();
    ctx.fillStyle = '#ffe9bf'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(S.toast, lay.cx, lay.toastY + th / 2);
  }
}

// The status line above the controls, and the Think hint card under the scoreboard (portrait).
function drawLessonIntro(ctx, S, lay) {
  const L = S.m.lesson, z = lay.z, fs = Math.round(26 * Math.min(z, 2));
  const cw = Math.min(640, SW - 80), cx0 = SW / 2;
  ctx.font = `400 ${fs}px ${FONT}`;
  const lines = wrapLines(ctx, L.text, cw - 60);
  const tfs = fitFont(ctx, `Lesson ${L.idx + 1}: ${L.title}`, Math.round(40 * Math.min(z, 2)), cw - 50, 800, NUM);
  ctx.font = `400 ${fs}px ${FONT}`;
  const h = Math.min(SH - 40, 120 + tfs + lines.length * fs * 1.3), y = Math.max(20, (SH - h) / 2);
  panel(ctx, cx0 - cw / 2, y, cw, h, { r: 26, fill: 'rgba(18,11,6,0.97)', stroke: '#e9c15f' });
  ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
  ctx.font = `800 ${tfs}px ${NUM}`; ctx.fillStyle = '#ffe08a'; ctx.fillText(`Lesson ${L.idx + 1}: ${L.title}`, cx0, y + 24 + tfs);
  ctx.font = `400 ${fs}px ${FONT}`; ctx.fillStyle = '#fff3d6';
  lines.forEach((l, i) => ctx.fillText(l, cx0, y + 40 + tfs + fs * (1 + i * 1.3)));
  ctx.font = `700 ${Math.round(22 * Math.min(z, 2))}px ${FONT}`; ctx.fillStyle = '#bfe8ff'; ctx.fillText('Tap to start', cx0, y + h - 20);
}
function drawStatus(ctx, S, lay) {
  if (S.m.cfg.mode === 'learn' && S.ph === 'intro') { drawLessonIntro(ctx, S, lay); return; }
  if (!lay.compact) return;
  if (S.ph === 'aim' && S.hint && !S.hint.busy) {
    const g = hintGeom(S, lay);
    roundPath(ctx, 24, g.y, SW - 48, g.h, 18); ctx.fillStyle = 'rgba(14,9,5,0.92)'; ctx.fill();
    ctx.strokeStyle = 'rgba(125,232,255,0.6)'; ctx.lineWidth = 2; ctx.stroke();
    ctx.font = `400 ${g.fs}px ${FONT}`; ctx.fillStyle = '#e8fbff'; ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
    g.lines.forEach((l, i) => ctx.fillText(l, SW / 2, g.y + 16 + g.fs * (1 + i * 1.25) - 4));
    drawButton(ctx, g.use, 'Use this line', { primary: true, size: 24 });
    return;
  }
  if (S.ph === 'aim' && S.hint && S.hint.busy) {
    ctx.font = `700 ${Math.round(Math.max(22, minUnits(11)))}px ${FONT}`; ctx.fillStyle = '#bff3ff'; ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
    ctx.fillText('Testing lines with real rolls...', SW / 2, lay.hud.h + 30); return;
  }
  const st = lay.status;
  if (!st) return;
  const { fs, lines, y, h } = st;
  roundPath(ctx, 24, y, SW - 48, h, 16); ctx.fillStyle = 'rgba(18,11,6,0.86)'; ctx.fill();
  ctx.strokeStyle = 'rgba(125,232,255,0.5)'; ctx.lineWidth = 2; ctx.stroke();
  ctx.fillStyle = '#e8fbff'; ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic'; ctx.font = `400 ${fs}px ${FONT}`;
  lines.forEach((l, i) => ctx.fillText(l, SW / 2, y + 12 + fs * (1 + i * 1.25) - 4));
  if (st.more) { ctx.font = `700 ${st.mfs}px ${FONT}`; ctx.fillStyle = '#7de8ff'; ctx.fillText('Tap here to read it all', SW / 2, y + 12 + fs * (1 + lines.length * 1.25) - 4 + st.mfs * 0.1); }
}
export { toScene, scaleAt, pathPoints, C };
export { computeLayout as layoutFor };
