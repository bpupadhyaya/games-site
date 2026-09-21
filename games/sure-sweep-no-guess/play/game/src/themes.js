// Colour schemes. Index 0 is the default look; players can cycle through the others in-game
// (some colours are easier on some eyes). The saved `theme` value is an index into this list,
// so the order must never change - only append.
//   bg        three stops of the backdrop (light corner -> deep edge)
//   hidden    top/bottom of an unopened tile
//   revealed  top/bottom of an opened cell
//   numbers   ink for 1..8 (index 0 unused)
//   ink       text drawn straight on the backdrop (optional; light by default)
const DEFAULT_NUMBERS = ['#000', '#1565c0', '#2e7d32', '#c62828', '#0d1a63', '#6a1b1a', '#00838f', '#111111', '#555555'];
const STRONG_NUMBERS = ['#000', '#1d4ed8', '#15803d', '#b91c1c', '#4c1d95', '#9a3412', '#0e7490', '#111111', '#555555'];

export const THEMES = [
  { name: 'Default', bg: ['#1FB8B0', '#0F6B72', '#062f38'], hidden: ['#3fd6cb', '#149a9c'], revealed: ['#fbf3df', '#ecdfbd'], numbers: DEFAULT_NUMBERS },
  { name: 'Dark', bg: ['#1d2230', '#161a26', '#10131c'], hidden: ['#46516a', '#2b3347'], revealed: ['#cfd6e0', '#b4bcc9'], numbers: DEFAULT_NUMBERS },
  { name: 'High contrast', bg: ['#000000', '#000000', '#000000'], hidden: ['#6a7488', '#454c5e'], revealed: ['#ffffff', '#f0f0f0'], numbers: ['#000', '#0000ff', '#007a00', '#d00000', '#00008b', '#8b0000', '#007b8b', '#000', '#444'] },
  { name: 'Colour-blind safe', bg: ['#2f7ba3', '#2a5f7e', '#1c3a4d'], hidden: ['#4a5670', '#2c3448'], revealed: ['#f4f6f8', '#dde3ea'], numbers: ['#000', '#0072B2', '#b36b00', '#D55E00', '#CC79A7', '#009E73', '#2a6f9e', '#000', '#555'] },
  { name: 'Warm', bg: ['#a3692f', '#7e5a2a', '#4a3319'], hidden: ['#a07a52', '#6f5538'], revealed: ['#fbf3e4', '#efe2c8'], numbers: DEFAULT_NUMBERS },
  { name: 'Sunset', bg: ['#ff8a5c', '#d6336c', '#5f2b6b'], hidden: ['#8a4272', '#56264b'], revealed: ['#fff1e6', '#ffd9c2'], numbers: STRONG_NUMBERS },
  { name: 'Aurora', bg: ['#34d399', '#7c3aed', '#0f172a'], hidden: ['#3d4d66', '#1e293b'], revealed: ['#ecfeff', '#cffafe'], numbers: STRONG_NUMBERS },
  { name: 'Candy', bg: ['#f9a8d4', '#c4b5fd', '#93c5fd'], hidden: ['#b39dfb', '#8b5cf6'], revealed: ['#fff7fb', '#fde7f3'], numbers: STRONG_NUMBERS, ink: '#3a2466' },
  { name: 'Midnight', bg: ['#1e3a8a', '#0f172a', '#020617'], hidden: ['#3d4d66', '#1e293b'], revealed: ['#dbeafe', '#bfdbfe'], numbers: STRONG_NUMBERS },
  { name: 'Forest', bg: ['#22c55e', '#15803d', '#052e16'], hidden: ['#56801d', '#2a4210'], revealed: ['#f7fee7', '#ecfccb'], numbers: STRONG_NUMBERS },
  { name: 'Lavender', bg: ['#c4b5fd', '#8b5cf6', '#4c1d95'], hidden: ['#7d6be0', '#5b4bb5'], revealed: ['#faf5ff', '#f3e8ff'], numbers: STRONG_NUMBERS },
  { name: 'Deep sea', bg: ['#22d3ee', '#0e7490', '#083344'], hidden: ['#1b7590', '#164e63'], revealed: ['#ecfeff', '#cffafe'], numbers: STRONG_NUMBERS },
  { name: 'Slate', bg: ['#64748b', '#334155', '#0f172a'], hidden: ['#56657c', '#334155'], revealed: ['#f1f5f9', '#e2e8f0'], numbers: STRONG_NUMBERS },
];

const parse = (hex) => {
  let h = hex.replace('#', '');
  if (h.length === 3) h = h.split('').map((c) => c + c).join('');
  const n = parseInt(h, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
};
const mixTo = (hex, target, a) => {
  const c = parse(hex);
  return `rgb(${c.map((v, i) => Math.round(v + (target[i] - v) * a)).join(',')})`;
};
export const lighten = (hex, a) => mixTo(hex, [255, 255, 255], a);
export const darken = (hex, a) => mixTo(hex, [0, 0, 0], a);
export const alpha = (hex, a) => `rgba(${parse(hex).join(',')},${a})`;

// Everything the renderer needs for one scheme, derived once and cached.
const cache = new Map();
export function palette(index) {
  if (cache.has(index)) return cache.get(index);
  const t = THEMES[index] ?? THEMES[0];
  const ink = t.ink ?? '#f2fbfa';
  const p = {
    name: t.name,
    bg: t.bg,
    tileTop: lighten(t.hidden[0], 0.1),
    tileBottom: t.hidden[1],
    tileLip: darken(t.hidden[1], 0.5),
    tileRim: lighten(t.hidden[0], 0.45),
    cellTop: t.revealed[0],
    cellBottom: t.revealed[1],
    cellEdge: darken(t.revealed[1], 0.22),
    numbers: t.numbers,
    frameTop: darken(t.bg[1], 0.35),
    frameBottom: darken(t.bg[2], 0.35),
    well: darken(t.bg[2], 0.62),
    glassTop: darken(t.bg[1], 0.5),
    glassBottom: darken(t.bg[2], 0.6),
    ink,
    inkSoft: alpha(ink, 0.72),
    inkFaint: alpha(ink, 0.5),
    lightInk: !t.ink,
  };
  cache.set(index, p);
  return p;
}
