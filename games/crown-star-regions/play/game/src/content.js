// Text for the in-app Rules reference page. Every claim here is cross-checked against the real
// implementation (generator.js / rules.js / game.js are the single source of truth for what
// actually ships) so this page can never contradict the shipped game or the idealized textbook
// rules of the Star Battle/Queens family. Where the design document's plan and the real shipped
// behaviour differ (Hint's real pick order, the Expert board's real unlock state, and the
// generator's real - not absolute - preference for a no-guess board), this page describes the
// real, shipped behaviour.
//
// `art` names which small illustration view.js's own `drawRulesArt` should draw for that page,
// reusing this game's own drawing functions (drawBoardBase/drawPlacedCrown/drawRuledOut/
// drawCrown/button/chip/ICONS) - never a separate simplified icon set. See view.js's
// `drawRulesArt` for what each `art` name does.
export const RULES = [
  {
    title: 'The grid and its regions',
    art: 'board',
    lines: [
      'Every puzzle is a grid split into as many differently-coloured regions as it is wide - 7 ' +
        'regions on a 7×7 board, 10 on the 10×10 Expert board. A solved puzzle places exactly ' +
        'one crown in every row, every column and every region - that many crowns in total, never ' +
        'more, never fewer.',
    ],
  },
  {
    title: 'Region sizes vary',
    lines: [
      'Regions are grown, not hand-drawn, so their sizes vary from puzzle to puzzle: no region is ' +
        'ever allowed to cover more than about 30% of the board, and at most one region on a board ' +
        'is a single cell. That is exactly why some regions collapse to an obvious placement before ' +
        'others.',
    ],
  },
  {
    title: 'No touching',
    art: 'touch',
    lines: [
      'Two crowns may never sit within one row AND one column of each other. That rules out the 4 ' +
        'orthogonal neighbours (up, down, left, right) and the 4 diagonal neighbours alike - a ' +
        'crown forbids every one of the up to 8 cells immediately around it, corners included.',
      'This is checked exactly, cell by cell - never an approximation. Any two crowns that end up ' +
        'that close together are flagged, whatever row, column or region they belong to.',
    ],
  },
  {
    title: 'Marking a cell',
    art: 'cycle',
    lines: [
      'Tap any cell to cycle its mark, one step per tap: empty → crossed out → crown → empty. ' +
        'Crossing a cell out is how you record "a crown can never go here" while you narrow a ' +
        'region down.',
      'Tapping a cell that already holds a crown sends it straight back to empty in that same one ' +
        'tap, rather than back to a cross first - undoing a wrong crown never costs more than a ' +
        'single extra tap. That is simply how the three-step cycle is ordered; there is no separate ' +
        'long-press gesture in the shipped build.',
    ],
  },
  {
    title: 'Auto-cross on a crown',
    art: 'autocross',
    lines: [
      'The moment you place a crown, every cell it makes illegal is crossed out for you ' +
        'automatically: the rest of its row, the rest of its column, the rest of its region, and its ' +
        'up to 8 touching neighbours.',
      'Auto-cross only ever changes cells that are still empty. A cross or a crown you placed on ' +
        'purpose, anywhere else on the board, is never overwritten by it.',
    ],
  },
  {
    title: 'Conflicts',
    art: 'conflict',
    lines: [
      'If a crown ends up sharing a row, column or region with another crown, or touching one, both ' +
        'crowns are flagged: their tile glows inside a pulsing red ring and a short low tone plays.',
      'A conflicting crown is NOT blocked from being placed - it still lands on the board, and your ' +
        'move counter still goes up. Conflicts stay highlighted for exactly as long as they are ' +
        'real; they clear the instant you fix them rather than fading out on a timer.',
    ],
  },
  {
    title: 'Undo',
    art: 'hintundo',
    lines: [
      'Undo steps back one mark at a time - free, with no limit for the puzzle you are currently ' +
        'solving.',
    ],
  },
  {
    title: 'Hint',
    lines: [
      'Hint places one correct crown immediately, with no ad and no waiting: it checks the puzzle’s ' +
        'regions in order (region 0, then 1, then 2, and so on) and drops a crown on the first ' +
        'region that does not have its solution crown placed yet. It does not look ahead for ' +
        'whichever region is easiest to finish next.',
    ],
  },
  {
    title: 'Free and unlimited',
    lines: [
      'Both Hint and Undo are simply free and unlimited in this build - any suggestion elsewhere ' +
        'that a hint costs a reward or an ad no longer matches the shipped game.',
    ],
  },
  {
    title: 'Colours',
    art: 'colours',
    lines: [
      'The Colours button cycles through 14 palettes for the board’s regions - purely cosmetic; it ' +
        'changes nothing about how a puzzle plays, and your choice is remembered.',
      'The Colour-blind safe scheme also draws a distinct pattern inside every region on top of its ' +
        'colour, so regions stay easy to tell apart without relying on hue at all.',
    ],
  },
  {
    title: 'Endless',
    art: 'modes',
    lines: [
      'Endless: an untimed 7×7 puzzle from a fresh random seed every time. Tapping anywhere on the ' +
        'solved screen of an Endless puzzle starts a new one at the same size.',
    ],
  },
  {
    title: 'Daily Puzzle',
    lines: [
      'Daily Puzzle: a 7×7 board seeded from the date, so every player sees the same board on a ' +
        'given day. Finishing it and tapping the solved screen does NOT repeat the Daily - it starts ' +
        'a fresh Endless 7×7 instead.',
    ],
  },
  {
    title: 'Expert 10×10',
    lines: [
      'Expert 10×10: a bigger board, generated the same way at size 10 - one crown per row, column ' +
        'and region either way. It is unlocked and playable right away in this build; a "solve 5 or ' +
        'buy the Expert Pack" message some earlier notes describe is not currently enforced.',
    ],
  },
  {
    title: 'How a puzzle is built',
    art: 'generate',
    lines: [
      'Every board starts from a valid crown placement, then grows its regions outward from those ' +
        'crowns into mismatched sizes. A real backtracking solver then checks the board and reshapes ' +
        'it, cell by cell, until that starting placement is the ONLY solution left - checked by ' +
        'search, never assumed.',
    ],
  },
  {
    title: 'Built to avoid guessing',
    lines: [
      'The generator also strongly favours a board a player can finish by pure step-by-step ' +
        'deduction, never a blind guess, and throws out any board so easy its crowns simply fall out ' +
        'on their own. That preference is not an absolute guarantee, though: unlike a true no-guess ' +
        'design, if a logic-only board cannot be found within the search budget, Crown Fields still ' +
        'hands you a board proven to have exactly one solution, even if that particular one might ' +
        'need a guess, rather than fail to produce a puzzle.',
    ],
  },
  {
    title: 'Winning',
    art: 'win',
    lines: [
      'A puzzle is solved the instant the board holds exactly one crown in every row, every column ' +
        'and every region, with zero conflicts left anywhere - there is no separate "submit" step.',
      'The solved screen shows your time and move count, plus how many hints you used (or "No hints ' +
        'used"). Tapping it moves straight on to the next puzzle - see Endless, Daily Puzzle and ' +
        'Expert 10×10.',
    ],
  },
];
