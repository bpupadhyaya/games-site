// Every gameplay number in one place (design/GDD.md "Progression and content"). Pure data.
export const W = 720;
export const H = 1280;

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
  hummingbird: { points: 100, r: 16, stay: [0, 0], unlock: 10, weight: 1 },
};
export const OWL_STONE_PENALTY = 2;
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
  return {
    n,
    quota,
    stones: quota + Math.max(3, 8 - Math.floor(n / 3)),
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
