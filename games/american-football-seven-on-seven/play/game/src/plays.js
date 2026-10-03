// The play book. Coordinates are relative to the line of scrimmage and the offence's direction of attack:
// u = yards past the line (negative = behind it), v = lateral (positive = the offence's right hand). The sim turns them into field x/z.
// Offence slots: QB RB WA (receiver, left) TE WB (receiver, right) C G.  Defence slots: S LB1 CB1 DL1 CB2 DL2 LB2.

export const OFF_SLOTS = ['QB', 'RB', 'WA', 'TE', 'WB', 'C', 'G'];
export const DEF_SLOTS = ['S', 'LB1', 'CB1', 'DL1', 'CB2', 'DL2', 'LB2'];

// default offence line-up (u, v)
const OFF0 = { QB: [-4.5, 0], RB: [-4.6, 2.3], WA: [-0.5, -10], TE: [-0.5, 1.7], WB: [-0.5, 10], C: [-0.5, 0], G: [-0.5, -1.7] };

// block kinds: 'pass' (pocket), 'run' (drive the nearest defender along the run), 'stalk' (block a corner downfield), 'screen' (let rushers by, then lead), 'lead' (RB lead block)
// route: waypoints [u, v] (absolute in line-of-scrimmage terms); the receiver runs them in order at spd * run, slowing a little at each break.
export const OFF_PLAYS = [
  {
    id: 'inside', name: 'Inside Run', kind: 'run', short: 'Hand to the running back up the middle.',
    desc: 'The quarterback hands off to the running back, who follows the centre and guard through the middle. The receivers block the corners.',
    handoff: { to: 'RB', t: 0.75, at: [-3.2, 0.9] }, carrier: 'RB', hole: [3, 0.7], hold: 1.6,
    form: {}, routes: { RB: [[-3.2, 0.9]] },
    blocks: { C: 'run', G: 'run', TE: 'run', WA: 'stalk', WB: 'stalk', QB: 'fake' },
    strong: ['run'], weak: ['blitz'], tags: ['RB'],
  },
  {
    id: 'outside', name: 'Outside Run', kind: 'run', short: 'Toss to the back, run to the edge.',
    desc: 'A quick toss to the running back, who runs wide to the right sideline behind the tight end. The left receiver blocks.',
    handoff: { to: 'RB', t: 0.5, at: [-3.8, 4.2], toss: true }, carrier: 'RB', hole: [4, 9], hold: 1.2,
    form: {}, routes: { RB: [[-4.0, 5.2]] },
    blocks: { C: 'run', G: 'run', TE: 'run', WA: 'stalk', QB: 'fake' },
    strong: ['zone', 'prevent'], weak: ['runstop', 'blitz'], tags: ['RB'],
  },
  {
    id: 'quick', name: 'Quick Pass', kind: 'pass', short: 'Three-step drop, short routes.',
    desc: 'A three-step drop and a fast throw to a short route: a slant, a hitch, a drag or a back out of the backfield.',
    drop: { u: -6.0, t: 0.55 }, ready: 0.85, max: 2.4, primary: 'WA', reads: ['WA', 'TE', 'WB', 'RB'],
    form: {}, routes: {
      WA: [[3, -10], [4.8, -6.6]], WB: [[5.5, 10], [4.2, 9.2]], TE: [[1.8, 2.5], [2.8, 6.5], [3.0, 11]], RB: [[-4.2, 6], [-1.2, 9.5]],
    },
    blocks: { C: 'pass', G: 'pass', QB: 'qb' },
    strong: ['blitz', 'prevent'], weak: ['man'], tags: ['WR', 'TE'],
  },
  {
    id: 'deep', name: 'Deep Pass', kind: 'pass', short: 'Long drop, receivers run deep.',
    desc: 'A five-step drop while the receivers run deep: a go on the left, a post on the right, a seam for the tight end. The quarterback waits for them to get open.',
    drop: { u: -7.6, t: 0.9 }, ready: 1.7, max: 3.4, primary: 'WA', reads: ['WA', 'WB', 'TE'],
    form: {}, routes: {
      WA: [[8, -10], [21, -9.3]], WB: [[8.5, 10], [13, 6.5], [20, 1.5]], TE: [[5, 2.4], [14, 1.1]], RB: [],
    },
    blocks: { C: 'pass', G: 'pass', RB: 'pass', QB: 'qb' },
    strong: ['runstop', 'zone'], weak: ['prevent', 'blitz'], tags: ['WR'],
  },
  {
    id: 'screen', name: 'Screen Pass', kind: 'pass', short: 'Let the rush in, throw behind the line.',
    desc: 'The line lets the rushers come, the quarterback drops back and flips a short pass to the running back behind the line, with the tight end, centre and guard running ahead to block.',
    drop: { u: -7.0, t: 0.7 }, ready: 1.35, max: 2.4, primary: 'RB', reads: ['RB'], screen: true,
    form: {}, routes: { RB: [[-5.6, 5.4], [-4.8, 9]], WA: [[8, -10], [22, -8]], WB: [[8, 10], [22, 8.5]], TE: [] },
    blocks: { C: 'screen', G: 'screen', TE: 'screen', QB: 'qb' },
    strong: ['blitz', 'man'], weak: ['zone', 'runstop'], tags: ['RB'],
  },
  {
    id: 'playaction', name: 'Play-Action', kind: 'pass', short: 'Fake the run, then throw.',
    desc: 'The quarterback fakes the handoff to the running back, which can pull the linebackers forward, then drops and throws to the tight end crossing the field or a receiver behind them.',
    drop: { u: -7.6, t: 1.05 }, ready: 1.9, max: 3.4, primary: 'TE', reads: ['TE', 'WA', 'WB'], fake: { to: 'RB', t: 0.65 },
    form: {}, routes: { TE: [[4.5, 3], [8.5, -3.5], [9.5, -10]], WA: [[7, -10], [13, -5], [19, -3]], WB: [[7, 10], [13, 12.4]], RB: [[-3.2, 0.9], [0.4, 0.7]] },
    blocks: { C: 'pass', G: 'pass', QB: 'qb' },
    strong: ['runstop', 'zone'], weak: ['blitz', 'prevent'], tags: ['TE', 'QB'],
  },
  {
    id: 'jet', name: 'Jet Sweep', kind: 'run', short: 'The receiver takes a handoff on the move.',
    desc: 'The right receiver runs across the backfield before the snap, takes the handoff at speed and runs to the left edge. The running back leads the way.',
    handoff: { to: 'WB', t: 0.5, at: [-3.5, 1.2] }, carrier: 'WB', hole: [3.5, -8], hold: 1.1,
    form: { WB: [-1.2, 6.5] }, motion: { slot: 'WB', to: [-3.2, 3.2], t: 0.75 }, routes: { WB: [[-3.5, 1.2]] },
    blocks: { C: 'run', G: 'run', TE: 'run', WA: 'stalk', RB: 'lead', QB: 'fake' },
    strong: ['zone', 'runstop'], weak: ['man', 'blitz'], tags: ['WR'],
  },
  {
    id: 'qbdraw', name: 'QB Draw', kind: 'run', short: 'Look like a pass, then run it yourself.',
    desc: 'The quarterback drops back as if to pass, then keeps the ball and runs through the middle while the pass rushers are upfield.',
    draw: { u: -5.2, t: 0.55 }, carrier: 'QB', hole: [4, 0.5], hold: 1.0,
    form: {}, routes: { WA: [[8, -10], [18, -9]], WB: [[8, 10], [18, 9]], TE: [[4, 2.5], [10, 5]] },
    blocks: { C: 'pass', G: 'pass', RB: 'lead', QB: 'draw' },
    strong: ['blitz', 'prevent'], weak: ['runstop'], tags: ['QB'],
  },
];

// ---- defence ----------------------------------------------------------------------------------------------------------------------------------
// task kinds: rush (lane v), man (slot), zone (u, v, radius), spy, fill (u, v), deep (u, v)
export const DEF_CALLS = [
  {
    id: 'man', name: 'Man', short: 'Each defender covers one receiver.',
    desc: 'Both corners cover the receivers, one linebacker covers the running back, the other covers the tight end, the safety plays deep. The two linemen rush.',
    form: { CB1: [3.2, -9.6], CB2: [3.2, 9.6], S: [10, 0] },
    tasks: { DL1: { k: 'rush', lane: -0.9 }, DL2: { k: 'rush', lane: 0.9 }, LB1: { k: 'man', on: 'RB' }, LB2: { k: 'man', on: 'TE' }, CB1: { k: 'man', on: 'WA' }, CB2: { k: 'man', on: 'WB' }, S: { k: 'deep', u: 12, v: 0 } },
    strong: ['quick', 'qbdraw'], weak: ['screen', 'jet'], tags: [],
  },
  {
    id: 'zone', name: 'Zone', short: 'Defenders guard areas of the field.',
    desc: 'The linebackers guard the middle, the corners guard the flats, the safety guards deep. The two linemen rush.',
    form: { CB1: [5.5, -9.6], CB2: [5.5, 9.6], LB1: [4.5, -3.2], LB2: [4.5, 3.2], S: [12, 0] },
    tasks: { DL1: { k: 'rush', lane: -0.9 }, DL2: { k: 'rush', lane: 0.9 }, LB1: { k: 'zone', u: 6.5, v: -3.8, r: 4.2 }, LB2: { k: 'zone', u: 6.5, v: 3.8, r: 4.2 }, CB1: { k: 'zone', u: 6.0, v: -9.2, r: 4.8 }, CB2: { k: 'zone', u: 6.0, v: 9.2, r: 4.8 }, S: { k: 'deep', u: 15, v: 0 } },
    strong: ['inside', 'quick', 'inside'], weak: ['deep', 'outside', 'playaction'], tags: [],
  },
  {
    id: 'blitz', name: 'Blitz', short: 'Extra rushers go after the quarterback.',
    desc: 'Both linebackers join the two linemen to rush the quarterback. The corners and the safety cover the receivers; nobody covers the running back.',
    form: { LB1: [1.9, -2.4], LB2: [1.9, 2.4], CB1: [3.0, -9.6], CB2: [3.0, 9.6], S: [8, 0] },
    tasks: { DL1: { k: 'rush', lane: -0.9 }, DL2: { k: 'rush', lane: 0.9 }, LB1: { k: 'rush', lane: -2.4 }, LB2: { k: 'rush', lane: 2.4 }, CB1: { k: 'man', on: 'WA' }, CB2: { k: 'man', on: 'WB' }, S: { k: 'man', on: 'TE' } },
    strong: ['deep', 'playaction', 'outside'], weak: ['quick', 'screen', 'qbdraw'], tags: [],
  },
  {
    id: 'prevent', name: 'Prevent', short: 'Everyone drops deep to stop the big play.',
    desc: 'Both corners and the safety drop far back, the linebackers guard the short middle, two linemen rush.',
    form: { CB1: [9.5, -9], CB2: [9.5, 9], LB1: [5.5, -3.4], LB2: [5.5, 3.4], S: [15, 0] },
    tasks: { DL1: { k: 'rush', lane: -0.9 }, DL2: { k: 'rush', lane: 0.9 }, LB1: { k: 'zone', u: 8, v: -4, r: 4.5 }, LB2: { k: 'zone', u: 8, v: 4, r: 4.5 }, CB1: { k: 'deep', u: 14, v: -9 }, CB2: { k: 'deep', u: 14, v: 9 }, S: { k: 'deep', u: 20, v: 0 } },
    strong: ['deep'], weak: ['quick', 'inside', 'outside'], tags: [],
  },
  {
    id: 'runstop', name: 'Run Stop', short: 'Crowd the line to stop the run.',
    desc: 'The linebackers and the safety move up to the line to fill the gaps, the corners hold the edges. Little is left deep.',
    form: { LB1: [2.6, -2.6], LB2: [2.6, 2.6], CB1: [4.2, -9.6], CB2: [4.2, 9.6], S: [6.5, 0] },
    tasks: { DL1: { k: 'rush', lane: -0.9 }, DL2: { k: 'rush', lane: 0.9 }, LB1: { k: 'fill', u: 2.2, v: -2.4 }, LB2: { k: 'fill', u: 2.2, v: 2.4 }, CB1: { k: 'man', on: 'WA' }, CB2: { k: 'man', on: 'WB' }, S: { k: 'fill', u: 5.2, v: 0 } },
    strong: ['inside', 'outside', 'jet', 'qbdraw'], weak: ['deep', 'playaction'], tags: [],
  },
];

export const offPlay = (id) => OFF_PLAYS.find((p) => p.id === id) || OFF_PLAYS[0];
export const defCall = (id) => DEF_CALLS.find((c) => c.id === id) || DEF_CALLS[0];

export function offFormation(play) {
  const f = { ...OFF0 };
  for (const [k, v] of Object.entries(play.form || {})) f[k] = v;
  return f;
}
// defence line-up (u, v) for a call, with the base positions
const DEF0 = { DL1: [0.9, -0.9], DL2: [0.9, 0.9], LB1: [4.0, -3.2], LB2: [4.0, 3.2], CB1: [4.5, -9.6], CB2: [4.5, 9.6], S: [10, 0] };
export function defFormation(call) {
  const f = { ...DEF0 };
  for (const [k, v] of Object.entries(call.form || {})) f[k] = v;
  return f;
}
