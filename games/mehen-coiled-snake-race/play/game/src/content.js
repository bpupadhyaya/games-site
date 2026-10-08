// All player-facing text (English). Numbers come from the engine's own constants so the Rules pages cannot drift from it.
import { TRACK, HEAD, MARBLES, SAFE_CELLS, SAFE_STEP, EXTRA_AT, STICKS, VALUE_P, FLAT_WAYS, MAX_PLAYERS, MIN_PLAYERS, MAX_TURNS, LENGTHS, lengthOf } from './rules.js';
import { PALETTE } from './art.js';

const pct = (x) => `${Math.round(x * 1000) / 10}%`.replace('.0%', '%');
const list = (a) => a.join(', ');
const EXTRA_P = VALUE_P.slice(EXTRA_AT).reduce((s, v) => s + v, 0);

export const STR = {
  playBtn: 'Play', continueBtn: 'Continue game', autoBtn: 'Watch & Learn',
  howtoBtn: 'How to Play', rulesBtn: 'Rules', aboutBtn: 'About', settingsBtn: 'Settings',
  back: 'Back', think: 'Think', restart: 'Restart', resume: 'Resume', paused: 'Paused', quitMenu: 'Main Menu',
  soundOn: 'Sound: On', soundOff: 'Sound: Off', thinkTime: 'Watch & Learn think time', seconds: 's',
  restore: 'Restore Purchases', unlock: 'Unlock Full Game', resetProgress: 'Erase Records and Progress', resetConfirm: 'Tap again to erase everything',
  owned: 'Full game unlocked. Thank you!', theme: 'Stone and light',
  startGame: 'Start game', playersTitle: 'Players', seatsTitle: 'Seats', levelTitle: 'Computer level', lengthTitle: 'Length of the race',
  you: 'You', computer: 'Computer', human: 'Player', tapToToggle: 'Tap a seat to switch between a person and the computer.',
  twoPlayers: 'Two players', vsComputer: 'vs computer',
  throwBtn: 'Throw', moveBtn: 'Move', nudgeM: 'One less', nudgeP: 'One more', skipBtn: 'Skip', pauseBtn: 'Pause',
  thinkingDots: 'Thinking...',
  autoPause: 'Pause', autoPlay: 'Resume', autoExit: 'Exit', autoSlower: 'Think -', autoFaster: 'Think +',
  autoThink: 'Thinking {n}', autoSession: 'Watch & Learn', autoAgain: 'Watch Again',
  autoSummary: 'You watched a whole race, with every choice explained. Watch again for a different race, or head to Play to try the ideas yourself.',
  demoLimitTitle: 'FREE PREVIEW FINISHED',
  demoLimitBody: 'You played the three free games. Get the full game on iPhone and Android for every computer level, all three race lengths, up to six seats and the other stones.',
  demoLeft: '{n} free games left',
  title: 'Mehen', tagline: 'The coiled snake race', taglineSub: 'Throw. Roll. Reach the head.',
  record: 'Record', recordLine: '{label} ({level}): {w} W  {l} L',
  again: 'Play Again', newSetup: 'Change Game', textSize: 'Text size', locked: 'In the full game',
  // HUD
  lengthLine: '{n} seats · {len}', watchSub: 'Watch & Learn · Think {n}s', winnerWord: 'Winner', turnWord: 'Turn',
  lionsHome: '{a} of {b} home', lionsWait: '{n} waiting', marblesWord: 'marbles',
  yourThrow: 'Your turn. Throw the sticks.', seatThrow: '{seat}, throw the sticks.',
  seatThinks: '{seat} is thinking...', seatThrows: '{seat} throws...',
  threw: '{seat} threw {v}.', threwYou: 'You threw {v}.',
  pick: 'Tap a lion, or a lit stone, to move {v}.', pickNudged: 'Throw {v}, nudged to {w}. Tap a lion or a lit stone.',
  onlyNudge: 'No lion can move {v}. Spend a marble to nudge the throw, or skip.',
  noMove: 'No lion can move {v}. The turn passes.', noMoveExtra: 'No lion can move {v}, but you throw again.',
  extraThrow: 'A {v}: throw again!', gotMarble: '{seat} wins a marble',
  captured: '{seat} sends a {victim} lion back to the tail', capturedMarble: '{seat} sends a {victim} lion back to the tail and takes a marble',
  homeLion: '{seat} brings a lion home', turned: '{seat}\'s lion reaches the head and turns back',
  wins: '{seat} wins!', youWin: 'You win!', lostTo: '{seat} wins', levelWins: '{name} wins',
  endBody: 'All {who} lions made it {where} after {n} throws in all.', whereHead: 'to the head', whereHome: 'there and back',
  endLimit: 'The safety limit of {n} turns ended the race; {seat} was furthest along.',
  standings: 'Standings',
  // toasts
  tNoMarble: 'No marbles left to spend.', tNotNow: 'Throw the sticks first.', tNoLion: 'That lion cannot move that far.', tHintBusy: 'Think is working...', tYourTurn: 'Wait for your turn.',
  // level names
  lv_novice: 'Novice', lv_skilled: 'Skilled', lv_expert: 'Expert', lv_master: 'Master',
  lvb_novice: 'Plays quickly and loosely: likes a capture and a resting stone, but misses the dangers.',
  lvb_skilled: 'Looks one move ahead and weighs the risk of being hit.',
  lvb_expert: 'Looks two moves ahead through every possible throw.',
  lvb_master: 'Looks four moves ahead, counts marbles carefully and rarely leaves a lion exposed.',
  len_quick: 'Quick', len_classic: 'Classic', len_long: 'Long',
  lenb_quick: 'One lion each runs from the tail to the head. About 3 minutes with two seats.',
  lenb_classic: 'Two lions each run from the tail to the head. About 6 minutes with two seats.',
  lenb_long: 'One lion each runs to the head, turns, and runs all the way back out. About 6 minutes with two seats.',
  paceTitle: 'Computer pace', pace_0: 'Auto', pace_1: 'Relaxed', pace_2: 'Brisk', pace_3: 'Fast', tSkip: 'Tap the board to skip ahead',
  thRule: 'Rules', lionWord: 'lion', lionsWord: 'lions',
  th_sandstone: 'Sandstone', th_basalt: 'Basalt and Gold', th_lapis: 'Lapis Night',
  cThrow: 'Four sticks', cNudge: 'Nudge with a marble', cRest: 'Resting stones', cCapture: 'Capture', cHead: 'The head',
};

export const tr = (key, vars) => {
  let s = STR[key] ?? key;
  if (vars) for (const k of Object.keys(vars)) s = s.split(`{${k}}`).join(String(vars[k]));
  return s;
};
export const lvName = (id) => tr(`lv_${id}`);
export const lvBlurb = (id) => tr(`lvb_${id}`);
export const lenName = (id) => tr(`len_${id}`);
export const lenBlurb = (id) => tr(`lenb_${id}`);
export const themeName = (id) => tr(`th_${id}`);
export const seatColor = (i) => PALETTE[i % PALETTE.length].id[0].toUpperCase() + PALETTE[i % PALETTE.length].id.slice(1);
export const lionsText = (n) => `${n} ${n === 1 ? tr('lionWord') : tr('lionsWord')}`;

// ----------------------------------------------------------------------------------------------------- How to Play
export function getHowto() {
  const lens = LENGTHS.map((l) => `${lenName(l.id)}: ${l.lions} ${l.lions === 1 ? 'lion' : 'lions'} each, ${l.mode === 'full' ? 'to the head and back' : 'to the head'}`).join('. ');
  return [
    { title: 'Reach the head', art: 'goal', body: `A snake is carved in a stone slab, coiled round and round. Its tail is on the outside, its head is in the middle. Race your lions along its back from the tail to the head. Up to ${MAX_PLAYERS} seats play, each a different colour, any mix of people and computer.` },
    { title: 'Throw the sticks', art: 'sticks', body: `On your turn tap Throw. Four sticks tumble: count the flat sides that land face up. One flat is a 1, two flats a 2, three a 3, four a 4, and no flats at all counts as a 5. A 4 or a 5 earns another throw.` },
    { title: 'Move a lion', art: 'move', body: `Tap one of your lions, or the lit stone it would land on, to move it forward by your throw. A lion still waiting at the tail enters on the stone with that number. Your lion cannot share a stone with another of yours, and it must reach the head with an exact count.` },
    { title: 'Spend a marble', art: 'nudge', body: `Each seat starts with ${MARBLES} marbles. Before you move, tap One more or One less and a marble rolls down the snake to change your throw by one step. Marbles are also the spoils of battle, so spend them where they count.` },
    { title: 'Rest and strike', art: 'rest', body: `Every ${SAFE_STEP === 5 ? 'fifth' : SAFE_STEP + 'th'} stone is a resting stone with a gold diamond: nobody can land on a lion that rests there. Land on a rival lion anywhere else and it goes back to the tail while you take one of its marbles.` },
    { title: 'Win the race', art: 'win', body: `Bring all your lions home to win. Choose the length of the race when you start: ${lens}. Think shows a good choice and why; Watch & Learn plays a whole race for you with every decision explained.` },
  ];
}

// ----------------------------------------------------------------------------------------------------------- Rules
const oddsLine = () => [1, 2, 3, 4, 5].map((v) => `${v}: ${pct(VALUE_P[v])}`).join(', ');
const waysLine = () => FLAT_WAYS.map((w, f) => `${f} ${f === 1 ? 'flat' : 'flats'}: ${w} of 16`).join(', ');
export function getRules() {
  const safe = list(SAFE_CELLS.filter((c) => c < HEAD));
  return [
    { title: 'A reconstruction', art: 'recon', body: [
      'No ancient rulebook for Mehen survives. What archaeologists have found are carved boards in the form of a coiled snake whose body is divided into cells, sets of lion figures, and small marbles, from Old Kingdom Egypt (roughly 3000 to 2300 BC), with spiral boards in Cyprus and the Levant later still.',
      `Because the rules are lost, every modern version is a reconstruction. This one is built from the evidence: a coiled track raced from the tail to the head, lions as pieces, marbles as small counters, and several seats at one board. The details below (${TRACK} cells, four throwing sticks, resting stones, the marble nudge, captures) are this game's own choices, made to give a fair, quick and thoughtful race.`,
    ] },
    { title: 'The board', art: 'board', body: [
      `The snake has ${TRACK - 1} body cells numbered from the tail (1) inwards, and its head, cell ${HEAD}, is in the middle. The tail end is on the outside edge of the slab.`,
      `Every ${SAFE_STEP === 5 ? 'fifth' : SAFE_STEP + 'th'} cell (${safe}) is a resting stone, marked with a carved gold diamond. The head also counts as safe.`,
      'Lions that have not yet entered wait at the tail, shown on their seat plate. Lions that are home are shown on the plate too.',
    ] },
    { title: 'Seats, lions and marbles', art: 'seats', body: [
      `${MIN_PLAYERS} to ${MAX_PLAYERS} seats play. Each seat has its own colour: ${list(PALETTE.map((p) => p.id[0].toUpperCase() + p.id.slice(1)))}. Seats take turns in that order, as the plates are laid out, and the first seat moves first.`,
      `Each seat has 1 or 2 lions, depending on the race length you choose (Quick and Long: 1 lion; Classic: 2 lions), and ${MARBLES} marbles.`,
      'Every seat can be a person or the computer, so the same phone can host a family game, a game against the computer, or a mix.',
    ] },
    { title: 'Throwing the sticks', art: 'sticks', body: [
      `You throw ${STICKS} two-sided sticks. The number of flat faces that land up gives your throw: 1, 2, 3 or 4. If no flat face lands up, the throw counts as 5.`,
      `The sixteen ways the sticks can fall give: ${waysLine()}. So the throws come up: ${oddsLine()}.`,
      'Twos are the most common throw; fours and fives are rare, and valuable, because they bring another turn.',
    ] },
    { title: 'Extra throws', art: 'sticks', body: [
      `A throw of ${EXTRA_AT} or ${EXTRA_AT + 1} earns an extra throw after you have moved (about ${pct(EXTRA_P)} of throws). Nudging a throw with a marble never changes this: only the number the sticks showed counts.`,
      `If a ${EXTRA_AT} or a ${EXTRA_AT + 1} cannot be used at all, you still throw again.`,
    ] },
    { title: 'Entering and moving', art: 'move', body: [
      'You must move one lion by the full throw if any lion can. A lion waiting at the tail enters on the cell with the number you threw; a lion on the board moves forward that many cells along the snake.',
      'You cannot land on a cell that holds one of your own lions. You cannot land on a rival lion that stands on a resting stone.',
      'Tap a lion, or the lit stone it would land on. Stones where a move is possible are lit; the ghost lion shows where it will stand.',
    ] },
    { title: 'Marbles: the nudge', art: 'nudge', body: [
      `Once per throw you may spend 1 marble to change the throw by one step, up (One more) or down (One less). A throw of 3 can become 2 or 4; a throw can never be nudged below 1. The marble rolls down the snake to the head.`,
      'Marbles are the only way to fine-tune a throw, for example to land exactly on a resting stone or on the head. A seat with no marbles cannot nudge.',
      `You win marbles by capturing (see Capturing) and by bringing a lion home. You start with ${MARBLES}.`,
    ] },
    { title: 'Resting stones', art: 'rest', body: [
      `The resting stones (${safe}) protect any lion standing on them. A rival cannot land there, so a lion that rests there can never be captured.`,
      'A rival lion can still pass over a resting stone. Only the stone you stand on is safe; the cells around it are not.',
    ] },
    { title: 'Capturing', art: 'capture', body: [
      'If your lion lands exactly on a rival lion on a cell that is not a resting stone, that lion is captured: it is sent back to the tail, where it must enter again.',
      'The capturing seat takes one marble from the captured lion\'s seat, if that seat has one. If it has none, nothing is taken.',
      'Several rival lions are never captured in one move: one landing captures at most one lion. The head can never be a place of capture.',
    ] },
    { title: 'The head', art: 'head', body: [
      `The head (cell ${HEAD}) must be reached with an exact count. A lion that would pass the head cannot use that throw; it simply waits for a smaller one. A marble nudge can fix an awkward count.`,
      'A lion that reaches the head in the Quick and Classic races is home at once. Bringing a lion home wins its seat a marble.',
      'In the Long race, the lion at the head turns round: it must then run back along the same cells out to the tail, moving toward cell 1 with the same throws. It leaves the board with any count that carries it past cell 1, and is then home.',
    ] },
    { title: 'Lions on the return trip', art: 'full', body: [
      'In the Long race, a returning lion keeps all the rules of the outward trip: it cannot share a cell with your own lions, cannot land on a rival on a resting stone, and captures a rival it lands on.',
      'A captured returning lion goes back to the tail and must make the whole journey again. The head holds any number of lions at once, so lions turn there without blocking.',
    ] },
    { title: 'No move', art: 'sticks', body: [
      `If no lion can use your throw, even with a marble nudge, the turn passes (after a ${EXTRA_AT} or ${EXTRA_AT + 1} you still throw again). If no lion can use the throw as thrown but one could with a nudge, you may spend a marble to make the move, or tap Skip to keep the marble; Skip also ends the turn, with the same extra throw after a ${EXTRA_AT} or ${EXTRA_AT + 1}.`,
      'If a move is possible with the throw as thrown, you must make a move, but you can still choose which lion.',
    ] },
    { title: 'Winning', art: 'win', body: [
      'The first seat to bring all its lions home wins. There are no draws.',
      `A safety limit of ${MAX_TURNS} turns ends a race that somehow never finishes, in favour of the seat furthest along. It is never reached in normal play.`,
    ] },
    { title: 'Race lengths', art: 'full', body: [
      LENGTHS.map((l) => `${lenName(l.id)}: ${l.lions} ${l.lions === 1 ? 'lion' : 'lions'} each, ${l.mode === 'full' ? 'there and back (about twice the distance)' : 'tail to head'}.`).join(' '),
      'A Quick race is mostly luck and nerve; Classic gives you a choice between two lions every turn; Long makes captures on the way back matter.',
    ] },
    { title: 'Computer opponents and Think', art: 'think', body: [
      'The computer has four levels. Novice plays loosely. Skilled looks one move ahead and counts how often a rival could hit each lion. Expert looks two moves ahead through all five throws. Master looks four moves ahead and counts marbles carefully.',
      'Think (tap it on your turn after throwing) shows a good move and a nudge if one helps, and says why in plain words. Watch & Learn plays whole races between computer seats: it thinks, shows the options and the chosen move, then plays it, with Pause at any time.',
    ] },
    { title: 'Text size and sound', art: 'sound', body: [
      'Every text screen has A- and A+ buttons that scale the text from 100% to 300%; the pages scroll when the text is large. The Settings page also holds the sound switch, the stone and light you play on, the pace of the computer seats (Auto speeds them up as more seats join; tap the board during a computer turn to skip ahead) and the Watch & Learn thinking time.',
    ] },
  ];
}

// ----------------------------------------------------------------------------------------------------------- About
export function getAbout() {
  return [
    { title: 'Mehen: The Coiled Snake Race', body: 'Carved lions race along a coiled snake of stone, from its tail on the outside to its head in the middle. Throw four sticks, decide which lion to move, spend a marble to nudge a throw, rest on the carved stones and knock rivals back to the start.' },
    { title: 'An old game', body: 'Boards in the shape of a coiled snake, with sets of lion figures and small marbles, have been found in Egypt and are shown in wall paintings from the Old Kingdom, roughly 3000 to 2300 BC. Similar spiral boards turn up later in Cyprus and the Levant. It is one of the oldest board games known.' },
    { title: 'A reconstruction', body: 'Nobody knows how Mehen was really played: no rules survive. This game is a reconstruction in the spirit of the evidence, and it says so plainly. The Rules page explains each choice made here, so you can see where this version fills a gap.' },
    { title: 'This version', body: 'Up to six seats, any mix of people and computer, in three race lengths. A carved board lit like a lamp-lit stone, glass marbles that roll, four computer levels, Think with plain-English reasons, and Watch & Learn. Plays in portrait and landscape, with text that scales to 300%. No timers, no ads, works offline.' },
    { title: 'Credits', body: 'Designed and built by Arcforge: every picture, the carved relief and all of the sounds are drawn and synthesized in the game itself.' },
  ];
}
export const RULE_COUNT = () => getRules().length;
export { lengthOf };
