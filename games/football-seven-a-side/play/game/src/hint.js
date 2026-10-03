// Think: what a good player would do right now, for the role you control. Every reason is computed from the real positions at the moment
// you ask (distances, free space, passing lanes, the predicted line of a shot), never canned.
import { HL, HW, GOAL_HW, BOX_HW, ROLE_NAME } from './consts.js';
import { xgAt, laneMargin, freeSpace, attackSpot, defendSpot, teamThink } from './ai.js';

const dirOf = (t) => (t === 0 ? 1 : -1);
const depthOf = (t, z) => (t === 0 ? z + HL : HL - z);
const word = (q) => (q.role === 'ST' ? 'striker' : q.role === 'WL' || q.role === 'WR' ? 'winger' : q.role === 'CM' ? 'midfielder' : q.role === 'GK' ? 'goalkeeper' : 'defender');
// screen-left for the human team is world +x (the team faces +z); sides are described from the player's own point of view
const sideOf = (p, x) => ((x - p.x) * (p.team === 0 ? 1 : -1) > 0.4 ? 'left' : (x - p.x) * (p.team === 0 ? 1 : -1) < -0.4 ? 'right' : 'middle');
const m1 = (v) => (Math.round(v * 10) / 10).toString();
const nearestOpp = (X, p, x = p.x, z = p.z) => { let b = null, bd = 99; for (const q of X.P) if (q.team !== p.team && q.role !== 'GK') { const d = Math.hypot(q.x - x, q.z - z); if (d < bd) { bd = d; b = q; } } return { q: b, d: bd }; };

export function makeHint(X, p) {
  const s = X.s;
  teamThink(X, 0); teamThink(X, 1);
  const tm = X.tm[p.team], B = s.ball;
  const sp = s.sp && s.phase === 'setpiece' ? s.sp : null;
  let h;
  if (sp && sp.taker === p.id) h = restartHint(X, p, sp);
  else if (p.role === 'GK') h = keeperHint(X, p, tm);
  else if (B.owner === p.id) h = carrierHint(X, p);
  else if (sp) h = restartWaitHint(X, p, sp);
  else if (tm.has === p.team) h = supportHint(X, p, tm);
  else if (tm.has === 1 - p.team) h = defendHint(X, p, tm);
  else h = looseHint(X, p, tm);
  return { title: 'Think', tgt: -1, spot: null, why: '', ...h };
}

function carrierHint(X, p) {
  const opts = X.evalOptions(p);
  const o = opts[0];
  const t = p.team, gz = dirOf(t) * HL;
  if (!o) return { text: 'Keep the ball and look up.', why: '' };
  const near = nearestOpp(X, p);
  if (o.kind === 'shot') {
    const gk = X.P[(1 - t) * 7], dg = Math.hypot(p.x, gz - p.z);
    const side = sideOf(p, o.tx);
    return { text: `Shoot. Aim for the ${side} corner: hold SHOOT, point the stick at it and release.`, why: `You are ${m1(dg)} m from the goal, the goalkeeper is on your ${sideOf(p, gk.x)} side, and about ${Math.round(o.xg * 100)} in 100 shots from here would score.`, spot: { x: o.tx, z: gz }, spotLabel: 'Aim here' };
  }
  if (o.kind === 'pass' || o.kind === 'through' || o.kind === 'lob' || o.kind === 'cross') {
    const q = X.P[o.tgt], space = freeSpace(X, q.x, q.z, t, 9), mm = laneMargin(X, p, q.x, q.z, 12), d = Math.hypot(q.x - p.x, q.z - p.z);
    const btn = o.kind === 'pass' ? 'PASS' : o.kind === 'through' ? 'THROUGH' : 'LOB';
    const how = o.kind === 'through' ? 'Play it into the space ahead of him' : o.kind === 'cross' ? 'Cross it into the area' : o.kind === 'lob' ? 'Lift it over the defenders' : 'Pass along the ground';
    const lane = o.kind === 'lob' || o.kind === 'cross' ? 'the ball goes over the defenders' : mm > 0.3 ? 'no opponent can reach the ball on the way' : 'the lane is narrow but still open';
    return { text: `${how} to the ${word(q)} on your ${sideOf(p, q.x)}: point the stick at him and press ${btn}.`, why: `He is ${m1(d)} m away with ${m1(space)} m of space around him, and ${lane}.${near.d < 2 ? ` The nearest opponent is only ${m1(near.d)} m from you, so do it quickly.` : ''}`, tgt: q.id };
  }
  if (o.kind === 'clear') return { text: 'Clear the ball away from your goal: point the stick towards the side and press KICK or LOB.', why: `An opponent is ${m1(near.d)} m away and you are ${m1(depthOf(t, p.z))} m from your own goal line, so keep it safe.` };
  const free = o.free;
  return { text: 'Dribble forward: use the stick and sprint into the space.', why: free > 3 ? `There are ${m1(Math.min(free, 6))} m of open grass ahead and the nearest opponent is ${m1(near.d)} m away.` : `Space ahead is tight (${m1(Math.max(0, free))} m): protect the ball and wait for a teammate to get free.` };
}

function supportHint(X, p, tm) {
  const s = X.s, t = p.team;
  const car = tm.carrier >= 0 ? X.P[tm.carrier] : X.P[s.ball.owner];
  const { pos } = attackSpot(X, p, tm);
  const d = Math.hypot(pos.x - p.x, pos.z - p.z);
  const space = freeSpace(X, pos.x, pos.z, t, 9);
  const mm = car ? laneMargin(X, car, pos.x, pos.z, 12) : 0;
  const job = { ST: 'Make a run to the marked spot, on the shoulder of the last defender', WL: 'Stay wide at the marked spot to stretch the defence', WR: 'Stay wide at the marked spot to stretch the defence', CM: 'Offer a pass at the marked spot, a little behind the ball', DL: 'Stay back at the marked spot as a safe outlet', DR: 'Stay back at the marked spot as a safe outlet' }[p.role];
  const why = `${m1(space)} m from the nearest opponent${car ? `, and the ${word(car)} with the ball ${mm > 0.1 ? 'can pass there without an opponent cutting it out' : 'would need a clear lane first'}` : ''}.`;
  if (d < 2.5) return { text: `You are in a good place. Press CALL to ask ${car ? `the ${word(car)}` : 'for the ball'} to pass.`, why, tgt: car ? car.id : -1 };
  return { text: `${job}.`, why: `That spot is ${why}`, spot: pos, spotLabel: 'Go here', tgt: car ? car.id : -1 };
}

function defendHint(X, p, tm) {
  const t = p.team, B = X.s.ball;
  const r = defendSpot(X, p, tm);
  const car = r.carrier || (B.owner >= 0 ? X.P[B.owner] : null);
  const dc = car ? Math.hypot(car.x - p.x, car.z - p.z) : 0;
  if (r.kind === 'press' && car) {
    const own = t === 0 ? -HL : HL, gx = 0 - car.x, gz = own - car.z, l = Math.hypot(gx, gz) || 1;
    return { text: 'Close him down: get between him and your goal, then TACKLE when the ball is out in front of him.', why: `You are the nearest of your team to the ball (${m1(dc)} m). Rushing in from the side or behind risks a foul.`, spot: { x: car.x + gx / l * 1.4, z: car.z + gz / l * 1.4 }, spotLabel: 'Stand here', tgt: car.id };
  }
  if (r.kind === 'cover') return { text: 'Cover your teammate: stand behind the player who is closing the ball down.', why: `If the ball carrier gets past, you are the next defender; the marked spot is on the goal side, ${m1(Math.hypot(r.pos.x - p.x, r.pos.z - p.z))} m from you.`, spot: r.pos, spotLabel: 'Cover here' };
  if (r.kind === 'mark') { const o = X.P[r.mark]; return { text: `Mark the opposing ${word(o)}: stay goal-side, between him and your goal.`, why: `He is ${m1(Math.hypot(o.x - p.x, o.z - p.z))} m from you and the marked spot keeps you ${m1(Math.hypot(r.pos.x - o.x, r.pos.z - o.z))} m from him, on the side of your goal.`, spot: r.pos, spotLabel: 'Stand here', tgt: o.id }; }
  const fw = { ST: 'Stay forward as an outlet and block the pass to their goalkeeper.', WL: 'Drop back a little on your wing and watch the opposing winger.', WR: 'Drop back a little on your wing and watch the opposing winger.', CM: 'Stay in the middle and cut the passing lanes through the centre.' }[p.role];
  return { text: fw || 'Hold your zone: stay between the ball and your goal and keep close to your teammates.', why: `The ball is ${m1(Math.hypot(B.x - p.x, B.z - p.z))} m away; keeping the team compact leaves fewer passing lanes.`, spot: r.pos, spotLabel: 'Hold here' };
}

function looseHint(X, p, tm) {
  const B = X.s.ball, d = Math.hypot(B.x - p.x, B.z - p.z);
  const mineT = p.ai.tti ?? 99;
  if (mineT <= tm.tChase + 0.2 || p.human && mineT < tm.tOpp) return { text: 'The ball is loose and you are the closest: sprint to it.', why: `You can get there in about ${m1(mineT)} s; the nearest opponent needs about ${m1(tm.tOpp)} s.`, spot: { x: p.ai.ix ?? B.x, z: p.ai.iz ?? B.z }, spotLabel: 'Meet it here' };
  return { text: 'A teammate is closer to the loose ball: move into space to offer a pass.', why: `The ball is ${m1(d)} m from you; the player nearest it will get there in about ${m1(tm.tChase)} s.` };
}

function keeperHint(X, p, tm) {
  const s = X.s, B = s.ball, t = p.team, gz = t === 0 ? -HL : HL, sg = t === 0 ? 1 : -1;
  if (B.held === p.id) {
    let best = null, bs = -9;
    for (const q of X.P) if (q.team === t && q.id !== p.id) { const m = laneMargin(X, p, q.x, q.z, 11), sc = freeSpace(X, q.x, q.z, t, 9) + m * 2 - Math.hypot(q.x - p.x, q.z - p.z) * 0.1; if (sc > bs && m > 0.1) { bs = sc; best = q; } }
    if (best) return { text: `Throw it to the ${word(best)} on your ${sideOf(p, best.x)}: aim with the stick and press THROW.`, why: `He has ${m1(freeSpace(X, best.x, best.z, t, 9))} m of space and no opponent is close to the line of the throw.`, tgt: best.id };
    return { text: 'Kick it long: aim up the pitch and press KICK.', why: 'No teammate is free for a short throw.' };
  }
  const path = X.predictBall();
  let cross = null;
  if (Math.abs(B.vz) > 3 && B.vz * sg < 0) for (let i = 0; i < path.length; i++) { const q = path[i]; if ((q.z - gz) * sg <= 0) { cross = q; break; } }
  if (cross && Math.abs(cross.x) < GOAL_HW + 0.6) {
    const side = sideOf(p, cross.x), hgt = cross.y > 1.4 ? 'high' : cross.y < 0.5 ? 'low' : 'at chest height';
    return { text: `A shot is coming. Dive to your ${side}: swipe that way, or hold the stick that way and press DIVE.`, why: `The ball will cross the goal line ${m1(Math.abs(cross.x - p.x))} m to your ${side} ${hgt}, in about ${m1(cross.t)} s. Dive when it is about 0.3 s away.`, spot: { x: cross.x, z: gz }, spotLabel: 'Ball arrives' };
  }
  const near = B.owner >= 0 && X.P[B.owner].team !== t ? X.P[B.owner] : null;
  const dg = Math.hypot(B.x, B.z - gz);
  if (near && dg < 9) return { text: 'He is close and alone: come out a little to cut down the angle.', why: `The ball is ${m1(dg)} m from your goal; standing a step further out leaves him less of the goal to aim at.` };
  return { text: 'Stay on the line between the ball and the middle of the goal.', why: `The ball is ${m1(dg)} m away. From the middle of your goal you can reach either post with a dive.`, spot: { x: Math.max(-GOAL_HW, Math.min(GOAL_HW, B.x * 0.25)), z: gz + sg * 1.2 }, spotLabel: 'Stand here' };
}

function restartHint(X, p, sp) {
  const k = sp.kind;
  if (k === 'penalty') { const gk = X.P[(1 - p.team) * 7]; return { text: 'Penalty: point the stick at a corner and press SHOOT.', why: `The goalkeeper stands in the middle (${m1(Math.abs(gk.x))} m off centre). The corners are about 2.5 m from the middle.` }; }
  if (k === 'throw') return { text: 'Throw-in: point the stick at a free teammate and press THROW.', why: 'The ring shows who will receive it; pick someone with space around them.' };
  if (k === 'goalkick') return { text: 'Goal kick: press KICK for a long ball or SHORT to a defender.', why: 'A short pass keeps the ball when opponents are far away; kick long when they are pressing.' };
  if (k === 'corner') return { text: 'Corner: press LOB and aim at the striker in the area.', why: 'Your attackers wait near the penalty spot; a high ball is the quickest way to reach them.' };
  if (k === 'free') return { text: 'Free kick: shoot if you are near the goal, otherwise pass.', why: `You are ${m1(Math.hypot(sp.x, dirOf(p.team) * HL - sp.z))} m from the goal.` };
  return { text: 'Kick-off: pass to a teammate and start the attack.', why: 'Press PASS towards a free player.' };
}
function restartWaitHint(X, p, sp) {
  return { text: `${ROLE_NAME[p.role]}: get into position for the ${sp.kind === 'goalkick' ? 'goal kick' : sp.kind === 'free' ? 'free kick' : sp.kind}.`, why: 'Everyone has a place to wait until the ball is kicked.' };
}
