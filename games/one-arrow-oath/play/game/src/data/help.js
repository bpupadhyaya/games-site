// Text for the in-game How to Play and About pages.
// The About wording is the owner's: do not change it without his approval (see STATUS.md, Decisions).

export const HOW_TO_PLAY = [
  { icon: 'aim', title: 'Read the intent', text: 'Every enemy shows what it will do this turn, and which element answers it.' },
  { icon: 'up', title: 'Pull and release', text: 'Press a card, pull it down like a bowstring, and let go. Tapping a card twice also plays it.' },
  { icon: 'dmg', title: 'Arrows are spent', text: 'Gold-framed Arrows hit hard and are gone for the whole run. Steel-framed Techniques come back.' },
  { icon: 'answer', title: 'Answer the attack', text: 'Play the element that beats it. A Ward cancels it. A matching Arrow cancels it and strikes for +50%.' },
  { icon: 'mark', title: 'Waste nothing', text: 'Finish weak enemies with Reed Shafts. Never loose a named Arrow at a Lure.' },
  { icon: 'guard', title: 'Debts and the Covenant', text: 'Debts give power now and come due in the final fight. Break the Covenant and your Standing is hard to win back.' },
];

export const ABOUT = [
  'The idea at the heart of this game is more than two thousand years old.',
  'In one of the great epic poems of ancient Sanskrit literature, a legendary archer holds himself to a rule: he will never loose the same arrow twice. At the decisive moment of his life he is offered a second chance with his deadliest arrow, and refuses. He would rather lose as himself than win by breaking his word.',
  'Sanskrit has a word for a vow like that: pratigya. A promise declared openly, and kept whatever it costs.',
  'Sanskrit is one of the world\'s oldest literary languages, and its epics stand among humanity\'s great storytelling treasures, beside the Greek, Norse and Persian traditions. This game borrows one idea from that heritage and builds an original world around it. Every character, place and card here is our own invention.',
];

export const CREDITS = 'Display typeface: Cinzel, SIL Open Font License 1.1.';

// Three one-line hints shown once each, during the first fights.
export const COACH = {
  read: 'Every enemy shows what it will do. The element beside its number is the one that answers it.',
  answer: 'A card outlined in green answers the attack: it cancels it, and an Arrow also strikes harder.',
  spent: 'That Arrow is Spent for the whole run. Reed Shafts and Techniques come back every fight.',
};
