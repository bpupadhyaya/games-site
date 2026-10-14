// Field, horse, javelin and match constants shared by the simulation, the AI, the HUD and the presenter.
// Sim axes: z runs ALONG the field (screen right in the side view), x is the lane axis (+x = the lane nearest the camera), y is up.
// Heading h: forward = (sin h, cos h) in (x, z). A pass runs in direction dir = +1 (toward +z) or -1.
export const DT = 1 / 60;
export const FIG = 1.35;                        // horses and riders are drawn this much larger than life so they read on a phone
export const GRAV = 9.8;
export const Z_END = 46, Z_START = 40;          // a pass runs from -dir*Z_START to +dir*Z_END
export const PADDOCK_Z = -53;                   // the teams wait here, behind the start end
export const LANES = [-2.6, 0, 2.6];            // lane 0 far, 1 middle, 2 near (x, metres)
export const LANE_NAMES = ['left', 'middle', 'right'];
export const FIELD_HW = 11;                      // half width of the trodden arena (wheeling room)

// pace
export const V_MIN = 3.6;                       // canter at the bottom of the slider (m/s)
export const GAITS = [{ v: 0, name: 'Canter' }, { v: 0.34, name: 'Easy gallop' }, { v: 0.68, name: 'Gallop' }, { v: 0.9, name: 'Full gallop' }];

// throwing
export const JAV_N = 3;                         // javelins per chaser per pass
export const WIND_TICKS = 12;                   // throw input to release (0.2 s)
export const FOLLOW_TICKS = 24;
export const THROW_COOL = 0.55;                 // seconds between throws
export const V_THROW = 25;                      // fastest a javelin can leave the hand relative to the rider (m/s)
export const HAND_Y = 3.3;                      // release height (drawn figure scale)
export const MARK_Y = 3.4;                      // centre of the target shield
export const MARK_BACK = 0.5;                   // the target standard rides this far behind the rider's centre
export const HIT_R = 0.78, BULL_R = 0.26, SOLID_R = 0.52;
export const REACH_MAX = 24;                    // longest throw (m)
export const flightTime = (dist) => Math.min(0.7, Math.max(0.3, 0.2 + dist / 48));

// lean
export const LEAN_T = 0.7, LEAN_SAFE = [0.12, 0.56];

// scoring
export const PTS = { bull: 15, solid: 10, glance: 5, dodge: 4, leanDodge: 2, fast: 3, long: 3, streakMax: 4, perfect: 2 };
export const LONG_RANGE = 14;

// pass timing
export const PASS_MAX = 15;                     // seconds
export const INTRO_T = 2.2, WHEEL_MAX = 3.6, OUTRO_T = 3.2;
export const GAP_START = 8;
export const BOUTS = [2, 3, 5];

// horses: top speed, acceleration, lateral speed, aim steadiness (lower = steadier), lean cooldown, stamina drain
export const HORSES = [
  { id: 0, name: 'Ruzgar', title: 'Swift', blurb: 'Fastest on the straight, wide in the turn.', vmax: 10.6, acc: 3.4, lat: 2.5, shake: 1.2, leanCool: 1.9, coat: 'bay', trait: ['Speed', 5], trait2: ['Agility', 3], trait3: ['Steadiness', 3] },
  { id: 1, name: 'Yildiz', title: 'Nimble', blurb: 'Quick to change lane and to lean away.', vmax: 9.6, acc: 4.0, lat: 3.9, shake: 1.0, leanCool: 1.2, coat: 'palomino', trait: ['Speed', 3], trait2: ['Agility', 5], trait3: ['Steadiness', 3] },
  { id: 2, name: 'Kaya', title: 'Steady', blurb: 'Smooth at a gallop: the steadiest throwing arm.', vmax: 9.9, acc: 3.5, lat: 2.9, shake: 0.55, leanCool: 1.6, coat: 'grey', trait: ['Speed', 4], trait2: ['Agility', 3], trait3: ['Steadiness', 5] },
];
export const OPP_COATS = ['chestnut', 'black', 'dun'];

// costume colour sets for the player's team; the rival gets a contrasting one
export const COSTUMES = [
  { id: 0, name: 'Crimson vest', top: '#b3262e', trim: '#f4ead2', bottoms: '#2d2a4a', cap: '#e8d9b0', cloth: '#b3262e' },
  { id: 1, name: 'Indigo and gold', top: '#23407f', trim: '#e9b94a', bottoms: '#efe6d0', cap: '#23407f', cloth: '#23407f' },
  { id: 2, name: 'Saffron sash', top: '#e0912a', trim: '#6d2a1c', bottoms: '#3a2b22', cap: '#f2e2b8', cloth: '#e0912a' },
  { id: 3, name: 'Forest felt', top: '#2f6b46', trim: '#f0e6c4', bottoms: '#4b3a2a', cap: '#2f6b46', cloth: '#2f6b46' },
];
export const SKINS = ['tan', 'brown', 'clay', 'peach', 'deep', 'ivory'];

// rival levels: reaction time (s), lead error (m), prediction quality, dodge skill, lane weaving, top pace, preferred throw band
export const LEVELS = [
  { id: 1, name: 'Village Rider', react: 0.62, err: 1.5, lead: 0.55, dodge: 0.16, weave: 0.10, thrMax: 0.74, band: [4.5, 11], stars: 1 },
  { id: 2, name: 'Club Rider', react: 0.44, err: 1.05, lead: 0.78, dodge: 0.36, weave: 0.26, thrMax: 0.84, band: [5, 13], stars: 2 },
  { id: 3, name: 'Regional Rider', react: 0.32, err: 0.68, lead: 0.92, dodge: 0.56, weave: 0.42, thrMax: 0.92, band: [5.5, 15], stars: 3 },
  { id: 4, name: 'National Rider', react: 0.22, err: 0.42, lead: 1.0, dodge: 0.76, weave: 0.6, thrMax: 0.97, band: [6, 17], stars: 4 },
  { id: 5, name: 'Champion', react: 0.14, err: 0.2, lead: 1.0, dodge: 0.92, weave: 0.78, thrMax: 1.0, band: [6, 18], stars: 5 },
];
export const MATE_LEVEL = 3;
export const CUP = [{ name: 'Quarter-final', lvl: 2 }, { name: 'Semi-final', lvl: 3 }, { name: 'Final', lvl: 4 }];
