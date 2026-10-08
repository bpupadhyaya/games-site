// Badminton Rally: constants shared by the engine, the AI, the HUD and the rules text (so the Rules page can never disagree with the code).
// Court coordinates in metres: x across the court (screen right in the portrait view), z along it. The net is at z = 0.
// The human's end is z > 0 (the near end), the computer's end is z < 0. A "side" is +1 (human end) or -1 (computer end).
export const HL = 6.7;            // half length: baseline at z = +-6.7 (13.4 m court)
export const HW = 2.59;           // half width for singles (5.18 m)
export const HWD = 3.05;          // half width for doubles (drawn, not in play)
export const SHORT = 1.98;        // short service line, distance from the net
export const NET_H = 1.53;        // net height used for clearance (1.524 m at the centre, 1.55 m at the posts)
export const NET_POST = 1.55;
export const GRAV = 9.81;
export const DRAG = 0.215;        // quadratic drag per metre: terminal speed sqrt(g / k) = 6.8 m/s, like a real feather shuttle
export const DT = 1 / 60;
export const REACH_MAX_Y = 2.75;  // highest standing contact (a jump smash adds about 0.35 m)
export const REACH_MIN_Y = 0.12;
export const HOME_Z = 3.7;        // where a player waits between strokes
export const SERVE_Z = 2.45;      // where the server stands (behind the short service line)

export const TEXT_STEPS = 5;

export const SHOTS = {
  // key: label, short text for the guide
  serveShort: { name: 'Short serve', verb: 'short serve' },
  serveLong: { name: 'High serve', verb: 'high serve' },
  clear: { name: 'Clear', verb: 'clear' },
  drop: { name: 'Drop', verb: 'drop shot' },
  smash: { name: 'Smash', verb: 'smash' },
  drive: { name: 'Drive', verb: 'flat drive' },
  push: { name: 'Push', verb: 'push' },
  lift: { name: 'Lift', verb: 'lift' },
  net: { name: 'Net shot', verb: 'net shot' },
  block: { name: 'Block', verb: 'block' },
  safe: { name: 'Safe return', verb: 'safe return' },
};

// Computer levels. speed = top running speed (m/s), react = seconds before it starts to move to the shuttle,
// aim = aiming error scale (1 = the human at a perfect swipe), err = chance of an unforced slip, temp = how random its shot choice is,
// smash = top smash speed (m/s), reachR = how far from its body it can meet the shuttle (m), judge = how well it reads where a shuttle will land.
export const LEVELS = [
  null,
  { id: 1, name: 'Club Rookie', stars: 1, speed: 4.1, react: 0.34, aim: 2.1, err: 0.075, temp: 1.1, smash: 46, reachR: 0.92, judge: 0.55, accel: 14 },
  { id: 2, name: 'Regional', stars: 2, speed: 4.7, react: 0.26, aim: 1.6, err: 0.045, temp: 0.8, smash: 54, reachR: 1.0, judge: 0.7, accel: 16 },
  { id: 3, name: 'National', stars: 3, speed: 5.3, react: 0.19, aim: 1.2, err: 0.022, temp: 0.55, smash: 62, reachR: 1.06, judge: 0.85, accel: 18 },
  { id: 4, name: 'Pro', stars: 4, speed: 5.9, react: 0.14, aim: 0.95, err: 0.01, temp: 0.4, smash: 70, reachR: 1.12, judge: 0.95, accel: 20 },
  { id: 5, name: 'World Class', stars: 5, speed: 6.4, react: 0.1, aim: 0.8, err: 0.004, temp: 0.28, smash: 78, reachR: 1.18, judge: 1.0, accel: 22 },
];

// Tournament rivals: a fictional field from across Asia and beyond. Style weights bias the shot choice.
export const STYLES = {
  attacker: { name: 'Attacker', blurb: 'Smashes at every chance and forces you to defend.', w: { smash: 1.5, drive: 0.5, clear: 0.9, drop: 0.8, net: 0.6, lift: 0.8, block: 0.8, push: 0.8 } },
  defender: { name: 'Defender', blurb: 'Returns everything, clears high and waits for your mistake.', w: { smash: 0.5, drive: 0.6, clear: 1.5, drop: 0.9, net: 0.8, lift: 1.4, block: 1.3, push: 0.9 } },
  net: { name: 'Net player', blurb: 'Lives at the net with tight drops and tumbling net shots.', w: { smash: 0.8, drive: 0.8, clear: 0.7, drop: 1.6, net: 1.7, lift: 1.0, block: 1.0, push: 1.2 } },
  counter: { name: 'Counter puncher', blurb: 'Blocks and drives your attack straight back at you.', w: { smash: 0.9, drive: 1.5, clear: 0.8, drop: 0.8, net: 0.9, lift: 0.9, block: 1.5, push: 1.4 } },
  allround: { name: 'All-rounder', blurb: 'Mixes every stroke and has no weak side.', w: { smash: 1.0, drive: 1.0, clear: 1.0, drop: 1.0, net: 1.0, lift: 1.0, block: 1.0, push: 1.0 } },
};

export const RIVALS = [
  { id: 'aarav', name: 'Aarav Nair', country: 'India', female: false, style: 'allround', level: 2, skin: 'brown', hair: 'black', kit: { top: '#e8892f', bottoms: '#2a2a33', socks: '#f3f3f3', shoes: '#f3f3f3' } },
  { id: 'putri', name: 'Putri Wulandari', country: 'Indonesia', female: true, style: 'attacker', level: 2, skin: 'tan', hair: 'black', kit: { top: '#d6402f', bottoms: '#ffffff', socks: '#f3f3f3', shoes: '#f3f3f3' } },
  { id: 'wei', name: 'Lim Wei Jie', country: 'Malaysia', female: false, style: 'net', level: 3, skin: 'tan', hair: 'black', kit: { top: '#2467c9', bottoms: '#173c78', socks: '#f3f3f3', shoes: '#f3f3f3' } },
  { id: 'mei', name: 'Chen Mei', country: 'China', female: true, style: 'defender', level: 3, skin: 'light', hair: 'black', kit: { top: '#c2252b', bottoms: '#f2c94c', socks: '#f3f3f3', shoes: '#f3f3f3' } },
  { id: 'haru', name: 'Haruto Sato', country: 'Japan', female: false, style: 'counter', level: 4, skin: 'light', hair: 'black', kit: { top: '#f4f1ea', bottoms: '#13283a', socks: '#f3f3f3', shoes: '#f3f3f3' } },
  { id: 'nat', name: 'Nattaya Boon', country: 'Thailand', female: true, style: 'allround', level: 4, skin: 'tan', hair: 'brown', kit: { top: '#7a45c2', bottoms: '#47257a', socks: '#f3f3f3', shoes: '#f3f3f3' } },
  { id: 'soren', name: 'Soren Madsen', country: 'Denmark', female: false, style: 'attacker', level: 5, skin: 'light', hair: 'blond', kit: { top: '#b0182c', bottoms: '#f3f3f3', socks: '#f3f3f3', shoes: '#f3f3f3' } },
  { id: 'minjun', name: 'Park Min-jun', country: 'South Korea', female: false, style: 'allround', level: 5, skin: 'light', hair: 'black', kit: { top: '#0f2f6b', bottoms: '#f3f3f3', socks: '#f3f3f3', shoes: '#f3f3f3' } },
];
export const ROUND_NAMES = ['Quarter-final', 'Semi-final', 'Final'];
export const TOURNEY_TARGET = 15, TOURNEY_CAP = 21;

export const LENGTHS = {
  to11: { id: 'to11', name: 'One game to 11', games: 1, target: 11, cap: 15 },
  to21: { id: 'to21', name: 'One game to 21', games: 1, target: 21, cap: 30 },
  bo3: { id: 'bo3', name: 'Best of 3 to 21', games: 3, target: 21, cap: 30 },
};

export const KITS = [
  { name: 'Blue', top: '#2467c9', bottoms: '#173c78', socks: '#f3f3f3', shoes: '#f3f3f3', col: '#2f7be0' },
  { name: 'Green', top: '#1f9d6a', bottoms: '#12583c', socks: '#f3f3f3', shoes: '#f3f3f3', col: '#27b37a' },
  { name: 'Violet', top: '#7a45c2', bottoms: '#47257a', socks: '#f3f3f3', shoes: '#f3f3f3', col: '#8a55d4' },
  { name: 'Orange', top: '#e8892f', bottoms: '#8a4a12', socks: '#f3f3f3', shoes: '#f3f3f3', col: '#ee9a3c' },
];
