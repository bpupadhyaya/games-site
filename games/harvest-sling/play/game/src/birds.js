// Bird behaviour. A bird is a plain object (so state stays serialisable); update mutates it.
// phases: 'arriving' -> 'perched' -> ('hopping' -> 'perched')* -> 'leaving' -> gone
//         'crossing' (duck) and 'darting' (hummingbird) never perch.
import { V, skyY, BIRDS, CROW_DODGE_WINDOW, flyK } from './tuning.js';

const edgeX = (rng) => (rng.chance(0.5) ? -60 : V.WW + 60);

// `id` comes from the game state (never a module-level counter: two runs in one process must match).
export function spawnBird(rng, type, scene, birds, speed, id) {
  const def = BIRDS[type];
  const bird = { id, type, hp: def.hp ?? 1, r: def.r, x: 0, y: 0, vx: 0, vy: 0, phase: 'arriving', t: 0, stay: 0, perch: -1, flap: 0, facing: 1, dodged: false, dodgeT: 0, tx: 0, ty: 0, gone: false, scored: false, tours: 0 };
  if (type === 'duck') {
    const fromLeft = rng.chance(0.5);
    bird.phase = 'crossing';
    bird.x = fromLeft ? -50 : V.WW + 50;
    bird.y = skyY(rng.range(130, 420));
    bird.vx = (fromLeft ? 1 : -1) * rng.range(150, 210) * speed;
    bird.facing = fromLeft ? 1 : -1;
    return bird;
  }
  if (type === 'swallow') {   // a diver: skims in from the side, swoops low over the field and climbs out again
    const fromLeft = rng.chance(0.5);
    bird.phase = 'swoop';
    bird.sx = fromLeft ? -50 : V.WW + 50;
    bird.ex = fromLeft ? V.WW + 50 : -50;
    bird.y0 = skyY(rng.range(120, 300));
    bird.depth = Math.max(120, V.hy - 170 - bird.y0);
    bird.dur = Math.abs(bird.ex - bird.sx) / (rng.range(260, 330) * speed);
    bird.x = bird.sx; bird.y = bird.y0;
    bird.facing = fromLeft ? 1 : -1;
    return bird;
  }
  if (type === 'hummingbird' || type === 'goldfinch' || type === 'butterfly') {
    bird.phase = 'darting';
    bird.x = edgeX(rng);
    bird.y = skyY(rng.range(200, 600));
    bird.tx = rng.range(80, V.WW - 80);
    bird.ty = skyY(rng.range(180, 640));
    bird.stay = type === 'goldfinch' ? rng.range(5, 7) : type === 'butterfly' ? rng.range(8, 11) : rng.range(7, 10); // total visit time
    return bird;
  }
  const free = scene.perches.map((p, i) => i).filter((i) => !scene.perches[i].taken && !birds.some((b) => !b.gone && b.perch === i));
  if (!free.length) return null;
  bird.perch = rng.pick(free);
  bird.x = edgeX(rng);
  bird.y = skyY(rng.range(80, 300));
  bird.stay = rng.range(def.stay[0], def.stay[1]) / Math.sqrt(speed);
  return bird;
}

export function perchPoint(scene, index, time) {
  const p = scene.perches[index];
  return { x: p.x, y: p.y + (p.sway ? Math.sin(time * 1.3 + p.phase) * p.sway : 0) };
}

function flyToward(bird, tx, ty, speed, dt) {
  const dx = tx - bird.x;
  const dy = ty - bird.y;
  const dist = Math.hypot(dx, dy);
  if (dx !== 0) bird.facing = dx > 0 ? 1 : -1;
  if (dist <= speed * dt) {
    bird.x = tx;
    bird.y = ty;
    return true;
  }
  bird.x += (dx / dist) * speed * dt;
  bird.y += (dy / dist) * speed * dt;
  return false;
}

// ---- Tours: on wider / taller fields perched birds sometimes take a flight instead of leaving: a ROUND trip (out and back to the same
// perch), a FIGURE-8 (out to one side, across to the other, home) or a HALF trip (arc across the field and land on a far perch).
// Routes use the live sky band, so a bigger field means longer flights. On the baseline phone flyK() = 0 and none of this runs.
const quad = (a, c, b, t) => { const u = 1 - t; return { x: u * u * a.x + 2 * u * t * c.x + t * t * b.x, y: u * u * a.y + 2 * u * t * c.y + t * t * b.y }; };
const clampSky = (p) => ({ x: Math.max(50, Math.min(V.WW - 50, p.x)), y: Math.max(V.top, Math.min(V.bot, p.y)) });
function leg(a, b, rng, lift) {
  const mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2, d = Math.hypot(b.x - a.x, b.y - a.y);
  return { a, b, c: { x: mx + rng.range(-0.15, 0.15) * d, y: Math.max(V.top - 30, my - lift - 0.12 * d) }, d: Math.max(60, d * 1.2) };
}
export function planTour(bird, rng, scene, birds, speed) {
  const chance = Math.min(0.65, 0.4 * flyK());
  if (chance <= 0 || bird.tours >= 2 || bird.type === 'owl' || !rng.chance(chance)) return false;
  const p0 = { x: bird.x, y: bird.y }, home = perchPoint(scene, bird.perch, 0), homeP = { x: home.x, y: home.y - bird.r * 0.7 };
  const reach = Math.max(160, Math.min(900, V.WW * 0.42)), lift = rng.range(30, 120) * Math.max(1, V.WH / 1560);
  const kind = rng.pick(['round', 'eight', 'half']);
  let legs;
  if (kind === 'half') {
    const free = scene.perches.map((p, i) => i).filter((i) => i !== bird.perch && !scene.perches[i].taken && !birds.some((b) => !b.gone && b.perch === i));
    if (!free.length) return false;
    const far = free.sort((a, b) => Math.abs(scene.perches[b].x - bird.x) - Math.abs(scene.perches[a].x - bird.x)).slice(0, 3);
    bird.perch = rng.pick(far);
    const q = perchPoint(scene, bird.perch, 0);
    legs = [leg(p0, { x: q.x, y: q.y - bird.r * 0.7 }, rng, lift + 60)];
  } else {
    const side = rng.chance(0.5) ? 1 : -1;
    const A = clampSky({ x: bird.x + side * rng.range(0.4, 1) * reach, y: V.top + rng.range(0.05, 0.6) * (V.bot - V.top) });
    if (kind === 'round') legs = [leg(p0, A, rng, lift), leg(A, homeP, rng, lift)];
    else { const B = clampSky({ x: bird.x - side * rng.range(0.4, 1) * reach, y: V.top + rng.range(0.05, 0.6) * (V.bot - V.top) }); legs = [leg(p0, A, rng, lift), leg(A, B, rng, lift * 0.5), leg(B, homeP, rng, lift)]; }
  }
  const sp = 300 * speed;
  for (const l of legs) l.dur = l.d / sp;
  bird.legs = legs; bird.leg = 0; bird.lt = 0; bird.phase = 'tour'; bird.tours += 1;
  return true;
}

export function startle(bird, rng, scene, birds) {
  if (bird.phase !== 'perched') return;
  const free = scene.perches.map((p, i) => i).filter((i) => i !== bird.perch && !scene.perches[i].taken && !birds.some((b) => !b.gone && b.perch === i));
  if (free.length && rng.chance(0.6)) {
    bird.perch = rng.pick(free);
    bird.phase = 'hopping';
  } else leave(bird, rng);
}

export function leave(bird, rng) {
  bird.phase = 'leaving';
  bird.perch = -1;
  bird.tx = edgeX(rng);
  bird.ty = skyY(rng.range(40, 260));
}

// Crow: the first stone that gets close makes it sidestep; it is then hittable for a short window.
export function maybeDodge(bird, stone) {
  if (bird.type !== 'crow' || bird.dodged || bird.phase !== 'perched') return false;
  if (Math.hypot(stone.x - bird.x, stone.y - bird.y) > 150) return false;
  bird.dodged = true;
  bird.dodgeT = CROW_DODGE_WINDOW;
  bird.phase = 'dodging';
  bird.tx = bird.x + (stone.vx >= 0 ? -1 : 1) * 78;
  bird.ty = bird.y - 58;
  bird.t = 0;
  return true;
}

export function updateBird(bird, dt, rng, scene, birds, time, speed) {
  bird.flap += dt * (bird.phase === 'perched' ? 0 : 14);
  bird.t += dt;
  switch (bird.phase) {
    case 'arriving':
    case 'hopping': {
      const p = perchPoint(scene, bird.perch, time);
      if (flyToward(bird, p.x, p.y - bird.r * 0.7, (bird.phase === 'hopping' ? 330 : 260) * speed, dt)) {
        bird.phase = 'perched';
        bird.t = 0;
      }
      break;
    }
    case 'perched': {
      const p = perchPoint(scene, bird.perch, time);
      bird.x = p.x;
      bird.y = p.y - bird.r * 0.7;
      if (bird.type === 'sparrow' && bird.t > 2 && rng.chance(dt / 3)) startle(bird, rng, scene, birds);
      else if (bird.t >= bird.stay) { if (!planTour(bird, rng, scene, birds, speed)) leave(bird, rng); }
      break;
    }
    case 'dodging': {
      const up = bird.t < 0.35;
      flyToward(bird, bird.tx, up ? bird.ty : bird.ty + 58, 420, dt);
      bird.dodgeT -= dt;
      if (bird.dodgeT <= 0) leave(bird, rng); // window closed: it has had enough
      break;
    }
    case 'crossing':
      bird.x += bird.vx * dt;
      bird.y += Math.sin(bird.t * 2.2) * 14 * dt;
      if (bird.x < -80 || bird.x > V.WW + 80) bird.gone = true;
      break;
    case 'mob': {   // a crow mobbing a predator: chases it, then settles back on its perch
      bird.mobT += dt;
      flyToward(bird, bird.tx, bird.ty, 420 * speed, dt);
      if (bird.mobT > 2.4) { if (bird.perch >= 0) bird.phase = 'hopping'; else leave(bird, rng); }
      break;
    }
    case 'tour': {
      const L = bird.legs[bird.leg];
      bird.lt += dt / L.dur;
      const p = quad(L.a, L.c, L.b, Math.min(1, bird.lt));
      if (Math.abs(p.x - bird.x) > 0.01) bird.facing = p.x > bird.x ? 1 : -1;
      bird.x = p.x; bird.y = p.y;
      if (bird.lt >= 1) { bird.leg += 1; bird.lt = 0; if (bird.leg >= bird.legs.length) { bird.phase = 'arriving'; bird.legs = null; } }
      break;
    }
    case 'swoop': {
      const prog = bird.t / bird.dur;
      bird.x = bird.sx + (bird.ex - bird.sx) * prog;
      bird.y = bird.y0 + bird.depth * Math.sin(Math.PI * Math.min(1, prog)) ** 1.5;
      if (prog >= 1) bird.gone = true;
      break;
    }
    case 'boss': {   // the Hawk: sweeps across the sky on a slow sine, and every few seconds stoops low for a moment (a fair, readable pattern)
      const span = V.WW * 0.36, cyc = bird.t % 6, stoop = cyc > 4.2 && cyc < 5.4 ? Math.sin(((cyc - 4.2) / 1.2) * Math.PI) * 120 : 0;
      const nx = V.WW / 2 + Math.sin(bird.t * (0.55 / Math.sqrt(Math.max(1, V.WW / 720)))) * span;
      bird.facing = nx >= bird.x ? 1 : -1;
      bird.x = nx; bird.y = skyY(250) + Math.sin(bird.t * 1.1) * 40 + stoop;
      break;
    }
    case 'darting':
      if (flyToward(bird, bird.tx, bird.ty, (bird.type === 'butterfly' ? 150 : 520) * speed, dt)) {
        bird.tx = rng.range(80, V.WW - 80);
        bird.ty = skyY(rng.range(180, 640));
      }
      if (bird.t >= bird.stay) leave(bird, rng);
      break;
    case 'leaving':
      if (flyToward(bird, bird.tx, bird.ty, 340 * speed, dt)) bird.gone = true;
      break;
    default:
      break;
  }
}

export function spawnBoss(id) {
  const def = BIRDS.hawk;
  return { id, type: 'hawk', hp: def.hp, r: def.r, x: V.WW / 2, y: skyY(250), vx: 0, vy: 0, phase: 'boss', t: 0, stay: 0, perch: -1, flap: 0, facing: 1, dodged: false, dodgeT: 0, tx: 0, ty: 0, gone: false, scored: false };
}

export const isTarget = (bird) => !bird.gone && bird.phase !== 'leaving';
export const isPerchedPest = (bird) => !bird.gone && bird.type !== 'owl' && (bird.phase === 'perched' || bird.phase === 'dodging');
