// Turns a chosen shot into a plain-language reason. Every claim is checked against a clean simulation of that very
// shot on the current board, so the text never says something the ice will not do.
import { scoreEnd, toButton, inHouse, inGuardZone, R, FOUR_R, HOUSE_R } from './sim.js';
import { WEIGHTS, guardsProtected, playShot, shotParams, stonesLeft, other, FORMATS } from './match.js';

const m2 = (v) => `${v.toFixed(1)} m`;

// names: { me, foe } how to address each side. Returns { title, reason, outcome } (outcome = facts for the UI).
export function explainShot(m, w, team, shot, names) {
  const p = shotParams(shot);
  const res = playShot(m, w, team, { v0: p.v0, theta: p.theta, turn: p.turn });
  const before = scoreEnd(w), after = scoreEnd(res.w);
  const foe = other(team);
  const stone = res.thrown;
  const wt = WEIGHTS[shot.w];
  const hasLast = m.hammer === team;
  const early = m.shot + 1 <= m.fmt.fg;
  const leftAfter = stonesLeft(m, team) - 1;
  const gone = w.stones.filter((s) => s.mode === 'play' && s.team === foe && !res.w.stones.some((q) => q.id === s.id && q.mode === 'play' && !res.restored));
  const goneGuards = gone.filter((s) => inGuardZone(s)).length;
  const lines = [];
  let title = shot.name ?? wt.name;
  const alive = stone && stone.mode === 'play';
  const inH = alive && inHouse(stone), d = alive ? toButton(stone) : 9;
  const lies = after.team === team;

  if (res.restored) {
    return { title, reason: 'This shot would knock a guard out of play too early. The free guard rule would remove your stone and put everything back.', outcome: { ok: false, restored: true } };
  }
  if (!alive) {
    return { title, reason: 'This delivery does not stay in play, so it is a poor choice.', outcome: { ok: false } };
  }

  switch (shot.kind) {
    case 'guard': {
      const centre = Math.abs(stone.x) < 0.62;
      if (inGuardZone(stone)) {
        lines.push(`Guard: your stone stops in the free guard zone, ${centre ? 'on the centre line' : 'to one side'}, ${m2(Math.abs(stone.y))} short of the tee line.`);
        if (!hasLast && centre) lines.push('Without the last stone, a centre guard makes the other side\'s draw to the button harder.');
        else if (hasLast && !centre) lines.push('With the last stone, a guard to the side keeps the middle open for your final draw.');
        else if (hasLast) lines.push('It protects the stones you place behind it, though it also clutters your own centre.');
        else lines.push('It protects the stones you place behind it.');
        if (early && m.shot + 2 <= m.fmt.fg) lines.push('The free guard rule means the other side cannot knock it out with their next stone.');
      } else lines.push(`Guard: the stone is meant to stop in front of the house, but it ends ${m2(d)} from the button.`);
      break;
    }
    case 'draw': {
      lines.push(`Draw: your stone stops ${m2(d)} from the button${inH ? ', inside the house' : ''}.`);
      if (lies) lines.push(`It lies shot (closest to the button): ${after.pts === 1 ? 'one point' : `${after.pts} points`} if the end stopped now.`);
      else if (after.team !== null) lines.push(`${names.foe}'s stone is still closer, so this builds the end rather than taking the lead.`);
      if (hasLast && leftAfter === 0) lines.push('This is the last stone of the end, so it decides the score.');
      break;
    }
    case 'freeze': {
      lines.push(`Freeze: your stone stops against the other stone, ${m2(d)} from the button.`);
      lines.push('Touching it makes the stone hard to remove without also moving yours.');
      break;
    }
    case 'tap':
    case 'raise': {
      if (shot.kind === 'raise') lines.push('Raise: it pushes your own guard forward into a scoring position.');
      else lines.push('Tap: a light hit that moves the stone only a little.');
      lines.push(alive && inH ? `Your stone ends ${m2(d)} from the button.` : 'Your stone ends outside the house.');
      break;
    }
    default: {   // takeout, peel
      const removed = gone.length;
      lines.push(`${shot.kind === 'peel' ? 'Peel' : 'Takeout'}: ${removed ? (removed === 1 ? `removes ${names.foe}'s stone` : `removes ${removed} of ${names.foe}'s stones`) : 'it does not clear anything'}${goneGuards ? ' (a guard among them)' : ''}.`);
      if (alive && inH) lines.push(`Your stone stays in the house, ${m2(d)} from the button.`);
      else if (alive) lines.push('Your own stone does not stay in the house.');
      else lines.push('Your own stone rolls out of play.');
      if (removed && before.team === foe) lines.push(`Before the shot ${names.foe} would score ${before.pts}.`);
    }
  }
  if (!lines.length) lines.push('A sensible shot here.');
  void R; void FOUR_R; void HOUSE_R; void guardsProtected; void FORMATS;
  return { title, reason: lines.join(' '), outcome: { ok: true, d, lies, pts: after.pts, team: after.team, removed: gone.length } };
}

// The line that opens the situation: who has the last stone and how many stones remain.
export function situation(m, team, names) {
  const hasLast = m.hammer === team;
  const left = stonesLeft(m, team) - 1;
  return `${hasLast ? `${names.me} ${names.me === 'You' ? 'have' : 'has'} the last stone` : `${names.foe} has the last stone`} · ${left} more stone${left === 1 ? '' : 's'} after this one`;
}
