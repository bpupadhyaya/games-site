// Enemy data. Every enemy follows a repeating list of intents, shown to the player in full.
// Intent types:
//   attack   { value, hits?, element?, foul? }   foul attacks cannot be answered, only guarded
//   guard    { value, strength? }                this enemy gains Guard
//   guardAll { value }                           every living enemy gains Guard
//   heal     { value }                           restores the most wounded living enemy
//   buff     { strength }
//   debuff   { weak? , snared? , exposed? }      applied to the player, in turns
//   curse    { count }                           adds Frayed String cards to the player's discard
//   summon   { key, count, hpFrac? }             adds minions (up to 3 enemies on the field)
// `act` is the act an enemy is native to; used in a later act it is tougher (see ACT_*_MULT).
// `shape` picks the construct silhouette the renderer draws. Numbers are tuned with design/sim.mjs.

const atk = (value, element = null, hits = 1, foul = false) => ({ type: 'attack', value, hits, element, foul });
const guard = (value) => ({ type: 'guard', value });
const guardAll = (value) => ({ type: 'guardAll', value });
const heal = (value) => ({ type: 'heal', value });
const buff = (strength) => ({ type: 'buff', strength });
const debuff = (fields) => ({ type: 'debuff', ...fields });
const curse = (count) => ({ type: 'curse', count });
const summon = (key, count, hpFrac = 1) => ({ type: 'summon', key, count, hpFrac });

export const ENEMIES = {
  // ---- Act 1
  cinder_drone: { act: 1, name: 'Cinder Drone', element: 'ember', hp: 30, shape: 'tri', pattern: [atk(8, 'ember'), atk(8, 'ember'), buff(2)] },
  tide_lurker: { act: 1, name: 'Tide Lurker', element: 'tide', hp: 34, shape: 'wave', pattern: [atk(6, 'tide'), guard(8), atk(12, 'tide')] },
  gale_kite: { act: 1, name: 'Gale Kite', element: 'gale', hp: 22, shape: 'kite', pattern: [atk(4, 'gale', 2), atk(4, 'gale', 2), debuff({ snared: 1 })] },
  stone_warden: { act: 1, name: 'Stone Warden', element: 'stone', hp: 42, shape: 'hex', pattern: [guard(10), atk(14, 'stone'), atk(9, 'stone')] },
  squall_caller: { act: 1, name: 'Squall Caller', element: 'storm', hp: 28, shape: 'bolt', pattern: [debuff({ weak: 2 }), atk(10, 'storm'), atk(7, 'storm')] },
  glare_lens: { act: 1, name: 'Glare Lens', element: 'flare', hp: 26, shape: 'sun', pattern: [atk(5, 'flare'), atk(9, 'flare'), atk(13, 'flare')] },
  reed_thief: { act: 1, name: 'Reed Thief', element: null, hp: 24, shape: 'diamond', pattern: [atk(7), atk(7), guard(6)] },
  ash_moth: { act: 1, name: 'Ash Moth', element: 'ember', hp: 16, shape: 'kite', pattern: [atk(5, 'ember'), debuff({ exposed: 1 }), atk(6, 'ember')] },
  forge_colossus: {
    act: 1, name: 'Forge Colossus', element: 'ember', hp: 58, shape: 'colossus', elite: true,
    pattern: [atk(10, 'ember'), { type: 'guard', value: 10, strength: 1 }, atk(13, 'stone'), atk(5, 'ember', 3)],
  },
  // Boss of the first act, and its lures. While a lure stands, single-target shots hit a lure.
  lure_master: {
    act: 1, name: 'The Lure-Master', element: 'gale', hp: 74, shape: 'boss_lure', boss: true, tune: { hp: 0.95, atk: 0.95 },
    intro: { title: 'THE LURE-MASTER', sub: 'Never loose a legend at a lure.' },
    pattern: [summon('decoy', 2), atk(9, 'gale'), atk(13, 'storm'), summon('decoy', 1), atk(7, null, 2), atk(14, 'gale')],
  },
  decoy: { act: 1, name: 'Lure', element: null, hp: 1, shape: 'lure', decoy: true, pattern: [atk(2)] },

  // ---- Act 2: the enemies begin to cheat
  kiln_sentry: { act: 2, name: 'Kiln Sentry', element: 'ember', hp: 46, shape: 'hex', pattern: [atk(11, 'ember'), atk(11, 'ember'), guardAll(8)] },
  undertow_eel: { act: 2, name: 'Undertow Eel', element: 'tide', hp: 40, shape: 'wave', pattern: [atk(7, 'tide', 2), debuff({ weak: 2 }), atk(16, 'tide')] },
  glass_hawk: { act: 2, name: 'Glass Hawk', element: 'flare', hp: 34, shape: 'kite', pattern: [atk(9, 'flare'), atk(9, 'flare', 1, true), atk(14, 'flare')] },
  thunder_drum: { act: 2, name: 'Thunder Drum', element: 'storm', hp: 44, shape: 'bolt', pattern: [buff(2), atk(8, 'storm', 2), atk(8, 'storm', 2)] },
  dust_devil: { act: 2, name: 'Dust Devil', element: 'gale', hp: 30, shape: 'kite', pattern: [atk(5, 'gale', 3), curse(1), atk(5, 'gale', 3)] },
  cairn_golem: { act: 2, name: 'Cairn Golem', element: 'stone', hp: 60, shape: 'hex', pattern: [guard(14), atk(18, 'stone'), atk(12, 'stone')] },
  oath_breaker: { act: 2, name: 'Oath-Breaker', element: null, hp: 42, shape: 'diamond', pattern: [atk(10, null, 1, true), guard(8), atk(14, null, 1, true)] },
  field_medic: { act: 2, name: 'Field Surgeon', element: null, hp: 28, shape: 'sun', pattern: [heal(10), atk(6), heal(10)] },
  storm_choir: {
    act: 2, name: 'Storm Choir', element: 'storm', hp: 96, shape: 'colossus', elite: true,
    pattern: [atk(6, 'storm', 3), buff(2), atk(8, 'storm', 3), curse(2)],
  },
  glass_matron: {
    act: 2, name: 'Glass Matron', element: 'flare', hp: 88, shape: 'colossus', elite: true,
    pattern: [summon('glass_hawk', 2, 0.6), atk(14, 'flare'), atk(10, 'flare', 1, true), guardAll(10)],
  },

  // Boss of the second day. It gains Strength from every damaging card you play (`feeds`), loses
  // some when you hold back, and blows itself out after `lasts` actions — which is a win.
  answering_storm: {
    act: 2, name: 'The Answering Storm', element: 'storm', hp: 160, shape: 'boss_storm', boss: true, feeds: 2, lasts: 7, tune: { atk: 0.87 },
    intro: { title: 'THE ANSWERING STORM', sub: 'It feeds on every blow. It cannot last.' },
    pattern: [atk(5, 'storm', 2), atk(6, 'storm', 2), guard(12), atk(7, 'storm', 2), atk(8, 'storm', 2), atk(6, 'storm', 3), atk(10, 'storm', 2)],
  },

  // ---- Act 3: nobody keeps the Covenant
  // The final boss. Its pattern comes from RIVAL_SEQUENCE and the run's face-up quiver (see below).
  the_rival: {
    act: 3, name: 'The Rival', element: null, hp: 130, shape: 'boss_rival', boss: true, rival: true, tune: { hp: 2.7, atk: 3.27 },
    intro: { title: 'THE RIVAL', sub: 'Another Oathkeeper. Every arrow they have left is shown.' },
    pattern: [],
  },
  ash_herald: { act: 3, name: 'Ash Herald', element: 'ember', hp: 58, shape: 'tri', pattern: [atk(14, 'ember', 1, true), atk(14, 'ember'), curse(2)] },
  rime_warden: { act: 3, name: 'Rime Warden', element: 'tide', hp: 70, shape: 'wave', pattern: [guard(16), atk(20, 'tide'), debuff({ exposed: 2 })] },
  sun_eater: { act: 3, name: 'Sun-Eater', element: 'flare', hp: 50, shape: 'sun', pattern: [atk(12, 'flare', 2, true), buff(3), atk(12, 'flare', 2)] },
  last_banner: { act: 3, name: 'Last Banner', element: null, hp: 80, shape: 'diamond', pattern: [guardAll(12), atk(16, null, 1, true), heal(14)] },
  // Two of these fight together; each is strengthened whenever the other is struck (`rally`).
  captain: { act: 3, name: 'Quarrelling Captain', element: null, hp: 82, shape: 'colossus', elite: true, rally: 2, pattern: [atk(11), guard(10), atk(14, null, 1, true)] },
  the_quartermaster: {
    act: 3, name: 'The Quartermaster', element: null, hp: 120, shape: 'colossus', elite: true,
    pattern: [curse(2), atk(18, null, 1, true), summon('field_medic', 1), atk(12, null, 2)],
  },
};

// Encounter tables. Each entry is a list of enemy keys (max 3). The Surgeon only ever fights beside a partner.
export const ENCOUNTERS = {
  1: {
    easy: [['cinder_drone'], ['reed_thief'], ['gale_kite', 'gale_kite'], ['glare_lens'], ['ash_moth', 'ash_moth']],
    normal: [['tide_lurker'], ['stone_warden'], ['squall_caller'], ['cinder_drone', 'ash_moth'], ['reed_thief', 'gale_kite'], ['glare_lens', 'ash_moth'], ['squall_caller', 'gale_kite']],
    elite: [['forge_colossus']],
    boss: [['lure_master']],
  },
  2: {
    easy: [['glass_hawk'], ['dust_devil', 'dust_devil'], ['oath_breaker'], ['thunder_drum']],
    normal: [['kiln_sentry'], ['undertow_eel'], ['cairn_golem'], ['thunder_drum', 'dust_devil'], ['glass_hawk', 'oath_breaker'], ['field_medic', 'kiln_sentry'], ['field_medic', 'undertow_eel'], ['dust_devil', 'oath_breaker']],
    elite: [['storm_choir'], ['glass_matron']],
    boss: [['answering_storm']],
  },
  3: {
    easy: [['ash_herald'], ['sun_eater'], ['glass_hawk', 'oath_breaker']],
    normal: [['rime_warden'], ['last_banner'], ['cairn_golem'], ['kiln_sentry', 'ash_herald'], ['undertow_eel', 'sun_eater'], ['field_medic', 'last_banner'], ['thunder_drum', 'oath_breaker']],
    elite: [['captain', 'captain'], ['the_quartermaster']],
    boss: [['the_rival']],
  },
};

// Enemy health and attack values grow a little with each step along the path.
export const STEP_SCALE = 0.05;
export const PAIR_HP_SCALE = 0.85;
// An enemy met in a later act than its own is tougher, and in the third act half its attacks are FOUL.
export const ACT_HP_MULT = 1.35;
export const ACT_ATK_MULT = 1.3;
// Tuning multipliers applied on top of every enemy's own numbers, by the act it is native to.
// The listed numbers above are the design intent (design/CONTENT-SPEC.md); these are what the
// simulator says the game needs. Change these first when a whole act is too hard or too soft.
export const NATIVE_TUNE = { 1: { hp: 1, atk: 1 }, 2: { hp: 0.5, atk: 0.5 }, 3: { hp: 0.22, atk: 0.22 } };

// ---- The Rival's quiver: nine named Arrows, all shown face-up from the start of Act 3.
// Each is fired once and struck off, whether it is answered or not. Every element appears at least once.
export const RIVAL_ARROWS = [
  { name: 'Cinderhand', element: 'ember', value: 14, hits: 1 },
  { name: 'Deepcall', element: 'tide', value: 16, hits: 1 },
  { name: 'Noonwright', element: 'flare', value: 12, hits: 1 },
  { name: 'Hailvoice', element: 'storm', value: 7, hits: 2 },
  { name: 'Longsigh', element: 'gale', value: 10, hits: 1 },
  { name: 'Graveweight', element: 'stone', value: 20, hits: 1 },
  { name: 'Plainword', element: null, value: 13, hits: 1 },
  { name: 'Twinned', element: null, value: 8, hits: 2 },
  { name: 'Embertongue', element: 'ember', value: 9, hits: 2 },
  { name: 'Undersong', element: 'tide', value: 11, hits: 1 },
  { name: 'Glasscry', element: 'flare', value: 18, hits: 1 },
  { name: 'Stormledger', element: 'storm', value: 15, hits: 1 },
  { name: 'Highwind', element: 'gale', value: 6, hits: 3 },
  { name: 'Oldstone', element: 'stone', value: 13, hits: 1 },
];
// A = the next Arrow in its quiver, T = a Technique (Guard 14, then Take Aim +8, then Guard 14).
export const RIVAL_SEQUENCE = ['A', 'A', 'T', 'A', 'A', 'T', 'A', 'A', 'T', 'A', 'A', 'A'];
export const RIVAL_TECHNIQUES = [guard(14), { type: 'aim', value: 8 }, guard(14)];
export const RIVAL_BREAKS_AT = 0.4;

export function buildRivalQuiver(rng, mult = 1) {
  const chosen = ['ember', 'tide', 'flare', 'storm', 'gale', 'stone'].map((el) => rng.pick(RIVAL_ARROWS.filter((a) => a.element === el)));
  const rest = rng.shuffle(RIVAL_ARROWS.filter((a) => !chosen.includes(a)));
  chosen.push(...rest.slice(0, 3));
  return rng.shuffle(chosen).map((a) => ({ ...a, value: Math.max(1, Math.round(a.value * mult)) }));
}
