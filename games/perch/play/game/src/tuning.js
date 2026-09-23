// Every number that shapes the feel lives here (see design/GDD.md, "Rules and numbers").
export const T = {
  LIVES: 3,
  HIT_R: 44,
  FLIT_BASE: 0.24,     // seconds, plus distance / FLIT_SPEED
  FLIT_SPEED: 1500,
  REACH: 470,          // how far the bird will fly in one flit
  AVOID_R: 90,         // a perch this close to an incoming stone counts as targeted
  REST: 0.55,
  BUFFER: 0.15,
  STUN: 0.5,
  INVULN: 1.2,
  CLOSE_CALL: 0.25,
  WAVE_LEN: 20,
  MAX_HUNTERS: 14,
  FIRST_VOLLEY: 1.4,
  PULL_START: 1.4,
  PULL_MIN: 0.45,
  LOB_FLIGHT: 1.6,
  FLAT_FLIGHT: 1.0,
  FLIGHT_MIN: 0.7,
  GAP_START: 2.4,
  GAP_MIN: 0.35,
  STAGGER: 0.25,
  DEMO_RUNS: 3,
  WIND_DRIFT: 150,     // sideways drift of a stone per second of flight at full wind
  SEED_TTL: 7,
  SEED_EVERY: 5.5,
  SEED_POINTS: 10,
  BEATER_TIME: 1.1,
  BEATER_EVERY: 11,
  NET_FLIGHT: 1.2,
  AMMO_MAX: 3,          // acorns: earned by close calls, thrown at hunters
  NUT_FLIGHT: 0.3,
  HUNTER_STUN: 2.6,     // seconds a knocked-down hunter is out of the game
  KNOCK_POINTS: 5,
};

// Auto Play ("Watch & Learn"): THINK holds the state still so the viewer can guess before the bird
// acts, then REVEAL marks the reachable perches and the one about to be chosen, then ACT flits for
// real. An index into this list, never a raw float (same pattern as every other stepper in this
// codebase) - repo-wide hard cap is 10s, but perch's own pace is much faster than a board game's
// (first stone lands ~4.4s into a level; a hunter's pull-back is as short as 0.45s at high
// difficulty - see tuning above), so the shared brief's [2,5,8,10] default steps would make each
// single dodge decision take 7-12s of frozen viewing time, ballooning a 60s level into several real
// minutes. Scaled down consistently to [1,2,4,6]s (default index 1 = 2s) instead, well under the
// 10s cap, while keeping the exact same THINK -> REVEAL -> ACT shape and a configurable timeout.
export const AUTO_THINK_STEPS = [1, 2, 4, 6];
// REVEAL is fixed (not stepped), scaled down from the shared brief's ~2s by the same ratio as
// THINK's default (2s vs 5s, a 0.4 ratio) - 2 * 0.4 = 0.8s, rounded to a clean 1s.
export const AUTO_REVEAL_SECS = 1;

// Hunter slots in the order they join the field. `s` is the depth scale: near hunters are big,
// far ones small on the horizon, so the eyes keep switching distance and sweeping the width.
export const SLOTS = [
  { x: 35, y: 610, s: 0.62 }, { x: 685, y: 610, s: 0.62 },
  { x: 220, y: 362, s: 0.4 }, { x: 500, y: 362, s: 0.4 },
  { x: 70, y: 1150, s: 1 }, { x: 650, y: 1150, s: 1 },
  { x: 100, y: 345, s: 0.38 }, { x: 620, y: 345, s: 0.38 },
  { x: 40, y: 880, s: 0.82 }, { x: 680, y: 880, s: 0.82 },
  { x: 330, y: 352, s: 0.38 }, { x: 400, y: 352, s: 0.38 },
  { x: 30, y: 470, s: 0.5 }, { x: 690, y: 470, s: 0.5 },
  { x: 360, y: 410, s: 0.62 },   // the Master Hunter: only on boss levels
];
export const BOSS_SLOT = 14;

// Which threat kinds exist from which wave, and how likely each is once available.
// Threat kinds. `from`: difficulty step at which it can appear; `feat`: level feature that must be on.
export const KINDS = [
  { kind: 'lob', from: 0, weight: 3 },
  { kind: 'flat', from: 1, weight: 3 },
  { kind: 'double', from: 3, weight: 1.5 },
  { kind: 'fake', from: 5, weight: 1 },
  { kind: 'skipper', from: 7, weight: 1 },
  { kind: 'leader', from: 9, weight: 1 },
  { kind: 'arrow', from: 0, weight: 2.5, feat: 'archers' },
  { kind: 'net', from: 0, weight: 1.1, feat: 'nets' },
];
