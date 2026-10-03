// Dot arrangements (the shape of the pulli) for puzzles and the Sandbox. A shape is a small array like ['rect', 5, 4]; dotsOf() turns it
// into the sorted dot list for its lattice.
import { rectDots, hexDots, triDots, sortDots } from './board.js';

export function dotsOf(shape) {
  const [k, a, b] = shape;
  if (k === 'rect') return rectDots(a, b);
  if (k === 'hex') return hexDots(a);
  if (k === 'tri') return triDots(a);
  if (k === 'para') return rectDots(a, b); // a parallelogram on the staggered lattice
  if (k === 'plus') { // n x n with arms of width b
    const d = [], lo = Math.floor((a - b) / 2), hi = lo + b - 1;
    for (let v = 0; v < a; v++) for (let u = 0; u < a; u++) if ((u >= lo && u <= hi) || (v >= lo && v <= hi)) d.push([u, v]);
    return d;
  }
  if (k === 'ring') { // n x n with a b x b hole in the middle
    const d = [], lo = Math.floor((a - b) / 2), hi = lo + b - 1;
    for (let v = 0; v < a; v++) for (let u = 0; u < a; u++) if (!(u >= lo && u <= hi && v >= lo && v <= hi)) d.push([u, v]);
    return d;
  }
  if (k === 'dia') { // a diamond-shaped block of dots: rows of 1, 3, 5 ... (radius a)
    const d = [];
    for (let v = -a + 1; v <= a - 1; v++) for (let u = -a + 1; u <= a - 1; u++) if (Math.abs(u) + Math.abs(v) <= a - 1) d.push([u + a - 1, v + a - 1]);
    return sortDots(d);
  }
  if (k === 'stair') { // a staircase of n steps
    const d = [];
    for (let v = 0; v < a; v++) for (let u = 0; u <= v; u++) d.push([u, v]);
    return sortDots(d);
  }
  if (k === 'hee') { // an H: two columns joined by a bar (n tall)
    const d = [], mid = Math.floor(a / 2);
    for (let v = 0; v < a; v++) for (let u = 0; u < a; u++) if (u === 0 || u === a - 1 || v === mid) d.push([u, v]);
    return d;
  }
  if (k === 'ell') { // an L
    const d = [];
    for (let v = 0; v < a; v++) for (let u = 0; u < b; u++) if (u < 2 || v >= a - 2) d.push([u, v]);
    return d;
  }
  return [];
}

export const shapeName = (shape) => {
  const [k, a, b] = shape;
  if (k === 'rect' || k === 'para') return `${a} x ${b}`;
  if (k === 'hex') return `Ring of ${a}`;
  if (k === 'tri') return `Triangle ${a}`;
  if (k === 'plus') return `Cross ${a}`;
  if (k === 'ring') return `Frame ${a}`;
  if (k === 'dia') return `Diamond ${a}`;
  if (k === 'stair') return `Stairs ${a}`;
  if (k === 'hee') return `Gate ${a}`;
  if (k === 'ell') return `Corner ${a}`;
  return '';
};
