// Bird behaviour. A bird is a plain object (so state stays serialisable); update mutates it.
// phases: 'arriving' -> 'perched' -> ('hopping' -> 'perched')* -> 'leaving' -> gone
//         'crossing' (duck) and 'darting' (hummingbird) never perch.
import { W, BIRDS, CROW_DODGE_WINDOW } from './tuning.js';

const edgeX = (rng) => (rng.chance(0.5) ? -60 : W + 60);

// `id` comes from the game state (never a module-level counter: two runs in one process must match).
export function spawnBird(rng, type, scene, birds, speed, id) {
  const def = BIRDS[type];
  const bird = { id, type, r: def.r, x: 0, y: 0, vx: 0, vy: 0, phase: 'arriving', t: 0, stay: 0, perch: -1, flap: 0, facing: 1, dodged: false, dodgeT: 0, tx: 0, ty: 0, gone: false, scored: false };
  if (type === 'duck') {
    const fromLeft = rng.chance(0.5);
    bird.phase = 'crossing';
    bird.x = fromLeft ? -50 : W + 50;
    bird.y = rng.range(130, 420);
    bird.vx = (fromLeft ? 1 : -1) * rng.range(150, 210) * speed;
    bird.facing = fromLeft ? 1 : -1;
    return bird;
  }
  if (type === 'hummingbird') {
    bird.phase = 'darting';
    bird.x = edgeX(rng);
    bird.y = rng.range(200, 600);
    bird.tx = rng.range(80, W - 80);
    bird.ty = rng.range(180, 640);
    bird.stay = rng.range(7, 10); // total visit time
    return bird;
  }
  const free = scene.perches.map((p, i) => i).filter((i) => !birds.some((b) => !b.gone && b.perch === i));
  if (!free.length) return null;
  bird.perch = rng.pick(free);
  bird.x = edgeX(rng);
  bird.y = rng.range(80, 300);
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

export function startle(bird, rng, scene, birds) {
  if (bird.phase !== 'perched') return;
  const free = scene.perches.map((p, i) => i).filter((i) => i !== bird.perch && !birds.some((b) => !b.gone && b.perch === i));
  if (free.length && rng.chance(0.6)) {
    bird.perch = rng.pick(free);
    bird.phase = 'hopping';
  } else leave(bird, rng);
}

export function leave(bird, rng) {
  bird.phase = 'leaving';
  bird.perch = -1;
  bird.tx = edgeX(rng);
  bird.ty = rng.range(40, 260);
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
      else if (bird.t >= bird.stay) leave(bird, rng);
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
      if (bird.x < -80 || bird.x > W + 80) bird.gone = true;
      break;
    case 'darting':
      if (flyToward(bird, bird.tx, bird.ty, 520 * speed, dt)) {
        bird.tx = rng.range(80, W - 80);
        bird.ty = rng.range(180, 640);
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

export const isTarget = (bird) => !bird.gone && bird.phase !== 'leaving';
export const isPerchedPest = (bird) => !bird.gone && bird.type !== 'owl' && (bird.phase === 'perched' || bird.phase === 'dodging');
