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
//
// One concept per page, kept short: at the largest text-size step (see layout.js TEXT_SCALES,
// now topping out at 3.0/300%) a page with more than a short phrase under an illustration (a
// fixed, tight text budget - see render.js RULES_TEXT_TOP_WITH_ART/HERO) would overflow, so every
// page is kept to one short sentence (or a very short pair) - a 300% top step leaves an
// illustrated page only ~2-3 lines of body text, far less than the ~5 lines available at the
// previous 200% ceiling, so this pass split nearly every page down further than the 200% pass
// left it. Where a page was split, only its first page still carries the illustration
// (introducing the concept); its continuation pages have more room precisely because they have
// no art to make room for. Every page here was verified to fit at the 300% step both by an exact
// headless-Chrome replica of render.js's own wrapRulesParagraph/layoutRulesBody sizing logic (see
// STATUS.md) and by rendering + reading every one of the 96 pages as PNGs.
export const RULES = [
  {
    title: "No-guess, from the first tap",
    art: "hero",
    lines: ["Every board is generated."],
  },
  {
    title: "Proven before you see it",
    lines: ["It is proven fully solvable by logic alone before it is ever shown to you."],
  },
  {
    title: "How you clear a board",
    lines: ["Tap to open a tile, read its numbers, flag the mines they force, and chord back on a satisfied number to clear the rest in one tap."],
  },
  {
    title: "Never a forced guess",
    lines: ["Because of that guarantee, a loss is always your own misclick or wrong flag - never an unavoidable 50/50 the game forced on you."],
  },
  {
    title: "The tiles",
    art: "cells",
    lines: ["Hidden: a raised, unopened tile."],
  },
  {
    title: "Hidden means unknown",
    lines: ["It could be empty ground or a mine - you cannot tell until you open it (or deduce it)."],
  },
  {
    title: "Opened - blank",
    lines: ["Opened - blank: a shallow, empty cell with no number."],
  },
  {
    title: "What a blank means",
    lines: ["It means none of its neighbours are mines."],
  },
  {
    title: "Opened - number",
    lines: ["Opened - number: a shallow cell showing how many of its up to 8 neighbouring tiles are mines."],
  },
  {
    title: "Flags",
    lines: ["Flagged: a marker planted on a still-hidden tile - your own note that you believe it is a mine."],
  },
  {
    title: "Flags are never opened",
    lines: ["It is never opened while flagged."],
  },
  {
    title: "When a mine is shown",
    lines: ["A mine is only ever shown once a run ends - on the tile that ended it (drawn on a red tile)."],
  },
  {
    title: "After Undo",
    lines: ["Or, after you spend your one Undo, on every mine left on the board."],
  },
  {
    title: "Reading a number",
    art: "neighbours",
    lines: ["A revealed number counts nearby mines."],
  },
  {
    title: "What the count means",
    lines: ["It counts exactly how many of its up-to-8 neighbouring tiles are mines."],
  },
  {
    title: "When neighbours are safe",
    lines: ["If a number already has that many flags planted on its neighbours, every other neighbour is guaranteed safe."],
  },
  {
    title: "When neighbours are mines",
    lines: ["If a number has exactly that many still-hidden neighbours left, all of them are guaranteed mines."],
  },
  {
    title: "The whole game",
    lines: ["Spotting both of those is the entire game."],
  },
  {
    title: "Number colours",
    lines: ["Numbers 1 to 8 are always drawn in different, consistent colours (the classic convention)."],
  },
  {
    title: "Easy to tell apart",
    lines: ["This makes them easy to tell apart at a glance."],
  },
  {
    title: "Colours depend on your scheme",
    lines: ["The exact colours depend on which colour scheme you have picked (see the Colours page)."],
  },
  {
    title: "Always distinct",
    lines: ["But every scheme keeps every number visually distinct."],
  },
  {
    title: "Opening a tile",
    art: "flood",
    lines: ["Tap a hidden tile in Reveal mode to open it."],
  },
  {
    title: "Cascading blanks",
    lines: ["If it turns out to be blank (no neighbouring mines at all), opening cascades outward on its own."],
  },
  {
    title: "How far it spreads",
    lines: ["Every connected blank tile opens too, plus the single ring of numbered tiles bordering that blank region."],
  },
  {
    title: "One tap, big area",
    lines: ["One tap can clear a large area at once."],
  },
  {
    title: "Opening a mine",
    lines: ["If the tile you tap is a mine, the run ends immediately, right there."],
  },
  {
    title: "The first tap is always safe",
    lines: ["The very first tap of every board is guaranteed to never be a mine, and the 8 tiles right around it are kept mine-free too."],
  },
  {
    title: "Never a lonely number",
    lines: ["So the opening move always cascades into a real region to work with, never a single lonely number."],
  },
  {
    title: "Reveal or Flag",
    art: "flags",
    lines: ["The switch picks what a tap does."],
  },
  {
    title: "Reveal vs Flag",
    lines: ["Reveal (left) opens it; Flag (right) plants or lifts a marker instead, without opening the tile."],
  },
  {
    title: "Desktop shortcut",
    lines: ["On the desktop web demo, F or Space also flips the switch."],
  },
  {
    title: "Flagging is always safe",
    lines: ["Flagging is completely safe by itself - you can never end a run just by placing or removing a flag."],
  },
  {
    title: "Un-flagging a tile",
    lines: ["Tapping an already-flagged tile while in Reveal mode does nothing; you have to switch back to Flag mode to lift it first."],
  },
  {
    title: "Why that's safer",
    lines: ["This protects a flagged tile from being opened by accident."],
  },
  {
    title: "Chording",
    art: "chord",
    lines: ["Tap an opened number again to chord it."],
  },
  {
    title: "When chording fires",
    lines: ["If the flags planted on a number's neighbours already equal that number, chording is ready."],
  },
  {
    title: "What happens",
    lines: ["Every remaining hidden, unflagged neighbour opens at once, in a single tap."],
  },
  {
    title: "Why it's useful",
    lines: ["A fast way to clear the rest of a solved area without tapping each tile by hand."],
  },
  {
    title: "Chording checks count only",
    lines: ["Chording only ever checks the COUNT of flags around the number, not whether they sit on the right tiles."],
  },
  {
    title: "A wrong flag can cost you",
    lines: ["If a flag was planted on the wrong tile, chording can open an actual mine and end the run right there."],
  },
  {
    title: "Just like classic Minesweeper",
    lines: ["That is the one place a bad flag can cost you, exactly like classic Minesweeper."],
  },
  {
    title: "Reading the HUD",
    art: "hud",
    lines: ["MINES (left): mines still unflagged."],
  },
  {
    title: "How it's counted",
    lines: ["That's the mine count minus your flags planted so far."],
  },
  {
    title: "Never below zero",
    lines: ["It can go negative-looking in spirit if you over-flag, but the game only ever shows it floored at zero."],
  },
  {
    title: "The progress ring",
    lines: ["The ring in the middle fills as you open safe tiles - it reaches 100% exactly when the board is won."],
  },
  {
    title: "The timer",
    lines: ["TIME (right): seconds elapsed since this board started, counting up only while you are actively playing it."],
  },
  {
    title: "Your best time",
    lines: ["Your fastest ever winning time is saved as your best time and shown on the title screen and after every win."],
  },
  {
    title: "Winning",
    art: "winlose",
    lines: ["You win when every safe tile is open."],
  },
  {
    title: "No mines to flag",
    lines: ["You never have to flag a single mine to win - only reveal all the safe ground."],
  },
  {
    title: "Losing",
    lines: ["You lose the instant a mine is revealed, whether by tapping it directly or by exposing it through a chord."],
  },
  {
    title: "The fatal tile",
    lines: ["The exact mine that ended the run is shown on a red tile."],
  },
  {
    title: "No score, just a timer",
    lines: ["There is no score, no points and no lives - just the timer, your best time, and a fresh board whenever you want one."],
  },
  {
    title: "Always a fresh board",
    lines: ["New Board (or tapping the result card) always starts a brand new, freshly verified board, win or lose."],
  },
  {
    title: "After a loss",
    art: "losshint",
    lines: ["The game looks back at your last tap."],
  },
  {
    title: "Searching for a forced move",
    lines: ["It looks at the board exactly as it stood the instant before your fatal tap and searches for one forced move."],
  },
  {
    title: "What counts as a forced move",
    lines: ["A tile that had to be safe, or had to be a mine, that could already be worked out from the flags and numbers on the board."],
  },
  {
    title: "At that exact moment",
    lines: ["That's true at that exact moment; if the search finds one, it is ringed green (safe) or red (mine)."],
  },
  {
    title: "A real search, not a replay",
    lines: ["This is a real search of that exact position, not a replay of the ideal solve path."],
  },
  {
    title: "If nothing is found",
    lines: ["If no forced move happened to be available at that precise instant, no ring is shown."],
  },
  {
    title: "Hint",
    art: "hintundo",
    lines: ["Hint: finds a forced move right now."],
  },
  {
    title: "Hint: free and unlimited",
    lines: ["It uses the same logic as the loss review and rings the tile for a few seconds. Free, and you can ask for it as often as you like."],
  },
  {
    title: "Undo",
    lines: ["Undo (on the loss screen only): offered once per board."],
  },
  {
    title: "What Undo does",
    lines: ["It un-explodes the fatal tile and plants a flag on it instead."],
  },
  {
    title: "Back into the run",
    lines: ["Then it drops you straight back into the same run with that mine now safely marked."],
  },
  {
    title: "Mines stay hidden",
    lines: ["Until you spend that Undo, the board never shows you where the other mines are."],
  },
  {
    title: "The full reveal",
    lines: ["The full reveal of every remaining mine only happens on the loss screen once Undo has been used or declined."],
  },
  {
    title: "Why it's timed that way",
    lines: ["So it can never leak information into a run you are still able to continue."],
  },
  {
    title: "Colours",
    art: "colours",
    lines: ["Colours button cycles schemes."],
  },
  {
    title: "Where to find it",
    lines: ["Tap it on the title screen or while playing to cycle through a set of colour schemes."],
  },
  {
    title: "Colours for readability",
    lines: ["Some schemes are easier to read for colour-blind or low-vision players."],
  },
  {
    title: "Two dedicated schemes",
    lines: ["That includes a dedicated High contrast scheme and a Colour-blind safe scheme."],
  },
  {
    title: "Your choice is remembered",
    lines: ["Your choice is remembered between sessions."],
  },
  {
    title: "Colours never change the puzzle",
    lines: ["Changing it never touches the mines, the difficulty, or anything about how a board is generated or solved."],
  },
  {
    title: "Only how it looks",
    lines: ["It only changes how it looks."],
  },
  {
    title: "The board",
    lines: ["Every board today is the same size and density: a 9x9 grid with 10 mines (about 1 tile in 8)."],
  },
  {
    title: "Bigger boards, later",
    lines: ["Larger grids with more mines are on the roadmap but are not in this build."],
  },
  {
    title: "How boards are made",
    lines: ["Boards are entirely procedural - there is nothing hand-authored to unlock or run out of."],
  },
  {
    title: "A fresh seed every time",
    lines: ["Every tap of New Board is a freshly generated, freshly verified layout with a new random seed."],
  },
  {
    title: "The free preview",
    lines: ["The free web preview limits how many boards you can start before it asks you to get the full game; the full app has no such limit."],
  },
  {
    title: "How every board is guaranteed solvable",
    lines: ["Before a board is ever shown to you, the game places mines randomly, keeping the opening tap and its neighbours clear."],
  },
  {
    title: "Handed to the solver",
    lines: ["It then hands that exact layout to its own logical solver."],
  },
  {
    title: "Three kinds of deduction",
    lines: ["The solver tries to open the whole board using only three kinds of deduction."],
  },
  {
    title: "Single-point deduction",
    lines: ["Single-point: a number whose flags already match it, or whose hidden neighbours already match it, resolves them all at once."],
  },
  {
    title: "Subset/pair deduction",
    lines: ["Subset/pair: comparing two numbers whose unknown neighbours overlap can resolve tiles neither number alone can."],
  },
  {
    title: "End-game count",
    lines: ["An end-game count: once the mines left exactly match the tiles left (or none are left at all), everything remaining resolves at once."],
  },
  {
    title: "Verifying a board",
    lines: ["Only if the solver can clear the entire board using just those three kinds of reasoning does the game accept that layout."],
  },
  {
    title: "If it can't be verified",
    lines: ["Otherwise it reshuffles the mines and tries again - up to 500 attempts for one board."],
  },
  {
    title: "Its honest limit",
    lines: ["This solver does not do full probability reasoning or brute-force search across every possible mine arrangement."],
  },
  {
    title: "More cautious than perfect",
    lines: ["So it is more cautious than a perfect solver would be."],
  },
  {
    title: "What that trade-off means",
    lines: ["A board it accepts never needs a guess, but it may reject some boards a stronger solver could have proven safe too."],
  },
  {
    title: "Why it needs several tries",
    lines: ["That is why it sometimes needs several attempts."],
  },
  {
    title: "If every attempt fails",
    lines: ["In the vanishingly rare case where none of the 500 attempts pass, the game does not hang or loop forever."],
  },
  {
    title: "It ships anyway",
    lines: ["It ships the last attempted layout anyway rather than freezing."],
  },
  {
    title: "How rare, in practice",
    lines: ["That is the only way a board could theoretically ship without the full no-guess guarantee."],
  },
  {
    title: "Essentially never happens",
    lines: ["And at today's board size, this essentially never happens."],
  },
];
