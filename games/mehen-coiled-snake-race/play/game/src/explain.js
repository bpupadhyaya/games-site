// Plain-English reasons for a move: used by Think (hints) and by Watch & Learn. Reads the engine only.
import { isSafe, cellOf, isHome, isBack, hitChance, HEAD, progress, applyAction } from './rules.js';

const ord = (n) => n;
// How exposed is a lion on `cell` for seat p in state st (0..1): the best chance any rival has of landing on it next throw.
function exposure(st, p, cell) {
  if (cell < 1 || cell >= HEAD || isSafe(cell)) return 0;
  let h = 0;
  for (let q = 0; q < st.n; q++) if (q !== p) h = Math.max(h, hitChance(st, q, cell));
  return h;
}
const pctWord = (x) => (x < 0.12 ? 'very few' : x < 0.3 ? 'some' : x < 0.5 ? 'many' : 'most');

// act: an action of the player to move in `st`. name: seat name (or null for advice: "Enter a lion on stone 2"). Returns { head, why }.
export function describeAction(st, act, name) {
  const p = st.turn;
  const from = cellOf(act.from), to = isHome(act.to) ? HEAD : cellOf(act.to);
  const adv = !name;
  const verb = (base, third) => (adv ? base : third);
  const subj = adv ? '' : `${name} `;
  const cap1 = (s) => (adv ? s.charAt(0).toUpperCase() + s.slice(1) : s);
  const nudge = act.adj ? `${verb('spend', 'spends')} a marble to turn the ${act.value} into a ${act.value + act.adj}, then ` : '';
  let head, why;
  const nx = applyAction(st, act);
  const exp = act.kind === 'capture' || isHome(act.to) || isSafe(to) || to >= HEAD ? 0 : exposure(nx, p, to);
  let core;
  if (act.kind === 'enter') core = `${verb('enter', 'enters')} a lion on stone ${to}`;
  else if (act.kind === 'home') core = `${verb('bring', 'brings')} a lion home`;
  else if (act.kind === 'head') core = `${verb('take', 'takes')} a lion to the head`;
  else if (act.kind === 'capture') core = from ? `${verb('move', 'moves')} a lion from ${from} to ${to}, capturing a rival` : `${verb('enter', 'enters')} a lion on stone ${to}, capturing a rival`;
  else core = `${verb('move', 'moves')} a lion from ${from || 'the tail'} to ${to}`;
  head = cap1(`${subj}${nudge}${core}`);
  if (act.kind === 'capture') why = nx.last.marbleFrom >= 0 ? 'The rival lion goes back to the tail and its owner loses a marble to this seat.' : 'The rival lion goes back to the tail and must start over.';
  else if (act.kind === 'home') why = 'A lion home is safe for good and wins a marble.';
  else if (act.kind === 'head') why = 'The head is safe, and the lion has finished its outward run.';
  else if (act.kind === 'safe') why = `Stone ${to} is a resting stone: no rival can land on it, so the lion cannot be captured there.`;
  else {
    const was = exposure(st, p, from);
    if (was > 0.2 && exp < was - 0.1) why = 'It moves a lion out of the reach of rival throws.';
    else if (act.kind === 'enter') why = exp < 0.15 ? 'Getting a lion onto the track early keeps options open, and few rival throws can reach this stone.' : 'Getting a lion onto the track keeps options open, though some rival throws can reach this stone.';
    else if (exp >= 0.3) why = `It makes progress, but ${pctWord(exp)} of rival throws could land here, so it is a risk worth taking only for the speed.`;
    else why = `It makes steady progress, and ${pctWord(exp)} rival throws can reach it.`;
  }
  if (act.adj) why += ' The marble is worth it here.';
  return { head, why };
}

export function describePass(name, value) {
  return { head: `${name} cannot move a ${value}`, why: 'No lion can use that throw, so the turn passes.' };
}

// Think: the plan returned by planGen -> text for the status card
export function hintText(st, plan, name) {
  if (!plan.act) return { head: 'No move', why: 'No lion can use this throw, even with a marble.' };
  return describeAction(st, plan.act, null);
}
export { ord, progress, isBack };
