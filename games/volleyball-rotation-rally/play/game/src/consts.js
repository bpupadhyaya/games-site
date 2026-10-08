// Court, ball, body and rule constants shared by the simulation, the AI, the HUD and the Rules page.
// World axes: x across the court (+x is the LEFT hand of a player facing +z), y up, z along the court.
// The net is at z = 0. Team 0 (the near side, camera side, always the player's team) plays on z < 0 and faces +z. Team 1 plays on z > 0.
export const G = 9.81;
export const BR_PLAY = 0.28;     // gameplay tolerance for net and block geometry and dig bands (kept from the tuned game; not drawn)
export const BR = 0.115;          // ball radius used everywhere (sim, picture, contact): a regulation ball is 0.21 m across; the mannequins are drawn 1.25x (about 2.1 m tall), so the ball is drawn 1.1x, which keeps ball : player at the real 0.11
export const HW = 4.5;              // half court width (9 m)
export const HL = 9.0;              // half court length (18 m)
export const ATK = 3.0;             // attack line: 3 m from the net
export const NET = { m: 2.43, f: 2.24 };   // net height at the centre
export const NET_BOTTOM = 1.43;     // the net is 1 m wide
export const FREE = 2.2;            // free zone around the court that stays in play for the sim (m)
export const SCALE = { m: 1.25, f: 1.19 }; // the stylised mannequin is drawn at this scale so reach matches the net

// Rules
export const MODES = {
  quick: { id: 'quick', name: 'Quick match', sets: 1, setsToWin: 1, pts: 15, last: 15, blurb: 'One set to 15' },
  best3: { id: 'best3', name: 'Best of 3', sets: 3, setsToWin: 2, pts: 25, last: 15, blurb: 'Two sets to 25, a third to 15 if needed' },
  best5: { id: 'best5', name: 'Best of 5', sets: 5, setsToWin: 3, pts: 25, last: 15, blurb: 'Sets to 25, a fifth to 15 if needed' },
};
export const MODE_IDS = ['quick', 'best3', 'best5'];
export const setTarget = (mode, setNo) => (setNo >= MODES[mode].sets && MODES[mode].sets > 1 ? MODES[mode].last : MODES[mode].pts);

// Player types. Ids 0..6 inside a team. A team fields six at a time: the libero replaces the middle blocker in the back row.
export const TYPES = [
  { id: 0, code: 'S', short: 'Setter', name: 'Setter' },
  { id: 1, code: 'OH', short: 'Outside', name: 'Outside hitter' },
  { id: 2, code: 'MB', short: 'Middle', name: 'Middle blocker' },
  { id: 3, code: 'OPP', short: 'Opposite', name: 'Opposite' },
  { id: 4, code: 'OH', short: 'Outside', name: 'Outside hitter' },
  { id: 5, code: 'MB', short: 'Middle', name: 'Middle blocker' },
  { id: 6, code: 'L', short: 'Libero', name: 'Libero' },
];
// The five roles a player can choose: id of the type they control.
export const ROLES = [
  { id: 'setter', type: 0, name: 'Setter', code: 'S', line: 'Run the offence. Set the second ball.' },
  { id: 'outside', type: 1, name: 'Outside hitter', code: 'OH', line: 'Pass, attack from the left, block.' },
  { id: 'middle', type: 2, name: 'Middle blocker', code: 'MB', line: 'Block the net, hit fast sets down the middle.' },
  { id: 'opposite', type: 3, name: 'Opposite', code: 'OPP', line: 'Attack from the right, block, serve.' },
  { id: 'libero', type: 6, name: 'Libero', code: 'L', line: 'The back-row passer. Dig and receive.' },
];
export const ROLE_IDS = ['setter', 'outside', 'middle', 'opposite', 'libero'];
export const isMB = (tp) => tp === 2 || tp === 5;
export const isOH = (tp) => tp === 1 || tp === 4;

// Court positions P1..P6 as [lat (team-left positive), depth (from the net)] for a team facing the net. Index 0 = P1 ... 5 = P6.
export const SLOT = [[-3.0, 7.0], [-3.0, 1.6], [0, 1.6], [3.0, 1.6], [3.0, 7.0], [0, 7.0]];
export const SLOT_NAME = ['P1', 'P2', 'P3', 'P4', 'P5', 'P6'];
export const FRONT = [false, true, true, true, false, false];     // by slot index

// Techniques: `fwd` is where the ball is drawn in front of the pelvis (so the arms and head are clear of it); `reach` (default fwd) is how far the sim lets a player stretch for it.
// Techniques: ball-centre height band the contact can be made in, preferred height, forward reach from the pelvis (m, horizontal,
// in the facing direction) and the wind-up / follow-through times used by the presenter. Heights are for the men's body; women scale by HSCALE_F.
export const HSCALE_F = 0.92;
export const TECH = {
  bump:   { id: 'bump',   y0: 0.62, y1: 1.30, pref: 1.00, fwd: 0.70, reach: 0.52, lead: 0.60, follow: 0.60, name: 'Forearm pass' },
  dive:   { id: 'dive',   y0: BR_PLAY + 0.12, y1: BR_PLAY + 0.40, pref: BR_PLAY + 0.22, fwd: 0.95, reach: 0.78, lead: 0.62, follow: 1.0,  name: 'Dive' },
  dig:    { id: 'dig',    y0: BR_PLAY + 0.12, y1: BR_PLAY + 0.40, pref: BR_PLAY + 0.22, fwd: 0.95, reach: 0.78, lead: 0.62, follow: 0.65, name: 'Low dig' },
  over:   { id: 'over',   y0: 2.04, y1: 2.48, pref: 2.28, fwd: 0.46, reach: 0.16, lead: 0.55, follow: 0.55, name: 'Overhand set' },
  spike:  { id: 'spike',  y0: 2.4, y1: 3.4, pref: 3.05, fwd: 0.22, lead: 0.62, follow: 0.80, name: 'Spike' },
  block:  { id: 'block',  y0: 1.90, y1: 3.40, pref: 2.80, fwd: 0.0,  lead: 0.50, follow: 0.65, name: 'Block' },
  serveF: { id: 'serveF', y0: 2.1, y1: 2.38, pref: 2.28, fwd: 0.18, lead: 0.95, follow: 0.70, name: 'Float serve' },
  serveJ: { id: 'serveJ', y0: 2.7, y1: 3.2, pref: 2.95, fwd: 0.22, lead: 1.05, follow: 0.85, name: 'Jump serve' },
};
export const HIT0 = 2.215;          // ball-centre height of a spike contact standing on the floor with the arm raised (men); add the jump height
export const BLOCK0 = 2.43;        // top of the raised hands of a standing blocker (men)
export const PELVIS_Y = 1.0;       // standing pelvis height of the drawn body (men)
export const JUMP = { m: 0.58, f: 0.5 };   // average maximum jump (m), scaled by the player's jump stat
export const REACH0 = 0.10;        // m a player covers by leaning or shuffling without running
export const DIVE = 0.60;          // extra m a low dive adds beyond the lunge
export const LUNGE = 0.30;         // extra m available at a stretch (costs quality)
export const PREP = 0.18;          // s a player needs to plant before a touch

// Attack shots. speed: ball speed m/s at the top setting; acc: accuracy; win: width of the timing window; kind: swing style.
export const SHOTS = {
  power: { id: 'power', name: 'Power spike', short: 'Power', speed: 28, acc: 0.62, win: 0.8, blurb: 'Full swing. Hardest hit, hardest to control.' },
  roll:  { id: 'roll',  name: 'Roll shot',   short: 'Roll',  speed: 15.5, acc: 0.85, win: 1.05, blurb: 'Open hand, slower, deep and accurate.' },
  tip:   { id: 'tip',   name: 'Tip',         short: 'Tip',   speed: 8.5, acc: 0.8, win: 1.2, blurb: 'Soft finger push over or around the block.' },
};
export const SHOT_IDS = ['power', 'roll', 'tip'];
export const SERVES = {
  float: { id: 'float', name: 'Float serve', short: 'Float', tech: 'serveF', speed: 15.5, acc: 0.9, margin: 0.40, blurb: 'Standing serve that wobbles. Safe and hard to pass cleanly.' },
  jump:  { id: 'jump',  name: 'Jump serve',  short: 'Jump',  tech: 'serveJ', speed: 24, acc: 0.6, margin: 0.14, blurb: 'Approach and jump. Fast, often a point, often an error.' },
};
export const SERVE_IDS = ['float', 'jump'];
// Set targets: [lat, depth from the net, apex height, flight time, attacker kind]
export const SETS = {
  outside: { id: 'outside', name: 'Outside', short: 'Outside', lat: 3.6, depth: 0.62, T: 1.10, hit: 'left', blurb: 'High ball to the left side. Time to hit, time to block.' },
  middle:  { id: 'middle',  name: 'Quick middle', short: 'Quick', lat: 0.2, depth: 0.58, T: 0.62, hit: 'middle', blurb: 'Fast low ball in the middle. Hard to block.' },
  right:   { id: 'right',   name: 'Right side', short: 'Right', lat: -3.6, depth: 0.62, T: 1.05, hit: 'right', blurb: 'High ball to the right side for the opposite.' },
  pipe:    { id: 'pipe',    name: 'Back-row pipe', short: 'Pipe', lat: 0.4, depth: 3.9, T: 1.18, hit: 'pipe', blurb: 'High ball to a back-row hitter in the centre.' },
  dump:    { id: 'dump',    name: 'Dump', short: 'Dump', lat: 0, depth: 0, T: 0, hit: 'self', blurb: 'The setter pushes the second ball over the net.' },
};
export const SET_IDS = ['outside', 'middle', 'right', 'pipe', 'dump'];

export const LEVELS = [
  { id: 1, name: 'Park Club',       skill: 0.30, iq: 0.25, stars: 1 },
  { id: 2, name: 'Town League',     skill: 0.42, iq: 0.45, stars: 2 },
  { id: 3, name: 'College Squad',   skill: 0.55, iq: 0.62, stars: 3 },
  { id: 4, name: 'National Team',   skill: 0.70, iq: 0.78, stars: 4 },
  { id: 5, name: 'World Champions', skill: 0.88, iq: 0.92, stars: 5 },
];
export const HUMAN_SKILL = 0.55;     // stat level of the player's own character and teammates (a college-level squad)
export const TEAM_NAMES = ['Blue', 'Red'];
export const TEAM_COL = ['#2b6fd6', '#d8423a'];
export const LIBERO_COL = ['#ffd24a', '#f5f5f0'];
