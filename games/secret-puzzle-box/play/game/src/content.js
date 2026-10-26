// Text for the About, How to Play and Rules screens. Every rule here is checked against box.js / game.js.
// Blocks: { h } heading, { p } paragraph, { li: [...] } bullets. A page may carry `fig` (a drawn example).
export const ABOUT = {
  title: 'About',
  pages: [
    {
      title: 'Secret Puzzle Box',
      fig: 'box',
      body: [
        { p: 'A sequence box hides a drawer behind a lid, a front and a back that look quite ordinary. Every panel slides, but only when another panel is in the right place. Move them in the right order and the drawer opens.' },
        { p: 'Each box here is a small mystery with an exact answer. Some need five moves, the grandest need well over a hundred, and the catch that holds one panel is often on another face of the box.' },
      ],
    },
    {
      title: 'The tradition',
      body: [
        { p: 'Secret boxes, himitsu-bako, are a craft of Japan, best known from the Hakone region, where woodworkers make them from many woods and join thin strips into patterns called yosegi marquetry.' },
        { p: 'A good box may need ten, fifty or more than a hundred slides before it gives up its drawer. Makers hide the catches inside the wood, so the box is solved by touch and patience.' },
        { p: 'This game is a respectful puzzle homage, not a copy of any craftsperson\'s design. It borrows the idea of panels that free each other in sequence and the look of inlaid wood. To see the real thing, look for boxes made by Hakone craft workshops.' },
      ],
    },
    {
      title: 'Credits and ads',
      body: [
        { p: 'Free to play with short ads; go ad-free once.' },
        { p: 'Numerals and interface text are set in Fredoka, used under the SIL Open Font License 1.1. All sounds are synthesized on your device.' },
        { p: 'Secret Puzzle Box is part of Arcforge, a collection of world heritage games.' },
      ],
    },
  ],
};

export const HOWTO = {
  title: 'How to Play',
  pages: [
    {
      title: 'Slide the panels',
      fig: 'slide',
      body: [
        { p: 'Drag a panel along its groove, or tap the side of the panel you want it to move toward. A free panel glides one place and settles with a click.' },
        { p: 'Brass marks show where each panel has to end up. When every panel rests on its mark, the box opens.' },
      ],
    },
    {
      title: 'Find what holds a panel',
      fig: 'held',
      body: [
        { p: 'A panel that will not move is held by a catch. Try to slide it and the panel that holds it pulses. Move that panel to the right place and the catch lets go.' },
        { li: ['Catches often hold a panel on another face. The face tabs under the box turn it over.', 'A panel can slide back, so a wrong move can always be undone.', 'Fewer moves earn more stars.'] },
      ],
    },
    {
      title: 'Help when you want it',
      body: [
        { p: 'Think lights the panel that starts the shortest way open and says why. Tap Do it to slide it, or Close to keep going alone. Undo takes back your last move and Reset puts every panel back at its start.' },
        { p: 'Watch and Learn opens a whole box for you: it thinks, shows its choice, then slides the panel. You can pause it at any time and set how long it thinks.' },
      ],
    },
  ],
};

export const RULES = {
  title: 'Rules',
  pages: [
    {
      title: 'The box',
      fig: 'box',
      body: [
        { p: 'A box has from 2 to 8 panels spread over 1 to 3 faces: the Lid, the Front and the Back. Each panel sits in its own groove and slides in one direction only, along that groove.' },
        { p: 'A panel can rest in 3 or 4 places along its groove. Every box starts closed with every panel in the first place, at the left end or the top end of its groove.' },
      ],
    },
    {
      title: 'Moves',
      fig: 'slide',
      body: [
        { p: 'One move slides one panel by exactly one place, toward either end. A panel cannot jump over a place and cannot leave its groove.' },
        { p: 'Panels never block each other physically. Only catches stop a panel.' },
      ],
    },
    {
      title: 'Catches',
      fig: 'held',
      body: [
        { p: 'A catch holds one step of one panel: that step is possible only while one particular other panel rests in one of a few places. The other panel may be on the same face or on a different one.' },
        { p: 'Different steps of the same panel can have different catches, and some steps have none. A catch only looks at where the other panel rests; it does not care what happened before.' },
        { p: 'When you try to slide a held panel, the panel that holds it pulses so you can see where to go next. How to free it is for you to work out.' },
      ],
    },
    {
      title: 'Opening and stars',
      body: [
        { p: 'The box opens when every panel rests on its brass mark. The lid lifts, the drawer slides out and shows a small keepsake.' },
        { li: ['Every slide is one move. Undo takes a move back and Reset puts the box back to its start and clears the move count.', 'Each box has a par: the fewest moves that open it from the start, found by searching every possible position.', 'Three stars: par plus a small allowance, with no Think. Two stars: up to about one and a half times par. Any other opening gives one star.'] },
      ],
    },
    {
      title: 'Modes and simplifications',
      body: [
        { li: ['Boxes: 30 boxes in five stages, each unlocked by opening the one before.', 'Daily Box: a new box every day, the same for everyone.', 'Watch and Learn: the game opens a box using the same Think help, with a pause button and a thinking time you choose.'] },
        { p: 'Simplifications: a real box holds its catches in the wood and every slide depends on the shape of its parts. Here a catch is a clear rule between two panels, the faces turn with a flip rather than in your hands, and the keepsakes are drawings.' },
        { p: 'Text size: the A- and A+ buttons on every text screen zoom the text up to 300 percent.' },
      ],
    },
  ],
};

export const DOCS = { about: ABOUT, howto: HOWTO, rules: RULES };
