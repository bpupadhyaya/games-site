// Snooker frame rules: what is "on", scoring, fouls, free ball, re-spotting, the simplified miss rule and the frame
// result. Pure functions over the frame record `f` and the physics world `w` (see sim.js). The AI, the hints, the
// Rules page and the game all read the same values from here.
import {
  CUE, BLACK, YELLOW, COLOURS, isRed, isColour, VALUE, nameOf, R, TW, TL, SPOT, MID_X, BAULK_Y,
  ballById, respotPosition, pathClear, anyMoving, nearestInD, inD, spotFree,
} from './sim.js';

export const FORMATS = {
  full: { id: 'full', name: '15 reds', reds: 15, blurb: 'The full game: 15 reds, 6 colours', short: '15-red' },
  six: { id: 'six', name: '6 reds', reds: 6, blurb: 'Short frame for a phone: 6 reds, 6 colours', short: '6-red' },
};
export const FORMAT_IDS = ['six', 'full'];
export const MATCH_LENGTHS = [1, 3, 5];       // best of

export const other = (t) => 1 - t;

export function newFrame(cfg) {
  return {
    cfg, nReds: FORMATS[cfg.format].reds, scores: [0, 0], turn: cfg.breaker ?? 0, breaker: cfg.breaker ?? 0,
    on: 'red', next: YELLOW, visit: 0, free: false, inHand: true, shots: 0, blackOff: false, over: null,
    last: null, pendingMiss: null, breaks: [0, 0], high: [0, 0], redsLeft: FORMATS[cfg.format].reds, fouls: [0, 0],
  };
}

const onTable = (w, pred) => w.b.filter((q) => q.on && pred(q.id));
export const redsOnTable = (w) => onTable(w, isRed).length;
export const coloursOnTable = (w) => onTable(w, isColour);

// The balls that are "on" (legal first contact) for the player about to shoot.
export function ballsOn(f, w) {
  if (f.on === 'red') return onTable(w, isRed).map((q) => q.id);
  if (f.on === 'colour') return onTable(w, isColour).map((q) => q.id);
  const n = ballById(w, f.next);
  return n && n.on ? [n.id] : [];
}
// Phase text for the HUD
export function onLabel(f) {
  if (f.free) return 'Free ball';
  if (f.on === 'red') return 'Red';
  if (f.on === 'colour') return 'Any colour';
  return nameOf(f.next);
}

// Highest points still available on the table for the player at the table.
export function pointsLeft(f, w) {
  const reds = redsOnTable(w);
  const cols = coloursOnTable(w).reduce((s, q) => s + VALUE(q.id), 0);
  if (f.on === 'order') return cols - (f.blackOff ? 0 : 0);
  if (f.on === 'colour') return 7 + reds * 8 + 27;
  return reds * 8 + 27;
}

// ---- snooker (can the cue ball see the balls on?) -------------------------------------------------------------------
// The two extreme-edge aim points for the cue ball to touch ball t: ghost centres at 2R from t, perpendicular to the line.
function ghosts(cx, cy, t) {
  const dx = t.x - cx, dy = t.y - cy, d = Math.hypot(dx, dy) || 1;
  const nx = -dy / d, ny = dx / d;
  // tangent from c to the circle of radius 2R around t: the ghost centres are the tangent points
  const r = 2 * R, L = Math.sqrt(Math.max(0, d * d - r * r));
  const a = Math.asin(Math.min(1, r / d));
  const ux = dx / d, uy = dy / d;
  const cs = Math.cos(a), sn = Math.sin(a);
  return [
    { x: cx + (ux * cs - uy * sn) * L, y: cy + (ux * sn + uy * cs) * L },
    { x: cx + (ux * cs + uy * sn) * L, y: cy + (-ux * sn + uy * cs) * L },
  ].map((g) => ({ ...g, nx, ny }));
}
// Obstacles are balls that are not on (balls that are on never snooker the cue ball).
export function hitsBothEdges(w, targetId, onIds) {
  const c = ballById(w, CUE), t = ballById(w, targetId);
  if (!c || !t || !c.on || !t.on) return false;
  const skip = [CUE, ...onIds];
  const d = Math.hypot(t.x - c.x, t.y - c.y);
  if (d < 2 * R + 1e-4) return true;
  return ghosts(c.x, c.y, t).every((g) => pathClear(w, c.x, c.y, g.x, g.y, skip));
}
export function canHitDirect(w, targetId, onIds) {
  const c = ballById(w, CUE), t = ballById(w, targetId);
  if (!c || !t || !c.on || !t.on) return false;
  return pathClear(w, c.x, c.y, t.x, t.y, [CUE, ...onIds.filter((i) => i !== targetId)].concat([targetId]));
}
// Snookered: no ball on can be hit at both extreme edges.
export function isSnookered(f, w) {
  const on = ballsOn(f, w);
  if (!on.length) return false;
  return !on.some((id) => hitsBothEdges(w, id, on));
}
// Can the player see a ball on at all (centre line clear)? Used by the miss rule.
export function canSeeBallOn(f, w) {
  const on = ballsOn(f, w);
  return on.some((id) => canHitDirect(w, id, on));
}

// ---- judging a shot ----------------------------------------------------------------------------------------------------
// ev: events from the physics settle. Returns the verdict and does not touch f or w.
export function judge(f, w, ev, before) {
  const first = ev.find((e) => e.k === 'hit' && (e.a === CUE || e.b === CUE));
  const firstHit = first ? (first.a === CUE ? first.b : first.a) : null;
  const t0 = first ? first.t : Infinity;
  const pots = ev.filter((e) => e.k === 'pot').map((e) => e.id);
  const cuePot = pots.includes(CUE);
  const potted = pots.filter((id) => id !== CUE);
  const cushion = ev.some((e) => (e.k === 'cush' || e.k === 'jaw' || e.k === 'pot') && e.t >= t0);
  const onSet = before.on;              // ids that were on before the shot
  const free = before.free;
  const freeUsed = free && firstHit !== null && !onSet.includes(firstHit);
  const fouls = [];
  const addFoul = (why, val) => fouls.push({ why, val: Math.max(4, val) });
  const valOn = f.on === 'order' ? VALUE(f.next) : f.on === 'red' ? 1 : 1;
  const valHit = firstHit !== null ? VALUE(firstHit) : 0;

  if (firstHit === null) addFoul('nohit', f.on === 'order' ? VALUE(f.next) : 4);
  else if (!freeUsed) {
    if (!onSet.includes(firstHit)) addFoul('wrongfirst', Math.max(valHit, f.on === 'order' ? VALUE(f.next) : 1));
  }
  if (cuePot) addFoul('inoff', Math.max(valHit, valOn));
  if (firstHit !== null && !cushion && !cuePot) addFoul('nocushion', 4);

  // potting
  let scored = 0, nReds = 0, colourPotted = null;
  const respot = [];
  for (const id of potted) {
    let legal = false;
    if (freeUsed && id === firstHit) {
      legal = true; scored += f.on === 'order' ? VALUE(f.next) : 1;
      if (f.on === 'red') nReds += 1;                 // a free ball counts as the red that was on
      else if (f.on === 'colour') colourPotted = id;
      if (!isRed(id)) respot.push(id);
    } else if (f.on === 'red') {
      if (isRed(id)) { legal = true; scored += 1; nReds += 1; }
    } else if (f.on === 'colour') {
      if (isColour(id) && id === firstHit && colourPotted === null && !freeUsed) { legal = true; scored += VALUE(id); colourPotted = id; respot.push(id); }
    } else if (id === f.next && !freeUsed) { legal = true; scored += VALUE(id); colourPotted = id; }
    if (!legal) addFoul('wrongpot', VALUE(id));
  }
  // in the "red" phase a red and a colour together is already a wrong pot (handled above); a free ball counts once
  const foul = fouls.length > 0;
  const foulPts = foul ? Math.max(...fouls.map((x) => x.val)) : 0;
  const whys = fouls.map((x) => x.why);
  // every coloured ball potted on a foul shot (and the correct colour after a red) goes back on the table
  const back = new Set(respot);
  if (foul) for (const id of potted) if (isColour(id)) back.add(id);
  // miss rule: no contact or the wrong ball first when a ball on could be seen (judged on the positions before the shot)
  const missy = (whys.includes('nohit') || (whys.includes('wrongfirst') && !freeUsed)) && !cuePot && before.canSee;
  return {
    firstHit, pots, potted, cuePot, cushion, fouls, foul, foulPts, whys, scored: foul ? 0 : scored, nReds, colourPotted,
    respot: [...back], freeUsed, miss: !!missy, onSet,
  };
}

const WHY_TEXT = {
  nohit: 'the white did not touch any ball', wrongfirst: 'the wrong ball was hit first', inoff: 'the white was potted',
  wrongpot: 'a ball that was not on was potted', nocushion: 'no ball reached a cushion after the first contact',
};
export const whyText = (res) => [...new Set(res.whys)].map((k) => WHY_TEXT[k]).join(' and ');

// ---- applying a verdict -----------------------------------------------------------------------------------------------------
// Mutates f and the physics world w (re-spots, cue ball in hand). Returns { turnEnds, over, notes }.
export function applyShot(f, w, res, before) {
  const me = f.turn, opp = other(me);
  const notes = [];
  f.shots++;
  f.free = false;
  f.pendingMiss = null;
  const cue = ballById(w, CUE);
  for (const id of res.respot) {
    const q = ballById(w, id);
    if (q) { const p = respotPosition(w, id); q.x = p.x; q.y = p.y; q.lx = p.x; q.ly = p.y; q.on = true; q.vx = q.vy = 0; q.wx = q.wy = q.wz = 0; q.pk = -1; q.respotted = 1; }
  }
  f.redsLeft = redsOnTable(w);
  let turnEnds = false;
  if (res.foul) {
    f.scores[opp] += res.foulPts;
    f.fouls[me]++;
    f.visit = 0;
    notes.push({ k: 'foul', text: `Foul: ${whyText(res)}. ${res.foulPts} to ${f.cfg.names ? f.cfg.names[opp] : 'the opponent'}`, pts: res.foulPts, who: opp });
    turnEnds = true;
    if (res.cuePot) { f.inHand = true; cue.on = false; }
    else f.inHand = false;
    // miss rule offer
    if (res.miss && !f.blackOff) f.pendingMiss = { by: me, pts: res.foulPts };
  } else {
    f.scores[me] += res.scored;
    f.visit += res.scored;
    if (res.scored > 0) { f.high[me] = Math.max(f.high[me], f.visit); }
    f.inHand = false;
    if (res.potted.length === 0) turnEnds = true;
  }
  // next phase
  if (f.on === 'order') {
    if (!res.foul && res.colourPotted === f.next) {
      if (f.next === BLACK) f.next = null; else f.next = COLOURS[COLOURS.indexOf(f.next) + 1];
    }
  } else if (!res.foul && res.nReds > 0 && f.on === 'red') f.on = 'colour';
  else if (!res.foul && res.scored > 0 && f.on === 'colour') f.on = f.redsLeft > 0 ? 'red' : 'order';
  else if (turnEnds && f.on === 'colour') f.on = f.redsLeft > 0 ? 'red' : 'order';
  if (f.on === 'red' && f.redsLeft === 0) f.on = 'order';

  // free ball offered after a foul when the incoming player is snookered
  // frame end
  let over = null;
  if (f.blackOff) {
    if (res.foul) over = { win: opp, why: 'Foul on the re-spotted black' };
    else if (res.colourPotted === BLACK || res.potted.includes(BLACK)) over = { win: me, why: 'Potted the re-spotted black' };
    else if (turnEnds) { /* pass */ }
  } else if (f.next === null) {
    // the final black has gone (potted legally) or it is respotted by a tie
    if (f.scores[0] !== f.scores[1]) over = { win: f.scores[0] > f.scores[1] ? 0 : 1, why: 'Final black' };
    else {
      f.blackOff = true; f.on = 'order'; f.next = BLACK;
      const q = ballById(w, BLACK); const p = SPOT[BLACK];
      q.on = true; q.x = p.x; q.y = p.y; q.lx = p.x; q.ly = p.y; q.vx = q.vy = 0; q.pk = -1; q.respotted = 1;
      f.inHand = true; cue.on = false;
      turnEnds = true; f.turn = other(f.breaker); f.visit = 0;
      notes.push({ k: 'blackoff', text: 'Scores are level: the black is re-spotted. First to pot it wins the frame' });
    }
  } else if (res.foul && f.on === 'order' && f.next === BLACK && f.scores[opp] > f.scores[me] && coloursOnTable(w).length === 1) {
    over = null;
  }
  if (over) { f.over = over; return { turnEnds: true, over, notes }; }
  if (turnEnds && !(f.blackOff && notes.some((n) => n.k === 'blackoff'))) {
    f.turn = opp; f.visit = 0;
  }
  // free ball for the incoming player
  if (turnEnds && !f.inHand && !f.over) {
    if (res.foul && isSnookered(f, w)) { f.free = true; notes.push({ k: 'free', text: 'Free ball: you are snookered. Any ball can be played as the ball on' }); }
  }
  return { turnEnds, over: null, notes };
}

// The cue ball is in hand: where may it go? (anywhere in the D, clear of balls)
export function placeCue(w, x, y) {
  const p = nearestInD(w, x, y);
  const q = ballById(w, CUE);
  q.x = p.x; q.y = p.y; q.lx = p.x; q.ly = p.y; q.on = true; q.vx = q.vy = 0; q.wx = q.wy = q.wz = 0;
  return p;
}
export function defaultCuePos(w) { return nearestInD(w, MID_X + 0.05, BAULK_Y - 0.18); }

// Snapshot of what the judge needs before the shot.
export function beforeShot(f, w) {
  return { on: ballsOn(f, w), free: f.free, canSee: canSeeBallOn(f, w) };
}

// Frame state for the save file and replay (balls only; f is plain data already)
export const snapshotBalls = (w) => w.b.map((q) => ({ id: q.id, x: q.x, y: q.y, on: q.on, mx: q.mx, my: q.my, mz: q.mz }));
void TW; void TL; void inD; void spotFree; void anyMoving;
