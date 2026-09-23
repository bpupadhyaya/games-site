// Every button on every screen: one list per screen, used both to draw them (view.js) and to hit-test taps (game.js).
import { LESSONS } from './lessons.js';
import { LEVELS } from './engine.js';
import { ABOUT, HOWTO, RULES } from './content.js';
import { TEXT_SCALES, THINK_STEPS } from './layout.js';

// Derived from content.js directly (not hardcoded) so splitting a page there - e.g. one that
// overflowed at the top text-size step - can never drift out of sync with the page count here.
export const ABOUT_PAGES = ABOUT.length, HOWTO_PAGES = HOWTO.length, RULES_PAGES = RULES.length;
const FULL = { x: 80, w: 560 }, HALF_L = { x: 80, w: 272 }, HALF_R = { x: 368, w: 272 };

// The title screen's button list has two shapes (with/without a "Continue game" row), so the pixel
// where it ends differs. Computed once here and reused both to place the Auto Play row right below
// it (this function) and, in view.js, to place the decorative stats/language text below THAT - so
// neither can ever land on top of the other regardless of which shape the list is in.
export function titleListBottom(s) {
  let y = 660 + (s.saved ? 228 : 114);
  y += 104 + 104 + 104 + 148; // learn/puzzle, mini/two, howto/about/rules, settings/sound row gaps
  return y + 92; // + the language row's own height
}
export const TITLE_AUTO_GAP = 24, TITLE_AUTO_H = 84;

export function buttonsFor(s) {
  const out = [];
  const add = (id, label, x, y, w, h, o = {}) => out.push({ id, label, x, y, w, h, ...o });
  const half = (idL, lblL, idR, lblR, y, oL = {}, oR = {}) => { add(idL, lblL, HALF_L.x, y, HALF_L.w, 92, oL); add(idR, lblR, HALF_R.x, y, HALF_R.w, 92, oR); };
  const bottom = (items, y = 1352) => { const w = items.length === 2 ? 300 : 200, gap = 20, x0 = (720 - (items.length * w + (items.length - 1) * gap)) / 2; items.forEach(([id, label, o], i) => add(id, label, x0 + i * (w + gap), y, w, 92, o)); };

  if (s.promo) {
    add('promoYes', 'Promote', 70, 640, 270, 320, { kind: 'promo', primary: true });
    add('promoNo', 'Keep', 380, 640, 270, 320, { kind: 'promo' });
    add('promoCancel', 'Cancel', 260, 990, 200, 76, { small: true });
    return out;
  }
  switch (s.scene) {
    case 'title': {
      let y = 660;
      if (s.saved) { add('continue', 'Continue game', FULL.x, y, FULL.w, 100, { primary: true }); y += 114; add('play', 'New game vs computer', FULL.x, y, FULL.w, 100); }
      else add('play', 'Play the computer', FULL.x, y, FULL.w, 100, { primary: true });
      y += 114;
      half('learn', 'Learn to play', 'puzzle', 'Puzzle of the day', y); y += 104;
      half('mini', 'Mini shogi 5x5', 'two', 'Two players', y); y += 104;
      // How to play / About / Rules share one row, three even columns (Rules is the addition; the other
      // two columns keep their same y and height, only narrower).
      { const tw = (FULL.w - 32) / 3; add('howto', 'How to play', FULL.x, y, tw, 92); add('about', 'About shogi', FULL.x + tw + 16, y, tw, 92); add('rules', 'Rules', FULL.x + (tw + 16) * 2, y, tw, 92); }
      y += 104;
      half('settings', 'Settings', 'sound', s.prefs.sound ? 'Sound: on' : 'Sound: off', y); y += 148;
      half('langJP', 'Play (日本語)', 'langEN', 'Play (English)', y, { toggle: s.prefs.lang !== 'en' }, { toggle: s.prefs.lang === 'en' });
      // Free, silent, full-game teaching demo - a clearly separate row below everything else so it
      // never crowds the normal play/setup buttons above it. titleListBottom() keeps this in sync
      // with wherever the list above actually ends (it shifts when "Continue game" is showing).
      add('autoplay', 'Auto Play  ·  Watch & Learn', FULL.x, titleListBottom(s) + TITLE_AUTO_GAP, FULL.w, TITLE_AUTO_H);
      break;
    }
    case 'setup': {
      LEVELS.forEach((lv, i) => add('level' + i, lv.name, FULL.x, 318 + i * 96, FULL.w, 86, { toggle: s.level === i, stars: i + 1 }));
      half('sideB', 'You go first', 'sideW', 'You go second', 972, { toggle: s.humanPick === 0 }, { toggle: s.humanPick === 1 });
      add('start', 'Start game', FULL.x, 1090, FULL.w, 100, { primary: true });
      add('back', 'Back', FULL.x, 1206, FULL.w, 84);
      break;
    }
    case 'settings': {
      const rowsS = [['tSound', 'Sound', s.prefs.sound], ['tCalm', 'Reduced motion', s.prefs.calm], ['tBig', 'Large text', s.prefs.big], ['tLabels', 'Western letters on pieces', s.prefs.labels]];
      rowsS.forEach(([id, label, on], i) => add(id, label, FULL.x, 330 + i * 108, FULL.w, 92, { pill: on }));
      half('langJP', 'Play (日本語)', 'langEN', 'Play (English)', 798, { toggle: s.prefs.lang !== 'en' }, { toggle: s.prefs.lang === 'en' });
      add('back', 'Back', FULL.x, 924, FULL.w, 92);
      break;
    }
    case 'about': case 'howto': case 'rules': {
      const pages = s.scene === 'about' ? ABOUT_PAGES : s.scene === 'howto' ? HOWTO_PAGES : RULES_PAGES;
      // An equal-width pill pair spanning nearly the full width, near the bottom - reads as one
      // connected navigation row rather than two small islands (matches the reference pattern in
      // big-card-solitaire-large-print's rulesBack/rulesNext).
      if (s.page > 0) add('prev', 'Previous', 30, 1330, 310, 92); else add('back', 'Back', 30, 1330, 310, 92);
      if (s.page < pages - 1) add('next', 'Next', 380, 1330, 310, 92, { primary: true }); else add('back', 'Done', 380, 1330, 310, 92, { primary: true });
      // Text-size stepper for these read-heavy reference pages, right in the top corners of the panel
      // where a player is already reading - not buried in Settings. Guarded lookup + clamp on load
      // both live in game.js; here we only need to disable at either end of the array.
      add('textDec', 'A−', 50, 78, 110, 66, { small: true, dim: s.textScaleIdx <= 0 });
      add('textInc', 'A+', 560, 78, 110, 66, { small: true, dim: s.textScaleIdx >= TEXT_SCALES.length - 1 });
      break;
    }
    case 'learn': {
      LESSONS.forEach((l, i) => add('lesson' + i, `${i + 1}. ${l.title.replace(/^The /, '')}`, i % 2 ? 368 : 80, 300 + Math.floor(i / 2) * 118, 272, 100, { done: s.lessonsDone[i], tile: true }));
      add('back', 'Back', FULL.x, 1040, FULL.w, 92);
      break;
    }
    case 'play': {
      if (s.menu) {
        add('resume', 'Resume', FULL.x, 420, FULL.w, 92, { primary: true });
        add('newgame', 'New game', FULL.x, 532, FULL.w, 92);
        add('resign', 'Resign', FULL.x, 644, FULL.w, 92);
        add('settings', 'Settings', FULL.x, 756, FULL.w, 92);
        add('title', 'Main menu', FULL.x, 868, FULL.w, 92);
      } else if (s.result) bottom([['again', 'Play again', { primary: true }], ['title', 'Main menu']]);
      else bottom([['undo', 'Take back', { dim: !s.canUndo }], ['hint', `Hint (${s.hintsLeft})`, { dim: s.two || s.hintsLeft <= 0 }], ['menu', 'Menu']]);
      break;
    }
    case 'lesson': {
      if (s.menu) { add('resume', 'Resume', FULL.x, 420, FULL.w, 92, { primary: true }); add('learn', 'All lessons', FULL.x, 532, FULL.w, 92); add('title', 'Main menu', FULL.x, 644, FULL.w, 92); }
      else if (s.lesson.done) bottom([[s.lesson.i < LESSONS.length - 1 ? 'nextLesson' : 'learn', s.lesson.i < LESSONS.length - 1 ? 'Next lesson' : 'All lessons', { primary: true }], ['retryLesson', 'Again'], ['learn', 'Lessons']]);
      else bottom([['retryLesson', 'Restart'], ['showMe', 'Show me'], ['learn', 'Lessons']]);
      break;
    }
    case 'puzzle': {
      if (s.menu) { add('resume', 'Resume', FULL.x, 420, FULL.w, 92, { primary: true }); add('title', 'Main menu', FULL.x, 532, FULL.w, 92); }
      else if (s.pz.status === 'solved') bottom([['anotherPuzzle', 'Another puzzle', { primary: true }], ['title', 'Main menu']]);
      else bottom([['pzHint', 'Hint'], ['pzRestart', 'Restart'], ['menu', 'Menu']]);
      break;
    }
    case 'auto': {
      // Same `state.menu` pause gate every other scene uses (game.js's update() skips autoStep(dt)
      // entirely while it's true, freezing THINK/REVEAL timers and the in-flight engine search
      // bit-for-bit - not just hiding the board), but labelled "Pause"/"Resume" here specifically:
      // this is the one control a Watch & Learn viewer reaches for to get unlimited thinking time on
      // demand, so it must read as a pause control, not a generic app menu.
      if (s.menu) { add('resume', 'Resume', FULL.x, 420, FULL.w, 92, { primary: true }); add('title', 'Main menu', FULL.x, 532, FULL.w, 92); }
      else if (s.result) bottom([['again', 'Play again', { primary: true }], ['title', 'Main menu']]);
      else {
        // Think-time stepper, corners of the header row (same idiom as textDec/textInc on the
        // reference pages) - out of the way of the centred "Auto Play" title between them.
        add('autoThinkDec', '−', 50, 60, 110, 66, { small: true, dim: s.autoThinkIdx <= 0 });
        add('autoThinkInc', '+', 560, 60, 110, 66, { small: true, dim: s.autoThinkIdx >= THINK_STEPS.length - 1 });
        add('menu', 'Pause', 260, 1352, 200, 92);
      }
      break;
    }
    case 'demo-limit': add('title', 'Main menu', FULL.x, 1100, FULL.w, 96, { primary: true }); break;
    default: break;
  }
  return out;
}
