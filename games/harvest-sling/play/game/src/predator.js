// The predator ecosystem: from level 7 a FALCON (slim, fast, steep stoop) or a HAWK (broad, slower sweep) sometimes hunts the flock.
// It is scenery with teeth, never a target: stones fly through it, it never costs a stone, it can never be hit.
//   telegraph (0.9 s: the cue) -> climb (soars high) -> stoop (steep dive on a bird) -> catch or miss -> pull up -> leave.
// Easy prey (sparrow, pigeon, parrot, duck, golden finch) is caught reliably; crows are clever: they usually slip aside at the last
// moment (the falcon misses), and when several crows are about they MOB the predator, which aborts and leaves.
// Butterflies, owls, big crows, swallows and hummingbirds are ignored. All randomness comes from the level's seeded stream.
import { V } from './tuning.js';

export const PRED = { easy: new Set(['sparrow', 'pigeon', 'parrot', 'duck', 'goldfinch']), CATCH_VALUE: 0.5, GUARD_TIME: 5 };
const ALIVE = (b) => !b.gone && b.phase !== 'leaving';
const isCrow = (b) => b.type === 'crow';
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

// A seeded schedule for one level: null (no hunt) or { left, wait, kind0 }. Draws random numbers only from level 7 on (levels 1-6 are untouched).
export function planHunts(rng, n) {
  if (n < 7 || n % 10 === 0) return null;
  if (!rng.chance(0.6)) return null;
  const left = n >= 14 && rng.chance(0.5) ? 2 : 1;
  return { left, wait: rng.range(5, 9), kind0: n % 2 === 0 ? 'falcon' : 'hawk', done: 0, credit: 0 };
}

function pickTarget(birds, rng) {
  const easy = birds.filter((b) => ALIVE(b) && PRED.easy.has(b.type));
  const hard = birds.filter((b) => ALIVE(b) && isCrow(b));
  const pool = easy.length ? easy : hard;
  return pool.length ? rng.pick(pool) : null;
}

// hooks: { toast(text), cue(kind, what), burst(x, y, bird), caught(bird), flush() }
export function updatePredator(state, dt, rng, hooks) {
  const H = state.hunt;
  let P = state.predator;
  state.guardT = Math.max(0, (state.guardT || 0) - dt);
  if (!P) {
    if (!H || H.left <= 0) return;
    H.wait -= dt;
    if (H.wait > 0) return;
    if ((state.sitters || []).some((s) => s.state === 'lock')) return;
    const target = pickTarget(state.birds, rng);
    if (!target) { H.wait = 1.5; return; }
    const kind = H.done % 2 === 0 ? H.kind0 : H.kind0 === 'falcon' ? 'hawk' : 'falcon';
    const crows = state.birds.filter((b) => ALIVE(b) && isCrow(b));
    const mob = crows.length >= 3 && rng.chance(Math.min(0.9, 0.45 + 0.1 * (crows.length - 3)));
    const side = rng.chance(0.5) ? 1 : -1, reach = clamp(V.WW * 0.2, 150, 520);
    const mode = kind === 'falcon' ? rng.pick(['stoop', 'stoop', 'double', 'skim']) : rng.pick(['diagonal', 'stoop']);   // variety: a plain stoop, a double-stoop, a low skimming run, a hawk's long diagonal glide
    P = state.predator = { kind, phase: 'telegraph', t: 0, x: clamp(target.x + side * reach, 90, V.WW - 90), y: -70, vx: 0, vy: 0, facing: -side, target: target.id, carry: null, mob, side, mode, second: false, slowUsed: 0, push: 0, fx: 0, wheel: rng.range(0, 6), hist: [], ht: 0, seed: rng.range(0, 6), strikeT: 0, rvx: 0, rvy: 0, near: false, strike: false, speed: 0, dx: 0, dy: 1, dodgeRoll: rng.chance(0.75), slipped: false, angle: 0, size: kind === 'falcon' ? 1.3 : 1.6 };
    H.credit = 0;
    hooks.toast(kind === 'falcon' ? 'Falcon!' : 'Hawk!');
    hooks.cue(kind, 'screech');
    return;
  }
  P.t += dt;
  const ox = P.x, oy = P.y;
  P.strikeT = Math.max(0, (P.strikeT || 0) - dt);
  const tgt = state.birds.find((b) => b.id === P.target && ALIVE(b));
  const soarY = V.top + 120, tall = clamp(V.WH / 1560, 1, 1.4);
  const shallow = P.mode === 'skim' ? 0.42 : P.mode === 'diagonal' ? 0.5 : 0;   // slope of the attack for the low modes
  const soarPoint = (b) => {
    const off = shallow ? clamp(V.WW * 0.42, 260, 640) : clamp(V.WW * 0.2, 150, 520);
    const x = clamp(b.x + P.side * off, 60, V.WW - 60);
    return { x, y: shallow ? clamp(b.y - shallow * Math.abs(x - b.x), V.top + 70, V.hy - 120) : soarY };
  };
  P.fx = Math.min(1, P.fx + dt * 1.2); const calm = hooks.calm ? hooks.calm() : false;
  const toward = (tx, ty, sp) => { const dx = tx - P.x, dy = ty - P.y, d = Math.hypot(dx, dy) || 1, k = Math.min(1, (sp * dt) / d); P.x += dx * k; P.y += dy * k; if (Math.abs(dx) > 1) P.facing = dx > 0 ? 1 : -1; return d; };
  switch (P.phase) {
    case 'telegraph': {
      toward(P.x, soarY - 20 + Math.sin(P.t * 5) * 6, 160);
      if (P.t >= 0.9) {
        if (P.mob) {
          P.phase = 'mobbed'; P.t = 0;
          let n = 0;
          for (const b of state.birds) if (ALIVE(b) && isCrow(b) && n < 8 && (b.phase === 'perched' || b.phase === 'arriving' || b.phase === 'hopping')) { b.phase = 'mob'; b.mobT = 0; n += 1; }
          hooks.flush(P.x);
          hooks.cue(P.kind, 'caws');
        } else if (!tgt) { P.phase = 'leave'; P.t = 0; } else { P.phase = 'climb'; P.t = 0; hooks.flush(P.x); }   // its arrival sends the birds near the crop flying
      }
      break;
    }
    case 'mobbed': {   // crows harass it; it gives up and flies off the top
      for (const b of state.birds) if (b.phase === 'mob') { b.tx = P.x; b.ty = P.y + 40; }
      toward(P.x + P.side * 600, -140, 260);
      if (Math.floor(P.t * 5) !== Math.floor((P.t - dt) * 5) && P.t < 1.8) hooks.cue(P.kind, 'caw');
      if (P.t > 2 || P.y < -100) { state.predator = null; H.left -= 1; H.done += 1; H.wait = rng.range(7, 12); }
      break;
    }
    case 'climb': {   // "wait-on": it wheels in lazy circles high above, head tracking the flock, then folds into the stoop
      if (!tgt) { P.phase = 'leave'; P.t = 0; break; }
      const sp = soarPoint(tgt), a = P.wheel + P.t * (P.kind === 'falcon' ? 2.2 : 1.1), R = (P.kind === 'falcon' ? 55 : 80) * (shallow ? 0.4 : 1);
      toward(sp.x + Math.cos(a) * R, sp.y + Math.sin(a) * R * 0.35, 520);
      P.facing = tgt.x > P.x ? 1 : -1;
      if (P.t >= (P.second ? 0.5 : 1.7)) { P.phase = 'stoop'; P.t = 0; P.vx = 0; P.vy = 0; P.speed = 80; P.dx = shallow ? P.facing : 0; P.dy = shallow ? 0.2 : 1; hooks.flush(tgt.x, tgt.id); hooks.cue(P.kind, 'whistle'); }
      break;
    }
    case 'stoop': {   // ease-in: it trades height for speed (accelerates), steering by turning its heading
      let tx = P.x, ty = P.y + 400;
      if (tgt) { tx = tgt.x; ty = tgt.y; }
      const d0 = Math.hypot(tx - P.x, ty - P.y) || 1;
      // The money shot: the predator alone drops to ~45 % time for about 0.35 s as it closes in (effect layer only; birds, stones and aiming keep real time). Off in Calm.
      let sdt = dt;
      if (!calm && !P.slipped && tgt && d0 < 280 && P.slowUsed < 0.35) { P.slowUsed += dt; sdt = dt * 0.45; }
      P.push = clamp(P.push + (!calm && tgt && !P.slipped && d0 < 420 ? dt * 5 : -dt * 4), 0, 1);   // camera push-in (<= 3.5 %), easing back after the strike
      const top = (P.kind === 'falcon' ? 1000 : 720) * (shallow ? 0.8 : tall), accel = P.kind === 'falcon' ? 2200 : 1400;
      P.speed = Math.min(top, (P.speed || 0) + accel * sdt);
      const dx = tx - P.x, dy = ty - P.y, d = d0, turn = P.kind === 'falcon' ? 7 : 4;
      P.dx += (dx / d - P.dx) * Math.min(1, turn * sdt); P.dy += (dy / d - P.dy) * Math.min(1, turn * sdt);
      if (shallow && !P.slipped && d > 140) P.dy = Math.min(P.dy, shallow);
      const hl = Math.hypot(P.dx, P.dy) || 1; P.dx /= hl; P.dy /= hl;
      if (P.slipped) P.dy = Math.max(P.dy, 0.7);
      P.vx = P.dx * P.speed; P.vy = P.dy * P.speed;
      P.x += P.vx * sdt; P.y += P.vy * sdt;
      if (Math.abs(P.vx) > 20) P.facing = P.vx > 0 ? 1 : -1;
      P.near = !!tgt && !P.slipped && d < 150; P.strike = !!tgt && !P.slipped && d < 70;
      P.ht += dt; if (P.ht > 0.035) { P.ht = 0; P.hist.unshift({ x: P.x, y: P.y }); if (P.hist.length > 3) P.hist.pop(); }   // 3 ghost positions for motion trails
      if (tgt && !P.slipped) {
        if (isCrow(tgt) && P.dodgeRoll && d < 170) {   // the crow breaks sideways at the last moment
          P.slipped = true; tgt.phase = 'dodging'; tgt.dodged = true; tgt.dodgeT = 1.6; tgt.t = 0;
          tgt.tx = tgt.x + (tgt.x < P.x ? -1 : 1) * 150; tgt.ty = tgt.y - 30;
          hooks.toast('Crow dodged!'); hooks.cue(P.kind, 'caws');
        } else if (d < tgt.r + 34) {
          tgt.gone = true; P.carry = tgt.type; P.strikeT = 0.5; P.vx *= 0.5; P.vy *= 0.5; hooks.caught(tgt, P); P.phase = 'pullup'; P.t = 0; P.strike = false; P.hist.length = 0; break;
        }
      }
      if (P.t > 2.6 || P.y > V.hy - 40 || P.y > V.WH - 60 || P.x < -80 || P.x > V.WW + 80) { P.phase = 'pullup'; P.t = 0; P.strike = false; P.hist.length = 0; }
      break;
    }
    case 'flinch': {   // hit by the player's stone: it tumbles a short way, shrieks and gives up the hunt
      P.spin = (P.spin || 0) + dt * 11 * P.side;
      P.vx += (P.side * 140 - P.vx) * Math.min(1, 4 * dt); P.vy += (260 - P.vy) * Math.min(1, 5 * dt);
      P.x += P.vx * dt; P.y += P.vy * dt;
      if (P.t > 0.55) { P.phase = 'leave'; P.t = 0; P.spin = 0; P.vx = P.side * 200; P.vy = -300; }
      break;
    }
    case 'ambush': {   // launched from a branch: a fast intercept that uses the falcon's speed advantage (aims where the bird will be)
      if (!tgt) { P.phase = 'leave'; P.t = 0; break; }
      const top = (P.kind === 'falcon' ? 840 : 640);
      P.speed = Math.min(top, (P.speed || 160) + 1900 * dt);
      P.tvx += (((tgt.x - P.ltx) / Math.max(dt, 1e-3)) - P.tvx) * Math.min(1, 6 * dt); P.tvy += (((tgt.y - P.lty) / Math.max(dt, 1e-3)) - P.tvy) * Math.min(1, 6 * dt); P.ltx = tgt.x; P.lty = tgt.y;
      const dist = Math.hypot(tgt.x - P.x, tgt.y - P.y) || 1, lead = Math.min(0.7, dist / P.speed);
      const ax = tgt.x + clamp(P.tvx, -400, 400) * lead, ay = tgt.y + clamp(P.tvy, -400, 400) * lead, dd = Math.hypot(ax - P.x, ay - P.y) || 1;
      P.dx += ((ax - P.x) / dd - P.dx) * Math.min(1, 9 * dt); P.dy += ((ay - P.y) / dd - P.dy) * Math.min(1, 9 * dt);
      const hl = Math.hypot(P.dx, P.dy) || 1; P.dx /= hl; P.dy /= hl;
      P.vx = P.dx * P.speed; P.vy = P.dy * P.speed; P.x += P.vx * dt; P.y += P.vy * dt;
      if (Math.abs(P.vx) > 20) P.facing = P.vx > 0 ? 1 : -1;
      P.near = !P.slipped && dist < 140; P.strike = !P.slipped && dist < 70;
      P.ht += dt; if (P.ht > 0.035) { P.ht = 0; P.hist.unshift({ x: P.x, y: P.y }); if (P.hist.length > 3) P.hist.pop(); }
      if (!P.slipped) {
        const hard = (isCrow(tgt) && P.dodgeRoll) || (SIT_FAST.has(tgt.type) && P.fastRoll);
        if (hard && dist < 160) {   // the crow breaks aside / the swift bird outflies it: the falcon misses
          P.slipped = true; hooks.toast(isCrow(tgt) ? 'Crow dodged!' : 'Too quick!'); hooks.cue(P.kind, 'caws');
          if (isCrow(tgt)) { tgt.phase = 'dodging'; tgt.dodged = true; tgt.dodgeT = 1.6; tgt.t = 0; tgt.tx = tgt.x + (tgt.x < P.x ? -1 : 1) * 150; tgt.ty = tgt.y - 30; }
        } else if (dist < tgt.r + 32) {
          tgt.gone = true; P.carry = tgt.type; P.strikeT = 0.5; P.vx *= 0.5; P.vy *= 0.5; hooks.caught(tgt, P); P.phase = 'pullup'; P.t = 0; P.strike = false; P.hist.length = 0; break;
        }
      }
      if (P.t > 2.4 || P.x < -80 || P.x > V.WW + 80 || P.y > V.hy + 60) { P.phase = 'pullup'; P.t = 0; P.strike = false; P.hist.length = 0; }
      break;
    }
    case 'return': {   // back to a branch to wait again
      const S = P.sitter, bx = S.x, by = S.y - 40, d = Math.hypot(bx - P.x, by - P.y);
      P.vx = ((bx - P.x) / (d || 1)) * Math.min(420, 120 + d * 1.6); P.vy = ((by - P.y) / (d || 1)) * Math.min(420, 120 + d * 1.6);
      P.x += P.vx * dt; P.y += P.vy * dt; P.facing = bx >= P.x ? 1 : -1;
      if (d < 14 || P.t > 4) { S.state = 'perched'; S.cd = rng.range(6, 12); S.watch = S.watch; state.predator = null; }
      break;
    }
    case 'pullup': {
      P.vx += (P.side * 480 - P.vx) * Math.min(1, 3 * dt); P.vy += (-650 - P.vy) * Math.min(1, 3 * dt);
      P.x += P.vx * dt; P.y += P.vy * dt; P.angle = Math.atan2(P.vy, P.vx);
      if (Math.abs(P.vx) > 20) P.facing = P.vx > 0 ? 1 : -1;
      P.push = Math.max(0, P.push - dt * 4);
      if (P.t > 1.2) {
        if (P.sitter && P.sitter.state === 'away' && rng.chance(0.55)) { P.phase = 'return'; P.t = 0; break; }
        const nt = P.mode === 'double' && !P.second && !P.carry && pickTarget(state.birds, rng);   // a second stoop after a miss, on another bird
        if (nt) { P.second = true; P.target = nt.id; P.dodgeRoll = rng.chance(0.75); P.slipped = false; P.phase = 'climb'; P.t = 0; P.side = -P.side; P.mode = 'stoop'; hooks.cue(P.kind, 'screech'); }
        else { P.phase = 'leave'; P.t = 0; }
      }
      break;
    }
    default: {   // leave: climb out of the picture
      P.vx += (P.side * 520 - P.vx) * Math.min(1, 2 * dt); P.vy += (-420 - P.vy) * Math.min(1, 2 * dt);
      P.x += P.vx * dt; P.y += P.vy * dt; P.angle = Math.atan2(P.vy, P.vx);
      if (P.y < -140 || P.x < -160 || P.x > V.WW + 160 || P.t > 3) {
        if (P.sitter) { P.sitter.state = 'gone'; state.world.perches[P.sitter.perch] && (state.world.perches[P.sitter.perch].taken = false); state.predator = null; return; }
        state.predator = null; if (H && H.left > 0) { H.left -= 1; H.done += 1; H.wait = rng.range(7, 12); } }
    }
  }
  if (state.predator === P && dt > 0) {
    const raw = Math.atan2(P.rvy, Math.max(Math.abs(P.rvx), 1));
    const want = P.phase === 'stoop' ? raw : P.phase === 'pullup' ? clamp(raw, -0.7, 0.15) : P.phase === 'flinch' ? 0 : raw * 0.3;   // a pull-up keeps the body 15-40 degrees nose-up, not hanging vertical
    P.angS = (P.angS ?? want) + (want - (P.angS ?? want)) * Math.min(1, (P.phase === 'stoop' ? 14 : 7) * dt); P.rvx += ((P.x - ox) / dt - P.rvx) * Math.min(1, 14 * dt); P.rvy += ((P.y - oy) / dt - P.rvy) * Math.min(1, 14 * dt); }
}


// ---- PERCHED FALCONS: they sit on high branches, watch, LOCK ON to a bird, launch and take it (usually in mid-air), then fly off or return to a perch. -------------
// A sitter occupies one high branch perch (`perch.taken`, so ordinary birds never use it). It is hittable like the flying predator (same escalating penalty).
const SIT_FAST = new Set(['swallow', 'hummingbird', 'goldfinch']);   // fast, hard to take
export function planSitters(rng, world, n, F) {
  if (n < 7 || n % 10 === 0 || !rng.chance(0.7)) return [];
  const count = Math.min(3, 1 + (F >= 1.6 ? 1 : 0) + (F >= 2.6 && n >= 12 ? 1 : 0));
  const cand = world.perches.map((p, i) => ({ p, i })).filter((o) => o.p.kind === 'branch' && !o.p.taken && o.p.x > 110 && o.p.x < V.WW - 110).sort((x, y) => x.p.y - y.p.y).slice(0, Math.max(count * 3, 4));
  const out = [];
  while (out.length < count && cand.length) {
    const c = cand.splice(rng.int(cand.length), 1)[0];
    if (out.some((s) => Math.abs(s.x - c.p.x) < 220)) continue;
    c.p.taken = true;
    out.push({ id: 5000 + out.length, kind: rng.chance(0.75) ? 'falcon' : 'hawk', perch: c.i, x: c.p.x, y: c.p.y, state: 'perched', t: 0, cd: rng.range(5, 9), target: null, lock: 0, face: rng.chance(0.5) ? 1 : -1, seed: rng.range(0, 6), watch: false, strikes: 0, phaseT: rng.range(2, 6), blink: 0, spin: 0, vy: 0 });
  }
  return out;
}

// Re-seat the sitters on the nearest high branch after the scenery was re-fitted (rotation / resize).
export function reseatSitters(state) {
  const ps = state.world.perches;
  for (const S of state.sitters || []) {
    if (S.state === 'gone') continue;
    let best = -1, bd = 1e9;
    ps.forEach((p, i) => { if (p.kind !== 'branch' || p.taken) return; const d = Math.hypot(p.x - S.x * (state.reseatSx || 1), p.y - S.y * (state.reseatSy || 1)); if (d < bd) { bd = d; best = i; } });
    if (best >= 0) { ps[best].taken = true; S.perch = best; S.x = ps[best].x; S.y = ps[best].y; }
  }
}

export function sitterBody(S) { return { x: S.x, y: S.y - 40 }; }   // body centre of a perched falcon (feet on the branch)

export function updateSitters(state, dt, rng, hooks) {
  const list = state.sitters || [];
  const busy = !!state.predator;
  for (const S of list) {
    if (S.state === 'gone') continue;
    S.t += dt; S.phaseT -= dt; S.blink = Math.max(0, S.blink - dt);
    if (S.phaseT <= 0 && S.state === 'perched') { S.phaseT = rng.range(2.5, 6); if (rng.chance(0.5)) S.blink = 0.14; if (rng.chance(0.25)) S.face = -S.face; }
    if (S.state === 'tumble') {   // knocked off its branch: falls away spinning, then is gone for this level
      S.vy += 900 * dt; S.y += S.vy * dt; S.x += S.face * -90 * dt; S.spin += dt * 9;
      if (S.y > V.hy + 100) { S.state = 'gone'; }
      continue;
    }
    if (S.state === 'away') continue;
    const tgtOf = () => state.birds.find((b) => b.id === S.target && ALIVE(b));
    if (S.state === 'perched') {
      if (state.hunt && state.hunt.sitterCap === undefined) state.hunt.sitterCap = 4;
      S.cd -= dt * (S.watch ? 2 : 1);
      if (S.cd > 0 || busy || (state.sitterStrikes || 0) >= 4) continue;
      const cands = state.birds.filter((b) => ALIVE(b) && b.type !== 'owl' && b.type !== 'butterfly' && b.type !== 'bigcrow' && b.type !== 'hawk' && b.phase !== 'boss' && Math.hypot(b.x - S.x, b.y - S.y) < V.WW * 0.6);
      if (!cands.length) { S.cd = 1.5; continue; }
      const t = rng.pick(cands);
      S.target = t.id; S.state = 'lock'; S.lock = 0; S.face = t.x >= S.x ? 1 : -1;
      hooks.cue('falcon', 'kak');
      hooks.nervous(S);
    } else if (S.state === 'lock') {
      S.lock += dt;
      const t = tgtOf();
      if (!t) { S.state = 'perched'; S.cd = 2.5; continue; }
      S.face = t.x >= S.x ? 1 : -1;
      if (S.lock >= 0.7 && !busy) {   // launch: it becomes the active predator
        const b = sitterBody(S);
        state.predator = { kind: S.kind, phase: 'ambush', t: 0, x: b.x, y: b.y, vx: 0, vy: 0, facing: S.face, target: t.id, carry: null, mob: false, side: S.face, mode: 'ambush', second: false, slowUsed: 0, push: 0, fx: 0, wheel: 0, hist: [], ht: 0, seed: S.seed, strikeT: 0, rvx: 0, rvy: 0, near: false, strike: false, speed: 160, dx: S.face, dy: 0, slipped: false, angle: 0, size: 1, sitter: S, dodgeRoll: rng.chance(0.75), fastRoll: rng.chance(0.55), tvx: 0, tvy: 0, ltx: t.x, lty: t.y };
        S.state = 'away'; S.strikes += 1; state.sitterStrikes = (state.sitterStrikes || 0) + 1;
        hooks.toast(S.kind === 'falcon' ? 'Falcon strikes!' : 'Hawk strikes!');
        hooks.cue(S.kind, 'whistle'); hooks.flush(t.x, t.id);
      }
    }
  }
}
