// Numbers shared by the simulation, the drawing and the Rules text, so the Rules page can never disagree with the engine.
// Units: metres, seconds. Energy, water, paws and mood of every dog run from 0 (empty) to 1 (full).
export const V_MAX = 11;           // m/s at a full gallop on the flat with a fresh team
export const PACE_FLOOR = 0.15;    // share of V_MAX at pace 0.0 (the walk)
export const ACC = 2.2;            // m/s^2 the team gains speed
export const DEC = 3.0;            // m/s^2 the sled loses speed by itself
export const BRAKE_DEC = 6.5;      // m/s^2 with the brake held
export const BRAKE_V = 4.5;        // top speed with the brake held
export const STEEP = -0.075;       // a downhill slope steeper than this needs the brake
export const OVERRUN_V = 9;        // m/s above which a steep downhill without the brake overruns the wheel dogs
export const OVERRUN_MOOD = 0.14;  // mood the wheel dogs lose in an overrun
export const TIRED_E = 0.08;       // below this energy a dog rides in the sled bag
export const REJOIN_E = 0.45;      // a dog needs this much energy to be put back in harness
export const BAG_REGEN = 0.008;    // energy per second a dog regains while riding in the bag
export const LAYOVER = 8;          // seconds of mandatory layover at every checkpoint
export const LAYOVER_E = 0.05;     // energy every dog regains during the layover
export const DETOUR_S = 9;         // seconds added by taking the wrong trail at a junction
export const DETOUR_MOOD = 0.06;
export const HINT_COST = 1;        // seconds added to a leg that used the Think hint
export const PRAISE_CD = 3;        // seconds between two praises on the trail
export const PRAISE_MOOD = 0.05;
export const STAR_CARE = 0.65;     // care score the Care Award needs
export const LEG_STRIKE = 1.35;    // Trail Run: a leg over this times the target is a strike
export const TRAIL_LIVES = 3;
export const THINK_STEPS = [2, 5, 8, 10];
export const SNOW_K = { clear: 1, snow: 0.96, whiteout: 0.92 };
export const VIS = { clear: 80, snow: 52, whiteout: 30 };   // how far ahead a junction sign can be read
export const SIGN_WINDOW = 10;     // the call window opens this much after the sign becomes readable... shrinks as visibility falls

// Per second drains (each divided by the dog's stamina)
export const drainE = (p, slope) => 0.001 + 0.0139 * Math.pow(p, 2.5) + 0.01 * Math.max(0, slope) * (p + 0.2);
export const drainW = (p) => 0.0015 + 0.0045 * p;
export const drainP = (p, rough, booties) => (0.0012 + 0.004 * p) * (rough ? 3 : 1) * (booties ? 0.3 : 1);

// Care actions at a checkpoint: seconds for one dog, seconds for the whole team.
export const CARE = {
  water: { name: 'Water', one: 2.5, all: 9, gain: 0.7, text: 'fresh water' },
  snack: { name: 'Snack', one: 3.5, all: 12, gain: 0.15, text: 'a meaty snack' },
  paws: { name: 'Paws', one: 3.5, all: 13, gain: 0.55, text: 'a paw check and booties' },
  rest: { name: 'Rest', all: 10, gain: 0.16, text: 'ten minutes on the straw' },
  praise: { name: 'Praise', one: 2, all: 5, gain: 0.25, allGain: 0.12, text: 'a cuddle and kind words' },
  bag: { name: 'Bag', one: 1.5, text: 'ride in the sled bag' },
};

// The team: six dogs in three pairs. pair 0 leaders, pair 1 swing dogs, pair 2 wheel dogs (next to the sled). power = how much of the pull
// the dog gives, stamina = how slowly its energy drains, cmd = how readily it answers Gee and Haw (leaders only).
export const DOGS = [
  { id: 'juno', name: 'Juno', role: 'Leader', coat: ['#dfe5ec', '#4a5360', '#9fb4c8'], power: 1.0, stamina: 1.0, cmd: 0.97, blurb: 'Calm, answers every call' },
  { id: 'pika', name: 'Pika', role: 'Leader', coat: ['#2c3038', '#f4f6f8', '#d8c8a0'], power: 0.95, stamina: 0.92, cmd: 0.9, blurb: 'Quick and eager' },
  { id: 'bear', name: 'Bear', role: 'Swing', coat: ['#c8a47a', '#6b4a2a', '#e8d4b0'], power: 1.1, stamina: 0.94, cmd: 0, blurb: 'Strong, thirsty' },
  { id: 'sitka', name: 'Sitka', role: 'Swing', coat: ['#8e949c', '#f1f3f5', '#b9c3cc'], power: 1.0, stamina: 1.1, cmd: 0, blurb: 'Steady all day' },
  { id: 'koda', name: 'Koda', role: 'Wheel', coat: ['#b5502f', '#f2e3d0', '#8a3a20'], power: 1.15, stamina: 0.9, cmd: 0, blurb: 'Big and powerful' },
  { id: 'willow', name: 'Willow', role: 'Wheel', coat: ['#f1f1ee', '#a8a39a', '#d9d4c8'], power: 0.95, stamina: 1.2, cmd: 0, blurb: 'Tough little paws' },
];
export const POWER_SUM = DOGS.reduce((a, d) => a + d.power, 0);

// Looks: 0 dawn, 1 day, 2 dusk, 3 aurora night.
// A race is a list of legs; every leg except the last ends at a checkpoint. hill = amplitude of the hills in metres, rough = [from, to] as fractions of
// the leg, junctions = fraction of the leg and the marked direction (L = Haw, R = Gee).
export const RACES = [
  { id: 'meadow', name: 'Meadow Sprint', place: 'Open meadow trail', look: 0, skill: 0.76, legs: [
    { len: 400, hill: 3.5, rough: [], jx: [{ at: 0.55, dir: 'R' }], weather: 'clear' },
    { len: 380, hill: 4, rough: [[0.4, 0.62]], jx: [{ at: 0.5, dir: 'L' }], weather: 'clear' },
  ] },
  { id: 'pine', name: 'Pine Loop', place: 'Forest trail with soft snow', look: 1, skill: 0.84, legs: [
    { len: 420, hill: 5, rough: [], jx: [{ at: 0.4, dir: 'L' }], weather: 'clear' },
    { len: 460, hill: 5.5, rough: [[0.55, 0.8]], jx: [{ at: 0.3, dir: 'R' }, { at: 0.72, dir: 'L' }], weather: 'snow' },
    { len: 400, hill: 5, rough: [], jx: [{ at: 0.5, dir: 'R' }], weather: 'snow' },
  ] },
  { id: 'lake', name: 'Frozen Lake', place: 'Wide ice and lakeshore', look: 2, skill: 0.9, legs: [
    { len: 500, hill: 2.5, rough: [[0.15, 0.6]], jx: [{ at: 0.7, dir: 'L' }], weather: 'clear' },
    { len: 540, hill: 3, rough: [[0.1, 0.8]], jx: [{ at: 0.35, dir: 'R' }, { at: 0.8, dir: 'R' }], weather: 'snow' },
    { len: 440, hill: 4.5, rough: [[0.3, 0.5]], jx: [{ at: 0.5, dir: 'L' }], weather: 'clear' },
  ] },
  { id: 'pass', name: 'Mountain Pass', place: 'Steep climbs and long descents', look: 1, skill: 0.94, legs: [
    { len: 480, hill: 6.5, rough: [], jx: [{ at: 0.35, dir: 'R' }, { at: 0.75, dir: 'L' }], weather: 'clear' },
    { len: 520, hill: 7, rough: [[0.5, 0.75]], jx: [{ at: 0.45, dir: 'L' }, { at: 0.85, dir: 'R' }], weather: 'snow' },
    { len: 460, hill: 6.5, rough: [[0.1, 0.3]], jx: [{ at: 0.3, dir: 'R' }, { at: 0.6, dir: 'R' }], weather: 'snow' },
  ] },
  { id: 'long', name: 'Long Trail', place: 'Night under the aurora', look: 3, skill: 0.95, legs: [
    { len: 520, hill: 5, rough: [[0.6, 0.85]], jx: [{ at: 0.3, dir: 'L' }, { at: 0.7, dir: 'R' }], weather: 'clear' },
    { len: 560, hill: 6, rough: [[0.2, 0.5]], jx: [{ at: 0.25, dir: 'R' }, { at: 0.55, dir: 'L' }, { at: 0.85, dir: 'L' }], weather: 'snow' },
    { len: 520, hill: 6.5, rough: [[0.4, 0.7]], jx: [{ at: 0.4, dir: 'R' }, { at: 0.8, dir: 'R' }], weather: 'whiteout' },
    { len: 480, hill: 5.5, rough: [], jx: [{ at: 0.5, dir: 'L' }], weather: 'snow' },
  ] },
];
export const RIVALS = [
  { name: 'Red team', col: '#e5503a', d: 0.0 },
  { name: 'Green team', col: '#4fbf7a', d: -0.06 },
  { name: 'Gold team', col: '#f0b83a', d: -0.12 },
];

// Trail Run: an endless trail, one leg and one checkpoint after another, each with a target time; three legs over the target end it.
export const trailLeg = (n) => {
  const k = Math.min(12, n);
  const weather = ['clear', 'snow', 'clear', 'snow', 'whiteout'][n % 5];
  const dir = (i) => ((n * 7 + i * 3) % 5 < 2 ? 'L' : 'R');
  return { len: 380 + 14 * k, hill: 3 + 0.5 * k, rough: n % 2 ? [[0.3, 0.55]] : [], jx: [{ at: 0.35, dir: dir(0) }, ...(n >= 3 ? [{ at: 0.75, dir: dir(1) }] : [])], weather, look: n % 4 };
};

export const LESSONS = [
  { id: 'pace', title: 'Pace', goal: 'Finish one leg within 20% of the target time with no dog tired out', mode: 'pace', runs: 4, need: 1,
    leg: { len: 420, hill: 4, rough: [], jx: [], weather: 'clear' }, look: 1,
    intro: ['Slide the pace lever. Higher is faster, but every dog spends energy faster too, and hills cost extra. A steady pace that leaves the team fresh at the checkpoint is quicker over a long trail than a sprint that ends with tired dogs.',
      'This drill is a short leg with a few hills. Finish it within 20% of the target time and keep every dog out of the sled bag.'] },
  { id: 'calls', title: 'Gee and Haw', goal: 'Take every junction on the marked trail', mode: 'calls', runs: 4, need: 1,
    leg: { len: 420, hill: 3, rough: [], jx: [{ at: 0.25, dir: 'R' }, { at: 0.5, dir: 'L' }, { at: 0.78, dir: 'R' }], weather: 'clear' }, look: 0,
    intro: ['Sign boards stand at junctions. When the call marker lights up, tap Gee to go right or Haw to go left, the way the board points. The leaders answer.',
      'Miss a junction or call the wrong way and the team loses nine seconds on a detour. Call early in the window so the leaders have time.'] },
  { id: 'care', title: 'Care', goal: 'Finish with a care score of 60% or more', mode: 'care', runs: 4, need: 1,
    legs: [{ len: 380, hill: 4, rough: [[0.3, 0.7]], jx: [], weather: 'clear' }, { len: 360, hill: 4, rough: [[0.2, 0.5]], jx: [], weather: 'snow' }], look: 2,
    intro: ['Two short legs with a checkpoint between them. At the checkpoint spend a little time on the dogs: water, a snack, paws and a rest. Seconds spent on care are earned back later because tired dogs are slow dogs.',
      'The vet looks at every dog as the team arrives, so ease off before the checkpoint.'] },
];
export const CHAL_CARE = 0.5;
