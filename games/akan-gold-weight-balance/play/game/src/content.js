// Text content: market days (chapters), tiers, and the How to Play / Rules / About pages.
export const CHAPTERS = [
  { id: 'morning', rule: 'right', name: 'Market Morning', count: 6, blurb: 'Weights go on the right pan. Pour dust on the left until it levels.' },
  { id: 'pans', rule: 'both', name: 'The Second Pan', count: 6, blurb: 'Weights may go on the left pan too: what is on the left is taken away.' },
  { id: 'bag', rule: 'bag', name: 'Weigh the Bag', count: 6, blurb: 'The bag itself can sit on a pan, like a weight of its own.' },
  { id: 'few', rule: 'bag', name: 'Big Orders', count: 6, blurb: 'Large orders, a handful of weights. Every weighing has to count.' },
  { id: 'master', rule: 'bag', name: 'The Master Trader', count: 6, blurb: 'Two weights, one huge order. Plan backwards from the number.' },
];
export const FACTS = {
  right: 'Among the Akan peoples of what is now Ghana and Cote d\'Ivoire, gold dust was money for centuries. Traders carried a small brass balance, cast weights and a spoon, and weighed out each payment.',
  both: 'Cast brass weights come in many shapes: animals, plants, tools and plain geometric forms. Many were made by the lost-wax method, one mould for one weight.',
  bag: 'Weight systems were not the same everywhere or in every century. Traders in different towns and markets used their own sets, and learned to check each other\'s weights.',
  daily: 'Many gold weights are tied to proverbs: a small figure stands for a saying that everyone in the market knows.',
};
export const TIERS = ['Gentle', 'Steady', 'Master'];
export const RULE_TEXT = {
  right: 'Weights on the right pan only.',
  both: 'Weights on both pans.',
  bag: 'The bag can be weighed too.',
};
export const RULE_TITLE = { right: 'Right Pan Only', both: 'Both Pans', bag: 'Weigh the Bag' };

const R = (title, body, fig) => ({ title, body, fig });
export const DOCS = {
  howto: {
    title: 'How to Play',
    pages: [
      R('Serve the order', [
        { p: 'A customer wants an exact amount of gold dust. You have a brass balance, a few cast weights and a heap of dust. Fill the customer\'s bag with exactly the amount on the order slip, in as few weighings as you can.' },
        { p: 'Every order is a small puzzle: which weights go where so the dust you pour is the right amount, and how few pours it takes.' },
      ], 'goal'),
      R('One weighing', [
        { li: ['Put weights on the pans. Drag them, or tap a weight to send it to the right pan; tap it again to move it to the left pan; tap once more to take it back.', 'The dust is poured into the left pan until the balance is level. So the dust poured is what the right pan weighs, minus what the left pan already holds.', 'Press Pour. The dust goes into the customer\'s bag.'] },
        { p: 'The left pan has to be the lighter one, or there is nothing to pour.' },
      ], 'pour'),
      R('Weights on both pans', [
        { p: 'A weight on the left pan counts against you: the dust only has to make up the difference. A 9 on the right and a 3 on the left makes the dust 6. That is how you reach amounts no single weight shows.' },
      ], 'both'),
      R('The bag is a weight too', [
        { p: 'From the third market day, the bag itself can go on a pan. Put the bag on the left pan and the dust tops it up to match the right pan. Put the bag on the right pan and the dust must match it: a full bag doubles itself.' },
        { p: 'Planning backwards from the order is the secret of the big ones.' },
      ], 'bag'),
      R('Hints and Watch and Learn', [
        { p: 'The lamp button first shows where to look, then explains the reasoning, then sets the pans for you. Watch and Learn plays a whole order and explains every step, with a real Pause.' },
        { p: 'Three stars for serving the order in the fewest weighings possible, two for one more, one for any other way. A hint caps the order at two stars. Nothing is ever lost: Undo takes back the last pour.' },
      ]),
    ],
  },
  rules: {
    title: 'Rules',
    pages: [
      R('The goal', [
        { p: 'Each order names an amount of gold dust. The customer\'s bag starts empty. Make the bag hold exactly that amount.' },
        { p: 'You score by the number of weighings (pours) you use. The fewest possible number for the order is its par.' },
      ], 'goal'),
      R('What you have', [
        { li: ['A set of cast weights, each marked with its value. You have one of each value in the set, and a weight is never used up: it stays on the pan or goes back to the tray as you like.', 'A balance with two pans. The left pan is the dust pan: dust is only ever poured into the left pan.', 'A bag, which holds the dust you have poured so far.', 'An endless heap of gold dust.'] },
      ], 'weights'),
      R('A weighing', [
        { p: 'Place any weights you want on the pans, then pour. The dust poured is exactly enough to level the balance:' },
        { p: 'dust = right pan - left pan', mono: true },
        { p: 'Only a whole number above zero can be poured: if the left pan is as heavy as the right or heavier, the Pour button stays grey. After a pour the dust goes into the bag, and the pans keep their weights.' },
      ], 'pour'),
      R('Right Pan Only', [
        { p: 'In the first market day the left pan is for dust only. A weighing pours the sum of the weights on the right pan. To make an amount you add several weighings together, using the weights in different combinations.' },
      ], 'right'),
      R('Both Pans', [
        { p: 'From the second market day, weights may go on the left pan beside the dust. Then dust = (weights on the right) - (weights on the left). With a 9 and a 4 you can pour 13, 9, 4 or 5 (9 - 4).' },
      ], 'both'),
      R('Weigh the Bag', [
        { p: 'From the third market day, the bag may sit on a pan as a weight of its own, worth what it holds now.' },
        { li: ['Bag on the left pan: dust = right pan - (left weights + bag). The bag ends up holding exactly right pan - left weights.', 'Bag on the right pan: dust = (right weights + bag) - left weights. With nothing else on the pans the bag doubles.', 'The bag can only be on one pan at a time.'] },
      ], 'bag'),
      R('Mistakes and Undo', [
        { p: 'The bag can never hold less than it did: dust only goes in. If you pour more than the order asks, press Undo to take the last pour back. Undo can be used as often as you like; weighings you undo are not counted.' },
        { p: 'Clear pans puts all the weights back in the tray.' },
      ]),
      R('Stars, hints and the demo', [
        { li: ['3 stars: the order served in par weighings or fewer. 2 stars: one more. 1 star: any number.', 'A hint from the lamp button caps the order at 2 stars. Watch and Learn is free and never counts.', 'Daily Order: a new order every day, the same for everyone.', 'The web demo allows three orders; the app has them all.'] },
      ]),
    ],
  },
  about: {
    title: 'About',
    pages: [
      R('Akan gold weights', [
        { p: 'For centuries the Akan peoples of Ghana and Cote d\'Ivoire used gold dust as money. A trader weighed it out on a small brass balance, against a set of cast brass weights known as abrammuo.' },
        { p: 'The weights themselves became small works of art. Some are plain geometric forms; many are animals, plants, tools and everyday objects, and a good number stand for proverbs that the whole market knew.' },
      ], 'weights'),
      R('The game', [
        { p: 'Gold-Weight Balance is an original puzzle inspired by that trade: serve each customer\'s order exactly, in the fewest weighings. The figures in the game are our own drawings in the spirit of the tradition, not copies of any museum piece.' },
        { p: 'Real weight systems varied from place to place and over time. Here the weights are plain numbers, so that the puzzle is the same for everyone. The names of the weights are only for the figures: a fish, a bird, a tortoise.' },
      ]),
      R('Credits', [
        { p: 'Heritage: the gold-weight tradition of the Akan peoples of Ghana and Cote d\'Ivoire. Many museums around the world keep collections of these weights, and they are well worth a visit.' },
        { p: 'Fonts: Dela Gothic One and Fredoka, both under the SIL Open Font License 1.1. All art and sound in the game are drawn and synthesised in the game itself.' },
        { p: 'A game from Arcforge, a collection of world heritage games.' },
      ]),
    ],
  },
};
