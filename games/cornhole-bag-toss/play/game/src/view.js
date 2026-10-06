// The play screen: the backyard scene in a window, the scoreboard above it, the fixed mini board, the controls below, banners and cards on top.
// Pure drawing and pure layout; game.js owns the state. computeLayout() is called by game.js for hit-testing (no canvas, text widths
// estimated) and by render (real text widths), and gives the same rectangles to both.
import { W, H, FR, TEXT_SCALES, COMPACT, TRAY, SCENE_Y0, MINI, PLAY_WIN, PULL_ZONE_Y0, playLayout, toScene } from './layout.js';
import { FONT, NUM, roundPath, drawButton, paintButton, panel, wrapLines, textShadow, ease } from './ui.js';
import { drawStill, drawBags, drawArc, drawLanding, drawParts, interpBags, fixedCam, setExtent, TAU, BAG_COL } from './scene.js';
import { PROFILES } from './ai.js';
import { STYLES, arcPoints, BOARD_W, BOARD_L, HOLE_V, HOLE_R, BAG_HALF, BOARD_Z0, COS_A } from './phys.js';
import { pointsOf, bagIndex, turnOf, BAGS_EACH } from './engine.js';

export const SPIN_NAMES = ['strong spin left', 'light spin left', 'no spin', 'light spin right', 'light spin right'];
SPIN_NAMES[4] = 'strong spin right';
export const sideName = (S, side) => {
  const c = S.m.cfg;
  if (c.mode === 'two') return side === 0 ? 'Player 1' : 'Player 2';
  if (c.mode === 'watch') return PROFILES[side === 0 ? c.watchA : c.opp].name;
  if (c.mode === 'learn') return 'You';
  return side === 0 ? 'You' : PROFILES[c.opp].name;
};
export const sideColour = (side) => (side === 0 ? 'Red' : 'Blue');

const estCtx = { font: '', measureText(t) { const m = /(\d+)px/.exec(this.font); return { width: String(t).length * (m ? +m[1] : 20) * 0.54 }; } };
const zOf = (S) => TEXT_SCALES[S.settings.textIdx];
const clampV = (v, a, b) => Math.max(a, Math.min(b, v));
const RR = (x, y, w, h) => ({ x, y, w, h });

// ---- the status line: what to do now ------------------------------------------------------------------------------------
export function phaseLine(S) {
  const m = S.m;
  if (m.cfg.mode === 'learn') return `Lesson ${m.lesson.idx + 1}: ${m.lesson.title}`;
  const who = sideName(S, turnOf(m)), you = who === 'You';
  return `Round ${m.round}, bag ${Math.min(bagIndex(m), 8)} of 8. ${you ? 'Your throw' : `${who}${who.endsWith('s') ? "'" : "'s"} throw`}`;
}
export function statusText(S) {
  const m = S.m;
  switch (S.ph) {
    case 'aim': return S.hint && !S.hint.busy ? S.hint.text : `${STYLES[S.plan.style].name}, ${SPIN_NAMES[S.plan.spin + 2]}. ${S.guide ? S.guide : 'Pull back and let go to throw.'}`;
    case 'think': return S.think && S.think.text && S.think.phase !== 'think' ? S.think.text : 'Thinking about the throw...';
    case 'flight': return '';
    case 'result': return '';
    default: return m && m.over ? 'Game over' : '';
  }
}
export function resultText(res) {
  if (res === 'hole') return 'In the hole! 3 points';
  if (res === 'board') return 'On the board: 1 point';
  return 'Off the board: no points';
}

// ---- layout ------------------------------------------------------------------------------------------------------------------
export function hudMetrics(S, ctx) {
  const z = zOf(S), cx = ctx ?? estCtx;
  // the host's floating back button sits at the top left: the scoreboard starts to the right of it
  const t0 = Math.max(0, FR.ins.t - 24), bx = FR.ins.back ? Math.max(14, FR.ins.l + FR.ins.back + 14 - FR.fox) : 14;
  if (z <= COMPACT) {
    const cardH = Math.round(20 + 24 * z * 1.1 + 18 * z * 1.2 + 12), fs = Math.round(24 * z);
    return { compact: true, z, cardH, y: 44 + t0, bx, h: 44 + t0 + cardH + 8 + Math.round(fs * 1.35) + 10, fs };
  }
  // Large text: two score rows (name and score) and one short line for the round. Everything else (the guide, the hint) lives in the Set up sheet,
  // so the scene keeps its full size instead of shrinking into a small window.
  const fs = Math.round(26 * z), m = S.m, rows = [];
  if (m.cfg.mode === 'learn') { const li = lessonInfo(S); rows.push({ name: 'Bags left', score: String(li.left), active: true }, { name: li.goalName, score: String(li.goalScore), active: false }); }
  else [0, 1].forEach((sd) => rows.push({ name: sideName(S, sd), score: String(m.score[sd]), active: turnOf(m) === sd && !m.over, side: sd }));
  const sub = m.cfg.mode === 'learn' ? `Lesson ${m.lesson.idx + 1} of ${S.lessonCount}` : `Round ${m.round}, bag ${Math.min(bagIndex(m), 8)} of 8`;
  const sfs = Math.round(fs * 0.64);
  return { compact: false, z, fs, sfs, rows, sub, y: 40 + t0, bx: Math.max(36, bx), h: 40 + t0 + rows.length * fs * 1.2 + sfs * 1.3 + 12 };
}
export function fitStatus(cx, text, fs, maxW, maxLines) {
  cx.font = `400 ${fs}px ${FONT}`;
  let lines = wrapLines(cx, text, maxW), more = false;
  if (lines.length > maxLines) { more = true; lines = lines.slice(0, maxLines); lines[maxLines - 1] = lines[maxLines - 1].replace(/[ ,.;:]*$/, '') + '...'; }
  return { lines, more };
}
export const whyTitle = (S) => (S.m.cfg.mode === 'watch' || S.ph === 'think' ? 'Why this throw?' : 'The suggested throw');

function trayMetrics(S, ctx) {
  const z = zOf(S), cx = ctx ?? estCtx;
  const fs = Math.round(24 * z);
  const { lines, more } = { lines: [], more: false };
  const mfs = Math.round(fs * 0.8), moreH = more ? mfs * 1.3 : 0;
  const bh = Math.round(26 * z * 1.15 + 38), rows = 1;
  return { fs, lines, more, mfs, bh, rows, h: (lines.length ? 24 + lines.length * fs * 1.22 + moreH + 16 : 8) + rows * bh + (rows - 1) * 12 + 28 };
}
function compactStatus(S, ctx, z, dy = 0) {
  if (S.ph === 'aim' || !S.m) return null;
  const text = statusText(S);
  if (!text) return null;
  const cx = ctx ?? estCtx, fs = Math.round(22 * z);
  const { lines, more } = fitStatus(cx, text, fs, W - 70, 4);
  const mfs = Math.round(fs * 0.8), h = lines.length * fs * 1.25 + (more ? mfs * 1.3 : 0) + 18, y = (S.m.cfg.mode === 'watch' ? 1070 : 1000) + dy - h;
  return { fs, lines, more, mfs, h, y, rect: { x: 24, y, w: W - 48, h } };
}

// The layout of the play screen for the live frame. Portrait: the original composition in the design column (extra height goes to the lawn);
// landscape: score panel left, controls right, the lawn scene between them. Both return the same fields:
//   s, tx, ty  the scene transform in FRAME coordinates (frame = scene * s + (tx, ty)); fox the column origin the UI is drawn at
//   rects      every tappable rectangle, in the same (UI) coordinates as the pointer; pullHit(x, y) says whether a press starts a throw
export function computeLayout(S, ctx) {
  const z = zOf(S);
  if (FR.land) return landLayout(S, ctx, z);
  const hud = hudMetrics(S, ctx);
  let tray = null, trayH = 0;
  if (z > COMPACT) { tray = trayMetrics(S, ctx); trayH = tray.h; }
  const lay = playLayout(z, hud.h, trayH);
  lay.hud = hud; lay.tray = tray; lay.z = z; lay.land = false; lay.fox = FR.fox;
  lay.tx = FR.fox + lay.vx; lay.ty = lay.vy - SCENE_Y0 * lay.s;
  lay.status = z <= COMPACT ? compactStatus(S, ctx, z, lay.dy) : null;
  lay.rects = rectsFor(S, lay);
  lay.bannerX = 360; lay.bannerY = lay.compact ? 560 + lay.top0 : lay.vy + 330 * lay.s;
  const clipC = lay.clip, hh = hud.h, tt = lay.trayTop;
  lay.pullHit = (x, y) => {
    const sy = (y - lay.ty) / lay.s;
    const inView = clipC ? (x >= -FR.fox && x <= FR.sw - FR.fox && y >= clipC.y && y <= clipC.y + clipC.h) : y < tt - 4 && y > hh - 10;
    return inView && sy >= PULL_ZONE_Y0;
  };
  return lay;
}
const row = (y, h, items, x0 = 16, w = 688, gap = 10) => {
  const total = items.reduce((a, it) => a + it.w, 0), avail = w - gap * (items.length - 1), out = {};
  let x = x0;
  items.forEach((it) => { const ww = (it.w / total) * avail; out[it.id] = { x, y, w: ww, h }; x += ww + gap; });
  return out;
};
function rectsFor(S, lay) {
  const R = {};
  const m = S.m, ph = S.ph, mode = m.cfg.mode, dy = lay.dy;
  const humanAim = ph === 'aim' && S.humanTurn;
  if (mode === 'watch') {
    if (!lay.compact) {   // large text: one row (Pause, Why, Exit); the thinking time lives in the Why sheet
      Object.assign(R, row(H - 28 - Math.max(0, FR.ins.b - 14) - lay.tray.bh, lay.tray.bh, [{ id: 'wpause', w: 1.25 }, { id: 'more', w: 0.9 }, { id: 'wexit', w: 0.85 }]));
      return R;
    }
    const h = 72, y = 1086 + dy;
    Object.assign(R, row(y, h, [{ id: 'wdec', w: 1 }, { id: 'wlabel', w: 3 }, { id: 'winc', w: 1 }]));
    Object.assign(R, row(y + h + 12, h, [{ id: 'wpause', w: 2 }, { id: 'wexit', w: 1 }]));
    addMore(R, lay, y);
    return R;
  }
  if (lay.compact) {
    if (humanAim) {
      const g = lay.g, ya = TRAY.act.y + dy, hs = TRAY.spin.h + Math.round(g * 0.8), hl = TRAY.loft.h + Math.round(g * 0.6), ys = ya - 8 - hs, yl = ys - 8 - hl;
      Object.assign(R, row(yl, hl, [{ id: 'sty0', w: 1 }, { id: 'sty1', w: 1 }, { id: 'sty2', w: 1 }]));
      Object.assign(R, row(ys, hs, [0, 1, 2, 3, 4].map((i) => ({ id: `spin${i}`, w: 1 })), 16, 688, 8));
      Object.assign(R, row(TRAY.act.y + dy, TRAY.act.h, [{ id: 'think', w: 126 }, { id: 'left', w: 76 }, { id: 'right', w: 76 }, { id: 'throw', w: 230 }, { id: 'menu', w: 108 }], 16, 688, 10));
    } else if (ph === 'result') Object.assign(R, row(TRAY.act.y + dy, TRAY.act.h, [{ id: 'next', w: 1.6 }, { id: 'menu', w: 0.9 }]));
    else if (ph === 'flight') Object.assign(R, row(TRAY.act.y + dy, TRAY.act.h, [{ id: 'skip', w: 1.6 }, { id: 'menu', w: 0.9 }]));
    else Object.assign(R, row(TRAY.act.y + dy, TRAY.act.h, [{ id: 'menu', w: 1 }]));
    if (humanAim && S.hint && !S.hint.busy) R.use = hintGeom(S, lay).use;
    addMore(R, lay, 0);
    return R;
  }
  const t = lay.tray, y = H - 28 - Math.max(0, FR.ins.b - 14) - t.bh;
  const ids = humanAim ? [{ id: 'setup', w: 1 }, { id: 'throw', w: 1 }] : ph === 'result' ? [{ id: 'next', w: 1 }, { id: 'menu', w: 1 }] : ph === 'flight' ? [{ id: 'skip', w: 1 }, { id: 'menu', w: 1 }] : [{ id: 'menu', w: 1 }];
  Object.assign(R, row(y, t.bh, ids));
  addMore(R, lay, y);
  return R;
}
function addMore(R, lay, btnTop) {
  if (lay.compact) { if (lay.status && lay.status.more) R.more = lay.status.rect; return; }
  const t = lay.tray;
  if (t && t.more) R.more = { x: 0, y: lay.trayTop, w: W, h: Math.max(40, btnTop - lay.trayTop - 4) };
}
export function hintGeom(S, lay) {
  const z = Math.min(lay.z, COMPACT), fs = Math.round(21 * z);
  estCtx.font = `400 ${fs}px ${FONT}`;
  const lines = wrapLines(estCtx, S.hint.text, W - 80);
  const y = lay.hud.h + 6, h = 16 + lines.length * fs * 1.25 + 14 + 76;
  return { y, h, fs, lines, use: { x: W / 2 - 130, y: y + h - 78, w: 260, h: 66 } };
}

// ---- landscape ---------------------------------------------------------------------------------------------------------------
// Left panel: the scoreboard (and the mini board). Right panel: the coach / hint text and the controls. Between them: the lawn scene,
// fitted so the whole throwing window (PLAY_WIN) shows at full height.
function landLayout(S, ctx, z) {
  const ins = FR.ins, sw = FR.sw, Hh = H, m = S.m, ph = S.ph, mode = m.cfg.mode, cx = ctx ?? estCtx;
  const big = z > 1, humanAim = ph === 'aim' && S.humanTurn;
  const wideL = sw > 1300, PL = (wideL ? clampV(Math.round(sw * 0.245), 300, 360) : clampV(Math.round(sw * 0.21), 280, 330)) + (big ? 24 : 0), PR = wideL ? clampV(Math.round(sw * 0.235), 300, 350) : clampV(Math.round(sw * 0.2), 280, 322);
  const lp = RR(0, 0, ins.l + PL, Hh), rp = RR(sw - ins.r - PR, 0, ins.r + PR, Hh);
  const cx0 = lp.w, cx1 = rp.x, cxm = (cx0 + cx1) / 2;
  const wh = PLAY_WIN.y1 - PLAY_WIN.y0, ww = PLAY_WIN.x1 - PLAY_WIN.x0;
  const s = clampV((cx1 - cx0 - 14) / (ww + 10), 0.5, Math.min(0.94, (Hh - 20) / wh));
  const lay = { land: true, compact: !big, z, s, fox: 0, lp, rp, vx: cxm - 360 * s, hud: null, tray: null, trayTop: 0, clip: null, dy: 0, top0: 0 };
  lay.tx = cxm - 360 * s; lay.ty = (Hh - wh * s) / 2 - PLAY_WIN.y0 * s; lay.vy = lay.ty + SCENE_Y0 * s;
  lay.bannerX = cxm; lay.bannerY = Hh * 0.4; lay.cxm = cxm; lay.cw = cx1 - cx0;
  lay.pullHit = (x, y) => x >= cx0 && x <= cx1 && (y - lay.ty) / s >= PULL_ZONE_Y0;
  const padB = Math.max(12, ins.b + 8);
  const yR0 = Math.max(12, ins.t + 6);
  const lx = ins.l + 12, lw = PL - 24, rx = rp.x + 12, rw = PR - 24;
  const R = {};
  lay.rects = R;
  // ---- left: scoreboard -------------------------------------------------------------------------------------------------
  let yL = ins.back ? Math.max(yL0min(ins), 12) : Math.max(12, ins.t + 6);
  if (!big) {
    const hud = hudMetrics(S, cx), cardH = hud.cardH;
    const phase = fitStatus(cx, phaseLine(S), 21, lw, 3);
    lay.hud = { compact: true, z, cardH, h: yL + cardH * 2 + 8, cards: [RR(lx, yL, lw, cardH), RR(lx, yL + cardH + 8, lw, cardH)], phase: { lines: phase.lines, x: lx + lw / 2, y: yL + cardH * 2 + 8 + 12, fs: 21 } };
    yL += cardH * 2 + 8 + 12 + phase.lines.length * 27 + 8;
  } else {
    const hud = hudMetrics(S, cx), fs = Math.min(hud.fs, 52), sfs = Math.round(fs * 0.64);
    lay.hud = { compact: false, z, fs, sfs, rows: hud.rows, sub: hud.sub, x0: lx, x1: lx + lw, y: yL, h: yL + hud.rows.length * fs * 1.2 + sfs * 1.3 + 12 };
    yL = lay.hud.h + 10;
  }
  const avail = Hh - padB - yL;
  const kk = Math.min(1.7, avail / (MINI.h + 8), lw / (MINI.w + 8));
  lay.mini = kk >= 0.62 ? { k: kk, x: lx + (lw - (MINI.w + 8) * kk) / 2, y: yL, w: (MINI.w + 8) * kk, h: (MINI.h + 8) * kk } : null;
  // ---- right ----------------------------------------------------------------------------------------------------------------
  const stack = (items, y0, gap = 10) => { let y = y0; for (const it of items) { R[it.id] = RR(rx, y, rw, it.h); y += it.h + gap; } return y; };
  const rowOf = (ids, y, h, gap = 8) => { const n = ids.length, w1 = (rw - gap * (n - 1)) / n; ids.forEach((id, i) => { R[id] = RR(rx + i * (w1 + gap), y, w1, h); }); };
  if (big) {
    const t = trayMetrics(S, cx), bh = t.bh;
    lay.tray = t;
    const ids = mode === 'watch' ? ['wpause', 'more', 'wexit'] : humanAim ? ['setup', 'throw', 'menu'] : ph === 'result' ? ['next', 'menu'] : ph === 'flight' ? ['skip', 'menu'] : ['menu'];
    const gap = 12, tot = ids.length * bh + (ids.length - 1) * gap, h0 = Math.min(bh, (Hh - yR0 - padB - (ids.length - 1) * gap) / ids.length);
    let y = Math.max(yR0, (Hh - (tot - (bh - h0) * ids.length)) / 2);
    ids.forEach((id) => { R[id] = RR(rx, y, rw, h0); y += h0 + gap; });
    return lay;
  }
  // compact: an info box (coach line, the Think hint, the reason) on top, then the controls
  let yy = yR0;
  const info = infoFor(S, cx, rw, humanAim);
  if (info) {
    lay.info = { ...info, rect: RR(rx, yy, rw, info.h) };
    if (info.kind === 'hint') R.use = RR(rx + 12, yy + info.h - 10 - 66, rw - 24, 66);
    if (info.more && info.kind !== 'hint') R.more = lay.info.rect;
    if (info.kind === 'hint' && info.more) R.more = RR(rx, yy, rw, info.h - 82);
    yy += info.h + 10;
  }
  const rows = [];
  if (mode === 'watch') rows.push({ k: 'wpause', h: 84 }, { k: 'wdec2', h: 76 }, { k: 'wlabel', h: 40 }, { k: 'wexit', h: 76 });
  else if (humanAim) rows.push({ k: 'sty', h: 78 }, { k: 'spin', h: 72 }, { k: 'act', h: 78 }, { k: 'throw', h: 100 }, { k: 'menu', h: 76 });
  else if (ph === 'result') rows.push({ k: 'next', h: 84 }, { k: 'menu', h: 76 });
  else if (ph === 'flight') rows.push({ k: 'skip', h: 84 }, { k: 'menu', h: 76 });
  else rows.push({ k: 'menu', h: 76 });
  const gap = 10, sum = rows.reduce((a, r) => a + r.h, 0) + gap * (rows.length - 1), room = Hh - padB - yy;
  const f = Math.min(1, room / sum);
  rows.forEach((r) => {
    const h = Math.max(44, Math.round(r.h * f));
    if (r.k === 'sty') rowOf(['sty0', 'sty1', 'sty2'], yy, h);
    else if (r.k === 'spin') rowOf(['spin0', 'spin1', 'spin2', 'spin3', 'spin4'], yy, h, 6);
    else if (r.k === 'act') rowOf(['think', 'left', 'right'], yy, h);
    else if (r.k === 'wdec2') rowOf(['wdec', 'winc'], yy, h);
    else R[r.k] = RR(rx, yy, rw, h);
    yy += h + gap;
  });
  return lay;
}
const yL0min = (ins) => ins.t + ins.back + 10;
// The text box above the controls: what to do now, the Think hint (with its Use button), or the reason for the computer's throw.
function infoFor(S, cx, rw, humanAim) {
  const fs = 21, mfs = 19;
  let kind = 'text', text = '';
  if (S.ph === 'aim' && humanAim) {
    if (S.hint && S.hint.busy) { kind = 'busy'; text = 'Testing throws with the real physics...'; }
    else if (S.hint) { kind = 'hint'; text = S.hint.text; }
    else text = statusText(S);
  } else text = statusText(S);
  if (!text) return null;
  const maxLines = kind === 'hint' ? 5 : 4;
  const f = fitStatus(cx, text, fs, rw - 24, maxLines);
  const more = f.more || (S.m.cfg.mode === 'watch' && S.ph === 'think');
  const textH = f.lines.length * fs * 1.25 + (more ? mfs * 1.5 : 0);
  return { kind, lines: f.lines, more: f.more, fs, mfs, h: 12 + textH + 8 + (kind === 'hint' ? 78 : 0) };
}

// ---- drawing -----------------------------------------------------------------------------------------------------------------
export function fitFont(ctx, text, size, maxW, weight = 700, family = FONT) {
  let px = size;
  ctx.font = `${weight} ${px}px ${family}`;
  while (ctx.measureText(text).width > maxW && px > 11) { px -= 1; ctx.font = `${weight} ${px}px ${family}`; }
  return px;
}
// A small bag mark: the same diamond (red) or ring (blue) that is printed on the bags.
export function bagMark(ctx, x, y, r, side, alpha = 1) {
  ctx.save(); ctx.globalAlpha = alpha;
  const col = BAG_COL[side];
  roundPath(ctx, x - r, y - r, r * 2, r * 2, r * 0.3); ctx.fillStyle = `rgb(${col[0]},${col[1]},${col[2]})`; ctx.fill();
  ctx.strokeStyle = 'rgba(255,248,230,0.95)'; ctx.fillStyle = 'rgba(255,248,230,0.95)'; ctx.lineWidth = Math.max(1.5, r * 0.14);
  if (side === 0) { ctx.beginPath(); ctx.moveTo(x, y - r * 0.5); ctx.lineTo(x + r * 0.5, y); ctx.lineTo(x, y + r * 0.5); ctx.lineTo(x - r * 0.5, y); ctx.closePath(); ctx.fill(); }
  else { ctx.beginPath(); ctx.arc(x, y, r * 0.48, 0, TAU); ctx.stroke(); }
  ctx.restore();
}
function drawCardRaw(ctx, x, y, w, h, z, name, score, sub, active, side, pips) {
  panel(ctx, x, y, w, h, { r: 18, fill: active ? 'rgba(40,52,30,0.92)' : 'rgba(18,28,14,0.82)', stroke: active ? 'rgba(255,220,120,0.95)' : 'rgba(255,255,255,0.22)', lw: active ? 3 : 2, shadow: true });
  ctx.textBaseline = 'alphabetic';
  fitFont(ctx, String(score), 46 * z, w * 0.34, 800, NUM);
  ctx.textAlign = 'right'; ctx.fillStyle = '#ffe7a8'; ctx.fillText(String(score), x + w - 14, y + h * 0.62);
  const sw = ctx.measureText(String(score)).width;
  const mk = Math.min(16 * z, h * 0.2);
  if (side != null) bagMark(ctx, x + 14 + mk, y + 14 + mk, mk, side);
  const nx = x + 14 + (side != null ? mk * 2 + 8 : 0);
  const np = fitFont(ctx, name, 24 * z, w - sw - 44 - (nx - x - 14), 700);
  ctx.textAlign = 'left'; ctx.fillStyle = active ? '#fff3d6' : 'rgba(255,243,214,0.78)'; ctx.fillText(name, nx, y + 14 + np * 0.95);
  fitFont(ctx, sub, 21 * z, w - 28 - (pips != null ? 4 * 12 * Math.min(z, 1.5) : 0), 400);
  ctx.fillStyle = 'rgba(255,243,214,0.8)'; ctx.fillText(sub, x + 14, y + h - 14);
  if (pips != null) { const pr = 5 * Math.min(z, 1.5); for (let i = 0; i < BAGS_EACH; i++) { ctx.beginPath(); ctx.arc(x + w - 20 - i * (pr * 2.6), y + h - 14 - pr * 0.4, pr, 0, TAU); ctx.fillStyle = i < pips ? '#ffe08a' : 'rgba(255,255,255,0.18)'; ctx.fill(); } }
}
function drawCard(ctx, S, x, y, w, h, side, z) {
  const m = S.m;
  drawCardRaw(ctx, x, y, w, h, z, sideName(S, side), m.score[side], `Round: ${pointsOf(m.bags, side)}`, turnOf(m) === side && !m.over, side, BAGS_EACH - m.made[side]);
}
export function lessonInfo(S) {
  const L = S.m.lesson, left = L.tries - L.used;
  return { left, tries: L.tries, goalName: 'Goal', goalScore: L.goalShort, goalSub: L.goalSub };
}
function drawSpinBtn(ctx, r, i, active) {
  const { dy } = paintButton(ctx, r, { active, dark: !active });
  const s = i - 2, cx = r.x + r.w / 2, cy = r.y + dy + r.h / 2, rad = Math.min(r.h * 0.3, r.w * 0.28);
  ctx.save(); ctx.strokeStyle = '#fff7e6'; ctx.fillStyle = '#fff7e6'; ctx.lineWidth = 4; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  if (s === 0) { ctx.beginPath(); ctx.arc(cx, cy, rad * 0.35, 0, TAU); ctx.fill(); ctx.beginPath(); ctx.arc(cx, cy, rad, 0, TAU); ctx.setLineDash([3, 6]); ctx.stroke(); }
  else {
    const dir = Math.sign(s), n = Math.abs(s), a0 = dir > 0 ? -2.4 : -0.74, a1 = dir > 0 ? 0.9 : -3.55;
    ctx.beginPath(); ctx.arc(cx, cy, rad, a0, a1, dir < 0); ctx.stroke();
    const ex = cx + Math.cos(a1) * rad, ey = cy + Math.sin(a1) * rad, tx = -Math.sin(a1) * dir, ty = Math.cos(a1) * dir;
    for (let k = 0; k < n; k++) { const o = k * 8; ctx.beginPath(); ctx.moveTo(ex + tx * (6 - o) , ey + ty * (6 - o)); ctx.lineTo(ex - tx * (4 + o) + ty * 7, ey - ty * (4 + o) - tx * 7); ctx.lineTo(ex - tx * (4 + o) - ty * 7, ey - ty * (4 + o) + tx * 7); ctx.closePath(); ctx.fill(); }
  }
  ctx.restore();
}

// The fixed top-down mini board: it never moves; bags are drawn where they really lie.
function drawMini(ctx, S, bags, guide) {
  const { x, y, w, h } = MINI;
  const sx = (w - 16) / BOARD_W, bx = x + 8, by = y + 24;
  const bh = BOARD_L * sx;
  ctx.save();
  panel(ctx, x - 4, y - 4, w + 8, h + 8, { r: 14, fill: 'rgba(16,26,12,0.8)', stroke: 'rgba(255,255,255,0.28)', lw: 2, shadow: true });
  ctx.font = `700 21px ${FONT}`; ctx.fillStyle = 'rgba(255,243,214,0.9)'; ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic'; ctx.fillText('The board', x + w / 2, y + 20);
  roundPath(ctx, bx, by, BOARD_W * sx, bh, 5); ctx.fillStyle = '#ecd6aa'; ctx.fill(); ctx.strokeStyle = '#7a4e28'; ctx.lineWidth = 2; ctx.stroke();
  const P = (u, v) => ({ x: bx + (u + BOARD_W / 2) * sx, y: by + (BOARD_L - v) * sx });   // the back edge (high end) at the top, the thrower below
  const hp = P(0, HOLE_V);
  ctx.fillStyle = '#2d6ac4'; ctx.fillRect(bx + 3, by + 3, BOARD_W * sx - 6, 6); ctx.fillStyle = '#c0372e'; ctx.fillRect(bx + 3, by + bh - 9, BOARD_W * sx - 6, 6);
  ctx.beginPath(); ctx.arc(hp.x, hp.y, HOLE_R * sx, 0, TAU); ctx.fillStyle = '#140c06'; ctx.fill(); ctx.strokeStyle = 'rgba(0,0,0,0.5)'; ctx.stroke();
  const bagPx = BAG_HALF * sx;
  const inHole = [0, 0];
  for (const b of bags) {
    if (b.st === 'hole') { inHole[b.side]++; continue; }
    if (b.st !== 'board') continue;
    const p = P(b.u, b.v);
    ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(-(b.yaw || 0));
    ctx.fillStyle = 'rgba(0,0,0,0.25)'; ctx.fillRect(-bagPx + 1.5, -bagPx + 2, bagPx * 2, bagPx * 2);
    bagMark(ctx, 0, 0, bagPx, b.side); ctx.restore();
  }
  // bags in the hole: shown stacked small in the hole, and counted below
  let k = 0; for (const b of bags) if (b.st === 'hole') { const a = k++ * 1.4; bagMark(ctx, hp.x + Math.cos(a) * 4, hp.y + Math.sin(a) * 4 + (k > 1 ? 0 : 0), HOLE_R * sx * 0.62, b.side, 0.95); }
  if (guide) {
    if (guide.ghost) { const p = P(guide.ghost.u, guide.ghost.v); ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(-(guide.ghost.yaw || 0)); ctx.setLineDash([4, 3]); ctx.strokeStyle = guide.col; ctx.lineWidth = 2.2; ctx.strokeRect(-bagPx, -bagPx, bagPx * 2, bagPx * 2); ctx.restore(); }
    if (guide.land) { const p = P(guide.land.u, guide.land.v); ctx.beginPath(); ctx.arc(p.x, p.y, 7, 0, TAU); ctx.strokeStyle = guide.col; ctx.lineWidth = 2.6; ctx.stroke(); ctx.beginPath(); ctx.moveTo(p.x - 11, p.y); ctx.lineTo(p.x + 11, p.y); ctx.moveTo(p.x, p.y - 11); ctx.lineTo(p.x, p.y + 11); ctx.stroke(); }
  }
  // points on the board for each side
  const s0 = pointsOf(bags, 0), s1 = pointsOf(bags, 1);
  ctx.font = `800 24px ${NUM}`; ctx.textAlign = 'left'; ctx.fillStyle = '#ff9a8c'; ctx.fillText(`${s0}`, x + 12, y + h - 8);
  ctx.textAlign = 'right'; ctx.fillStyle = '#8ec0ff'; ctx.fillText(`${s1}`, x + w - 12, y + h - 8);
  ctx.textAlign = 'center'; ctx.font = `400 21px ${FONT}`; ctx.fillStyle = 'rgba(255,243,214,0.78)'; ctx.fillText('round', x + w / 2, y + h - 9);
  void inHole; void S;
  ctx.restore();
}

export function drawScene(ctx, S) {
  const cam = S.cam, t = S.t;
  drawStill(ctx, cam, t);
  const ov = S.overlay;
  if (ov) {
    if (ov.last) drawArc(ctx, cam, ov.last, 'rgba(255,255,255,0.55)', t, 3, 0.8);
    const track = (pts, col, alpha) => { const a = pts[0], b = pts[pts.length - 1], k = 0.7 / Math.max(1, b.z - a.z), g = [{ x: a.x + (b.x - a.x) * k, y: 0.01, z: a.z + (b.z - a.z) * k }, { x: b.x, y: 0.01, z: b.z }]; drawArc(ctx, cam, g, col, t, 5, alpha); };
    if (ov.hint) { drawArc(ctx, cam, ov.hint.pts, '#7de8ff', t, 3, 0.6); track(ov.hint.pts, '#7de8ff', 0.95); drawLanding(ctx, cam, ov.hint.aimX, ov.hint.aimZ, '#7de8ff', t, ''); }
    if (ov.plan) { const col = ov.plan.col ?? '#ffe08a'; drawArc(ctx, cam, ov.plan.pts, col, t, 3, 0.55); track(ov.plan.pts, col, 1); drawLanding(ctx, cam, ov.plan.aimX, ov.plan.aimZ, col, t, ov.plan.label); }
  }
  const bags = interpBags(S.sim, S.alpha);
  const list = S.handBag ? [...bags, S.handBag] : bags;
  drawBags(ctx, cam, list);
  if (ov && ov.ghost) { const g = { ...ov.ghost, side: S.handSide, sq: 0 }; drawBags(ctx, cam, [g], { alpha: 0.38, shadow: false }); }
  drawParts(ctx, cam, S.parts);
}

function drawBanner(ctx, S, lay) {
  const b = S.banner;
  if (!b) return;
  const k = Math.min(1, b.t / 0.28), e = ease.outBack(k), fade = b.dur - b.t < 0.3 ? Math.max(0, (b.dur - b.t) / 0.3) : 1;
  const z = lay.z, cy = lay.bannerY, bcx = lay.bannerX;
  ctx.save();
  ctx.globalAlpha = fade;
  const pw = lay.land ? clampV(lay.cw + 80, 440, 640) : 640, size = Math.round((b.size ?? 76) * Math.min(1.3, 0.85 + z * 0.2));
  ctx.font = `800 ${size}px ${NUM}`;
  const px = fitFont(ctx, b.text, size, pw - 60, 800, NUM);
  const subSize = Math.round(26 * Math.min(z, 2.2));
  ctx.font = `400 ${subSize}px ${FONT}`;
  const subLines = b.sub ? wrapLines(ctx, b.sub, pw - 60) : [];
  const ph = px * 1.3 + subLines.length * subSize * 1.25 + 34;
  ctx.translate(bcx, cy); ctx.scale(0.8 + 0.2 * e, 0.8 + 0.2 * e);
  roundPath(ctx, -pw / 2, -ph / 2, pw, ph, 26); ctx.fillStyle = 'rgba(16,26,12,0.92)'; ctx.fill();
  ctx.lineWidth = 3; ctx.strokeStyle = b.kind === 'bad' ? '#e0806e' : '#ffd36a'; ctx.stroke();
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
  g.addColorStop(0, 'rgba(10,18,8,0.92)'); g.addColorStop(0.85, 'rgba(10,18,8,0.62)'); g.addColorStop(1, 'rgba(10,18,8,0)');
  ctx.fillStyle = g; ctx.fillRect(-FR.fox, 0, FR.sw, hud.h + 30);
  ctx.textBaseline = 'alphabetic';
  const cx0 = hud.bx ?? 14, cwd = (706 - cx0 - 4) / 2;
  if (hud.compact) {
    if (m.cfg.mode === 'learn') {
      const li = lessonInfo(S);
      drawCardRaw(ctx, cx0, hud.y, cwd, hud.cardH, hud.z, 'Bags left', li.left, `Lesson ${m.lesson.idx + 1} of ${S.lessonCount}`, true, 0, null);
      drawCardRaw(ctx, cx0 + cwd + 4, hud.y, cwd, hud.cardH, hud.z, li.goalName, li.goalScore, li.goalSub, false, null, null);
    } else {
      drawCard(ctx, S, cx0, hud.y, cwd, hud.cardH, 0, hud.z);
      drawCard(ctx, S, cx0 + cwd + 4, hud.y, cwd, hud.cardH, 1, hud.z);
    }
    ctx.textAlign = 'center'; ctx.fillStyle = 'rgba(255,243,214,0.95)';
    fitFont(ctx, phaseLine(S), hud.fs, W - 40, 400);
    textShadow(ctx, phaseLine(S), W / 2, hud.y + hud.cardH + 8 + hud.fs, '#fff3d6', 6);
  } else {
    let y = hud.y;
    hud.rows.forEach((r) => {
      const sfont = `800 ${Math.round(hud.fs * 1.1)}px ${NUM}`;
      ctx.font = sfont; const sw = ctx.measureText(r.score).width;
      const np = fitFont(ctx, r.name, hud.fs, W - 36 - hud.bx - sw - 24 - (r.side != null ? hud.fs * 0.9 : 0), 700);
      let nx = hud.bx;
      if (r.side != null) { const mk = hud.fs * 0.34; bagMark(ctx, nx + mk, y + hud.fs * 0.62, mk, r.side); nx += mk * 2 + 12; }
      ctx.textAlign = 'left'; ctx.font = `700 ${np}px ${FONT}`; textShadow(ctx, r.name, nx, y + hud.fs, r.active ? '#ffe08a' : '#fff3d6', 6);
      ctx.textAlign = 'right'; ctx.font = sfont; textShadow(ctx, r.score, W - 36, y + hud.fs, r.active ? '#ffe08a' : '#ffe7a8', 6);
      y += hud.fs * 1.2;
    });
    ctx.textAlign = 'left'; ctx.font = `400 ${hud.sfs}px ${FONT}`; textShadow(ctx, hud.sub, hud.bx, y + hud.sfs * 1.05, '#fff3d6', 6);
  }
}
function drawTrayText(ctx, lay) {
  const t = lay.tray;
  ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
  if (!t.lines.length) return;
  t.lines.forEach((l, i) => { ctx.font = `400 ${t.fs}px ${FONT}`; textShadow(ctx, l, W / 2, lay.trayTop + 16 + t.fs * (1 + i * 1.22), '#fff3d6', 6); });
  if (t.more) { ctx.font = `700 ${t.mfs}px ${FONT}`; textShadow(ctx, 'Tap here to read it all', W / 2, lay.trayTop + 16 + t.fs * (1 + t.lines.length * 1.22) + t.mfs * 0.2, '#7de8ff', 6); }
}
function drawTray(ctx, S, lay) {
  const R = lay.rects, z = lay.z, m = S.m, ph = S.ph;
  const bar = ctx.createLinearGradient(0, lay.trayTop - 24, 0, H);
  bar.addColorStop(0, 'rgba(10,18,8,0)'); bar.addColorStop(0.2, 'rgba(10,18,8,0.84)'); bar.addColorStop(1, 'rgba(10,18,8,0.96)');
  ctx.fillStyle = bar; ctx.fillRect(-FR.fox, lay.trayTop - 24, FR.sw, H - lay.trayTop + 24);
  const size = Math.round(26 * Math.min(z, 3)), humanAim = ph === 'aim' && S.humanTurn;
  const btn = (id, label, o = {}) => { if (R[id]) drawButton(ctx, R[id], label, { size, ...o }); };
  if (m.cfg.mode === 'watch') {
    if (!lay.compact) {
      btn('wpause', S.paused ? 'Resume' : 'Pause', { primary: true }); btn('more', 'Why?', { dark: true }); btn('wexit', 'Exit', { dark: true });
      return;
    }
    btn('wdec', 'Faster', { dark: true, disabled: S.settings.thinkIdx === 0, size: Math.round(size * 0.85) });
    btn('winc', 'Slower', { dark: true, disabled: S.settings.thinkIdx === 3, size: Math.round(size * 0.85) });
    if (R.wlabel) { const r = R.wlabel, txt = `Thinking time ${S.thinkSecs} s`; ctx.fillStyle = '#ffe9bf'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; fitFont(ctx, txt, Math.round(24 * z), r.w - 8, 700); ctx.fillText(txt, r.x + r.w / 2, r.y + r.h / 2); }
    btn('wpause', S.paused ? 'Resume' : 'Pause', { primary: true });
    btn('wexit', 'Exit', { dark: true });
    return;
  }
  if (lay.compact && humanAim) {
    STYLES.forEach((st, i) => btn(`sty${i}`, st.name, { active: S.plan.style === i, dark: S.plan.style !== i, size: Math.round(27 * z) }));
    for (let i = 0; i < 5; i++) drawSpinBtn(ctx, R[`spin${i}`], i, S.plan.spin === i - 2);
    btn('think', S.hint && S.hint.busy ? 'Think...' : 'Think', { dark: true, size: Math.round(24 * z) });
    btn('left', '◄', { dark: true, size: 30 }); btn('right', '►', { dark: true, size: 30 });
    btn('throw', 'Throw', { primary: true, size: Math.round(34 * Math.min(z, 1.4)) });
    btn('menu', 'Menu', { dark: true, size: Math.round(22 * z) });
    return;
  }
  if (lay.compact) {
    btn('next', ph === 'result' && m.over ? 'See result' : 'Next', { primary: true });
    btn('skip', 'Skip', { dark: true }); btn('menu', 'Menu', { dark: true, size: Math.round(22 * z) });
    return;
  }
  drawTrayText(ctx, lay);
  btn('setup', 'Set up'); btn('throw', 'Throw', { primary: true });
  btn('next', 'Next', { primary: true }); btn('skip', 'Skip', { dark: true }); btn('menu', 'Menu', { dark: true });
}

// The drag handle: a lit hand marker with a band back to where the drag started.
function drawPull(ctx, S) {
  const d = S.drag;
  if (!d || d.kind !== 'pull') return;
  const x0 = d.sx, y0 = d.sy, x1 = d.x, y1 = d.y;
  ctx.save(); ctx.lineCap = 'round';
  ctx.strokeStyle = 'rgba(0,0,0,0.35)'; ctx.lineWidth = 10; ctx.beginPath(); ctx.moveTo(x0, y0 + 2); ctx.lineTo(x1, y1 + 2); ctx.stroke();
  ctx.strokeStyle = 'rgba(255,236,170,0.9)'; ctx.lineWidth = 6; ctx.setLineDash([2, 12]); ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x1, y1); ctx.stroke(); ctx.setLineDash([]);
  ctx.beginPath(); ctx.arc(x0, y0, 9, 0, TAU); ctx.fillStyle = 'rgba(255,236,170,0.55)'; ctx.fill();
  const g = ctx.createRadialGradient(x1 - 6, y1 - 8, 2, x1, y1, 34); g.addColorStop(0, 'rgba(255,250,225,0.95)'); g.addColorStop(0.6, 'rgba(255,214,120,0.8)'); g.addColorStop(1, 'rgba(255,190,90,0.0)');
  ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x1, y1, 34, 0, TAU); ctx.fill();
  ctx.beginPath(); ctx.arc(x1, y1, 17, 0, TAU); ctx.fillStyle = 'rgba(255,248,226,0.92)'; ctx.fill(); ctx.lineWidth = 3; ctx.strokeStyle = 'rgba(210,150,50,0.95)'; ctx.stroke();
  ctx.restore();
}

// The scene (sky, lawn, board, bags) in frame coordinates, covering the whole screen; the mini board with it in portrait.
function drawSceneLayer(ctx, S, lay) {
  const { s, tx, ty } = lay;
  setExtent(-tx / s, -ty / s, (FR.sw - tx) / s, (H - ty) / s);
  ctx.save();
  if (lay.clip) { ctx.beginPath(); ctx.rect(0, lay.clip.y, FR.sw, lay.clip.h); ctx.clip(); }
  ctx.translate(tx, ty); ctx.scale(s, s);
  drawScene(ctx, S);
  ctx.restore();
  const vg = ctx.createRadialGradient(FR.sw / 2, H * 0.5, Math.min(FR.sw, H) * 0.42, FR.sw / 2, H * 0.5, Math.max(FR.sw, H) * 0.7); vg.addColorStop(0, 'rgba(0,0,0,0)'); vg.addColorStop(1, 'rgba(0,0,0,0.34)');
  ctx.fillStyle = vg; ctx.fillRect(0, 0, FR.sw, H);
}
export function renderPlay(ctx, S) {
  const lay = computeLayout(S, ctx);
  ctx.fillStyle = '#0b1408'; ctx.fillRect(0, 0, FR.sw, H);
  drawSceneLayer(ctx, S, lay);
  const bags = interpBags(S.sim, S.alpha), mbags = bags.filter((b) => b.st !== 'free' || !b.dead);
  if (lay.land) {
    renderLand(ctx, S, lay, mbags);
    return;
  }
  // portrait: the mini board lives in the scene (also scaled with the scene window at large text)
  ctx.save();
  if (lay.clip) { ctx.beginPath(); ctx.rect(0, lay.clip.y, FR.sw, lay.clip.h); ctx.clip(); }
  ctx.translate(lay.tx, lay.ty); ctx.scale(lay.s, lay.s);
  drawMini(ctx, S, mbags, S.miniGuide);
  ctx.restore();
  ctx.save(); ctx.translate(lay.fox, 0);
  drawPull(ctx, S);
  drawHud(ctx, S, lay);
  if (!(S.m.cfg.mode === 'learn' && S.ph === 'intro')) drawBanner(ctx, S, lay);
  drawTray(ctx, S, lay);
  drawStatus(ctx, S, lay);
  if (S.toastT > 0 && S.toast) {
    ctx.font = `700 ${Math.round(22 * Math.min(lay.z, 2))}px ${FONT}`; const tw = Math.min(660, ctx.measureText(S.toast).width + 44);
    roundPath(ctx, 360 - tw / 2, lay.hud.h + 18, tw, 54 * Math.min(lay.z, 2), 16); ctx.fillStyle = 'rgba(16,26,12,0.92)'; ctx.fill();
    ctx.fillStyle = '#ffe9bf'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(S.toast, 360, lay.hud.h + 18 + 27 * Math.min(lay.z, 2));
  }
  ctx.restore();
}

// ---- landscape drawing ---------------------------------------------------------------------------------------------------------
function panelBg(ctx, r, side) {
  const x0 = side === 'l' ? r.x : r.x - 36, x1 = side === 'l' ? r.x + r.w + 36 : r.x + r.w;
  const g = ctx.createLinearGradient(side === 'l' ? r.x + r.w - 6 : r.x + 6, 0, side === 'l' ? r.x + r.w + 36 : r.x - 36, 0);
  g.addColorStop(0, 'rgba(10,18,8,0.9)'); g.addColorStop(1, 'rgba(10,18,8,0)');
  ctx.fillStyle = 'rgba(10,18,8,0.9)'; ctx.fillRect(r.x, 0, r.w, r.h);
  ctx.fillStyle = g; ctx.fillRect(side === 'l' ? r.x + r.w - 1 : r.x - 36, 0, 37, r.h);
  void x0; void x1;
}
function renderLand(ctx, S, lay, mbags) {
  const m = S.m;
  panelBg(ctx, lay.lp, 'l'); panelBg(ctx, lay.rp, 'r');
  // ---- left: the scoreboard ----
  const hud = lay.hud;
  ctx.textBaseline = 'alphabetic';
  if (hud.compact) {
    if (m.cfg.mode === 'learn') {
      const li = lessonInfo(S);
      const c = hud.cards;
      drawCardRaw(ctx, c[0].x, c[0].y, c[0].w, hud.cardH, hud.z, 'Bags left', li.left, `Lesson ${m.lesson.idx + 1} of ${S.lessonCount}`, true, 0, null);
      drawCardRaw(ctx, c[1].x, c[1].y, c[1].w, hud.cardH, hud.z, li.goalName, li.goalScore, li.goalSub, false, null, null);
    } else { drawCard(ctx, S, hud.cards[0].x, hud.cards[0].y, hud.cards[0].w, hud.cardH, 0, hud.z); drawCard(ctx, S, hud.cards[1].x, hud.cards[1].y, hud.cards[1].w, hud.cardH, 1, hud.z); }
    ctx.textAlign = 'center'; ctx.font = `400 ${hud.phase.fs}px ${FONT}`;
    hud.phase.lines.forEach((l, i) => textShadow(ctx, l, hud.phase.x, hud.phase.y + hud.phase.fs + i * 27, '#fff3d6', 6));
  } else {
    let y = hud.y;
    hud.rows.forEach((r) => {
      const sfont = `800 ${Math.round(hud.fs * 1.1)}px ${NUM}`;
      ctx.font = sfont; const sw = ctx.measureText(r.score).width;
      let nx = hud.x0;
      const np = fitFont(ctx, r.name, hud.fs, hud.x1 - hud.x0 - sw - 16 - (r.side != null ? hud.fs * 0.9 : 0), 700);
      if (r.side != null) { const mk = hud.fs * 0.34; bagMark(ctx, nx + mk, y + hud.fs * 0.62, mk, r.side); nx += mk * 2 + 12; }
      ctx.textAlign = 'left'; ctx.font = `700 ${np}px ${FONT}`; textShadow(ctx, r.name, nx, y + hud.fs, r.active ? '#ffe08a' : '#fff3d6', 6);
      ctx.textAlign = 'right'; ctx.font = sfont; textShadow(ctx, r.score, hud.x1, y + hud.fs, r.active ? '#ffe08a' : '#ffe7a8', 6);
      y += hud.fs * 1.2;
    });
    ctx.textAlign = 'left'; ctx.font = `400 ${hud.sfs}px ${FONT}`; fitFont(ctx, hud.sub, hud.sfs, hud.x1 - hud.x0, 400); textShadow(ctx, hud.sub, hud.x0, y + hud.sfs * 1.05, '#fff3d6', 6);
  }
  if (lay.mini) { const mi = lay.mini; ctx.save(); ctx.translate(mi.x, mi.y); ctx.scale(mi.k, mi.k); ctx.translate(-(MINI.x - 4), -(MINI.y - 4)); drawMini(ctx, S, mbags, S.miniGuide); ctx.restore(); }
  // ---- the throw handle, banner ----
  drawPull(ctx, S);
  if (!(m.cfg.mode === 'learn' && S.ph === 'intro')) drawBanner(ctx, S, lay);
  // ---- right: text box and controls ----
  drawRightLand(ctx, S, lay);
  // the lesson card is a centred column dialog
  if (m.cfg.mode === 'learn' && S.ph === 'intro') { ctx.save(); ctx.translate(FR.fox, 0); drawLessonIntro(ctx, S, lay); ctx.restore(); }
}
function drawRightLand(ctx, S, lay) {
  const R = lay.rects, z = lay.z, m = S.m, ph = S.ph, size = Math.round(26 * Math.min(z, 3));
  const btn = (id, label, o = {}) => { if (R[id]) drawButton(ctx, R[id], label, { size, ...o }); };
  const info = lay.info;
  if (info) {
    const r = info.rect;
    roundPath(ctx, r.x, r.y, r.w, r.h, 16); ctx.fillStyle = 'rgba(12,20,10,0.88)'; ctx.fill();
    ctx.strokeStyle = info.kind === 'hint' ? 'rgba(125,232,255,0.6)' : 'rgba(125,232,255,0.4)'; ctx.lineWidth = 2; ctx.stroke();
    ctx.fillStyle = info.kind === 'busy' ? '#bff3ff' : '#e8fbff'; ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic'; ctx.font = `400 ${info.fs}px ${FONT}`;
    info.lines.forEach((l, i) => ctx.fillText(l, r.x + r.w / 2, r.y + 10 + info.fs * (1 + i * 1.25) - 3));
    if (info.more) { ctx.font = `700 ${info.mfs}px ${FONT}`; ctx.fillStyle = '#7de8ff'; ctx.fillText('Tap to read it all', r.x + r.w / 2, r.y + 10 + info.fs * (1 + info.lines.length * 1.25) + info.mfs * 0.4); }
    if (info.kind === 'hint') btn('use', 'Use this throw', { primary: true, size: 24 });
  }
  const humanAim = ph === 'aim' && S.humanTurn;
  if (m.cfg.mode === 'watch') {
    if (lay.compact) {
      btn('wpause', S.paused ? 'Resume' : 'Pause', { primary: true });
      btn('wdec', 'Faster', { dark: true, disabled: S.settings.thinkIdx === 0, size: 22 });
      btn('winc', 'Slower', { dark: true, disabled: S.settings.thinkIdx === 3, size: 22 });
      if (R.wexit) {
        const wy = R.wdec.y + R.wdec.h + 6;
        ctx.fillStyle = '#ffe9bf'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; fitFont(ctx, `Thinking time ${S.thinkSecs} s`, 22, R.wdec.w * 2 + 8, 700); ctx.fillText(`Thinking time ${S.thinkSecs} s`, R.wdec.x + R.wdec.w + 4, wy + 18);
      }
      btn('wexit', 'Exit', { dark: true });
    } else { btn('wpause', S.paused ? 'Resume' : 'Pause', { primary: true }); btn('more', 'Why?', { dark: true }); btn('wexit', 'Exit', { dark: true }); }
    return;
  }
  if (lay.compact && humanAim) {
    STYLES.forEach((st, i) => btn(`sty${i}`, st.name, { active: S.plan.style === i, dark: S.plan.style !== i, size: 22 }));
    for (let i = 0; i < 5; i++) drawSpinBtn(ctx, R[`spin${i}`], i, S.plan.spin === i - 2);
    btn('think', S.hint && S.hint.busy ? '...' : 'Think', { dark: true, size: 22 });
    btn('left', '◄', { dark: true, size: 30 }); btn('right', '►', { dark: true, size: 30 });
    btn('throw', 'Throw', { primary: true, size: 36 });
    btn('menu', 'Menu', { dark: true, size: 22 });
    return;
  }
  btn('setup', 'Set up'); btn('throw', 'Throw', { primary: true });
  btn('next', ph === 'result' && m.over ? 'See result' : 'Next', { primary: true }); btn('skip', 'Skip', { dark: true });
  btn('menu', 'Menu', { dark: true, size: Math.round(24 * Math.min(z, 2)) });
}

// The lesson card: a title, the lesson text and "Tap to start". At large text the text is longer than the card: it then scrolls (drag, wheel,
// arrow keys) under a fixed title and a Start button, with a scroll bar.
export function introGeom(S, ctx) {
  const L = S.m.lesson, z = Math.min(zOf(S), 2), fs = Math.round(26 * z), cx = ctx ?? estCtx;
  cx.font = `400 ${fs}px ${FONT}`;
  const lines = wrapLines(cx, L.text, 580);
  const tfs = fitFont(cx, `Lesson ${L.idx + 1}: ${L.title}`, Math.round(40 * z), 590, 800, NUM);
  const lh = fs * 1.3, head = 24 + tfs + 24, textH = lines.length * lh;
  const maxH = H - 140, natural = head + textH + 70, over = natural > maxH;
  const h = over ? maxH : natural, y = Math.max(40, (H - h) / 2);
  const view = { x: 40, y: y + head, w: 640, h: h - head - (over ? 110 : 60) };
  return { L, fs, tfs, lines, lh, h, y, over, view, max: Math.max(0, textH - view.h + 10), start: { x: 200, y: y + h - 94, w: 320, h: 76 } };
}
function drawLessonIntro(ctx, S, lay) {
  const g = introGeom(S, ctx), L = g.L, z = lay.z;
  panel(ctx, 40, g.y, 640, g.h, { r: 26, fill: 'rgba(16,26,12,0.97)', stroke: '#ffd36a' });
  ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
  ctx.font = `800 ${g.tfs}px ${NUM}`; ctx.fillStyle = '#ffe08a'; ctx.fillText(`Lesson ${L.idx + 1}: ${L.title}`, 360, g.y + 24 + g.tfs);
  const sc = Math.min(g.max, Math.max(0, S.introScroll || 0));
  ctx.save(); ctx.beginPath(); ctx.rect(g.view.x, g.view.y, g.view.w, g.view.h); ctx.clip();
  ctx.font = `400 ${g.fs}px ${FONT}`; ctx.fillStyle = '#fff3d6';
  g.lines.forEach((l, i) => ctx.fillText(l, 360, g.view.y + g.fs * (1 + i * 1.3) - sc));
  ctx.restore();
  if (g.over) {
    const th = Math.max(40, g.view.h * (g.view.h / (g.view.h + g.max))), ty = g.view.y + (g.max ? (sc / g.max) * (g.view.h - th) : 0);
    roundPath(ctx, 664, g.view.y, 6, g.view.h, 3); ctx.fillStyle = 'rgba(255,240,204,0.15)'; ctx.fill();
    roundPath(ctx, 664, ty, 6, th, 3); ctx.fillStyle = 'rgba(255,240,204,0.6)'; ctx.fill();
    if (sc < g.max - 4) { const gr = ctx.createLinearGradient(0, g.view.y + g.view.h - 40, 0, g.view.y + g.view.h); gr.addColorStop(0, 'rgba(16,26,12,0)'); gr.addColorStop(1, 'rgba(16,26,12,0.95)'); ctx.fillStyle = gr; ctx.fillRect(g.view.x, g.view.y + g.view.h - 40, g.view.w, 40); }
    drawButton(ctx, g.start, 'Start', { primary: true, size: Math.round(28 * Math.min(z, 2)) });
    ctx.font = `400 ${Math.round(18 * Math.min(z, 2))}px ${FONT}`; ctx.fillStyle = 'rgba(191,232,255,0.9)'; ctx.fillText('Drag the text to read more', 360, g.start.y - 12);
  } else {
    ctx.font = `700 ${Math.round(22 * Math.min(z, 2))}px ${FONT}`; ctx.fillStyle = '#bfe8ff'; ctx.fillText('Tap to start', 360, g.y + g.h - 20);
  }
}
function drawStatus(ctx, S, lay) {
  if (S.m.cfg.mode === 'learn' && S.ph === 'intro') { drawLessonIntro(ctx, S, lay); return; }
  if (!lay.compact) return;
  if (S.ph === 'aim' && S.hint && !S.hint.busy) {
    const g = hintGeom(S, lay);
    roundPath(ctx, 24, g.y, W - 48, g.h, 18); ctx.fillStyle = 'rgba(12,20,10,0.93)'; ctx.fill();
    ctx.strokeStyle = 'rgba(125,232,255,0.6)'; ctx.lineWidth = 2; ctx.stroke();
    ctx.font = `400 ${g.fs}px ${FONT}`; ctx.fillStyle = '#e8fbff'; ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
    g.lines.forEach((l, i) => ctx.fillText(l, W / 2, g.y + 16 + g.fs * (1 + i * 1.25) - 4));
    drawButton(ctx, g.use, 'Use this throw', { primary: true, size: 24 });
    return;
  }
  if (S.ph === 'aim' && S.hint && S.hint.busy) {
    ctx.font = `700 22px ${FONT}`; ctx.fillStyle = '#bff3ff'; ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
    ctx.fillText('Testing throws with the real physics...', W / 2, lay.hud.h + 30); return;
  }
  if (S.ph === 'aim' && S.humanTurn && !S.drag) {
    // a one-line coach under the scoreboard
    ctx.font = `700 ${Math.round(21 * lay.z)}px ${FONT}`; const txt = statusText(S);
    const { lines } = fitStatus(ctx, txt, Math.round(21 * lay.z), W - 90, 2);
    const h = lines.length * 21 * lay.z * 1.3 + 16, y = lay.hud.h + 2;
    roundPath(ctx, 24, y, W - 48, h, 14); ctx.fillStyle = 'rgba(12,20,10,0.78)'; ctx.fill();
    ctx.fillStyle = '#fff3d6'; ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic'; ctx.font = `400 ${Math.round(21 * lay.z)}px ${FONT}`;
    lines.forEach((l, i) => ctx.fillText(l, W / 2, y + 10 + 21 * lay.z * (1 + i * 1.3) - 3));
    return;
  }
  const st = lay.status;
  if (!st) return;
  const { fs, lines, y, h } = st;
  roundPath(ctx, 24, y, W - 48, h, 16); ctx.fillStyle = 'rgba(12,20,10,0.88)'; ctx.fill();
  ctx.strokeStyle = 'rgba(125,232,255,0.5)'; ctx.lineWidth = 2; ctx.stroke();
  ctx.fillStyle = '#e8fbff'; ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic'; ctx.font = `400 ${fs}px ${FONT}`;
  lines.forEach((l, i) => ctx.fillText(l, W / 2, y + 12 + fs * (1 + i * 1.25) - 4));
  if (st.more) { ctx.font = `700 ${st.mfs}px ${FONT}`; ctx.fillStyle = '#7de8ff'; ctx.fillText('Tap here to read it all', W / 2, y + 12 + fs * (1 + lines.length * 1.25) - 4 + st.mfs * 0.1); }
}
export { toScene, arcPoints, fixedCam, COS_A, BOARD_Z0 };
