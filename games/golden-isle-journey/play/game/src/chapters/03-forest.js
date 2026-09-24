// Chapter 3: guarding the hermitage. Raiders come along the ground from both sides and swoop from
// the upper corners; tap one to loose an arrow. The quiver is small, so choose who to stop first.
// Deer and birds must never be targeted.
import { W, H, TAU, PAL, INK, GOLD, clamp, lerp, smooth, hash, sky, light, ridge, treeline, stars, motes, finish, shadow, shakeOffset, rays, banyan } from '../stage.js';
import { figure, poses, stridePose, deer, bird } from '../puppets.js';
import { label, caption, pips, meter } from '../ui.js';

const LENGTH = 75, GROUND = 1262, HUT_X = 410, AX = 292, AY = 1196;
const TYPES = { runner: { hp: 1, speed: 92, s: 1.0 }, brute: { hp: 2, speed: 46, s: 1.5 }, flyer: { hp: 1, dur: 7.5, s: 1.0 } };

export function create(env, shared) {
  const { rng } = env;
  const L = shared.text.lines;
  const s = {
    t: 0, time: shared.showcase ? 30 : 0, quiver: 5, refill: 0, calm: 5, harmed: 0, nextId: 1, spawnIn: 1.5, critterIn: 6,
    raiders: [], arrows: [], puffs: [], critters: [], aim: -0.3, dir: 1, shotT: 9, shake: 0, msg: '', msgT: 0, done: false, doneT: 0, lost: false,
  };
  const say = (m, d = 1.8) => { s.msg = m; s.msgT = d; };

  function spawn(forceKind) {
    const roll = rng.next(), side = rng.chance(0.5) ? -1 : 1;
    const kind = forceKind ?? (roll < 0.3 ? 'flyer' : roll < 0.55 && s.time > 12 ? 'brute' : 'runner');
    const r = { id: s.nextId++, kind, side, hp: TYPES[kind].hp, u: 0, x: side < 0 ? -70 : W + 70, y: GROUND, flash: 0, ph: rng.range(0, 6) };
    if (kind === 'flyer') { r.sx = side < 0 ? -80 : W + 80; r.sy = rng.range(230, 620); r.x = r.sx; r.y = r.sy; }
    s.raiders.push(r);
  }
  if (shared.showcase) { spawn('runner'); spawn('brute'); spawn('flyer'); spawn('flyer'); s.raiders.forEach((r, i) => { r.u = 0.3 + i * 0.1; if (r.kind !== 'flyer') r.x += -r.side * (140 + i * 70); }); }

  const centre = (r) => (r.kind === 'flyer' ? [r.x, r.y] : [r.x, r.y - 105 * TYPES[r.kind].s]);

  function update(dt, input) {
    s.t += dt; s.msgT = Math.max(0, s.msgT - dt); s.shake = Math.max(0, s.shake - dt); s.shotT += dt;
    for (const pf of s.puffs) pf.t += dt;
    s.puffs = s.puffs.filter((pf) => pf.t < 0.9);
    if (s.done || s.lost) { s.doneT += dt; return; }
    s.time += dt;
    if (s.quiver < 5) { s.refill += dt; if (s.refill >= 0.9) { s.refill = 0; s.quiver += 1; } }
    // waves
    s.spawnIn -= dt;
    if (s.spawnIn <= 0 && s.time < LENGTH - 5) {
      spawn(); const k = s.time / LENGTH; s.spawnIn = lerp(2.6, 1.05, k) * rng.range(0.8, 1.25);
      if (rng.chance(0.18 + k * 0.2)) { spawn(); say(L.wave, 1.2); }
    }
    s.critterIn -= dt;
    if (s.critterIn <= 0) {
      const d = rng.chance(0.5) ? 1 : -1, isDeer = rng.chance(0.55);
      s.critters.push({ kind: isDeer ? 'deer' : 'bird', dir: d, x: d > 0 ? -90 : W + 90, y: isDeer ? GROUND - 8 : rng.range(330, 820), v: isDeer ? 70 : 150 });
      s.critterIn = rng.range(7, 12);
    }
    for (const c of s.critters) c.x += c.dir * c.v * dt;
    s.critters = s.critters.filter((c) => c.x > -140 && c.x < W + 140);
    // raiders advance
    for (const r of s.raiders) {
      r.flash = Math.max(0, r.flash - dt);
      if (r.kind === 'flyer') { r.u += dt / TYPES.flyer.dur; const e = Math.pow(r.u, 1.5); r.x = lerp(r.sx, HUT_X, r.u) + Math.sin(r.u * 9 + r.ph) * 70 * (1 - r.u); r.y = lerp(r.sy, GROUND - 170, e); }
      else r.x -= r.side * TYPES[r.kind].speed * (r.flash > 0 ? 0.3 : 1) * dt;
      const reached = r.kind === 'flyer' ? r.u >= 1 : Math.abs(r.x - HUT_X) < 125;
      if (reached) { r.hp = 0; r.gone = true; s.calm -= 1; s.shake = 0.4; shared.sfx('thud'); const [cx, cy] = centre(r); s.puffs.push({ x: cx, y: cy, t: 0, dark: true }); }
    }
    s.raiders = s.raiders.filter((r) => !r.gone);
    if (s.calm <= 0) { s.lost = true; return; }
    // arrows home on their target
    for (const a of s.arrows) {
      a.u += dt / 0.25;
      const r = s.raiders.find((q) => q.id === a.id);
      if (r) [a.tx, a.ty] = centre(r);
      if (a.u >= 1 && r) {
        r.hp -= 1; r.flash = 0.35; shared.sfx(r.hp <= 0 ? 'good' : 'thud');
        if (r.hp <= 0) { r.gone = true; s.puffs.push({ x: a.tx, y: a.ty, t: 0, big: r.kind === 'brute' }); }
      }
    }
    s.arrows = s.arrows.filter((a) => a.u < 1);
    s.raiders = s.raiders.filter((r) => !r.gone);
    // the player's choice
    const p = input.pointer;
    if (p.pressed && p.y > 120) {
      let best = null, bd = 1e9;
      for (const r of s.raiders) { const [cx, cy] = centre(r); const d = Math.hypot(p.x - cx, p.y - cy) / TYPES[r.kind].s; if (d < 120 && d < bd) { bd = d; best = r; } }
      const critter = best ? null : s.critters.find((c) => Math.hypot(p.x - c.x, p.y - (c.kind === 'deer' ? c.y - 70 : c.y)) < 100);
      if (best && s.quiver > 0) {
        const [cx, cy] = centre(best);
        s.quiver -= 1; s.shotT = 0; s.dir = cx < AX ? -1 : 1; s.aim = Math.atan2(cy - (AY - 245), Math.abs(cx - AX));
        s.arrows.push({ id: best.id, x0: AX + s.dir * 75, y0: AY - 245, tx: cx, ty: cy, u: 0 }); shared.sfx('arrow');
      } else if (best) shared.sfx('bad');
      else if (critter) { s.harmed += 1; say(L.spare, 2.2); shared.sfx('bad'); }
    }
    if (s.time >= LENGTH && s.raiders.length === 0) { s.done = true; shared.sfx('good'); }
  }

  function raider(ctx, r, t) {
    const T = TYPES[r.kind], ink = r.flash > 0 ? '#5a2a3a' : INK;
    if (r.kind === 'flyer') {
      const flap = Math.sin(t * 9 + r.ph) * 0.6, d = r.x < HUT_X ? 1 : -1;
      light(ctx, r.x, r.y, 120, '255,110,70', 0.35);
      ctx.save(); ctx.translate(r.x, r.y); ctx.scale(d, 1); ctx.fillStyle = ink;
      for (const w of [-1, 1]) { ctx.save(); ctx.rotate(w * 0.2 - flap * w); ctx.beginPath(); ctx.moveTo(0, 0); ctx.quadraticCurveTo(-40, -90 * w, -130, -70 * w); ctx.lineTo(-96, -40 * w); ctx.lineTo(-110, -16 * w); ctx.lineTo(-62, -14 * w); ctx.lineTo(-60, 8 * w); ctx.closePath(); ctx.fill(); ctx.restore(); }
      ctx.restore();
      figure(ctx, { x: r.x - d * 20, y: r.y + 96, s: 0.85, dir: d, kind: 'raider', prop: 'sword', ink, pose: { ...poses.leap(t), rot: 0.5, shF: 1.6 } });
    } else {
      const d = -r.side;
      shadow(ctx, r.x, r.y, 46 * T.s, 0.35);
      light(ctx, r.x, r.y - 120 * T.s, 110 * T.s, '255,110,70', 0.3);
      figure(ctx, { x: r.x, y: r.y, s: T.s, dir: d, kind: 'raider', prop: r.kind === 'brute' ? 'mace' : 'sword', ink, pose: r.kind === 'brute' ? { ...stridePose('raider', r.x * d, T.s, { t }), shF: 2.2, elF: 0.5, propA: 2.7 } : { ...stridePose('raider', r.x * d, T.s, { run: true, t }), shF: 1.9, elF: 0.4 } });
      if (r.kind === 'brute') pips(ctx, r.x - 13, r.y - 250 * T.s + 40, r.hp, 2, '255,120,80', 7, 26);
    }
  }

  function render(ctx) {
    const t = s.t, rm = shared.rm(), sway = rm ? 0 : Math.sin(t * 0.25) * 40;
    const [ox, oy] = shakeOffset(t, s.shake * 16, rm);
    ctx.save(); ctx.translate(ox, oy);
    sky(ctx, ['#050d18', '#0d3a38', '#3c7a5c', '#b9cf80'], null);
    stars(ctx, 0.7, t, 0, 600);
    light(ctx, 520, 330, 300, '230,240,200', 0.5); ctx.fillStyle = 'rgba(240,246,214,0.95)'; ctx.beginPath(); ctx.arc(520, 330, 52, 0, TAU); ctx.fill();
    ridge(ctx, { base: 880, amp: 110, wl: 360, scroll: 200 + sway * 0.1, color: '#1d4a40', seed: 3 });
    treeline(ctx, { base: 1030, scroll: 300 + sway * 0.3, color: PAL.forest.far, seed: 2, h: 520, gap: 150 });
    light(ctx, HUT_X, 1120, 560, '255,200,120', 0.5);
    treeline(ctx, { base: 1150, scroll: 80 + sway * 0.6, color: PAL.forest.mid, seed: 6, h: 760, gap: 230, cut: 'rgba(238,230,150,0.3)' });
    rays(ctx, { x: 520, y: 300, dir: Math.PI / 2 + 0.25, n: 7, len: 1300, spread: 1.0, rgb: '238,236,170', alpha: 0.14, t, rm });
    banyan(ctx, { x: -30, base: 1300, h: 1000, side: 1, t, rm, seed: 1 }); banyan(ctx, { x: W + 30, base: 1300, h: 900, side: -1, t, rm, seed: 5 });
    // ground with the rise the hermitage stands on
    ctx.fillStyle = PAL.forest.near; ctx.beginPath(); ctx.moveTo(0, H); ctx.lineTo(0, GROUND - 10);
    ctx.quadraticCurveTo(140, GROUND - 6, 210, GROUND - 56); ctx.quadraticCurveTo(360, GROUND - 96, 560, GROUND - 50); ctx.quadraticCurveTo(620, GROUND - 8, W, GROUND - 12); ctx.lineTo(W, H); ctx.fill();
    ctx.strokeStyle = 'rgba(238,230,150,0.25)'; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(0, GROUND - 10); ctx.quadraticCurveTo(140, GROUND - 6, 210, GROUND - 56); ctx.quadraticCurveTo(360, GROUND - 96, 560, GROUND - 50); ctx.quadraticCurveTo(620, GROUND - 8, W, GROUND - 12); ctx.stroke();
    // the leaf hut, a hearth, the two who wait by it
    const hx = HUT_X + 40, hy = GROUND - 66;
    ctx.fillStyle = INK; ctx.beginPath(); ctx.moveTo(hx - 130, hy); ctx.lineTo(hx - 100, hy - 120); ctx.lineTo(hx, hy - 215); ctx.lineTo(hx + 110, hy - 120); ctx.lineTo(hx + 140, hy); ctx.fill();
    ctx.beginPath(); ctx.moveTo(hx - 160, hy - 104); ctx.lineTo(hx, hy - 236); ctx.lineTo(hx + 170, hy - 104); ctx.lineTo(hx + 150, hy - 96); ctx.lineTo(hx, hy - 210); ctx.lineTo(hx - 140, hy - 96); ctx.fill();
    ctx.fillStyle = 'rgba(255,196,110,0.9)'; ctx.beginPath(); ctx.moveTo(hx - 24, hy); ctx.lineTo(hx - 24, hy - 70); ctx.arc(hx, hy - 70, 24, Math.PI, 0); ctx.lineTo(hx + 24, hy); ctx.fill();
    ctx.strokeStyle = 'rgba(242,196,106,0.5)'; ctx.lineWidth = 2; for (let i = 0; i < 6; i++) { ctx.beginPath(); ctx.moveTo(hx - 130 + i * 26, hy - 100 - i * 20); ctx.lineTo(hx - 118 + i * 26, hy - 84 - i * 20); ctx.stroke(); ctx.beginPath(); ctx.moveTo(hx + 140 - i * 26, hy - 100 - i * 20); ctx.lineTo(hx + 128 - i * 26, hy - 84 - i * 20); ctx.stroke(); }
    figure(ctx, { x: hx + 100, y: hy + 4, s: 1.3, dir: -1, kind: 'princess_f', pose: poses.stand(t) });
    figure(ctx, { x: hx + 190, y: hy + 12, s: 1.35, dir: 1, kind: 'brother_f', prop: 'bow', pose: poses.holdBow(t + 1) });
    // creatures of the forest
    for (const c of s.critters) { if (c.kind === 'deer') deer(ctx, c.x, c.y, 0.9, t, c.dir, false, '#0c1a14'); else { bird(ctx, c.x, c.y + Math.sin(t * 2 + c.x / 90) * 20, 1.5, t, '#0c1a14'); bird(ctx, c.x - c.dir * 44, c.y + 30 + Math.sin(t * 2.2 + 1) * 18, 1.1, t + 0.5, '#0c1a14'); } }
    // the archer
    shadow(ctx, AX, AY, 60, 0.4);
    const pull = s.quiver > 0 ? clamp(s.shotT / 0.35, 0, 1) * 0.85 : 0;
    figure(ctx, { x: AX, y: AY, s: 1.75, dir: s.dir, kind: 'prince_f', prop: 'bow', pose: poses.drawBow(t, pull, s.aim) });
    for (const r of [...s.raiders].sort((a, b) => a.y - b.y)) raider(ctx, r, t);
    for (const a of s.arrows) {
      const x = lerp(a.x0, a.tx, a.u), y = lerp(a.y0, a.ty, a.u), an = Math.atan2(a.ty - a.y0, a.tx - a.x0);
      ctx.strokeStyle = 'rgba(255,226,160,0.35)'; ctx.lineWidth = 6; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(a.x0, a.y0); ctx.lineTo(x, y); ctx.stroke();
      ctx.strokeStyle = '#fff0c4'; ctx.lineWidth = 4; ctx.beginPath(); ctx.moveTo(x - Math.cos(an) * 70, y - Math.sin(an) * 70); ctx.lineTo(x, y); ctx.stroke();
    }
    for (const pf of s.puffs) {
      const u = pf.t / 0.9, n = pf.big ? 14 : 9;
      for (let i = 0; i < n; i++) { const an = (i / n) * TAU + i, d = u * (pf.big ? 130 : 90) * (0.5 + hash(i) * 0.7); ctx.fillStyle = pf.dark ? `rgba(20,8,14,${(1 - u) * 0.8})` : `rgba(255,${190 + i * 4},120,${(1 - u) * 0.85})`; ctx.beginPath(); ctx.arc(pf.x + Math.cos(an) * d, pf.y + Math.sin(an) * d - u * 50, (1 - u) * (pf.big ? 16 : 11) + 2, 0, TAU); ctx.fill(); }
    }
    // near foliage frames the stage
    ctx.fillStyle = '#040b09';
    for (let i = 0; i < 7; i++) { const bx = i < 4 ? -30 + i * 38 : W + 30 - (i - 4) * 44, by = 170 + hash(i) * 220; ctx.beginPath(); ctx.ellipse(bx + sway * 0.4, by, 130, 60, (i % 2 ? -1 : 1) * 0.5, 0, TAU); ctx.fill(); }
    motes(ctx, { n: 34, t, rgb: '214,240,150', kind: 'firefly', top: 300, bottom: 1300, rm });
    ctx.restore();
    finish(ctx, 0.78);

    meter(ctx, 190, 150, 340, 16, s.time / LENGTH, '214,240,150');
    label(ctx, L.quiver, 40, 1452, 24); pips(ctx, 52, 1482, s.quiver, 5, '255,226,160', 12, 34);
    label(ctx, L.calm, W - 40, 1452, 24, 'right'); pips(ctx, W - 52 - 4 * 34, 1482, s.calm, 5, '160,230,170', 12, 34);
    caption(ctx, s.msg, 1370, Math.min(1, s.msgT * 2), 30);
  }

  return {
    state: s, update, render,
    result: () => (s.lost && s.doneT > 0.8 ? { lost: true } : s.done && s.doneT > 1.6 ? { stars: s.calm >= 4 && s.harmed === 0 ? 3 : s.calm >= 2 ? 2 : 1 } : null),
  };
}
