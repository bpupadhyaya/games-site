// Public text: How to play and About pages. Facts here are limited to what is well established; keep it that way.
export const HOW_PAGES = [
  { title: 'The goal', lines: [
    'Be the first to build a complete hand: four sets and a pair, fourteen tiles in all.',
    'A CHOW is three tiles in a row from one suit (4-5-6 of Bamboo).',
    'A PUNG is three identical tiles. A KONG is four identical tiles.',
    'The pair is any two identical tiles. Winds and dragons can make pungs and pairs, never chows.'] },
  { title: 'Your turn', lines: [
    'You hold 13 tiles. On your turn you draw one and discard one.',
    'TAP a tile to lift it. TAP it again, or DRAG it upward, to discard it.',
    'Flowers and seasons are bonus tiles: they are set aside and you draw a replacement.',
    'Tap WHY? any time for a plain-words suggestion. On a computer: Left and Right choose, Enter or Space lifts and discards, H asks why.'] },
  { title: 'Claiming a discard', lines: [
    'When another player discards, buttons appear if you can use that tile: CHOW, PUNG, KONG or WIN!',
    'TAP the button you want, or TAP PASS. A short timer runs (you can turn it off in Settings). Keys: C, P, K, W, X to pass.',
    'WIN! beats PUNG and KONG, and those beat CHOW. A chow may only be taken from the player before you.',
    'A claimed set is shown face up, and then you must discard a tile.'] },
  { title: 'Scoring', lines: [
    'A winning hand scores FAN for its patterns: an all-chow Common Hand, pungs of dragons or your wind, one suit, all pungs, and more.',
    'Drawing the winning tile yourself, or keeping the hand fully concealed, scores extra.',
    'Fan turn into points: 1 fan is 1 point, 3 fan is 4, 5 fan is 16 and 10 fan is a limit hand of 64.',
    'When a player wins on a discard, the discarder pays double. If the wall runs out, the hand is a draw.'] },
];

// Exhaustive rules reference. Every claim here is cross-checked against the actual implementation in
// rules.js (the single source of truth for legality and scoring) so this page can never contradict the
// engine. Describes the real Hong Kong-style ruleset this build plays - including what it leaves out
// (seven pairs, robbing a kong, dealer doubling) - never an idealised/textbook version. `tileRows` (when
// present) draws real tiles with the game's own tileByKind(), one row per group, with an optional caption.
export const RULE_PAGES = [
  { title: 'The tile set: three suits', lines: [
    'A full set has 144 tiles. Three number suits - Characters (also called Wan), Bamboo and Dots - each run 1 to 9, four copies of every tile: 108 tiles in all.',
    'A sequence of three, three of a kind, or a pair can be built from any suit; only the pictures differ.'],
    tileRows: [
      { tiles: [0, 4, 8], caption: 'Characters (Wan): 1, 5, 9 shown' },
      { tiles: [9, 13, 17], caption: 'Bamboo: 1, 5, 9 shown' },
      { tiles: [18, 22, 26], caption: 'Dots: 1, 5, 9 shown' },
    ] },
  { title: 'Honour tiles: winds and dragons', lines: [
    'Four winds and three dragons, four copies each, add 28 more tiles: East, South, West and North; Red, Green and White dragons.',
    'Honour tiles can only ever form a pung, a kong or a pair - never a chow. A chow always needs three tiles in a row from a number suit.'],
    tileRows: [
      { tiles: [27, 28, 29, 30], caption: 'Winds: East, South, West, North' },
      { tiles: [31, 32, 33], caption: 'Dragons: Red, Green, White' },
    ] },
  { title: 'Bonus tiles: flowers and seasons', lines: [
    'Eight bonus tiles complete the 144-tile set: four flowers and four seasons, one copy of each - never four copies like the other tiles.',
    'A bonus tile drawn into your hand is set aside at once and you draw a replacement immediately. It is never kept as part of a set or discarded.'],
    tileRows: [
      { tiles: [34, 35, 36, 37], caption: 'Flowers: Plum, Orchid, Chrysanthemum, Bamboo' },
      { tiles: [38, 39, 40, 41], caption: 'Seasons: Spring, Summer, Autumn, Winter' },
    ] },
  { title: 'Bonus tiles: scoring your own', lines: [
    'Each flower and season is numbered 1 to 4. Holding the one that matches your own seat number scores a fan (see Scoring, a few pages on).'] },
  { title: 'Chow, pung and kong', lines: [
    'A CHOW is three tiles in a row, all the same suit (4-5-6 of Bamboo, shown below). Winds and dragons can never form a chow.',
    'A PUNG is three identical tiles, of any suit or an honour tile.',
    'A KONG is four identical tiles. Making one draws an extra replacement tile at once from the back of the wall, and still counts as only one of your four sets.'],
    tileRows: [
      { tiles: [12, 13, 14], caption: 'CHOW - 4, 5, 6 of Bamboo' },
      { tiles: [22, 22, 22], caption: 'PUNG - three 5 of Dots' },
      { tiles: [4, 4, 4, 4], caption: 'KONG - four 5 of Characters' },
    ] },
  { title: 'The pair, and a complete hand', lines: [
    'The PAIR is any two identical tiles - a number, a wind or a dragon.',
    'A complete winning hand is four sets (any mix of chow, pung and kong) plus one pair: fourteen tiles in all.',
    'The one exception is Thirteen Orphans, a special hand shape covered on the winning page.'],
    tileRows: [{ tiles: [31, 31], caption: 'PAIR - two Red Dragons', tw: 74 }] },
  { title: 'The deal and your seat', lines: [
    'Each of the four players is dealt 13 tiles to start. You sit at seat 0, the bottom of the table; turns run 0 -> 1 -> 2 -> 3 (seat 1 is on your right, seat 2 sits across, seat 3 is on your left).',
    'Any bonus tile dealt into a starting hand is set aside and replaced from the back of the wall before the first turn, the same as during play.',
    'The dealer is called East and always plays first. East can rotate between hands - see the last page.'] },
  { title: 'Your turn: draw and discard', lines: [
    'On your turn you draw one tile, giving you 14. Drawing a bonus tile sets it aside at once and draws you a replacement, so you always draw down to a real playing tile.',
    'You then discard one tile from your full 14-tile hand, leaving 13 again. TAP a tile to lift it, then TAP it again - or DRAG it upward - to discard it.'] },
  { title: 'Claiming a discard', lines: [
    'When a tile is discarded, every other seat may claim it if it would complete a Win, a Pung, a Kong, or a Chow.',
    'A Chow may only be claimed from the player immediately before you in turn order; a Pung, a Kong or a Win can be claimed on a discard from any seat.'] },
  { title: 'Claim priority', lines: [
    'Priority when more than one seat wants the same tile: WIN beats PUNG and KONG, and both beat CHOW. If more than one seat could make the same kind of claim, the seat nearer after the discarder (in turn order) gets it.',
    'A claimed set is shown face up (open) in front of that player, who then discards a tile of their own.'] },
  { title: 'Kong on your own turn', lines: [
    'You can also declare a Kong on your own turn from tiles already in your hand: a CONCEALED kong (all four copies already in hand) or an ADDED kong (the fourth tile added to a pung you have already shown).',
    'Either way you immediately draw a replacement tile from the back of the wall before discarding.',
    'This build does not let another player claim ("rob") the tile added to make an added kong - see the last page.'] },
  { title: 'Declaring Mahjong (winning)', lines: [
    'You may declare a win the instant your hand is complete - four sets and a pair, fourteen tiles - either by drawing the winning tile yourself, or by claiming another player\'s discard as your final tile.',
    'The one other winning shape is Thirteen Orphans: one each of every terminal (1 and 9) tile and every honour tile - thirteen different kinds - plus one more copy of any one of them. This needs a hand with no declared sets at all, not even a concealed kong.'] },
  { title: 'Reaching the minimum', lines: [
    'A complete hand alone is not enough to win: it must also reach the minimum fan set in Settings (next pages) before you may declare it.'] },
  { title: 'Scoring: limit hands (10 fan)', lines: [
    'A limit hand scores the maximum 10 fan outright, whatever else it contains:',
    'Thirteen Orphans. All Honours (every set and the pair are winds or dragons). All Terminals (every set is a pung of 1s or 9s, no chows). Great Four Winds (a pung of all four winds). Small Four Winds (three wind pungs plus a wind pair). Great Three Dragons (a pung of all three dragons).'] },
  { title: 'Scoring: suits and pungs', lines: [
    'Small Three Dragons (two dragon pungs plus a pair of the third dragon): 5 fan. Pure One Suit (every tile from a single suit, no honours): 7. Mixed One Suit (one suit plus winds/dragons): 3. All Pungs (four pungs or kongs and a pair, no chows): 3.',
    'Common Hand (four chows and a pair that scores nothing by itself): 1. A pung or kong of any dragon: 1 fan each. A pung of your own seat wind: 1. A pung of the round wind (always East in this build): 1.'] },
  { title: 'Scoring: flowers and win conditions', lines: [
    'Your own flower or season, numbered to match your seat: 1 fan each. All four flowers: 2. All four seasons: 2.',
    'Concealed hand, self-drawn (no set was ever claimed from a discard, and you drew the winning tile yourself): 3. Concealed hand only (same, but you won on a discard): 1. Self-drawn with an open set on the table: 1.',
    'Winning on a kong\'s replacement tile: 1. Winning on the very last tile of the wall: 1. Every pattern your hand actually contains adds up, capped at 10 fan (a limit hand).'] },
  { title: 'Minimum fan and points', lines: [
    'A hand needs at least the minimum fan to be declared a win: 1 fan by default, or 3 fan (the traditional Hong Kong threshold) if you turn that on in Settings.',
    'Fan convert to points on this scale: 1 fan = 1 point, 2 = 2, 3 = 4, 4 = 8, 5 = 16, 6 = 24, 7 = 32, 8 = 48, 9 = 64, 10 or more (a limit hand) = 64.',
    'Winning on a discard: the discarder alone pays double the points. Winning on your own draw: each of the other three players pays the points once. Score only - no stakes of any kind.'] },
  { title: 'How a hand ends without a win, and the deal', lines: [
    'If nobody completes a legal winning hand before the wall runs low, the live wall stops once only the last 14 tiles remain: the hand ends in a draw, and the dealer stays East for the next hand.',
    'After a win, the dealer (East) stays for another hand only if East was the winner; otherwise the deal passes to the next seat, who becomes the new East.',
    '"East round" plays hands until the deal has rotated through all four seats, or 8 hands have been played, whichever comes first. "Quick hand" is a single hand and then it is over.'] },
  { title: 'What this build leaves out', lines: [
    'This is a friendly, teachable Hong Kong-style ruleset, not every regional or tournament rule. Left out on purpose:',
    'Seven Pairs is not a recognised winning shape here - only four sets plus a pair, or Thirteen Orphans, can win.',
    'Robbing a Kong: you cannot claim a tile as your winning tile when another player adds it to make an added kong.'] },
  { title: 'What this build leaves out (cont.)', lines: [
    'Dealer doubling: East\'s win pays and is paid at the very same rate as anyone else\'s - no bonus multiplier for being the dealer.',
    'Riichi (Japanese), Taiwanese, Sichuan, American and other regional rule sets are different games, with their own scoring, and are not implemented here.'] },
];

export const ABOUT_PAGES = [
  { title: 'A game of four winds', lines: [
    'Mahjong is a tile game for four players. It took its modern form in China in the 1800s and is played today by families, friends and clubs in China, across the Chinese diaspora and far beyond.',
    'In the 1920s it became a craze in the United States and Europe, and many regions have kept their own rules ever since.',
    'Players sit at the four points of the compass and take turns as the East wind, the dealer. That is where "the four winds" comes from.'] },
  { title: 'The tiles', lines: [
    'A full set has 144 tiles. Three suits (Dots, Bamboo and Characters) run from 1 to 9 in four copies each: 108 tiles.',
    'Four winds and three dragons, four copies each, add 28 honour tiles. Eight bonus tiles, four flowers and four seasons, complete the set.',
    'In "Play in 中文" mode the Characters suit shows the tile number above the character 萬, which means "ten thousand". Choose "Play in English" in Settings for a number-and-letter tile set instead.'] },
  { title: 'One game, many styles', lines: [
    'Hong Kong, Taiwanese, Sichuan, Japanese and American mahjong all share the same tiles and the same idea of sets and pairs, and differ in scoring and special rules.',
    'This game plays a friendly Hong Kong style: scoring in fan, no stakes of any kind, just points on the table.',
    'The tiles, the glyphs and the walls are drawn to look like a well-loved family set. Thank you for playing.'] },
];
