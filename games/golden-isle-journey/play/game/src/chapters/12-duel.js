// Chapter 12: the duel. Drag back to aim (a dotted arc shows the flight), release to shoot.
// Crowned heads grow back unless the glinting one is struck. After six, counsel arrives: the
// last arrow must find the king's centre while his arms are raised. His fire bolts fall on the
// army's line: shoot them down or lose heart.
import { W, H, TAU, PAL, INK, GOLD, clamp, lerp, smooth, sky, stars, skyline, ridge, light, motes, finish, shakeOffset, clouds, rays } from '../stage.js';
import { figure, poses, tenCrowned, tenHeadPos, chariot, fireArrow } from '../puppets.js';
import { pips, label, caption } from '../ui.js';

const ARCHER = { x: 200, y: 1478 }, NOCK = { x: 250, y: 1190 }, G = 900, NEED = 10;

export function create(env, shared) {
  const { rng } = env;
  const L = shared.text.lines;
  const s = {
    t: 0, phase: 'heads', phaseT: 0, heads: Array(10).fill(1), down: Array(10).fill(false), target: rng.int(10), felled: 0,
    aim: null, angle: -1.0, power: 0, reload: 0, arrows: [], bolts: [], sparks: [], boltIn: 3, resolve: 8, shots: 0,
    shake: 0, flash: 0, rx: W / 2, msgT: 0,
  };
  if (shared.showcase) {
    for (const i of [1, 6, 8]) { s.down[i] = true; s.heads[i] = 0; } s.felled = 3; s.target = 4;
    s.arrows.push({ x: 420, y: 760, vx: 420, vy: -760 });
    s.bolts.push({ x: 470, y: 760, tx: 560, ty: 1400, t: 0.45, x0: 430, y0: 420 });
    s.aim = null; s.angle = -1.05; s.power = 0.8;
  }
  const kingY = () => 640 + Math.sin(s.t * 0.9) * 14;
  const pickTarget = () => { const open = []; for (let i = 0; i < 10; i++) if (!s.down[i]) open.push(i); s.target = open.length ? rng.pick(open) : -1; };
  const glinting = () => s.phase === 'heads' && (s.t % 2.4) < 1.1;
  const armsUp = () => (s.phase === 'core' ? smooth(clamp(Math.min((s.phaseT % 4.4) - 0.6, 3.0 - (s.phaseT % 4.4)) * 3, 0, 1)) : 0);
  const velocity = () => { const v = 500 + s.power * 1500; return [Math.cos(s.angle) * v, Math.sin(s.angle) * v]; };

  function update(dt, input) {
    const p = input.pointer;
    s.t += dt; s.phaseT += dt;
    s.shake = Math.max(0, s.shake - dt); s.flash = Math.max(0, s.flash - dt * 2); s.reload = Math.max(0, s.reload - dt);
    for (const f of s.sparks) f.t += dt;
    s.sparks = s.sparks.filter((f) => f.t < 0.6);
    if (s.phase === 'won') return;
    s.rx = W / 2 + Math.sin(s.t * 0.45) * 170;
    for (let i = 0; i < 10; i++) if (!s.down[i] && s.heads[i] < 1) s.heads[i] = Math.min(1, s.heads[i] + dt / 2.6);

    // aiming: pull back like a bowstring
    if (p.pressed && p.y > 130) s.aim = { x: p.x, y: p.y };
    if (s.aim && p.down) {
      const dx = s.aim.x - p.x, dy = s.aim.y - p.y, len = Math.hypot(dx, dy);
      s.power = clamp(len / 300, 0, 1);
      if (len > 12) s.angle = clamp(Math.atan2(dy, dx), -Math.PI + 0.15, -0.15);
    }
    if (s.aim && p.released) {
      if (s.power > 0.15 && s.reload <= 0) { const [vx, vy] = velocity(); s.arrows.push({ x: NOCK.x, y: NOCK.y, vx, vy }); s.reload = 0.35; s.shots += 1; shared.sfx('arrow'); }
      s.aim = null; s.power = 0;
    }
    if (input.keys.down.has('ArrowLeft')) s.angle = clamp(s.angle - dt, -Math.PI + 0.15, -0.15);
    if (input.keys.down.has('ArrowRight')) s.angle = clamp(s.angle + dt, -Math.PI + 0.15, -0.15);
    if (input.keys.pressed.has('Space') && s.reload <= 0) { s.power = 0.85; const [vx, vy] = velocity(); s.arrows.push({ x: NOCK.x, y: NOCK.y, vx, vy }); s.power = 0; s.reload = 0.35; shared.sfx('arrow'); }

    // the king's fire bolts fall on the army's line
    if (s.phase !== 'counsel') s.boltIn -= dt;
    if (s.boltIn <= 0) {
      s.boltIn = s.phase === 'core' ? 3.4 : 5.2;
      const side = rng.chance(0.5) ? -1 : 1;
      s.bolts.push({ x0: s.rx + side * 150, y0: kingY() - 330, tx: rng.range(400, 680), ty: 1400, t: 0, x: 0, y: 0 });
      shared.sfx('fire');
    }
    for (const b of s.bolts) {
      if (b.shot) continue;              // shot down by an arrow: gone, and it costs nothing
      b.t += dt / 4.2;
      b.x = lerp(b.x0, b.tx, b.t); b.y = lerp(b.y0, b.ty, b.t * b.t * 0.6 + b.t * 0.4);
      if (b.t >= 1) { s.resolve -= 1; s.shake = 0.5; s.sparks.push({ x: b.tx, y: b.ty, t: 0, rgb: '255,140,60' }); shared.sfx('thud'); }
    }
    s.bolts = s.bolts.filter((b) => b.t < 1 && !b.shot);

    // arrows
    const ky = kingY(), up = armsUp();
    for (const a of s.arrows) {
      a.vy += G * dt; a.x += a.vx * dt; a.y += a.vy * dt;
      for (const b of s.bolts) if (!a.dead && Math.hypot(a.x - b.x, a.y - b.y) < 46) { a.dead = true; b.t = 2; b.shot = true; s.sparks.push({ x: b.x, y: b.y, t: 0, rgb: '255,200,120' }); shared.sfx('chime'); }
      if (a.dead) continue;
      if (s.phase === 'heads' || s.phase === 'counsel') {
        for (let i = 0; i < 10; i++) {
          if (s.heads[i] < 0.6) continue;
          const [hx, hy] = tenHeadPos(i, s.rx, ky, 1.15);
          if (Math.hypot(a.x - hx, a.y - (hy - 8)) < 27) {
            a.dead = true; s.heads[i] = 0; s.sparks.push({ x: hx, y: hy, t: 0, rgb: '255,220,150' });
            if (i === s.target && s.phase === 'heads') { s.down[i] = true; s.felled += 1; s.flash = 0.5; shared.sfx('good'); pickTarget(); if (s.felled >= NEED) { s.phase = 'counsel'; s.phaseT = 0; shared.sfx('horn'); } }
            else shared.sfx('thud');
            break;
          }
        }
      } else if (s.phase === 'core') {
        if (Math.hypot(a.x - s.rx, a.y - (ky - 112 * 1.15)) < 40) {
          a.dead = true;
          if (up > 0.6) { s.phase = 'won'; s.phaseT = 0; s.flash = 1; s.shake = 1; s.bolts = []; shared.sfx('star'); }
          else { s.sparks.push({ x: a.x, y: a.y, t: 0, rgb: '200,200,220' }); shared.sfx('thud'); }
        }
      }
    }
    s.arrows = s.arrows.filter((a) => !a.dead && a.y < H + 50 && a.x > -50 && a.x < W + 50);
    if (s.phase === 'counsel' && s.phaseT > 4.5) { s.phase = 'core'; s.phaseT = 0; }
    if (s.resolve <= 0 && s.phase !== 'won') { s.resolve = 0; s.phase = 'lost'; }
  }

  function render(ctx) {
    const t = s.t, rm = shared.rm(), ky = kingY();
    const wonU = s.phase === 'won' ? smooth(s.phaseT / 3.2) : 0;
    const [ox, oy] = shakeOffset(t, s.shake * 14, rm);
    ctx.save(); ctx.translate(ox, oy);
    sky(ctx, PAL.ember.sky, null);
    if (wonU > 0) { ctx.globalAlpha = wonU; sky(ctx, PAL.dawn.sky, null); ctx.globalAlpha = 1; }
    stars(ctx, 0.4 * (1 - wonU), t, 0, 400);
    light(ctx, W / 2, 900, 800, wonU > 0 ? '255,220,150' : '255,110,40', 0.55);
    clouds(ctx, { y: 160, h: 380, scroll: t * 16, color: `rgba(40,8,10,${0.6 * (1 - wonU)})`, n: 7, seed: 5, scale: 1.4 });
    clouds(ctx, { y: 700, h: 260, scroll: t * 26 + 200, color: `rgba(70,16,12,${0.5 * (1 - wonU)})`, n: 5, seed: 11 });
    rays(ctx, { x: s.rx, y: 470, dir: Math.PI / 2, n: 9, len: 1300, spread: 1.5, rgb: wonU > 0 ? '255,230,170' : '255,120,50', alpha: 0.2, t, rm });
    skyline(ctx, { base: 1130, scroll: 60, color: '#2a0a0c', seed: 3, h: 200, gap: 116, kind: 'lanka', lit: '255,150,60', t });
    if (!rm) for (let i = 0; i < 6; i++) light(ctx, 60 + i * 130, 1040 + Math.sin(t * 3 + i) * 12, 110, '255,120,40', 0.35 * (1 - wonU));
    ridge(ctx, { base: 1200, amp: 40, wl: 300, scroll: 0, color: '#1a0708', seed: 2 });

    // the ten-crowned king on his chariot
    const sink = wonU * 420, ka = 1 - wonU;
    ctx.globalAlpha = ka;
    light(ctx, s.rx, ky - 170 + sink, 420, '255,90,40', 0.45);
    tenCrowned(ctx, { x: s.rx, y: ky + sink, s: 1.15, t, heads: s.heads, glint: glinting() ? s.target : -1, arms: s.phase === 'won' ? -0.6 * wonU : armsUp(), core: s.phase === 'core' ? 0.25 + armsUp() * 0.75 : 0 });
    chariot(ctx, s.rx - 10, ky + 20 + sink, 1.25, t, { dir: -1, open: true });
    ctx.globalAlpha = 1;

    // bolts, visible all the way down
    for (const b of s.bolts) {
      light(ctx, b.x, b.y, 120, '255,120,50', 0.8);
      ctx.strokeStyle = 'rgba(255,170,80,0.55)'; ctx.lineWidth = 10; ctx.lineCap = 'round';
      ctx.beginPath(); ctx.moveTo(b.x, b.y); ctx.lineTo(lerp(b.x, b.x0, 0.12), b.y - 90); ctx.stroke();
      ctx.fillStyle = '#fff0c0'; ctx.beginPath(); ctx.arc(b.x, b.y, 13, 0, TAU); ctx.fill();
      ctx.strokeStyle = 'rgba(255,120,80,0.5)'; ctx.lineWidth = 2; ctx.setLineDash([6, 10]); ctx.beginPath(); ctx.arc(b.tx, b.ty - 10, 34, 0, TAU); ctx.stroke(); ctx.setLineDash([]);
    }

    // ground, the army's line, the archer
    ctx.fillStyle = '#0c0406'; ctx.beginPath(); ctx.moveTo(0, 1350); ctx.quadraticCurveTo(200, 1300, 420, 1370); ctx.quadraticCurveTo(600, 1410, W, 1390); ctx.lineTo(W, H); ctx.lineTo(0, H); ctx.fill();
    for (let i = 0; i < 5; i++) figure(ctx, { x: 420 + i * 62, y: 1392 + (i % 2) * 14, s: 0.5, kind: 'vanara', prop: i % 2 ? 'mace' : null, pose: wonU > 0 || s.flash > 0 ? poses.cheer(t, i) : poses.stand(t + i) });
    if (s.phase === 'counsel' || s.phase === 'core') figure(ctx, { x: 96, y: 1372, s: 0.74, kind: 'vibhishan', pose: { ...poses.stand(t), shF: 1.9, elF: 0.3 } });
    light(ctx, ARCHER.x + 20, ARCHER.y - 150, 240, '255,210,140', 0.35);
    const aimA = s.angle, pull = s.aim ? s.power : 0;
    figure(ctx, { x: ARCHER.x, y: ARCHER.y, s: 1.6, kind: 'prince', prop: 'bow', pose: { ...poses.drawBow(t, pull, clamp(aimA, -1.5, -0.1)), fireArrow: true } });

    // trajectory hint
    if (s.aim && s.power > 0.05) {
      let [vx, vy] = velocity(), x = NOCK.x, y = NOCK.y;
      for (let i = 0; i < 26; i++) {
        vy += G * 0.055; x += vx * 0.055; y += vy * 0.055;
        if (y > 1400 || x < 0 || x > W) break;
        ctx.fillStyle = `rgba(255,236,180,${0.9 - i * 0.03})`; ctx.beginPath(); ctx.arc(x, y, 5 - i * 0.12, 0, TAU); ctx.fill();
      }
    }
    for (const a of s.arrows) {
      const an = Math.atan2(a.vy, a.vx);
      fireArrow(ctx, { x: a.x, y: a.y, a: an, s: 0.85, t: t + a.x * 0.01 });
    }
    for (const f of s.sparks) { const a = 1 - f.t / 0.6; for (let i = 0; i < 9; i++) { ctx.fillStyle = `rgba(${f.rgb},${a})`; ctx.beginPath(); ctx.arc(f.x + Math.cos(i * 0.7) * f.t * 160, f.y + Math.sin(i * 0.7) * f.t * 160, 5 * a + 1, 0, TAU); ctx.fill(); } }
    motes(ctx, { n: 36, t, rgb: wonU > 0.5 ? '255,230,170' : '255,140,60', kind: wonU > 0.5 ? 'petal' : 'ember', top: 200, bottom: 1400, rm });
    if (s.flash > 0) { ctx.fillStyle = `rgba(255,236,190,${s.flash * 0.35})`; ctx.fillRect(0, 0, W, H); }
    ctx.restore();
    finish(ctx, 0.72);

    label(ctx, L.heads, 130, 142, 22); pips(ctx, 138, 161, s.felled, NEED, '255,214,120', 8, 20);
    label(ctx, L.resolve, 400, 142, 22); pips(ctx, 408, 161, s.resolve, 8, '160,230,170', 8, 20);
    if (s.phase === 'counsel') caption(ctx, L.counsel, 900, Math.min(1, s.phaseT * 2, (4.5 - s.phaseT) * 2), 32);
    if (s.phase === 'core' && armsUp() > 0.6) label(ctx, L.now, s.rx, kingY() - 420, 44, 'center', '#fff2c0', undefined, 700);
  }

  return {
    state: s, update, render,
    result: () => (s.phase === 'lost' ? { lost: true } : s.phase === 'won' && s.phaseT > 3.6 ? { stars: s.resolve >= 6 ? 3 : s.resolve >= 3 ? 2 : 1 } : null),
  };
}
