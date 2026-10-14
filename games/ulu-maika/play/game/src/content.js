// Text for About, How to Play and the Rules reference. Every rule below was checked against the engine:
// sim.js (course, physics, gates, scoring), match.js (turn order, ties), game.js (flow). Numbers are in metres.
// A section is { title, art?, p: [paragraphs] }; the reader flows every section into one scrolling page.

export const ABOUT = [
  { title: 'Ulu Maika', art: 'discs', p: [
    'Ulu maika is a traditional skill game from Hawaiʻi. Players roll a smooth, rounded stone disc, an ʻulu maika, along a prepared lane, aiming it between two stakes set a short way apart and on towards a stake farther away.',
    'It was played across the islands long before European ships arrived, and it is still taught today in cultural programmes and parks, where visitors can try rolling a disc for themselves.',
  ] },
  { title: 'More than a roll', p: [
    'A good roll depends on a steady eye and a patient hand. The disc runs on its edge, so a tiny error at the start becomes a metre at the far end. A slope or a patch of soft ground changes the story, and a gentle roll finds the gap more often than a hard one.',
  ] },
  { title: 'This version', p: [
    'Ulu Maika simulates every roll on a meadow lane by the sea. You look down the lane through a sight, turn it, set a lean, and swipe to roll. You can play five rivals, a friend on the same phone, practise alone, or watch two rivals play a whole match and see how they choose each roll.',
    'This is a respectful, simplified retelling for play on a phone, with the lane shortened and the stakes and the far target a little larger so they can be read at a distance. It is a game of skill only, with no wagering of any kind. The Rules page lists exactly what is simplified.',
  ] },
  { title: 'Learn more', p: [
    'If you would like to learn the real game, Hawaiian cultural practitioners and cultural centres are the best teachers. This game is only a small, friendly doorway to their tradition.',
  ] },
];

export const HOWTO = [
  { title: 'The idea', art: 'course', p: [
    'Roll your disc up the lane. It must pass cleanly between the two stakes of each gate, then come to rest as close as it can to the far stake, ideally touching it.',
    'Each side rolls the same number of discs. The highest total wins.',
  ] },
  { title: 'Sight', art: 'scope', p: [
    'The big picture is your view down the lane. Drag left or right on it to turn the sight; the dotted line shows where the roll would go. The strip below shows the whole lane from above.',
  ] },
  { title: 'Lean', art: 'lean', p: [
    'Lean bows the roll to the left or right. Use it to curve round a boulder or to arrive at a gate from the side. Each step bends the path a little more; a long roll bends more than a short one.',
  ] },
  { title: 'Power', art: 'power', p: [
    'Press the ROLL pad, swipe up and let go. The farther you swipe, the harder the roll. The gauge in the picture fills as you swipe; the white ticks show the power that only just reaches each gate (G) and the far stake (F).',
    'A hard swipe wobbles more than a gentle one. Roll with just enough power, and a little over.',
  ] },
  { title: 'Read the ground', art: 'ground', p: [
    'Soft mud drags a disc to a halt. White arrows on the grass show a cross slope: a slow disc is pushed along the arrows for longer than a fast one. Boulders stop a disc and send it away.',
  ] },
  { title: 'Watch & Learn and Hint', p: [
    'Watch & Learn plays a whole match between two rivals. For each roll you see them think, then the roll they chose and the best alternatives, then the roll itself. Use Pause to stop everything exactly where it is, and Think - / + to change how long they think.',
    'In your own match, Hint asks a strong rival for the roll it would make and sets your sight, lean and a power marker for you.',
  ] },
];

export const RULES = [
  { title: 'The lane', art: 'course', p: [
    'The lane is between 22 and 28 metres long and 5.2 metres wide, with the roll line at the near end. A disc that crosses the side lines, runs more than two and a half metres past the far stake, or rolls back behind the roll line is out.',
    'Gates are pairs of stakes set across the lane. The far stake stands at the end of the lane with a ring painted round it, 1.35 metres from its centre.',
  ] },
  { title: 'The disc and the roll', p: [
    'Each side has the same number of discs: six, or three in a quick match. You roll a disc from the middle of the roll line in the direction of your sight, at the power you swipe, with the lean you set.',
    'Power runs from slow (1.2 metres per second) to very fast (9 metres per second). The disc slows steadily as it rolls and stops by itself.',
  ] },
  { title: 'Sight and release', p: [
    'The sight turns up to about 15 degrees either way. Where the roll really goes is the sight plus a small wobble from your release. The wobble is small for a gentle swipe and grows with the square of the power; Steady hand in Settings halves it.',
    'The dotted preview shows the roll you would make with no wobble. The disc then follows the same physics, with the wobble added.',
  ] },
  { title: 'Lean', art: 'lean', p: [
    'Lean has five steps, two left, two right and straight. Each step curves the path with a constant bend, so the disc turns the same amount for every metre it travels, whatever its speed.',
  ] },
  { title: 'The ground', art: 'ground', p: [
    'Every course has its own rolling drag. Mud patches make the drag four times as strong inside the patch. A cross slope pushes the disc sideways at a steady rate while it is on the sloped stretch, so a slower disc, which spends longer there, is pushed farther.',
    'Boulders are solid: a disc bounces off one and loses most of its speed. Stakes are solid too, and a disc that touches a gate stake bounces away.',
  ] },
  { title: 'Gates', art: 'gate', p: [
    'A gate is passed when the centre of the disc crosses the line between the two stakes, between them, without the disc touching either stake first. Touching a stake spoils that gate even if the disc then rolls on through. Crossing the line outside the stakes is a miss.',
    'Each clean gate scores 2 points. Gates can be passed in any order, but they are laid out along the lane.',
  ] },
  { title: 'The far stake and the ring', art: 'score', p: [
    'Touching the far stake scores 2 points if every gate was passed clean, and 1 point if not. If the disc comes to rest inside the ring having passed every gate clean, it scores 1 more point.',
    'A disc that is out scores nothing for the ring, but keeps the points for gates it passed and a far stake it touched before leaving.',
  ] },
  { title: 'Turns and winning', p: [
    'Sides alternate rolls, starting with the side that leads. After every disc has been rolled, the side with more points wins. If it is a tie, each side rolls one more disc, and again if still level, up to three times; after that the match is a draw.',
    'Solo Practice has one side and no winner: you roll all your discs and your total is compared with your best on that course.',
  ] },
  { title: 'Courses', p: [
    'Meadow Run: one wide gate on flat ground. Sloped Field: a cross slope along most of the lane. Twin Stakes: two gates one after the other, with the far stake set to the side. Mud and Boulder: a boulder in the first part and a mud patch before the far stake. Daily Course: gates, slopes, mud and boulders mixed from the date, the same for everyone that day.',
  ] },
  { title: 'What is simplified', p: [
    'The real game has many local forms, different ground and a different number of players. This version uses a shortened lane, stakes and a far target a little larger than real ones, wider gates than the traditional ones, and the scoring above. The disc rolls in a straight line unless leaned or pushed; it wobbles and tips over as it slows, as a real stone does, and the players, the village and the onlookers are drawn for play, not copied from any one place. Distances are measured on flat ground.',
  ] },
];
