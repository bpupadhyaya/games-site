// The play screen: the backyard scene in a window, the scoreboard above it, the fixed mini board, the controls below, banners and cards on top.
// Pure drawing and pure layout; game.js owns the state. computeLayout() is called by game.js for hit-testing (no canvas, text widths
// estimated) and by render (real text widths), and gives the same rectangles to both.
import { W, H, TEXT_SCALES, COMPACT, TRAY, SCENE_Y0, MINI, playLayout, toScene } from './layout.js';
import { FONT, NUM, roundPath, drawButton, paintButton, panel, wrapLines, textShadow, ease } from './ui.js';
import { drawStill, drawBags, drawArc, drawLanding, drawParts, interpBags, fixedCam, TAU, BAG_COL } from './scene.js';
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
  if (z <= COMPACT) {
    const cardH = Math.round(20 + 24 * z * 1.1 + 18 * z * 1.2 + 12), fs = Math.round(24 * z);
    return { compact: true, z, cardH, y: 44, h: 44 + cardH + 8 + Math.round(fs * 1.35) + 10, fs };
  }
  // Large text: two score rows (name and score) and one short line for the round. Everything else (the guide, the hint) lives in the Set up sheet,
  // so the scene keeps its full size instead of shrinking into a small window.
  const fs = Math.round(26 * z), m = S.m, rows = [];
  if (m.cfg.mode === 'learn') { const li = lessonInfo(S); rows.push({ name: 'Bags left', score: String(li.left), active: true }, { name: li.goalName, score: String(li.goalScore), active: false }); }
  else [0, 1].forEach((sd) => rows.push({ name: sideName(S, sd), score: String(m.score[sd]), active: turnOf(m) === sd && !m.over, side: sd }));
  const sub = m.cfg.mode === 'learn' ? `Lesson ${m.lesson.idx + 1} of ${S.lessonCount}` : `Round ${m.round}, bag ${Math.min(bagIndex(m), 8)} of 8`;
  const sfs = Math.round(fs * 0.64);
  return { compact: false, z, fs, sfs, rows, sub, y: 40, h: 40 + rows.length * fs * 1.2 + sfs * 1.3 + 12 };
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
function rectsFor(S, lay) {
  const R = {};
  const m = S.m, ph = S.ph, mode = m.cfg.mode;
  const humanAim = ph === 'aim' && S.humanTurn;
  if (mode === 'watch') {
    if (!lay.compact) {   // large text: one row (Pause, Why, Exit); the thinking time lives in the Why sheet
      Object.assign(R, row(H - 28 - lay.tray.bh, lay.tray.bh, [{ id: 'wpause', w: 1.25 }, { id: 'more', w: 0.9 }, { id: 'wexit', w: 0.85 }]));
      return R;
    }
    const h = 72, y = 1086;
    Object.assign(R, row(y, h, [{ id: 'wdec', w: 1 }, { id: 'wlabel', w: 3 }, { id: 'winc', w: 1 }]));
    Object.assign(R, row(y + h + 12, h, [{ id: 'wpause', w: 2 }, { id: 'wexit', w: 1 }]));
    addMore(R, lay, y);
    return R;
  }
  if (lay.compact) {
    if (humanAim) {
      Object.assign(R, row(TRAY.loft.y, TRAY.loft.h, [{ id: 'sty0', w: 1 }, { id: 'sty1', w: 1 }, { id: 'sty2', w: 1 }]));
      Object.assign(R, row(TRAY.spin.y, TRAY.spin.h, [0, 1, 2, 3, 4].map((i) => ({ id: `spin${i}`, w: 1 })), 16, 688, 8));
      Object.assign(R, row(TRAY.act.y, TRAY.act.h, [{ id: 'think', w: 126 }, { id: 'left', w: 76 }, { id: 'right', w: 76 }, { id: 'throw', w: 230 }, { id: 'menu', w: 108 }], 16, 688, 10));
    } else if (ph === 'result') Object.assign(R, row(TRAY.act.y, TRAY.act.h, [{ id: 'next', w: 1.6 }, { id: 'menu', w: 0.9 }]));
    else if (ph === 'flight') Object.assign(R, row(TRAY.act.y, TRAY.act.h, [{ id: 'skip', w: 1.6 }, { id: 'menu', w: 0.9 }]));
    else Object.assign(R, row(TRAY.act.y, TRAY.act.h, [{ id: 'menu', w: 1 }]));
    if (humanAim && S.hint && !S.hint.busy) R.use = hintGeom(S, lay).use;
    addMore(R, lay, 0);
    return R;
  }
  const t = lay.tray, y = H - 28 - t.bh;
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
  const z = Math.min(lay.z, COMPACT), fs = Math.round(19 * z);
  estCtx.font = `400 ${fs}px ${FONT}`;
  const lines = wrapLines(estCtx, S.hint.text, W - 80);
  const y = lay.hud.h + 6, h = 16 + lines.length * fs * 1.25 + 14 + 58;
  return { y, h, fs, lines, use: { x: W / 2 - 130, y: y + h - 64, w: 260, h: 54 } };
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
  fitFont(ctx, sub, 17 * z, w - 28 - (pips != null ? 4 * 12 * Math.min(z, 1.5) : 0), 400);
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
  ctx.font = `700 15px ${FONT}`; ctx.fillStyle = 'rgba(255,243,214,0.9)'; ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic'; ctx.fillText('The board', x + w / 2, y + 17);
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
  ctx.font = `800 20px ${NUM}`; ctx.textAlign = 'left'; ctx.fillStyle = '#ff9a8c'; ctx.fillText(`${s0}`, x + 12, y + h - 8);
  ctx.textAlign = 'right'; ctx.fillStyle = '#8ec0ff'; ctx.fillText(`${s1}`, x + w - 12, y + h - 8);
  ctx.textAlign = 'center'; ctx.font = `400 14px ${FONT}`; ctx.fillStyle = 'rgba(255,243,214,0.7)'; ctx.fillText('round', x + w / 2, y + h - 8);
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
  const z = lay.z, cy = lay.compact ? 560 : lay.vy + 330 * lay.s;
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
  ctx.fillStyle = g; ctx.fillRect(0, 0, W, hud.h + 30);
  ctx.textBaseline = 'alphabetic';
  if (hud.compact) {
    if (m.cfg.mode === 'learn') {
      const li = lessonInfo(S);
      drawCardRaw(ctx, 14, hud.y, 344, hud.cardH, hud.z, 'Bags left', li.left, `Lesson ${m.lesson.idx + 1} of ${S.lessonCount}`, true, 0, null);
      drawCardRaw(ctx, 362, hud.y, 344, hud.cardH, hud.z, li.goalName, li.goalScore, li.goalSub, false, null, null);
    } else {
      drawCard(ctx, S, 14, hud.y, 344, hud.cardH, 0, hud.z);
      drawCard(ctx, S, 362, hud.y, 344, hud.cardH, 1, hud.z);
    }
    ctx.textAlign = 'center'; ctx.fillStyle = 'rgba(255,243,214,0.95)';
    fitFont(ctx, phaseLine(S), hud.fs, W - 40, 400);
    textShadow(ctx, phaseLine(S), W / 2, hud.y + hud.cardH + 8 + hud.fs, '#fff3d6', 6);
  } else {
    let y = hud.y;
    hud.rows.forEach((r) => {
      const sfont = `800 ${Math.round(hud.fs * 1.1)}px ${NUM}`;
      ctx.font = sfont; const sw = ctx.measureText(r.score).width;
      const np = fitFont(ctx, r.name, hud.fs, W - 72 - sw - 24 - (r.side != null ? hud.fs * 0.9 : 0), 700);
      let nx = 36;
      if (r.side != null) { const mk = hud.fs * 0.34; bagMark(ctx, 36 + mk, y + hud.fs * 0.62, mk, r.side); nx += mk * 2 + 12; }
      ctx.textAlign = 'left'; ctx.font = `700 ${np}px ${FONT}`; textShadow(ctx, r.name, nx, y + hud.fs, r.active ? '#ffe08a' : '#fff3d6', 6);
      ctx.textAlign = 'right'; ctx.font = sfont; textShadow(ctx, r.score, W - 36, y + hud.fs, r.active ? '#ffe08a' : '#ffe7a8', 6);
      y += hud.fs * 1.2;
    });
    ctx.textAlign = 'left'; ctx.font = `400 ${hud.sfs}px ${FONT}`; textShadow(ctx, hud.sub, 36, y + hud.sfs * 1.05, '#fff3d6', 6);
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
  ctx.fillStyle = bar; ctx.fillRect(0, lay.trayTop - 24, W, H - lay.trayTop + 24);
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

export function renderPlay(ctx, S) {
  const lay = computeLayout(S, ctx);
  ctx.fillStyle = '#0b1408'; ctx.fillRect(0, 0, W, H);
  ctx.save();
  if (lay.clip) { ctx.beginPath(); ctx.rect(lay.clip.x, lay.clip.y, lay.clip.w, lay.clip.h); ctx.clip(); }
  ctx.translate(lay.vx, lay.vy - SCENE_Y0 * lay.s); ctx.scale(lay.s, lay.s);
  drawScene(ctx, S);
  ctx.restore();
  const vg = ctx.createRadialGradient(360, 640, 300, 360, 640, 900); vg.addColorStop(0, 'rgba(0,0,0,0)'); vg.addColorStop(1, 'rgba(0,0,0,0.34)');
  ctx.fillStyle = vg; ctx.fillRect(0, 0, W, H);
  // the fixed mini board (also scaled with the scene window at large text)
  ctx.save();
  if (lay.clip) { ctx.beginPath(); ctx.rect(lay.clip.x, lay.clip.y, lay.clip.w, lay.clip.h); ctx.clip(); }
  ctx.translate(lay.vx, lay.vy - SCENE_Y0 * lay.s); ctx.scale(lay.s, lay.s);
  const bags = interpBags(S.sim, S.alpha);
  drawMini(ctx, S, bags.filter((b) => b.st !== 'free' || !b.dead), S.miniGuide);
  ctx.restore();
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
    const { lines } = fitStatus(ctx, txt, Math.round(20 * lay.z), W - 90, 2);
    const h = lines.length * 20 * lay.z * 1.3 + 16, y = lay.hud.h + 2;
    roundPath(ctx, 24, y, W - 48, h, 14); ctx.fillStyle = 'rgba(12,20,10,0.78)'; ctx.fill();
    ctx.fillStyle = '#fff3d6'; ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic'; ctx.font = `400 ${Math.round(20 * lay.z)}px ${FONT}`;
    lines.forEach((l, i) => ctx.fillText(l, W / 2, y + 10 + 20 * lay.z * (1 + i * 1.3) - 3));
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
