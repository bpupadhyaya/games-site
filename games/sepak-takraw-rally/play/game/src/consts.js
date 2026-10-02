// Court, ball and technique constants shared by the simulation, the AI and the HUD.
// World axes: x across the court (+x is the LEFT hand of a player facing +z), y up, z along the court.
// The net is at z = 0. Team 0 (the near side, camera side) plays on z < 0 and faces +z. Team 1 plays on z > 0.
export const G = 9.81;
export const BR = 0.067;            // ball radius (circumference 0.42 m)
export const HW = 3.05;             // half court width (6.1 m)
export const HL = 6.7;              // half court length (13.4 m)
export const NET = { m: 1.52, f: 1.42 };      // net height at the centre
export const NET_BOTTOM = 0.82;     // the net is 0.7 m wide
export const SERVE_CIRCLE = { lat: 0, depth: 4.25, r: 0.3 };
export const QUARTER = { lat: 3.05, depth: 0, r: 0.9 };

export const SET_POINTS = { full: 21, quick: 11 };
export const SET_CAP = { full: 25, quick: 13 };

// Attack types. contactY: preferred ball height. up: seconds from take-off to contact. down: contact to landing.
export const ATTACKS = {
  roll:   { id: 'roll',   name: 'Roll spike',     short: 'Roll',    speed: 12.5, acc: 0.85, win: 1.0,  y: 1.95, up: 0.40, down: 0.46, jump: 0.78, tip: 0.0, blurb: 'Body rolls over the ball. Reliable and accurate.' },
  back:   { id: 'back',   name: 'Sunback spike',  short: 'Sunback', speed: 15.0, acc: 0.62, win: 0.8,  y: 2.05, up: 0.42, down: 0.50, jump: 0.85, tip: 0.0, blurb: 'Back to the net, kick over the shoulder. Hard, but needs timing.' },
  scissor:{ id: 'scissor',name: 'Scissor spike',  short: 'Scissor', speed: 17.0, acc: 0.50, win: 0.65, y: 2.20, up: 0.46, down: 0.55, jump: 0.92, tip: 0.0, blurb: 'Airborne scissor kick. The hardest hit and the hardest to time.' },
  header: { id: 'header', name: 'Header',         short: 'Header',  speed: 9.5, acc: 0.95, win: 1.15, y: 2.10, up: 0.34, down: 0.40, jump: 0.62, tip: 0.5, blurb: 'A soft placed head shot. Safe and precise, easier to dig.' },
  foot:   { id: 'foot',   name: 'Foot spike',     short: 'Foot',    speed: 13.5, acc: 0.72, win: 0.95, y: 1.85, up: 0.32, down: 0.40, jump: 0.60, tip: 0.0, blurb: 'A quick instep hit from lower contact. Best on a quick set.' },
};
export const ATTACK_IDS = ['roll', 'back', 'scissor', 'header', 'foot'];

// Serve types: flight time, accuracy factor, net margin
export const SERVES = {
  safe:  { id: 'safe',  name: 'Lob serve',   short: 'Lob',   T: 1.35, acc: 0.95, margin: 0.55, blurb: 'High and safe. Easy to receive.' },
  drive: { id: 'drive', name: 'Drive serve', short: 'Drive', T: 0.92, acc: 0.78, margin: 0.28, blurb: 'Flat and quick.' },
  power: { id: 'power', name: 'Power serve', short: 'Power', T: 0.68, acc: 0.55, margin: 0.14, blurb: 'Fastest serve. Often misses.' },
};
export const SERVE_IDS = ['safe', 'drive', 'power'];

export const SET_PACE = { high: { T: 1.05, y: 2.15 }, quick: { T: 0.70, y: 1.92 } };
export const ZONES = [1, 0, -1];            // team-left, centre, team-right
export const ZONE_LAT = 2.0;
export const ZONE_DEPTH = 0.95;             // contact depth (distance from the net) for attacks

export const BLOCKS = { single: 'Single block', double: 'Double block', drop: 'No block (drop back)' };
export const BLOCK_IDS = ['single', 'double', 'drop'];

// Receive / set techniques by ball height (metres).
export const TECH_BANDS = [
  { id: 'foot',   lo: 0.12, hi: 0.46 },     // inside / instep of the foot, low
  { id: 'footHi', lo: 0.46, hi: 1.08 },     // raised-foot inside volley (the classic set)
  { id: 'chest',  lo: 1.08, hi: 1.48 },     // chest cushion
  { id: 'head',   lo: 1.48, hi: 1.95 },     // header
];
// nominal forward reach (pelvis to contact point, metres) per technique, measured from the clips (dev/measure.mjs)
export const TECH_FWD = { foot: 0.42, knee: 0.33, footHi: 0.42, chest: 0.30, head: 0.16, serve: 0.50 };

export const LEVELS = [
  { id: 1, name: 'Village Green',   skill: 0.30, iq: 0.30, stars: 1 },
  { id: 2, name: 'Harbour Club',    skill: 0.43, iq: 0.50, stars: 2 },
  { id: 3, name: 'Rattan Rovers',   skill: 0.56, iq: 0.65, stars: 3 },
  { id: 4, name: 'Monsoon United',  skill: 0.70, iq: 0.80, stars: 4 },
  { id: 5, name: 'Sunrise Elite',   skill: 0.95, iq: 0.85, stars: 5 },
];
export const HUMAN_SKILL = 0.62;

// Vertical reach from the pelvis to the contact point for each attack (metres), measured from the clips.
export const REACH_UP = { roll: 0.70, back: 0.65, scissor: 0.75, header: 0.80, foot: 0.60 };
export const ATTACK_FWD = 0.25;      // contact point is this far ahead of the pelvis (towards the net)
export const PELVIS_Y = 0.89;   // standing pelvis height of the athlete rig
export const NET_TOUCH_DEPTH = 0.30;   // pelvis closer than this to the net is a net touch
