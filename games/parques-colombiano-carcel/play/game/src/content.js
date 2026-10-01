// Reference text for the How to Play, About and Rules screens. The pages are paginated automatically for the current text
// size (text.js paginate), so a section can be any length. EVERY rule claim below is cross-checked against rules.js (the
// single source of truth for legality) and the turn flow in game.js; see the "Rules reference" section of design/GDD.md.
// `art` names a picture drawn by view.js (drawRulesArt) with the game's own board and piece drawing.

export const HOW = [
  { h: 'Rolling the dice', art: 'dice', p: [
    'On your turn TAP the dice tray, or SWIPE up across it. Keyboard: Space or Enter.',
    'You roll two dice. Each die is its own move.',
  ] },
  { h: 'Spending the dice', p: [
    'TAP a die to pick it, then TAP one of your glowing pieces to preview where it lands. TAP the piece again to move it.',
    'Then spend the other die on the same piece or another. A die nobody can use is lost.',
    'Keyboard: D switches die, the arrow keys choose a piece, Space confirms.',
  ] },
  { h: 'Getting out of the cárcel', art: 'jail', p: [
    'All four of your pieces start in the cárcel (jail). Only a PAIR, two equal dice, frees a piece. Each die of the pair frees one.',
    'With no piece on the board you get three tries per turn to roll a pair.',
  ] },
  { h: 'Salida and seguros', art: 'safe', p: [
    'Your salida is where freed pieces appear. A piece on a salida or a gold seguro cannot be captured.',
    'But freeing a piece captures any rival waiting on your salida!',
  ] },
  { h: 'Captures and barriers', art: 'capture', p: [
    'Land exactly on a lone rival outside a safe square and it goes back to its cárcel.',
    'Two of your pieces on one square make a barrier: rivals can neither land on it nor pass it.',
  ] },
  { h: 'Pairs and penalties', p: [
    'A pair gives you another roll. Three pairs in a row: your most advanced piece on the track goes back to the cárcel.',
  ] },
  { h: 'Going home', art: 'corona', p: [
    'Race anticlockwise round the whole track, then up your own coloured lane to the corona in the centre. The last step needs an exact die.',
    'First to bring all four pieces home wins.',
  ] },
  { h: 'Hint and Auto Play', p: [
    'The Hint button shows what the computer would play, and why. It is free and unlimited.',
    'Auto Play (Watch & Learn) on the menu plays a whole game by itself so you can see the rules at work. You can pause it any time.',
  ] },
];

export const ABOUT = [
  { h: 'About Parqués', p: [
    'Parqués is Colombia\'s version of the pachisi family: cross-shaped board games where pieces race round a track and home, decided by throws of dice or shells.',
    'The name is a Spanish form of the Hindi word pachisi. Its relatives include Ludo, the Spanish parchís and the original pachisi of India, and many other cross-and-circle race games around the world.',
  ] },
  { h: 'In Colombian homes', p: [
    'Parqués is a familiar family and gathering game in Colombia, played at kitchen tables on a printed or wooden board, with two dice and four coloured pieces for each player.',
    'Its own spirit comes from the cárcel (jail) that pieces start in and fall back to, the pair of dice that opens the door, and the playful tension of captures and barriers.',
  ] },
  { h: 'House rules', p: [
    'Like every family game, parqués is played a little differently from home to home. This game follows common Colombian practice and writes down exactly what it plays on its Rules pages: nothing hidden, nothing assumed.',
  ] },
  { h: 'This version', p: [
    'Play against one to three computer opponents with different personalities, share one phone with two to four friends in pass-and-play, ask for a Hint whenever you like, or watch a whole game with Auto Play.',
    'The board borrows the colours of Colombian textiles. Every colour has its own emblem on the pieces: disc, diamond, triangle and star.',
    'Text size can be raised to 300% in Settings and on every reading page.',
  ] },
];

export const RULES = [
  { h: 'The board', art: 'board', p: [
    'Parqués is played on a cross of four arms around a centre square. Each arm is three squares wide and eight squares long.',
    'The outer track runs round the edge of the cross: 68 squares in all, 17 on each arm. Every piece travels it anticlockwise.',
    'The middle column of each arm is not part of the outer track. It is that colour\'s home lane.',
  ] },
  { h: 'Seats and pieces', art: 'pieces', p: [
    'Two players use opposite arms (Yellow at the bottom, Red at the top). Three players use Yellow, Blue and Red. Four players use all four arms: Yellow, Blue, Red and Green.',
    'Each player has four pieces. Each colour wears its own emblem on top (a disc, a diamond, a triangle or a star), so colour is never the only way to tell them apart.',
    'Turns pass anticlockwise: Yellow, then Blue, then Red, then Green. Yellow always plays first. Against the computer you are Yellow. In pass-and-play every seat is a person sharing the phone.',
  ] },
  { h: 'The cárcel', art: 'jail', p: [
    'Every piece starts in the cárcel: the barred corner next to its owner\'s salida. A captured piece returns there too.',
    'A piece in the cárcel cannot move on an ordinary roll. It leaves only when its owner rolls a pair (see Pairs).',
  ] },
  { h: 'Salida and seguros', art: 'safe', p: [
    'Each colour has a salida: its start square, marked with a white star on a square of its own colour. It is the first square after the tip of its own arm.',
    'Each arm also has one seguro, a gold roundel. There are eight safe squares in all: four salidas and four seguros.',
    'A piece standing on a safe square can never be captured by landing, and pieces of any colour may share a safe square.',
    'The only way to capture on a safe square is the free-from-the-cárcel capture described under Freeing a piece.',
  ] },
  { h: 'Rolling two dice', art: 'dice', p: [
    'On your turn you roll two dice. Each die is a separate move of its own.',
    'Pick one die and one piece: that piece moves exactly that many squares. Then spend the other die the same way, on the same piece or on a different one.',
    'You cannot add the two dice into one jump. Moving one piece with both dice is two hops, and anything that happens on the first landing square (a capture, for instance) really happens.',
    'You choose which die to play first. If any piece can legally use a die you must use it; if no piece can, that die is simply lost.',
  ] },
  { h: 'Pairs', art: 'pair', p: [
    'A pair means both dice show the same number. A pair is special in two ways.',
    'First, each die of a pair can free one piece from the cárcel instead of moving a piece, so one pair can free up to two pieces.',
    'Second, after you finish moving you roll again. This applies even if you could not use the dice at all.',
  ] },
  { h: 'Freeing a piece', art: 'jailfree', p: [
    'A freed piece is placed on its owner\'s salida. This uses one die of a pair; the number on the die does not matter.',
    'If rival pieces are standing on your salida when you free a piece, they are all captured and sent to their own cárcel, even though a salida is a safe square.',
    'Any number of your own pieces may stand on your own salida.',
  ] },
  { h: 'Three tries', p: [
    'While none of your pieces is on the board (every unfinished piece is in the cárcel) you get up to three rolls on your turn to find a pair.',
    'If a roll is not a pair, nothing can move and you roll again, up to three rolls in all. After the third miss the turn passes.',
    'A pair freed pieces and you carry on as normal, including the extra roll that a pair earns.',
  ] },
  { h: 'Three pairs in a row', p: [
    'If you roll a pair three times in a row during one turn, the third roll does not count.',
    'Instead your most advanced piece that is still on the outer track goes back to the cárcel, and your turn ends. A piece already in its home lane or on the corona is safe from this penalty. If you have no piece on the outer track, nothing is lost.',
  ] },
  { h: 'Moving a piece', p: [
    'Once on the board a piece moves forward, anticlockwise, the exact number of squares on the die you chose, one square at a time.',
    'It may pass over rival pieces and over its own pieces. It may not pass over, or land on, a rival barrier (see Barriers).',
    'Each piece travels the whole outer track: from its own salida round to the tip of its own arm (68 squares), then turns up its own home lane.',
  ] },
  { h: 'Barriers', art: 'barrier', p: [
    'Two pieces of the same colour on the same square, which is not a salida or seguro, form a barrier.',
    'A rival piece can neither land on a barrier nor pass over it: any move that would do so is refused. Your own pieces may pass over your own barrier.',
    'At most two of your pieces may share an ordinary square: a third cannot land there.',
    'Barriers never form on a salida or a seguro, because every piece is safe there already.',
  ] },
  { h: 'Captures', art: 'capture', p: [
    'If a piece lands exactly on a square holding a single rival piece, and the square is not a salida or a seguro, the rival piece is captured. It goes back to its owner\'s cárcel and must wait for a pair again.',
    'A capture earns no extra move of its own. Its reward is that the rival loses everything that piece had travelled.',
    'You can capture with either die, including the second die of a pair or the first of a split roll.',
    'Two rivals of one colour on a square are a barrier and cannot be captured at all.',
  ] },
  { h: 'The home lane', art: 'lane', p: [
    'After the 68 squares of the outer track a piece turns up the seven-square home lane of its own colour, which runs from the tip of its arm to the centre.',
    'Only its owner\'s pieces ever stand in a home lane, so nothing can be captured or blocked there.',
  ] },
  { h: 'The corona', art: 'corona', p: [
    'The centre is the corona, the finish. From its salida a piece needs 75 squares in all: 68 on the outer track, 7 up the home lane, and the final step onto the corona.',
    'A piece must reach the corona with an exact count. A die that would carry it past the corona cannot be used by that piece.',
    'Two dice on the same piece can finish the journey in two hops. A piece on the corona is finished and stays there.',
  ] },
  { h: 'Winning', p: [
    'The first player to bring all four pieces onto the corona wins at once, even if others still have pieces on the board.',
    'The remaining players are ranked afterwards by how many pieces they got home, then by how far the rest had travelled.',
    'There is no draw: play continues until someone wins. (A game that somehow lasted 2,000 turns would end with the same ranking.)',
  ] },
  { h: 'When nothing can move', p: [
    'If neither die can be used, the dice are lost and the turn passes, unless you rolled a pair, in which case you roll again.',
    'The message on screen names the most useful reason.',
  ] },
  { h: 'Why a move is refused', p: [
    'The reasons a piece cannot move, in the order the game checks them:',
    'A rival barrier sits on the square it would land on, or on one it would pass over.',
    'Two of your own pieces already stand on the ordinary square it would land on.',
    'The die is bigger than the squares left to the corona.',
    'The piece is in the cárcel and the dice are not a pair.',
    'TAP any piece that cannot move and it shakes, and the message says exactly why.',
  ] },
];
