// Numbers shared by the simulation, the drawing and the Rules text, so the Rules page can never disagree with the engine.
export const ARENA = { x0: -20, x1: 20, y0: -11, y1: 53 };  // the fenced arena in metres (x across, y up the arena)
export const FIG = 1.7;             // horse and rider are drawn this much larger than life so they read on a phone (the sim's body circles are this scale)
export const START_Y = -9;          // the rider waits here, behind the timing line
export const YAW_MAX = 2.5;         // radians per second at most
export const ACC = 5.0;             // m/s^2 at a standstill
export const SCRUB = 0.10;          // speed lost per radian turned (1/rad): hard turns cost speed
export const BODY_R = 0.5;          // horse body circle radius (three circles along the body)
export const BRAKE = 8.5;           // m/s^2 of slowing when the reins are pulled all the way back
export const BARREL_R = 0.5;        // barrel radius
export const KNOCK_S = 5;           // seconds added for each barrel knocked over
export const WIND_DONE = 4.2;       // radians (about 240 degrees) of turning around a barrel to complete it
export const WIND_RING = 12;        // metres: turning only counts this close to the barrel
export const BURST_T = 1.4;         // seconds of burst, once per run
export const BURST_V = 1.18;        // top speed multiplier during the burst
export const BURST_A = 2.2;         // acceleration multiplier during the burst
export const HINT_COST = 1;         // seconds added to a run that used the Think hint
export const TIME_LIMIT = 70;       // seconds: a run that takes longer is a did-not-finish
export const RUNS_PER_ROUND = 3;
export const CHALLENGE_LIVES = 3;
export const STAR_GOLD = 1.2;       // two stars: total at most this times the ideal total
export const STAR_PLAT = 1.1;       // three stars: total at most this times the ideal total

export const HORSES = [
  { id: 'steady', name: 'Steady', vTop: 10.5, acc: 4.8, gripAdd: 1.0, blurb: 'Sure-footed' },
  { id: 'quick', name: 'Quick', vTop: 11.5, acc: 5.2, gripAdd: 0, blurb: 'Balanced' },
  { id: 'flyer', name: 'Flyer', vTop: 12.8, acc: 5.6, gripAdd: -1.0, blurb: 'Fast, wide turns' },
];

// Rounds of the Rodeo Cup. sp = pattern size (1 = the standard pattern), grip = metres per second squared the horse can turn with,
// skill = the rival's skill (0-1), look = arena look (0 dawn, 1 day, 2 afternoon, 3 dusk, 4 floodlit night).
export const ROUNDS = [
  { id: 'paddock', name: 'Village Paddock', sp: 0.86, grip: 15.0, skill: 0.2, look: 0, ground: 'Packed dirt' },
  { id: 'fair', name: 'County Fair', sp: 0.93, grip: 14.5, skill: 0.35, look: 1, ground: 'Packed dirt' },
  { id: 'regional', name: 'Regional Finals', sp: 1.0, grip: 14.0, skill: 0.5, look: 2, ground: 'Fine sand' },
  { id: 'state', name: 'State Finals', sp: 1.06, grip: 13.2, skill: 0.65, look: 3, ground: 'Damp clay' },
  { id: 'national', name: 'National Finals', sp: 1.12, grip: 12.6, skill: 0.8, look: 4, ground: 'Deep sand' },
];
export const GROUNDS = [{ name: 'Firm', k: 1.0 }, { name: 'Sandy', k: 0.9 }, { name: 'Heavy', k: 0.8 }];
export const THINK_STEPS = [2, 5, 8, 10];

// Time Trial: a target time for every run, tighter every three runs; three runs over the target ends it.
export const challengeCourse = (n) => {
  const k = Math.min(10, Math.floor(n / 3));
  return { sp: 0.86 + 0.032 * k, grip: 15 - 0.24 * k, look: k % 5, parMul: 1.45 - 0.026 * k };
};

export const LESSONS = [
  { id: 'steer', title: 'Steering', goal: 'Finish a run with no barrel knocked, once in 4 runs', runs: 4, need: 1, mode: 'clean', cfg: { sp: 0.82, grip: 16.5, look: 1 }, intro: [
    'Put a thumb anywhere and slide it left or right: the horse turns the way you slide. The further you slide, the tighter it turns. Let go and it runs straight.',
    'The pattern in this drill is small and the ground is firm. Ride around the right barrel, the left barrel, the far barrel and home.'] },
  { id: 'line', title: 'The line', goal: 'Finish a run in under the target time', runs: 4, need: 1, mode: 'par', parMul: 1.55, cfg: { sp: 0.95, grip: 14.5, look: 2 }, intro: [
    'A hard turn costs speed, so the shortest line is not always the fastest. Open the turn early, keep the horse close to the barrel without touching it and leave the turn on a straight line to the next one.',
    'The dotted line on the ground is a good line. Follow it, then try to improve on it.'] },
  { id: 'burst', title: 'Burst', goal: 'Finish three runs with the burst used on the home stretch', runs: 5, need: 3, mode: 'burstHome', cfg: { sp: 1.0, grip: 14, look: 3 }, intro: [
    'Once in every run you can tap Burst for a short surge. It adds the most when used on a straight, so keep it for the run home after the third barrel.',
    'Use it too early and the next turn will slide wide.'] },
];
