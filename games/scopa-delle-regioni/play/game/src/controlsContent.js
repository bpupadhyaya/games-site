// Controls / how-to-play reference, paginated one short instruction per page like about.js and
// rulesContent.js, so it still reads comfortably at the largest text size, 300%. A page that was
// two instructions at the last pass is split here into one instruction per page; never shrink
// the font to force a fit.
export const CONTROLS = [
  {
    title: 'Play a card',
    lines: ['TAP a card in your hand. It lifts.'],
  },
  {
    title: 'Confirm the play',
    lines: ['TAP the same card again to play it.'],
  },
  {
    title: 'Take cards',
    lines: ['TAP the glowing table cards you want to take.'],
  },
  {
    title: 'Auto capture',
    lines: ['When they add up, the capture plays itself.'],
  },
  {
    title: 'A matching card',
    lines: ['If a table card has the same number, take it.'],
  },
  {
    title: 'Alone, not added',
    lines: ['You must take that single matching card alone.'],
  },
  {
    title: 'Lay a card down',
    lines: ['If nothing can be taken, TAP the lifted card again.'],
  },
  {
    title: 'Or tap the table',
    lines: ['You can also TAP the table to lay it down.'],
  },
  {
    title: 'Take it back',
    lines: ['TAP a selected table card to put it back.'],
  },
  {
    title: 'Pick a card',
    lines: ['Or TAP another card in your hand instead.'],
  },
  {
    title: 'Hint',
    lines: ['TAP Hint for a good play and the reason.'],
  },
  {
    title: 'Undo',
    lines: ['TAP Undo to take back your last play.'],
  },
  {
    title: 'Picking a card',
    lines: ['1, 2, 3 pick a card.'],
  },
  {
    title: 'Table card keys',
    lines: ['Left and Right move over the table cards.'],
  },
  {
    title: 'Keyboard: play',
    lines: ['Enter selects a table card, Space plays.'],
  },
  {
    title: 'H and U keys',
    lines: ['H asks for a hint, U undoes.'],
  },
  {
    title: 'Keyboard: menu',
    lines: ['Esc opens the menu.'],
  },
];
