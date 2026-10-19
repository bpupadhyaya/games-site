// The World Atlas: mastery *is* the scoreboard (docs/WORLD-WEAVE-GAMEPLAY.md §4), simplified for
// this prototype slice to just the 3 regions built so far. A tier needs BOTH a gameplay bar
// (panels completed, a perfect weave) AND an engagement bar (heritage notes actually opened) —
// skill alone can't skip the learning, and reading alone can't skip the craft. Tier names,
// thresholds and the completion math are identical in kind for every region (docs/WORLD-WEAVE-
// GAMEPLAY.md §5): any difference in how hard a region's panels are comes only from its own
// construction-rule twist, never from a different mastery bar.
export const TIERS = ['Novice', 'Skilled', 'Master Weaver'];

export function defaultRegionStats() {
  return {
    panelsCompleted: 0,
    perfectWeaves: 0,
    notesOpened: 0,
    deepNoteRevealed: false,
    levels: {}, // levelIndex -> { completed, perfect }
  };
}

export function tierFor(region, stats) {
  const totalLevels = region.levelSizes.length;
  const totalNotes = region.notes.length;
  const levelsDone = Object.values(stats.levels).filter((l) => l.completed).length;
  if (levelsDone >= totalLevels && stats.perfectWeaves >= 1 && stats.notesOpened >= totalNotes) return 'Master Weaver';
  if (stats.panelsCompleted >= 1 && stats.notesOpened >= 1) return 'Skilled';
  return 'Novice';
}

// The next not-yet-opened note for a region, cycling once every note has been seen (a completed
// region keeps resurfacing its facts as the spaced-repetition-lite "did you know" beat, §4).
export function nextNote(region, stats) {
  const idx = stats.notesOpened % region.notes.length;
  return region.notes[idx];
}
