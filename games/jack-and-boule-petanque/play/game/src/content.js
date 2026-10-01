// Text for About, How to Play and the Rules reference. Every rule claim below was checked against the
// engine: sim.js (physics and distances), match.js (turn order, jack, scoring), game.js (flow).
// Numbers: 60 world units = 1 metre on screen; the lane is 200 units (3.3 m) wide.
// A section is { title, art?, p: [paragraphs] }; the reader paginates the lines so nothing ever
// overflows, whatever the text size.

export const ABOUT = [
  { title: 'Pétanque', art: 'equipment', p: [
    'Pétanque is a boules game from Provence, in the south of France. Two sides throw heavy steel boules and try to finish closest to a tiny wooden target, the cochonnet, or jack.',
    'It is played on any patch of gravel, in village squares, under plane trees, beside harbours.',
  ] },
  { title: 'Where it comes from', p: [
    'Boules games are very old, and the Provençal game called jeu provençal was played with a running start.',
    'Pétanque as played today is usually dated to 1907 in La Ciotat, where a player who could not run was allowed to throw with his feet planted in a circle. The Provençal name for that, pèd tancat, gave the game its name.',
  ] },
  { title: 'The gravel is half the game', p: [
    'Real pitches are never flat. A boule lands, bites, rolls on, and a slope, a soft patch or a stone changes where it stops. Reading the ground is the skill that players spend years on.',
  ] },
  { title: 'This version', p: [
    'Jack and Boule simulates the throw, the flight, the landing and the rolling of every boule, with a fresh gravel pitch for every match.',
    'You play tête-à-tête against one of five rivals, or against a friend on the same phone, or watch two rivals play a full match and learn from their choices.',
  ] },
  { title: 'Fanny', p: [
    'In France a team that loses 13 to 0 is said to have faire Fanny. Here the result screen simply says so. Do not take it personally.',
  ] },
];

export const HOWTO = [
  { title: 'The idea', art: 'equipment', p: [
    'Throw your boules so that they finish closer to the little red jack than the other side\'s boules. The closer side scores.',
  ] },
  { title: 'Throw like a slingshot', art: 'sling', p: [
    'Press anywhere in the lower play area and drag back, like pulling a slingshot. Let go to throw.',
    'How far you pull sets the distance. Which way you pull sets the direction: pull down and to the left to throw up and to the right.',
    'A very short pull cancels the throw.',
  ] },
  { title: 'Choose your throw', art: 'lofts', p: [
    'Roll runs along the ground. Half-lob lands halfway and then rolls on. Lob drops steeply and stops close to where it lands. Shoot is a fast, flat throw for knocking rivals away.',
    'The dotted arc and the blue ring show where the throw lands. Yellow dots show how far it should run on.',
  ] },
  { title: 'Spin', p: [
    'Neutral lands and rolls. Retro puts backspin on the boule so it bites and stops short, and a shot with Retro tends to stay where it hits. Forward makes it run on.',
  ] },
  { title: 'Read the ground', art: 'surfaces', p: [
    'Pale patches are loose sand: slow and dead. Dark patches are packed clay: fast and lively. Slopes pull rolling boules downhill. Stones deflect them.',
  ] },
  { title: 'Who throws next', p: [
    'The side whose closest boule is farther from the jack throws again, until it takes the point or runs out of boules.',
  ] },
  { title: 'Scoring an end', art: 'score', p: [
    'When all six boules are thrown, the side with the closest boule scores one point for each of its boules that is closer than the other side\'s best. First to 13 wins.',
  ] },
  { title: 'Buttons', p: [
    'Hint shows a good throw for you. Hold the screen while boules roll to fast-forward. Menu pauses the game.',
    'Calm mode in Settings draws a bigger jack ring and shows the whole predicted path of your throw, bounces and all.',
  ] },
  { title: 'Keyboard', p: [
    'Arrow keys aim and set power, 1 to 4 pick the throw, S changes the spin, Space throws, H gives a hint, P pauses.',
  ] },
];

export const RULES = [
  { title: 'The match', art: 'equipment', p: [
    'Jack and Boule is played tête-à-tête: one against one. Each side has three boules: silver-blue for the first side, copper for the second. A small red jack is the target.',
    'The match is a series of ends. The first side to reach 13 points wins, or 7 in a Quick match.',
  ] },
  { title: 'The pitch', art: 'zone', p: [
    'The pitch is a gravel lane 3.3 m wide, bordered by wooden planks and closed at the far end by a stone wall. All throws are made from the circle at the near end.',
    'Two chalk arcs mark 5 m and 8 m from the circle. They matter for the jack.',
  ] },
  { title: 'Starting an end', p: [
    'At the very start of a match a coin toss, seeded from the game, decides who throws the jack. After that, the side that scored the last end throws the jack of the next one.',
    'The side that throws the jack also throws the first boule.',
  ] },
  { title: 'Throwing the jack', art: 'zone', p: [
    'The jack may be thrown with Roll, Half-lob or Lob. To be valid it must stop between 5 m and 8 m from the circle, inside the lane, and not within about a quarter of a metre of the planks.',
    'If it stops anywhere else, the other side throws the jack and then plays first. If that throw is also invalid, the jack is placed on the centre line 6.5 m from the circle and the side that threw it plays first.',
  ] },
  { title: 'Who throws next', p: [
    'After each boule, the side whose closest boule is farther from the jack throws next.',
    'If the two closest boules are equally far (a dead heat), the side that did not throw last goes next. If no boule is left on the lane, the side that did not throw last goes next.',
    'A side with no boules left in hand sits out; the other side throws all of its remaining boules.',
  ] },
  { title: 'The throw', art: 'lofts', p: [
    'You pull back and let go. Pull length sets the distance, in the range of the loft you picked, and the angle of the pull sets the direction, up to 36 degrees to either side of straight ahead.',
    'Roll rests between 0.7 m and 10 m. Half-lob and Lob land between 1.7 m and 9.3 m. Shoot lands between 2.3 m and 10.3 m. The dotted arc and ring on screen show the landing on flat ground; real gravel can change it.',
  ] },
  { title: 'Roll', p: [
    'The boule is released low and rolls. Nothing but the ground slows it, so its run is long and the ground matters most. A rolled boule is a good way to use a slope.',
  ] },
  { title: 'Half-lob and Lob', p: [
    'The boule flies, lands, and then rolls on. A Half-lob usually runs on a long way after it lands. A Lob drops steeply and usually stops within a short distance of where it landed.',
    'Landing on loose sand deadens it. Landing on packed clay makes it bounce more.',
  ] },
  { title: 'Shoot', p: [
    'A shot is a very fast, almost flat throw aimed straight at a rival boule or at the jack, so it hits on the fly or just after landing.',
    'Boules collide like steel balls. The jack is much lighter than a boule and is thrown a long way when hit.',
    'A shot that takes a rival\'s place and stays there is called a carreau.',
  ] },
  { title: 'Spin', art: 'spins', p: [
    'Neutral: no spin. Retro: backspin; the boule bites on landing, slows quickly and may skid back a little. A shot with Retro tends to stay where it hits. Forward: topspin; the boule runs on farther.',
  ] },
  { title: 'The ground', art: 'surfaces', p: [
    'The base surface is gravel. Pale patches are loose sand: they slow a rolling boule a great deal and take the bounce out of a landing. Dark patches are packed clay: faster and bouncier.',
    'Bumps and slopes pull a rolling boule downhill. Every pitch is generated fresh for the match, and the Daily Pitch is the same for everyone on a given day.',
    'Stones set in the gravel near the planks are fixed: a rolling boule that hits one bounces off. Boules flying above them pass over.',
  ] },
  { title: 'Moving the jack', p: [
    'The jack can be hit and moved. Play simply carries on, measured from wherever the jack comes to rest, as long as it stays in the lane.',
    'Distances are measured from the surface of the jack to the surface of the boule.',
  ] },
  { title: 'Out of the lane', art: 'border', p: [
    'A boule or jack whose centre rolls or comes to rest over a plank, past the far end line below the stone wall, or more than about 0.8 m behind the circle is out. Out boules are dead: they are taken away and cannot score.',
    'A boule in the air is judged where it lands.',
  ] },
  { title: 'Scoring an end', art: 'score', p: [
    'When all six boules are thrown, measure every boule still on the lane. The side with the closest boule scores one point for each of its boules that is closer than the best boule of the other side.',
    'Only boules of the winning side that are closer than the rival\'s best count; as soon as a rival boule comes between, counting stops.',
  ] },
  { title: 'Dead heat', p: [
    'If the closest boules of the two sides are within about 1 cm of each other, the end is a dead heat: nobody scores, and the side that threw the jack throws it again.',
  ] },
  { title: 'Dead jack', p: [
    'If the jack is knocked out of the lane, the end stops at once. If only one side still has boules in hand, it scores one point for each of them. If both sides have boules in hand, or neither, nobody scores and the same side throws the jack again.',
    'Boules already on the lane do not count when the jack is dead.',
  ] },
  { title: 'Winning', p: [
    'The first side to reach 13 points, or 7 in a Quick match, wins. Points are only ever scored by one side in an end, so a match cannot end tied.',
    'A win by 13 to 0 is a fanny.',
  ] },
  { title: 'Simplifications', p: [
    'Real pétanque has more detail than this game: boule weights and sizes, team play, measuring disputes, and boules touching the jack on landing. Here, boules are all the same, the circle is fixed, and every close call is decided by exact distances from the physics.',
  ] },
];
