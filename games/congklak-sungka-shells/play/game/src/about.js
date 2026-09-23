// The heritage page: short, factual, respectful. Anything not certain is left out.
export const ABOUT = {
  title: 'About Congklak',
  parts: [
    ['One game, many names', 'This game is called Congklak in Indonesia (also Dakon in Javanese), Congkak in Malaysia, Brunei and Singapore, and Sungka in the Philippines. It belongs to the mancala family of sowing games.'],
    ['The board', 'Boards are carved from wood, often long and shaped like a boat, with two rows of seven cup-shaped houses and a larger storehouse at each end. The standard game uses 98 pieces: seven in every house.'],
    ['The pieces', 'Traditionally the pieces are cowrie shells, which is one reason the game’s name has come to mean the shells themselves, or small seeds and pebbles. With no board at all, people have scooped holes in the ground.'],
    ['How it is played', 'Both players begin at the same moment, sowing shells one by one round the board and into their own storehouse only. Where the last shell lands decides whether you play on, take shells, or pass the turn.'],
    ['Rounds and burnt houses', 'After a round each player refills their houses from their storehouse. A player who cannot fill a house has it burnt shut, and the match goes on until one player has no houses left.'],
    ['These rules', 'This game follows the common Indonesian and Malay rules with one small simplification: the player who finishes the opening first moves next. Local rules vary from family to family, and that is part of the fun.'],
  ],
};

// Exhaustive rules reference. Every claim here is cross-checked against the actual implementation in
// rules.js (the single source of truth for legality) so this page can never contradict the engine.
// `art` names an illustration drawn with the board's own real pit/store/seed drawing functions
// (art.js) — never a separate simplified icon.
export const RULES = [
  {
    title: 'The board and setup',
    lines: [
      'Fourteen small houses in all: seven in your own column, the right-hand side you tap, and seven in your opponent’s column on the left. Each house starts with 7 shells — 98 shells on the board altogether.',
      'Each side also has one storehouse: yours at the bottom of your column, your opponent’s at the top of theirs. Both storehouses start empty.',
    ],
  },
  {
    title: 'Setup: who moves first',
    lines: [
      'To begin, both players choose one of their own houses and sow it at exactly the same moment (see “The simultaneous opening”, later on this page list). Whichever side’s sowing finishes first is the one who moves next; on an exact tie, player one moves next.',
      '(This page covers the rules only — see Controls for how to tap and play.)',
    ],
  },
  {
    title: 'A house (small pit)',
    art: 'house',
    lines: [
      'Each small house holds shells — yours or your opponent’s — and can be sown from or sown into. Tapping one of your own houses that has shells lifts every shell out of it, leaving it empty, and sows them one by one into the houses ahead: up your own column, across the top, and down your opponent’s column — reaching your own storehouse and starting round the board again if there are enough shells to go that far.',
    ],
  },
  {
    title: 'A house: whose you can tap',
    lines: [
      'Both players sow into every house on the board, yours and your opponent’s alike — only the two storehouses are private. You can never tap an empty house, one of your opponent’s houses, or a house that has been burnt shut (see later pages).',
    ],
  },
  {
    title: 'Your storehouse — and playing again',
    art: 'store',
    lines: [
      'Your storehouse banks your shells. Once a shell lands there it is safe for the rest of the round and is never sown again until houses are refilled between rounds.',
      'If the very last shell you sow lands exactly in your own storehouse, your turn does not pass — you immediately choose another house of yours and sow again. A good run can chain several of these “play again” turns in a row.',
      'Sowing always skips over your opponent’s storehouse completely: no shell of yours is ever dropped there, and landing in it is never possible.',
    ],
  },
  {
    title: 'Relay sowing',
    lines: [
      'If the very last shell you sow lands in a house — yours or your opponent’s — that already had one or more shells in it, you immediately scoop up everything now sitting in that house, including the shell you just dropped, and keep sowing onward from there. This costs nothing extra and does not end your turn: it is still the same single move.',
    ],
  },
  {
    title: 'Relay sowing: how far it can run',
    lines: [
      'A relay can circle the board more than once — if it comes back around to the house it started from, that house (now empty) simply receives a shell like any other. Relays are rare but can run long: the longest seen in this game’s own testing is 342 shells sown in one move. As a safety limit, a single relay is never let run past 500 shells sown.',
    ],
  },
  {
    title: 'The simultaneous opening',
    lines: [
      'At the very start of every round, both players choose one of their own houses and sow at the same moment — both hands move on the shared board together, one shell at a time, rather than one player waiting for the other.',
      'Because the board is shared while this happens, it is possible, though unusual, for one player’s sowing to relay back around to the very house the other player already emptied a moment before; when that happens, that side’s turn simply ends there with nothing more to do.',
      'Whichever side’s opening sow finishes first is the one who takes the next ordinary turn. If both finish at exactly the same instant, player one moves next.',
    ],
  },
  {
    title: 'Capturing (the shoot)',
    art: 'capture',
    lines: [
      'If the very last shell you sow lands in one of your OWN houses that was completely empty a moment before, look at the house directly opposite it, on your opponent’s side. If that opposite house has one or more shells in it, you capture: every shell in it, plus the one shell you just dropped, all go straight into your own storehouse at once, emptying both houses.',
      'If the opposite house is empty too, nothing is captured — your dropped shell simply stays put in your own empty house, and your turn ends as normal.',
    ],
  },
  {
    title: 'Capturing: what never triggers it',
    lines: [
      'Landing your last shell in an empty house on your OPPONENT’s side never captures anything, no matter what: the shell stays there and your turn ends. Only an empty house on your own side can ever trigger a capture.',
      'A capture, or a sow that lands harmlessly in an empty house, always ends your turn — unlike landing in your own storehouse, it never earns you another go.',
    ],
  },
  {
    title: 'How a round ends',
    lines: [
      'A round ends the instant the player about to move has no shells left in any of their own houses.',
      'At that moment every remaining shell is swept home at once: whatever is left in your houses goes into your own storehouse, and whatever is left in your opponent’s houses goes into theirs. No shell sitting in a house carries over into the next round.',
      'Whoever has more shells in their storehouse once everything is swept home wins that round; an exact tie is a tied round.',
    ],
  },
  {
    title: 'Refilling houses, and burnt houses',
    lines: [
      'If the match continues into another round, each player refills their own houses back up to 7 shells, spending shells from their own storehouse, filling the house nearest their own storehouse first, then the next, and so on.',
      'Any house that side cannot refill — because they have run out of open houses, or simply do not have 7 shells left to spend — is burnt shut for the rest of the match: skipped by every future sow, on both sides, and never filled or played again.',
    ],
  },
  {
    title: 'Refilling: leftovers and a failed refill',
    lines: [
      'Leftover shells that are not enough to fill a whole house stay banked safely in the storehouse.',
      'If a player cannot refill even a single house, the match ends immediately in the other player’s favour — no further round is played.',
    ],
  },
  {
    title: 'Winning the match',
    lines: [
      'Match length is chosen in Settings: One round (a single round decides everything), Three rounds (best of three), or Full match (up to nine rounds).',
      'Across a match of more than one round, whoever has won more rounds by the end wins the match. If rounds won are tied after the last round played, the match is decided instead by that final round’s own storehouse count; if that is tied too, the match is a draw.',
      'A match can also end earlier than its planned length the moment a player is unable to refill any house after a round (see the previous page) — the other player wins immediately.',
    ],
  },
];

// The Controls / How to play page. Always the same capital-letter verbs: TAP, HOLD (not used), DRAG (not used).
export const HOWTO = {
  title: 'How to play',
  parts: [
    ['Controls', 'TAP a glowing house on your side (the right-hand column) to sow it. That is every control: there is no DRAG and no HOLD. TAP anywhere while shells are moving to fast-forward.'],
    ['Buttons', 'Undo takes back your last move. Hint shows a good move and says why (3 per game). Menu leaves the game; it is saved.'],
    ['Keyboard', 'UP and DOWN move along your column, ENTER or SPACE sows, U is Undo, H is Hint, F fast-forwards, ESC opens the menu.'],
    ['Sowing', 'Lift every shell from one of your houses and drop one in each place ahead, going up your column, across the top and down the other. Your storehouse gets a shell; your opponent’s never does.'],
    ['Where the last shell lands', 'Your storehouse: play again. A house with shells: scoop them all up and keep sowing. Your own empty house: take everything in the house opposite. An empty house on the other side: your turn ends.'],
    ['Rounds', 'A round ends when the player to move has no shells. Then houses are refilled from the storehouses; a player who cannot fill a house has it burnt shut. Choose one round, three or a full match in Settings.'],
  ],
};
