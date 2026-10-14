// All drawing. Reads the game state and the layout; never changes game state (apart from the scroll metrics it reports back).
import { playLayout, titleLayout, docLayout, settingsLayout, listLayout, journeyRects, freeRects, overLayout, pauseLayout, centerCard, TEXT_SCALES, host, R, clamp, grid } from './layout.js';
import { theme, LOOKS, LOOK_IDS, background, panel, plate, button, rr, txt, para, paraHeight, wrap, F, mix, rgba, icons, UI, NUM } from './ui.js';
import { setBrandTone, drawCredit, drawMoreLine, edgeStroke, drawBadgeStack } from './brand.js';
import { RULES, RULE_IDS } from './engine.js';
import { itemsOn, keysOf, totals, canPour, overshoot } from './play.js';
import { DOCS, CHAPTERS, TIERS, RULE_TEXT, RULE_TITLE, FACTS } from './content.js';
import { v3 } from './v3.js';
import { drawWeight, drawBag, drawDust, drawBalance, balanceGeo, drawMini, slotPos, hash, TAU } from './weights.js';

export const metrics = { max: 0, view: 0, rect: null };   // scroll body of the current screen, filled in each frame
export const SETTINGS = [
  { id: 'look', label: 'Look', opts: LOOK_IDS.map((k) => LOOKS[k].name) },
  { id: 'totals', label: 'Pan totals', opts: ['Show', 'Hide'] },
  { id: 'lefty', label: 'Tray side', opts: ['Right', 'Left'] },
  { id: 'sound', label: 'Sound', opts: ['On', 'Off'] },
  { id: 'calm', label: 'Calm motion', opts: ['Off', 'On'] },
  { id: 'restore', label: 'Purchases', opts: ['Restore'] },
];
// The Purchases row is hidden in the web demo (nothing can be bought there).
export const settingRows = (s) => (s.demo ? SETTINGS.filter((r) => r.id !== 'restore') : SETTINGS);
export const restoreLabel = (s) => (s.owned ? 'Full game unlocked' : s.restore?.busy ? 'Checking...' : 'Restore purchase');
export const settingIndex = (s, id) => {
  const p = s.prefs;
  switch (id) {
    case 'look': return LOOK_IDS.indexOf(p.look);
    case 'totals': return p.totals ? 0 : 1;
    case 'lefty': return p.lefty ? 1 : 0;
    case 'sound': return p.sound ? 0 : 1;
    case 'calm': return p.calm ? 1 : 0;
    default: return -1;
  }
};
const scaleOf = (s) => TEXT_SCALES[s.prefs.textIdx] ?? 1;
const smooth = (t) => t * t * (3 - 2 * t);
const flashOf = (s, id) => (s.flash && s.flash.id === id ? Math.max(0, 1 - s.flash.t / 0.2) : 0);

export function render(ctx, s, view) {
  const w = view.width, h = view.height, T = theme();
  background(ctx, w, h, s.prefs.calm ? 0 : s.t);
  metrics.max = 0; metrics.rect = null;
  const sc = s.scene;
  if (sc === 'title') drawTitle(ctx, s, w, h);
  else if (sc === 'play') drawPlay(ctx, s, w, h);
  else if (sc === 'journey') drawJourney(ctx, s, w, h);
  else if (sc === 'free') drawFree(ctx, s, w, h);
  else if (sc === 'doc') drawDoc(ctx, s, w, h);
  else if (sc === 'settings') drawSettings(ctx, s, w, h);
  else if (sc === 'stats') drawStats(ctx, s, w, h);
  else if (sc === 'over') drawOver(ctx, s, w, h);
  else if (sc === 'demo-limit') drawDemoLimit(ctx, s, w, h);
  if (s.sceneT < 0.25 && sc !== 'play') { ctx.fillStyle = rgba(T.bg1, 1 - smooth(s.sceneT / 0.25)); ctx.fillRect(0, 0, w, h); }
}

// ================================================================ the scene ===============================================================
// The numbers the scene shows right now (they follow the pour animation).
export function shownModel(s) {
  const P = s.P, po = s.pour;
  let dust = 0, bagShown = P.bag;
  if (po) {
    const e1 = smooth(clamp(po.t / po.dur1, 0, 1)), e2 = smooth(clamp((po.t - po.dur1) / po.dur2, 0, 1));
    dust = po.d * (po.t < po.dur1 ? e1 : 1 - e2);
    bagShown = po.before + (po.t < po.dur1 ? 0 : po.d * e2);
  }
  const R0 = RULES[P.order.rule], tot = totals({ ...P, bag: bagShown });
  const left = tot.left + dust, right = tot.right;
  return { dust, bagShown, left, right, rule: R0 };
}
export function beamTarget(m) {
  const diff = m.left - m.right, mx = Math.max(m.left, m.right, 1);
  return clamp(diff / (0.35 * mx + 1.5), -1, 1) * 0.2;
}

function drawSpout(ctx, G, k, t) {
  if (v3.on) { const b = v3.balances[v3.balances.length - 1]; if (b) b.spout = k; return; }
  // a brass ladle above the left pan, tilted while pouring, with a thin stream of grains
  const x = G.L.x, y = G.rect.y + G.chain * 0.22, tilt = 0.9 * k;
  ctx.save(); ctx.translate(x + G.dw * 0.25, y); ctx.rotate(-0.25 - tilt * 0.6);
  ctx.beginPath(); ctx.moveTo(-G.dw * 0.5, 0); ctx.quadraticCurveTo(-G.dw * 0.5, G.dw * 0.38, 0, G.dw * 0.3); ctx.quadraticCurveTo(G.dw * 0.2, G.dw * 0.22, G.dw * 0.18, 0); ctx.closePath();
  const b = theme().brass, g = ctx.createLinearGradient(-G.dw * 0.5, 0, G.dw * 0.2, G.dw * 0.3); g.addColorStop(0, b[0]); g.addColorStop(0.5, b[1]); g.addColorStop(1, b[2]);
  ctx.fillStyle = g; ctx.fill(); ctx.lineWidth = 2; ctx.strokeStyle = mix(b[2], '#000000', 0.4); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(G.dw * 0.15, G.dw * 0.05); ctx.lineTo(G.dw * 0.95, -G.dw * 0.45); ctx.lineWidth = Math.max(4, G.dw * 0.07); ctx.lineCap = 'round'; ctx.strokeStyle = b[1]; ctx.stroke();
  ctx.restore();
  if (k > 0.05) {
    const top = y + G.dw * 0.28, bot = G.L.y - G.dw * 0.05;
    for (let i = 0; i < 16; i++) {
      const ph = ((t * 2.2 + i / 16) % 1), yy = top + (bot - top) * ph, xx = x - G.dw * 0.06 + (hash(i, 3) - 0.5) * G.dw * 0.12;
      ctx.fillStyle = i % 3 ? '#f6c548' : '#fff6b8'; ctx.globalAlpha = k;
      ctx.beginPath(); ctx.arc(xx, yy, Math.max(1.6, G.dw * 0.022), 0, TAU); ctx.fill();
    }
    ctx.globalAlpha = 1;
  }
}

function drawScene(ctx, s, L) {
  const T = theme(), P = s.P, G = balanceGeo(L.scene, s.beam.ang), m = shownModel(s);
  const pr = rgba('#000000', T.dark ? 0.2 : 0.07);
  if (!v3.on) {
    rr(ctx, L.scene.x, L.scene.y, L.scene.w, L.scene.h, 26); ctx.fillStyle = pr; ctx.fill();
    ctx.lineWidth = 1.5; ctx.strokeStyle = T.line; ctx.stroke();
  }
  ctx.save(); if (!v3.on) { rr(ctx, L.scene.x, L.scene.y, L.scene.w, L.scene.h, 26); ctx.clip(); }
  const items = { left: itemsOn(P, 'left'), right: itemsOn(P, 'right') };
  const glow = {};
  if (s.hint && s.hint.move) { const pulse = 0.55 + 0.45 * Math.sin(s.t * 5); s.hint.keys.forEach((k) => { glow[k] = pulse; }); }
  if (s.auto.on && s.auto.keys) s.auto.keys.forEach((k) => { glow[k] = 0.7; });
  const dragSide = s.drag ? s.drag.hot : null;
  const lvl = Math.abs(m.left - m.right) < 0.01 && (m.left > 0 || m.right > 0);
  drawBalance(ctx, G, { t: s.t, calm: s.prefs.calm, items, dust: m.dust, bagShown: m.bagShown, bagFill: P.order.target ? P.bag / P.order.target : 0, hot: dragSide, skip: s.drag ? s.drag.key : null, glow, level: lvl, chips: s.prefs.totals ? { left: Math.round(m.left), right: Math.round(m.right) } : null });
  if (s.pour) { const po = s.pour; drawSpout(ctx, G, po.t < po.dur1 ? 1 : Math.max(0, 1 - (po.t - po.dur1) / 0.2), s.t); }
  else drawSpout(ctx, G, 0, s.t);
  ctx.restore();
  return G;
}
const roundN = (v) => Math.round(v * 10) / 10;

// ================================================================ play screen ============================================================
function drawPlay(ctx, s, w, h) {
  const P = s.P, keys = keysOf(P);
  const L = playLayout(w, h, { n: keys.length, coach: !!(s.hint || s.auto.on), lefty: s.prefs.lefty });
  const G = drawScene(ctx, s, L);
  drawInfo(ctx, s, L);
  if (L.strip.h > 0) drawStrip(ctx, s, L);
  drawTray(ctx, s, L, keys);
  if (s.paused) drawPaused(ctx, s, L);
  else if (s.auto.on) drawAutoControls(ctx, s, L);
  else if (s.hint) drawCoach(ctx, s, L);
  else drawControls(ctx, s, L);
  if (s.drag && !s.paused) {
    const sz = G.item * 1.05, y = s.drag.y + sz * 0.5;
    if (s.drag.key === 'bag') drawBag(ctx, s.drag.x, y, sz * 1.05, s.P.bag, { lift: 1, glow: 0.6, fill: P.bag / P.order.target, z: 2 });
    else drawWeight(ctx, s.drag.x, y, sz, s.drag.key, { lift: 1, glow: 0.6, z: 2 });
  }
  if (s.winT > 0) drawWinBanner(ctx, s, L);
  drawMsg(ctx, s, L);
}

function drawInfo(ctx, s, L) {
  const T = theme(), P = s.P, hud = L.hud;
  const rule = P.order.rule;
  let title = s.auto.on ? 'Watch and Learn' : P.kind === 'daily' ? 'Daily Order' : RULE_TITLE[rule];
  let sub = RULE_TEXT[rule];
  if (P.kind === 'journey' && !s.auto.on) { const [ci, i] = P.ref.split(':').map(Number); title = CHAPTERS[ci].name; sub = `Order ${i + 1} of ${CHAPTERS[ci].count}  ·  ${RULE_TEXT[rule]}`; }
  if (L.mode === 'portrait') {
    txt(ctx, title, hud.title.x, hud.title.y + 26, { size: F(36), weight: 400, color: T.text, maxW: L.U.w * 0.6, min: 18, fam: NUM });
    txt(ctx, sub, hud.title.x, hud.title.y + 62, { size: F(21), weight: 500, color: T.accent, maxW: L.U.w * 0.62, min: 12 });
    button(ctx, L.pause, '', { icon: 'pause', size: 28, radius: 20, flash: flashOf(s, 'pause') });
    return;
  }
  const r = L.info;
  panel(ctx, r, { radius: 26 });
  edgeStroke(ctx, r, 26, 0.35);
  txt(ctx, title, hud.title.x, hud.title.y + 26, { size: F(32), weight: 400, color: T.text, maxW: r.w - 120, min: 16, fam: NUM });
  if (L.shortCoach) sub = `Order ${P.order.target}  ·  bag ${P.bag}  ·  weighings ${P.pours}`;
  txt(ctx, sub, hud.title.x, hud.title.y + 62, { size: F(20), weight: 500, color: T.accent, maxW: r.w - 120, min: 12 });
  button(ctx, L.pause, '', { icon: 'pause', size: 28, radius: 20, flash: flashOf(s, 'pause') });
}

// The order slip: the amount asked for, how full the bag is, the weighings used.
function drawStrip(ctx, s, L) {
  const T = theme(), P = s.P, r = L.strip, tg = P.order.target, m = shownModel(s), over = m.bagShown > tg;
  if (!plate(ctx, r, 20, { kind: 'slip' })) { rr(ctx, r.x, r.y, r.w, r.h, 20); ctx.fillStyle = T.dark ? 'rgba(0,0,0,0.3)' : 'rgba(255,255,255,0.45)'; ctx.fill(); ctx.lineWidth = 1.5; ctx.strokeStyle = rgba(T.rim, 0.6); ctx.stroke(); }
  const pad = 14, narrow = r.w < 600, need = tg - Math.round(m.bagShown);
  const note = over ? `Over by ${-need}` : need === 0 ? 'Exactly the order' : `${need} still to pour`;
  const bar = (bx, bw, by, bhh, bagS, baseY) => {
    drawBag(ctx, bx + bagS * 0.5, baseY, bagS, Math.round(m.bagShown), { fill: tg ? m.bagShown / tg : 0, shadow: false, stand: false });
    const barX = bx + bagS + 10, barW = Math.max(30, bw - bagS - 10);
    rr(ctx, barX, by, barW, bhh, bhh / 2); ctx.fillStyle = 'rgba(0,0,0,0.4)'; ctx.fill();
    const fillW = barW * clamp(m.bagShown / Math.max(1, tg), 0, 1);
    if (fillW > 2) { rr(ctx, barX, by, Math.max(bhh, fillW), bhh, bhh / 2); const g = ctx.createLinearGradient(barX, 0, barX + barW, 0); g.addColorStop(0, '#f6c548'); g.addColorStop(1, over ? T.err : '#fff0a0'); ctx.fillStyle = g; ctx.fill(); }
    ctx.lineWidth = 1.5; rr(ctx, barX, by, barW, bhh, bhh / 2); ctx.strokeStyle = rgba(T.rim, 0.5); ctx.stroke();
    txt(ctx, note, barX, by - bhh * 0.85, { size: F(18), weight: 600, color: over ? T.err : T.text, maxW: barW, min: 11 });
  };
  if (!narrow) {
    const bw = Math.min(r.w * 0.27, 150), wb = Math.min(r.w * 0.27, 150), bx = r.x + pad + bw + 8, ex = r.x + r.w - pad - wb - 8, bagS = r.h * 0.74, barH = Math.max(14, r.h * 0.26);
    txt(ctx, 'ORDER', r.x + pad, r.y + 17, { size: F(15), weight: 600, color: T.dim, maxW: bw });
    txt(ctx, String(tg), r.x + pad, r.y + r.h * 0.62, { size: F(r.h * 0.52), weight: 400, color: T.accent, maxW: bw, min: 20, fam: NUM });
    bar(bx, ex - bx, r.y + r.h / 2 + r.h * 0.04, barH, bagS, r.y + r.h - 6);
    txt(ctx, 'WEIGHINGS', ex + wb / 2 + 8, r.y + 17, { size: F(15), weight: 600, color: T.dim, align: 'center', maxW: wb });
    txt(ctx, String(P.pours), ex + 8 + wb * 0.32, r.y + r.h * 0.62, { size: F(r.h * 0.46), weight: 400, color: T.text, align: 'center', fam: NUM });
    txt(ctx, `par ${P.order.par}`, ex + 8 + wb * 0.76, r.y + r.h * 0.64, { size: F(20), weight: 600, color: T.dim, align: 'center', maxW: wb * 0.5, min: 11 });
    return;
  }
  // narrow (landscape side panel): order and weighings on the top row, bag and bar on the lower row (no overlaps at any slip height)
  const topH = Math.round(r.h * 0.5), numS = Math.min(36, topH * 0.55), numY = r.y + 16 + (topH - 16) * 0.58;
  txt(ctx, 'ORDER', r.x + pad, r.y + 14, { size: F(15), weight: 600, color: T.dim });
  txt(ctx, String(tg), r.x + pad, numY, { size: F(numS), weight: 400, color: T.accent, maxW: r.w * 0.3, min: 16, fam: NUM });
  txt(ctx, 'WEIGHINGS', r.x + r.w - pad, r.y + 14, { size: F(15), weight: 600, color: T.dim, align: 'right' });
  txt(ctx, `par ${P.order.par}`, r.x + r.w - pad, numY, { size: F(20), weight: 600, color: T.dim, align: 'right', maxW: r.w * 0.2, min: 11 });
  txt(ctx, `${P.pours}`, r.x + r.w - pad - r.w * 0.22, numY, { size: F(numS), weight: 400, color: T.text, align: 'right', fam: NUM });
  const lowH = r.h - topH, bagS = Math.min(lowH * 0.8, 52), bhh = Math.max(12, Math.min(16, lowH * 0.22));
  bar(r.x + pad, r.w - 2 * pad, r.y + topH + lowH * 0.58, bhh, bagS, r.y + r.h - 8);
}

function drawTray(ctx, s, L, keys) {
  const T = theme(), P = s.P, tr = L.tray, hint = s.hint;
  const pad = 12, bgR = R(tr.rect.x - pad, tr.rect.y - pad * 0.8, tr.rect.w + pad * 2, tr.rect.h + pad * 1.6);
  if (!plate(ctx, bgR, 22, { kind: 'tray' })) {
    rr(ctx, bgR.x, bgR.y, bgR.w, bgR.h, 22);
    const g = ctx.createLinearGradient(0, bgR.y, 0, bgR.y + bgR.h); g.addColorStop(0, T.wood[0]); g.addColorStop(1, T.wood[1]);
    ctx.fillStyle = g; ctx.fill(); ctx.lineWidth = 2; ctx.strokeStyle = rgba(T.rim, 0.55); ctx.stroke();
    const inner = R(bgR.x + 7, bgR.y + 7, bgR.w - 14, bgR.h - 14);
    rr(ctx, inner.x, inner.y, inner.w, inner.h, 16); ctx.fillStyle = T.tray; ctx.fill();
  }
  keys.forEach((k, i) => {
    const r = tr.slots[i], cx = r.x + r.w / 2, base = r.y + r.h - r.h * 0.04, out = P.side[k] !== 'tray', dragged = s.drag && s.drag.key === k;
    if (out || dragged) {
      rr(ctx, r.x + r.w * 0.08, base - r.w * 0.34, r.w * 0.84, r.w * 0.3, 8); ctx.setLineDash([5, 6]); ctx.lineWidth = 2; ctx.strokeStyle = rgba(T.rim, 0.4); ctx.stroke(); ctx.setLineDash([]);
      return;
    }
    const gl = hint && hint.keys.includes(k) ? 0.6 + 0.4 * Math.sin(s.t * 5) : 0, pop = s.fx.pop[k];
    const sc = pop !== undefined && pop < 0.25 ? 1 + 0.15 * Math.sin((Math.PI * pop) / 0.25) : 1;
    if (k === 'bag') drawBag(ctx, cx, base, r.w * 0.96 * sc, P.bag, { glow: gl, fill: P.bag / P.order.target, z: 1 });
    else drawWeight(ctx, cx, base, r.w * 0.96 * sc, k, { glow: gl, z: 1 });
  });
}

function drawControls(ctx, s, L) {
  const T = theme(), P = s.P, pr = L.pour, tl = L.tools, t = totals(P), ok = canPour(P) && !s.pour;
  const reason = !P.seq.length ? 'Put weights on the pans' : t.dust <= 0 ? 'Right pan must be heavier' : '';
  button(ctx, pr, ok ? `Pour ${t.dust}` : 'Pour', { kind: 'accent', size: 36, sub: ok ? 'into the bag' : reason, disabled: !ok, radius: 22, flash: flashOf(s, 'pour') });
  const defs = [['undo', 'Undo', 'undo', !P.undo.length], ['clear', 'Clear', 'erase', !P.seq.length], ['hint', 'Hint', 'bulb', false]];
  for (const [id, label, icon, dis] of defs) {
    const r = tl[id], hint = id === 'hint';
    ctx.save(); if (dis) ctx.globalAlpha = 0.38;
    if (v3.on) v3.buttons.push({ r: { x: r.x, y: r.y, w: r.w, h: r.h }, rad: 18, accent: false, active: hint, disabled: dis, ghost: false, flash: flashOf(s, id), clip: null });
    else {
      rr(ctx, r.x, r.y, r.w, r.h, 18); ctx.fillStyle = hint ? rgba(T.accent, 0.25) : T.btn; ctx.fill();
      const fl = flashOf(s, id); if (fl) { ctx.fillStyle = `rgba(255,255,255,${0.3 * fl})`; ctx.fill(); }
      ctx.lineWidth = hint ? 2 : 1.5; ctx.strokeStyle = hint ? T.accent : T.line; ctx.stroke();
    }
    const col = T.text;
    if (r.w > 120) {
      const isz = Math.min(r.h * 0.46, 36);
      icons[icon](ctx, r.x + r.w * 0.3, r.y + r.h / 2, isz, col);
      txt(ctx, label, r.x + r.w * 0.45, r.y + r.h / 2, { size: F(24), weight: 600, color: col, maxW: r.w * 0.5, min: 12 });
    } else icons[icon](ctx, r.x + r.w / 2, r.y + r.h / 2, Math.min(r.h * 0.5, 36), col);
    ctx.restore();
  }
}

function drawCoach(ctx, s, L) {
  const T = theme(), hnt = s.hint, C = L.coachR, B = L.coachBtns;
  panel(ctx, C, { radius: 24, fill: rgba(T.dark ? '#000000' : '#ffffff', T.dark ? 0.28 : 0.5) });
  edgeStroke(ctx, C, 24, 0.5);
  const x = C.x + 20, w = C.w - 40;
  const chip = hnt.stage === 'look' ? 'Where to look' : hnt.stage === 'explain' ? 'Why it works' : 'Take it back';
  const ts = F(C.h > 300 ? 32 : 28);
  txt(ctx, hnt.name, x, C.y + 14 + ts * 0.6, { size: ts, weight: 400, color: T.accent, maxW: w, min: 16, fam: NUM });
  txt(ctx, chip, x, C.y + 14 + ts * 1.62, { size: F(20), weight: 500, color: T.dim });
  const bodyTop = C.y + 14 + ts * 2.15, bodyH = B.close.y - 8 - bodyTop;
  let size = F((C.w > 500 ? 28 : 25) + (C.h > 380 ? 6 : 0));
  while (size > 14 && paraHeight(ctx, hnt.text, w, size, 500, 1.28) > bodyH) size -= 1;
  para(ctx, hnt.text, x, bodyTop, w, { size, weight: 500, color: T.text, lh: 1.28 });
  button(ctx, B.close, 'Close', { size: 28, flash: flashOf(s, 'close') });
  button(ctx, B.go, hnt.stage === 'look' ? 'Explain' : hnt.stage === 'mistake' ? 'Undo pour' : 'Set the pans', { kind: 'accent', size: 28, flash: flashOf(s, 'go') });
}
const THINK_LABEL = ['2 s', '5 s', '8 s', '10 s'];
function drawAutoControls(ctx, s, L) {
  const T = theme(), a = s.auto, C = L.coachR, rl = L.rail, hnt = s.hint;
  panel(ctx, C, { radius: 24, fill: rgba(T.dark ? '#000000' : '#ffffff', T.dark ? 0.28 : 0.5) });
  edgeStroke(ctx, C, 24, 0.5);
  const x = C.x + 20, w = C.w - 40, T0 = L.coachText;
  const ts = F(C.h > 300 ? 32 : 28), name = hnt ? hnt.name : (a.done ? 'Order served' : 'Thinking');
  txt(ctx, name, x, T0.y + 14 + ts * 0.6, { size: ts, weight: 400, color: T.accent, maxW: w, min: 16, fam: NUM });
  const phase = a.paused ? 'Paused' : a.phase === 'think' ? 'Where to look' : a.phase === 'reveal' ? 'Why it works' : a.phase === 'act' ? 'Setting the pans' : a.done ? 'The bag holds the order' : 'Finding the next weighing';
  txt(ctx, `Weighing ${Math.max(1, a.n)}  ·  ${phase}`, x, T0.y + 14 + ts * 1.62, { size: F(20), weight: 500, color: T.dim, maxW: w * 0.62, min: 12 });
  const bodyTop = T0.y + 14 + ts * 2.15, bodyH = T0.y + T0.h - bodyTop;
  const text = hnt ? hnt.text : (a.done ? 'The order is served. Tap Exit to go back to the menu.' : 'Looking for the next weighing.');
  let size = F((C.w > 500 ? 26 : 24) + (C.h > 380 ? 6 : 0));
  while (size > 13 && paraHeight(ctx, text, w, size, 500, 1.28) > bodyH) size -= 1;
  para(ctx, text, x, bodyTop, w, { size, weight: 500, color: T.text, lh: 1.28 });
  button(ctx, rl.exit, 'Exit', { icon: 'exit', size: 26, flash: flashOf(s, 'aexit') });
  button(ctx, rl.pause, a.paused ? 'Resume' : 'Pause', { icon: a.paused ? 'play' : 'pause', kind: 'accent', size: 26, flash: flashOf(s, 'apause') });
  button(ctx, rl.dec, '', { icon: 'minus', size: 26, flash: flashOf(s, 'adec') });
  button(ctx, rl.inc, '', { icon: 'plus', size: 26, flash: flashOf(s, 'ainc') });
  txt(ctx, `Think ${THINK_LABEL[s.prefs.thinkIdx]}`, C.x + C.w - 20, T0.y + 14 + ts * 1.62, { size: F(20), weight: 500, color: T.dim, align: 'right' });
}

function drawPaused(ctx, s, L) {
  const T = theme(), pl = pauseLayout(L.w, L.h, L.scene);
  if (v3.on) { v3.scrim = 0.72; v3.scrimAt = { p: v3.panels.length, b: v3.buttons.length }; } else { ctx.fillStyle = rgba(T.tray, 0.86); rr(ctx, L.scene.x, L.scene.y, L.scene.w, L.scene.h, 26); ctx.fill(); }
  panel(ctx, pl.card, { radius: 26, fill: T.dark ? 'rgba(26,12,30,0.97)' : 'rgba(255,250,236,0.98)' });
  edgeStroke(ctx, pl.card, 26, 0.5);
  txt(ctx, 'Paused', pl.card.x + pl.card.w / 2, pl.card.y + 44, { size: F(38), weight: 400, color: T.text, align: 'center', fam: NUM });
  button(ctx, pl.resume, 'Resume', { kind: 'accent', icon: 'play', size: 30, flash: flashOf(s, 'resume') });
  button(ctx, pl.restart, 'Restart order', { size: 28, flash: flashOf(s, 'restart') });
  button(ctx, pl.settings, 'Settings', { icon: 'gear', size: 28, flash: flashOf(s, 'psettings') });
  button(ctx, pl.menu, 'Save and menu', { size: 28, flash: flashOf(s, 'pmenu') });
}

function drawWinBanner(ctx, s, L) {
  const T = theme(), a = clamp(s.winT / 0.5, 0, 1) * clamp((3.2 - s.winT) / 0.25, 0, 1);
  const r = L.scene, cx = r.x + r.w / 2, cy = r.y + r.h * 0.2;
  ctx.save(); ctx.globalAlpha = a;
  const wdt = Math.min(r.w - 30, 560), hgt = 78;
  if (v3.on) v3.panels.push({ r: { x: cx - wdt / 2, y: cy - hgt / 2, w: wdt, h: hgt }, rad: 22, kind: 'gold', clip: null, flash: 0, dim: 1 - a });
  else { rr(ctx, cx - wdt / 2, cy - hgt / 2, wdt, hgt, 22); ctx.fillStyle = 'rgba(20,10,4,0.9)'; ctx.fill(); ctx.lineWidth = 3; ctx.strokeStyle = T.accent; ctx.stroke(); }
  txt(ctx, 'Order served', cx, cy, { size: F(44), weight: 400, color: '#ffe38a', align: 'center', maxW: wdt - 30, min: 18, fam: NUM });
  ctx.restore();
  for (const p of s.sparks) { ctx.globalAlpha = Math.max(0, 1 - p.t / p.life); ctx.fillStyle = p.c; ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, TAU); ctx.fill(); }
  ctx.globalAlpha = 1;
}

function drawMsg(ctx, s, L) {
  const m = s.msg;
  if (!m) return;
  const T = theme(), a = Math.min(1, (m.hold - m.t) / 0.4, m.t / 0.12), portrait = L.mode === 'portrait';
  const bx = L.scene, w = portrait ? Math.min(bx.w - 30, 600) : L.info.w - 24, cx2 = portrait ? bx.x + bx.w / 2 : L.info.x + L.info.w / 2;
  let size = F(portrait ? 24 : 24), lines = wrap(ctx, m.text, w - 36, size, 600);
  while (portrait && lines.length > 2 && size > F(18)) { size -= 1; lines = wrap(ctx, m.text, w - 36, size, 600); }
  const hh = lines.length * size * 1.22 + 22;
  const y = portrait ? L.strip.y + L.strip.h + 10 : L.strip.y + Math.max(0, (L.strip.h - hh) / 2);
  ctx.save(); ctx.globalAlpha = a;
  if (v3.on) v3.panels.push({ r: { x: cx2 - w / 2, y, w, h: hh }, rad: 18, kind: 'toast', clip: null, flash: 0, dim: 1 - a });
  else { rr(ctx, cx2 - w / 2, y, w, hh, 18); ctx.fillStyle = T.dark ? 'rgba(14,6,22,0.96)' : 'rgba(255,255,255,0.97)'; ctx.fill(); ctx.lineWidth = 2; ctx.strokeStyle = T.accent; ctx.stroke(); }
  para(ctx, m.text, cx2 - w / 2 + 18, y + 11, w - 36, { size, weight: 600, color: T.text, align: 'center', lh: 1.22 });
  ctx.restore();
}

// ================================================================ title ==================================================================
// Embossed cast-gold lettering: dark stroke, gold body gradient, a lit upper edge and a soft drop shadow.
function goldText(ctx, str, cx, cy, size, maxW, tone) {
  ctx.save();
  ctx.font = `400 ${size}px ${NUM}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  let fs = size; const w = ctx.measureText(str).width; if (w > maxW) { fs = size * maxW / w; ctx.font = `400 ${fs}px ${NUM}`; }
  const g = ctx.createLinearGradient(0, cy - fs * 0.5, 0, cy + fs * 0.5);
  if (tone) { g.addColorStop(0, '#fff6c8'); g.addColorStop(0.45, '#ffd45a'); g.addColorStop(0.55, '#e8a21c'); g.addColorStop(1, '#9a5a0c'); }
  else { g.addColorStop(0, '#ffffff'); g.addColorStop(0.45, '#f7e3b0'); g.addColorStop(0.55, '#d9b266'); g.addColorStop(1, '#8a5a24'); }
  ctx.lineJoin = 'round'; ctx.shadowColor = 'rgba(0,0,0,0.55)'; ctx.shadowBlur = fs * 0.18; ctx.shadowOffsetY = fs * 0.06;
  ctx.lineWidth = fs * 0.14; ctx.strokeStyle = '#2a1204'; ctx.strokeText(str, cx, cy);
  ctx.shadowColor = 'transparent'; ctx.fillStyle = g; ctx.fillText(str, cx, cy);
  ctx.lineWidth = fs * 0.02; ctx.strokeStyle = 'rgba(255,255,255,0.55)'; ctx.strokeText(str, cx - fs * 0.012, cy - fs * 0.014);
  ctx.restore();
}
function drawTitle(ctx, s, w, h) {
  const T = theme(), L = titleLayout(w, h, !!s.saved), hero = L.hero; setBrandTone(T.dark);
  const H = hero.h, tb = Math.min(190, Math.max(96, H * 0.34));
  const sw = Math.min(hero.w, 720), sh = Math.max(120, Math.min(H - tb * 1.05 - 6, sw * 0.8));
  const sr = R(hero.x + (hero.w - sw) / 2, hero.y + Math.max(0, (H - sh - tb) / 2), sw, sh);
  const ang = s.prefs.calm ? 0.08 : Math.sin(s.t * 0.9) * 0.1 + 0.04;
  const rise = smooth(clamp(s.sceneT * 2.2, 0, 1));
  ctx.save(); ctx.globalAlpha = rise;
  drawMini(ctx, sr, { ang, items: { left: [3, 5], right: ['bag'] }, bagShown: 21, bagFill: 0.55, dust: 4, t: s.t, calm: s.prefs.calm, level: false, chips: null });
  ctx.restore();
  const ty = sr.y + sr.h + tb * 0.26;
  if (v3.on) {
    goldText(ctx, 'GOLD-WEIGHT', hero.x + hero.w / 2, ty, tb * 0.4, hero.w * 0.96, 0);
    goldText(ctx, 'BALANCE', hero.x + hero.w / 2, ty + tb * 0.42, tb * 0.46, hero.w * 0.96, 1);
  } else {
    txt(ctx, 'GOLD-WEIGHT', hero.x + hero.w / 2, ty, { size: tb * 0.4, weight: 400, color: T.text, align: 'center', maxW: hero.w * 0.96, min: 22, fam: NUM });
    txt(ctx, 'BALANCE', hero.x + hero.w / 2, ty + tb * 0.4, { size: tb * 0.4, weight: 400, color: T.accent, align: 'center', maxW: hero.w * 0.96, min: 22, fam: NUM });
  }
  txt(ctx, 'An Akan trader\'s puzzle', hero.x + hero.w / 2, ty + tb * 0.72, { size: tb * 0.15, weight: 600, color: T.dim, align: 'center', maxW: hero.w * 0.9, min: 12 });
  const done = Object.keys(s.progress).length, Bt = L.buttons, total = CHAPTERS.reduce((a, c) => a + c.count, 0);
  const lab = {
    continue: ['Continue', s.saved ? `${RULE_TITLE[s.saved.variant] ?? 'Order'}${s.saved.kind === 'daily' ? ' · Daily' : ''}  ·  ${s.saved.pours} weighings` : ''],
    journey: ['The Market', `${done} of ${total} orders served`], free: ['Free Play', 'Three kinds of weighing, three levels each'],
    daily: ['Daily Order', s.dailyDone ? `${RULE_TITLE[s.dailyVariant]}  ·  done today` : `${RULE_TITLE[s.dailyVariant]}  ·  ${s.streak ? s.streak + ' day streak' : 'new every day'}`],
    learn: ['Watch and Learn', ''], howto: ['How to Play', ''], rules: ['Rules', ''], stats: ['Stats', ''], settings: ['Settings', ''], about: ['About', ''],
  };
  const iconOf = { learn: 'eye', settings: 'gear', stats: 'star' };
  for (const id of Object.keys(Bt)) {
    const prim = id === 'continue' || id === 'journey' || id === 'free' || id === 'daily', r = Bt[id];
    button(ctx, r, lab[id][0], { kind: id === 'journey' || id === 'continue' ? 'accent' : 'solid', size: prim ? 32 : 24, sub: prim ? lab[id][1] : '', radius: 20, flash: flashOf(s, id), icon: prim ? '' : (iconOf[id] ?? '') });
    if (id === 'daily' && s.dailyDone) icons.check(ctx, r.x + r.w - 36, r.y + r.h / 2, 28, T.good);
  }
  drawCredit(ctx, L.brand.x, L.brand.y, Math.min(16, Math.max(12.5, 13.5 / (host.px || 0.55) * 0.5 + 6)), { dim: 0.95 });
}

// ================================================================ pick screens ============================================================
function header(ctx, s, P, title) {
  const T = theme(), sc = scaleOf(s);
  txt(ctx, title, P.titleX, P.header.y + P.header.h / 2, { size: F(38), weight: 400, color: T.text, maxW: P.textDec.x - P.titleX - 14, min: 18, fam: NUM });
  button(ctx, P.textDec, 'A−', { size: 28, disabled: s.prefs.textIdx === 0, flash: flashOf(s, 'tdec'), radius: 16 });
  button(ctx, P.textInc, 'A+', { size: 28, disabled: s.prefs.textIdx === TEXT_SCALES.length - 1, flash: flashOf(s, 'tinc'), radius: 16 });
  if (sc > 1) txt(ctx, `${Math.round(sc * 100)}%`, P.textDec.x - 12, P.header.y + P.header.h / 2, { size: F(22), weight: 500, color: T.dim, align: 'right' });
}
function scrollBody(ctx, s, rect, draw) {
  ctx.save(); ctx.beginPath(); ctx.rect(rect.x - 6, rect.y, rect.w + 12, rect.h); ctx.clip();
  ctx.translate(0, -s.scrollY);
  const prevClip = v3.clip, off = s.scrollY;
  v3.clip = { x: rect.x - 6, y: rect.y, w: rect.w + 12, h: rect.h, off };
  const ch = draw();
  v3.clip = prevClip;
  ctx.restore();
  metrics.max = Math.max(0, ch - rect.h); metrics.view = rect.h; metrics.rect = rect;
  if (metrics.max > 0) {
    const T = theme(), bx = rect.x + rect.w + 4, th = Math.max(40, rect.h * rect.h / ch), ty = rect.y + (rect.h - th) * clamp(s.scrollY / metrics.max, 0, 1);
    rr(ctx, bx, rect.y, 6, rect.h, 3); ctx.fillStyle = 'rgba(128,128,128,0.2)'; ctx.fill();
    rr(ctx, bx, ty, 6, th, 3); ctx.fillStyle = T.accent; ctx.fill();
  }
}

function drawJourney(ctx, s, w, h) {
  const T = theme(), LL = listLayout(w, h), sc = scaleOf(s);
  header(ctx, s, LL, 'The Market');
  const J = journeyRects(LL.body, CHAPTERS.map((c) => c.count), sc);
  let nextKey = null;
  outer: for (let ci = 0; ci < CHAPTERS.length; ci++) for (let i = 0; i < CHAPTERS[ci].count; i++) if (!s.progress[`${ci}:${i}`]) { nextKey = `${ci}:${i}`; break outer; }
  scrollBody(ctx, s, LL.body, () => {
    J.items.forEach((it) => {
      const ch = CHAPTERS[it.ci], done = Array.from({ length: ch.count }, (_, i) => !!s.progress[`${it.ci}:${i}`]).filter(Boolean).length, hd = it.head, z = Math.min(sc, 1.6);
      txt(ctx, ch.name, hd.x + 4, hd.y + 24 * z, { size: F(32) * z, weight: 400, color: T.text, maxW: hd.w * 0.7, min: 16, fam: NUM });
      txt(ctx, `${done} of ${ch.count}`, hd.x + hd.w - 4, hd.y + 24 * z, { size: F(24) * Math.min(sc, 1.5), weight: 600, color: T.accent, align: 'right' });
      para(ctx, ch.blurb, hd.x + 4, hd.y + 46 * z, hd.w - 8, { size: F(21) * z, weight: 400, color: T.dim, lh: 1.15 });
      it.lv.forEach((r, i) => {
        const key = `${it.ci}:${i}`, pr = s.progress[key], idx = CHAPTERS.slice(0, it.ci).reduce((a, c) => a + c.count, 0) + i;
        const locked = !s.dev && !(idx === 0 || s.progress[prevKey(it.ci, i)] || pr);
        const cx = r.x + r.w / 2, isNext = key === nextKey, size = Math.min(r.w, r.h * 1.15) * 0.82;
        ctx.save(); if (locked) ctx.globalAlpha = 0.4;
        drawWeight(ctx, cx, r.y + r.h * 0.74, size, i + 1 + it.ci * 6, { glow: isNext ? 0.5 + 0.5 * Math.sin(s.t * 4) : 0, shadow: false });
        ctx.restore();
        if (pr) for (let k = 0; k < 3; k++) icons.star(ctx, cx + (k - 1) * size * 0.34, r.y + r.h - 4, size * 0.3, k < pr.stars ? '#ffc93c' : 'rgba(128,128,128,0.4)');
        else if (locked) txt(ctx, 'locked', cx, r.y + r.h - 6, { size: F(15), weight: 500, color: T.dim, align: 'center' });
      });
    });
    return J.contentH + 10;
  });
  button(ctx, LL.back, 'Back', { icon: 'back', size: 30, flash: flashOf(s, 'back') });
}
function prevKey(ci, i) { return i > 0 ? `${ci}:${i - 1}` : `${ci - 1}:${CHAPTERS[Math.max(0, ci - 1)].count - 1}`; }

function drawFree(ctx, s, w, h) {
  const T = theme(), LL = listLayout(w, h), sc = scaleOf(s), Fr = freeRects(LL.body, RULE_IDS.length, sc), z = Math.min(sc, 1.5);
  header(ctx, s, LL, 'Free Play');
  scrollBody(ctx, s, LL.body, () => {
    Fr.cards.forEach((c, vi) => {
      const id = RULE_IDS[vi], r = c.r, best = s.stats.starsTotal[id], solved = s.stats.solved[id] ?? 0;
      panel(ctx, r, { radius: 22 });
      txt(ctx, RULE_TITLE[id], r.x + 20, r.y + 30 * z, { size: F(30) * z, weight: 400, color: T.text, maxW: r.w * 0.6, min: 15, fam: NUM });
      txt(ctx, RULE_TEXT[id], r.x + 20, r.y + 66 * z, { size: F(21) * z, weight: 500, color: T.accent, maxW: r.w * 0.62, min: 12 });
      txt(ctx, `${solved} served`, r.x + r.w - 20, r.y + 30 * z, { size: F(26) * z, weight: 600, color: T.text, align: 'right', maxW: r.w * 0.34, min: 12 });
      txt(ctx, best ? `${best} stars total` : 'none yet', r.x + r.w - 20, r.y + 62 * z, { size: F(19) * z, weight: 400, color: T.dim, align: 'right', maxW: r.w * 0.34, min: 11 });
      c.tiers.forEach((tr, t) => button(ctx, tr, TIERS[t], { size: 24, kind: t === 1 ? 'accent' : 'solid', radius: 14, flash: flashOf(s, 'tier' + vi + t) }));
    });
    return Fr.contentH;
  });
  button(ctx, LL.back, 'Back', { icon: 'back', size: 30, flash: flashOf(s, 'back') });
}

// ================================================================ docs ===================================================================
function figBox(ctx, r, caption) {
  const T = theme();
  if (!plate(ctx, r, 22, { kind: 'fig' })) { rr(ctx, r.x, r.y, r.w, r.h, 22); ctx.fillStyle = T.dark ? 'rgba(0,0,0,0.22)' : 'rgba(255,255,255,0.4)'; ctx.fill(); ctx.lineWidth = 1.5; ctx.strokeStyle = T.line; ctx.stroke(); }
  if (caption) txt(ctx, caption, r.x + r.w / 2, r.y + r.h - 16, { size: F(20), weight: 600, color: T.accent, align: 'center', maxW: r.w - 24, min: 11 });
}
export function drawFigure(ctx, r, kind, t) {
  const T = theme();
  const inner = R(r.x + 6, r.y + 6, r.w - 12, r.h - 40);
  const mini = (m, caption) => { figBox(ctx, r, caption); ctx.save(); rr(ctx, r.x, r.y, r.w, r.h, 22); ctx.clip(); drawMini(ctx, inner, { chips: { left: m.cl ?? 0, right: m.cr ?? 0 }, t, mini: true, ...m }); ctx.restore(); };
  switch (kind) {
    case 'goal': {
      figBox(ctx, r, 'The bag must hold exactly the order');
      const cx = r.x + r.w * 0.32, base = r.y + r.h * 0.72, s0 = Math.min(r.w * 0.32, r.h * 0.5);
      drawBag(ctx, cx, base, s0, 38, { fill: 0.6 });
      const sx = r.x + r.w * 0.64, sw = Math.min(r.w * 0.3, 190), sh = sw * 0.62;
      rr(ctx, sx - sw / 2, base - sh - 30, sw, sh, 14); ctx.fillStyle = 'rgba(255,248,224,0.92)'; ctx.fill(); ctx.lineWidth = 2; ctx.strokeStyle = T.rim; ctx.stroke();
      txt(ctx, 'ORDER', sx, base - sh - 30 + sh * 0.25, { size: F(18), weight: 700, color: '#6a4410', align: 'center' });
      txt(ctx, '38', sx, base - sh - 30 + sh * 0.65, { size: F(sh * 0.5), weight: 400, color: '#3a2006', align: 'center', fam: NUM });
      break;
    }
    case 'weights': {
      figBox(ctx, r, 'Cast weights: each has its figure and its value');
      const vs = [2, 3, 4, 5, 6, 7], n = Math.min(vs.length, r.w > 520 ? 6 : r.w > 380 ? 4 : 3), sz = Math.min(r.h * 0.34, (r.w - 40) / n * 0.86);
      for (let i = 0; i < n; i++) drawWeight(ctx, r.x + r.w * (0.5 + (i - (n - 1) / 2) / n * 0.92 / 1), r.y + r.h * 0.5 + sz * 0.5, sz, vs[i], {});
      break;
    }
    case 'pour': mini({ ang: 0, items: { left: [], right: [9] }, dust: 9, cl: 9, cr: 9 }, 'dust = right 9 - left 0 = 9'); break;
    case 'right': mini({ ang: 0, items: { left: [], right: [1, 5] }, dust: 6, cl: 6, cr: 6 }, 'right pan 1 + 5: pour 6'); break;
    case 'both': mini({ ang: 0, items: { left: [3], right: [9] }, dust: 6, cl: 9, cr: 9 }, 'right 9 - left 3 = dust 6'); break;
    case 'bag': mini({ ang: 0, items: { left: [3], right: ['bag'] }, bagShown: 7, bagFill: 0.4, dust: 4, cl: 7, cr: 7 }, 'bag 7 on the right, 3 on the left: pour 4'); break;
    default: break;
  }
}

function drawDoc(ctx, s, w, h) {
  const T = theme(), doc = DOCS[s.doc.kind], page = doc.pages[s.doc.page], DL = docLayout(w, h), sc = scaleOf(s);
  header(ctx, s, DL, doc.title);
  const n = doc.pages.length;
  button(ctx, DL.menu, 'Menu', { icon: 'back', size: 26, flash: flashOf(s, 'back') });
  button(ctx, DL.prev, 'Prev', { size: 26, disabled: s.doc.page === 0, flash: flashOf(s, 'prev') });
  button(ctx, DL.next, 'Next', { size: 26, kind: s.doc.page < n - 1 ? 'accent' : 'solid', disabled: s.doc.page >= n - 1, flash: flashOf(s, 'next') });
  txt(ctx, `${s.doc.page + 1} / ${n}`, DL.count.x + DL.count.w / 2, DL.count.y + DL.count.h / 2, { size: F(26), weight: 600, color: T.dim, align: 'center' });
  const textR = DL.text, figR = DL.fig;
  const drawText = (top, width, x) => {
    let y = top;
    txt(ctx, page.title, x, y + 26 * sc, { size: F(34) * sc, weight: 400, color: T.accent, maxW: width, min: 15, fam: NUM }); y += 26 * sc + 30 * sc;
    for (const b of page.body) {
      if (b.p && b.mono) { y += para(ctx, b.p, x, y, width, { size: F(32) * sc, weight: 700, color: T.text, align: 'center', lh: 1.4 }) + 14 * sc; }
      else if (b.p) { y += para(ctx, b.p, x, y, width, { size: F(28) * sc, weight: 400, color: T.text, lh: 1.34 }) + 14 * sc; }
      else if (b.li) for (const it of b.li) {
        const sz = F(27) * sc;
        ctx.beginPath(); ctx.arc(x + 8 * sc, y + sz * 0.62, 5 * sc, 0, 7); ctx.fillStyle = T.accent; ctx.fill();
        y += para(ctx, it, x + 28 * sc, y, width - 28 * sc, { size: sz, weight: 400, color: T.text, lh: 1.3 }) + 10 * sc;
      }
    }
    return y - top + 20;
  };
  if (DL.split) {
    if (page.fig) drawFigure(ctx, figR, page.fig, s.t);
    scrollBody(ctx, s, textR, () => drawText(textR.y, textR.w - 10, textR.x));
  } else {
    scrollBody(ctx, s, textR, () => {
      let y = textR.y;
      if (page.fig) {
        const fh = Math.min(textR.w * 0.8, Math.max(260, textR.h * (sc > 1.6 ? 0.4 : 0.52)), 520), fr = R(textR.x + (textR.w - Math.min(textR.w, fh * 1.25)) / 2, y, Math.min(textR.w, fh * 1.25), fh);
        drawFigure(ctx, fr, page.fig, s.t); y += fr.h + 14;
      }
      return y - textR.y + drawText(y, textR.w - 10, textR.x);
    });
  }
}

// ================================================================ settings ===============================================================
function drawSettings(ctx, s, w, h) {
  const T = theme(), sc = scaleOf(s), ROWS = settingRows(s), SL = settingsLayout(w, h, sc, ROWS.length);
  header(ctx, s, SL, 'Settings');
  scrollBody(ctx, s, SL.body, () => {
    ROWS.forEach((row, i) => {
      const g = SL.rows[i], isR = row.id === 'restore', msg = isR ? s.restore?.msg : '';
      panel(ctx, g.rect, { radius: 20 });
      txt(ctx, row.label, g.rect.x + 22, g.rect.y + g.rect.h / 2 - (msg ? 14 : 0), { size: F(28) * Math.min(sc, 1.5), weight: 600, color: T.text, maxW: g.rect.w - g.ctrl.w - 50, min: 14 });
      if (msg) txt(ctx, msg, g.rect.x + 22, g.rect.y + g.rect.h / 2 + 22, { size: F(20) * Math.min(sc, 1.4), weight: 400, color: T.dim ?? T.text, maxW: g.rect.w - g.ctrl.w - 50, min: 10 });
      const opts = isR ? [restoreLabel(s)] : row.opts, n = opts.length, seg = grid(g.ctrl, n, 1, 8), cur = settingIndex(s, row.id);
      opts.forEach((o, k) => button(ctx, seg[k], o, { size: 24, active: k === cur, radius: 14, kind: isR ? 'accent' : 'solid', disabled: isR && s.owned, flash: flashOf(s, 'set' + i + '.' + k) }));
    });
    return SL.contentH;
  });
  button(ctx, SL.back, 'Back', { icon: 'back', size: 30, flash: flashOf(s, 'back') });
}

// ================================================================ stats ==================================================================
function drawStats(ctx, s, w, h) {
  const T = theme(), sc = scaleOf(s), SL = listLayout(w, h), st = s.stats, z = Math.min(sc, 1.6);
  header(ctx, s, SL, 'Stats');
  const total = RULE_IDS.reduce((a, id) => a + (st.solved[id] ?? 0), 0), wide = SL.body.w >= 1000;
  const stars = Object.values(s.progress).reduce((a, p) => a + (p.stars ?? 0), 0);
  scrollBody(ctx, s, SL.body, () => {
    const r = SL.body, gapC = 28, lw = wide ? (r.w - gapC) * 0.54 : r.w, x = r.x; let y = r.y;
    const cols = lw > 760 ? 4 : 2, tiles = [['Orders served', total], ['Market stars', stars], ['Daily streak', s.streak], ['Best streak', st.bestStreak]];
    const th = 110 * Math.min(sc, 1.8), g = 12, tw = (lw - g * (cols - 1)) / cols;
    tiles.forEach(([l, v], i) => {
      const tr = R(x + (i % cols) * (tw + g), y + Math.floor(i / cols) * (th + g), tw, th);
      panel(ctx, tr, { radius: 20 });
      txt(ctx, v, tr.x + 20, tr.y + th * 0.42, { size: F(44) * z, weight: 400, color: T.text, fam: NUM });
      txt(ctx, l, tr.x + 20, tr.y + th * 0.8, { size: F(22) * z, weight: 400, color: T.dim, maxW: tw - 30, min: 11 });
    });
    y += Math.ceil(tiles.length / cols) * (th + g) + 10;
    txt(ctx, 'By kind of weighing', x, y + 20 * sc, { size: F(30) * sc, weight: 400, color: T.accent, fam: NUM }); y += 50 * sc;
    for (const id of RULE_IDS) {
      const rh = 76 * Math.min(sc, 1.8), rr2 = R(x, y, lw, rh);
      panel(ctx, rr2, { radius: 16 });
      txt(ctx, RULE_TITLE[id], x + 20, y + rh / 2, { size: F(26) * z, weight: 600, color: T.text, maxW: lw * 0.4, min: 13 });
      txt(ctx, `${st.solved[id] ?? 0} served`, x + lw - 20, y + rh / 2, { size: F(23) * z, weight: 500, color: T.dim, align: 'right', maxW: lw * 0.4, min: 12 });
      y += rh + 8;
    }
    const leftEnd = y;
    let cx = x, cw = lw, cy;
    if (wide) { cx = x + lw + gapC; cw = r.w - lw - gapC; cy = r.y; } else { y += 14; cy = y; }
    txt(ctx, 'Last five weeks', cx, cy + 20 * sc, { size: F(30) * sc, weight: 400, color: T.accent, fam: NUM }); cy += 50 * sc;
    const cs = Math.min(wide ? 110 : 86, (cw - 6 * 8) / 7), done = new Set(st.days);
    ['S', 'M', 'T', 'W', 'T', 'F', 'S'].forEach((d, i) => txt(ctx, d, cx + i * (cs + 8) + cs / 2, cy + 12, { size: F(20), weight: 500, color: T.dim, align: 'center' }));
    cy += 28;
    const today = s.daily.day, wd = (today + 4) % 7, start = today - wd - 28;
    for (let k = 0; k < 35; k++) {
      const day = start + k, ex = cx + (k % 7) * (cs + 8), ey = cy + Math.floor(k / 7) * (cs + 8), isDone = done.has(day), future = day > today;
      if (v3.on) v3.panels.push({ r: { x: ex, y: ey, w: cs, h: cs }, rad: cs * 0.2, kind: isDone ? 'good' : future ? 'ghost' : 'cell', clip: v3.clip, flash: 0, dim: 0 });
      else { rr(ctx, ex, ey, cs, cs, cs * 0.2); ctx.fillStyle = isDone ? T.good : future ? 'rgba(128,128,128,0.08)' : T.btn; ctx.fill(); }
      if (day === today) { ctx.lineWidth = 3; ctx.strokeStyle = T.accent; ctx.stroke(); }
      if (isDone) icons.check(ctx, ex + cs / 2, ey + cs / 2, cs * 0.5, '#06241a');
    }
    cy += 5 * (cs + 8) + 10;
    return Math.max(wide ? leftEnd : 0, cy) - r.y;
  });
  button(ctx, SL.back, 'Back', { icon: 'back', size: 30, flash: flashOf(s, 'back') });
}

// ================================================================ result =================================================================
function drawOver(ctx, s, w, h) {
  const T = theme(), R0 = s.result;
  if (!R0) return;
  setBrandTone(T.dark);
  const sc = scaleOf(s), O = overLayout(w, h, sc), b = O.scene;
  if (!v3.on) { rr(ctx, b.x, b.y, b.w, b.h, 26); ctx.fillStyle = rgba('#000000', T.dark ? 0.2 : 0.07); ctx.fill(); ctx.lineWidth = 1.5; ctx.strokeStyle = T.line; ctx.stroke(); }
  ctx.save(); if (!v3.on) { rr(ctx, b.x, b.y, b.w, b.h, 26); ctx.clip(); }
  const ang = 0.16 + (s.prefs.calm ? 0 : Math.sin(s.t * 1.4) * 0.02);
  const G = balanceGeo(b, ang);
  drawBalance(ctx, G, { t: s.t, calm: s.prefs.calm, items: { left: ['bag'], right: [] }, dust: 0, bagShown: R0.target, bagFill: 1, level: false, chips: null });
  const sp = (k) => { const a = (s.t * 0.6 + k / 9) % 1; return a; };
  for (let k = 0; k < 9; k++) { const a = sp(k), x = G.L.x + (hash(k, 4) - 0.5) * G.dw * 1.6, y = G.L.y - G.item * 1.6 - a * G.item * 1.4; ctx.globalAlpha = (1 - a) * 0.9; ctx.fillStyle = '#fff6b8'; ctx.beginPath(); ctx.arc(x, y, Math.max(2, G.item * 0.045), 0, TAU); ctx.fill(); }
  ctx.globalAlpha = 1; ctx.restore();
  const body = O.body;
  scrollBody(ctx, s, body, () => {
    let y = body.y + 4;
    const compact = O.wide, tsz = compact ? 36 : 46, z = Math.min(sc, 1.5);
    txt(ctx, R0.daily ? 'Daily Order served' : 'Order served', body.x + body.w / 2, y + tsz * 0.55, { size: F(tsz) * z, weight: 400, color: T.text, align: 'center', maxW: body.w, min: 18, fam: NUM }); y += (tsz + 12) * z;
    const sz = compact ? 36 : 52;
    for (let k = 0; k < 3; k++) icons.star(ctx, body.x + body.w / 2 + (k - 1) * (sz + 10), y + sz / 2, sz, k < R0.stars ? '#ffc93c' : 'rgba(128,128,128,0.35)');
    y += sz + (compact ? 8 : 16);
    const facts = [['Order', R0.target], ['Weighings', R0.pours], ['Par', R0.par], ['Hints', R0.hints]];
    const cols = body.w > 330 ? 4 : 2, fw = (body.w - 8 * (cols - 1)) / cols, fh = (compact ? 66 : 82) * Math.min(sc, 1.7);
    facts.forEach(([l, v], i) => {
      const r = R(body.x + (i % cols) * (fw + 8), y + Math.floor(i / cols) * (fh + 8), fw, fh);
      panel(ctx, r, { radius: 14 });
      txt(ctx, v, r.x + r.w / 2, r.y + fh * 0.4, { size: F(compact ? 28 : 34) * z, weight: 400, color: T.text, align: 'center', maxW: fw - 8, min: 14, fam: NUM });
      txt(ctx, l, r.x + r.w / 2, r.y + fh * 0.78, { size: F(18) * z, weight: 400, color: T.dim, align: 'center', maxW: fw - 6, min: 11 });
    });
    y += Math.ceil(facts.length / cols) * (fh + 8) + 4;
    if (R0.pours <= R0.par) { txt(ctx, R0.pours < R0.par ? 'Better than par' : 'Par: the fewest weighings possible', body.x + body.w / 2, y + 16, { size: F(24) * sc, weight: 600, color: T.good, align: 'center', maxW: body.w, min: 12 }); y += 40 * sc; }
    if (R0.daily) { y += para(ctx, `Daily streak: ${R0.streak} day${R0.streak === 1 ? '' : 's'}`, body.x, y, body.w, { size: F(28) * sc, weight: 600, color: T.accent, align: 'center' }) + 8; }
    if (R0.pours > R0.par) { y += para(ctx, `The fewest possible was ${R0.par}. Replay the order to find it.`, body.x, y, body.w, { size: F(24) * sc, weight: 500, color: T.dim, align: 'center' }) + 10; }
    txt(ctx, 'Did you know', body.x, y + 16 * sc, { size: F(26) * sc, weight: 700, color: T.accent }); y += 38 * sc;
    y += para(ctx, FACTS[R0.daily ? 'daily' : R0.variant] ?? FACTS.right, body.x + 8, y, body.w - 16, { size: F(24) * sc, weight: 400, color: T.dim, lh: 1.3 }) + 6;
    return y - body.y + 10;
  });
  const nextLabel = R0.kind === 'journey' ? (R0.next ? 'Next order' : 'Back to the Market') : R0.daily ? 'Back to menu' : 'Another order';
  button(ctx, O.btns.next, nextLabel, { kind: 'accent', size: 32, flash: flashOf(s, 'next') });
  button(ctx, O.btns.share, 'Share', { size: 28, flash: flashOf(s, 'share') });
  button(ctx, O.btns.menu, R0.kind === 'journey' ? 'Market' : R0.daily ? 'Free Play' : 'Menu', { size: 28, flash: flashOf(s, 'menu') });
  drawMoreLine(ctx, O.more.x, O.more.y, 15);
}

function drawDemoLimit(ctx, s, w, h) {
  setBrandTone(theme().dark);
  const T = theme(), c = centerCard(w, h, 640, 440);
  panel(ctx, c, { radius: 28 }); edgeStroke(ctx, c, 28, 0.5);
  txt(ctx, 'That was the free preview', c.x + c.w / 2, c.y + 70, { size: F(34), weight: 400, color: T.text, align: 'center', maxW: c.w - 40, min: 18, fam: NUM });
  para(ctx, 'The full game has the whole Market of thirty orders, Free Play at three levels, the Daily Order, hints that teach and Watch and Learn. Get Gold-Weight Balance on iPhone and Android.', c.x + 30, c.y + 120, c.w - 60, { size: F(26), weight: 400, color: T.text, align: 'center' });
  drawCredit(ctx, c.x + c.w / 2, c.y + c.h - 28, 14);
}
export { smooth };
