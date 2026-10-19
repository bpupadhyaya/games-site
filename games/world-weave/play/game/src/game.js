// GAME CONTRACT (docs/GAME-CONTRACT.md): meta + createGame(env) -> { update, render, getState }.
// World Weave — solo weave-fit placement puzzle. See design/GDD.md for the full design and
// design/RESEARCH-NOTES.md for how each region's construction-rule twist was sourced. This
// prototype slice implements Solo puzzle mode only, across 3 regions (docs/WORLD-WEAVE-CONCEPT.md
// §6): daily challenge, local multiplayer and the Timeline view are deferred (see STATUS.md).
import { SCREEN, inRect, BACK_BUTTON, regionCardRect, levelCardRect, hitTestCell,
  ROTATE_BUTTON, FLIP_BUTTON, UNDO_BUTTON, EXIT_BUTTON,
  COMPLETE_NEXT_BUTTON, COMPLETE_ATLAS_BUTTON, TITLE_PLAY_BUTTON, TITLE_ATLAS_BUTTON,
  TITLE_HOWTO_BUTTON, HOWTO_CONTINUE_BUTTON, howtoCellRect, HOWTO_ROTATE_BUTTON,
  INTRO_CONTINUE_BUTTON, ATLAS_TILE } from './layout.js';
import { transform } from './grid.js';
import { REGIONS, getRegion } from './regions/index.js';
import { buildLevel } from './generator.js';
import { evaluatePlacement, evaluatePanel } from './rules.js';
import { defaultRegionStats, tierFor, nextNote } from './atlas.js';
import { DEMO_PANEL_LIMIT, HOWTO_STEPS, HOWTO_TILE_HINT, HOWTO_SUCCESS } from './content.js';
import { render, ATLAS_MAX_SCROLL, ATLAS_TAXONOMY } from './view.js';

export const meta = { width: SCREEN.width, height: SCREEN.height };
export { REGIONS };

export function createGame(env) {
  const { rng, storage, monetization, audio, config } = env;

  const state = {
    scene: 'title',
    t: 0,
    sceneT: 0,
    ptr: { x: 0, y: 0, down: false },

    seenHowTo: false,
    introSeen: {},
    atlas: {},
    atlasScroll: 0,
    atlasDragY: null,
    atlasDragTotal: 0,
    taxonomyInfoId: null,

    // onboarding practice grid (howto)
    howtoStep: 0,
    howtoTile: null,
    howtoPlaced: false,
    howtoQuality: null,

    // navigation
    currentRegionId: null,
    currentLevelIndex: 0,

    // active run
    level: null,
    board: [],
    bagPos: 0,
    activeRot: 0,
    activeFlip: false,
    history: [],
    streak: 0,
    bestStreak: 0,
    milestonesShown: {},
    noteToast: null,
    lastSpecialLabel: '',
    fragmentInfo: null,
    runHighlight: [],
    runHighlightT: -9,
    panelResult: null, // set once a panel finishes: { allPerfect, specialsOk, perfectWeave, deepRevealed }

    demo: Boolean(config?.demo),
    demoPanels: 0,
    demoLimitReached: false,
  };

  storage.get('seenHowTo', false).then((v) => { state.seenHowTo = Boolean(v); });
  storage.get('introSeen', {}).then((v) => { state.introSeen = v || {}; });
  storage.get('atlas', {}).then((v) => { state.atlas = v || {}; });
  if (state.demo) {
    storage.get('demoPanels', 0).then((v) => {
      state.demoPanels = v || 0;
      if (state.demoPanels >= DEMO_PANEL_LIMIT) state.demoLimitReached = true;
    });
  }

  // ------------------------------------------------------------------------------------- Atlas
  const getStats = (regionId) => state.atlas[regionId] ?? defaultRegionStats();
  const saveStats = (regionId, stats) => {
    state.atlas = { ...state.atlas, [regionId]: stats };
    storage.set('atlas', state.atlas);
  };
  const revealNote = (regionId, region) => {
    const stats = { ...getStats(regionId) };
    const text = nextNote(region, stats);
    stats.notesOpened += 1;
    saveStats(regionId, stats);
    state.noteToast = { text, kind: 'note' };
    audio.tone({ freq: 587, dur: 0.09 });
    audio.tone({ freq: 784, dur: 0.13 });
  };

  // ------------------------------------------------------------------------------------- Howto
  const startHowTo = () => {
    state.scene = 'howto';
    state.howtoStep = 0;
    state.howtoPlaced = false;
    state.howtoQuality = null;
    // A tile that starts mismatched on purpose, so rotating it is a real, felt decision.
    state.howtoTile = { baseEdges: [0, 1, 0, 1], rot: 0, flip: false };
  };
  const finishHowTo = () => {
    state.seenHowTo = true;
    storage.set('seenHowTo', true);
    state.scene = 'regionSelect';
  };

  // ------------------------------------------------------------------------------------- Levels
  const startLevel = (regionId, levelIndex) => {
    if (state.demo && state.demoLimitReached) { state.scene = 'demo-limit'; return; }
    const region = getRegion(regionId);
    const level = buildLevel(region, rng.fork(), levelIndex);
    state.currentRegionId = regionId;
    state.currentLevelIndex = levelIndex;
    state.level = level;
    state.board = new Array(level.size * level.size).fill(null);
    state.bagPos = 0;
    state.activeRot = level.bag[0].rot;
    state.activeFlip = level.bag[0].flip;
    state.history = [];
    state.streak = 0;
    state.milestonesShown = {};
    state.noteToast = null;
    state.lastSpecialLabel = '';
    state.fragmentInfo = null;
    state.runHighlight = [];
    state.panelResult = null;
    state.scene = 'playing';
  };

  const activeTile = () => {
    const entry = state.level?.bag[state.bagPos];
    if (!entry) return null;
    return { baseEdges: entry.baseEdges, edges: transform(entry.baseEdges, state.activeRot, state.activeFlip) };
  };

  const finishPanel = () => {
    const region = getRegion(state.currentRegionId);
    const result = evaluatePanel(region, state.level, state.board);
    const prior = getStats(region.id);
    const stats = { ...prior, levels: { ...prior.levels } };
    stats.panelsCompleted += 1;
    stats.levels[state.currentLevelIndex] = { completed: true, perfect: result.perfectWeave };
    let deepRevealed = false;
    if (result.perfectWeave) {
      stats.perfectWeaves += 1;
      if (!stats.deepNoteRevealed) { stats.deepNoteRevealed = true; deepRevealed = true; }
    }
    saveStats(region.id, stats);
    state.panelResult = { ...result, deepRevealed };
    monetization.track('panel_complete', { region: region.id, level: state.currentLevelIndex, perfectWeave: result.perfectWeave });
    audio.tone({ freq: 523, dur: 0.1 });
    audio.tone({ freq: 659, dur: 0.1 });
    audio.tone({ freq: 784, dur: 0.16 });
    if (state.demo) {
      state.demoPanels += 1;
      storage.set('demoPanels', state.demoPanels);
      if (state.demoPanels >= DEMO_PANEL_LIMIT) state.demoLimitReached = true;
    }
    state.scene = 'levelComplete';
  };

  const checkMilestones = (region) => {
    const total = state.level.size * state.level.size;
    const pct = Math.floor((state.bagPos / total) * 100);
    for (const threshold of [25, 50, 75]) {
      if (pct >= threshold && !state.milestonesShown[threshold]) {
        state.milestonesShown[threshold] = true;
        revealNote(region.id, region);
        return; // one toast at a time
      }
    }
  };

  const placeActiveTile = (cellIndex) => {
    const region = getRegion(state.currentRegionId);
    const tile = activeTile();
    const result = evaluatePlacement(region, state.level, state.board, cellIndex, tile.edges);
    state.board[cellIndex] = { edges: tile.edges, special: result.special, quality: result.quality };
    state.history.push({ cellIndex, rotUsed: state.activeRot, flipUsed: state.activeFlip });
    state.streak = result.quality === 'poor' ? 0 : state.streak + 1;
    state.bestStreak = Math.max(state.bestStreak, state.streak);
    audio.tone(result.quality === 'perfect' ? { freq: 660, dur: 0.08 }
      : result.quality === 'good' ? { freq: 480, dur: 0.07 }
        : { freq: 220, dur: 0.09, type: 'square' });

    if (result.special) {
      if (result.special.kind === 'rosette' && result.special.locked) revealNote(region.id, region);
      else if (result.special.kind === 'thread') state.fragmentInfo = result.special;
      else if (result.special.kind === 'strip') {
        state.runHighlight = result.special.propagated ? result.special.runCells : [];
        state.runHighlightT = state.t;
      }
      state.lastSpecialLabel = result.special.label;
    }

    state.bagPos += 1;
    const total = state.level.size * state.level.size;
    if (state.bagPos < total) {
      const nextEntry = state.level.bag[state.bagPos];
      state.activeRot = nextEntry.rot;
      state.activeFlip = nextEntry.flip;
      checkMilestones(region);
    } else {
      finishPanel();
    }
  };

  const undo = () => {
    if (state.history.length === 0) return;
    const top = state.history[state.history.length - 1];
    const placed = state.board[top.cellIndex];
    if (placed?.special?.locked) return; // a locked rosette can never be undone
    state.history.pop();
    state.board[top.cellIndex] = null;
    state.bagPos -= 1;
    state.activeRot = top.rotUsed;
    state.activeFlip = top.flipUsed;
    state.streak = 0;
  };

  // Entering the Atlas always starts scrolled to the top (a stale scroll position from a previous
  // visit would otherwise strand the player mid-list on an empty-looking screen).
  const enterAtlas = () => { state.scene = 'atlas'; state.atlasScroll = 0; };

  // -------------------------------------------------------------------------------- Tap routing
  function handleTitle(x, y) {
    if (state.demo && state.demoLimitReached) { state.scene = 'demo-limit'; return; }
    if (inRect(x, y, TITLE_PLAY_BUTTON)) { if (state.seenHowTo) state.scene = 'regionSelect'; else startHowTo(); }
    else if (inRect(x, y, TITLE_ATLAS_BUTTON)) enterAtlas();
    else if (inRect(x, y, TITLE_HOWTO_BUTTON)) startHowTo();
  }

  function handleHowto(x, y) {
    if (state.howtoStep < 2) {
      if (inRect(x, y, HOWTO_CONTINUE_BUTTON)) state.howtoStep += 1;
      return;
    }
    if (!state.howtoPlaced) {
      if (inRect(x, y, HOWTO_ROTATE_BUTTON)) { state.howtoTile.rot = (state.howtoTile.rot + 1) % 4; return; }
      if (inRect(x, y, howtoCellRect(1))) {
        const edges = transform(state.howtoTile.baseEdges, state.howtoTile.rot, false);
        const fixedNeighborEdges = [1, 0, 1, 0]; // the pre-placed demo tile at cell 0
        state.howtoQuality = edges[3] === fixedNeighborEdges[1] ? 'perfect' : 'poor'; // tile's W vs neighbour's E
        state.howtoPlaced = true;
        audio.tone(state.howtoQuality === 'perfect' ? { freq: 660, dur: 0.08 } : { freq: 220, dur: 0.09, type: 'square' });
      }
      return;
    }
    if (inRect(x, y, HOWTO_CONTINUE_BUTTON)) finishHowTo();
  }

  // Shared by the region-select cards and the Atlas map's built patches — both enter a region the
  // same way: straight to its ABOUT/twist intro the first time, or straight to level select after.
  const enterRegion = (regionId) => {
    state.currentRegionId = regionId;
    state.scene = state.introSeen[regionId] ? 'levelSelect' : 'regionIntro';
  };

  function handleRegionSelect(x, y) {
    if (inRect(x, y, BACK_BUTTON)) { state.scene = 'title'; return; }
    for (let i = 0; i < REGIONS.length; i++) {
      if (inRect(x, y, regionCardRect(i))) { enterRegion(REGIONS[i].id); return; }
    }
  }

  function handleRegionIntro(x, y) {
    if (inRect(x, y, INTRO_CONTINUE_BUTTON)) {
      state.introSeen = { ...state.introSeen, [state.currentRegionId]: true };
      storage.set('introSeen', state.introSeen);
      state.scene = 'levelSelect';
    }
  }

  function handleLevelSelect(x, y) {
    if (inRect(x, y, BACK_BUTTON)) { state.scene = 'regionSelect'; return; }
    const region = getRegion(state.currentRegionId);
    for (let i = 0; i < region.levelSizes.length; i++) {
      if (inRect(x, y, levelCardRect(i))) { startLevel(region.id, i); return; }
    }
  }

  function handlePlaying(x, y) {
    if (state.noteToast) { state.noteToast = null; return; }
    if (inRect(x, y, ROTATE_BUTTON)) { state.activeRot = (state.activeRot + 1) % 4; audio.tone({ freq: 340, dur: 0.04 }); return; }
    if (inRect(x, y, FLIP_BUTTON)) { state.activeFlip = !state.activeFlip; audio.tone({ freq: 300, dur: 0.04 }); return; }
    if (inRect(x, y, UNDO_BUTTON)) { undo(); return; }
    if (inRect(x, y, EXIT_BUTTON)) { state.scene = 'levelSelect'; return; }
    const index = hitTestCell(x, y, state.level.size);
    if (index >= 0 && !state.board[index]) placeActiveTile(index);
  }

  function handleLevelComplete(x, y) {
    if (state.demo && state.demoLimitReached) { state.scene = 'demo-limit'; return; }
    if (inRect(x, y, COMPLETE_NEXT_BUTTON)) {
      const region = getRegion(state.currentRegionId);
      const nextIndex = state.currentLevelIndex + 1;
      if (nextIndex < region.levelSizes.length) startLevel(region.id, nextIndex);
      else state.scene = 'regionSelect';
    } else if (inRect(x, y, COMPLETE_ATLAS_BUTTON)) enterAtlas();
  }

  // The Atlas (view.js): the same 3 built-region cards as region-select, entered the same way, now
  // inside a scrollable view (see update()'s drag handling below) — card rects are content-space,
  // so hit-testing adds the current scroll back on before comparing against them. The taxonomy
  // tiles below the built cards are informational only, not tappable (nothing to enter yet).
  function handleAtlas(x, y) {
    if (inRect(x, y, BACK_BUTTON)) { state.scene = 'title'; return; }
    const contentY = y + state.atlasScroll;
    for (let i = 0; i < REGIONS.length; i++) {
      if (inRect(x, contentY, regionCardRect(i))) { enterRegion(REGIONS[i].id); return; }
    }
    // The "not yet woven" taxonomy tiles are tappable too (2026-09-25): each opens its own real
    // historical/geographic overview (view.js's drawTaxonomyInfo) instead of just a shape.
    for (const tile of ATLAS_TAXONOMY.tiles) {
      if (inRect(x, contentY, { x: tile.x, y: tile.y, w: ATLAS_TILE.w, h: ATLAS_TILE.h })) {
        state.taxonomyInfoId = tile.entry.id;
        state.scene = 'taxonomyInfo';
        return;
      }
    }
  }

  // Back returns to the Atlas exactly where the player left it (no scroll reset, unlike entering
  // fresh from the title screen) — opening an info card should never lose your place in the list.
  function handleTaxonomyInfo(x, y) {
    if (inRect(x, y, BACK_BUTTON)) state.scene = 'atlas';
  }

  function step(x, y) {
    if (state.scene === 'title') handleTitle(x, y);
    else if (state.scene === 'howto') handleHowto(x, y);
    else if (state.scene === 'regionSelect') handleRegionSelect(x, y);
    else if (state.scene === 'regionIntro') handleRegionIntro(x, y);
    else if (state.scene === 'levelSelect') handleLevelSelect(x, y);
    else if (state.scene === 'playing') handlePlaying(x, y);
    else if (state.scene === 'levelComplete') handleLevelComplete(x, y);
    else if (state.scene === 'atlas') handleAtlas(x, y);
    else if (state.scene === 'taxonomyInfo') handleTaxonomyInfo(x, y);
    // 'demo-limit': deliberately a no-op — the web preview stays capped (docs/GAME-CONTRACT.md).
  }

  return {
    update(dt, input) {
      const before = state.scene;
      state.t += dt;
      state.sceneT += dt;
      state.ptr = { x: input.pointer.x, y: input.pointer.y, down: Boolean(input.pointer.down) };
      // The Atlas scrolls by drag instead of tapping straight through on press (every other scene's
      // convention): a tap only fires on release, and only if the finger barely moved, so a scroll
      // gesture never also opens the region under wherever the drag happened to start.
      if (state.scene === 'atlas') {
        if (input.pointer.down) {
          if (state.atlasDragY == null) { state.atlasDragY = input.pointer.y; state.atlasDragTotal = 0; }
          else {
            const dy = input.pointer.y - state.atlasDragY;
            state.atlasScroll = Math.max(0, Math.min(ATLAS_MAX_SCROLL, state.atlasScroll - dy));
            state.atlasDragTotal += Math.abs(dy);
            state.atlasDragY = input.pointer.y;
          }
        }
        if (input.pointer.released) {
          // Guard against the OTHER scene's own leftover release: entering the Atlas happens on a
          // press (title's "World Atlas" button, or level-complete's "View Atlas"), so the matching
          // release fires one tick later, already inside this branch, at that press's stale
          // coordinates — with no down ever observed here (atlasDragY still null), that release must
          // never tap-through to whatever Atlas card happens to sit under those old coordinates.
          if (state.atlasDragY != null && state.atlasDragTotal < 12) step(input.pointer.x, input.pointer.y);
          state.atlasDragY = null;
          state.atlasDragTotal = 0;
        }
      } else if (input.pointer.pressed) step(input.pointer.x, input.pointer.y);
      if (state.scene !== before) state.sceneT = 0;
    },
    render(ctx) {
      render(ctx, state, env.manifest, { activeTile, tierFor, getStats, HOWTO_STEPS, HOWTO_TILE_HINT, HOWTO_SUCCESS, DEMO_PANEL_LIMIT });
    },
    // Must be JSON-serializable and fully describe the run (used for determinism checks).
    getState: () => state,
  };
}
