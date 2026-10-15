// The computer player. A "brain" watches the puck through a short delay (reaction time), then picks one of a few
// behaviours each tick: stand at home, block the lane the puck is coming down, hit it back, or line up behind a resting puck
// and strike it along a planned line (straight or off one side wall). It works in its own frame where its goal is at +y,
// so the same code plays either side. All randomness comes from the rng it is given.
import { HW, HH, GOAL_HW, R_PUCK, R_PAD, predictPuck, shotLine, clamp } from './sim.js';

const gauss = (rng) => (rng.next() + rng.next() + rng.next() - 1.5) * 1.15;

export function createBrain(side, prof, rng) {
  return { side, prof, rng, hist: [], mode: 'home', phase: 'idle', plan: null, dwell: 0, cool: 0, strikeT: 0, lineT: 0, errX: 0, errT: 0, feintT: 0, feintX: 0, ready: true, tx: 0, ty: 0, say: '' };
}

const segDist = (px, py, ax, ay, bx, by) => {
  const dx = bx - ax, dy = by - ay, l2 = dx * dx + dy * dy || 1;
  const t = clamp(((px - ax) * dx + (py - ay) * dy) / l2, 0, 1);
  return Math.hypot(px - (ax + dx * t), py - (ay + dy * t));
};

// Choose a shot from a resting/slow puck `o` (AI frame: own goal at +y). `opp` is the rival paddle in the same frame.
export function planShot(prof, rng, o, opp, force = null) {
  const wall = HW - R_PUCK;
  const tx = (rng.next() - 0.5) * 80;
  const cands = [];
  const clear = (ax, ay, bx, by) => segDist(opp.x, opp.y, ax, ay, bx, by) > R_PAD + R_PUCK + 12;
  // direct: at the goal mouth
  { const dx = tx - o.x, dy = -HH - o.y; cands.push({ kind: 'direct', dx, dy, aim: { x: tx, y: -HH }, blocked: !clear(o.x, o.y, tx, -HH), w: 1 }); }
  // bank off the left / right wall: aim at the mirror image of the goal target
  if (o.y > -60 && prof.bank > 0) {
    for (const s of [-1, 1]) {
      const mx = 2 * s * wall - tx;
      const dx = mx - o.x, dy = -HH - o.y;
      // the bounce point on the wall
      const k = (s * wall - o.x) / (dx || 1e-6);
      if (k <= 0.15 || k >= 0.85) continue;
      const by = o.y + dy * k;
      if (by > o.y - 40 || by < -HH + 70) continue;
      const blocked = !clear(o.x, o.y, s * wall, by) || !clear(s * wall, by, tx, -HH);
      cands.push({ kind: s < 0 ? 'bank-left' : 'bank-right', dx, dy, aim: { x: s * wall, y: by }, blocked, w: prof.bank });
    }
  }
  for (const c of cands) c.w *= c.blocked ? 0.25 : 1;
  let pick = cands[0];
  if (force) pick = cands.find((c) => c.kind === force) || cands[0];
  else {
    const total = cands.reduce((a, c) => a + c.w, 0);
    let r = rng.next() * total;
    for (const c of cands) { r -= c.w; if (r <= 0) { pick = c; break; } }
  }
  let errAng = gauss(rng) * prof.err;
  if (rng.chance(0.12 * (1.2 - prof.punch))) errAng += gauss(rng) * prof.err * 2.2;
  const ang = Math.atan2(pick.dy, pick.dx) + errAng;
  return { kind: pick.kind, blocked: pick.blocked, errAng, ang, dx: Math.cos(ang), dy: Math.sin(ang), aim: pick.aim, power: 0.55 + prof.punch * 0.45 };
}

export function describeShot(plan) {
  if (!plan) return '';
  if (plan.kind === 'bank-left') return 'Bank it off the left side';
  if (plan.kind === 'bank-right') return 'Bank it off the right side';
  return plan.blocked ? 'Go straight, the lane is tight' : 'Hit it straight at the goal';
}

// One decision per tick. Sets pad.tx / pad.ty / pad.vmax for the paddle of b.side.
function brainStepInner(b, w, dt, ctx = {}) {
  const side = b.side, pad = w.pads[side], opp = w.pads[1 - side], prof = b.prof, rng = b.rng, f = side === 0 ? 1 : -1;
  const pu = w.puck;
  b.hist.push({ x: pu.x, y: pu.y * f, vx: pu.vx, vy: pu.vy * f });
  if (b.hist.length > 40) b.hist.shift();
  const lagN = Math.min(b.hist.length - 1, Math.round(prof.lag * 60));
  const o = b.hist[b.hist.length - 1 - lagN];
  const me = { x: pad.x, y: pad.y * f };
  const oppF = { x: opp.x, y: opp.y * f };
  const speed = Math.hypot(o.vx, o.vy);
  pad.vmax = prof.vmax;
  b.cool = Math.max(0, b.cool - dt); b.errT -= dt;
  if (b.errT <= 0) { b.errX = gauss(rng) * prof.errPx; b.errT = 0.18 + rng.next() * 0.2; }
  const set = (x, y) => { b.tx = x; b.ty = y; pad.tx = x; pad.ty = y * f; };
  const homeX = clamp(o.x * 0.3, -90, 90), homeY = prof.defY - 40;

  // waiting: the world is frozen for the Watch & Learn think, or the serve has not been released yet
  if (ctx.hold) { set(0, homeY - 20); b.phase = 'idle'; return; }

  const inOwn = o.y > -6;                // a puck resting right on the centre line belongs to both (otherwise neither would play it)
  const toward = o.vy > 70;
  const resting = speed < prof.attackSpeed;

  // ---- in the middle of a strike: carry it through ----
  if (b.phase === 'strike') {
    b.strikeT -= dt;
    const pl = b.plan;
    set(pu.x + pl.dx * 40 * pl.power * 2.2, pu.y * f + pl.dy * 40 * pl.power * 2.2);
    pad.vmax = prof.vmax;
    if (b.strikeT <= 0 || (me.y < o.y - 30 && speed > 300)) { b.phase = 'idle'; b.cool = 0.18 + rng.next() * 0.2; b.plan = null; }
    return;
  }

  // ---- a resting / slow puck in my half: line up and strike ----
  if (inOwn && resting && b.cool <= 0 && (o.y < HH - R_PUCK - 6 || true)) {
    if (b.phase !== 'line') {
      // the plan may have been prepared by the game (Watch & Learn reveal); otherwise decide now
      b.plan = ctx.plan || planShot(prof, rng, { x: o.x, y: o.y }, oppF);
      b.phase = 'line'; b.lineT = 0; b.via = null; b.viaDone = false;
      b.dwell = prof.dwell[0] + rng.next() * (prof.dwell[1] - prof.dwell[0]);
      if (ctx.serve) b.dwell = Math.max(b.dwell, ctx.serveDwell || 0);
      b.feintT = rng.chance(prof.feint) ? 0.22 : 0; b.feintX = (rng.chance(0.5) ? -1 : 1) * 70;
    }
    const pl = b.plan;
    // the plan stores WHERE to send the puck (a point on the goal mouth or on the wall); the direction is recomputed from the
    // puck's current place and rotated by the planned aiming error
    const ang0 = Math.atan2(pl.aim.y - o.y, pl.aim.x - o.x) + pl.errAng;
    let dx = Math.cos(ang0), dy = Math.sin(ang0);
    pl.dx = dx; pl.dy = dy;
    let bx = o.x - dx * (R_PAD + R_PUCK + 12), by = o.y - dy * (R_PAD + R_PUCK + 12);
    // puck tucked against my own end or a side wall: come at it from the side, pushing it out and forward
    if (by > HH - R_PAD || Math.abs(bx) > HW - R_PAD + 6) {
      const sx = o.x > 0 ? -1 : 1;
      const ndx = 0.55 * sx, ndy = -0.83, l = Math.hypot(ndx, ndy);
      dx = ndx / l; dy = ndy / l; pl.dx = dx; pl.dy = dy;
      bx = o.x - dx * (R_PAD + R_PUCK + 8); by = o.y - dy * (R_PAD + R_PUCK + 8);
    }
    bx = clamp(bx, -HW + R_PAD, HW - R_PAD); by = clamp(by, R_PAD, HH - R_PAD);
    // the paddle is in front of the puck (between it and the rival) and the straight run to the spot behind it would push the
    // puck into my own goal: go round it first (out to the side level with it, then down beside it), then line up as usual
    if (!b.via && !b.viaDone && me.y < o.y + 6 && segDist(o.x, o.y, me.x, me.y, bx, by) < R_PAD + R_PUCK + 6) {
      // pass on the side the paddle is already on; only if the wall leaves no room there, take the other side
      let sd = me.x >= o.x ? 1 : -1;
      if (Math.abs(o.x + sd * (R_PAD + R_PUCK + 18)) > HW - R_PAD + 4) sd = -sd;
      b.via = { side: sd, stage: 0, t: 0 };
    }
    if (b.via) {
      b.via.t += dt;
      const v = b.via, cl = R_PAD + R_PUCK + 18, vx = clamp(o.x + v.side * cl, -HW + R_PAD, HW - R_PAD);
      // first slide sideways at the paddle's own height (never toward the puck), then go down beside it
      if (v.stage === 0) { set(vx, Math.min(me.y, o.y - 30)); if ((me.x - o.x) * v.side >= cl * 0.9 || Math.hypot(me.x - vx, me.y - Math.min(me.y, o.y - 30)) < 14) v.stage = 1; }
      else {
        const vy = clamp(Math.max(by, o.y + cl * 0.55), R_PAD, HH - R_PAD);
        set(vx, vy);
        if (me.y >= vy - 14 || v.t > 2.2) { b.via = null; b.viaDone = true; }
      }
      return;
    }
    b.lineT += dt;
    if (b.dwell > 0) { b.dwell -= dt; set(clamp(bx * 0.6 + homeX * 0.4, -HW + R_PAD, HW - R_PAD), Math.min(HH - R_PAD, Math.max(by, homeY))); b.say = 'ready'; return; }
    if (b.feintT > 0) { b.feintT -= dt; set(clamp(bx + b.feintX, -HW + R_PAD, HW - R_PAD), by); return; }
    set(bx, by);
    const near = Math.hypot(me.x - bx, me.y - by) < 18;
    if (near || b.lineT > 1.1) {
      b.phase = 'strike'; b.strikeT = 0.38;
      pad.vmax = prof.vmax;
      set(o.x + dx * 60 * pl.power, o.y + dy * 60 * pl.power);
    }
    return;
  }
  if (b.phase === 'line') { b.phase = 'idle'; b.plan = null; }

  // ---- the puck is coming: block the lane, then hit it back ----
  if (toward || (inOwn && !resting)) {
    // already past my paddle (between it and my goal): chasing it would only push it in. Hold the line.
    if (o.y > me.y + 8) {
      b.say = 'hold';
      if (o.vy > 30) {
        // it is heading for my goal: get to where it will cross the goal line and stand in the way
        const pts2 = predictPuck({ x: o.x, y: o.y, vx: o.vx, vy: o.vy }, 1.2, 1 / 30);
        const gx = (pts2.find((q) => q.y >= HH - R_PAD - 10) || pts2[pts2.length - 1] || o).x;
        set(clamp(gx, -GOAL_HW + 10, GOAL_HW - 10), HH - R_PAD - 4);
      } else {
        // it is behind my paddle and not going into my goal: never sit in its way (it would bounce off my back into my own goal);
        // slide out of its lane, to the side I am already on
        const cl = R_PAD + R_PUCK + 26, ttl = o.vy < -20 ? Math.max(0, (o.y - me.y) / -o.vy) : 0;
        const lane = clamp(o.x + o.vx * ttl, -HW, HW);               // where its lane crosses my height
        let best = me.x, bestScore = -1e9;
        for (const c0 of [lane - cl, lane + cl]) {
          const c = clamp(c0, -HW + R_PAD, HW - R_PAD);
          const score = Math.min(Math.abs(c - lane), cl) - 0.15 * Math.abs(me.x - c);
          if (score > bestScore) { bestScore = score; best = c; }
        }
        set(best, me.y);
      }
      return;
    }
    const pts = predictPuck({ x: o.x, y: o.y, vx: o.vx, vy: o.vy }, 1.4, 1 / 30);
    const defY = prof.defY + (o.vy > 700 ? 30 : 0);
    let hit = null;
    for (const s of pts) { if (s.y >= defY - 60 && s.vy > 0) { hit = s; break; } }
    if (hit) {
      // positioning error grows with the puck's speed and with every bounce on the way (people read banks worse)
      const bounces = pts.filter((q) => q.bounced && q.t <= hit.t).length;
      const ix = hit.x + b.errX * (1 + speed / 420 + 0.8 * bounces), iy = clamp(Math.max(hit.y, defY - 60), 120, HH - R_PAD);
      // punch: when the puck is close and in front of me, drive through it towards the rival's side
      const dp = Math.hypot(o.x - me.x, o.y - me.y);
      if (dp < 150 && o.y < me.y + 4 && o.vy > 0 && o.y > 40) {
        const ax = clamp(-o.x * 0.5 + gauss(rng) * 60 * (1 - prof.punch + 0.1), -HW, HW), ay = -HH;
        const d = Math.hypot(ax - o.x, ay - o.y) || 1;
        const k = 30 + 70 * prof.punch;
        set(o.x + (ax - o.x) / d * k, o.y + (ay - o.y) / d * k);
        b.say = 'punch';
      } else { set(ix, Math.min(iy, me.y > iy ? iy : Math.max(iy, me.y - 400))); b.say = 'block'; }
      return;
    }
  }
  // ---- otherwise: home, shadowing the puck a little ----
  set(homeX + b.errX * 0.3, homeY);
  b.say = 'home';
}

// A coaching suggestion for the human (the Hint button): what the strongest brain would do right now.
export function coach(w, side, prof, rng) {
  const f = side === 0 ? 1 : -1, pu = w.puck;
  const o = { x: pu.x, y: pu.y * f, vx: pu.vx, vy: pu.vy * f };
  const opp = { x: w.pads[1 - side].x, y: w.pads[1 - side].y * f };
  const speed = Math.hypot(o.vx, o.vy);
  const flip = (p) => ({ x: p.x, y: p.y * f });
  if (o.y > 10 && speed < 330) {
    const plan = planShot({ ...prof, err: 0, bank: Math.max(prof.bank, 0.7) }, rng, o, opp);
    const dx = Math.cos(plan.ang), dy = Math.sin(plan.ang);   // err is 0 here, so the line is exact
    const back = flip({ x: o.x - dx * (R_PAD + R_PUCK + 12), y: o.y - dy * (R_PAD + R_PUCK + 12) });
    const line = shotLine(pu.x, pu.y, dx, dy * f);
    return { kind: 'strike', plan, stand: back, line: line.pts, text: `${describeShot(plan)}: stand behind the puck, then sweep through it` };
  }
  if (o.vy > 40 || (o.y > 10 && speed >= 330)) {
    const pts = predictPuck(o, 1.6, 1 / 30);
    const defY = prof.defY;
    let hit = pts.find((s) => s.y >= defY - 60 && s.vy > 0) || pts[pts.length - 1];
    const stand = flip({ x: hit.x, y: clamp(Math.max(hit.y, defY - 60), 120, HH - R_PAD) });
    return { kind: 'defend', stand, line: pts.filter((_, i) => i % 3 === 0).map(flip), text: 'Block the lane: put your paddle on the ring and push it back' };
  }
  const pts = predictPuck(o, 1.2, 1 / 30);
  return { kind: 'wait', stand: flip({ x: clamp(o.x * 0.3, -90, 90), y: prof.defY - 40 }), line: pts.filter((_, i) => i % 3 === 0).map(flip), text: 'Guard the middle of your goal and wait for the puck to come back' };
}

// Safety net on top of every behaviour: a paddle that is directly in front of its own puck (the puck between the paddle and my goal,
// within reach) must never move toward it, or it would knock the puck backwards into my own goal. Back off along the line
// away from the puck instead; behind-the-puck strikes and side passes are unaffected (they are not in the puck's lane).
export function brainStep(b, w, dt, ctx = {}) {
  brainStepInner(b, w, dt, ctx);
  if (b.phase === 'strike') return;
  const side = b.side, pad = w.pads[side], f = side === 0 ? 1 : -1, pu = w.puck;
  if (Math.hypot(pu.vx, pu.vy) < 60) return;     // a resting puck is the line-up logic's job (it goes round it)
  const mx = pad.x, my = pad.y * f, ux = pu.x, uy = pu.y * f;
  const reach = R_PAD + R_PUCK;
  if (uy <= my + 6 || uy - my > reach + 50 || Math.abs(ux - mx) > reach + 6) return;     // puck not directly behind me
  const tx = pad.tx - mx, ty = pad.ty * f - my;
  if (tx * (ux - mx) + ty * (uy - my) <= 0) return;                                     // not heading toward the puck
  const dx = mx - ux, dy = my - uy, l = Math.hypot(dx, dy) || 1;
  const nx = clamp(mx + dx / l * 70, -HW + R_PAD, HW - R_PAD), ny = clamp(my + dy / l * 70, R_PAD, HH - R_PAD);
  b.tx = nx; b.ty = ny; pad.tx = nx; pad.ty = ny * f; b.say = 'hold';
}
