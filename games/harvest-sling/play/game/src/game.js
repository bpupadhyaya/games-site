// GAME CONTRACT (docs/GAME-CONTRACT.md): meta + createGame(env) -> { update, render, getState }.
// Golden Sling - guard the harvest with a slingshot. Design: design/GDD.md. This file owns
// scenes, state and input; numbers live in tuning.js, flight in physics.js, bird behaviour in
// birds.js, scene generation in levels.js and every pixel in render.js.
import { createRng } from '../kit/rng.js';
import {
  W, H, SLING, STONE_R, STARTLE_RADIUS, BIRDS, OWL_STONE_PENALTY, CROP_MAX, CROP_DRAIN_PER_BIRD,
  CROP_DRAIN_FROM_LEVEL, DAILY, DEMO_LEVEL_LIMIT, DEMO_RUN_LIMIT, levelSpec, comboMultiplier, starsFor, woodFor,
} from './tuning.js';
import { clampPull, launchVelocity, stepStone, segmentHitsCircle, distanceToSegment } from './physics.js';
import { spawnBird, updateBird, startle, maybeDodge, isTarget, isPerchedPest } from './birds.js';
import { generateScene, pickBirdType } from './levels.js';
import { drawGame, BUTTONS, SCHEMES } from './render.js';

export const meta = { width: W, height: H };

const inRect = (x, y, r) => x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h;

export function createGame(env) {
  const { rng, storage, monetization, audio, config } = env;
  const demo = Boolean(config?.demo);
  const day = config?.day ?? 0;

  const state = {
    scene: 'title', // 'title' | 'playing' | 'levelclear' | 'tally' | 'demo-limit'
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
    newWood: -1, // index of a slingshot wood unlocked by the level just cleared, else -1
    aim: null, // { sx, sy, pull: {x,y,len} } while dragging
    snap: 0, // band overshoot animation after release
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
  };
  let playRng = rng.fork();

  storage.get('best', 0).then((v) => (state.best = v));
  storage.get('highestLevel', 1).then((v) => (state.highestLevel = v));
  storage.get('stars', 0).then((v) => (state.stars = v));
  storage.get('scheme', 0).then((v) => (state.scheme = SCHEMES[v] ? v : 0));
  storage.get('daily', null).then((v) => v && (state.daily = v));
  if (demo) storage.get('demoRuns', 0).then((v) => (state.demoRuns = v));

  const startLevel = (n) => {
    const base = state.mode === 'daily' ? DAILY.level : n;
    state.level = n;
    state.spec = levelSpec(base);
    if (state.mode === 'daily') state.spec = { ...state.spec, quota: 999, stones: DAILY.stones };
    state.world = generateScene(playRng, state.spec);
    state.birds = [];
    state.stones = [];
    state.particles = [];
    state.popups = [];
    state.spawnTimer = 0.4;
    state.stonesLeft = state.spec.stones;
    state.hits = 0;
    state.crop = CROP_MAX;
    state.wind = state.spec.windMax ? playRng.range(-state.spec.windMax, state.spec.windMax) : 0;
    state.aim = null;
    state.scene = 'playing';
  };

  const startRun = (mode) => {
    if (demo) {
      if (mode !== 'campaign' || state.demoRuns >= DEMO_RUN_LIMIT) {
        state.scene = 'demo-limit';
        return;
      }
      state.demoRuns += 1;
      storage.set('demoRuns', state.demoRuns);
    }
    state.mode = mode;
    // Daily Hunt: the same field and birds for every player on the same date.
    playRng = mode === 'daily' ? createRng((day * 7919 + 13) >>> 0) : rng.fork();
    state.score = 0;
    state.combo = 0;
    state.bestCombo = 0;
    state.shots = [];
    state.tally = { thrown: 0, hit: 0, byType: {} };
    startLevel(mode === 'campaign' && !demo ? state.highestLevel : 1);
  };

  const endRun = () => {
    state.scene = 'tally';
    state.aim = null;
    if (state.score > state.best) {
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
    state.stars += state.lastStars;
    state.newWood = woodFor(state.stars) > woodBefore ? woodFor(state.stars) : -1;
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
    if (demo && state.level >= DEMO_LEVEL_LIMIT) {
      state.scene = 'demo-limit';
      return;
    }
    startLevel(state.level + 1);
  };

  const burst = (x, y, color, count) => {
    for (let i = 0; i < count; i++) {
      const a = playRng.range(0, Math.PI * 2);
      const sp = playRng.range(60, 240);
      state.particles.push({ x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 80, life: playRng.range(0.5, 1.1), rot: a, color });
    }
  };

  const fire = () => {
    const pull = state.aim.pull;
    state.aim = null;
    if (pull.len < SLING.minPull || state.stonesLeft <= 0) return;
    const v = launchVelocity(pull);
    state.stones.push({ x: SLING.x, y: SLING.y, px: SLING.x, py: SLING.y, vx: v.vx, vy: v.vy, minMiss: 9999, hit: false });
    state.stonesLeft -= 1;
    state.tally.thrown += 1;
    state.snap = 0.18;
    audio.tone({ freq: 300, to: 900, dur: 0.12, type: 'sine', vol: 0.15 });
  };

  const onHit = (stone, bird) => {
    stone.hit = true;
    bird.gone = true;
    const def = BIRDS[bird.type];
    if (bird.type === 'owl') {
      state.stonesLeft = Math.max(0, state.stonesLeft - OWL_STONE_PENALTY);
      state.combo = 0;
      state.score = Math.max(0, state.score + def.points);
      state.shots.push('owl');
      state.popups.push({ x: bird.x, y: bird.y, text: `Protected! -${OWL_STONE_PENALTY} stones`, life: 1.4, bad: true });
      burst(bird.x, bird.y, '#c9b38a', 8);
      audio.tone({ freq: 200, to: 120, dur: 0.3, type: 'sawtooth', vol: 0.18 });
      return;
    }
    state.combo += 1;
    state.bestCombo = Math.max(state.bestCombo, state.combo);
    const distance = Math.min(1, Math.hypot(bird.x - SLING.x, bird.y - SLING.y) / 1000);
    const moving = bird.phase === 'crossing' || bird.phase === 'darting' || bird.phase === 'hopping' || bird.phase === 'arriving';
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
    state.popups.push({ x: bird.x, y: bird.y - 30, text: `+${gained}${state.combo > 1 ? `  x${comboMultiplier(state.combo - 1)}` : ''}`, life: 1.1, bad: false });
    burst(bird.x, bird.y, '#ffffff', 12);
    audio.tone({ freq: 520 + state.combo * 40, to: 880, dur: 0.1, type: 'triangle', vol: 0.22 });
  };

  const onMiss = (stone) => {
    state.combo = 0;
    state.shots.push('miss');
    audio.tone({ freq: 260, to: 160, dur: 0.16, type: 'sine', vol: 0.12 });
    void stone;
  };

  const updatePlaying = (dt, input) => {
    state.time += dt;
    const spec = state.spec;
    const wind = spec.gusty ? state.wind * (0.6 + 0.4 * Math.sin(state.time * 0.9)) : state.wind;

    // --- aiming
    const { pointer } = input;
    if (pointer.pressed) {
      if (inRect(pointer.x, pointer.y, BUTTONS.playColors)) cycleScheme();
      else if (pointer.y >= SLING.dragZoneTop && state.stonesLeft > 0) state.aim = { sx: pointer.x, sy: pointer.y, pull: { x: 0, y: 0, len: 0 } };
    }
    if (state.aim && !state.aim.kbd) {
      if (pointer.down) state.aim.pull = clampPull(state.aim.sx - pointer.x, state.aim.sy - pointer.y);
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
      const type = pickBirdType(playRng, spec, alive.some((b) => b.type === 'owl'));
      const bird = spawnBird(playRng, type, state.world, state.birds, spec.speed, state.nextBirdId);
      if (bird) {
        state.nextBirdId += 1;
        state.birds.push(bird);
      }
      state.spawnTimer = playRng.range(0.7, 1.6) / spec.speed;
    }
    for (const bird of state.birds) updateBird(bird, dt, playRng, state.world, state.birds, state.time, spec.speed);

    // --- stones
    for (const stone of state.stones) {
      stepStone(stone, dt, wind);
      for (const bird of state.birds) {
        if (!isTarget(bird) || stone.hit) continue;
        if (maybeDodge(bird, stone)) continue;
        if (segmentHitsCircle(stone.px, stone.py, stone.x, stone.y, bird.x, bird.y, bird.r + STONE_R)) onHit(stone, bird);
        else stone.minMiss = Math.min(stone.minMiss, distanceToSegment(stone.px, stone.py, stone.x, stone.y, bird.x, bird.y));
      }
      if (!stone.hit) {
        for (const bird of state.birds) {
          if (bird.phase === 'perched' && distanceToSegment(stone.px, stone.py, stone.x, stone.y, bird.x, bird.y) < STARTLE_RADIUS && stone.vy > -200) startle(bird, playRng, state.world, state.birds);
        }
      }
      stone.done = stone.hit || stone.y > H + 40 || stone.x < -60 || stone.x > W + 60;
      if (stone.done && !stone.hit) onMiss(stone);
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
    if (spec.n >= CROP_DRAIN_FROM_LEVEL && state.mode !== 'daily') {
      state.crop = Math.max(0, state.crop - state.birds.filter(isPerchedPest).length * CROP_DRAIN_PER_BIRD * dt);
    }
    if (state.hits >= spec.quota) completeLevel();
    else if (state.crop <= 0 || (state.stonesLeft <= 0 && state.stones.length === 0 && !state.aim)) endRun();
  };

  function cycleScheme() {
    state.scheme = (state.scheme + 1) % SCHEMES.length;
    storage.set('scheme', state.scheme);
  }

  const updateTitle = (input) => {
    if (!input.pointer.pressed) return;
    const { x, y } = input.pointer;
    if (inRect(x, y, BUTTONS.colors)) cycleScheme();
    else if (inRect(x, y, BUTTONS.daily)) {
      if (!demo && state.daily.day !== day) startRun('daily');
    } else if (inRect(x, y, BUTTONS.endless)) {
      if (!demo) startRun('endless');
    }
    else if (inRect(x, y, BUTTONS.play)) startRun('campaign');
  };

  return {
    update(dt, input) {
      if (state.scene === 'playing') updatePlaying(dt, input);
      else if (state.scene === 'title') updateTitle(input);
      else if (state.scene === 'levelclear') {
        state.time += dt;
        state.clearTimer -= dt;
        if (state.clearTimer <= 0 || (input.pointer.pressed && state.clearTimer < 1.6)) nextLevel();
      } else if (state.scene === 'tally') {
        if (input.pointer.pressed) {
          const { x, y } = input.pointer;
          if (inRect(x, y, BUTTONS.again)) startRun(state.mode === 'daily' ? 'campaign' : state.mode);
          else if (inRect(x, y, BUTTONS.home)) state.scene = 'title';
        }
      }
      // 'demo-limit': deliberate no-op.
    },
    render(ctx) {
      drawGame(ctx, state, env.manifest, day);
    },
    getState() {
      return state;
    },
  };
}
