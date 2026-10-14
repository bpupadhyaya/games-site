// Candlepin scoring and turn flow. Pure: it only knows how many pins each ball knocked down.
//
// A game is ten frames of up to three balls. Every pin knocked down is one point. A strike (ten on the first ball) scores
// ten plus the next two balls, a spare (ten in two balls) ten plus the next ball, ten in three balls scores ten with no
// bonus. The tenth frame always has three balls; the pins are re-racked after a strike or a spare. Maximum 300.

export const FRAMES = 10;

// rolls: the flat list of pins knocked by each ball of ONE player, in order.
// Returns { frames: [{ rolls, mark: '' | 'X' | '/' | '10', done, pts, total }], total } where pts/total are null until the bonus balls exist.
export function scoreCard(rolls) {
  const frames = [];
  let i = 0;
  for (let f = 0; f < FRAMES; f++) {
    const fr = { rolls: [], mark: '', start: i, done: false, pts: null, total: null, tenth: f === FRAMES - 1 };
    frames.push(fr);
    if (i >= rolls.length) continue;
    if (!fr.tenth) {
      const a = rolls[i];
      if (a >= 10) { fr.rolls = [a]; fr.mark = 'X'; fr.done = true; i += 1; }
      else if (i + 1 < rolls.length) {
        const b = rolls[i + 1];
        if (a + b >= 10) { fr.rolls = [a, b]; fr.mark = '/'; fr.done = true; i += 2; }
        else if (i + 2 < rolls.length) { const c = rolls[i + 2]; fr.rolls = [a, b, c]; fr.done = true; fr.mark = a + b + c >= 10 ? '10' : ''; i += 3; }
        else { fr.rolls = [a, b]; i += 2; }
      } else { fr.rolls = [a]; i += 1; }
    } else {
      fr.rolls = rolls.slice(i, i + 3); i += fr.rolls.length; fr.done = fr.rolls.length === 3;
    }
  }
  let total = 0, known = true;
  frames.forEach((fr) => {
    if (!fr.rolls.length) return;
    const k = fr.start + fr.rolls.length, sum = fr.rolls.reduce((s, v) => s + v, 0);
    let pts = null;
    if (fr.tenth) pts = fr.done ? sum : null;
    else if (fr.mark === 'X') { if (rolls[k] !== undefined && rolls[k + 1] !== undefined) pts = 10 + rolls[k] + rolls[k + 1]; }
    else if (fr.mark === '/') { if (rolls[k] !== undefined) pts = 10 + rolls[k]; }
    else if (fr.done) pts = sum;
    if (pts === null) known = false;
    if (known) { total += pts; fr.pts = pts; fr.total = total; }
  });
  return { frames, total };
}
// the player's score so far even if the last bonuses are not final (what a scoreboard shows live)
export function runningTotal(rolls) {
  let total = 0, i = 0;
  for (let f = 0; f < FRAMES && i < rolls.length; f++) {
    if (f === FRAMES - 1) { total += rolls.slice(i, i + 3).reduce((s, v) => s + v, 0); break; }
    const a = rolls[i];
    if (a >= 10) { total += 10 + (rolls[i + 1] ?? 0) + (rolls[i + 2] ?? 0); i += 1; continue; }
    const b = rolls[i + 1] ?? 0;
    if (a + b >= 10) { total += 10 + (rolls[i + 2] ?? 0); i += 2; continue; }
    total += a + b + (rolls[i + 2] ?? 0); i += 3;
  }
  return total;
}

// ---- match flow ----------------------------------------------------------------------------------
// players: number of bowlers (1 for puzzles is handled elsewhere). Bowlers take whole frames in turn.
export function newMatch(cfg) {
  const n = cfg.players ?? 2;
  return {
    cfg, n, turn: 0, frame: 0, ball: 0,           // frame 0..9, ball 0..2 inside the frame
    rolls: Array.from({ length: n }, () => []),
    frameRolls: Array.from({ length: n }, () => Array.from({ length: FRAMES }, () => [])),
    over: null, strikes: Array(n).fill(0), spares: Array(n).fill(0), last: null,
  };
}
// Record a ball. `cleared` = all ten down after this ball. Returns what the flow should do.
export function recordBall(m, pins, cleared) {
  const p = m.turn, f = m.frame;
  m.rolls[p].push(pins);
  m.frameRolls[p][f].push(pins);
  const first = m.ball === 0;
  const res = { pins, strike: false, spare: false, rack: false, frameDone: false, gameOver: false, nextTurn: p, ballInFrame: m.ball };
  if (cleared && first) { res.strike = true; m.strikes[p]++; } else if (cleared && m.ball === 1) { res.spare = true; m.spares[p]++; }
  m.last = res;
  const tenth = f === FRAMES - 1;
  m.ball++;
  if (!tenth) {
    if (cleared || m.ball >= 3) { res.rack = true; res.frameDone = true; }
  } else {
    if (cleared) res.rack = true;           // tenth frame: strike or spare re-racks and the frame goes on
    if (m.ball >= 3) { res.frameDone = true; res.rack = true; }
    else if (cleared && m.ball === 3) res.frameDone = true;
  }
  if (res.frameDone) {
    m.ball = 0;
    if (p < m.n - 1) { m.turn = p + 1; }
    else { m.turn = 0; m.frame++; }
    if (m.frame >= FRAMES) { res.gameOver = true; m.over = finalResult(m); }
    res.nextTurn = m.turn;
  }
  return res;
}
export function totals(m) { return m.rolls.map((r) => runningTotal(r)); }
function finalResult(m) {
  const t = totals(m);
  let win = 0;
  for (let i = 1; i < m.n; i++) if (t[i] > t[win]) win = i;
  const tie = t.filter((v) => v === t[win]).length > 1;
  return { scores: t, win, tie };
}
// how many balls the bowler has left in the current frame (for the HUD)
export function ballsLeft(m) {
  const tenth = m.frame === FRAMES - 1;
  return tenth ? 3 - m.ball : 3 - m.ball;
}
