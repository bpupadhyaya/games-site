// Contact physics: how well a touch goes. Pure numbers in, numbers out, so it can be tuned and tested by simulation.
// Quality q in 0..1: 1 is a perfect touch. Every tunable lives in TUNE.
import { clamp } from './util.js';

export const TUNE = {
  // serve
  srvErr: { float: 0.045, jump: 0.20 },       // base probability of a serve error (net or out) for an average server
  srvSpread: 0.45,                            // metres of landing scatter at q = 1
  // passing (receive / dig)
  passBase: 0.34, passSkill: 0.62, passSpeed: 0.62, passStretch: 0.45, passTm: 0.22,
  // setting
  setBase: 0.34, setSkill: 0.55, setStretch: 0.35, setTm: 0.16,
  // attack
  atkBase: 0.16, atkSkill: 0.36, atkTm: 0.22, atkStretch: 0.30, atkSet: 0.24,
};

// Press timing: e = press time minus the ideal time (s). win = the window width. 1 = perfect, ~0.1 = very bad.
export function tmFromErr(e, win) {
  const a = Math.abs(e) / win;
  if (a <= 0.3) return 1;
  if (a <= 1) return 1 - (a - 0.3) * 0.78;
  if (a <= 2) return 0.454 - (a - 1) * 0.31;
  return 0.12;
}
export const tmLabel = (tm) => (tm >= 0.9 ? 'PERFECT' : tm >= 0.7 ? 'GOOD' : tm >= 0.45 ? 'OK' : 'POOR');

// Timing noise of an AI player (s, one standard deviation). A better player presses closer to the ideal moment.
export const aiSigma = (skill) => 0.165 - 0.115 * skill;

// Ring timing per skill: the ring closes LAG seconds before the contact; it opens OPEN seconds before it closes.
export const LAG = { serve: 0.30, receive: 0.18, set: 0.20, attack: 0.30, block: 0.34, free: 0.18, dump: 0.24 };
export const WIN = { serve: 0.17, receive: 0.16, set: 0.16, attack: 0.15, block: 0.15, free: 0.17, dump: 0.15 };
export const OPEN = 0.95;

export function passQuality(st, tm, stretch, vin, noise = 0) {
  const v = clamp((vin - 6) / 19, 0, 1);
  const q = TUNE.passBase + TUNE.passSkill * st.pass - TUNE.passSpeed * v * (1.2 - 0.7 * st.pass) - TUNE.passStretch * stretch + TUNE.passTm * (tm - 0.6) + noise * 0.10 * (1.2 - st.pass);
  return clamp(q, 0.02, 1);
}
export function setQuality(st, tm, stretch, inQ, noise = 0) {
  const q = TUNE.setBase + TUNE.setSkill * st.set - TUNE.setStretch * stretch + TUNE.setTm * (tm - 0.6) + 0.08 * (inQ - 0.5) + noise * 0.08 * (1.2 - st.set);
  return clamp(q, 0.02, 1);
}
export function serveQuality(st, tm, noise = 0) {
  return clamp(0.25 + 0.55 * st.srv + 0.22 * (tm - 0.6) + noise * 0.08, 0.04, 1);
}
export function serveErrP(st, type, tm) {
  return clamp(TUNE.srvErr[type] * (1.2 - 0.65 * st.srv) * (1 + 1.4 * Math.max(0, 0.7 - tm)), 0.005, 0.7);
}
// Attack: efficiency from the hitter, the set and the timing.
export function attackQuality(st, tm, stretch, setQ, noise = 0) {
  const q = TUNE.atkBase + TUNE.atkSkill * st.att + TUNE.atkTm * (tm - 0.5) - TUNE.atkStretch * stretch + TUNE.atkSet * (setQ - 0.5) + noise * 0.09 * (1.2 - st.att);
  return clamp(q, 0.02, 1);
}
// A hand-made saying of what a quality number means, for the HUD.
export const qLabel = (q) => (q >= 0.85 ? 'Perfect' : q >= 0.65 ? 'Good' : q >= 0.45 ? 'Fair' : q >= 0.25 ? 'Poor' : 'Bad');
