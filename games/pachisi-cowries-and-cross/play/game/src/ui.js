// Every button on every screen, as data. `screenButtons(state)` is used both to draw (view.js) and to hit-test (game.js),
// so what you see is exactly what you can tap.
import { LESSONS } from './lessons.js';
import { LEVELS, LEVEL_NAMES } from './ai.js';

export const PANEL = { x: 36, y: 118, w: 648, h: 1300 };
const row = (n, i, x0 = 60, w = 600, gap = 14) => { const cw = (w - gap * (n - 1)) / n; return { x: x0 + i * (cw + gap), w: cw }; };
const chips = (ids, y, h, cur, labels, extra = {}) => ids.map((id, i) => ({ id, y, h, ...row(ids.length, i), label: labels[i], sel: cur === id, chip: true, ...extra }));

export function screenButtons(s) {
  const B = [];
  const sc = s.scene;
  if (sc === 'title') {
    let y = 1030;
    if (s.saved) { B.push({ id: 'continue', x: 60, y, w: 600, h: 78, label: 'Continue game', primary: true }); y += 90; B.push({ id: 'new', x: 60, y, w: 600, h: 68, label: 'New game' }); y += 80; }
    else { B.push({ id: 'new', x: 60, y, w: 600, h: 84, label: 'Play', primary: true, size: 42 }); y += 98; }
    B.push({ id: 'learn', y, h: 70, ...row(2, 0), label: 'Learn to play' }, { id: 'daily', y, h: 70, ...row(2, 1), label: 'Daily race' }); y += 84;
    B.push({ id: 'about', y, h: 62, ...row(3, 0), label: 'About', size: 26 }, { id: 'how', y, h: 62, ...row(3, 1), label: 'How to play', size: 26 }, { id: 'settings', y, h: 62, ...row(3, 2), label: 'Settings', size: 26 });
    y += 76; B.push({ id: 'rules', x: 60, y, w: 600, h: 66, label: 'Rules', size: 28 });
  } else if (sc === 'setup') {
    const t = s.setup;
    B.push(...chips(['mode:pachisi', 'mode:ludo'], 292, 70, 'mode:' + t.mode, ['Pachisi', 'Ludo mode']));
    B.push(...chips(['pl:2', 'pl:3', 'pl:4'], 430, 70, 'pl:' + t.players, ['2 players', '3 players', '4 players']));
    B.push(...chips(['who:cpu', 'who:friends'], 568, 70, t.friends ? 'who:friends' : 'who:cpu', ['You vs computer', 'Friends, one phone']));
    if (!t.friends) {
      const ids = LEVELS.map((l) => 'opp:' + l).concat('opp:mixed');
      B.push(...chips(ids.slice(0, 3), 706, 64, 'opp:' + t.opp, ids.slice(0, 3).map((id) => LEVEL_NAMES[id.slice(4)])));
      B.push(...chips(ids.slice(3), 780, 64, 'opp:' + t.opp, ['Bold', 'Mixed']));
    }
    B.push(...chips(['pcs:4', 'pcs:2'], 926, 70, 'pcs:' + t.pieces, ['4 pawns each', '2 pawns (short)']));
    B.push({ id: 'start', x: 60, y: 1180, w: 600, h: 88, label: 'Start game', primary: true, size: 38 }, { id: 'back', x: 60, y: 1288, w: 600, h: 70, label: 'Back' });
  } else if (sc === 'learn') {
    LESSONS.forEach((l, i) => B.push({ id: 'lesson:' + i, x: 60, y: 226 + i * 96, w: 600, h: 82, label: `${i + 1}.  ${l.title}`, left: true, done: !!s.stats.lessons[i], locked: s.demo && i >= 3 }));
    B.push({ id: 'back', x: 60, y: 1310, w: 600, h: 70, label: 'Back' });
  } else if (sc === 'settings') {
    const p = s.prefs;
    [['sound', 'Sound', p.sound], ['calm', 'Reduced motion', p.calm], ['big', 'Large text', p.big], ['auto', 'Auto-move a single choice', p.auto]].forEach(([id, label, on], i) => B.push({ id: 'set:' + id, x: 60, y: 250 + i * 118, w: 600, h: 92, label, value: on ? 'On' : 'Off', sel: on, toggle: true }));
    B.push({ id: 'back', x: 60, y: 1310, w: 600, h: 70, label: 'Back' });
  } else if (sc === 'how' || sc === 'about' || sc === 'rules') {
    B.push({ id: 'back', ...row(2, 0), y: 1310, h: 70, label: 'Back' }, { id: 'page', ...row(2, 1), y: 1310, h: 70, label: 'Next page', primary: true });
  } else if (sc === 'play' || sc === 'lesson' || sc === 'daily') {
    const L = s.lesson, ph = s.phase;
    if (s.menuOpen) {
      B.push({ id: 'resume', x: 110, y: 560, w: 500, h: 84, label: 'Resume', primary: true }, { id: 'sound', x: 110, y: 660, w: 500, h: 72, label: s.prefs.sound ? 'Sound: on' : 'Sound: off' },
        { id: 'howmenu', x: 110, y: 748, w: 500, h: 72, label: 'How to play' }, { id: 'leave', x: 110, y: 836, w: 500, h: 72, label: sc === 'play' ? 'Leave game' : 'Leave' });
    } else if (sc === 'lesson' && L && L.complete) {
      B.push({ id: 'nextlesson', x: 60, y: 1156, w: 600, h: 84, label: L.i + 1 < LESSONS.length ? 'Next lesson' : 'Back to lessons', primary: true }, { id: 'lessons', x: 60, y: 1252, w: 290, h: 70, label: 'Lessons' }, { id: 'again', x: 370, y: 1252, w: 290, h: 70, label: 'Replay' });
    } else if (sc === 'daily' && s.dl && s.dl.finished) {
      B.push({ id: 'again', x: 60, y: 1156, w: 600, h: 84, label: 'Try again for a better score', primary: true }, { id: 'leave', x: 60, y: 1252, w: 600, h: 70, label: 'Menu' });
    } else {
      B.push({ id: 'menu', x: 38, y: 1392, w: 200, h: 78, label: 'Menu' });
      if (sc === 'play') B.push({ id: 'hint', x: 260, y: 1392, w: 200, h: 78, label: `Hint (${s.hintsLeft})`, dim: !(ph === 'choose' && s.hintsLeft > 0 && s.g.players[s.g.turn].human) });
      else B.push({ id: 'hint', x: 260, y: 1392, w: 200, h: 78, label: 'Hint', dim: ph !== 'choose' });
      B.push({ id: 'sound', x: 482, y: 1392, w: 200, h: 78, label: s.prefs.sound ? 'Sound on' : 'Sound off' });
    }
  } else if (sc === 'over') {
    B.push({ id: 'again', x: 90, y: 1000, w: 540, h: 88, label: 'Play again', primary: true, size: 38 }, { id: 'title', x: 90, y: 1104, w: 540, h: 72, label: 'Menu' });
  } else if (sc === 'pass') {
    B.push({ id: 'ready', x: 100, y: 900, w: 520, h: 100, label: 'I am ready', primary: true, size: 40 });
  } else if (sc === 'demo-limit') {
    B.push({ id: 'title', x: 100, y: 1000, w: 520, h: 80, label: 'Back to menu', primary: true });
  }
  return B;
}

export const HOW_PAGES = [
  ['Controls', [
    'THROW: TAP the cowries, or SWIPE up across them. Keyboard: Space or Enter.',
    'READ THE SHELLS: count the mouths facing up. 1 up = 10, 2 = 2, 3 = 3, 4 = 4, 5 = 25, 6 = 6, none up = 12.',
    'GRACE THROWS (10, 25, 6, 12): you throw again after moving, and only a grace throw lets a waiting pawn enter.',
    'MOVE: the pawns that can move glow. TAP one to see where it lands, then TAP it again to confirm. Keyboard: arrows to choose, Space to confirm.',
    'If only one move is possible it plays itself after a moment (turn this off in Settings).',
    'REFUSED? TAP any pawn: if it cannot move it shakes, and the message says exactly why.',
    'ONE PHONE, MANY FRIENDS: choose Friends in Set up. A Pass the phone screen appears between turns.',
  ]],
  ['The rules of the race', [
    'Race your pawns anticlockwise once around the cross (68 squares), then up the middle lane of your own arm to the centre. The centre needs an exact count.',
    'Land exactly on a rival pawn to send it back to its yard, and throw again.',
    'Squares marked with an X are safe: nobody can be captured there, and pawns of different colours can share them.',
    'Two of your pawns on one square make a block: rivals can neither land on it nor jump over it. Only two pawns may share a square.',
    'Reaching the centre gives another throw. The first player to bring all pawns home wins.',
    'Ludo mode: one die, a smaller board, a 6 to enter and to throw again, no blocks, and a landing captures every rival pawn on the square.',
  ]],
];
export const ABOUT_PAGES = [
  ['About Pachisi', [
    'Pachisi is a very old race game from India. Players race pawns around a cross-shaped board, usually embroidered on cloth, and the moves are decided by throwing cowrie shells rather than dice.',
    'The name comes from the Hindi word for twenty-five, the highest throw of the shells.',
    'Two, three or four players take part. Each has four pawns and an arm of the cross to call their own, and each pawn must travel all the way around before climbing the middle lane to the centre.',
    'Pachisi has been played in homes and in courts. A famous version uses a very large board laid out on a courtyard, with people standing in for the pawns.',
  ]],
  ['A game with many children', [
    'Pachisi is the ancestor of many family games. Ludo, patented in England in the 1890s, keeps the cross, the four colours and the race home, and swaps the shells for a die.',
    'Similar cross-and-circuit games are played around the world today.',
    'In this version: six shells with the widely known values, grace throws, safe squares, blocks and the home lane. Cowrie values and small rules differ from place to place, so families often have their own.',
  ]],
];

// Exhaustive rules reference (the "Rules" button). Every claim here is cross-checked against the
// actual implementation in rules.js, the single source of truth for legality (see its own header
// comment) - this page can never knowingly contradict the engine. Third element, when present, is
// which piece of real in-game art view.js's drawRulesArt() should render beside the text.
export const RULES_PAGES = [
  ['The cross-shaped board', [
    'Pachisi is played on a cross: four arms of squares meeting at one shared centre square. Each arm is three squares wide and eight squares long, plus the tip square where it meets the centre.',
    'Going once around the outside of the cross is the outer track: 68 squares in all (17 per arm), travelled anticlockwise.',
    'Two players use the two arms opposite each other; three players use the near, right and far arms; four players use all four arms - one seat per arm, Red, Green, Gold and Indigo in this build.',
    'Every seat starts with its pawns waiting in its own coloured yard, and gets either four pawns or two (the "Short game" option chosen at set-up).',
    'The seat on the near arm always throws first, and turns pass from arm to arm in the same anticlockwise order the pawns travel.',
  ]],
  ['The pawn', [
    'Pachisi has only one kind of piece, coloured and even shaped differently for each seat so colour is never the only cue: Red (a ball), Green (a cone), Gold (a crown) and Indigo (a cube).',
    'A pawn starts waiting in its own yard. It can only leave the yard by entering onto its own start square, and only on a grace throw (see Cowries and grace throws).',
    'Once on the board, a pawn moves forward the exact number of squares shown by the throw, always anticlockwise around the outer track.',
    'After completing the full circuit, a pawn turns up the seven-square home lane belonging to its own arm and makes for the centre (see Reaching the centre).',
  ], 'pawns'],
  ['Safe squares', [
    'Twelve squares on the outer track are marked with a star: three on every arm, one of which is that arm\'s own start square.',
    'No pawn can ever be captured while standing on a marked square, and pawns of any colour, in any number, are free to share one.',
    'A marked square is also exempt from blocking: it never forms a block, and a rival pawn may always land there or pass over it.',
  ], 'safe'],
  ['Blocks', [
    'Two of your own pawns standing together on the same UNMARKED square form a block. A block is always one colour - two different colours can never occupy the same unmarked square at once.',
    'A rival pawn can neither land on a block nor hop over it while moving; the move that would have done so is refused instead.',
    'At most two of your pawns may ever share an unmarked square - a third pawn cannot land there either.',
    'None of this applies on a marked square or inside a home lane: any number of your own pawns may share those freely, and a home lane can never hold a rival\'s pawns at all.',
  ], 'block'],
  ['The cowrie throw', [
    'Six cowrie shells are thrown together. Each lands mouth up or mouth down, and the value of the throw comes from how many mouths land up:',
    '0 up = 12,   1 up = 10,   2 up = 2,   3 up = 3,   4 up = 4,   5 up = 25,   6 up = 6.',
    'A grace throw (10, 25, 6 or 12) lets you throw again after you move, and it is the ONLY kind of throw that lets a waiting pawn enter the board. On a grace throw you may enter a new pawn, or move a pawn already out - the choice is yours.',
    'Every throw is played in full the moment it is cast - the game never lets throws queue up unused.',
  ], 'cowries'],
  ['Ludo mode', [
    'Ludo mode runs on the same engine, on a smaller, friendlier board: one six-sided die instead of six shells, a shorter arm (six squares instead of eight) and two marked squares per arm instead of three.',
    'Only a throw of 6 is special in Ludo mode: it is the only throw that lets a waiting pawn enter, and the only one that earns another throw. No other value does either.',
    'Ludo mode has no blocks at all - any number of pawns, of any colour, may share any square.',
    'Landing on a square that holds rival pawns sends every rival pawn there home at once, not just one - but unlike Pachisi, a capture in Ludo mode earns no extra throw, and neither does reaching the centre.',
  ], 'ludo'],
  ['Capturing', [
    'In Pachisi mode, landing exactly on a single rival pawn standing on an unmarked square sends it straight back to its own yard, and you throw again.',
    'Capture is impossible on a marked square, in either mode - rival pawns simply share it in peace there (see Safe squares).',
    'Capture is also impossible against a block: you cannot land on two rival pawns standing together at all (see Blocks) - that move is refused rather than played.',
  ], 'capture'],
  ['Reaching the centre', [
    'The centre square is the finish line, reached only after the full 68-square outer circuit and the seven squares of your own home lane.',
    'You must land on the centre with an EXACT throw: a throw that would carry a pawn past it is refused for that pawn, though another pawn, or another throw, may still be playable.',
    'One house rule fills the gap this leaves: because no cowrie throw is ever worth exactly 1 (the lowest throw is 2), a pawn sitting exactly one square short of the centre finishes on ANY throw at all. This applies to Pachisi mode only - Ludo mode\'s die can roll a 1, so it needs no such rule.',
    'Reaching the centre earns another throw, just like a grace throw or a capture (Pachisi mode only - see Ludo mode).',
  ]],
  ['Winning', [
    'The first seat to bring every one of its pawns to the centre wins immediately - four pawns home in the standard game, or two in the Short game.',
    'The moment that happens the game ends at once, even if other seats still have pawns on the board - there is no second race to finish.',
    'The remaining seats are simply ranked afterwards, by how many pawns they got home and then by how far the rest had travelled.',
  ]],
  ['No legal move', [
    'A throw is played the instant it is cast. If no pawn can legally use it, the whole throw is lost and play passes on - there is no queue of unused throws, and no draw in Pachisi: the game always continues until somebody wins.',
    'The most common reasons a throw is refused, in the order the game checks them:',
    '- A rival block sits on a square this move would have to land on or pass over.',
    '- Your own two pawns already fill the only unmarked square this move would land on.',
    '- The move would overshoot the centre, and this pawn is not the one-square-short exception.',
    '- You threw a value that is not a grace throw, and the only pawn that could move is still waiting in its yard.',
    'When more than one reason applies to different pawns at once, the message on screen names the single most useful one.',
  ]],
];
