// GAME CONTRACT (docs/GAME-CONTRACT.md): meta + createGame(env) -> { update, render, getState }.
// Golden Sling - guard the harvest with a slingshot. Design: design/GDD.md. This file owns
// scenes, state and input; numbers live in tuning.js, flight in physics.js, bird behaviour in
// birds.js, scene generation in levels.js and every pixel in render.js.
import { createRng } from '../kit/rng.js';
import {
  V, SLING, scaleSpec, applyField, fieldF, STONE_R, STARTLE_RADIUS, BIRDS, OWL_STONE_PENALTY, CROP_MAX, CROP_DRAIN_PER_BIRD,
  CROP_DRAIN_FROM_LEVEL, GOLDFINCH_STONES, BUTTERFLY_STONE_PENALTY, WIDE_STONE_R, COMBO_WIDE, COMBO_SLOW, SLOW_TIME, STREAK_GIFTS, MISS_ASSIST, DAILY, DEMO_LEVEL_LIMIT, DEMO_RUN_LIMIT, levelSpec, comboMultiplier, starsFor, woodFor, stoneFor, SHARE_URL, SIBLINGS,
  AP_THINK_STEPS, AP_REVEAL_TIME,
} from './tuning.js';
import { clampPull, launchVelocity, stepStone, segmentHitsCircle, distanceToSegment, aimAt } from './physics.js';
import { spawnBird, spawnBoss, perchPoint, updateBird, startle, leave, maybeDodge, isTarget, isPerchedPest } from './birds.js';
import { generateScene, fitScene, pickBirdType } from './levels.js';
import { drawGame, SCHEMES, rulesMetrics } from './render.js';
import { createSfx } from './sfx.js';
import { planHunts, updatePredator, planSitters, reseatSitters, updateSitters, sitterBody, PRED } from './predator.js';
import { layoutFor, applyView, inRect, TEXT_SCALES } from './layout.js';

const AP_IDLE = { pointer: { x: 0, y: 0, down: false, pressed: false, released: false }, keys: { down: new Set(), pressed: new Set() } };
// A shot's flight time isn't known ahead of time (it depends on the angle physics.js's aimAt()
// solves for), so a few candidate times are tried and the first that yields a real, in-range pull
// is used - the same idea as a lead shot in any of the other autoplay-pro games' physics-based aims.
const AP_TIME_GUESSES = [0.35, 0.5, 0.65, 0.8, 1.0, 1.25, 1.5];
// Easiest first: a stationary (or about-to-be-briefly-stationary) bird is a clean, reliable shot;
// a moving one needs a lead guess that is more often wrong - "prefer a plausible action" (brief),
// not a perfect one.
const AP_PHASE_ORDER = ['perched', 'dodging', 'crossing', 'swoop', 'boss', 'arriving', 'hopping', 'darting'];
function apPickShot(s) {
  const wind = s.spec.gusty ? s.wind * (0.6 + 0.4 * Math.sin(s.time * 0.9)) : s.wind;
  const candidates = s.birds.filter((b) => !b.gone && b.type !== 'owl' && b.type !== 'butterfly' && b.phase !== 'leaving');
  candidates.sort((a, b) => AP_PHASE_ORDER.indexOf(a.phase) - AP_PHASE_ORDER.indexOf(b.phase));
  for (const bird of candidates) {
    for (const t of AP_TIME_GUESSES) {
      const lead = bird.phase === 'crossing' ? t : 0; // only the duck has a simple constant vx worth leading
      const pull = aimAt(bird.x + (bird.vx || 0) * lead, bird.y, wind, t);
      if (pull && pull.len >= SLING.minPull + 4) return { pull, birdId: bird.id };
    }
  }
  return null;
}

// Fluid viewport (kit 1.7.1): the short side is always 720 units and the long side follows the screen, in portrait and landscape.
// `meta.width/height` are updated live by the kit on every resize; every position comes from layoutFor(meta.width, meta.height).
export const meta = { width: 720, height: 1560, fluid: { short: 720 } };
export const wheelInput = { dy: 0 };   // fed by main.js (the kit has no wheel event); scrolls the Rules page
const hit = (r, x, y) => inRect(r, x, y);
const FEATHERS = { sparrow: ['#a5744a', '#e8d2b0'], pigeon: ['#8d97a8', '#c7cedb'], parrot: ['#2fae4f', '#ffd23f'], duck: ['#7a5a3a', '#e9dcc3'], crow: ['#2d3040', '#5a5f78'], hummingbird: ['#18b89a', '#e9fff8'], goldfinch: ['#ffc93f', '#fff3b0'], swallow: ['#2f4a8a', '#e8d2b0'], bigcrow: ['#1d1f2a', '#5a5f78'], hawk: ['#6b4a2a', '#e8d2b0'] };

export function createGame(env) {
  const { rng, storage, monetization, audio, config } = env;
  const demo = Boolean(config?.demo);
  const day = config?.day ?? 0;

  const state = {
    scene: 'title', // 'title' | 'playing' | 'levelclear' | 'tally' | 'demo-limit' | 'rules'
    rulesPage: 0,
    rulesScroll: 0, // pixels scrolled on the current Rules page (0 when the page fits)
    textScaleIdx: 0, // index into TEXT_SCALES; the Rules reference page's text size
    mode: 'campaign', // 'campaign' | 'endless' | 'daily'
    level: 1,
    spec: levelSpec(1),
    world: null, // generated scene: trees, perches...
    birds: [],
    stones: [], // in flight
    particles: [],
    popups: [],
    nextBirdId: 1,
    spawnTimer: 0,
    stonesLeft: 0,
    hits: 0, // toward this level's quota
    combo: 0,
    bestCombo: 0,
    score: 0,
    crop: CROP_MAX,
    wind: 0,
    time: 0,
    clearTimer: 0,
    lastStars: 0,
    newStone: -1, // same for stones
    newWood: -1, // index of a slingshot wood unlocked by the level just cleared, else -1
    aim: null, // { sx, sy, pull: {x,y,len} } while dragging
    snap: 0, // band overshoot animation after release
    hitStop: 0, // seconds of near-freeze after a hit (game feel)
    shake: 0, // screen shake amplitude (world units), decays on its own
    flash: 0, // soft white flash on a golden finch
    calm: false, // "Calm: less shake": no shake / hit-stop / flash (persisted; defaults to the OS reduced-motion setting when readable)
    power: null, // 'wide' = the next stone is a big Wide stone (earned by a combo)
    slowT: 0, // seconds of slow time left (earned by a combo)
    missStreak: 0, // misses in a row: after MISS_ASSIST the aim guide quietly gets longer
    boss: null, bossDown: false,
    breathe: false, breatheT: 0, playTime: 0, restNote: false, scareT: 0, // wellness options, session clock, scarecrow wave
    falconHits: 0, avoidNext: false, drainK: 1, drainT: 0, // hitting the predator is a mistake with an escalating penalty (reset per run)
    sitters: [], sitterStrikes: 0, hunt: null, predator: null, guardT: 0, toast: null, // predator ecosystem (predator.js)
    visit: { day: -1, count: 0 }, bestVisit: 0, giftNote: '', // coming-back streak (cosmetic stone gifts only)
    duck: 0, // seconds the music stays ducked after a hit
    sfxQ: [], // delayed sound cues [{ t, p }] (screech tails, caw volleys)
    muted: false,
    chirpTimer: 2,
    windTimer: 0,
    chirpN: 0,
    shareNote: '',
    kbdAim: { angle: -Math.PI / 2, power: 130 }, // keyboard aim, remembered between shots
    creakTimer: 0, // seconds until the next band-creak tone while aiming
    shots: [], // this run: 'hit' | 'miss' | 'owl' per stone (Daily Hunt share string)
    tally: { thrown: 0, hit: 0, byType: {} },
    // persisted
    best: 0,
    highestLevel: 1,
    stars: 0,
    scheme: 0,
    daily: { day: -1, score: 0, streak: 0 },
    demoRuns: 0,
    demo,
    // Auto Play: a free, silent, save/stats-untouched THINK -> REVEAL -> ACT demonstration
    // (STATUS.md). apThinkIdx is an index into AP_THINK_STEPS (never a raw float); `ap` is this
    // scene's own tiny phase machine. The actual game being watched is a completely separate
    // instance (see startAutoplay()/apGame below) - nothing here ever touches the real save state.
    apThinkIdx: 1, ap: null,
  };
  let playRng = rng.fork();
  let apGame = null;
  // Impact sounds on the game's own AudioContext (sfx.js); the Auto Play shadow game is silent. `env.sfxCtx` lets tests supply a fake context.
  const sfx = env.silent ? null : createSfx({ makeCtx: env.sfxCtx ?? (() => { const C = globalThis.AudioContext ?? globalThis.webkitAudioContext; return C ? new C() : null; }), isMuted: () => state.muted || audio.muted === true });
  const whooshes = new WeakMap();

  // The live layout. Called at the top of update() and render(): publishes the world geometry (V, SLING) and, when the screen
  // changed shape (rotation, split window, resize), re-spreads the scenery and carries the live birds / stones over by proportion
  // so a rotation at any moment keeps the level, the score and the birds in play.
  let cur = null;
  const lay = () => {
    const L = layoutFor(meta.width, meta.height);
    applyView(L);
    if (cur && cur.key !== L.key) {
      const sx = L.WW / cur.WW, sy = L.WH / cur.WH;
      for (const b of state.birds) { b.x *= sx; b.y *= sy; b.tx *= sx; b.ty *= sy; }
      for (const o of [...state.stones, ...state.particles]) { o.x *= sx; o.y *= sy; if ('px' in o) { o.px *= sx; o.py *= sy; } }
      for (const p of state.popups) { p.x *= sx; p.y *= sy; }
      if (state.predator) { state.predator.x *= sx; state.predator.y *= sy; }
      if (state.world) {
        fitScene(state.world, state.spec);
        state.reseatSx = sx; state.reseatSy = sy; reseatSitters(state);
        for (const b of state.birds) if (b.perch >= state.world.perches.length) leave(b, playRng);
      }
      state.aim = null;
      if (state.spec) {
        applyField(state.spec);   // the flock cap follows the new field
        // Birds that were sitting fly to where their perch now is (no teleporting); a field that shrank sends the surplus birds away.
        for (const b of state.birds) if (b.phase === 'perched') b.phase = 'hopping';
        let alive = state.birds.filter((b) => !b.gone && b.phase !== 'leaving').length;
        for (const b of state.birds) if (alive > state.spec.maxBirds && b.type !== 'hawk' && (b.phase === 'hopping' || b.phase === 'arriving')) { leave(b, playRng); alive -= 1; }
      }
    }
    cur = L;
    return L;
  };

  storage.get('best', 0).then((v) => (state.best = v));
  storage.get('highestLevel', 1).then((v) => (state.highestLevel = v));
  storage.get('stars', 0).then((v) => (state.stars = v));
  storage.get('muted', false).then((v) => {
    state.muted = Boolean(v);
    audio.setMuted(state.muted);
  });
  storage.get('scheme', 0).then((v) => (state.scheme = SCHEMES[v] ? v : 0));
  // Clamp on load: a stale saved index from a build with a longer/shorter TEXT_SCALES array must
  // never produce an out-of-range (NaN-font) size.
  storage.get('textScaleIdx', 0).then((v) => (state.textScaleIdx = Math.min(Math.max(v ?? 0, 0), TEXT_SCALES.length - 1)));
  storage.get('daily', null).then((v) => v && (state.daily = v));
  storage.get('calm', null).then((v) => { state.calm = v === null ? Boolean(globalThis.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches) : Boolean(v); });
  storage.get('breathe', false).then((v) => { state.breathe = Boolean(v); });
  storage.get('bestVisit', 0).then((v) => (state.bestVisit = v || 0));
  // Visit streak: one more day each calendar day the player comes back; a gap simply starts again from 1 (nothing is lost, no penalty).
  storage.get('visit', null).then((v) => {
    const old = v && typeof v.day === 'number' ? v : { day: -1, count: 0 };
    if (old.day !== day) {
      const count = old.day === day - 1 ? old.count + 1 : 1;
      state.visit = { day, count };
      storage.set('visit', state.visit);
      const before = state.bestVisit;
      if (count > state.bestVisit) { state.bestVisit = count; storage.set('bestVisit', count); }
      const gift = STREAK_GIFTS.find((d) => before < d && state.bestVisit >= d);
      if (gift) state.giftNote = `Day ${gift} gift: a new stone skin, thanks for coming back!`;
    } else state.visit = old;
  });
  if (demo) storage.get('demoRuns', 0).then((v) => (state.demoRuns = v));
  storage.get('apThinkIdx', 1).then((v) => (state.apThinkIdx = Math.min(Math.max(v ?? 1, 0), AP_THINK_STEPS.length - 1)));

  const startLevel = (n) => {
    const base = state.mode === 'daily' ? DAILY.level : state.mode === 'zen' ? 3 : n;
    state.level = n;
    state.spec = levelSpec(base);
    if (state.mode === 'daily') state.spec = { ...state.spec, quota: 999, stones: Math.round(DAILY.stones * Math.sqrt(fieldF())) };   // Daily Hunt has no quota: the stone count scales with the field
    else scaleSpec(state.spec);
    if (state.mode === 'zen') { state.spec = { ...state.spec, quota: 999999, stones: 999, windMax: 0, gusty: false, boss: false, world: (n + 1) % 5, maxBirds: 3, maxBirds0: 3 }; applyField(state.spec); }
    if (state.mode === 'daily') state.spec.world = day % 5;   // the Daily Hunt has its own scenery each day
    if (state.mode === 'daily') { state.spec.maxBirds0 = state.spec.maxBirds; applyField(state.spec); }
    state.world = generateScene(playRng, state.spec);
    state.sitters = state.mode === 'zen' ? [] : planSitters(playRng, state.world, state.spec.n, fieldF()); state.sitterStrikes = 0;
    state.birds = [];
    state.stones = [];
    state.particles = [];
    state.popups = [];
    state.spawnTimer = 0.4;
    // A wide field starts half full: birds already sitting on perches (deterministic, from the level's own rng stream).
    const seed0 = Math.floor((state.spec.maxBirds - 2) / 2) * (fieldF() > 1.3 ? 1 : 0);
    for (let i = 0; i < seed0; i++) {
      const type = pickBirdType(playRng, state.spec, state.birds.some((b) => b.type === 'owl'), false);
      const b = spawnBird(playRng, type, state.world, state.birds, state.spec.speed, state.nextBirdId);
      if (!b || b.perch < 0) continue;
      state.nextBirdId += 1;
      const p = perchPoint(state.world, b.perch, 0);
      Object.assign(b, { phase: 'perched', x: p.x, y: p.y - b.r * 0.7, t: playRng.range(0, 3) });
      state.birds.push(b);
    }
    state.stonesLeft = state.spec.stones;
    state.hits = 0;
    state.crop = CROP_MAX;
    state.wind = state.spec.windMax ? playRng.range(-state.spec.windMax, state.spec.windMax) : 0;
    state.aim = null;
    state.predator = null; state.guardT = 0; state.toast = null;
    state.hunt = state.mode === 'zen' ? null : planHunts(playRng, state.spec.n);
    if (state.avoidNext && state.hunt) { state.hunt = null; state.avoidNext = false; }   // after a third hit the falcon stays away from the next hunt (it remembers)
    state.drainT = 0;
    state.power = null; state.slowT = 0; state.missStreak = 0; state.boss = null; state.bossDown = false;
    if (state.spec.boss && state.mode !== 'daily') {
      state.boss = spawnBoss(state.nextBirdId); state.nextBirdId += 1; state.birds.push(state.boss);
      state.popups.push({ x: V.WW / 2, y: V.hy - 330, text: 'Boss: the Hawk!', life: 2.2, bad: false, size: 40, gold: true });
    }
    state.scene = 'playing';
  };

  const startRun = (mode) => {
    if (demo) {
      if ((mode !== 'campaign') || state.demoRuns >= DEMO_RUN_LIMIT) {
        state.scene = 'demo-limit';
        return;
      }
      state.demoRuns += 1;
      storage.set('demoRuns', state.demoRuns);
    }
    state.mode = mode;
    // Daily Hunt: the same field and birds for every player on the same date.
    playRng = mode === 'daily' ? createRng((day * 7919 + 13) >>> 0) : rng.fork();
    state.summary = '';
    state.score = 0;
    state.falconHits = 0; state.avoidNext = false; state.drainT = 0;
    state.combo = 0;
    state.bestCombo = 0;
    state.shots = [];
    state.tally = { thrown: 0, hit: 0, byType: {} };
    startLevel(mode === 'campaign' && !demo ? state.highestLevel : 1);
  };

  // A kind, non-judgmental line for the end of a session.
  const kindLine = () => {
    const acc = state.tally.thrown ? state.tally.hit / state.tally.thrown : 0;
    if (state.mode === 'zen') return 'A calm session. Thank you for taking a moment for yourself.';
    if (state.falconHits > 0) return 'The falcon is a friend of the harvest. Next time, give it room.';
    if (state.score >= state.best && state.score > 0) return 'A lovely session, and your best yet.';
    if (acc >= 0.6) return 'Steady hands, steady eyes. Well played.';
    return 'Every shot is practice. Thanks for playing.';
  };
  const endRun = () => {
    state.scene = 'tally';
    state.aim = null;
    state.summary = kindLine();
    if (state.score > state.best && state.mode !== 'zen') {
      state.best = state.score;
      storage.set('best', state.best);
    }
    if (state.mode === 'daily' && state.daily.day !== day) {
      state.daily = { day, score: state.score, streak: state.daily.day === day - 1 ? state.daily.streak + 1 : 1 };
      storage.set('daily', state.daily);
    }
    monetization.track('run_end', { mode: state.mode, level: state.level, score: state.score });
    audio.tone({ freq: 440, to: 220, dur: 0.4, type: 'sine', vol: 0.2 });
  };

  const completeLevel = () => {
    state.lastStars = starsFor(state.stonesLeft);
    const woodBefore = woodFor(state.stars);
    const stoneBefore = stoneFor(state.stars);
    state.stars += state.lastStars;
    state.newWood = woodFor(state.stars) > woodBefore ? woodFor(state.stars) : -1;
    state.newStone = stoneFor(state.stars) > stoneBefore ? stoneFor(state.stars) : -1;
    storage.set('stars', state.stars);
    if (state.mode === 'campaign' && !demo && state.level + 1 > state.highestLevel) {
      state.highestLevel = state.level + 1;
      storage.set('highestLevel', state.highestLevel);
    }
    state.score += state.stonesLeft * 5;
    state.scene = 'levelclear';
    state.clearTimer = 2.4;
    state.aim = null;
    for (const f of [523, 659, 784]) audio.tone({ freq: f, dur: 0.14, type: 'triangle', vol: 0.2 });
  };

  const nextLevel = () => {
    if (state.restNote) { state.restNote = false; state.playTime = 0; }
    if (demo && state.level >= DEMO_LEVEL_LIMIT) {
      state.scene = 'demo-limit';
      return;
    }
    startLevel(state.level + 1);
  };

  const burst = (x, y, color, count, color2 = null) => {
    for (let i = 0; i < count; i++) {
      const a = playRng.range(0, Math.PI * 2);
      const sp = playRng.range(60, 240);
      state.particles.push({ x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 80, life: playRng.range(0.5, 1.1), rot: a, color: color2 && i % 2 ? color2 : color });
    }
  };

  const fire = () => {
    const pull = state.aim.pull;
    state.aim = null;
    if (pull.len < SLING.minPull || state.stonesLeft <= 0) return;
    const v = launchVelocity(pull);
    const wide = state.power === 'wide';
    state.power = null;
    const stone = { x: SLING.x, y: SLING.y, px: SLING.x, py: SLING.y, vx: v.vx, vy: v.vy, minMiss: 9999, hit: false, wide, trail: [], air: false, landed: false, landT: 0, missed: false };
    state.stones.push(stone);
    if (sfx) { const w = sfx.whoosh(pull.len / 220); if (w) whooshes.set(stone, w); }
    state.stonesLeft -= 1;
    state.tally.thrown += 1;
    state.snap = 0.18;
    audio.tone({ freq: 300, to: 900, dur: 0.12, type: 'sine', vol: 0.15 });
    audio.tone({ freq: 190, to: 80, dur: 0.22, type: 'triangle', vol: 0.12 });   // the release twang
  };

  // Pentatonic note for combo step k (rising as the streak builds).
  const comboNote = (k) => 523.25 * 2 ** ([0, 2, 4, 7, 9][k % 5] / 12) * (1 + Math.floor(k / 5));
  const feel = (stop, shake) => { if (state.calm) return; state.hitStop = Math.max(state.hitStop, stop); state.shake = Math.max(state.shake, shake); };

  const onHit = (stone, bird) => {
    stone.hit = true;
    const def = BIRDS[bird.type];
    const dmg = stone.wide ? 2 : 1;
    if (sfx) { sfx.cancel(whooshes.get(stone)); sfx.strike(bird.r, bird.type === 'bigcrow' || bird.type === 'hawk'); }   // ONE strike sound per hit, at the moment of impact
    state.missStreak = 0;
    state.duck = 0.5;
    const P = state.predator;
    if (P && P.target === bird.id && (P.phase === 'climb' || P.phase === 'stoop') && !P.carry) {   // STEAL: the player's stone beats the predator to its prey
      state.score += 75;
      state.popups.push({ x: bird.x, y: bird.y - 100, text: 'Steal! +75', life: 1.8, bad: false, size: 38, gold: true });
      burst(bird.x, bird.y, '#ffd75a', 18, '#ffffff');
      for (const f of [880, 1318, 1760]) audio.tone({ freq: f, dur: 0.16, type: 'triangle', vol: 0.15 });
      P.slipped = true; P.target = null;
    }
    if (bird.type === 'owl' && state.mode === 'zen') { bird.gone = true; state.popups.push({ x: bird.x, y: bird.y, text: 'Gently - that one is protected', life: 1.4, bad: false }); return; }
    if (bird.type === 'owl') {
      bird.gone = true;
      state.stonesLeft = Math.max(0, state.stonesLeft - OWL_STONE_PENALTY);
      state.combo = 0;
      state.score = Math.max(0, state.score + def.points);
      state.shots.push('owl');
      state.popups.push({ x: bird.x, y: bird.y, text: `Protected! -${OWL_STONE_PENALTY} stones`, life: 1.4, bad: true });
      burst(bird.x, bird.y, '#c9b38a', 8);
      audio.tone({ freq: 200, to: 120, dur: 0.3, type: 'sawtooth', vol: 0.18 });
      return;
    }
    if (bird.type === 'butterfly' && state.mode === 'zen') { bird.gone = true; state.popups.push({ x: bird.x, y: bird.y, text: 'Just a butterfly', life: 1.2, bad: false }); return; }
    if (bird.type === 'butterfly') {   // a decoy: harmless, but the stone is wasted
      bird.gone = true;
      state.stonesLeft = Math.max(0, state.stonesLeft - BUTTERFLY_STONE_PENALTY);
      state.combo = 0;
      state.shots.push('miss');
      state.popups.push({ x: bird.x, y: bird.y, text: `Just a butterfly! -${BUTTERFLY_STONE_PENALTY} stone`, life: 1.4, bad: true });
      burst(bird.x, bird.y, '#ffb35a', 8, '#8fd0ff');
      audio.tone({ freq: 330, to: 200, dur: 0.25, type: 'sine', vol: 0.14 });
      return;
    }
    // Tough birds (big crow, hawk) take several hits.
    bird.hp -= dmg;
    if (bird.hp > 0) {
      feel(0.09, 9);
      state.score += 15;
      state.popups.push({ x: bird.x, y: bird.y - 40, text: bird.type === 'hawk' ? `Hawk hit! ${bird.hp} left` : 'Tough one! Again!', life: 1.2, bad: false, size: 34, gold: true });
      burst(bird.x, bird.y, FEATHERS[bird.type]?.[0] ?? '#ffffff', 14, FEATHERS[bird.type]?.[1] ?? '#ffffff');
      if (bird.type === 'bigcrow') { bird.phase = 'dodging'; bird.dodged = true; bird.dodgeT = 3; bird.tx = bird.x + (stone.vx >= 0 ? -1 : 1) * 90; bird.ty = bird.y - 50; bird.t = 0; }
      return;
    }
    bird.gone = true; state.scareT = 1.3;
    if (bird.type === 'hawk') { state.bossDown = true; state.flash = 0.5; state.popups.push({ x: bird.x, y: bird.y - 90, text: 'The Hawk is beaten!', life: 2, bad: false, size: 40, gold: true }); }
    state.combo += 1;
    state.bestCombo = Math.max(state.bestCombo, state.combo);
    feel(bird.type === 'goldfinch' || bird.type === 'hawk' ? 0.14 : 0.06, Math.min(14, 4 + state.combo * 1.5 + (bird.type === 'goldfinch' ? 4 : 0)));   // a tiny freeze sells the impact
    const distance = Math.min(1, Math.hypot(bird.x - SLING.x, bird.y - SLING.y) / 1000);
    const moving = bird.phase === 'crossing' || bird.phase === 'darting' || bird.phase === 'hopping' || bird.phase === 'arriving' || bird.phase === 'swoop';
    const gained = Math.round(def.points * comboMultiplier(state.combo - 1) * (1 + distance * 0.5) * (moving ? 1.25 : 1));
    state.score += gained;
    state.hits += 1;
    state.tally.hit += 1;
    state.tally.byType[bird.type] = (state.tally.byType[bird.type] ?? 0) + 1;
    state.shots.push('hit');
    if (state.combo % 3 === 0) {
      state.stonesLeft += 1;
      state.popups.push({ x: SLING.x, y: SLING.y - 120, text: '+1 stone', life: 1.2, bad: false });
    }
    // Combo power-ups, kept simple: 5 in a row = the next stone is a Wide stone; 8 = a few seconds of slow time.
    if (state.combo === COMBO_WIDE || (state.combo > COMBO_WIDE && state.combo % 5 === 0)) {
      state.power = 'wide';
      state.popups.push({ x: SLING.x, y: SLING.y - 170, text: 'Wide stone ready!', life: 1.6, bad: false, size: 34, gold: true });
      audio.tone({ freq: 784, dur: 0.2, type: 'triangle', vol: 0.16 });
    }
    if (state.combo === COMBO_SLOW || (state.combo > COMBO_SLOW && state.combo % 8 === 0)) {
      state.slowT = SLOW_TIME;
      state.popups.push({ x: SLING.x, y: SLING.y - 220, text: 'Slow time!', life: 1.6, bad: false, size: 34, gold: true });
      audio.tone({ freq: 392, to: 196, dur: 0.5, type: 'sine', vol: 0.14 });
    }
    if (bird.type === 'goldfinch') {
      state.stonesLeft += GOLDFINCH_STONES;
      if (!state.calm) state.flash = 0.35;
      state.popups.push({ x: bird.x, y: bird.y - 80, text: `Golden finch! +${GOLDFINCH_STONES} stones`, life: 1.6, bad: false, size: 36, gold: true });
      burst(bird.x, bird.y, '#ffd75a', 22, '#fff3b0');
      for (const f of [659, 880, 1175]) audio.tone({ freq: f, dur: 0.18, type: 'triangle', vol: 0.2 });
    }
    // Popups grow with the combo so a streak feels like it is building.
    state.popups.push({ x: bird.x, y: bird.y - 30, text: `+${gained}${state.combo > 1 ? `  x${comboMultiplier(state.combo - 1)}` : ''}`, life: 1.1, bad: false, size: 30 + Math.min(state.combo, 6) * 3 });
    burst(bird.x, bird.y, FEATHERS[bird.type]?.[0] ?? '#ffffff', 12, FEATHERS[bird.type]?.[1] ?? '#ffffff');
    audio.tone({ freq: comboNote(state.combo - 1), dur: 0.22, type: 'triangle', vol: 0.2 });      // the rising combo note
  };

  const onMiss = (stone) => {
    state.combo = 0;
    state.missStreak += 1;
    state.shots.push('miss');
    audio.tone({ freq: 260, to: 160, dur: 0.16, type: 'sine', vol: 0.12 });
    void stone;
  };

  // ---- Predator hooks (predator.js) -------------------------------------------------------------------------------------
  const later = (t, p) => state.sfxQ.push({ t, p });
  const cawVolley = (n) => { for (let i = 0; i < n; i++) later(i * 0.17, { freq: 250 - i * 14, to: 150, dur: 0.1, type: 'sawtooth', vol: 0.05 }); };
  const hunthooks = {
    calm: () => state.calm,
    toast: (text) => state.popups.push({ x: V.WW / 2, y: V.top + 120, text, life: 1.7, bad: false, size: 38, gold: true }),
    cue: (kind, what) => {
      if (what === 'screech') {
        if (kind === 'falcon') { audio.tone({ freq: 2100, to: 3500, dur: 0.2, type: 'triangle', vol: 0.07 }); later(0.2, { freq: 3500, to: 1900, dur: 0.28, type: 'triangle', vol: 0.06 }); }
        else { audio.tone({ freq: 1500, to: 950, dur: 0.4, type: 'sawtooth', vol: 0.05 }); later(0.35, { freq: 1300, to: 800, dur: 0.4, type: 'sawtooth', vol: 0.045 }); }
      } else if (what === 'whistle') audio.tone({ freq: 2600, to: 900, dur: 0.35, type: 'sine', vol: 0.035 });   // wind in the folded wings
      else if (what === 'kak') { for (let i = 0; i < 3; i++) later(i * 0.11, { freq: 1900 - i * 120, to: 1300, dur: 0.06, type: 'square', vol: 0.03 }); }
      else if (what === 'caws') cawVolley(4);
      else if (what === 'caw') cawVolley(1);
    },
    nervous: (S) => {   // birds near a falcon that has locked on get nervous: some hop away, some leave
      for (const b of state.birds) if (b.phase === 'perched' && b.type !== 'owl' && b.type !== 'crow' && b.id !== S.target && Math.hypot(b.x - S.x, b.y - S.y) < 320 && playRng.chance(0.4)) startle(b, playRng, state.world, state.birds);
    },
    // The alarm ripples through the flock. Birds sitting low (fence, hay sheaves, scarecrow: the crop) take off and fly OFF the field: they count as scared off
    // by the predator at half value (at most 3 per hunt) and the crop is guarded while they flee; the rest hop away or leave. Crows hold their ground (and mob).
    flush: (x, exceptId) => {
      let n = 0, credited = 0;
      for (const b of state.birds) {
        if (b.id === exceptId || b.phase !== 'perched' || b.type === 'owl' || b.type === 'crow' || Math.abs(b.x - x) > V.WW * (b.y > V.hy - 190 ? 0.75 : 0.4)) continue;   // the crop birds flee from farther away
        if (b.y > V.hy - 190 && state.hunt && state.hunt.credit < 3 && b.type !== 'butterfly') {
          const def = BIRDS[b.type];
          leave(b, playRng); b.fled = true; state.hunt.credit += 1; credited += 1; n += 1;
          state.hits += 1; state.score += Math.round(def.points * PRED.CATCH_VALUE);
          state.tally.byType['by hunt'] = (state.tally.byType['by hunt'] ?? 0) + 1;
          state.popups.push({ x: b.x, y: b.y - 40, text: 'Scared off!', life: 1.1, bad: false, size: 24 });
          burst(b.x, b.y, FEATHERS[b.type]?.[0] ?? '#ffffff', 8, FEATHERS[b.type]?.[1] ?? '#ffffff');
        } else if (playRng.chance(0.55)) { startle(b, playRng, state.world, state.birds); n += 1; }
      }
      if (credited) state.guardT = Math.max(state.guardT, 4);
      if (n) for (let i = 0; i < 5; i++) later(i * 0.05, { freq: 3500 + i * 420, dur: 0.05, type: 'square', vol: 0.012 });   // wings clapping
    },
    caught: (bird, P) => {
      const def = BIRDS[bird.type];
      state.scareT = 1.3;
      state.hits += 1;                       // it counts toward the quota, but at half value: no combo, no stone refund, not a stone hit
      state.score += Math.round(def.points * PRED.CATCH_VALUE);
      state.tally.byType['by ' + P.kind] = (state.tally.byType['by ' + P.kind] ?? 0) + 1;
      state.guardT = PRED.GUARD_TIME;        // the crop is guarded for a few seconds
      state.popups.push({ x: bird.x, y: bird.y - 30, text: `+${Math.round(def.points * PRED.CATCH_VALUE)}  caught!`, life: 1.2, bad: false, size: 28 });
      state.popups.push({ x: bird.x, y: bird.y - 74, text: 'Falcon helps!', life: 1.5, bad: false, size: 30, gold: true });
      burst(bird.x, bird.y, '#fff3b0', 10, '#ffd75a');   // a small golden shimmer
      burst(bird.x, bird.y, FEATHERS[bird.type]?.[0] ?? '#ffffff', 14, FEATHERS[bird.type]?.[1] ?? '#ffffff');
      feel(0.1, 4);   // the strike's brief hit-pause
      audio.tone({ freq: 220, to: 90, dur: 0.16, type: 'sine', vol: 0.18 });
    },
  };

  // HITTING THE PREDATOR is a mistake (owner decision): it flinches, abandons the hunt and the helper effect is lost; birds come back to the harvest and the
  // penalty escalates with every repeat in the run (reset per run; deterministic: extra birds come from the seeded stream).
  const PENALTY = [null, { pts: 50, birds: 3, k: 1.5, t: 6, stone: 0 }, { pts: 100, birds: 4, k: 2, t: 8, stone: 1 }];
  const onPredatorHit = (stone, P0, sitter = null) => {
    stone.hit = true;
    const P = sitter ? { ...sitterBody(sitter), kind: sitter.kind } : P0;
    for (const s of state.sitters) s.watch = true;   // the other falcons become watchful and strike sooner
    state.falconHits += 1;
    const n = state.falconHits, pen = PENALTY[Math.min(n, 3)] ?? { pts: Math.min(300, 150 + 50 * (n - 3)), birds: 5, k: 2.5, t: 10, stone: 1 };
    const pts = n >= 3 ? Math.min(300, 150 + 50 * (n - 3)) : pen.pts;
    state.score = Math.max(0, state.score - pts);
    state.combo = 0; state.shots.push('miss');
    if (pen.stone && state.stonesLeft > 2) state.stonesLeft -= 1;
    state.drainK = pen.k; state.drainT = pen.t;
    if (n >= 3) state.avoidNext = true;
    state.guardT = 0;
    state.popups.push({ x: V.WW / 2, y: Math.max(P.y - 60, V.top + 190), text: n === 1 ? 'Oops! The falcon was helping - birds return!' : `Falcon hit again (-${pts})`, life: 2.4, bad: true, size: n === 1 ? 26 : 30 });
    burst(P.x, P.y, P.kind === 'falcon' ? '#4f6379' : '#7b5432', 14, '#e9eef3');
    feel(0.08, 6);
    if (sfx) { sfx.cancel(whooshes.get(stone)); sfx.flinch(); }
    // the predator tumbles a short way, then flies off high; the hunt is over for this level
    if (sitter) { sitter.state = 'tumble'; sitter.vy = -160; sitter.spin = 0; }
    else { P0.phase = 'flinch'; P0.t = 0; P0.strike = false; P0.carry = null; P0.target = null; P0.hist.length = 0; P0.spin = 0; if (!P0.sitter && state.hunt) state.hunt.left = 0; }
    // fleeing birds return to the harvest...
    const used = new Set(state.birds.filter((b) => !b.gone && b.perch >= 0).map((b) => b.perch));
    const free = state.world.perches.map((p, i) => i).filter((i) => !used.has(i));
    for (const b of state.birds) if (b.fled && !b.gone && free.length) { b.perch = free.splice(playRng.int(free.length), 1)[0]; b.phase = 'hopping'; b.fled = false; }
    // ...and a wave of extra birds swoops onto the crop (low perches first)
    const low = free.filter((i) => state.world.perches[i].y > V.hy - 190);
    const alive = state.birds.filter((b) => !b.gone).length;
    for (let i = 0; i < Math.min(pen.birds, 28 - alive); i++) {
      const type = pickBirdType(playRng, state.spec, true, true);
      const b = spawnBird(playRng, type === 'butterfly' ? 'sparrow' : type, state.world, state.birds, state.spec.speed, state.nextBirdId);
      if (!b) continue;
      if (b.perch >= 0) { const pool = low.length ? low : free; if (pool.length) { const k = pool.splice(playRng.int(pool.length), 1)[0]; b.perch = k; const li = low.indexOf(k); if (li >= 0) low.splice(li, 1); } }
      state.nextBirdId += 1; state.birds.push(b);
    }
  };

  const updatePlaying = (dt0, input) => {
    let dt = dt0;
    if (state.hitStop > 0) { state.hitStop = Math.max(0, state.hitStop - dt0); dt = dt0 * 0.12; }   // hit-stop: the world nearly freezes for a beat
    state.shake = Math.max(0, state.shake - dt0 * 22);
    state.flash = Math.max(0, state.flash - dt0);
    state.time += dt;
    const spec = state.spec;
    ambient(dt, spec.gusty ? state.wind * (0.6 + 0.4 * Math.sin(state.time * 0.9)) : state.wind);
    const wind = spec.gusty ? state.wind * (0.6 + 0.4 * Math.sin(state.time * 0.9)) : state.wind;

    // --- aiming
    state.playTime += dt0; state.scareT = Math.max(0, state.scareT - dt0);
    if (state.playTime > 1200 && state.mode !== 'zen') state.restNote = true;   // ~20 minutes of play: one gentle suggestion to rest the eyes (never repeated until dismissed)
    const { pointer } = input, L = cur;
    if (state.mode === 'zen' && pointer.pressed && hit(L.btn.zenDone, pointer.x, pointer.y)) { endRun(); return; }
    const wx = pointer.x / V.z, wy = pointer.y / V.z;   // the finger in world units
    if (pointer.pressed) {
      if (hit(L.btn.menu, pointer.x, pointer.y)) { state.aim = null; state.scene = 'title'; return; }   // standalone has no host Back: leave the level from here
      else if (hit(L.btn.playColors, pointer.x, pointer.y)) cycleScheme();
      else if (hit(L.btn.sound, pointer.x, pointer.y)) toggleMute();
      else if (wy >= SLING.dragZoneTop && state.stonesLeft > 0) state.aim = { sx: wx, sy: wy, pull: { x: 0, y: 0, len: 0 } };
    }
    if (state.aim && !state.aim.kbd) {
      if (pointer.down) state.aim.pull = clampPull(state.aim.sx - wx, state.aim.sy - wy);
      if (pointer.released || !pointer.down) fire();
    }
    // Desktop keyboard: arrows turn / change power (the guide shows the shot), Space fires.
    if (state.stonesLeft > 0 && !(state.aim && !state.aim.kbd)) {
      const held = input.keys.down;
      const turn = (held.has('ArrowRight') ? 1 : 0) - (held.has('ArrowLeft') ? 1 : 0);
      const power = (held.has('ArrowUp') ? 1 : 0) - (held.has('ArrowDown') ? 1 : 0);
      const k = state.kbdAim;
      if (turn || power) {
        k.angle = Math.max(-Math.PI + 0.15, Math.min(-0.15, k.angle + turn * 1.3 * dt));
        k.power = Math.max(SLING.minPull + 8, Math.min(SLING.maxPull, k.power + power * 150 * dt));
        state.aim = { sx: 0, sy: 0, kbd: true, pull: { x: Math.cos(k.angle) * k.power, y: Math.sin(k.angle) * k.power, len: k.power } };
      }
      if (input.keys.pressed.has('Space') && (state.aim && state.aim.kbd)) fire();
    }
    state.snap = Math.max(0, state.snap - dt);
    // Band creak: a soft rising tone (at most one per 0.15 s) while the pouch is pulled back.
    state.creakTimer = Math.max(0, state.creakTimer - dt);
    if (state.aim && state.aim.pull.len >= SLING.minPull && state.creakTimer === 0) {
      audio.tone({ freq: 120 + state.aim.pull.len * 2.4, dur: 0.09, type: 'sawtooth', vol: 0.05 });
      state.creakTimer = 0.15;
    }

    // --- birds
    const alive = state.birds.filter((b) => !b.gone);
    state.spawnTimer -= dt;
    if (state.spawnTimer <= 0 && alive.length < spec.maxBirds) {
      const type = pickBirdType(playRng, spec, alive.some((b) => b.type === 'owl'), alive.some((b) => b.type === 'goldfinch'));
      const herdK = type === 'crow' && spec.n >= 7 && !alive.some((b) => b.herd) ? Math.min(14, Math.max(2, Math.round(2 + (spec.n - 6) * 0.25 + (fieldF() - 1) * 1))) : 0;
      const room = Math.min(28, spec.maxBirds + 3 + Math.round((fieldF() - 1) * 4)) - alive.length;
      if (herdK >= 2 && room >= 2) {   // crows come in herds: they arrive together from one side and settle together
        const edge = playRng.chance(0.5) ? -1 : 1, gid = state.nextBirdId;
        for (let i = 0; i < Math.min(herdK, room); i++) {
          const b = spawnBird(playRng, 'crow', state.world, state.birds, spec.speed, state.nextBirdId);
          if (!b) break;
          state.nextBirdId += 1; b.herd = gid; b.x = edge < 0 ? -60 - i * 45 : V.WW + 60 + i * 45;
          state.birds.push(b);
        }
      } else {
        const bird = spawnBird(playRng, type, state.world, state.birds, spec.speed, state.nextBirdId);
        if (bird) {
          state.nextBirdId += 1;
          state.birds.push(bird);
        }
      }
      state.spawnTimer = playRng.range(0.7, 1.6) / (spec.speed * (spec.spawnK ?? 1));
    }
    state.slowT = Math.max(0, state.slowT - dt0);
    state.drainT = Math.max(0, state.drainT - dt0);
    for (const q of state.sfxQ) q.t -= dt0;
    for (const q of state.sfxQ) if (q.t <= 0) audio.tone(q.p);
    state.sfxQ = state.sfxQ.filter((q) => q.t > 0);
    const bdt = state.slowT > 0 ? dt * 0.5 : dt;   // slow time: the birds move at half speed
    for (const bird of state.birds) updateBird(bird, bdt, playRng, state.world, state.birds, state.time, spec.speed);

    if (state.predator && (state.predator.phase === 'telegraph' || state.predator.phase === 'climb')) state.duck = Math.max(state.duck, 0.3);   // the field goes quiet
    updatePredator(state, bdt, playRng, hunthooks);
    updateSitters(state, bdt, playRng, hunthooks);

    // --- stones
    for (const stone of state.stones) {
      if (stone.trail) { stone.trail.push({ x: stone.x, y: stone.y }); if (stone.trail.length > 12) stone.trail.shift(); }
      if (!stone.landed) stepStone(stone, dt, wind);
      for (const bird of state.birds) {
        if (!isTarget(bird) || stone.hit) continue;
        if (maybeDodge(bird, stone)) continue;
        if (segmentHitsCircle(stone.px, stone.py, stone.x, stone.y, bird.x, bird.y, bird.r + (stone.wide ? WIDE_STONE_R : STONE_R))) onHit(stone, bird);
        else stone.minMiss = Math.min(stone.minMiss, distanceToSegment(stone.px, stone.py, stone.x, stone.y, bird.x, bird.y));
      }
      const PD = state.predator;
      if (!stone.hit && PD && (PD.phase === 'climb' || PD.phase === 'stoop' || PD.phase === 'pullup' || PD.phase === 'leave' || PD.phase === 'mobbed') && PD.x > 0 && PD.x < V.WW && PD.y > 0 && PD.y < V.WH
        && segmentHitsCircle(stone.px, stone.py, stone.x, stone.y, PD.x, PD.y, (PD.kind === 'falcon' ? 34 : 40) + (stone.wide ? WIDE_STONE_R : STONE_R))) onPredatorHit(stone, PD);   // body hitbox: generous but inside the sprite
      if (!stone.hit) for (const S of state.sitters) if ((S.state === 'perched' || S.state === 'lock')) { const bd = sitterBody(S); if (segmentHitsCircle(stone.px, stone.py, stone.x, stone.y, bd.x, bd.y, (S.kind === 'falcon' ? 30 : 34) + (stone.wide ? WIDE_STONE_R : STONE_R))) { onPredatorHit(stone, null, S); break; } }
      if (!stone.hit) {
        for (const bird of state.birds) {
          if (bird.phase === 'perched' && distanceToSegment(stone.px, stone.py, stone.x, stone.y, bird.x, bird.y) < STARTLE_RADIUS && stone.vy > -200) {
            startle(bird, playRng, state.world, state.birds);
            if (bird.herd && bird.phase !== 'perched') for (const o of state.birds) if (o.herd === bird.herd && o.phase === 'perched') startle(o, playRng, state.world, state.birds);   // a herd takes off together
          }
        }
      }
      // The ground: a stone that has been up in the air and comes back down to the field line lands there (one thud, no rolling), stays a moment, then is gone.
      const gy = V.hy + 120;
      if (stone.y < gy) stone.air = true;
      if (!stone.hit && !stone.landed && stone.air && stone.vy > 0 && stone.y >= gy) {
        const impact = Math.hypot(stone.vx, stone.vy);
        stone.landed = true; stone.landT = 0.35; stone.y = gy; stone.vx = 0; stone.vy = 0;
        if (sfx) { sfx.cancel(whooshes.get(stone)); sfx.ground(impact, stone.wide); }
        if (!stone.missed) { stone.missed = true; onMiss(stone); }
      }
      if (stone.landed) stone.landT -= dt;
      stone.done = stone.hit || (stone.landed && stone.landT <= 0) || stone.y > V.WH + 40 || stone.x < -60 || stone.x > V.WW + 60;
      if (stone.done && !stone.hit && !stone.missed) { stone.missed = true; sfx?.cancel(whooshes.get(stone)); onMiss(stone); }
    }
    state.stones = state.stones.filter((s) => !s.done);
    state.birds = state.birds.filter((b) => !b.gone);

    // --- particles / popups
    for (const p of state.particles) {
      p.vy += 420 * dt;
      p.vx *= 1 - dt * 1.5;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.rot += dt * 6;
      p.life -= dt;
    }
    state.particles = state.particles.filter((p) => p.life > 0);
    for (const p of state.popups) {
      p.y -= 46 * dt;
      p.life -= dt;
    }
    state.popups = state.popups.filter((p) => p.life > 0);

    // --- crop + end conditions
    if (spec.n >= CROP_DRAIN_FROM_LEVEL && state.mode !== 'daily' && state.mode !== 'zen' && !spec.boss && state.guardT <= 0) {
      state.crop = Math.max(0, state.crop - state.birds.filter(isPerchedPest).length * CROP_DRAIN_PER_BIRD * dt / Math.sqrt(spec.F ?? 1) * (state.drainT > 0 ? state.drainK : 1));
    }
    if (state.hits >= spec.quota || state.bossDown) completeLevel();
    else if (state.crop <= 0 || (state.stonesLeft <= 0 && state.stones.length === 0 && !state.aim)) endRun();
  };

  // ---- Music: an original soft pastoral loop (C major pentatonic), played note by note with audio.tone so it follows the sound button's mute,
  // needs no assets and is silent in headless runs. It is driven by real time (not the simulation), and ducks for half a second after a hit.
  const SCALE = [0, 2, 4, 7, 9];
  const MELODY = [0, 2, 4, 2, 3, -1, 2, 0, 4, 3, 2, -1, 5, 4, 2, 1, 0, -1, 2, 4, 5, 4, 3, 2, 1, 2, 0, -1, -1, 4, 2, 0];
  const ROOTS = [0, -3, -5, -3];
  let beatT = 0.3, beatN = 0;
  const music = (dt) => {
    if (!['title', 'playing', 'levelclear', 'tally'].includes(state.scene)) return;
    state.duck = Math.max(0, state.duck - dt);
    beatT -= dt;
    if (beatT > 0) return;
    beatT += 0.7;
    const root = ROOTS[Math.floor(beatN / 8) % 4], d = state.duck > 0 ? 0.35 : 1, f = (semi) => 261.63 * 2 ** ((semi + root) / 12);
    const deg = MELODY[beatN % MELODY.length];
    if (deg >= 0) audio.tone({ freq: f(SCALE[deg % 5] + 12 * Math.floor(deg / 5)), dur: 1.0, type: 'sine', vol: 0.032 * d });
    if (beatN % 4 === 0) audio.tone({ freq: f(-12), dur: 1.6, type: 'sine', vol: 0.04 * d });
    if (beatN % 8 === 0) { audio.tone({ freq: f(-5), dur: 3.2, type: 'triangle', vol: 0.014 * d }); audio.tone({ freq: f(4), dur: 3.2, type: 'triangle', vol: 0.011 * d }); }
    beatN += 1;
  };

  function toggleMute() {
    state.muted = !state.muted;
    audio.setMuted(state.muted);
    storage.set('muted', state.muted);
  }

  // Ambient sound per world (birdsong) + wind, from audio.tone only. Timing comes from a small integer
  // hash of a counter kept in state, never from playRng, so it cannot disturb the simulation.
  const CHIRPS = { wheat: [3400, 4000, 0.07, 'sine'], rice: [1500, 1050, 0.2, 'sine'], orchard: [900, 700, 0.26, 'sine'], savanna: [320, 250, 0.32, 'triangle'], snow: [2500, 2800, 0.05, 'sine'] };
  const hash01 = (n) => ((Math.imul(n + 1, 2654435761) >>> 0) % 100000) / 100000;
  const ambient = (dt, wind) => {
    state.chirpTimer -= dt;
    if (state.chirpTimer <= 0) {
      state.chirpN += 1;
      const r = hash01(state.chirpN * 31 + state.level);
      const [from, to, dur, type] = CHIRPS[state.world?.world] ?? CHIRPS.wheat;
      audio.tone({ freq: from * (0.93 + r * 0.14), to, dur, type, vol: 0.045 });
      state.chirpTimer = 2.5 + hash01(state.chirpN * 17 + 3) * 3.5;
    }
    state.windTimer -= dt;
    if (Math.abs(wind) >= 60 && state.windTimer <= 0) {
      audio.tone({ freq: 80 + Math.abs(wind) * 0.5, dur: 0.55, type: 'triangle', vol: 0.025 });
      state.windTimer = 0.6;
    }
  };

  const shareText = () => {
    const acc = state.tally.thrown ? Math.round((state.tally.hit / state.tally.thrown) * 100) : 0;
    const marks = state.shots.map((s) => (s === 'hit' ? '🟩' : s === 'owl' ? '🟥' : '⬜'));
    const rows = [];
    for (let i = 0; i < marks.length; i += 10) rows.push(marks.slice(i, i + 10).join(''));
    const head = state.mode === 'daily' ? `Golden Sling Daily Hunt · day ${day} · ${['golden wheat', 'rice terraces', 'mango orchard', 'savanna', 'snowy village'][day % 5]}` : `Golden Sling · level ${state.level}`;
    return `${head}\n${state.score} pts · ${acc}% accuracy · best combo ${state.bestCombo}\n${rows.join('\n')}\n${SHARE_URL}`;
  };

  function cycleScheme() {
    state.scheme = (state.scheme + 1) % SCHEMES.length;
    storage.set('scheme', state.scheme);
  }

  const updateTitle = (input) => {
    if (!input.pointer.pressed) return;
    const { x, y } = input.pointer, B = cur.title.hit;
    if (hit(B.colors, x, y)) cycleScheme();
    else if (hit(B.soundTitle, x, y)) toggleMute();
    else if (hit(B.calm, x, y)) {   // cycles: off -> Calm (less shake) -> Calm + breathe -> off
      const next = !state.calm ? [true, false] : !state.breathe ? [true, true] : [false, false];
      [state.calm, state.breathe] = next; storage.set('calm', state.calm); storage.set('breathe', state.breathe);
      if (state.calm) { state.shake = 0; state.hitStop = 0; state.flash = 0; }
    }
    else if (hit(B.zen, x, y)) { if (!demo) { state.restNote = false; startRun('zen'); } }
    else if (hit(B.rules, x, y)) {
      state.rulesPage = 0;
      state.rulesScroll = 0;
      drag = null;
      state.scene = 'rules';
    } else if (hit(B.daily, x, y)) {
      if (!demo && state.daily.day !== day) startRun('daily');
    } else if (hit(B.endless, x, y)) {
      if (!demo) startRun('endless');
    }
    else if (hit(B.auto, x, y)) startAutoplay();
    else if (hit(B.play, x, y)) startRun('campaign');
  };

  // Rules: Back / Next / text size, and a scrolling body (drag, wheel, keys, scroll bar). Pages that fit never move.
  let drag = null;
  const updateRules = (input) => {
    const RL = cur.rules, p = input.pointer, keys = input.keys.pressed;
    const max = () => rulesMetrics.max;
    const setScroll = (v) => { state.rulesScroll = Math.max(0, Math.min(v, max())); };
    if (wheelInput.dy) { setScroll(state.rulesScroll + wheelInput.dy); wheelInput.dy = 0; }
    if (keys.has('ArrowDown')) setScroll(state.rulesScroll + 70);
    if (keys.has('ArrowUp')) setScroll(state.rulesScroll - 70);
    if (keys.has('PageDown')) setScroll(state.rulesScroll + rulesMetrics.view * 0.9);
    if (keys.has('PageUp')) setScroll(state.rulesScroll - rulesMetrics.view * 0.9);
    if (keys.has('Home')) setScroll(0);
    if (keys.has('End')) setScroll(max());
    if (p.pressed) {
      if (hit(RL.scrollbar, p.x, p.y)) drag = { bar: true };
      else if (hit(RL.viewport, p.x, p.y)) drag = { y0: p.y, s0: state.rulesScroll };
    }
    if (drag) {
      if (!p.down) drag = null;
      else if (drag.bar) setScroll(((p.y - RL.scrollbar.y) / RL.scrollbar.h) * max());
      else setScroll(drag.s0 - (p.y - drag.y0));
    }
    state.rulesScroll = Math.max(0, Math.min(state.rulesScroll, max()));
    if (!p.pressed) return;
    const { x, y } = p;
    if (hit(RL.back, x, y)) { state.rulesScroll = 0; state.rulesPage = 0; state.scene = 'title'; }
    else if (hit(RL.next, x, y)) {
      if (max() <= 0 || state.rulesScroll >= max() - 1) { state.scene = 'title'; state.rulesPage = 0; state.rulesScroll = 0; }
      else setScroll(state.rulesScroll + rulesMetrics.view * 0.85);
    }
    else if (hit(RL.dec, x, y) && state.textScaleIdx > 0) { state.textScaleIdx--; state.rulesScroll = 0; storage.set('textScaleIdx', state.textScaleIdx); }
    else if (hit(RL.inc, x, y) && state.textScaleIdx < TEXT_SCALES.length - 1) { state.textScaleIdx++; state.rulesScroll = 0; storage.set('textScaleIdx', state.textScaleIdx); }
  };

  // ---- Auto Play: a free, silent, whole-run THINK -> REVEAL -> ACT demonstration ------------------
  // Decision-point unit: one SHOT (a genre adaptation - see tuning.js's own note on why THINK/REVEAL
  // are scaled down for this fast, continuous action game rather than reusing the board games'
  // timings verbatim). The game being watched is an entirely separate `createGame()` instance with
  // its own no-op storage/audio/monetization - exactly like the other autoplay-pro games' separate
  // demo/chapter instances - so the real player's save, stats and stars are never touched, and the
  // instance's own silence is automatic (a no-op `audio.tone` needs no per-call guard anywhere).
  // Aiming reuses physics.js's own `aimAt()` (already written for "any future assist/tutorial
  // ghost"); firing reuses the real input contract verbatim: setting `apState.aim` directly and
  // then resuming ticks makes the instance's own `fire()` run exactly as it would for a real drag,
  // because a resumed idle input has `pointer.down === false`, which is exactly the release
  // condition `updatePlaying` already checks.
  function apNoopStorage() { return { get: async (k, d) => d, set: async () => {}, remove: async () => {} }; }
  function startAutoplay() {
    apGame = createGame({
      rng: rng.fork(), storage: apNoopStorage(), audio: { tone: () => {}, setMuted: () => {} },
      monetization: { track: () => {} }, config: { ...config, demo: false }, manifest: env.manifest, silent: true,
      share: async () => ({ shared: false }), openGame: () => {},
    });
    // Tap "Play" on its own fresh title screen - the same real path a player's first tap takes.
    const pb = layoutFor(meta.width, meta.height).title.hit.play;
    apGame.update(1 / 60, { pointer: { x: pb.x + 5, y: pb.y + 5, down: true, pressed: true, released: false }, keys: { down: new Set(), pressed: new Set() } });
    apGame.update(1 / 60, AP_IDLE);
    state.ap = { phase: 'idle', t: 0, chosen: null, paused: false };
    state.scene = 'autoplay';
  }
  function exitAutoplay() { apGame = null; state.scene = 'title'; }
  function updateAutoplay(dt, input) {
    const A = state.ap, p = input.pointer, L = cur, AP = L.ap;
    if (A.phase === 'finished') {
      // The finished state renders the shadow apGame's own real tally screen underneath the Auto
      // Play control band (drawAutoplay() in render.js), chips included - so a player sees the
      // exact same "More from Arcforge" row a real session's tally shows. Wire the chip taps up
      // the same way the real tally scene does (env.openGame doesn't depend on any real-vs-shadow
      // session state, unlike Share, which is deliberately left inert here - see STATUS.md).
      if (p.pressed) {
        if (hit(L.tally.hit.again, p.x, p.y)) startAutoplay();
        else if (hit(L.tally.hit.home, p.x, p.y)) exitAutoplay();
        else SIBLINGS.forEach((g, i) => hit(L.tally.hit.chips[i], p.x, p.y) && env.openGame(g.slug));
      }
      return;
    }
    if (p.pressed) {
      if (hit(AP.exit, p.x, p.y)) { exitAutoplay(); return; }
      if (hit(AP.dec, p.x, p.y) && state.apThinkIdx > 0) { state.apThinkIdx--; storage.set('apThinkIdx', state.apThinkIdx); }
      else if (hit(AP.inc, p.x, p.y) && state.apThinkIdx < AP_THINK_STEPS.length - 1) { state.apThinkIdx++; storage.set('apThinkIdx', state.apThinkIdx); }
      else if (hit(AP.pause, p.x, p.y)) A.paused = !A.paused;
    }
    if (A.paused) return;
    const skip = p.pressed && hit(AP.skip, p.x, p.y);
    const apState = apGame.getState();
    if (apState.scene === 'tally') { A.phase = 'finished'; A.t = 0; return; }   // one whole run is the natural end for this endless game
    if (apState.scene !== 'playing') { apGame.update(dt, AP_IDLE); return; }    // 'levelclear' auto-advances on its own real timer
    if (A.phase === 'idle') {
      apGame.update(dt, AP_IDLE);                                              // the field keeps living until there is something to shoot at
      if (apState.stonesLeft > 0) { const shot = apPickShot(apState); if (shot) { A.chosen = shot; A.phase = 'think'; A.t = 0; } }
      return;
    }
    if (A.phase === 'think') {
      A.t += dt; if (skip) A.t = AP_THINK_STEPS[state.apThinkIdx];
      if (A.t >= AP_THINK_STEPS[state.apThinkIdx]) { apState.aim = { sx: SLING.x, sy: SLING.y, pull: A.chosen.pull }; A.phase = 'reveal'; A.t = 0; }
      return;
    }
    if (A.phase === 'reveal') {
      A.t += dt; if (skip) A.t = AP_REVEAL_TIME;
      if (A.t >= AP_REVEAL_TIME) { A.phase = 'act'; apGame.update(1 / 60, AP_IDLE); }   // an idle tick with `aim` set fires it (pointer.down is false)
      return;
    }
    if (A.phase === 'act') {
      const steps = skip ? 6 : 1;
      for (let i = 0; i < steps; i++) {
        apGame.update(1 / 60, AP_IDLE);
        const s2 = apGame.getState();
        if (s2.scene !== 'playing' || s2.stones.length === 0) { A.phase = 'idle'; A.t = 0; A.chosen = null; break; }
      }
    }
  }

  return {
    update(dt, input) {
      lay();
      if (state.scene === 'title' && state.restNote) { state.restNote = false; state.playTime = 0; }
      music(dt);
    if (state.scene === 'playing' && !state.calm) {   // rare, soft ambience: a dog that barks twice now and then, and wind chimes (short one-shots, no loops)
      state.dogT = (state.dogT ?? 55) - dt; state.chimeT = (state.chimeT ?? 90) - dt;
      if (state.dogT <= 0) { state.dogT = 75 + (state.time * 7 % 40); for (let i = 0; i < 2; i++) later(i * 0.28, { freq: 420 - i * 30, to: 230, dur: 0.1, type: 'square', vol: 0.025 }); }
      if (state.chimeT <= 0) { state.chimeT = 100 + (state.time * 13 % 60); [0, 2, 4, 7].forEach((d, i) => later(i * 0.23 + (d % 3) * 0.04, { freq: 1046.5 * 2 ** (d / 12), dur: 0.9, type: 'sine', vol: 0.014 })); }
    }
    if (state.breathe) state.breatheT += dt;
      if (sfx) { sfx.tick(); if (state.scene !== 'playing' && sfx.active() > 0) sfx.stopAll(); }   // leaving the game screen silences every effect within 60 ms
      if (state.scene === 'playing') updatePlaying(dt, input);
      else if (state.scene === 'title') updateTitle(input);
      else if (state.scene === 'rules') updateRules(input);
      else if (state.scene === 'autoplay') updateAutoplay(dt, input);
      else if (state.scene === 'levelclear') {
        state.time += dt;
        state.clearTimer -= dt;
        if (state.clearTimer <= 0 || (input.pointer.pressed && state.clearTimer < 1.6)) nextLevel();
      } else if (state.scene === 'tally') {
        if (input.pointer.pressed) {
          const { x, y } = input.pointer;
          const TH = cur.tally.hit;
          if (hit(TH.again, x, y)) startRun(state.mode === 'daily' ? 'campaign' : state.mode);
          else if (hit(TH.home, x, y)) state.scene = 'title';
          else if (hit(TH.share, x, y)) {
            state.shareNote = '';
            env.share(shareText()).then((r) => {
              state.shareNote = r && r.copied ? 'Copied!' : '';
            });
          } else SIBLINGS.forEach((g, i) => hit(TH.chips[i], x, y) && env.openGame(g.slug));
        }
      }
      // 'demo-limit': deliberate no-op.
    },
    render(ctx) {
      drawGame(ctx, state, env.manifest, day, apGame, lay());
    },
    getState() {
      return state;
    },
    unlockSfx: () => sfx?.unlock(),
    debugSfx: () => sfx,
    debugAutoplay: () => apGame,   // check scripts only (the shadow game behind Auto Play)
  };
}
