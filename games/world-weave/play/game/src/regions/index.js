// The 3 Tier-1 regions built in this prototype slice, spanning 3 different continents on purpose
// (docs/WORLD-WEAVE-TAXONOMY.md, docs/WORLD-WEAVE-CONCEPT.md §5c): Middle East/West Asia, South
// Asia and Africa. See design/RESEARCH-NOTES.md for the sourcing behind each one, and each region
// module's own header comment for its single construction-rule twist and why it fits that region.
// Every remaining taxonomy region (~30 more) is deferred — see STATUS.md "Next steps".
import * as mesopotamia from './mesopotamia.js';
import * as kolam from './kolam.js';
import * as westAfrica from './westAfrica.js';

export const REGIONS = [mesopotamia, kolam, westAfrica];

export function getRegion(id) {
  return REGIONS.find((r) => r.id === id);
}
