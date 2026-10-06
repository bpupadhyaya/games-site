// Every button on every screen, as data. `screenButtons(state)` is used both to draw (view.js) and to hit-test (game.js),
// so what you see is exactly what you can tap. All geometry comes from the LIVE layout (layout.js `L`, kept current by applyLayout),
// so the same code serves a tall phone, a tablet and a landscape screen. At the tall phone size (720 x 1560) every rect is the original.
import { LESSONS } from './lessons.js';
import { LEVELS, LEVEL_NAMES, LEVEL_BLURB } from './ai.js';
import { L, barRects } from './layout.js';

// Text-size steps for the reference pages (How to play / About / Rules). An index into this array,
// never a raw float, so the stepper can cleanly disable at either end and a stale saved index from a
// build with a shorter/longer array is easy to clamp (see game.js prefs load). Top step is 3x (300%).
export const TEXT_SCALES = [1, 1.5, 2, 2.5, 3];
// Auto Play THINK-phase steps, in seconds: an index into this array (never a raw float), default
// 5s (index 1), hard-capped at 10s per the owner's instruction that a longer wait defeats the point.
export const AP_THINK_STEPS = [2, 5, 8, 10];
export const SETUP_DESC = {
  ludo: 'Ludo mode: one die, a smaller board, a 6 to enter and to throw again. No blocks. A friendly first step.',
  pachisi: 'Pachisi: six cowrie shells, grace throws, safe squares, blocks and the home lane. The full royal race.',
};

const R = (x, y, w, h) => ({ x, y, w, h });
const fit = (h, pad = 24) => Math.max(0.62, Math.min(1, (L.U.h - pad) / h));
const rowAt = (n, i, x0, w, gap = 14) => { const cw = (w - gap * (n - 1)) / n; return { x: x0 + i * (cw + gap), w: cw }; };
const chipRow = (ids, y, h, cur, labels, x0, w, extra = {}) => ids.map((id, i) => ({ id, y, h, ...rowAt(ids.length, i, x0, w), label: labels[i], sel: cur === id, chip: true, ...extra }));

// ---- the title screen -------------------------------------------------------------------------------------------------------
export function titleGeo(s) {
  const has = !!s.saved, T = L.title, plate = T.plateFor(has), sc = T.rowScale(has), x0 = plate.x + 24, w = plate.w - 48, B = [];
  let y = plate.y + 26;
  const put = (b, gap) => { B.push(b); y += b.h + gap * sc; };
  const H = (h) => Math.round(h * sc);
  if (has) { put({ id: 'continue', x: x0, y, w, h: H(78), label: 'Continue game', primary: true }, 12); put({ id: 'new', x: x0, y, w, h: H(68), label: 'New game' }, 12); }
  else put({ id: 'new', x: x0, y, w, h: H(84), label: 'Play', primary: true, size: 42 }, 14);
  { const h = H(70); B.push({ id: 'learn', y, h, ...rowAt(2, 0, x0, w), label: 'Learn to play' }, { id: 'daily', y, h, ...rowAt(2, 1, x0, w), label: 'Daily race' }); y += h + 14 * sc; }
  put({ id: 'autoplay', x: x0, y, w, h: H(66), label: 'Auto Play · Watch & Learn', size: 28 }, 14);
  { const h = H(62); B.push({ id: 'about', y, h, ...rowAt(3, 0, x0, w), label: 'About', size: 26 }, { id: 'how', y, h, ...rowAt(3, 1, x0, w), label: 'How to play', size: 26 }, { id: 'settings', y, h, ...rowAt(3, 2, x0, w), label: 'Settings', size: 26 }); y += h + 14 * sc; }
  put({ id: 'rules', x: x0, y, w, h: H(66), label: 'Rules', size: 28 }, 0);
  return { plate, buttons: B, footY: plate.y + plate.h - 22 };
}

// ---- the set-up screen -----------------------------------------------------------------------------------------------------
export function setupGeo(s) {
  const P = L.panel, t = s.setup, x0 = P.x + 24, w = P.w - 48, B = [], labels = [], texts = [];
  const inline = L.panelWide || P.h < 900, labW = L.panelWide ? 200 : 170, cw = w - labW, oneRow = cw >= 600;
  const levelIds = LEVELS.map((l) => 'opp:' + l).concat('opp:mixed'), levelLab = LEVELS.map((l) => LEVEL_NAMES[l]).concat('Mixed');
  const secs = [
    { label: 'Game', rows: [[['mode:pachisi', 'mode:ludo'], 'mode:' + t.mode, ['Pachisi', 'Ludo mode'], 70]] },
    { label: 'Players', rows: [[['pl:2', 'pl:3', 'pl:4'], 'pl:' + t.players, ['2 players', '3 players', '4 players'], 70]] },
    { label: 'Who plays', rows: [[['who:cpu', 'who:friends'], t.friends ? 'who:friends' : 'who:cpu', ['You vs computer', 'Friends, one phone'], 70]] },
  ];
  const oneLevelRow = inline ? oneRow : false;
  if (!t.friends) secs.push({ label: 'Computer level', rows: oneLevelRow ? [[levelIds, 'opp:' + t.opp, levelLab, 64]] : [[levelIds.slice(0, 3), 'opp:' + t.opp, levelLab.slice(0, 3), 64], [levelIds.slice(3), 'opp:' + t.opp, levelLab.slice(3), 64]] });
  secs.push({ label: 'Pawns each', rows: [[['pcs:4', 'pcs:2'], 'pcs:' + t.pieces, ['4 pawns each', '2 pawns (short)'], 70]] });
  const descStr = SETUP_DESC[t.mode];
  const blurb = t.friends ? 'Friends: everyone takes turns on this phone. A pass-the-phone screen appears between turns.' : t.opp === 'mixed' ? 'Mixed: each computer player has a different personality.' : `${LEVEL_NAMES[t.opp]}: ${LEVEL_BLURB[t.opp]}`;
  const top = P.y + 108, startH = 88, backH = 70, pad = 38;
  if (L.panelWide && P.h < 520) {
    // very short landscape screens: two columns, the label above its chips, Back / Start under the right column
    const c2 = (w - 24) / 2, rx = x0 + c2 + 24, lh = 22, rh = 52, pitchY = lh + rh + 14, top2 = P.y + 84;
    const place = (list, colX, y0) => { let y = y0; for (const c of list) { labels.push({ text: c.label, x: colX, y: y + 16, size: 22 }); for (const [ids, cur, labs] of c.rows) { B.push(...chipRow(ids, Math.round(y + lh), rh, cur, labs, colX, c2)); y += pitchY; } } return y; };
    const lv = secs.filter((c) => c.label === 'Computer level').map((c) => ({ ...c, rows: [[levelIds, 'opp:' + t.opp, levelLab, 52]] }));
    place(secs.slice(0, 3), x0, top2); const ry = place([...lv, secs[secs.length - 1]], rx, top2) - 4;
    const bk = Math.round(c2 * 0.32); B.push({ id: 'back', x: rx, y: ry, w: bk, h: 56, label: 'Back' }, { id: 'start', x: rx + bk + 12, y: ry, w: c2 - bk - 12, h: 56, label: 'Start game', primary: true, size: 32 });
  } else if (!inline) {
    // single column: sections flow down; start / back at the foot of the panel
    const foot = P.y + P.h - pad - (startH + 12 + backH);
    const textH = 150, rowsH = secs.reduce((a, c) => a + 38 + c.rows.length * 74 + 28, 0);
    const avail = foot - top - textH - 16, u = Math.max(0.6, Math.min(1.12, avail / rowsH));
    let y = top;
    for (const c of secs) {
      labels.push({ text: c.label, x: x0, y: y + 22 * u + 6, size: 26 });
      y += 38 * u;
      for (const [ids, cur, labs, h] of c.rows) { B.push(...chipRow(ids, Math.round(y), Math.round(h * u), cur, labs, x0, w)); y += (h + 8) * u; }
      y += 28 * u;
    }
    texts.push({ str: descStr, x: P.x + P.w / 2, y: y + 6, w: Math.min(580, P.w - 68), size: 22, lh: 30, color: 'ink' });
    texts.push({ str: blurb, x: P.x + P.w / 2, y: y + 6 + 70 * Math.min(1, u + 0.2), w: Math.min(560, P.w - 88), size: 24, lh: 32, color: 'red' });
    B.push({ id: 'start', x: x0, y: foot, w, h: startH, label: 'Start game', primary: true, size: 38 }, { id: 'back', x: x0, y: foot + startH + 12, w, h: backH, label: 'Back' });
  } else {
    // label on the left, chips on the right, one line per row; description + Back / Start along the foot
    const cx0 = x0 + labW, footH = 74, foot = P.y + P.h - 22 - footH, textH = L.panelWide ? 104 : 96, avail = foot - top - textH - 6;
    const lines = secs.reduce((a, c) => a + c.rows.length, 0), u = Math.max(0.5, Math.min(1, avail / (lines * 76)));
    let y = top;
    for (const c of secs) {
      const h = Math.round(c.rows[0][3] * u);
      labels.push({ text: c.label, x: x0, y: y + h / 2 + 9, size: 26 });
      for (const [ids, cur, labs] of c.rows) { B.push(...chipRow(ids, Math.round(y), h, cur, labs, cx0, cw)); y += h + 10 * u; }
      y += 4 * u;
    }
    if (L.panelWide) { texts.push({ str: descStr, x: x0, y: y + 14, w: w * 0.5 - 12, size: 21, lh: 27, color: 'ink', left: true }, { str: blurb, x: x0 + w * 0.5 + 12, y: y + 14, w: w * 0.5 - 12, size: 21, lh: 28, color: 'red', left: true }); }
    else { texts.push({ str: descStr, x: x0, y: y + 8, w, size: 21, lh: 26, color: 'ink', left: true }, { str: blurb, x: x0, y: y + 8 + 56, w, size: 21, lh: 26, color: 'red', left: true }); }
    const bk = Math.round(w * 0.28);
    B.push({ id: 'back', x: x0, y: foot, w: bk, h: footH, label: 'Back' }, { id: 'start', x: x0 + bk + 16, y: foot, w: w - bk - 16, h: footH, label: 'Start game', primary: true, size: 36 });
  }
  return { buttons: B, labels, texts };
}

// ---- Learn / Settings ------------------------------------------------------------------------------------------------------
export function learnGeo(s) {
  const P = L.panel, wide = L.panelWide, x0 = P.x + 24, w = P.w - 48, B = [], n = LESSONS.length;
  const backH = wide ? 64 : 70, backY = P.y + P.h - (wide ? 24 + backH : 108), top = P.y + (wide ? 118 : 150);
  const cols = wide ? 2 : 1, rows = Math.ceil(n / cols), pitch = Math.min(96, (backY - 12 - top) / rows), h = Math.round(pitch * 0.85), cw = (w - 16 * (cols - 1)) / cols;
  LESSONS.forEach((l, i) => { const c = wide ? Math.floor(i / rows) : 0, r = wide ? i % rows : i; B.push({ id: 'lesson:' + i, x: x0 + c * (cw + 16), y: Math.round(top + r * pitch), w: cw, h, label: `${i + 1}.  ${l.title}`, left: true, done: !!s.stats.lessons[i], locked: s.demo && i >= 3 }); });
  B.push({ id: 'back', x: x0, y: backY, w, h: backH, label: 'Back' });
  return { buttons: B, introY: P.y + (wide ? 100 : 114) };
}
export function settingsGeo(s) {
  const P = L.panel, wide = L.panelWide, x0 = P.x + 24, w = P.w - 48, B = [], p = s.prefs;
  const backH = wide ? 64 : 70, backY = P.y + P.h - (wide ? 24 + backH : 108), top = P.y + (wide ? 112 : 132);
  const items = [['sound', 'Sound', p.sound], ['calm', 'Reduced motion', p.calm], ['big', 'Large text', p.big], ['auto', 'Auto-move a single choice', p.auto]];
  const cols = wide ? 2 : 1, rows = Math.ceil(items.length / cols), room = backY - 12 - top - (wide ? 70 : 150), pitch = Math.min(118, room / rows), h = Math.round(pitch * 0.78), cw = (w - 16 * (cols - 1)) / cols;
  items.forEach(([id, label, on], i) => { const c = wide ? Math.floor(i / rows) : 0, r = wide ? i % rows : i; B.push({ id: 'set:' + id, x: x0 + c * (cw + 16), y: Math.round(top + r * pitch), w: cw, h, label, value: on ? 'On' : 'Off', sel: on, toggle: true }); });
  B.push({ id: 'back', x: x0, y: backY, w, h: backH, label: 'Back' });
  return { buttons: B, textY: Math.round(top + rows * pitch + 30) };
}

// ---- the reference pages (How to play / About / Rules) ------------------------------------------------------------------
export function readerGeo(s) {
  const P = L.panel, wide = L.panelWide, sc = s.scene, ti = s.prefs.textScaleIdx ?? 0, x0 = P.x + 24, w = P.w - 48;
  // On the last page, "Next page" becomes "Done" and exits (see game.js) instead of silently wrapping back to page one.
  const isLast = !(s.scrollMax > 1) || s.scroll >= s.scrollMax - 1;   // one scrolling document: Next pages down, Done at the end
  const B = [], titleY = P.y + (wide ? 62 : 78), titleSize = wide ? 54 : 66;
  let region, counterY, counterX = P.x + P.w / 2;
  if (!wide) {
    const nav = P.y + P.h - 108, step = P.y + P.h - 162;
    B.push({ id: 'textDec', x: x0, y: step, w: 110, h: 46, label: 'A−', size: 24, dim: ti <= 0 }, { id: 'textInc', x: x0 + w - 110, y: step, w: 110, h: 46, label: 'A+', size: 24, dim: ti >= TEXT_SCALES.length - 1 },
      { id: 'back', ...rowAt(2, 0, x0, w), y: nav, h: 70, label: 'Back' }, { id: 'page', ...rowAt(2, 1, x0, w), y: nav, h: 70, label: isLast ? 'Done' : 'Next page', primary: true });
    region = R(P.x + 40, P.y + 104, P.w - 80, step - 8 - (P.y + 104)); counterY = P.y + P.h - 128;
  } else {
    const nav = P.y + P.h - 24 - 64, bw = 160;
    B.push({ id: 'back', x: x0, y: nav, w: bw, h: 64, label: 'Back' }, { id: 'page', x: x0 + w - bw, y: nav, w: bw, h: 64, label: isLast ? 'Done' : 'Next page', primary: true },
      { id: 'textDec', x: P.x + P.w / 2 - 200, y: nav + 9, w: 90, h: 46, label: 'A−', size: 24, dim: ti <= 0 }, { id: 'textInc', x: P.x + P.w / 2 + 110, y: nav + 9, w: 90, h: 46, label: 'A+', size: 24, dim: ti >= TEXT_SCALES.length - 1 });
    region = R(P.x + 40, P.y + 88, P.w - 80, nav - 10 - (P.y + 88)); counterY = nav + 40;
  }
  return { buttons: B, titleY, titleSize, region, counterY, counterX };
}

// ---- overlays and end screens (all centred on the live screen; compressed when the screen is short) ----------------------------
export function overlayGeo(s) {
  const o = {}, cx = L.cx, cy = L.cy, wide = L.mode === 'wide';
  // pause menu
  o.pause = R(cx - 280, cy - 235, 560, 470);
  // pass the phone
  { const c = fit(640); o.pass = { c, P: R(cx - 300, cy - 320 * c, 600, 640 * c) }; }
  // game over
  if (wide) o.over = { wide: true, P: R(cx - 440, cy - 250, 880, 500) };
  else { const c = fit(920); o.over = { wide: false, c, P: R(cx - 300, cy - 460 * c, 600, 920 * c) }; }
  // daily race complete
  if (wide) o.daily = { wide: true, P: R(cx - 440, cy - 250, 880, 500) };
  else { const c = fit(790); o.daily = { wide: false, c, P: R(cx - Math.min(324, L.w / 2 - 12), cy - 395 * c, Math.min(648, L.w - 24), 790 * c) }; }
  // lesson complete: a plate over the foot of the play screen
  { const bw = Math.min(648, L.col ? L.col.w : L.w - 24); const x = L.col ? L.col.x : (L.w - bw) / 2, bottom = L.bar.y + L.bar.h; o.lesson = R(x, bottom - 232, bw, 232); }
  return o;
}

// ---- every screen's buttons ---------------------------------------------------------------------------------------------------
export function screenButtons(s) {
  const sc = s.scene, ph = s.phase;
  if (sc === 'title') return titleGeo(s).buttons;
  if (sc === 'setup') return setupGeo(s).buttons;
  if (sc === 'learn') return learnGeo(s).buttons;
  if (sc === 'settings') return settingsGeo(s).buttons;
  if (sc === 'how' || sc === 'about' || sc === 'rules') return readerGeo(s).buttons;
  const O = overlayGeo(s), B = [];
  if (sc === 'play' || sc === 'lesson' || sc === 'daily' || sc === 'autoplay') {
    const Lz = s.lesson;
    if (s.menuOpen) {
      const P = O.pause, x = P.x + 30, w = P.w - 60;
      B.push({ id: 'resume', x, y: P.y + 90, w, h: 84, label: 'Resume', primary: true }, { id: 'sound', x, y: P.y + 190, w, h: 72, label: s.prefs.sound ? 'Sound: on' : 'Sound: off' },
        { id: 'howmenu', x, y: P.y + 278, w, h: 72, label: 'How to play' }, { id: 'leave', x, y: P.y + 366, w, h: 72, label: sc === 'play' ? 'Leave game' : 'Leave' });
    } else if (sc === 'lesson' && Lz && Lz.complete) {
      const P = O.lesson, x = P.x + 24, w = P.w - 48, hw = (w - 14) / 2;
      B.push({ id: 'nextlesson', x, y: P.y + 64, w, h: 64, label: Lz.i + 1 < LESSONS.length ? 'Next lesson' : 'Back to lessons', primary: true }, { id: 'lessons', x, y: P.y + 142, w: hw, h: 62, label: 'Lessons' }, { id: 'again', x: x + hw + 14, y: P.y + 142, w: hw, h: 62, label: 'Replay' });
    } else if (sc === 'daily' && s.dl && s.dl.finished) {
      const D = O.daily, P = D.P;
      if (D.wide) { const x = P.x + 40, w = P.w - 80, hw = (w - 16) / 2; B.push({ id: 'again', x, y: P.y + P.h - 104, w: hw, h: 76, label: 'Try again', primary: true }, { id: 'leave', x: x + hw + 16, y: P.y + P.h - 104, w: hw, h: 76, label: 'Menu' }); }
      else { const c = D.c, x = P.x + 24, w = P.w - 48; B.push({ id: 'again', x, y: P.y + 596 * c, w, h: 84 * c, label: 'Try again for a better score', primary: true }, { id: 'leave', x, y: P.y + 692 * c, w, h: 70 * c, label: 'Menu' }); }
    } else if (sc === 'autoplay') {
      const ti = s.prefs.apThinkIdx ?? 1, r = barRects(4);
      B.push({ id: 'menu', ...r[0], label: 'Menu' }, { id: 'apPause', ...r[1], label: s.apPaused ? 'Resume' : 'Pause', sel: !!s.apPaused },
        { id: 'apDec', ...r[2], label: 'Think −', dim: ti <= 0 }, { id: 'apInc', ...r[3], label: 'Think +', dim: ti >= AP_THINK_STEPS.length - 1 });
    } else {
      const r = barRects(3);
      B.push({ id: 'menu', ...r[0], label: 'Menu' });
      if (sc === 'play') B.push({ id: 'hint', ...r[1], label: `Hint (${s.hintsLeft})`, dim: !(ph === 'choose' && s.hintsLeft > 0 && s.g.players[s.g.turn].human) });
      else B.push({ id: 'hint', ...r[1], label: 'Hint', dim: ph !== 'choose' });
      B.push({ id: 'sound', ...r[2], label: s.prefs.sound ? 'Sound on' : 'Sound off' });
    }
  } else if (sc === 'over' || sc === 'autoplay-over') {
    const Ov = O.over, P = Ov.P, again = sc === 'autoplay-over' ? 'Watch again' : 'Play again';
    if (Ov.wide) { const x = P.x + 40, w = P.w - 80, hw = (w - 16) / 2; B.push({ id: 'again', x, y: P.y + P.h - 150, w: hw, h: 84, label: again, primary: true, size: 36 }, { id: 'title', x: x + hw + 16, y: P.y + P.h - 150, w: hw, h: 84, label: 'Menu' }); }
    else { const c = Ov.c, x = P.x + 30, w = P.w - 60; B.push({ id: 'again', x, y: P.y + 670 * c, w, h: 88 * c, label: again, primary: true, size: 38 }, { id: 'title', x, y: P.y + 774 * c, w, h: 72 * c, label: 'Menu' }); }
  } else if (sc === 'pass') {
    const { c, P } = O.pass; B.push({ id: 'ready', x: P.x + 40, y: P.y + 480 * c, w: P.w - 80, h: 100 * c, label: 'I am ready', primary: true, size: 40 });
  } else if (sc === 'demo-limit') {
    const P = L.panel; B.push({ id: 'title', x: P.x + 64, y: Math.min(P.y + 882, P.y + P.h - 120), w: P.w - 128, h: 80, label: 'Back to menu', primary: true });
  }
  return B;
}

// Split into short, single-concept pages so every page still fits comfortably at the top text-size
// step (see view.js TEXT_SCALES) - a page that fit fine at the old, smaller font can overflow once
// the font grows, so each page here covers only one idea.
export const HOW_PAGES = [
  ['Throwing', [
    'THROW: TAP the cowries, or SWIPE up across them. Keyboard: Space or Enter.',
  ]],
  ['Throwing', [
    'READ THE SHELLS: count the mouths facing up. 1 up = 10, 2 = 2, 3 = 3, 4 = 4, 5 = 25, 6 = 6, none up = 12.',
  ]],
  ['Grace throws', [
    'GRACE THROWS (10, 25, 6, 12): you throw again after moving,',
  ]],
  ['Grace throws', [
    'and only a grace throw lets a waiting pawn enter.',
  ]],
  ['Moving a pawn', [
    'MOVE: the pawns that can move glow. TAP one to see where it lands, then TAP it again to confirm.',
  ]],
  ['Moving a pawn', [
    'Keyboard: arrows to choose, Space to confirm. If only one move is possible it plays itself after a moment',
  ]],
  ['Moving a pawn', [
    '(turn this off in Settings).',
  ]],
  ['When a move is refused', [
    'REFUSED? TAP any pawn: if it cannot move it shakes, and the message says exactly why.',
  ]],
  ['Playing with friends', [
    'ONE PHONE, MANY FRIENDS: choose Friends in Set up.',
  ]],
  ['Playing with friends', [
    'A Pass the phone screen appears between turns.',
  ]],
  ['The race', [
    'Race your pawns anticlockwise once around the cross (68 squares),',
  ]],
  ['The race', [
    'then up the middle lane of your own arm to the centre. The centre needs an exact count.',
  ]],
  ['The race', [
    'Land exactly on a rival pawn to send it back to its yard, and throw again.',
  ]],
  ['Safe squares and blocks', [
    'Squares marked with an X are safe: nobody can be captured there,',
  ]],
  ['Safe squares and blocks', [
    'and pawns of different colours can share them.',
  ]],
  ['Safe squares and blocks', [
    'Two of your pawns on one square make a block: rivals can neither land on it nor jump over it.',
  ]],
  ['Safe squares and blocks', [
    'Only two pawns may share a square.',
  ]],
  ['Winning', [
    'Reaching the centre gives another throw. The first player to bring all pawns home wins.',
  ]],
  ['Ludo mode', [
    'Ludo mode: one die, a smaller board, a 6 to enter and to throw again, no blocks,',
  ]],
  ['Ludo mode', [
    'and a landing captures every rival pawn on the square.',
  ]],
];
export const ABOUT_PAGES = [
  ['About Pachisi', [
    'Pachisi is a very old race game from India. Players race pawns around a cross-shaped board,',
  ]],
  ['About Pachisi', [
    'usually embroidered on cloth,',
  ]],
  ['About Pachisi', [
    'and the moves are decided by throwing cowrie shells rather than dice.',
  ]],
  ['The name', [
    'The name comes from the Hindi word for twenty-five, the highest throw of the shells.',
  ]],
  ['Players and pawns', [
    'Two, three or four players take part. Each has four pawns and an arm of the cross to call their own,',
  ]],
  ['Players and pawns', [
    'and each pawn must travel all the way around before climbing the middle lane to the centre.',
  ]],
  ['A game of courts and courtyards', [
    'Pachisi has been played in homes and in courts. A famous version uses a very large board laid out on a',
  ]],
  ['A game of courts and courtyards', [
    'courtyard, with people standing in for the pawns.',
  ]],
  ['A game with many children', [
    'Pachisi is the ancestor of many family games. Ludo, patented in England in the 1890s, keeps the cross,',
  ]],
  ['A game with many children', [
    'the four colours and the race home, and swaps the shells for a die.',
  ]],
  ['A game with many children', [
    'Similar cross and circuit games are played around the world today.',
  ]],
  ['This version', [
    'In this version: six shells with the widely known values, grace throws, safe squares, blocks and the home lane.',
  ]],
  ['This version', [
    'Cowrie values and small rules differ from place to place, so families often have their own.',
  ]],
];

// Exhaustive rules reference (the "Rules" button). Every claim here is cross-checked against the
// actual implementation in rules.js, the single source of truth for legality (see its own header
// comment) - this page can never knowingly contradict the engine. Third element, when present, is
// which piece of real in-game art view.js's drawRulesArt() should render beside the text.
// Split into short, single-concept pages so every page still fits comfortably at the top text-size
// step (see view.js TEXT_SCALES) - at the 300% top step a page holds well under ten words of body
// text, so most sections below are now several consecutive pages sharing one heading rather than
// one page each; page numbering ("Page X of Y") is the reader's cue that more is coming.
export const RULES_PAGES = [
  ['The cross-shaped board', [
    'Pachisi is played on a cross: four arms of squares meeting at one shared centre square.',
  ]],
  ['The cross-shaped board', [
    'Each arm is three squares wide and eight squares long, plus the tip square where it meets the centre.',
  ]],
  ['The outer track', [
    'Going once around the outside of the cross is the outer track: 68 squares in all (17 per arm),',
  ]],
  ['The outer track', [
    'travelled anticlockwise.',
  ]],
  ['Seats and players', [
    'Two players use the two arms opposite each other; three players use the near, right and far arms;',
  ]],
  ['Seats and players', [
    'four players use all four arms - one seat per arm, Red, Green, Gold and Indigo in this build.',
  ]],
  ['Yards', [
    'Every seat starts with its pawns waiting in its own coloured yard,',
  ]],
  ['Yards', [
    'and gets either four pawns or two (the "Short game" option chosen at set-up).',
  ]],
  ['Turn order', [
    'The seat on the near arm always throws first,',
  ]],
  ['Turn order', [
    'and turns pass from arm to arm in the same anticlockwise order the pawns travel.',
  ]],
  ['The pawn', [
    'Pachisi has only one kind of piece,',
  ], 'pawns'],
  ['The pawn', [
    'coloured and even shaped differently for each seat so colour is never',
  ]],
  ['The pawn', [
    'the only cue: Red (a ball), Green (a cone),',
  ]],
  ['The pawn', [
    'Gold (a crown) and Indigo (a cube).',
  ]],
  ['Leaving the yard', [
    'A pawn starts waiting in its own yard. It can only leave the yard by entering onto its own start square,',
  ]],
  ['Leaving the yard', [
    'and only on a grace throw (see Cowries and grace throws).',
  ]],
  ['Moving forward', [
    'Once on the board, a pawn moves forward the exact number of squares shown by the throw,',
  ]],
  ['Moving forward', [
    'always anticlockwise around the outer track.',
  ]],
  ['Turning for home', [
    'After completing the full circuit,',
  ]],
  ['Turning for home', [
    'a pawn turns up the seven-square home lane belonging to its own',
  ]],
  ['Turning for home', [
    'arm and makes for the centre (see Reaching the centre).',
  ]],
  ['Safe squares', [
    'Twelve squares on the outer track are marked with a star: three on every arm,',
  ], 'safe'],
  ['Safe squares', [
    'one of which is that arm\'s own start square.',
  ]],
  ['Immune to capture', [
    'No pawn can ever be captured while standing on a marked square, and pawns of any colour,',
  ]],
  ['Immune to capture', [
    'in any number, are free to share one.',
  ]],
  ['Exempt from blocking', [
    'A marked square is also exempt from blocking: it never forms a block,',
  ]],
  ['Exempt from blocking', [
    'and a rival pawn may always land there or pass over it.',
  ]],
  ['Blocks', [
    'Two of your own pawns standing together on the same UNMARKED',
  ], 'block'],
  ['Blocks', [
    'square form a block. A block is always one colour -',
  ]],
  ['Blocks', [
    'two different colours can never occupy the same unmarked square at once.',
  ]],
  ['When a block stops a move', [
    'A rival pawn can neither land on a block nor hop over it while moving;',
  ]],
  ['When a block stops a move', [
    'the move that would have done so is refused instead.',
  ]],
  ['At most two pawns', [
    'At most two of your pawns may ever share an unmarked square - a third pawn cannot land there either.',
  ]],
  ['Where blocking never applies', [
    'None of this applies on a marked square or inside a home',
  ]],
  ['Where blocking never applies', [
    'lane: any number of your own pawns may share those freely,',
  ]],
  ['Where blocking never applies', [
    'and a home lane can never hold a rival\'s pawns at all.',
  ]],
  ['The cowrie throw', [
    'Six cowrie shells are thrown together.',
  ], 'cowries'],
  ['The cowrie throw', [
    'Each lands mouth up or mouth down,',
  ]],
  ['The cowrie throw', [
    'and the value of the throw comes from how many mouths land up: 0 up = 12,',
  ]],
  ['The cowrie throw', [
    '1 up = 10, 2 up = 2, 3 up = 3, 4 up = 4, 5 up = 25, 6 up = 6.',
  ]],
  ['Grace throws', [
    'A grace throw (10, 25, 6 or 12) lets you throw again after you move,',
  ]],
  ['Grace throws', [
    'and it is the ONLY kind of throw that lets a waiting pawn enter the board.',
  ]],
  ['Grace throws', [
    'On a grace throw you may enter a new pawn, or move a pawn already out - the choice is yours.',
  ]],
  ['One throw at a time', [
    'Every throw is played in full the moment it is cast - the game never lets throws queue up unused.',
  ]],
  ['Ludo mode', [
    'Ludo mode runs on the same engine, on a smaller,',
  ], 'ludo'],
  ['Ludo mode', [
    'friendlier board: one six-sided die instead of six shells,',
  ]],
  ['Ludo mode', [
    'a shorter arm (six squares instead of eight) and two marked squares',
  ]],
  ['Ludo mode', [
    'per arm instead of three.',
  ]],
  ['Ludo mode: throws', [
    'Only a throw of 6 is special in Ludo mode: it is the only throw that lets a waiting pawn enter,',
  ]],
  ['Ludo mode: throws', [
    'and the only one that earns another throw. No other value does either.',
  ]],
  ['Ludo mode: no blocks', [
    'Ludo mode has no blocks at all - any number of pawns, of any colour, may share any square.',
  ]],
  ['Ludo mode: captures', [
    'Landing on a square that holds rival pawns sends every rival pawn there home at once, not just one -',
  ]],
  ['Ludo mode: captures', [
    'but unlike Pachisi, a capture in Ludo mode earns no extra throw,',
  ]],
  ['Ludo mode: captures', [
    'and neither does reaching the centre.',
  ]],
  ['Capturing', [
    'In Pachisi mode,',
  ], 'capture'],
  ['Capturing', [
    'landing exactly on a single rival pawn standing on an unmarked square',
  ]],
  ['Capturing', [
    'sends it straight back to its own yard, and you throw again.',
  ]],
  ['Safe from capture', [
    'Capture is impossible on a marked square, in either mode -',
  ]],
  ['Safe from capture', [
    'rival pawns simply share it in peace there (see Safe squares).',
  ]],
  ['Blocks can\'t be captured', [
    'Capture is also impossible against a block: you cannot land on two',
  ]],
  ['Blocks can\'t be captured', [
    'rival pawns standing together at all (see Blocks) - that move is refused rather than played.',
  ]],
  ['Reaching the centre', [
    'The centre square is the finish line,',
  ]],
  ['Reaching the centre', [
    'reached only after the full 68-square outer circuit and the seven squares of your own home lane.',
  ]],
  ['An exact throw', [
    'You must land on the centre with an EXACT throw: a throw',
  ]],
  ['An exact throw', [
    'that would carry a pawn past it is refused for that pawn, though another pawn,',
  ]],
  ['An exact throw', [
    'or another throw, may still be playable.',
  ]],
  ['The one-square-short rule', [
    'One house rule fills the gap this leaves: because no cowrie throw',
  ]],
  ['The one-square-short rule', [
    'is ever worth exactly 1 (the lowest throw is 2),',
  ]],
  ['The one-square-short rule', [
    'a pawn sitting exactly one square short of the centre finishes on ANY throw at all.',
  ]],
  ['Pachisi mode only', [
    'This applies to Pachisi mode only - Ludo mode\'s die can roll a 1, so it needs no such rule.',
  ]],
  ['An extra throw', [
    'Reaching the centre earns another throw, just like a grace throw or a capture (Pachisi mode only -',
  ]],
  ['An extra throw', [
    'see Ludo mode).',
  ]],
  ['Winning', [
    'The first seat to bring every one of its pawns to the centre wins immediately -',
  ]],
  ['Winning', [
    'four pawns home in the standard game, or two in the Short game.',
  ]],
  ['The game ends at once', [
    'The moment that happens the game ends at once, even if other seats still have pawns on the board -',
  ]],
  ['The game ends at once', [
    'there is no second race to finish.',
  ]],
  ['Ranking the rest', [
    'The remaining seats are simply ranked afterwards, by how many pawns they got home and then by how far',
  ]],
  ['Ranking the rest', [
    'the rest had travelled.',
  ]],
  ['No legal move', [
    'A throw is played the instant it is cast. If no pawn can legally use it,',
  ]],
  ['No legal move', [
    'the whole throw is lost and play passes on - there is no queue of unused throws,',
  ]],
  ['No legal move', [
    'and no draw in Pachisi: the game always continues until somebody wins.',
  ]],
  ['Why a move gets refused', [
    'The most common reasons a throw is refused, in the order the game checks them:',
  ]],
  ['Why a move gets refused', [
    '- A rival block sits on a square this move would have to land on or pass over.',
  ]],
  ['Why a move gets refused', [
    '- Your own two pawns already fill the only unmarked square this move would land on.',
  ]],
  ['More reasons', [
    '- The move would overshoot the centre, and this pawn is not one square short of the centre.',
  ]],
  ['More reasons', [
    '- You threw a value that is not a grace throw, and the only pawn that could move is still waiting in its yard.',
  ]],
  ['When reasons conflict', [
    'When more than one reason applies to different pawns at once,',
  ]],
  ['When reasons conflict', [
    'the message on screen names the single most useful one.',
  ]],
];
