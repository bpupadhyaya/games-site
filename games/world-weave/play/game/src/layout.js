// Shared screen-space layout (virtual 720x1280 portrait canvas). Pure math only, no canvas calls —
// one source of truth for both rendering (view.js) and pointer hit-testing (game.js).

export const SCREEN = { width: 720, height: 1280 };

export function inRect(x, y, rect) {
  return x >= rect.x && x <= rect.x + rect.w && y >= rect.y && y <= rect.y + rect.h;
}

// ---- Title -------------------------------------------------------------------------------------
export const TITLE_PLAY_BUTTON = { x: 110, y: 760, w: 500, h: 120 };
export const TITLE_ATLAS_BUTTON = { x: 110, y: 900, w: 500, h: 96 };
export const TITLE_HOWTO_BUTTON = { x: 110, y: 1012, w: 500, h: 84 };

// ---- Back button (region select, level select, atlas) ------------------------------------------
export const BACK_BUTTON = { x: 30, y: 36, w: 150, h: 74 };

// ---- Region select -------------------------------------------------------------------------------
export function regionCardRect(i) {
  return { x: 50, y: 260 + i * 300, w: 620, h: 270 };
}

// ---- Level select --------------------------------------------------------------------------------
export function levelCardRect(i) {
  return { x: 60, y: 300 + i * 230, w: 600, h: 190 };
}

// ---- Playing -------------------------------------------------------------------------------------
export const BOARD_AREA = 600;
export function boardGeo(size) {
  const cell = BOARD_AREA / size;
  return { x: (SCREEN.width - BOARD_AREA) / 2, y: 210, px: BOARD_AREA, cell, size };
}
export function hitTestCell(x, y, size) {
  const geo = boardGeo(size);
  const col = Math.floor((x - geo.x) / geo.cell);
  const row = Math.floor((y - geo.y) / geo.cell);
  if (row < 0 || row >= size || col < 0 || col >= size) return -1;
  return row * size + col;
}

export const TRAY_TILE = { x: 56, y: 900, w: 148, h: 148 };
export function nextPreviewRect(i) {
  return { x: 224 + i * 70, y: 934, w: 60, h: 60 };
}
export const ROTATE_BUTTON = { x: 452, y: 892, w: 118, h: 78 };
export const FLIP_BUTTON = { x: 452, y: 980, w: 118, h: 78 };
export const UNDO_BUTTON = { x: 582, y: 892, w: 88, h: 78 };
export const EXIT_BUTTON = { x: 582, y: 980, w: 88, h: 78 };

// The strip meter / thread meter / rosette count line, drawn just under the board.
export const SPECIAL_LINE_Y = 838;

// Milestone/heritage-note toast, and the tap-anywhere-to-dismiss area it owns while shown.
export const NOTE_TOAST = { x: 60, y: 380, w: 600, h: 420 };

// ---- Level complete overlay ------------------------------------------------------------------
export const COMPLETE_PANEL = { x: 60, y: 300, w: 600, h: 620 };
export const COMPLETE_NEXT_BUTTON = { x: 100, y: 780, w: 520, h: 100 };
export const COMPLETE_ATLAS_BUTTON = { x: 100, y: 894, w: 520, h: 84 };

// ---- Onboarding: game-level how-to-play, and the tiny interactive practice grid ----------------
export const HOWTO_CONTINUE_BUTTON = { x: 160, y: 1080, w: 400, h: 96 };
export const HOWTO_BOARD = { x: 210, y: 560, px: 300, size: 2 }; // a fixed 2x2 practice grid
export function howtoCellRect(index) {
  const cell = HOWTO_BOARD.px / HOWTO_BOARD.size;
  const row = Math.floor(index / HOWTO_BOARD.size), col = index % HOWTO_BOARD.size;
  return { x: HOWTO_BOARD.x + col * cell, y: HOWTO_BOARD.y + row * cell, w: cell, h: cell };
}
export const HOWTO_TRAY_TILE = { x: 300, y: 900, w: 120, h: 120 };
export const HOWTO_ROTATE_BUTTON = { x: 240, y: 1050, w: 240, h: 90 };

// ---- Region intro (ABOUT + this region's one twist, shown once before its first panel) ---------
export const INTRO_CONTINUE_BUTTON = { x: 110, y: 1080, w: 500, h: 100 };

// ---- Atlas: a card gallery, one real card per built region (docs/WORLD-WEAVE-GAMEPLAY.md §4) ----
// Reuses the exact same card geometry as region-select (`regionCardRect`, just above) — the Atlas
// is a different screen showing the same 3 built regions, not a separate layout. See view.js for
// why: an earlier map-layout attempt is documented in worldMap.js's file header.
export const ATLAS_SWATCH_MARGIN = 30; // gap from the card's right/top edge to its pattern swatch

// ---- Atlas, taxonomy section (2026-09-25 pass, corrected same day): below the built-region cards,
// a compact swatch tile per remaining docs/WORLD-WEAVE-TAXONOMY.md region, so the Atlas gives every
// one of the 41 civilizations its own shape instead of a single "+38 more" footer line. Deliberately
// NOT another attempt at the rejected literal geographic map (see worldMap.js's file header).
//
// First cut of this grouped tiles by continent, with a printed "EUROPE" / "THE AMERICAS" header per
// section. The owner rejected that directly, on the taxonomy's own founding principle: regions here
// are civilizational lineages defined by settlement geography, "never by modern political borders"
// (docs/WORLD-WEAVE-TAXONOMY.md's own words) — printing continent names as section banners put a
// modern-geopolitical-map frame right back over content whose whole point is to not be organized
// that way. Fixed by dropping grouping/headers entirely: one continuous grid, in the taxonomy's own
// listed order (still a real, deliberate order — see worldMap.js — just never labelled as "a
// continent" on screen).
export const ATLAS_SCROLL_TOP = 250; // fixed header height; only content below this scrolls
export const ATLAS_TILE = { w: 190, h: 190, gap: 25 };
export const ATLAS_TILE_LABEL_H = 54; // room for the region name + "Not yet woven" tag below the tile
export const ATLAS_TILE_ROW_H = ATLAS_TILE.h + ATLAS_TILE_LABEL_H + 22;
export const ATLAS_COLS = 3;
export const ATLAS_CONTENT_MARGIN = 50; // matches regionCardRect's left edge

// Pure geometry, no canvas calls (this file's one rule) — the single source of truth for both
// drawing (view.js) and scroll-extent/hit-testing (game.js). `taxonomyRegions` excludes anything
// with a `builtId`: those 3 already get full-detail cards above, from `regionCardRect`.
export function atlasTaxonomyLayout(taxonomyRegions, startY) {
  const entries = taxonomyRegions.filter((r) => !r.builtId);
  const tiles = entries.map((entry, i) => {
    const row = Math.floor(i / ATLAS_COLS), col = i % ATLAS_COLS;
    return {
      entry,
      x: ATLAS_CONTENT_MARGIN + col * (ATLAS_TILE.w + ATLAS_TILE.gap),
      y: startY + row * ATLAS_TILE_ROW_H,
    };
  });
  const contentBottom = startY + Math.ceil(entries.length / ATLAS_COLS) * ATLAS_TILE_ROW_H;
  return { tiles, contentBottom };
}
