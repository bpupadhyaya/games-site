// Chapter 5: the golden deer, the flying chariot, and the eagle king's stand.
// A: chase - tap ahead of the bounding deer. B: the camera tilts to the sky as the chariot crosses.
// C: tap the glinting wheel so the eagle strikes it. The chariot escapes south: that is the story.
import { W, H, TAU, PAL, clamp, lerp, smooth, hash, sky, sun, ridge, treeline, clouds, light, motes, finish, shadow, shakeOffset } from '../stage.js';
import { figure, poses, stridePose, deer, eagle, chariot, bird } from '../puppets.js';
import { label, caption, pips } from '../ui.js';

const GROUND = 1210, LANES = [1200, 1010, 830], CHASE_MAX = 25, EAGLE_TIME = 15, TILT = 640;

export function create(env, shared) {
  const { rng } = env;
  const L = shared.text.lines;
  const s = {
    t: 0, phase: 'chase', pt: 0, scroll: 0, noHint: false,
    deerX: 520, deerY: LANES[0], lane: 0, laneT: 1.2, hits: 0, hitFlash: 0,
    arrows: [], burst: 0, cam: 0,
    chX: -300, chY: 560, chS: 1, glint: -1, glintT: 0.8, strikes: 0, dive: 0, diveWheel: 0, shud: 0, sparks: 0,
    eaX: 900, eaY: 300, done: false,
  };
  if (shared.showcase) { s.phase = 'eagle'; s.pt = 4; s.cam = TILT; s.chX = 400; s.hits = 3; s.strikes = 2; s.glint = 1; s.glintT = 0.9; }
  const go = (ph) => { s.phase = ph; s.pt = 0; };
  const wheelPos = (i) => [s.chX + (i === 0 ? -70 : 60) * s.chS, s.chY + Math.sin(s.t * 2) * 6 + 56 * s.chS];

  function update(dt, input) {
    s.t += dt; s.pt += dt;
    const p = input.pointer;
    s.hitFlash = Math.max(0, s.hitFlash - dt * 2); s.shud = Math.max(0, s.shud - dt * 2); s.sparks = Math.max(0, s.sparks - dt * 2);
    if (s.phase === 'chase') {
      s.scroll += 520 * dt;
      s.laneT -= dt;
      if (s.laneT <= 0) { let n = rng.int(3); if (n === s.lane) n = (n + 1) % 3; s.lane = n; s.laneT = rng.range(0.9, 1.7); }
      s.deerY = lerp(s.deerY, LANES[s.lane], 1 - Math.pow(0.02, dt));
      s.deerX = 520 + Math.sin(s.t * 0.9) * 90 + Math.sin(s.t * 2.3) * 30;
      if (p.pressed && p.y > 130 && s.arrows.length < 3) { s.arrows.push({ x: p.x, y: p.y, t: 0 }); shared.sfx('arrow'); }
      for (const a of s.arrows) {
        a.t += dt;
        if (a.t >= 0.4 && !a.spent) {
          a.spent = true;
          if (Math.hypot(a.x - s.deerX, a.y - (s.deerY - 70)) < 85) { s.hits += 1; s.hitFlash = 1; shared.sfx('good'); } else shared.sfx('tap');
        }
      }
      s.arrows = s.arrows.filter((a) => a.t < 0.7);
      if (s.hits >= 5 || s.pt > CHASE_MAX) { go('cry'); s.burst = 1; s.arrows = []; s.noHint = true; shared.sfx('chime'); }
    } else if (s.phase === 'cry') {
      s.burst = Math.max(0, s.burst - dt * 0.7);
      s.scroll += 520 * dt * Math.max(0, 1 - s.pt);
      if (s.pt > 4.5) go('sky');
    } else if (s.phase === 'sky') {
      s.cam = TILT * smooth(s.pt / 2.2);
      s.chX = -300 + smooth(clamp((s.pt - 1.5) / 5, 0, 1)) * 700;
      s.eaX = 900; s.eaY = 300;
      if (s.pt > 6.5) { go('eagle'); shared.sfx('horn'); }
    } else if (s.phase === 'eagle') {
      s.chX = 400 + Math.sin(s.t * 0.7) * 110; s.chY = 560 + Math.sin(s.t * 1.1) * 40;
      s.glintT -= dt;
      if (s.glintT <= 0) { if (s.glint < 0) { s.glint = rng.int(2); s.glintT = 1.0; } else { s.glint = -1; s.glintT = 0.35; } }
      if (s.dive > 0) s.dive = Math.max(0, s.dive - dt * 2.4);
      if (p.pressed && p.y > 130 && s.glint >= 0) {
        const [wx, wy] = wheelPos(s.glint);
        if (Math.hypot(p.x - wx, p.y - wy) < 95) { s.strikes += 1; s.dive = 1; s.diveWheel = s.glint; s.shud = 1; s.sparks = 1; s.glint = -1; s.glintT = 0.45; shared.sfx('thud'); }
      }
      // the eagle wheels around the chariot, diving at the wheel when called
      const ang = s.t * 1.3, ox = s.chX + Math.cos(ang) * 270, oy = s.chY - 120 + Math.sin(ang) * 150;
      const [wx, wy] = wheelPos(s.diveWheel), d = smooth(s.dive);
      s.eaX = lerp(ox, wx, d); s.eaY = lerp(oy, wy - 30, d);
      if (s.pt > EAGLE_TIME) { go('away'); s.glint = -1; }
    } else if (s.phase === 'away') {
      s.chX += (260 + s.pt * 120) * dt; s.chY -= 60 * dt; s.chS = Math.max(0.25, s.chS - dt * 0.2);
      s.eaX -= 70 * dt; s.eaY += (60 + s.pt * 70) * dt;
      if (s.pt > 4.2) s.done = true;
    }
  }

  function render(ctx) {
    const t = s.t, rm = shared.rm(), cam = s.cam, k = cam / TILT;
    const [ox, oy] = shakeOffset(t, s.shud * 8, rm);
    ctx.save(); ctx.translate(ox, oy);
    sky(ctx, PAL.forest.sky, null);
    ctx.fillStyle = `rgba(60,16,50,${k * 0.55})`; ctx.fillRect(0, 0, W, H);
    sun(ctx, 520, 520 + cam * 0.35, 60, '255,238,170');
    clouds(ctx, { y: 160 + cam * 0.3, h: 500, scroll: s.scroll * 0.03 + t * 8, color: 'rgba(30,70,56,0.4)', n: 6, seed: 4, scale: 1.3 });
    ridge(ctx, { base: 900 + cam * 0.5, amp: 90, wl: 380, scroll: s.scroll * 0.05, color: PAL.forest.far, seed: 2 });
    treeline(ctx, { base: 1080 + cam * 0.7, scroll: s.scroll * 0.18, color: '#22493a', seed: 3, h: 420, gap: 170 });
    treeline(ctx, { base: 1180 + cam * 0.85, scroll: s.scroll * 0.4, color: PAL.forest.mid, seed: 8, h: 560, gap: 210, cut: 'rgba(238,230,150,0.35)' });

    // sky actors (screen space)
    if (s.phase === 'sky' || s.phase === 'eagle' || s.phase === 'away') {
      light(ctx, s.chX, s.chY, 300 * s.chS, '255,120,70', 0.35);
      chariot(ctx, s.chX + (rm ? 0 : Math.sin(t * 50) * s.shud * 5), s.chY, s.chS, t, { glint: s.glint });
      if (s.sparks > 0) { const [wx, wy] = wheelPos(s.diveWheel); for (let i = 0; i < (rm ? 4 : 12); i++) { const a = hash(i + s.strikes * 13) * TAU, r = (1 - s.sparks) * 130 + 10; ctx.fillStyle = `rgba(255,230,150,${s.sparks})`; ctx.beginPath(); ctx.arc(wx + Math.cos(a) * r, wy + Math.sin(a) * r, 4, 0, TAU); ctx.fill(); } }
      if (s.phase !== 'sky' || s.pt > 5) eagle(ctx, s.eaX, s.eaY, 0.95, t, s.phase === 'away' ? -1 : (Math.cos(t * 1.3) < 0 || s.dive > 0 ? (s.eaX < s.chX ? 1 : -1) : -1));
      if (s.phase === 'eagle') { label(ctx, L.strikes, 60, 176, 24); pips(ctx, 170, 168, s.strikes, 10, '255,214,130', 8, 22); }
    }

    // forest floor
    const gy = GROUND + cam;
    if (gy < H + 300) {
      ctx.fillStyle = PAL.forest.near; ctx.fillRect(0, gy - 6, W, H);
      ridge(ctx, { base: gy + 4, amp: 10, wl: 160, scroll: s.scroll, color: PAL.forest.near, seed: 5 });
      // ledges the deer bounds along
      for (let li = 1; li < 3; li++) {
        const ly = LANES[li] + cam;
        ctx.fillStyle = 'rgba(10,26,20,0.9)';
        for (let i = -1; i < 4; i++) { const x = ((i * 330 - s.scroll * (0.8 + li * 0.05)) % 1320 + 1320) % 1320 - 300; ctx.beginPath(); ctx.ellipse(x + 150, ly + 8, 170, 14, 0, 0, TAU); ctx.fill(); }
      }
      if (s.phase === 'chase') {
        light(ctx, s.deerX, s.deerY - 60 + cam, 200, '255,220,120', 0.35 + s.hitFlash * 0.5);
        shadow(ctx, s.deerX, s.deerY + 6 + cam, 60);
        deer(ctx, s.deerX, s.deerY + cam - Math.abs(Math.sin(t * 7)) * 26, 1, t, 1, true);
      }
      if (s.burst > 0) { const r = (1 - s.burst) * 520 + 40; light(ctx, s.deerX, s.deerY - 60 + cam, r, '255,226,140', s.burst); for (let i = 0; i < (rm ? 6 : 18); i++) { const a = hash(i) * TAU; ctx.fillStyle = `rgba(255,236,170,${s.burst})`; ctx.beginPath(); ctx.arc(s.deerX + Math.cos(a) * r * 0.6, s.deerY - 60 + cam + Math.sin(a) * r * 0.6, 5, 0, TAU); ctx.fill(); } }
      const running = s.phase === 'chase' || (s.phase === 'cry' && s.pt < 1);
      shadow(ctx, 170, gy + 4, 60);
      const aimDy = s.deerY - 120 - (GROUND - 215), aim = Math.atan2(aimDy, s.deerX - 190);
      const pose = running ? { ...stridePose('prince_f', s.scroll * 0.9, 1.7, { run: true, t }), shF: Math.PI / 2 - aim, elF: 0.05, aim, pull: s.arrows.some((a) => a.t < 0.12) ? 0 : 0.7, arrow: true } : poses.holdBow(t);
      figure(ctx, { x: 190, y: gy, s: 1.7, kind: 'prince_f', prop: 'bow', pose });
      for (const a of s.arrows) {
        const u = clamp(a.t / 0.4, 0, 1), x0 = 260, y0 = GROUND - 215, ax = lerp(x0, a.x, u), ay = lerp(y0, a.y, u) - Math.sin(u * Math.PI) * 40 + cam;
        const an = Math.atan2(a.y - y0, a.x - x0);
        ctx.strokeStyle = '#1a0d12'; ctx.lineWidth = 4; ctx.beginPath(); ctx.moveTo(ax - Math.cos(an) * 60, ay - Math.sin(an) * 60); ctx.lineTo(ax, ay); ctx.stroke();
        ctx.fillStyle = '#f2c46a'; ctx.beginPath(); ctx.arc(ax, ay, 5, 0, TAU); ctx.fill();
        if (u < 1) { ctx.strokeStyle = 'rgba(255,230,160,0.6)'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(a.x, a.y + cam, 26 * (1 - u) + 8, 0, TAU); ctx.stroke(); }
      }
      // undergrowth rushing past
      treeline(ctx, { base: gy + 330, scroll: s.scroll * 1.5, color: '#06100c', seed: 12, h: 300, gap: 420 });
    }
    for (let i = 0; i < 3; i++) bird(ctx, ((i * 300 + t * 40) % 900) - 80, 330 + i * 70 + cam * 0.4, 0.8, t + i);
    motes(ctx, { n: 24, t, rgb: k > 0.5 ? '255,170,110' : '238,240,170', kind: 'firefly', top: 300, bottom: 1300, rm, scroll: s.scroll * 0.3 });
    ctx.restore();
    finish(ctx, 0.72);
    if (s.phase === 'chase') pips(ctx, W / 2 - 26, 168, s.hits, 5, '255,214,130', 10, 28);
    if (s.phase === 'cry') caption(ctx, L.cry, 330, Math.min(1, s.pt, 4.5 - s.pt), 30);
    if (s.phase === 'sky') caption(ctx, L.disguise, 1180, Math.min(1, s.pt - 0.8, 6.5 - s.pt), 30);
    if (s.phase === 'eagle') caption(ctx, L.eagle, 1240, Math.min(1, s.pt, 5 - s.pt), 30);
  }

  return { state: s, update, render, result: () => (s.done ? { stars: s.hits + s.strikes >= 9 ? 3 : s.hits + s.strikes >= 6 ? 2 : 1 } : null) };
}
