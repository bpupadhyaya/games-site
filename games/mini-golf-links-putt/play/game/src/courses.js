// The three courses and their eighteen holes. All names are generic. Coordinates are course units in the hole's own
// portrait frame (y runs down the screen: tee near the bottom, cup near the top); the view may turn a hole sideways to
// fill a landscape screen. See sim.js for what each feature does.
const rect = (x, y, w, h) => [[x, y], [x + w, y], [x + w, y + h], [x, y + h]];
const R = (x, y, w, h) => ({ shape: 'rect', x, y, w, h });
const C = (x, y, r) => ({ shape: 'circle', x, y, r });
const ang = (a, b) => Math.atan2(b.y - a.y, b.x - a.x);

// An outline around a centre line of width w (mitre joins), for winding holes.
export function corridor(pts, w) {
  const n = pts.length, hw = w / 2, L = [], Rr = [];
  const norm = (a, b) => { const dx = b[0] - a[0], dy = b[1] - a[1], l = Math.hypot(dx, dy) || 1; return [-dy / l, dx / l]; };
  for (let i = 0; i < n; i++) {
    let nx, ny, m = 1;
    if (i === 0) [nx, ny] = norm(pts[0], pts[1]);
    else if (i === n - 1) [nx, ny] = norm(pts[n - 2], pts[n - 1]);
    else {
      const a = norm(pts[i - 1], pts[i]), b = norm(pts[i], pts[i + 1]);
      nx = a[0] + b[0]; ny = a[1] + b[1]; const l = Math.hypot(nx, ny) || 1; nx /= l; ny /= l;
      m = 1 / Math.max(0.3, nx * a[0] + ny * a[1]);
    }
    L.push([pts[i][0] + nx * hw * m, pts[i][1] + ny * hw * m]);
    Rr.push([pts[i][0] - nx * hw * m, pts[i][1] - ny * hw * m]);
  }
  return [...L, ...Rr.reverse()];
}
const octagon = (cx, cy, r) => Array.from({ length: 12 }, (_, i) => [cx + Math.cos((i / 12) * Math.PI * 2) * r, cy + Math.sin((i / 12) * Math.PI * 2) * r]);

export const COURSES = [
  { id: 'heather', name: 'Heather Dunes', blurb: 'Gentle dunes, hedges and sand. A friendly start.', feel: 'heather' },
  { id: 'harbour', name: 'Harbour Rocks', blurb: 'Stone quays, tide pools, bumpers and tunnels.', feel: 'harbour' },
  { id: 'mill', name: 'Windmill Green', blurb: 'Windmills and sliding gates: time your putt.', feel: 'mill' },
];

const H = [];
const add = (course, def) => H.push({ course, railMat: def.railMat ?? (course === 'harbour' ? 'stone' : 'timber'), ...def });

// ---- Heather Dunes ------------------------------------------------------------------------------------------------------
add('heather', {
  id: 'dunes-1', name: 'First Tee', par: 2, tip: 'Straight and simple. Mind the bunker on the left.',
  outer: rect(0, 0, 8, 20), tee: { x: 4, y: 17 }, cup: { x: 4, y: 3.2 },
  sand: [C(1.4, 6.2, 1.7)],
});
const d2 = corridor([[3.5, 21], [3.5, 3.6], [20.8, 3.6]], 7);
add('heather', {
  id: 'dunes-2', name: 'The Dogleg', par: 3, tip: 'Round the corner: bank off the end wall if you dare.',
  outer: d2, tee: { x: 3.5, y: 18.6 }, cup: { x: 18.2, y: 3.6 },
  sand: [C(1.4, 1.6, 1.5)],
});
add('heather', {
  id: 'dunes-3', name: 'Twin Bunkers', par: 2, tip: 'The slope in the lane drifts you to the right.',
  outer: rect(0, 0, 9, 22), tee: { x: 4.5, y: 19.5 }, cup: { x: 4.5, y: 3 },
  sand: [R(0, 7, 3, 8.5), R(6, 7, 3, 8.5)], slopes: [{ ...R(3, 7, 3, 8.5), ax: 1.3, ay: 0 }],
});
add('heather', {
  id: 'dunes-4', name: 'Hedge Maze', par: 3, tip: 'Two hedges, two gaps. Lines the hedge corners.',
  outer: rect(0, 0, 14, 20), tee: { x: 3, y: 17 }, cup: { x: 11, y: 3 },
  walls: [{ pts: [[0, 13], [8.2, 13]], mat: 'hedge' }, { pts: [[14, 7.2], [5.8, 7.2]], mat: 'hedge' }],
});
add('heather', {
  id: 'dunes-5', name: 'Rolling Dune', par: 3, tip: 'The hill pushes the ball away from its top; the bowl by the cup helps.',
  outer: rect(0, 0, 11, 22), tee: { x: 5.5, y: 19.5 }, cup: { x: 5.5, y: 3.6 },
  slopes: [{ ...C(5.5, 11.8, 4.4), mode: 'out', k: 3.6 }, { ...C(5.5, 3.6, 3), mode: 'in', k: 1.5 }],
});
add('heather', {
  id: 'dunes-6', name: 'The Pond', par: 3, tip: 'Cross the pond on the bridge. Water costs a stroke.',
  outer: rect(0, 0, 17, 18), tee: { x: 2.6, y: 15.2 }, cup: { x: 14.4, y: 2.8 },
  water: [R(5.8, 0, 5.4, 18)], bridges: [R(5.8, 6.6, 5.4, 4.8)],
});

// ---- Harbour Rocks ------------------------------------------------------------------------------------------------------
add('harbour', {
  id: 'harbour-1', name: 'The Quay', par: 2, tip: 'The boost pad is fast. Thread the bumpers or go round them.',
  outer: rect(0, 0, 9.5, 24), tee: { x: 4.75, y: 21.5 }, cup: { x: 4.75, y: 3 },
  boosts: [{ ...R(3.2, 15, 3.1, 3), dx: 0, dy: -1, acc: 20 }], bumpers: [{ x: 3.1, y: 10.2, r: 0.95 }, { x: 6.4, y: 10.2, r: 0.95 }],
});
add('harbour', {
  id: 'harbour-2', name: 'Stepping Stones', par: 5, tip: 'Hop from stone to stone. The rails keep the ball in play.',
  outer: rect(0, 0, 19, 19), tee: { x: 3, y: 15.2 }, cup: { x: 3.2, y: 4 },
  water: [R(0, 0, 19, 19)],
  bridges: [R(0, 12, 6.2, 7), R(6.2, 13.4, 5.2, 3.4), R(9.6, 7.6, 6.4, 9.2), R(4.4, 7.6, 6.6, 3.6), R(0, 1.6, 7, 9)],
});
add('harbour', {
  id: 'harbour-3', name: 'Lighthouse Loop', par: 3, tip: 'Go round either side of the lighthouse rock.',
  outer: rect(0, 0, 20, 20), tee: { x: 10, y: 17.6 }, cup: { x: 10, y: 2.6 },
  islands: [{ pts: octagon(10, 10, 4.4), mat: 'stone' }], sand: [C(2.6, 10, 2), C(17.4, 10, 2)],
});
add('harbour', {
  id: 'harbour-4', name: 'Tide Pool', par: 3, tip: 'Pinball: the round bumpers kick the ball back.',
  outer: rect(0, 0, 14, 22), tee: { x: 7, y: 19.4 }, cup: { x: 7, y: 3.4 },
  bumpers: [{ x: 4, y: 12.4, r: 1.1 }, { x: 10, y: 12.4, r: 1.1 }, { x: 7, y: 8.4, r: 1.1 }, { x: 7, y: 15.6, r: 0.9 }],
  water: [C(1.6, 4.2, 2.1), C(12.4, 4.2, 2.1)], sand: [R(0, 17, 3, 5), R(11, 17, 3, 5)],
});
add('harbour', {
  id: 'harbour-5', name: 'Tunnel Run', par: 3, tip: 'The wall is solid. Use the tunnel pipes.',
  outer: rect(0, 0, 16, 22), tee: { x: 8, y: 19.4 }, cup: { x: 8, y: 3 },
  walls: [{ pts: [[0, 11], [16, 11]] }],
  tunnels: [{ r: 0.85, a: { x: 3, y: 14.5, dir: Math.PI * 0.5 }, b: { x: 12.8, y: 7.5, dir: ang({ x: 12.8, y: 7.5 }, { x: 8, y: 3 }) } }],
});
const b6 = corridor([[3.5, 27], [3.5, 17], [15.5, 17], [15.5, 1.0]], 6.4);
add('harbour', {
  id: 'harbour-6', name: 'The Breakwater', par: 4, tip: 'Long and winding. The slope in the middle pulls you up.',
  outer: b6, tee: { x: 3.5, y: 24.6 }, cup: { x: 15.5, y: 3.4 },
  slopes: [{ ...R(5, 14, 10.4, 6.2), ax: 0, ay: -1.5 }], sand: [C(1.2, 14.5, 1.6)],
  water: [C(18, 17, 1.4)],
});

// ---- Windmill Green -----------------------------------------------------------------------------------------------------
add('mill', {
  id: 'mill-1', name: 'Mill Lane', par: 2, tip: 'Wait for the blades, then putt.', cycle: 4,
  outer: rect(0, 0, 8, 22), tee: { x: 4, y: 19.5 }, cup: { x: 4, y: 3.2 },
  mills: [{ x: 4, y: 11, len: 3.15, n: 4, per: 4, ph: 0, thick: 0.13, hub: 0.45 }],
});
add('mill', {
  id: 'mill-2', name: 'Twin Mills', par: 3, tip: 'Two mills turn in opposite directions.', cycle: 6,
  outer: rect(0, 0, 11, 26), tee: { x: 5.5, y: 23.4 }, cup: { x: 5.5, y: 3 },
  mills: [{ x: 3.4, y: 16.5, len: 2.9, n: 3, per: 6, ph: 0.1, thick: 0.13, hub: 0.45, dir: 1 }, { x: 7.6, y: 9, len: 2.9, n: 3, per: 6, ph: 0.4, thick: 0.13, hub: 0.45, dir: -1 }],
});
add('mill', {
  id: 'mill-3', name: 'Sluice Gate', par: 3, tip: 'Two sliding gates guard the openings.', cycle: 4,
  outer: rect(0, 0, 12, 24), tee: { x: 6, y: 21.4 }, cup: { x: 6, y: 3 },
  walls: [{ pts: [[0, 15], [4.4, 15]] }, { pts: [[7.6, 15], [12, 15]] }, { pts: [[0, 8], [4.4, 8]] }, { pts: [[7.6, 8], [12, 8]] }],
  gates: [{ ax: 3.2, ay: 15, bx: 6.8, by: 15, dx: 2.6, dy: 0, per: 4, ph: 0, thick: 0.2 }, { ax: 5.2, ay: 8, bx: 8.8, by: 8, dx: -2.6, dy: 0, per: 4, ph: 0.25, thick: 0.2 }],
});
add('mill', {
  id: 'mill-4', name: 'Conveyor Hill', par: 3, tip: 'The belt drags you sideways. Cross it quickly.',
  outer: rect(0, 0, 11, 24), tee: { x: 2.8, y: 21.4 }, cup: { x: 2.8, y: 3.2 },
  slopes: [{ ...R(0, 8.5, 11, 7), ax: 3.4, ay: 0 }], water: [R(8.2, 8.5, 2.8, 7)],
  boosts: [{ ...R(1.4, 17, 2.8, 2.6), dx: 0, dy: -1, acc: 16 }], sand: [R(5, 18, 6, 6)],
});
const m5 = corridor([[3.2, 28], [3.2, 21], [15.5, 21], [15.5, 11], [3.2, 11], [3.2, 1.2]], 5.6);
add('mill', {
  id: 'mill-5', name: 'Switchback', par: 4, tip: 'Three turns and a mill at the middle.', cycle: 5,
  outer: m5, tee: { x: 3.2, y: 25.6 }, cup: { x: 3.2, y: 3.6 },
  mills: [{ x: 15.5, y: 16, len: 2.6, n: 2, per: 5, ph: 0, thick: 0.13, hub: 0.45 }],
});
add('mill', {
  id: 'mill-6', name: 'Grand Finale', par: 4, tip: 'Bridge, bumpers and a mill: the lot.', cycle: 5,
  outer: rect(0, 0, 22, 30), tee: { x: 4, y: 27.2 }, cup: { x: 18, y: 3.6 },
  water: [R(0, 15, 22, 4.2)], bridges: [R(8, 15, 5.2, 4.2)],
  bumpers: [{ x: 5, y: 9, r: 1 }, { x: 9.6, y: 5.6, r: 1 }], sand: [R(0, 21, 5, 4), R(17, 21, 5, 4)],
  mills: [{ x: 15, y: 8.4, len: 3.2, n: 3, per: 5, ph: 0, thick: 0.13, hub: 0.45 }],
});

export const HOLES = H;
export const holeById = (id) => H.find((h) => h.id === id);
export const courseHoles = (cid) => H.filter((h) => h.course === cid);
export const COURSE_BY_ID = Object.fromEntries(COURSES.map((c) => [c.id, c]));
