// Chapter 9: the fortress burns. An auto-run over the roofs with a burning tail: tap to leap,
// hold for the high leap to the upper roofs where the towers stand. Fire follows close behind.
import { W, H, TAU, PAL, INK, clamp, lerp, smooth, hash, sky, stars, skyline, sea, light, motes, finish, shakeOffset } from '../stage.js';
import { figure, poses } from '../puppets.js';
import { label, caption, meter } from '../ui.js';

const LOW = 1150, UP = 800, GRAV = 2700, JUMP = 1450, CUT = 520, HERO_SX = 260, LENGTH = 30000;

export function create(env, shared) {
  const { rng } = env;
  const L = shared.text.lines;
  const plats = [], towers = [];
  let x = -400;
  while (x < LENGTH) {
    const w = x < 0 ? 1500 : rng.range(520, 950);
    plats.push({ x, w, y: LOW, k: plats.length });
    if (x > 0 && rng.chance(0.28)) towers.push({ x: x + w * rng.range(0.35, 0.65), y: LOW, lit: false, h: rng.range(200, 260) });
    x += w + rng.range(130, 200);
  }
  plats.push({ x, w: 900, y: LOW, k: plats.length, last: true });
  const END = x + 820;
  x = 1300;
  while (x < LENGTH - 600) {
    const w = rng.range(380, 760);
    plats.push({ x, w, y: UP, k: plats.length });
    if (w > 430 && rng.chance(0.85)) towers.push({ x: x + w * rng.range(0.4, 0.6), y: UP, lit: false, h: rng.range(300, 420) });
    x += w + rng.range(210, 420);
  }
  const s = { t: 0, x: 0, y: LOW, vy: 0, ground: true, coyote: 0, held: false, speed: 420, gap: 380, lit: 0, total: towers.length, plats, towers,
    slip: 0, slips: 0, msg: 0, phase: 'run', pt: 0, shake: 0, done: false, lost: false, END };
  if (shared.showcase) { const up = plats.find((q) => q.y === UP && q.x > 8000); s.x = up.x + 40; s.y = UP; s.speed = 500; for (const tw of towers) if (tw.x < s.x) { tw.lit = true; s.lit += 1; } }

  const platUnder = (px, y0, y1) => s.plats.find((q) => px >= q.x - 6 && px <= q.x + q.w + 6 && y0 <= q.y + 1 && y1 >= q.y);

  function update(dt, input) {
    s.t += dt; s.pt += dt;
    s.msg = Math.max(0, s.msg - dt); s.shake = Math.max(0, s.shake - dt * 2);
    const p = input.pointer, keys = input.keys;
    const press = (p.pressed && p.y > 130) || keys.pressed.has('Space') || keys.pressed.has('ArrowUp');
    const holding = p.down || keys.down.has('Space') || keys.down.has('ArrowUp');
    if (s.slip > 0) { s.slip -= dt; return; }
    if (s.phase === 'away') { s.x += s.speed * dt; s.vy += GRAV * 0.35 * dt; s.y += s.vy * dt; if (s.pt > 1.8) s.done = true; return; }
    const prog = clamp(s.x / LENGTH, 0, 1);
    s.speed = lerp(420, 600, prog);
    s.gap = Math.min(520, s.gap + 12 * dt);
    s.x += s.speed * dt;
    s.coyote = s.ground ? 0.09 : Math.max(0, s.coyote - dt);
    if (press && s.coyote > 0) { s.vy = -JUMP; s.ground = false; s.coyote = 0; s.held = true; shared.sfx('whoosh'); }
    if (s.held && !holding) { s.held = false; if (s.vy < -CUT) s.vy = -CUT; }
    if (s.ground) { if (!platUnder(s.x, s.y, s.y)) s.ground = false; }
    if (!s.ground) {
      const y0 = s.y; s.vy += GRAV * dt; s.y += s.vy * dt;
      if (s.vy > 0) { const q = platUnder(s.x, y0, s.y); if (q) { s.y = q.y; s.vy = 0; s.ground = true; s.held = false; } }
    }
    for (const tw of s.towers) if (!tw.lit && Math.abs(tw.x - s.x) < 70 && Math.abs(tw.y - s.y) < 150) { tw.lit = true; s.lit += 1; s.shake = 0.4; shared.sfx('fire'); }
    if (s.y > H - 120) {
      s.slips += 1; s.gap -= 115; s.msg = 1.6; shared.sfx('bad');
      if (s.gap < 60) { s.lost = true; return; }
      const q = s.plats.find((r) => r.y === LOW && r.x > s.x + 40) ?? s.plats.find((r) => r.last);
      s.x = q.x + 70; s.y = LOW; s.vy = 0; s.ground = true; s.slip = 0.7;
    }
    if (s.x > s.END) { s.phase = 'away'; s.pt = 0; s.vy = -JUMP * 0.8; s.ground = false; shared.sfx('good'); }
  }

  function flame(ctx, x, y, h, t, k) {
    for (let i = 0; i < 3; i++) {
      const fh = h * (0.7 + 0.3 * Math.sin(t * (9 + i * 2) + k * 3 + i)), w = h * 0.34, ox = (i - 1) * w * 0.6;
      ctx.fillStyle = i === 1 ? 'rgba(255,226,130,0.95)' : 'rgba(255,120,40,0.9)';
      ctx.beginPath(); ctx.moveTo(x + ox - w / 2, y); ctx.quadraticCurveTo(x + ox - w * 0.7, y - fh * 0.5, x + ox + Math.sin(t * 7 + k + i) * w * 0.3, y - fh); ctx.quadraticCurveTo(x + ox + w * 0.7, y - fh * 0.5, x + ox + w / 2, y); ctx.fill();
    }
  }

  function tower(ctx, tw, x, t) {
    ctx.fillStyle = tw.y === UP ? '#1d0708' : '#120405';
    let w = 74, y = tw.y;
    ctx.fillRect(x - w / 2, y - tw.h * 0.45, w, tw.h * 0.45);
    y -= tw.h * 0.45;
    for (let j = 0; j < 3; j++) { const th = tw.h * 0.16; ctx.beginPath(); ctx.moveTo(x - w / 2 - 12, y); ctx.lineTo(x + w / 2 + 12, y); ctx.lineTo(x + w * 0.36, y - th); ctx.lineTo(x - w * 0.36, y - th); ctx.fill(); y -= th; w *= 0.72; }
    ctx.fillRect(x - 3, y - 26, 6, 28);
    ctx.beginPath(); ctx.moveTo(x - 20, y - 26); ctx.quadraticCurveTo(x, y - 8, x + 20, y - 26); ctx.fill();
    ctx.strokeStyle = 'rgba(242,196,106,0.7)'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(x - 20, y - 27); ctx.lineTo(x + 20, y - 27); ctx.stroke();
    if (tw.lit) { light(ctx, x, y - 50, 260, '255,150,60', 0.7); flame(ctx, x, y - 26, 90, t, tw.x); flame(ctx, x, tw.y - tw.h * 0.45, 50, t, tw.x + 3); }
    else { ctx.strokeStyle = `rgba(255,226,150,${0.4 + 0.3 * Math.sin(t * 5 + tw.x)})`; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(x, y - 40, 34, 0, TAU); ctx.stroke(); }
  }

  function render(ctx) {
    const t = s.t, rm = shared.rm(), prog = clamp(s.x / LENGTH, 0, 1), cam = s.x - HERO_SX, fireX = s.x - s.gap;
    const [ox, oy] = shakeOffset(t, s.shake * 8, rm);
    ctx.save(); ctx.translate(ox, oy);
    sky(ctx, PAL.night.sky, null);
    const g = ctx.createLinearGradient(0, 0, 0, H); g.addColorStop(0, `rgba(60,8,10,${0.3 + prog * 0.6})`); g.addColorStop(0.6, `rgba(190,50,20,${0.35 + prog * 0.55})`); g.addColorStop(1, `rgba(255,150,60,${0.4 + prog * 0.5})`);
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
    stars(ctx, 0.6 * (1 - prog), t, 0, 500);
    light(ctx, -60, 900, 900, '255,120,40', 0.55);
    // smoke
    for (let i = 0; i < 7; i++) { const sx = ((i * 260 - cam * 0.1 - t * 20) % 1500 + 1500) % 1500 - 300; ctx.fillStyle = 'rgba(20,6,10,0.35)'; ctx.beginPath(); ctx.ellipse(sx, 260 + hash(i) * 330, 240, 60 + hash(i + 3) * 40, -0.2, 0, TAU); ctx.fill(); }
    skyline(ctx, { base: 900, scroll: cam * 0.15, color: '#3a0c0e', seed: 4, h: 360, gap: 160, kind: 'lanka', lit: '255,170,80', t });
    skyline(ctx, { base: 1000, scroll: cam * 0.35 + 70, color: '#26080a', seed: 9, h: 300, gap: 210, kind: 'lanka', lit: '255,190,90', t });
    // burning far city behind the fire line
    for (let i = 0; i < 6; i++) { const fx = fireX - cam - 40 - i * 130; if (fx > -100) flame(ctx, fx * 0.6, 900 - hash(i) * 120, 120, t, i); }

    const drawPlat = (q) => {
      const x = q.x - cam; if (x > W + 50 || x + q.w < -50) return;
      const upper = q.y === UP, burning = q.x < fireX + 250;
      ctx.fillStyle = upper ? '#1d0708' : '#0f0304';
      ctx.fillRect(x, q.y, q.w, H - q.y);
      ctx.fillStyle = upper ? '#2a0a0b' : '#190506'; ctx.fillRect(x - 10, q.y - 4, q.w + 20, 18);
      for (let i = 0; i < q.w / 60 - 1; i++) if (hash(q.k * 7 + i) > 0.4) ctx.fillRect(x + 12 + i * 60, q.y - 18, 30, 14);
      ctx.strokeStyle = 'rgba(255,200,120,0.5)'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(x - 10, q.y - 4); ctx.lineTo(x + q.w + 10, q.y - 4); ctx.stroke();
      const rows = upper ? 4 : 3;
      for (let c = 0; c < q.w / 90 - 0.5; c++) for (let r = 0; r < rows; r++) {
        if (hash(q.k * 13 + c * 5 + r) < 0.4) continue;
        const wx = x + 50 + c * 90, wy = q.y + 70 + r * 100;
        ctx.fillStyle = burning ? `rgba(255,${130 + 60 * Math.sin(t * 8 + c + r)},50,0.95)` : 'rgba(255,200,120,0.55)';
        ctx.beginPath(); ctx.moveTo(wx - 11, wy + 22); ctx.lineTo(wx - 11, wy); ctx.arc(wx, wy, 11, Math.PI, 0); ctx.lineTo(wx + 11, wy + 22); ctx.fill();
      }
      if (burning) for (let i = 0; i < q.w / 170; i++) { const fx = x + 60 + i * 170; if (fx + cam < fireX + 200) flame(ctx, fx, q.y - 2, 70 + hash(q.k + i) * 60, t, q.k + i); }
    };
    for (const q of s.plats) if (q.y === UP) drawPlat(q);
    for (const tw of s.towers) if (tw.y === UP) { const x = tw.x - cam; if (x > -200 && x < W + 200) tower(ctx, tw, x, t); }
    for (const q of s.plats) if (q.y === LOW) drawPlat(q);
    for (const tw of s.towers) if (tw.y === LOW) { const x = tw.x - cam; if (x > -200 && x < W + 200) tower(ctx, tw, x, t); }
    // the sea beyond the last roof
    const ex = s.END + 80 - cam; if (ex < W + 50) { ctx.save(); ctx.beginPath(); ctx.rect(Math.max(0, ex), 0, W, H); ctx.clip(); sea(ctx, { y: 1260, t, scroll: cam, colors: ['#3a1420', '#2a0e1c', '#1c0a18', '#120612', '#0a040c'], crest: '255,170,100' }); ctx.restore(); }

    // the leaper with the burning tail
    const hx = s.x - cam;
    if (s.slip <= 0) {
      light(ctx, hx - 40, s.y - 90, 230, '255,160,70', 0.5);
      const pose = s.ground ? poses.run(t, 13) : poses.leap(t, s.vy < 0 ? 1 : 0.4);
      figure(ctx, { x: hx, y: s.y, s: 1.4, kind: 'leaper', pose: { ...pose, fire: true } });
      if (!rm) for (let i = 0; i < 8; i++) { const u = i / 8; ctx.fillStyle = `rgba(255,${190 - i * 12},80,${0.7 * (1 - u)})`; ctx.beginPath(); ctx.arc(hx - 90 - u * 220, s.y - 110 - Math.sin(t * 9 + i) * 14 - u * 50, 6 * (1 - u) + 2, 0, TAU); ctx.fill(); }
    }
    // the fire wall
    const fw = fireX - cam;
    if (fw > -400) {
      const fg = ctx.createLinearGradient(fw - 300, 0, fw + 160, 0); fg.addColorStop(0, 'rgba(255,190,80,0.95)'); fg.addColorStop(0.6, 'rgba(255,90,30,0.75)'); fg.addColorStop(1, 'rgba(255,90,30,0)');
      ctx.fillStyle = fg; ctx.fillRect(-20, 0, fw + 180, H);
      for (let i = 0; i < 9; i++) flame(ctx, fw - 30 + Math.sin(i * 2.1) * 40, 300 + i * 150, 210, t, i * 5);
    }
    motes(ctx, { n: 46, t, rgb: '255,180,90', kind: 'ember', rm, scroll: cam * 0.6 });
    ctx.restore();
    finish(ctx, 0.74);
    meter(ctx, 130, 150, 300, 20, prog, '255,160,80', L.towers, `${s.lit} / ${s.total}`);
    if (s.msg > 0) caption(ctx, L.slip, 1380, Math.min(1, s.msg * 2), 30);
    if (s.slip > 0) { ctx.fillStyle = `rgba(6,2,8,${Math.sin((s.slip / 0.7) * Math.PI) * 0.9})`; ctx.fillRect(0, 0, W, H); }
  }

  return { state: s, update, render, result: () => (s.lost ? { lost: true } : s.done ? { stars: s.lit >= s.total * 0.7 ? 3 : s.lit >= s.total * 0.4 ? 2 : 1 } : null) };
}
