// Third-person explanations for Watch & Learn: what a computer player is about to do and why, using the same race numbers
// (runTimes) the rival itself uses to decide. Pure.
import { CAN, LINE_Z, STYLES, taya, slipOf, runTimes, canUp, fixTime } from './sim.js';
import { bestTarget } from './ai.js';

const hyp = Math.hypot;
const f1 = (v) => (Math.round(v * 10) / 10).toFixed(1);

export function explainThrow(w, a, name, style) {
  const T = taya(w), near = hyp(T.x, T.z - CAN.z);
  const st = STYLES[style];
  return {
    title: `${name} will throw a ${st.name.toLowerCase()} at the middle of the can`,
    text: `${style === 'skim' ? 'A skim is low and fast: if it hits, the can flies a long way and the guard has far to go.' : 'A lob drops from above and is easier to place, but the can only rolls a short way.'} The guard is ${f1(near)} m from the can.`,
    mark: { x: 0, z: CAN.z },
  };
}
export function explainDash(w, a, name) {
  const rt = runTimes(w, a), s = slipOf(w, a.id), down = !canUp(w);
  return {
    title: `${name} decides to run for the slipper`,
    text: `${down ? `The can is down, so the guard needs about ${f1(rt.fix)} s to stand it up before tagging. ` : ''}${name} needs about ${f1(rt.tMe)} s to fetch it and get home; the guard needs about ${f1(rt.tTaya)} s to arrive. That is ${rt.slack >= 0 ? `a lead of ${f1(rt.slack)} s` : `a risk: ${f1(-rt.slack)} s short, but waiting longer is worse`}.`,
    mark: { x: s.x, z: s.z },
  };
}
export function explainTaya(w, name, mode) {
  const c = w.can;
  if (mode === 'fetch') return { title: `${name} goes for the can`, text: `The can is down ${f1(hyp(c.x - taya(w).x, c.z - taya(w).z))} m away. While it lies there the guard cannot tag anyone, so fetching it fast matters most.`, mark: { x: c.x, z: c.z } };
  const tg = bestTarget(w);
  if (tg) return { title: `${name} chases a runner`, text: `The runner is ${f1(Math.max(0, tg.a.z))} m from the toe line, about ${f1(tg.tHome)} s from home. The guard can reach them in about ${f1(tg.tCatch)} s, so a tag is ${tg.tCatch < tg.tHome ? 'possible' : 'a long shot'}.`, mark: { x: tg.a.x, z: tg.a.z } };
  return { title: `${name} watches the yard`, text: 'The guard stays near the can and the slippers.', mark: null };
}
export { fixTime, LINE_Z };
