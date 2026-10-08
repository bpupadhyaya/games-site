// Field, ball and kick constants plus the content tables (ladder grounds, rivals). Distances in metres, angles in radians.
// Coordinates: the try line (posts) is z = 0, the kicker is at z = -d; +z runs toward the posts; +x is to the RIGHT of a kicker facing the posts.
export const GOAL_HW = 2.8;          // half the distance between the uprights (5.6 m apart)
export const BAR_H = 3.0;            // crossbar height
export const POST_R = 0.05;          // upright radius
export const BALL_R = 0.12;          // the ball radius used for flight and touches (a ball is not round: this is the mean)
export const TEE_Y = 0.16;           // ball centre height on the tee
export const G = 9.81;
export const KD = 0.0105;            // quadratic drag per metre (0.5 rho Cd A / m)
export const VMAX = 33;              // launch speed at full power (m/s)
export const CURL_A = 1.5;           // sideways acceleration (m/s^2) from a full curl
export const RUN_Q = 2.2;            // seconds from KICK to the ring closing (the strike cue)
export const CONTACT_LATE = 0.1;     // the foot meets the ball this long after the cue; a press up to here still counts
export const EARLY_MAX = 0.45;       // a press earlier than this before the cue is ignored (it is not a strike)
export const BEATS = [0.7, 1.2, 1.7];
export const YAW_PER_S = 0.16;       // sideways pull per second of timing error (rad/s), early pulls left, late pushes right
export const AIM_MAX = 16;           // the aim marker slides this far (m) from the posts' centre line
export const TILTS = [
  { id: 'upright', name: 'Upright', short: 'High', elev: 40 * Math.PI / 180, blurb: 'Highest flight. Carries the farthest for the power, but it hangs in the air so the wind pushes it the most.' },
  { id: 'lean', name: 'Leaning', short: 'Mid', elev: 32 * Math.PI / 180, blurb: 'The balanced flight: good height, good range, a fair share of drift.' },
  { id: 'flat', name: 'Flat', short: 'Low', elev: 25 * Math.PI / 180, blurb: 'Low and driven. Less range for the same power, less drift, and from close it can pass under the bar.' },
];
export const QUALITY = [
  { id: 'perfect', name: 'Perfect strike', max: 0.05 },
  { id: 'good', name: 'Good strike', max: 0.11 },
  { id: 'ok', name: 'Scuffed', max: 0.22 },
  { id: 'poor', name: 'Mistimed', max: 9 },
];
// Wind direction alpha is where the wind BLOWS TOWARD, measured from +z (toward the posts) turning toward +x: 0 tailwind, pi/2 blows to the right, pi headwind.
export const windVec = (ws, dir) => ({ x: ws * Math.sin(dir), z: ws * Math.cos(dir) });

export const GROUNDS = [
  { id: 'paddock', name: 'Training Paddock', light: 'day', crowd: 0.1, sky: 0 },
  { id: 'green', name: 'Village Green', light: 'day', crowd: 0.3, sky: 1 },
  { id: 'coast', name: 'Coastal Ground', light: 'day', crowd: 0.5, sky: 2 },
  { id: 'highland', name: 'Highland Park', light: 'evening', crowd: 0.7, sky: 3 },
  { id: 'arena', name: 'City Arena', light: 'evening', crowd: 0.9, sky: 4 },
  { id: 'night', name: 'Night Stadium', light: 'night', crowd: 1, sky: 5 },
];
const D = Math.PI / 180;
// [distance m, try point x m, wind m/s, wind direction deg, gust 0..0.5, timing window multiplier, mishit noise multiplier]
const L = [
  [14, 0, 0, 0, 0, 1.6, 0.7], [18, 6, 1, 90, 0, 1.5, 0.8], [20, -9, 2, -90, 0.05, 1.4, 0.85], [24, 4, 2, 60, 0.05, 1.3, 0.9],
  [22, -11, 3, 90, 0.1, 1.25, 0.95], [26, 13, 4, -70, 0.1, 1.2, 1], [28, 0, 5, 160, 0.12, 1.15, 1], [30, -7, 4, 110, 0.15, 1.1, 1],
  [30, 16, 6, -90, 0.15, 1.05, 1.05], [32, -15, 6, 80, 0.18, 1, 1.05], [34, 9, 7, 20, 0.2, 1, 1.1], [36, -3, 6, -150, 0.2, 0.95, 1.1],
  [36, 19, 7, 100, 0.2, 0.95, 1.1], [38, -17, 8, -60, 0.22, 0.9, 1.15], [40, 6, 8, 170, 0.25, 0.9, 1.15], [42, -21, 7, 120, 0.25, 0.88, 1.2],
  [42, 11, 9, -100, 0.28, 0.85, 1.2], [44, -23, 9, 70, 0.3, 0.85, 1.25], [43, 0, 9, 45, 0.3, 0.82, 1.25], [44, 23, 10, -100, 0.32, 0.8, 1.3],
  [42, -12, 11, 90, 0.35, 0.78, 1.3], [45, 14, 12, -60, 0.35, 0.76, 1.35], [45, -25, 10, 60, 0.38, 0.74, 1.4], [46, 24, 12, -45, 0.4, 0.72, 1.45],
];
export const LEVELS = L.map((r, i) => ({ n: i + 1, tier: Math.floor(i / 4), d: r[0], sx: r[1], ws: r[2], dir: r[3] * D, gust: r[4], win: r[5], noise: r[6], kicks: 3, need: 2 }));

export const RIVALS = [
  { id: 1, name: 'Rookie Boot', blurb: 'Still learning to read the wind.', wind: 0.4, time: 0.15, noise: 1.5, curl: false, stars: 1 },
  { id: 2, name: 'Steady Hand', blurb: 'Safe and tidy from close range.', wind: 0.28, time: 0.11, noise: 1.3, curl: false, stars: 2 },
  { id: 3, name: 'Wind Reader', blurb: 'Knows how every breeze bends the ball.', wind: 0.16, time: 0.08, noise: 1.1, curl: false, stars: 3 },
  { id: 4, name: 'Ice Cold', blurb: 'Hardly ever misses on the beat.', wind: 0.09, time: 0.05, noise: 1, curl: true, stars: 4 },
  { id: 5, name: 'Big Match Boot', blurb: 'Reads, aims and strikes like a pro.', wind: 0.04, time: 0.03, noise: 0.85, curl: true, stars: 5 },
];
export const KICKER_LOOKS = {
  you: { top: '#1b4fa0', bottoms: '#ffffff', socks: '#1b4fa0', shoes: '#f2f2f2', trim: '#e8c14a', skin: 'tan', hair: 'black' },
  rival: { top: '#b8302a', bottoms: '#ffffff', socks: '#b8302a', shoes: '#f2f2f2', trim: '#ffffff', skin: 'ivory', hair: 'ginger' },
};
export const SHOOTOUT_KICKS = 5;
export const DEMO_RUN_CAP = 6;
