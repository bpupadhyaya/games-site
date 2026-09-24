// Chapter 11: the war before the gate. Three lanes run up the screen to the gate. Choose a unit,
// tap a lane. Every enemy wears the colour of the unit that beats it. The leaper hero can be
// called once to sweep a lane. Midway: the night flight for the healing herb.
import { W, H, TAU, PAL, INK, GOLD, clamp, lerp, smooth, hash, sky, stars, skyline, ridge, light, motes, finish, shakeOffset, rr, clouds, sun, rays, banner } from '../stage.js';
import { figure, lodFigure, poses, boulder } from '../puppets.js';
import { meter, pips, label, caption, panel, hit, font, wrap, SANS } from '../ui.js';

const Y0 = 1225, Y1 = 500, GATE0 = 72;
const VAN = {
  leaper:  { hp: 30, dmg: 10, spd: 0.12, range: 0.05, cost: 2, beats: 'archer', rgb: '110,225,200', kind: 'vanara', prop: null },
  thrower: { hp: 42, dmg: 14, spd: 0.05, range: 0.24, cost: 4, beats: 'brute', rgb: '255,184,84', kind: 'vanara', prop: 'stone' },
  rallyer: { hp: 52, dmg: 7, spd: 0.07, range: 0.06, cost: 3, beats: 'spear', rgb: '255,140,175', kind: 'vanara', prop: 'staff' },
};
const RAI = {
  archer: { hp: 22, dmg: 8, spd: 0.05, range: 0.26, preys: 'rallyer', prop: 'bow' },
  brute:  { hp: 80, dmg: 16, spd: 0.04, range: 0.05, preys: 'leaper', prop: 'mace' },
  spear:  { hp: 45, dmg: 11, spd: 0.07, range: 0.07, preys: 'thrower', prop: 'spear' },
  giant:  { hp: 320, dmg: 26, spd: 0.022, range: 0.07, preys: 'leaper', prop: 'mace' },
};
const COUNTER_RGB = { archer: VAN.leaper.rgb, brute: VAN.thrower.rgb, giant: VAN.thrower.rgb, spear: VAN.rallyer.rgb };
// PERF: the unit-buy buttons (drawn every frame, even under the story card) tint 'vanara' with each
// unit's own colour (see `gold:` below) - a distinct sprite cache entry per colour, not covered by
// game.js's plain-kind WARM list. Exported so game.js can warm these too, one relief-part at a time,
// instead of the buttons paying to build them the first time the chapter is actually drawn.
export const WARM_LOOKS = [...Object.values(VAN).map((u) => [u.kind, `rgb(${u.rgb})`]), ['raider', '#e0633a']];
const ORDER = ['leaper', 'thrower', 'rallyer'];
const BTN = ORDER.map((id, i) => ({ id, x: 24 + i * 170, y: 1318, w: 160, h: 150 }));
const CALL = { x: 24 + 3 * 170, y: 1318, w: 162, h: 150 };

const laneX = (lane, p) => W / 2 + (lane - 1) * lerp(218, 112, p);
const laneY = (p) => lerp(Y0, Y1, p);
const depth = (p) => lerp(1, 0.56, p);

export function create(env, shared) {
  const { rng } = env;
  const L = shared.text.lines, ally = shared.ally();
  const herbClouds = [];
  for (let i = 0; i < 12; i++) herbClouds.push({ x: 900 + i * 520 + rng.range(-120, 120), y: rng.range(330, 1180), r: rng.range(90, 140) });
  const s = {
    t: 0, noHint: true, phase: 'battle', phaseT: 0, time: 0,
    gate: GATE0, line: 8, energy: 6, pick: 'leaper', calling: false, called: false, sweep: null,
    units: [], shots: [], puffs: [], nextId: 1, spawnIn: 2.5, giantDone: false, herbDone: false,
    shake: 0, gateHit: 0, msg: '', msgT: 0,
    herb: { y: 760, vy: 0, x: 0, hits: 0, safe: 0 }, herbClouds,
  };
  const say = (m, d = 2.4) => { s.msg = m; s.msgT = d; };

  function addUnit(side, type, lane, p) {
    const d = side === 'v' ? VAN[type] : RAI[type];
    s.units.push({ id: s.nextId++, side, type, lane, p, hp: d.hp, max: d.hp, cd: 0.4, act: 0, flash: 0 });
  }
  if (shared.showcase) {
    s.time = 40; s.gate = 46; s.energy = 7;
    [['leaper', 0, 0.55], ['thrower', 0, 0.3], ['rallyer', 1, 0.42], ['leaper', 1, 0.5], ['thrower', 2, 0.35], ['leaper', 2, 0.62], ['rallyer', 2, 0.2]].forEach(([type, lane, p]) => addUnit('v', type, lane, p));
    [['brute', 0, 0.63], ['archer', 0, 0.85], ['spear', 1, 0.58], ['archer', 1, 0.8], ['brute', 2, 0.72], ['spear', 2, 0.9]].forEach(([type, lane, p]) => addUnit('r', type, lane, p));
  }

  function hurt(u, dmg) {
    u.hp -= dmg; u.flash = 0.18;
    if (u.hp <= 0) {
      s.puffs.push({ x: laneX(u.lane, u.p), y: laneY(u.p), t: 0, big: u.type === 'giant' });
      if (u.type === 'giant') { s.giantDone = true; s.shake = 0.6; shared.sfx('thud'); }
    }
  }

  function updateBattle(dt, input) {
    const p = input.pointer;
    s.time += dt;
    s.energy = Math.min(10, s.energy + dt * (ally === 'scouts' ? 1.3 : 1.0));
    if (p.pressed) {
      const b = BTN.find((k) => hit(k, p));
      if (b) { s.pick = b.id; s.calling = false; shared.sfx('tap'); }
      else if (hit(CALL, p)) { if (!s.called) { s.calling = !s.calling; shared.sfx('tap'); } }
      else if (p.y > Y1 - 60 && p.y < Y0 + 60) {
        const lane = p.x < W / 3 ? 0 : p.x < (2 * W) / 3 ? 1 : 2;
        if (s.calling && !s.called) { s.called = true; s.calling = false; s.sweep = { lane, p: 0 }; shared.sfx('horn'); }
        else {
          const cost = s.pick === 'leaper' && ally === 'leapers' ? 1 : VAN[s.pick].cost;
          if (s.energy >= cost) { s.energy -= cost; addUnit('v', s.pick, lane, 0.02); shared.sfx('good'); } else shared.sfx('bad');
        }
      }
    }
    ['Digit1', 'Digit2', 'Digit3'].forEach((code, i) => { if (input.keys.pressed.has(code)) s.pick = ORDER[i]; });
    // enemy waves
    s.spawnIn -= dt;
    if (s.spawnIn <= 0) {
      const pace = lerp(3.3, 1.7, clamp(s.time / 90, 0, 1));
      s.spawnIn = pace * rng.range(0.75, 1.25);
      addUnit('r', rng.pick(['archer', 'brute', 'spear', 'spear', 'archer']), rng.int(3), 0.97);
    }
    if (!s.giantDone && !s.units.some((u) => u.type === 'giant') && s.gate <= GATE0 * 0.55) { addUnit('r', 'giant', 1, 0.95); say(L.giant, 3); shared.sfx('horn'); }

    if (s.sweep) {
      s.sweep.p += dt * 0.95;
      for (const u of s.units) if (u.side === 'r' && u.hp > 0 && u.lane === s.sweep.lane && Math.abs(u.p - s.sweep.p) < 0.07) hurt(u, u.type === 'giant' ? 120 : 999);
      if (s.sweep.p >= 0.96) { s.gate -= 8; s.gateHit = 0.5; s.shake = 0.5; shared.sfx('thud'); s.sweep = null; }
    }

    for (const u of s.units) {
      if (u.hp <= 0) continue;
      const d = u.side === 'v' ? VAN[u.type] : RAI[u.type];
      u.cd -= dt; u.flash = Math.max(0, u.flash - dt); u.act = Math.max(0, u.act - dt * 2.5);
      let target = null, best = 9;
      for (const o of s.units) {
        if (o.side === u.side || o.lane !== u.lane || o.hp <= 0) continue;
        const gap = u.side === 'v' ? o.p - u.p : u.p - o.p;
        if (gap > -0.03 && gap < best) { best = gap; target = o; }
      }
      if (target && best <= d.range) {
        if (u.cd <= 0) {
          u.cd = 0.85; u.act = 1;
          let dmg = d.dmg;
          if (u.side === 'v') { if (d.beats === target.type || (d.beats === 'brute' && target.type === 'giant')) dmg *= 2.3; if (u.type === 'thrower' && ally === 'strong') dmg *= 1.3; }
          else if (d.preys === target.type) dmg *= 1.6;
          if (d.range > 0.2) s.shots.push({ x0: laneX(u.lane, u.p), y0: laneY(u.p) - 70 * depth(u.p), x1: laneX(target.lane, target.p), y1: laneY(target.p) - 50 * depth(target.p), t: 0, kind: u.side === 'v' ? 'stone' : 'arrow', to: target.id, dmg });
          else hurt(target, dmg);
        }
      } else if (u.side === 'v') {
        if (u.p >= 0.93) { if (u.cd <= 0) { u.cd = 0.9; u.act = 1; s.gate -= d.dmg * 0.22; s.gateHit = 0.3; } }
        else u.p += d.spd * dt;
      } else {
        u.p -= d.spd * dt;
        if (u.p <= 0.03) { u.hp = 0; s.line -= u.type === 'giant' ? 3 : 1; s.shake = 0.4; shared.sfx('bad'); }
      }
      if (u.side === 'v' && u.type === 'rallyer') for (const o of s.units) if (o.side === 'v' && o.lane === u.lane && o.hp > 0 && Math.abs(o.p - u.p) < 0.2) o.hp = Math.min(o.max, o.hp + 4 * dt);
    }
    for (const sh of s.shots) {
      sh.t += dt / 0.4;
      if (sh.t >= 1) { const o = s.units.find((k) => k.id === sh.to); if (o && o.hp > 0) hurt(o, sh.dmg); if (sh.kind === 'stone') shared.sfx('thud'); }
    }
    s.shots = s.shots.filter((sh) => sh.t < 1);
    s.units = s.units.filter((u) => u.hp > 0);

    if (s.giantDone && !s.herbDone) { s.phase = 'herbCard'; s.phaseT = 0; }
    if (!s.herbDone && s.gate < 1) s.gate = 1;
    if (s.gate <= 0) { s.gate = 0; s.phase = 'won'; s.phaseT = 0; s.shake = 1; shared.sfx('thud'); }
    else if (s.line <= 0) { s.line = 0; s.phase = 'lost'; }
  }

  function updateHerb(dt, input) {
    const h = s.herb, p = input.pointer;
    h.x += 430 * dt; h.safe = Math.max(0, h.safe - dt);
    let target = null;
    if (p.down) target = p.y - 90;
    if (input.keys.down.has('ArrowUp')) target = h.y - 300;
    if (input.keys.down.has('ArrowDown')) target = h.y + 300;
    h.vy = lerp(h.vy, target === null ? 0 : clamp((target - h.y) * 4, -900, 900), 1 - Math.pow(0.001, dt));
    h.y = clamp(h.y + h.vy * dt, 330, 1250);
    for (const c of s.herbClouds) if (h.safe <= 0 && Math.hypot(c.x - h.x - 230, c.y - h.y) < c.r + 40) { h.hits += 1; h.safe = 1.2; s.shake = 0.3; shared.sfx('bad'); }
    if (s.phaseT > 14) { s.phase = 'herbEnd'; s.phaseT = 0; s.herbDone = true; s.line = Math.min(8, s.line + Math.max(1, 4 - h.hits)); s.energy = 10; shared.sfx('chime'); }
  }

  function update(dt, input) {
    s.t += dt; s.phaseT += dt;
    s.shake = Math.max(0, s.shake - dt); s.gateHit = Math.max(0, s.gateHit - dt); s.msgT = Math.max(0, s.msgT - dt);
    for (const f of s.puffs) f.t += dt;
    s.puffs = s.puffs.filter((f) => f.t < 0.8);
    if (s.phase === 'battle') updateBattle(dt, input);
    else if (s.phase === 'herbCard') { if (s.phaseT > 1 && input.pointer.pressed) { s.phase = 'herb'; s.phaseT = 0; shared.sfx('whoosh'); } }
    else if (s.phase === 'herb') updateHerb(dt, input);
    else if (s.phase === 'herbEnd') { if (s.phaseT > 3) { s.phase = 'battle'; s.phaseT = 0; } }
  }

  // ---- drawing ----
  function backdrop(ctx, t, rm) {
    sky(ctx, PAL.ember.sky, null);
    stars(ctx, 0.5, t, 0, 300);
    light(ctx, W / 2, 470, 620, '255,120,50', 0.55);
    rays(ctx, { x: W / 2, y: 400, dir: Math.PI / 2, n: 8, len: 1200, spread: 1.4, rgb: '255,130,60', alpha: 0.16, t, rm });
    clouds(ctx, { y: 130, h: 200, scroll: t * 10, color: 'rgba(30,8,10,0.6)', n: 5, seed: 4, scale: 1.3 });
    skyline(ctx, { base: 420, scroll: 30, color: '#3a0e10', seed: 8, h: 210, gap: 120, kind: 'lanka', lit: '255,170,80', t });
    const gx = Math.sin(t * 50) * s.gateHit * (rm ? 0 : 10);
    const broken = 1 - s.gate / GATE0;
    ctx.fillStyle = '#1a0608';
    ctx.fillRect(0, 380, W, 150);
    for (let i = 0; i < 15; i++) ctx.fillRect(i * 50 + 6, 356, 30, 28);
    for (const tx of [150, 570]) { ctx.fillStyle = '#1a0608'; ctx.fillRect(tx - 50, 270, 100, 260); for (let i = 0; i < 3; i++) ctx.fillRect(tx - 50 + i * 38, 246, 24, 26); light(ctx, tx, 300, 120, '255,150,60', 0.5); }
    ctx.save(); ctx.translate(W / 2 + gx, 0);
    ctx.fillStyle = '#0e0305'; ctx.fillRect(-120, 300, 240, 232);
    ctx.beginPath(); ctx.moveTo(-140, 304); ctx.lineTo(0, 236); ctx.lineTo(140, 304); ctx.fill();
    const won = s.phase === 'won' ? smooth(s.phaseT / 1.6) : 0;
    if (won > 0) light(ctx, 0, 440, 300 * won, '255,220,150', 0.9);
    ctx.fillStyle = '#4a1a10';
    for (const d of [-1, 1]) {
      ctx.save(); ctx.translate(d * 92, 0); ctx.scale(d * (1 - won * 0.8), 1);
      ctx.beginPath(); ctx.moveTo(0, 530); ctx.lineTo(0, 400); ctx.quadraticCurveTo(0, 330, -92, 322); ctx.lineTo(-92, 530); ctx.fill(); ctx.restore();
    }
    ctx.strokeStyle = GOLD; ctx.lineWidth = 2.5; ctx.beginPath(); ctx.moveTo(-92, 530); ctx.lineTo(-92, 400); ctx.quadraticCurveTo(-92, 330, 0, 322); ctx.quadraticCurveTo(92, 330, 92, 400); ctx.lineTo(92, 530); ctx.stroke();
    ctx.strokeStyle = 'rgba(255,170,70,0.9)'; ctx.lineWidth = 3;
    for (let i = 0; i < Math.floor(broken * 9); i++) { let cx = (hash(i * 3) - 0.5) * 150, cy = 340 + hash(i * 3 + 1) * 60; ctx.beginPath(); ctx.moveTo(cx, cy); for (let k = 0; k < 4; k++) { cx += (hash(i * 7 + k) - 0.5) * 40; cy += 34; ctx.lineTo(cx, cy); } ctx.stroke(); }
    ctx.restore();
    const g = ctx.createLinearGradient(0, 520, 0, H);
    g.addColorStop(0, '#4a1812'); g.addColorStop(0.5, '#260c0e'); g.addColorStop(1, '#0c0406');
    ctx.fillStyle = g; ctx.fillRect(0, 528, W, H - 528);
    for (let lane = 0; lane < 3; lane++) {
      const w0 = 96, w1 = 50;
      const lg = ctx.createLinearGradient(0, Y1, 0, Y0);
      lg.addColorStop(0, 'rgba(255,150,80,0.22)'); lg.addColorStop(1, 'rgba(255,200,120,0.08)');
      ctx.fillStyle = lg;
      ctx.beginPath(); ctx.moveTo(laneX(lane, 0) - w0, Y0 + 40); ctx.lineTo(laneX(lane, 1) - w1, Y1 - 10); ctx.lineTo(laneX(lane, 1) + w1, Y1 - 10); ctx.lineTo(laneX(lane, 0) + w0, Y0 + 40); ctx.fill();
      ctx.strokeStyle = 'rgba(242,196,106,0.35)'; ctx.lineWidth = 2; ctx.setLineDash([14, 16]);
      for (const d of [-1, 1]) { ctx.beginPath(); ctx.moveTo(laneX(lane, 0) + d * w0, Y0 + 40); ctx.lineTo(laneX(lane, 1) + d * w1, Y1 - 10); ctx.stroke(); }
      ctx.setLineDash([]);
    }
    for (let i = 0; i < 4; i++) for (const d of [-1, 1]) { const p = i / 3.4, x = W / 2 + d * lerp(345, 190, p), y = laneY(p); light(ctx, x, y - 50 * depth(p), 90 * depth(p), '255,160,70', 0.55 + 0.1 * Math.sin(t * 9 + i)); banner(ctx, x, y + 6 * depth(p), 190 * depth(p), t + i, i % 2 ? '#b8321c' : '#a8781c', rm); }
  }

  function drawUnit(ctx, u, t) {
    const x = laneX(u.lane, u.p) + (u.side === 'v' ? -24 : 24) * depth(u.p), y = laneY(u.p), giant = u.type === 'giant';
    const sc = 0.98 * depth(u.p) * (giant ? 2.0 : u.type === 'brute' ? 1.2 : 1);
    const d = u.side === 'v' ? VAN[u.type] : RAI[u.type];
    const rgb = u.side === 'v' ? d.rgb : COUNTER_RGB[u.type];
    ctx.fillStyle = 'rgba(0,0,0,0.35)'; ctx.beginPath(); ctx.ellipse(x, y, 40 * sc, 9 * sc, 0, 0, TAU); ctx.fill();
    if (u.side === 'v') light(ctx, x, y - 70 * sc, 80 * sc, rgb, 0.35);
    const pose = u.act > 0 ? poses.strike(t, 1 - u.act) : poses.walk(t + u.id, u.side === 'v' ? 7 : 5);
    if (u.side === 'v' && u.type === 'thrower' && u.act <= 0) Object.assign(pose, { shF: 2.7, elF: 0.3, shB: -2.7, elB: -0.3 });
    const fo = { x, y, s: sc, dir: u.side === 'v' ? 1 : -1, kind: u.side === 'v' ? d.kind : 'raider', prop: d.prop, pose, ink: u.flash > 0 ? '#5a2a20' : INK, gold: u.side === 'v' ? `rgb(${rgb})` : '#e0633a' };
    if (u.p > 0.5 && u.act <= 0 && u.flash <= 0 && u.type !== 'thrower') {   // rear ranks: one baked sprite per walk frame
      const rate = u.side === 'v' ? 7 : 5, frames = 8, f = Math.floor((((t + u.id) * rate) / (2 * Math.PI) % 1) * frames);
      lodFigure(ctx, fo, ((f % frames) + frames) % frames, (k) => poses.walk((k / frames) * 2 * Math.PI / rate, rate));
    } else figure(ctx, fo);
    const py = y - (giant ? 250 : 215) * sc;
    ctx.fillStyle = `rgb(${rgb})`; ctx.strokeStyle = 'rgba(10,4,8,0.8)'; ctx.lineWidth = 2;
    ctx.beginPath();
    if (u.side === 'v') ctx.arc(x, py, 7, 0, TAU); else { ctx.moveTo(x, py + 10); ctx.lineTo(x - 10, py - 7); ctx.lineTo(x + 10, py - 7); ctx.closePath(); }
    ctx.fill(); ctx.stroke();
    if (u.hp < u.max) { ctx.fillStyle = 'rgba(10,4,8,0.7)'; ctx.fillRect(x - 22, py - 20, 44, 6); ctx.fillStyle = u.side === 'v' ? '#9fe0a0' : '#ff8a5a'; ctx.fillRect(x - 22, py - 20, 44 * clamp(u.hp / u.max, 0, 1), 6); }
  }

  function unitButton(ctx, b, t) {
    const d = VAN[b.id], on = s.pick === b.id && !s.calling;
    const cost = b.id === 'leaper' && ally === 'leapers' ? 1 : d.cost, can = s.energy >= cost;
    ctx.globalAlpha = can ? 1 : 0.55;
    ctx.fillStyle = on ? 'rgba(60,30,30,0.95)' : 'rgba(16,6,12,0.85)'; rr(ctx, b.x, b.y, b.w, b.h, 18); ctx.fill();
    ctx.strokeStyle = on ? `rgb(${d.rgb})` : 'rgba(242,196,106,0.6)'; ctx.lineWidth = on ? 5 : 2; rr(ctx, b.x, b.y, b.w, b.h, 18); ctx.stroke();
    if (on) light(ctx, b.x + b.w / 2, b.y + 60, 110, d.rgb, 0.35);
    figure(ctx, { x: b.x + b.w / 2 - 6, y: b.y + 104, s: 0.44, kind: 'vanara', prop: d.prop, pose: b.id === 'thrower' ? { ...poses.stand(t), shF: 2.7, elF: 0.3, shB: -2.7, elB: -0.3 } : b.id === 'leaper' ? { ...poses.leap(t), air: false } : poses.stand(t), gold: `rgb(${d.rgb})` });
    label(ctx, L[b.id], b.x + b.w / 2, b.y + 134, 22, 'center', '#fff1cf');
    ctx.fillStyle = `rgb(${d.rgb})`; ctx.beginPath(); ctx.arc(b.x + 24, b.y + 24, 15, 0, TAU); ctx.fill();
    ctx.fillStyle = '#1a0a10'; ctx.font = font(22, SANS, 800); ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(String(cost), b.x + 24, b.y + 25);
    ctx.globalAlpha = 1;
  }

  function renderHerb(ctx, t, rm) {
    const h = s.herb, dawn = clamp(s.phaseT / 14, 0, 1);
    sky(ctx, PAL.night.sky, null);
    stars(ctx, 1 - dawn * 0.6, t, 0, H);
    light(ctx, W + 100, 1300, 900, '255,170,110', 0.15 + dawn * 0.5);
    sun(ctx, 120, 300, 46, '220,228,255');
    ridge(ctx, { base: 1330, amp: 150, wl: 300, scroll: h.x * 0.15, color: '#141c44', seed: 2 });
    ridge(ctx, { base: 1450, amp: 110, wl: 220, scroll: h.x * 0.35, color: '#0a1030', seed: 6 });
    for (const c of s.herbClouds) {
      const x = c.x - h.x; if (x < -300 || x > W + 300) continue;
      ctx.fillStyle = 'rgba(16,18,50,0.95)';
      for (let i = 0; i < 5; i++) { ctx.beginPath(); ctx.ellipse(x + (hash(i + c.r) - 0.5) * c.r * 1.4, c.y + (hash(i * 3 + c.r) - 0.5) * c.r * 0.6, c.r * 0.7, c.r * 0.45, 0, 0, TAU); ctx.fill(); }
      ctx.strokeStyle = 'rgba(190,200,255,0.3)'; ctx.lineWidth = 2; ctx.setLineDash([8, 12]); ctx.beginPath(); ctx.arc(x, c.y, c.r, 0, TAU); ctx.stroke(); ctx.setLineDash([]);
    }
    const hx = 230, hy = h.y;
    light(ctx, hx + 20, hy - 120, 260, '170,255,180', 0.4);
    ctx.fillStyle = INK;
    ctx.beginPath(); ctx.moveTo(hx - 130, hy - 96); ctx.lineTo(hx - 80, hy - 170); ctx.lineTo(hx - 46, hy - 150); ctx.lineTo(hx + 4, hy - 250); ctx.lineTo(hx + 56, hy - 160); ctx.lineTo(hx + 86, hy - 186); ctx.lineTo(hx + 140, hy - 96); ctx.quadraticCurveTo(hx, hy - 60, hx - 130, hy - 96); ctx.fill();
    for (let i = 0; i < 8; i++) { const px = hx - 96 + i * 28, py = hy - 120 - hash(i) * 70; light(ctx, px, py, 26, '170,255,170', 0.8); ctx.fillStyle = 'rgba(210,255,200,0.95)'; ctx.beginPath(); ctx.arc(px, py, 2.6, 0, TAU); ctx.fill(); }
    ctx.globalAlpha = h.safe > 0 && Math.floor(t * 12) % 2 === 0 ? 0.55 : 1;
    figure(ctx, { x: hx - 70, y: hy + 96, s: 1.1, kind: 'leaper', pose: { ...poses.fly(t, clamp(h.vy / 2000, -0.3, 0.3)), shF: -Math.PI / 2 - 0.35, elF: -0.25, shB: Math.PI - 0.3, elB: 0.1 } });
    ctx.globalAlpha = 1;
    motes(ctx, { n: 20, t, rgb: '190,255,200', kind: 'dust', scroll: h.x, rm });
  }

  function render(ctx) {
    const t = s.t, rm = shared.rm();
    const [ox, oy] = shakeOffset(t, s.shake * 12, rm);
    ctx.save(); ctx.translate(ox, oy);
    if (s.phase === 'herb' || s.phase === 'herbEnd') {
      renderHerb(ctx, t, rm);
      ctx.restore(); finish(ctx, 0.75);
      meter(ctx, 130, 150, 460, 20, s.phase === 'herb' ? clamp(s.phaseT / 14, 0, 1) : 1, '255,190,130', L.dawn);
      if (s.phase === 'herb') caption(ctx, L.herbHint, 236, clamp(3.5 - s.phaseT, 0, 1), 28); else caption(ctx, L.herbDone, 700, 1, 32);
      return;
    }
    backdrop(ctx, t, rm);
    for (const u of [...s.units].sort((a, b) => b.p - a.p)) drawUnit(ctx, u, t);
    if (s.sweep) { const x = laneX(s.sweep.lane, s.sweep.p), y = laneY(s.sweep.p), sc = depth(s.sweep.p); light(ctx, x, y - 80 * sc, 220 * sc, '255,220,140', 0.8); figure(ctx, { x, y, s: 1.1 * sc, kind: 'leaper', prop: 'mace', pose: { ...poses.run(t, 16), propA: 2.4 } }); }
    for (const sh of s.shots) {
      const x = lerp(sh.x0, sh.x1, sh.t), y = lerp(sh.y0, sh.y1, sh.t) - Math.sin(sh.t * Math.PI) * (sh.kind === 'stone' ? 90 : 40);
      if (sh.kind === 'stone') boulder(ctx, x, y, 12); else { ctx.strokeStyle = '#ffb070'; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + (sh.x0 - sh.x1) * 0.08, y + (sh.y0 - sh.y1) * 0.08 - 6); ctx.stroke(); }
    }
    for (const f of s.puffs) { const a = 1 - f.t / 0.8; for (let i = 0; i < (f.big ? 16 : 7); i++) { ctx.fillStyle = `rgba(255,${150 + i * 6},90,${a * 0.7})`; ctx.beginPath(); ctx.arc(f.x + Math.cos(i * 2.4) * f.t * (f.big ? 200 : 90), f.y - 50 + Math.sin(i * 2.4) * f.t * (f.big ? 200 : 90) - f.t * 60, (f.big ? 16 : 8) * a + 2, 0, TAU); ctx.fill(); } }
    ctx.fillStyle = '#0a0306'; ctx.beginPath(); ctx.moveTo(0, 1296); ctx.quadraticCurveTo(W / 2, 1262, W, 1296); ctx.lineTo(W, H); ctx.lineTo(0, H); ctx.fill();
    motes(ctx, { n: 34, t, rgb: '255,160,80', kind: 'ember', top: 300, bottom: 1300, rm });
    ctx.restore();
    finish(ctx, 0.72);

    meter(ctx, 130, 150, 300, 20, s.gate / GATE0, '255,120,70', L.gate);
    label(ctx, L.line, 470, 142, 22); pips(ctx, 478, 161, s.line, 8, '160,230,170', 8, 17);
    meter(ctx, 24, 1284, W - 48, 18, s.energy / 10, '255,214,120', L.energy, `${Math.floor(s.energy)}`);
    for (const b of BTN) unitButton(ctx, b, t);
    ctx.globalAlpha = s.called ? 0.35 : 1;
    ctx.fillStyle = s.calling ? 'rgba(90,60,20,0.95)' : 'rgba(16,6,12,0.85)'; rr(ctx, CALL.x, CALL.y, CALL.w, CALL.h, 18); ctx.fill();
    ctx.strokeStyle = s.calling ? '#fff2c0' : GOLD; ctx.lineWidth = s.calling ? 5 : 2.5; rr(ctx, CALL.x, CALL.y, CALL.w, CALL.h, 18); ctx.stroke();
    if (!s.called) light(ctx, CALL.x + CALL.w / 2, CALL.y + 60, 100, '255,210,120', 0.3 + 0.15 * Math.sin(t * 3));
    figure(ctx, { x: CALL.x + CALL.w / 2 - 8, y: CALL.y + 100, s: 0.44, kind: 'leaper', prop: 'mace', pose: poses.stand(t) });
    label(ctx, L.call, CALL.x + CALL.w / 2, CALL.y + 134, 20, 'center', '#fff1cf');
    ctx.globalAlpha = 1;
    if (s.phase === 'battle' && s.time < 7 && !shared.showcase) caption(ctx, shared.text.hint, 236, clamp(Math.min(s.time * 2, 7 - s.time), 0, 1), 28);
    caption(ctx, s.msg, 640, Math.min(1, s.msgT * 2), 32);
    if (s.phase === 'herbCard') {
      ctx.fillStyle = 'rgba(6,2,8,0.7)'; ctx.fillRect(0, 0, W, H);
      ctx.font = font(34); const lines = wrap(ctx, L.herbCard, W - 190);
      panel(ctx, 50, 420, W - 100, 150 + lines.length * 44);
      ctx.fillStyle = '#f3dfc0'; ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic'; ctx.font = font(34);
      lines.forEach((ln, i) => ctx.fillText(ln, W / 2, 500 + i * 44));
      if (s.phaseT > 1) label(ctx, shared.T.ui.tapToContinue, W / 2, 530 + lines.length * 44, 24, 'center', GOLD);
    }
  }

  return {
    state: s, update, render,
    result: () => (s.phase === 'lost' ? { lost: true } : s.phase === 'won' && s.phaseT > 2.6 ? { stars: s.line >= 6 ? 3 : s.line >= 3 ? 2 : 1 } : null),
  };
}
