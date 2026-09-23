// All drawing. Pure function of state; no input handling here (that's game.js).
import { W, H, CARD, TOP, seatSpot, STOCK, TRUMP, DISCARD, pairSpot, TRANSFER_SLOT, TABLE_ZONE, BAR, actionRect, ACTIONS, HAND_Y, handSlot, SETUP, MENU_BTN, BACK, REF_BACK, REF_NEXT, SETTINGS_ROWS, SETTINGS_ROW, HEADER, TEXT_SCALES, AUTO_THINK_STEPS, AUTO_BAR, AUTO_DEC, AUTO_INC, autoActionRect } from './layout.js';
import { drawScene, drawFace, drawBack, lacquer, panel, plaque, rr, txt, drawSuit, suitColor, khokhloma, GOLD, CREAM, INK } from './art.js';
import { suitOf, rankOf, cardName, RANK_LABELS, SUIT_NAMES } from './rules.js';
import { LEVELS } from './ai.js';
import { LESSONS } from './lessons.js';
import { ABOUT } from './about.js';
import { RULES } from './rulesText.js';

const SUIT_WORD = { spades: 'Spades', hearts: 'Hearts', diamonds: 'Diamonds', clubs: 'Clubs' };
const ease = (t) => 1 - Math.pow(1 - Math.min(1, Math.max(0, t)), 3);
const lerp = (a, b, t) => a + (b - a) * t;

function card3D(ctx, cx, cy, rot, scale, drawInner, big) {
  ctx.save(); ctx.translate(cx, cy); ctx.rotate(rot); ctx.scale(scale, scale);
  ctx.translate(-CARD.w / 2, -CARD.h / 2);
  drawInner(ctx);
  ctx.restore();
}
function faceSprite(art, c, four, big) { return null; }

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
  plaque(ctx, x, y, o.w, 64, { hot: o.active });
  txt(ctx, o.name, x, y - 8, { size: 24, color: o.active ? '#3a2408' : CREAM, weight: 700 });
  txt(ctx, o.sub, x, y + 16, { size: 17, color: o.active ? '#5a3c10' : GOLD, weight: 600 });
}

function drawTableCards(ctx, g, t, o) {
  g.table.forEach((pair, i) => {
    const s = pairSpot(i);
    drawCard(ctx, { id: pair.a }, s.x, s.y, { scale: 0.72, rot: -0.05, four: o.four, big: o.big, backTheme: o.backTheme, glow: o.beatable && o.beatable.has(i) ? '#ffe27a' : null });
    if (pair.d >= 0) drawCard(ctx, { id: pair.d }, s.x + 26, s.y + 20, { scale: 0.72, rot: 0.09, four: o.four, big: o.big, backTheme: o.backTheme });
  });
}

function drawStockAndTrump(ctx, g, o) {
  const n = g.stock.length;
  for (let i = 0; i < Math.min(n, 6); i++) drawCard(ctx, {}, STOCK.x - i * 1.4, STOCK.y - i * 1.4, { scale: STOCK.scale, rot: 0, back: true, backTheme: o.backTheme });
  if (n > 0) drawCard(ctx, { id: g.trumpCard }, TRUMP.x + 46, TRUMP.y + 10, { scale: STOCK.scale, rot: Math.PI / 2 - 0.06, four: o.four });
  else { drawCard(ctx, { id: g.trumpCard }, TRUMP.x + 30, TRUMP.y, { scale: STOCK.scale, rot: -0.06, four: o.four }); }
  txt(ctx, `${n}`, STOCK.x, STOCK.y + 96, { size: 22, color: GOLD, weight: 700, shadow: 'rgba(0,0,0,0.6)' });
  const col = suitColor(g.trump, o.four);
  drawSuit(ctx, g.trump, DISCARD.x, DISCARD.y - 90, 26, col);
  if (g.discard.length) { for (let i = 0; i < Math.min(g.discard.length, 5); i++) drawCard(ctx, {}, DISCARD.x + i * 1.2, DISCARD.y - i * 1.2, { scale: DISCARD.scale * 0.9, rot: 0.5, back: true, backTheme: o.backTheme }); }
}

function drawOpponent(ctx, g, seat, o) {
  const sp = seatSpot(g.n, seat);
  const n = g.hands[seat].length;
  const active = g.actor === seat;
  ctx.save(); ctx.translate(sp.x, sp.y);
  const w = Math.min(sp.maxW, 34 * Math.max(1, n) * sp.scale + 40);
  for (let i = 0; i < n; i++) { const cx = (i - (n - 1) / 2) * Math.min(30, w / Math.max(1, n)); drawCard(ctx, {}, cx, 0, { scale: sp.scale, rot: (i - (n - 1) / 2) * 0.05, back: true, backTheme: o.backTheme }); }
  ctx.restore();
  seatPlaque(ctx, sp.x, sp.y + 100 * sp.scale + 44, { w: Math.max(150, w * 0.62), name: o.names[seat], sub: `${n} card${n === 1 ? '' : 's'}${g.out[seat] ? ' · safe' : ''}`, active });
  if (o.thinking && active) { ctx.save(); ctx.globalAlpha = 0.6 + 0.3 * Math.sin(o.t * 6); txt(ctx, '…', sp.x, sp.y - 100 * sp.scale - 16, { size: 34, color: GOLD }); ctx.restore(); }
}

function drawHand(ctx, hand, o) {
  const n = hand.length;
  hand.forEach((c, i) => {
    if (o.drag && o.drag.from === 'hand' && o.drag.c === c) return; // drawn separately, following the pointer
    const s = handSlot(i, n);
    const lifted = o.sel === c;
    const y = lifted ? s.y - 46 : s.y;
    drawCard(ctx, { id: c }, s.x, y, { scale: 1, rot: lifted ? 0 : s.rot, four: o.four, big: o.big, lift: lifted, glow: o.legal && o.legal.has(c) ? '#8ee08e' : (lifted ? '#ffe27a' : null) });
  });
}

function actionBtn(ctx, k, o) {
  const r = actionRect(k);
  const label = { take: 'Взять', bito: 'Бито', hint: 'Подсказка', undo: 'Отмена', seen: 'Счёт' }[k];
  const en = { take: 'Take', bito: 'Bito', hint: 'Hint', undo: 'Undo', seen: 'Seen' }[k];
  lacquer(ctx, r, { kind: k === 'hint' ? 'gold' : 'wood', disabled: !o.enabled(k), label: o.font === 'cy' ? label : en, size: 21 });
}

function drawTopBar(ctx, state) {
  lacquer(ctx, TOP.menu, { label: '☰' });
  lacquer(ctx, TOP.sound, { label: state.sound ? '♪' : '×' });
  panel(ctx, TOP.info.x, TOP.info.y, TOP.info.w, TOP.info.h, {});
  const g = state.game;
  txt(ctx, `${state.modeName} · ${SUIT_WORD[SUIT_NAMES[g.trump]]} trump`, TOP.info.x + TOP.info.w / 2, TOP.info.y + 27, { size: 21, color: CREAM, weight: 700 });
  if (state.msg) wrapCentered(ctx, state.msg, TOP.info.x + TOP.info.w / 2, TOP.info.y + 58, TOP.info.w - 40, 22, { size: 17, color: GOLD, weight: 600 });
}

function drawSetup(ctx, state) {
  drawScene(ctx, state.t, { calm: state.calm });
  txt(ctx, 'ДУРАК', W / 2, 150, { size: 96, color: CREAM, weight: 700, shadow: 'rgba(0,0,0,0.6)' });
  txt(ctx, 'New game', W / 2, 216, { size: 30, color: GOLD, weight: 600 });
  txt(ctx, 'Players', W / 2, 300, { size: 26, color: CREAM, weight: 700 });
  SETUP.players.forEach((p, i) => lacquer(ctx, p.r, { kind: state.setup.n === p.v ? 'gold' : 'wood', label: String(p.v) }));
  txt(ctx, 'Mode', W / 2, 464, { size: 26, color: CREAM, weight: 700 });
  lacquer(ctx, SETUP.modes[0], { kind: state.setup.mode === 'pod' ? 'gold' : 'wood', label: 'Podkidnoy', sub: 'throw-in' });
  lacquer(ctx, SETUP.modes[1], { kind: state.setup.mode === 'per' ? 'gold' : 'wood', label: 'Perevodnoy', sub: 'transfer' });
  txt(ctx, 'Computer strength', W / 2, 660, { size: 26, color: CREAM, weight: 700 });
  // Pre-existing bug fixed here (found via CDP screenshot while verifying Auto Play left normal
  // play unaffected, not assumed): this passed the whole `{v, r}` setup-level descriptor to
  // lacquer() instead of its `.r` rect, so every field inside was `undefined` and `lacquer()`
  // crashed at its first `createLinearGradient(..., NaN, ...)` call — silently aborting the rest of
  // `drawSetup()` (Computer strength, the blurb panel, and the Start button never rendered, so a new
  // match could never actually be started from this screen).
  LEVELS.forEach((L, i) => { const r = SETUP.levels[i].r; lacquer(ctx, r, { kind: state.setup.level === L.id ? 'gold' : 'wood', label: `${L.id} · ${L.name}`, size: 24 }); });
  panel(ctx, 40, 1176, W - 80, 96, {});
  const L = LEVELS[state.setup.level - 1];
  txt(ctx, L.blurb, W / 2, 1224, { size: 18, color: CREAM, weight: 500 });
  lacquer(ctx, SETUP.start, { kind: 'gold', label: 'Start', size: 40 });
  lacquer(ctx, BACK, { label: '←' });
}

function drawTitle(ctx, state) {
  drawScene(ctx, state.t, { calm: state.calm });
  const bob = state.calm ? 0 : Math.sin(state.t * 1.1) * 4;
  // The wordmark sits BELOW the veranda shelf/window art (which ends around y=386) so it never fights the scene.
  txt(ctx, 'ДУРАК', W / 2, 460 + bob, { size: 96, color: CREAM, weight: 700, shadow: 'rgba(0,0,0,0.6)' });
  txt(ctx, 'Durak · the card game of the fool', W / 2, 518 + bob, { size: 25, color: GOLD, weight: 600 });
  const rot = state.calm ? -0.08 : -0.1 + Math.sin(state.t * 0.8) * 0.03;
  drawCard(ctx, { id: 15 }, W / 2 - 58, 610 + bob * 0.6, { scale: 0.8, rot: rot - 0.12, four: state.four });
  drawCard(ctx, { id: 8 }, W / 2 + 50, 612 + bob * 0.6, { scale: 0.8, rot: -rot + 0.1, four: state.four });
  const items = state.saved ? ['Continue', 'New Game', 'Learn', 'Daily Deal', 'About', 'Settings', 'Rules', 'Auto Play'] : ['New Game', 'Learn', 'Daily Deal', 'About', 'Settings', 'Rules', 'Auto Play'];
  items.forEach((label, i) => lacquer(ctx, MENU_BTN(i), { kind: i === 0 && state.saved ? 'gold' : 'wood', label, size: 30 }));
  lacquer(ctx, TOP.sound, { label: state.sound ? '♪' : '×' });
  const statsY = MENU_BTN(items.length).y + 22;
  panel(ctx, 26, statsY, 300, 74, {});
  txt(ctx, `Played ${state.stats.played} · Won ${state.stats.wins}`, 176, statsY + 37, { size: 19, color: CREAM, weight: 600 });
  panel(ctx, W - 326, statsY, 300, 74, {});
  txt(ctx, `Streak ${state.daily.streak} · Lv ${state.setup.level}`, W - 176, statsY + 37, { size: 19, color: CREAM, weight: 600 });
  if (state.config?.demo) txt(ctx, `Web preview · ${Math.max(0, state.demoLimit - state.demoPlays)} matches left`, W / 2, statsY + 110, { size: 18, color: GOLD, weight: 600 });
}

export function drawPlay(ctx, state) {
  const g = state.game, o = { four: state.four, big: state.big, backTheme: state.back, names: state.names, thinking: state.thinking, t: state.t };
  const isAuto = state.scene === 'auto';
  drawScene(ctx, state.t, { calm: state.calm });
  drawTopBar(ctx, state);
  drawStockAndTrump(ctx, g, o);
  for (let s = 1; s < g.n; s++) drawOpponent(ctx, g, s, o);
  drawTableCards(ctx, g, state.t, { ...o, beatable: state.beatSlots });
  if (g.mode === 'per' && state.canXfer) { const s = TRANSFER_SLOT(g.table.length); ctx.save(); ctx.globalAlpha = 0.55 + 0.25 * Math.sin(state.t * 5); rr(ctx, s.x - s.w / 2, s.y - s.h / 2, s.w, s.h, 14); ctx.strokeStyle = '#8ee08e'; ctx.lineWidth = 4; ctx.setLineDash([10, 8]); ctx.stroke(); ctx.setLineDash([]); ctx.restore(); }
  if (state.pickup) drawPickupFx(ctx, state.pickup, o);
  if (isAuto) drawAutoActions(ctx, state);
  else ACTIONS.forEach((k) => actionBtn(ctx, k, { enabled: state.actionEnabled, font: 'en' }));
  if (state.seenOpen) drawSeenPanel(ctx, state);
  drawHand(ctx, g.hands[0], { ...o, sel: state.sel, legal: state.legalCards, drag: state.drag });
  if (state.drag) { const s = state.drag; drawCard(ctx, { id: s.c }, s.x, s.y, { scale: 1.12, four: state.four, lift: true, glow: '#ffe27a' }); }
  if (state.hint) drawHintBanner(ctx, state);
  if (isAuto && !g.over) drawAutoBar(ctx, state);
  if (g.over) drawResult(ctx, state);
  panel(ctx, 26, BAR.y - 8, 0, 0, {});
}
export const drawAutoPlay = drawPlay;

// Auto Play's bottom row: Take/Bito/Hint/Undo/Seen have no meaning in a spectator run, so the same
// action-bar row becomes three wider Exit/Pause/Skip buttons.
function drawAutoActions(ctx, state) {
  const A = state.auto;
  lacquer(ctx, autoActionRect('exit'), { label: 'Exit', size: 24 });
  lacquer(ctx, autoActionRect('pause'), { label: A && A.paused ? 'Resume' : 'Pause', size: 24 });
  lacquer(ctx, autoActionRect('skip'), { label: 'Skip', size: 24 });
}
// Auto Play's status strip: the ~60px gap between the top bar and the opponent seats is otherwise
// empty during a board scene, so the phase word + the configurable think-time stepper live there.
function drawAutoBar(ctx, state) {
  const A = state.auto; if (!A) return;
  panel(ctx, AUTO_BAR.x, AUTO_BAR.y, AUTO_BAR.w, AUTO_BAR.h, {});
  const label = A.paused ? 'Paused' : A.sub === 'think' ? 'Thinking...' : 'Revealing...';
  txt(ctx, label, AUTO_BAR.x + 120, AUTO_BAR.y + AUTO_BAR.h / 2 + 7, { size: 20, color: A.paused ? GOLD : '#8ee0ff', weight: 700, align: 'left' });
  txt(ctx, `Think ${AUTO_THINK_STEPS[state.autoThinkIdx]}s`, W / 2, AUTO_BAR.y + AUTO_BAR.h / 2 + 6, { size: 19, color: CREAM, weight: 600 });
  lacquer(ctx, AUTO_DEC, { label: '−', size: 24 });
  lacquer(ctx, AUTO_INC, { label: '+', size: 24 });
}

function drawSeenPanel(ctx, state) {
  panel(ctx, 90, 470, W - 180, 210, {});
  txt(ctx, 'Cards seen', W / 2, 512, { size: 26, color: CREAM, weight: 700 });
  const g = state.game;
  const counts = [0, 0, 0, 0];
  for (const c of g.discard) counts[suitOf(c)]++;
  for (const t of g.table) { counts[suitOf(t.a)]++; if (t.d >= 0) counts[suitOf(t.d)]++; }
  SUIT_NAMES.forEach((sn, i) => {
    const x = 150 + i * 130, y = 570;
    drawSuit(ctx, i, x, y, 28, suitColor(i, state.four));
    txt(ctx, `${counts[i]}/9`, x, y + 44, { size: 22, color: CREAM, weight: 700 });
  });
  txt(ctx, `Stock left: ${g.stock.length}`, W / 2, 640, { size: 19, color: GOLD, weight: 600 });
}

function drawHintBanner(ctx, state) {
  panel(ctx, 50, 928, W - 100, 108, {});
  wrapCentered(ctx, state.hint.text, W / 2, 968, W - 160, 26, { size: 19, color: CREAM, weight: 600 });
}

function drawPickupFx(ctx, p, o) {
  const t = ease(p.t / p.dur);
  const spTo = seatSpot(p.n, p.seat === 0 ? 1 : p.seat); // visually collapse toward the taking seat
  const target = p.seat === 0 ? { x: W / 2, y: HAND_Y - 40 } : spTo;
  p.cards.forEach((c, i) => {
    const from = pairSpot(Math.min(5, i));
    const x = lerp(from.x, target.x, t), y = lerp(from.y, target.y, t);
    drawCard(ctx, { id: c }, x, y, { scale: lerp(0.72, 0.4, t), rot: lerp(0, (i - p.cards.length / 2) * 0.1, t), back: p.seat !== 0, backTheme: o.backTheme, four: o.four });
  });
}

function drawResult(ctx, state) {
  ctx.save(); ctx.fillStyle = 'rgba(10,6,3,0.6)'; ctx.fillRect(0, 0, W, H); ctx.restore();
  panel(ctx, 80, 560, W - 160, 340, {});
  const g = state.game, you = 0, isAuto = state.scene === 'auto';
  const line = g.loser === -1 ? 'No fool this time' : (!isAuto && g.loser === you) ? 'You are the Дурак' : `${state.names[g.loser]} is the fool`;
  const sub = isAuto ? 'Tap Play again for a new deal.' : g.loser === you ? 'Better luck in the next deal.' : g.loser === -1 ? 'Everyone finished together.' : 'Well played — you stayed safe.';
  txt(ctx, line, W / 2, 660, { size: 40, color: (!isAuto && g.loser === you) ? '#ff8a7a' : CREAM, weight: 700 });
  txt(ctx, sub, W / 2, 716, { size: 22, color: GOLD, weight: 600 });
  lacquer(ctx, { x: 130, y: 800, w: 460, h: 90 }, { kind: 'gold', label: 'Play again', size: 30 });
  lacquer(ctx, { x: 130, y: 908, w: 460, h: 76 }, { label: isAuto ? 'Exit' : 'Menu', size: 26 });
}

const LESSON_PANEL = { x: 40, y: 432, w: W - 80 };
export function drawLesson(ctx, state) {
  drawPlay(ctx, state);
  const L = LESSONS[state.lesson.i];
  const h = state.lesson.done ? 216 : 176;
  panel(ctx, LESSON_PANEL.x, LESSON_PANEL.y, LESSON_PANEL.w, h, {});
  txt(ctx, `Lesson ${state.lesson.i + 1} of ${LESSONS.length} · ${L.title}`, W / 2, LESSON_PANEL.y + 36, { size: 21, color: GOLD, weight: 700 });
  wrapCentered(ctx, state.lesson.done ? L.done : L.text, W / 2, LESSON_PANEL.y + 74, LESSON_PANEL.w - 60, 25, { size: 18, color: CREAM, weight: 500 });
  if (state.lesson.done) lacquer(ctx, lessonNextRect(state), { kind: 'gold', label: state.lesson.i + 1 < LESSONS.length ? 'Next lesson' : 'Done', size: 24 });
  lacquer(ctx, BACK, { label: '←' });
}
export const lessonNextRect = (state) => ({ x: W / 2 - 150, y: LESSON_PANEL.y + (state.lesson.done ? 216 : 176) - 90, w: 300, h: 72 });

const DAILY_PANEL = { x: 40, y: 432, w: W - 80, h: 150 };
export function drawDaily(ctx, state) {
  drawScene(ctx, state.t, { calm: state.calm });
  lacquer(ctx, BACK, { label: '←' });
  if (state.daily.status === 'making') {
    txt(ctx, 'Preparing today\'s deal…', W / 2, H / 2, { size: 30, color: CREAM, weight: 600 });
    return;
  }
  drawPlay(ctx, state);
  panel(ctx, DAILY_PANEL.x, DAILY_PANEL.y, DAILY_PANEL.w, DAILY_PANEL.h, {});
  const p = state.daily.puzzle;
  txt(ctx, p.title, W / 2, DAILY_PANEL.y + 34, { size: 23, color: GOLD, weight: 700 });
  wrapCentered(ctx, state.daily.status === 'solved' ? 'Solved! Come back tomorrow for a new deal.' : state.daily.wrongMsg || p.goal, W / 2, DAILY_PANEL.y + 70, DAILY_PANEL.w - 60, 24, { size: 18, color: CREAM, weight: 500 });
  if (state.daily.status === 'solved') lacquer(ctx, dailyShareRect(), { kind: 'gold', label: 'Share result', size: 24 });
}
export const dailyShareRect = () => ({ x: W / 2 - 190, y: DAILY_PANEL.y + DAILY_PANEL.h + 20, w: 380, h: 70 });

// Shared reader-panel layout for every text-heavy reference screen (About, Rules): a framed panel
// (art.js's own panel(), the same lacquer-and-khokhloma frame used everywhere else in this game)
// holding a page title and body copy, with Back/Next paging and an A-/A+ text-size stepper in the
// header row (reusing lacquer(), this game's own button style — its built-in `disabled` dimming
// covers the "dimmed at each end" requirement for free). Pages that name `cards` show the real
// in-game card art via drawCard(), paired with a plain-language caption, exactly as the table itself
// draws cards — never a separate simplified icon.
function drawReferencePage(ctx, state, list, headerTitle) {
  drawScene(ctx, state.t, { calm: state.calm });
  const page = list[state.page % list.length];
  // Falls back to 1 for any out-of-range index (e.g. a save from a build with a since-changed array).
  const scale = TEXT_SCALES[state.textScaleIdx] ?? 1;
  // Text-size stepper: two small pills in the top corners only, clear of the title below them.
  lacquer(ctx, HEADER.textDec, { label: 'A−', disabled: state.textScaleIdx === 0 });
  lacquer(ctx, HEADER.textInc, { label: 'A+', disabled: state.textScaleIdx === TEXT_SCALES.length - 1 });
  txt(ctx, headerTitle, W / 2, 120, { size: 46, color: CREAM, weight: 700, shadow: 'rgba(0,0,0,0.6)' });
  // One tall panel holds the whole page, so the busy veranda scene never bleeds through behind the
  // text. Its bottom now stays clear of the Back/Next nav row (REF_BACK/REF_NEXT, y:1416) and the
  // "Page X of Y" indicator between them, instead of sharing a crowded header row with Back/Next.
  const panelY = 200, panelBottom = 1370;
  panel(ctx, 40, panelY, W - 80, panelBottom - panelY, {});
  let y = panelY + 66;
  // The title font is capped well below the body's growth (unlike body text, a title is one short
  // phrase that cannot rewrap into a narrower measure) and wraps onto a second line if it still would
  // run past the panel's edges at the highest steps, so it never runs off the panel at 300%.
  const titleScale = Math.min(scale, 1.6);
  const titleFontPx = Math.round(31 * titleScale);
  const titleLh = Math.round(titleFontPx * 1.15);
  const titleLines = wrapCentered(ctx, page.title, W / 2, y, W - 160, titleLh, { size: titleFontPx, color: GOLD, weight: 700 });
  y += (titleLines - 1) * titleLh + Math.round(56 * scale);
  if (page.cards) {
    const cy = y + 108, dx = 120;
    page.cards.forEach((cd, i) => {
      const x = W / 2 + (i - (page.cards.length - 1) / 2) * dx * 2;
      if (cd.back) drawCard(ctx, {}, x, cy, { scale: 0.62, back: true, backTheme: state.back });
      else drawCard(ctx, { id: cd.id }, x, cy, { scale: 0.62, four: state.four });
      txt(ctx, cd.label, x, cy + 150, { size: Math.round(16 * Math.min(scale, 1.15)), color: GOLD, weight: 600 });
    });
    y = cy + 192;
  }
  const fontPx = Math.round(29 * scale), lh = Math.round(fontPx * 1.4), gap = Math.round(10 * scale);
  for (const line of page.lines) y += wrapCentered(ctx, line, W / 2, y, W - 160, lh, { size: fontPx, color: CREAM, weight: 500 }) * lh + gap;
  // A small crossed-cards flourish (the same pair the title screen shows) — only where a short page has
  // genuinely left clear room below its last line, never crowding a longer page's text or its "cards" art.
  if (!page.cards && y + 220 < panelBottom) {
    const sy = Math.min(panelBottom - 130, y + 130);
    drawCard(ctx, { id: 15 }, W / 2 - 46, sy, { scale: 0.5, rot: -0.14, four: state.four });
    drawCard(ctx, { id: 8 }, W / 2 + 40, sy, { scale: 0.5, rot: 0.12, four: state.four });
  }
  txt(ctx, `Page ${(state.page % list.length) + 1} of ${list.length}`, W / 2, 1392, { size: 19, color: 'rgba(247,239,220,0.6)', weight: 500 });
  // Back/Next: an equal-width bottom pill pair, clear of the reader panel above it. Back is the
  // neutral/secondary action, Next the primary one (lacquer's own 'gold' kind, the same accent the
  // title screen's "Play again"/"Start" buttons use).
  lacquer(ctx, REF_BACK, { label: 'Back' });
  lacquer(ctx, REF_NEXT, { kind: 'gold', label: 'Next' });
}
export function drawAbout(ctx, state) { drawReferencePage(ctx, state, ABOUT, 'About Durak'); }
// Paginated Rules reference (Back/Next/"Page N of M", the same convention as About above).
export function drawRules(ctx, state) { drawReferencePage(ctx, state, RULES, 'Rules'); }

export function drawSettings(ctx, state) {
  drawScene(ctx, state.t, { calm: state.calm });
  lacquer(ctx, BACK, { label: '←' });
  txt(ctx, 'Settings', W / 2, 150, { size: 44, color: CREAM, weight: 700, shadow: 'rgba(0,0,0,0.6)' });
  const rows = [
    { label: 'Sound', value: state.sound ? 'On' : 'Off' },
    { label: 'Reduced motion', value: state.calm ? 'On' : 'Off' },
    { label: 'Large print', value: state.big ? 'On' : 'Off' },
    { label: 'Four-colour suits', value: state.four ? 'On' : 'Off' },
    { label: 'Card back', value: state.back === 'gzhel' ? 'Gzhel' : 'Khokhloma' },
  ];
  for (let i = 0; i < SETTINGS_ROWS; i++) {
    const r = SETTINGS_ROW(i);
    lacquer(ctx, r, { kind: 'wood' });
    txt(ctx, rows[i].label, r.x + 34, r.y + r.h / 2, { size: 24, color: CREAM, weight: 700, align: 'left' });
    plaque(ctx, r.x + r.w - 108, r.y + r.h / 2, 176, 62, { hot: rows[i].value === 'On' });
    txt(ctx, rows[i].value, r.x + r.w - 108, r.y + r.h / 2, { size: 21, color: rows[i].value === 'On' ? '#3a2408' : CREAM, weight: 700 });
  }
}

export function drawDemoLimit(ctx, state) {
  drawScene(ctx, state.t, { calm: state.calm });
  panel(ctx, 60, 520, W - 120, 340, {});
  txt(ctx, 'Preview complete', W / 2, 600, { size: 34, color: CREAM, weight: 700 });
  wrapText(ctx, 'You have played the free matches in this web preview. Get the full game — every match, all four computer levels and both modes — on iPhone and Android.', W / 2 - 260, 650, 520, 26, { size: 19, color: GOLD, align: 'left' });
}

function wrapText(ctx, text, x, y, maxW, lh, o) {
  const words = text.split(' '); let line = '', yy = y;
  ctx.font = `${o.weight || 500} ${o.size}px "Cormorant Garamond", Georgia, serif`;
  for (const w of words) {
    const test = line ? line + ' ' + w : w;
    if (ctx.measureText(test).width > maxW && line) { txt(ctx, line, x, yy, { ...o, align: o.align || 'left' }); line = w; yy += lh; }
    else line = test;
  }
  if (line) txt(ctx, line, x, yy, { ...o, align: o.align || 'left' });
}
// Centered word-wrap: each line is centred under cx (used for panel copy, lesson/puzzle text, hints).
function wrapCentered(ctx, text, cx, y, maxW, lh, o) {
  const words = text.split(' '); const lines = []; let line = '';
  ctx.font = `${o.weight || 500} ${o.size}px "Cormorant Garamond", Georgia, serif`;
  for (const w of words) {
    const test = line ? line + ' ' + w : w;
    if (ctx.measureText(test).width > maxW && line) { lines.push(line); line = w; } else line = test;
  }
  if (line) lines.push(line);
  lines.forEach((l, i) => txt(ctx, l, cx, y + i * lh, { ...o, align: 'center' }));
  return lines.length;
}

export function render(ctx, state) {
  ctx.fillStyle = '#0a0603'; ctx.fillRect(0, 0, W, H);
  if (state.scene === 'title') drawTitle(ctx, state);
  else if (state.scene === 'setup') drawSetup(ctx, state);
  else if (state.scene === 'play') drawPlay(ctx, state);
  else if (state.scene === 'lesson') drawLesson(ctx, state);
  else if (state.scene === 'daily') drawDaily(ctx, state);
  else if (state.scene === 'about') drawAbout(ctx, state);
  else if (state.scene === 'rules') drawRules(ctx, state);
  else if (state.scene === 'settings') drawSettings(ctx, state);
  else if (state.scene === 'demo-limit') drawDemoLimit(ctx, state);
  else if (state.scene === 'auto') drawAutoPlay(ctx, state);
}
