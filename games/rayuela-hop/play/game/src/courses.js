// The chalk courses, as data. Coordinates are metres in the courtyard: +z is "up the course" for the first stop, +x is the hopper's LEFT when
// facing +z (yaw 0). A "stop" is one landing: a single square, a double (two squares side by side) or the Sky (Cielo) rest square.
// Every numbered square belongs to exactly one stop. The geometry is pure data used by the engine, the 3D scene and the 2D fallback.
const sin = Math.sin, cos = Math.cos;

const SQ = 0.46;                 // a square is this wide and deep (m)
const HALF_GAP = 0.23;           // centre of each half of a double, from the double's middle line

function finish(c) {
  // cell lookup by number and the start/exit zone behind the first stop
  c.byNum = {};
  for (const cell of c.cells) if (cell.num) c.byNum[cell.num] = cell.id;
  c.N = c.cells.filter((x) => x.num).length;
  const s0 = c.stops[0];
  const f = [sin(s0.yaw), cos(s0.yaw)];
  c.start = { x: s0.x - f[0] * 0.85, z: s0.z - f[1] * 0.85, yaw: s0.yaw };
  c.line = { x: s0.x - f[0] * 0.5, z: s0.z - f[1] * 0.5, yaw: s0.yaw };
  let x0 = 1e9, x1 = -1e9, z0 = 1e9, z1 = -1e9;
  for (const cell of c.cells) for (const [dx, dz] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) {
    const lx = dx * cell.w / 2, lz = dz * cell.d / 2;
    const x = cell.x + lx * cos(cell.yaw) + lz * sin(cell.yaw), z = cell.z - lx * sin(cell.yaw) + lz * cos(cell.yaw);
    x0 = Math.min(x0, x); x1 = Math.max(x1, x); z0 = Math.min(z0, z); z1 = Math.max(z1, z);
  }
  x0 = Math.min(x0, c.start.x - 0.3); x1 = Math.max(x1, c.start.x + 0.3); z0 = Math.min(z0, c.start.z - 0.3); z1 = Math.max(z1, c.start.z + 0.3);
  c.bounds = { x0, x1, z0, z1 };
  return c;
}

// spec: [{ t: 's' | 'p' | 'k', x, z, yaw, w?, d? }, ...]; singles and doubles get numbers in order, the 'k' stop is the Sky square
function build(id, meta, spec) {
  const cells = [], stops = [];
  let num = 0;
  spec.forEach((sp, si) => {
    const yaw = sp.yaw, lx = cos(yaw), lz = -sin(yaw);     // the hopper's left unit vector
    const stop = { i: si, type: sp.t, x: sp.x, z: sp.z, yaw, cells: [] };
    if (sp.t === 'p') {
      for (const side of ['L', 'R']) {
        const k = side === 'L' ? 1 : -1;
        const cell = { id: cells.length, num: ++num, kind: 'half', stop: si, side, x: sp.x + lx * HALF_GAP * k, z: sp.z + lz * HALF_GAP * k, w: SQ, d: sp.d || SQ, yaw, color: sp.color || null };
        cells.push(cell); stop.cells.push(cell.id);
      }
    } else {
      const cell = { id: cells.length, num: sp.t === 'k' ? 0 : ++num, kind: sp.t === 'k' ? 'sky' : 'single', stop: si, side: null, x: sp.x, z: sp.z, w: sp.w || SQ, d: sp.d || SQ, yaw, color: sp.color || null };
      cells.push(cell); stop.cells.push(cell.id);
    }
    stops.push(stop);
  });
  return finish({ id, ...meta, stops, cells });
}

const lin = (n, step, types) => types.map((t, i) => ({ t, x: 0, z: i * step, yaw: 0, ...(t === 'k' ? { w: 1.25, d: 0.8 } : {}) })).slice(0, n);

// 1. Classic (avion): 1, 2, 3|4, 5, 6|7, 8, 9|10, Cielo
const classic = build('classic', {
  name: 'Classic', local: 'Avion', blurb: 'The straight chalk course: singles, doubles and the Sky at the end.', rule: 'free', bpm: 84, bpmTo: 108, color: '#e2503c',
}, (() => { const a = lin(8, 0.46, ['s', 's', 'p', 's', 'p', 's', 'p', 'k']); a[7].z += 0.17; return a; })());

// 2. Snail (caracol): a square spiral round a centre Sky square, hopped on ONE foot only
const SN = 0.5;
const snailGrid = [[0, 0], [1, 0], [2, 0], [2, 1], [2, 2], [1, 2], [0, 2], [0, 1], [1, 1]];
const snailSpec = snailGrid.map(([c, r], i) => {
  const nx = snailGrid[Math.min(i + 1, snailGrid.length - 1)], px = snailGrid[Math.max(0, i - 1)];
  const dx = i < snailGrid.length - 1 ? nx[0] - c : c - px[0], dz = i < snailGrid.length - 1 ? nx[1] - r : r - px[1];
  // heading: +z is yaw 0, +x is yaw -90 deg (the hopper's left is +x at yaw 0): x grows to the hopper's LEFT, so grid columns grow to the left
  const yaw = Math.atan2(dx, dz);
  return { t: i === 8 ? 'k' : 's', x: (c - 1) * SN, z: r * SN, yaw, ...(i === 8 ? { w: SN * 1.0, d: SN * 1.0 } : { w: SN * 0.94, d: SN * 0.94 }) };
});
snailSpec[0].yaw = 0;                 // the hopper enters facing up the course
const snail = build('snail', {
  name: 'Snail', local: 'Caracol', blurb: 'A spiral that winds into the middle. Hop it on one foot only.', rule: 'same', bpm: 92, bpmTo: 112, color: '#1f9d8f',
}, snailSpec);

// 3. Rainbow (arco iris): a curved band that rises and falls, with doubles in the bend. You must hop from foot to foot.
const RR = 2.0, RSTEP = 0.25, RT0 = Math.PI / 2 + 3.5 * RSTEP;
const rbTypes = ['s', 's', 'p', 's', 's', 'p', 's', 'k'];
const rbColors = ['#e2503c', '#f28a30', '#ffc94d', '#7bc96f', '#1f9d8f', '#3a7fd5', '#8c5fd0', '#ffffff'];
const rbSpec = rbTypes.map((t, i) => {
  const th = RT0 - i * RSTEP;
  const x = RR * cos(th), z = RR * sin(th) - RR * sin(RT0);
  const yaw = Math.atan2(sin(th), -cos(th));      // heading along the arc towards decreasing theta
  return { t, x, z, yaw, color: rbColors[i], ...(t === 'k' ? { w: 1.0, d: 0.8 } : {}) };
});
const rainbow = build('rainbow', {
  name: 'Rainbow', local: 'Arco iris', blurb: 'A coloured arch with doubles in the bend. Hop from foot to foot.', rule: 'alternate', bpm: 100, bpmTo: 120, color: '#8c5fd0',
}, rbSpec);

// ---- little courses for the Learn lessons (hidden from the course list) --------------------------------------------------------------------
const learnA = build('learn-singles', { name: 'Practice strip', local: '', blurb: '', rule: 'free', bpm: 76, bpmTo: 76, lesson: true, color: '#e2503c' }, lin(4, 0.46, ['s', 's', 's', 'k']));
const learnB = build('learn-doubles', { name: 'Practice strip', local: '', blurb: '', rule: 'free', bpm: 76, bpmTo: 76, lesson: true, color: '#e2503c' }, lin(5, 0.46, ['s', 'p', 's', 'p', 'k']));
const learnC = build('learn-marker', { name: 'Practice strip', local: '', blurb: '', rule: 'free', bpm: 76, bpmTo: 76, lesson: true, color: '#e2503c' }, lin(4, 0.46, ['s', 'p', 's', 'k']));

export const COURSES = { classic, snail, rainbow, 'learn-singles': learnA, 'learn-doubles': learnB, 'learn-marker': learnC };
export const COURSE_LIST = ['classic', 'snail', 'rainbow'];
export const getCourse = (id) => COURSES[id] || classic;

export const RULE_TEXT = {
  free: 'Hop on either foot. Change feet whenever you like.',
  same: 'Hop on the SAME foot all the way: change feet only at the Sky square.',
  alternate: 'Hop from foot to foot: left, right, left... The Sky square and doubles reset it.',
};
