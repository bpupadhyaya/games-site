// Envoy events: a short text and two or three choices. Effects are applied by rules/run.js.
// Effect fields: debt (offer a random Debt), resolve, marks, arrow (rarity to gain),
// standing (negative = the Covenant is broken), tradeUp, enemyGuardNext, guardNext.

export const EVENTS = {
  lender: {
    title: 'The Lender',
    text: 'A quiet figure waits by the road with a ledger and an open hand. "Everyone pays. Most pay late."',
    options: [
      { label: 'Hear the offer', note: 'Take a Debt', effect: { debt: true } },
      { label: 'Walk on', note: 'Nothing changes', effect: {} },
    ],
  },
  fallen_rival: {
    title: 'A Fallen Archer',
    text: 'An archer of the other side lies by a broken tower, quiver still full, too hurt to stand.',
    options: [
      { label: 'Tend the wounds', note: 'Lose 6 Resolve. Gain an uncommon Arrow.', effect: { resolve: -6, arrow: 'uncommon' } },
      { label: 'Take the quiver', note: 'Gain a rare Arrow and 30 Marks. Breaks the Covenant.', effect: { arrow: 'rare', marks: 30, standing: -1 } },
      { label: 'Walk on', note: 'Nothing changes', effect: {} },
    ],
  },
  tuners_trade: {
    title: "The Tuner's Trade",
    text: 'An old Tuner turns your plainest Arrow over in her hands. "I can do better than this. It will not be this one any more."',
    options: [
      { label: 'Trade it', note: 'Your least valuable Arrow becomes a better one.', effect: { tradeUp: true } },
      { label: 'Keep it', note: 'Nothing changes', effect: {} },
    ],
  },
  parley: {
    title: 'Parley',
    text: 'A herald under a white pennant asks what you carry into tomorrow. The Covenant says: answer truly.',
    options: [
      { label: 'Answer truly', note: 'Next fight: enemies start with 6 Guard.', effect: { enemyGuardNext: 6 } },
      { label: 'Lie', note: 'Next fight: you start with 10 Guard. Breaks the Covenant.', effect: { guardNext: 10, standing: -1 } },
    ],
  },

  deserter: {
    title: 'The Deserter',
    text: 'A soldier in your enemy\'s colours crouches in a ditch, unarmed, begging you not to call the patrol.',
    options: [
      { label: 'Hide them', note: 'Lose 5 Resolve. A free uncommon Arrow reaches you two steps on.', effect: { resolve: -5, arrowLater: { rarity: 'uncommon', steps: 2 } } },
      { label: 'Turn them in', note: 'Gain 30 Marks. Breaks the Covenant.', effect: { marks: 30, standing: -1 } },
      { label: 'Walk on', note: 'Nothing changes', effect: {} },
    ],
  },
  wager: {
    title: 'The Wager',
    text: 'An archer from the other side offers a bet: you cannot win your next fight without loosing a single Arrow.',
    options: [
      { label: 'Accept', note: 'Win without loosing an Arrow: a rare Arrow. Loose one: lose 20 Marks.', effect: { wager: true } },
      { label: 'Decline', note: 'Nothing changes', effect: {} },
    ],
  },
  supply_train: {
    title: 'The Supply Train',
    text: 'Unguarded wagons stand on the road, oxen asleep in their traces. The Covenant forbids touching them.',
    options: [
      { label: 'Burn them', note: 'Your next 2 fights: enemies have 15% less health. Breaks the Covenant.', effect: { burnFights: 2, standing: -1 } },
      { label: 'Take only food', note: 'Heal 6 Resolve', effect: { resolve: 6 } },
      { label: 'Leave them', note: 'Nothing changes', effect: {} },
    ],
  },
  old_oathkeeper: {
    title: 'The Old Oathkeeper',
    text: 'An archer past fighting sits by a fire, her quiver empty for thirty years. She keeps one rule still.',
    options: [
      { label: 'Give her an Arrow', note: "Choose one. In return: Oathkeeper's Calm.", effect: { giveArrowFor: 'oathkeepers_calm' } },
      { label: 'Ask for a story', note: 'Learn how this day\'s last enemy opens.', effect: { story: true } },
      { label: 'Walk on', note: 'Nothing changes', effect: {} },
    ],
  },
  well: {
    title: 'Truce at the Well',
    text: 'Both armies drink from the same well at dusk. Nobody strikes here. A flask waits on the rim.',
    options: [
      { label: 'Share the water', note: 'Heal 8. Next fight, enemies also have 8 more health.', effect: { resolve: 8, enemyHpNext: 8 } },
      { label: 'Poison the well', note: 'Next fight enemies start Weak 3. Breaks the Covenant.', effect: { enemyWeakNext: 3, standing: -1 } },
    ],
  },
  broken_tuner: {
    title: 'The Broken Tuner',
    text: 'A Tuner sits in the wreck of her workshop, her hands crushed. Her finished arrows lie in a chest beside her.',
    options: [
      { label: 'Help her', note: 'Lose 8 Resolve. Remove 2 Techniques of your choice.', effect: { resolve: -8, removeTechs: 2 } },
      { label: 'Loot the chest', note: 'Gain 2 uncommon Arrows. Breaks the Covenant.', effect: { arrowsNow: { rarity: 'uncommon', count: 2 }, standing: -1 } },
      { label: 'Walk on', note: 'Nothing changes', effect: {} },
    ],
  },
  child: {
    title: 'The Child with a Bow',
    text: 'A child in a too-big cloak holds up a bow strung with cord. "Have you one spare arrow? Only one."',
    options: [
      { label: 'Give your weakest Arrow', note: 'Gain 1 Standing if below 3; otherwise +15 Legend.', effect: { giveLeast: true } },
      { label: 'Refuse', note: 'Nothing changes', effect: {} },
    ],
  },
  herald: {
    title: "The Herald's Count",
    text: 'A herald under a white pennant asks for the number of Arrows you have loosed. The Covenant says: answer truly.',
    options: [
      { label: 'Answer truly', note: 'Fewer than 6 Spent: the next Hard Fight has 20% less health.', effect: { heraldTruth: true } },
      { label: 'Pad the count', note: 'Gain 25 Marks. Breaks the Covenant.', effect: { marks: 25, standing: -1 } },
    ],
  },
  night_offer: {
    title: 'The Night Offer',
    text: 'The Lender is at your fire before you have lit it. "Better terms tonight. The road is long, and you look tired."',
    options: [
      { label: 'Hear the terms', note: 'A Debt whose due effect is halved.', effect: { debt: true, debtHalved: true } },
      { label: 'Refuse', note: 'Nothing changes', effect: {} },
    ],
  },
  horse: {
    title: 'The Wounded Horse',
    text: 'A cavalry horse limps along the road, saddle empty, one foreleg torn. It follows you a little way.',
    options: [
      { label: 'Tend to it', note: 'Next fight: 1 less Focus on turn 1. Gain 10 Legend.', effect: { tendHorse: true } },
      { label: 'Walk on', note: 'Nothing changes', effect: {} },
    ],
  },
  crossing: {
    title: 'Crossing Lines',
    text: 'There is a gap in the enemy picket, a shallow ford and no guard. You could be past them before dawn.',
    options: [
      { label: 'Slip through', note: 'Skip the next step of the road: no fight, no reward.', effect: { skipStep: true } },
      { label: 'Fight fair', note: 'Nothing changes', effect: {} },
    ],
  },
  forger: {
    title: 'The Forger',
    text: 'A man with ink on his fingers sells sealed papers that open any Tuner\'s stock at half price. "No Lender needed."',
    options: [
      { label: 'Buy a seal', note: 'Take the Forged Seal Debt. Breaks the Covenant.', effect: { debtId: 'forged_seal' } },
      { label: 'Report him', note: 'Gain 20 Marks', effect: { marks: 20 } },
    ],
  },
  captains: {
    title: 'Two Captains Quarrel',
    text: 'Two enemy captains argue over a map in the open. Each would gladly see the other broken by you.',
    options: [
      { label: 'Take a side', note: 'A Hard Fight waits on the next road, and it pays a guaranteed rare card.', effect: { captains: true } },
      { label: 'Keep walking', note: 'Nothing changes', effect: {} },
    ],
  },
  letter: {
    title: 'The Last Letter',
    text: 'A dying archer presses a folded page into your hand. "Not to any of us. To whoever is left at the end."',
    options: [
      { label: 'Carry it', note: 'A useless card joins your quiver. Reach the end still holding it: +40 Legend.', effect: { letter: true } },
      { label: 'Refuse', note: 'Nothing changes', effect: {} },
    ],
  },
};

export const EVENT_IDS = Object.keys(EVENTS);

export const COVENANT = [
  'Strike only the ready.',
  'One against one.',
  'No blow from behind.',
  'None against the fallen.',
  'None against the supply train.',
];
