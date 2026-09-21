// Region colour schemes and their backdrops. Pure data + colour math.

// Region colour schemes. Index 0 is the original look and stays the default; players can cycle
// through the others (some colours are easier on some eyes). A scheme gives a [hue, saturation]
// per region (lightness comes from the renderer, shifted by `light`), and optionally its own
// board-surround gradient (`bg`).
const OKABE_ITO = [[41, 100], [202, 70], [164, 100], [55, 84], [202, 100], [26, 100], [326, 46], [0, 0], [251, 46], [173, 47]];

function hexToHs(hex) {
  const r = parseInt(hex.slice(1, 3), 16) / 255;
  const g = parseInt(hex.slice(3, 5), 16) / 255;
  const b = parseInt(hex.slice(5, 7), 16) / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const d = max - min;
  let h = 0;
  if (d) {
    if (max === r) h = ((g - b) / d) % 6;
    else if (max === g) h = (b - r) / d + 2;
    else h = (r - g) / d + 4;
  }
  const l = (max + min) / 2;
  const sat = d === 0 ? 0 : d / (1 - Math.abs(2 * l - 1));
  return [Math.round(((h * 60) + 360) % 360), Math.round(sat * 100)];
}
// Like hexToHs but also keeps the colour's own lightness (for schemes whose base tones are fixed).
function hexToHsl(hex) {
  const [h, sat] = hexToHs(hex);
  const r = parseInt(hex.slice(1, 3), 16) / 255;
  const g = parseInt(hex.slice(3, 5), 16) / 255;
  const b = parseInt(hex.slice(5, 7), 16) / 255;
  return [h, sat, Math.round(((Math.max(r, g, b) + Math.min(r, g, b)) / 2) * 100)];
}
const fromHexExact = (list) => {
  const table = list.map(hexToHsl);
  return (id) => table[id % table.length];
};
const fromHex = (list) => {
  const table = list.map(hexToHs);
  return (id) => table[id % table.length];
};
const rainbow = (sat) => (id, n) => [Math.round((360 / n) * id), sat];

export const PALETTES = [
  { name: 'Default', pick: rainbow(65) },
  { name: 'Soft', pick: rainbow(40) },
  { name: 'Vivid', pick: rainbow(90) },
  { name: 'Muted', pick: rainbow(22) },
  { name: 'Colour-blind safe', pick: (id) => OKABE_ITO[id % OKABE_ITO.length] },
  // Sure Sweep's look: slate-grey cells with a hint of colour per region, on its blue-teal backdrop.
  { name: 'Slate', pick: fromHexExact(['#3a4356', '#4a5a78', '#574d75', '#44606b', '#5b6472', '#6a5a52', '#34506a', '#4d604f', '#75566a', '#63636b']), bg: ['#2f7ba3', '#2a5f7e', '#2a4f66'] },
  { name: 'Candy', pick: fromHex(['#ff6fb5', '#ffa94d', '#ffe066', '#69db7c', '#4dd0e1', '#7c9cff', '#b57cff', '#ff8787', '#f783ac', '#63e6be']), light: 6, bg: ['#ff8fc7', '#c77dff', '#7b5cff'] },
  { name: 'Jewel', pick: fromHex(['#c2255c', '#1971c2', '#2f9e44', '#9c36b5', '#e8590c', '#0c8599', '#e03131', '#5f3dc4', '#f59f00', '#087f5b']), bg: ['#3b1c5a', '#26123d', '#150a26'] },
  { name: 'Sunset', pick: fromHex(['#ff4d4d', '#ff8c1a', '#ffd43b', '#f06595', '#c2255c', '#9775fa', '#5f3dc4', '#ff9e7a', '#e8590c', '#b197fc']), bg: ['#ff8a5c', '#d6336c', '#5f2b6b'] },
  { name: 'Autumn', pick: fromHex(['#c0392b', '#d35400', '#f39c12', '#7d6608', '#6e8b3d', '#1e8449', '#117a65', '#a04000', '#af601a', '#5d6d7e']), light: 4, bg: ['#a0522d', '#6b3a1e', '#3d2110'] },
  { name: 'Neon', pick: fromHex(['#ff2079', '#ffe600', '#00f5d4', '#9b5de5', '#00bbf9', '#f15bb5', '#fee440', '#39ff14', '#ff6d00', '#3a86ff']), light: -2, bg: ['#1b1b3a', '#101028', '#07071a'] },
  { name: 'Ocean', pick: fromHex(['#0077b6', '#ffb703', '#48cae4', '#2a9d8f', '#e76f51', '#90e0ef', '#023e8a', '#06d6a0', '#118ab2', '#f4a261']), bg: ['#0a9396', '#005f73', '#001d3d'] },
  { name: 'Sherbet', pick: fromHex(['#ff9a9e', '#fad0c4', '#ffd86f', '#b5ead7', '#a0e7e5', '#c7ceea', '#e2a9f1', '#ffb7b2', '#9be564', '#84a9ff']), light: 8, bg: ['#ffc2d1', '#ffb3c6', '#bde0fe'] },
  { name: 'Midnight', pick: rainbow(70), light: -6, bg: ['#243b55', '#141e30', '#0b1120'] },
];

// Colour of one region at a given lightness stop (the renderer asks for light, mid and dark stops).
// Fixed-tone schemes (baseL given) keep their own lightness and only shift around it.
export function regionColor(palette, regionId, regionCount, lightness, alpha = 1) {
  const [hue, sat, baseL] = palette.pick(regionId, regionCount);
  const l = Math.max(10, Math.min(90, baseL !== undefined ? baseL + (lightness - 40) : lightness + (palette.light ?? 0)));
  return `hsl(${hue} ${sat}% ${l}% / ${alpha})`;
}

