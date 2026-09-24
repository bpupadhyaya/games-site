// Chapter 13: reunion, the flight home over every place visited, the city lighting its lamps,
// and the crowning. Phases: reunion -> flight -> lamps -> crown.
import { W, H, TAU, PAL, INK, GOLD, clamp, lerp, smooth, hash, sky, sun, stars, clouds, sea, ridge, treeline, skyline, hall, lamp, light, motes, finish, shadow, dome, wall, moon } from '../stage.js';
import { figure, poses, stridePose, chariot, boulder, throne } from '../puppets.js';
import { label, caption, meter } from '../ui.js';

const FLIGHT_T = 30, FLY_SPEED = 260, REGION = (FLIGHT_T * FLY_SPEED) / 5;
const CITY_H = 2600, LAMP_T = 35, ROWS = 20, ROW_STEP = 118, REACH = 78;

export function create(env, shared) {
  const { rng } = env;
  const L = shared.text.lines;

  // the home city: terraces of flat roofs climbing to the palace
  const rows = [], lamps = [], folk = [];
  for (let r = 0; r < ROWS; r++) {
    const y = 2480 - r * ROW_STEP, blocks = [];
    let x = -rng.range(10, 90);
    while (x < W) { const w = rng.range(130, 230); blocks.push({ x, w, h: rng.range(26, 96), door: rng.chance(0.7), steps: rng.chance(0.3) }); x += w; }
    rows.push({ y, blocks });
    for (let k = 0; k < 3; k++) {
      const lx = clamp(120 + k * 240 + rng.range(-80, 80), 40, W - 40);
      const b = blocks.find((q) => lx >= q.x && lx < q.x + q.w) ?? blocks[0];
      lamps.push({ x: lx, y: y - b.h, lit: false });
    }
    if (r % 2 === 1) { const b = blocks[1 + rng.int(Math.max(1, blocks.length - 2))]; folk.push({ x: b.x + b.w * 0.5, y: y - b.h, kind: rng.chance(0.5) ? 'woman' : 'citizen', dir: rng.chance(0.5) ? 1 : -1 }); }
  }
  const lights = [];
  for (let i = 0; i < 30; i++) lights.push({ x: 700 + i * 235 + rng.range(-40, 40), y: 640 + Math.sin(i * 0.7) * 250 + rng.range(-60, 60), got: false });

  const s = {
    t: 0, phase: 'reunion', phaseT: 0, carY: 600, vy: 0, gathered: 0, lights, rows, lamps, folk,
    lit: 0, cam: CITY_H - H, glowT: 0, noHint: true, done: false,
  };
  const go = (ph) => { s.phase = ph; s.phaseT = 0; s.noHint = ph !== 'flight'; };
  if (shared.showcase) {
    go('lamps'); s.phaseT = 15;
    for (const q of s.lamps) if (q.y > 1500 && hash(q.x + q.y) > 0.28) { q.lit = true; s.lit += 1; }
  }

  function update(dt, input) {
    s.t += dt; s.phaseT += dt; s.glowT = Math.max(0, s.glowT - dt);
    const p = input.pointer, keys = input.keys, tap = p.pressed && p.y > 120;
    if (s.phase === 'reunion') {
      if ((tap && s.phaseT > 2) || keys.pressed.has('Space') && s.phaseT > 2 || s.phaseT > 8) { go('flight'); shared.sfx('whoosh'); }
    } else if (s.phase === 'flight') {
      let want = 0;
      if (p.down && p.y > 120) want = clamp((p.y - 60 - s.carY) * 5, -700, 700);
      if (keys.down.has('ArrowUp')) want = -500;
      if (keys.down.has('ArrowDown')) want = 500;
      s.vy = lerp(s.vy, want, 1 - Math.pow(0.002, dt));
      s.carY = clamp(s.carY + s.vy * dt, 300, 980);
      const wx = s.phaseT * FLY_SPEED + 260;
      for (const q of s.lights) if (!q.got && Math.abs(q.x - wx) < 110 && Math.abs(q.y - s.carY) < 100) { q.got = true; s.gathered += 1; s.glowT = 0.5; shared.sfx('chime'); }
      if (s.phaseT >= FLIGHT_T) { go('lamps'); shared.sfx('good'); }
    } else if (s.phase === 'lamps') {
      s.cam = lerp(CITY_H - H, 0, smooth(s.phaseT / (LAMP_T - 3)));
      if (p.down && p.y > 120) {
        let rang = false;
        for (const q of s.lamps) if (!q.lit && Math.hypot(q.x - p.x, q.y - s.cam - p.y) < REACH) { q.lit = true; s.lit += 1; rang = true; }
        if (rang) shared.sfx('chime');
      }
      if (s.phaseT >= LAMP_T || (s.lit === s.lamps.length && s.phaseT > 6)) { go('crown'); shared.sfx('horn'); }
    } else if (s.phase === 'crown') {
      if (s.phaseT > 7.5 || (tap && s.phaseT > 2.5)) s.done = true;
    }
  }

  // ---- reunion ----
  function drawReunion(ctx, t) {
    const P = PAL.dawn, u = s.phaseT;
    sky(ctx, P.sky, null);
    sun(ctx, 360, 820, 84, '255,226,160');
    clouds(ctx, { y: 260, h: 380, scroll: t * 8, color: 'rgba(255,200,170,0.28)', n: 6, seed: 2, scale: 1.2 });
    skyline(ctx, { base: 960, scroll: 30, color: P.far, seed: 5, h: 210, gap: 120, kind: 'lanka' });
    sea(ctx, { y: 950, t, scroll: t * 20, colors: ['#a0566a', '#7c405c', '#5a2c4c'], crest: '255,230,190', bands: 3, bottom: 1130 });
    ridge(ctx, { base: 1140, amp: 22, wl: 300, scroll: 0, color: P.near, seed: 2 });
    light(ctx, 400, 1040, 420, '255,220,150', 0.45);
    const gy = 1180;
    const px = lerp(800, 452, smooth(u / 4.5)), walking = u < 4.5;
    for (const [x, w] of [[110, 60], [215, 56], [345, 60], [px, 54], [630, 60]]) shadow(ctx, x, gy + 4, w);
    figure(ctx, { x: 110, y: gy, s: 1.12, kind: 'leaper_c', prop: 'mace', pose: { ...poses.stand(t + 2), propA: 3.0 } });
    figure(ctx, { x: 215, y: gy, s: 1.1, kind: 'brother', prop: 'bow', pose: poses.holdBow(t + 1) });
    figure(ctx, { x: 345, y: gy, s: 1.18, kind: 'prince', pose: walking ? poses.stand(t) : { ...poses.stand(t), shF: 0.9, elF: 0.6 } });
    figure(ctx, { x: px, y: gy, s: 1.1, dir: -1, kind: 'princess', pose: walking ? stridePose('princess', -px, 1.1, { t }) : { ...poses.stand(t), shF: 0.8, elF: 0.6 } });
    figure(ctx, { x: 630, y: gy, s: 1.1, dir: -1, kind: 'king', pose: { ...poses.stand(t + 3), shF: 1.0, elF: 1.2 } });
    motes(ctx, { n: 24, t, rgb: '255,230,180', kind: 'petal', top: 200, bottom: 1200, rm: shared.rm() });
    finish(ctx, 0.7);
    caption(ctx, L.reunion, 1370, Math.min(1, u), 32);
    if (u > 2) label(ctx, shared.T.ui.tapToContinue, W / 2, 1480, 24, 'center', `rgba(246,227,189,${0.5 + 0.4 * Math.sin(t * 3)})`);
  }

  // ---- flight home ----
  function region(ctx, i, x0, x1, scroll, t, night) {
    ctx.save(); ctx.beginPath(); ctx.rect(x0, 0, x1 - x0, H); ctx.clip();
    const G = 1230;
    if (i === 0) { // the sea and the bridge of stones
      sea(ctx, { y: 1080, t, scroll, colors: ['#3a3a7e', '#2a2a66', '#1c1c4e', '#101036'], crest: '255,210,170', bands: 4 });
      ctx.fillStyle = INK; ctx.fillRect(x0, G - 40, x1 - x0, 26);
      for (let k = Math.floor((scroll + x0) / 60) - 1; k * 60 - scroll < x1 + 60; k++) { boulder(ctx, k * 60 - scroll, G - 38, 20); if (k % 2 === 0) ctx.fillRect(k * 60 - scroll - 8, G - 20, 16, 200); }
    } else if (i === 1) { // the hill kingdom
      ridge(ctx, { base: 1060, amp: 170, wl: 260, scroll: scroll * 0.5, color: '#3a2a4a', seed: 3 });
      ridge(ctx, { base: 1200, amp: 120, wl: 200, scroll: scroll * 0.8, color: '#22172e', seed: 8 });
    } else if (i === 2) { // the forest
      ridge(ctx, { base: 1130, amp: 50, wl: 320, scroll: scroll * 0.5, color: '#24402e', seed: 5 });
      treeline(ctx, { base: 1200, scroll: scroll * 0.7, color: '#15281e', seed: 4, h: 260, gap: 120 });
      treeline(ctx, { base: 1290, scroll, color: '#0a1610', seed: 9, h: 330, gap: 150, cut: 'rgba(255,220,140,0.5)' });
    } else if (i === 3) { // the river
      ridge(ctx, { base: 1120, amp: 40, wl: 380, scroll: scroll * 0.5, color: '#2c3550', seed: 6 });
      sea(ctx, { y: 1180, t, scroll, colors: ['#4a5a8a', '#34426e', '#222c50'], crest: '255,225,180', bands: 3, bottom: 1330 });
      const bx = ((REGION * 3.5 - scroll) % 2000);
      ctx.fillStyle = INK; ctx.beginPath(); ctx.moveTo(bx - 70, 1236); ctx.quadraticCurveTo(bx, 1276, bx + 80, 1230); ctx.lineTo(bx + 60, 1252); ctx.lineTo(bx - 56, 1254); ctx.fill();
      ridge(ctx, { base: 1350, amp: 24, wl: 240, scroll, color: '#121828', seed: 12 });
    } else { // the home city
      skyline(ctx, { base: 1150, scroll: scroll * 0.5, color: '#3a2440', seed: 7, h: 260, gap: 150, kind: 'palace', lit: '255,210,130', t });
      skyline(ctx, { base: 1260, scroll: scroll * 0.8, color: '#1e1226', seed: 2, h: 200, gap: 130, kind: 'city', lit: '255,200,120', t });
    }
    ctx.restore();
    // a soft cloud bank hides the seam
    if (i > 0) { ctx.fillStyle = night ? 'rgba(40,30,70,0.92)' : 'rgba(90,60,100,0.9)'; for (let k = 0; k < 9; k++) { ctx.beginPath(); ctx.ellipse(x0 + (hash(i * 9 + k) - 0.5) * 120, 880 + k * 70, 120 + hash(k + i) * 70, 56, 0, 0, TAU); ctx.fill(); } }
  }

  function drawFlight(ctx, t) {
    const u = clamp(s.phaseT / FLIGHT_T, 0, 1), scroll = s.phaseT * FLY_SPEED, rm = shared.rm();
    sky(ctx, PAL.dusk.sky, null);
    ctx.fillStyle = `rgba(6,8,34,${u * 0.7})`; ctx.fillRect(0, 0, W, H);
    stars(ctx, u, t, 0, 900);
    sun(ctx, 520 - u * 100, 900 + u * 320, 70, '255,196,120');
    clouds(ctx, { y: 200, h: 500, scroll: scroll * 0.05, color: 'rgba(120,60,110,0.4)', n: 7, seed: 2, scale: 1.3 });
    clouds(ctx, { y: 640, h: 300, scroll: scroll * 0.12, color: 'rgba(60,30,90,0.5)', n: 6, seed: 9 });
    ridge(ctx, { base: 1090, amp: 60, wl: 520, scroll: scroll * 0.2, color: 'rgba(40,26,70,0.9)', seed: 1 });
    for (let i = 0; i < 6; i++) { const x0 = i * REGION - scroll, x1 = x0 + REGION; if (x1 > -200 && x0 < W + 200) region(ctx, Math.min(i, 4), Math.max(x0, -10), Math.min(x1, W + 10), scroll, t, u > 0.5); }
    ridge(ctx, { base: 1440, amp: 36, wl: 260, scroll: scroll * 1.3, color: '#07040c', seed: 14 });
    // drifting lights
    for (const q of s.lights) {
      if (q.got) continue;
      const x = q.x - scroll - 260 + 260, y = q.y + Math.sin(t * 2 + q.x) * 12;
      if (x < -60 || x > W + 60) continue;
      light(ctx, x, y, 70, '255,220,140', 0.8);
      ctx.fillStyle = '#fff2c4'; ctx.beginPath(); ctx.arc(x, y, 7, 0, TAU); ctx.fill();
    }
    // the great flying car
    light(ctx, 260, s.carY, 300, '255,200,120', 0.4 + s.glowT);
    if (!rm) for (let i = 0; i < 10; i++) { const k = i / 10; ctx.fillStyle = `rgba(255,214,140,${(1 - k) * 0.5})`; ctx.beginPath(); ctx.arc(120 - k * 200, s.carY + 40 + Math.sin(t * 6 + i) * 10, 6 * (1 - k) + 1, 0, TAU); ctx.fill(); }
    ctx.save(); ctx.translate(260, s.carY); ctx.rotate(clamp(s.vy / 2600, -0.2, 0.2)); chariot(ctx, 0, 0, 0.9, t, { palace: true }); ctx.restore();
    motes(ctx, { n: 20, t, rgb: '255,220,170', kind: 'dust', scroll, rm });
    finish(ctx, 0.72);
    const ri = Math.min(4, Math.floor((scroll + 300) / REGION)), into = (scroll + 300) / REGION - ri;
    caption(ctx, L.over[ri], 1390, Math.min(1, into * 6, (0.62 - into) * 6), 34);
    if (s.phaseT < 5) caption(ctx, L.chariot, 250, Math.min(1, s.phaseT * 2, 5 - s.phaseT), 28);
    meter(ctx, 130, 150, 300, 20, u, '255,206,120', shared.T.places.ayodhya);
    label(ctx, `${s.gathered}`, 600, 170, 30, 'right', '#ffe9b8');
    light(ctx, 520, 160, 30, '255,220,140', 0.8);
  }

  // ---- the lamps ----
  function drawLamps(ctx, t) {
    const ratio = s.lit / s.lamps.length, rm = shared.rm();
    sky(ctx, PAL.night.sky, null);
    stars(ctx, 1, t, 0, H);
    ctx.save(); ctx.translate(0, -s.cam * 0.6);
    moon(ctx, 560, 330, 46, '236,240,255', 0.3);
    ctx.restore();
    ctx.save(); ctx.translate(0, -s.cam);
    // the palace on the hilltop
    light(ctx, W / 2, 200, 520, '255,200,120', 0.2 + ratio * 0.5);
    skyline(ctx, { base: 260, scroll: 60, color: '#1c1434', seed: 3, h: 250, gap: 190, kind: 'palace', lit: `255,210,130`, t });
    for (let r = ROWS - 1; r >= 0; r--) {
      const row = s.rows[r];
      if (row.y - s.cam < -160 || row.y - s.cam > H + 420) continue;
      const k = r / ROWS, col = '#' + [16 + k * 22, 9 + k * 14, 22 + k * 36].map((v) => Math.round(v).toString(16).padStart(2, '0')).join('');
      for (const b of row.blocks) {
        const top = row.y - b.h;
        wall(ctx, b.x, top, b.w + 1, b.h + 330, col, { glow: '255,196,110', top: 0.06 });
        ctx.fillStyle = col; ctx.fillRect(b.x - 4, top - 7, b.w + 9, 9);
        for (let c = 0; c < b.w - 20; c += 28) { ctx.fillStyle = col; ctx.fillRect(b.x + 6 + c, top - 15, 14, 9); ctx.fillStyle = `rgba(255,214,150,${0.12 + ratio * 0.3})`; ctx.fillRect(b.x + 6 + c, top - 15, 14, 2); }
        ctx.strokeStyle = `rgba(242,196,106,${0.45 + ratio * 0.5})`; ctx.lineWidth = 2.5; ctx.beginPath(); ctx.moveTo(b.x, top - 3); ctx.lineTo(b.x + b.w, top - 3); ctx.stroke();
        if (b.door) { const dx = b.x + b.w * 0.5, dy = top + 30; ctx.fillStyle = `rgba(255,200,120,${0.12 + ratio * 0.75})`; ctx.beginPath(); ctx.moveTo(dx - 13, dy + 56); ctx.lineTo(dx - 13, dy + 14); ctx.arc(dx, dy + 14, 13, Math.PI, 0); ctx.lineTo(dx + 13, dy + 56); ctx.fill(); }
        if (b.steps) { ctx.fillStyle = col; for (let q = 0; q < 4; q++) ctx.fillRect(b.x + b.w - 20 - q * 16, top + b.h - 8 - (3 - q) * 0 - q * 0 + 0, 0, 0); }
      }
      for (const f of s.folk) if (Math.abs(f.y - (row.y - 0)) < 100 && f.y <= row.y && f.y > row.y - 100 && s.rows[r].blocks.some((b) => row.y - b.h === f.y)) {
        const near = s.lamps.some((q) => q.lit && Math.abs(q.y - f.y) < 8 && Math.abs(q.x - f.x) < 260);
        figure(ctx, { x: f.x, y: f.y - 6, s: 0.5, dir: f.dir, kind: f.kind, prop: 'lamp', pose: near ? { ...poses.cheer(t, f.x), shF: 1.4, elF: 0.4 } : { ...poses.stand(t + f.x), shF: 1.2, elF: 0.6 } });
      }
      for (const q of s.lamps) {
        if (q.y > row.y || q.y <= row.y - 100 || !row.blocks.some((b) => row.y - b.h === q.y)) continue;
        if (q.lit) lamp(ctx, q.x, q.y - 16, 0.9, t, '255,200,110', INK);
        else {
          ctx.fillStyle = '#05030a'; ctx.beginPath(); ctx.moveTo(q.x - 14, q.y - 16); ctx.quadraticCurveTo(q.x, q.y + 2, q.x + 14, q.y - 16); ctx.fill();
          ctx.strokeStyle = `rgba(255,220,150,${0.35 + 0.3 * Math.sin(t * 4 + q.x)})`; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(q.x, q.y - 16, 22, 0, TAU); ctx.stroke();
        }
      }
    }
    ctx.restore();
    ctx.fillStyle = `rgba(255,160,70,${ratio * 0.13})`; ctx.fillRect(0, 0, W, H);
    motes(ctx, { n: Math.round(10 + ratio * 40), t, rgb: '255,210,130', kind: 'ember', rm });
    finish(ctx, 0.78 - ratio * 0.2);
    meter(ctx, 130, 150, 460, 20, ratio, '255,200,110', L.lit, `${s.lit} / ${s.lamps.length}`);
    caption(ctx, L.lamps, 250, Math.min(1, s.phaseT * 2, 6 - s.phaseT), 28);
  }

  // ---- the crowning ----
  function drawCrown(ctx, t) {
    const P = PAL.palace, u = s.phaseT, floor = 1200;
    sky(ctx, P.sky, null);
    light(ctx, W / 2, 760, 700, '255,214,140', 0.65);
    hall(ctx, { scroll: -120, color: P.mid, top: 120, floor, gap: 240, t });
    ctx.fillStyle = P.near; ctx.fillRect(0, floor, W, H - floor);
    ctx.strokeStyle = 'rgba(242,196,106,0.5)'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(0, floor + 3); ctx.lineTo(W, floor + 3); ctx.stroke();
    // the throne: a wide seat for two under a domed back
    const tx = 440, seat = floor - 96;
    throne(ctx, tx, floor + 4, 400, 470, false);
    light(ctx, tx, seat - 130, 300, '255,220,150', 0.5);
    figure(ctx, { x: 640, y: floor, s: 1.1, dir: -1, kind: 'brother', prop: 'bow', pose: poses.holdBow(t + 1) });
    figure(ctx, { x: tx + 40, y: floor - 6, s: 1.08, dir: -1, kind: 'princess', pose: poses.sit(t + 1) });
    figure(ctx, { x: tx - 40, y: floor - 6, s: 1.15, dir: -1, kind: 'prince', pose: poses.sit(t) });
    // the regent gives back the sandals
    const kx = 236;
    shadow(ctx, kx, floor + 4, 60);
    figure(ctx, { x: kx, y: floor, s: 1.08, kind: 'bharat', pose: poses.offer(t) });
    const cx = kx + 74, cy = floor - 112 + Math.sin(t * 1.4) * 1.2;
    light(ctx, cx, cy - 8, 90, '255,226,150', 0.85);
    ctx.fillStyle = '#7a1f2a'; ctx.beginPath(); ctx.ellipse(cx, cy + 6, 34, 10, 0, 0, TAU); ctx.fill();
    ctx.fillStyle = GOLD; for (const d of [-11, 11]) { ctx.beginPath(); ctx.ellipse(cx + d, cy - 3, 9, 4.5, 0, 0, TAU); ctx.fill(); ctx.beginPath(); ctx.arc(cx + d + 5, cy - 9, 2.6, 0, TAU); ctx.fill(); }
    // the leaper kneels at the front
    shadow(ctx, 110, floor + 96, 70);
    figure(ctx, { x: 110, y: floor + 92, s: 1.2, kind: 'leaper_c', pose: poses.kneel(t) });
    for (let i = 0; i < 4; i++) figure(ctx, { x: 560 + i * 50, y: floor + 130 + (i % 2) * 20, s: 0.8, dir: -1, kind: i % 2 ? 'woman' : 'citizen', pose: poses.cheer(t, i) });
    motes(ctx, { n: 46, t, rgb: '255,190,170', kind: 'petal', top: 100, bottom: floor + 100, rm: shared.rm() });
    finish(ctx, 0.7);
    caption(ctx, L.crown, 1400, Math.min(1, u), 32);
  }

  function render(ctx) {
    ctx.save();
    if (s.phase === 'reunion') drawReunion(ctx, s.t);
    else if (s.phase === 'flight') drawFlight(ctx, s.t);
    else if (s.phase === 'lamps') drawLamps(ctx, s.t);
    else drawCrown(ctx, s.t);
    ctx.restore();
    const f = Math.max(0, 1 - s.phaseT * 2);
    if (f > 0 && !(shared.showcase && s.phase === 'lamps')) { ctx.fillStyle = `rgba(6,2,8,${f})`; ctx.fillRect(0, 0, W, H); }
  }

  return {
    state: s, update, render,
    result: () => { if (!s.done) return null; const r = s.lit / s.lamps.length; return { stars: r >= 0.8 ? 3 : r >= 0.5 ? 2 : 1 }; },
  };
}
