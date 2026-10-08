// Shared constants, grounds, levels, strikers and tiny math helpers. Pure: no DOM, no clock, no randomness.
export const W = 720;
export const H = 1280;
export const G = 9.81;
export const DT = 1 / 60;
export const DEG = Math.PI / 180;

export const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
export const lerp = (a, b, t) => a + (b - a) * t;
export const smooth = (t) => { t = clamp(t, 0, 1); return t * t * (3 - 2 * t); };
export const round1 = (v) => Math.round(v * 10) / 10;

// ---- frame (metres) ---------------------------------------------------------------------------------------------------------
// Sim frame: the ground hole (guli) is the origin, +z runs down the lane/field in the direction of play, +x is to the striker's right, y is up.
// The striker stands just behind the hole at STRIKER_Z and faces +z. The gilli lies across the hole along the x axis.
export const DANDA = 0.75;             // the stick: also the unit that scores a hit (danda lengths)
export const GILLI_LEN = 0.13;
export const STRIKER_Z = -0.62;
export const STRIKER_X = 0.0;
export const AIM_MAX = 46;             // degrees either side of straight
export const SW = 0.12;                // seconds from the press to the danda meeting the gilli
export const HS = 0.86;                // the height the danda strikes at (sweet spot of the swing)
export const GILLI_Y0 = 0.05;
export const FIELD_HALF = 30;          // fielders stay inside +- this many metres sideways
export const VMAX = 22;                // m/s off a perfect strike
export const DRAG = 0.0085;            // quadratic air drag per metre

export const FIELDS = {
  lane: { key: 'lane', name: 'Mango Lane', short: 'Mango Lane', light: 'evening', sky: ['#3a5f9a', '#f0a070', '#ffd98a'], blurb: 'A village lane at golden hour: whitewashed walls, tile roofs, a banyan tree and a bullock cart.' },
  harvest: { key: 'harvest', name: 'Harvest Field', short: 'Harvest Field', light: 'day', sky: ['#3c86cf', '#9ccbee', '#e9f2f6'], blurb: 'An open stubble field after the harvest, haystacks and a bright noon sky.' },
  lamp: { key: 'lamp', name: 'Lamp Night', short: 'Lamp Night', light: 'night', sky: ['#070b1e', '#1c2858', '#4a3568'], blurb: 'The lane after dark under strings of paper lanterns and bunting.' },
};
export const FIELD_KEYS = Object.keys(FIELDS);

// Levels change the fielders, not the physics. speed in m/s, react in seconds, skill 0..1 (catching and judging the landing), tapP = pendulum period.
export const LEVELS = [
  { name: 'Gully', blurb: 'Three young fielders who are slow to react. Plenty of gaps.', fielders: 3, speed: 4.3, react: 0.62, skill: 0.5, tapP: 1.18, tapZ: 1.28, swZ: 1.3, reach: 0.8 },
  { name: 'Mohalla', blurb: 'Four fielders who read the ball well. Aim for the gaps and keep it low.', fielders: 4, speed: 5.0, react: 0.45, skill: 0.66, tapP: 1.0, tapZ: 1.0, swZ: 1.0, reach: 0.9 },
  { name: 'Maidan', blurb: 'Five quick fielders who move after your last hit. Every chance counts.', fielders: 5, speed: 5.7, react: 0.32, skill: 0.82, tapP: 0.86, tapZ: 0.82, swZ: 0.82, reach: 1.0 },
];

export const ASSISTS = [1.25, 1, 0.82];       // relaxed / standard / sharp scale on both timing windows

export const FIRST = ['Arjun', 'Meera', 'Kabir', 'Chhaya', 'Ravi', 'Anika', 'Imran', 'Sunita', 'Dev', 'Farida', 'Gopal', 'Leela', 'Zoya', 'Bhanu', 'Tara', 'Naveen', 'Ishaan', 'Noor', 'Mohan', 'Pari', 'Vikram', 'Sana', 'Rohan', 'Kavya'];
export const SKINS = ['tan', 'brown', 'deep', 'tan', 'brown', 'light'];
export const HAIRS = ['black', 'black', 'brown', 'black'];
export const TEAMS = [
  { key: 'home', name: 'Mango Lane XI', top: '#f2b02e', trim: '#8a4b12', cap: '#f4efe2', pants: '#e9e2d0' },
  { key: 'river', name: 'Riverbank Rascals', top: '#2f78c8', trim: '#10305c', cap: '#e9eef6', pants: '#d9d4c4' },
  { key: 'hay', name: 'Haystack Hawks', top: '#4aa264', trim: '#14502a', cap: '#f0e9d2', pants: '#e2dccb' },
  { key: 'lamp', name: 'Lamp Lane Lions', top: '#d4503f', trim: '#6a1c14', cap: '#efe6d0', pants: '#dcd5c2' },
];

// Fielder look (the fielding side wears their own village colour).
export const FIELDER_PANTS = ['#e6dfcc', '#cfd8e0', '#d8cfb8', '#c9c2ae', '#e2d8c2'];
