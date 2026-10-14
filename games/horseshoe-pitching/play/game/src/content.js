// Text for About, How to Play and the Rules reference. Every rule below was checked against the engine:
// sim.js (pit, shoe, throw, scoring, arm swing), match.js (innings, turn order, winning), game.js (flow, modes).
// Numbers are metric with the traditional inches beside them. A section is { title, art?, p: [paragraphs] };
// the reader flows every section into one scrolling page.

export const ABOUT = [
  { title: 'Horseshoe pitching', art: 'shoe', p: [
    'Horseshoe pitching is a throwing game from the United States and Canada. Players pitch a steel horseshoe about forty feet at an iron stake standing in a pit of clay, and try to wrap the shoe around it. A shoe that circles the stake is a ringer and is worth the most.',
    'It is part of the living heritage of the United States and Canada, played in back yards, at picnics and in clubs, with leagues and world championships run by national associations. A good pitcher throws with a clean arc and a measured turn of the shoe, and every sound of steel on iron is part of the pleasure.',
  ] },
  { title: 'More than a throw', p: [
    'Every shoe changes the pit. A ringer can be cancelled by another ringer, a shoe leaning on the stake can be knocked away by a well-placed throw, and a safe shoe near the stake can be enough to score. Knowing when to go for the ringer and when to play close is the whole game.',
  ] },
  { title: 'This version', p: [
    'Horseshoe Pitching simulates every flight, landing, slide and collision in a clay pit on a sunny afternoon. You play one of five rivals, a friend on the same phone, or team up with a partner against two rivals, or watch two rivals play a whole match and see how they choose each throw.',
    'This is a respectful, simplified retelling for play on a phone: the pit is shown larger than it looks from the pitching end so that the shoes can be read, the scoring is the cancellation count kept simple, and the throw is controlled by an arm swing and a choice of flip. The Rules page lists exactly what is simplified.',
  ] },
  { title: 'About the shoes', p: ['Real horseshoes were made for horses, and animals come first. The shoes in this game are the steel pitching shoes made for the game, in two paint colours so that each side can be told apart.'] },
];

export const HOWTO = [
  { title: 'The idea', art: 'shoe', p: [
    'Two sides each pitch two shoes at the stake from forty feet away. A shoe that circles the stake is a ringer and scores 3. A shoe that finishes closer to the stake than the rival\'s closest shoe, within 6 inches, scores 1. Only one side scores in an inning: the lower total is taken away from the higher.',
    'First to 21 points wins (or 11 in a quick match).',
  ] },
  { title: 'Aim the target', art: 'aim', p: [
    'Touch or drag on the pit board to place the target where you want the shoe to come to rest. The ghost shoe shows its open end pointing at the stake; put the stake inside the open end for a ringer. The dashed ring shows where most of your shoes will land.',
    'The Hint button asks a champion where it would pitch and sets the target and flip for you.',
  ] },
  { title: 'Choose the flip', art: 'flips', p: [
    'Three-quarter turn: a wide release window, but the shoe lands flatter, digs in and hops more. One and a quarter turns: a narrow window, but the shoe lands level and slides onto the stake. The smaller window rewards a steady hand.',
  ] },
  { title: 'Swing and let go', art: 'gauge', p: [
    'Hold PITCH. The arm winds back, swings forward through the green and follows through. Let go while the arm is in the green. The nearer the middle of the green, the cleaner the throw. Too early lands short and under-turned; too late carries long and over-turned.',
    'On a keyboard: arrow keys move the target, 1 and 2 choose the flip, hold Space to swing, H for a hint, P to pause.',
  ] },
  { title: 'Score the inning', art: 'score', p: [
    'When all four shoes are down the inning is scored and shown. The side that scored pitches first in the next inning. A shoe that lands outside the pit is dead and scores nothing.',
  ] },
  { title: 'Watch & Learn', p: [
    'Two rivals play a whole match and show how they choose: each thinks, shows its choice and the best alternatives, then pitches. You can pause at any time, and change the thinking time in Settings.',
  ] },
];

export const RULES = [
  { title: 'The pit', art: 'pit', p: [
    'The two stakes stand 40 feet (12.19 m) apart. Each is in the middle of a pit of clay about 31 inches (0.8 m) wide and 6 feet (1.82 m) long, with a back board behind it. You pitch at the far pit. The stake is a 1 inch (2.5 cm) iron peg.',
    'A shoe must come to rest inside the pit to count. A shoe that lands outside it, or is knocked or slides out, is dead: it scores nothing and lies where it stopped.',
  ] },
  { title: 'The shoe', art: 'shoe', p: [
    'A pitching shoe is a steel U about 7 inches (18 cm) long with an opening of about 3.5 inches (9 cm) between the arms. A ringer is a shoe that finishes with the stake inside the opening, between the arms and in front of the closed end. A shoe leaning against the stake is not a ringer; it is measured by distance like any other shoe.',
  ] },
  { title: 'An inning', p: [
    'Each side pitches two shoes at the same end: the first side pitches both, then the second side pitches both. After the fourth shoe the inning is scored and the pit is cleared for the next. In the first inning the side that pitches first is chosen at random. After that the side that scored pitches first in the next inning; if nobody scored, the order stays.',
  ] },
  { title: 'Scoring', art: 'score', p: [
    'Each side adds up its points: 3 for every ringer, and 1 for every other shoe that is within 6 inches (15 cm) of the stake and closer than the rival\'s closest other shoe. Distance is measured from the edge of the stake to the nearest steel.',
    'The lower total is taken from the higher, so only one side scores in an inning (cancellation scoring). Two ringers each cancel completely; two ringers against one scores 3 for the pair and so on. The first side to 21 points wins (11 in a quick match).',
  ] },
  { title: 'Pitching a shoe', art: 'aim', p: [
    'You choose where the shoe should come to rest (the target), the flip, and the moment of release. The shoe flies about one second, lands, may hop, slides a short way and stops. Where it lands depends on your release and a little chance: the dashed ring around the target shows where most shoes finish, and it is larger on a rival\'s weaker day.',
    'Every shoe has a small scatter from side to side and front to back. A release in the middle of the green adds nothing to it; a release at the edge of the green adds about 20 cm of depth and turns the shoe about 23 degrees; further out it is worse. Early releases land short, late ones long.',
  ] },
  { title: 'The flips', art: 'flips', p: [
    'Three-quarter turn: the green is wide (26 degrees either side of the release mark), the shoe turns less cleanly, slides about 7 cm and hops in about one throw in seven. One and a quarter turns: the green is narrow (16 degrees either side), the shoe lands level and slides about 17 cm on Packed Clay, and hops in about one throw in twenty-five.',
    'On the arm gauge the inner 35 percent of the green is a perfect release. The setting Release window: wide makes every green 40 percent larger; Arm swing: slow slows the arm by about a third.',
  ] },
  { title: 'The arm swing', art: 'gauge', p: [
    'While you hold PITCH the arm winds back (about half a second), swings forward through the release mark (about one second), follows through and returns, then repeats. Letting go during the wind-up drops the shoe short. Letting go after the green carries it long and over-turned.',
  ] },
  { title: 'Landing, slide and the stake', p: [
    'After landing, a shoe slides along the clay toward the back board. If its open end meets the stake the stake funnels it in, and a shoe that reaches the closed end stops there as a ringer. If an arm of the shoe hits the stake from outside, the shoe is knocked sideways and turned and stops. A shoe that slides or hops onto a shoe already in the pit knocks that shoe away about 13 to 25 cm and turns it, which can take a ringer off the stake.',
  ] },
  { title: 'The pits', art: 'pit', p: [
    'Packed Clay: the standard surface. Soft Sand: shoes slide about a third as far and hop less, so a throw lands almost where it falls. Hard Pan: dry and fast, shoes slide about half as far again and hop more. The Daily Pit mixes slide, hop and scatter from the day number, the same for everyone that day.',
  ] },
  { title: 'Doubles', p: [
    'You and Sunny play as the blue side against two rivals. The partners of a side pitch from opposite ends, so you pitch the odd innings and your partner the even ones, and the rivals take turns the same way. Each side still pitches two shoes at the end where the inning is played.',
  ] },
  { title: 'The rivals', p: [
    'Five rivals from Gus, a backyard beginner, to The Judge. A rival tries about two dozen ideas on a copy of the pit (a ringer try, a close shoe, a knock-off aimed at one of your shoes) with both flips, and picks the best average. Weaker rivals scatter more, release less steadily and sometimes settle for a lesser idea. The hint uses The Judge\'s eye with a near-perfect release.',
  ] },
  { title: 'What is simplified', p: [
    'The pit is drawn large; shoes are pitched from one fixed position straight down the lane; there is no wind or foul line; the count-all scoring and the 40-shoe game are not included; the flip is a choice of two; and the shoe\'s landing and slide are a simple model of clay, not a full simulation of steel. Numbers on this page are what the game uses.',
  ] },
];
