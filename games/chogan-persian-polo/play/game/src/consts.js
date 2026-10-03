// Field, horse, ball and swing constants shared by the simulation, the AI, the HUD and the presenter.
// Sim axes (top-down, screen-aligned): x = to the screen RIGHT, z = UP the screen (away from the camera). Heading h: forward = (sin h, cos h),
// the rider's right-hand side = (cos h, -sin h). Team 0 (the player's) defends z = -HL and attacks z = +HL; team 1 the other way round.
export const DT = 1 / 60;
export const HW = 6, HL = 14;                 // half width / half length of the field (12 m by 28 m)
export const CHAMFER = 2.6;                  // the four corners are cut at 45 degrees so the ball can never come to rest in one
export const GOAL_HW = 2.2;                  // half width of the goal mouth (4.4 m)
export const POST_R = 0.14;
export const BALL_R = 0.34;
export const FIG = 1.2;                      // the horses and riders are drawn this much larger than life so they read on a phone; every rider-relative distance below is scaled with them
export const GRAV = 9.8;

// horse
export const V_BASE = 7.0;                   // top speed without sprint (m/s)
export const V_SPRINT = 1.3;                 // sprint multiplier
export const ACC = 5.0, BRAKE = 9.0;         // m/s^2
export const A_LAT = 9.5;                    // lateral acceleration limit used for the turn rate
export const STAM_DRAIN = 0.2, STAM_REGEN = 0.1;   // per second
export const BODY_HALF_W = 0.38 * FIG, BODY_HALF_L = 1.1 * FIG;

// stick
export const WIND_MAX = 0.55;                // seconds to full power
export const STRIKE_TICKS = 10;              // release to contact when nothing better is found (10/60 s)
export const FOLLOW_TICKS = 14;              // contact to the end of the follow-through
export const SWING_COOL = 8;                 // ticks before the next wind-up
// Contact envelopes in the rider's frame (lat = distance to the stroke side, f = forward), verified against the mallet IK (dev/grid.mjs):
// R = forehand on the right (offside), B = back-hand on the right, L = near-side stroke across the neck. Inside these the mallet head meets the ball exactly.
// (measured on the unscaled figure and multiplied by FIG: the whole figure, arm and mallet scale together)
const SC = (E) => ({ latMin: E.latMin * FIG, latMax: E.latMax * FIG, fMin: E.fMin * FIG, fMax: E.fMax * FIG, latI: E.latI * FIG, fI: E.fI * FIG });
export const REACH = {
  R: SC({ latMin: 0.65, latMax: 1.15, fMin: 0.05, fMax: 0.9, latI: 0.9, fI: 0.48 }),
  B: SC({ latMin: 0.7, latMax: 1.05, fMin: -0.45, fMax: 0.2, latI: 0.88, fI: -0.1 }),
  L: SC({ latMin: 0.6, latMax: 1.15, fMin: 0.4, fMax: 1.15, latI: 0.85, fI: 0.77 }),
};
export const STRIKE_MIN = 8, STRIKE_MAX = 18;   // the stroke may choose its contact tick within this range after the release
export const HIT_MAX_Y = 0.8;               // the ball must be below this to be struck
export const HOOK_TICKS = 24, HOOK_WIN = [5, 15], HOOK_COOL = 36, HOOK_RANGE = 2.8 * FIG, HOOK_STUN = 34;

// match
export const PERIODS = 4;
export const PERIOD_SECS = [60, 90, 120];
export const RESET_MAX = 6.0, THROW_COUNT = 2.4, GOAL_PAUSE = 3.0, FOUL_PAUSE = 1.8, BREAK_PAUSE = 4.0;

export const ROLES = ['Attacker', 'Midfielder', 'Back'];
export const ROLE_NUM = ['1', '2', '3'];
// kick-off spots for team 0; team 1 mirrors both x and z
export const SPOTS = [{ x: 1.8, z: -2.0 }, { x: -2.0, z: -5.0 }, { x: 0.3, z: -8.8 }];

// AI levels: reaction time, speed cap, shot angle error (rad), pass/goal sense, hook skill, decision noise
export const LEVELS = [
  { id: 1, name: 'Village Rider', react: 0.55, cap: 0.58, err: 0.50, sense: 0.15, hook: 0.03, sprint: 0.2, stars: 1 },
  { id: 2, name: 'Club Player', react: 0.38, cap: 0.70, err: 0.34, sense: 0.35, hook: 0.12, sprint: 0.45, stars: 2 },
  { id: 3, name: 'Regional Pro', react: 0.24, cap: 0.82, err: 0.22, sense: 0.58, hook: 0.28, sprint: 0.7, stars: 3 },
  { id: 4, name: 'National Star', react: 0.14, cap: 0.94, err: 0.11, sense: 0.80, hook: 0.45, sprint: 0.9, stars: 4 },
  { id: 5, name: 'Champion', react: 0.03, cap: 1.05, err: 0.02, sense: 1.0, hook: 0.6, sprint: 1.0, stars: 5 },
];
export const MATE_LEVEL = 3;
