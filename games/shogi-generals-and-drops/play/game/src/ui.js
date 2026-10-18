// Every button on every screen: one list per screen, used both to draw them (view.js) and to hit-test taps (game.js).
// All rects come from the live layout `L` (layout.js), so the same list serves every phone and tablet in both orientations.
import { LESSONS } from './lessons.js';
import { LEVELS } from './engine.js';
import { TEXT_SCALES, THINK_STEPS, layoutFor, W, H } from './layout.js';

const DEFAULT_L = () => layoutFor(W, H);

// The title screen's rows. Returns the buttons plus the y of the Language label and of the line under the last button, so
// view.js can place its decorative text without ever colliding with the list (which grows by one row with a saved game).
export function titleGeom(s, L = DEFAULT_L()) {
  const T = L.title(!!s.saved), out = [], p = T.pitch, bh = T.bh, x = T.x, fw = T.fullW, hw = (fw - 16) / 2;
  let y = T.listY;
  const full = (id, label, o = {}) => { out.push({ id, label, x, y, w: fw, h: bh, ...o }); y += p; };
  const half = (idL, lL, idR, lR, oL = {}, oR = {}) => { out.push({ id: idL, label: lL, x, y, w: hw, h: bh, ...oL }, { id: idR, label: lR, x: x + hw + 16, y, w: hw, h: bh, ...oR }); y += p; };
  if (s.saved) { full('continue', 'Continue game', { primary: true }); full('play', 'New game vs computer'); }
  else full('play', 'Play the computer', { primary: true });
  half('learn', 'Learn to play', 'puzzle', 'Puzzle of the day');
  half('mini', 'Mini shogi 5x5', 'two', 'Two players');
  { const tw = (fw - 32) / 3; out.push({ id: 'howto', label: 'How to play', x, y, w: tw, h: bh }, { id: 'about', label: 'About shogi', x: x + tw + 16, y, w: tw, h: bh }, { id: 'rules', label: 'Rules', x: x + (tw + 16) * 2, y, w: tw, h: bh }); y += p; }
  half('settings', 'Settings', 'sound', s.prefs.sound ? 'Sound: on' : 'Sound: off');
  const labelY = y + 22; y += 30;
  half('langJP', 'Play (日本語)', 'langEN', 'Play (English)', { toggle: s.prefs.lang !== 'en' }, { toggle: s.prefs.lang === 'en' });
  y += 6;
  // Free, silent, full-game teaching demo - its own row below everything else so it never crowds the normal play/setup buttons.
  full('autoplay', 'Auto Play  ·  Watch & Learn', { h: bh * 0.96 });
  return { buttons: out, labelY, afterY: y, T };
}

export function buttonsFor(s, L = DEFAULT_L()) {
  const out = [];
  const add = (id, label, r, o = {}) => out.push({ id, label, x: r.x, y: r.y, w: r.w, h: r.h, ...o });
  const half = (r, idL, lblL, idR, lblR, oL = {}, oR = {}) => { const w = (r.w - 16) / 2; add(idL, lblL, { x: r.x, y: r.y, w, h: r.h }, oL); add(idR, lblR, { x: r.x + w + 16, y: r.y, w, h: r.h }, oR); };

  if (s.promo) {
    const P = L.promo();
    add('promoYes', 'Promote', P.yes, { kind: 'promo', primary: true, d: P.d.yes });
    add('promoNo', 'Keep', P.no, { kind: 'promo', d: P.d.no });
    add('promoCancel', 'Cancel', P.cancel, { small: true, d: P.d.cancel });
    return out;
  }
  const board = () => L.board(s.n || 9, s.scene === 'lesson' || s.scene === 'puzzle');
  // the button strip of a board scene: a row under the message (portrait) or a stack under your stand (landscape)
  const bottom = (items) => {
    const B = board(), bar = B.bar, n = items.length;
    if (!B.barVertical) {
      const gap = 14, w = Math.min(n === 2 ? 300 : 210, (bar.w - gap * (n - 1)) / n), x0 = bar.x + (bar.w - (n * w + (n - 1) * gap)) / 2;
      items.forEach(([id, label, o], i) => add(id, label, { x: x0 + i * (w + gap), y: bar.y, w, h: bar.h }, o));
    } else {
      const gap = 10, bh = Math.max(50, Math.min(84, (bar.h - (n - 1) * gap) / n)), bw = Math.min(bar.w, 340);
      items.forEach(([id, label, o], i) => add(id, label, { x: bar.x + (bar.w - bw) / 2, y: bar.y + i * (bh + gap), w: bw, h: bh }, o));
    }
  };
  const menuStack = (items) => { const M = L.menuStack(items.length); items.forEach(([id, label, o], i) => add(id, label, M.buttons[i], o)); };

  switch (s.scene) {
    case 'title': out.push(...titleGeom(s, L).buttons); break;
    case 'setup': {
      const S = L.setup();
      LEVELS.forEach((lv, i) => add('level' + i, lv.name, S.levels[i], { toggle: s.level === i, stars: i + 1 }));
      half(S.sides, 'sideB', 'You go first', 'sideW', 'You go second', { toggle: s.humanPick === 0 }, { toggle: s.humanPick === 1 });
      add('start', 'Start game', S.start, { primary: true });
      add('back', 'Back', S.back);
      break;
    }
    case 'settings': {
      const S = L.settings();
      [['tSound', 'Sound', s.prefs.sound], ['tCalm', 'Reduced motion', s.prefs.calm], ['tBig', 'Large text', s.prefs.big], ['tLabels', 'Western letters on pieces', s.prefs.labels]]
        .forEach(([id, label, on], i) => add(id, label, S.toggles[i], { pill: on }));
      half(S.lang, 'langJP', 'Play (日本語)', 'langEN', 'Play (English)', { toggle: s.prefs.lang !== 'en' }, { toggle: s.prefs.lang === 'en' });
      add('back', 'Back', S.back);
      break;
    }
    case 'about': case 'howto': case 'rules': {
      const N = L.reader(TEXT_SCALES[s.textScaleIdx] ?? 1, false).nav;
      add('back', 'Back', N.prev);
      add('textDec', 'A−', N.dec, { dim: s.textScaleIdx <= 0 });
      add('textInc', 'A+', N.inc, { dim: s.textScaleIdx >= TEXT_SCALES.length - 1 });
      if (!s.readEnd) add('next', 'Next', N.next, { primary: true }); else add('back', 'Done', N.next, { primary: true });
      break;
    }
    case 'learn': {
      const S = L.learn(LESSONS.length);
      LESSONS.forEach((l, i) => add('lesson' + i, `${i + 1}. ${l.title.replace(/^The /, '')}`, S.tiles[i], { done: s.lessonsDone[i], tile: true }));
      add('back', 'Back', S.back);
      break;
    }
    case 'play': {
      if (s.menu) menuStack([['resume', 'Resume', { primary: true }], ['newgame', 'New game'], ['resign', 'Resign'], ['settings', 'Settings'], ['title', 'Main menu']]);
      else if (s.result) bottom([['again', 'Play again', { primary: true }], ['title', 'Main menu']]);
      else bottom([['undo', 'Take back', { dim: !s.canUndo }], ['hint', `Hint (${s.hintsLeft})`, { dim: s.two || s.hintsLeft <= 0 }], ['menu', 'Menu']]);
      break;
    }
    case 'lesson': {
      if (s.menu) menuStack([['resume', 'Resume', { primary: true }], ['learn', 'All lessons'], ['title', 'Main menu']]);
      else if (s.lesson.done) bottom([[s.lesson.i < LESSONS.length - 1 ? 'nextLesson' : 'learn', s.lesson.i < LESSONS.length - 1 ? 'Next lesson' : 'All lessons', { primary: true }], ['retryLesson', 'Again'], ['learn', 'Lessons']]);
      else bottom([['retryLesson', 'Restart'], ['showMe', 'Show me'], ['learn', 'Lessons']]);
      break;
    }
    case 'puzzle': {
      if (s.menu) menuStack([['resume', 'Resume', { primary: true }], ['title', 'Main menu']]);
      else if (s.pz.status === 'solved') bottom([['anotherPuzzle', 'Another puzzle', { primary: true }], ['title', 'Main menu']]);
      else bottom([['pzHint', 'Hint'], ['pzRestart', 'Restart'], ['menu', 'Menu']]);
      break;
    }
    case 'auto': {
      // Same `state.menu` pause gate every other scene uses (game.js's update() skips autoStep(dt) entirely while it is true,
      // freezing THINK/REVEAL and the in-flight engine search), labelled "Pause"/"Resume": the one control a Watch & Learn
      // viewer reaches for to get unlimited thinking time on demand. The think-time stepper sits right beside it.
      if (s.menu) menuStack([['resume', 'Resume', { primary: true }], ['title', 'Main menu']]);
      else if (s.result) bottom([['again', 'Play again', { primary: true }], ['title', 'Main menu']]);
      else bottom([['menu', 'Pause'], ['autoThinkDec', 'Think −', { dim: s.autoThinkIdx <= 0 }], ['autoThinkInc', 'Think +', { dim: s.autoThinkIdx >= THINK_STEPS.length - 1 }]]);
      break;
    }
    case 'demo-limit': add('title', 'Main menu', L.limit().back, { primary: true }); break;
    default: break;
  }
  return out;
}
