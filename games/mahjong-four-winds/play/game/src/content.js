// Public text: How to play and About pages. Facts here are limited to what is well established; keep it that way.
export const HOW_PAGES = [
  { title: 'The goal', lines: [
    'Be the first to build a complete hand: four sets and a pair, fourteen tiles in all.',
  ] },
  { title: 'The goal (cont. 1)', lines: [
    'A CHOW is three tiles in a row from one suit (4-5-6 of Bamboo).',
  ] },
  { title: 'The goal (cont. 2)', lines: [
    'A PUNG is three identical tiles.',
    'A KONG is four identical tiles.',
  ] },
  { title: 'The goal (cont. 3)', lines: [
    'The pair is any two identical tiles.',
  ] },
  { title: 'The goal (cont. 4)', lines: [
    'Winds and dragons can make pungs and pairs, never chows.',
  ] },
  { title: 'Your turn', lines: [
    'You hold 13 tiles.',
    'On your turn you draw one and discard one.',
  ] },
  { title: 'Your turn (cont. 1)', lines: [
    'TAP a tile to lift it.',
    'TAP it again, or DRAG it upward, to discard it.',
  ] },
  { title: 'Your turn (cont. 2)', lines: [
    'Flowers and seasons are bonus tiles: they are set aside and you draw a replacement.',
  ] },
  { title: 'Your turn (cont. 3)', lines: [
    'Tap WHY? any time for a plain-words suggestion.',
  ] },
  { title: 'Your turn (cont. 4)', lines: [
    'On a computer: Left and Right choose, Enter or Space lifts and discards, H asks why.',
  ] },
  { title: 'Claiming a discard', lines: [
    'When another player discards, buttons appear if you can use that tile:',
  ] },
  { title: 'Claiming a discard (cont. 1)', lines: [
    'CHOW, PUNG, KONG or WIN!',
    'TAP the button you want, or TAP PASS.',
  ] },
  { title: 'Claiming a discard (cont. 2)', lines: [
    'A short timer runs (you can turn it off in Settings).',
    'Keys: C, P, K, W, X to pass.',
  ] },
  { title: 'Claiming a discard (cont. 3)', lines: [
    'WIN! beats PUNG and KONG, and those beat CHOW.',
  ] },
  { title: 'Claiming a discard (cont. 4)', lines: [
    'A chow may only be taken from the player before you.',
  ] },
  { title: 'Claiming a discard (cont. 5)', lines: [
    'A claimed set is shown face up, and then you must discard a tile.',
  ] },
  { title: 'Scoring', lines: [
    'A winning hand scores FAN for its patterns:',
  ] },
  { title: 'Scoring (cont. 1)', lines: [
    'an all-chow Common Hand, pungs of dragons or your wind, one suit, all pungs, and more.',
  ] },
  { title: 'Scoring (cont. 2)', lines: [
    'Drawing the winning tile yourself, or keeping the hand fully concealed, scores extra.',
  ] },
  { title: 'Scoring (cont. 3)', lines: [
    'Fan turn into points: 1 fan is 1 point, 3 fan is 4, 5 fan is 16 and 10 fan is a limit hand of 64.',
  ] },
  { title: 'Scoring (cont. 4)', lines: [
    'When a player wins on a discard, the discarder pays double.',
  ] },
  { title: 'Scoring (cont. 5)', lines: [
    'If the wall runs out, the hand is a draw.',
  ] },
  { title: 'Auto Play', lines: [
    'On the title screen, TAP Auto Play (free, silent) to watch a full hand play itself, seat by seat, every hand face-up.',
  ] },
  { title: 'Auto Play (cont. 1)', lines: [
    'It pauses before each discard so you can guess it yourself, then reveals and plays the tile it chose.',
  ] },
  { title: 'Auto Play (cont. 2)', lines: [
    'A stepper on that screen sets how long it pauses, from 2 to 10 seconds.',
  ] },
];

// Exhaustive rules reference. Every claim here is cross-checked against the actual implementation in
// rules.js (the single source of truth for legality and scoring) so this page can never contradict the
// engine. Describes the real Hong Kong-style ruleset this build plays - including what it leaves out
// (seven pairs, robbing a kong, dealer doubling) - never an idealised/textbook version. `tileRows` (when
// present) draws real tiles with the game's own tileByKind(), one row per group, with an optional caption.
// At the 300% text-size step this ruleset's length forces very granular single-sentence (sometimes
// single-clause) pages so nothing overlaps the panel/footer - see STATUS.md for the resulting page count.
export const RULE_PAGES = [
  { title: 'The tile set: three suits', lines: [
    'A full set has 144 tiles.',
  ],
    tileRows: [{tiles:[0,4,8],caption:"Characters (Wan): 1, 5, 9 shown"},{tiles:[9,13,17],caption:"Bamboo: 1, 5, 9 shown"},{tiles:[18,22,26],caption:"Dots: 1, 5, 9 shown"}] },
  { title: 'The tile set: three suits (cont. 1)', lines: [
    'Three number suits - Characters (also called Wan), Bamboo and Dots -',
  ] },
  { title: 'The tile set: three suits (cont. 2)', lines: [
    'each run 1 to 9, four copies of every tile:',
    '108 tiles in all.',
  ] },
  { title: 'The tile set: three suits (cont. 3)', lines: [
    'A sequence of three, three of a kind, or a pair can be built from any suit; only the pictures differ.',
  ] },
  { title: 'Honour tiles: winds and dragons', lines: [
    'Four winds and three dragons, four copies each, add 28 more tiles:',
  ],
    tileRows: [{tiles:[27,28,29,30],caption:"Winds: East, South, West, North"},{tiles:[31,32,33],caption:"Dragons: Red, Green, White"}] },
  { title: 'Honour tiles: winds and dragons (cont. 1)', lines: [
    'East, South, West and North;',
    'Red, Green and White dragons.',
  ] },
  { title: 'Honour tiles: winds and dragons (cont. 2)', lines: [
    'Honour tiles can only ever form a pung, a kong or a pair - never a chow.',
  ] },
  { title: 'Honour tiles: winds and dragons (cont. 3)', lines: [
    'A chow always needs three tiles in a row from a number suit.',
  ] },
  { title: 'Bonus tiles: flowers and seasons', lines: [
    'Eight bonus tiles complete the 144-tile set:',
  ],
    tileRows: [{tiles:[34,35,36,37],caption:"Flowers: Plum, Orchid, Chrysanthemum, Bamboo"},{tiles:[38,39,40,41],caption:"Seasons: Spring, Summer, Autumn, Winter"}] },
  { title: 'Bonus tiles: flowers and seasons (cont. 1)', lines: [
    'four flowers and four seasons, one copy of each - never four copies like the other tiles.',
  ] },
  { title: 'Bonus tiles: flowers and seasons (cont. 2)', lines: [
    'A bonus tile drawn into your hand is set aside at',
  ] },
  { title: 'Bonus tiles: flowers and seasons (cont. 3)', lines: [
    'once and you draw a replacement immediately.',
    'It is never kept as part of a set or discarded.',
  ] },
  { title: 'Bonus tiles: scoring your own', lines: [
    'Each flower and season is numbered 1 to 4.',
  ] },
  { title: 'Bonus tiles: scoring your own (cont. 1)', lines: [
    'Holding the one that matches your own seat number scores a fan (see Scoring,',
  ] },
  { title: 'Bonus tiles: scoring your own (cont. 2)', lines: [
    'a few pages on).',
  ] },
  { title: 'Chow, pung and kong', lines: [
    'A CHOW is three tiles in a row, all the same suit (4-5-6 of Bamboo, shown below).',
  ],
    tileRows: [{tiles:[12,13,14],caption:"CHOW - 4, 5, 6 of Bamboo"},{tiles:[22,22,22],caption:"PUNG - three 5 of Dots"},{tiles:[4,4,4,4],caption:"KONG - four 5 of Characters"}] },
  { title: 'Chow, pung and kong (cont. 1)', lines: [
    'Winds and dragons can never form a chow.',
  ] },
  { title: 'Chow, pung and kong (cont. 2)', lines: [
    'A PUNG is three identical tiles, of any suit or an honour tile.',
    'A KONG is four identical tiles.',
  ] },
  { title: 'Chow, pung and kong (cont. 3)', lines: [
    'Making one draws an extra replacement tile at once from the back of the wall, and',
  ] },
  { title: 'Chow, pung and kong (cont. 4)', lines: [
    'still counts as only one of your four sets.',
  ] },
  { title: 'The pair, and a complete hand', lines: [
    'The PAIR is any two identical tiles - a number, a wind or a dragon.',
  ],
    tileRows: [{tiles:[31,31],caption:"PAIR - two Red Dragons",tw:74}] },
  { title: 'The pair, and a complete hand (cont. 1)', lines: [
    'A complete winning hand is four sets (any mix of chow, pung and kong) plus one pair:',
  ] },
  { title: 'The pair, and a complete hand (cont. 2)', lines: [
    'fourteen tiles in all.',
    'The one exception is Thirteen Orphans,',
  ] },
  { title: 'The pair, and a complete hand (cont. 3)', lines: [
    'a special hand shape covered on the winning page.',
  ] },
  { title: 'The deal and your seat', lines: [
    'Each of the four players is dealt 13 tiles to start.',
    'You sit at seat 0, the bottom of the table;',
  ] },
  { title: 'The deal and your seat (cont. 1)', lines: [
    'turns run 0 -> 1 -> 2 -> 3 (seat 1 is on your right, seat 2 sits across, seat 3 is on your left).',
  ] },
  { title: 'The deal and your seat (cont. 2)', lines: [
    'Any bonus tile dealt into a starting hand is set aside and',
  ] },
  { title: 'The deal and your seat (cont. 3)', lines: [
    'replaced from the back of the wall before the first turn,',
    'the same as during play.',
  ] },
  { title: 'The deal and your seat (cont. 4)', lines: [
    'The dealer is called East and always plays first.',
  ] },
  { title: 'The deal and your seat (cont. 5)', lines: [
    'East can rotate between hands - see the last page.',
  ] },
  { title: 'Your turn: draw and discard', lines: [
    'On your turn you draw one tile, giving you 14.',
  ] },
  { title: 'Your turn: draw and discard (cont. 1)', lines: [
    'Drawing a bonus tile sets it aside at once and draws you a replacement,',
  ] },
  { title: 'Your turn: draw and discard (cont. 2)', lines: [
    'so you always draw down to a real playing tile.',
  ] },
  { title: 'Your turn: draw and discard (cont. 3)', lines: [
    'You then discard one tile from your full 14-tile hand, leaving 13 again.',
  ] },
  { title: 'Your turn: draw and discard (cont. 4)', lines: [
    'TAP a tile to lift it, then TAP it again - or DRAG it upward - to discard it.',
  ] },
  { title: 'Claiming a discard', lines: [
    'When a tile is discarded,',
  ] },
  { title: 'Claiming a discard (cont. 1)', lines: [
    'every other seat may claim it if it would complete a Win, a Pung, a Kong, or a Chow.',
  ] },
  { title: 'Claiming a discard (cont. 2)', lines: [
    'A Chow may only be claimed from the player immediately before you in turn order;',
  ] },
  { title: 'Claiming a discard (cont. 3)', lines: [
    'a Pung, a Kong or a Win can be claimed on a discard from any seat.',
  ] },
  { title: 'Claim priority', lines: [
    'Priority when more than one seat wants the same tile:',
  ] },
  { title: 'Claim priority (cont. 1)', lines: [
    'WIN beats PUNG and KONG, and both beat CHOW.',
  ] },
  { title: 'Claim priority (cont. 2)', lines: [
    'If more than one seat could make the same kind of claim,',
  ] },
  { title: 'Claim priority (cont. 3)', lines: [
    'the seat nearer after the discarder (in turn order) gets it.',
  ] },
  { title: 'Claim priority (cont. 4)', lines: [
    'A claimed set is shown face up (open) in front of that player,',
  ] },
  { title: 'Claim priority (cont. 5)', lines: [
    'who then discards a tile of their own.',
  ] },
  { title: 'Kong on your own turn', lines: [
    'You can also declare a Kong on your own turn from tiles already in your hand:',
  ] },
  { title: 'Kong on your own turn (cont. 1)', lines: [
    'a CONCEALED kong (all four copies already in hand) or an ADDED',
  ] },
  { title: 'Kong on your own turn (cont. 2)', lines: [
    'kong (the fourth tile added to a pung you have already shown).',
  ] },
  { title: 'Kong on your own turn (cont. 3)', lines: [
    'Either way you immediately draw a replacement tile',
  ] },
  { title: 'Kong on your own turn (cont. 4)', lines: [
    'from the back of the wall before discarding.',
  ] },
  { title: 'Kong on your own turn (cont. 5)', lines: [
    'This build does not let another player claim ("rob") the tile added to make an added kong -',
  ] },
  { title: 'Kong on your own turn (cont. 6)', lines: [
    'see the last page.',
  ] },
  { title: 'Declaring Mahjong (winning)', lines: [
    'You may declare a win the instant your hand is complete -',
  ] },
  { title: 'Declaring Mahjong (winning) (cont. 1)', lines: [
    'four sets and a pair, fourteen tiles -',
    'either by drawing the winning tile yourself, or',
  ] },
  { title: 'Declaring Mahjong (winning) (cont. 2)', lines: [
    'by claiming another player\'s discard as your final tile.',
  ] },
  { title: 'Declaring Mahjong (winning) (cont. 3)', lines: [
    'The one other winning shape is Thirteen Orphans:',
  ] },
  { title: 'Declaring Mahjong (winning) (cont. 4)', lines: [
    'one each of every terminal (1 and 9) tile and every honour tile -',
  ] },
  { title: 'Declaring Mahjong (winning) (cont. 5)', lines: [
    'thirteen different kinds - plus one more copy of any one of them.',
  ] },
  { title: 'Declaring Mahjong (winning) (cont. 6)', lines: [
    'This needs a hand with no declared sets at all, not even a concealed kong.',
  ] },
  { title: 'Reaching the minimum', lines: [
    'A complete hand alone is not enough to win:',
  ] },
  { title: 'Reaching the minimum (cont.)', lines: [
    'it must also reach the minimum fan set in Settings (next pages) before you may declare it.',
  ] },
  { title: 'Scoring: limit hands (10 fan)', lines: [
    'A limit hand scores the maximum 10 fan outright, whatever else it contains:',
  ] },
  { title: 'Scoring: limit hands (10 fan) (cont. 1)', lines: [
    'Thirteen Orphans.',
    'All Honours (every set and the pair are winds or dragons).',
  ] },
  { title: 'Scoring: limit hands (10 fan) (cont. 2)', lines: [
    'All Terminals (every set is a pung of 1s or 9s, no chows).',
  ] },
  { title: 'Scoring: limit hands (10 fan) (cont. 3)', lines: [
    'Great Four Winds (a pung of all four winds).',
  ] },
  { title: 'Scoring: limit hands (10 fan) (cont. 4)', lines: [
    'Small Four Winds (three wind pungs plus a wind pair).',
  ] },
  { title: 'Scoring: limit hands (10 fan) (cont. 5)', lines: [
    'Great Three Dragons (a pung of all three dragons).',
  ] },
  { title: 'Scoring: suits and pungs', lines: [
    'Small Three Dragons (two dragon pungs plus a pair of the third dragon): 5 fan.',
  ] },
  { title: 'Scoring: suits and pungs (cont. 1)', lines: [
    'Pure One Suit (every tile from a single suit, no honours): 7.',
  ] },
  { title: 'Scoring: suits and pungs (cont. 2)', lines: [
    'Mixed One Suit (one suit plus winds/dragons): 3.',
  ] },
  { title: 'Scoring: suits and pungs (cont. 3)', lines: [
    'All Pungs (four pungs or kongs and a pair, no chows): 3.',
  ] },
  { title: 'Scoring: suits and pungs (cont. 4)', lines: [
    'Common Hand (four chows and a pair that scores nothing by itself): 1.',
  ] },
  { title: 'Scoring: suits and pungs (cont. 5)', lines: [
    'A pung or kong of any dragon: 1 fan each.',
    'A pung of your own seat wind: 1.',
  ] },
  { title: 'Scoring: suits and pungs (cont. 6)', lines: [
    'A pung of the round wind (always East in this build): 1.',
  ] },
  { title: 'Scoring: flowers and win conditions', lines: [
    'Your own flower or season, numbered to match your seat: 1 fan each.',
  ] },
  { title: 'Scoring: flowers and win conditions (cont. 1)', lines: [
    'All four flowers: 2.',
    'All four seasons: 2.',
  ] },
  { title: 'Scoring: flowers and win conditions (cont. 2)', lines: [
    'Concealed hand, self-drawn (no set was ever claimed from a discard, and',
  ] },
  { title: 'Scoring: flowers and win conditions (cont. 3)', lines: [
    'you drew the winning tile yourself): 3.',
  ] },
  { title: 'Scoring: flowers and win conditions (cont. 4)', lines: [
    'Concealed hand only (same, but you won on a discard): 1.',
  ] },
  { title: 'Scoring: flowers and win conditions (cont. 5)', lines: [
    'Self-drawn with an open set on the table: 1.',
  ] },
  { title: 'Scoring: flowers and win conditions (cont. 6)', lines: [
    'Winning on a kong\'s replacement tile: 1.',
  ] },
  { title: 'Scoring: flowers and win conditions (cont. 7)', lines: [
    'Winning on the very last tile of the wall: 1.',
  ] },
  { title: 'Scoring: flowers and win conditions (cont. 8)', lines: [
    'Every pattern your hand actually contains adds up, capped at 10 fan (a limit hand).',
  ] },
  { title: 'Minimum fan and points', lines: [
    'A hand needs at least the minimum fan to be declared a win:',
    '1 fan by default, or',
  ] },
  { title: 'Minimum fan and points (cont. 1)', lines: [
    '3 fan (the traditional Hong Kong threshold) if you turn that on in Settings.',
  ] },
  { title: 'Minimum fan and points (cont. 2)', lines: [
    'Fan convert to points on this scale:',
  ] },
  { title: 'Minimum fan and points (cont. 3)', lines: [
    '1 fan = 1 point, 2 = 2, 3 = 4, 4 = 8, 5 = 16, 6 = 24, 7 = 32, 8 = 48, 9 = 64, 10 or more (a limit hand) = 64.',
  ] },
  { title: 'Minimum fan and points (cont. 4)', lines: [
    'Winning on a discard: the discarder alone pays double the points.',
  ] },
  { title: 'Minimum fan and points (cont. 5)', lines: [
    'Winning on your own draw: each of the other three players pays the points once.',
  ] },
  { title: 'Minimum fan and points (cont. 6)', lines: [
    'Score only - no stakes of any kind.',
  ] },
  { title: 'How a hand ends without a win, and the deal', lines: [
    'If nobody completes a legal winning hand before the wall runs low,',
  ] },
  { title: 'How a hand ends without a win, and the deal (cont. 1)', lines: [
    'the live wall stops once only the last 14 tiles remain:',
  ] },
  { title: 'How a hand ends without a win, and the deal (cont. 2)', lines: [
    'the hand ends in a draw, and the dealer stays East for the next hand.',
  ] },
  { title: 'How a hand ends without a win, and the deal (cont. 3)', lines: [
    'After a win, the dealer (East) stays for another hand only if East was the winner;',
  ] },
  { title: 'How a hand ends without a win, and the deal (cont. 4)', lines: [
    'otherwise the deal passes to the next seat, who becomes the new East.',
  ] },
  { title: 'How a hand ends without a win, and the deal (cont. 5)', lines: [
    '"East round" plays hands until the deal has rotated through all four seats, or',
  ] },
  { title: 'How a hand ends without a win, and the deal (cont. 6)', lines: [
    '8 hands have been played, whichever comes first.',
  ] },
  { title: 'How a hand ends without a win, and the deal (cont. 7)', lines: [
    '"Quick hand" is a single hand and then it is over.',
  ] },
  { title: 'What this build leaves out', lines: [
    'This is a friendly, teachable Hong Kong-style ruleset,',
  ] },
  { title: 'What this build leaves out (cont. 1)', lines: [
    'not every regional or tournament rule.',
    'Left out on purpose:',
  ] },
  { title: 'What this build leaves out (cont. 2)', lines: [
    'Seven Pairs is not a recognised winning shape here -',
  ] },
  { title: 'What this build leaves out (cont. 3)', lines: [
    'only four sets plus a pair, or Thirteen Orphans, can win.',
    'Robbing a Kong:',
  ] },
  { title: 'What this build leaves out (cont. 4)', lines: [
    'you cannot claim a tile as your winning tile when',
  ] },
  { title: 'What this build leaves out (cont. 5)', lines: [
    'another player adds it to make an added kong.',
    'Dealer doubling:',
  ] },
  { title: 'What this build leaves out (cont. 6)', lines: [
    'East\'s win pays and is paid at the very same rate as anyone else\'s -',
  ] },
  { title: 'What this build leaves out (cont. 7)', lines: [
    'no bonus multiplier for being the dealer.',
  ] },
  { title: 'What this build leaves out (cont. 8)', lines: [
    'Riichi (Japanese), Taiwanese, Sichuan,',
  ] },
  { title: 'What this build leaves out (cont. 9)', lines: [
    'American and other regional rule sets are different games, with their own scoring, and',
  ] },
  { title: 'What this build leaves out (cont. 10)', lines: [
    'are not implemented here.',
  ] },
];

export const ABOUT_PAGES = [
  { title: 'A game of four winds', lines: [
    'Mahjong is a tile game for four players.',
  ] },
  { title: 'A game of four winds (cont. 1)', lines: [
    'It took its modern form in China in the 1800s and is played today by families,',
  ] },
  { title: 'A game of four winds (cont. 2)', lines: [
    'friends and clubs in China, across the Chinese diaspora and far beyond.',
  ] },
  { title: 'A game of four winds (cont. 3)', lines: [
    'In the 1920s it became a craze in the United States and Europe, and',
  ] },
  { title: 'A game of four winds (cont. 4)', lines: [
    'many regions have kept their own rules ever since.',
  ] },
  { title: 'A game of four winds (cont. 5)', lines: [
    'Players sit at the four points of the compass and take turns as the East wind, the dealer.',
  ] },
  { title: 'A game of four winds (cont. 6)', lines: [
    'That is where "the four winds" comes from.',
  ] },
  { title: 'The tiles', lines: [
    'A full set has 144 tiles.',
  ] },
  { title: 'The tiles (cont. 1)', lines: [
    'Three suits (Dots, Bamboo and Characters) run from 1 to 9 in four copies each:',
  ] },
  { title: 'The tiles (cont. 2)', lines: [
    '108 tiles.',
    'Four winds and three dragons, four copies each, add 28 honour tiles.',
  ] },
  { title: 'The tiles (cont. 3)', lines: [
    'Eight bonus tiles, four flowers and four seasons, complete the set.',
  ] },
  { title: 'The tiles (cont. 4)', lines: [
    'In "Play in 中文" mode the Characters suit shows the tile number above the character 萬,',
  ] },
  { title: 'The tiles (cont. 5)', lines: [
    'which means "ten thousand".',
  ] },
  { title: 'The tiles (cont. 6)', lines: [
    'Choose "Play in English" in Settings for a number-and-letter tile set instead.',
  ] },
  { title: 'One game, many styles', lines: [
    'Hong Kong, Taiwanese, Sichuan,',
  ] },
  { title: 'One game, many styles (cont. 1)', lines: [
    'Japanese and American mahjong all share the same',
  ] },
  { title: 'One game, many styles (cont. 2)', lines: [
    'tiles and the same idea of sets and pairs, and',
    'differ in scoring and special rules.',
  ] },
  { title: 'One game, many styles (cont. 3)', lines: [
    'This game plays a friendly Hong Kong style:',
  ] },
  { title: 'One game, many styles (cont. 4)', lines: [
    'scoring in fan, no stakes of any kind, just points on the table.',
  ] },
  { title: 'One game, many styles (cont. 5)', lines: [
    'The tiles, the glyphs and the walls are drawn to look like a well-loved family set.',
  ] },
  { title: 'One game, many styles (cont. 6)', lines: [
    'Thank you for playing.',
  ] },
];