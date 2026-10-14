// Numbers and tables shared by the engine, the drawing and the Rules text, so the Rules page can never disagree with the engine.
// The floor holds eight dancers on eight places, counted counter-clockwise from the bottom-left (slot 0). Even slots are the gents' places in the
// home set, odd slots the ladies'. A call is a table `to`: the dancer standing on slot s walks to slot to[s].
export const N = 8;
export const BEATS = 8;               // one call fills one phrase of eight beats
export const FILL_BEATS = 8;          // the floor swings partners when no call was made in time
export const TEMPOS = [96, 108, 120, 132];
export const PACES = ['Relaxed', 'Easy', 'Lively'];   // Relaxed: the music waits for your call. Easy / Lively: it does not.
export const PACE_MUL = [1.0, 1.0, 1.25];              // tempo multiplier for Relaxed / Easy / Lively
export const SLACK_ONE = 1;           // two stars: at most this many extra phrases
export const SLACK_TIP = 4;           // the tip is this many phrases longer than the shortest way home
export const HINT_COST = 1;           // phrases added to a square that used the Think hint
export const THINK_STEPS = [2, 5, 8, 10];
export const SQUARES_PER_TIP = 5;
export const MARATHON_LIVES = 2;
export const DEMO_LEVELS = 12;
export const DEMO_MARATHON_CAP = 5;

const R = (s, k) => (((s + k) % N) + N) % N;
const ident = () => Array.from({ length: N }, (_, i) => i);
const swaps = (...pairs) => { const t = ident(); for (const [a, b] of pairs) { t[a] = b; t[b] = a; } return t; };
const evenShift = (k) => { const t = ident(); for (let s = 0; s < N; s += 2) t[s] = R(s, k); return t; };
const oddShift = (k) => { const t = ident(); for (let s = 1; s < N; s += 2) t[s] = R(s, k); return t; };
const rot = (k) => Array.from({ length: N }, (_, s) => R(s, k));

// kind decides how the dancers are animated; to is the move itself.
export const CALLS = [
  { id: 'cl4', label: 'Circle left ¼', short: 'Circle ¼', kind: 'rot', to: rot(2), say: 'Circle left, a quarter around' },
  { id: 'cl2', label: 'Circle left ½', short: 'Circle ½', kind: 'rot', to: rot(4), say: 'Circle left, halfway round' },
  { id: 'cr4', label: 'Circle right ¼', short: 'Circle right', kind: 'rot', to: rot(-2), say: 'Circle right, a quarter around' },
  { id: 'hlc', label: 'Heads lady chain', short: 'Heads chain', kind: 'chain', to: swaps([1, 5]), say: 'Head ladies chain across the ring' },
  { id: 'slc', label: 'Sides lady chain', short: 'Sides chain', kind: 'chain', to: swaps([3, 7]), say: 'Side ladies chain across the ring' },
  { id: 'hrl', label: 'Heads right and left through', short: 'Heads R & L thru', kind: 'rlt', to: swaps([0, 4], [1, 5]), say: 'Head couples right and left through' },
  { id: 'srl', label: 'Sides right and left through', short: 'Sides R & L thru', kind: 'rlt', to: swaps([2, 6], [3, 7]), say: 'Side couples right and left through' },
  { id: 'gr2', label: 'Grand right and left, hand 2', short: 'Grand R & L, 2', kind: 'grand', n: 2, to: oddShift(-2), say: 'Allemande left, grand right and left, count two hands, promenade home' },
  { id: 'gr3', label: 'Grand right and left, hand 3', short: 'Grand R & L, 3', kind: 'grand', n: 3, to: oddShift(-4), say: 'Allemande left, grand right and left, count three hands, promenade home' },
  { id: 'gr4', label: 'Grand right and left, hand 4', short: 'Grand R & L, 4', kind: 'grand', n: 4, to: oddShift(-6), say: 'Allemande left, grand right and left, count four hands, promenade home' },
  { id: 'gs4', label: 'Gents star left ¼', short: 'Gents star ¼', kind: 'star', to: evenShift(2), say: 'Gents star left, a quarter, and ladies hold your place' },
  { id: 'gs2', label: 'Gents star left ½', short: 'Gents star ½', kind: 'star', to: evenShift(4), say: 'Gents star left, halfway, and ladies hold your place' },
  { id: 'hpt', label: 'Heads pass thru', short: 'Heads pass thru', kind: 'pass', to: swaps([0, 5], [1, 4]), say: 'Head couples pass thru' },
  { id: 'spt', label: 'Sides pass thru', short: 'Sides pass thru', kind: 'pass', to: swaps([2, 7], [3, 6]), say: 'Side couples pass thru' },
  { id: 'c1s', label: 'Couple 1 half sashay', short: 'Couple 1 sashay', kind: 'sashay', to: swaps([0, 1]), say: 'Number one couple, half sashay' },
  { id: 'c2s', label: 'Couple 2 half sashay', short: 'Couple 2 sashay', kind: 'sashay', to: swaps([2, 3]), say: 'Number two couple, half sashay' },
  { id: 'c3s', label: 'Couple 3 half sashay', short: 'Couple 3 sashay', kind: 'sashay', to: swaps([4, 5]), say: 'Number three couple, half sashay' },
  { id: 'c4s', label: 'Couple 4 half sashay', short: 'Couple 4 sashay', kind: 'sashay', to: swaps([6, 7]), say: 'Number four couple, half sashay' },
  { id: 'hsa', label: 'Heads half sashay', short: 'Heads sashay', kind: 'sashay', to: swaps([0, 1], [4, 5]), say: 'Head couples half sashay' },
  { id: 'ssa', label: 'Sides half sashay', short: 'Sides sashay', kind: 'sashay', to: swaps([2, 3], [6, 7]), say: 'Side couples half sashay' },
];
export const SWING = { id: 'swing', label: 'Swing your partner', short: 'Swing', kind: 'swing', to: ident(), say: 'Swing your partner, and swing her around' };
export const CALL_BY_ID = Object.fromEntries([...CALLS, SWING].map((c) => [c.id, c]));
export const callIdx = (id) => CALLS.findIndex((c) => c.id === id);

export const COUPLES = [
  { n: 1, name: 'Coral', col: '#e5484d', dark: '#8f1d28', light: '#ff8f8a' },
  { n: 2, name: 'Gold', col: '#f2b01e', dark: '#9a6200', light: '#ffe08a' },
  { n: 3, name: 'Teal', col: '#17a398', dark: '#0b5f5b', light: '#7be0d2' },
  { n: 4, name: 'Violet', col: '#7a5af8', dark: '#3f2aa3', light: '#c2b3ff' },
];

// Tips (sets of five squares): which calls are on the card, how many calls were used to scramble the floor and how short the way home may be.
export const TIPS = [
  { id: 'barn', name: 'Barn Dance', place: 'The farm barn', look: 0, tempo: 96, cards: ['cl4', 'hlc', 'slc', 'c1s'], depth: [1, 2, 2, 3, 3] },
  { id: 'grange', name: 'Grange Hall', place: 'The grange hall', look: 1, tempo: 100, cards: ['cl4', 'cl2', 'hlc', 'slc', 'hrl', 'c1s'], depth: [2, 3, 3, 4, 4] },
  { id: 'town', name: 'Town Hall', place: 'The town hall', look: 2, tempo: 104, cards: ['cl4', 'hlc', 'hpt', 'spt', 'c2s', 'gr3'], depth: [3, 4, 4, 5, 5] },
  { id: 'fair', name: 'County Fair', place: 'The fairground pavilion', look: 3, tempo: 108, cards: ['cl4', 'hlc', 'hpt', 'c1s', 'gr2', 'srl'], depth: [4, 4, 5, 5, 6] },
  { id: 'star', name: 'Starlight Hoedown', place: 'The open-air platform', look: 4, tempo: 112, cards: ['cl4', 'hlc', 'hpt', 'gs4', 'c1s', 'gr2', 'srl'], depth: [5, 5, 6, 6, 7] },
  { id: 'jam', name: 'Jamboree', place: 'The big hall', look: 5, tempo: 116, cards: ['cl4', 'cr4', 'slc', 'hrl', 'gr3', 'gs2', 'c3s'], depth: [6, 6, 7, 7, 8] },
];
export const LEVELS = TIPS.flatMap((t, ti) => t.depth.map((d, k) => ({ idx: ti * SQUARES_PER_TIP + k, tip: ti, k, minOpt: d, tempo: t.tempo + k * 2 })));

export const LESSONS = [
  { id: 'circle', title: 'Circle', goal: 'Bring the set home with circle calls only', calls: ['cl4', 'cl2'], scramble: ['cl4'], intro: [
    'Everyone moves together. Circle left a quarter moves every dancer two places round, counter-clockwise. Four quarters bring them back where they began.',
    'This floor was turned one quarter. Make one call that brings everyone home.'] },
  { id: 'chain', title: 'Lady chain', goal: 'Return the head ladies to their own gents', calls: ['hlc', 'slc'], scramble: ['hlc'], intro: [
    'In a lady chain the two ladies cross the ring and swap places, while the gents stay where they are. Heads are the couples at the bottom and the top, sides are the couples at left and right.',
    'The two head ladies have been chained. Call the chain that sends them back.'] },
  { id: 'thru', title: 'Right and left through', goal: 'Send two couples back across the ring', calls: ['hrl', 'srl'], scramble: ['srl'], intro: [
    'In a right and left through, two facing couples cross the ring and trade places, each pair staying together.',
    'The side couples have crossed over. Call the figure that sends them home.'] },
];
