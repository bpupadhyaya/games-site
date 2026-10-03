// Plain-language reasons for the computer's shots. Everything said here is read from the simulated result of the shot (what
// really gets potted, where the white really stops), never guessed: a hint is the planner's own verified choice.
import { TW, TL, CUE, BAULK_Y, ballById, nameOf, isRed, VALUE } from './sim.js';
import { pointsLeft, ballsOn, other } from './rules.js';
import { easeFor } from './ai.js';

export const POCKET_NAMES = ['bottom-left corner', 'bottom-right corner', 'top-left corner', 'top-right corner', 'left middle', 'right middle'];

export function zoneOf(x, y) {
  const across = x < TW / 3 ? 'left' : x > 2 * TW / 3 ? 'right' : 'centre';
  const along = y < BAULK_Y ? 'in the baulk area' : y < TL * 0.45 ? 'in the lower half' : y < TL * 0.78 ? 'in the upper half' : 'near the top cushion';
  return `${along}, ${across}`;
}
const SPIN_TEXT = {
  stun: 'with a centre strike', follow: 'with top spin (follow) to send the white forward', 'follow hard': 'with strong top spin to send the white well forward',
  draw: 'with back spin (draw) to bring the white back', 'draw hard': 'with strong back spin to pull the white back', left: 'with left side spin', right: 'with right side spin',
};

export function situation(f, w, names) {
  const me = f.turn, ahead = f.scores[me] - f.scores[other(me)];
  const on = f.free ? 'a free ball' : f.on === 'red' ? 'a red' : f.on === 'colour' ? 'a colour' : `the ${nameOf(f.next).toLowerCase()}`;
  const score = ahead === 0 ? 'Level' : ahead > 0 ? `${names.me} ${ahead === 1 ? 'is' : 'are'} ${ahead} ahead` : `${names.me} ${ahead === -1 ? 'is' : 'are'} ${-ahead} behind`;
  return `${on[0].toUpperCase()}${on.slice(1)} is on, ${pointsLeft(f, w)} points left on the table. ${score}`;
}

// r: planner result { kind, target, pocket, spin, shot, sim }
export function explainShot(f, w, r, names) {
  const sim = r.sim, res = sim.res;
  const tName = nameOf(r.target).toLowerCase();
  const power = `${Math.round(r.shot.power * 100)}% power`;
  const spin = r.spin && SPIN_TEXT[r.spin] ? ` ${SPIN_TEXT[r.spin]}` : '';
  const cue = ballById(sim.w, CUE);
  const cueText = cue && cue.on ? `the white finishes ${zoneOf(cue.x, cue.y)}` : 'the white is potted';
  const next = easeFor(sim.f, sim.w);
  if (r.kind === 'pot' && res.potted.length) {
    const got = res.potted.map((id) => nameOf(id).toLowerCase()).join(' and ');
    let title = `Pot the ${tName}`;
    let reason = `Plays the ${tName} into the ${POCKET_NAMES[r.pocket] ?? 'pocket'} at ${power}${spin}. Simulated: the ${got} drops and ${res.scored} point${res.scored === 1 ? '' : 's'} score.`;
    if (!res.foul && sim.f.turn === f.turn) {
      reason += ` Position: ${cueText}, which keeps ${next.ease > 0.35 ? 'a good' : next.ease > 0.15 ? 'a possible' : 'a difficult'} next shot${next.snookered ? ' (note: the white would be snookered)' : ''}.`;
    } else if (res.foul) reason += ` Warning: the simulation shows a foul (${res.whys.join(', ')}).`;
    return { title, reason };
  }
  if (r.kind === 'safety') {
    const opp = easeFor(sim.f, sim.w);
    const snook = sim.f.turn !== f.turn && sim.f.free === false && opp.snookered;
    const title = snook ? 'Play a snooker' : 'Play safe';
    let reason = `No pot is worth the risk here, so it hits the ${tName} at ${power}${spin || ''}; ${cueText}.`;
    if (snook) reason += ' The opponent is left with no clear way to hit a ball on.';
    else if (opp.ease < 0.12) reason += ' The simulation leaves the opponent no easy pot.';
    else reason += ' It gives away little compared with the alternatives it checked.';
    if (res.foul) reason += ' (It still costs a foul in the simulation: nothing better was found.)';
    return { title, reason };
  }
  return { title: `Hit the ${tName}`, reason: `Best option found: it hits the ${tName} at ${power}${spin}; ${cueText}.` };
}
void ballsOn; void isRed; void VALUE;
