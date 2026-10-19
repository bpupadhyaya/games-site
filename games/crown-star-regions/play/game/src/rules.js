// Pure rule helpers shared by the game and its tests: reading crowns off the mark grid,
// finding rule violations, and deciding whether a board is solved. No state, no side effects.

export function crownsFromCells(size, cells) {
  const crowns = [];
  for (let index = 0; index < cells.length; index++) {
    if (cells[index] === 'crown') {
      crowns.push({ row: Math.floor(index / size), col: index % size, index });
    }
  }
  return crowns;
}

// Returns the set of cell indices holding a crown that breaks a rule: sharing a row, column or
// region with another crown, or touching another crown (including diagonally).
export function computeConflicts(regions, crowns) {
  const conflicts = new Set();
  const byRow = new Map();
  const byCol = new Map();
  const byRegion = new Map();

  for (const crown of crowns) {
    if (!byRow.has(crown.row)) byRow.set(crown.row, []);
    byRow.get(crown.row).push(crown);
    if (!byCol.has(crown.col)) byCol.set(crown.col, []);
    byCol.get(crown.col).push(crown);
    const regionId = regions[crown.index];
    if (!byRegion.has(regionId)) byRegion.set(regionId, []);
    byRegion.get(regionId).push(crown);
  }

  const flagIfDuplicate = (groups) => {
    for (const group of groups.values()) {
      if (group.length > 1) for (const crown of group) conflicts.add(crown.index);
    }
  };
  flagIfDuplicate(byRow);
  flagIfDuplicate(byCol);
  flagIfDuplicate(byRegion);

  for (let i = 0; i < crowns.length; i++) {
    for (let j = i + 1; j < crowns.length; j++) {
      const a = crowns[i];
      const b = crowns[j];
      if (Math.abs(a.row - b.row) <= 1 && Math.abs(a.col - b.col) <= 1) {
        conflicts.add(a.index);
        conflicts.add(b.index);
      }
    }
  }
  return conflicts;
}

// Solved: exactly one crown per row/column/region (implied by `size` crowns with zero conflicts,
// since any duplicate would already show up as a conflict) and no touching pairs.
export function isSolved(size, crowns, conflicts) {
  return crowns.length === size && conflicts.size === 0;
}
