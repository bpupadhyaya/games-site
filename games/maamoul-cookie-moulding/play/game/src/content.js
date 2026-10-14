// Text content: the Rules / How to Play / About pages. Numbers are read from the engine constants (K, TYPES, BAKERIES).
import { K, TYPES, BAKERIES, TOTAL_SHIFTS, SHIFTS_PER_BAKERY } from './engine.js';
import { PATTERNS, UNLOCK } from './art.js';

const pc = (v) => `${Math.round(v * 100)}%`;
const R = (title, body, fig) => ({ title, body, fig });
const typeList = Object.values(TYPES).map((t) => `${t.name.toLowerCase()} (${t.filling}, ${t.mould})`).join(', ');

export const FACTS = [
  'Maamoul are small, filled semolina cookies from the Levant: Lebanon, Syria and Jordan, with many family variations in neighbouring countries.',
  'The print comes from a carved wooden mould. The dough is pressed in, the mould is knocked firmly on the table edge, and the cookie drops out with the pattern sharp.',
  'Cooks often match shape to filling: a domed cookie for walnut, a round flat one for pistachio and an oval one for dates. Families have their own habits.',
  'Maamoul is baked pale. A cookie that goes brown has stayed in the oven too long: the dough is meant to be soft and crumbly.',
  'The dough is made from semolina and butter and is rested before shaping. The filling is ground nuts or soft date paste with a little spice.',
  'Many bakers dust the cooled cookies with icing sugar, which also shows off the carved print.',
];

export const DOCS = {
  howto: {
    title: 'How to Play',
    pages: [
      R('Work the bench', [
        { p: 'Each shift is a set of trays. The tray at the top shows ghost slots: each shape and dot says which cookie goes there. Make the cookies one at a time at the bench, set them on the tray and bake it.' },
        { p: 'Slot shapes: oval for date, domed for walnut and round for pistachio. The dot colour matches the filling.' },
      ], 'tray'),
      R('1. Choose a mould', [
        { p: 'Tap one of the moulds on the rack at the bottom. Only moulds the tray still needs can be chosen.' },
        { p: 'You can switch to another mould until you drop the filling.' },
      ], 'cookies'),
      R('2. Fill', [
        { li: ['The filling in the dough cup swells and shrinks.', 'Tap the bench when it reaches the dashed ring.', 'Too little leaves a hollow cookie; too much splits the seam.'] },
      ], 'cup'),
      R('3. Seal', [
        { li: ['Drag your finger once all the way round the rim of the dough.', 'Stay on the ring: the crimp turns green where you are accurate, red where you wander.', 'In Settings, Easy seal turns this into a single tap.'] },
      ], 'rim'),
      R('4. Knock', [
        { li: ['The dough is pressed into the carved mould and knocked out. Three rings close on the mould, one after another.', 'Tap as each ring touches the rim. Close to the beat is a perfect knock.', 'A stray tap does nothing, so keep calm and keep the rhythm.'] },
      ], 'knock'),
      R('5. Place', [
        { p: 'The cookie lands on a floured peel. Tap one of the glowing ghost slots on the tray to set it down.' },
        { p: 'When every slot is filled the tray is ready for the oven.' },
      ], 'tray'),
      R('6. Bake', [
        { li: ['Tap Load oven to slide a full tray in. The bake runs while you carry on making the next tray.', 'Watch the gauge. Pull the tray inside the green pale-gold zone.', 'Earlier leaves the cookies doughy, later turns them brown. The oven pulls a tray out by itself once it is burnt.'] },
      ], 'oven'),
      R('More ways to play', [
        { li: [`Journey: ${BAKERIES.length} bakeries of ${SHIFTS_PER_BAKERY} shifts.`, 'Rush Hour: ninety seconds of non-stop trays, score only.', 'Daily Shift: one new shift every day, the same for everyone.', 'Pattern Book: collect carved patterns with your stars.', 'Watch and Learn: the game bakes a small shift and explains each move. Think shows what to do next.'] },
      ]),
    ],
  },
  rules: {
    title: 'Rules',
    pages: [
      R('Trays and slots', [
        { p: 'A shift is a number of trays (1 to 4). Each tray is a grid of slots, 3 by 2 in the Home Kitchen and 4 by 2 later. Every slot has a fixed cookie type, shown by its ghost shape and a coloured dot.' },
        { p: `The three types are ${typeList}.` },
        { p: 'Only the first tray that is still being filled can be worked on. When all its slots hold a cookie it becomes ready for the oven.' },
      ], 'tray'),
      R('Choosing a mould', [
        { p: 'You can pick a mould only if the current tray still has an empty slot of that type. Choosing a mould takes a fresh dough ball; picking a different mould before the filling is dropped swaps it at no cost.' },
        { p: 'Only one cookie is worked on at a time: fill, seal, knock, then place. You cannot start the next dough until the current cookie is on the tray.' },
      ], 'cookies'),
      R('Fill', [
        { p: 'A scoop of filling swings in and out of the dough cup. The shift sets how long a swing takes (about 2.3 seconds in the first shift, 1.2 in the last) and how wide the good band is.' },
        { li: [`The dashed ring is the right amount. Within about a third of the band's half-width of it you score 100%.`, `The score falls in a straight line to 0% at ${K.BAND_FAR.toFixed(1)} band half-widths away.`, 'You can tap at any time; there is no penalty for waiting for the next swing.'] },
      ], 'cup'),
      R('Seal', [
        { p: 'Drag a finger once round the dough rim, in either direction. Each stretch of the circle you cover adds to the seal; when the whole circle is covered the seal is finished.' },
        { li: ['Staying within a small distance of the rim scores 100% for that stretch; drifting further away scores less, down to 0%.', 'Going back the way you came does not add anything.', 'Easy seal in Settings: one tap seals the dough at a fixed 78%.'] },
      ], 'rim'),
      R('Knock', [
        { p: `The knock has ${K.KNOCK_BEATS} beats about ${K.KNOCK_LEAD.toFixed(0)} second after the seal ends, then one every 0.55 to 0.8 seconds depending on the shift.` },
        { li: [`A tap within ${Math.round(K.KNOCK_CLEAN * 1000)} ms of a beat scores 100%; the score falls to 0% at ${Math.round(K.KNOCK_TOL * 1000)} ms.`, 'A beat nobody taps counts as 0%. A tap that is not near any beat is ignored.', 'The knock score is the average of the three beats.'] },
      ], 'knock'),
      R('Cookie quality and placing', [
        { p: `A finished cookie's quality is ${pc(K.W_FILL)} fill, ${pc(K.W_SEAL)} seal and ${pc(K.W_KNOCK)} knock. A quality of ${pc(K.PERFECT)} or more is Perfect.` },
        { p: 'Set it on any empty slot of its type. A slot of another type will not take it. A perfect cookie adds a bonus of 10 points plus 5 for each perfect cookie in a row before it (up to 20); anything below perfect breaks the row.' },
      ], 'tray'),
      R('The oven', [
        { p: 'There is one oven. Tap Load oven to slide in the first ready tray. A bake takes between 12 and 7 seconds, depending on the shift (a quarter longer with Calm oven on), and the gauge shows how far along it is.' },
        { li: [`Below ${pc(K.B_RAW)}: underbaked (30% value).`, `${pc(K.B_RAW)} to ${pc(K.WIN0)}: nearly there, rising to 85%.`, `${pc(K.WIN0)} to ${pc(K.WIN1)}: pale gold, the green zone, 90% to 100% with the best at ${pc(K.WIN_MID)}.`, `${pc(K.WIN1)} to ${pc(K.B_BROWN)}: golden, 90% falling to 65%.`, `${pc(K.B_BROWN)} to ${pc(K.B_BURN)}: brown, falling to 30%.`, `Beyond ${pc(K.B_BURN)}: burnt, 15%. At ${pc(K.B_AUTO)} the oven pulls the tray by itself.`] },
        { p: 'Every cookie on the tray gets the same bake value. The cookies in the oven window change colour live.' },
      ], 'oven'),
      R('Scoring and stars', [
        { li: ['A baked cookie scores 100 times its quality times the tray\'s bake value.', 'Perfect bonuses are added as cookies are placed.', 'A cleared shift also adds 2 points for every second left on the clock.'] },
        { p: `Stars: all trays baked before closing time is 1 star; 2 stars need an average cookie value of ${pc(K.STAR2)}; 3 stars need ${pc(K.STAR3)} and a finish within ${pc(K.TIME_FOR_3)} of the time limit. If the clock runs out first the bakery closes with no stars.` },
      ]),
      R('Rush, Daily Shift and Pattern Book', [
        { li: [`Rush Hour runs for ${K.RUSH_SECONDS} seconds with an endless supply of 3 by 2 trays and all three fillings. Only trays you have pulled count. Score marks for 1, 2 and 3 stars: ${K.RUSH_STARS.join(', ')}.`, 'Daily Shift is one seeded shift, the same for everyone on the same day. Clearing it adds to your streak.', `The Pattern Book holds nine carved patterns, three per type. Stars unlock them (${Object.entries(UNLOCK).map(([k, v]) => `${k} at ${v.join(', ')}`).join('; ')}). Equip one per type; it only changes how cookies look.`] },
      ], 'book'),
      R('Watch and Learn, controls and simplifications', [
        { li: ['Watch and Learn plays a small shift with the game\'s own planner: it thinks (2 to 10 seconds, your choice), shows the move, then does it. Time slows while it thinks. Pause freezes everything.', 'Think in a normal shift shows the same suggestion without playing it.', 'Keyboard: 1 to 3 choose a mould, Space taps the bench, arrows and Enter pick a slot, O loads the oven or pulls the tray, H Think, P or Esc pauses.'] },
        { p: `Simplifications: real maamoul is shaped by hand with many more steps (resting the dough, measuring each ball). Here the dough is ready, one oven bakes one tray, and the ${TOTAL_SHIFTS} Journey shifts are invented for the game.` },
      ]),
    ],
  },
  about: {
    title: 'About',
    pages: [
      R('Maamoul Cookie Moulding', [
        { p: 'Maamoul are small filled cookies from the Levant, made in Lebanon, Syria and Jordan and in many homes beyond. A semolina dough is wrapped round a filling of dates or ground nuts and pressed into a hand-carved wooden mould that gives each cookie its pattern.' },
        { p: 'This game is about that moment of craft: the right amount of filling, a tight seal, three clean knocks and an oven watched for pale gold. It is inspired by the tradition; the shifts, bakeries and scoring are our own.' },
      ], 'cookies'),
      R('Good to know', [
        { li: ['One-time unlock after a free preview; no ads and no subscriptions.', 'Fillings are date paste, walnut and pistachio. Everything is vegetarian.', 'Everything works offline. Portrait or landscape on phone and tablet.', 'Tap Think any time you want a nudge. Watch and Learn plays and explains a whole shift.'] },
        { p: 'Part of Arcforge, a collection of world heritage games.' },
      ]),
      R('Credits', [
        { p: 'Design, art, sound and code: Arcforge. All sounds are synthesized in the game. Heritage note: thanks to the bakers and families of the region who keep these moulds and recipes in use.' },
        { p: 'Fonts: Cormorant Garamond (the Cormorant Project Authors) and Fredoka (the Fredoka Project Authors), SIL Open Font License 1.1.' },
      ]),
    ],
  },
};
export { PATTERNS };
