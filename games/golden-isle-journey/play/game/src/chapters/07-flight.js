// Chapter 7: the leap across the sea. A long flight with altitude choices: wind streams in the
// middle air build speed, the sea below hides jaws and the shadow-catcher, storms sit up high,
// and a golden mountain rises to offer rest. The camera pulls back as speed grows.
import { W, H, TAU, PAL, INK, clamp, lerp, smooth, hash, sky, sun, stars, clouds, sea, skyline, light, motes, finish, shakeOffset, rays } from '../stage.js';
import { figure, poses } from '../puppets.js';
import { meter, label, caption } from '../ui.js';

const DIST = 34000, BASE = 300, TOP = 700, SEA_Y = H - 190;

export function create(env, shared) {
  const { rng } = env;
  const L = shared.text.lines;
  const objs = [];
  for (let x = 1800; x < DIST - 1500; x += rng.range(900, 1500)) {
    const roll = rng.next();
    if (roll < 0.34) objs.push({ k: 'wind', x, alt: rng.range(520, 1500), len: rng.range(1500, 2400) });
    else if (roll < 0.54) objs.push({ k: 'jaws', x, h: rng.range(420, 720), rise: 0 });
    else if (roll < 0.68) objs.push({ k: 'shadow', x, len: rng.range(600, 900) });
    else if (roll < 0.88) objs.push({ k: 'storm', x, alt: rng.range(1350, 1800), r: rng.range(190, 250), ph: rng.range(0, 3) });
    else objs.push({ k: 'mount', x, h: rng.range(480, 660), rested: false });
    if (roll >= 0.34 && rng.chance(0.6)) objs.push({ k: 'wind', x: x + rng.range(-300, 300), alt: rng.range(600, 1400), len: rng.range(1300, 2000) });
  }
  const s = {
    t: 0, x: shared.showcase ? DIST * 0.62 : 0, alt: 900, vy: 0, speed: shared.showcase ? 600 : BASE, hx: 200,
    hits: 0, safe: 0, shake: 0, inWind: 0, zoom: 0.8, cam: 0, objs, msg: '', msgT: 0, done: false, doneT: 0, time: 0,
  };
  const say = (m) => { s.msg = m; s.msgT = 2.2; };

  function bump(m) {
    if (s.safe > 0) return;
    s.hits += 1; s.safe = 1.6; s.shake = 0.5; s.speed = Math.max(BASE * 0.7, s.speed * 0.55);
    say(m); shared.sfx('bad');
  }

  function update(dt, input) {
    s.t += dt;
    if (s.done) { s.doneT += dt; s.x += s.speed * dt * 0.5; return; }
    s.time += dt;
    const p = input.pointer, keys = input.keys;
    // steer
    let target = null;
    if (p.down) { target = (SEA_Y + s.cam - (p.y - 90)) / s.zoom; s.hx = lerp(s.hx, clamp(p.x, 110, 430), 1 - Math.pow(0.02, dt)); }
    if (keys.down.has('ArrowUp')) target = s.alt + 400;
    if (keys.down.has('ArrowDown')) target = s.alt - 400;
    const want = target === null ? 0 : clamp((target - s.alt) * 4, -1000, 1000);
    s.vy = lerp(s.vy, want, 1 - Math.pow(0.001, dt));
    s.alt = clamp(s.alt + s.vy * dt, 110, 1900);
    // speed
    s.inWind = Math.max(0, s.inWind - dt * 3);
    s.speed = Math.max(BASE, s.speed - 14 * dt);
    s.safe = Math.max(0, s.safe - dt); s.shake = Math.max(0, s.shake - dt); s.msgT = Math.max(0, s.msgT - dt);
    for (const o of s.objs) {
      const dx = o.x - s.x;
      if (dx > 2600 || dx < -2800) continue;
      if (o.k === 'wind') {
        if (s.x > o.x && s.x < o.x + o.len && Math.abs(s.alt - o.alt) < 120) {
          if (s.inWind <= 0) shared.sfx('whoosh');
          s.inWind = 1; s.speed = Math.min(TOP, s.speed + 150 * dt);
        }
      } else if (o.k === 'jaws') {
        o.rise = clamp(o.rise + (dx < 1000 && dx > -300 ? dt * 1.1 : -dt * 0.8), 0, 1);
        if (Math.abs(dx) < 100 && s.alt < o.h * smooth(o.rise) + 40) bump(L.jaws);
      } else if (o.k === 'shadow') {
        if (dx < 0 && dx > -o.len && s.alt < 340) bump(L.shadow);
      } else if (o.k === 'storm') {
        if (Math.hypot(dx, (o.alt - s.alt)) < o.r * 0.85) bump(L.storm);
        const cyc = (s.t + o.ph) % 3.2;
        if (cyc > 2.6 && Math.abs(dx) < 46 && s.alt < o.alt && s.alt > o.alt - 900) bump(L.storm);
      } else if (o.k === 'mount') {
        const half = o.h * 0.55, inside = Math.abs(dx) < half * (1 - s.alt / o.h);
        if (inside && s.alt < o.h - 30) bump(L.rest);
        else if (!o.rested && Math.abs(dx) < 160 && s.alt < o.h + 230) { o.rested = true; s.speed = Math.min(TOP, s.speed + 140); if (s.hits > 0) s.hits -= 1; say(L.rest); shared.sfx('chime'); }
      }
    }
    s.x += s.speed * dt;
    s.zoom = lerp(s.zoom, lerp(0.8, 0.56, (s.speed - BASE) / (TOP - BASE)), 1 - Math.pow(0.2, dt));
    s.cam = lerp(s.cam, Math.max(0, s.alt * s.zoom - 930), 1 - Math.pow(0.03, dt));
    if (s.x > DIST * 0.62 && s.x - s.speed * dt <= DIST * 0.62) { say(L.sighted); shared.sfx('chime'); }
    if (s.x >= DIST) { s.done = true; shared.sfx('good'); }
  }

  const sx = (wx) => s.hx + (wx - s.x) * s.zoom;
  const sy = (alt) => SEA_Y + s.cam - alt * s.zoom;

  function render(ctx) {
    const t = s.t, z = s.zoom, rm = shared.rm(), prog = clamp(s.x / DIST, 0, 1);
    const [ox, oy] = shakeOffset(t, s.shake * 14, rm);
    ctx.save(); ctx.translate(ox, oy);
    sky(ctx, PAL.dusk.sky, null);
    ctx.fillStyle = `rgba(8,10,40,${prog * 0.62})`; ctx.fillRect(0, 0, W, H);
    stars(ctx, 0.25 + prog * 0.75, t, 0, H * 0.7);
    const seaY = sy(0), horizon = seaY - 150 * z;
    sun(ctx, 520 - prog * 120, horizon - 190 + prog * 260, 66, '255,196,120');
    rays(ctx, { x: 520 - prog * 120, y: horizon - 190 + prog * 260, dir: -Math.PI / 2 - 0.1, n: 8, len: 1400, spread: 2.2, rgb: '255,196,120', alpha: 0.12, t, rm });
    clouds(ctx, { y: horizon - 900 + s.cam * 0.05, h: 600, scroll: s.x * 0.06, color: 'rgba(120,60,110,0.45)', n: 7, seed: 2, scale: 1.2 });
    clouds(ctx, { y: horizon - 520, h: 420, scroll: s.x * 0.14, color: 'rgba(60,30,90,0.5)', n: 6, seed: 9 });
    // the far shore: golden towers grow on the horizon
    if (prog > 0.5) {
      const u = smooth((prog - 0.5) / 0.5), sc = 0.3 + u * 0.95;
      ctx.save(); ctx.translate(W + 260 - u * 640, horizon + 14); ctx.scale(sc, sc);
      light(ctx, 200, -120, 520, '255,190,90', 0.35 + u * 0.3);
      ctx.fillStyle = '#1a0e2c'; ctx.beginPath(); ctx.moveTo(-260, 10); ctx.quadraticCurveTo(200, -110, 760, 10); ctx.fill();
      skyline(ctx, { base: -40, scroll: 0, color: '#c8923a', seed: 5, h: 170, gap: 110, kind: 'lanka', lit: '255,240,180', t });
      ctx.restore();
    }
    sea(ctx, { y: horizon, t, scroll: s.x, colors: ['#3b2c66', '#2a2156', '#1d1846', '#130f34', '#0b0a24'], crest: '255,190,140', bands: 5, bottom: Math.max(H, seaY + 400) });

    // world objects
    for (const o of s.objs) {
      const x = sx(o.x);
      if (o.k === 'wind') { if (x < W + 100 && sx(o.x + o.len) > -100) wind(ctx, o, t, z); continue; }
      if (x < -900 * z || x > W + 900 * z) { if (x > W && x < W + 1100 * z && o.k !== 'mount') warn(ctx, o.k === 'storm' ? sy(o.alt) : Math.min(H - 80, seaY - 60), t); continue; }
      if (o.k === 'jaws') jaws(ctx, x, seaY, o.h * smooth(o.rise) * z, z, t, o.rise);
      else if (o.k === 'shadow') shadowCatcher(ctx, x, seaY, o.len * z, z, t);
      else if (o.k === 'storm') storm(ctx, x, sy(o.alt), o.r * z, (t + o.ph) % 3.2, z);
      else if (o.k === 'mount') mount(ctx, x, seaY, o.h * z, o.rested, t);
    }

    // the leaper
    const hy = sy(s.alt), fs = 1.75 * (0.4 + z * 0.6);   // hero scale: about a third of the screen; collisions use the world point (s.x, s.alt), not the sprite
    if (!rm) { ctx.strokeStyle = 'rgba(255,236,190,0.35)'; ctx.lineWidth = 2; ctx.lineCap = 'round'; for (let i = 0; i < 7; i++) { const ly = hy - 70 + i * 24 + Math.sin(i * 2.1) * 8, lx = s.hx - 150 - ((t * (500 + i * 60) + i * 97) % 260); ctx.beginPath(); ctx.moveTo(lx, ly); ctx.lineTo(lx - 60 - s.speed * 0.08, ly); ctx.stroke(); } }
    if (!rm) for (let i = 0; i < 9; i++) { const u = i / 9; ctx.fillStyle = `rgba(255,214,140,${(1 - u) * 0.5 * (s.speed / TOP)})`; ctx.beginPath(); ctx.arc(s.hx - 60 - u * s.speed * 0.45, hy + Math.sin(t * 7 + i) * 8 + 10, 5 * (1 - u) + 1, 0, TAU); ctx.fill(); }
    light(ctx, s.hx + 30, hy, 240, '255,206,130', 0.45 + s.inWind * 0.3);
    const blink = s.safe > 0 && Math.floor(t * 12) % 2 === 0;
    ctx.globalAlpha = blink ? 0.55 : 1;
    figure(ctx, { x: s.hx - 50 * fs, y: hy + 92 * fs, s: fs, kind: 'leaper', prop: 'mace', cape: '#2b8a62', pose: poses.fly(t, clamp(-s.vy / 1800, -0.4, 0.4) + (s.safe > 1 ? Math.sin(t * 20) * 0.12 : 0)) });
    ctx.globalAlpha = 1;
    motes(ctx, { n: 22, t, rgb: '255,220,170', kind: 'dust', scroll: s.x, rm });
    ctx.restore();
    finish(ctx, 0.7);

    {
      meter(ctx, 130, 150, 300, 20, prog, '255,206,120', L.toLanka);
      meter(ctx, 470, 150, 130, 20, (s.speed - BASE * 0.7) / (TOP - BASE * 0.7), s.inWind > 0 ? '160,230,255' : '242,196,106', L.speed);
    }
    caption(ctx, s.msg, 1380, Math.min(1, s.msgT * 2), 30);
  }

  function wind(ctx, o, t, z) {
    const x0 = Math.max(-40, sx(o.x)), x1 = Math.min(W + 40, sx(o.x + o.len)), y = sy(o.alt);
    const inside = s.x > o.x && s.x < o.x + o.len && Math.abs(s.alt - o.alt) < 120;
    const g = ctx.createLinearGradient(0, y - 120 * z, 0, y + 120 * z);
    g.addColorStop(0, 'rgba(190,230,255,0)'); g.addColorStop(0.5, `rgba(190,230,255,${inside ? 0.22 : 0.12})`); g.addColorStop(1, 'rgba(190,230,255,0)');
    ctx.fillStyle = g; ctx.fillRect(x0, y - 120 * z, x1 - x0, 240 * z);
    ctx.lineCap = 'round';
    for (let i = 0; i < 5; i++) {
      ctx.strokeStyle = `rgba(225,245,255,${inside ? 0.75 : 0.45})`; ctx.lineWidth = 3;
      ctx.setLineDash([60 + i * 14, 50]); ctx.lineDashOffset = t * (420 + i * 60) + i * 37 + s.x * 0.4;
      ctx.beginPath();
      for (let x = x0; x <= x1; x += 24) { const yy = y + (i - 2) * 38 * z + Math.sin((x + s.x * z) / 130 + i) * 12 * z; if (x === x0) ctx.moveTo(x, yy); else ctx.lineTo(x, yy); }
      ctx.stroke();
    }
    ctx.setLineDash([]);
  }

  function warn(ctx, y, t) {
    const a = 0.5 + 0.5 * Math.sin(t * 9);
    ctx.fillStyle = `rgba(255,120,80,${0.5 + a * 0.5})`;
    const yy = clamp(y, 220, H - 120);
    ctx.beginPath(); ctx.moveTo(W - 14, yy); ctx.lineTo(W - 44, yy - 20); ctx.lineTo(W - 44, yy + 20); ctx.fill();
  }

  function jaws(ctx, x, seaY, h, z, t, rise) {
    // telegraph: churning light on the water
    light(ctx, x, seaY - 10, 170 * z, '255,120,90', 0.35 + 0.2 * Math.sin(t * 8));
    if (h < 8) return;
    const top = seaY - h, sway = Math.sin(t * 2.2) * 22 * z;
    ctx.strokeStyle = INK; ctx.lineCap = 'round'; ctx.lineWidth = 86 * z;
    ctx.beginPath(); ctx.moveTo(x, seaY + 40); ctx.quadraticCurveTo(x - 50 * z, seaY - h * 0.5, x + sway, top + 60 * z); ctx.stroke();
    ctx.strokeStyle = 'rgba(242,196,106,0.6)'; ctx.lineWidth = 3;
    for (let i = 1; i < 6; i++) { const yy = seaY - (h * i) / 6.5; ctx.beginPath(); ctx.arc(x - 30 * z * Math.sin((i / 6) * Math.PI) + sway * (i / 6), yy, 34 * z, 0.3, Math.PI - 0.3); ctx.stroke(); }
    const open = 0.35 + 0.3 * rise + Math.sin(t * 5) * 0.06;
    ctx.fillStyle = INK;
    for (const d of [-1, 1]) {
      ctx.save(); ctx.translate(x + sway, top + 50 * z); ctx.rotate(-Math.PI / 2 + d * open); ctx.scale(z, z);
      ctx.beginPath(); ctx.moveTo(-10, -d * 8); ctx.quadraticCurveTo(80, -d * 60, 170, -d * 6); ctx.lineTo(0, d * 30); ctx.fill();
      ctx.fillStyle = '#ffe9b8'; for (let k = 0; k < 5; k++) { ctx.beginPath(); ctx.moveTo(40 + k * 26, -d * 2); ctx.lineTo(48 + k * 26, d * 20); ctx.lineTo(58 + k * 26, -d * 2); ctx.fill(); }
      ctx.restore(); ctx.fillStyle = INK;
    }
  }

  function shadowCatcher(ctx, x, seaY, len, z, t) {
    const g = ctx.createRadialGradient(x + len / 2, seaY + 40 * z, 10, x + len / 2, seaY + 40 * z, len * 0.6);
    g.addColorStop(0, 'rgba(0,0,0,0.85)'); g.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = g; ctx.fillRect(x - len * 0.2, seaY - 60 * z, len * 1.4, 300 * z);
    ctx.strokeStyle = 'rgba(190,120,255,0.55)'; ctx.lineWidth = 4; ctx.lineCap = 'round';
    for (let i = 0; i < 6; i++) {
      const bx = x + (len * (i + 0.5)) / 6, reach = (250 + 120 * Math.sin(t * 3 + i * 1.3)) * z;
      ctx.beginPath(); ctx.moveTo(bx, seaY + 10); ctx.quadraticCurveTo(bx + Math.sin(t * 2 + i) * 40 * z, seaY - reach * 0.6, bx + Math.sin(t * 1.7 + i * 2) * 30 * z, seaY - reach); ctx.stroke();
    }
  }

  function storm(ctx, x, y, r, cyc, z) {
    const flash = cyc > 2.6, warnF = cyc > 1.9 && !flash;
    if (flash) light(ctx, x, y, r * 2.4, '220,230,255', 0.8);
    ctx.fillStyle = flash ? '#3a3560' : '#15122c';
    for (let i = 0; i < 7; i++) { ctx.beginPath(); ctx.ellipse(x + (hash(i) - 0.5) * r * 1.5, y + (hash(i + 9) - 0.5) * r * 0.7, r * (0.5 + hash(i + 3) * 0.35), r * (0.34 + hash(i + 5) * 0.2), 0, 0, TAU); ctx.fill(); }
    ctx.strokeStyle = 'rgba(200,190,255,0.35)'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(x, y, r * 0.85, 0, TAU); ctx.setLineDash([8, 14]); ctx.stroke(); ctx.setLineDash([]);
    if (warnF || flash) {
      ctx.strokeStyle = flash ? 'rgba(255,255,255,0.95)' : `rgba(200,200,255,${0.25 + 0.2 * Math.sin(cyc * 40)})`; ctx.lineWidth = flash ? 7 : 3;
      ctx.beginPath(); let lx = x, ly = y + r * 0.4; ctx.moveTo(lx, ly);
      for (let i = 0; i < 9; i++) { lx = x + (hash(i * 7 + Math.floor(y)) - 0.5) * 50 * z; ly += 100 * z; ctx.lineTo(lx, ly); }
      ctx.stroke();
    }
  }

  function mount(ctx, x, seaY, h, rested, t) {
    const half = h * 0.55;
    light(ctx, x, seaY - h, 260, '255,220,130', rested ? 0.3 : 0.6 + 0.15 * Math.sin(t * 3));
    ctx.fillStyle = '#1b1030';
    ctx.beginPath(); ctx.moveTo(x - half, seaY + 30); ctx.lineTo(x - half * 0.45, seaY - h * 0.55); ctx.lineTo(x - half * 0.25, seaY - h * 0.45); ctx.lineTo(x, seaY - h); ctx.lineTo(x + half * 0.3, seaY - h * 0.5); ctx.lineTo(x + half * 0.5, seaY - h * 0.6); ctx.lineTo(x + half, seaY + 30); ctx.fill();
    ctx.fillStyle = '#f2c46a';
    ctx.beginPath(); ctx.moveTo(x, seaY - h); ctx.lineTo(x - half * 0.16, seaY - h * 0.7); ctx.lineTo(x - half * 0.04, seaY - h * 0.76); ctx.lineTo(x + half * 0.06, seaY - h * 0.68); ctx.lineTo(x + half * 0.18, seaY - h * 0.72); ctx.fill();
    if (!rested) { ctx.strokeStyle = `rgba(255,230,160,${0.4 + 0.3 * Math.sin(t * 4)})`; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(x, seaY - h - 110, 90, 0, TAU); ctx.stroke(); }
  }

  return {
    state: s, update, render,
    result: () => (s.done && s.doneT > 1.6 ? { stars: s.hits <= 1 && s.time < 78 ? 3 : s.hits <= 4 ? 2 : 1 } : null),
  };
}
