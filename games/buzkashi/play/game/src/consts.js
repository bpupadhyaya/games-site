// Numbers shared by the simulation, the drawing and the Rules text, so the Rules page can never disagree with the engine.
export const FIELD = { x0: -16, x1: 16, y0: -27, y1: 27 };      // the playing field in metres (x across, y up the field)
export const FLAG = { x: 0, y: 19 };                              // the turning post at the far end
export const CIRCLE = { x: 0, y: -19, r: 3.6 };                   // the scoring circle at the near end
export const CENTRE = { x: 0, y: 0, r: 2.4 };                     // where the sack starts every carry
export const FLAG_RING = 9;         // metres: going round the post only counts this close to it
export const FLAG_WIND = 3.0;       // radians (a little over a half turn) swept round the post to have rounded it

export const RIDER_R = 0.85;        // body circle of a rider and horse
export const V_WALK = 2.6;          // m/s
export const ACC = 5.2;             // m/s^2
export const BRAKE = 9.5;           // m/s^2
export const SPRINT_MUL = 1.2;      // top speed multiplier while spurring
export const STAM_DRAIN = 0.3;      // stamina per second while spurring
export const SHIELD_DRAIN = 0.1;    // stamina per second while shielding
export const STAM_REGEN = 0.11;     // stamina per second otherwise
export const TIRED = 0.12;          // below this stamina the horse is blown and slows
export const CARRY_MUL = 0.88;      // speed multiplier while carrying the sack
export const SHIELD_MUL = 0.8;      // speed multiplier while shielding it
export const SCOOP_REACH = 1.6;     // metres from a rider to the sack to start a scoop
export const SCOOP_T = 0.35;        // seconds the rider leans down
export const SCOOP_VMAX = 9.0;      // faster than this and the scoop is fumbled
export const STRIP_REACH = 2.1;     // metres between two riders to try to strip the sack
export const STRIP_CD = 1.1;        // seconds between strip attempts
export const STRIP_BASE = 0.36;     // chance of a strip between equal riders
export const STRIP_STR = 0.34;      // added per point of strength difference
export const STRIP_SHIELD = 0.28;   // taken off when the carrier shields
export const STRIP_TIRED = 0.18;    // added against a blown horse
export const STRIP_MIN = 0.08;
export const STRIP_MAX = 0.78;
export const RECOVER_T = 0.7;       // seconds a rider who was stripped cannot grab
export const HINT_NOTE = 'A hinted chukka cannot earn a third star.';
export const MAX_THINK = 10;
export const RESET_T = 2.6;         // seconds of pause after a carry is scored
export const OVERTIME = 45;         // seconds of sudden death after a tie
export const GAUNTLET_TIME = 120;
export const CUP_CARRY_VALUE = 1;

export const HORSES = [
  { id: 'steady', name: 'Steady', vTop: 10.4, turn: 1.0, str: 1.0, blurb: 'Balanced' },
  { id: 'swift', name: 'Swift', vTop: 11.2, turn: 1.1, str: 0.82, blurb: 'Fast, easily stripped' },
  { id: 'strong', name: 'Strong', vTop: 9.7, turn: 0.95, str: 1.3, blurb: 'Slow, hard to strip' },
];

// Rounds of the Winter Cup. size = riders per side (you and your team mates against the same number), skill = rivals' skill 0-1,
// look = field look (0 dawn, 1 day, 2 afternoon, 3 winter, 4 floodlit), time = seconds of the chukka.
export const ROUNDS = [
  { id: 'meadow', name: 'Village Meadow', size: 2, skill: 0.2, look: 0, time: 120, ground: 'Soft meadow' },
  { id: 'valley', name: 'Valley Festival', size: 3, skill: 0.38, look: 1, time: 150, ground: 'Dry grass' },
  { id: 'foothills', name: 'Foothills Cup', size: 3, skill: 0.55, look: 2, time: 150, ground: 'Packed earth' },
  { id: 'winter', name: 'Winter Tournament', size: 4, skill: 0.72, look: 3, time: 180, ground: 'Frozen ground' },
  { id: 'grand', name: 'Grand Championship', size: 4, skill: 0.9, look: 4, time: 180, ground: 'Hard earth' },
];
export const GROUNDS = [{ name: 'Firm', k: 1.0 }, { name: 'Soft', k: 0.94 }, { name: 'Frozen', k: 1.04 }];
export const THINK_STEPS = [2, 5, 8, 10];

// Gauntlet: you alone against rivals who join after every carry. Score = carries x 100 + the seconds left on the clock after the last carry.
export const gauntletRivals = (carries) => Math.min(5, 1 + Math.floor(carries / 1.5));
export const gauntletSkill = (carries) => Math.min(0.9, 0.3 + 0.09 * carries);

export const LESSONS = [
  { id: 'scoop', title: 'The scoop', goal: 'Scoop the sack cleanly three times', mode: 'scoop', need: 3, time: 90, cfg: { size: 1, rivals: 0, skill: 0.1, look: 1 }, intro: [
    'Ride up to the sack and tap Grab when it is within about a horse length. Come in slowly: at a gallop the scoop is fumbled and the sack bounces away.',
    'Hold a finger where you want the horse to go. The nearer the finger is to the rider, the slower it rides.'] },
  { id: 'flag', title: 'Round the post', goal: 'Carry the sack round the post and into the circle twice', mode: 'carry', need: 2, time: 120, cfg: { size: 1, rivals: 0, skill: 0.1, look: 2 }, intro: [
    'A carry counts only if the sack goes round the far post first, then into the white circle at the near end. A half turn round the post is enough, on either side.',
    'The gold ring on the post fills as you turn round it. The sack stays rounded even if it is stripped from you.'] },
  { id: 'strip', title: 'Shield and strip', goal: 'Score one carry against one rival', mode: 'carry', need: 1, time: 120, cfg: { size: 1, rivals: 1, skill: 0.3, look: 3 }, intro: [
    'Hold Shield to tuck the sack in: it makes you harder to strip but a little slower. Ride alongside a rider with the sack and tap Grab to try to strip it.',
    'A tired horse is easier to strip. Spur gives a burst of speed but empties the stamina bar.'] },
];
