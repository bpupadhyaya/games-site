// Shared constants and tiny helpers for the pure simulation and the screens. No DOM, no clock, no Math.random.
export const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
export const lerp = (a, b, t) => a + (b - a) * t;
export const smooth = (t) => t * t * (3 - 2 * t);

export const NLANES = 4;
export const LANE_W = 5;
export const HALF_W = 12.5;          // the river is a little wider than the four lanes
export const BOAT_LEN = 12.4;
export const HALF_LEN = BOAT_LEN / 2;
export const laneX = (i) => (i - (NLANES - 1) / 2) * LANE_W;

// timing windows in seconds: Perfect, Great, Good, Ragged (beyond Ragged is a miss)
export const WINDOWS = { easy: [0.085, 0.15, 0.22, 0.3], normal: [0.065, 0.12, 0.18, 0.25], tight: [0.05, 0.09, 0.14, 0.2] };
export const TIERS = ['perfect', 'great', 'good', 'ragged'];
export const TIER_Q = { perfect: 1, great: 0.8, good: 0.55, ragged: 0.25, miss: 0 };
export const TIER_LABEL = { perfect: 'PERFECT', great: 'GREAT', good: 'GOOD', ragged: 'RAGGED', miss: 'MISS' };

export const TEXT_SCALES = [1, 1.25, 1.5, 2, 2.5, 3];
export const THINK_STEPS = [2, 5, 8, 10];
export const placeName = (p) => ['1st', '2nd', '3rd', '4th'][p] ?? `${p + 1}th`;
export const fmtTime = (t) => { t = Math.max(0, t); const m = Math.floor(t / 60), s = t - m * 60; return `${m}:${s < 10 ? '0' : ''}${s.toFixed(1)}`; };
export const spm = (period) => Math.round(60 / period);
