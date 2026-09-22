// Learn to play: ten short hands-on lessons. Each is a position and one thing to do. Add a lesson = add an object.
//   pits: 18 counts (yours 0-8 left to right, then the opponent's 9-17, see rules.js)   kazan: [yours, opponent's]   tuz: [yours, opponent's] pit or -1
//   want: pits that count as doing it right   text: what to do (says the exact command)   done: what to say afterwards
//   hint: shown when they tap a different legal pit   trap: { pit, text } a pit worth trying first: it is played, explained, then the lesson resets
// Pebbles in the pits and both kazans always total 162; `pos` fills the rest of the board with 9s and balances the kazans.
const P = (k0, over = {}, tuz = [-1, -1], mine = 8, opp = 8) => {
  const pits = new Array(18).fill(0).map((_, i) => (i < 9 ? mine : opp));
  for (const k of Object.keys(over)) pits[+k] = over[k];
  return { pits, kazan: [k0, 162 - pits.reduce((x, y) => x + y, 0) - k0], tuz };
};
const mk = (o) => ({ ...o });
export const LESSONS = [
  mk({ title: 'The first pebble stays', want: [0], ...P(0, {}, undefined, 9, 9),
    text: 'Every pit starts with nine pebbles. TAP the glowing pit on the far left of your row.',
    done: 'One pebble stayed in the pit you lifted from; the other eight went one by one into the next eight pits. That is a move.',
    hint: 'Any pit is a real move, but this lesson uses the far left one. TAP the glowing pit.' }),
  mk({ title: 'A lone pebble', want: [3], ...P(20, { 3: 1 }),
    text: 'A pit with a single pebble simply moves it on. TAP the glowing pit with one pebble.',
    done: 'A single pebble jumps into the next pit, and the pit it left is empty. Only pits with pebbles can be played.',
    hint: 'This lesson is about the pit with a single pebble. TAP the glowing pit.' }),
  mk({ title: 'Around the board', want: [8], ...P(0, { 8: 5 }),
    text: 'Pebbles travel counter-clockwise: along your row, then back along your opponent’s. TAP the glowing pit on the far right of your row.',
    done: 'Four pebbles went round the corner into the opponent’s row. The last one made a pit hold nine: an odd number, so nothing is taken.',
    hint: 'TAP the glowing pit on the far right of your row.' }),
  mk({ title: 'Taking an even pit', want: [6], ...P(0, { 6: 5, 10: 5, 3: 5 }),
    text: 'If your last pebble lands in an opponent’s pit and makes it EVEN, you take every pebble in it. TAP the glowing pit.',
    done: 'The pit held five; your last pebble made six, an even number, so all six went to your kazan.',
    hint: 'That one takes nothing. Only the glowing pit ends on an opponent’s pit that becomes even.' }),
  mk({ title: 'Odd takes nothing', want: [5], ...P(0, { 5: 5, 9: 3, 2: 6 }),
    text: 'A last pebble that makes a pit ODD takes nothing. Only one of your pits makes an even pit. TAP the glowing pit.',
    done: 'That pit held three; one more made four, so you took it. Before you sow, count where the last pebble lands and check odd or even.',
    hint: 'That pebble ends on a pit that becomes odd, so it takes nothing. TAP the glowing pit.' }),
  mk({ title: 'Long journeys', want: [1], ...P(0, { 1: 21 }),
    text: 'A big pit can go round more than once. TAP the glowing pit with 21 pebbles and watch where the last one lands.',
    done: 'The starting pit is not skipped: it receives a pebble again on the way round. The last pebble ended in your own row, so nothing was taken.',
    hint: 'TAP the glowing pit with 21 pebbles.' }),
  mk({ title: 'Making a tuz', want: [7], ...P(0, { 7: 4, 10: 2, 3: 5 }),
    text: 'If your last pebble makes an opponent’s pit hold exactly THREE, it becomes your tuz. TAP the glowing pit.',
    done: 'That pit is now your tuz, marked with a flag. You took its three pebbles, and from now on every pebble that lands there is yours.',
    hint: 'That one does not make a three. Only the glowing pit ends on the pit holding two.' }),
  mk({ title: 'A tuz pays', want: [4], ...P(30, { 4: 12, 12: 0 }, [12, -1], 2, 8),
    text: 'Your tuz is the flagged pit on your opponent’s row. TAP the glowing pit and watch a pebble drop into it.',
    done: 'The pebble that landed in your tuz went straight to your kazan. The tuz stays empty and can never be played by either side.',
    hint: 'TAP the glowing pit: its pebbles pass your tuz.' }),
  mk({ title: 'Tuz limits', want: [6], trap: { pit: 8, text: 'That pit made three in your opponent’s 9th pit, and a tuz can never be made there. Nothing was taken. The lesson is set up again.' },
    ...P(0, { 8: 10, 6: 6, 17: 2, 11: 2 }, [-1, -1], 2, 8),
    text: 'A tuz has limits. First TAP the pit on the far right: it ends on the opponent’s 9th pit. Then TAP the other glowing pit.',
    done: 'Each player may have only one tuz, never in the opponent’s 9th pit, and never in a pit with the same number as the opponent’s tuz.',
    hint: 'TAP the other glowing pit to make a real tuz.' }),
  mk({ title: 'Reaching 82', want: [7], ...P(80, { 7: 4, 10: 1, 2: 1 }, [-1, -1], 0, 0),
    text: 'The first player to collect 82 pebbles wins: more than half of 162. You have 80. TAP the glowing pit to take two more.',
    done: 'That makes 82: you win. If a player has no pebbles to move, the other player collects the pebbles on their own side. 81 each is a draw.' }),
];
