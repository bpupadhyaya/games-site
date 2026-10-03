// All player-facing text (English). Counts quoted in Rules come from the engine's own tables.
import { TOTAL, LESSON_COUNT } from './puzzles.js';

export const STR = {
  title: 'Kolam', tagline: 'One line. Every dot.',
  playBtn: 'Play', continueBtn: 'Continue', dailyBtn: 'Daily Pattern', sandboxBtn: 'Sandbox', learnBtn: 'Learn', autoBtn: 'Watch & Learn',
  howtoBtn: 'How to Play', rulesBtn: 'Rules', aboutBtn: 'About', settingsBtn: 'Settings',
  back: 'Back', next: 'Next', prev: 'Previous',
  undo: 'Undo', clear: 'Clear', think: 'Think', guide: 'Guide',
  pauseTitle: 'Paused', resume: 'Resume', restart: 'Start Over', quitMenu: 'Main Menu', list: 'Patterns', textSize: 'Text size',
  soundOn: 'Sound: On', soundOff: 'Sound: Off', guideOn: 'Guide: On', guideOff: 'Guide: Off', thinkTime: 'Watch & Learn think time', seconds: 's', look: 'Look',
  restore: 'Restore Purchases', unlock: 'Unlock Full Game', owned: 'Full game unlocked. Thank you!', resetProgress: 'Erase Progress and Stars', resetConfirm: 'Tap again to erase everything',
  chapters: 'Chapters', locked: 'In the full game', inProgress: 'In progress',
  endHead: 'Pattern complete!', endAgain: 'Draw Again', endNext: 'Next Pattern', endMenu: 'Main Menu',
  star1: 'Closed the loop', star2: 'No Think used', star3: 'No wrong turns',
  dailyHead: 'Daily Pattern', dailyBody: 'One pattern a day, the same for everyone on the same date.', dailySolved: 'Drawn today', dailyPlay: "Draw today's pattern",
  hintApply: 'Draw it', why: 'Why?',
  autoThink: 'Thinking', autoPause: 'Pause', autoPlay: 'Resume', autoExit: 'Exit', autoSlower: 'Think -', autoFaster: 'Think +',
  autoSession: 'Watch & Learn', autoAgain: 'Watch Again',
  autoSummary: 'You watched three patterns drawn from start to finish. Every turn came with its reason, and each one was checked by the solver.',
  lessonsTitle: 'Learn', lessonDone: 'Done', lessonStart: 'Practice', lessonNext: 'Next Lesson', lessonList: 'All Lessons', lessonPass: 'Lesson complete!',
  lessonTask: 'Practice: draw one closed line around every dot.',
  tipDraw: 'Touch near a dot and drag around it. Keep going without lifting until the line closes.',
  tipTip: 'Drag from the glowing tip, or tap a faint choice.',
  demoLimitTitle: 'Preview finished', demoLimitBody: 'You have drawn the free patterns in this web preview. Get the full game on iPhone and Android for every pattern, the Sandbox and daily patterns.',
  sbDraw: 'Draw', sbErase: 'Erase', sbMirror: 'Mirror', sbGrid: 'Grid', sbWeave: 'Weave', sbClear: 'Clear', sbUndo: 'Undo',
  sbHint: 'Drag across the arcs to draw. Mirrors repeat your strokes.',
};

export const TERMS = { dot: 'dot (pulli)', hug: 'Wrap', cross: 'Cross', cup: 'Dip' };

export const HOWTO = [
  { title: 'The goal', art: 'goal', body: 'Draw ONE line that goes around every dot and closes back on itself. Lift your finger and the line waits for you; touch its glowing tip to carry on.' },
  { title: 'Draw with one finger', art: 'drag', body: 'Touch near any dot and drag around it. The line follows your finger and bends smoothly around the dots. You can start on any arc. Drag back along the line to rub it out.' },
  { title: 'Three ways through a gap', art: 'gap3', body: 'Between two neighbouring dots the line has a choice. WRAP: bend round the dot you are at. CROSS: pass between the dots and cross the other line. DIP: dip into the gap and turn back. Each choice changes the shape of the pattern.' },
  { title: 'Marks', art: 'marks', body: 'A small round mark on a gap shows how the line must pass there: two curved lines means Wrap, an X means Cross, a U over an upside-down U means Dip. Marks are fixed; the rest is up to you.' },
  { title: 'Do not close too soon', art: 'early', body: 'If the line joins up before every dot is wrapped, it has closed too soon. Switch Guide on and it warns you before a turn that would trap part of the pattern. Think shows the next move with its reason, and Undo goes back to your last real choice.' },
  { title: 'Stars and more', art: 'stars', body: `One star for closing the loop, two if you never used Think, three if you also made no wrong turns. ${TOTAL} patterns, a daily pattern, Learn, Watch & Learn and a free-draw Sandbox with mirrors.` },
];

const R = (title, art, ...body) => ({ title, art, body });
export const RULES = [
  R('The board', 'board', 'A pattern is made of dots (called pulli in Tamil) laid out on a grid. Square grids have four neighbours per dot, diamond grids are the same grid turned a quarter-way round, and staggered grids have six neighbours per dot like a honeycomb. Some patterns are shaped: crosses, frames, stairs.', 'Around every dot there are small arcs that join the gaps next to it: four arcs on square and diamond grids, six on staggered grids. Every one of these arcs belongs to the line.'),
  R('The line', 'goal', 'You draw one continuous line. It must go along every arc of every dot exactly once, so every dot ends up wrapped, and it must come back and close on itself.', 'You may begin on any arc. The line never stops in the middle, never retraces itself and never leaves a loose end. When the last arc joins the first, the pattern is complete.'),
  R('Gaps', 'gap3', 'A gap is the place halfway between two neighbouring dots. Where a line reaches a gap that has not been decided yet, you choose one of three ways through. The first time the line passes a gap, your choice decides it for the whole pattern; the second line through that gap simply follows.', 'WRAP: the line bends round the dot it came from. CROSS: the line passes between the two dots, crossing the other line at an angle. DIP: the line dips into the gap and turns back up on its own side.', 'Gaps on the outside edge of a pattern have only one dot beside them, so the line always just wraps round the outside.'),
  R('Marks', 'marks', 'Some gaps carry a mark. A mark is already decided and cannot be changed: the line has to pass that gap the way the mark shows. Two curved lines is Wrap, an X is Cross, a U over an upside-down U is Dip.', 'Every pattern has at least one solution that keeps all its marks. Any single closed line through every arc that keeps the marks wins; it does not have to match the stored solution.'),
  R('Closing too soon', 'early', 'A line that closes before every arc is drawn is a mistake: it has closed too soon. So is a line that runs into itself with no way on.', 'Guide (off by default, always on in the Learn lessons; switch it on under Guide or in Settings) refuses a turn the exact solver proves can never become one complete loop, and says why: how many arcs would be cut off, or that the line would close after only a few arcs. A refused turn counts as a wrong turn for stars. With Guide off, a dead end is shown and the line goes back to your last real choice.'),
  R('Drawing', 'drag', 'Press near a dot and drag around it. The first arc is the one your stroke follows. At a gap the direction your finger leaves in decides the turn. A short pause at the gap is fine. If your finger is not precise enough, tap one of the faint choices at the tip instead: the game draws that arc for you.', 'Lift your finger and the line stays; touch near its glowing tip to continue. Drag back along the line to take arcs back. Undo goes back to your last real choice; Clear starts the pattern again (tap twice).'),
  R('Think', 'hint', 'Think finds a complete one-loop pattern that fits what you have drawn and shows the next stretch of line, highlighted, with the reason for the next choice. Using Think costs the second star.', '"Draw it" lets the game draw that stretch for you. Every reason is backed by the exact solver or by counting arcs.'),
  R('Stars', 'stars', 'One star for closing the loop. Two if you did not use Think. Three if you also made no wrong turns (refused or failed turns). Stars are saved per pattern.', `There are ${TOTAL} patterns in six chapters: First Dots, Square Grids, Diamonds, Staggered Grids, Shapes and Grand Patterns.`),
  R('Learn and Watch & Learn', 'learn', `Learn has ${LESSON_COUNT} short lessons, each a small pattern to draw. Watch & Learn plays three whole patterns by itself: it thinks, shows the choice and the reason, then draws. You can change the think time or pause at any moment.`),
  R('Daily Pattern', 'daily', 'One pattern a day, the same for everyone on the same date. Draw it to keep your streak going.'),
  R('Sandbox', 'sandbox', 'The Sandbox is free drawing with no goal. Drag across the arcs to draw or erase them. Mirror repeats every stroke in 2, 4 or 8 copies (6 or 12 on staggered grids). Grid changes the arrangement of dots. Weave draws a complete one-line pattern for you.'),
  R('Text size and sound', 'text', 'Every text screen has A- and A+ to scale text from 100% to 300%. Settings holds sound, Guide, think time and the look of the floor.'),
];
export const RULE_COUNT = RULES.length;
export const HOWTO_COUNT = HOWTO.length;

export const ABOUT = [
  { title: 'Kolam', body: ['A puzzle about drawing one unbroken line around every dot.'] },
  { title: 'The tradition', body: ['Kolam is a traditional South Indian art of drawing patterns from dots and looped lines. In the style this game follows, a grid of dots (pulli in Tamil) is laid out and one continuous line is drawn around them, by hand, with rice flour.', 'Its rules are simple: every dot is encircled, lines cross at points, and the line has no loose ends. Mathematicians and computer scientists have studied these patterns for their symmetry and structure.'] },
  { title: 'About this game', body: ['This game is a puzzle inspired by that tradition. It is not a lesson in the art itself, and it cannot replace learning it from the people who practise it. The tradition belongs to the people of South India who keep it alive and pass it on.'] },
  { title: 'Credits', body: ['Design, drawing and sound: Arcforge. All sound is generated in the game. Patterns are checked by an exact solver.'] },
];

export const LESSON_TEXT = [
  { title: 'One dot', intro: 'Every dot must be wrapped by the line. Here is a single dot with four small arcs around it. Touch near it and drag all the way around until the line closes.' },
  { title: 'Two dots', intro: 'Between two dots the line chooses a way through the gap. Wrap each dot separately and you get two loops, which is too many. Cross at the gap, or dip into it, and the line becomes one. Draw it.' },
  { title: 'Three in a row', intro: 'With more dots there are more gaps to decide, and a turn can close the line too soon. If Guide refuses a turn, read its reason and try another.' },
  { title: 'Marks', intro: 'The round marks on gaps are decided for you. Two curved lines means Wrap, an X means Cross, a U over a U means Dip. Draw one closed line that obeys every mark.' },
  { title: 'Edges', intro: 'On the outside edge there is only one dot beside each gap, so the line simply wraps round the outside. Work along the edge and decide the inside gaps as you go.' },
  { title: 'Diamond grid', intro: 'A diamond grid is the square grid turned on its corner. The rules are the same; the lines now run straight across. Use Think if you get stuck: it explains each turn.' },
  { title: 'Staggered grid', intro: 'On a staggered grid every dot has six gaps around it. The three ways through a gap are the same: Wrap, Cross, Dip.' },
  { title: 'Think and Undo', intro: 'A bigger pattern. Try it alone first. Think shows the next stretch with its reason, and Undo goes back to your last real choice.' },
];
