// Text for About, How to Play and the Rules reference. Every rule claim was checked against the engine: sim.js (board, physics,
// beds, chalks), match.js (rounds, turns, win, round limit), game.js (flow, gesture). Numbers: the board is 216 units wide, a
// bed is 27 units from line to line, a coin is 18 units across, so a coin has about 3.7 units to spare each way (7.4 in all).
// A section is { title, art?, p: [paragraphs] }.

export const ABOUT = [
  { title: 'An English pub game', art: 'board', p: [
    'Shove ha\'penny is a traditional English pub game. Coins are shoved with the heel of the hand up a smooth board marked with lines, and the aim is to stop each coin neatly between two lines, in a space called a bed.',
    'Its ancestors, shove-groat and shovel-board, were played in England in the 1400s and 1500s, and the game has been a fixture of pubs and clubs ever since, with leagues of its own.',
  ] },
  { title: 'A game of touch and nerve', p: [
    'A coin only counts if it lies wholly inside a bed, and a bed is only a little wider than a coin. Too soft and it stops short; too hard and it runs through or off the end. Coins already lying are both targets and obstacles: you can nudge your own coin on with the next one, or knock a rival\'s coin off its chalk.',
    'The nine beds must each be won three times, and a coin in a bed its owner has already filled works for the other side, so every coin is a decision as well as a shot.',
  ] },
  { title: 'This version', p: [
    'This version has a slate board with brass lines in lamplight, original coins, and honest sliding physics: friction, coin against coin, coins that fall off the edge. The same physics runs for you, the computer rivals and the ghost coin, so what you see is what happens.',
    'Play one of four computer rivals, share the phone with a friend, fill the beds in as few rounds as you can in Solo Run, or sit back with Watch & Learn and see why a skilled player picks each shot.',
  ] },
  { title: 'About the rules', p: [
    'Shove ha\'penny is played with small local variations. The version here is written out in full on the Rules page, including the parts that are this game\'s own way of playing (a round of five coins a side, the round limit and how a Solo Run is counted).',
  ] },
];

export const HOWTO = [
  { title: 'The idea', art: 'board', p: [
    'Shove coins up the board so each stops wholly inside one of the nine beds. Three coins in a bed win it for you. The first to fill nine beds wins the match (five in a Quick match).',
  ] },
  { title: 'Place the coin', art: 'place', p: [
    'Your coin waits on the near edge of the board, half hanging over it. Touch near the edge and drag sideways to put the coin where you want it.',
  ] },
  { title: 'Aim and shove', art: 'aim', p: [
    'Press on the board and drag up it: a marker rides a little above your fingertip and shows where the coin should stop, and a ghost coin shows what the physics will really do, including knocks against coins that are lying. Let go to shove. Let go near the edge instead to cancel.',
    'The small oval around the marker is the unsteadiness of the hand: the farther the coin must go, the more it can wander.',
  ] },
  { title: 'Chalks and beds', art: 'beds', p: [
    'A coin on a line, or partly off the board, is dead and is swept away. After all ten coins of a round (five a side, played alternately) the coins lying wholly in beds are counted: each one is a chalk, shown beside the board.',
  ] },
  { title: 'Full beds', art: 'chalks', p: [
    'Three chalks fill a bed. After that, further coins of yours in that bed count for your rival, if the rival has fewer than three there, so do not overshoot into a bed you have already won.',
  ] },
  { title: 'Nudges', art: 'nudge', p: [
    'Coins stay on the board through the round, so a coin lying just short of a bed can be pushed in by the next one, a coin in the way can block a rival, and a hard shot can knock a rival\'s coin out of its bed.',
    'The Hint button runs a skilled rival\'s thinking and shows where to place the coin and where to aim. On a keyboard: Left and Right place, A D W S move the marker, Space shoves, H gives a hint, P pauses.',
  ] },
];

export const RULES = [
  { title: 'Goal', art: 'board', p: [
    'Fill beds before your rival. A bed is filled by three chalks. A Full match is won by the first side to fill all nine beds; a Quick match by the first to fill five. Alone, in a Solo Run, you fill the beds in as few rounds as you can.',
  ] },
  { title: 'The board', p: [
    'The board is a slate, 216 units wide, with ten brass lines across it that make nine beds, each 27 units from line to line. Bed 1 is the nearest to you and bed 9 the farthest. A coin is 18 units across, so it fits a bed with about 3.7 units to spare each way. In front of bed 1 there is a blank run, and the coin starts on the near edge, half over it.',
  ] },
  { title: 'A round', p: [
    'A round is ten coins, five for each side, played one at a time with the sides alternating. The side that starts changes every round. In a Solo Run a round is five coins. You choose where on the edge the coin starts, and where it should stop; the strike supplies the speed.',
    'Coins that stay on the board stay there for the rest of the round, so later coins can hit them. After every coin the board is tidied: a coin that does not lie wholly in a bed is dead and swept away at once. A coin that crosses the far end or a side of the board falls off.',
  ] },
  { title: 'A coin that counts', art: 'beds', p: [
    'A coin counts when it lies wholly inside a bed: it must not touch either line, and it must be wholly on the board. A coin that touches a line is dead, even if only by a hair.',
  ] },
  { title: 'Chalks', art: 'chalks', p: [
    'When the tenth coin has come to rest the round is counted. The coins are taken in the order they were played. A coin gives its owner a chalk in its bed. If the owner already has three chalks there, the coin gives a chalk to the other side instead, if the other side has fewer than three; if both sides are full it is wasted. Then all coins are picked up and a new round begins.',
  ] },
  { title: 'Winning', p: [
    'The first side to have the target number of beds filled wins. If both reach it in the same round, the side whose chalk completed it first, in the order the coins were played, wins. After 24 rounds (30 in a Solo Run) the match stops: the side with more beds wins, then the side with more chalks; level means a draw.',
  ] },
  { title: 'Physics', art: 'nudge', p: [
    'A coin slows down at a steady rate and stops. Two coins that meet bounce off each other like billiard balls, and a struck coin passes on most of its speed. Nothing is random in the board itself: the same shove on the same board always does the same thing. Only the hand wobbles, a little more the longer the shove.',
    'The marker you set is where the coin would stop on a clear board. The ghost coin shows where it would stop with the coins that are really there. A few small differences from a real board: the beds here are a little wider than a coin\'s exact width so a phone fingertip can find them.',
  ] },
  { title: 'Rivals, Hint and Watch & Learn', p: [
    'The computer rivals work out their shoves with the same physics. Old Bert is gentle and unhurried, Dolly is quick and cheerful, Sergeant Pike likes to block and to knock your coins out, and Nan Hartley hardly errs.',
    'Hint shows what a skilled player would do. Watch & Learn lets two rivals play a Quick match with a thinking time you can change, a reveal of the chosen shove, and a Pause that freezes everything.',
  ] },
  { title: 'Simplified in this version', p: [
    'Real boards, coins and house rules vary from pub to pub. Here a round is counted after ten coins, any coin not wholly in a bed is swept away at once, and a coin that touches a line is always dead. Real play uses the heel of the hand; here the heel is a drag and a release.',
  ] },
];
