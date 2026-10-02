// The throw: a drifting aim point that tightens as the hand settles and loosens again as the arm tires, plus a
// believable spread at release. Pure functions of the hold time. Distances are virtual pixels (1 mm of board = 1.66 px).
export const ASSIST = [{ name: 'Relaxed', k: 0.7, note: 'Calmer drift, tighter group' }, { name: 'Standard', k: 1, note: 'A real hand' }, { name: 'Pub-tough', k: 1.35, note: 'Shaky, like the last orders rush' }];

export const SETTLE = 1.4;     // seconds to reach the steadiest point
export const STEADY_END = 2.4; // seconds the hand stays at its steadiest
const A_START = 62, A_MIN = 22, A_MAX = 74;
const smooth = (x) => { const t = Math.min(1, Math.max(0, x)); return t * t * (3 - 2 * t); };

// Amplitude (px) of the aim point's drift after holding for t seconds.
export function swayAmp(t, k = 1) {
  let a = A_START + (A_MIN - A_START) * smooth(t / SETTLE);
  if (t > STEADY_END) a = Math.min(A_MAX, A_MIN + (t - STEADY_END) * 17);
  return a * k;
}
// 0 = shakiest, 1 = steadiest, for the colour of the reticle.
export function steadiness(t, k = 1) {
  const a = swayAmp(t, k) / k;
  return Math.max(0, Math.min(1, 1 - (a - A_MIN) / (A_START - A_MIN)));
}
export const tired = (t) => t > STEADY_END + 0.6;

// The drift of the aim point (px) at hold time t, with four fixed phases for this throw.
export function swayOffset(t, A, ph) {
  const TAU = Math.PI * 2;
  return {
    x: A * (0.62 * Math.sin(TAU * 0.63 * t + ph[0]) + 0.38 * Math.sin(TAU * 1.37 * t + ph[1])),
    y: A * (0.62 * Math.sin(TAU * 0.47 * t + ph[2]) + 0.38 * Math.sin(TAU * 1.11 * t + ph[3])),
  };
}
// Standard deviation (px per axis) of where the dart lands around the aim point at release: a hand-and-eye base, more when
// the aim point is drifting a lot, and extra when the finger is still moving at the moment of release.
export function spreadSigma(A, k = 1, fingerSpeed = 0) {
  const flick = Math.min(18, Math.max(0, fingerSpeed - 40) * 0.028);
  return (17 + 0.45 * A) * (0.6 + 0.4 * k) + flick;
}
