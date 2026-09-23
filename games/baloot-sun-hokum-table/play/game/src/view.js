// Everything drawn each frame. Reads `state` (game.js) and changes nothing. Static art is cached (art.js).
import { W, H as HH, CW, CH, TW, TH, BW, BH, HAND_Y, LIFT, BTN, TRICK, SEAT, DECK, TOAST, CHIP, titleRows, PANEL, ACT, OVERLAY_BTN, BACK, NEXT, handSlot } from './layout.js';
import { drawBackground, drawTable, drawCoffee, drawCard, button, plaque, rr, drawSuit, SUIT_INK, FONT, UI, BRASS, CREAM, star8, rosette, TABLE } from './art.js';
import { SUIT_NAMES, TARGETS, legalFor, cardShort, teamOf, DECL, declValue, SEAT_NAMES } from './rules.js';
import { LEVELS } from './ai.js';
import { LESSONS } from './lessons.js';
import { RULES } from './rulesContent.js';

const TAU = Math.PI * 2;
const NAMES = ['You', 'Right', 'Partner', 'Left'];
const TEAM = ['Us', 'Them'];

export function render(ctx, state) {
  const sc = state.scene, t = state.t;
  drawBackground(ctx, t);
  const text = (str, x, y, size, color = CREAM, font = UI, weight = 700, align = 'center') => { ctx.textAlign = align; ctx.font = `${weight} ${size}px ${font}`; ctx.fillStyle = color; ctx.fillText(str, x, y); };
  const shadowText = (str, x, y, size, color = CREAM, font = UI, weight = 700, align = 'center') => { ctx.save(); ctx.shadowColor = 'rgba(0,0,0,0.75)'; ctx.shadowBlur = 8; ctx.shadowOffsetY = 2; text(str, x, y, size, color, font, weight, align); ctx.restore(); };
  const wrap = (str, x, y, size, maxW, color = CREAM, lh = size * 1.32, align = 'center', weight = 600) => {
    ctx.font = `${weight} ${size}px ${UI}`; const words = str.split(' '), lines = []; let cur = '';
    for (const w of words) { const t2 = cur ? cur + ' ' + w : w; if (ctx.measureText(t2).width > maxW && cur) { lines.push(cur); cur = w; } else cur = t2; }
    lines.push(cur); lines.forEach((ln, i) => text(ln, x, y + i * lh, size, color, UI, weight, align)); return lines.length;
  };
  const suitGlyph = (s, x, y, size, four, col) => drawSuit(ctx, s, x, y, size, col || (four ? SUIT_INK.four : SUIT_INK.std)[s]);
  const lightSuit = (s, x, y, size) => drawSuit(ctx, s, x, y, size, s === 1 || s === 2 ? '#ff8a80' : '#f6ead0');
  const V = { text, shadowText, wrap, lightSuit };

  if (sc === 'title') return title(ctx, state, V);
  if (sc === 'lessons') return lessonsPage(ctx, state, V);
  if (sc === 'settings') return settingsPage(ctx, state, V);
  if (sc === 'about') return aboutPage(ctx, state, V);
  if (sc === 'how') return howPage(ctx, state, V);
  if (sc === 'rules') return rulesPage(ctx, state, V);
  if (sc === 'over') return overPage(ctx, state, V);
  if (sc === 'demo-limit') return demoPage(ctx, state, V);
  if (sc === 'daily' && state.daily.status === 'making') { drawTable(ctx, t); text('Setting today\'s deal...', W / 2, 700, 44, CREAM, FONT); button(ctx, BTN.menu, 'Menu', { size: 30 }); return; }
  table(ctx, state, V);
}

// ---- title ------------------------------------------------------------------------------------------------
function backButton(ctx, V, label = 'Back') { button(ctx, BACK, label, { size: 28 }); }
function title(ctx, state, V) {
  const t = state.t, { text, shadowText } = V;
  // big slowly turning medallion behind the title
  ctx.save(); ctx.translate(W / 2, 420); ctx.rotate(t * 0.05);
  ctx.strokeStyle = 'rgba(232,190,110,0.32)'; ctx.lineWidth = 2.5; rosette(ctx, 0, 0, 330, 'rgba(232,190,110,0.32)', 2.5);
  ctx.rotate(-t * 0.1); rosette(ctx, 0, 0, 240, 'rgba(232,190,110,0.24)', 2);
  ctx.restore();
  const g = ctx.createRadialGradient(W / 2, 430, 20, W / 2, 430, 340); g.addColorStop(0, 'rgba(255,214,140,0.28)'); g.addColorStop(1, 'rgba(255,214,140,0)'); ctx.fillStyle = g; ctx.fillRect(0, 100, W, 660);
  // fan of cards
  const fan = [[7, 0], [24, 2], [11, 1], [22, 3], [3 + 8 * 2, 3]];
  const cards = [7 + 0 * 8 + 0, 4 + 8, 2 + 8, 6 + 16, 3 + 24]; void fan;
  cards.forEach((c, i) => {
    const a = (i - 2) * 0.2 + Math.sin(t * 0.8 + i) * 0.015, cx = W / 2 + (i - 2) * 92, cy = 560 + Math.abs(i - 2) * 22;
    ctx.save(); ctx.translate(cx, cy + 150); ctx.rotate(a); ctx.translate(-CW * 0.5, -CH * 0.9 - 150 + 150); drawCard(ctx, c, 0, -CH * 0.15, 1.0, { big: state.set.big, four: state.set.four }); ctx.restore();
  });
  ctx.save(); ctx.shadowColor = 'rgba(255,190,90,0.7)'; ctx.shadowBlur = 30;
  const gr = ctx.createLinearGradient(0, 130, 0, 260); gr.addColorStop(0, '#fff1c2'); gr.addColorStop(1, '#d9a441');
  text('Baloot', W / 2, 250, 170, gr, FONT, 700); ctx.restore();
  shadowText('The partnership card game of the Gulf', W / 2, 322, 30, '#f6dfae', UI, 600);
  drawCoffee(ctx, 80, 780, t, 0.6);
  const R = titleRows(!!state.saved);
  if (R.resume) button(ctx, R.resume, 'Resume match', { primary: true, size: 36, sub: `You ${state.saved.match.scores[0]}, Them ${state.saved.match.scores[1]}` });
  button(ctx, R.play, 'Play a match', { primary: !R.resume, size: 36, sub: `Race to ${TARGETS[state.targetIdx]} with Partner` });
  button(ctx, R.learn, 'Learn to play', { size: 34, sub: `${Object.keys(state.learned).length} of ${LESSONS.length} lessons done` });
  button(ctx, R.daily, 'Daily deal', { size: 34, sub: state.daily.solvedDay === state.daily.day ? `Solved today. Streak ${state.daily.streak}` : 'One puzzle a day' });
  // target + level chips
  const r = R.level; plaque(ctx, r, 0.7);
  ctx.strokeStyle = 'rgba(224,178,90,0.5)'; ctx.beginPath(); ctx.moveTo(r.x + r.w / 2, r.y + 12); ctx.lineTo(r.x + r.w / 2, r.y + r.h - 12); ctx.stroke();
  text(`Match to ${TARGETS[state.targetIdx]}`, r.x + r.w / 4, r.y + 48, 28, CREAM, UI, 700);
  text(`${LEVELS[state.level - 1].name}`, r.x + r.w * 0.75, r.y + 36, 28, CREAM, UI, 700);
  text(['Tap to change'][0], r.x + r.w * 0.75, r.y + 62, 18, 'rgba(246,234,208,0.7)', UI, 600);
  button(ctx, R.settings, 'Settings', { size: 21 }); button(ctx, R.about, 'About', { size: 21 }); button(ctx, R.how, 'Controls', { size: 21 }); button(ctx, R.rules, 'Rules', { size: 21 });
  text(LEVELS[state.level - 1].blurb, W / 2, R.settings.y + 130, 22, 'rgba(246,234,208,0.8)', UI, 600);
}

// ---- simple pages ----------------------------------------------------------------------------------------------
function pageFrame(ctx, V, titleText) {
  ctx.fillStyle = 'rgba(12,4,6,0.55)'; ctx.fillRect(0, 0, W, HH);
  V.text(titleText, W / 2, 120, 64, CREAM, FONT, 700); backButton(ctx, V);
  ctx.strokeStyle = 'rgba(224,178,90,0.6)'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(140, 150); ctx.lineTo(W - 140, 150); ctx.stroke();
  V.text('♦', W / 2, 160, 22, BRASS, UI, 700);
}
function lessonRowRect(i) { return { x: 40, y: 200 + i * 116, w: 640, h: 100 }; }
function lessonsPage(ctx, state, V) {
  pageFrame(ctx, V, 'Learn to play');
  LESSONS.forEach((L, i) => {
    const r = lessonRowRect(i), done = state.learned[i], locked = false;
    button(ctx, r, '', { dim: locked });
    ctx.fillStyle = done ? '#e0b25a' : 'rgba(0,0,0,0.35)'; ctx.beginPath(); ctx.arc(r.x + 52, r.y + 50, 30, 0, TAU); ctx.fill();
    V.text(done ? '✓' : String(i + 1), r.x + 52, r.y + 62, 34, done ? '#2a1606' : CREAM, UI, 800);
    V.text(L.title, r.x + 104, r.y + 46, 32, CREAM, UI, 800, 'left'); V.text(L.blurb, r.x + 104, r.y + 78, 22, 'rgba(246,234,208,0.85)', UI, 600, 'left');
  });
  V.text('Each lesson is a real position: you make every move yourself.', W / 2, 1400, 24, 'rgba(246,234,208,0.85)', UI, 600);
}
function settingsPage(ctx, state, V) {
  pageFrame(ctx, V, 'Settings');
  const rows = [['sound', 'Sound', 'Card slaps and soft chimes'], ['calm', 'Reduced motion', 'Quicker, calmer animations'], ['big', 'Large-print cards', 'Bigger ranks and suits on every card'], ['four', 'Four-colour suits', 'Easier to tell suits apart at a glance']];
  rows.forEach(([key, label, sub], i) => {
    const r = { x: 60, y: 300 + i * 150, w: 600, h: 116 }; button(ctx, r, '', {});
    V.text(label, r.x + 34, r.y + 52, 34, CREAM, UI, 800, 'left'); V.text(sub, r.x + 34, r.y + 88, 21, 'rgba(246,234,208,0.8)', UI, 600, 'left');
    const on = state.set[key], p = { x: r.x + r.w - 140, y: r.y + 32, w: 104, h: 52 };
    ctx.fillStyle = on ? '#e0b25a' : 'rgba(0,0,0,0.5)'; rr(ctx, p.x, p.y, p.w, p.h, 26); ctx.fill();
    ctx.fillStyle = on ? '#2a1606' : '#f6ead0'; ctx.beginPath(); ctx.arc(on ? p.x + p.w - 26 : p.x + 26, p.y + 26, 20, 0, TAU); ctx.fill();
  });
  V.text('Preview', W / 2, 960, 26, 'rgba(246,234,208,0.8)', UI, 700);
  [[7 + 8 * 1, 0], [3 + 8 * 2, 1], [6 + 8 * 3, 2], [4 + 8 * 0, 3]].forEach(([c], i) => drawCard(ctx, c, 90 + i * 140, 990, 0.85, { big: state.set.big, four: state.set.four }));
  V.wrap('Your choices are saved on this device.', W / 2, 1300, 22, 560, 'rgba(246,234,208,0.8)');
}
function paragraphs(ctx, V, items, y0, size = 26, maxW = 600) {
  let y = y0;
  for (const it of items) {
    if (it.h) { V.text(it.h, 60, y, size + 4, BRASS, UI, 800, 'left'); y += size * 1.5; continue; }
    const n = V.wrap(it.p, 60, y, size, maxW, CREAM, size * 1.36, 'left'); y += n * size * 1.36 + size * 0.7;
  }
}
function aboutPage(ctx, state, V) {
  pageFrame(ctx, V, 'About Baloot');
  paragraphs(ctx, V, [
    { p: 'Baloot is a trick-taking card game for four players in two partnerships, played across Saudi Arabia and the wider Arabian Peninsula. It is related to the French game Belote.' },
    { p: 'It uses a 32-card deck, 7 to Ace. Each player gets eight cards. Partners sit opposite each other.' },
    { p: 'Two contracts: Sun, with no trump, and Hokum, where one suit is trump and the Jack and 9 of trump become the two highest cards.' },
    { p: 'Players may score bonuses called declarations: Sira, Fifty, Hundred and Baloot, the King and Queen of trump together.' },
    { p: 'A match is usually played to 152 game points.' },
    { p: 'This game follows the widely played Saudi rules. House rules vary from table to table, so the choices made here are listed under Controls.' },
    { p: 'Score only: no money is played for.' },
  ], 230, 27, 610);
}
function howPage(ctx, state, V) {
  pageFrame(ctx, V, 'Controls and rules');
  paragraphs(ctx, V, [
    { h: 'Controls' },
    { p: 'TAP a card to raise it, TAP it again to play it. Or DRAG it upward.' },
    { p: 'TAP a big button to bid, double or declare. Hint suggests a play and says why. Take back undoes your last play.' },
    { p: 'Keyboard: Left and Right pick a card or button, Enter or Space plays, H is Hint, U is Take back, Esc is Menu.' },
    { h: 'The hand' },
    { p: 'Bidding: one card is turned up. Each player may say Hokum (that suit is trump), Sun or Pass. A second round lets Hokum be a different suit. Sun beats Hokum.' },
    { p: 'The buyer takes the turned-up card and everyone is dealt to eight. Opponents may then Double (x2); the buyer can answer Three, the opponents Four, and the buyer a Match call: win the hand, win the match.' },
    { p: 'Follow suit. In Hokum, if you cannot and an opponent is winning, you must trump, and you must go higher than a trump already played.' },
    { h: 'Points' },
    { p: 'Sun: A 11, 10 10, K 4, Q 3, J 2. Hokum trump: J 20, 9 14, A 11, 10 10, K 4, Q 3. Last trick +10. A hand is 16 game points in Hokum and 26 in Sun. The buyer must beat the other team or they take everything. Winning every trick is Kaboot: 25 in Hokum, 44 in Sun.' },
    { p: 'Declarations: Sira 2, Fifty 5, Hundred 10, Baloot 2 (Sun: 4, 10, 20, four aces 40). Only the team with the best declaration scores theirs.' },
  ], 210, 23, 610);
}
// Draws a centred row of real in-game cards (via the same drawCard() the table uses — never a
// separate simplified icon), each with a label under it, sized to always fit within the page's
// text margin. Returns the y just below the row, for the body text that follows.
function drawRuleCards(ctx, state, cards, y0) {
  const n = cards.length, gap = 16, maxW = 640;
  const scale = Math.min(0.62, (maxW - (n - 1) * gap) / (n * CW));
  const w = CW * scale, h = CH * scale;
  let x = W / 2 - (n * w + (n - 1) * gap) / 2;
  for (const item of cards) {
    drawCard(ctx, item.c, x, y0, scale, { four: state.set.four, big: state.set.big });
    ctx.save(); ctx.textAlign = 'center';
    ctx.font = `700 18px ${UI}`; ctx.fillStyle = CREAM;
    ctx.fillText(item.label, x + w / 2, y0 + h + 24);
    if (item.sub) { ctx.font = `600 14px ${UI}`; ctx.globalAlpha = 0.82; ctx.fillText(item.sub, x + w / 2, y0 + h + 44); ctx.globalAlpha = 1; }
    ctx.restore();
    x += w + gap;
  }
  return y0 + h + (cards.some((c) => c.sub) ? 66 : 44);
}
// The exhaustive Rules reference: a paginated set of short pages (Back / Next / "Page N of M"),
// the closest equivalent this game has to the board games' per-piece pages, built additively on
// top of the same pageFrame()/paragraphs() the About and Controls pages already use. Every claim
// on every page is cross-checked against rules.js in rulesContent.js.
function rulesPage(ctx, state, V) {
  pageFrame(ctx, V, 'Game Rules');
  const list = RULES, page = list[state.page % list.length];
  V.text(page.title, W / 2, 200, 32, BRASS, UI, 800);
  let y = 236;
  if (page.cards && page.cards.length) y = drawRuleCards(ctx, state, page.cards, y) + 10;
  paragraphs(ctx, V, page.lines.map((p) => ({ p })), y, 24, 610);
  button(ctx, NEXT, 'Next', { size: 26 });
  V.text(`Page ${(state.page % list.length) + 1} of ${list.length}`, W / 2, HH - 34, 21, 'rgba(246,234,208,0.65)', UI, 600);
}
function demoPage(ctx, state, V) {
  ctx.fillStyle = 'rgba(12,4,6,0.6)'; ctx.fillRect(0, 0, W, HH);
  V.text('That was the preview', W / 2, 500, 60, CREAM, FONT, 700);
  V.wrap('Get the full game on iPhone or Android: unlimited matches, all ten lessons and a new daily deal every day.', W / 2, 590, 30, 560, CREAM, 42);
  button(ctx, OVERLAY_BTN, 'Back to title', { primary: true, size: 30 });
}
function overPage(ctx, state, V) {
  const won = state.match.winner === 0, m = state.match, t = state.t;
  ctx.fillStyle = 'rgba(12,4,6,0.6)'; ctx.fillRect(0, 0, W, HH);
  ctx.save(); ctx.translate(W / 2, 400); ctx.rotate(t * 0.06); rosette(ctx, 0, 0, 260, 'rgba(232,190,110,0.35)', 2.5); ctx.restore();
  V.text(won ? 'You win the match!' : 'They win the match', W / 2, 400, 64, CREAM, FONT, 700);
  V.text(`Us ${m.scores[0]}   Them ${m.scores[1]}`, W / 2, 500, 52, BRASS, UI, 800);
  V.text(`${m.hands} hand${m.hands === 1 ? '' : 's'} played to ${TARGETS[state.targetIdx]}. Level: ${LEVELS[state.level - 1].name}`, W / 2, 560, 26, 'rgba(246,234,208,0.85)', UI, 600);
  V.wrap(won ? 'Well played, and well partnered.' : 'A close match is good practice. Try again, or use Hint.', W / 2, 630, 28, 520, CREAM);
  // a fan of cards celebrates the finish, echoing the title screen
  const cards = [7 + 24, 4 + 8, 6 + 16, 2 + 8, 3 + 24];
  cards.forEach((c, i) => {
    const a = (i - 2) * 0.2 + Math.sin(t * 0.8 + i) * 0.015, cx = W / 2 + (i - 2) * 92, cy = 900 + Math.abs(i - 2) * 20;
    ctx.save(); ctx.translate(cx, cy); ctx.rotate(a); drawCard(ctx, c, -CW * 0.5, -CH * 0.5, 1.0, { big: state.set.big, four: state.set.four }); ctx.restore();
  });
  const stats = state.stats;
  const r = { x: 90, y: 1040, w: 540, h: 110 }; plaque(ctx, r, 0.7);
  V.text(`Matches played ${stats.played}  ·  Won ${stats.wins}  ·  Best score ${stats.best}`, W / 2, r.y + r.h / 2 + 10, 26, CREAM, UI, 700);
  button(ctx, { x: 160, y: 1176, w: 400, h: 90 }, 'Play again', { size: 30 }); button(ctx, OVERLAY_BTN, 'Back to title', { primary: true, size: 30 });
}

// ---- the table -----------------------------------------------------------------------------------------------
function table(ctx, state, V) {
  const { text, shadowText, wrap, lightSuit } = V, H = state.H, t = state.t, ui = state.ui, sc = state.scene;
  const big = state.set.big, four = state.set.four, calm = state.set.calm;
  drawTable(ctx, t);
  const study = sc !== 'play';
  if (!study) drawCoffee(ctx, 84, 318, t, 0.46);
  const ct = H.contract;
  // ---- scores
  const sPl = [{ x: 92, y: 52, w: 250, h: 88 }, { x: 378, y: 52, w: 250, h: 88 }];
  const inLesson = sc !== 'play';
  for (let i = 0; i < (study ? 0 : 2); i++) {
    const r = sPl[i]; plaque(ctx, r, 0.78);
    text(i === 0 ? 'US' : 'THEM', r.x + 22, r.y + 32, 22, 'rgba(246,234,208,0.8)', UI, 800, 'left');
    text(inLesson ? '-' : String(state.match.scores[i]), r.x + r.w - 22, r.y + 62, 54, i === 0 ? '#ffe08a' : CREAM, UI, 800, 'right');
    if (!inLesson) text(`of ${TARGETS[state.targetIdx]}`, r.x + 22, r.y + 66, 20, 'rgba(246,234,208,0.7)', UI, 600, 'left');
  }
  // ---- contract chip
  if (!study) plaque(ctx, CHIP, 0.8);
  let chip;
  if (H.phase === 'bid' || H.phase === 'lessondone' && !ct) chip = `Bidding, round ${H.round}`;
  else if (H.phase === 'double') chip = 'Doubling';
  else chip = null;
  if (study) { /* header carries the contract */ } else if (chip) text(chip, CHIP.x + CHIP.w / 2, CHIP.y + 34, 26, CREAM, UI, 700);
  else if (ct && !study) {
    const w = H.taken ? H.tricks : 0;
    const label = ct.type === 'sun' ? 'SUN' : 'HOKUM';
    text(label, CHIP.x + 24, CHIP.y + 35, 26, '#ffe08a', UI, 800, 'left');
    if (ct.type === 'hokum') lightSuit(ct.trump, CHIP.x + 148, CHIP.y + 26, 30);
    text(`${H.mult > 1 ? 'x' + H.mult + '  ' : ''}${ct.buyer === 0 ? 'You' : NAMES[ct.buyer]} bought`, CHIP.x + 190, CHIP.y + 34, 22, CREAM, UI, 700, 'left');
    text(`${w}/8`, CHIP.x + CHIP.w - 20, CHIP.y + 34, 22, 'rgba(246,234,208,0.8)', UI, 700, 'right');
  }
  // ---- opponents' hands (backs) and name plates
  const backSc = 0.5;
  const nb = (s) => Math.floor(state.shown[s] + 0.001);
  if (study) {
    const face = (seat, x0, y0, dx, dy) => H.hands[seat].forEach((c, k) => drawCard(ctx, c, x0 + k * dx, y0 + k * dy, 0.5, { four, noShadow: false }));
    const n2 = H.hands[2].length, sp = n2 > 1 ? Math.min(58, 420 / (n2 - 1)) : 0;
    face(2, 360 - (74 + sp * (n2 - 1)) / 2, 274, sp, 0);
    face(3, 14, 578, 0, 44); face(1, 632, 578, 0, 44);
  } else {
    for (let k = 0; k < nb(2); k++) drawCard(ctx, -1, 360 - (BW + 34 * 7) / 2 + k * 34 - 10, 232, backSc, {});
    for (let k = 0; k < nb(3); k++) drawCard(ctx, -1, 19, 578 + k * 44, backSc, { rot: Math.PI / 2 });
    for (let k = 0; k < nb(1); k++) drawCard(ctx, -1, 627, 578 + k * 44, backSc, { rot: -Math.PI / 2 });
  }
  const plate = (s, x, y, w) => {
    const turn = H.turn === s && (H.phase === 'bid' || H.phase === 'play' || H.phase === 'double') && !state.show;
    const r = { x: x - w / 2, y, w, h: 40 }; plaque(ctx, r, turn ? 0.95 : 0.65);
    if (turn) { ctx.save(); ctx.strokeStyle = `rgba(255,224,138,${0.6 + 0.4 * Math.sin(t * 6)})`; ctx.lineWidth = 3; ctx.shadowColor = '#ffe08a'; ctx.shadowBlur = 14; rr(ctx, r.x, r.y, r.w, r.h, 16); ctx.stroke(); ctx.restore(); }
    text(NAMES[s], x, y + 28, 22, turn ? '#ffe08a' : CREAM, UI, 800);
    if (ct && ct.buyer === s) { ctx.fillStyle = '#e0b25a'; ctx.beginPath(); ctx.arc(r.x + r.w - 6, r.y + 6, 9, 0, TAU); ctx.fill(); text('B', r.x + r.w - 6, r.y + 11, 12, '#2a1606', UI, 800); }
  };
  plate(2, 360, study ? 386 : 338, 150); plate(3, 62, 526, 104); plate(1, 660, 526, 104);
  // speech bubbles
  const bub = (s, x, y) => { const b = state.says[s]; if (!b) return; const a = Math.min(1, b.t * 6) * (b.t > 2.8 ? Math.max(0, 1 - (b.t - 2.8) * 4) : 1);
    if (a <= 0) return; ctx.save(); ctx.globalAlpha = a; ctx.font = `800 26px ${UI}`; const w = ctx.measureText(b.text).width + 36; const yy = y - (1 - Math.min(1, b.t * 5)) * -10;
    ctx.fillStyle = '#f6ead0'; rr(ctx, x - w / 2, yy - 28, w, 46, 22); ctx.fill(); ctx.strokeStyle = BRASS; ctx.lineWidth = 2.5; ctx.stroke(); ctx.fillStyle = '#2a1606'; ctx.textAlign = 'center'; ctx.fillText(b.text, x, yy + 6); ctx.restore(); };
  bub(2, 540, 358); bub(3, 190, 632); bub(1, 530, 632); bub(0, 560, 1164);

  // ---- centre: turned-up card during bidding
  if (H.phase === 'bid' && H.floor >= 0) {
    const bob = calm ? 0 : Math.sin(t * 2) * 4;
    drawCard(ctx, H.floor, DECK.x - CW * 0.45, DECK.y - CH * 0.45 + bob, 0.9, { big, four });
    text('Turned-up card', W / 2, DECK.y + CH * 0.5 + 34, 24, 'rgba(255,240,200,0.9)', UI, 700);
  }
  // deal animation from a deck in the middle
  if (state.dealT < 1.6 && sc === 'play' && H.phase === 'bid' && H.bidLog.length === 0 && !calm) { /* cards fly in via positions */ }

  // ---- cards: hand, then table, then the raised/dragged card on top
  const hand = H.hands[0], legalSet = new Set(H.phase === 'play' && H.turn === 0 && !state.show && (ui.delay <= 0) ? legalFor(hand, H.trick, ct, 0) : hand);
  const showLegal = H.phase === 'play' && H.turn === 0 && !state.show && H.trick.length > 0;
  const drawHandCard = (c, i) => {
    const p = state.pos[c]; if (!p) return; if (p.born && p.born > t) return;
    const dim = showLegal && !legalSet.has(c);
    const hint = ui.hint && ui.hint.kind === 'card' && ui.hint.card === c;
    const cur = ui.kb && ui.cursor === i && H.phase === 'play';
    const refused = ui.refuse && ui.refuse.card === c;
    const shake = refused ? Math.sin(ui.refuse.t * 60) * 7 * (1 - ui.refuse.t / 0.6) : 0;
    drawCard(ctx, c, p.x + shake, p.y - (hint && !calm ? Math.abs(Math.sin(t * 5)) * 10 : 0), p.sc, { big, four, dim, glow: hint ? '#ffe08a' : cur ? '#9fe0ff' : refused ? '#ff7070' : null });
  };
  hand.forEach((c, i) => { if (c !== ui.sel && !(ui.drag && ui.drag.card === c && ui.drag.moved)) drawHandCard(c, i); });
  const tt = state.show ? state.show.plays : H.trick;
  for (const pl of tt) { const p = state.pos[pl.card]; if (!p) continue; const winner = state.show && state.show.t > 0.15 && state.show.winner === pl.seat && state.show.t < 1.3;
    drawCard(ctx, pl.card, p.x, p.y, p.sc, { big, four, glow: winner ? '#ffe08a' : null }); }
  if (ui.sel >= 0 && hand.includes(ui.sel)) drawHandCard(ui.sel, hand.indexOf(ui.sel));
  if (ui.drag && ui.drag.moved) drawHandCard(ui.drag.card, hand.indexOf(ui.drag.card));
  // who won the trick
  if (state.show && state.show.t > 0.2 && state.show.t < 1.3) { const w = state.show.winner; shadowText(w === 0 ? 'You take it' : w === 2 ? 'Partner takes it' : `${NAMES[w]} takes it`, W / 2, 1010, 30, teamOf(w) === 0 ? '#ffe08a' : '#ffb0a0', UI, 800); }

  // ---- toast, lesson/daily header, panel, buttons
  if (sc === 'lesson') lessonHeader(ctx, state, V);
  else if (sc === 'daily') dailyHeader(ctx, state, V);
  else if (ui.msg) toast(ctx, ui.msg, V);
  panel(ctx, state, V);
  if (H.phase === 'play' && H.turn === 0 && !state.show && !state.panel.length && ui.delay <= 0 && !ui.summary) {
    const line = ui.sel >= 0 ? 'TAP the card again to play it, or DRAG it up' : H.trick.length ? 'Your turn: TAP a bright card' : 'You lead: TAP a card';
    shadowText(line, W / 2, 1150 - (ui.sel >= 0 ? 8 : 0), 24, '#ffe9b0', UI, 700);
  }
  if (ui.thinking && ui.thinking !== false && state.H.turn !== 0 && !state.show) { /* the computer is thinking */ ctx.fillStyle = 'rgba(255,224,138,0.9)'; for (let i = 0; i < 3; i++) { ctx.beginPath(); ctx.arc(W / 2 - 22 + i * 22, 1010 + Math.sin(t * 8 + i) * 4, 5, 0, TAU); ctx.fill(); } }
  button(ctx, BTN.hint, 'Hint', { size: 30, sub: sc === 'lesson' ? 'repeat step' : `${ui.hintsLeft} left`, glow: false });
  button(ctx, BTN.undo, sc === 'daily' ? 'Try again' : 'Take back', { size: 28, dim: sc === 'lesson' });
  button(ctx, BTN.menu, 'Menu', { size: 30 });
  if (ui.summary) summary(ctx, state, V);
}

function toast(ctx, m, V) {
  const a = Math.min(1, m.t * 5) * Math.min(1, (m.hold - m.t) * 3 + 0.01);
  ctx.save(); ctx.globalAlpha = Math.max(0, a);
  plaque(ctx, TOAST, 0.86);
  ctx.font = `700 24px ${UI}`;
  const words = m.text.split(' '), lines = []; let cur = '';
  for (const w of words) { const t2 = cur ? cur + ' ' + w : w; if (ctx.measureText(t2).width > TOAST.w - 40 && cur) { lines.push(cur); cur = w; } else cur = t2; }
  lines.push(cur);
  const size = lines.length > 3 ? 19 : lines.length > 2 ? 21 : 24, lh = size * 1.22, y0 = TOAST.y + TOAST.h / 2 - (lines.length - 1) * lh / 2 + size * 0.35;
  lines.forEach((ln, i) => V.text(ln, TOAST.x + TOAST.w / 2, y0 + i * lh, size, CREAM, UI, 700));
  ctx.restore();
}
function lessonHeader(ctx, state, V) {
  const L = state.lesson, def = LESSONS[L.i], st = def.steps[L.s], ui = state.ui;
  const r = { x: 30, y: 60, w: 660, h: 206 };
  plaque(ctx, r, 0.92);
  V.text(`Lesson ${L.i + 1} of ${LESSONS.length}: ${def.title}`, r.x + 24, r.y + 36, 25, '#ffe08a', UI, 800, 'left');
  const body = L.done ? (L.after || 'Lesson complete.') : (st ? st.text : '');
  ctx.save(); ctx.beginPath(); ctx.rect(r.x, r.y, r.w, r.h); ctx.clip();
  const fs = body.length > 150 ? 22 : 25; const nl = V.wrap(body, r.x + 24, r.y + 76, fs, r.w - 48, CREAM, fs * 1.3, 'left', 700);
  const msg = ui.msg && ui.msg.text !== body ? ui.msg.text : null;
  if (msg) { ctx.strokeStyle = 'rgba(224,178,90,0.4)'; ctx.beginPath(); ctx.moveTo(r.x + 24, r.y + 76 + nl * fs * 1.3 - 6); ctx.lineTo(r.x + r.w - 24, r.y + 76 + nl * fs * 1.3 - 6); ctx.stroke(); V.wrap(msg, r.x + 24, r.y + 76 + nl * fs * 1.3 + 22, 20, r.w - 48, '#ffd9a0', 24, 'left', 600); }
  ctx.restore();
  if (L.done && state.H.phase !== 'done' && !(state.H.phase === 'play' && state.H.trick.length > 0 && state.H.turn !== 0)) button(ctx, OVERLAY_BTN, L.i + 1 < LESSONS.length ? 'Next lesson' : 'All lessons', { primary: true, size: 32, glow: true, pulse: state.t });
}
function dailyHeader(ctx, state, V) {
  const d = state.daily, p = d.puzzle, H = state.H, ui = state.ui;
  const r = { x: 30, y: 60, w: 660, h: 206 }; plaque(ctx, r, 0.92);
  V.text('Daily deal', r.x + 24, r.y + 38, 26, '#ffe08a', UI, 800, 'left');
  V.text(`Streak ${d.streak}`, r.x + r.w - 24, r.y + 38, 24, CREAM, UI, 700, 'right');
  if (p) {
    V.wrap(`${p.type === 'sun' ? 'Sun' : 'Hokum, ' + SUIT_NAMES[p.trump] + ' is trump'}. You lead; North is your partner. Your team needs ${p.target} of the ${p.total} points left (last trick +10). All hands are face up.`, r.x + 24, r.y + 74, 22, r.w - 48, CREAM, 28, 'left', 700);
    V.text(`Your team so far: ${H.taken[0]} of ${p.target}`, r.x + r.w - 24, r.y + r.h - 16, 22, '#ffe08a', UI, 800, 'right');
  }
  if (ui.msg) { V.wrap(ui.msg.text, r.x + 24, r.y + 150, 20, r.w - 48, '#ffd9a0', 24, 'left', 600); }
  if (d.wrong) button(ctx, OVERLAY_BTN, 'Try again', { primary: true, size: 32, glow: true, pulse: state.t });
}

function panel(ctx, state, V) {
  const P = state.panel; if (!P.length) return;
  const ui = state.ui, H = state.H;
  ctx.save(); ctx.fillStyle = 'rgba(14,6,8,0.66)'; rr(ctx, 16, 976, 688, 216, 26); ctx.fill(); ctx.strokeStyle = 'rgba(224,178,90,0.65)'; ctx.lineWidth = 2.5; ctx.stroke(); ctx.restore();
  if (state.panelText.length) state.panelText.forEach((s, i) => V.text(s, W / 2, 1012 + i * 26, 22, CREAM, UI, 700));
  const hintKey = ui.hint && ui.hint.kind === 'bid' ? ui.hint.a : null;
  P.forEach((b, i) => {
    const hinted = hintKey && b.kind === 'bid' && b.a.t === hintKey.t && (b.a.suit ?? -1) === (hintKey.suit ?? -1);
    const cur = ui.kb && ui.cursor === i;
    button(ctx, b.r, b.suit >= 0 ? '' : b.label, { primary: b.primary, size: b.r.h > 100 ? 34 : 30, sub: b.suit >= 0 && b.sub ? undefined : b.sub, glow: hinted || cur, pulse: state.t });
    if (b.suit >= 0) {
      const cx = b.r.x + b.r.w / 2; ctx.font = `800 32px ${UI}`; const w = ctx.measureText(b.label).width;
      V.text(b.label, cx - 22, b.r.y + b.r.h / 2 + 12, 32, b.primary ? '#2a1606' : CREAM, UI, 800);
      drawSuit(ctx, b.suit, cx + w / 2 + 6, b.r.y + b.r.h / 2 + 2, 34, b.suit === 1 || b.suit === 2 ? '#c4171d' : '#15110f');
      void b.sub;
    }
  });
}

function summary(ctx, state, V) {
  const S = state.ui.summary, { text, wrap } = V;
  ctx.fillStyle = 'rgba(8,3,4,0.72)'; ctx.fillRect(0, 0, W, HH);
  const box = { x: 40, y: 200, w: 640, h: 1020 }; plaque(ctx, box, 0.94);
  if (S.daily) {
    text(S.failed ? 'Not this time' : 'Solved!', W / 2, 330, 64, CREAM, FONT, 700);
    wrap(`Your team took ${S.got} points. The target was ${S.target}.${S.failed ? ' Every deal has an answer: try again and look at the first lead.' : ''}`, W / 2, 420, 30, 540, CREAM, 42);
    button(ctx, OVERLAY_BTN, S.failed ? 'Try again' : 'Done', { primary: true, size: 32 }); return;
  }
  const r = S.result, ct = S.contract, buyer = ct.buyer, sun = ct.type === 'sun';
  text(S.lesson ? 'Hand tally' : 'Hand result', W / 2, 290, 62, CREAM, FONT, 700);
  const won = r.buyerWon, bt = r.buyerTeam;
  text(`${buyer === 0 ? 'You' : NAMES[buyer]} bought ${sun ? 'Sun' : 'Hokum ' + SUIT_NAMES[ct.trump]}${S.mult > 1 ? ' (x' + S.mult + ')' : ''}`, W / 2, 350, 28, 'rgba(246,234,208,0.9)', UI, 700);
  const rows = [['', 'Us', 'Them'], ['Card points', r.taken[0], r.taken[1]], ['Game points', r.cardG[0], r.cardG[1]], ['Declarations', r.decl[0] ? '+' + r.decl[0] : '-', r.decl[1] ? '+' + r.decl[1] : '-'], ['Baloot', r.baloot[0] ? '+' + r.baloot[0] : '-', r.baloot[1] ? '+' + r.baloot[1] : '-'], ['Tricks won', r.wins[0], r.wins[1]]];
  rows.forEach((row, i) => { const y = 430 + i * 62; if (i === 0) { text(row[1], 470, y, 28, '#ffe08a', UI, 800, 'center'); text(row[2], 600, y, 28, CREAM, UI, 800, 'center'); return; }
    text(row[0], 78, y, 27, CREAM, UI, 600, 'left'); text(String(row[1]), 470, y, 30, '#ffe08a', UI, 800); text(String(row[2]), 600, y, 30, CREAM, UI, 800);
    ctx.strokeStyle = 'rgba(224,178,90,0.25)'; ctx.beginPath(); ctx.moveTo(70, y + 18); ctx.lineTo(650, y + 18); ctx.stroke(); });
  let msg;
  if (r.kaboot >= 0) msg = `Kaboot: ${r.kaboot === 0 ? 'your team' : 'the other team'} won all eight tricks.`;
  else msg = won ? `${TEAM[bt]} made the contract.` : `${TEAM[bt]} failed the contract: every point goes to ${TEAM[1 - bt]}.`;
  wrap(msg, W / 2, 850, 27, 560, won ? CREAM : '#ffd0a8', 34);
  text('Points scored this hand', W / 2, 950, 24, 'rgba(246,234,208,0.8)', UI, 700);
  text(`Us +${r.delta[0]}      Them +${r.delta[1]}`, W / 2, 1010, 46, '#ffe08a', UI, 800);
  if (!S.lesson) { text(`Match: Us ${state.match.scores[0]}, Them ${state.match.scores[1]}  (to ${TARGETS[state.targetIdx]})`, W / 2, 1080, 26, CREAM, UI, 700); if (r.matchCall) text('Match call decided the match.', W / 2, 1120, 24, '#ffd0a8', UI, 700); }
  button(ctx, OVERLAY_BTN, S.lesson ? 'Next lesson' : S.matchWinner >= 0 ? 'See result' : 'Next hand', { primary: true, size: 32, glow: true, pulse: state.t });
}
export { star8, DECL, declValue, SEAT_NAMES, TW, TH, BH, CH, HAND_Y, LIFT, TRICK, SEAT, TABLE, handSlot, cardShort };
