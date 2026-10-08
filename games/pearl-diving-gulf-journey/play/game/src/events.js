// The evening tales. Each event is a short scene with two or three honest choices; the engine applies `fx` and writes `result` to the journal.
// fx keys: cash, spirit, stam, standing, debt, fam (rupees credited to the family's next need), salimTired, forceRest, provDisc, sellNow
// Cond functions read the season state S. No religion, no brands. Hardship is told plainly.
export const EVENTS = [
  { id: 'first-pearl', title: 'The first pearl song', lines: ['After the evening meal Khalifa, the old singer, tells how his grandfather found a pearl as big as a date stone and sang for three nights.', 'The crew knows the story. They still lean in.'],
    choices: [
      { label: 'Listen quietly', fx: { spirit: 7 }, result: 'You listened until the lamp burned low. The sea felt friendly.' },
      { label: 'Ask him to teach you the refrain', fx: { spirit: 4, stam: -2 }, result: 'Khalifa taught you the refrain. Your clapping will be steadier tomorrow.' },
    ] },
  { id: 'neighbour-boat', title: 'A boat alongside', lines: ['A small boat from Muharraq ties up for the evening. Their diver has a fever and they are short of rope and food.'],
    choices: [
      { label: 'Give a coil of rope and share the pot (4 rupees)', fx: { cash: -4, standing: 1, spirit: 3 }, result: 'They left at dawn with rope and a full stomach. Hamad nodded at you across the deck.' },
      { label: 'Wish them well', fx: {}, result: 'You wished them well. The sea is wide and everyone is short of something.' },
    ] },
  { id: 'dolphins', title: 'Dolphins', lines: ['A pod of dolphins follows the boat at sunset, rolling in the long swell. Even the captain stops steering to watch.'],
    choices: [
      { label: 'Watch them until dark', fx: { spirit: 7 }, result: 'The whole crew watched. Nobody said much.' },
      { label: 'Use the light to mend a net', fx: { stam: -2, cash: 3 }, result: 'You mended a net for the cook and he paid you 3 rupees for it.' },
    ] },
  { id: 'fish-day', title: 'A fish on the line', lines: ['Rashid, the cook, trolled a line all afternoon and hauled in a fat grouper. The whole deck smells of garlic and smoke.'],
    choices: [
      { label: 'Eat well tonight', fx: { stam: 8, spirit: 4 }, result: 'A good meal. You slept like a stone.' },
      { label: 'Dry half to sell at the harbour', fx: { stam: 3, cash: 5 }, result: 'Rashid dried half the fish. It will fetch 5 rupees in Muharraq.' },
    ] },
  { id: 'torn-cap', title: 'A torn finger cap', lines: ['One of your leather finger caps split on the shells today. Without it the oyster edges bite.'],
    choices: [
      { label: 'Buy leather from the cook and mend it (3 rupees)', fx: { cash: -3 }, result: 'Mended. The new stitches look better than the old ones.' },
      { label: 'Dive on with the torn one', fx: { stam: -6 }, result: 'Your fingers will sting tomorrow. You said nothing.' },
    ] },
  { id: 'letter-home', title: 'News from home', lines: ['A boat heading back to Muharraq will carry messages. Your mother can have news of you, and perhaps a few rupees for Latifa.'],
    choices: [
      { label: 'Send 8 rupees with a message', fx: { cash: -8, fam: 8, spirit: 3 }, result: 'The money is on its way. Your mother will not have to borrow at the shop this month.' },
      { label: 'Send only a message', fx: { spirit: 2 }, result: 'You dictated a short message to the cook, who writes well. Your pearls will do the rest.' },
    ] },
  { id: 'ledger', title: "The captain's ledger", lines: ['Hamad, the nakhuda, opens the ledger at the lamp. Your advance is written there in his careful hand. He does not press you. He only turns the book so you can see the figure.'],
    choices: [
      { label: 'Pay 10 rupees against the advance now', when: (S) => S.cash >= 10, fx: { cash: -10, debt: -10, standing: 1 }, result: 'Hamad wrote the sum and blew on the ink. "A man who pays a little pays all," he said.' },
      { label: 'Keep your cash for now', fx: {}, result: 'Hamad closed the book without a word. The figure stayed in your head.' },
    ] },
  { id: 'deckhand', title: 'The boy who coils rope', lines: ['The youngest deckhand, a boy of eleven, keeps tangling the haul rope. Yesterday it cost Salim a worried minute.'],
    choices: [
      { label: 'Show him the knots', fx: { stam: -2, standing: 1, spirit: 3 }, result: 'By dark he could tie the rope loop with his eyes shut.' },
      { label: 'Let the others sort it out', fx: {}, result: 'The rope stayed tangled until Khalifa shouted at it.' },
    ] },
  { id: 'salim-ear', title: "Salim's ear", lines: ['Salim presses a hand to his ear after the deep dives. He says it is nothing. He has said it three days now.'],
    choices: [
      { label: "Ask Hamad to give Salim an easy day", fx: { spirit: 2, standing: 1 }, result: 'Hamad grunted and put Salim on the oar. He did not argue.' },
      { label: 'Say nothing', fx: { salimTired: 1 }, result: 'Salim will keep diving. Haul carefully tomorrow.' },
    ] },
  { id: 'jassim-boat', title: "Mr. Jassim's boat", lines: ['A fast boat comes alongside at dusk. Mr. Jassim, the pearl merchant, offers to buy what you have found so far, at once, for ready money. He pays below the harbour price.'],
    when: (S) => S.pearls.filter((p) => !p.kept).length >= 2,
    choices: [
      { label: 'Sell what you have for 85% of its value', sell: 0.85, fx: { sellNow: 0.85 }, result: 'The coins were warm from his pocket. You counted them twice.' },
      { label: 'Decline politely', fx: {}, result: 'He bowed and sailed on. The pearls stayed in their cloth.' },
    ] },
  { id: 'stars', title: 'A night of stars', lines: ['The wind drops at dusk. The sea turns to black glass with the stars lying on it. Someone starts a slow song.'],
    choices: [
      { label: 'Sleep early', fx: { stam: 7 }, result: 'You slept before the second verse.' },
      { label: 'Stay up with the singers', fx: { spirit: 8, stam: -2 }, result: 'You sang until your voice cracked and the crew laughed kindly.' },
    ] },
  { id: 'storm-sign', title: 'Old sailors smell the wind', lines: ['Hamad sniffs the air and looks north-west. "Shamal by morning," he says. "Nobody dives in that."'],
    when: (S) => S.day < 3,
    choices: [
      { label: 'Shelter behind the sandbar tomorrow', fx: { stam: 6, forceRest: 1 }, result: 'Tomorrow the boat will lie behind a sandbar and the crew will mend and sleep.' },
      { label: 'Trust the sky and work on', fx: { stormTomorrow: 1 }, result: 'You will dive tomorrow, shamal or not.' },
    ] },
  { id: 'sister-comb', title: 'A shell comb for Latifa', lines: ['A pale shell with a smooth curve lies in your basket. It is not a pearl shell. Latifa would like it.'],
    choices: [
      { label: 'Carve a small comb from it', fx: { stam: -2, spirit: 5 }, result: 'It took an evening. It is not very straight. She will not mind.' },
      { label: 'Throw it back for luck', fx: { spirit: 1 }, result: 'It sank slowly, turning in the green water.' },
    ] },
  { id: 'cook-lesson', title: "Rashid's pot", lines: ['Rashid lets you stir the pot and shows you how to stretch rice with dates and a little fish. "Half the cost, twice the taste," he says.'],
    choices: [
      { label: 'Learn the trick', fx: { provDisc: 3, spirit: 2 }, result: 'The next trip\'s provisions will cost you 3 rupees less.' },
      { label: 'Just eat', fx: { stam: 3 }, result: 'It was delicious and you did not ask how.' },
    ] },
  { id: 'widow', title: 'A family in need', lines: ['Word comes by a passing boat: the family of a diver who did not return last season is short of everything. The crews are collecting.'],
    choices: [
      { label: 'Give 6 rupees', when: (S) => S.cash >= 6, fx: { cash: -6, standing: 2, spirit: 2 }, result: 'Hamad added your name to the list. The boat carried the money home.' },
      { label: 'You have your own family to think of', fx: {}, result: 'Nobody blamed you. The debt is heavy for everyone.' },
    ] },
  { id: 'old-debt', title: "Khalifa's debt", lines: ['Khalifa has been singing on this boat for thirty years. He still owes the advance his father took. Debts here pass from father to son. He tells you this lightly, between two verses.'],
    choices: [
      { label: 'Listen, and say you will pay yours', fx: { spirit: -2, standing: 1 }, result: 'It is the truth of the trade. You wrote your own figure on the inside of your arm with a burnt stick.' },
      { label: 'Ask for another song', fx: { spirit: 3 }, result: 'He sang. The figure was forgotten for an hour.' },
    ] },
];

// A quiet line for the journal when no tale is told (one per day, picked by the season seed).
export const SEA_NOTES = [
  'The sea was the colour of the inside of a shell.',
  'Rashid burned the rice again. Nobody said a word.',
  'A long swell came in from the north and rocked everyone to sleep.',
  'The sail was patched in three places and still pulled well.',
  'Gulls followed the boat for an hour, then lost interest.',
  'Salim whistled the whole way back to the mooring.',
  'The lamp swung. The talk was all of other seasons.',
  'Hamad checked the stars twice, which he does when he is pleased.',
];

export const EPILOGUES = {
  clear: ['You repaid the whole advance. Hamad crossed your name out of the ledger and, for the first time, shook your hand across the page.', 'Your family has not borrowed from the shop this season. Few divers can say that.'],
  part: ['You repaid most of the advance. The rest is written in the ledger for next season.', 'This is how the trade works: a little carried forward, a little hope.'],
  owe: ['The season did not cover the advance. What remains is written in the ledger and will be there in spring.', 'Many divers began their lives this way. You are not alone, and the next season is a new sea.'],
};
