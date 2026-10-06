// Every gameplay number in one place (design/GDD.md "Progression and content"). Pure data.
// LIVE world geometry (fluid layout, kit 1.7.1). layout.js writes it whenever the screen size changes; the simulation, the
// scene generator and the renderer all read it, never a fixed 720 x 1280. The world is drawn scaled by `z` (screen units per
// world unit); a 720 x 1280 portrait screen has z = 1 and is exactly the original approved composition.
export const V = { WW: 720, WH: 1280, z: 1, hy: 790, top: 80, bot: 640, key: '' };
// Maps an original-design sky height (80..640 in the 1280 layout) into the live bird band (below the HUD, above the horizon).
export const skyY = (yd) => V.top + ((yd - 80) * (V.bot - V.top)) / 560;

// How much bigger than the baseline portrait phone (720 x 1560 world units) the live field is. F = 1 on every phone-shaped portrait screen,
// so the approved portrait look and balance are untouched; wider / taller fields get more perches, more birds and longer flights.
export const fieldF = () => Math.max(1, V.WW / 720) * Math.max(1, V.WH / 1560);
export const flyK = () => Math.max(0, V.WW / 720 - 1) + 3 * Math.max(0, V.WH / 1560 - 1);   // 0 on the baseline: birds keep their original behaviour
export const MAX_LIVE_BIRDS = 28;
// Scales a level's flock to the field: crowd c = 1 + (F^0.9 - 1) * ramp, where ramp eases in over levels 1-6 (early levels stay gentle on any screen).
export function applyField(spec) {
  const F = fieldF(), ramp = 0.5 + 0.5 * Math.min(1, (spec.n - 1) / 5), c = 1 + (F ** 0.9 - 1) * ramp;
  spec.F = F;
  spec.maxBirds = Math.min(MAX_LIVE_BIRDS, Math.round((spec.maxBirds0 ?? spec.maxBirds) * c));
  spec.spawnK = Math.sqrt(c);
  return spec;
}
// Quota and stones grow with the square root of the crowd (a bigger flock gives more targets but also more to track).
export function scaleSpec(spec) {
  spec.maxBirds0 = spec.maxBirds;
  const F = fieldF(), ramp = 0.5 + 0.5 * Math.min(1, (spec.n - 1) / 5), c = 1 + (F ** 0.9 - 1) * ramp;
  if (!spec.boss && c > 1) {
    const slack = spec.stones - spec.quota;
    spec.quota = Math.min(40, Math.ceil(spec.quota * Math.sqrt(c)));
    spec.stones = spec.quota + Math.ceil(slack * Math.sqrt(c));
  }
  return applyField(spec);
}

export const SLING = { x: 360, y: 1050, maxPull: 220, minPull: 24, power: 7.2, dragZoneTop: 640 };

// Auto Play (assisted-learning THINK -> REVEAL -> ACT loop over the real physics/aiming). This is a
// fast, continuous action game (10-40s a level, a new bird roughly every second), unlike the
// turn-based board games this pattern was first built for - a 2s+5s pause before EVERY shot would
// make the game unwatchably slow and let birds despawn mid-think. Genre adaptation (per the shared
// brief's own note on this game): the decision-point unit is one SHOT; THINK/REVEAL are scaled down
// consistently (still the same three-phase shape, still an index array, still configurable) so the
// whole demo stays at a pace that matches the game's own; the live field is fully frozen for the
// duration of THINK/REVEAL (nothing spawns, moves or drains) so a slow setting never costs a bird
// the chance to be shot at - only ACT (the real flight/physics) advances real time.
export const AP_THINK_STEPS = [1, 2, 3, 5]; // seconds; default index 1 (2s), hard-capped at 5s here
export const AP_REVEAL_TIME = 0.8; // fixed; scaled down from the board games' 2s for this pace
export const GRAVITY = 900;
export const STONE_R = 9;
export const STARTLE_RADIUS = 120;

// points, hit radius, and how long a perched bird of this type stays before leaving by itself.
export const BIRDS = {
  sparrow: { points: 10, r: 26, stay: [6, 10], unlock: 1, weight: 5 },
  pigeon: { points: 15, r: 34, stay: [8, 13], unlock: 1, weight: 5 },
  parrot: { points: 25, r: 28, stay: [3.2, 3.8], unlock: 3, weight: 3 },
  duck: { points: 30, r: 32, stay: [0, 0], unlock: 4, weight: 3 },
  crow: { points: 40, r: 30, stay: [7, 11], unlock: 7, weight: 2 },
  owl: { points: -50, r: 34, stay: [9, 14], unlock: 8, weight: 1 },
  swallow: { points: 35, r: 24, stay: [0, 0], unlock: 5, weight: 2 },
  butterfly: { points: 0, r: 20, stay: [0, 0], unlock: 3, weight: 1 },
  bigcrow: { points: 90, r: 42, stay: [9, 13], unlock: 12, weight: 1, hp: 2 },
  hawk: { points: 400, r: 56, stay: [0, 0], unlock: 999, weight: 0, hp: 5 },
  goldfinch: { points: 150, r: 24, stay: [0, 0], unlock: 6, weight: 1 },
  hummingbird: { points: 100, r: 16, stay: [0, 0], unlock: 10, weight: 1 },
};
// ONE scale for every bird: pixels (world units) per real centimetre, derived from the game's own pigeon sprite (the drawBird sprite is ~87 units long at scale 1,
// scaled by r/30 * 1.15) and the pigeon's real length of 32 cm. The predator art is sized from real body lengths with this same constant.
export const SPRITE_UNITS = 87;
export const pxPerCm = () => (SPRITE_UNITS * (BIRDS.pigeon.r / 30) * 1.15) / 32;
export const REAL_CM = { sparrow: 14, goldfinch: 13, hummingbird: 9, pigeon: 32, parrot: 30, duck: 55, crow: 47, bigcrow: 58, owl: 38, swallow: 18, falcon: 42, hawk: 52 };
export const OWL_STONE_PENALTY = 2;
export const GOLDFINCH_STONES = 2;
export const BUTTERFLY_STONE_PENALTY = 1;
export const WIDE_STONE_R = 17;      // a power-up stone: bigger hit radius
export const COMBO_WIDE = 5;         // combo that earns a Wide stone for the next shot
export const COMBO_SLOW = 8;         // combo that earns a few seconds of slow time
export const SLOW_TIME = 4;
// Cosmetic gifts for coming back: current stone skin by the longest visit streak (days). Never gated by money, never taken away.
export const STREAK_GIFTS = [3, 7, 14, 30];
export const streakKind = (best) => (STREAK_GIFTS.filter((d) => best >= d).length ? 2 + STREAK_GIFTS.filter((d) => best >= d).length : 0);
export const MISS_ASSIST = 3;        // misses in a row before the aim guide quietly gets longer
export const CROW_DODGE_WINDOW = 2.5;

export const CROP_MAX = 100;
export const CROP_DRAIN_PER_BIRD = 1.2;
export const CROP_DRAIN_FROM_LEVEL = 4;

export const DAILY = { level: 8, stones: 20 };
export const DEMO_LEVEL_LIMIT = 3;
export const DEMO_RUN_LIMIT = 3;
// Stars needed for the 2nd..5th slingshot wood (the 1st, oak, is always available).
export const STAR_UNLOCKS = [10, 25, 50, 90];
// Stars needed for the 2nd and 3rd stone (pebble is the default).
export const STONE_UNLOCKS = [15, 40];
export const stoneFor = (stars) => STONE_UNLOCKS.filter((t) => stars >= t).length;
export const stoneKind = (state) => Math.max(stoneFor(state.stars), streakKind(state.bestVisit || 0));
export const SHARE_URL = 'https://equalinformation.com/games-site/';
// The other Arcforge games, for the tally screen's "More from Arcforge" chips. This is a free
// game's one natural advertising moment (a player has just finished a session and is deciding
// what to do next) - deliberately paid games only, never another free game: a player can already
// find the free ones for themselves (they're labelled), so this moment is spent showing the ones
// they might not otherwise discover and might buy (2026-09-23, owner decision).
export const SIBLINGS = [
  { slug: 'tiger-and-goat', title: 'Tiger and Goat' },
  { slug: 'go-stones-and-territory', title: 'Go' },
  { slug: 'carrom-striker-and-queen', title: 'Carrom' },
  { slug: 'word-game', title: 'Word Game' },
];
export const woodFor = (stars) => STAR_UNLOCKS.filter((t) => stars >= t).length;

export function levelSpec(n) {
  const quota = Math.min(16, 4 + Math.floor(n * 0.8));
  const boss = n % 10 === 0;
  return {
    n,
    boss,
    quota: boss ? 999 : quota,
    stones: boss ? 26 : quota + Math.max(3, 8 - Math.floor(n / 3)),
    maxBirds: Math.min(6, 2 + Math.floor(n / 4)),
    guideDots: Math.max(4, 14 - Math.floor((n - 1) * 0.67)),
    windMax: n < 4 ? 0 : Math.min(140, (n - 3) * 16),
    gusty: n >= 16,
    world: Math.floor((n - 1) / 5) % 5,
    speed: 1 + Math.min(0.8, (n - 1) * 0.04), // bird tempo multiplier
  };
}

export const comboMultiplier = (combo) => Math.min(5, 1 + combo * 0.5);
export const starsFor = (stonesLeft) => (stonesLeft >= 5 ? 3 : stonesLeft >= 2 ? 2 : 1);
