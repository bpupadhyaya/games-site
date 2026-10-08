// The text of the About, How to Play and Rules pages. Every number here is the engine's number (sim.js, match.js, game.js).
// Sections: { title, art?, p: [paragraphs] }. `art` names an illustration drawn by menus.js with the game's own tile art.
export const ABOUT = [
  { title: 'Ddakji', art: 'tile', p: [
    'Ddakji is a Korean children\'s game. Each player folds a square of paper into a thick, flat tile. One tile lies on the floor; the other player slaps theirs down beside it so hard that the rush of air and the shock tip the first tile right over onto its back.',
    'This version gives the paper real weight: the tile pivots on its far edge under gravity and the burst of wind, so a soft slap only makes it wobble, a clever one flips it, and a wild one scatters.',
  ] },
  { title: 'What is in the game', p: [
    'Play against six rivals, share one screen with a friend, or sit back and Watch & Learn while two rivals show how it is done. The Fold Workshop teaches how a tile is made, and the weight of your tile depends on how crisp your folds are.',
    'Every rival\'s printed tile is yours to win. Twelve patterns can be collected, and you choose which one you play with.',
  ] },
  { title: 'Heritage', p: [
    'Ddakji comes from Korea and is played on floors, pavements and school yards. Folded paper tiles from old exercise books, calendars and wrapping paper are the traditional material. The patterns in this game are original and inspired by Korean paper crafts: window lattices, patchwork cloth, fans, waves, bamboo, plum blossom and the night sky.',
  ] },
  { title: 'The free preview', p: [
    'Real play is free for a short preview. Menus, the Fold Workshop, the Collection, Rules, Watch & Learn and a paused game never use up preview time. The full game is a single purchase that also unlocks every rival, with nothing else to buy. Settings has Restore Purchases for people who already own it.',
  ] },
  { title: 'Made by Arcforge', p: [
    'Ddakji is part of Arcforge, a growing collection of the world\'s heritage games, each built to feel as good as it looks.',
  ] },
];

export const HOWTO = [
  { title: 'The goal', art: 'flip', p: [
    'Flip your rival\'s tile onto its back. Each flip wins the tile and one point. In a quick match the first to 2 flips wins; in a full match, the first to 3.',
  ] },
  { title: 'Taking your throw', art: 'aim', p: [
    'One tile lies on the floor. Drag on the floor to move the ghost tile: that is where your tile will land. Slap it down just beside the tile you want to flip. The soft ring around it shows how far your throw may scatter.',
    'Then set Strength with the first slider and Twist with the second, and press Throw.',
  ] },
  { title: 'Strength and twist', art: 'power', p: [
    'Strength is how hard you slap. Too soft and the tile barely stirs; about three quarters is the sweet spot; at full strength the throw scatters and skids away.',
    'Twist turns your tile in the air. It pushes more wind under the other tile but makes the landing less certain, left or right.',
  ] },
  { title: 'Where to land', art: 'pin', p: [
    'Land close beside the middle of one edge. Landing on a corner lifts it poorly, landing far away loses the wind, and landing on top of the tile pins it down.',
    'If your tile does not flip theirs, it stays where it landed and becomes the next target; the rival picks up the old one and slaps back.',
  ] },
  { title: 'Fold your own tile', art: 'fold', p: [
    'The Fold Workshop shows how to fold one. Drag along each arrow with a straight, steady line: crisp folds make a tighter, heavier tile that hits harder and is harder to flip.',
  ] },
  { title: 'Helpers', p: [
    'Think shows the best slap it can find and moves the controls for you. Watch & Learn plays a whole game between two rivals, shows what each is planning, and has a real Pause. In the Settings you can choose the thinking time and the text size.',
  ] },
];

export const RULES = [
  { title: 'The tiles', art: 'tile', p: [
    'Each tile is a square, 1 unit on a side, with a printed face and a plain cream underside. A flipped tile shows its plain underside. A tile\'s weight is 0.90 plus 0.20 times its crispness (0 to 1), so between 0.90 and 1.10. Rivals have fixed weights from 0.94 to 1.10.',
  ] },
  { title: 'A match', art: 'match', p: [
    'Two sides, you against a rival or two people on one screen. The first side to flip 2 tiles (quick match) or 3 tiles (full match) wins. The side that was flipped last throws first in the next exchange; in the first exchange the first thrower is chosen at random.',
    'An exchange is a run of throws, one after the other, alternating sides, until a tile is flipped. If ten throws pass without a flip, both tiles are laid again and the exchange starts over with the same score.',
  ] },
  { title: 'Aiming', art: 'aim', p: [
    'The thrower stands below the sheet. You choose the landing point of the centre of your tile (anywhere on the sheet), a strength from 0 to 100 percent and a twist from minus 100 to plus 100 percent (left to right).',
    'The throw is never perfect. The landing point scatters around your aim by a typical distance of 0.045 + 0.24 times strength to the power 1.8 + 0.12 times the size of the twist (units of one tile). Rivals add the unsteadiness of their hand to this. The scatter is random but fixed by the game\'s seed, so nothing is rigged.',
    'Your tile lands turned by half the angle of your approach plus 0.9 radians (about 52 degrees) at full twist, with a small random tilt that makes a slap land a little flatter or less flat (a factor from 0.9 to 1.1).',
  ] },
  { title: 'The lift', art: 'power', p: [
    'The struck edge of the target is the one nearest your tile. That edge is lifted while the opposite edge is the hinge. The lift quality Q is the product of:',
    'strength: (0.25 + 0.95 times strength) times 1.5, and above 80 percent strength that is multiplied by 1 minus 2.4 times (strength minus 0.8), because a very hard throw skids and loses wind; place: 1 when the tiles are 0.12 apart or closer, falling away smoothly for greater gaps (and no lift at all beyond a gap of 1.4); overlap: a tile that overlaps the target loses 1.15 times the overlap depth, and an overlap deeper than 0.65 pins the target (no lift); sideways: up to 65 percent lost the further you land from the middle of the edge; approach: 68 to 100 percent depending on whether you came straight at the edge; twist: plus 25 percent at full twist; weights: the square root of your weight over theirs; and the flat factor above.',
  ] },
  { title: 'The flip', art: 'flip', p: [
    'The target pivots on its far edge. Its angle follows gravity (acceleration 40 times the cosine of the angle), a little air drag, and a burst of wind that fades in about 0.12 seconds. It starts with a spin of 0.8 times Q times the spin needed to reach upright, plus the wind. If the tile gets past upright it tumbles over and lands face-down one unit away: a flip. Otherwise it falls back. An angle of 29 degrees or more is a wobble; anything less barely stirred.',
    'The same calculation is used for you, for every rival and for the hint; there are no hidden bonuses.',
  ] },
  { title: 'Other results', art: 'pin', p: [
    'Pinned: your tile landed more than 0.65 deep over the target, which stays flat. Miss: your tile landed more than 1.4 from the target. Thud: the lift was real but tiny. In every case other than a flip, the target is picked up, your tile stays where it landed (slid a little by a hard throw) and becomes the new target for the other side.',
  ] },
  { title: 'The rivals', p: [
    'Six rivals, from Jiho (one star: unsteady, makes mistakes) to Halmeoni (five stars: a very steady hand and an excellent eye). Each rival\'s tile has its own printed pattern; beating a rival for the first time adds that pattern to your Collection. Rivals look at every edge, a few offsets and gaps, nine strengths and five twists and throw the one they judge best; weaker rivals judge less well and shake more.',
  ] },
  { title: 'Collection', art: 'patterns', p: [
    'Twelve patterns. You start with Ribbon Bands. Flip your first tile for Plum Blossom; 10 flips in all for Morning Sun; 30 for Honeycomb; fold a tile with 90 percent crispness for Curled Clouds; win a full match 3 to 0 or win three matches in a row for Night Stars; and beat each of the six rivals once for their patterns. The pattern you choose is your tile; it changes nothing but the look.',
  ] },
  { title: 'Watch & Learn', p: [
    'Two rivals play a quick match. Each throw has three phases: Think (2, 5, 8 or 10 seconds, you choose), Reveal (2 seconds: the chosen landing spot, strength and twist are shown, with the runner-up spots), then the throw. Pause stops everything exactly where it is. Watch & Learn never uses preview time.',
  ] },
  { title: 'Two players', p: [
    'Two people share the screen and pass the device. Between throws a card says whose turn it is; tap it to take your throw.',
  ] },
];
