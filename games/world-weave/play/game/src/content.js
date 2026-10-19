// Text content and small constants shared by game.js/view.js. Kept separate so the wording used by
// the (future, production-stage) exhaustive Rules reference page can reuse the exact same strings
// as onboarding, rather than drifting — see docs/WORLD-WEAVE-GAMEPLAY.md §5c.

// Web preview cap (docs/GAME-CONTRACT.md "Web preview"): a real taste of the game, not the whole
// thing — 3 panels out of this slice's 6 (2 per region x 3 regions), the same number
// crown-star-regions uses for its own demo cap.
export const DEMO_PANEL_LIMIT = 3;

// Game-level taught-controls sequence (docs/WORLD-WEAVE-GAMEPLAY.md §5c): the ONE thing every
// region shares, taught once, before any real panel. Step 2 is interactive (see game.js howto*).
export const HOWTO_STEPS = [
  "Every panel is a grid. You'll place tiles so their edges continue whatever is already down.",
  "Rotate and flip a tile before you drop it. Nothing is ever blocked — a poor fit just looks duller, so you can always try.",
  'Try it: rotate the tile below until it lines up, then tap the open cell to place it.',
];

export const HOWTO_TILE_HINT = 'Tap Rotate, then tap the glowing cell.';
export const HOWTO_SUCCESS = 'Good fit! Every region ahead uses this same move, plus one twist of its own.';
