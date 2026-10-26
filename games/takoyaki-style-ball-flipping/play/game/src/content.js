// Text content: the Rules / How to Play / About pages. Numbers are read from the engine constants (K, FLAMES, FILLINGS).
import { K, FLAMES, FILLINGS, STALLS, TOTAL_SHIFTS } from './engine.js';

const pc = (v) => `${Math.round(v * 100)}%`;
const R = (title, body, fig) => ({ title, body, fig });
const fillNames = Object.values(FILLINGS).map((f) => f.name.toLowerCase()).join(', ');

export const FACTS = [
  'Takoyaki means grilled octopus. The street-stall version from Osaka is a round ball of batter turned with two thin picks in a plate of half-sphere moulds.',
  'Stall cooks turn each ball by a quarter, again and again, tucking the overflow in, until it is a perfect sphere. It takes years to make it look easy.',
  'The plate is cast iron and heats unevenly. Cooks learn which moulds run hot and give them a head start or an earlier turn.',
  'Good takoyaki is crisp outside and soft inside. The picks are used to turn it, never to stab it.',
  'A busy stall turns out forty or fifty balls a minute, so the cook is always working three or four batches at once.',
  'Many stalls offer fillings other than octopus: cheese, corn, mushroom and green onion are common.',
];

export const DOCS = {
  howto: {
    title: 'How to Play',
    pages: [
      R('Run the stall', [
        { p: 'Customers queue at the ticket rail. Each ticket shows what they want: a filling and how many balls. Pour batter into the iron plate, cook the balls, and pack them for the right ticket before the customer loses patience.' },
        { p: 'The row of dots beside each filling is the number of balls. A dot fills in when a ball is served.' },
      ], 'ticket'),
      R('Pour and fill', [
        { li: ['Choose the Ladle at the bottom, then tap or hold on a mould. Holding fills it; one short tap is a third of a mould.', 'Drag the ladle across several moulds to pour a row. Go steadily: too fast leaves thin balls, too slow overflows.', 'Choose a filling and tap or drag over fresh batter to drop it in. It must go in before the first flip.'] },
      ], 'plate'),
      R('Flip at the right time', [
        { p: 'Each ball is four quarters. Only the quarter on the iron cooks properly. The ring around the ball shows how done that quarter is.' },
        { li: ['Take the Picks and tap the ball while the ring is in the green.', 'Too early and the batter spills. Too late and the quarter toasts, then burns.', 'Every flip brings a fresh quarter down. After the fourth quarter the ball is round, golden and ready.'] },
      ], 'ring'),
      R('Pack and serve', [
        { p: 'A ready ball glows. Tap it with the Picks to pack it: it goes to the most urgent customer who wants that filling. If nobody wants it yet it waits in the warm tray.' },
        { p: 'Perfect balls in a row build a streak bonus. A customer who gets everything at once leaves a tip.' },
      ], 'boat'),
      R('Flame and hearts', [
        { li: ['The Flame button cycles Low, Medium and High. High cooks quickly but the green window is short.', 'The glowing mould is a hot spot: it cooks faster than the rest.', 'A customer who waits too long leaves and costs a heart. Lose all three and the stall closes.'] },
      ], 'flame'),
      R('More ways to play', [
        { li: ['Journey: three stalls of six shifts, from one small plate to the full plate.', 'Rush: ninety seconds of non-stop tickets, score only.', 'Daily Shift: one new shift every day, the same for everyone.', 'Watch and Learn: the game cooks a shift and explains every move. Think shows what to do next.'] },
      ]),
    ],
  },
  rules: {
    title: 'Rules',
    pages: [
      R('The stall and the plate', [
        { p: `The plate is a grid of round moulds: 3 by 2 in the first shifts, up to 4 by 3. Each mould holds one ball. The plate sits over an iron fire; the moulds near the middle run a little hotter than the corners.` },
        { p: `One mould in each shift is a glowing hot spot that cooks about a third faster than the rest.` },
        { p: `A shift lasts until every ticket has been served or has walked away. At most ${K.SLOTS} tickets wait at the rail at once; the next one steps up when a place is free.` },
      ], 'plate'),
      R('Batter and pouring', [
        { p: `The ladle adds batter at about ${K.POUR_RATE.toFixed(1)} mould-fulls per second while you hold it over a mould, and slows to ${pc(K.BRIM_SLOW)} of that speed once the mould is full (a keyboard tap adds ${pc(K.DOLLOP)} at once).` },
        { p: `A mould counts as full from ${pc(K.FULL)}. Under 70% you get a small ball and its score is reduced. Above ${pc(K.MAX_FILL)} the batter overflows: the ball is marked as sloppy (lower score) and part of the excess runs into the neighbouring moulds, starting thin puddles there.` },
        { p: 'You can add batter to a mould until its first flip. A burnt mould must be scraped before it can be used again.' },
      ], 'plate'),
      R('Fillings', [
        { p: `Fillings are ${fillNames}. Which ones a shift uses depends on the stall. They are vegetarian; octopus, the traditional filling, is not used here.` },
        { p: 'A filling goes into a poured mould that has not been flipped yet and holds at least a third of a mould of batter. Each ball takes one filling or none (a plain ball). A small tag on the ball shows what is inside.' },
        { p: 'A ticket line asks for a filling (or plain) and a number of balls. Only a ball with that exact filling counts for that line.' },
      ], 'ticket'),
      R('The four quarters', [
        { p: 'Every ball has four quarters arranged around one axis. At any moment one quarter is on the iron (the bottom), two are against the sides of the mould and one is on top.' },
        { li: [`The bottom quarter cooks at the full rate of the iron: about ${Math.round(K.RATE * 100)} points of doneness per second at medium flame on an ordinary mould (the ring scale is on the next page), a little faster in later shifts.`, `The two side quarters cook at ${pc(K.SIDE)} of that rate, the top quarter at ${pc(K.TOP)}.`, 'Flipping turns the ball a quarter of a turn: the quarter that was on top moves to a side, a side quarter moves to the bottom.'] },
      ], 'ball'),
      R('The cook ring and colours', [
        { p: 'The ring around a ball tracks its bottom quarter. It runs clockwise from the top and is split into zones:' },
        { li: [`Raw, 0% to ${pc(K.RAW)}: pale batter, still liquid.`, `Setting, ${pc(K.RAW)} to ${pc(K.GOLD)}: blond, firming up.`, `Golden, ${pc(K.GOLD)} to ${pc(K.GOLD_END)}: the green zone, full marks.`, `Toasting, ${pc(K.GOLD_END)} to ${pc(K.BURN)}: darker and falling in value.`, `Burnt, ${pc(K.BURN)} and beyond: the ball is scrapped.`] },
        { p: 'The colours on the ball itself follow the same scale, so you can also read doneness by eye. The Cook ring setting can hide the ring.' },
      ], 'ring'),
      R('Flipping and spills', [
        { p: `Tap a cooking ball with the Picks to turn it a quarter. If the bottom quarter is still below ${pc(K.RAW)} the batter spills: that quarter stays undercooked and the ball loses a tenth of its quality for each spill.` },
        { p: 'You can flip any time after that. A ball is ready when all four quarters have reached the golden zone. Because the sides keep cooking slowly, the best moment to flip is as the ring enters green, not at the end of it.' },
        { p: 'If a ball sits on the iron after it is ready, the bottom quarter keeps cooking and will toast and then burn.' },
      ], 'ring'),
      R('Ready, packing and the tray', [
        { p: 'A ready ball glows. With the Picks, tap it to pack it. It goes straight to the waiting customer who wants its filling and has the least patience left. If nobody needs it, it goes to the warm tray.' },
        { p: `The warm tray holds ${K.TRAY} balls and cools slowly: a ball loses about ${(K.TRAY_COOL * 60 * 100).toFixed(0)}% of its quality per minute. When a new customer steps up, the tray serves them at once if it holds what they want.` },
        { p: 'If the tray is full and nobody wants the ball, it stays on the iron. Scrape a burnt ball with the Picks to clear the mould.' },
      ], 'boat'),
      R('Flame', [
        { p: `The flame has three settings: ${FLAMES.map((f) => `${f.name} (${f.mul.toFixed(2)}x)`).join(', ')}. It multiplies the cooking rate of every mould at once.` },
        { p: 'Low gives the longest green window and is kind to a full plate; High is for a plate that has only a few balls and a short queue. The Calm iron setting slows the whole plate further.' },
      ], 'flame'),
      R('Customers, tickets and hearts', [
        { p: 'Each ticket has a patience bar. It drains steadily while the customer waits; larger orders get more time and later shifts get slightly less.' },
        { p: `When the bar empties the customer leaves with whatever they already received and you lose a heart. You start with ${K.HEARTS}. With no hearts left the stall closes and the shift ends.` },
        { p: 'In Rush there are no hearts: customers who leave just cost you the points they would have given.' },
      ], 'ticket'),
      R('Scoring and stars', [
        { li: ['A ball is worth 100 times its quality, 0 to 100. Quality is the average of the four quarters, reduced for a small ball, for spills and for overflow.', `A perfect ball (quality ${pc(K.PERFECT)} or more) adds 20, plus 5 more for each perfect ball in the current streak (up to 5). Any ball below perfect resets the streak.`, 'A finished ticket adds a tip: up to 30 for patience left, and 20 more if every ball was Good or better.'] },
        { p: `Stars: 3 stars need at least par (the score of a clean shift) with all ${K.HEARTS} hearts; 2 stars need 70% of par and at most one heart lost; 1 star is simply finishing with a heart left.` },
      ]),
      R('Rush, Daily Shift and Watch and Learn', [
        { li: [`Rush runs for ${K.RUSH_SECONDS} seconds on the full plate with an endless stream of tickets. Score only; there are 3, 2 and 1 star marks at 1500, 900 and 350 points.`, 'Daily Shift is one eight-ticket shift, the same for everyone on the same day. Finishing it adds to your streak.', 'Watch and Learn plays a short shift with the game\'s own planner. It thinks (you can set 2 to 10 seconds), shows what it chose and why, then does it. Time runs in slow motion while it thinks. Pause freezes everything.', 'Think in a normal shift shows the same suggestion without doing it.'] },
      ]),
      R('Controls, and what is simplified', [
        { li: ['Touch: pick a tool at the bottom, then tap or drag over the plate. The Flame button cycles. Think shows a hint.', 'Keyboard: arrows move the cursor, Space uses the tool, 1 to 5 choose tools, F cycles the flame, H is Think, P or Escape pauses.', 'A tool that cannot act on a mould hands over to the picks: tapping a ready or already-flipped ball with the ladle packs or flips it.'] },
        { p: `Simplifications: real takoyaki is turned over several times in two directions and the cook tucks the overflow in by hand; here a ball is four quarters around one axis and overflow is only a score penalty. The ${TOTAL_SHIFTS} Journey shifts across ${STALLS.length} stalls are invented for the game.` },
      ]),
    ],
  },
  about: {
    title: 'About',
    pages: [
      R('Takoyaki Flip Stall', [
        { p: 'Takoyaki is a street food from Osaka, Japan: a runny batter poured into a cast-iron plate of half-sphere moulds, filled, and turned bit by bit with two thin picks until each ball is a crisp golden sphere. Cooks at festival stalls and station-side carts do it faster than the eye can follow.' },
        { p: 'This game is about that rhythm: reading many tiny timers at once, turning each ball at the right instant and keeping a queue of customers happy. It is inspired by the tradition; the shifts, customers and scoring are our own.' },
      ], 'boat'),
      R('Good to know', [
        { li: ['Free to play with short ads; go ad-free once.', 'Fillings are all vegetarian: cheese, sweet corn, mushroom and green onion.', 'Everything works offline. Portrait or landscape on phone and tablet.', 'Tap Think any time you want a nudge. Watch and Learn plays and explains a whole shift.'] },
        { p: 'Part of Arcforge, a collection of world heritage games.' },
      ]),
      R('Credits', [
        { p: 'Design, art, sound and code: Arcforge. All sounds are synthesized in the game. Heritage note: takoyaki is the everyday cooking of Osaka stall keepers; thanks to the many cooks who share their craft.' },
        { p: 'Fonts: Barlow and Barlow Condensed by Jeremy Tribby, SIL Open Font License 1.1.' },
      ]),
    ],
  },
};

export const STORY = {
  tutorial: 'Tap a mould with the ladle to pour batter.',
};
