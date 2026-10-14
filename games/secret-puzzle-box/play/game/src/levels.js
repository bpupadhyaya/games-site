// The level ladder: thirty boxes in five stages. The data (panels, catches, goal, par) is built offline by design/gen-levels.mjs and
// stored in leveldata.js; every par is the exact shortest way open, found by searching the whole state graph.
import { LEVEL_DATA } from './leveldata.js';

export const LEVELS = LEVEL_DATA.map((d) => ({ ...d, n: d.k.length, faces: Math.max(...d.f) + 1 }));
export const TIER_NAMES = ['Pocket boxes', 'Trick boxes', 'Master boxes', 'Grand boxes', 'Hundred-step boxes'];
export const tierOf = (n) => Math.min(TIER_NAMES.length - 1, Math.floor(n / 6));
export const FACE_NAMES = ['Lid', 'Front', 'Back'];
export const KEEPSAKES = ['coin', 'key', 'gem', 'crane', 'blossom', 'fan', 'bell', 'leaf'];
export const KEEPSAKE_NAMES = { coin: 'a silver coin', key: 'a little brass key', gem: 'a cut gem', crane: 'a paper crane', blossom: 'a pressed blossom', fan: 'a folding fan', bell: 'a tiny bell', leaf: 'a maple leaf' };
