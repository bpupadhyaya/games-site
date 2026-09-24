// Chapter 10: the bridge of stones. Carriers leap overhead in rhythm; tap one to drop his stone.
// A stone on the next gap extends the bridge, a stone on a built span strengthens it, and the
// big waves break any plain span they reach. Extend, or strengthen first?
import { W, H, PAL, INK, GOLD, clamp, lerp, smooth, hash, sky, sun, clouds, sea, skyline, light, motes, finish, shakeOffset, treeline } from '../stage.js';
import { figure, poses, stridePose, boulder } from '../puppets.js';
import { meter, label, caption } from '../ui.js';

const SPANS = 14, SW = 110, SHORE = 220, DECK = 1090, HORIZON = 900;
const CARRY_SPEED = 200, FALL = 0.5, WAVE_EVERY = 12, WAVE_WARN = 4, GIVE_UP = 130;

export function create(env, shared) {
  const { rng } = env;
  const L = shared.text.lines;
  const s = {
    t: 0, time: 0, spans: new Array(SPANS).fill(0), carriers: [], stones: [], splashes: [],
    spawnIn: 0.4, nextId: 1, cam: 0, waveIn: WAVE_EVERY, wave: null, shake: 0, flash: [],
    msg: '', msgT: 0, done: false, doneT: 0, together: false,
  };
  if (shared.showcase) {
    for (let i = 0; i < 8; i++) s.spans[i] = i === 3 || i === 6 ? 2 : 1;
    s.time = 38; s.waveIn = 0.1; s.cam = SHORE + 8 * SW - 330;
    for (let i = 0; i < 4; i++) s.carriers.push({ id: s.nextId++, x: s.cam + 60 + i * 190, y0: 380 + ((i * 173) % 360), born: s.cam - 80 - i * 40, has: true, ph: i * 1.3 });
  }
  const say = (m) => { s.msg = m; s.msgT = 1.6; };
  const built = () => s.spans.filter((v) => v > 0).length;
  const front = () => { let i = 0; while (i < SPANS && s.spans[i] > 0) i++; return i; };
  const spanAt = (x) => Math.floor((x - SHORE) / SW);
  const fillable = (i) => i >= 0 && i < SPANS && s.spans[i] === 0 && (i === 0 || s.spans[i - 1] > 0);
  const carrierY = (c) => c.y0 - Math.sin(clamp((c.x - c.born) / (W + 200), 0, 1) * Math.PI) * 130 - Math.abs(Math.sin((c.x - c.born) / 95 + c.ph)) * 46;
  const drop = (c) => { c.has = false; const y = carrierY(c) - 120; s.stones.push({ x: c.x, y, y0: y, t: 0 }); shared.sfx('tap'); };

  function land(st) {
    const i = spanAt(st.x);
    if (fillable(i)) { s.spans[i] = 1; s.flash.push({ i, t: 0.5 }); shared.sfx('thud'); s.shake = Math.max(s.shake, 0.15); }
    else if (i >= 0 && i < SPANS && s.spans[i] === 1) { s.spans[i] = 2; s.flash.push({ i, t: 0.5 }); say(L.strong); shared.sfx('chime'); }
    else if (i >= 0 && i < SPANS && s.spans[i] === 2) shared.sfx('tap');
    else { s.splashes.push({ x: st.x, t: 0 }); say(L.splash); shared.sfx('splash'); }
  }

  function update(dt, input) {
    s.t += dt;
    s.msgT = Math.max(0, s.msgT - dt); s.shake = Math.max(0, s.shake - dt);
    for (const f of s.flash) f.t -= dt;
    s.flash = s.flash.filter((f) => f.t > 0);
    for (const sp of s.splashes) sp.t += dt;
    s.splashes = s.splashes.filter((sp) => sp.t < 0.8);
    const fx = SHORE + front() * SW;
    s.cam = lerp(s.cam, clamp(fx - 330, 0, SHORE + SPANS * SW - W + 160), 1 - Math.pow(0.12, dt));
    if (s.done) { s.doneT += dt; return; }
    s.time += dt;

    // carriers in rhythm
    s.spawnIn -= dt;
    if (s.spawnIn <= 0) {
      s.spawnIn = 1.25 + rng.range(0, 0.5);
      s.carriers.push({ id: s.nextId++, x: s.cam - 90, born: s.cam - 90, y0: rng.range(340, 760), has: true, ph: rng.range(0, 6) });
    }
    for (const c of s.carriers) c.x += CARRY_SPEED * dt;
    s.carriers = s.carriers.filter((c) => c.x < s.cam + W + 140);

    // tap a carrier to drop his stone
    const p = input.pointer;
    if (p.pressed && p.y > 120) {
      let best = null, bd = 120;
      for (const c of s.carriers) { if (!c.has) continue; const d = Math.hypot(c.x - s.cam - p.x, carrierY(c) - 70 - p.y); if (d < bd) { bd = d; best = c; } }
      if (best) drop(best);
    }
    if (input.keys.pressed.has('Space')) { // keyboard: the carrier over the next gap
      let best = null, bd = SW / 2; const gx = fx + SW / 2;
      for (const c of s.carriers) { if (!c.has) continue; const d = Math.abs(c.x - gx); if (d < bd) { bd = d; best = c; } }
      if (best) drop(best);
    }
    for (const st of s.stones) { st.t += dt; const u = clamp(st.t / FALL, 0, 1); st.y = lerp(st.y0, DECK - 10, u * u); if (u >= 1) { st.dead = true; land(st); } }
    s.stones = s.stones.filter((st) => !st.dead);

    // the big waves
    if (!s.wave) {
      s.waveIn -= dt;
      if (s.waveIn <= 0) {
        const f = front();
        if (f >= 2) { const len = Math.min(f, 2 + rng.int(2)), a = clamp(f - len - rng.int(3), 0, f - len); s.wave = { a, len, t: 0, hit: false }; shared.sfx('horn'); }
        else s.waveIn = 4;
      }
    } else {
      s.wave.t += dt;
      if (s.wave.t >= WAVE_WARN && !s.wave.hit) {
        s.wave.hit = true; s.shake = 0.6; shared.sfx('splash'); shared.sfx('thud');
        for (let i = s.wave.a; i < s.wave.a + s.wave.len; i++) { if (s.spans[i] > 0) s.spans[i] -= 1; s.splashes.push({ x: SHORE + (i + 0.5) * SW, t: 0 }); }
      }
      if (s.wave.t >= WAVE_WARN + 1.2) { s.wave = null; s.waveIn = WAVE_EVERY - WAVE_WARN; }
    }

    if (s.time >= GIVE_UP && built() < SPANS) { s.spans.fill(1); s.together = true; }
    if (built() === SPANS) { s.done = true; s.wave = null; shared.sfx('good'); shared.sfx('horn'); }
  }

  function span(ctx, i, x, v) {
    const fl = s.flash.find((f) => f.i === i);
    ctx.fillStyle = INK;
    ctx.fillRect(x + 1, DECK, SW - 2, 46);
    ctx.fillRect(x + SW / 2 - 16, DECK + 40, 32, 300);
    for (let k = 0; k < 4; k++) boulder(ctx, x + 14 + k * 27, DECK + 2 + (hash(i * 7 + k) - 0.5) * 8, 17 + hash(i * 3 + k) * 5);
    for (let k = 0; k < 3; k++) boulder(ctx, x + 28 + k * 27, DECK + 28, 15);
    ctx.strokeStyle = 'rgba(242,196,106,0.75)'; ctx.lineWidth = 2.5;
    ctx.beginPath(); ctx.moveTo(x + 2, DECK - 15); ctx.lineTo(x + SW - 2, DECK - 15); ctx.stroke();
    if (v === 2) {
      light(ctx, x + SW / 2, DECK + 10, 90, '255,210,120', 0.5);
      ctx.fillStyle = GOLD; ctx.fillRect(x + 4, DECK + 12, SW - 8, 10);
      ctx.fillStyle = INK; for (let k = 0; k < 5; k++) { const px = x + 15 + k * 20; ctx.beginPath(); ctx.moveTo(px, DECK + 12); ctx.lineTo(px + 5, DECK + 17); ctx.lineTo(px, DECK + 22); ctx.lineTo(px - 5, DECK + 17); ctx.fill(); }
    }
    if (fl) light(ctx, x + SW / 2, DECK, 150, '255,230,160', fl.t * 1.6);
  }

  function render(ctx) {
    const t = s.t, rm = shared.rm(), prog = built() / SPANS;
    const [ox, oy] = shakeOffset(t, s.shake * 12, rm);
    ctx.save(); ctx.translate(ox, oy);
    sky(ctx, PAL.sea.sky, null);
    sun(ctx, 540, HORIZON - 130, 70, '255,214,150');
    clouds(ctx, { y: 240, h: 420, scroll: s.cam * 0.08 + t * 6, color: 'rgba(90,60,130,0.45)', n: 7, seed: 4, scale: 1.2 });
    clouds(ctx, { y: 600, h: 220, scroll: s.cam * 0.16 + t * 10, color: 'rgba(255,190,150,0.22)', n: 5, seed: 11 });
    // the far fortress grows as the bridge does
    const sc = 0.45 + prog * 0.75;
    ctx.save(); ctx.translate(W - 250 - prog * 140 - s.cam * 0.04, HORIZON + 10); ctx.scale(sc, sc);
    light(ctx, 160, -120, 460, '255,190,110', 0.4);
    ctx.fillStyle = '#2a1e50'; ctx.beginPath(); ctx.moveTo(-220, 8); ctx.quadraticCurveTo(170, -90, 620, 8); ctx.fill();
    skyline(ctx, { base: -30, scroll: 0, color: '#3a2860', seed: 5, h: 190, gap: 105, kind: 'lanka', lit: '255,220,150', t });
    ctx.restore();
    sea(ctx, { y: HORIZON, t, scroll: s.cam, colors: ['#4a4a8e', '#38387a', '#2a2a64', '#1c1c4c', '#101034'], crest: '255,220,190' });

    // the incoming swell, behind the bridge
    if (s.wave) {
      const w = s.wave, u = clamp(w.t / WAVE_WARN, 0, 1), cx = SHORE + (w.a + w.len / 2) * SW - s.cam;
      const wx = cx + (1 - smooth(u)) * 520, hgt = 60 + u * 190 - (w.hit ? (w.t - WAVE_WARN) * 220 : 0);
      if (hgt > 0) {
        const half = w.len * SW;
        ctx.fillStyle = 'rgba(30,34,96,0.92)';
        ctx.beginPath(); ctx.moveTo(wx - half * 0.9, DECK + 60);
        ctx.quadraticCurveTo(wx - half * 0.3, DECK - hgt * 0.4, wx - 30, DECK - hgt);
        ctx.quadraticCurveTo(wx - 90, DECK - hgt * 1.12, wx - 120, DECK - hgt * 0.8);
        ctx.quadraticCurveTo(wx - 40, DECK - hgt * 0.7, wx + half * 0.7, DECK + 60); ctx.fill();
        ctx.strokeStyle = 'rgba(255,235,210,0.8)'; ctx.lineWidth = 4; ctx.lineCap = 'round';
        ctx.beginPath(); ctx.moveTo(wx - half * 0.5, DECK - hgt * 0.35); ctx.quadraticCurveTo(wx - 60, DECK - hgt * 1.05, wx - 120, DECK - hgt * 0.8); ctx.stroke();
      }
    }

    // home shore with its trees and the waiting army
    if (s.cam < SHORE + 420) {
      ctx.save(); ctx.beginPath(); ctx.rect(0, 0, Math.max(0, SHORE - 60 - s.cam), H); ctx.clip();
      treeline(ctx, { base: DECK - 50, scroll: s.cam + 600, color: INK, seed: 3, h: 300, gap: 160 });
      ctx.restore();
    }
    ctx.save(); ctx.translate(-s.cam, 0);
    ctx.fillStyle = INK;
    ctx.beginPath(); ctx.moveTo(-400, H); ctx.lineTo(-400, DECK - 70); ctx.quadraticCurveTo(40, DECK - 90, SHORE, DECK - 14); ctx.lineTo(SHORE, H); ctx.fill();
    for (let i = 0; i < 4; i++) figure(ctx, { x: -30 + i * 58, y: DECK - 66 + i * 14, s: 0.9, kind: 'vanara', pose: s.done ? poses.cheer(t, i) : poses.stand(t + i), prop: i % 2 ? 'staff' : null });
    for (let i = 0; i < SPANS; i++) if (s.spans[i] > 0) span(ctx, i, SHORE + i * SW, s.spans[i]);
    // gaps that will take a stone
    const f = front();
    if (!s.done) for (let i = 0; i <= Math.min(f, SPANS - 1); i++) if (s.spans[i] === 0) {
      const gx = SHORE + i * SW, mid = i < f;
      ctx.strokeStyle = mid ? `rgba(255,150,110,${0.55 + 0.3 * Math.sin(t * 6)})` : `rgba(255,220,140,${0.5 + 0.3 * Math.sin(t * 5)})`;
      ctx.lineWidth = 3; ctx.setLineDash([10, 9]); ctx.strokeRect(gx + 5, DECK - 16, SW - 10, 56); ctx.setLineDash([]);
    }
    // the two lead builders at the front
    if (f > 0) {
      const bx = SHORE + f * SW;
      figure(ctx, { x: bx - 40, y: DECK - 14, s: 1.05, kind: 'vanara', prop: 'staff', pose: { ...poses.stand(t), shF: 1.9 + Math.sin(t * 3) * 0.2, elF: 0.2, propA: 2.9 } });
      if (f > 1) figure(ctx, { x: bx - 130, y: DECK - 14, s: 1.0, kind: 'vanara', prop: 'staff', dir: -1, pose: { ...poses.stand(t + 1), shF: 2.2 + Math.sin(t * 2.4) * 0.3, elF: 0.3, propA: 3.0 } });
    }
    // wave warning over the threatened spans
    if (s.wave && !s.wave.hit) {
      const w = s.wave, a = 0.55 + 0.45 * Math.sin(t * 10);
      for (let i = w.a; i < w.a + w.len; i++) {
        const cx = SHORE + (i + 0.5) * SW;
        ctx.fillStyle = `rgba(255,130,90,${a})`;
        ctx.beginPath(); ctx.moveTo(cx, DECK - 40); ctx.lineTo(cx - 20, DECK - 78); ctx.lineTo(cx + 20, DECK - 78); ctx.fill();
        ctx.fillStyle = `rgba(255,130,90,${a * 0.16})`; ctx.fillRect(cx - SW / 2 + 3, DECK - 30, SW - 6, 80);
      }
    }
    // carriers and their aim lines
    for (const c of s.carriers) {
      const y = carrierY(c);
      if (c.has && !s.done) {
        const i = spanAt(c.x), good = fillable(i), strong = i >= 0 && i < SPANS && s.spans[i] === 1;
        if (good || strong) {
          ctx.strokeStyle = good ? 'rgba(255,224,150,0.75)' : 'rgba(170,220,255,0.5)'; ctx.lineWidth = 3; ctx.setLineDash([6, 12]);
          ctx.beginPath(); ctx.moveTo(c.x, y - 60); ctx.lineTo(c.x, DECK - 22); ctx.stroke(); ctx.setLineDash([]);
          light(ctx, c.x, y - 110, 90, good ? '255,220,140' : '170,220,255', 0.5);
        }
      }
      const pose = c.has ? { ...poses.leap(t + c.ph), shF: 2.75, elF: 0.3, shB: -2.75, elB: -0.3 } : poses.leap(t + c.ph);
      figure(ctx, { x: c.x, y, s: 1.0, kind: 'vanara', prop: c.has ? 'stone' : null, pose });
    }
    for (const st of s.stones) boulder(ctx, st.x, st.y, 28);
    for (const sp of s.splashes) {
      const u = sp.t / 0.8;
      ctx.strokeStyle = `rgba(235,240,255,${1 - u})`; ctx.lineWidth = 4; ctx.lineCap = 'round';
      for (let k = -3; k <= 3; k++) { ctx.beginPath(); ctx.moveTo(sp.x + k * 8, DECK + 30); ctx.quadraticCurveTo(sp.x + k * 22 * u, DECK - 300 * Math.sin(u * Math.PI) * (1 - Math.abs(k) / 5), sp.x + k * 34 * u, DECK + 30); ctx.stroke(); }
    }
    // the army crosses
    if (s.done) for (let i = 0; i < 12; i++) {
      const x = s.cam - 80 + s.doneT * 420 - i * 95;
      if (x > s.cam - 100) figure(ctx, { x, y: DECK - 14, s: 0.85, kind: i % 4 === 0 ? 'leaper' : 'vanara', pose: stridePose(i % 4 === 0 ? 'leaper' : 'vanara', x, 0.85, { run: true, t }), prop: i % 3 === 0 ? 'mace' : null });
    }
    ctx.restore();

    // a near wave laps over the bridge foot
    ctx.fillStyle = 'rgba(14,14,50,0.88)';
    ctx.beginPath(); ctx.moveTo(0, H);
    for (let x = 0; x <= W + 20; x += 20) ctx.lineTo(x, DECK + 130 + Math.sin((x + s.cam * 1.2) / 90 + t * 1.6) * 14);
    ctx.lineTo(W + 20, H); ctx.fill();
    motes(ctx, { n: 18, t, rgb: '255,230,190', kind: 'dust', scroll: s.cam, rm, top: 200, bottom: 1000 });
    ctx.restore();
    finish(ctx, 0.7);

    meter(ctx, 130, 150, 300, 20, prog, '255,206,120', L.spans, `${built()} / ${SPANS}`);
    if (s.wave && !s.wave.hit) label(ctx, L.wave, 600, 168, 26, 'right', `rgba(255,150,110,${0.6 + 0.4 * Math.sin(t * 10)})`);
    caption(ctx, s.msg, 1400, Math.min(1, s.msgT * 2.5), 28);
  }

  return {
    state: s, update, render,
    result: () => (s.done && s.doneT > 2.6 ? { stars: s.together ? 1 : s.time < 75 ? 3 : s.time < 100 ? 2 : 1 } : null),
  };
}
