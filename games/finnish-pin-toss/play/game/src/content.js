// Text for About, How to Play and the Rules reference. Every rule claim was checked against the engine: sim.js (flight,
// bodies, toppling, standing up), match.js (points, the 50 rule, misses, turns, the cap), game.js (gesture mapping, flow).
// Numbers: skittles are 6 cm across and 15 cm long, the pin is 6 cm across and 22 cm long; the throw line is 3.5 m from
// the front row; the rope field is 250 cm wide and runs 100 cm in front of and 150 cm behind the middle of the bundle.
// A section is { title, art?, p: [paragraphs] }.

export const ABOUT = [
  { title: 'A summer game from Finland', art: 'cluster', p: [
    'Finnish pin toss is a throwing game played on lawns, beaches and cottage yards in Finland. Twelve wooden skittles, each marked with a number, stand tightly together. From a line a few metres away you throw a wooden pin underhand to knock them down.',
    'One skittle down scores its number; several down score how many fell. The first to land on exactly 50 wins, and going over sends you back to 25. A modern brand-name version of this traditional Finnish pastime is sold around the world; this is an independent game of the pastime itself.',
  ] },
  { title: 'Nerve and arithmetic', p: [
    'Knocking over many skittles is easy; knocking over exactly the right ones is not. Close to 50 the game turns into a puzzle: the 7 alone, or seven skittles at once? Safe and gentle, or fast and risky?',
    'After every throw the skittles are stood up again where they landed, so the lawn changes: numbers get isolated, bundled, pushed to the rope. A good thrower reads that lawn before throwing.',
  ] },
  { title: 'This version', p: [
    'This version sets the game on a lakeside lawn on a summer evening. The pin flies in a real arc, lands and skids, and toppled skittles slide into their neighbours with honest rigid-body physics, so chains happen the way you would expect.',
    'Play one of four computer rivals, share the phone with friends, practise alone, or sit back with Watch & Learn and see why a skilled player picks each throw. The scorecard keeps the 50 rule in front of you.',
  ] },
  { title: 'Credits', p: [
    '3D layer: the people are derived from avatars of the Microsoft Rocketbox Avatar Library (MIT licence, Copyright (c) 2020 Microsoft). Motion data from the Quaternius Universal Animation Library (CC0) and the Carnegie Mellon University Graphics Lab Motion Capture Database. Rendering uses three.js (MIT). Typeface: Fredoka (SIL Open Font Licence). Full licence texts ship with the game in vendor3d/LICENSES.md.',
  ] },
  { title: 'About the rules', p: [
    'Local rules vary from yard to yard. The version here is written out in full on the Rules page, including the parts that are this game\'s own way of playing (the fixed throw line, the rope field and the marathon limit).',
  ] },
];

export const HOWTO = [
  { title: 'The idea', art: 'cluster', p: [
    'Knock down skittles with the pin. One skittle scores its number (the 7 scores 7). Two or more score how many fell (four skittles score 4). Land on exactly 50.',
  ] },
  { title: 'Pull back and let go', art: 'pull', p: [
    'Press anywhere on the lawn and pull straight down, like drawing a sling. The farther you pull, the harder and farther the pin goes. Pull a little to the left and the pin goes right, and the other way round.',
    'A white dotted arc and a ring show where the pin will land. Let go to throw. If you change your mind, let go with only a short pull and nothing is thrown.',
  ] },
  { title: 'Hold still for a steady hand', p: [
    'Your hand shakes a little. While you hold your finger still the ring shrinks, down to about a quarter of its size, and turns gold when you are steady. A smaller ring means the pin lands closer to where the ring says.',
    'Moving your finger makes the ring grow again, so pull to roughly the right place first, then hold still and let go.',
  ] },
  { title: 'Choose how to throw', art: 'styles', p: [
    'Lob goes high and lands gently: good for picking out one skittle. Skim goes low and fast and drives through the bundle: good for taking several.',
    'End over end lands the pin lengthwise: a narrow hit. Flat spin lands it broadside and spinning: it sweeps a wide path but is harder to predict. The two switches sit on the lawn below the skittles.',
  ] },
  { title: 'Count it up', art: 'rule50', p: [
    'Your card at the top shows your score, a bar towards 50 with a mark at 25, and your misses. Close to the end the line above the lawn tells you what you need.',
    'Over 50 and you drop back to 25. Aim to finish with exactly the right skittle, or the right number of skittles.',
  ] },
  { title: 'Misses and the hint', art: 'misses', p: [
    'Missing everything is a miss. Three misses in a row and you are out, so a safe throw that touches one skittle is sometimes the best throw.',
    'Hint shows what a skilled rival would do: the gold ring is where to land, and the switches change to the right style. The Scorecard button lists every throw of every player with the totals.',
  ] },
];

export const RULES = [
  { title: '1. The goal', p: [
    'Be the first player whose score is exactly 50. In a Short match the target is exactly 30. Your score only goes up by what you knock down, so the game is about hitting the right number, not the biggest number.',
  ] },
  { title: '2. The skittles and the set-up', art: 'cluster', p: [
    'There are twelve skittles numbered 1 to 12, each 6 cm across and 15 cm long. They start standing upright in a tight bundle of four rows: 1 and 2 in front (nearest the thrower), then 3, 10 and 4, then 5, 11, 12 and 6, and 7, 9 and 8 at the back. They touch each other.',
    'The pin is 6 cm across and 22 cm long. The throw line is 3.5 m in front of the bundle and stays in the same place for the whole match; every player throws from it.',
  ] },
  { title: '3. A throw', art: 'pull', p: [
    'On your turn you throw the pin once, underhand. In this game you press on the lawn and pull straight down: the pull length sets the throwing speed and the sideways offset of the pull sets the direction (pull to the left and the pin goes to the right).',
    'The pin flies in an arc and lands. The ring on the lawn shows the landing spot the arc leads to. Your hand is not perfect: the pin lands within the ring about two times in three at its widest; holding still shrinks the ring to about 28 percent. Releasing after a very short pull throws nothing.',
  ] },
  { title: '4. Lob or skim, end over end or flat', art: 'styles', p: [
    'Lob throws on a steep 62 degree arc: the pin comes down fairly gently and skids a short way. Skim throws on a flat 28 degree arc: the same strength lands at the same place, but the pin comes in fast and carries a long way through the bundle.',
    'End over end makes the pin land lengthwise along its line of flight (with a small random turn). Flat spin makes it land spinning broadside, at a turn that is not under your control, so it can sweep in unexpected ways.',
  ] },
  { title: '5. Knocking skittles down', p: [
    'When the pin lands and slides it can hit standing skittles. A skittle that is struck hard enough tips over, slides and turns, and can knock others. A touch that is too gentle only bounces the pin away and the skittle stays standing. Toppled skittles that touch other skittles can tip those too, so chains happen.',
    'A skittle counts as knocked down if it fell over at any time during the throw, even if it slides to rest far away.',
  ] },
  { title: '6. Counting', art: 'scoring', p: [
    'If no skittle fell, the throw is a miss and scores nothing. If exactly one skittle fell, you score its number. If two or more fell, you score the count of fallen skittles, whatever their numbers are.',
    'Your score changes by exactly that amount. Examples: knocking only the 9 scores 9; knocking the 3, 12 and 5 together scores 3.',
  ] },
  { title: '7. Standing them up', p: [
    'When everything stops, every fallen skittle is stood up where it came to rest, in the middle of where it lay. Skittles that overlap after standing up are moved apart until they are separate.',
    'The playing field is marked by a rope: 125 cm to the left and right of the bundle\'s middle, 100 cm in front and 150 cm behind it. A skittle that comes to rest beyond the rope is stood up on the rope instead. Skittles that were not knocked down stay exactly where they were.',
  ] },
  { title: '8. Misses and being out', art: 'misses', p: [
    'Every miss adds one to your run of misses; any throw that knocks at least one skittle sets the run back to zero. A player with three misses in a row is out of the match and takes no more turns.',
    'The little dots on your card show your run of misses.',
  ] },
  { title: '9. The 50 rule', art: 'rule50', p: [
    'The target is 50 (30 in a Short match). If your throw takes your score exactly to the target, you win at once.',
    'If it takes your score above the target, your score drops back to half the target, which is 25 (15 in a Short match). It can be a better throw to hit one low skittle than to scatter the bundle.',
  ] },
  { title: '10. Winning and turns', p: [
    'Players take turns in a fixed order; a match starts with a random player. Out players are skipped. The match ends when someone reaches the exact target, or when only one player is left in the game, and that player wins.',
    'Marathon limit: if no one has finished after 40 turns each, the match ends and the highest score among the players still in wins; equal scores are a draw.',
    'In Solo Practice you play alone: the run ends when you land exactly on the target, or after three misses in a row. Your record is the fewest throws.',
  ] },
  { title: '11. Computer rivals, Hint and Watch & Learn', p: [
    'The four rivals (Aino, Jussi, Helmi and Eero) play with the same physics as you. Each one tries hundreds of throws on a copy of the lawn, scores them by what they would leave it needing, tests the best against small slips of the hand, and then throws with a hand that is as steady as its level: Aino is gentle and careless of the 50 rule, Eero rarely slips.',
    'Hint runs the strongest version of that planner for your situation. Watch & Learn lets two rivals play a Short match while you read their reasoning: they think (2, 5, 8 or 10 seconds as you set), then show the ring and the style they chose, then throw. Pause and Resume freeze everything exactly where it is.',
  ] },
  { title: '12. Simplifications', p: [
    'This version simplifies a few things of the yard game. The pin is thrown from a fixed line with a pull gesture. Standing skittles do not slide until they tip. The flight is a clean arc without wind. Skittles lying on the lawn behave like smooth rods with ordinary friction. Teams, the children\'s shorter distance and local variations on where skittles stand again are not included.',
  ] },
];
