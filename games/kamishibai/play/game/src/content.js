// Text pages: How to Play, Rules and About. A page may carry a picture: fig = { story, card }.
export const FACTS = [
  'Street storytellers rode bicycles with a small wooden stage on the back. They clapped two wooden blocks, called hyoshigi, to call the children.',
  'The wooden stage is called a butai. Its little doors swing open like a theatre, and the cards slide in and out of the side.',
  'A performer pulls each card out sideways and slides it to the back of the stack. The picture changes in a flash.',
  'The words of a story are printed on the back of the card, so the storyteller reads from the card that comes next, not the one in front.',
  'Kamishibai means "paper theatre". The pictures are drawn big and bold so a crowd of children can see them from across the street.',
  'A good storyteller changes voice for each character and pauses before a surprise. The pause is part of the story.',
  'In the 1930s about thirty thousand storytellers reached around a million children every day.',
  'Today kamishibai is told in schools and libraries around the world, and many children make their own cards.',
  'The street storyteller often sold sweets to the audience. Children who bought one stood at the front.',
  'Pictures in kamishibai were often drawn in a rush. Strong outlines and flat colours make them easy to read from far away.',
];
export const CHAPTER_FACT = FACTS;

const R = (title, body, fig) => ({ title, body, fig });
export const DOCS = {
  howto: {
    title: 'How to Play',
    pages: [
      R('Put the story in order', [
        { p: 'Every tale comes as a set of picture cards, shuffled. Work out what happened first, next and last, and lay the cards out in that order: left to right, top to bottom.' },
        { p: 'Look for clues in the pictures: the time of day, the weather, a plant growing, a thing that is whole and then broken.' },
      ], { story: 'seed', card: 1 }),
      R('Moving and checking', [
        { li: ['Tap a card, then tap another to swap them. Or drag a card onto another.', 'Tap the page-turn icon on a card to read the narrator\'s line on its back.', 'Press "Hang the cards" to check. Cards in the right place lock with a gold edge. The others stay free.', 'Fewer checks means more stars.'] },
      ], { story: 'kite', card: 2 }),
      R('Tell the tale', [
        { p: 'When every card is hung, the show begins. The narrator\'s line appears and a ring shrinks around the card\'s pull tab. Pull the card out when the ring closes: swipe it sideways, press Pull, or press Space.' },
        { p: 'Right on the beat is Perfect. Too soon rushes the story, too late makes the children restless. Five paper lanterns show how much attention the audience has left.' },
      ], { story: 'lantern', card: 1 }),
      R('Hints and Watch and Learn', [
        { p: 'The lamp button gives a hint in two steps: where to look, then why. Watch and Learn arranges and performs a whole tale by itself and explains each card. It has a real Pause and a thinking-time setting.' },
        { p: 'The Journey leads through ten tales. Free Play lets you choose any tale at Gentle, Steady or Master. The Daily Tale is the same for everyone.' },
      ], { story: 'drum', card: 5 }),
    ],
  },
  rules: {
    title: 'Rules',
    pages: [
      R('The goal', [
        { p: 'Arrange the cards of a tale in the order the story happened, then perform it by pulling each card out in time with its line.' },
        { p: 'Each tale has exactly one correct order. A tale has between four and eight cards.' },
      ], { story: 'pot', card: 1 }),
      R('Arranging', [
        { li: ['All cards start shuffled, one to a place. Places are read left to right, then top to bottom.', 'A swap exchanges the positions of two cards. A locked card cannot be swapped.', '"Hang the cards" is one check. It locks every card that is already in its right place and leaves the others free.', 'Undo takes back swaps made since the last check.', 'Flipping a card shows its line. On Master the line is cut short.'] },
      ]),
      R('Tiers', [
        { li: ['Gentle: the first and the last cards are already hung. Full lines on the card backs. The show cannot fail.', 'Steady: every card is yours to place. Full lines.', 'Master: short clues only, one more check allowed for three stars, and a stricter audience.'] },
      ]),
      R('Performing', [
        { p: 'Each card has a beat: the time its line takes to read, plus a pause for suspense where the story needs one. The ring around the pull tab closes exactly on the beat.' },
        { li: ['Perfect: within 0.3 seconds of the beat.', 'Good: within 0.65 seconds.', 'OK: a little early or late.', 'Rushed: pulled more than a second early.', 'Late: pulled well after the beat.'] },
        { p: 'Audience attention is five lanterns. Perfect and Good pulls light them. Rushed and Late pulls dim one, and the lanterns also fade slowly while you wait too long. If all go dark, the children wander off and the show restarts from that card. On Gentle the show cannot fail.' },
      ], { story: 'egg', card: 4 }),
      R('Stars and score', [
        { p: 'Three stars: no more than the par number of checks (two for four to six cards, three for seven and eight; one more on Master), at least seven in ten pulls Good or Perfect, and at least three lanterns lit at the end. Two stars need a couple of extra checks and four in ten good pulls. Otherwise one star.' },
        { p: 'Preview and unlock: the game is free to try for a short while of real play. Menus, Rules, Watch and Learn and pauses do not use the preview time.' },
      ]),
      R('How this differs from the street tradition', [
        { p: 'A real performer reads each picture\'s words from the back of the card behind it, slides the pulled card to the back and ad-libs. Here every line is printed on the card\'s own back, the cards are drawn in one style and the beat is fixed. All tales are original to this game.' },
      ]),
    ],
  },
  about: {
    title: 'About',
    pages: [
      R('Kamishibai', [
        { p: 'Kamishibai means "paper theatre". It is the art of telling a story with a stack of large picture cards in a small wooden stage, called a butai. It began on the streets of Japan in the early twentieth century. Storytellers rode from town to town on bicycles, clapped wooden clappers to gather the children, and told one tale a day, a card at a time.' },
        { p: 'In the 1930s tens of thousands of storytellers were reaching about a million children every day. Today the tradition lives on in schools and libraries, where teachers and children make and tell their own.' },
      ], { story: 'lantern', card: 2 }),
      R('This game', [
        { p: 'Kamishibai is part of Arcforge, a collection of world heritage games. All ten tales, pictures and sounds were made for this game. Names, places and characters are invented.' },
        { p: 'Arrange the cards of each tale into the order of the story, then perform it for the children with a pull on the beat. Play in portrait or landscape on any phone or tablet.' },
      ], { story: 'road', card: 7 }),
    ],
  },
};

export const SCENE_TEXT = {
  arrange: 'Put the story in order.',
  perform: 'Pull each card on the beat.',
};
