// Everything drawn each frame. Reads `state` (see game.js) and changes nothing.
import { SCREEN, inRect, BACK_BUTTON, regionCardRect, levelCardRect, boardGeo,
  TRAY_TILE, nextPreviewRect, ROTATE_BUTTON, FLIP_BUTTON, UNDO_BUTTON, EXIT_BUTTON,
  SPECIAL_LINE_Y, NOTE_TOAST, COMPLETE_PANEL, COMPLETE_NEXT_BUTTON, COMPLETE_ATLAS_BUTTON,
  TITLE_PLAY_BUTTON, TITLE_ATLAS_BUTTON, TITLE_HOWTO_BUTTON, HOWTO_CONTINUE_BUTTON, HOWTO_BOARD,
  howtoCellRect, HOWTO_TRAY_TILE, HOWTO_ROTATE_BUTTON, INTRO_CONTINUE_BUTTON,
  ATLAS_SWATCH_MARGIN, ATLAS_SCROLL_TOP, ATLAS_TILE, ATLAS_TILE_LABEL_H,
  atlasTaxonomyLayout } from './layout.js';
import { transform } from './grid.js';
import { createRng } from '../kit/rng.js';
import { REGIONS, getRegion } from './regions/index.js';
import { REGIONS as TAXONOMY_REGIONS } from './worldMap.js';
import { buildPanel } from './generator.js';

const W = SCREEN.width, H = SCREEN.height;
const UI = 'system-ui, -apple-system, "Segoe UI", Roboto, sans-serif';
const DISPLAY = 'Georgia, "Times New Roman", serif';
const CREAM = '#f5ecd8';
const GOLD = '#e0b654';

// The Atlas's taxonomy section starts right below the last built-region card. Computed once here
// (not per-frame) and exported so game.js's scroll clamping and hit-testing share this exact
// geometry with what actually gets drawn — same "one source of truth" convention as layout.js.
const ATLAS_TAXONOMY_START_Y = regionCardRect(REGIONS.length - 1).y + regionCardRect(REGIONS.length - 1).h + 130;
export const ATLAS_TAXONOMY = atlasTaxonomyLayout(TAXONOMY_REGIONS, ATLAS_TAXONOMY_START_Y);
export const ATLAS_MAX_SCROLL = Math.max(0, ATLAS_TAXONOMY.contentBottom + 40 - H);

function text(ctx, str, x, y, size, color = CREAM, font = UI, weight = 600, align = 'center') {
  ctx.textAlign = align;
  ctx.font = `${weight} ${size}px ${font}`;
  ctx.fillStyle = color;
  ctx.fillText(str, x, y);
}

// `x` is the anchor `text()` aligns against: a centre point when align is 'center' (the default,
// used for full-width blurbs), or the left edge when align is 'left' (card copy that must stay
// clear of art on the right — see drawRegionSelect).
function wrapText(ctx, str, x, y, maxWidth, lineHeight, size, color = CREAM, font = UI, align = 'center') {
  ctx.font = `500 ${size}px ${font}`;
  let line = '', drawn = 0;
  for (const word of str.split(' ')) {
    const test = line ? `${line} ${word}` : word;
    if (ctx.measureText(test).width > maxWidth && line) {
      text(ctx, line, x, y + drawn * lineHeight, size, color, font, 500, align);
      line = word; drawn += 1;
    } else line = test;
  }
  if (line) text(ctx, line, x, y + drawn * lineHeight, size, color, font, 500, align);
  return drawn + 1;
}

function panel(ctx, x, y, w, h, fill = 'rgba(26,16,52,0.92)') {
  ctx.save();
  ctx.shadowColor = 'rgba(0,0,0,0.5)'; ctx.shadowBlur = 30; ctx.shadowOffsetY = 12;
  ctx.fillStyle = fill;
  ctx.beginPath(); ctx.roundRect(x, y, w, h, 26); ctx.fill();
  ctx.restore();
  ctx.strokeStyle = 'rgba(224,182,84,0.55)'; ctx.lineWidth = 2.5;
  ctx.beginPath(); ctx.roundRect(x, y, w, h, 26); ctx.stroke();
}

function button(ctx, rect, label, opts = {}) {
  ctx.save();
  const dim = Boolean(opts.dim);
  ctx.globalAlpha = dim ? 0.45 : 1;
  const g = ctx.createLinearGradient(0, rect.y, 0, rect.y + rect.h);
  if (opts.primary) { g.addColorStop(0, '#f6d98a'); g.addColorStop(1, '#c8922f'); } else { g.addColorStop(0, '#5a3fae'); g.addColorStop(1, '#372375'); }
  ctx.fillStyle = g;
  ctx.beginPath(); ctx.roundRect(rect.x, rect.y, rect.w, rect.h, Math.min(22, rect.h * 0.3)); ctx.fill();
  ctx.strokeStyle = opts.primary ? '#8a5c10' : GOLD; ctx.lineWidth = 2;
  ctx.stroke();
  text(ctx, label, rect.x + rect.w / 2, rect.y + rect.h / 2 + (opts.size ?? 30) * 0.34, opts.size ?? 30, opts.primary ? '#3a2205' : CREAM, DISPLAY, 700);
  ctx.restore();
}

function backdrop(ctx) {
  const g = ctx.createRadialGradient(W / 2, 260, 60, W / 2, 420, 1200);
  g.addColorStop(0, '#3a2a6e'); g.addColorStop(0.55, '#211442'); g.addColorStop(1, '#0c0820');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);
}

// ---------------------------------------------------------------------------------------------
function drawTitle(ctx, state, manifest) {
  text(ctx, manifest.title.toUpperCase(), W / 2, 260, 64, GOLD, DISPLAY, 800);
  text(ctx, manifest.tagline ?? 'Weave real heritage patterns, one tile at a time.', W / 2, 310, 24, 'rgba(245,236,216,0.85)');
  // a small hero: three tiles from the three regions, side by side
  REGIONS.forEach((region, i) => {
    const s = 150, x = W / 2 - s * 1.5 - 20 + i * (s + 20), y = 420 + Math.sin(state.t * 1.1 + i) * 6;
    const demo = { edges: region.id === 'kolam' ? ['T', 'B', 'T', 'B'] : [0, 1, 2, 0].map((v) => v % (region.STRANDS?.length ?? 3)) };
    region.drawTile(ctx, x, y, s, demo, {});
  });
  button(ctx, TITLE_PLAY_BUTTON, 'Play', { primary: true, size: 40 });
  button(ctx, TITLE_ATLAS_BUTTON, 'World Atlas', { size: 30 });
  button(ctx, TITLE_HOWTO_BUTTON, 'How to Play', { size: 26 });
}

// ---------------------------------------------------------------------------------------------
function drawHowto(ctx, state, helpers) {
  text(ctx, 'HOW TO WEAVE', W / 2, 140, 40, GOLD, DISPLAY, 800);
  const step = state.howtoStep;
  if (step < 2) {
    wrapText(ctx, helpers.HOWTO_STEPS[step], W / 2, 300, 560, 34, 26);
    button(ctx, HOWTO_CONTINUE_BUTTON, 'Continue', { primary: true });
    return;
  }
  wrapText(ctx, helpers.HOWTO_STEPS[2], W / 2, 220, 580, 30, 23);
  // fixed demo tile at cell 0 + open cell 1
  const fixed = { edges: [1, 0, 1, 0] };
  const cell0 = howtoCellRect(0), cell1 = howtoCellRect(1);
  ctx.fillStyle = 'rgba(0,0,0,0.25)';
  ctx.fillRect(HOWTO_BOARD.x - 6, HOWTO_BOARD.y - 6, HOWTO_BOARD.px + 12, HOWTO_BOARD.px + 12);
  ctx.strokeStyle = GOLD; ctx.lineWidth = 2;
  ctx.strokeRect(HOWTO_BOARD.x - 6, HOWTO_BOARD.y - 6, HOWTO_BOARD.px + 12, HOWTO_BOARD.px + 12);
  // Reuse mesopotamia's generic thread-tile rendering for the neutral demo — its drawTile only
  // needs an edges array, no region-specific meta.
  const demoRegion = REGIONS[0];
  demoRegion.drawTile(ctx, cell0.x, cell0.y, cell0.w, fixed, {});
  if (!state.howtoPlaced) {
    ctx.strokeStyle = `rgba(120,220,255,${0.6 + 0.3 * Math.sin(state.t * 5)})`;
    ctx.lineWidth = 4;
    ctx.strokeRect(cell1.x + 3, cell1.y + 3, cell1.w - 6, cell1.h - 6);
    const edges = transform(state.howtoTile.baseEdges, state.howtoTile.rot, false);
    demoRegion.drawTile(ctx, HOWTO_TRAY_TILE.x, HOWTO_TRAY_TILE.y, HOWTO_TRAY_TILE.w, { edges }, {});
    text(ctx, helpers.HOWTO_TILE_HINT, W / 2, HOWTO_TRAY_TILE.y - 20, 20, 'rgba(245,236,216,0.85)');
    button(ctx, HOWTO_ROTATE_BUTTON, 'Rotate', { primary: true });
  } else {
    const edges = transform(state.howtoTile.baseEdges, state.howtoTile.rot, false);
    demoRegion.drawTile(ctx, cell1.x, cell1.y, cell1.w, { edges }, {});
    text(ctx, state.howtoQuality === 'perfect' ? 'Perfect fit!' : "That's a poor fit — edges matter.",
      W / 2, cell1.y + cell1.h + 60, 26, state.howtoQuality === 'perfect' ? '#8ef0a0' : '#ff9d8a', DISPLAY, 700);
    wrapText(ctx, helpers.HOWTO_SUCCESS, W / 2, cell1.y + cell1.h + 100, 560, 28, 21);
    button(ctx, HOWTO_CONTINUE_BUTTON, 'Continue', { primary: true });
  }
}

// ---------------------------------------------------------------------------------------------
function drawRegionSelect(ctx, state, helpers) {
  button(ctx, BACK_BUTTON, 'Back');
  text(ctx, 'CHOOSE A REGION', W / 2, 170, 38, GOLD, DISPLAY, 800);
  REGIONS.forEach((region, i) => {
    const r = regionCardRect(i);
    panel(ctx, r.x, r.y, r.w, r.h);
    const stats = helpers.getStats(region.id);
    const tier = helpers.tierFor(region, stats);
    text(ctx, region.name, r.x + 30, r.y + 56, 30, CREAM, DISPLAY, 700, 'left');
    text(ctx, region.continent, r.x + 30, r.y + 86, 19, 'rgba(245,236,216,0.7)', UI, 500, 'left');
    wrapText(ctx, region.aboutText, r.x + 30, r.y + 122, r.w - 220, 24, 17, 'rgba(245,236,216,0.85)', UI, 'left');
    text(ctx, tier, r.x + r.w - 30, r.y + 56, 22, GOLD, DISPLAY, 700, 'right');
    const demo = { edges: region.id === 'kolam' ? ['T', 'T', 'B', 'B'] : [0, 1, 2, 1] };
    region.drawTile(ctx, r.x + r.w - 150, r.y + r.h - 130, 110, demo, {});
  });
}

function drawRegionIntro(ctx, state) {
  const region = getRegion(state.currentRegionId);
  panel(ctx, 60, 220, 600, 780);
  text(ctx, region.name, W / 2, 300, 36, GOLD, DISPLAY, 800);
  text(ctx, region.continent, W / 2, 336, 20, 'rgba(245,236,216,0.75)');
  const demo = { edges: region.id === 'kolam' ? ['T', 'T', 'T', 'B'] : [0, 1, 2, 0] };
  region.drawTile(ctx, W / 2 - 70, 380, 140, demo, { rosette: region.id === 'mesopotamia' });
  wrapText(ctx, region.aboutText, W / 2, 580, 500, 30, 21);
  text(ctx, 'THIS REGION’S TWIST', W / 2, 700, 22, GOLD, DISPLAY, 700);
  wrapText(ctx, region.twistText, W / 2, 736, 500, 30, 21, '#f0dca0');
  button(ctx, INTRO_CONTINUE_BUTTON, 'Begin', { primary: true, size: 34 });
}

// Tapping a "not yet woven" Atlas tile opens this — real historical/geographic context per
// civilization (worldMap.js's `about` field), not just a shape (2026-09-25, direct owner request).
// Same honest framing as the tile itself: a general-knowledge overview, clearly marked "not yet
// woven" (not the deep, cited research a region needs before it becomes playable) — see
// worldMap.js's file comment on the `about` field for the full reasoning and its sourcing tier.
function drawTaxonomyInfo(ctx, state) {
  button(ctx, BACK_BUTTON, 'Back');
  const entry = TAXONOMY_REGIONS.find((r) => r.id === state.taxonomyInfoId);
  if (!entry) return;
  panel(ctx, 60, 220, 600, 780);
  text(ctx, entry.name, W / 2, 300, 32, GOLD, DISPLAY, 800);
  drawTaxonomySwatch(ctx, W / 2 - 80, 336, 160, entry);
  // `about` length varies a lot (region to region); position the badge below it by the ACTUAL
  // number of wrapped lines rather than a fixed offset, so a longer entry can never run into it.
  const aboutLines = wrapText(ctx, entry.about, W / 2, 560, 500, 30, 21);
  const badgeY = 560 + aboutLines * 30 + 40;
  text(ctx, 'NOT YET WOVEN', W / 2, badgeY, 19, GOLD, UI, 800);
  wrapText(ctx, "This civilization hasn't been researched into a playable pattern yet — its real "
    + 'construction-rule twist and heritage notes are still ahead.',
    W / 2, badgeY + 34, 480, 26, 16, 'rgba(245,236,216,0.6)');
}

function drawLevelSelect(ctx, state, helpers) {
  const region = getRegion(state.currentRegionId);
  button(ctx, BACK_BUTTON, 'Back');
  text(ctx, region.name.toUpperCase(), W / 2, 170, 34, GOLD, DISPLAY, 800);
  const stats = helpers.getStats(region.id);
  region.levelSizes.forEach((size, i) => {
    const r = levelCardRect(i);
    panel(ctx, r.x, r.y, r.w, r.h);
    const lvl = stats.levels[i];
    text(ctx, `Panel ${i + 1} — ${size} × ${size}`, r.x + 30, r.y + 60, 28, CREAM, DISPLAY, 700, 'left');
    text(ctx, lvl?.perfect ? 'Perfect weave' : lvl?.completed ? 'Completed' : 'Not started',
      r.x + 30, r.y + 96, 19, lvl?.perfect ? '#ffe08a' : lvl?.completed ? '#9adf9e' : 'rgba(245,236,216,0.6)', UI, 600, 'left');
    const demo = { edges: region.id === 'kolam' ? ['B', 'T', 'B', 'T'] : [1, 0, 2, 1] };
    region.drawTile(ctx, r.x + r.w - 130, r.y + r.h / 2 - 55, 100, demo, {});
  });
}

// ---------------------------------------------------------------------------------------------
function drawSpecialLine(ctx, state) {
  const region = getRegion(state.currentRegionId);
  let label = '';
  if (region.id === 'kolam' && state.fragmentInfo) label = state.fragmentInfo.label;
  else if (region.id === 'mesopotamia') {
    const locked = state.level.rosetteCells.filter((i) => state.board[i]?.special?.locked).length;
    label = `Rosettes locked: ${locked} / ${state.level.rosetteCells.length}`;
  } else if (region.id === 'west-africa') label = state.lastSpecialLabel || 'Weave a run of matching color along a row';
  text(ctx, label, W / 2, SPECIAL_LINE_Y, 20, 'rgba(245,236,216,0.85)');
}

function drawPlaying(ctx, state, helpers) {
  const region = getRegion(state.currentRegionId);
  const geo = boardGeo(state.level.size);
  const total = state.level.size * state.level.size;

  text(ctx, `${region.name} — Panel ${state.currentLevelIndex + 1}`, W / 2, 60, 24, GOLD, DISPLAY, 700);
  text(ctx, `Filled ${state.bagPos} / ${total}     Streak ${state.streak}`, W / 2, 96, 20, 'rgba(245,236,216,0.85)');

  ctx.fillStyle = 'rgba(0,0,0,0.28)';
  ctx.fillRect(geo.x - 6, geo.y - 6, geo.px + 12, geo.px + 12);
  ctx.strokeStyle = GOLD; ctx.lineWidth = 2;
  ctx.strokeRect(geo.x - 6, geo.y - 6, geo.px + 12, geo.px + 12);

  const highlightAge = state.t - state.runHighlightT;
  for (let i = 0; i < state.board.length; i++) {
    const row = Math.floor(i / state.level.size), col = i % state.level.size;
    const x = geo.x + col * geo.cell, y = geo.y + row * geo.cell;
    const tile = state.board[i];
    if (!tile) {
      ctx.strokeStyle = 'rgba(224,182,84,0.25)'; ctx.lineWidth = 1;
      ctx.strokeRect(x + 1, y + 1, geo.cell - 2, geo.cell - 2);
      continue;
    }
    const opts = {};
    if (region.id === 'mesopotamia') { opts.rosette = state.level.rosetteCells.includes(i); opts.locked = tile.special?.locked; }
    if (region.id === 'kolam') opts.fragmentBad = false;
    if (region.id === 'west-africa') opts.propagated = highlightAge < 0.8 && state.runHighlight.includes(i);
    region.drawTile(ctx, x, y, geo.cell, tile, opts);
    if (tile.quality === 'poor') {
      ctx.strokeStyle = 'rgba(255,90,90,0.7)'; ctx.lineWidth = 3;
      ctx.strokeRect(x + 3, y + 3, geo.cell - 6, geo.cell - 6);
    } else if (tile.quality === 'perfect') {
      ctx.strokeStyle = 'rgba(150,255,180,0.55)'; ctx.lineWidth = 2;
      ctx.strokeRect(x + 2, y + 2, geo.cell - 4, geo.cell - 4);
    }
  }

  drawSpecialLine(ctx, state);

  // tray: active tile + next-up preview
  const active = helpers.activeTile();
  if (active) {
    ctx.fillStyle = 'rgba(0,0,0,0.25)';
    ctx.fillRect(TRAY_TILE.x - 4, TRAY_TILE.y - 4, TRAY_TILE.w + 8, TRAY_TILE.h + 8);
    region.drawTile(ctx, TRAY_TILE.x, TRAY_TILE.y, TRAY_TILE.w, active, {});
    for (let k = 0; k < 2; k++) {
      const upcoming = state.level.bag[state.bagPos + 1 + k];
      if (!upcoming) continue;
      const r = nextPreviewRect(k);
      const e = transform(upcoming.baseEdges, upcoming.rot, upcoming.flip);
      ctx.globalAlpha = 0.55;
      region.drawTile(ctx, r.x, r.y, r.w, { edges: e }, { dim: true });
      ctx.globalAlpha = 1;
    }
  }
  button(ctx, ROTATE_BUTTON, 'Rotate', { size: 22 });
  button(ctx, FLIP_BUTTON, 'Flip', { size: 22 });
  button(ctx, UNDO_BUTTON, 'Undo', { size: 18, dim: state.history.length === 0 });
  button(ctx, EXIT_BUTTON, 'Exit', { size: 18 });

  if (state.demo) text(ctx, `Free preview: ${state.demoPanels}/${helpers.DEMO_PANEL_LIMIT} panels used`, W / 2, 1220, 17, 'rgba(245,236,216,0.6)');

  if (state.noteToast) {
    panel(ctx, NOTE_TOAST.x, NOTE_TOAST.y, NOTE_TOAST.w, NOTE_TOAST.h, 'rgba(20,10,40,0.97)');
    text(ctx, 'HERITAGE NOTE', W / 2, NOTE_TOAST.y + 70, 22, GOLD, DISPLAY, 700);
    wrapText(ctx, state.noteToast.text, W / 2, NOTE_TOAST.y + 140, NOTE_TOAST.w - 80, 32, 22);
    text(ctx, 'Tap to continue', W / 2, NOTE_TOAST.y + NOTE_TOAST.h - 40, 18, 'rgba(245,236,216,0.6)');
  }
}

// ---------------------------------------------------------------------------------------------
function drawLevelComplete(ctx, state) {
  const region = getRegion(state.currentRegionId);
  const r = state.panelResult ?? { perfectWeave: false, allPerfect: false };
  panel(ctx, COMPLETE_PANEL.x, COMPLETE_PANEL.y, COMPLETE_PANEL.w, COMPLETE_PANEL.h);
  text(ctx, r.perfectWeave ? 'PERFECT WEAVE' : 'PANEL COMPLETE', W / 2, COMPLETE_PANEL.y + 80, 38, GOLD, DISPLAY, 800);
  text(ctx, region.name, W / 2, COMPLETE_PANEL.y + 122, 22, 'rgba(245,236,216,0.85)');
  const demo = { edges: region.id === 'kolam' ? ['T', 'T', 'T', 'T'] : [0, 1, 2, 0] };
  region.drawTile(ctx, W / 2 - 70, COMPLETE_PANEL.y + 150, 140, demo, { rosette: region.id === 'mesopotamia', locked: true });
  let y = COMPLETE_PANEL.y + 340;
  y += wrapText(ctx, r.perfectWeave
    ? 'Every tile met, and this region’s own twist held true across the whole panel.'
    : 'Panel filled. Chase a perfect weave next time for a deeper heritage note.', W / 2, y, 500, 28, 20) * 28 + 20;
  if (r.deepRevealed) {
    text(ctx, 'NEW: DEEPER NOTE UNLOCKED', W / 2, y, 18, '#ffe08a', DISPLAY, 700);
    y += 34;
    wrapText(ctx, region.deepNote, W / 2, y, 500, 26, 18, '#f0dca0');
  }
  button(ctx, COMPLETE_NEXT_BUTTON, 'Next Panel', { primary: true, size: 30 });
  button(ctx, COMPLETE_ATLAS_BUTTON, 'View Atlas', { size: 24 });
}

// ---------------------------------------------------------------------------------------------
// The World Atlas: a gallery of the pattern library itself. 2026-09-24, second pass — the owner
// reviewed a first attempt at a literal stylized world map (continent silhouettes with a dot per
// region) and rejected it directly: it didn't read as a map, and worse, it hid the real pattern
// art behind small progress-gated circles instead of showing it. Fixed here on both counts: this
// is a card gallery again (same card geometry as region-select), and the actual woven pattern is
// ALWAYS drawn at full size and detail for every built region, at every mastery tier — mastery
// changes the frame around the pattern, never whether the pattern itself is visible.
//
// The swatch is a real, complete, always-valid sample panel built with the exact same generator
// every real playthrough uses (`buildPanel`, seeded so it's identical every time this screen
// renders — a genuine "solved weave", not a mockup), then drawn cell by cell with the region's own
// `drawTile()` — the same rendering code that draws every real tile in play, so the gallery is
// never out of sync with what the game actually looks like.
const swatchCache = new Map();
function getSwatch(region) {
  if (!swatchCache.has(region.id)) {
    const rng = createRng(`atlas-swatch-${region.id}`);
    const levelIndex = region.levelSizes.length - 1; // the larger, more detailed level
    swatchCache.set(region.id, buildPanel(region, rng, levelIndex));
  }
  return swatchCache.get(region.id);
}

function drawSwatch(ctx, x, y, size, region, tier) {
  const panel = getSwatch(region);
  const n = panel.size;
  const cell = size / n;
  const rosetteCells = panel.rosetteCells ?? [];
  ctx.save();
  ctx.beginPath(); ctx.rect(x, y, size, size); ctx.clip();
  if (tier === 'Novice') ctx.globalAlpha = 0.68; // shown in full, just quieter until it's earned
  for (let i = 0; i < panel.cells.length; i++) {
    const row = Math.floor(i / n), col = i % n;
    const opts = {};
    if (rosetteCells.includes(i)) { opts.rosette = true; opts.locked = true; }
    if (region.id === 'west-africa' && row === n - 1 && col > 0) opts.propagated = true;
    region.drawTile(ctx, x + col * cell, y + row * cell, cell, { edges: panel.cells[i] }, opts);
  }
  ctx.restore();
  ctx.save();
  if (tier === 'Master Weaver') {
    ctx.shadowColor = 'rgba(224,182,84,0.85)'; ctx.shadowBlur = 24;
    ctx.strokeStyle = GOLD; ctx.lineWidth = 4;
    ctx.strokeRect(x + 2, y + 2, size - 4, size - 4);
    ctx.shadowBlur = 0; ctx.lineWidth = 2; ctx.strokeStyle = 'rgba(255,246,216,0.7)';
    ctx.strokeRect(x + 8, y + 8, size - 16, size - 16);
  } else if (tier === 'Skilled') {
    ctx.strokeStyle = 'rgba(224,182,84,0.8)'; ctx.lineWidth = 3;
    ctx.strokeRect(x + 1.5, y + 1.5, size - 3, size - 3);
  } else {
    ctx.strokeStyle = 'rgba(224,182,84,0.4)'; ctx.lineWidth = 2;
    ctx.strokeRect(x + 1, y + 1, size - 2, size - 2);
  }
  ctx.restore();
}

// ---------------------------------------------------------------------------------------------
// The other 38, given real shape (2026-09-25 pass, per the owner's direct request that the Atlas
// "represent all world heritage and human civilizations", not just the 3 built ones behind a single
// footer line). Two corrections made the same day, both from direct owner review — see
// layout.js's file header for why there's no continent grouping/header here any more:
// (1) grouping and tinting these by "continent" put a modern-geopolitical-map frame over content
//     whose whole point (docs/WORLD-WEAVE-TAXONOMY.md) is to be organized by civilizational
//     lineage, never modern borders — dropped entirely, see layout.js.
// (2) the first version's swatches all looked like the same shape recolored ("these look fake") —
//     a 3x3 grid with only 2 mirrored quarter-arc states just doesn't have enough visual entropy to
//     read as distinct at a glance, however different the seeds actually were underneath. Fixed by
//     giving each region its own grid density (3-5), 4 real motif choices per cell (two arc
//     directions, a cross, and blank — for real negative space) and its own line weight, all seeded
//     from the region's id — plus a colour drawn from a broad id-hashed palette instead of a
//     continent bucket, so neighbouring cards never band into the same hue by geography.
// Still, deliberately, a GENERIC motif — the same quarter-circle "weave" idea the real edge-matching
// engine is built from, so it's honestly on-theme — never dressed up as a specific real cultural
// pattern: no research has been done for these regions yet, and claiming otherwise would break the
// neutrality guardrail in docs/WORLD-WEAVE-GAMEPLAY.md §5. A dashed border and a plain "Not yet
// woven" tag keep this honest at a glance, never mistakable for a real weave.
const HERITAGE_PALETTE = ['#e0b654', '#d97a52', '#c0587a', '#7a93e0', '#4fbfa0', '#c9a15a',
  '#8a6fd6', '#5cc47e', '#e0955c', '#4fa8c6', '#b06fc0', '#9fc96a', '#e0637a', '#6fa0d6'];
const SWATCH_MOTIFS = ['arcA', 'arcB', 'cross', 'blank'];

function drawTaxonomySwatch(ctx, x, y, size, entry) {
  const rng = createRng(`atlas-shape-${entry.id}`);
  const color = HERITAGE_PALETTE[rng.int(HERITAGE_PALETTE.length)];
  const n = 3 + rng.int(3); // 3x3, 4x4 or 5x5 — its own density, not just its own colour
  const cell = size / n;
  ctx.save();
  ctx.fillStyle = 'rgba(20,12,36,0.92)';
  ctx.beginPath(); ctx.roundRect(x, y, size, size, 14); ctx.fill();
  ctx.save();
  ctx.beginPath(); ctx.roundRect(x, y, size, size, 14); ctx.clip();
  ctx.globalAlpha = 0.12; ctx.fillStyle = color; ctx.fillRect(x, y, size, size);
  ctx.globalAlpha = 0.88;
  ctx.strokeStyle = color;
  ctx.lineWidth = Math.max(1.5, cell * (0.08 + rng.next() * 0.06));
  ctx.lineCap = 'round';
  for (let row = 0; row < n; row++) {
    for (let col = 0; col < n; col++) {
      const cx = x + col * cell, cy = y + row * cell;
      const motif = SWATCH_MOTIFS[rng.int(SWATCH_MOTIFS.length)];
      if (motif === 'blank') continue;
      ctx.beginPath();
      if (motif === 'arcA') {
        ctx.arc(cx, cy, cell / 2, 0, Math.PI / 2);
        ctx.moveTo(cx + cell, cy + cell);
        ctx.arc(cx + cell, cy + cell, cell / 2, Math.PI, Math.PI * 1.5);
      } else if (motif === 'arcB') {
        ctx.arc(cx + cell, cy, cell / 2, Math.PI / 2, Math.PI);
        ctx.moveTo(cx, cy + cell);
        ctx.arc(cx, cy + cell, cell / 2, Math.PI * 1.5, Math.PI * 2);
      } else { // cross
        ctx.moveTo(cx + cell / 2, cy + cell * 0.15);
        ctx.lineTo(cx + cell / 2, cy + cell * 0.85);
        ctx.moveTo(cx + cell * 0.15, cy + cell / 2);
        ctx.lineTo(cx + cell * 0.85, cy + cell / 2);
      }
      ctx.stroke();
    }
  }
  ctx.restore();
  ctx.strokeStyle = 'rgba(224,182,84,0.45)'; ctx.lineWidth = 2;
  ctx.setLineDash([7, 6]);
  ctx.beginPath(); ctx.roundRect(x + 1, y + 1, size - 2, size - 2, 14); ctx.stroke();
  ctx.setLineDash([]);
  ctx.restore();
}

function drawTaxonomyTile(ctx, tile) {
  const { entry, x, y } = tile;
  drawTaxonomySwatch(ctx, x, y, ATLAS_TILE.w, entry);
  const labelY = y + ATLAS_TILE.h + 21;
  wrapText(ctx, entry.name, x + ATLAS_TILE.w / 2, labelY, ATLAS_TILE.w, 16, 13, 'rgba(245,236,216,0.85)', UI, 'center');
  text(ctx, 'Not yet woven', x + ATLAS_TILE.w / 2, y + ATLAS_TILE.h + ATLAS_TILE_LABEL_H - 4, 11, 'rgba(224,182,84,0.65)', UI, 600, 'center');
}

function drawAtlas(ctx, state, helpers) {
  button(ctx, BACK_BUTTON, 'Back');
  text(ctx, 'WORLD ATLAS', W / 2, 170, 38, GOLD, DISPLAY, 800);
  wrapText(ctx, 'Your pattern library. Every weave is always shown in full — mastery brightens its '
    + 'frame, never hides what it looks like.', W / 2, 206, 620, 21, 15, 'rgba(245,236,216,0.7)');

  const scroll = state.atlasScroll ?? 0;
  ctx.save();
  ctx.beginPath(); ctx.rect(0, ATLAS_SCROLL_TOP, W, H - ATLAS_SCROLL_TOP); ctx.clip();
  ctx.translate(0, -scroll);

  REGIONS.forEach((region, i) => {
    const r = regionCardRect(i);
    panel(ctx, r.x, r.y, r.w, r.h);
    const stats = helpers.getStats(region.id);
    const tier = helpers.tierFor(region, stats);
    const swatch = r.h - ATLAS_SWATCH_MARGIN * 2;
    drawSwatch(ctx, r.x + r.w - swatch - ATLAS_SWATCH_MARGIN, r.y + ATLAS_SWATCH_MARGIN, swatch, region, tier);

    text(ctx, region.name, r.x + 34, r.y + 56, 26, CREAM, DISPLAY, 800, 'left');
    text(ctx, tier, r.x + 34, r.y + 87, 17,
      tier === 'Master Weaver' ? '#ffe08a' : tier === 'Skilled' ? '#9adf9e' : 'rgba(245,236,216,0.6)', UI, 700, 'left');
    const lines = [
      `Panels completed: ${stats.panelsCompleted}`,
      `Perfect weaves: ${stats.perfectWeaves}`,
      `Heritage notes read: ${stats.notesOpened} / ${region.notes.length}`,
    ];
    lines.forEach((line, li) => text(ctx, line, r.x + 34, r.y + 130 + li * 27, 16, 'rgba(245,236,216,0.85)', UI, 500, 'left'));
  });

  if (ATLAS_TAXONOMY.tiles.length) {
    const lastCard = regionCardRect(REGIONS.length - 1);
    wrapText(ctx, 'Every other civilization in the taxonomy, given its own shape below — not yet '
      + 'researched or playable. Woven in for real, one region at a time.',
      50, lastCard.y + lastCard.h + 34, 620, 24, 16, 'rgba(245,236,216,0.55)', UI, 'left');
  }

  ATLAS_TAXONOMY.tiles.forEach((tile) => drawTaxonomyTile(ctx, tile));

  ctx.restore();
}

function drawDemoLimit(ctx) {
  text(ctx, 'FREE PREVIEW FINISHED', W / 2, H / 2 - 40, 34, GOLD, DISPLAY, 800);
  wrapText(ctx, 'You’ve played the free preview panels. Get World Weave on iPhone and Android to keep weaving every region.', W / 2, H / 2 + 20, 520, 32, 22);
}

// A short fade + rise on every scene change (2026-09-25, per direct owner feedback that
// navigating between screens felt abrupt) — `state.sceneT` (game.js) already reset to 0 on every
// `state.scene` change but was never actually read anywhere until now. Purely a render-time
// transform: it settles to a no-op (alpha 1, zero offset) in 160ms, well under a normal
// tap-to-tap interval, so it never touches hit-testing (game.js compares taps against the fixed
// layout rects directly, untouched by this transform) or any scene's own internal animation
// (e.g. the Atlas's scroll, which only moves on a drag, not on `sceneT`).
const SCENE_FADE_IN = 0.16; // seconds
const easeOutCubic = (t) => 1 - (1 - t) ** 3;

export function render(ctx, state, manifest, helpers) {
  backdrop(ctx);
  const t = easeOutCubic(Math.min(1, state.sceneT / SCENE_FADE_IN));
  ctx.save();
  ctx.globalAlpha = t;
  ctx.translate(0, (1 - t) * 14);
  if (state.scene === 'title') drawTitle(ctx, state, manifest);
  else if (state.scene === 'howto') drawHowto(ctx, state, helpers);
  else if (state.scene === 'regionSelect') drawRegionSelect(ctx, state, helpers);
  else if (state.scene === 'regionIntro') drawRegionIntro(ctx, state);
  else if (state.scene === 'levelSelect') drawLevelSelect(ctx, state, helpers);
  else if (state.scene === 'playing') drawPlaying(ctx, state, helpers);
  else if (state.scene === 'levelComplete') drawLevelComplete(ctx, state);
  else if (state.scene === 'atlas') drawAtlas(ctx, state, helpers);
  else if (state.scene === 'taxonomyInfo') drawTaxonomyInfo(ctx, state);
  else if (state.scene === 'demo-limit') drawDemoLimit(ctx);
  ctx.restore();
}
