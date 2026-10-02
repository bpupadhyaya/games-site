// Text for About, How to Play and the Rules reference. Every rule claim below was checked against the engine:
// sim.js (board geometry, flight, scoring by ring, removal), match.js (rounds, turn order, tie), game.js (flow).
// Numbers: the board is 660 units across; a disc is 38 across; 8 pegs; rings at 100 / 178 / 254 from the centre.
// A section is { title, art?, p: [paragraphs] }; the reader paginates the lines so nothing ever overflows,
// whatever the text size.

export const ABOUT = [
  { title: 'A kitchen-table classic', art: 'board', p: [
    'Flicking wooden discs across a smooth round board is an old tabletop pastime from Canada. Families have played it on kitchen tables, in cabins and at community halls for well over a century.',
    'Two sides take turns to flick discs towards the middle. The prizes are the high-scoring rings and the little pocket at the very centre.',
  ] },
  { title: 'A game of two halves', p: [
    'Half of it is finesse: a gentle flick that stops exactly on a ring, or drops into the pocket. The other half is knocking: a hard flick that clears a rival disc out of the best spot and takes its place.',
    'A ring of small pegs guards the middle, so the straight route to the pocket runs through narrow gaps, and every bounce off a peg is a surprise.',
  ] },
  { title: 'This version', p: [
    'Disc Flick Table simulates every flick with real collisions: discs, pegs, the pocket and the gutter. The board is yours to read, and a Hint is there whenever you want help.',
    'Play against one of five rivals, share the phone with a friend, or sit back with Watch & Learn and see why a skilled player chooses what they choose.',
  ] },
  { title: 'About the rules', p: [
    'Disc Flick Table uses the common house rules of the game, written out in full on the Rules pages. Where the rules differ a little between tables, this game follows the Rules pages exactly.',
  ] },
];

export const HOWTO = [
  { title: 'The idea', art: 'board', p: [
    'Flick your discs so they finish in the high-scoring rings, or drop into the 20 pocket in the middle. Knock the other side\'s discs away. When all discs are flicked, every disc on the board scores for its side.',
  ] },
  { title: 'Pull back and let go', art: 'flick', p: [
    'Press anywhere on the screen above the controls and drag back, like pulling a slingshot. Let go to flick.',
    'The direction you pull from sets the aim: pull straight down to flick straight up. How far you pull sets the power. A very short pull cancels.',
    'The dotted line shows the first part of the path, up to the first thing the disc will touch. A ghost disc shows where it would stop.',
  ] },
  { title: 'Choose your spot', art: 'spot', p: [
    'Your disc starts on your own curved line at the bottom of the board. Drag the slider under the board, or the arrow keys A and D, to slide the disc along that line before you flick.',
    'Different spots give different angles through the pegs.',
  ] },
  { title: 'The rival disc rule', art: 'musthit', p: [
    'If any rival disc is on the board, your flicked disc must touch one. A disc that touches none is taken off the board.',
    'The first flick of a round is free, because there is nothing to touch yet. The dotted line turns amber if your current aim would break the rule.',
  ] },
  { title: 'Rings and the pocket', art: 'rings', p: [
    'The rings score 5, 10 and 15 from the outside in. A disc dropped in the pocket scores 20.',
    'A disc that touches a line scores the higher ring. A disc that does not even reach the outer ring leaves the board.',
  ] },
  { title: 'Pegs and the gutter', art: 'pegs', p: [
    'The eight brass pegs stand around the 15 ring. Discs bounce off them. A disc that flies off the playing surface drops into the gutter and is gone.',
  ] },
  { title: 'Rounds', p: [
    'Each side flicks eight discs a round, taking turns one at a time. Then everything is counted. Both sides add their own points: nothing is subtracted.',
    'Quick matches are two rounds and full matches are four. The side that shoots first changes each round. The higher total wins. A tie plays one more round.',
  ] },
  { title: 'Hint, Calm mode and Watch & Learn', p: [
    'Hint finds a strong flick and shows it as a blue ghost disc and path. Calm mode (Menu or Settings) draws the whole predicted path, including bounces.',
    'Watch & Learn plays a complete round between two computer players. Each one thinks first, then shows its plan, then flicks. Pause freezes everything, and Think + and Think − change how long they think.',
  ] },
  { title: 'Saving a match', p: [
    'The game saves your match after every flick has come to rest. If you close the app, or it is closed for you, Continue match on the main menu brings you back to the start of your turn, paused, with every disc where it lay. Watch & Learn is not saved. Starting a new match replaces the saved one.',
  ] },
  { title: 'Keyboard', p: [
    'A and D slide the spot. Arrow left and right turn the aim, up and down change power. Space flicks. H gives a hint. P pauses. Holding the screen while discs slide speeds them up.',
  ] },
];

export const RULES = [
  { title: 'The board', art: 'board', p: [
    'The board is a round, smooth wooden disc. In the exact middle is the pocket. Around it are three scoring rings, worth 15, 10 and 5 points from the centre outwards.',
    'Eight small pegs stand on the outer edge of the 15 ring, evenly spaced. Outside the 5 ring is a plain wooden margin where flicks start, and beyond that a dark gutter around the whole board.',
  ] },
  { title: 'The discs', art: 'discs', p: [
    'Each side has its own colour: red with a maple leaf, and blue with a star. Every disc is the same size and weight.',
    'Each side flicks eight discs in a round.',
  ] },
  { title: 'Where a flick starts', art: 'spot', p: [
    'A flick starts from your own shooting line: the curved line at the edge of the board on your side. You may place the disc anywhere along that line, then flick it towards the board.',
    'You cannot place a disc on top of another one. If a disc already lies on your spot, the new disc shows a red ring: slide along the line to a clear spot first.',
    'In a game for two players on one phone, the board turns to face whoever is flicking.',
  ] },
  { title: 'Taking turns', p: [
    'The sides flick one disc each in turn until all sixteen discs are flicked. The side that flicks first changes every round. In round one the first side is chosen at random.',
    'A disc is flicked, and everything on the board must come to rest, before the next disc is flicked.',
  ] },
  { title: 'The flick', art: 'flick', p: [
    'Power runs from a gentle nudge to a flick that crosses the whole board. Discs slow down smoothly as they slide.',
    'About two fifths of full power carries a disc from the shooting line to the pocket.',
  ] },
  { title: 'The pegs', art: 'pegs', p: [
    'A disc that touches a peg bounces off it and loses a little speed. Pegs never move.',
    'There are eight gaps between the pegs, one straight up, down, left and right and four on the diagonals. A flick towards the pocket only slips through if it lines up with a gap.',
  ] },
  { title: 'Hitting discs', art: 'hit', p: [
    'When two discs touch, they bounce apart. A fast disc hitting a still one passes most of its speed on, though a little is lost in every collision.',
  ] },
  { title: 'The rival disc rule', art: 'musthit', p: [
    'Whenever any rival disc is on the board at the start of your flick, your flicked disc must touch at least one rival disc. Touching your own discs or a peg does not count.',
    'If your disc touches no rival disc, it is taken off the board when everything has stopped. This applies even if it came to rest in the pocket. Discs it knocked about stay where they stopped.',
    'When no rival disc is on the board, any flick is allowed.',
  ] },
  { title: 'Leaving the board', art: 'removed', p: [
    'A disc whose middle goes past the edge of the playing surface drops into the gutter and is removed at once.',
    'When all discs have stopped, any disc that does not reach the 5 ring (it must at least touch the ring\'s outer line) is removed too. This includes a flicked disc that stopped short, and discs knocked back to the margin.',
  ] },
  { title: 'The pocket', art: 'pocket', p: [
    'A disc that drops into the pocket is worth 20 points. Slow discs are drawn in gently. A disc that crosses the pocket too fast flies straight over it.',
    'A pocketed disc is taken out of play and kept for scoring: it cannot be knocked out, and it does not block the board.',
  ] },
  { title: 'Scoring a disc', art: 'rings', p: [
    'Discs are counted when all sixteen have been flicked. A disc scores the highest ring that any part of it touches: a disc lying on a line scores the higher ring.',
    'A pocketed disc scores 20. Discs on the 15, 10 and 5 rings score 15, 10 and 5. Discs removed from the board score nothing.',
  ] },
  { title: 'Scoring a round', p: [
    'Each side adds up its own discs. Both totals are added to the match score: points are never subtracted. The "on board" number on the screen shows what each side would score right now.',
  ] },
  { title: 'Winning the match', art: 'rounds', p: [
    'A quick match is two rounds and a full match is four. After the last round, the side with more points wins.',
    'If the scores are level, one more round is played, and again if needed, until one side leads.',
    'Watch & Learn plays a single round.',
  ] },
  { title: 'The computer players', p: [
    'Each rival thinks about many flicks, tries them out in a hidden copy of the board and picks the best. Weaker rivals consider fewer options and have a less steady hand. The strongest rarely slips.',
    'Hint uses the strongest rival\'s thinking for you.',
  ] },
  { title: 'Preview and unlocking', p: [
    'The first 90 seconds of real play are free. Menus, these pages, settings and Watch & Learn never use up the free time, and a paused match does not either.',
  ] },
];
