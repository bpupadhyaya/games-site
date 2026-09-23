// Words for the How to play and About pages. Facts only; anything uncertain is left out.
// Split into shorter, single-concept pages (was one long page of 6 blocks) so every page still
// fits comfortably in the reader card at the top text-size step.
export const HOWTO = [
  { blocks: [
    { h: 'Controls', p: 'TAP the dice to roll. TAP one of your checkers: the points it can reach glow. TAP a glowing point to move there, or DRAG the checker and drop it on a glowing point. TAP Undo to take back a move in your turn.' },
    { h: 'Keyboard', p: 'Space rolls, Left and Right choose, Enter moves, U undoes.' },
  ] },
  { blocks: [
    { h: 'The goal', p: 'You play the light checkers. Bring all 15 home to points 1 to 6, then bear them off. The first player to bear off all 15 wins.' },
    { h: 'Moving', p: 'Move down toward point 1. Each die is a separate move. A double (the same number twice) is played four times. You may land on an empty point, on your own checkers, or on a lone opposing checker (a blot), which is hit and goes to the bar.' },
  ] },
  { blocks: [
    { h: 'Blocked and the bar', p: 'You cannot land on a point held by two or more opposing checkers. A hit checker must enter from the bar before anything else moves: a die of N enters on point 25 minus N.' },
    { h: 'You must play', p: 'Play as many dice as you can. If only one die can be played, it must be the larger. When no move exists, the turn passes.' },
  ] },
  { blocks: [
    { h: 'Scoring', p: 'A win scores 1. A gammon (the loser bore off nothing) scores 2, a backgammon 3. With the cube on, either side may double the stakes before rolling; the other takes or drops. Points are only a score.' },
  ] },
];
// The exhaustive in-app rules reference, opened from the title screen. Each page is { title, piece?, blocks }.
// `piece: true` tells the Rules view to draw the real in-game checker (both colours) above that page's text.
// Every claim here was checked against the shipped code in rules.js and game.js, not against textbook rules.
// Split into shorter, single-concept pages so every page still fits comfortably in the reader card
// at the top text-size step (a page is only combined with its neighbour when there is real room).
export const RULES = [
  { title: 'The board and setup', blocks: [
    { h: 'Two colours, one board', p: 'Tavla is played on 24 points in four rows of six, joined by a bar down the middle. You play the light checkers, the rival plays the dark. Your home board is points 1–6; the rival’s home board is points 19–24.' },
  ] },
  { title: 'The board: starting position', blocks: [
    { h: 'Starting position', p: 'Each side starts with 15 checkers, laid out the same way, mirrored: 2 on the point farthest from home, 5 on the far edge of the middle (the 13-point), 3 on the 8-point, and 5 on the 6-point at the edge of home.' },
  ] },
  { title: 'The board: the opening roll', blocks: [
    { h: 'The opening roll', p: 'Each side throws one die; a tie is thrown again. Whoever rolls higher moves first and plays that exact pair of numbers as the first move — so the opening move is never a double.' },
  ] },
  { title: 'The checker', piece: true, blocks: [
    { h: 'What it is', p: 'The only playing piece in Tavla. Both sides have 15 identical checkers; only the colour tells them apart.' },
  ] },
  { title: 'The checker: how it moves', blocks: [
    { h: 'How it moves', p: 'A checker moves along the points in one direction only: yours travels down from 24 toward 1, the rival’s travels up from 1 toward 24. Each die you roll moves one checker that many points.' },
  ] },
  { title: 'The checker: where it can land', blocks: [
    { h: 'Where it can land', p: 'A checker may land on an empty point, a point already held by your own checkers, or a point held by a single lone enemy checker — a blot — which it hits.' },
  ] },
  { title: 'Dice and forced play', blocks: [
    { h: 'Rolling', p: 'Each turn starts with a roll of two dice. Every die is a separate move for one checker.' },
    { h: 'Doubles', p: 'Rolling the same number on both dice gives four moves of that number instead of two.' },
  ] },
  { title: 'Dice: play as much as you can', blocks: [
    { h: 'Play as much as you can', p: 'You must use as many of your dice as any legal sequence allows. If a roll lets only one die be played, you must play the larger one when that is possible. If no legal move exists at all, the turn passes with nothing played.' },
  ] },
  { title: 'Blocked points and hitting', blocks: [
    { h: 'Blocked points', p: 'A point held by two or more of the opponent’s checkers is blocked: no checker of yours may land there.' },
    { h: 'Hitting a blot', p: 'A point held by exactly one enemy checker is open. Landing on it hits that checker and sends it to the bar.' },
  ] },
  { title: 'The bar: sent off', blocks: [
    { h: 'Sent to the bar', p: 'A hit checker leaves the board and waits on the bar. While you have a checker on the bar, it must re-enter the board before any other checker of yours may move.' },
  ] },
  { title: 'The bar: entering', blocks: [
    { h: 'Entering', p: 'A checker enters from the bar into the opponent’s home board: a die of N enters on the point 25 minus N. If that point is blocked (two or more enemy checkers), that die cannot be used to enter, and nothing else of yours moves until you do.' },
  ] },
  { title: 'Bearing off: when you may', blocks: [
    { h: 'When you may bear off', p: 'Once all 15 of your checkers are inside your home board — none on the bar or anywhere else — you may start bearing them off.' },
  ] },
  { title: 'Bearing off: exact and higher dice', blocks: [
    { h: 'Exact and higher dice', p: 'A die that exactly matches a checker’s distance from off bears it off. A die larger than any occupied point may bear a checker off from your highest occupied point, but only once no checker of yours sits on a point farther from off than that die value.' },
    { h: 'Winning the race', p: 'The first side to bear off all 15 checkers wins the game.' },
  ] },
  { title: 'The doubling cube: turning it on', blocks: [
    { h: 'Turning it on', p: 'The doubling cube is optional: switch it on or off from the title screen (“Cube: On/Off”). It resets to a value of 1, owned by neither side, at the start of every game.' },
  ] },
  { title: 'The doubling cube: offering a double', blocks: [
    { h: 'Offering a double', p: 'Before rolling your own dice, if you own the cube or no one owns it yet, you may double: the value doubles (1 → 2 → 4 → 8 → 16 → 32 → 64) and the other side must answer.' },
  ] },
  { title: 'The doubling cube: take, drop, ceiling', blocks: [
    { h: 'Take or drop', p: 'Take: play continues at the new value, and you now own the cube — only you may double again. Drop: you concede the game at once, scored at the cube’s value before this double, with no gammon or backgammon bonus.' },
    { h: 'The ceiling', p: 'The cube stops at 64: once it reaches 64 it cannot be doubled again.' },
  ] },
  { title: 'Winning and scoring: a win', blocks: [
    { h: 'A win', p: 'Bearing off all 15 checkers before the opponent scores 1 point.' },
    { h: 'Gammon and backgammon', p: 'If the loser has not borne off a single checker, it is a gammon, worth 2 points. If the loser still has a checker on the bar or anywhere in the winner’s home board, it is a backgammon, worth 3 points.' },
  ] },
  { title: 'Winning and scoring: the cube and gammons', blocks: [
    { h: 'With the cube', p: 'That result (1, 2 or 3) is multiplied by the doubling cube’s value whenever the cube is in play.' },
    { h: 'Turning gammons off', p: 'The “Gammons: On/Off” toggle on the title screen controls this bonus: switch it off and every win scores a flat 1 point, whatever the position.' },
  ] },
  { title: 'No draws', blocks: [
    { h: 'Every game has a winner', p: 'Tavla has no tie and no stalemate. Play continues, one turn at a time, until a side bears off all 15 checkers — or an opponent drops an offered double and concedes.' },
    { h: 'A turn with no move', p: 'If your roll leaves no legal move at all, your turn is simply skipped and play passes to the other side. That is not a draw, just a turn you could not use.' },
  ] },
];
// Split into shorter, single-concept pages (was two long pages of 3 blocks each) so every page
// still fits comfortably in the reader card at the top text-size step.
export const ABOUT = [
  { blocks: [
    { h: 'A game of the tables family', p: 'Tavla is backgammon as it is played in Turkey. In the Arab world and Israel it is called tawla or shesh besh, in Persia takhteh nard, in Greece tavli. The names for the board are widely traced to the Latin word tabula.' },
  ] },
  { blocks: [
    { h: 'Very old roots', p: 'Race games with dice and a track of squares are among the oldest board games known: the Royal Game of Ur from Mesopotamia and Senet from Egypt were played more than four thousand years ago. The tables games, in which two players race fifteen checkers around 24 points, came later and spread through the Roman and Byzantine worlds and Persia.' },
  ] },
  { blocks: [
    { h: 'Shesh besh', p: 'The name is usually explained as six and five: shesh is six in Persian, besh is five in Turkish.' },
  ] },
  { blocks: [
    { h: 'The coffeehouse', p: 'In Turkey and across the region tavla is played in coffeehouses over tea or coffee, often with the dice thrown and the checkers struck down with a flourish, while friends look on and comment. Turkish coffee culture and tradition is on UNESCO\'s list of intangible heritage, added in 2013.' },
  ] },
  { blocks: [
    { h: 'Made by hand', p: 'Boards are often folding wooden boxes, inlaid with different woods, bone and mother-of-pearl. This game paints a board in that tradition.' },
    { h: 'Modern additions', p: 'The doubling cube is a 20th-century addition and is optional here: the classic game has no cube.' },
  ] },
];
