// Everything drawn each frame. Reads `state` (game.js). The only things it writes back are layout caches that the next
// update needs: `state.maxScroll` (how far a page can scroll) and `state.hits` (settings tap rectangles).
import { W, H as HH, CW, CH, BW, BH, HAND_Y, LIFT, BTN, TRICK, SEAT, DECK, TSC, TOAST, TABLE, PLATE_US, PLATE_THEM, STAKE, VIRA, TRICKS, TRUCO_BTN, ANS, ACT, PANEL, SIGPOP, SIGCLOSE, OVERLAY_BTN, OVERLAY_BTN2, BACK, REF_BACK, REF_NEXT, REF_PANEL, TEXT_SCALES, TEXT_DEC, TEXT_INC, AUTO_THINK_STEPS, AUTO_BAR, AUTO_DEC, AUTO_INC, HEADER_H, titleRows, largeTitle, handSlot } from './layout.js';
import { drawBackground, drawTable, drawCard, button, plaque, rr, drawSuit, drawGesture, bunting, star8, FONT, UI, GOLD, CREAM, GREEN, SUIT_INK } from './art.js';
import * as RL from './rules.js';
import { levelOf } from './ai.js';
import { RULES, ABOUT, HOWTO } from './rulesContent.js';

const TAU = Math.PI * 2;
const NAMES4 = ['You', 'Right', 'Partner', 'Left'];
const DIM = 'rgba(255,246,221,0.78)';

// ---- text helpers -----------------------------------------------------------------------------------------------
function makeV(ctx) {
  const text = (str, x, y, size, color = CREAM, font = UI, weight = 700, align = 'center') => { ctx.textAlign = align; ctx.font = `${weight} ${size}px ${font}`; ctx.fillStyle = color; ctx.fillText(str, x, y); };
  const shadowText = (str, x, y, size, color = CREAM, font = UI, weight = 700, align = 'center') => { ctx.save(); ctx.shadowColor = 'rgba(0,0,0,0.75)'; ctx.shadowBlur = 8; ctx.shadowOffsetY = 2; text(str, x, y, size, color, font, weight, align); ctx.restore(); };
  // greedy word wrap that also breaks over-long hyphenated words; returns lines
  const lines = (str, size, maxW, weight = 600, font = UI) => {
    ctx.font = `${weight} ${size}px ${font}`;
    const words = [];
    for (const rw of String(str).split(' ')) {
      if (ctx.measureText(rw).width > maxW && rw.includes('-')) { const parts = rw.split('-'); parts.forEach((p, i) => words.push(i < parts.length - 1 ? p + '-' : p)); } else words.push(rw);
    }
    const out = []; let cur = '';
    for (const w of words) { const t2 = cur ? cur + ' ' + w : w; if (ctx.measureText(t2).width > maxW && cur) { out.push(cur); cur = w; } else cur = t2; }
    out.push(cur); return out;
  };
  const wrap = (str, x, y, size, maxW, color = CREAM, lh = size * 1.32, align = 'center', weight = 600, font = UI) => {
    const ls = lines(str, size, maxW, weight, font); ls.forEach((ln, i) => text(ln, x, y + i * lh, size, color, font, weight, align)); return ls.length;
  };
  return { text, shadowText, lines, wrap };
}
// A vertical flow inside a clipped, scrollable region. Draws as it measures; returns the content height.
function flow(ctx, V, state, region, build) {
  ctx.save(); ctx.beginPath(); ctx.rect(region.x, region.y, region.w, region.h); ctx.clip();
  const F = { y: region.y - state.scroll, x0: region.x + 34, w: region.w - 68, cx: region.x + region.w / 2, top: region.y };
  F.gap = (n) => { F.y += n; };
  F.p = (str, size, color = CREAM, weight = 600, align = 'left', gap = 0.55, font = UI) => {
    const lh = Math.round(size * 1.36), ls = V.lines(str, size, F.w, weight, font);
    const x = align === 'center' ? F.cx : align === 'right' ? F.x0 + F.w : F.x0;
    ls.forEach((ln, i) => V.text(ln, x, F.y + size + i * lh, size, color, font, weight, align));
    F.y += ls.length * lh + Math.round(size * gap);
  };
  F.line = () => { ctx.strokeStyle = 'rgba(255,210,63,0.45)'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(F.x0 + 20, F.y); ctx.lineTo(F.x0 + F.w - 20, F.y); ctx.stroke(); F.y += 22; };
  build(F);
  const total = F.y + state.scroll - region.y + 30;
  ctx.restore();
  state.maxScroll = Math.max(0, total - region.h);
  if (state.maxScroll > 0) {
    const th = Math.max(50, region.h * region.h / total), ty = region.y + (region.h - th) * (state.scroll / state.maxScroll);
    ctx.fillStyle = 'rgba(255,210,63,0.55)'; rr(ctx, region.x + region.w - 8, ty, 5, th, 3); ctx.fill();
  }
  return total;
}

export function render(ctx, state) {
  const sc = state.scene, t = state.t, V = makeV(ctx);
  ctx.save();
  if (state.shake > 0 && !state.set.calm) ctx.translate(Math.sin(t * 90) * state.shake * 0.5, Math.cos(t * 77) * state.shake * 0.4);
  drawBackground(ctx, t);
  if (sc === 'title') title(ctx, state, V);
  else if (sc === 'settings') settingsPage(ctx, state, V);
  else if (sc === 'about') refPage(ctx, state, V, ABOUT, state.aboutPage, 'About');
  else if (sc === 'how') refPage(ctx, state, V, HOWTO, state.howPage, 'How to Play');
  else if (sc === 'rules') refPage(ctx, state, V, RULES, state.page, 'Game Rules');
  else if (sc === 'over') overPage(ctx, state, V);
  else if (sc === 'demo-limit') demoPage(ctx, state, V);
  else if (state.H) table(ctx, state, V);
  ctx.restore();
}

// ---- the title ----------------------------------------------------------------------------------------------------
function fanCards(variant) {
  // Paulista: a vira of 6 turns the four 7s into manilhas. Mineiro: the four fixed manilhas.
  if (variant === 'mineiro') return [RL.card(0, 3), RL.card(1, 7), RL.card(2, 3), RL.card(3, 0)];
  return [RL.card(0, 3), RL.card(1, 3), RL.card(2, 3), RL.card(3, 3)];
}
function zoomPills(ctx, state) {
  plaque(ctx, TEXT_DEC, 0.95); plaque(ctx, TEXT_INC, 0.95);
  button(ctx, TEXT_DEC, 'A−', { size: 26, dim: state.textScaleIdx === 0 });
  button(ctx, TEXT_INC, 'A+', { size: 26, dim: state.textScaleIdx >= TEXT_SCALES.length - 1 });
  ctx.fillStyle = DIM; ctx.font = `700 22px ${UI}`; ctx.textAlign = 'center'; ctx.fillText(`${Math.round(TEXT_SCALES[state.textScaleIdx] * 100)}%`, W / 2, 62);
}
function titleHeader(ctx, state, V, k) {
  const t = state.t, yo = 0;
  bunting(ctx, t, 0, 1);
  const g = ctx.createRadialGradient(W / 2, 520 * k, 20, W / 2, 520 * k, 360); g.addColorStop(0, 'rgba(255,210,63,0.22)'); g.addColorStop(1, 'rgba(255,210,63,0)'); ctx.fillStyle = g; ctx.fillRect(0, 100, W, 720);
  const cards = fanCards(state.variant);
  cards.forEach((c, i) => {
    const a = (i - 1.5) * 0.2 + Math.sin(t * 0.8 + i) * 0.015, cx = W / 2 + (i - 1.5) * 120, cy = (560 + Math.abs(i - 1.5) * 24) * k + yo;
    ctx.save(); ctx.translate(cx, cy + 150 * k); ctx.rotate(a); ctx.translate(-CW * 0.5, -CH * 0.9 - 150 * k + 150 * k);
    drawCard(ctx, c, 0, -CH * 0.15, 1.0, { big: state.set.big, four: state.set.four, man: true, t: t + i * 0.3 }); ctx.restore();
  });
  ctx.save(); ctx.shadowColor = 'rgba(255,200,40,0.7)'; ctx.shadowBlur = 30;
  const gr = ctx.createLinearGradient(0, 150, 0, 270); gr.addColorStop(0, '#fff2a0'); gr.addColorStop(1, '#f2b705');
  V.text('Truco', W / 2, 262, 190, gr, FONT, 800); ctx.restore();
  // ribbon
  ctx.save(); ctx.translate(W / 2, 318); ctx.fillStyle = GREEN; rr(ctx, -250, -28, 500, 56, 10); ctx.fill(); ctx.strokeStyle = GOLD; ctx.lineWidth = 3; ctx.stroke(); ctx.restore();
  V.text('BRASILEIRO  ·  MANILHA', W / 2, 336, 28, '#fff2a0', UI, 800);
  V.shadowText('Shout it. Bluff it. Win with the manilha.', W / 2, 394, 26, '#fff6dd', UI, 600);
  ctx.fillStyle = DIM; ctx.font = `700 20px ${UI}`; ctx.textAlign = 'center';
  ctx.fillText(state.variant === 'mineiro' ? 'Zap · Copas · Espadilha · Pica-fumo: always the same four' : 'The vira turns four manilhas: Zap · Copas · Espadilha · Pica-fumo', W / 2, 790);
}
function title(ctx, state, V) {
  const k = state.textScaleIdx > 0 ? 0.64 : 1;
  if (state.textScaleIdx > 0) return titleLarge(ctx, state, V);
  titleHeader(ctx, state, V, k);
  const R = titleRows(!!state.saved), V0 = RL.VARIANTS;
  if (R.resume) button(ctx, R.resume, 'Resume match', { primary: true, size: 34, sub: `You ${state.saved.match.scores[0]}, Them ${state.saved.match.scores[1]}` });
  button(ctx, R.play, 'Play a match', { primary: !R.resume, size: 38, sub: `${V0[state.variant].name}, ${state.n === 4 ? 'with a partner' : 'head to head'}, to ${RL.TARGET}` });
  const seg = (rects, labels, active) => rects.forEach((r, i) => button(ctx, r, labels[i], { size: 26, on: i === active, dim: false }));
  seg(R.variant, ['Paulista', 'Mineiro'], state.variant === 'paulista' ? 0 : 1);
  seg(R.players, ['2 players', '4 players'], state.n === 2 ? 0 : 1);
  seg(R.level, ['Rookie', 'Regular', 'Master'], state.level - 1);
  button(ctx, R.how, 'How to Play', { size: 28 }); button(ctx, R.rules, 'Rules', { size: 28 });
  button(ctx, R.about, 'About', { size: 24 }); button(ctx, R.settings, 'Settings', { size: 24 }); button(ctx, R.auto, 'Auto Play', { size: 24 });
  V.text(levelOf(state.level).blurb, W / 2, R.auto.y + 124, 21, DIM, UI, 600);
  zoomPills(ctx, state);
}
function titleLarge(ctx, state, V) {
  const k = TEXT_SCALES[state.textScaleIdx], L = largeTitle(k, !!state.saved), sy = state.scroll;
  ctx.save(); ctx.translate(0, -sy);
  bunting(ctx, state.t, 0, 1);
  ctx.save(); ctx.shadowColor = 'rgba(255,200,40,0.7)'; ctx.shadowBlur = 20;
  const gr = ctx.createLinearGradient(0, 120, 0, 230); gr.addColorStop(0, '#fff2a0'); gr.addColorStop(1, '#f2b705');
  V.text('Truco', W / 2, 220, 140, gr, FONT, 800); ctx.restore();
  V.text('BRASILEIRO  ·  MANILHA', W / 2, 280, 26, '#fff2a0', UI, 800);
  const label = { resume: 'Resume match', play: 'Play a match', variant: `Style: ${RL.VARIANTS[state.variant].name}`, players: `Players: ${state.n}`, level: `Level: ${levelOf(state.level).name}`, how: 'How to Play', rules: 'Rules', about: 'About', settings: 'Settings', auto: 'Auto Play' };
  const sub = { variant: 'tap to switch', players: 'tap to switch', level: 'tap to change' };
  for (const [id, r] of Object.entries(L.rows)) button(ctx, r, label[id], { size: Math.round(30 * k), primary: id === 'play', sub: sub[id] });
  ctx.restore();
  state.maxScroll = Math.max(0, L.contentH - HH);
  zoomPills(ctx, state);
}

// ---- simple pages -------------------------------------------------------------------------------------------------
function pageFrame(ctx, V, titleText) {
  ctx.fillStyle = 'rgba(3,20,17,0.55)'; ctx.fillRect(0, 0, W, HH);
  V.text(titleText, W / 2, 118, 60, CREAM, FONT, 800); button(ctx, BACK, 'Back', { size: 26 });
}
function toggle(ctx, x, y, on) {
  const p = { x, y, w: 104, h: 52 };
  ctx.fillStyle = on ? '#ffd23f' : 'rgba(0,0,0,0.5)'; rr(ctx, p.x, p.y, p.w, p.h, 26); ctx.fill();
  ctx.fillStyle = on ? '#2a1606' : '#fff6dd'; ctx.beginPath(); ctx.arc(on ? p.x + p.w - 26 : p.x + 26, p.y + 26, 20, 0, TAU); ctx.fill();
}
function settingsPage(ctx, state, V) {
  pageFrame(ctx, V, 'Settings');
  const k = TEXT_SCALES[state.textScaleIdx] ?? 1, hits = [];
  const rows = [['sound', 'Sound', 'Card slaps, shouts and chimes'], ['calm', 'Reduced motion', 'Quicker, calmer animation and fewer particles'], ['big', 'Large-print cards', 'Bigger ranks and suits on every card'], ['four', 'Four-colour suits', 'Easier to tell the suits apart']];
  flow(ctx, V, state, { x: 20, y: 150, w: 680, h: 1360 }, (F) => {
    const lsz = Math.round(30 * k), ssz = Math.round(21 * k), tw = 130, tx = F.x0 + F.w - tw;
    for (const [key, label, sub] of rows) {
      const ll = V.lines(label, lsz, F.w - tw - 50, 800), sl = V.lines(sub, ssz, F.w - tw - 50, 600);
      const h = 40 + ll.length * Math.round(lsz * 1.25) + sl.length * Math.round(ssz * 1.3) + 14;
      const r = { x: F.x0, y: F.y, w: F.w, h }; button(ctx, r, '', {});
      ll.forEach((ln, i) => V.text(ln, r.x + 26, r.y + 26 + lsz + i * Math.round(lsz * 1.25), lsz, CREAM, UI, 800, 'left'));
      const y2 = r.y + 26 + ll.length * Math.round(lsz * 1.25) + 6;
      sl.forEach((ln, i) => V.text(ln, r.x + 26, y2 + ssz + i * Math.round(ssz * 1.3), ssz, DIM, UI, 600, 'left'));
      toggle(ctx, tx, r.y + h / 2 - 26, state.set[key]);
      hits.push({ key, r });
      F.y += h + 18;
    }
    // text size row
    const lsz2 = Math.round(30 * k), ll = V.lines('Text size', lsz2, F.w - 60, 800), sl = V.lines(`${Math.round(k * 100)}% on the rules, about and menu pages`, Math.round(21 * k), F.w - 60, 600);
    const h = 40 + ll.length * Math.round(lsz2 * 1.25) + sl.length * Math.round(21 * k * 1.3) + 110;
    const r = { x: F.x0, y: F.y, w: F.w, h }; button(ctx, r, '', {});
    ll.forEach((ln, i) => V.text(ln, r.x + 26, r.y + 26 + lsz2 + i * Math.round(lsz2 * 1.25), lsz2, CREAM, UI, 800, 'left'));
    const y2 = r.y + 26 + ll.length * Math.round(lsz2 * 1.25) + 6;
    sl.forEach((ln, i) => V.text(ln, r.x + 26, y2 + Math.round(21 * k) + i * Math.round(21 * k * 1.3), Math.round(21 * k), DIM, UI, 600, 'left'));
    const by = r.y + h - 90, dec = { x: r.x + 26, y: by, w: 130, h: 68 }, inc = { x: r.x + r.w - 156, y: by, w: 130, h: 68 };
    button(ctx, dec, 'A−', { size: 28, dim: state.textScaleIdx === 0 }); button(ctx, inc, 'A+', { size: 28, dim: state.textScaleIdx >= TEXT_SCALES.length - 1 });
    hits.push({ key: 'dec', r: dec }, { key: 'inc', r: inc });
    F.y += h + 24;
    F.p('Preview', 24, DIM, 700, 'center', 0.4);
    const py = F.y; [RL.card(1, 7), RL.card(2, 3), RL.card(3, 0), RL.card(0, 9)].forEach((c, i) => drawCard(ctx, c, F.x0 + i * 150 + 10, py, 0.8, { big: state.set.big, four: state.set.four, man: i === 2, t: state.t }));
    F.y += 190;
    F.p('Your choices are saved on this device.', 22, DIM, 600, 'center');
  });
  state.hits = hits;
}
function drawRuleCards(ctx, state, V, F, list) {
  const n = list.length, gap = 14, maxW = F.w;
  const sc = Math.min(0.62, (maxW - (n - 1) * gap) / (n * CW)), w = CW * sc, h = CH * sc;
  let x = F.cx - (n * w + (n - 1) * gap) / 2; const y0 = F.y + 6;
  for (const it of list) {
    drawCard(ctx, it.c, x, y0, sc, { four: state.set.four, big: state.set.big, man: !!it.man, t: state.t });
    V.text(it.label, x + w / 2, y0 + h + 24, 17, CREAM, UI, 700);
    x += w + gap;
  }
  F.y += h + 50;
}
function refPage(ctx, state, V, list, page, header) {
  ctx.fillStyle = 'rgba(2,14,12,0.88)'; ctx.fillRect(0, 0, W, HH);
  const k = TEXT_SCALES[state.textScaleIdx] ?? 1, item = list[page % list.length];
  plaque(ctx, REF_PANEL, 0.62);
  ctx.save(); ctx.strokeStyle = 'rgba(255,210,63,0.28)'; ctx.lineWidth = 1; rr(ctx, REF_PANEL.x + 8, REF_PANEL.y + 8, REF_PANEL.w - 16, REF_PANEL.h - 16, 14); ctx.stroke(); ctx.restore();
  const region = { x: REF_PANEL.x + 4, y: REF_PANEL.y + 96, w: REF_PANEL.w - 8, h: REF_PANEL.h - 150 };
  const hs = Math.min(Math.round(36 * k), 46), ts = Math.round(33 * k), bs = Math.round(30 * k);
  // header sits inside the panel above the scroll region (wrapped, never shrunk)
  const hl = V.lines(header, hs, REF_PANEL.w - 60, 800, FONT);
  ctx.save(); ctx.beginPath(); ctx.rect(REF_PANEL.x, REF_PANEL.y, REF_PANEL.w, 100); ctx.clip();
  hl.forEach((ln, i) => V.text(ln, W / 2, REF_PANEL.y + 22 + hs + i * Math.round(hs * 1.1), hs, CREAM, FONT, 800));
  ctx.restore();
  ctx.strokeStyle = 'rgba(255,210,63,0.5)'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(REF_PANEL.x + 50, REF_PANEL.y + 92); ctx.lineTo(REF_PANEL.x + REF_PANEL.w - 50, REF_PANEL.y + 92); ctx.stroke();
  flow(ctx, V, state, region, (F) => {
    F.p(item.title, ts, GOLD, 800, 'center', 0.5, FONT);
    if (item.cards && item.cards.length) drawRuleCards(ctx, state, V, F, item.cards);
    for (const line of item.lines) F.p(line, bs, CREAM, 600, 'left', 0.7);
  });
  V.text(`Page ${(page % list.length) + 1} of ${list.length}`, W / 2, REF_PANEL.y + REF_PANEL.h - 14, 20, DIM, UI, 600);
  button(ctx, REF_BACK, 'Back', { size: 34 });
  button(ctx, REF_NEXT, page % list.length >= list.length - 1 ? 'Done' : 'Next', { size: 34, primary: true });
  zoomPills(ctx, state);
}
function demoPage(ctx, state, V) {
  ctx.fillStyle = 'rgba(3,20,17,0.6)'; ctx.fillRect(0, 0, W, HH);
  bunting(ctx, state.t);
  V.text('That was the preview', W / 2, 500, 60, CREAM, FONT, 800);
  V.wrap('Get the full game on iPhone or Android: unlimited matches, both Paulista and Mineiro, 2 or 4 players, and all three computer levels.', W / 2, 590, 30, 560, CREAM, 42);
  button(ctx, OVERLAY_BTN, 'Back to title', { primary: true, size: 30 });
}
function overPage(ctx, state, V) {
  const won = state.match.winner === 0, m = state.match, k = TEXT_SCALES[state.textScaleIdx] ?? 1, t = state.t, st = state.stats;
  ctx.fillStyle = 'rgba(3,20,17,0.62)'; ctx.fillRect(0, 0, W, HH);
  flow(ctx, V, state, { x: 10, y: 96, w: 700, h: 1050 }, (F) => {
    F.p(won ? 'You win the match!' : 'They win the match', Math.round(54 * k), CREAM, 800, 'center', 0.4, FONT);
    F.p(`Us ${m.scores[0]}   Them ${m.scores[1]}`, Math.round(50 * k), GOLD, 800, 'center', 0.4);
    F.p(`${m.hands} hand${m.hands === 1 ? '' : 's'} to ${RL.TARGET}. ${RL.VARIANTS[state.variant].name}, ${state.n} players, ${levelOf(state.level).name}.`, Math.round(25 * k), DIM, 600, 'center', 0.5);
    F.p(won ? 'Well played. The table is yours.' : 'A close match is good practice. Try Hint, or watch Auto Play.', Math.round(27 * k), CREAM, 600, 'center', 0.6);
    const y0 = F.y + 10; const cards = [RL.card(0, 3), RL.card(1, 7), RL.card(2, 3), RL.card(3, 0)];
    cards.forEach((c, i) => { const a = (i - 1.5) * 0.2 + Math.sin(t * 0.8 + i) * 0.015; ctx.save(); ctx.translate(W / 2 + (i - 1.5) * 110, y0 + 150); ctx.rotate(a); drawCard(ctx, c, -CW * 0.4, -CH * 0.4, 0.8, { big: state.set.big, four: state.set.four, man: true, t: t + i * 0.3 }); ctx.restore(); });
    F.y = y0 + 300;
    F.line();
    F.p(`Matches played ${st.played}, won ${st.wins}`, Math.round(26 * k), CREAM, 700, 'center', 0.4);
    F.p(`Hands won ${st.handsWon} of ${st.hands}`, Math.round(26 * k), CREAM, 700, 'center', 0.4);
    F.p(`Shouts made ${st.trucos}, runs forced ${st.runsFromMe}`, Math.round(26 * k), CREAM, 700, 'center', 0.4);
  });
  button(ctx, OVERLAY_BTN2, 'Play again', { size: 30 }); button(ctx, OVERLAY_BTN, 'Back to title', { primary: true, size: 30 });
  zoomPills(ctx, state);
}

// ---- the table ----------------------------------------------------------------------------------------------------
const seatAtPos = (n, p) => (n === 4 ? p : p === 0 ? 0 : p === 2 ? 1 : -1);
function actorSeat(H) {
  if (H.phase === 'play') return H.turn;
  if (H.phase === 'raise') return H.answerSeat;
  if (H.phase === 'special') return H.teamOf.findIndex((x) => x === H.specialTeam);
  return -1;
}
const ease = (x) => 1 - Math.pow(1 - Math.min(1, Math.max(0, x)), 3);
const back = (x) => { const c1 = 1.70158, c3 = c1 + 1, u = Math.min(1, Math.max(0, x)); return 1 + c3 * Math.pow(u - 1, 3) + c1 * Math.pow(u - 1, 2); };

function table(ctx, state, V) {
  const { text, shadowText, wrap } = V, H = state.H, t = state.t, ui = state.ui, sc = state.scene, n = H.n;
  const big = state.set.big, four = state.set.four, calm = state.set.calm, isAuto = sc === 'auto', A = isAuto ? state.auto : null;
  const VR = RL.VARIANTS[H.variant];
  drawTable(ctx, t);
  const names = n === 4 ? NAMES4 : ['You', 'Opponent'];
  const scores = isAuto ? state.autoMatch.scores : state.match.scores;
  const revealPlan = A && A.phase === 'reveal' ? A.plan : null;
  const acting = actorSeat(H);

  // ---- scoreboard and stake
  for (let i = 0; i < 2; i++) {
    const r = i === 0 ? PLATE_US : PLATE_THEM; plaque(ctx, r, 0.8);
    text(i === 0 ? (n === 4 ? 'US' : 'YOU') : 'THEM', r.x + 20, r.y + 30, 22, DIM, UI, 800, 'left');
    text(String(scores[i]), r.x + r.w - 20, r.y + 64, 54, i === 0 ? GOLD : CREAM, UI, 800, 'right');
    text(`of ${RL.TARGET}`, r.x + 20, r.y + 62, 22, DIM, UI, 600, 'left');
  }
  plaque(ctx, STAKE, 0.85);
  const val = RL.value(H), pend = H.pending;
  const label = H.special === 'iron' ? 'IRON HAND' : H.special === 'eleven' ? VR.specialName.toUpperCase() : pend ? RL.shoutName(H, pend.idx).toUpperCase() + '?' : H.stakeIdx > 0 ? RL.shoutName(H, H.stakeIdx).toUpperCase() : 'HAND WORTH';
  text(label, STAKE.x + STAKE.w / 2, STAKE.y + 28, 20, pend ? '#ffb08a' : DIM, UI, 800);
  const pulse = state.banner ? 1 + 0.08 * Math.sin(t * 14) : 1;
  ctx.save(); ctx.translate(STAKE.x + STAKE.w / 2, STAKE.y + 70); ctx.scale(pulse, pulse); text(String(pend ? VR.vals[pend.idx] : val), 0, 0, 52, GOLD, FONT, 800); ctx.restore();

  // ---- vira / manilha plaque and the trick tracker
  plaque(ctx, VIRA, 0.8);
  if (H.vira >= 0) {
    drawCard(ctx, H.vira, VIRA.x + 12, VIRA.y + 8, 0.4, { big, four, noShadow: false });
    text('Vira', VIRA.x + 120, VIRA.y + 32, 20, DIM, UI, 700, 'left');
    text(`Manilha: ${RL.RANKS[H.manRank]}`, VIRA.x + 120, VIRA.y + 64, 30, GOLD, UI, 800, 'left');
    ['♣', '♥', '♠', '♦'].forEach((s, i) => text(s, VIRA.x + 120 + i * 30 + 6, VIRA.y + 90, 22, i === 1 || i === 3 ? '#ff7a7a' : CREAM, UI, 800, 'center'));
    text('best first', VIRA.x + 252, VIRA.y + 90, 18, DIM, UI, 600, 'left');
  } else {
    text('Fixed manilhas, best first', VIRA.x + 14, VIRA.y + 22, 19, DIM, UI, 700, 'left');
    RL.MINEIRO_MANILHAS.forEach((c, i) => { const x = VIRA.x + 16 + i * 84; drawCard(ctx, c, x, VIRA.y + 28, 0.25, { big, four, man: true, t }); text(['Zap', 'Copas', 'Espadilha', 'Pica-fumo'][i], x + 20, VIRA.y + 90, 15, CREAM, UI, 700, 'left'); });
  }
  plaque(ctx, TRICKS, 0.8);
  text('TRICKS', TRICKS.x + 22, TRICKS.y + 30, 20, DIM, UI, 800, 'left');
  for (let i = 0; i < 3; i++) {
    const cx = TRICKS.x + 70 + i * 82, cy = TRICKS.y + 62, tr = H.tricks[i];
    ctx.beginPath(); ctx.arc(cx, cy, 24, 0, TAU);
    if (tr) { ctx.fillStyle = tr.winTeam === 0 ? '#ffd23f' : tr.winTeam === 1 ? '#e8452c' : '#8a9a92'; ctx.fill(); text(tr.winTeam === 0 ? 'US' : tr.winTeam === 1 ? 'THEM' : '=', cx, cy + (tr.winTeam === 1 ? 7 : 8), tr.winTeam === 1 ? 16 : 22, '#2a1606', UI, 800); }
    else { ctx.strokeStyle = 'rgba(255,246,221,0.4)'; ctx.lineWidth = 2.5; ctx.stroke(); }
  }

  // ---- seats: hands (backs or face-up), name plates, gesture chips
  const faceUpSeat = (s) => isAuto || (n === 4 && s === 2 && (H.consulted[0] || (H.phase === 'special' && H.specialTeam === 0)));
  const drawFaceHand = (s, x0, y0, dx, dy) => {
    const rv = revealPlan && revealPlan.kind === 'turn' && revealPlan.seat === s ? revealPlan : null;
    H.hands[s].forEach((c, k) => {
      const chosen = rv && rv.type === 'play' && rv.card === c, dim = rv && rv.type === 'play' && !chosen;
      drawCard(ctx, c, x0 + k * dx, y0 + k * dy, 0.5, { four, big, dim, glow: chosen ? '#ffe08a' : null, man: H.pow[c] >= 100, t });
    });
  };
  for (let p = 1; p <= 3; p++) {
    const s = seatAtPos(n, p); if (s < 0) continue;
    const cnt = Math.floor(state.shown[s] + 0.001);
    if (faceUpSeat(s)) {
      if (p === 2) { const m = H.hands[s].length, sp = m > 1 ? Math.min(84, 260 / (m - 1)) : 0; drawFaceHand(s, 360 - (74 + sp * (m - 1)) / 2, 312, sp, 0); }
      else if (p === 1) drawFaceHand(s, 632, 578, 0, 44); else drawFaceHand(s, 14, 578, 0, 44);
    } else if (p === 2) { for (let k = 0; k < cnt; k++) drawCard(ctx, -1, 360 - (BW + 34 * 2) / 2 + k * 34 - 6, 312, 0.5, {}); }
    else if (p === 3) { for (let k = 0; k < cnt; k++) drawCard(ctx, -1, 19, 578 + k * 44, 0.5, { rot: Math.PI / 2 }); }
    else { for (let k = 0; k < cnt; k++) drawCard(ctx, -1, 627, 578 + k * 44, 0.5, { rot: -Math.PI / 2 }); }
  }
  const plate = (s, x, y, w) => {
    const turn = acting === s && !state.show && !ui.summary && H.phase !== 'done';
    const r = { x: x - w / 2, y, w, h: 40 }; plaque(ctx, r, turn ? 0.95 : 0.65);
    if (turn) { ctx.save(); ctx.strokeStyle = `rgba(255,224,138,${0.6 + 0.4 * Math.sin(t * 6)})`; ctx.lineWidth = 3; ctx.shadowColor = '#ffe08a'; ctx.shadowBlur = 14; rr(ctx, r.x, r.y, r.w, r.h, 16); ctx.stroke(); ctx.restore(); }
    text(names[s], x + (state.vis[s] && H.signals[s] ? 12 : 0), y + 28, 22, turn ? '#ffe08a' : CREAM, UI, 800);
    if (state.vis[s] && H.signals[s]) drawGesture(ctx, H.signals[s], r.x + 20, r.y + 20, 14);
    if (H.dealer === s) { ctx.fillStyle = GOLD; ctx.beginPath(); ctx.arc(r.x + r.w - 8, r.y + 8, 9, 0, TAU); ctx.fill(); text('D', r.x + r.w - 8, r.y + 12, 11, '#2a1606', UI, 800); }
  };
  const northSeat = seatAtPos(n, 2);
  plate(northSeat, 360, 428, n === 4 ? 150 : 190);
  if (n === 4) { plate(3, 66, 526, 116); plate(1, 654, 526, 116); }
  // speech bubbles and gesture bubbles
  const bub = (s, p) => {
    const b = state.says[s]; if (!b) return;
    const anchors = [{ x: 570, y: 1032 }, { x: 540, y: 690 }, { x: 540, y: 372 }, { x: 180, y: 690 }];
    const a = Math.min(1, b.t * 6) * (b.t > 2.8 ? Math.max(0, 1 - (b.t - 2.8) * 4) : 1); if (a <= 0) return;
    const an = anchors[p], rise = (1 - Math.min(1, b.t * 5)) * 10;
    ctx.save(); ctx.globalAlpha = a; ctx.font = `800 26px ${UI}`;
    const w = ctx.measureText(b.text).width + 36 + (b.gesture ? 52 : 0), yy = an.y + rise;
    ctx.fillStyle = '#fff6dd'; rr(ctx, an.x - w / 2, yy - 30, w, 54, 24); ctx.fill(); ctx.strokeStyle = GOLD; ctx.lineWidth = 3; ctx.stroke();
    if (b.gesture) drawGesture(ctx, b.gesture, an.x - w / 2 + 30, yy - 3, 20);
    ctx.fillStyle = '#2a1606'; ctx.textAlign = 'center'; ctx.fillText(b.text, an.x + (b.gesture ? 22 : 0), yy + 7); ctx.restore();
  };
  for (let s = 0; s < n; s++) bub(s, RL.posOf(n, s));

  // ---- cards: your hand, then the table, then the raised card on top
  const hand = H.hands[0], blind = H.special === 'iron' && !isAuto;
  const drawHandCard = (c, i) => {
    const p = state.pos[c]; if (!p) return; if (p.born && p.born > t) return;
    const hint = ui.hint && ui.hint.kind === 'card' && ui.hint.card === c;
    const cur = ui.kb && ui.cursor === i && H.phase === 'play';
    const rv = revealPlan && revealPlan.kind === 'turn' && revealPlan.seat === 0 ? revealPlan : null;
    const chosen = rv && rv.type === 'play' && rv.card === c, dim = rv && rv.type === 'play' && !chosen;
    if (blind) { drawCard(ctx, -1, p.x, p.y, p.sc, { glow: cur ? '#9fe0ff' : null }); return; }
    drawCard(ctx, c, p.x, p.y - ((hint || chosen) && !calm ? Math.abs(Math.sin(t * 5)) * 10 : 0), p.sc, { big, four, dim, glow: hint || chosen ? '#ffe08a' : cur ? '#9fe0ff' : null, man: H.pow[c] >= 100, t });
  };
  hand.forEach((c, i) => { if (c !== ui.sel && !(ui.drag && ui.drag.card === c && ui.drag.moved)) drawHandCard(c, i); });
  const tt = state.show ? state.show.plays : H.plays;
  for (const pl of tt) {
    const p = state.pos[pl.card]; if (!p) continue;
    const win = state.show && state.show.t > 0.15 && state.show.winner === pl.seat && state.show.t < 1.3;
    drawCard(ctx, pl.card, p.x, p.y, p.sc, { big, four, glow: win ? '#ffe08a' : null, man: H.pow[pl.card] >= 100, t });
  }
  if (ui.sel >= 0 && hand.includes(ui.sel)) drawHandCard(ui.sel, hand.indexOf(ui.sel));
  if (ui.drag && ui.drag.moved && hand.includes(ui.drag.card)) drawHandCard(ui.drag.card, hand.indexOf(ui.drag.card));
  if (state.show && state.show.t > 0.2 && state.show.t < 1.3) {
    const w = state.show.winner;
    shadowText(w < 0 ? 'Tie: empate' : w === 0 ? 'You take it' : w === 2 && n === 4 ? 'Partner takes it' : `${names[w]} takes it`, W / 2, 1024, 32, state.show.team === 0 ? '#ffe08a' : state.show.team === 1 ? '#ffb0a0' : CREAM, UI, 800);
  }

  // ---- toast, panel, truco button, buttons
  if (ui.msg && !isAuto) toast(ctx, ui.msg, V);
  if (isAuto && A) autoBar(ctx, state, V, A, names);
  panel(ctx, state, V);
  const canTruco = !isAuto && H.phase === 'play' && H.turn === 0 && RL.canRaise(H, 0) && !state.show && ui.delay <= 0 && !ui.summary && !ui.sig;
  if (canTruco) button(ctx, TRUCO_BTN, `${RL.shoutName(H, H.stakeIdx + 1).toUpperCase()}!`, { primary: true, size: 38, sub: `worth ${VR.vals[H.stakeIdx + 1]}`, glow: ui.hint && ui.hint.kind === 'truco', pulse: t });
  if (revealPlan && revealPlan.kind === 'turn') button(ctx, TRUCO_BTN, `${RL.shoutName(H, H.stakeIdx + 1).toUpperCase()}!`, { primary: revealPlan.type === 'raise', size: 36, sub: `${names[revealPlan.seat]} could shout`, glow: revealPlan.type === 'raise', pulse: t, dim: revealPlan.type !== 'raise' || !RL.canRaise(H, revealPlan.seat) && revealPlan.type !== 'raise' });
  if (!isAuto && H.phase === 'play' && H.turn === 0 && !state.show && !state.panel.length && ui.delay <= 0 && !ui.summary && !ui.sig) {
    const line = blind ? 'Blind hand: TAP a card twice to play it' : ui.sel >= 0 ? 'TAP the card again to play it, or DRAG it up' : H.plays.length ? 'Your turn: TAP a card' : 'You lead: TAP a card';
    shadowText(line, W / 2, canTruco ? 1182 : 1150, 24, '#ffe9b0', UI, 700);
  }
  if (!isAuto && ui.thinking) { ctx.fillStyle = 'rgba(255,224,138,0.9)'; for (let i = 0; i < 3; i++) { ctx.beginPath(); ctx.arc(W / 2 - 22 + i * 22, 1010 + Math.sin(t * 8 + i) * 4, 5, 0, TAU); ctx.fill(); } }
  if (isAuto) {
    button(ctx, BTN.hint, 'Skip', { size: 28, sub: 'this pause' }); button(ctx, BTN.sig, A && A.paused ? 'Resume' : 'Pause', { size: 28, primary: A && A.paused }); button(ctx, BTN.menu, 'Exit', { size: 30 });
  } else {
    button(ctx, BTN.hint, 'Hint', { size: 30, sub: `${ui.hintsLeft} left` });
    button(ctx, BTN.sig, 'Signal', { size: 28, sub: n === 4 ? (H.signalled[0] ? 'sent' : 'tell partner') : 'needs a partner', dim: n !== 4 || H.signalled[0] || H.special === 'iron' });
    button(ctx, BTN.menu, 'Menu', { size: 30 });
  }
  // particles and the shout banner
  for (const f of state.fx) { ctx.globalAlpha = Math.max(0, Math.min(1, f.life / 0.5)); ctx.fillStyle = f.col; ctx.save(); ctx.translate(f.x, f.y); ctx.rotate(f.life * 6); ctx.fillRect(-f.size / 2, -f.size / 3, f.size, f.size * 0.66); ctx.restore(); }
  ctx.globalAlpha = 1;
  if (state.banner) banner(ctx, state, V);
  if (ui.summary) summary(ctx, state, V);
}
function banner(ctx, state, V) {
  const b = state.banner, k = b.t < 0.3 ? back(b.t / 0.3) : 1, a = b.t > b.dur - 0.3 ? Math.max(0, (b.dur - b.t) / 0.3) : 1;
  ctx.save(); ctx.globalAlpha = a; ctx.translate(W / 2, 700); ctx.scale(k, k); ctx.rotate(-0.04);
  ctx.fillStyle = 'rgba(2,20,16,0.94)'; rr(ctx, -330, -92, 660, 184, 28); ctx.fill(); ctx.strokeStyle = b.col; ctx.lineWidth = 5; ctx.shadowColor = b.col; ctx.shadowBlur = 22; ctx.stroke(); ctx.shadowBlur = 0;
  let size = 96; ctx.font = `800 ${size}px ${FONT}`; while (size > 30 && ctx.measureText(b.text).width > 600) { size -= 4; ctx.font = `800 ${size}px ${FONT}`; }
  V.text(b.text, 0, 18, size, b.col, FONT, 800);
  if (b.sub) V.text(b.sub, 0, 66, 26, CREAM, UI, 700);
  ctx.restore();
}
function toast(ctx, m, V) {
  const a = Math.min(1, m.t * 5) * Math.min(1, (m.hold - m.t) * 3 + 0.01);
  ctx.save(); ctx.globalAlpha = Math.max(0, a); plaque(ctx, TOAST, 0.88);
  let size = 24, ls = V.lines(m.text, size, TOAST.w - 40, 700);
  while (ls.length > 2 && size > 16) { size -= 2; ls = V.lines(m.text, size, TOAST.w - 40, 700); }
  const lh = size * 1.22, y0 = TOAST.y + TOAST.h / 2 - (ls.length - 1) * lh / 2 + size * 0.35;
  ls.forEach((ln, i) => V.text(ln, TOAST.x + TOAST.w / 2, y0 + i * lh, size, CREAM, UI, 700));
  ctx.restore();
}
function autoBar(ctx, state, V, A, names) {
  const H = state.H; plaque(ctx, AUTO_BAR, 0.86);
  const phase = A.phase === 'think' ? 'Thinking...' : A.phase === 'reveal' ? 'About to act' : A.phase === 'summary' ? 'Hand done' : A.phase === 'ended' ? 'Match complete' : 'Playing';
  const seat = A.plan ? A.plan.seat : actorSeat(H);
  const who = seat >= 0 && (A.phase === 'think' || A.phase === 'reveal') ? names[seat] : '';
  V.text(who ? `${who}: ${phase}` : phase, AUTO_BAR.x + 16, AUTO_BAR.y + 28, 22, '#ffe08a', UI, 800, 'left');
  const p = A.plan; let what = '';
  if (A.phase === 'reveal' && p) what = p.kind === 'special' ? (p.play ? 'plays the hand' : 'runs') : p.kind === 'answer' ? { accept: 'accepts', fold: 'runs', raise: 'raises' }[p.action] : p.type === 'raise' ? `shouts ${RL.shoutName(H, H.stakeIdx + 1)}` : `plays ${RL.cardName(H, p.card)}`;
  V.text(what || (A.phase === 'think' ? 'weighing the options' : ''), AUTO_BAR.x + 16, AUTO_BAR.y + 54, 19, DIM, UI, 600, 'left');
  V.text(`Think ${AUTO_THINK_STEPS[state.autoThinkIdx]}s`, AUTO_DEC.x - 14, AUTO_BAR.y + 28, 18, CREAM, UI, 700, 'right');
  button(ctx, AUTO_DEC, '-', { size: 22 }); button(ctx, AUTO_INC, '+', { size: 22 });
  if (A.paused) V.shadowText('PAUSED', W / 2, AUTO_BAR.y - 6, 22, '#ffd0a8', UI, 800);
}
function panel(ctx, state, V) {
  const H = state.H, ui = state.ui, A = state.auto, isAuto = state.scene === 'auto';
  let P = state.panel, texts = state.panelText;
  const rp = isAuto && A && A.phase === 'reveal' ? A.plan : null;
  const VR = RL.VARIANTS[H.variant];
  if (rp && rp.kind !== 'turn') {
    // Auto Play: show the real option buttons of whoever is deciding, exactly like a human would see them
    P = [];
    if (rp.kind === 'special') { P.push({ r: ACT.a, kind: 'special', play: true, label: `Play for ${VR.specialVal}`, primary: true }); P.push({ r: ACT.b, kind: 'special', play: false, label: 'Run' }); texts = [`${VR.specialName}: ${rp.seat === 0 ? 'You decide' : 'the team decides'}`]; }
    else { const Pd = H.pending, up = Pd.idx < 4; P.push({ r: ANS[0], kind: 'answer', action: 'accept', label: 'Accept', sub: `worth ${VR.vals[Pd.idx]}`, primary: true }); P.push({ r: ANS[1], kind: 'answer', action: 'fold', label: 'Run', sub: `they score ${VR.vals[Pd.idx - 1]}` }); if (up) P.push({ r: ANS[2], kind: 'answer', action: 'raise', label: VR.shouts[Pd.idx + 1] + '!', sub: `worth ${VR.vals[Pd.idx + 1]}`, danger: true }); texts = [`${VR.shouts[Pd.idx].toUpperCase()} is called: worth ${VR.vals[Pd.idx]}`]; }
  }
  if (!P.length) return;
  ctx.save(); ctx.fillStyle = 'rgba(2,22,18,0.74)'; rr(ctx, PANEL.x, PANEL.y, PANEL.w, PANEL.h, 26); ctx.fill(); ctx.strokeStyle = 'rgba(255,210,63,0.7)'; ctx.lineWidth = 2.5; ctx.stroke(); ctx.restore();
  texts.forEach((s, i) => V.text(s, W / 2, 1010 + i * 28, 23, CREAM, UI, 700));
  const hint = ui.hint;
  P.forEach((b, i) => {
    const hinted = hint && ((hint.kind === 'answer' && b.kind === 'answer' && b.action === hint.action) || (hint.kind === 'special' && b.kind === 'special' && b.play === hint.play));
    const cur = ui.kb && ui.cursor === i && !isAuto;
    if (b.kind === 'sigclose') { button(ctx, b.r, 'Close', { size: 20 }); return; }
    if (b.kind === 'signal') { button(ctx, b.r, '', { glow: cur }); drawGesture(ctx, b.gesture, b.r.x + 46, b.r.y + 43, 30); V.text(b.label, b.r.x + 92, b.r.y + 42, 28, CREAM, UI, 800, 'left'); V.text(b.sub, b.r.x + 92, b.r.y + 70, 19, DIM, UI, 600, 'left'); return; }
    button(ctx, b.r, b.label, { primary: b.primary, danger: b.danger, size: b.r.h > 100 ? 32 : 28, sub: b.sub, glow: hinted || cur, pulse: state.t, dim: rp && !hinted });
  });
  // answer panel also lists the hint help
  void CH; void TABLE; void TRICK; void SEAT; void DECK; void TSC; void HAND_Y; void LIFT; void SIGPOP; void SIGCLOSE; void star8; void drawSuit; void SUIT_INK; void handSlot; void HEADER_H;
}

function recap(ctx, V, state, F, H, names) {
  const sc = 0.3, w = CW * sc, h = CH * sc, gap = 10;
  H.tricks.forEach((tr, i) => {
    const m = tr.plays.length, total = m * w + (m - 1) * gap, x0 = F.cx - total / 2 + 40, y0 = F.y;
    V.text(`Trick ${i + 1}`, F.x0, y0 + h / 2 + 8, Math.round(22 * (TEXT_SCALES[state.textScaleIdx] ?? 1) * 0.8), CREAM, UI, 800, 'left');
    tr.plays.forEach((p, k) => {
      const x = x0 + k * (w + gap), win = p.seat === tr.winSeat;
      drawCard(ctx, p.card, x, y0, sc, { big: state.set.big, four: state.set.four, glow: win ? '#ffe08a' : null, man: H.pow[p.card] >= 100, t: state.t });
      V.text(names[p.seat], x + w / 2, y0 + h + 17, 14, win ? '#ffe08a' : DIM, UI, 700);
    });
    F.y += h + 34;
  });
}
function summary(ctx, state, V) {
  const S = state.ui.summary, k = TEXT_SCALES[state.textScaleIdx] ?? 1, H = state.H, r = S.result, n = H.n;
  ctx.fillStyle = 'rgba(2,12,10,0.76)'; ctx.fillRect(0, 0, W, HH);
  const box = { x: 30, y: 150, w: 660, h: Math.min(1100, S.h || 760) }; plaque(ctx, box, 0.95);
  const names = n === 4 ? NAMES4 : ['You', 'Opponent'];
  const us = n === 4 ? 'Us' : 'You', them = 'Them';
  const winName = r.winner === 0 ? us : r.winner === 1 ? them : '';
  const tot = flow(ctx, V, state, { x: box.x, y: box.y + 10, w: box.w, h: box.h - 20 }, (F) => {
    const head = r.winner < 0 ? 'Hand tied' : r.winner === 0 ? 'You win the hand' : 'They win the hand';
    F.p(head, Math.round(46 * k), r.winner === 1 ? '#ffb0a0' : CREAM, 800, 'center', 0.4, FONT);
    let why;
    if (r.why === 'run') why = S.ranTeam === 0 ? 'Your side ran.' : `${n === 4 ? 'The other side' : 'Your opponent'} ran.`;
    else if (r.why === 'void') why = 'All three tricks tied. Nobody scores.';
    else why = `Won ${r.tricks.filter((x) => x === r.winner).length} trick${r.tricks.filter((x) => x === r.winner).length === 1 ? '' : 's'}${r.tricks.includes(-1) ? ' (with a tie)' : ''}.`;
    F.p(why, Math.round(26 * k), DIM, 600, 'center', 0.5);
    if (r.winner >= 0) F.p(`${winName} +${r.points}`, Math.round(64 * k), GOLD, 800, 'center', 0.4, FONT);
    // tricks row
    const trow = r.tricks.map((x) => (x === 0 ? 'Us' : x === 1 ? 'Them' : 'Tie')).join('  ·  ');
    if (r.tricks.length) F.p(`Tricks: ${trow}`, Math.round(24 * k), CREAM, 600, 'center', 0.5);
    F.line();
    recap(ctx, V, state, F, H, names);
    F.line();
    F.p(`Match score`, Math.round(22 * k), DIM, 700, 'center', 0.2);
    F.p(`Us ${S.before[0]} → ${S.after[0]}      Them ${S.before[1]} → ${S.after[1]}`, Math.round(32 * k), CREAM, 800, 'center', 0.5);
    if (S.bluff) {
      const who = S.bluff.seat >= 0 ? names[S.bluff.seat] : 'They';
      F.p(`It was a bluff! ${who} shouted with a weak hand and you ran. Their cards:`, Math.round(24 * k), '#ffd0a8', 700, 'center', 0.4);
      const cards = []; for (let s = 0; s < n; s++) if (H.teamOf[s] === S.bluff.team) for (const c of S.bluff.hands[s]) cards.push({ c, label: names[s] });
      if (cards.length) { const m = cards.length, gap = 12, sc = Math.min(0.5, (F.w - (m - 1) * gap) / (m * CW)), w = CW * sc, h = CH * sc; let x = F.cx - (m * w + (m - 1) * gap) / 2; const y0 = F.y + 4; cards.forEach((it) => { drawCard(ctx, it.c, x, y0, sc, { big: state.set.big, four: state.set.four, man: H.pow[it.c] >= 100, t: state.t }); V.text(it.label, x + w / 2, y0 + h + 20, 15, DIM, UI, 700); x += w + gap; }); F.y += h + 40; }
    }
    if (S.mw >= 0) F.p(S.mw === 0 ? 'That wins the match!' : 'That decides the match.', Math.round(30 * k), GOLD, 800, 'center', 0.4);
    if (r.special) F.p(r.special === 'iron' ? 'Mão de Ferro: a blind hand.' : `${RL.VARIANTS[H.variant].specialName}.`, Math.round(22 * k), DIM, 600, 'center', 0.4);
  });
  S.h = Math.max(520, Math.round(tot + state.scroll * 0 + 30));
  if (S.auto) { const ended = S.mw >= 0; V.text(ended ? '' : 'Auto-continuing to the next hand...', W / 2, 1300, 22, DIM, UI, 600); if (ended) { button(ctx, OVERLAY_BTN, 'Play again', { primary: true, size: 30 }); button(ctx, OVERLAY_BTN2, 'Exit to menu', { size: 28 }); } }
  else button(ctx, OVERLAY_BTN, S.mw >= 0 ? 'See result' : 'Next hand', { primary: true, size: 32, glow: true, pulse: state.t });
  if (!S.auto) zoomPills(ctx, state);
}
