// Learn-to-play content as data. Add a lesson = add an object. Each lesson is a small scripted position; the rival
// (arm 2) never moves; the throws are scripted so the lesson is always the same. A step is finished only by DOING it.
//
// lesson: { title, mode ('pachisi'|'ludo'), me: [pos x4], rival: [pos x4], steps: [...] }
// step:   { throw: value | null (keep the last throw), text: what the coach says,
//           want: { kind, to? }  kind: 'throw' | 'move' | 'enter' | 'land' (to = position) | 'capture' | 'refused' | 'block' | 'nomove' | 'home' }
// positions: -1 yard, 0 = start square, 68.. = home lane (pachisi), 75 = centre. Rival position q meets my position p on the
// same square when q = p + 34 (mod 68) - see rules.js trackIndex.

export const LESSONS = [
  { title: 'Throw the cowries', mode: 'pachisi', me: [-1, -1, -1, -1], rival: [-1, -1, -1, -1],
    steps: [{ throw: 3, want: { kind: 'nomove' }, text: 'Six cowrie shells are your dice. TAP the cowries (or SWIPE up across them) to throw. Watch them tumble and settle.' }],
    done: 'The shells that land mouth up are counted. Three mouths up is a 3. No pawn is on the board yet, so nothing can move.' },
  { title: 'Reading the shells', mode: 'pachisi', me: [5, -1, -1, -1], rival: [-1, -1, -1, -1],
    steps: [
      { throw: 25, want: { kind: 'move' }, text: 'Count the mouths facing up: 1 = 10, 2 = 2, 3 = 3, 4 = 4, 5 = 25, 6 = 6, none = 12. TAP the cowries, then TAP your glowing pawn.' },
      { throw: 4, want: { kind: 'move' }, text: 'A 10, 25, 6 or 12 is a grace throw: you throw again after moving. Throw once more and move.' }],
    done: 'Grace throws (1, 5, 6 or no mouths up) also let a waiting pawn enter the board.' },
  { title: 'Entering the board', mode: 'pachisi', me: [-1, -1, -1, -1], rival: [-1, -1, -1, -1],
    steps: [
      { throw: 3, want: { kind: 'nomove' }, text: 'A pawn may enter only on a grace throw. Throw and read why this 3 cannot bring a pawn in.' },
      { throw: 6, want: { kind: 'enter' }, text: 'A 6 is a grace throw. TAP a pawn in your yard (the brass bowl at the lower left) to bring it onto your start square.' }],
    done: 'Your start square is marked with an X. You throw again after a grace throw.' },
  { title: 'Walking the track', mode: 'pachisi', me: [0, -1, -1, -1], rival: [-1, -1, -1, -1],
    steps: [
      { throw: 4, want: { kind: 'move' }, text: 'Pawns travel anticlockwise around the whole cross. Throw, then TAP the glowing pawn: it hops square by square.' },
      { throw: 3, want: { kind: 'move' }, text: 'The number on the shells is the number of squares. Throw again and move.' },
      { throw: 2, want: { kind: 'move' }, text: 'After the full circuit a pawn turns up the middle lane of its own arm to the centre.' }],
    done: 'Keep going: 68 squares round, then up the middle lane.' },
  { title: 'Safe squares', mode: 'pachisi', me: [2, 0, -1, -1], rival: [39, -1, -1, -1],
    steps: [{ throw: 3, want: { kind: 'land', to: 5 }, text: 'Squares marked with an X are safe: nobody can be captured there, and rivals may share them. Throw, then TAP the pawn that lands on the X. TAP it again to confirm.' }],
    done: 'A pawn on an X cannot be captured. Rivals may stand there too.' },
  { title: 'Capturing', mode: 'pachisi', me: [8, 0, -1, -1], rival: [45, -1, -1, -1],
    steps: [{ throw: 3, want: { kind: 'capture' }, text: 'Land exactly on a lone rival pawn (not on an X) to send it back to its yard. Throw, then choose the pawn that lands on the rival. TAP it, then TAP again.' }],
    done: 'Captured! You also throw again. Reaching the centre and grace throws give another throw too.' },
  { title: 'Blocks', mode: 'pachisi', me: [8, 4, -1, -1], rival: [45, 45, -1, -1],
    steps: [
      { throw: 4, want: { kind: 'refused' }, text: 'Two rival pawns on one square form a block: nobody can land on it or jump over it. TAP the front pawn to try to pass it and read the reason.' },
      { throw: null, want: { kind: 'block' }, text: 'Now build your own block: land your back pawn on your other pawn. Two of your pawns on one square are safe from capture.' }],
    done: 'A block cannot be captured, passed or landed on. Break it whenever you want to move on.' },
  { title: 'The home run', mode: 'pachisi', me: [70, -1, -1, -1], rival: [-1, -1, -1, -1],
    steps: [
      { throw: 3, want: { kind: 'move' }, text: 'Your pawn is in the middle lane. It needs exactly 5 to reach the centre. Throw and move.' },
      { throw: 4, want: { kind: 'nomove' }, text: 'Two squares left. A throw of 4 is too big: the game tells you why. Throw and read it.' },
      { throw: 2, want: { kind: 'home' }, text: 'Exactly 2. Throw again and bring the pawn home.' }],
    done: 'Home in the centre! Bring all four pawns home to win.' },
  { title: 'Ludo mode', mode: 'ludo', me: [-1, -1, -1, -1], rival: [-1, -1, -1, -1],
    steps: [
      { throw: 3, want: { kind: 'nomove' }, text: 'Ludo mode uses one die and a smaller board. Only a 6 lets a pawn out of the yard. TAP the die to throw.' },
      { throw: 6, want: { kind: 'enter' }, text: 'A 6! TAP a pawn in your yard to bring it out. A 6 always gives another throw.' },
      { throw: 4, want: { kind: 'move' }, text: 'Now move it four squares: TAP the glowing pawn.' }],
    done: 'Ludo mode has no blocks; landing on a rival captures it. Everything else is as in Pachisi.' },
];
