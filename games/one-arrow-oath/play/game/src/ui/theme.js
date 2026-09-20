// One palette and type scale for the whole game. Swap this file's values for another scheme.
// The virtual canvas is 720x1560 (9:19.5) so the game fills a modern phone edge to edge.
export const W = 720;
export const H = 1560;
// Keep important things out of these bands: status bar / camera cut-out, and the home indicator.
export const SAFE_TOP = 92;
export const SAFE_BOTTOM = 52;

export const C = {
  skyTop: '#05071a',
  skyMid: '#0e1338',
  skyLow: '#1c1646',
  ink: '#f1ebd9',
  inkSoft: '#cfd0e4',
  gold: '#e2bd72',
  goldLight: '#fbe6ae',
  goldDeep: '#9a7431',
  goldDim: '#8a7443',
  steel: '#9fb0cf',
  steelDeep: '#56648a',
  muted: '#8590b4',
  panelTop: 'rgba(28, 34, 76, 0.94)',
  panelBottom: 'rgba(10, 13, 34, 0.96)',
  panelEdge: 'rgba(226, 189, 114, 0.5)',
  damage: '#ff5470',
  guard: '#bfe3ff',
  good: '#7dffb0',
  shade: 'rgba(3, 4, 12, 0.975)',
  night: '#080b20',
};

export const ELEMENT_COLOR = {
  ember: '#ff6b3d',
  tide: '#3fb8ff',
  flare: '#ffd34d',
  storm: '#9a86ff',
  gale: '#5fe3c0',
  stone: '#d2a97c',
};

export const elementColor = (element) => ELEMENT_COLOR[element] ?? C.gold;

// "#rrggbb" + alpha 0..1 -> rgba() string
export function alpha(hex, a) {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${a})`;
}

const SANS = 'system-ui, -apple-system, "Segoe UI", Roboto, sans-serif';
// Cinzel ships with the game (web/fonts). The rest are fallbacks while it loads.
const DISPLAY = '"Cinzel", "Cochin", "Palatino Linotype", Palatino, Georgia, "Noto Serif", serif';
export const font = (size, weight = 400, display = false) => `${weight} ${size}px ${display ? DISPLAY : SANS}`;
