// Lesson data: stroke types (width envelopes and the "why"), the 17 lessons (model paths in a 0..100 box), seals.
// A stroke path is a list of [x, y] points in the lesson box (0..100 on both axes); the box is placed on the 600 x 800 page.

export const PAGE = { w: 600, h: 800 };
export const CHAR_BOX = { x: 60, y: 160, w: 480, h: 480 };
export const FULL_BOX = { x: 0, y: 0, w: 600, h: 800 };

// Width envelopes: [u, ratio] pairs along the stroke (u 0..1). The ratio is the brush width relative to the stroke's own average.
export const TYPES = {
  heng: { cn: '横', name: 'Horizontal', env: [[0, 1.3], [0.12, 1.1], [0.5, 0.85], [0.85, 0.9], [0.93, 1.2], [1, 0.55]], why: 'Land the tip with a short press, glide level with even pressure, then press again and gather the tip at the end.' },
  shu: { cn: '竖', name: 'Vertical', env: [[0, 1.25], [0.15, 1.0], [0.6, 0.9], [0.9, 0.65], [1, 0.2]], why: 'Press at the top, pull straight down and lift while still moving so the tip ends thin, like a hanging needle.' },
  dian: { cn: '点', name: 'Dot', env: [[0, 0.7], [0.3, 1.3], [0.7, 1.25], [1, 0.45]], why: 'A dot is a short press with a tiny turn: land, press, and gather the tip back into the stroke.' },
  pie: { cn: '撇', name: 'Left-falling', env: [[0, 1.2], [0.3, 1.0], [0.7, 0.6], [1, 0.12]], why: 'Start pressed, then speed up as you pull down to the left and lift to a sharp tip.' },
  na: { cn: '捺', name: 'Right-falling', env: [[0, 0.5], [0.4, 0.9], [0.8, 1.45], [0.9, 1.2], [1, 0.4]], why: 'Start light, press more and more as you travel to the right, then lift out through the foot.' },
  gou: { cn: '钩', name: 'Hook', env: [[0, 1.25], [0.6, 0.95], [0.8, 0.95], [0.9, 0.7], [1, 0.15]], why: 'Pull the vertical down, pause at the bottom to turn the tip, then flick up and out in one quick lift.' },
  zhe: { cn: '折', name: 'Turning', env: [[0, 1.2], [0.4, 0.9], [0.5, 1.2], [0.6, 0.9], [1, 0.85]], why: 'Slow down at the corner and press: the brush turns by lifting a little, shifting the tip and pressing again.' },
  jie: { cn: '节', name: 'Joint', env: [[0, 1.3], [0.12, 1.0], [0.88, 1.0], [1, 1.3]], why: 'A bamboo stalk segment is pressed at both ends, so each joint looks like a small knot.' },
  ye: { cn: '叶', name: 'Leaf', env: [[0, 0.25], [0.4, 1.4], [0.75, 0.8], [1, 0.1]], why: 'Press quickly at the root, swell through the body and sweep out to a sharp tip in a single breath.' },
  lan: { cn: '兰', name: 'Long leaf', env: [[0, 0.5], [0.35, 1.25], [0.7, 1.0], [1, 0.12]], why: 'Orchid leaves are long and fast: start light, swell in the middle, and sweep out to a fine point.' },
  gan: { cn: '干', name: 'Branch', env: [[0, 1.25], [0.5, 1.0], [1, 0.8]], why: 'A branch is slow, heavy and angular. Let the brush run dry and keep a firm pace for rough, broken ink.' },
  ring: { cn: '圈', name: 'Ring', env: [[0, 0.8], [0.5, 1.0], [1, 0.8]], why: 'A blossom is drawn with a thin, steady line, a small loop with even pressure and no pause.' },
  dot: { cn: '蕊', name: 'Stamen', env: [[0, 0.8], [0.5, 1.3], [1, 0.8]], why: 'Stamen dots are small quick touches with the tip of the brush.' },
};

const S = (type, pts, o = {}) => ({ type, pts, ...o });
const C = (cx, cy, r, n = 9) => Array.from({ length: n + 1 }, (_, i) => [cx + Math.cos(-2.2 + (i / n) * Math.PI * 2) * r, cy + Math.sin(-2.2 + (i / n) * Math.PI * 2) * r]);

export const LESSONS = [
  // ---- basic strokes
  { id: 'heng', group: 'basic', title: 'Horizontal', cn: '横', box: CHAR_BOX, base: 36, strokes: [S('heng', [[10, 54], [50, 50], [90, 46]])], blurb: 'The level stroke: press, glide, gather.' },
  { id: 'shu', group: 'basic', title: 'Vertical', cn: '竖', box: CHAR_BOX, base: 36, strokes: [S('shu', [[50, 8], [50, 50], [50, 92]])], blurb: 'The plumb line: pull straight down and lift.' },
  { id: 'dian', group: 'basic', title: 'Dot', cn: '点', box: CHAR_BOX, base: 40, strokes: [S('dian', [[44, 34], [54, 44], [58, 58]])], blurb: 'A press and a turn of the tip.' },
  { id: 'pie', group: 'basic', title: 'Left-falling', cn: '撇', box: CHAR_BOX, base: 36, strokes: [S('pie', [[70, 10], [52, 45], [28, 75], [10, 92]])], blurb: 'Heavy at the start, a sharp tip at the end.' },
  { id: 'na', group: 'basic', title: 'Right-falling', cn: '捺', box: CHAR_BOX, base: 36, strokes: [S('na', [[14, 12], [44, 50], [72, 76], [92, 86]])], blurb: 'Light at the start, pressing as it travels.' },
  { id: 'gou', group: 'basic', title: 'Hook', cn: '钩', box: CHAR_BOX, base: 36, strokes: [S('gou', [[52, 8], [52, 72], [50, 86], [36, 78]])], blurb: 'A vertical that turns and flicks out.' },
  // ---- characters (stroke order is the order of the list)
  { id: 'yi', group: 'char', title: 'One', cn: '一', box: CHAR_BOX, base: 36, strokes: [S('heng', [[10, 52], [50, 49], [90, 46]])], blurb: 'One stroke, the simplest character.' },
  { id: 'san', group: 'char', title: 'Three', cn: '三', box: CHAR_BOX, base: 32, strokes: [S('heng', [[24, 24], [50, 23], [76, 22]]), S('heng', [[32, 50], [50, 50], [68, 50]]), S('heng', [[14, 78], [50, 79], [86, 80]])], blurb: 'Three levels, top to bottom; the lowest is the longest.' },
  { id: 'shi', group: 'char', title: 'Ten', cn: '十', box: CHAR_BOX, base: 34, strokes: [S('heng', [[10, 46], [50, 46], [90, 46]]), S('shu', [[50, 10], [50, 50], [50, 92]])], blurb: 'Horizontal first, then the vertical.' },
  { id: 'ren', group: 'char', title: 'Person', cn: '人', box: CHAR_BOX, base: 34, strokes: [S('pie', [[54, 14], [48, 48], [30, 72], [14, 90]]), S('na', [[46, 44], [64, 64], [80, 80], [92, 90]])], blurb: 'Left-falling, then right-falling.' },
  { id: 'da', group: 'char', title: 'Big', cn: '大', box: CHAR_BOX, base: 34, strokes: [S('heng', [[10, 38], [50, 38], [90, 38]]), S('pie', [[52, 38], [44, 60], [26, 78], [10, 92]]), S('na', [[52, 38], [62, 60], [78, 78], [92, 92]])], blurb: 'A horizontal, then two strokes that open like legs.' },
  { id: 'kou', group: 'char', title: 'Mouth', cn: '口', box: CHAR_BOX, base: 32, strokes: [S('shu', [[22, 24], [22, 52], [22, 78]]), S('zhe', [[22, 24], [50, 24], [78, 24], [78, 52], [78, 80]]), S('heng', [[22, 78], [50, 79], [78, 80]])], blurb: 'Left side, the turning stroke, then close the box.' },
  { id: 'shan', group: 'char', title: 'Mountain', cn: '山', box: CHAR_BOX, base: 32, strokes: [S('shu', [[50, 16], [50, 48], [50, 78]]), S('zhe', [[22, 40], [22, 80], [50, 80], [78, 80]]), S('shu', [[78, 40], [78, 60], [78, 80]])], blurb: 'Middle peak first, then the left side with the base, then the right.' },
  { id: 'mu', group: 'char', title: 'Tree', cn: '木', box: CHAR_BOX, base: 34, strokes: [S('heng', [[10, 38], [50, 38], [90, 38]]), S('shu', [[50, 8], [50, 50], [50, 92]]), S('pie', [[48, 46], [36, 64], [16, 84]]), S('na', [[52, 46], [66, 64], [88, 84]])], blurb: 'Horizontal, vertical, then the two roots.' },
  // ---- compositions
  { id: 'bamboo', group: 'comp', title: 'Bamboo', cn: '竹', box: FULL_BOX, base: 30, tol: 9, strokes: [
    S('jie', [[40, 94], [40.5, 85], [41, 76]], { tone: 'mid' }), S('jie', [[41, 72], [41.5, 63], [42, 54]], { tone: 'mid' }), S('jie', [[42, 50], [43, 41], [44, 32]], { tone: 'mid' }), S('jie', [[44, 28], [45, 19], [46, 10]], { tone: 'mid' }),
    S('ye', [[43, 52], [58, 56], [74, 70]], { tone: 'dark' }), S('ye', [[43, 52], [30, 58], [14, 72]], { tone: 'dark' }), S('ye', [[45, 30], [62, 34], [80, 48]], { tone: 'dark' }), S('ye', [[45, 30], [30, 36], [14, 50]], { tone: 'dark' })],
    blurb: 'Stalk joints in mid ink, then dark leaves in single sweeps.' },
  { id: 'orchid', group: 'comp', title: 'Orchid', cn: '兰', box: FULL_BOX, base: 26, tol: 9, strokes: [
    S('lan', [[46, 90], [34, 66], [22, 44], [10, 34]], { tone: 'dark' }), S('lan', [[46, 90], [58, 64], [74, 48], [92, 44]], { tone: 'dark' }), S('lan', [[46, 90], [44, 60], [48, 34], [60, 16]], { tone: 'dark' }),
    S('shu', [[52, 88], [54, 56], [56, 38]], { tone: 'mid', tol: 8 }), S('dian', [[56, 36], [50, 30], [44, 26]], { tone: 'pale', tol: 7 }), S('dian', [[56, 36], [63, 30], [70, 26]], { tone: 'pale', tol: 7 }), S('dian', [[56, 36], [56, 29], [56, 22]], { tone: 'pale', tol: 7 }), S('dot', [[55, 31], [56, 32]], { tone: 'dark', tol: 6 })],
    blurb: 'Long leaves in dark ink, a mid stem, pale petals and a dark stamen.' },
  { id: 'plum', group: 'comp', title: 'Plum Blossom', cn: '梅', box: FULL_BOX, base: 24, tol: 9, strokes: [
    S('gan', [[6, 90], [24, 70], [40, 66], [58, 50]], { tone: 'dark', dry: true }), S('gan', [[40, 66], [54, 76], [78, 70]], { tone: 'dark', dry: true }),
    S('ring', C(60, 40, 8), { tone: 'pale', closed: true, tol: 5 }), S('ring', C(26, 58, 7), { tone: 'pale', closed: true, tol: 5 }), S('ring', C(78, 62, 7), { tone: 'pale', closed: true, tol: 5 }),
    S('dot', [[59, 39], [60, 40]], { tone: 'dark', tol: 5 }), S('dot', [[25, 57], [26, 58]], { tone: 'dark', tol: 5 }), S('dot', [[77, 61], [78, 62]], { tone: 'dark', tol: 5 })],
    blurb: 'A dry angular branch, pale ring blossoms and dark stamen touches.' },
];
export const GROUPS = [['basic', 'Basic strokes'], ['char', 'Characters'], ['comp', 'Compositions']];
export const lessonById = (id) => LESSONS.find((l) => l.id === id);

// ---- seals (carved designs, drawn in art.js) -----------------------------------------------------------------------------------
export const SEALS = [
  { id: 'mountain', name: 'Mountain' }, { id: 'bamboo', name: 'Bamboo' }, { id: 'moon', name: 'Moon' },
  { id: 'plum', name: 'Plum' }, { id: 'cloud', name: 'Cloud' }, { id: 'ink', name: 'Ink' },
];

// ---- geometry helpers --------------------------------------------------------------------------------------------------------------------
export const toPage = (box, p) => [box.x + (p[0] / 100) * box.w, box.y + (p[1] / 100) * box.h];

// Catmull-Rom through the model points, returned as a dense polyline (page units).
const pathCache = new Map();
export function targetPath(lesson, idx) {
  const key = lesson.id + ':' + idx;
  let out = pathCache.get(key);
  if (out) return out;
  const st = lesson.strokes[idx], P = st.pts.map((p) => toPage(lesson.box, p));
  out = [];
  const n = P.length;
  if (n === 2 || (n === 3 && P[0][0] === P[2][0] && P[0][1] === P[2][1])) { for (let i = 0; i <= 10; i++) out.push([P[0][0] + (P[n - 1][0] - P[0][0]) * i / 10, P[0][1] + (P[n - 1][1] - P[0][1]) * i / 10]); }
  else {
    for (let i = 0; i < n - 1; i++) {
      const p0 = P[Math.max(0, i - 1)], p1 = P[i], p2 = P[i + 1], p3 = P[Math.min(n - 1, i + 2)];
      for (let k = 0; k < 10; k++) {
        const t = k / 10, t2 = t * t, t3 = t2 * t;
        out.push([0, 1].map((a) => 0.5 * ((2 * p1[a]) + (-p0[a] + p2[a]) * t + (2 * p0[a] - 5 * p1[a] + 4 * p2[a] - p3[a]) * t2 + (-p0[a] + 3 * p1[a] - 3 * p2[a] + p3[a]) * t3)));
      }
    }
    out.push(P[n - 1]);
  }
  pathCache.set(key, out);
  return out;
}
export const pathLen = (pts) => { let L = 0; for (let i = 1; i < pts.length; i++) L += Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]); return L; };

// n points evenly spaced by arc length.
export function resample(pts, n) {
  const L = pathLen(pts), out = [];
  if (L < 1e-6) { for (let i = 0; i < n; i++) out.push([pts[0][0], pts[0][1]]); return out; }
  let seg = 1, acc = 0, prev = 0;
  for (let i = 0; i < n; i++) {
    const target = (L * i) / (n - 1);
    while (seg < pts.length - 1 && acc + Math.hypot(pts[seg][0] - pts[seg - 1][0], pts[seg][1] - pts[seg - 1][1]) < target) { acc += Math.hypot(pts[seg][0] - pts[seg - 1][0], pts[seg][1] - pts[seg - 1][1]); seg++; }
    const a = pts[seg - 1], b = pts[seg], sl = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1, f = Math.max(0, Math.min(1, (target - acc) / sl));
    out.push([a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f]);
  }
  return out;
}
export function envAt(type, u) {
  const e = TYPES[type].env;
  if (u <= e[0][0]) return e[0][1];
  for (let i = 1; i < e.length; i++) if (u <= e[i][0]) { const f = (u - e[i - 1][0]) / (e[i][0] - e[i - 1][0] || 1); return e[i - 1][1] + (e[i][1] - e[i - 1][1]) * f; }
  return e[e.length - 1][1];
}
