// Chapter 6: the alliance in the hills. After the meeting on the hilltop the camera pans across
// a terraced hillside; eight horn calls decide which bands of the vanara people join the search.
import { W, H, TAU, PAL, clamp, smooth, hash, sky, sun, ridge, treeline, clouds, light, motes, finish, shadow } from '../stage.js';
import { figure, poses } from '../puppets.js';
import { label, caption, pips } from '../ui.js';

const TYPES = ['scouts', 'leapers', 'strong'];
const RGB = { scouts: '130,225,255', leapers: '255,218,120', strong: '255,140,96' };
const HEX = { scouts: '#82e1ff', leapers: '#ffda78', strong: '#ff8c60' };
const N_BANDS = 16, GAP = 340, FIRST = 900, SPEED = 150, CALLS = 8;
// PERF: each band tints 'vanara' with its own type colour (see `gold:` below) - a distinct sprite
// cache entry per colour, not covered by game.js's plain-kind WARM list. See 11-war.js's WARM_LOOKS.
export const WARM_LOOKS = Object.values(HEX).map((hex) => ['vanara', hex]);

export function create(env, shared) {
  const { rng } = env;
  const L = shared.text.lines;
  const bands = [];
  let lastY = 0;
  for (let i = 0; i < N_BANDS; i++) {
    let y = rng.range(430, 1330);
    if (Math.abs(y - lastY) < 220) y = y < 880 ? y + 330 : y - 330;
    lastY = y;
    bands.push({ x: FIRST + i * GAP + rng.range(-50, 50), y, type: TYPES[(i + rng.int(2)) % 3], called: false, ct: 0 });
  }
  const END = FIRST + N_BANDS * GAP + 200;
  const s = { t: 0, phase: 'meet', pt: 0, scroll: 0, calls: CALLS, bands, counts: { scouts: 0, leapers: 0, strong: 0 }, pick: null, done: false };
  if (shared.showcase) { s.phase = 'pan'; s.scroll = 1500; for (const i of [0, 2, 3]) { bands[i].called = true; bands[i].ct = 9; s.counts[bands[i].type] += 1; s.calls -= 1; } }

  function update(dt, input) {
    s.t += dt; s.pt += dt;
    const p = input.pointer;
    for (const b of s.bands) if (b.called) b.ct += dt;
    if (s.phase === 'meet') { if (s.pt > 3.2) { s.phase = 'pan'; s.pt = 0; } }
    else if (s.phase === 'pan') {
      s.scroll += SPEED * dt;
      if (p.pressed && p.y > 230) {
        for (const b of s.bands) {
          if (b.called || Math.hypot(p.x - (b.x - s.scroll), p.y - (b.y - 70)) > 125) continue;
          if (s.calls > 0) { b.called = true; s.calls -= 1; s.counts[b.type] += 1; shared.sfx('horn'); } else shared.sfx('bad');
          break;
        }
      }
      if (s.scroll > END - W * 0.4) {
        s.phase = 'bonus'; s.pt = 0;
        s.pick = TYPES.reduce((a, b) => (s.counts[b] > s.counts[a] ? b : a), 'scouts');
        shared.setAlly(s.pick); shared.sfx('good');
      }
    } else if (s.phase === 'bonus') { s.scroll += SPEED * dt * Math.max(0, 1 - s.pt); if (s.pt > 3.4) s.done = true; }
  }

  function band(ctx, b, t) {
    const x = b.x - s.scroll;
    if (x < -260 || x > W + 260) return;
    const rgb = RGB[b.type];
    // the ledge
    ctx.fillStyle = '#10241b';
    ctx.beginPath(); ctx.moveTo(x - 170, b.y + 4); ctx.quadraticCurveTo(x, b.y - 14, x + 170, b.y + 4); ctx.quadraticCurveTo(x + 120, b.y + 60, x + 20, b.y + 74); ctx.quadraticCurveTo(x - 120, b.y + 56, x - 170, b.y + 4); ctx.fill();
    ctx.strokeStyle = 'rgba(255,236,170,0.35)'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(x - 160, b.y + 2); ctx.quadraticCurveTo(x, b.y - 15, x + 160, b.y + 2); ctx.stroke();
    const gone = b.called ? clamp((b.ct - 0.9) / 0.8, 0, 1) : 0;
    if (gone >= 1) return;
    light(ctx, x, b.y - 80, 190, rgb, b.called ? 0.6 : 0.3 + 0.08 * Math.sin(t * 3 + b.x));
    // banner
    ctx.strokeStyle = '#10241b'; ctx.lineWidth = 5; ctx.beginPath(); ctx.moveTo(x - 128, b.y); ctx.lineTo(x - 128, b.y - 230); ctx.stroke();
    ctx.fillStyle = HEX[b.type]; ctx.beginPath(); ctx.moveTo(x - 126, b.y - 228); ctx.lineTo(x - 60 + Math.sin(t * 4 + b.x) * 6, b.y - 210); ctx.lineTo(x - 126, b.y - 186); ctx.fill();
    for (let i = 0; i < 3; i++) {
      const fx = x - 66 + i * 72 + gone * 260, fy = b.y - gone * 520 + (gone > 0 ? Math.sin(gone * Math.PI) * -60 : 0);
      let pose;
      if (gone > 0) pose = poses.leap(t);
      else if (b.called) pose = poses.cheer(t, i * 1.3);
      else if (b.type === 'leapers') pose = { ...poses.sneak(t, false), shF: 0.4, elF: 0.5 };
      else if (b.type === 'strong') pose = { ...poses.stand(t + i), shF: 2.7, elF: 0.3, shB: -2.7, elB: -0.3 };
      else pose = { ...poses.stand(t + i), shF: 2.2, elF: 1.4, head: -0.2 };
      ctx.globalAlpha = 1 - gone * 0.8;
      if (gone === 0) shadow(ctx, fx, b.y + 4, 36, 0.3);
      figure(ctx, { x: fx, y: fy, s: 0.82, kind: 'vanara', dir: i === 2 && !b.called ? -1 : 1, prop: b.type === 'strong' ? (b.called ? 'mace' : 'stone') : null, pose, gold: HEX[b.type] });
      ctx.globalAlpha = 1;
    }
    if (!b.called && s.calls > 0 && s.phase === 'pan') { ctx.strokeStyle = `rgba(${rgb},${0.45 + 0.3 * Math.sin(t * 5)})`; ctx.lineWidth = 3; ctx.setLineDash([10, 12]); ctx.beginPath(); ctx.ellipse(x, b.y - 70, 150, 120, 0, 0, TAU); ctx.stroke(); ctx.setLineDash([]); }
  }

  function render(ctx) {
    const t = s.t, rm = shared.rm(), sc = s.scroll;
    sky(ctx, PAL.day.sky, null);
    sun(ctx, 500 - sc * 0.02, 420, 92, '255,240,180');
    clouds(ctx, { y: 180, h: 380, scroll: sc * 0.05 + t * 6, color: 'rgba(255,246,210,0.35)', n: 6, seed: 6, scale: 1.2 });
    ridge(ctx, { base: 760, amp: 170, wl: 520, scroll: sc * 0.08, color: '#5f8f6c', seed: 1 });
    ridge(ctx, { base: 900, amp: 150, wl: 420, scroll: sc * 0.16 + 200, color: PAL.day.far, seed: 3 });
    treeline(ctx, { base: 960, scroll: sc * 0.22, color: '#3f6a50', seed: 5, h: 170, gap: 120 });
    ridge(ctx, { base: 1080, amp: 130, wl: 380, scroll: sc * 0.4 + 90, color: '#36594a', seed: 6 });
    // waterfall threads on the middle hills
    for (let i = 0; i < 3; i++) { const wx = ((i * 700 + 300 - sc * 0.4) % 2100 + 2100) % 2100 - 300; const g = ctx.createLinearGradient(0, 860, 0, 1300); g.addColorStop(0, 'rgba(235,250,255,0.55)'); g.addColorStop(1, 'rgba(235,250,255,0)'); ctx.fillStyle = g; ctx.fillRect(wx, 880 + hash(i) * 80, 14 + hash(i + 4) * 10, 420); }
    ridge(ctx, { base: 1250, amp: 110, wl: 330, scroll: sc * 0.7 + 400, color: PAL.day.mid, seed: 9 });
    treeline(ctx, { base: 1300, scroll: sc * 0.7, color: '#1f3a2d', seed: 15, h: 260, gap: 260 });
    ridge(ctx, { base: 1440, amp: 70, wl: 300, scroll: sc, color: PAL.day.near, seed: 12 });

    // the meeting on the hilltop (world x ~ 360)
    const mx = 360 - sc;
    if (mx > -500) {
      ctx.fillStyle = PAL.day.near; ctx.beginPath(); ctx.moveTo(mx - 480, H); ctx.quadraticCurveTo(mx - 260, 1150, mx, 1190); ctx.quadraticCurveTo(mx + 300, 1160, mx + 520, H); ctx.fill();
      light(ctx, mx, 1040, 420, '255,236,170', 0.4);
      const fs = 1.2;
      for (const [dx, kind, dir, prop, pose] of [[-210, 'brother', 1, 'bow', poses.holdBow(t + 1)], [-90, 'prince', 1, 'bow', { ...poses.stand(t), shF: 1.3, elF: 0.3 }], [70, 'vking', -1, null, { ...poses.stand(t + 2), shF: 1.3, elF: 0.3 }], [200, 'leaper', -1, 'mace', { ...poses.stand(t + 3), propA: 0.1 }]]) {
        shadow(ctx, mx + dx, 1196, 50, 0.3);
        figure(ctx, { x: mx + dx, y: 1192, s: fs, kind, dir, prop, pose });
      }
    }
    for (const b of s.bands) band(ctx, b, t);
    motes(ctx, { n: 20, t, rgb: '255,250,200', kind: 'dust', rm, scroll: sc * 0.5 });
    finish(ctx, 0.62);

    if (s.phase !== 'meet') {
      label(ctx, L.calls, 40, 176, 24); pips(ctx, 176, 168, s.calls, CALLS, '255,226,150', 9, 24);
      TYPES.forEach((ty, i) => { const x = 60 + i * 215; ctx.fillStyle = HEX[ty]; ctx.beginPath(); ctx.moveTo(x, 204); ctx.lineTo(x + 26, 216); ctx.lineTo(x, 228); ctx.fill(); label(ctx, `${L[ty]}  ${s.counts[ty]}`, x + 36, 225, 24, 'left', s.pick === ty ? HEX[ty] : '#f6e3bd'); });
    }
    if (s.phase === 'bonus') caption(ctx, L[`bonus${s.pick[0].toUpperCase()}${s.pick.slice(1)}`], 700, Math.min(1, s.pt * 2), 32);
  }

  return { state: s, update, render, result: () => (s.done ? { stars: CALLS - s.calls >= 8 ? 3 : CALLS - s.calls >= 5 ? 2 : 1 } : null) };
}
