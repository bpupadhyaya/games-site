// Numbers shared by the simulation, the drawing and the Rules text, so the Rules page can never disagree with the engine.
export const G = 9.81;             // m/s^2
export const PIVOT_Y = 1.38;       // shoulder height of the thrower, metres
export const LINE_X = 0.8;         // the throwing line: every distance is measured from here, metres
export const MIN_FAIR = 2;         // a boot that lands closer than this (or behind the line) is a no-throw
export const ARM_R = 0.95;         // how far the boot circles from the shoulder in the picture (drawing only)
export const OMEGA0 = 3.6;         // radians per second when the swing starts
export const SWEET_FRAC = 0.965;   // the sweet arc: launch angles within this fraction of the best distance
export const THROWS_PER_ROUND = 3;
export const CHALLENGE_LIVES = 3;
export const STAR_NAMES = ['Beat the rival', 'Reach the second mark', 'Reach the top mark'];
export const SECTOR_MAX = 16;      // degrees: the widest lane the plan strip can show

// Throwing styles. reach = metres of effective throwing radius (arm + body turn) so that speed = omega * reach.
// wMax = the swing's top speed (rad/s), tau = how quickly the swing builds (s), grip = how long the hand holds on before the boot slips (s),
// wob = degrees of sideways error the style adds (it is a smooth function of the boot's angle, so it can be read on the plan strip).
export const STYLES = [
  { id: 'under', name: 'Underarm Swing', short: 'Underarm', reach: 2.77, wMax: 8.2, tau: 1.7, grip: 4.2, wob: 0.35, note: 'Steady and forgiving' },
  { id: 'over', name: 'Overarm Hurl', short: 'Overarm', reach: 3.1, wMax: 9.4, tau: 1.7, grip: 3.4, wob: 0.8, note: 'Balanced power' },
  { id: 'spin', name: 'Full Spin', short: 'Spin', reach: 3.05, wMax: 10.8, tau: 1.4, grip: 2.8, wob: 1.9, note: 'Big power, wild' },
];
export const SLIP_BAND = [0.86, 1.14];   // the real slip moment is the style's grip time times a number in this band

// Boots (look and weight of the day). drag multiplies the air resistance: a light boot is blown about more.
export const BOOTS = [
  { id: 'farm', name: 'Farm boot', col: '#3f7a3a', sole: '#1f2a1c', drag: 1.0 },
  { id: 'kids', name: "Kids' boot", col: '#f2c230', sole: '#6a4a10', drag: 1.28 },
  { id: 'work', name: 'Work boot', col: '#2b2f36', sole: '#0f1114', drag: 0.9 },
  { id: 'rain', name: 'Rain boot', col: '#d24a3c', sole: '#4a1812', drag: 1.1 },
  { id: 'event', name: 'Event boot', col: '#2f7fb8', sole: '#10304a', drag: 1.0 },
];
export const KD = 0.0105;          // air resistance per metre (quadratic)

// Rounds of the Festival Cup. wind = strongest steady wind (m/s), sector = half-angle of the legal lane (degrees), skill = the rival (0-1),
// star2/star3 = the distances for two and three stars, sky = look of the day, boot = index into BOOTS.
export const ROUNDS = [
  { id: 'fete', name: 'Village Fete', wind: 1.5, sector: 15, skill: 0.2, star2: 26, star3: 34, sky: 0, boot: 0 },
  { id: 'market', name: 'Market Day', wind: 3.0, sector: 13, skill: 0.4, star2: 28, star3: 36, sky: 1, boot: 1 },
  { id: 'district', name: 'District Games', wind: 4.5, sector: 11.5, skill: 0.55, star2: 31, star3: 39, sky: 2, boot: 2 },
  { id: 'national', name: 'National Final', wind: 6.0, sector: 10, skill: 0.7, star2: 34, star3: 42, sky: 3, boot: 3 },
  { id: 'grand', name: 'Grand Final', wind: 7.5, sector: 9, skill: 0.85, star2: 36, star3: 46, sky: 4, boot: 4 },
];
export const RUNS_PER_ROUND = THROWS_PER_ROUND;
export const WINDS = [{ name: 'Calm', k: 0 }, { name: 'Breezy', k: 0.45 }, { name: 'Gusty', k: 1 }];
export const THINK_STEPS = [2, 5, 8, 10];

// Distance Challenge: every three throws the wind rises and the lane narrows.
export const challengeLevel = (n) => {
  const k = Math.min(10, Math.floor(n / 3));
  return { wind: 1 + k * 0.7, sector: Math.max(8, 15 - k * 0.7), sky: k % 5, boot: k % BOOTS.length };
};

export const LESSONS = [
  { id: 'power', title: 'Power', goal: 'Throw 20 m or more twice in 5 throws', runs: 5, need: 2, mode: 'far', far: 20, cfg: { wind: 0, sector: 16, boot: 0, style: 0 }, intro: [
    'The swing builds speed the longer you hold. The grip bar shows how long the hand can hold on: when it turns red the boot may slip away.',
    'Press and hold to swing, let go to throw. Hold for about two seconds, then let go as the boot comes up through the sweet arc.'] },
  { id: 'angle', title: 'Angle', goal: 'Throw 22 m or more twice in 5 throws', runs: 5, need: 2, mode: 'far', far: 22, cfg: { wind: 0, sector: 16, boot: 0, style: 1 }, intro: [
    'The boot flies off in the direction it is moving at the moment you let go. Too low and it skims the grass, too high and it only floats. The sweet arc shows the best angle.',
    'Let go while the boot is inside the green arc, a little after it passes the bottom of the circle.'] },
  { id: 'wind', title: 'Wind', goal: 'Two fair throws of 18 m or more in 5 throws', runs: 5, need: 2, mode: 'far', far: 18, cfg: { wind: 4.2, sector: 12, boot: 1, style: 1 }, intro: [
    'Wind pushes a light boot across the lane. The arrow on the plan strip shows the wind. Drag on the strip to turn the aim into the wind so the boot drifts back to the middle.',
    'A boot that lands outside the lane lines is a no-throw. A headwind shortens the throw and wants a lower angle; a tailwind wants a higher one.'] },
];
