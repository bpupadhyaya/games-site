// The play screen: the pitch in a window, the scoreboard above it, the controls below, banners and cards on top.
// Pure drawing and pure layout; game.js owns the state. computeLayout() is called by game.js for hit-testing (no canvas, text widths estimated)
// and by render (real text widths) and gives the same rectangles to both.
import { W, H, TEXT_SCALES, COMPACT, SCENE_Y0, SCENE_H, toScene, G, host, BAKE } from './layout.js';
import { FONT, NUM, C, roundPath, drawButton, paintButton, panel, wrapLines, textShadow, ease, FLOOR } from './ui.js';
import * as SC from './scene.js';
import { PROFILES } from './ai.js';
import { LOFTS, SPINS, KUBB, KING, FIELD, nlerp } from './phys.js';
import { totalLeft, targets, dirOf, baselineY, kingPos, KING_RING } from './engine.js';

const { proj, TAU, TEAM } = SC;
const estCtx = { font: '', measureText(t) { const m = /(\d+)px/.exec(this.font); return { width: String(t).length * (m ? +m[1] : 20) * 0.54 }; } };
let MCTX = null;   // the real drawing context, once there is one: hit-testing then measures text exactly as drawing does
export const setMeasureCtx = (c) => { MCTX = c; };
const pickCtx = (c) => c ?? MCTX ?? estCtx;
const zOf = (S) => TEXT_SCALES[S.settings.textIdx];
let LK = 1;   // labels drawn inside the scene follow the text size: on screen they are min(text scale, 2) times their base size even when the scene is shrunk

export const sideName = (S, side) => {
  const c = S.m.cfg;
  if (c.mode === 'two') return side === 0 ? 'Player 1' : 'Player 2';
  if (c.mode === 'watch') return PROFILES[side === 0 ? c.watchA : c.opp].name;
  if (c.mode === 'learn') return side === 0 ? 'You' : 'Opponent';
  return side === 0 ? 'You' : PROFILES[c.opp].name;
};

// ---- text: what is going on, what to do now ----------------------------------------------------------------------------------------------
export function phaseLine(S) {
  const m = S.m;
  if (m.cfg.mode === 'learn') return `Lesson ${m.lesson.idx + 1}: ${m.lesson.title}`;
  const who = sideName(S, m.turn), poss = who === 'You' ? 'Your turn' : `${who}${who.endsWith('s') ? "'" : "'s"} turn`;
  if (S.ph === 'place') return `${poss}: ${sideName(S, 1 - m.turn) === 'You' ? 'you place a kubb' : `${sideName(S, 1 - m.turn)} places a kubb`}`;
  if (m.phase === 'throwin' && (S.ph === 'toss' || S.ph === 'tosscomp' || S.ph === 'tossfly')) return `${poss}: throw in the fallen kubbs (${m.queue.length} left)`;
  return `${poss}: baton ${Math.min(m.baton + 1, m.batons)} of ${m.batons}`;
}
export function statusText(S) {
  const m = S.m;
  switch (S.ph) {
    case 'aim': return S.hint && !S.hint.busy ? S.hint.text : `${firstTime(S) ? `${slingText(S)} ` : ''}${planLine(S)}`;
    case 'think': return S.think && S.think.text && S.think.phase !== 'think' ? S.think.text : S.think && S.think.phase === 'think' && S.think.tossing ? 'Choosing where to throw the kubb...' : 'Choosing a throw...';
    case 'toss': return S.hint && !S.hint.busy ? S.hint.text : 'Drag on the opponent\'s half to place the aim ring, then let go to throw the kubb in. It must land past the centre line, inside the side lines and a baton length from the king.';
    case 'place': return 'The kubb missed twice, so you place it: tap a spot in the half that is being attacked.';
    case 'flight': return '';
    case 'result': return S.resultLine ?? '';
    default: return m && m.over ? m.over.why : '';
  }
}
const slingText = (S) => (S.m.turn === 1 ? 'Drag up the pitch like a slingshot (back towards your end), then let go to throw.' : 'Drag back down the pitch like a slingshot, then let go to throw.');
const firstTime = (S) => S.m.cfg.mode !== 'watch' && (S.record.throws | 0) < 3;
export function planLine(S) {
  const p = S.plan, m = S.m, line = S.line, dir = dirOf(m.turn);
  const dist = Math.abs(p.ay - (line ? line.y : baselineY(m.turn)));
  void dir;
  return `${LOFTS[p.loft].name} loft, ${SPINS[p.spin].name.toLowerCase()} spin, ${dist.toFixed(1)} m${line && line.adv ? ', from the advantage line' : ''}.`;
}
export const whyTitle = (S) => (S.m.cfg.mode === 'watch' || S.ph === 'think' ? 'Why this throw?' : 'The suggested throw');

// A very short version of the phase line for the largest text sizes.
function shortPhase(S) {
  const m = S.m;
  if (S.ph === 'place') return 'Place the kubb';
  if (m.phase === 'throwin' && (S.ph === 'toss' || S.ph === 'tosscomp' || S.ph === 'tossfly' || (S.think && S.think.tossing))) return `Kubbs to throw in: ${m.queue.length}`;
  return `Baton ${Math.min(m.baton + 1, m.batons)} of ${m.batons}`;
}
// ---- layout -------------------------------------------------------------------------------------------------------------------------------
// Three shapes, all a pure function of the live size (G.mode): 'tall' / 'compact' portrait (scoreboard on top, the lawn, controls below; text sizes up to
// 150 percent keep the inline controls, larger sizes get a text tray and a set-up sheet) and 'wide' landscape (left panel: scoreboard and status; the lawn
// in the middle; right panel: the controls). The lawn picture is only ever scaled, never re-drawn differently.
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const zEff = (S) => (G.land ? Math.min(zOf(S), COMPACT) : zOf(S));
const cardHFor = (z) => Math.round(20 + 24 * z * 1.1 + 18 * z * 1.2 + 16);
export function hudMetrics(S, ctx) {
  const z = zEff(S), cx = pickCtx(ctx), back = G.backBox, hasBack = back.h > 0;
  if (G.land) return { compact: true, wide: true, z, h: 0, y: 0, fs: Math.round(22 * z), cardH: cardHFor(z) };
  if (z <= COMPACT) {
    const cardH = cardHFor(z), fs = Math.round(22 * z);
    if (hasBack) { const y = back.y + back.h + 6; return { compact: true, z, cardH, y, h: y + cardH + 12, fs, strip: { x: back.x + back.w + 10, y: back.y, w: W - 14 - (back.x + back.w + 10), h: back.h } }; }
    const y = Math.max(44, host.t + 8);
    return { compact: true, z, cardH, y, h: y + cardH + 8 + Math.round(fs * 1.35) + 10, fs };
  }
  const fs = Math.round(26 * z), lines = [], m = S.m;
  const pushWrapped = (text, o) => { cx.font = `${o.bold ? 700 : 400} ${fs}px ${FONT}`; wrapLines(cx, text, W - 72).forEach((l) => lines.push({ text: l, ...o })); };
  if (m.cfg.mode === 'learn') { pushWrapped(`Batons left: ${m.batons - m.baton}`, { active: true, bold: true }); pushWrapped(m.lesson.goalShort, { bold: true }); }
  else { pushWrapped(`${sideName(S, 0)} ${totalLeft(m, 0)}, ${sideName(S, 1)} ${totalLeft(m, 1)}`, { bold: true }); pushWrapped(shortPhase(S), {}); }
  const y = hasBack ? back.y + back.h + 8 : Math.max(40, host.t + 10);
  return { compact: false, z, fs, lines, y, h: y + lines.length * fs * 1.22 + 20 };
}
export function fitStatus(cx, text, fs, maxW, maxLines) {
  cx.font = `400 ${fs}px ${FONT}`;
  let lines = wrapLines(cx, text, maxW), more = false;
  if (lines.length > maxLines) { more = true; lines = lines.slice(0, maxLines); lines[maxLines - 1] = lines[maxLines - 1].replace(/[ ,.;:]*$/, '') + '...'; }
  return { lines, more };
}
function trayMetrics(S, ctx) {
  const z = zOf(S), cx = pickCtx(ctx), fs = Math.round(24 * z);
  const maxLines = S.m.cfg.mode === 'watch' ? 2 : Math.max(2, Math.floor((H * 0.24) / (fs * 1.22)));
  const text = S.ph === 'aim' && !(S.hint && !S.hint.busy) ? '' : statusText(S);
  const { lines, more } = fitStatus(cx, text, fs, W - 110, maxLines);
  const mfs = Math.max(Math.round(fs * 0.8), Math.ceil(FLOOR.v)), moreH = more ? mfs * 1.3 : 0;
  const bh = Math.round(26 * z * 1.15 + 38), rows = S.m.cfg.mode === 'watch' ? 2 : 1;
  return { fs, lines, more, mfs, bh, rows, h: 24 + lines.length * fs * 1.22 + moreH + 16 + rows * bh + (rows - 1) * 12 + 28 };
}
// Portrait with inline controls: everything at the bottom hangs from the bottom edge; the lawn picture sits just above the control rows (scaled down a
// little when the screen is shorter than a phone, e.g. a tablet) and any extra height on a tall phone becomes more far scenery above it.
function portraitGeom(hud) {
  const tap = G.tap, padB = Math.max(66, host.b + 24);
  const spinY = H - padB - tap, loftY = spinY - 6 - tap, arrowY = loftY - 8 - tap, sceneBottom = loftY + 38;
  const s = clamp((sceneBottom - (hud.h + 54)) / SCENE_H, 0.6, 1);
  const vy = Math.min(sceneBottom - SCENE_H * s, 560 * s);
  return { tap, padB, spinY, loftY, arrowY, skipY: spinY, s, vx: W / 2 - 360 * s, vy, sceneBottom, bottom: H - padB };
}
function compactStatus(S, ctx, z, P) {
  const text = S.ph === 'aim' ? (firstTime(S) && !S.hint ? slingText(S) : '') : statusText(S);
  if (!text || S.ph === 'flight') return null;
  const cx = pickCtx(ctx), fs = Math.max(Math.round(21 * z), Math.ceil(FLOOR.v));
  const { lines, more } = fitStatus(cx, text, fs, W - 70, 4);
  const mfs = Math.max(Math.round(fs * 0.8), Math.ceil(FLOOR.v)), h = lines.length * fs * 1.25 + (more ? mfs * 1.3 : 0) + 18;
  const rowBelow = S.m.cfg.mode === 'watch' ? P.loftY - 10 : S.ph === 'aim' ? P.arrowY - 26 : (S.ph === 'flight' || S.ph === 'result' || S.ph === 'settle') ? P.skipY - 8 : P.bottom;
  const top = S.m.turn === 1 && S.ph !== 'result', y = top ? hudBottom(S) + (S.m.cfg.mode === 'watch' ? 8 : 70) : rowBelow - h;
  return { fs, lines, more, mfs, h, y, rect: { x: 24, y, w: W - 48, h } };
}
const hudBottom = (S) => hudMetrics(S).h;

// The landscape panels. Left: the two score cards, the phase line, the status text (or the Think hint). Right: the buttons.
function widePanels(S, ctx, z) {
  const U = G.U, cx = pickCtx(ctx), s = clamp(Math.min((U.h - 12) / 905, (U.w - 2 * 260) / 720), 0.55, 1.1);
  const cxm = (U.x0 + U.x1) / 2, ww = clamp(U.w - 2 * 260, 720 * s, 1240 * s * 0.97), wx0 = cxm - ww / 2;
  const L = { x: U.x0 + 8, y: U.y0 + 8, w: wx0 - 10 - (U.x0 + 8), h: U.h - 16 }, Rp = { x: wx0 + ww + 10, y: U.y0 + 8, w: U.x1 - 8 - (wx0 + ww + 10), h: U.h - 16 };
  const lay = { s, vx: cxm - 360 * s, vy: U.y0 + 6 - 10 * s, clip: { x: wx0, y: 0, w: ww, h: H }, cx: cxm, win: { x: wx0, w: ww }, L, Rp };
  const m = S.m, watch = m.cfg.mode === 'watch', fs = Math.max(Math.round(21 * z), Math.ceil(FLOOR.v));
  // left panel
  let y = L.y + 10;
  if (G.backBox.h > 0) y = Math.max(y, G.backBox.y + G.backBox.h + 6);
  const cardH = cardHFor(z);
  lay.cards = [{ x: L.x + 8, y, w: L.w - 16, h: cardH }, { x: L.x + 8, y: y + cardH + 8, w: L.w - 16, h: cardH }];
  y += 2 * cardH + 16;
  cx.font = `400 ${fs}px ${FONT}`;
  const ph = wrapLines(cx, phaseLine(S), L.w - 24);
  lay.phase = { x: L.x + L.w / 2, y, lines: ph, fs };
  y += ph.length * fs * 1.25 + 10;
  const text = S.ph === 'aim' ? (firstTime(S) && !S.hint ? slingText(S) : '') : S.ph === 'flight' ? '' : statusText(S);
  const hintShown = (S.ph === 'aim' || S.ph === 'toss') && S.hint && !S.hint.busy;
  const useH = hintShown ? Math.max(54, G.tap) : 0, avail = L.y + L.h - 10 - y - (useH ? useH + 10 : 0);
  const maxLines = Math.max(0, Math.floor((avail - 8) / (fs * 1.25)) - 1);
  const st = text ? fitStatus(cx, text, fs, L.w - 28, Math.max(1, maxLines)) : { lines: [], more: false };
  const mfs = Math.max(Math.round(fs * 0.8), Math.ceil(FLOOR.v)), moreH = st.more ? mfs * 1.3 : 0, sh = st.lines.length ? st.lines.length * fs * 1.25 + moreH + 16 : 0;
  lay.status = st.lines.length ? { fs, lines: st.lines, more: st.more, mfs, h: sh, rect: { x: L.x + 6, y, w: L.w - 12, h: sh } } : null;
  if (hintShown) lay.useRect = { x: L.x + 12, y: L.y + L.h - 10 - useH, w: L.w - 24, h: useH };
  lay.busy = (S.ph === 'aim' || S.ph === 'toss') && S.hint && S.hint.busy ? { x: L.x + L.w / 2, y: y + 24 } : null;
  // right panel rows
  const t = G.tap, gap = 8, R = {}, rx = Rp.x + 8, rw = Rp.w - 16;
  let ry = Rp.y + 10;
  const half = (id1, id2, yy, h = t) => { const w2 = (rw - gap) / 2; R[id1] = { x: rx, y: yy, w: w2, h }; R[id2] = { x: rx + w2 + gap, y: yy, w: w2, h }; };
  const full = (id, yy, h = t) => { R[id] = { x: rx, y: yy, w: rw, h }; };
  lay.labels = null;
  if (watch) {
    half('wdec', 'winc', ry); ry += t + gap;
    R.wlabel = { x: rx, y: ry, w: rw, h: Math.round(t * 0.8) }; ry += R.wlabel.h + gap;
    full('wpause', ry, t + 8); ry += t + 8 + gap; full('wexit', ry);
  } else if (S.humanTurn && S.ph === 'aim') {
    half('think', 'menu', ry); ry += t + gap;
    lay.labels = { y: ry + 12, lx: rx + (rw - gap) / 4, rx: rx + (rw - gap) * 3 / 4 + gap, fs: Math.max(Math.ceil(FLOOR.v), 20) };
    ry += 28;
    const w2 = (rw - gap) / 2;
    for (let i = 0; i < 3; i++) { R[`loft${i}`] = { x: rx, y: ry, w: w2, h: t }; R[`spin${i}`] = { x: rx + w2 + gap, y: ry, w: w2, h: t }; ry += t + 6; }
    ry += 2; half('left', 'right', ry);
  } else if (S.humanTurn && S.ph === 'toss') half('think', 'menu', ry);
  else if (S.ph === 'flight' || S.ph === 'result' || S.ph === 'settle') half('skip', 'menu', ry);
  else full('menu', ry);
  if (hintShown) R.use = lay.useRect;
  if (lay.status && lay.status.more) R.more = lay.status.rect;
  lay.rects = R;
  return lay;
}
export function computeLayout(S, ctx) {
  const z = zEff(S), hud = hudMetrics(S, ctx), real = zOf(S);
  FLOOR.v = Math.max(11, 11 / Math.max(0.25, host.px));
  if (G.land) {
    const lay = widePanels(S, ctx, z);
    Object.assign(lay, { wide: true, compact: true, z, hud, tray: null, trayTop: H, bannerW: Math.min(640, lay.win.w - 24), toastY: G.U.y0 + 16, geo: null });
    return lay;
  }
  let tray = null, trayH = 0, lay;
  if (real > COMPACT) {
    tray = trayMetrics(S, ctx); trayH = tray.h;
    const top = Math.min(hud.h + 30, 560), bottom = H - Math.min(trayH + 40, Math.max(180, H * 0.48)), h = Math.max(260, bottom - top), s = Math.min(1, h / SCENE_H);
    lay = { compact: false, s, vx: (W - W * s) / 2, vy: top + (h - SCENE_H * s) / 2, clip: { x: 0, y: top, w: W, h }, trayTop: bottom, geo: null };
  } else {
    const P = portraitGeom(hud);
    lay = { compact: true, s: P.s, vx: P.vx, vy: P.vy, clip: null, trayTop: P.loftY - 8, geo: P };
  }
  Object.assign(lay, { wide: false, hud, tray, z: real, cx: W / 2, bannerW: 640, toastY: hud.h + 76 });
  lay.status = real <= COMPACT ? compactStatus(S, ctx, real, lay.geo) : null;
  lay.rects = rectsFor(S, lay);
  return lay;
}
const row = (y, h, items, x0 = 16, w = W - 32, gap = 10) => {
  const total = items.reduce((a, it) => a + it.w, 0), avail = w - gap * (items.length - 1), out = {};
  let x = x0;
  items.forEach((it) => { const ww = (it.w / total) * avail; out[it.id] = { x, y, w: ww, h }; x += ww + gap; });
  return out;
};
function rectsFor(S, lay) {
  const R = {}, m = S.m, ph = S.ph, mode = m.cfg.mode, P = lay.geo;
  if (mode === 'watch') {
    const h = lay.compact ? P.tap : lay.tray.bh, y = lay.compact ? P.loftY : H - Math.max(70, host.b + 24) - 2 * h - 12;
    Object.assign(R, row(y, h, [{ id: 'wdec', w: 1 }, { id: 'wlabel', w: 3 }, { id: 'winc', w: 1 }]));
    Object.assign(R, row(y + h + (lay.compact ? 6 : 12), h, [{ id: 'wpause', w: 2 }, { id: 'wexit', w: 1 }]));
    addMore(R, lay, y);
    return R;
  }
  if (lay.compact) {
    const top = lay.hud.h + 6, tp = P.tap;
    if (S.humanTurn && ph === 'aim') {
      Object.assign(R, row(P.loftY, tp, [{ id: 'loft0', w: 1 }, { id: 'loft1', w: 1 }, { id: 'loft2', w: 1 }]));
      Object.assign(R, row(P.spinY, tp, [{ id: 'spin0', w: 1 }, { id: 'spin1', w: 1 }, { id: 'spin2', w: 1 }]));
      R.left = { x: 16, y: P.arrowY, w: 84, h: tp }; R.right = { x: W - 100, y: P.arrowY, w: 84, h: tp };
      R.think = { x: 16, y: top, w: 150, h: tp }; R.menu = { x: W - 166, y: top, w: 150, h: tp };
      if (S.hint && !S.hint.busy) R.use = hintGeom(S, lay).use;
    } else if (S.humanTurn && (ph === 'toss' || ph === 'place')) {
      if (ph === 'toss') R.think = { x: 16, y: top, w: 150, h: tp };
      R.menu = { x: W - 166, y: top, w: 150, h: tp };
      if (ph === 'toss' && S.hint && !S.hint.busy) R.use = hintGeom(S, lay).use;
    } else if (ph === 'flight' || ph === 'result' || ph === 'settle') {
      Object.assign(R, row(P.skipY, tp, [{ id: 'skip', w: 1.6 }, { id: 'menu', w: 0.9 }]));
    } else R.menu = { x: W - 166, y: top, w: 150, h: tp };
    addMore(R, lay, 0);
    return R;
  }
  const t = lay.tray, y = H - Math.max(70, host.b + 24) - t.bh;
  let ids;
  if (S.humanTurn && ph === 'aim') ids = [{ id: 'setup', w: 1 }, { id: 'menu', w: 1 }];
  else if (S.humanTurn && ph === 'toss') ids = [{ id: 'think', w: 1 }, { id: 'menu', w: 1 }];
  else if (ph === 'flight' || ph === 'result' || ph === 'settle') ids = [{ id: 'skip', w: 1 }, { id: 'menu', w: 1 }];
  else ids = [{ id: 'menu', w: 1 }];
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
  const z = Math.min(lay.z, COMPACT), fs = Math.max(Math.round(19 * z), Math.ceil(FLOOR.v));
  const cx = pickCtx(null);
  cx.font = `400 ${fs}px ${FONT}`;
  const lines = wrapLines(cx, S.hint.text, W - 80), uh = Math.max(54, G.tap);
  const h = 16 + lines.length * fs * 1.25 + 14 + uh + 4, y = S.m.turn === 0 ? lay.geo.arrowY - 10 - h : lay.hud.h + 72;   // next to the thrower, never over the kubbs that are being attacked
  return { y, h, fs, lines, use: { x: W / 2 - 130, y: y + h - uh - 8, w: 260, h: uh } };
}

// ---- drawing ------------------------------------------------------------------------------------------------------------------------------
function fitFont(ctx, text, size, maxW, weight = 700, family = FONT) {
  let px = Math.max(size, FLOOR.v);
  ctx.font = `${weight} ${px}px ${family}`;
  while (ctx.measureText(text).width > maxW && px > FLOOR.v) { px -= 1; ctx.font = `${weight} ${px}px ${family}`; }
  return px;
}
// A tiny kubb for the scoreboard: team-coloured top, pale wood body. state: base | field | fallen | cleared
function pip(ctx, x, y, team, state, s = 1) {
  const T = TEAM[team];
  ctx.save();
  ctx.translate(x, y);
  if (state === 'cleared') { ctx.globalAlpha = 0.28; ctx.fillStyle = '#9aa28f'; roundPath(ctx, -6 * s, -8 * s, 12 * s, 16 * s, 3); ctx.fill(); ctx.restore(); return; }
  if (state === 'fallen') ctx.rotate(Math.PI / 2 * 0.95);
  const w = 13 * s, h = 19 * s;
  roundPath(ctx, -w / 2, -h / 2, w, h, 3); ctx.fillStyle = '#e8c88a'; ctx.fill();
  ctx.fillStyle = T.main; roundPath(ctx, -w / 2, -h / 2, w, h * 0.34, 3); ctx.fill();
  ctx.lineWidth = state === 'field' ? 2.2 : 1.2; ctx.strokeStyle = state === 'field' ? '#fff3b0' : 'rgba(40,24,8,0.8)'; roundPath(ctx, -w / 2, -h / 2, w, h, 3); ctx.stroke();
  ctx.restore();
}
function drawCardRaw(ctx, x, y, w, h, z, name, big, sub, active, team, roles) {
  panel(ctx, x, y, w, h, { r: 18, fill: active ? 'rgba(20,38,22,0.93)' : 'rgba(10,22,12,0.8)', stroke: active ? TEAM[team].hi : 'rgba(255,240,190,0.3)', lw: active ? 3 : 2, shadow: true });
  ctx.fillStyle = TEAM[team].main; roundPath(ctx, x + 8, y + 10, 8, h - 20, 4); ctx.fill();
  ctx.textBaseline = 'alphabetic';
  fitFont(ctx, String(big), 44 * z, w * 0.3, 800, NUM);
  ctx.textAlign = 'right'; ctx.fillStyle = '#ffe9a0'; ctx.fillText(String(big), x + w - 14, y + h * 0.58);
  const sw = ctx.measureText(String(big)).width;
  const np = fitFont(ctx, name, 24 * z, w - sw - 56, 700);
  ctx.textAlign = 'left'; ctx.fillStyle = active ? '#fff6dc' : 'rgba(255,246,220,0.75)'; ctx.fillText(name, x + 26, y + 12 + np * 0.95);
  if (roles) roles.forEach((st, i) => pip(ctx, x + 36 + i * 20 * Math.min(z, 1.3), y + h - 18 * Math.min(z, 1.2) - 4, team, st, Math.min(z, 1.3) * 0.95));
  else { fitFont(ctx, sub, 17 * z, w - 40, 400); ctx.fillStyle = 'rgba(255,240,200,0.75)'; ctx.fillText(sub, x + 26, y + h - 14); }
}
function drawCard(ctx, S, x, y, w, h, side, z) {
  const m = S.m, own = m.blocks.filter((b) => b.team === side && !(b.role === 'cleared' && b.id % 5 >= m.size));
  const roles = own.map((b) => (b.role === 'base' ? (b.down ? 'fallen' : 'base') : b.role)).sort((a, b) => ['base', 'field', 'fallen', 'cleared'].indexOf(a) - ['base', 'field', 'fallen', 'cleared'].indexOf(b));
  drawCardRaw(ctx, x, y, w, h, z, `${sideName(S, side)}`, totalLeft(m, side), '', m.turn === side && !m.over, side, roles);
}

// The scene -------------------------------------------------------------------------------------------------------------------------------
const bodyDims = (b) => (b.kind === 'king' ? [KING.w, KING.h] : [KUBB.w, KUBB.h]);
export function drawScene(ctx, S) {
  SC.setHost(ctx);
  SC.drawBackdrop(ctx, S.baked);
  const ov = S.overlay, items = [];
  const w = S.world;
  // ground marks first: legal targets, throw line, valid zones, aim rings
  if (ov) drawGroundOverlay(ctx, S, ov);
  else if (S.marks && S.marks.length) drawGroundOverlay(ctx, S, {});
  // shadows
  if (w) for (const b of w.bodies) {
    const ps = SC.poseOf(b, S.alpha);
    if (b.kind === 'baton') SC.drawBatonShadow(ctx, ps.p, ps.q); else { const d = bodyDims(b); SC.drawBoxShadow(ctx, ps.p, ps.q, d[0], d[1]); }
    items.push({ d: proj(ps.p[0], ps.p[1], 0).d + (b.kind === 'baton' ? 0.001 : 0), draw: () => (b.kind === 'baton' ? SC.drawBaton(ctx, ps.p, ps.q, { team: b.team }) : SC.drawBox(ctx, ps.p, ps.q, bodyDims(b)[0], bodyDims(b)[1], { team: b.team, king: b.kind === 'king' })) });
  }
  for (const f of S.fades) {
    const k = f.t / 0.6;
    const ps = { p: f.p, q: f.q };
    items.push({ d: proj(f.p[0], f.p[1], 0).d, draw: () => { ctx.save(); ctx.globalAlpha = Math.max(0, 1 - k); SC.drawBox(ctx, ps.p, ps.q, KUBB.w, KUBB.h, { team: f.team }); ctx.restore(); } });
  }
  if (S.tossAnim) {
    const a = S.tossAnim, ps = tossPose(a, S.alpha);
    SC.drawBoxShadow(ctx, ps.p, ps.q, KUBB.w, KUBB.h);
    items.push({ d: proj(ps.p[0], ps.p[1], 0).d, draw: () => { ctx.save(); if (a.fadeOut) ctx.globalAlpha = Math.max(0, 1 - a.fadeOut); SC.drawBox(ctx, ps.p, ps.q, KUBB.w, KUBB.h, { team: a.team }); ctx.restore(); } });
  }
  if (S.showPaddles) for (const pd of S.paddles) items.push({ d: proj(pd.x, pd.y, 0).d, draw: () => SC.drawPaddle(ctx, pd.x, pd.y, pd.dir, pd.team, pd.lean, pd.held, pd.scale ?? 1) });
  items.sort((a, b) => b.d - a.d);
  for (const it of items) it.draw();
  if (ov) drawAirOverlay(ctx, S, ov);
  SC.drawButterflies(ctx, S.t);
  SC.drawParts(ctx, S.parts);
}
export function tossPose(a, alpha = 1) {
  const tAll = a.t + (a.t < a.pick + a.dur + 0.5 ? Math.max(0, Math.min(1, alpha)) / 60 : 0);
  if (tAll < a.pick) {   // picked up from where it lies and carried to the thrower's hand
    const k = ease.inOut(tAll / a.pick), L = a.lie;
    return { p: [L.p[0] + (a.from.x - L.p[0]) * k, L.p[1] + (a.from.y - L.p[1]) * k, L.p[2] + (a.from.z - L.p[2]) * k + Math.sin(Math.PI * k) * 0.25], q: nlerp(L.q, [1, 0, 0, 0], k) };
  }
  const td = tAll - a.pick, k = Math.max(0, Math.min(1, td / a.dur)), x = a.from.x + (a.to.x - a.from.x) * k, y = a.from.y + (a.to.y - a.from.y) * k;
  const z = a.from.z + (0.17 - a.from.z) * k + Math.sin(Math.PI * k) * a.apex;
  const h = Math.atan2(a.to.x - a.from.x, a.to.y - a.from.y), rev = a.rev * k;
  // end over end around the horizontal axis across the throw; lands upright
  const ang = rev * TAU, ax = Math.cos(h), ay = -Math.sin(h);
  const half = ang / 2, s = Math.sin(half), q = [Math.cos(half), ax * s, ay * s, 0];
  const bounce = k >= 1 ? Math.abs(Math.sin((td - a.dur) * 14)) * Math.exp(-(td - a.dur) * 9) * 0.05 : 0;
  return { p: [x, y, z + bounce], q };
}
function drawGroundOverlay(ctx, S, ov) {
  ctx.save();
  if (ov.zone) {   // where a kubb may land or be placed
    const z = ov.zone;
    ctx.beginPath();
    const y0 = z.y0, y1 = z.y1, hw = FIELD.W / 2 - 0.05;
    const pts = [proj(-hw, y0, 0), proj(hw, y0, 0), proj(hw, y1, 0), proj(-hw, y1, 0)];
    pts.forEach((p, i) => (i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y))); ctx.closePath();
    ctx.fillStyle = 'rgba(255,248,170,0.13)'; ctx.fill(); ctx.setLineDash([10, 8]); ctx.strokeStyle = 'rgba(255,248,170,0.7)'; ctx.lineWidth = 2; ctx.stroke(); ctx.setLineDash([]);
    SC.groundRing(ctx, kingPos(S.m).x, kingPos(S.m).y, KING_RING); ctx.fillStyle = 'rgba(200,60,40,0.25)'; ctx.fill(); ctx.strokeStyle = 'rgba(255,170,150,0.8)'; ctx.stroke();
  }
  if (ov.line) {
    const pulse = 0.65 + 0.35 * Math.sin(S.t * 5);
    SC.drawLine(ctx, ov.line.y, ov.line.adv ? `rgba(255,224,120,${pulse})` : 'rgba(255,255,255,0.0)', true, ov.line.adv ? 'Advantage line' : '', LK);
  }
  if (ov.legal) for (const id of ov.legal) {
    const b = S.m.blocks[id], pulse = 0.55 + 0.45 * Math.sin(S.t * 5 + id), r = (b.kind === 'king' ? 0.3 : 0.22);
    SC.groundRing(ctx, b.x, b.y, r); ctx.strokeStyle = `rgba(255,246,150,${0.55 * pulse + 0.2})`; ctx.lineWidth = 3; ctx.stroke();
  }
  if (ov.chosen != null) {
    const b = S.m.blocks[ov.chosen]; SC.groundRing(ctx, b.x, b.y, 0.3); ctx.strokeStyle = '#7de8ff'; ctx.lineWidth = 4; ctx.stroke();
    SC.groundRing(ctx, b.x, b.y, 0.38); ctx.strokeStyle = 'rgba(125,232,255,0.5)'; ctx.lineWidth = 2; ctx.stroke();
  }
  if (ov.warn) { const pulse = 0.6 + 0.4 * Math.sin(S.t * 8); SC.groundRing(ctx, ov.warn.x, ov.warn.y, 0.3); ctx.strokeStyle = `rgba(255,120,100,${pulse})`; ctx.lineWidth = 4; ctx.stroke(); }
  for (const mk of S.marks ?? []) {
    const k = mk.t / 2.6;
    SC.groundRing(ctx, mk.x, mk.y, 0.1 + 0.18 * k); ctx.strokeStyle = `rgba(255,255,240,${0.9 * (1 - k)})`; ctx.lineWidth = 3; ctx.stroke();
  }
  for (const r of ov.rings ?? []) {
    if (r.scatter) { SC.groundEllipse(ctx, r.x, r.y, Math.max(0.05, r.scatter.across), Math.min(1.1, Math.max(0.05, r.scatter.along))); ctx.fillStyle = r.fill ?? 'rgba(255,230,120,0.16)'; ctx.fill(); ctx.setLineDash([6, 6]); ctx.strokeStyle = r.col; ctx.lineWidth = 2; ctx.stroke(); ctx.setLineDash([]); }
    SC.groundRing(ctx, r.x, r.y, r.r ?? 0.16); ctx.strokeStyle = r.col; ctx.lineWidth = 4; ctx.stroke();
    SC.groundRing(ctx, r.x, r.y, (r.r ?? 0.16) * 0.35); ctx.fillStyle = r.col; ctx.fill();
  }
  for (const mk of ov.marks ?? []) {
    const p = proj(mk.x, mk.y, 0);
    ctx.fillStyle = mk.col; ctx.font = `800 ${Math.round(p.s * 0.24)}px ${FONT}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(mk.text, p.x, p.y);
  }
  ctx.restore();
}
function drawAirOverlay(ctx, S, ov) {
  for (const path of ov.paths ?? []) {
    ctx.save(); ctx.strokeStyle = path.col; ctx.lineWidth = 3; ctx.lineCap = 'round'; ctx.setLineDash([2, 9]);
    ctx.beginPath(); path.pts.forEach((p, i) => { const q = proj(p.x, p.y, p.z + 0.06); i ? ctx.lineTo(q.x, q.y) : ctx.moveTo(q.x, q.y); }); ctx.stroke(); ctx.setLineDash([]);
    ctx.restore();
  }
  for (const lb of ov.labels ?? []) {
    const p = proj(lb.x, lb.y, lb.z ?? 0), s = Math.round(21 * LK);
    ctx.save(); ctx.font = `800 ${s}px ${FONT}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    const tw = ctx.measureText(lb.text).width + 18, dy = lb.below ? s * 1.6 + 6 : 0;   // below the ring for far targets so it never leaves the picture
    roundPath(ctx, p.x - tw / 2, p.y - s * 0.8 - 8 + dy, tw, s * 1.4, 10); ctx.fillStyle = 'rgba(10,24,12,0.82)'; ctx.fill();
    ctx.fillStyle = lb.col ?? '#fff3b0'; ctx.fillText(lb.text, p.x, p.y - s * 0.1 - 8 + dy); ctx.restore();
  }
}

function drawBanner(ctx, S, lay) {
  const b = S.banner;
  if (!b) return;
  const k = Math.min(1, b.t / 0.28), e = ease.outBack(k), fade = b.dur - b.t < 0.3 ? Math.max(0, (b.dur - b.t) / 0.3) : 1;
  const z = lay.z, cy = lay.vy + (lay.compact ? 240 : 250) * lay.s;
  ctx.save();
  ctx.globalAlpha = fade;
  const pw = lay.bannerW, size = Math.round((b.size ?? 72) * Math.min(1.3, 0.85 + z * 0.2));
  const px = fitFont(ctx, b.text, size, pw - 60, 800, NUM);
  const subSize = Math.round(26 * Math.min(z, 2.2));
  ctx.font = `400 ${subSize}px ${FONT}`;
  const subLines = b.sub ? wrapLines(ctx, b.sub, pw - 60) : [];
  const ph = px * 1.3 + subLines.length * subSize * 1.25 + 34;
  ctx.translate(lay.cx, cy); ctx.scale(0.8 + 0.2 * e, 0.8 + 0.2 * e);
  roundPath(ctx, -pw / 2, -ph / 2, pw, ph, 26); ctx.fillStyle = 'rgba(10,24,14,0.92)'; ctx.fill();
  ctx.lineWidth = 3; ctx.strokeStyle = b.kind === 'bad' ? '#e58a78' : b.kind === 'team1' ? TEAM[1].hi : b.kind === 'team0' ? TEAM[0].hi : '#f1d27a'; ctx.stroke();
  ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
  ctx.font = `800 ${px}px ${NUM}`; ctx.fillStyle = b.kind === 'bad' ? '#ffb4a0' : '#ffe8a0';
  ctx.fillText(b.text, 0, -ph / 2 + 20 + px * 0.9);
  ctx.font = `400 ${subSize}px ${FONT}`; ctx.fillStyle = '#fff6dc';
  subLines.forEach((l, i) => ctx.fillText(l, 0, -ph / 2 + 20 + px * 1.25 + subSize * (1 + i * 1.25)));
  ctx.restore();
}

function drawHud(ctx, S, lay) {
  if (lay.wide) { drawWidePanels(ctx, S, lay); return; }
  const hud = lay.hud, m = S.m;
  const g = ctx.createLinearGradient(0, 0, 0, hud.h + 30);
  g.addColorStop(0, 'rgba(6,16,8,0.6)'); g.addColorStop(0.75, 'rgba(6,16,8,0.32)'); g.addColorStop(1, 'rgba(6,16,8,0)');
  ctx.fillStyle = g; ctx.fillRect(0, 0, W, hud.h + 30);
  ctx.textBaseline = 'alphabetic';
  if (hud.compact) {
    if (m.cfg.mode === 'learn') {
      drawCardRaw(ctx, 14, hud.y, 344, hud.cardH, hud.z, 'Batons left', m.batons - m.baton, `Lesson ${m.lesson.idx + 1} of 4`, true, 0, null);
      drawCardRaw(ctx, 362, hud.y, 344, hud.cardH, hud.z, 'Goal', m.lesson.goalShort, m.lesson.goalText, false, 1, null);
    } else { drawCard(ctx, S, 14, hud.y, 344, hud.cardH, 0, hud.z); drawCard(ctx, S, 362, hud.y, 344, hud.cardH, 1, hud.z); }
    ctx.textAlign = 'center';
    const line = phaseLine(S);
    if (hud.strip) {   // the host's back button sits top left: the phase line goes in the strip beside it
      const st = hud.strip; fitFont(ctx, line, hud.fs, st.w, 400);
      textShadow(ctx, line, st.x + st.w / 2, st.y + st.h / 2 + hud.fs * 0.35, '#fff6dc', 6);
    } else {
      fitFont(ctx, line, hud.fs, W - 40, 400);
      textShadow(ctx, line, W / 2, hud.y + hud.cardH + 8 + hud.fs, '#fff6dc', 6);
    }
  } else {
    let y = hud.y;
    ctx.textAlign = 'left';
    hud.lines.forEach((l) => { ctx.font = `${l.bold ? 700 : 400} ${hud.fs}px ${FONT}`; textShadow(ctx, l.text, 36, y + hud.fs, l.active ? '#ffe08a' : '#fff6dc', 6); y += hud.fs * 1.22; });
  }
}
// Landscape: two quiet panels either side of the lawn.
function drawWidePanels(ctx, S, lay) {
  const m = S.m, z = lay.z;
  for (const p of [lay.L, lay.Rp]) panel(ctx, p.x, p.y, p.w, p.h, { r: 22, fill: 'rgba(7,18,10,0.94)', stroke: 'rgba(255,232,150,0.32)', lw: 2, shadow: false });
  // hairlines where the lawn window meets the panels
  ctx.save(); ctx.strokeStyle = 'rgba(255,232,150,0.22)'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(lay.win.x, 0); ctx.lineTo(lay.win.x, H); ctx.moveTo(lay.win.x + lay.win.w, 0); ctx.lineTo(lay.win.x + lay.win.w, H); ctx.stroke(); ctx.restore();
  const [c0, c1] = lay.cards;
  if (m.cfg.mode === 'learn') {
    drawCardRaw(ctx, c0.x, c0.y, c0.w, c0.h, z, 'Batons left', m.batons - m.baton, `Lesson ${m.lesson.idx + 1} of 4`, true, 0, null);
    drawCardRaw(ctx, c1.x, c1.y, c1.w, c1.h, z, 'Goal', m.lesson.goalShort, m.lesson.goalText, false, 1, null);
  } else { drawCard(ctx, S, c0.x, c0.y, c0.w, c0.h, 0, z); drawCard(ctx, S, c1.x, c1.y, c1.w, c1.h, 1, z); }
  const ph = lay.phase;
  ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic'; ctx.font = `400 ${ph.fs}px ${FONT}`;
  ph.lines.forEach((l, k) => textShadow(ctx, l, ph.x, ph.y + ph.fs * (1 + k * 1.25) - 4, '#fff6dc', 4));
  const st = lay.status;
  if (st) {
    const r = st.rect;
    roundPath(ctx, r.x, r.y, r.w, r.h, 14); ctx.fillStyle = 'rgba(14,34,22,0.9)'; ctx.fill(); ctx.strokeStyle = 'rgba(125,232,255,0.45)'; ctx.lineWidth = 2; ctx.stroke();
    ctx.fillStyle = '#e8fbff'; ctx.textAlign = 'left'; ctx.font = `400 ${st.fs}px ${FONT}`;
    st.lines.forEach((l, i) => ctx.fillText(l, r.x + 12, r.y + 8 + st.fs * (1 + i * 1.25) - 4));
    if (st.more) { ctx.font = `700 ${st.mfs}px ${FONT}`; ctx.fillStyle = '#7de8ff'; ctx.fillText('Tap here to read it all', r.x + 12, r.y + 8 + st.fs * (1 + st.lines.length * 1.25) - 4 + st.mfs * 0.1); }
  }
  if (lay.busy) { ctx.font = `700 ${Math.round(FLOOR.v * 1.05)}px ${FONT}`; ctx.fillStyle = '#bff3ff'; ctx.textAlign = 'center'; ctx.fillText('Testing throws...', lay.busy.x, lay.busy.y); }
  if (lay.labels) {
    const lb = lay.labels; ctx.font = `800 ${lb.fs}px ${FONT}`; ctx.fillStyle = '#ffe9a8'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText('Loft', lb.lx, lb.y); ctx.fillText('Spin', lb.rx, lb.y);
  }
}
function drawTrayText(ctx, lay) {
  const t = lay.tray;
  ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
  t.lines.forEach((l, i) => { ctx.font = `400 ${t.fs}px ${FONT}`; textShadow(ctx, l, W / 2, lay.trayTop + 16 + t.fs * (1 + i * 1.22), '#fff6dc', 6); });
  if (t.more) { ctx.font = `700 ${t.mfs}px ${FONT}`; textShadow(ctx, 'Tap here to read it all', W / 2, lay.trayTop + 16 + t.fs * (1 + t.lines.length * 1.22) + t.mfs * 0.2, '#7de8ff', 6); }
}
function drawSelector(ctx, r, label, active, z) {
  const size = Math.max(Math.round(24 * Math.min(z, COMPACT)), Math.ceil(FLOOR.v));
  drawButton(ctx, r, label, { active, dark: !active, size });
}
function drawTray(ctx, S, lay) {
  const R = lay.rects, z = lay.z, m = S.m, ph = S.ph, P = lay.geo, wide = lay.wide;
  const bar = ctx.createLinearGradient(0, lay.trayTop - 24, 0, H);
  bar.addColorStop(0, 'rgba(6,16,8,0)'); bar.addColorStop(0.2, 'rgba(6,16,8,0.82)'); bar.addColorStop(1, 'rgba(6,16,8,0.96)');
  const size = Math.round(26 * Math.min(z, 3));
  const btn = (id, label, o = {}) => { if (R[id]) drawButton(ctx, R[id], label, { size, ...o }); };
  if (m.cfg.mode === 'watch') {
    if (!wide) { ctx.fillStyle = bar; ctx.fillRect(0, (lay.compact ? P.loftY - 8 : lay.trayTop) - 24, W, H); if (!lay.compact) drawTrayText(ctx, lay); }
    const big = !lay.compact;
    const wsz = Math.max(Math.round(size * 0.85), Math.ceil(FLOOR.v));
    btn('wdec', big ? '\u2212' : 'Faster', { dark: true, disabled: S.settings.thinkIdx === 0, size: big ? size : wsz });
    btn('winc', big ? '+' : 'Slower', { dark: true, disabled: S.settings.thinkIdx === 3, size: big ? size : wsz });
    if (R.wlabel) { const r = R.wlabel, txt = big ? `Think ${S.thinkSecs} s` : wide ? `Think time ${S.thinkSecs} s` : `Thinking time ${S.thinkSecs} s`; ctx.fillStyle = '#ffe9bf'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; fitFont(ctx, txt, Math.round(24 * z), r.w - 8, 700); ctx.fillText(txt, r.x + r.w / 2, r.y + r.h / 2); }
    btn('wpause', S.paused ? 'Resume' : 'Pause', { primary: true });
    btn('wexit', 'Exit', { dark: true });
    return;
  }
  if (lay.compact) {
    if (!wide) {
      if (R.loft0) { ctx.fillStyle = bar; ctx.fillRect(0, P.loftY - 32, W, H); }
      else if (lay.status || R.skip) { ctx.fillStyle = bar; ctx.fillRect(0, P.skipY - 38, W, H - P.skipY + 38); }
    }
    if (R.loft0) {
      LOFTS.forEach((l, i) => drawSelector(ctx, R[`loft${i}`], wide ? l.name : `${l.name} loft`, S.plan.loft === i, z));
      SPINS.forEach((l, i) => drawSelector(ctx, R[`spin${i}`], wide ? l.name : `${l.name} spin`, S.plan.spin === i, z));
      btn('left', '\u25c4', { dark: true, size: 30 }); btn('right', '\u25ba', { dark: true, size: 30 });
    }
    const tsz = Math.max(Math.round(24 * Math.min(z, COMPACT)), Math.ceil(FLOOR.v));
    btn('think', S.hint && S.hint.busy ? 'Testing...' : S.hint ? 'Hide tip' : 'Think', { dark: true, size: tsz });
    btn('menu', 'Menu', { dark: true, size: Math.max(Math.round(22 * z), Math.ceil(FLOOR.v)) });
    btn('skip', ph === 'flight' ? 'Skip ahead' : 'Next', { dark: true, size: tsz });
    if (wide && R.use) btn('use', 'Use this throw', { primary: true, size: tsz });
    return;
  }
  ctx.fillStyle = bar; ctx.fillRect(0, lay.trayTop - 24, W, H - lay.trayTop + 24);
  drawTrayText(ctx, lay);
  btn('setup', 'Set up the throw', { primary: true }); btn('think', 'Think', { dark: true });
  btn('skip', 'Skip', { dark: true }); btn('menu', 'Menu', { dark: true });
}

export function renderPlay(ctx, S) {
  const lay = computeLayout(S, ctx);
  LK = Math.max(Math.min(Math.min(lay.z, 2) / lay.s, 3.2), FLOOR.v / (18 * lay.s));
  ctx.fillStyle = '#0a120a'; ctx.fillRect(0, 0, W, H);
  ctx.save();
  if (lay.clip) { ctx.beginPath(); ctx.rect(lay.clip.x, lay.clip.y, lay.clip.w, lay.clip.h); ctx.clip(); }
  ctx.translate(lay.vx, lay.vy - SCENE_Y0 * lay.s); ctx.scale(lay.s, lay.s);
  drawScene(ctx, S);
  ctx.restore();
  drawPull(ctx, S, lay);
  drawHud(ctx, S, lay);
  drawTray(ctx, S, lay);
  drawStatus(ctx, S, lay);
  if (!(S.m.cfg.mode === 'learn' && S.ph === 'intro')) drawBanner(ctx, S, lay);
  if (S.toastT > 0 && S.toast) {
    const zz = Math.min(lay.z, 2);
    ctx.font = `700 ${Math.max(Math.round(22 * zz), Math.ceil(FLOOR.v))}px ${FONT}`; const tw = Math.min(lay.wide ? lay.win.w - 20 : 660, ctx.measureText(S.toast).width + 44);
    roundPath(ctx, lay.cx - tw / 2, lay.toastY, tw, 54 * zz, 16); ctx.fillStyle = 'rgba(10,24,14,0.94)'; ctx.fill();
    ctx.fillStyle = '#ffe9bf'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(S.toast, lay.cx, lay.toastY + 27 * zz);
  }
}
// The slingshot: a line from where the finger went down to where it is now, with a ring marking the spot that cancels the throw.
function drawPull(ctx, S) {
  const d = S.drag;
  if (!d || d.kind !== 'pull' || S.ph !== 'aim') return;
  ctx.save();
  ctx.lineCap = 'round';
  ctx.beginPath(); ctx.arc(d.x0, d.y0, 36, 0, TAU); ctx.setLineDash([6, 6]); ctx.strokeStyle = d.len < 36 ? 'rgba(255,200,170,0.9)' : 'rgba(255,255,255,0.35)'; ctx.lineWidth = 3; ctx.stroke(); ctx.setLineDash([]);
  if (d.len >= 18) {
    ctx.strokeStyle = 'rgba(255,240,170,0.9)'; ctx.lineWidth = 6; ctx.beginPath(); ctx.moveTo(d.x0, d.y0); ctx.lineTo(d.x, d.y); ctx.stroke();
    ctx.fillStyle = d.len >= 36 ? '#ffe08a' : '#ffb9a0'; ctx.beginPath(); ctx.arc(d.x, d.y, 15, 0, TAU); ctx.fill(); ctx.strokeStyle = 'rgba(40,24,6,0.8)'; ctx.lineWidth = 3; ctx.stroke();
    ctx.font = `800 ${Math.round(20 * Math.min(S.settings.textIdx ? TEXT_SCALES[S.settings.textIdx] : 1, 2))}px ${FONT}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillStyle = 'rgba(255,248,220,0.95)';
    ctx.fillText(d.len >= 36 ? 'Let go to throw' : 'Pull back more, or let go to cancel', d.x0, d.y0 - 52);
  }
  ctx.restore();
}
function drawLessonIntro(ctx, S, lay) {
  const L = S.m.lesson, z = lay.z, fs = Math.max(Math.round(26 * Math.min(z, 2)), Math.ceil(FLOOR.v));
  const pw = lay.wide ? Math.min(640, lay.win.w - 24) : 640, cx = lay.cx;
  ctx.font = `400 ${fs}px ${FONT}`;
  const lines = wrapLines(ctx, L.text, pw - 60);
  const tfs = fitFont(ctx, `Lesson ${L.idx + 1}: ${L.title}`, Math.round(38 * Math.min(z, 2)), pw - 50, 800, NUM);
  ctx.font = `400 ${fs}px ${FONT}`;
  const h = Math.min(H - 120, 120 + tfs + lines.length * fs * 1.3), y = Math.max(40, (H - h) / 2);
  panel(ctx, cx - pw / 2, y, pw, h, { r: 26, fill: 'rgba(8,20,10,0.97)', stroke: '#f1d27a' });
  ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
  ctx.font = `800 ${tfs}px ${NUM}`; ctx.fillStyle = '#ffe08a'; ctx.fillText(`Lesson ${L.idx + 1}: ${L.title}`, cx, y + 24 + tfs);
  ctx.font = `400 ${fs}px ${FONT}`; ctx.fillStyle = '#fff6dc';
  lines.forEach((l, i) => ctx.fillText(l, cx, y + 40 + tfs + fs * (1 + i * 1.3)));
  ctx.font = `700 ${Math.max(Math.round(22 * Math.min(z, 2)), Math.ceil(FLOOR.v))}px ${FONT}`; ctx.fillStyle = '#bfe8ff'; ctx.fillText('Tap to start', cx, y + h - 20);
}
function drawStatus(ctx, S, lay) {
  if (S.m.cfg.mode === 'learn' && S.ph === 'intro') { drawLessonIntro(ctx, S, lay); return; }
  if (!lay.compact || lay.wide) return;
  if ((S.ph === 'aim' || S.ph === 'toss') && S.hint && !S.hint.busy) {
    const g = hintGeom(S, lay);
    roundPath(ctx, 24, g.y, W - 48, g.h, 18); ctx.fillStyle = 'rgba(8,18,10,0.94)'; ctx.fill();
    ctx.strokeStyle = 'rgba(125,232,255,0.6)'; ctx.lineWidth = 2; ctx.stroke();
    ctx.font = `400 ${g.fs}px ${FONT}`; ctx.fillStyle = '#e8fbff'; ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
    g.lines.forEach((l, i) => ctx.fillText(l, W / 2, g.y + 16 + g.fs * (1 + i * 1.25) - 4));
    drawButton(ctx, g.use, 'Use this throw', { primary: true, size: Math.max(24, Math.ceil(FLOOR.v)) });
    return;
  }
  if ((S.ph === 'aim' || S.ph === 'toss') && S.hint && S.hint.busy) {
    ctx.font = `700 ${Math.max(22, Math.ceil(FLOOR.v))}px ${FONT}`; ctx.fillStyle = '#bff3ff'; ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
    ctx.fillText('Testing throws on the real lawn...', W / 2, S.m.turn === 0 ? lay.geo.arrowY - 36 : lay.hud.h + 100); return;
  }
  const st = lay.status;
  if (!st) return;
  const { fs, lines, y, h } = st;
  roundPath(ctx, 24, y, W - 48, h, 16); ctx.fillStyle = 'rgba(8,18,10,0.88)'; ctx.fill();
  ctx.strokeStyle = 'rgba(125,232,255,0.5)'; ctx.lineWidth = 2; ctx.stroke();
  ctx.fillStyle = '#e8fbff'; ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic'; ctx.font = `400 ${fs}px ${FONT}`;
  lines.forEach((l, i) => ctx.fillText(l, W / 2, y + 12 + fs * (1 + i * 1.25) - 4));
  if (st.more) { ctx.font = `700 ${st.mfs}px ${FONT}`; ctx.fillStyle = '#7de8ff'; ctx.fillText('Tap here to read it all', W / 2, y + 12 + fs * (1 + lines.length * 1.25) - 4 + st.mfs * 0.1); }
}
export { toScene, C, targets };
