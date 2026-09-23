// Everything that is drawn each frame. Reads `state` (see game.js) and changes nothing.
import { W, H as SH, CARD, TRICK_CARD, BACK, SLOT, SEAT, PLATE, DECK, HAND_Y, LIFT, handLayout, BTN, BID, titleRows, LESSON_ROWS, LESSONS_BACK, ABOUT_BACK, ABOUT_NEXT, RULES_BACK, RULES_NEXT, TEXT_DEC, TEXT_INC, TEXT_SCALES, THINK_STEPS } from './layout.js';
import { drawTable, drawLanterns, drawCard, suit, star8, suitColor } from './art.js';
import { SUIT_NAMES, SEAT_NAMES, legalPlays, teamOf, sortHand } from './rules.js';
import { LEVELS } from './ai.js';
import { LESSONS } from './lessons.js';
import { ABOUT } from './about.js';
import { RULES } from './rules-content.js';

const FONT = '"Cormorant Garamond", Georgia, "Times New Roman", serif', UI = 'system-ui, -apple-system, "Segoe UI", Roboto, sans-serif';
const TAU = Math.PI * 2, GOLD = '#f2d48a';
const ease = (f) => f * f * (3 - 2 * f);
const clamp01 = (x) => Math.max(0, Math.min(1, x));

export function render(ctx, S) {
  const tb = S.tb, t = S.t;
  drawTable(ctx); drawLanterns(ctx, t, S.calm);

  const text = (str, x, y, size, color = GOLD, font = FONT, weight = 700, align = 'center') => { ctx.textAlign = align; ctx.textBaseline = 'alphabetic'; ctx.font = `${weight} ${size}px ${font}`; ctx.fillStyle = color; ctx.fillText(str, x, y); };
  const wrap = (str, x, y, size, maxW, color, lh = size * 1.32, align = 'center', font = UI, weight = 600) => {
    ctx.font = `${weight} ${size}px ${font}`; const words = str.split(' '), lines = []; let cur = '';
    for (const w of words) { const t2 = cur ? cur + ' ' + w : w; if (ctx.measureText(t2).width > maxW && cur) { lines.push(cur); cur = w; } else cur = t2; }
    lines.push(cur); lines.forEach((ln, i) => text(ln, x, y + i * lh, size, color, font, weight, align)); return lines.length;
  };
  const panel = (r, alpha = 0.82) => {
    ctx.fillStyle = 'rgba(0,0,0,0.35)'; ctx.beginPath(); ctx.roundRect(r.x + 3, r.y + 7, r.w, r.h, 22); ctx.fill();
    const g = ctx.createLinearGradient(0, r.y, 0, r.y + r.h); g.addColorStop(0, `rgba(58,36,18,${alpha})`); g.addColorStop(1, `rgba(28,16,8,${alpha})`);
    ctx.fillStyle = g; ctx.beginPath(); ctx.roundRect(r.x, r.y, r.w, r.h, 22); ctx.fill(); ctx.strokeStyle = 'rgba(232,195,119,0.75)'; ctx.lineWidth = 2.5; ctx.stroke();
  };
  const button = (r, label, o = {}) => {
    ctx.save(); if (o.dim) ctx.globalAlpha = 0.45;
    ctx.fillStyle = 'rgba(0,0,0,0.38)'; ctx.beginPath(); ctx.roundRect(r.x + 3, r.y + 6, r.w, r.h, 18); ctx.fill();
    const gr = ctx.createLinearGradient(0, r.y, 0, r.y + r.h); gr.addColorStop(0, o.primary ? '#f6d888' : o.on ? '#2e7a5c' : '#7a4a24'); gr.addColorStop(1, o.primary ? '#c8922e' : o.on ? '#185038' : '#45260f');
    ctx.fillStyle = gr; ctx.beginPath(); ctx.roundRect(r.x, r.y, r.w, r.h, 18); ctx.fill();
    ctx.strokeStyle = o.ring || 'rgba(255,230,170,0.55)'; ctx.lineWidth = o.ring ? 4 : 2; ctx.stroke();
    const sz = o.size ?? 30, col = o.primary ? '#2a1606' : '#f6dfae';
    if (o.sub) { text(label, r.x + r.w / 2, r.y + r.h / 2 - 2, sz, col, UI, 700); text(o.sub, r.x + r.w / 2, r.y + r.h / 2 + sz * 0.72, Math.round(sz * 0.62), o.primary ? '#5a3a10' : 'rgba(246,223,174,0.75)', UI, 500); }
    else text(label, r.x + r.w / 2, r.y + r.h / 2 + sz * 0.35, sz, col, UI, 700);
    ctx.restore();
  };
  const pill = (x, y, w, h, fill, stroke) => { ctx.fillStyle = fill; ctx.beginPath(); ctx.roundRect(x - w / 2, y - h / 2, w, h, h / 2); ctx.fill(); if (stroke) { ctx.strokeStyle = stroke; ctx.lineWidth = 2; ctx.stroke(); } };
  const countLines = (str, size, maxW, font = UI, weight = 600) => {
    ctx.font = `${weight} ${size}px ${font}`; const words = str.split(' '); let cur = '', n = 0;
    for (const w of words) { const t2 = cur ? cur + ' ' + w : w; if (ctx.measureText(t2).width > maxW && cur) { n++; cur = w; } else cur = t2; }
    return n + 1;
  };
  const suitText = (s, x, y, r) => suit(ctx, s, x, y, r, s === 1 || s === 2 ? '#ff8a80' : '#f6efe0');

  // ------------------------------------------------------------------------------------------------ title
  if (S.scene === 'title' || S.scene === 'demo-limit') {
    // an idle-animated fan of cards over a star medallion
    const cx = 360, cy = 340;
    ctx.save(); ctx.translate(cx, cy); ctx.rotate(S.calm ? 0 : t * 0.05); ctx.lineWidth = 2; ctx.globalAlpha = 0.6; star8(ctx, 0, 0, 250, 'rgba(240,205,130,0.6)'); star8(ctx, 0, 0, 180, 'rgba(240,205,130,0.45)'); ctx.restore();
    const cards = [12, 24, 26 + 12, 39 + 11, 13 + 12];
    cards.forEach((c, i) => {
      const a = (i - 2) * 0.24 + (S.calm ? 0 : Math.sin(t * 0.9 + i) * 0.02), bob = S.calm ? 0 : Math.sin(t * 1.3 + i * 1.1) * 6;
      ctx.save(); ctx.translate(cx, cy + 210); ctx.rotate(a); drawCard(ctx, c, -84, -330 + bob, 168, 246); ctx.restore();
    });
    // title
    ctx.save(); ctx.shadowColor = 'rgba(0,0,0,0.6)'; ctx.shadowBlur = 14; ctx.shadowOffsetY = 5; text('Tarneeb', 360, 640, 132, '#f6dca0'); ctx.restore();
    text('The partnership card game of the Levant', 360, 676, 27, 'rgba(246,223,174,0.9)', UI, 600);
    if (S.scene === 'demo-limit') {
      panel({ x: 60, y: 760, w: 600, h: 420 });
      wrap('You have played the two free matches of the web demo. Get Tarneeb for iPhone and Android for unlimited matches, all four levels, every lesson and a new Daily Deal.', 360, 830, 30, 520, '#f6dfae', 40);
      return;
    }
    const R = titleRows(!!S.saved);
    if (R.resume) button(R.resume, 'Continue your match', { primary: true, sub: `Hand ${S.saved.handNo}: ${S.saved.scores[0]} to ${S.saved.scores[1]}` });
    button(R.learn, 'Learn to play', { primary: !R.resume && !S.learnedAll, sub: `${S.learned.filter(Boolean).length} of ${LESSONS.length} lessons done` });
    button(R.play, 'New match', { primary: !R.resume && S.learnedAll, sub: `You and your partner against two computers` });
    button(R.daily, 'Daily Deal', { sub: S.daily.solvedDay === S.daily.day ? `Solved today. Streak ${S.daily.streak}` : `Open-hand puzzle. Streak ${S.daily.streak}` });
    button(R.about, 'About', { size: 28 });
    button(R.rules, 'Rules', { size: 28 });
    button(R.level, `Computer: ${LEVELS[S.level].name}`, { size: 28, sub: LEVELS[S.level].blurb });
    button(R.sound, S.sound ? 'Sound on' : 'Sound off', { size: 24, on: S.sound });
    button(R.calm, S.calm ? 'Calm motion' : 'Full motion', { size: 24, on: S.calm });
    button(R.big, S.big ? 'Large print' : 'Standard cards', { size: 24, on: S.big });
    button(R.target, `Game to ${S.target}`, { size: 24 });
    button(R.auto, 'Auto Play', { size: 30, sub: 'Watch & Learn - every seat computer-played, hands open' });
    return;
  }

  // ------------------------------------------------------------------------------------------------ about / rules
  // Both are paginated reference sheets, one concept per page, sharing this one renderer: a framed
  // reader card (the same warm walnut/gold panel used everywhere else in this game, not a new
  // style), real comfortable body text, and a text-size stepper in the top corners (this game's
  // Back/Next live at the bottom of the screen, so the corners are free and nothing gets crowded).
  if (S.scene === 'about' || S.scene === 'rules') {
    const isAbout = S.scene === 'about', list = isAbout ? ABOUT : RULES, backBtn = isAbout ? ABOUT_BACK : RULES_BACK, nextBtn = isAbout ? ABOUT_NEXT : RULES_NEXT;
    const n = list.length, idx = ((S.page % n) + n) % n, page = list[idx];
    // Falls back to 1 for any out-of-range index (e.g. a save from a build with more/fewer steps).
    const scale = TEXT_SCALES[S.textScaleIdx] ?? 1;
    const headSize = Math.round(62 * Math.min(scale, 1.12)); // the big page title; already generous, capped so it never crowds the stepper
    // The page's own title stops growing past the 200% step (2x) - it is already a large display
    // font there, and letting it keep growing at 250%/300% would force it further and further
    // above the reader-card's frame (see panelTop below). Body text keeps scaling uncapped, which
    // is the point of the stepper.
    const titleScale = Math.min(scale, 2);
    const titleSize = Math.round(30 * titleScale), bodySize = Math.round(28 * scale), lh = Math.round(bodySize * 1.4), paraGap = Math.round(11 * scale), titleLH = Math.round(titleSize * 1.15);
    const bodyW = 580;
    text(isAbout ? 'About Tarneeb' : 'Rules', 360, 148, headSize);
    let cardsH = 0;
    if (page.cards) cardsH = 134 + (page.cards.some((c) => c.label) ? 26 : 0) + Math.round(24 * scale);
    // The reader-card's top edge backs off further at larger text sizes so a page's own (scaled)
    // title never pokes its ascenders out above the frame into the screen header above it. Uses
    // the same capped titleScale as the title itself, so the frame's top edge stops moving once
    // the title itself stops growing (200%+).
    const top = 226, panelTop = top - Math.round(26 * titleScale), panelBottom = 1400; // fixed reader-card, room left below short pages for a small flourish
    panel({ x: 40, y: panelTop, w: 640, h: panelBottom - panelTop });
    let y = top;
    // A page title wraps (like the body text) instead of running off the frame - a long title at
    // the top text-size step would otherwise overflow the panel's right edge.
    y += wrap(page.title, 70, y, titleSize, bodyW, GOLD, titleLH, 'left', FONT, 700) * titleLH + Math.round(14 * scale);
    if (page.cards) {
      const cw = 92, ch = 134, gap = 22, cn = page.cards.length, totalW = cn * cw + (cn - 1) * gap, x0 = 360 - totalW / 2;
      page.cards.forEach((cd, i) => drawCard(ctx, cd.c, x0 + i * (cw + gap), y, cw, ch));
      if (page.cards.some((c) => c.label)) page.cards.forEach((cd, i) => { if (cd.label) text(cd.label, x0 + i * (cw + gap) + cw / 2, y + ch + 22, 15, 'rgba(246,223,174,0.75)', UI, 600); });
      y += cardsH;
    }
    page.lines.forEach((l) => { y += wrap(l, 70, y, bodySize, bodyW, '#f0e2c4', lh, 'left').valueOf() * lh + paraGap; });
    // A small faded four-suit flourish, only drawn where it actually fits below the last line of
    // text - never on top of a longer page's last paragraph.
    const remaining = panelBottom - y;
    if (remaining > 200) {
      const cy = y + remaining / 2, gapX = 84, x0 = 360 - gapX * 1.5;
      ctx.save(); ctx.globalAlpha = 0.3;
      [0, 1, 2, 3].forEach((s, i) => suit(ctx, s, x0 + i * gapX, cy, 32, s === 1 || s === 2 ? '#ff8a80' : '#f6efe0'));
      ctx.restore();
    }
    text(`Page ${idx + 1} of ${n}`, 360, 1440, 20, 'rgba(246,223,174,0.65)', UI, 600);
    button(backBtn, 'Back');
    button(nextBtn, 'Next', { primary: true });
    button(TEXT_DEC, 'A−', { size: 30, dim: S.textScaleIdx === 0 });
    button(TEXT_INC, 'A+', { size: 30, dim: S.textScaleIdx === TEXT_SCALES.length - 1 });
    return;
  }
  // ------------------------------------------------------------------------------------------------ lesson list
  if (S.scene === 'lessons') {
    text('Learn to play', 360, 150, 68);
    text('Eight short lessons. You make every move yourself.', 360, 200, 24, 'rgba(246,223,174,0.85)', UI, 600);
    LESSON_ROWS(LESSONS.length).forEach((r, i) => {
      button(r, `${i + 1}. ${LESSONS[i].title}`, { size: 26, dim: false, on: S.learned[i] });
      if (S.learned[i]) text('Done', r.x + r.w - 56, r.y + r.h / 2 + 6, 18, '#0f3a26', UI, 700);
    });
    button(LESSONS_BACK(LESSONS.length), 'Back', { primary: true });
    return;
  }

  // ------------------------------------------------------------------------------------------------ the table
  if (!tb) return;
  // Auto Play shows every hand open too: with all four seats computer-played there is no hidden
  // information left to protect, and the viewer needs to see every seat's hand to compare its own
  // guess against (same idiom the "open-hand" Daily Deal puzzle already uses for this reason).
  const Hh = tb.H, open = tb.mode === 'puzzle' || tb.mode === 'auto', big = S.big;
  const dealing = tb.deal, dealSeq = dealing ? dealCounts(tb) : null;
  // The pending card, if any (Hint's own highlight for seat 0, or Auto Play's REVEAL for whichever
  // seat is about to act) - defined early so both the open-hand seats below and "your hand" further
  // down can use the same value.
  const hintC = tb.hint && tb.hint.c !== undefined ? tb.hint.c : -1;

  // ---- top area: score HUD (match), lesson card or puzzle card. Lesson text is variable length, so its panel
  // (and everything below it, down to the partner's seat) is sized and positioned to fit however many lines it needs.
  let seat2Drop = 0, trumpY = 196, showTrump = Hh.phase !== 'bid' && Hh.trump >= 0;
  if (tb.mode === 'play') {
    panel({ x: 34, y: 84, w: 210, h: 84 }, 0.7); panel({ x: 476, y: 84, w: 210, h: 84 }, 0.7);
    text('US', 139, 116, 22, '#9fe0b8', UI, 700); text(String(tb.scores[0]), 139, 156, 42, '#fff2cf');
    text('THEM', 581, 116, 22, '#f0a595', UI, 700); text(String(tb.scores[1]), 581, 156, 42, '#fff2cf');
    text(`First to ${tb.target}`, 360, 106, 20, 'rgba(246,223,174,0.8)', UI, 600);
  } else if (tb.mode === 'lesson') {
    const L = LESSONS[S.lesson.i], msg = tb.lessonMsg || L.text, lines = countLines(msg, 21, 620, UI, 600);
    const panelH = 76 + lines * 27, panelBottom = 74 + panelH;
    panel({ x: 24, y: 74, w: 672, h: panelH }, 0.86);
    text(`Lesson ${S.lesson.i + 1} of ${LESSONS.length}: ${L.title}`, 360, 112, 34);
    wrap(msg, 360, 148, 21, 620, '#f6e8c8', 27);
    trumpY = panelBottom + 46; showTrump = Hh.trump >= 0; seat2Drop = Math.max(0, trumpY + 130 - SEAT[2].y);
  } else if (tb.mode === 'puzzle') {
    panel({ x: 24, y: 74, w: 672, h: 130 }, 0.86);
    text('Daily Deal', 360, 112, 36);
    wrap(S.puzText, 360, 144, 20, 620, '#f6e8c8', 26);
    trumpY = 236; showTrump = true;
  } else if (tb.mode === 'auto') {
    panel({ x: 24, y: 74, w: 672, h: 150 }, 0.86);
    text('Auto Play', 360, 112, 36);
    text(`Watch & Learn  ·  think time ${THINK_STEPS[S.autoThinkIdx]}s`, 360, 146, 22, 'rgba(246,223,174,0.92)', UI, 600);
    text(`Us ${tb.scores[0]}   Them ${tb.scores[1]}   ·   First to ${tb.target}`, 360, 178, 19, 'rgba(246,223,174,0.75)', UI, 600);
    trumpY = 256; showTrump = Hh.trump >= 0;
  }
  // contract chip and trick count
  if (showTrump) {
    const y = trumpY;
    pill(360, y, 300, 40, 'rgba(0,0,0,0.42)', 'rgba(232,195,119,0.6)');
    text('Trump', 262, y + 8, 20, '#f6dfae', UI, 600, 'left'); suitText(Hh.trump, 344, y, 12);
    text(tb.mode === 'puzzle' ? `Need ${S.puzTarget}` : `Bid ${Hh.contract} · ${SEAT_NAMES[Hh.declarer] === 'You' ? 'you' : SEAT_NAMES[Hh.declarer].toLowerCase()}`, 372, y + 8, 20, '#f6dfae', UI, 600, 'left');
    text(`Tricks   Us ${Hh.tricks[0]}   Them ${Hh.tricks[1]}`, 360, y + 50, 19, 'rgba(246,223,174,0.85)', UI, 600);
  }

  // ---- seats: name plates and the other three hands
  for (let p = 1; p < 4; p++) {
    const n = Hh.hands[p].length, sh = dealing ? dealSeq[p] : n, drop = p === 2 ? seat2Drop : 0, pl = { x: PLATE[p].x, y: PLATE[p].y + drop }, seatXY = { x: SEAT[p].x, y: SEAT[p].y + drop };
    const active = !Hh.winnerShown && ((Hh.phase === 'bid' && Hh.bid.turn === p) || (Hh.phase === 'play' && Hh.turn === p && !tb.collect) || (Hh.phase === 'trump' && Hh.declarer === p));
    if (open) {
      const cards = Hh.hands[p];
      // Auto Play's REVEAL phase, for whichever seat is about to play a card: the same dim-the-
      // illegal / glow-the-legal / brighter-glow-the-chosen treatment "your hand" already gives
      // seat 0 below, just applied here since every hand is open during this mode.
      const revealing = tb.mode === 'auto' && tb.autoPhase === 'reveal' && Hh.phase === 'play' && Hh.turn === p;
      const legalHere = revealing ? legalPlays(Hh, p) : null;
      cards.forEach((c, i) => {
        const w = 66, h = 97, isChosen = revealing && c === hintC, isLegal = !legalHere || legalHere.includes(c);
        const o = { big, dim: legalHere && !isLegal, glow: isChosen ? '#ffe28a' : (legalHere && isLegal && Hh.trick.length ? 'rgba(255,240,170,0.55)' : undefined) };
        if (p === 2) drawCard(ctx, c, 360 - (cards.length * 74 - 8) / 2 + i * 74, 262 - (isChosen ? 10 : 0), w, h, o);
        else { const cy = seatXY.y + (i - (cards.length - 1) / 2) * 62; drawCard(ctx, c, p === 3 ? 22 : W - 22 - w, cy - h / 2 - (isChosen ? 10 : 0), w, h, o); }
      });
    } else {
      const count = sh;
      for (let i = 0; i < count; i++) {
        const off = (i - (count - 1) / 2) * (count > 8 ? 22 : 30);
        if (p === 2) drawCard(ctx, -1, seatXY.x + off - BACK.w / 2, seatXY.y - BACK.h / 2, BACK.w, BACK.h, { back: S.back });
        else drawCard(ctx, -1, seatXY.x - BACK.w / 2, seatXY.y + off - BACK.h / 2, BACK.w, BACK.h, { back: S.back, rot: p === 1 ? -Math.PI / 2 : Math.PI / 2 });
      }
    }
    const status = Hh.phase === 'bid' ? (Hh.bid.log[p] === null ? '' : Hh.bid.log[p] === 0 ? 'Pass' : `Bid ${Hh.bid.log[p]}`) : (Hh.dealer === p ? 'Dealer' : '');
    const pw = 132, ph = status ? 64 : 44, py = pl.y;
    if (active) { ctx.save(); ctx.shadowColor = '#ffd87a'; ctx.shadowBlur = 18 + (S.calm ? 0 : Math.sin(t * 6) * 5); }
    pill(pl.x, py, pw, ph, active ? 'rgba(90,56,20,0.95)' : 'rgba(0,0,0,0.5)', active ? '#ffd87a' : 'rgba(232,195,119,0.5)');
    if (active) ctx.restore();
    text(SEAT_NAMES[p], pl.x, py + (status ? -4 : 8), 24, teamOf(p) === 0 ? '#a8ecc4' : '#f6dfae', UI, 700);
    if (status) text(status, pl.x, py + 20, 19, status === 'Pass' ? 'rgba(246,223,174,0.7)' : '#fff2cf', UI, 600);
    if (tb.mode !== 'lesson' || true) { /* tricks won pile marker is in the HUD */ }
  }

  // ---- trick area (cards on the table)
  const flying = (c) => tb.flights.find((f) => f.c === c);
  const drawSlot = (p, c, alpha = 1, k = 1, dx = 0, dy = 0) => {
    const s = SLOT[p], w = TRICK_CARD.w * k, h = TRICK_CARD.h * k;
    ctx.save(); ctx.globalAlpha = alpha; drawCard(ctx, c, s.x - w / 2 + dx, s.y - h / 2 + dy, w, h, { rot: (((c * 7) % 9) - 4) * 0.013, big }); ctx.restore();
  };
  if (tb.collect) {
    const col = tb.collect, sw = clamp01((col.t - 0.7) / 0.4), to = SEAT[col.winner];
    if (col.t > 0.15) { const wp = SLOT[col.winner]; ctx.save(); ctx.strokeStyle = `rgba(255,216,122,${0.85 * (1 - sw)})`; ctx.lineWidth = 5; ctx.beginPath(); ctx.roundRect(wp.x - 56, wp.y - 80, 112, 160, 12); ctx.stroke(); ctx.restore(); }
    for (const cd of col.cards) {
      if (flying(cd.c)) continue;
      const s = SLOT[cd.p], e = ease(sw);
      drawSlot(cd.p, cd.c, 1 - sw * 0.9, 1 - e * 0.45, (to.x - s.x) * e, (to.y - s.y) * e);
    }
  } else for (const cd of Hh.trick) if (!flying(cd.c)) drawSlot(cd.p, cd.c);

  // ---- bidding panel / trump picker
  // Auto Play never lets a tap through (game.js's pressTable returns early for tb.mode==='auto'),
  // but it still shows this same panel - read-only - for every seat's bid/trump turn, not only
  // seat 0's, so the REVEAL ring (tb.hint, set by autoTick) is visible regardless of who is acting.
  const humanBid = Hh.phase === 'bid' && Hh.bid.turn === 0 && !tb.blocked && !tb.auto;
  const humanTrump = Hh.phase === 'trump' && Hh.declarer === 0 && !tb.blocked && !tb.auto;
  const showBidPicker = humanBid || (tb.auto && Hh.phase === 'bid' && !tb.blocked);
  const showTrumpPicker = humanTrump || (tb.auto && Hh.phase === 'trump' && !tb.blocked);
  if (!dealing && Hh.phase === 'bid') {
    panel(BID.panel, 0.88);
    const b = Hh.bid, names = [1, 2, 3, 0].map((p) => `${SEAT_NAMES[p]} ${b.log[p] === null ? '·' : b.log[p] === 0 ? 'Pass' : b.log[p]}`).join('   ');
    const autoReveal = tb.auto && tb.autoPhase === 'reveal';
    text(humanBid ? (b.high ? `Your bid (higher than ${b.high}), or pass` : 'Your bid: how many tricks will your side take?') : autoReveal ? 'This is the bid - compare it with your own guess.' : `${SEAT_NAMES[b.turn] === 'You' ? 'You are' : SEAT_NAMES[b.turn] + ' is'} thinking…`, 360, 972, 22, '#f6dfae', UI, 700);
    if (showBidPicker) {
      BID.nums.forEach((r) => button(r, String(r.n), { size: 34, dim: r.n <= b.high, ring: tb.hint && tb.hint.n === r.n ? '#ffe28a' : undefined, primary: tb.hint && tb.hint.n === r.n }));
      button(BID.pass, 'Pass', { size: 30, ring: tb.hint && tb.hint.n === 0 ? '#ffe28a' : undefined });
    } else text(names, 360, 1070, 22, 'rgba(246,223,174,0.9)', UI, 600);
    if (showBidPicker) text(names, 360, 1150, 18, 'rgba(246,223,174,0.7)', UI, 500);
  }
  if (!dealing && showTrumpPicker) {
    panel(BID.panel, 0.9);
    text(humanTrump ? `You won the bid with ${Hh.contract}. Name trump:` : `${SEAT_NAMES[Hh.declarer]} won the bid with ${Hh.contract} and names trump:`, 360, 972, 24, '#f6dfae', UI, 700);
    BID.suits.forEach((r) => {
      button(r, '', { primary: tb.hint && tb.hint.s === r.s, ring: tb.hint && tb.hint.s === r.s ? '#ffe28a' : undefined });
      suit(ctx, r.s, r.x + r.w / 2, r.y + 52, 34, r.s === 1 || r.s === 2 ? '#ff8a80' : '#f6efe0');
      text(SUIT_NAMES[r.s], r.x + r.w / 2, r.y + 120, 22, '#f6dfae', UI, 700);
    });
  }
  if (!dealing && Hh.phase === 'trump' && !showTrumpPicker) {
    pill(360, 1000, 420, 56, 'rgba(0,0,0,0.5)', 'rgba(232,195,119,0.6)');
    text(`${SEAT_NAMES[Hh.declarer]} won the bid with ${Hh.contract} and names trump…`, 360, 1008, 21, '#f6dfae', UI, 600);
  }

  // ---- message banner
  if (tb.msg && !(Hh.phase === 'bid' && !dealing) && !(Hh.phase === 'trump' && showTrumpPicker)) {
    const a = clamp01(Math.min(tb.msg.t / 0.15, (tb.msg.hold - tb.msg.t) / 0.5));
    if (a > 0) {
      ctx.save(); ctx.globalAlpha = a; const mr = { x: 40, y: 1130, w: 640, h: 86 }; panel(mr, 0.9);
      wrap(tb.msg.text, 360, 1130 + 33, 22, 590, '#fff2cf', 27); ctx.restore();
    }
  }

  // ---- your hand
  const hand = Hh.hands[0], shown = dealing ? dealSeq[0] : hand.length;
  const L = handLayout(hand.length), turnNow = Hh.phase === 'play' && Hh.turn === 0 && !tb.collect && !tb.blocked, legal = turnNow ? legalPlays(Hh, 0) : [];
  for (let i = 0; i < shown; i++) {
    const c = hand[i], r = L[i];
    if (flying(c) && false) continue;
    if (tb.drag && tb.drag.i === i && tb.drag.moved) continue;
    const isSel = tb.sel === i, shake = tb.shake && tb.shake.i === i ? Math.sin(tb.shake.t * 55) * 7 * (1 - clamp01(tb.shake.t / 0.4)) : 0;
    const lift = (isSel ? LIFT : 0) + (c === hintC ? 26 + (S.calm ? 0 : Math.sin(t * 6) * 6) : 0);
    const ok = !turnNow || legal.includes(c);
    drawCard(ctx, c, r.x + shake, r.y - lift, r.w, r.h, { big, dim: turnNow && !ok, glow: c === hintC ? '#ffe28a' : isSel ? '#ffd87a' : (turnNow && ok && Hh.trick.length ? 'rgba(255,240,170,0.55)' : undefined) });
  }
  if (tb.drag && tb.drag.moved && hand[tb.drag.i] !== undefined) drawCard(ctx, hand[tb.drag.i], tb.drag.x - CARD.w / 2, tb.drag.y - CARD.h / 2, CARD.w * 1.05, CARD.h * 1.05, { big, glow: '#ffd87a' });
  if (turnNow && !tb.msg && tb.mode !== 'lesson') { pill(360, 1242, 250, 34, 'rgba(0,0,0,0.5)'); text(Hh.trick.length ? 'Your turn: follow suit' : 'Your turn: lead a card', 360, 1249, 19, '#ffe9b0', UI, 700); }

  // ---- flights (cards moving) and the deal
  for (const f of tb.flights) {
    const e = ease(clamp01(f.t / f.dur)), k = f.k0 + (f.k1 - f.k0) * e, w = TRICK_CARD.w * k, h = TRICK_CARD.h * k;
    ctx.save(); const y = f.from.y + (f.to.y - f.from.y) * e - Math.sin(Math.PI * e) * 30;
    drawCard(ctx, f.c, f.from.x + (f.to.x - f.from.x) * e - w / 2, y - h / 2, w, h, { big, rot: (((f.c * 7) % 9) - 4) * 0.013 * e });
    ctx.restore();
  }
  if (dealing) {
    for (let k = 0; k < 52; k++) {
      const st = k * 0.028, f = (dealing.t - st) / 0.32; if (f <= 0 || f >= 1) continue;
      const seat = (Hh.dealer + 1 + k) % 4, to = SEAT[seat], e = ease(f);
      drawCard(ctx, -1, DECK.x + (to.x - DECK.x) * e - 26, DECK.y + (to.y - DECK.y) * e - 38 - Math.sin(Math.PI * e) * 24, 52, 76, { back: S.back, rot: e * (seat & 1 ? 1.4 : 0.2) * (seat === 1 ? -1 : 1) });
    }
    if (dealing.t < 0.05 || true) { const left = 52 - Math.floor(dealing.t / 0.028); if (left > 0) for (let i = 0; i < 4; i++) drawCard(ctx, -1, DECK.x - 26 + i * 1.5, DECK.y - 38 - i * 1.5, 52, 76, { back: S.back }); }
  }

  // ---- bottom rail buttons
  if (tb.mode === 'auto') {
    // The think-time stepper takes the Undo/Hint slots (same rects, no new layout) - neither
    // undo nor a hint means anything with nobody tapping.
    button(BTN.leave, 'Exit', { size: 26 });
    button(BTN.undo, '− Think', { size: 22, dim: S.autoThinkIdx <= 0 });
    button(BTN.hint, 'Think +', { size: 22, dim: S.autoThinkIdx >= THINK_STEPS.length - 1 });
  } else {
    if (tb.mode === 'play') button(BTN.leave, 'Leave', { size: 26 });
    else button(BTN.leave, tb.mode === 'lesson' ? 'Lessons' : 'Leave', { size: 26 });
    button(BTN.undo, 'Undo', { size: 26, dim: !tb.undo.length });
    button(BTN.hint, tb.hintsLeft < 90 ? `Hint (${tb.hintsLeft})` : 'Hint', { size: 26, dim: tb.hintsLeft <= 0 });
  }

  // ---- lesson result buttons
  if (tb.mode === 'lesson' && S.lesson.state === 'done') {
    panel({ x: 60, y: 940, w: 600, h: 200 });
    text('Well done!', 360, 1002, 48, '#fff2cf'); button(BTN.lesson, S.lesson.i + 1 < LESSONS.length ? 'Next lesson' : 'Finish', { primary: true, size: 30 });
  }
  if (tb.mode === 'lesson' && S.lesson.state === 'retry') { button(BTN.lesson, 'Try again', { primary: true, size: 30 }); }

  // ---- puzzle result
  if (tb.mode === 'puzzle' && S.puz.state !== 'play') {
    panel({ x: 50, y: 560, w: 620, h: 520 }, 0.92);
    const won = S.puz.state === 'solved';
    text(won ? 'Solved!' : 'Not this time', 360, 650, 64, won ? '#fff2cf' : '#f0c0b0');
    wrap(won ? `You and your partner took ${Hh.tricks[0]} of 5 tricks. Streak: ${S.daily.streak} day${S.daily.streak === 1 ? '' : 's'}.` : `You needed ${S.puzTarget} tricks and took ${Hh.tricks[0]}. Take back a card with Undo and try another line, or leave for today.`, 360, 710, 26, 500, '#f6e8c8', 34);
    button({ x: 110, y: 900, w: 500, h: 80 }, won ? 'Done' : 'Leave', { primary: true, size: 30 });
    if (!won) button({ x: 110, y: 990, w: 500, h: 70 }, 'Show me the solution', { size: 26 });
  }

  // ---- hand summary and match result overlays
  if (tb.summary) {
    const sm = tb.summary; panel({ x: 40, y: 250, w: 640, h: 680 }, 0.95);
    text(sm.sweep ? 'All thirteen tricks!' : sm.made ? 'Contract made' : 'Contract failed', 360, 330, 56, sm.made === (sm.declarerTeam === 0) ? '#fff2cf' : '#f0c0b0');
    wrap(sm.line1, 360, 392, 26, 560, '#f6e8c8', 34);
    wrap(sm.line2, 360, 500, 26, 560, '#f6e8c8', 34);
    text('MATCH SCORE', 360, 620, 22, 'rgba(246,223,174,0.75)', UI, 700);
    text(`US ${tb.scores[0]}      THEM ${tb.scores[1]}`, 360, 690, 58, '#fff2cf');
    text(`First to ${tb.target}`, 360, 730, 22, 'rgba(246,223,174,0.75)', UI, 600);
    if (tb.mode === 'lesson') wrap('That is how a hand is scored. Nicely played.', 360, 800, 24, 520, '#f6e8c8', 30);
    button(BTN.next, tb.mode === 'lesson' ? 'Finish lesson' : tb.over ? 'See the result' : 'Next hand', { primary: true, size: 32 });
  }
  if (tb.over && !tb.summary) {
    panel({ x: 40, y: 330, w: 640, h: 620 }, 0.95);
    const win = tb.over.winner === 0, auto = tb.mode === 'auto';
    text(auto ? (win ? 'South & North win!' : 'East & West win!') : win ? 'You win!' : 'They win', 360, 440, 76, win ? '#fff2cf' : '#f0c0b0');
    text(`Final score   Us ${tb.scores[0]}   Them ${tb.scores[1]}`, 360, 510, 30, '#f6e8c8', UI, 700);
    if (tb.over.unlocked) text(`${LEVELS[tb.over.unlocked].name} level unlocked`, 360, 560, 26, '#a8ecc4', UI, 700);
    wrap(auto ? 'A full match, played entirely by the computer.' : win ? 'You and your partner took the match.' : 'A hard-fought match. Try a lower level or use Hint and Undo.', 360, 610, 26, 520, '#f6e8c8', 34);
    // BTN.next, not a typo: see the comment on this screen's tap handling in game.js pressTable().
    button(BTN.next, 'Play again', { primary: true, size: 32 }); button(BTN.back, auto ? 'Exit to menu' : 'Menu', { size: 30 });
  }
  if (tb.leaving) {
    panel({ x: 60, y: 520, w: 600, h: 420 }, 0.96);
    text(tb.mode === 'play' ? 'Leave the table?' : 'Leave?', 360, 600, 54, '#fff2cf');
    wrap(tb.mode === 'play' ? 'Your match is saved at the start of each trick. You can continue it from the menu.' : 'You can come back any time.', 360, 650, 24, 500, '#f6e8c8', 32);
    button({ x: 110, y: 760, w: 500, h: 76 }, 'Keep playing', { primary: true, size: 30 }); button({ x: 110, y: 850, w: 500, h: 70 }, 'Leave', { size: 28 });
  }
}

// how many cards each seat has received at this moment of the deal
function dealCounts(tb) {
  const c = [0, 0, 0, 0];
  for (let k = 0; k < 52; k++) if (tb.deal.t >= k * 0.028 + 0.32) c[(tb.H.dealer + 1 + k) % 4]++;
  return c;
}
void sortHand; void SH; void suitColor; void DECK; void HAND_Y;
