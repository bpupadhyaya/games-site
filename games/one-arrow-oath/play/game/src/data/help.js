// Text for the in-game How to Play and About pages.
// The About wording is the owner's: do not change it without his approval (see STATUS.md, Decisions).

// Split at sentence boundaries for the 300% text-size step (owner request, 2026-09-22): several
// of these tips were themselves too tall for one page at 300%, even alone with one tip per page.
// Every split keeps the exact original wording (never rephrased) - only the title of a split-off
// second half is new, to give its own page a heading.
export const HOW_TO_PLAY = [
  { icon: 'aim', title: 'Read the intent', text: 'Every enemy shows what it will do this turn, and which element answers it.' },
  { icon: 'up', title: 'Pull and release', text: 'Press a card, pull it down like a bowstring, and let go.' },
  { icon: 'up', title: 'Or tap twice', text: 'Tapping a card twice also plays it.' },
  { icon: 'dmg', title: 'Arrows are spent', text: 'Gold-framed Arrows hit hard and are gone for the whole run.' },
  { icon: 'dmg', title: 'Techniques come back', text: 'Steel-framed Techniques come back.' },
  { icon: 'answer', title: 'Answer the attack', text: 'Play the element that beats it. A Ward cancels it.' },
  { icon: 'answer', title: 'The riposte', text: 'A matching Arrow cancels it and strikes for +50%.' },
  { icon: 'mark', title: 'Waste nothing', text: 'Finish weak enemies with Reed Shafts. Never loose a named Arrow at a Lure.' },
  { icon: 'guard', title: 'Debts', text: 'Debts give power now and come due in the final fight.' },
  { icon: 'guard', title: 'The Covenant', text: 'Break the Covenant and your Standing is hard to win back.' },
];

// Each entry is `{ text, lead }` (`lead` picks the bigger gold display style used for the two
// short framing lines). Split at sentence (and, where a single sentence was still too tall alone,
// clause) boundaries — first for the 200% text-size step, then split further for 300% (owner
// request, 2026-09-22, raised mid-pass from an original 200% target): every split below breaks
// only where a comma or colon already sat in the original sentence, so the wording read in order,
// entry after entry, is byte-for-byte the same text as before — just paced across more pages. Two
// short lines (the `pratigya` one) already fit at 300% alone and were left as one entry.
export const ABOUT = [
  { text: 'The idea at the heart of this game', lead: true },
  { text: 'is more than two thousand years old.', lead: true },
  { text: 'In one of the great epic poems of ancient Sanskrit literature,' },
  { text: 'a legendary archer holds himself to a rule:' },
  { text: 'he will never loose the same arrow twice.' },
  { text: 'At the decisive moment of his life he is offered a second chance with his deadliest arrow,' },
  { text: 'and refuses.' },
  { text: 'He would rather lose as himself than win by breaking his word.' },
  { text: 'Sanskrit has a word for a vow like that: pratigya.', lead: true },
  { text: 'A promise declared openly,', lead: true },
  { text: 'and kept whatever it costs.', lead: true },
  { text: 'Sanskrit is one of the world\'s oldest literary languages,' },
  { text: 'and its epics stand among humanity\'s great storytelling treasures,' },
  { text: 'beside the Greek, Norse and Persian traditions.' },
  { text: 'This game borrows one idea from that heritage' },
  { text: 'and builds an original world around it.' },
  { text: 'Every character, place and card here is our own invention.' },
];

export const CREDITS = 'Display typeface: Cinzel, SIL Open Font License 1.1.';

// Three one-line hints shown once each, during the first fights.
export const COACH = {
  read: 'Every enemy shows what it will do. The element beside its number is the one that answers it.',
  answer: 'A card outlined in green answers the attack: it cancels it, and an Arrow also strikes harder.',
  spent: 'That Arrow is Spent for the whole run. Reed Shafts and Techniques come back every fight.',
};
