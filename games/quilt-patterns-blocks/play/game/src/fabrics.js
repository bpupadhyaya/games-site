// The fabric stash: 18 prints in seven families. `lum` (0..1) is the cloth's lightness, what a quilter calls its value.
// Prints are drawn by art.js; here we only name them. Palette names describe craft styles only.
const hex = (h) => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
const F = (id, name, base, ink, print) => ({ id, name, base, ink, print });
export const FABRICS = [
  F('parchment', 'Parchment pin-dot', '#efe4cc', '#cdb98c', 'dot'),
  F('wheat', 'Wheat stripe', '#e5c98f', '#c39549', 'stripe'),
  F('sage', 'Sage gingham', '#bccaa4', '#6e8f5b', 'gingham'),
  F('sky', 'Sky ditsy', '#bfd5e3', '#6b93b2', 'ditsy'),
  F('butter', 'Butter solid', '#f2d67e', '#f2d67e', 'solid'),
  F('rose', 'Rose ditsy', '#ebb7b2', '#b6545d', 'ditsy'),
  F('brick', 'Brick pin-dot', '#a64a3a', '#ecc6a4', 'dot'),
  F('rust', 'Rust plaid', '#b8693a', '#6b3115', 'plaid'),
  F('indigo', 'Indigo solid', '#2a417c', '#2a417c', 'solid'),
  F('denim', 'Denim lattice', '#40608f', '#8aa9d2', 'lattice'),
  F('forest', 'Forest stripe', '#2f5a40', '#84a98b', 'stripe'),
  F('plum', 'Plum solid', '#5f2f5d', '#5f2f5d', 'solid'),
  F('charcoal', 'Charcoal pin-dot', '#37383c', '#8c8c93', 'dot'),
  F('teal', 'Teal gingham', '#2f7f86', '#c1e4e7', 'gingham'),
  F('mustard', 'Mustard plaid', '#c9962b', '#7a561a', 'plaid'),
  F('ivory', 'Ivory lattice', '#f7f1e0', '#d9d0b6', 'lattice'),
  F('jet', 'Jet solid', '#19191c', '#19191c', 'solid'),
  F('crimson', 'Crimson solid', '#a0233a', '#a0233a', 'solid'),
];
export const FAB = Object.fromEntries(FABRICS.map((f) => [f.id, f]));
for (const f of FABRICS) {
  const [r, g, b] = hex(f.base);
  f.lum = (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
  f.busy = f.print === 'plaid' || f.print === 'ditsy' || f.print === 'gingham' || f.print === 'lattice' || f.print === 'stripe';
  f.band = f.lum < 0.3 ? 0 : f.lum < 0.6 ? 1 : 2;   // 0 dark, 1 medium, 2 light
  f.gray = Math.round(f.lum * 255);
}
export const fab = (id) => FAB[id] ?? null;
export const BAND_NAME = ['dark', 'medium', 'light'];
export const PALETTES = [
  { id: 'jewel', name: 'Plain and jewel tones', note: 'Solid cloth in deep colour on a dark ground.', ids: ['jet', 'crimson', 'indigo', 'plum', 'forest', 'teal', 'butter', 'parchment'] },
  { id: 'homespun', name: 'Homespun scraps', note: 'Checks, plaids and stripes from the scrap bag.', ids: ['ivory', 'wheat', 'sage', 'brick', 'rust', 'mustard', 'denim', 'charcoal'] },
  { id: 'bold', name: 'Bold and improvised', note: 'Big contrasts in unexpected pairings.', ids: ['rose', 'sky', 'butter', 'teal', 'plum', 'crimson', 'ivory', 'mustard'] },
];
export const ALL_IDS = FABRICS.map((f) => f.id);
