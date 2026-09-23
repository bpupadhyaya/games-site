// Text for the in-app Rules reference page. Every claim here is cross-checked against the real
// implementation (solver.js / board.js / game.js are the single source of truth for what actually
// ships) so this page can never contradict the shipped game or the idealized textbook rules of
// Minesweeper. Where classic Minesweeper folklore and the real shipped behaviour differ (the
// no-guess guarantee's exact scope, the loss-hint's "no forced move yet" edge case, the shield
// keeping mines hidden until it is spent), this page describes the real, shipped behaviour.
//
// `art` names which small illustration render.js's own `drawRulesArt` should draw for that page,
// reusing this game's own drawing functions (drawTile/drawCell/drawNumber/drawFlag/drawMine/
// drawRing/drawHud/drawHero/drawModeSwitch/drawButton) - never a separate simplified icon set.
// See render.js's `drawRulesArt` for what each `art` name does.
export const RULES = [
  {
    title: 'No-guess, from the first tap',
    art: 'hero',
    lines: [
      'Every board is generated, then proven fully solvable by logic alone - before it is ever shown ' +
        'to you.',
      'Tap to open a tile, read its numbers, flag the mines they force, and chord back on a satisfied ' +
        'number to clear the rest in one tap.',
      'Because of that guarantee, a loss is always your own misclick or wrong flag - never an ' +
        'unavoidable 50/50 the game forced on you.',
    ],
  },
  {
    title: 'The tiles',
    art: 'cells',
    lines: [
      'Hidden: a raised, unopened tile. It could be empty ground or a mine - you cannot tell until ' +
        'you open it (or deduce it).',
      'Opened - blank: a shallow, empty cell with no number. It means none of its neighbours are ' +
        'mines.',
      'Opened - number: a shallow cell showing how many of its up to 8 neighbouring tiles are mines.',
      'Flagged: a marker planted on a still-hidden tile - your own note that you believe it is a ' +
        'mine. It is never opened while flagged.',
      'A mine: only ever shown once a run ends - on the tile that ended it (drawn on a red tile) or, ' +
        'after you spend your one Undo, on every mine left on the board.',
    ],
  },
  {
    title: 'Reading a number',
    art: 'neighbours',
    lines: [
      'A revealed number counts exactly how many of its neighbouring tiles are mines - up to 8 for a ' +
        'tile in the middle of the board, fewer for an edge or corner tile, which only has 5 or 3 ' +
        'neighbours to count.',
      'If a number already has that many flags planted on its neighbours, every other neighbour is ' +
        'guaranteed safe. If a number has exactly that many still-hidden neighbours left, all of them ' +
        'are guaranteed mines. Spotting both of those is the entire game.',
      'Numbers 1 to 8 are always drawn in different, consistent colours (the classic convention) so ' +
        'they are easy to tell apart at a glance - the exact colours depend on which colour scheme ' +
        'you have picked (see the Colours page), but every scheme keeps every number visually ' +
        'distinct.',
    ],
  },
  {
    title: 'Opening a tile',
    art: 'flood',
    lines: [
      'Tap a hidden tile in Reveal mode to open it. If it turns out to be blank (no neighbouring ' +
        'mines at all), opening cascades outward on its own: every connected blank tile opens too, ' +
        'plus the single ring of numbered tiles bordering that blank region - one tap can clear a ' +
        'large area at once.',
      'If the tile you tap is a mine, the run ends immediately, right there.',
      'The very first tap of every board is guaranteed to never be a mine, and the 8 tiles right ' +
        'around it are kept mine-free too - so the opening move always cascades into a real region ' +
        'to work with, never a single lonely number.',
    ],
  },
  {
    title: 'Reveal or Flag',
    art: 'flags',
    lines: [
      'The switch under the board picks what a tap on a hidden tile does: Reveal (left) opens it; ' +
        'Flag (right) plants or lifts a marker instead, without opening the tile. On the desktop web ' +
        'demo, F or Space also flips the switch.',
      'Flagging is completely safe by itself - you can never end a run just by placing or removing a ' +
        'flag.',
      'Tapping an already-flagged tile while in Reveal mode does nothing; you have to switch back to ' +
        'Flag mode to lift it first. This protects a flagged tile from being opened by accident.',
    ],
  },
  {
    title: 'Chording',
    art: 'chord',
    lines: [
      'Tap an already-opened number again to chord it: if the number of flags already planted on its ' +
        'neighbours equals that number, every remaining hidden, unflagged neighbour opens at once, in ' +
        'a single tap - a fast way to clear the rest of a solved area without tapping each tile by ' +
        'hand.',
      'Chording only ever checks the COUNT of flags around the number, not whether they sit on the ' +
        'right tiles. If a flag was planted on the wrong tile, chording can open an actual mine and ' +
        'end the run right there - the one place a bad flag can cost you, exactly like classic ' +
        'Minesweeper.',
    ],
  },
  {
    title: 'Reading the HUD',
    art: 'hud',
    lines: [
      'MINES (left): mines still unflagged - the mine count minus your flags planted so far. It can ' +
        'go negative-looking in spirit if you over-flag, but the game only ever shows it floored at ' +
        'zero.',
      'The ring in the middle fills as you open safe tiles - it reaches 100% exactly when the board ' +
        'is won.',
      'TIME (right): seconds elapsed since this board started, counting up only while you are ' +
        'actively playing it. Your fastest ever winning time is saved as your best time and shown on ' +
        'the title screen and after every win.',
    ],
  },
  {
    title: 'Winning and losing',
    art: 'winlose',
    lines: [
      'You win the instant every non-mine tile on the board is open - you never have to flag a single ' +
        'mine to win, only reveal all the safe ground.',
      'You lose the instant a mine is revealed, whether by tapping it directly or by exposing it ' +
        'through a chord. The exact mine that ended the run is shown on a red tile.',
      'There is no score, no points and no lives - just the timer, your best time, and a fresh board ' +
        'whenever you want one. New Board (or tapping the result card) always starts a brand new, ' +
        'freshly verified board, win or lose.',
    ],
  },
  {
    title: 'After a loss: what you could have deduced',
    art: 'losshint',
    lines: [
      'On the loss screen, the game looks back at the board exactly as it stood the instant before ' +
        'your fatal tap and searches it for one forced move: a tile that had to be safe, or had to be ' +
        'a mine, that could already be worked out from the flags and numbers on the board at that ' +
        'exact moment. If it finds one, it is ringed green (safe) or red (mine).',
      'This is a real search of that exact position, not a replay of the ideal solve path - if no ' +
        'forced move happened to be available at that precise instant, no ring is shown.',
    ],
  },
  {
    title: 'Hint and Undo',
    art: 'hintundo',
    lines: [
      'Hint (while playing): finds one forced move anywhere on the board right now, using the same ' +
        'logic as the loss review, and rings it for a few seconds. Free, and you can ask for it as ' +
        'often as you like.',
      'Undo (on the loss screen only): offered once per board. Using it un-explodes the fatal tile, ' +
        'plants a flag on it instead, and drops you straight back into the same run with that mine ' +
        'now safely marked.',
      'Until you spend that Undo, the board never shows you where the other mines are - the full ' +
        'reveal of every remaining mine only happens on the loss screen once Undo has been used or ' +
        'declined, so it can never leak information into a run you are still able to continue.',
    ],
  },
  {
    title: 'Colours',
    art: 'colours',
    lines: [
      'The Colours button (title screen or while playing) cycles through a purely cosmetic set of ' +
        'colour schemes for the tiles, backdrop and numbers - some are easier to read for colour-blind ' +
        'or low-vision players, including a dedicated High contrast and a Colour-blind safe scheme.',
      'Your choice is remembered between sessions. Changing it never touches the mines, the ' +
        'difficulty, or anything about how a board is generated or solved - it only changes how it ' +
        'looks.',
    ],
  },
  {
    title: 'The board',
    lines: [
      'Every board today is the same size and density: a 9x9 grid with 10 mines (about 1 tile in 8). ' +
        'Larger grids with more mines are on the roadmap but are not in this build.',
      'Boards are entirely procedural - there is nothing hand-authored to unlock or run out of; every ' +
        'tap of New Board is a freshly generated, freshly verified layout with a new random seed.',
      'The free web preview limits how many boards you can start before it asks you to get the full ' +
        'game; the full app has no such limit.',
    ],
  },
  {
    title: 'How every board is guaranteed solvable',
    lines: [
      'Before a board is ever shown to you, the game places mines randomly (keeping the opening tap ' +
        'and its neighbours clear) and then hands that exact layout to its own logical solver, which ' +
        'tries to open the whole board using only three kinds of deduction: (1) single-point - a ' +
        'number whose flags already match it, or whose hidden neighbours already match it, resolves ' +
        'them all at once; (2) subset/pair - comparing two numbers whose unknown neighbours overlap ' +
        'can resolve tiles neither number alone can; (3) an end-game count - once the mines left ' +
        'exactly match the tiles left (or none are left at all), everything remaining resolves at ' +
        'once.',
      'Only if the solver can clear the entire board using just those three kinds of reasoning does ' +
        'the game accept that layout and show it to you. Otherwise it reshuffles the mines and tries ' +
        'again - up to 500 attempts for one board.',
      'Honest limit: this solver does not do full probability reasoning or brute-force search across ' +
        'every possible mine arrangement, so it is more cautious than a perfect solver would be - a ' +
        'board it accepts never needs a guess, but it may reject some boards a stronger solver could ' +
        'have proven safe too, which is why it sometimes needs several attempts. And in the ' +
        'vanishingly rare case where none of the 500 attempts pass, the game does not hang or loop ' +
        'forever - it ships the last attempted layout anyway rather than freezing, which means that ' +
        'one specific edge case is the only way a board could theoretically ship without the full ' +
        'no-guess guarantee. At today\'s board size this essentially never happens in practice.',
    ],
  },
];
