// The eight animals as carved side-profile figures. Each is a closed outline in a 100-unit box (x right, y up, facing right, ground at y = 0)
// plus a painter that colours the SAME box (coat, stripes, spots, mane, eye), so one shape drives both the extruded 3D figure and the flat chips.
// `W` is the figure's width in board cells (a rat is small, an elephant fills its square). Pure data + canvas painting: no three.js here.
export const W = [0, 0.64, 0.68, 0.78, 0.86, 0.9, 0.96, 0.98, 1.04];
export const BOX = { w: 100, h: 84 };

// pt = [x, y] smooth, [x, y, 1] corner. Hermite through the points; corners keep the chord direction so legs and ear tips stay crisp.
export function outline(pts, sub = 7) {
  const n = pts.length, out = [];
  const tan = (i, dir) => {
    const p = pts[i], a = pts[(i - 1 + n) % n], b = pts[(i + 1) % n];
    if (p[2]) return dir > 0 ? [b[0] - p[0], b[1] - p[1]] : [p[0] - a[0], p[1] - a[1]];
    return [(b[0] - a[0]) / 2, (b[1] - a[1]) / 2];
  };
  for (let i = 0; i < n; i++) {
    const p0 = pts[i], p1 = pts[(i + 1) % n], m0 = tan(i, 1), m1 = tan((i + 1) % n, -1);
    for (let s = 0; s < sub; s++) {
      const t = s / sub, t2 = t * t, t3 = t2 * t, h00 = 2 * t3 - 3 * t2 + 1, h10 = t3 - 2 * t2 + t, h01 = -2 * t3 + 3 * t2, h11 = t3 - t2;
      out.push([h00 * p0[0] + h10 * m0[0] + h01 * p1[0] + h11 * m1[0], h00 * p0[1] + h10 * m0[1] + h01 * p1[1] + h11 * m1[1]]);
    }
  }
  return out;
}
const C = (x, y) => [x, y, 1];

export const SHAPES = {
  // 1 rat: low body, pointed snout, round ear, long curling tail
  1: [[14, 10], C(11, 2), C(22, 2), [25, 9], [40, 8], C(42, 2), C(53, 2), [56, 9], [68, 9], [84, 10], [95, 17], C(97, 21), [91, 26], [82, 29], [76, 36], C(74, 47), C(63, 48), [59, 37], [46, 33], [30, 31], [20, 28], [12, 23], [4, 24], [0.5, 33], [3, 43], C(9, 49), [10, 45], [6, 41], [4.5, 33], [6, 27], [12, 19]],
  // 2 cat: alert, ears up, tail in an S
  2: [C(10, 2), [10, 14], [9, 24], [3, 28], [0.5, 38], [2, 50], [7, 58], C(12, 64), [13, 57], [8, 49], [7, 40], [10, 34], [20, 37], [40, 38], [56, 38], [64, 40], [68, 46], [68, 54], C(69, 63), [75, 57], [83, 57], C(88, 64), [90, 54], [91, 46], [96, 42], C(95, 38), [88, 36], [82, 33], [78, 28], [78, 14], C(80, 2), C(67, 2), [66, 14], [56, 16], [34, 16], [26, 14], C(24, 2)],
  // 3 dog: sturdy, short snout, tail up
  3: [C(8, 2), [8, 16], [9, 28], [2, 31], [0, 41], [3, 51], C(10, 57), [10, 49], [7, 41], [10, 34], [16, 38], [30, 42], [52, 44], [62, 46], [68, 50], [71, 58], [77, 63], [86, 62], [92, 56], [94, 50], [99, 46], C(99, 40), [93, 37], [86, 36], [81, 33], [77, 27], [77, 14], C(78, 2), C(64, 2), [63, 16], [54, 17], [34, 17], [27, 15], C(26, 2)],
  // 4 wolf: long legs, long muzzle, upright ears, brush tail
  4: [C(14, 2), [14, 22], [12, 33], [5, 33], [0.5, 25], C(1, 16), [5, 23], [10, 28], [13, 40], [24, 49], [46, 53], [58, 52], [66, 55], [70, 63], C(71, 74), [77, 66], [83, 63], [96, 52], C(100, 48), [96, 44], [88, 44], [82, 40], [78, 34], [78, 22], C(79, 2), C(67, 2), [66, 22], [56, 24], [38, 24], [30, 22], C(28, 2)],
  // 5 leopard: long and low, rounded ears, tail drooping with a curl
  5: [C(8, 2), [8, 14], [9, 24], [4, 30], [0, 24], C(1, 14), [5, 20], [11, 28], [12, 36], [22, 43], [44, 46], [58, 45], [66, 48], [70, 54], C(71, 63), [77, 59], [83, 59], C(87, 62), [88, 54], [93, 50], [99, 45], C(98, 40), [90, 37], [84, 33], [78, 27], [76, 14], C(78, 2), C(65, 2), [63, 15], [52, 16], [34, 16], [26, 14], C(24, 2)],
  // 6 tiger: heavy shoulders, broad head, tail up and over
  6: [C(8, 2), [8, 14], [8, 24], [2, 30], [0, 42], [3, 54], C(9, 64), [13, 62], [9, 54], [7, 44], [10, 36], [14, 44], [24, 51], [46, 53], [60, 52], [68, 55], [74, 58], [77, 63], C(79, 67), [84, 62], [92, 60], [98, 52], C(100, 44), [96, 38], [90, 34], [84, 30], [78, 26], [76, 14], C(78, 2), C(64, 2), [62, 15], [52, 16], [32, 16], [26, 14], C(24, 2)],
  // 7 lion: tawny body, huge mane round the head, tufted tail
  7: [C(6, 2), [6, 14], [8, 26], [3, 30], [0, 40], [2, 52], C(2, 61), [7, 59], C(8, 52), [7, 44], [9, 40], [14, 44], [26, 48], [46, 49], [58, 50], [62, 58], [66, 66], [72, 72], [80, 76], [89, 74], [96, 67], [99, 58], [98, 48], [95, 40], [96, 33], [90, 30], [84, 28], [78, 24], [77, 14], C(78, 2), C(64, 2), [63, 16], [52, 18], [34, 18], [27, 14], C(25, 2)],
  // 8 elephant: heavy body, domed head, big ear, trunk curling down
  8: [C(10, 2), [9, 16], [7, 30], [9, 46], [16, 58], [30, 66], [46, 69], [58, 69], [64, 75], [72, 79], [82, 79], [89, 74], [91, 64], [92, 54], [95, 46], [97, 34], [96, 18], C(94, 6), [88, 5], [86, 12], [88, 22], [87, 34], [83, 42], [79, 38], [76, 24], [75, 14], C(76, 2), C(63, 2), [61, 14], [57, 16], [56, 14], C(56, 2), C(44, 2), [42, 14], [34, 16], [32, 14], C(32, 2), C(21, 2), [19, 14]],
};

// ------------------------------------------------------------------------------------------------ painting (y up, same box)
const el = (x, c, cx, cy, rx, ry, fill, rot = 0) => { x.fillStyle = fill; x.beginPath(); x.ellipse(cx, cy, rx, ry, rot, 0, 7); x.fill(); };
const eye = (x, cx, cy, r = 2.3, iris = '#2a1a0c') => { el(x, 0, cx, cy, r * 1.35, r * 1.15, '#fff8e6'); el(x, 0, cx + r * 0.2, cy, r * 0.85, r * 0.85, iris); el(x, 0, cx + r * 0.4, cy + r * 0.3, r * 0.3, r * 0.3, '#fff'); };
const stripes = (x, list, w, col = '#1b0f06') => { x.strokeStyle = col; x.lineCap = 'round'; x.lineWidth = w; for (const [x0, y0, x1, y1] of list) { x.beginPath(); x.moveTo(x0, y0); x.quadraticCurveTo((x0 + x1) / 2 + 2, (y0 + y1) / 2, x1, y1); x.stroke(); } };
const vgrad = (x, y0, y1, a, b) => { const g = x.createLinearGradient(0, y0, 0, y1); g.addColorStop(0, a); g.addColorStop(1, b); return g; };
const COAT = {
  1: ['#b9b2a6', '#8d867b'], 2: ['#f3e8cf', '#d8c8a4'], 3: ['#b9763f', '#8a5128'], 4: ['#a4a8ad', '#6f747b'],
  5: ['#e6bd62', '#c18f33'], 6: ['#f08a2c', '#cc6416'], 7: ['#e0a850', '#b97d28'], 8: ['#9aa0a8', '#6a7079'],
};
export function paintAnimal(x, rank) {
  const [hi, lo] = COAT[rank];
  x.save(); x.beginPath(); const o = outline(SHAPES[rank]); o.forEach(([px, py], i) => (i ? x.lineTo(px, py) : x.moveTo(px, py))); x.closePath(); x.clip();
  x.fillStyle = vgrad(x, 80, 0, hi, lo); x.fillRect(-5, -5, 112, 100);
  // a soft belly shade and top light on every coat
  x.fillStyle = 'rgba(0,0,0,0.12)'; x.fillRect(-5, -5, 112, 14);
  switch (rank) {
    case 1:
      el(x, 0, 66, 41, 5, 6, '#e7a3b0'); el(x, 0, 66, 41, 2.8, 3.4, '#f6c2cb');            // ear
      stripes(x, [[2, 36, 5, 46]], 1.4, '#e29aa8');                                       // tail tint
      eye(x, 80, 24, 2.1); el(x, 0, 95, 20, 2.4, 2.1, '#e7728a');                         // eye, nose
      stripes(x, [[86, 19, 99, 15], [86, 21, 100, 22]], 0.6, 'rgba(60,50,40,0.9)');         // whiskers
      break;
    case 2:
      el(x, 0, 84, 43, 8.5, 8, '#4b3426'); el(x, 0, 90, 44, 5, 5, '#4b3426');              // dark face mask
      for (const p of [[69, 60], [87, 60]]) { x.fillStyle = '#4b3426'; x.beginPath(); x.moveTo(p[0] - 5, 52); x.lineTo(p[0] + 1, 64); x.lineTo(p[0] + 7, 52); x.fill(); }
      x.fillStyle = '#4b3426'; x.fillRect(66, 0, 14, 12); x.fillRect(23, 0, 14, 12); x.fillRect(2, 28, 12, 40);   // paws, tail
      eye(x, 88, 47, 2.2, '#3a7fd0'); el(x, 0, 96, 42, 1.8, 1.5, '#e58b9b');
      break;
    case 3:
      el(x, 0, 72, 46, 8, 10, '#5a3317', -0.3);                                           // floppy ear
      el(x, 0, 86, 40, 12, 7, '#f4ead6'); el(x, 0, 76, 24, 7, 10, '#f4ead6');                // muzzle and chest blaze
      eye(x, 83, 53, 2.2); el(x, 0, 98, 45, 2.6, 2.3, '#1c1410');
      x.fillStyle = '#f4ead6'; x.fillRect(64, 0, 15, 5); x.fillRect(26, 0, 12, 5);
      break;
    case 4:
      el(x, 0, 84, 44, 12, 6, '#d5d8dc'); el(x, 0, 60, 26, 30, 10, '#c9cdd2');             // pale muzzle and belly
      stripes(x, [[20, 52, 56, 52], [14, 46, 52, 47]], 3.2, 'rgba(50,55,62,0.55)');          // darker saddle
      x.fillStyle = '#3d4249'; x.beginPath(); x.moveTo(68, 62); x.lineTo(71, 74); x.lineTo(77, 66); x.fill();
      eye(x, 86, 52, 2); el(x, 0, 99, 48, 2.3, 2, '#101214');
      break;
    case 5: {
      let seed = 7; const r = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
      for (let i = 0; i < 40; i++) { const px = 8 + r() * 86, py = 8 + r() * 55; x.strokeStyle = '#2b1b0a'; x.lineWidth = 1.5; x.beginPath(); x.arc(px, py, 1.5 + r() * 1.5, 0.3, 5.8); x.stroke(); el(x, 0, px, py, 0.7, 0.7, '#6b4515'); }
      el(x, 0, 88, 44, 8, 6, '#f2dca0');
      eye(x, 85, 51, 2); el(x, 0, 98, 45, 2.2, 1.9, '#2a1a10');
      break;
    }
    case 6:
      el(x, 0, 80, 26, 14, 8, '#fff2dc'); el(x, 0, 52, 14, 30, 8, '#f9e4c0');              // white chin, belly
      stripes(x, [[16, 50, 18, 36], [26, 52, 28, 34], [36, 53, 38, 32], [46, 53, 46, 30], [56, 52, 55, 30], [64, 55, 63, 36], [10, 36, 9, 26], [5, 48, 12, 52], [6, 58, 12, 60], [2, 38, 8, 40], [74, 60, 76, 52], [82, 62, 84, 54], [90, 58, 90, 50], [20, 14, 20, 4], [70, 16, 69, 6]], 3.2);
      eye(x, 88, 48, 2.2, '#c9a21c'); el(x, 0, 99, 44, 2.4, 2.1, '#d8707f');
      break;
    case 7:
      el(x, 0, 80, 53, 21, 22, '#7a3d12'); el(x, 0, 80, 53, 17, 18, '#96521c');             // mane
      for (let a = 0; a < 26; a++) { const t = (a / 26) * 6.283; stripes(x, [[80 + Math.cos(t) * 12, 53 + Math.sin(t) * 12, 80 + Math.cos(t) * 21, 53 + Math.sin(t) * 21]], 2, '#5a2a0c'); }
      el(x, 0, 85, 50, 11, 11, '#e8b75f'); el(x, 0, 90, 44, 7, 5.5, '#f3d6a2');               // face, muzzle
      eye(x, 87, 54, 2.1, '#6a3a08'); el(x, 0, 94, 47, 2.4, 2.1, '#3c2218');
      x.fillStyle = '#6a3412'; x.beginPath(); x.arc(4, 56, 5, 0, 7); x.fill();               // tail tuft
      break;
    case 8:
      el(x, 0, 69, 52, 13, 16, '#7f858e'); el(x, 0, 69, 51, 9.5, 12.5, '#c9a0a0');           // great ear
      stripes(x, [[40, 66, 38, 40], [28, 62, 26, 38], [50, 66, 48, 44]], 0.8, 'rgba(60,64,70,0.5)');
      for (let k = 0; k < 9; k++) stripes(x, [[90 - k * 0.3, 52 - k * 4, 96 - k * 0.3, 52 - k * 4]], 0.9, 'rgba(60,64,70,0.45)');   // trunk folds
      eye(x, 82, 62, 2); el(x, 0, 90, 38, 1.6, 6, '#f2ead2', 0.5);                            // eye, tusk
      break;
    default:
  }
  // rim light along the back edge
  x.lineWidth = 1.2; x.strokeStyle = 'rgba(255,255,255,0.28)'; x.beginPath(); o.forEach(([px, py], i) => (i ? x.lineTo(px, py) : x.moveTo(px, py))); x.closePath(); x.stroke();
  x.strokeStyle = 'rgba(20,10,4,0.55)'; x.lineWidth = 1.6; x.stroke();
  x.restore();
}
