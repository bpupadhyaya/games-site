// The words: Rules (exhaustive, checked against rules.js / game.js), How to Play and About. Pages are lists of blocks:
//   { h } heading   { p } paragraph   { li } bullet   { tiles: { n, shut: [..], sel: [..] } } a row of the game's own tiles
//   { dice: [a, b] } the game's own dice   { gap } extra space
export const DUEL_ROUNDS = 5;
export const LEVELS = [
  { id: 'friendly', name: 'Friendly', blurb: 'Plays the way most people do: shuts the biggest tile it can, and sometimes just goes with its gut.' },
  { id: 'regular', name: 'Regular', blurb: 'Plays well and now and then picks the second-best move, like a good player on an ordinary night.' },
  { id: 'sharp', name: 'Sharp', blurb: 'Plays the best move every time, the same one the hint would show you.' },
];

export const DOCS = {
  rules: {
    title: 'Rules',
    pages: [
      { title: 'The box and the tiles', blocks: [
        { p: 'Shut the Box is played with a box of hinged tiles numbered from 1 up and two dice. Every tile starts open (standing up). The aim is to shut as many tiles as you can, ideally all of them.' },
        { tiles: { n: 9, shut: [], sel: [] } },
        { li: 'Classic Box has nine tiles, 1 to 9. Tall Box has twelve, 1 to 12.' },
        { li: 'A shut tile lies flat in its slot and is out of play for the rest of that box. Tiles never open again.' },
        { li: 'Your score for a box is the total of the numbers of the tiles still open when the box ends. Low is good, 0 is perfect.' },
      ] },
      { title: 'The dice', blocks: [
        { p: 'Each turn you roll two dice and add them. The total is the number you must make with open tiles.' },
        { dice: [4, 3] },
        { li: 'You roll by tapping the dice tray or the Roll button (Space or Enter on a keyboard).' },
        { li: 'One die: once every open tile is 6 or lower, you may roll a single die instead of two. The Dice button switches between one and two dice, and one die is the default whenever it is allowed.' },
        { li: 'The dice are fair. Totals near 7 come up most often (6 in 36 rolls), 2 and 12 least often (1 in 36).' },
        { li: 'Dice never depend on your tile choices: the same box seed always gives the same rolls in the same order.' },
      ] },
      { title: 'Making a move', blocks: [
        { p: 'After the dice settle, tap open tiles whose numbers add up exactly to the total. With an 8 you could shut the 8 alone, or 3 and 5, or 1 and 7, or 1, 2 and 5.' },
        { dice: [5, 3] },
        { tiles: { n: 9, shut: [], sel: [3, 5] } },
        { li: 'A tapped tile lifts and glows amber. Tap it again to put it back.' },
        { li: 'The moment the lifted tiles add up to the total they flip down by themselves; there is no confirm button.' },
        { li: 'Tiles that can no longer be part of a total for this roll are dimmed and cannot be lifted, so you can never paint yourself into a corner mid-selection.' },
        { li: 'You must use the whole total: you cannot shut tiles that add up to less or to more.' },
        { li: 'After the tiles flip, roll again. The box continues until it is shut or stuck.' },
      ] },
      { title: 'The end of a box', blocks: [
        { p: 'A box ends in one of two ways.' },
        { li: 'Shut the Box: every tile is down. Your score is 0, the best possible result.' },
        { li: 'Stuck: after a roll, no set of open tiles adds up to the total. The tiles still open are added up and that is your score. For example, with the 1, 4 and 6 open the score is 11.' },
        { tiles: { n: 9, shut: [2, 3, 5, 7, 8, 9], sel: [] } },
        { li: 'There is no time limit and no penalty for thinking. The score is a plain sum, nothing is added for the number of tiles.' },
        { li: 'Score only: there are no stakes, chips or money.' },
      ] },
      { title: 'Classic, Tall Box and Daily', blocks: [
        { h: 'Classic Box' },
        { p: 'Tiles 1 to 9. Play one box after another; the lowest score you ever reached is saved as your best. Shutting the box is counted separately.' },
        { h: 'Tall Box' },
        { p: 'Tiles 1 to 12. Totals up to 12 can be made with a single tile, and the box is far harder to shut. The single-die rule applies when every open tile is 6 or lower.' },
        { h: 'Daily Box' },
        { p: 'One Classic box a day with the same dice for every player, so scores are comparable. Playing it keeps your streak going; it can be played once a day for the record, and as many times as you like for fun.' },
      ] },
      { title: 'Duel with the Innkeeper', blocks: [
        { p: 'A match of five rounds. In each round you play a full box, then the Innkeeper plays a full box with exactly the same dice order, so luck is even.' },
        { li: 'Each box is scored as above. Scores add up over the five rounds; the lower total wins the match.' },
        { li: 'A tie in the total is a draw.' },
        { li: 'Three levels: Friendly shuts the biggest tile it can and sometimes goes with its gut; Regular plays well but now and then picks the second-best move; Sharp always plays the best move. The level is chosen on the Duel button.' },
        { li: 'You can use Hint during a duel; it shows the solver\'s best move for you but your result is still your own.' },
      ] },
      { title: 'Hints, odds and Watch & Learn', blocks: [
        { h: 'The odds line' },
        { p: 'Under the dice you see the chance that your next roll can be played at all, and the best possible chance of shutting the box from the tiles that are open now.' },
        { h: 'Hint' },
        { p: 'Hint outlines the tiles the solver would shut. The solver is exact: it has worked out the lowest expected final score for every set of open tiles, and tells you the expected score of the best move and of the "shut the biggest tile" habit.' },
        { h: 'Watch & Learn' },
        { p: 'Auto Play plays whole Classic boxes with the solver. Each move goes Think, then Reveal (the legal tiles glow and the chosen ones are outlined), then Act. You can pause at any moment and set the think time to 2, 5, 8 or 10 seconds. Watched boxes never count toward your records.' },
      ] },
    ],
  },
  howto: {
    title: 'How to Play',
    pages: [
      { title: 'How to play', blocks: [
        { li: 'Tap the dice tray to roll two dice.' },
        { li: 'Tap open tiles that add up to the total. When they match, they flip down on their own.' },
        { li: 'Keep rolling and shutting. If no tiles can make the roll, the box is over and the tiles still open are your score.' },
        { li: 'Lower is better. Shut every tile for a perfect 0.' },
        { tiles: { n: 9, shut: [4, 5], sel: [] } },
        { li: 'When tiles 7, 8 and 9 are down you can roll a single die instead.' },
        { li: 'Stuck on a choice? Tap Hint to see the best move and why.' },
        { li: 'Duel the Innkeeper over five boxes, play the Daily Box, or just watch the solver play.' },
        { li: 'Rules has the complete guide with pictures.' },
      ] },
    ],
  },
  about: {
    title: 'About',
    pages: [
      { title: 'About Shut the Box', blocks: [
        { p: 'Shut the Box is an old tavern and family game from England and France, played with a hinged box of numbered tiles and two dice. It rewards a good eye for sums and a feel for risk.' },
        { tiles: { n: 9, shut: [1, 2, 3], sel: [] } },
        { li: 'Classic Box, Tall Box, a five-round Duel with the Innkeeper, a Daily Box and a Watch & Learn mode.' },
        { li: 'An exact solver behind the hints and the Innkeeper. Odds always visible.' },
        { li: 'Works offline, no ads, no clock. Calm mode reduces motion. Rules, How to Play and About zoom up to 300%.' },
        { li: 'Try it free for 90 seconds, then unlock the full game once. Restore purchase is on the unlock screen.' },
        { p: 'Made by Arcforge, World Heritage Games.' },
      ] },
    ],
  },
};

export const TIPS = [
  'Shutting the biggest tile first is a good habit, but not always the best move.',
  'Keep low tiles open for as long as you can: they make small totals playable.',
  '7 is the most common total. Tiles that make 7 (1+6, 2+5, 3+4, 7) are valuable.',
  'Two small tiles often beat one big tile when many high tiles are already shut.',
];
