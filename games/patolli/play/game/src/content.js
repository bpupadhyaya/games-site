// Words of the game: About, How to Play and the Rules book. Block types: { h }, { p }, { li }, { fig, hh }, { sp }.
// Every rule here is the rule the engine plays (engine.js). Figures are painted by docview.js with the game's own painters.
import { BEANS, STEPS, TRAP_BACK, LOOP, HOME, MAX_CHAIN } from './engine.js';
import { PREVIEW_NOTE } from './rulesdata.js';

export const ABOUT = {
  title: 'About Patolli',
  blocks: [
    { h: 'Where the game comes from' },
    { p: 'Patolli is a race game of ancient Mesoamerica, the lands of present-day Mexico. Spanish writers of the sixteenth century described it, and its cross-shaped boards are scratched and painted into stone floors at archaeological sites such as Teotihuacan. Players threw marked beans and raced their pieces around a cross.' },
    { h: 'A reconstruction' },
    { p: 'Nobody knows every rule exactly, so this is a reconstruction: a plain, secular race game in the spirit of the old one. There are no stakes, no wagers and no offerings; the game keeps score in points only. We tell you on the Rules pages which parts are our own design choices.' },
    { h: 'With respect for its roots' },
    { p: 'Patolli belongs to the heritage of Mexico and the peoples who played it. Here we describe the play and the craft of the board only, and we credit the tradition and the place it comes from. Corrections and thoughts from Mexican readers are welcome.' },
    { h: 'What is in this version' },
    { li: 'A carved stone cross, five beans, and two to four seats, each human or computer.' },
    { li: 'Choose which piece to move, make pairs that cannot be landed on, avoid trap squares, and win corner stones for an extra throw.' },
    { li: 'Computer players that weigh every move, a hint button, and Watch and Learn, where the game plays itself and shows its thinking.' },
    { li: 'A full Rules book, text size up to 300%, portrait and landscape, no ads, no betting.' },
    { p: PREVIEW_NOTE },
    { h: 'Made by' },
    { p: 'Patolli is part of Arcforge: world heritage games, redrawn with care.' },
  ],
};

export const HOWTO = {
  title: 'How to Play',
  blocks: [
    { h: 'The aim' },
    { p: 'Bring all of your pieces once round the cross and home to the centre stone before anyone else.' },
    { h: 'Your turn' },
    { li: 'Tap Throw the beans. Five beans fall; each shows its marked face or its plain face.' },
    { li: 'Count the marked faces: one is 1 step, two is 2, three is 3, four is 4. None marked is 5. All five marked is 10 and a throw again.' },
    { li: 'Pick one piece and move it that many squares along the track. Tap a glowing piece to select it, then tap Move (or tap it again).' },
    { li: 'A piece waiting in its pit enters the track with the same throw.' },
    { h: 'On the board' },
    { li: 'Land on a single piece of another seat to send it back to its pit.' },
    { li: 'Two of your pieces on one square make a pair: nobody can land there.' },
    { li: 'The dark trap squares throw you back four squares. The blue corner stones give you another throw.' },
    { li: 'Squares with a coloured top are arm mouths: they are safe for everyone.' },
    { h: 'Helpers' },
    { li: 'The lightbulb shows the move the computer would choose, and why.' },
    { li: 'Watch and Learn plays a whole game by itself: it thinks, shows its choice, then moves. You can pause it at any time.' },
    { li: 'In Settings you can change text size, speed and the Watch and Learn thinking time.' },
  ],
};

const T = (title, blocks) => ({ title, blocks });
export function rulesPages() {
  return [
    T('The board', [
      { p: 'The board is a cross carved in stone: a centre of 3 by 3 squares with four arms, each 3 squares wide and 3 long. The four corners between the arms hold the pit and home counters of the seats.' },
      { fig: 'board', hh: 420 },
      { p: `The outer track is a loop of ${LOOP} squares that runs clockwise round the outline of the cross, eight squares for each arm. Each seat owns one arm. The coloured square at the end of the arm is that seat's mouth, where its pieces come onto the track.` },
      { p: 'Two seats sit at opposite arms. With three or four seats the arms are used in clockwise order.' },
      { p: 'The three squares of a seat\'s own arm that point towards the middle are its spine: only that seat\'s pieces ever stand there. The centre stone at the end of the spine is home.' },
    ]),
    T('The beans', [
      { p: `Five beans are thrown together. Each bean has one marked face, a pale face with a dark drilled dot, and one plain dark face. Count how many land marked side up.` },
      { fig: 'beans', hh: 440 },
      { p: `The steps are: ${STEPS.map((s, k) => `${k} marked = ${s}`).join(', ')}.` },
      { p: `All ${BEANS} marked is the best throw: ten steps, and the same seat throws the beans again. You can earn at most ${MAX_CHAIN} extra throws in a row.` },
      { p: 'The beans are fair, so the middle throws are the most common: two or three marked faces come up about six times in ten. All five marked, or none marked, is rare.' },
      { p: 'Note on the reconstruction: the old accounts say players counted marked faces. The step values here are our own simple scale.' },
    ]),
    T('Pieces and the pit', [
      { p: 'Every seat starts with its pieces waiting in the pit, in its corner of the board. At the start of a game you choose three, four or six pieces for every seat. Six is the classic number; four is the standard game; three is a quick game.' },
      { p: 'A piece has a place on the way round, from 0 (in the pit) to 36 (home). A throw of N steps moves one piece from its place to its place plus N.' },
      { li: 'A piece from the pit enters the track with a throw: a throw of 3 puts it on the third square from its mouth.' },
      { li: `Squares 1 to ${LOOP} are on the loop. Squares ${LOOP + 1} to ${HOME - 1} are the spine, and ${HOME} is home.` },
      { p: 'Pieces of every seat travel the same way round: clockwise.' },
    ]),
    T('Choosing a move', [
      { p: 'After the beans fall, you choose which of your pieces moves. You must move if any piece can move; you may not split the throw between pieces.' },
      { li: 'Pieces standing on the same place count as one choice.' },
      { li: 'A move that is not allowed (a blocked square) is simply not offered.' },
      { li: 'If no piece can move, you pass and the beans go to the next seat.' },
      { p: 'Tap a glowing piece to select it: the track shows where it will land. Tap Move or tap the piece again to confirm, or tap Next piece to look at another. The lightbulb shows the computer\'s choice.' },
    ]),
    T('Capturing and pairs', [
      { p: 'If your piece lands on a square with exactly one piece of another seat, that piece is captured and goes back to its pit. It must come in again from the start.' },
      { fig: 'capture', hh: 280 },
      { li: 'The coloured arm mouths are safe squares: there nobody is captured, and pieces of different seats may stand together.' },
      { li: 'Two or more pieces of one seat on the same square (not a mouth) make a pair. No other seat may land on a pair: that move is not allowed.' },
      { li: 'Your own pieces may share squares freely, and a pair breaks up as soon as one piece moves away.' },
      { p: 'A pair is a good shelter when an opponent is a few squares behind, but it holds two pieces back.' },
    ]),
    T('Traps and corner stones', [
      { fig: 'specials', hh: 360 },
      { p: `Trap squares (the dark pits, one in each arm): a piece that finishes its move on a trap is thrown back ${TRAP_BACK} squares along the track (or, if that square is blocked by a pair, to the first square after it that is open). It does not trigger a second trap, and it does not earn a corner stone.` },
      { p: 'Corner stones (the blue gems at the four inside corners of the cross): a piece that finishes its move on one earns another throw for the same seat.' },
      { p: 'Both can be turned off in the setup screen if you want the plain race.' },
      { p: 'Passing over a trap or a stone does nothing; only the square where the move ends counts.' },
    ]),
    T('Going home and winning', [
      { p: `A piece that has gone all the way round (place ${LOOP}) turns off the loop onto its own spine and goes in towards the centre.` },
      { p: `You do not need an exact throw to get home: any throw that takes a piece to ${HOME} or beyond brings it home.` },
      { p: 'The first seat with all of its pieces home wins the game. When the game ends every seat gets a tally in points: 10 for each piece home, plus how far the others have got, and a bonus for the winner. There is no betting of any kind.' },
      { p: 'Your record (games played and won, fewest turns in a win, pieces captured) is kept in Settings.' },
    ]),
    T('Computer, hints and options', [
      { p: 'Computer seats weigh every move: how far it goes, whether it captures, whether the landing square can be reached by a piece behind it, whether it makes or breaks a pair, whether it ends on a trap or a stone.' },
      { p: 'Hint (the lightbulb): shows the move the computer would choose for you and says why, but does not play it.' },
      { p: 'Watch and Learn: two computer seats play a whole game. Each move has a Think time (you set it in Settings, 2 to 10 seconds), then a Reveal that marks the options and the chosen move, then the move. The pause button stops everything and carries on exactly where it stopped.' },
      { p: 'Text size: A- and A+ at the top of any text screen go up to 300%.' },
      { p: 'Reconstruction: the board, the beans, the pit and the aim are from the historical game. The step values, the pairs, the traps and the corner stones are this version\'s own design.' },
    ]),
  ];
}
