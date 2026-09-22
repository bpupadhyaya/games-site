// Learn to play: 8 short hands-on lessons, each a staged position with one thing to do. The lesson runner in
// game.js calls rules.apply() for real and checks the resulting event against `want`.
//   want: 'atk' | 'def' | 'xfer' | 'take' | 'pass' | 'win'
//     'win' means: after the move, the game is over and the taught seat (g.you) is not the fool.
//   at: optional list of card ids the move must use, so the lesson stays specific.
import { suitOf } from './rules.js';

// Ranks: 0..8 = 6,7,8,9,10,J,Q,K,A. Suits: 0 spades, 1 hearts, 2 diamonds, 3 clubs. Trump is hearts in every lesson.
const S = 0, H = 1, D = 2, C = 3;
const card = (suit, rank) => suit * 9 + rank;

// Builds a ready-to-play fixture. `you` is the seat the lesson is teaching (game.js reads it to orient the camera
// and input); `actor` (default = you) is who moves first.
function fixture({ n = 2, mode = 'pod', trump = H, hands, table = [], you = 0, actor, defender = 0, attacker = 1, phase = 'lead', taking = false, stock = [] }) {
  const used = new Set([...hands.flat(), ...table.flatMap((t) => (t.d >= 0 ? [t.a, t.d] : [t.a])), ...stock]);
  const trumpCard = stock.length ? stock[0] : [...Array(36).keys()].find((c) => suitOf(c) === trump && !used.has(c));
  return {
    n, mode, hands: hands.map((h) => h.slice()), stock: stock.slice(), trump, trumpCard, discard: [],
    table: table.map((t) => ({ a: t.a, d: t.d ?? -1 })), attacker, defender, actor: actor ?? you, phase, taking,
    passes: 0, cap: 6, first: false, out: new Array(n).fill(false), finished: [], loser: -1, over: false, bout: 1,
    known: hands.map(() => []), refused: [], you,
  };
}

export const LESSONS = [
  {
    title: 'The cards and the trump', want: 'atk',
    text: 'This is your hand, sorted by suit with the trump suit last. Whoever holds the lowest trump attacks first. TAP any card in your hand to lead it.',
    done: 'That is an attack: any card, to start the round.',
    build: () => fixture({ you: 0, actor: 0, attacker: 0, defender: 1, hands: [[card(S, 0), card(S, 3), card(D, 5), card(H, 1)], [card(C, 2), card(C, 6), card(D, 1), card(D, 4)]] }),
  },
  {
    title: 'Beat a card', want: 'def', at: [card(S, 7)],
    text: 'A nine of spades is on the table. TAP your King of spades to beat it: a higher card of the same suit.',
    done: 'Beaten: a higher card of the same suit always works.',
    build: () => fixture({ you: 0, phase: 'defend', table: [{ a: card(S, 3) }], hands: [[card(S, 7), card(D, 5)], [card(C, 2), card(H, 0)]] }),
  },
  {
    title: 'Trumps', want: 'def', at: [card(H, 0)],
    text: 'An Ace of clubs is on the table and you hold no clubs. TAP your six of hearts, the trump suit: any trump beats any plain card.',
    done: 'A trump beats any card of a different suit, even a small one.',
    build: () => fixture({ you: 0, phase: 'defend', table: [{ a: card(C, 8) }], hands: [[card(H, 0), card(D, 2)], [card(C, 4), card(S, 1)]] }),
  },
  {
    title: 'Pick up', want: 'take',
    text: 'The trump Ace is on the table: nothing beats it. TAP Take to pick it up instead.',
    done: 'Taking is not losing: it only means you carry these cards a little longer.',
    build: () => fixture({ you: 0, phase: 'defend', table: [{ a: card(H, 8) }], hands: [[card(D, 5), card(C, 3)], [card(H, 5), card(S, 6)]] }),
  },
  {
    title: 'Throw in', want: 'atk', at: [card(D, 3)],
    text: 'A nine is already on the table, beaten. You hold another nine: TAP it to throw in. The defender must beat that one too.',
    done: 'Any card whose RANK is already on the table can be thrown in, from any suit.',
    build: () => fixture({ you: 0, actor: 0, attacker: 0, defender: 1, phase: 'throw', table: [{ a: card(S, 3), d: card(S, 6) }], hands: [[card(D, 3), card(C, 0)], [card(H, 2), card(C, 5)]] }),
  },
  {
    title: 'Bito and refill', want: 'pass',
    text: 'Everything on the table is beaten and you have nothing worth adding. TAP Bito to end the round: the cards are discarded and hands refill from the stock.',
    done: 'Bito clears the table for good. The defender becomes the next attacker.',
    build: () => fixture({ you: 0, actor: 0, attacker: 0, defender: 1, phase: 'throw', table: [{ a: card(S, 3), d: card(S, 6) }], hands: [[card(D, 4)], [card(H, 4), card(C, 5)]], stock: [card(C, 0), card(C, 1), card(H, 3), card(D, 8)] }),
  },
  {
    title: 'Transfer', want: 'xfer', at: [card(D, 4)],
    text: 'In Perevodnoy you may pass an unbeaten attack on, before anything is beaten: TAP your ten of diamonds to match the rank and send it to the next player.',
    done: 'A transfer needs the next player to hold enough cards, and only works before anything on the table is beaten.',
    build: () => fixture({ n: 3, mode: 'per', you: 0, defender: 0, attacker: 2, phase: 'defend', table: [{ a: card(S, 4) }], hands: [[card(D, 4), card(S, 0)], [card(C, 1), card(H, 3), card(D, 0)], []] }),
  },
  {
    title: 'The endgame', want: 'win', at: [card(H, 8)],
    text: 'The stock is empty and this is your last card. TAP your Ace of hearts, the trump, to beat their last card on the table.',
    done: 'Empty-handed when the stock runs out means you are safe. Whoever is left holding cards alone is the fool.',
    build: () => fixture({ you: 0, phase: 'defend', table: [{ a: card(D, 8) }], hands: [[card(H, 8)], [card(C, 1)]] }),
  },
];
