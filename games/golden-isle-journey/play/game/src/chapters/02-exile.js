// Chapter 2: the exile. Hold to walk from the palace gate, through the city, over the river and
// into the forest. Pausing beside the people who wait with lamps receives their farewell.
import { W, H, TAU, PAL, INK, clamp, lerp, smooth, hash, sky, sun, light, ridge, strip, treeline, skyline, sea, motes, finish, shadow, dome } from '../stage.js';
import { figure, poses, stridePose } from '../puppets.js';
import { label, caption, pips } from '../ui.js';

const GROUND = 1190, END = 5000, SPEED = 125, BANK0 = 3080, BANK1 = 3840;
const GROUPS = [650, 1350, 1950, 2500, 2940];
const ZONES = [['gate', 120, 950], ['city', 1250, 2350], ['river', 3000, 3780], ['forest', 4050, 4900]];

export function create(env, shared) {
  const L = shared.text.lines;
  const s = { t: 0, x: shared.showcase ? 1820 : 120, walking: false, walkT: 0, got: GROUPS.map(() => 0), wait: 0, count: 0, done: false, doneT: 0 };
  if (shared.showcase) { s.got[0] = 1; s.got[1] = 1; s.count = 2; }

  function update(dt, input) {
    s.t += dt;
    if (s.done) { s.doneT += dt; return; }
    const p = input.pointer, keys = input.keys;
    if ((p.pressed && p.y > 120) || keys.pressed.has('Space') || keys.pressed.has('ArrowRight')) s.walking = true;
    if (!(p.down || keys.down.has('Space') || keys.down.has('ArrowRight'))) s.walking = false;
    if (s.walking) { s.x += SPEED * dt; s.walkT += dt; s.wait = 0; }
    else {
      const i = GROUPS.findIndex((gx, k) => !s.got[k] && Math.abs(s.x - 60 - gx) < 190);
      if (i >= 0) { s.wait += dt; if (s.wait > 0.8) { s.got[i] = 1; s.count += 1; s.wait = 0; shared.sfx('chime'); } } else s.wait = 0;
    }
    for (let k = 0; k < GROUPS.length; k++) if (s.got[k]) s.got[k] = Math.min(3, s.got[k] + dt);
    if (s.x >= END) { s.done = true; shared.sfx('good'); }
  }

  function gate(ctx, x) {
    ctx.fillStyle = PAL.palace.near;
    ctx.fillRect(x - 210, GROUND - 640, 120, 650); ctx.fillRect(x + 90, GROUND - 640, 120, 650);
    dome(ctx, x - 150, GROUND - 640, 66); dome(ctx, x + 150, GROUND - 640, 66);
    ctx.beginPath(); ctx.moveTo(x - 100, GROUND - 420); ctx.lineTo(x - 100, GROUND - 560); ctx.lineTo(x + 100, GROUND - 560); ctx.lineTo(x + 100, GROUND - 420); ctx.arc(x, GROUND - 420, 100, 0, Math.PI, true); ctx.fill();
    ctx.strokeStyle = 'rgba(242,196,106,0.7)'; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(x, GROUND - 420, 100, Math.PI, 0); ctx.stroke();
    for (const d of [-150, 150]) { ctx.fillStyle = 'rgba(255,205,130,0.85)'; for (let k = 0; k < 4; k++) { ctx.beginPath(); ctx.arc(x + d, GROUND - 520 + k * 120, 9, 0, TAU); ctx.fill(); } }
  }

  function boat(ctx, x, t, withPole) {
    const y = GROUND + 14 + Math.sin(t * 1.6) * 4;
    ctx.fillStyle = INK; ctx.beginPath(); ctx.moveTo(x - 230, y - 26); ctx.quadraticCurveTo(x - 190, y + 40, x - 60, y + 40); ctx.lineTo(x + 90, y + 40); ctx.quadraticCurveTo(x + 170, y + 34, x + 200, y - 40); ctx.quadraticCurveTo(x + 150, y, x + 60, y - 4); ctx.lineTo(x - 230, y - 26); ctx.fill();
    ctx.strokeStyle = 'rgba(242,196,106,0.7)'; ctx.lineWidth = 2.5; ctx.beginPath(); ctx.moveTo(x - 215, y - 10); ctx.quadraticCurveTo(x, y + 18, x + 180, y - 14); ctx.stroke();
    figure(ctx, { x: x + 150, y: y - 4, s: 1.05, dir: 1, kind: 'citizen', prop: 'staff', pose: { ...poses.stand(t), shF: 0.9 + Math.sin(t * 1.6) * (withPole ? 0.35 : 0.05), elF: 0.6, propA: 2.9 + Math.sin(t * 1.6) * 0.12 } });
    return y;
  }

  function render(ctx) {
    const t = s.t, rm = shared.rm(), cam = clamp(s.x - 300, 0, END - 420), prog = clamp(s.x / END, 0, 1);
    sky(ctx, PAL.palace.sky, null);
    const F = PAL.forest.sky, g = ctx.createLinearGradient(0, 0, 0, H); F.forEach((c, i) => g.addColorStop(i / 3, c));
    ctx.globalAlpha = smooth((prog - 0.45) / 0.45) * 0.9; ctx.fillStyle = g; ctx.fillRect(0, 0, W, H); ctx.globalAlpha = 1;
    sun(ctx, 520 - prog * 200, 640 + prog * 120, 70, '255,222,160');
    ridge(ctx, { base: 900, amp: 90, wl: 380, scroll: cam * 0.08, color: 'rgba(70,30,50,0.55)', seed: 2 });
    const aPal = 1 - smooth((cam - 1500) / 1000), aCity = smooth((cam - 500) / 600) * (1 - smooth((cam - 2300) / 500)), aWood = smooth((cam - 2500) / 900);
    if (aPal > 0.01) { ctx.globalAlpha = aPal; skyline(ctx, { base: 1040, scroll: cam * 0.22, color: PAL.palace.far, seed: 3, h: 560, gap: 230, kind: 'palace', lit: '255,210,140', t }); }
    if (aCity > 0.01) { ctx.globalAlpha = aCity; skyline(ctx, { base: 1130, scroll: cam * 0.5, color: PAL.palace.mid, seed: 8, h: 400, gap: 200, kind: 'city', lit: '255,200,120', t }); }
    if (aWood > 0.01) {
      ctx.globalAlpha = aWood;
      treeline(ctx, { base: 1090, scroll: cam * 0.3, color: PAL.forest.far, seed: 4, h: 520, gap: 170 });
      treeline(ctx, { base: 1160, scroll: cam * 0.6, color: PAL.forest.mid, seed: 9, h: 640, gap: 210, cut: 'rgba(238,230,150,0.35)' });
    }
    ctx.globalAlpha = 1;
    // ground
    const gg = ctx.createLinearGradient(0, GROUND - 30, 0, H); gg.addColorStop(0, prog > 0.7 ? '#23402c' : '#5a2a26'); gg.addColorStop(0.3, '#23121a'); gg.addColorStop(1, '#0c050a');
    ctx.fillStyle = gg; ctx.fillRect(0, GROUND - 30, W, H);
    light(ctx, W / 2, GROUND + 30, 520, '255,190,110', 0.22);
    // the river, cut into the ground
    const r0 = BANK0 + 60 - cam, r1 = BANK1 - 60 - cam;
    if (r1 > 0 && r0 < W) {
      ctx.save(); ctx.beginPath(); ctx.rect(Math.max(0, r0), GROUND - 60, Math.min(W, r1) - Math.max(0, r0), H); ctx.clip();
      sea(ctx, { y: GROUND - 34, t, scroll: cam, colors: ['#6a5a8a', '#4a4478', '#2e2c5c', '#1c1a40', '#100e28'], crest: '255,220,170' });
      light(ctx, (r0 + r1) / 2, GROUND + 60, 400, '255,210,150', 0.3);
      ctx.restore();
    }
    ctx.save(); ctx.translate(-cam, 0);
    gate(ctx, 330);
    // street lamps through the city
    for (let lx = 1100; lx < 2950; lx += 310) { ctx.fillStyle = INK; ctx.fillRect(lx - 5, GROUND - 330, 10, 330); ctx.fillRect(lx - 30, GROUND - 336, 60, 8); light(ctx, lx, GROUND - 350, 170, '255,200,120', 0.55); ctx.fillStyle = 'rgba(255,230,160,0.95)'; ctx.beginPath(); ctx.ellipse(lx, GROUND - 352, 8, 13, 0, 0, TAU); ctx.fill(); }
    // those who wait
    GROUPS.forEach((gx, k) => {
      const got = s.got[k], near = Math.abs(s.x - 60 - gx) < 190 && !got;
      light(ctx, gx, GROUND - 120, 260, '255,206,130', got ? 0.55 : 0.28 + 0.12 * Math.sin(t * 3 + k));
      if (!got) { ctx.strokeStyle = `rgba(255,224,150,${near ? 0.9 : 0.4})`; ctx.lineWidth = 3; ctx.setLineDash([10, 12]); ctx.beginPath(); ctx.ellipse(gx, GROUND + 6, 190, 30, 0, 0, TAU); ctx.stroke(); ctx.setLineDash([]);
        if (near && s.wait > 0) { ctx.strokeStyle = '#fff2c6'; ctx.lineWidth = 6; ctx.beginPath(); ctx.ellipse(gx, GROUND + 6, 190, 30, 0, -Math.PI / 2, -Math.PI / 2 + TAU * clamp(s.wait / 0.8, 0, 1)); ctx.stroke(); } }
      for (let i = 0; i < 4; i++) {
        const fx = gx - 110 + i * 74, fy = GROUND - 46 + (i % 2) * 22, raise = got ? smooth(got) : 0;
        shadow(ctx, fx, fy, 34, 0.3);
        figure(ctx, { x: fx, y: fy, s: 0.98, dir: fx > s.x - 60 ? -1 : 1, kind: hash(k * 7 + i) > 0.5 ? 'woman' : 'citizen', prop: 'lamp', pose: { ...poses.stand(t + i + k), shF: 1.0 + raise * 1.5, elF: 0.7 - raise * 0.5, head: got ? 0.15 : 0 } });
      }
    });
    // the boat and the three travellers
    const onBoat = s.x > BANK0 && s.x < BANK1, bx = onBoat ? s.x - 60 : s.x <= BANK0 ? BANK0 + 120 : BANK1 - 140;
    const by = boat(ctx, bx, t, onBoat && s.walking);
    const walk = s.walking && !onBoat && !s.done;
    [['brother', -170, 'bow'], ['princess', -85, null], ['prince', 0, 'bow']].forEach(([kind, dx, prop], i) => {
      const fx = s.x + dx + (onBoat ? 40 : 0), fy = onBoat ? by - 2 : GROUND;
      if (!onBoat) shadow(ctx, fx, fy, 46, 0.35);
      // phase from the distance walked (not the clock): the planted foot stays put on the road at any speed
      const pose = walk ? stridePose(kind, s.x, 1.6, { t, offset: i * 0.37 }) : poses.stand(t + i);
      figure(ctx, { x: fx, y: fy, s: 1.6, kind, prop, pose: prop ? { ...pose, shF: (pose.shF ?? 0) * 0.4 + 0.5, elF: 0.9, aim: -0.1 } : pose });
    });
    ctx.restore();
    // foreground: the city watches from the near side; trunks close in at the forest
    strip(cam * 1.5, 260, (i, x) => {
      const wx = i * 260 / 1.5;
      if (wx > 700 && wx < 2050) figure(ctx, { x: x + hash(i) * 80, y: H + 40, s: 2.1, dir: 1, kind: hash(i * 3) > 0.5 ? 'woman' : 'citizen', ink: '#0a0408', gold: 'rgba(242,196,106,0.35)', pose: poses.stand(t * 0.6 + i) });
      else if (wx > 2600 && i % 2 === 0) { ctx.fillStyle = '#060c0a'; ctx.beginPath(); ctx.moveTo(x - 50, H); ctx.quadraticCurveTo(x - 20, 700, x - 40, -20); ctx.lineTo(x + 40, -20); ctx.quadraticCurveTo(x + 24, 700, x + 60, H); ctx.fill(); }
    });
    motes(ctx, { n: 26, t, rgb: prog > 0.75 ? '220,240,150' : '255,206,130', kind: prog > 0.75 ? 'firefly' : 'dust', top: 400, bottom: 1300, scroll: cam, rm });
    finish(ctx, 0.75);

    label(ctx, L.farewell, 40, 158, 24);
    pips(ctx, 52, 184, s.count, GROUPS.length, '255,214,130', 10, 30);
    for (const [key, a, b] of ZONES) { const al = Math.min(smooth((s.x - a) / 120), smooth((b - s.x) / 120)); if (al > 0.01) caption(ctx, L[key], 392, al, 30); }
  }

  return { state: s, update, render, result: () => (s.done && s.doneT > 1.6 ? { stars: s.count >= 4 ? 3 : s.count >= 2 ? 2 : 1 } : null) };
}
