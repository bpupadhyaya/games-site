// Text for About, How to Play and the Rules reference. Every rule below was checked against the engine:
// sim.js (cancha, throws, bounces), match.js (turn order, mingo, scoring), game.js (flow). Numbers are in metres.
// A section is { title, art?, p: [paragraphs] }; the reader flows every section into one scrolling page.

export const ABOUT = [
  { title: 'Bolas criollas', art: 'balls', p: [
    'Bolas criollas is a throwing game from Venezuela. Two sides take turns to throw heavy balls along a long strip of sand towards a small white ball, the mingo. The closer a ball finishes, the more it is worth.',
    'It is part of the living heritage of Venezuela, played in towns and villages on a cancha of packed earth and sand, with friends and neighbours watching from the side. National federations in Venezuela, Aruba and elsewhere organise leagues and international tournaments today.',
  ] },
  { title: 'More than a throw', p: [
    'A good player reads the ground. Loose sand swallows a ball, hard-packed earth lets it run, and a well-placed ball can be a wall that stops a rival from reaching the mingo. A firm shot can knock a rival ball away, but a shot that misses can sail off the end of the cancha.',
  ] },
  { title: 'This version', p: [
    'Bolas Criollas simulates every throw, landing, roll and collision on a sand cancha at dusk. You play one of five rivals, a friend on the same phone, or watch two rivals play a whole match and see how they choose each throw.',
    'This is a respectful, simplified retelling for play on a phone: the cancha is scaled, the balls are drawn larger than life so that they can be read, and the scoring is kept simple. The Rules page lists exactly what is simplified.',
  ] },
  { title: 'Mingo', p: ['Mingo is the name of the small white target ball. Aim for it, and do not be afraid to move it.'] },
];

export const HOWTO = [
  { title: 'The idea', art: 'balls', p: [
    'Each side has four balls: turquoise or crimson. Throw them so they finish closer to the small white mingo than the other side\'s balls. When all eight are thrown, the side with the closest ball scores a point for every one of its balls that beats the rival\'s best.',
    'First to 12 points wins (or 6 in a quick match).',
  ] },
  { title: 'Aim, then swing', art: 'aim', p: [
    'Touch or drag on the cancha strip or on the loupe, the close-up above it, to place the aim ring where you want the ball to land. A dashed ring shows where the ball will come to rest.',
    'Then press and hold SWING. A needle sweeps along the bar; let go while it is in the green. A clean release lands the ball on the ring. Too early and it comes up short, too late and it carries long.',
  ] },
  { title: 'Release timing', art: 'swing', p: [
    'The green is narrower for a Shot than for a Lob or a Roll. Settings has a slower needle and a switch that shows the flight line of your throw.',
  ] },
  { title: 'Roll, Lob or Shot', art: 'styles', p: [
    'Roll: a low throw that runs along the sand and stops on the ring. It can be blocked by balls in its way.',
    'Lob: a high throw that flies over everything and drops on the ring, then runs on a little. Use it to get past a blocker or to land softly beside the mingo.',
    'Shot: a flat, fast throw that lands on the ring and keeps going. Use it to knock a rival ball or the mingo away. If it hits nothing it may leave the end of the cancha and be lost.',
  ] },
  { title: 'Read the sand', art: 'patches', p: [
    'Dark pitted patches are loose sand: they slow a rolling ball and take the bounce out of a landing. Pale glossy patches are hard-packed: balls skid on and rebound livelier. The rest of the cancha has its own pace; Soft Sand is slow, Packed Earth runs on.',
  ] },
  { title: 'The mingo toss', p: [
    'At the start of each end one side tosses the mingo: roll it so it finishes inside the teal zone. If it does not, the other side tosses it. The side that did not toss throws the first ball.',
  ] },
  { title: 'Watch & Learn and Hint', p: [
    'Watch & Learn plays a whole match between two rivals. For each throw you see them think, then the throw they chose and the best alternatives, then the swing. Use Pause to stop everything exactly where it is, and Think - / + to change how long they think.',
    'In your own match, Hint asks a strong rival for the throw it would make and puts the ring there.',
  ] },
];

export const RULES = [
  { title: 'The cancha', art: 'court', p: [
    'The cancha is 16 metres long and 3 metres wide. The throwing line is at the near end. The dead line is at the far end: a ball that passes it is out. The two long sides have low wooden boards that are in play; a ball bounces off them and stays in.',
    'A ball thrown high enough to clear a side board is out. A ball that rolls back behind the throwing line is out.',
  ] },
  { title: 'Balls and sides', art: 'balls', p: [
    'There are two sides. Each has four balls of one colour (turquoise or crimson). One small white mingo is the target.',
    'The balls in the game are drawn larger than real ones so that every ball can be read on a phone; the cancha is scaled to match.',
  ] },
  { title: 'An end', p: [
    'A match is a series of ends. In each end the lead side tosses the mingo, then the other side throws the first ball and the two sides alternate until all eight balls are thrown. So the lead side throws the last ball.',
    'The lead alternates every end. The first end\'s lead is chosen at random.',
  ] },
  { title: 'The mingo toss', p: [
    'The mingo is always tossed with a Roll. It is legal if it comes to rest between 8 and 13 metres from the throwing line, inside the cancha. If it stops short, stops long or leaves the cancha, the other side tosses it. After two failed tosses the mingo is placed at 10.5 metres in the middle.',
    'If the mingo is knocked off the cancha during an end, that end is played again from the start with the same lead.',
  ] },
  { title: 'Roll, Lob and Shot', art: 'styles', p: [
    'Roll: the ball is released along the sand with the speed that would stop it on the aim ring on a flat reading of the ground that includes the patches. Lob: it flies a high arc and lands on the ring, keeping about a third of its speed on landing. Shot: a flat, fast throw that lands on the ring keeping about two fifths of its speed, so it runs well past it.',
    'A flying ball can land on top of another and bounce off. All balls are the same weight except the mingo, which is a third of the weight and travels much further when struck.',
  ] },
  { title: 'The swing', art: 'swing', p: [
    'Where the ball really lands is the aim ring plus the error of your release. A release inside the green leaves only a small, unavoidable wobble. Outside it, the error grows with distance from the green: early throws land short, late throws land long, and a little sideways drift is added.',
    'The green is 12% of the bar for a Roll, 9.5% for a Lob and 7.5% for a Shot; its position changes every throw. Guide path in Settings widens the green by half and shows the flight line.',
  ] },
  { title: 'The ground', art: 'patches', p: [
    'Every cancha has a base drag: Packed Earth is the quickest, Coast Court is in the middle, Soft Sand is the slowest. Daily Court gets a new drag and a new set of patches each day.',
    'Loose patches roughly double the drag, kill most of a landing\'s carry and deaden collisions. Hard patches cut the drag by about two fifths and make collisions livelier. The aim ring and the dashed rest ring already include the patches.',
  ] },
  { title: 'Scoring an end', art: 'score', p: [
    'When all balls are thrown, every ball is measured from the face of the ball to the face of the mingo. The side with the closest ball scores one point for each of its balls that is closer than the rival\'s closest ball. At most four points can be scored in an end.',
    'If the closest balls of the two sides are within one centimetre, nobody scores. Balls that are out do not count; if no ball is left on the cancha nobody scores.',
  ] },
  { title: 'Winning', p: [
    'The first side to reach 12 points (6 in a quick match) wins, as soon as the end that takes it there is scored. There is no need to win by two.',
  ] },
  { title: 'What is simplified', p: [
    'The real game has regional variations, different court sizes and team sizes. This version uses a 16 metre cancha, four balls a side and the scoring above. There are no fouls for stepping over the throwing line, the throws all start from the middle of the line, and distances are measured on a flat map. Balls do not spin in the simulation; their rotation is drawn only for looks.',
  ] },
];
