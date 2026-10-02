// The play screen: the lane scene in a window, the scoreboard above it, the controls below, banners and cards on top.
// Pure drawing and pure layout; game.js owns the state. computeLayout() is called by game.js for hit-testing (no canvas, text
// widths estimated) and by render (real text widths), and gives the same rectangles to both.
import { W, H, TEXT_SCALES, COMPACT, TRAY, SCENE_Y0, SCENE_H, playLayout, toScene } from './layout.js';
import { FONT, NUM, C, roundPath, drawButton, paintButton, panel, wrapLines, textShadow, ease } from './ui.js';
import { drawRoom, drawLane, drawActors, drawPath, drawTarget, drawParts, proj, scaleAt, TAU } from './scene.js';
import { PROFILES } from './ai.js';
import { POWERS, pathPoints, PIN_Z0 } from './phys.js';
import { totals, phaseName, throwNo } from './engine.js';

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
  const z = zOf(S), cx = ctx ?? estCtx;
  if (z <= COMPACT) {
    const cardH = Math.round(20 + 24 * z * 1.1 + 18 * z * 1.2 + 12), fs = Math.round(24 * z);
    return { compact: true, z, cardH, y: 44, h: 44 + cardH + 8 + Math.round(fs * 1.35) + 10, fs };
  }
  const fs = Math.round(26 * z), lines = [];
  cx.font = `700 ${fs}px ${FONT}`;
  const m = S.m;
  const pushWrapped = (text, o) => { cx.font = `${o.bold ? 700 : 400} ${fs}px ${FONT}`; wrapLines(cx, text, W - 72).forEach((l) => lines.push({ text: l, ...o })); };
  if (m.cfg.mode === 'learn') { const li = lessonInfo(S); pushWrapped(`Throws left: ${li.left}`, { active: true, bold: true }); pushWrapped(`${li.goalName}: ${li.goalScore}`, { bold: true }); }
  else [0, 1].forEach((sd) => { const t = totals(m, sd); pushWrapped(`${sideName(S, sd)}: ${t.total}`, { active: m.turn === sd, bold: true }); });
  pushWrapped(phaseLine(S), {});
  return { compact: false, z, fs, lines, y: 40, h: 40 + lines.length * fs * 1.22 + 20 };
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

// Sizes of the bottom controls for the larger text sizes.
function trayMetrics(S, ctx) {
  const z = zOf(S), cx = ctx ?? estCtx;
  const fs = Math.round(24 * z);
  const maxLines = S.m.cfg.mode === 'watch' ? 2 : Math.max(2, Math.floor((H * 0.24) / (fs * 1.22)));
  const { lines, more } = fitStatus(cx, statusText(S), fs, W - 110, maxLines);
  const mfs = Math.round(fs * 0.8), moreH = more ? mfs * 1.3 : 0;
  const bh = Math.round(26 * z * 1.15 + 38), rows = S.m.cfg.mode === 'watch' ? 2 : 1;
  return { fs, lines, more, mfs, bh, rows, h: 24 + lines.length * fs * 1.22 + moreH + 16 + rows * bh + (rows - 1) * 12 + 28 };
}
// The compact (100 to 150 percent) status box above the controls.
function compactStatus(S, ctx, z) {
  if (S.ph === 'aim' || !S.m) return null;
  const text = statusText(S);
  if (!text) return null;
  const cx = ctx ?? estCtx, fs = Math.round(22 * z);
  const { lines, more } = fitStatus(cx, text, fs, W - 70, 4);
  const mfs = Math.round(fs * 0.8), h = lines.length * fs * 1.25 + (more ? mfs * 1.3 : 0) + 18, y = (S.m.cfg.mode === 'watch' ? 1070 : 1000) - h;
  return { fs, lines, more, mfs, h, y, rect: { x: 24, y, w: W - 48, h } };
}

export function computeLayout(S, ctx) {
  const z = zOf(S), hud = hudMetrics(S, ctx);
  let tray = null, trayH = 0;
  if (z > COMPACT) { tray = trayMetrics(S, ctx); trayH = tray.h; }
  const lay = playLayout(z, hud.h, trayH);
  lay.hud = hud; lay.tray = tray; lay.z = z;
  lay.status = z <= COMPACT ? compactStatus(S, ctx, z) : null;
  lay.rects = rectsFor(S, lay);
  return lay;
}

const row = (y, h, items, x0 = 16, w = 688, gap = 10) => {
  const total = items.reduce((a, it) => a + it.w, 0), avail = w - gap * (items.length - 1), out = {};
  let x = x0;
  items.forEach((it) => { const ww = (it.w / total) * avail; out[it.id] = { x, y, w: ww, h }; x += ww + gap; });
  return out;
};

// All the buttons of the play screen for the current phase, as { id: rect } (scene-independent screen coordinates).
function rectsFor(S, lay) {
  const R = {};
  const m = S.m, ph = S.ph, mode = m.cfg.mode;
  const humanAim = ph === 'aim' && S.humanTurn;
  const z = lay.z;
  if (mode === 'watch') {
    const h = lay.compact ? 72 : lay.tray.bh, y = lay.compact ? 1086 : H - 28 - 2 * h - 12;
    Object.assign(R, row(y, h, [{ id: 'wdec', w: 1 }, { id: 'wlabel', w: 3 }, { id: 'winc', w: 1 }]));
    Object.assign(R, row(y + h + 12, h, [{ id: 'wpause', w: 2 }, { id: 'wexit', w: 1 }]));
    addMore(R, lay, y);
    return R;
  }
  if (lay.compact) {
    if (humanAim) {
      const hk = TRAY.hook;
      for (let i = 0; i < 7; i++) R[`hook${i}`] = { x: hk.x + i * (hk.bw + hk.gap), y: hk.y, w: hk.bw, h: hk.h };
      Object.assign(R, row(TRAY.power.y, TRAY.power.h, [{ id: 'pow0', w: 1 }, { id: 'pow1', w: 1 }, { id: 'pow2', w: 1 }]));
      Object.assign(R, row(TRAY.act.y, TRAY.act.h, [{ id: 'think', w: 132 }, { id: 'left', w: 80 }, { id: 'roll', w: 240 }, { id: 'right', w: 80 }, { id: 'menu', w: 116 }], 16, 688, 10));
    } else if (ph === 'result') Object.assign(R, row(TRAY.act.y, TRAY.act.h, [{ id: 'replay', w: 1 }, { id: 'next', w: 1.6 }, { id: 'menu', w: 0.9 }]));
    else if (ph === 'replay') Object.assign(R, row(TRAY.act.y, TRAY.act.h, [{ id: 'skip', w: 1 }]));
    else if (ph === 'rolling') Object.assign(R, row(TRAY.act.y, TRAY.act.h, [{ id: 'skip', w: 1.6 }, { id: 'menu', w: 0.9 }]));
    else Object.assign(R, row(TRAY.act.y, TRAY.act.h, [{ id: 'menu', w: 1 }]));
    if (humanAim && S.hint && !S.hint.busy) R.use = hintGeom(S, lay).use;
    addMore(R, lay, 0);
    return R;
  }
  // large text: the status text, then one or two big buttons
  const t = lay.tray, y = H - 28 - t.bh;
  const ids = humanAim ? [{ id: 'setup', w: 1 }, { id: 'roll', w: 1 }] : ph === 'result' ? [{ id: 'replay', w: 1 }, { id: 'next', w: 1 }] : ph === 'replay' || ph === 'rolling' ? [{ id: 'skip', w: 1 }, { id: 'menu', w: 1 }] : [{ id: 'menu', w: 1 }];
  Object.assign(R, row(y, t.bh, ids));
  addMore(R, lay, y);
  return R;
}
// The tappable status text (only when it had to be shortened). Added last so every button wins a tie.
function addMore(R, lay, btnTop) {
  if (lay.compact) { if (lay.status && lay.status.more) R.more = lay.status.rect; return; }
  const t = lay.tray;
  if (t && t.more) R.more = { x: 0, y: lay.trayTop, w: W, h: Math.max(40, btnTop - lay.trayTop - 4) };
}

// The Think hint card sits under the scoreboard (so it never covers the ball or the controls), with the button inside it.
export function hintGeom(S, lay) {
  const z = Math.min(lay.z, COMPACT), fs = Math.round(19 * z);
  estCtx.font = `400 ${fs}px ${FONT}`;
  const lines = wrapLines(estCtx, S.hint.text, W - 80);
  const y = lay.hud.h + 6, h = 16 + lines.length * fs * 1.25 + 14 + 58;
  return { y, h, fs, lines, use: { x: W / 2 - 130, y: y + h - 64, w: 260, h: 54 } };
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
  fitFont(ctx, sub, 17 * z, w - 28, 400);
  ctx.fillStyle = 'rgba(255,233,191,0.72)'; ctx.fillText(sub, x + 14, y + h - 14);
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

export function drawLaneScene(ctx, S) {
  const cam = S.cam, t = S.t;
  drawRoom(ctx, cam, t);
  drawLane(ctx, cam, t);
  const ov = S.overlay;
  if (ov) {
    if (ov.last) drawPath(ctx, cam, ov.last, 'rgba(130,190,255,0.8)', t, 0.03, 0.8);
    if (ov.hint) { drawPath(ctx, cam, ov.hint.pts, '#7de8ff', t, 0.04, 0.95); drawTarget(ctx, cam, ov.hint.aimX, PIN_Z0, '#7de8ff', t, ''); }
    if (ov.plan) { drawPath(ctx, cam, ov.plan.pts, ov.plan.col ?? '#ffe08a', t, 0.05, 1); drawTarget(ctx, cam, ov.plan.aimX, PIN_Z0, ov.plan.col ?? '#ffe08a', t, ov.plan.label); }
  }
  drawActors(ctx, cam, S.sim.pins, S.ballShow, {
    alphaOf: (p) => (S.fade && p.st >= 0 && (p.st > 0 || Math.abs(p.x) > 0.67) ? Math.max(0, 1 - S.fade) : 1),
    dropOf: (p) => (S.drops ? Math.max(0, S.drops[p.id] ?? 0) : 0),
    ballOpts: S.ballOpts,
  });
  drawParts(ctx, cam, S.parts);
}

function drawBanner(ctx, S, lay) {
  const b = S.banner;
  if (!b) return;
  const k = Math.min(1, b.t / 0.28), e = ease.outBack(k), fade = b.dur - b.t < 0.3 ? Math.max(0, (b.dur - b.t) / 0.3) : 1;
  const z = lay.z, cy = lay.compact ? 730 : lay.vy + 500 * lay.s;
  ctx.save();
  ctx.globalAlpha = fade;
  const pw = 640, size = Math.round((b.size ?? 76) * Math.min(1.3, 0.85 + z * 0.2));
  ctx.font = `800 ${size}px ${NUM}`;
  const px = fitFont(ctx, b.text, size, pw - 60, 800, NUM);
  const subSize = Math.round(26 * Math.min(z, 2.2));
  ctx.font = `400 ${subSize}px ${FONT}`;
  const subLines = b.sub ? wrapLines(ctx, b.sub, pw - 60) : [];
  const ph = px * 1.3 + subLines.length * subSize * 1.25 + 34;
  ctx.translate(360, cy); ctx.scale(0.8 + 0.2 * e, 0.8 + 0.2 * e);
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
  ctx.fillStyle = g; ctx.fillRect(0, 0, W, hud.h + 30);
  ctx.textBaseline = 'alphabetic';
  if (hud.compact) {
    if (m.cfg.mode === 'learn') {
      const li = lessonInfo(S);
      drawCardRaw(ctx, 14, hud.y, 344, hud.cardH, hud.z, 'Throws left', li.left, `Lesson ${m.lesson.idx + 1} of 4`, true);
      drawCardRaw(ctx, 362, hud.y, 344, hud.cardH, hud.z, li.goalName, li.goalScore, li.goalSub, false);
    } else {
      drawCard(ctx, S, 14, hud.y, 344, hud.cardH, 0, hud.z);
      drawCard(ctx, S, 362, hud.y, 344, hud.cardH, 1, hud.z);
    }
    ctx.textAlign = 'center'; ctx.fillStyle = 'rgba(255,243,214,0.95)';
    fitFont(ctx, phaseLine(S), hud.fs, W - 40, 400);
    textShadow(ctx, phaseLine(S), W / 2, hud.y + hud.cardH + 8 + hud.fs, '#fff3d6', 6);
  } else {
    let y = hud.y;
    ctx.textAlign = 'left';
    hud.lines.forEach((l, i) => {
      ctx.font = `${l.bold ? 700 : 400} ${hud.fs}px ${FONT}`;
      textShadow(ctx, l.text, 36, y + hud.fs, l.active ? '#ffe08a' : '#fff3d6', 6);
      y += hud.fs * 1.22;
    });
  }
  void m;
}

function drawTrayText(ctx, lay) {
  const t = lay.tray;
  ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
  t.lines.forEach((l, i) => { ctx.font = `400 ${t.fs}px ${FONT}`; textShadow(ctx, l, W / 2, lay.trayTop + 16 + t.fs * (1 + i * 1.22), '#fff3d6', 6); });
  if (t.more) { ctx.font = `700 ${t.mfs}px ${FONT}`; textShadow(ctx, 'Tap here to read it all', W / 2, lay.trayTop + 16 + t.fs * (1 + t.lines.length * 1.22) + t.mfs * 0.2, '#7de8ff', 6); }
}
function drawTray(ctx, S, lay) {
  const R = lay.rects, z = lay.z, m = S.m, ph = S.ph;
  const bar = ctx.createLinearGradient(0, lay.trayTop - 24, 0, H);
  bar.addColorStop(0, 'rgba(8,5,3,0)'); bar.addColorStop(0.2, 'rgba(8,5,3,0.82)'); bar.addColorStop(1, 'rgba(8,5,3,0.96)');
  ctx.fillStyle = bar; ctx.fillRect(0, lay.trayTop - 24, W, H - lay.trayTop + 24);
  const size = Math.round(26 * Math.min(z, 3)), humanAim = ph === 'aim' && S.humanTurn;
  const btn = (id, label, o = {}) => { if (R[id]) drawButton(ctx, R[id], label, { size, ...o }); };
  if (m.cfg.mode === 'watch') {
    if (!lay.compact) { const t = lay.tray; ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic'; drawTrayText(ctx, lay); }
    const big = !lay.compact;
    btn('wdec', big ? '−' : 'Faster', { dark: true, disabled: S.settings.thinkIdx === 0, size: big ? size : Math.round(size * 0.85) });
    btn('winc', big ? '+' : 'Slower', { dark: true, disabled: S.settings.thinkIdx === 3, size: big ? size : Math.round(size * 0.85) });
    if (R.wlabel) { const r = R.wlabel, txt = big ? `Think ${S.thinkSecs} s` : `Thinking time ${S.thinkSecs} s`; ctx.fillStyle = '#ffe9bf'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; fitFont(ctx, txt, Math.round(24 * z), r.w - 8, 700); ctx.fillText(txt, r.x + r.w / 2, r.y + r.h / 2); }
    btn('wpause', S.paused ? 'Resume' : 'Pause', { primary: true });
    btn('wexit', 'Exit', { dark: true });
    return;
  }
  if (lay.compact && humanAim) {
    for (let i = 0; i < 7; i++) drawHookBtn(ctx, R[`hook${i}`], i, S.plan.hook === i - 3);
    POWERS.forEach((p, i) => btn(`pow${i}`, p.name, { active: S.plan.power === i, dark: S.plan.power !== i, size: Math.round(26 * z) }));
    btn('think', S.hint && S.hint.busy ? 'Think...' : 'Think', { dark: true, size: Math.round(24 * z) });
    btn('left', '◄', { dark: true, size: 30 }); btn('right', '►', { dark: true, size: 30 });
    btn('roll', 'Roll', { primary: true, size: Math.round(34 * Math.min(z, 1.4)) });
    btn('menu', 'Menu', { dark: true, size: Math.round(22 * z) });
    
    return;
  }
  if (lay.compact) {
    btn('replay', 'Replay', { dark: true }); btn('next', ph === 'result' && m.over ? 'See result' : 'Next', { primary: true });
    btn('skip', ph === 'replay' ? 'Skip replay' : 'Skip', { dark: true }); btn('menu', 'Menu', { dark: true, size: Math.round(22 * z) });
    if (ph === 'think' || ph === 'intro' || ph === 'sweep') { /* only Menu */ }
    return;
  }
  // large text
  drawTrayText(ctx, lay);
  btn('setup', 'Set up'); btn('roll', 'Roll', { primary: true });
  btn('replay', 'Replay', { dark: true }); btn('next', 'Next', { primary: true });
  btn('skip', 'Skip', { dark: true }); btn('menu', 'Menu', { dark: true });
  if (humanAim) { /* setup and roll are shown above */ }
}

// Whole play screen.
export function renderPlay(ctx, S) {
  const lay = computeLayout(S, ctx);
  ctx.fillStyle = '#0b0705'; ctx.fillRect(0, 0, W, H);
  ctx.save();
  if (lay.clip) { ctx.beginPath(); ctx.rect(lay.clip.x, lay.clip.y, lay.clip.w, lay.clip.h); ctx.clip(); }
  ctx.translate(lay.vx, lay.vy - SCENE_Y0 * lay.s); ctx.scale(lay.s, lay.s);
  drawLaneScene(ctx, S);
  ctx.restore();
  // vignette for focus
  const vg = ctx.createRadialGradient(360, 560, 260, 360, 560, 820); vg.addColorStop(0, 'rgba(0,0,0,0)'); vg.addColorStop(1, 'rgba(0,0,0,0.38)');
  ctx.fillStyle = vg; ctx.fillRect(0, 0, W, H);
  drawHud(ctx, S, lay);
  if (!(S.m.cfg.mode === 'learn' && S.ph === 'intro')) drawBanner(ctx, S, lay);
  drawTray(ctx, S, lay);
  drawStatus(ctx, S, lay);
  if (S.toastT > 0 && S.toast) {
    ctx.font = `700 ${Math.round(22 * Math.min(lay.z, 2))}px ${FONT}`; const tw = Math.min(660, ctx.measureText(S.toast).width + 44);
    roundPath(ctx, 360 - tw / 2, lay.hud.h + 18, tw, 54 * Math.min(lay.z, 2), 16); ctx.fillStyle = 'rgba(18,11,6,0.92)'; ctx.fill();
    ctx.fillStyle = '#ffe9bf'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(S.toast, 360, lay.hud.h + 18 + 27 * Math.min(lay.z, 2));
  }
}

// The status line above the controls, and the Think hint card under the scoreboard.
function drawLessonIntro(ctx, S, lay) {
  const L = S.m.lesson, z = lay.z, fs = Math.round(26 * Math.min(z, 2));
  ctx.font = `400 ${fs}px ${FONT}`;
  const lines = wrapLines(ctx, L.text, 580);
  const tfs = fitFont(ctx, `Lesson ${L.idx + 1}: ${L.title}`, Math.round(40 * Math.min(z, 2)), 590, 800, NUM);
  ctx.font = `400 ${fs}px ${FONT}`;
  const h = Math.min(H - 120, 120 + tfs + lines.length * fs * 1.3), y = Math.max(40, (H - h) / 2);
  panel(ctx, 40, y, 640, h, { r: 26, fill: 'rgba(18,11,6,0.97)', stroke: '#e9c15f' });
  ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
  ctx.font = `800 ${tfs}px ${NUM}`; ctx.fillStyle = '#ffe08a'; ctx.fillText(`Lesson ${L.idx + 1}: ${L.title}`, 360, y + 24 + tfs);
  ctx.font = `400 ${fs}px ${FONT}`; ctx.fillStyle = '#fff3d6';
  lines.forEach((l, i) => ctx.fillText(l, 360, y + 40 + tfs + fs * (1 + i * 1.3)));
  ctx.font = `700 ${Math.round(22 * Math.min(z, 2))}px ${FONT}`; ctx.fillStyle = '#bfe8ff'; ctx.fillText('Tap to start', 360, y + h - 20);
}
function drawStatus(ctx, S, lay) {
  if (S.m.cfg.mode === 'learn' && S.ph === 'intro') { drawLessonIntro(ctx, S, lay); return; }
  if (!lay.compact) return;
  if (S.ph === 'aim' && S.hint && !S.hint.busy) {
    const g = hintGeom(S, lay);
    roundPath(ctx, 24, g.y, W - 48, g.h, 18); ctx.fillStyle = 'rgba(14,9,5,0.92)'; ctx.fill();
    ctx.strokeStyle = 'rgba(125,232,255,0.6)'; ctx.lineWidth = 2; ctx.stroke();
    ctx.font = `400 ${g.fs}px ${FONT}`; ctx.fillStyle = '#e8fbff'; ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
    g.lines.forEach((l, i) => ctx.fillText(l, W / 2, g.y + 16 + g.fs * (1 + i * 1.25) - 4));
    drawButton(ctx, g.use, 'Use this line', { primary: true, size: 24 });
    return;
  }
  if (S.ph === 'aim' && S.hint && S.hint.busy) {
    ctx.font = `700 22px ${FONT}`; ctx.fillStyle = '#bff3ff'; ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
    ctx.fillText('Testing lines with real rolls...', W / 2, lay.hud.h + 30); return;
  }
  const st = lay.status;
  if (!st) return;
  const { fs, lines, y, h } = st;
  roundPath(ctx, 24, y, W - 48, h, 16); ctx.fillStyle = 'rgba(18,11,6,0.86)'; ctx.fill();
  ctx.strokeStyle = 'rgba(125,232,255,0.5)'; ctx.lineWidth = 2; ctx.stroke();
  ctx.fillStyle = '#e8fbff'; ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic'; ctx.font = `400 ${fs}px ${FONT}`;
  lines.forEach((l, i) => ctx.fillText(l, W / 2, y + 12 + fs * (1 + i * 1.25) - 4));
  if (st.more) { ctx.font = `700 ${st.mfs}px ${FONT}`; ctx.fillStyle = '#7de8ff'; ctx.fillText('Tap here to read it all', W / 2, y + 12 + fs * (1 + lines.length * 1.25) - 4 + st.mfs * 0.1); }
}
export { toScene, scaleAt, pathPoints, SCENE_H, C };
export { computeLayout as layoutFor };
