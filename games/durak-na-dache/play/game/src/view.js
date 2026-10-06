// All drawing. Pure function of (state, layout); no input handling here (that's game.js). `L` = layoutFor(w, h, variant).
import { CARD, ACTIONS, TEXT_SCALES, AUTO_THINK_STEPS } from './layout.js';
import { drawScene, drawFace, drawBack, lacquer, panel, plaque, rr, txt, drawSuit, suitColor, khokhloma, GOLD, CREAM, INK } from './art.js';
import { suitOf, rankOf, cardName, RANK_LABELS, SUIT_NAMES } from './rules.js';
import { LEVELS } from './ai.js';
import { LESSONS } from './lessons.js';
import { ABOUT } from './about.js';
import { RULES } from './rulesText.js';
import { drawLockup, drawMoreLine } from './brand.js';

const SUIT_WORD = { spades: 'Spades', hearts: 'Hearts', diamonds: 'Diamonds', clubs: 'Clubs' };
const ease = (t) => 1 - Math.pow(1 - Math.min(1, Math.max(0, t)), 3);
const lerp = (a, b, t) => a + (b - a) * t;
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

// The veranda behind every screen, sized to the live layout. `wall` = height of the wall strip, `mat` = the stitched play mat (play screens).
const scene = (ctx, state, L, wall, mat, band = true) => drawScene(ctx, state.t, { calm: state.calm, w: L.w, h: L.h, wall, mat, band });
const playScene = (ctx, state, L) => scene(ctx, state, L, L.wallPlay, L.sceneMat, !L.land);
// the title keeps the stitched band; the other menu-type screens in landscape are full of controls, so they get a bare wall strip
const menuScene = (ctx, state, L, hero) => (L.land && !hero ? scene(ctx, state, L, L.wallBare, null, false) : scene(ctx, state, L, L.wallMenu, null, true));

function card3D(ctx, cx, cy, rot, scale, drawInner) {
  ctx.save(); ctx.translate(cx, cy); ctx.rotate(rot); ctx.scale(scale, scale);
  ctx.translate(-CARD.w / 2, -CARD.h / 2);
  drawInner(ctx);
  ctx.restore();
}

export function drawCard(ctx, c, cx, cy, o = {}) {
  const scale = o.scale ?? 1, rot = o.rot ?? 0;
  ctx.save(); ctx.shadowColor = 'rgba(0,0,0,0.45)'; ctx.shadowBlur = o.lift ? 22 : 10; ctx.shadowOffsetY = o.lift ? 14 : 5;
  card3D(ctx, cx, cy, rot, scale, (c2) => {
    if (o.back) drawBack(c2, o.backTheme || 'gzhel');
    else drawFace(c2, c.id, { four: o.four, big: o.big });
  });
  ctx.restore();
  if (o.glow) {
    ctx.save(); ctx.translate(cx, cy); ctx.rotate(rot); ctx.scale(scale, scale);
    rr(ctx, -CARD.w / 2 - 4, -CARD.h / 2 - 4, CARD.w + 8, CARD.h + 8, 16);
    ctx.strokeStyle = o.glow; ctx.lineWidth = 5; ctx.globalAlpha = 0.85; ctx.stroke(); ctx.restore();
  }
}

function seatPlaque(ctx, x, y, o) {
  plaque(ctx, x, y, o.w, 56, { hot: o.active });
  txt(ctx, o.name, x, y - 8, { size: 22, color: o.active ? '#3a2408' : CREAM, weight: 700 });
  txt(ctx, o.sub, x, y + 14, { size: 16, color: o.active ? '#5a3c10' : GOLD, weight: 600 });
}

function drawTableCards(ctx, g, L, o) {
  const P = L.tablePairs, sc = P.scale;
  g.table.forEach((pair, i) => {
    const s = L.pair(i);
    drawCard(ctx, { id: pair.a }, s.x - P.off.x / 2, s.y - P.off.y / 2, { scale: sc, rot: -0.05, four: o.four, big: o.big, backTheme: o.backTheme, glow: o.beatable && o.beatable.has(i) ? '#ffe27a' : null });
    if (pair.d >= 0) drawCard(ctx, { id: pair.d }, s.x + P.off.x / 2, s.y + P.off.y / 2, { scale: sc, rot: 0.09, four: o.four, big: o.big, backTheme: o.backTheme });
  });
}

function drawStockAndTrump(ctx, g, L, o) {
  if (!L.stock) return;
  const n = g.stock.length, S = L.stock, T = L.trump, k = S.scale / 0.7;
  for (let i = 0; i < Math.min(n, 6); i++) drawCard(ctx, {}, S.x - i * 1.4, S.y - i * 1.4, { scale: S.scale, rot: 0, back: true, backTheme: o.backTheme });
  if (n > 0) drawCard(ctx, { id: g.trumpCard }, T.x, T.y, { scale: S.scale, rot: Math.PI / 2 - 0.06, four: o.four });
  else drawCard(ctx, { id: g.trumpCard }, T.x - 16 * k, T.y - 10 * k, { scale: S.scale, rot: -0.06, four: o.four });
  txt(ctx, `${n}`, L.stockCount.x, L.stockCount.y, { size: 22, color: GOLD, weight: 700, shadow: 'rgba(0,0,0,0.6)' });
  drawSuit(ctx, g.trump, L.suitIcon.x, L.suitIcon.y, L.suitIcon.size, suitColor(g.trump, o.four));
  const D = L.discard;
  if (g.discard.length) { for (let i = 0; i < Math.min(g.discard.length, 5); i++) drawCard(ctx, {}, D.x + i * 1.2, D.y - i * 1.2, { scale: D.scale, rot: 0.5, back: true, backTheme: o.backTheme }); }
}

function drawOpponent(ctx, g, L, seat, o) {
  const sp = L.seat(g.n, seat);
  const n = g.hands[seat].length;
  const active = g.actor === seat;
  const cw = CARD.w * sp.scale;
  const step = Math.min(0.42 * cw, (sp.maxW - cw) / Math.max(1, n - 1));
  for (let i = 0; i < n; i++) { const cx = sp.x + (i - (n - 1) / 2) * step; drawCard(ctx, {}, cx, sp.y, { scale: sp.scale, rot: (i - (n - 1) / 2) * 0.05, back: true, backTheme: o.backTheme }); }
  const fan = cw + step * Math.max(0, n - 1);
  seatPlaque(ctx, sp.x, sp.plaqueY, { w: Math.min(sp.maxW, Math.max(140, fan * 0.8)), name: o.names[seat], sub: `${n} card${n === 1 ? '' : 's'}${g.out[seat] ? ' · safe' : ''}`, active });
  if (o.thinking && active) { ctx.save(); ctx.globalAlpha = 0.6 + 0.3 * Math.sin(o.t * 6); txt(ctx, '…', sp.x, sp.y - CARD.h * sp.scale / 2 + 6, { size: 34, color: GOLD }); ctx.restore(); }
}

function drawHand(ctx, hand, L, o) {
  const n = hand.length, H = L.hand;
  hand.forEach((c, i) => {
    if (o.drag && o.drag.from === 'hand' && o.drag.c === c) return; // drawn separately, following the pointer
    const s = H.slot(i, n);
    const lifted = o.sel === c;
    const y = lifted ? s.y - H.lift(s.scale) : s.y;
    drawCard(ctx, { id: c }, s.x, y, { scale: s.scale, rot: lifted ? 0 : s.rot, four: o.four, big: o.big, lift: lifted, glow: o.legal && o.legal.has(c) ? '#8ee08e' : (lifted ? '#ffe27a' : null) });
  });
}

function actionBtn(ctx, k, L, o) {
  const r = L.bar[k];
  const en = { take: 'Take', bito: 'Bito', hint: 'Hint', undo: 'Undo', seen: 'Seen' }[k];
  lacquer(ctx, r, { kind: k === 'hint' ? 'gold' : 'wood', disabled: !o.enabled(k), label: en, size: Math.min(21, r.h * 0.4) });
}

function drawTopBar(ctx, state, L, teach) {
  const g = state.game, T = L.top;
  lacquer(ctx, T.menu, { label: teach ? '←' : '☰' });
  if (!teach) lacquer(ctx, T.sound, { label: state.sound ? '♪' : '×' });
  const head = `${state.modeName} · ${SUIT_WORD[SUIT_NAMES[g.trump]]} trump`;
  if (T.info && !L.land) {
    const I = T.info;
    panel(ctx, I.x, I.y, I.w, I.h, {});
    const small = I.h < 84;
    txt(ctx, head, I.x + I.w / 2, I.y + (small ? 22 : 27), { size: small ? 19 : 21, color: CREAM, weight: 700 });
    if (state.msg) wrapCentered(ctx, state.msg, I.x + I.w / 2, I.y + (small ? 47 : 58), I.w - 40, small ? 18 : 22, { size: small ? 16 : 17, color: GOLD, weight: 600 });
  } else if (T.info) {
    const I = T.info;
    panel(ctx, I.x, I.y, I.w, I.h, {});
    txt(ctx, state.modeName, I.x + I.w / 2, I.y + 26, { size: 21, color: CREAM, weight: 700 });
    txt(ctx, `${SUIT_WORD[SUIT_NAMES[g.trump]]} trump`, I.x + I.w / 2, I.y + 48, { size: 18, color: CREAM, weight: 600 });
    if (state.msg) wrapCentered(ctx, state.msg, I.x + I.w / 2, I.y + 74, I.w - 28, 18, { size: 15, color: GOLD, weight: 600 }, 4);
  }
}

function drawSetup(ctx, state, L) {
  const S = L.setup;
  menuScene(ctx, state, L);
  txt(ctx, 'New game', S.title.x, S.title.y, { size: 36, color: GOLD, weight: 700, shadow: 'rgba(0,0,0,0.5)' });
  txt(ctx, 'Players', S.labPlayers.x, S.labPlayers.y, { size: 26, color: CREAM, weight: 700 });
  S.players.forEach((p) => lacquer(ctx, p.r, { kind: state.setup.n === p.v ? 'gold' : 'wood', label: String(p.v) }));
  txt(ctx, 'Mode', S.labMode.x, S.labMode.y, { size: 26, color: CREAM, weight: 700 });
  lacquer(ctx, S.modes[0], { kind: state.setup.mode === 'pod' ? 'gold' : 'wood', label: 'Podkidnoy', sub: 'throw-in', size: 26 });
  lacquer(ctx, S.modes[1], { kind: state.setup.mode === 'per' ? 'gold' : 'wood', label: 'Perevodnoy', sub: 'transfer', size: 26 });
  txt(ctx, 'Computer strength', S.labLevel.x, S.labLevel.y, { size: 26, color: CREAM, weight: 700 });
  LEVELS.forEach((Lv, i) => { const r = S.levels[i].r; lacquer(ctx, r, { kind: state.setup.level === Lv.id ? 'gold' : 'wood', label: `${Lv.id} · ${Lv.name}`, size: Math.min(24, r.h * 0.38) }); });
  panel(ctx, S.blurb.x, S.blurb.y, S.blurb.w, S.blurb.h, {});
  const Lv = LEVELS[state.setup.level - 1];
  wrapCentered(ctx, Lv.blurb, S.blurb.x + S.blurb.w / 2, S.blurb.y + S.blurb.h / 2 - 8, S.blurb.w - 50, 21, { size: 18, color: CREAM, weight: 500 }, 2, true);
  lacquer(ctx, S.start, { kind: 'gold', label: 'Start', size: Math.min(40, S.start.h * 0.5) });
  lacquer(ctx, S.back, { label: '←' });
}

function drawTitle(ctx, state, L) {
  menuScene(ctx, state, L, true);
  const items = state.saved ? ['Continue', 'New Game', 'Learn', 'Daily Deal', 'About', 'Settings', 'Rules', 'Auto Play'] : ['New Game', 'Learn', 'Daily Deal', 'About', 'Settings', 'Rules', 'Auto Play'];
  const T = L.title(items.length);
  const bob = state.calm ? 0 : Math.sin(state.t * 1.1) * 4;
  txt(ctx, 'ДУРАК', T.word.x, T.word.y + bob, { size: T.word.size, color: CREAM, weight: 700, shadow: 'rgba(0,0,0,0.6)' });
  txt(ctx, 'Durak · the card game of the fool', T.tag.x, T.tag.y + bob, { size: T.tag.size, color: GOLD, weight: 600 });
  const rot = state.calm ? -0.08 : -0.1 + Math.sin(state.t * 0.8) * 0.03, cs = T.cards.scale;
  drawCard(ctx, { id: 15 }, T.cards.x - 72 * cs, T.cards.y + bob * 0.6, { scale: cs, rot: rot - 0.12, four: state.four });
  drawCard(ctx, { id: 8 }, T.cards.x + 62 * cs, T.cards.y + 2 + bob * 0.6, { scale: cs, rot: -rot + 0.1, four: state.four });
  items.forEach((label, i) => { const r = T.btn(i); lacquer(ctx, r, { kind: i === 0 ? 'gold' : 'wood', label, size: Math.min(30, r.h * 0.46) }); });
  lacquer(ctx, T.sound, { label: state.sound ? '♪' : '×' });
  panel(ctx, T.statsL.x, T.statsL.y, T.statsL.w, T.statsL.h, {});
  txt(ctx, `Played ${state.stats.played} · Won ${state.stats.wins}`, T.statsL.x + T.statsL.w / 2, T.statsL.y + T.statsL.h / 2, { size: 19, color: CREAM, weight: 600 });
  panel(ctx, T.statsR.x, T.statsR.y, T.statsR.w, T.statsR.h, {});
  txt(ctx, `Streak ${state.daily.streak} · Lv ${state.setup.level}`, T.statsR.x + T.statsR.w / 2, T.statsR.y + T.statsR.h / 2, { size: 19, color: CREAM, weight: 600 });
  if (state.config?.demo) txt(ctx, `Web preview · ${Math.max(0, state.demoLimit - state.demoPlays)} matches left`, T.demo.x, T.demo.y, { size: 18, color: GOLD, weight: 600 });
  { const q = T.lockup, qh = q.w * 327 / 1200, dn = state.lkDown;      // the themed Arcforge lockup under the menu; a tap opens the Arcforge home
    ctx.save(); ctx.fillStyle = 'rgba(14,6,3,0.62)'; rr(ctx, q.x - q.w / 2 - 10, q.y - qh / 2 - 5, q.w + 20, qh + 10, (qh + 10) / 2); ctx.fill(); ctx.restore();
    drawLockup(ctx, q.x, q.y + (dn ? 1 : 0), q.w * (dn ? 0.96 : 1), dn ? 0.7 : 1); }
}

export function drawPlay(ctx, state, L) {
  const g = state.game, o = { four: state.four, big: state.big, backTheme: state.back, names: state.names, thinking: state.thinking, t: state.t };
  const isAuto = state.scene === 'auto', teach = state.scene === 'lesson' || state.scene === 'daily';
  playScene(ctx, state, L);
  drawTopBar(ctx, state, L, teach);
  drawStockAndTrump(ctx, g, L, o);
  for (let s = 1; s < g.n; s++) drawOpponent(ctx, g, L, s, o);
  drawTableCards(ctx, g, L, { ...o, beatable: state.beatSlots });
  if (g.mode === 'per' && state.canXfer) { const s = L.xfer(g.table.length); ctx.save(); ctx.globalAlpha = 0.55 + 0.25 * Math.sin(state.t * 5); rr(ctx, s.x - s.w / 2, s.y - s.h / 2, s.w, s.h, 14); ctx.strokeStyle = '#8ee08e'; ctx.lineWidth = 4; ctx.setLineDash([10, 8]); ctx.stroke(); ctx.setLineDash([]); ctx.restore(); }
  if (state.pickup) drawPickupFx(ctx, state.pickup, L, o);
  if (isAuto) drawAutoActions(ctx, state, L);
  else ACTIONS.forEach((k) => actionBtn(ctx, k, L, { enabled: state.actionEnabled }));
  if (state.seenOpen) drawSeenPanel(ctx, state, L);
  drawHand(ctx, g.hands[0], L, { ...o, sel: state.sel, legal: state.legalCards, drag: state.drag });
  if (state.drag) { const s = state.drag; drawCard(ctx, { id: s.c }, s.x, s.y, { scale: L.hs * 1.12, four: state.four, lift: true, glow: '#ffe27a' }); }
  if (state.hint) drawHintBanner(ctx, state, L);
  if (isAuto && !g.over) drawAutoBar(ctx, state, L);
  if (g.over) drawResult(ctx, state, L);
}
export const drawAutoPlay = drawPlay;

// Auto Play's buttons (Take/Bito/Hint/Undo/Seen have no meaning in a spectator run): Exit / Pause / Skip.
function drawAutoActions(ctx, state, L) {
  const A = state.auto, B = L.autoBtns;
  lacquer(ctx, B.exit, { label: 'Exit', size: 24 });
  lacquer(ctx, B.pause, { label: A && A.paused ? 'Resume' : 'Pause', size: 24 });
  lacquer(ctx, B.skip, { label: 'Skip', size: 24 });
}
// Auto Play's status: the phase word and the configurable think-time stepper (a strip in portrait, the right / left panels in landscape).
function drawAutoBar(ctx, state, L) {
  const A = state.auto; if (!A) return;
  const label = A.paused ? 'Paused' : A.sub === 'think' ? 'Thinking...' : 'Revealing...';
  const col = A.paused ? GOLD : '#8ee0ff', Bar = L.auto.bar, think = `Think ${AUTO_THINK_STEPS[state.autoThinkIdx]}s`;
  if (!L.land) {
    panel(ctx, Bar.x, Bar.y, Bar.w, Bar.h, {});
    txt(ctx, label, Bar.x + 100, Bar.y + Bar.h / 2, { size: 20, color: col, weight: 700, align: 'left' });
    txt(ctx, think, L.w / 2 + 40, Bar.y + Bar.h / 2, { size: 19, color: CREAM, weight: 600 });
  } else {
    const S = L.autoStatus;   // left panel: status and the think time; the right panel only has the two stepper buttons
    panel(ctx, S.x, S.y, S.w, S.h, {});
    txt(ctx, label, S.x + S.w / 2, S.y + 22, { size: 20, color: col, weight: 700 });
    txt(ctx, think, S.x + S.w / 2, S.y + 46, { size: 18, color: CREAM, weight: 600 });
  }
  lacquer(ctx, L.auto.dec, { label: '−', size: 30 });
  lacquer(ctx, L.auto.inc, { label: '+', size: 30 });
}

function drawSeenPanel(ctx, state, L) {
  const P = L.seen;
  panel(ctx, P.x, P.y, P.w, P.h, {});
  txt(ctx, 'Cards seen', P.x + P.w / 2, P.y + 42, { size: 26, color: CREAM, weight: 700 });
  const g = state.game;
  const counts = [0, 0, 0, 0];
  for (const c of g.discard) counts[suitOf(c)]++;
  for (const t of g.table) { counts[suitOf(t.a)]++; if (t.d >= 0) counts[suitOf(t.d)]++; }
  SUIT_NAMES.forEach((sn, i) => {
    const x = P.x + P.w * (i + 0.5) / 4, y = P.y + 100;
    drawSuit(ctx, i, x, y, 28, suitColor(i, state.four));
    txt(ctx, `${counts[i]}/9`, x, y + 44, { size: 22, color: CREAM, weight: 700 });
  });
  txt(ctx, `Stock left: ${g.stock.length}`, P.x + P.w / 2, P.y + 180, { size: 19, color: GOLD, weight: 600 });
}

function drawHintBanner(ctx, state, L) {
  const P = L.hint;
  panel(ctx, P.x, P.y, P.w, P.h, {});
  wrapCentered(ctx, state.hint.text, P.x + P.w / 2, P.y + 38, P.w - 60, 26, { size: 19, color: CREAM, weight: 600 });
}

function drawPickupFx(ctx, p, L, o) {
  const t = ease(p.t / p.dur);
  const spTo = L.seat(p.n, p.seat === 0 ? 1 : p.seat); // visually collapse toward the taking seat
  const hs = L.hand.slot(0, 1);
  const target = p.seat === 0 ? { x: L.w / 2 + (L.land ? (L.table.x + L.table.w / 2 - L.w / 2) : 0), y: hs.y - 40 } : spTo;
  const sc = L.tablePairs.scale;
  p.cards.forEach((c, i) => {
    const from = L.pair(Math.min(5, i));
    const x = lerp(from.x, target.x, t), y = lerp(from.y, target.y, t);
    drawCard(ctx, { id: c }, x, y, { scale: lerp(sc, sc * 0.55, t), rot: lerp(0, (i - p.cards.length / 2) * 0.1, t), back: p.seat !== 0, backTheme: o.backTheme, four: o.four });
  });
}

function drawResult(ctx, state, L) {
  ctx.save(); ctx.fillStyle = 'rgba(10,6,3,0.6)'; ctx.fillRect(0, 0, L.w, L.h); ctx.restore();
  const R = L.result, cx = R.panel.x + R.panel.w / 2;
  panel(ctx, R.panel.x, R.panel.y, R.panel.w, R.panel.h, {});
  const g = state.game, you = 0, isAuto = state.scene === 'auto';
  const line = g.loser === -1 ? 'No fool this time' : (!isAuto && g.loser === you) ? 'You are the Дурак' : `${state.names[g.loser]} is the fool`;
  const sub = isAuto ? 'Tap Play again for a new deal.' : g.loser === you ? 'Better luck in the next deal.' : g.loser === -1 ? 'Everyone finished together.' : 'Well played — you stayed safe.';
  txt(ctx, line, cx, R.title, { size: Math.min(40, R.panel.w / 11), color: (!isAuto && g.loser === you) ? '#ff8a7a' : CREAM, weight: 700 });
  txt(ctx, sub, cx, R.sub, { size: 22, color: GOLD, weight: 600 });
  lacquer(ctx, R.again, { kind: 'gold', label: 'Play again', size: 30 });
  lacquer(ctx, R.menu, { label: isAuto ? 'Exit' : 'Menu', size: 26 });
  drawMoreLine(ctx, cx, R.more, 15);
}

// Learn: the text panel (a band under the top bar in portrait, the left panel in landscape) replaces the talon row.
export function drawLesson(ctx, state, L) {
  drawPlay(ctx, state, L);
  const Ls = LESSONS[state.lesson.i], T = L.teach, P = T.panel;
  panel(ctx, P.x, P.y, P.w, P.h, {});
  const cx = P.x + P.w / 2;
  let lines;
  if (L.land) {
    txt(ctx, `Lesson ${state.lesson.i + 1} of ${LESSONS.length}`, cx, P.y + 32, { size: 21, color: GOLD, weight: 700 });
    const tn = wrapCentered(ctx, Ls.title, cx, P.y + 66, T.textW, 24, { size: 21, color: CREAM, weight: 700 });
    const y = P.y + 66 + tn * 24 + 10;
    lines = wrapCentered(ctx, state.lesson.done ? Ls.done : Ls.text, cx, y, T.textW, 24, { size: 19, color: CREAM, weight: 500 });
    if (state.msg && !state.lesson.done && state.msg !== Ls.text) wrapCentered(ctx, state.msg, cx, y + lines * 24 + 14, T.textW, 22, { size: 18, color: '#ffb0a0', weight: 600 });
  } else {
    txt(ctx, `Lesson ${state.lesson.i + 1} of ${LESSONS.length} · ${Ls.title}`, cx, P.y + 30, { size: 21, color: GOLD, weight: 700 });
    wrapCentered(ctx, state.lesson.done ? Ls.done : Ls.text, cx, P.y + 66, T.textW, 22, { size: 18, color: CREAM, weight: 500 });
  }
  if (state.lesson.done) lacquer(ctx, T.next, { kind: 'gold', label: state.lesson.i + 1 < LESSONS.length ? 'Next lesson' : 'Done', size: 24 });
}
export const lessonNextRect = (state, L) => L.teach.next;

export function drawDaily(ctx, state, L) {
  if (state.daily.status === 'making') {
    menuScene(ctx, state, L);
    lacquer(ctx, L.top.menu, { label: '←' });
    txt(ctx, 'Preparing today\'s deal…', L.w / 2, L.h / 2, { size: 30, color: CREAM, weight: 600 });
    return;
  }
  drawPlay(ctx, state, L);
  const T = L.teach, P = T.panel, p = state.daily.puzzle, cx = P.x + P.w / 2;
  panel(ctx, P.x, P.y, P.w, P.h, {});
  const solved = state.daily.status === 'solved';
  txt(ctx, p.title, cx, P.y + 34, { size: 23, color: GOLD, weight: 700 });
  const body = solved ? 'Solved! Come back tomorrow for a new deal.' : state.daily.wrongMsg || p.goal;
  wrapCentered(ctx, body, cx, P.y + 72, T.textW, L.land ? 24 : 22, { size: 18, color: CREAM, weight: 500 });
  if (L.land && state.msg && !solved) wrapCentered(ctx, state.msg, cx, P.y + 190, T.textW, 22, { size: 17, color: '#ffb0a0', weight: 600 });
  if (solved) lacquer(ctx, T.share, { kind: 'gold', label: 'Share result', size: 24 });
}
export const dailyShareRect = (L) => L.teach.share;

// Shared reader for every text-heavy reference screen (About, Rules): a header row (title, A- / A+), one framed panel whose body
// scrolls (drag, wheel, keys) so any text size fits at every window size, a page line and Back / Next. Pages that name `cards`
// show the real in-game card art via drawCard().
function drawReferencePage(ctx, state, L, list, headerTitle) {
  menuScene(ctx, state, L);
  const R = L.ref;
  const scale = TEXT_SCALES[state.textScaleIdx] ?? 1;
  txt(ctx, headerTitle, R.title.x, R.title.y, { size: 40, color: CREAM, weight: 700, shadow: 'rgba(0,0,0,0.6)', align: 'left' });
  lacquer(ctx, R.dec, { label: 'A−', disabled: state.textScaleIdx === 0 });
  lacquer(ctx, R.inc, { label: 'A+', disabled: state.textScaleIdx === TEXT_SCALES.length - 1 });
  panel(ctx, R.panel.x, R.panel.y, R.panel.w, R.panel.h, {});
  const B = R.body, cx = B.x + B.w / 2, scroll = state.refScroll || 0;
  const titleScale = Math.min(scale, 1.6), titleFontPx = Math.round(31 * titleScale), titleLh = Math.round(titleFontPx * 1.15);
  const fontPx = Math.round(29 * scale), lh = Math.round(fontPx * 1.4), gap = Math.round(10 * scale);
  // The wrapped document is laid out once per (screen, text size, geometry, font) and reused; a frame draws only the visible slice.
  ctx.font = '800 40px "Cormorant Garamond", Georgia, serif'; const fontKey = ctx.measureText('Hamburgefonstiv').width;   // changes when the web font finishes loading
  const key = [headerTitle, scale, B.x, B.y, B.w, B.h, fontKey].join('|');
  if (readerCache.key !== key || readerCache.list !== list) {
    readerStats.layouts++;
    const items = []; let y = B.y + 34;
    // One continuous reader: every section in order, separated by a thin rule.
    list.forEach((page, idx) => {
      if (idx > 0) {
        y += Math.round(fontPx * 0.4);
        items.push({ k: 'rule', y });
        y += Math.round(fontPx * 0.9);
      }
      const tl = wrapLinesC(ctx, page.title, B.w - 20, { size: titleFontPx, weight: 700 });
      items.push({ k: 'l', ls: tl, y, lh: titleLh, o: { size: titleFontPx, color: GOLD, weight: 700 } });
      y += (tl.length - 1) * titleLh + Math.round(52 * scale);
      if (page.cards) {
        const cy = y + 108, capSize = Math.round(16 * Math.min(scale, 1.15)), capLh = Math.round(capSize * 1.2);
        // Captions wrap inside their own card slot; the row's height counts every caption line, and the text below starts a full
        // text line (which grows with the text size) under the lowest caption, so nothing can overlap at any text size.
        const dx = Math.min(240, B.w / page.cards.length);
        const caps = page.cards.map((cd) => wrapLinesC(ctx, cd.label, dx - 10, { size: capSize, weight: 600 }));
        const capBottom = cy + 150 + 6 + (Math.max(...caps.map((c) => c.length)) - 1) * capLh;
        y = capBottom + 14 + Math.round(fontPx * 0.9);
        items.push({ k: 'cards', page, cy, caps, capSize, capLh, top: cy - 120, h: y - (cy - 120) });
      }
      for (const line of page.lines) { const ls = wrapLinesC(ctx, line, B.w - 20, { size: fontPx, weight: 500 }); items.push({ k: 'l', ls, y, lh, o: { size: fontPx, color: CREAM, weight: 500 } }); y += ls.length * lh + gap; }
    });
    readerCache.key = key; readerCache.list = list; readerCache.items = items; readerCache.endY = y;
  }
  ctx.save(); ctx.beginPath(); ctx.rect(B.x - 6, B.y, B.w + 12, B.h); ctx.clip(); ctx.translate(0, -scroll);
  const vtop = B.y + scroll - 60, vbot = B.y + B.h + scroll + 60;
  for (const it of readerCache.items) {
    if (it.k === 'rule') {
      if (it.y < vtop || it.y > vbot) continue;
      ctx.save(); ctx.strokeStyle = 'rgba(226,180,85,0.3)'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(B.x + 16, it.y); ctx.lineTo(B.x + B.w - 16, it.y); ctx.stroke(); ctx.restore();
    } else if (it.k === 'l') {
      if (it.y + it.ls.length * it.lh < vtop || it.y - it.o.size > vbot) continue;
      it.ls.forEach((ln, i) => { const ly = it.y + i * it.lh; if (ly > vtop - it.o.size && ly - it.o.size < vbot) txt(ctx, ln, cx, ly, { ...it.o, align: 'center' }); });
    } else if (it.top + it.h >= vtop && it.top <= vbot) {
      const cards = it.page.cards, cy = it.cy, dx = Math.min(240, B.w / cards.length);
      cards.forEach((cd, i) => {
        const x = cx + (i - (cards.length - 1) / 2) * dx;
        if (cd.back) drawCard(ctx, {}, x, cy, { scale: 0.62, back: true, backTheme: state.back });
        else drawCard(ctx, { id: cd.id }, x, cy, { scale: 0.62, four: state.four });
        it.caps[i].forEach((ln, k) => txt(ctx, ln, x, cy + 150 + k * it.capLh, { size: it.capSize, color: GOLD, weight: 600 }));
      });
    }
  }
  const total = readerCache.endY - B.y + 10;
  ctx.restore();
  state.refContent = total;
  if (total > B.h + 1) {   // scroll bar
    const S = R.scrollbar, th = Math.max(40, S.h * B.h / total), ty = S.y + (S.h - th) * (scroll / Math.max(1, total - B.h));
    ctx.save(); ctx.fillStyle = 'rgba(226,180,85,0.18)'; rr(ctx, S.x, S.y, S.w, S.h, 5); ctx.fill(); ctx.fillStyle = 'rgba(226,180,85,0.8)'; rr(ctx, S.x, ty, S.w, th, 5); ctx.fill(); ctx.restore();
  }
  lacquer(ctx, R.back, { label: 'Back' });
  lacquer(ctx, R.next, { kind: 'gold', label: 'Done' });
}
export function drawAbout(ctx, state, L) { drawReferencePage(ctx, state, L, ABOUT, 'About Durak'); }
export function drawRules(ctx, state, L) { drawReferencePage(ctx, state, L, RULES, 'Rules'); }

export function drawSettings(ctx, state, L) {
  menuScene(ctx, state, L);
  const ST = L.settings;
  lacquer(ctx, ST.back, { label: '←' });
  txt(ctx, 'Settings', ST.title.x, ST.title.y, { size: 44, color: CREAM, weight: 700, shadow: 'rgba(0,0,0,0.6)' });
  const rows = [
    { label: 'Sound', value: state.sound ? 'On' : 'Off' },
    { label: 'Reduced motion', value: state.calm ? 'On' : 'Off' },
    { label: 'Large print', value: state.big ? 'On' : 'Off' },
    { label: 'Four-colour suits', value: state.four ? 'On' : 'Off' },
    { label: 'Card back', value: state.back === 'gzhel' ? 'Gzhel' : 'Khokhloma' },
  ];
  for (let i = 0; i < 5; i++) {
    const r = ST.row(i);
    lacquer(ctx, r, { kind: 'wood' });
    txt(ctx, rows[i].label, r.x + 76, r.y + r.h / 2, { size: Math.min(24, r.h * 0.36), color: CREAM, weight: 700, align: 'left' });
    const pw = Math.min(176, r.w * 0.32), ph = Math.min(62, r.h - 16);
    plaque(ctx, r.x + r.w - 40 - pw / 2, r.y + r.h / 2, pw, ph, { hot: rows[i].value === 'On' });
    txt(ctx, rows[i].value, r.x + r.w - 40 - pw / 2, r.y + r.h / 2, { size: 21, color: rows[i].value === 'On' ? '#3a2408' : CREAM, weight: 700 });
  }
}

export function drawDemoLimit(ctx, state, L) {
  menuScene(ctx, state, L);
  const P = L.demo.panel;
  panel(ctx, P.x, P.y, P.w, P.h, {});
  txt(ctx, 'Preview complete', P.x + P.w / 2, P.y + 80, { size: 34, color: CREAM, weight: 700 });
  wrapCentered(ctx, 'You have played the free matches in this web preview. Get the full game — every match, all four computer levels and both modes — on iPhone and Android.', P.x + P.w / 2, P.y + 130, P.w - 80, 28, { size: 19, color: GOLD, weight: 500 });
}

// Centered word-wrap: each line is centred under cx (used for panel copy, lesson/puzzle text, hints). Returns the number of lines drawn.
// maxLines (optional) stops drawing after that many lines; `tight` shrinks nothing, it only exists for call-site readability.
// Reader layout cache (wrapped lines + total height). readerStats.layouts counts rebuilds (tests read it).
const readerCache = { key: '', list: null, items: [], endY: 0 };
export const readerStats = { layouts: 0 };
function wrapLinesC(ctx, text, maxW, o) {
  const words = text.split(' '); const lines = []; let line = '';
  ctx.font = `${o.weight || 500} ${o.size}px "Cormorant Garamond", Georgia, serif`;
  for (const w of words) {
    const test = line ? line + ' ' + w : w;
    if (ctx.measureText(test).width > maxW && line) { lines.push(line); line = w; } else line = test;
  }
  if (line) lines.push(line);
  return lines;
}
function wrapCentered(ctx, text, cx, y, maxW, lh, o, maxLines = 99) {
  const lines = wrapLinesC(ctx, text, maxW, o);
  lines.slice(0, maxLines).forEach((l, i) => txt(ctx, l, cx, y + i * lh, { ...o, align: 'center' }));
  return Math.min(lines.length, maxLines);
}

export function render(ctx, state, L) {
  ctx.fillStyle = '#0a0603'; ctx.fillRect(0, 0, L.w, L.h);
  if (state.scene === 'title') drawTitle(ctx, state, L);
  else if (state.scene === 'setup') drawSetup(ctx, state, L);
  else if (state.scene === 'play') drawPlay(ctx, state, L);
  else if (state.scene === 'lesson') drawLesson(ctx, state, L);
  else if (state.scene === 'daily') drawDaily(ctx, state, L);
  else if (state.scene === 'about') drawAbout(ctx, state, L);
  else if (state.scene === 'rules') drawRules(ctx, state, L);
  else if (state.scene === 'settings') drawSettings(ctx, state, L);
  else if (state.scene === 'demo-limit') drawDemoLimit(ctx, state, L);
  else if (state.scene === 'auto') drawAutoPlay(ctx, state, L);
}
