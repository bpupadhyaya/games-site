// Chapter 4: the regency. The throne holds only a pair of sandals; the regent sits below it and
// hears four petitions. Each judgement moves the "kingdom in good order" meter.
import { W, H, TAU, PAL, INK, GOLD, clamp, lerp, smooth, sky, light, hall, motes, finish, shadow, rr, dome } from '../stage.js';
import { figure, poses, throne } from '../puppets.js';
import { label, meter, panel, paragraph, button, hit, font, SANS } from '../ui.js';

const FLOOR = 1140, STOP = 520, MAX = 12;
const BTN = [{ x: 56, y: 1346, w: W - 112, h: 84 }, { x: 56, y: 1446, w: W - 112, h: 84 }];
const LOOKS = [['citizen', null], ['citizen', null], ['citizen', 'spear'], ['citizen', 'staff'], ['woman', null], ['hermit', 'staff']];

export function create(env, shared) {
  const Q = shared.text.petitions, L = shared.text.lines;
  const s = { t: 0, i: shared.showcase ? 1 : 0, phase: shared.showcase ? 'ask' : 'enter', phaseT: 0, order: shared.showcase ? 3 : 0, shownOrder: shared.showcase ? 3 : 0, choice: -1, done: false, doneT: 0 };

  function choose(c) {
    const q = Q[s.i]; s.choice = c; s.order += c === 0 ? q.va : q.vb; s.phase = 'answer'; s.phaseT = 0;
    shared.sfx((c === 0 ? q.va : q.vb) >= 2 ? 'good' : 'tap');
  }

  function update(dt, input) {
    s.t += dt; s.phaseT += dt; s.shownOrder = lerp(s.shownOrder, s.order, 1 - Math.pow(0.05, dt));
    if (s.done) { s.doneT += dt; return; }
    const p = input.pointer, keys = input.keys;
    if (s.phase === 'enter' && s.phaseT > 2) { s.phase = 'ask'; s.phaseT = 0; }
    else if (s.phase === 'ask' && s.phaseT > 0.4) {
      if (p.pressed) { if (hit(BTN[0], p)) choose(0); else if (hit(BTN[1], p)) choose(1); }
      else if (keys.pressed.has('ArrowLeft') || keys.pressed.has('ArrowUp')) choose(0);
      else if (keys.pressed.has('ArrowRight') || keys.pressed.has('ArrowDown')) choose(1);
    } else if (s.phase === 'answer' && s.phaseT > 2.8) { s.phase = 'leave'; s.phaseT = 0; }
    else if (s.phase === 'leave' && s.phaseT > 2.2) {
      if (s.i + 1 >= Q.length) { s.done = true; shared.sfx('chime'); } else { s.i += 1; s.phase = 'enter'; s.phaseT = 0; s.choice = -1; }
    }
  }

  function render(ctx) {
    const t = s.t, rm = shared.rm(), P = PAL.palace;
    sky(ctx, ['#1c0a14', '#5a2222', '#b8642c', '#f0b860'], { x: 360, y: 700, r: 640, color: P.glow, alpha: 0.6 });
    for (let i = 0; i < 3; i++) { const x = 40 + i * 240; ctx.fillStyle = 'rgba(255,214,140,0.13)'; ctx.beginPath(); ctx.moveTo(x + 50, FLOOR - 100); ctx.lineTo(x + 50, 520); ctx.arc(x + 110, 520, 60, Math.PI, 0); ctx.lineTo(x + 170, FLOOR - 100); ctx.fill(); }
    hall(ctx, { scroll: 90, color: P.mid, top: 120, floor: FLOOR - 90, gap: 240, t, lampRgb: P.glow });
    const fg = ctx.createLinearGradient(0, FLOOR - 100, 0, H); fg.addColorStop(0, '#54221f'); fg.addColorStop(0.3, '#2a1016'); fg.addColorStop(1, '#10060b');
    ctx.fillStyle = fg; ctx.fillRect(0, FLOOR - 100, W, H);
    // the dais and the empty throne
    const tx = 330, ty = FLOOR - 70;
    light(ctx, tx, ty - 200, 420, '255,220,150', 0.55 + (rm ? 0 : 0.05 * Math.sin(t * 2)));
    ctx.fillStyle = P.near; for (let k = 0; k < 3; k++) rr(ctx, tx - 190 + k * 30, ty - k * 30, 380 - k * 60, 34, 6), ctx.fill();
    ctx.fillStyle = 'rgba(200,148,42,0.95)'; rr(ctx, tx - 150, ty - 128, 300, 72, 10); ctx.fill(); ctx.fillStyle = 'rgba(90,40,10,0.5)'; ctx.fillRect(tx - 150, ty - 90, 300, 4);
    throne(ctx, tx, ty - 120, 300, 470, false);
    // the cushion and the sandals, in their own pool of light
    light(ctx, tx, ty - 214, 170, '255,236,170', 0.85);
    ctx.fillStyle = '#7a2230'; rr(ctx, tx - 78, ty - 214, 156, 30, 14); ctx.fill(); ctx.strokeStyle = GOLD; ctx.lineWidth = 2; rr(ctx, tx - 78, ty - 214, 156, 30, 14); ctx.stroke();
    for (const d of [-26, 26]) { ctx.fillStyle = INK; ctx.beginPath(); ctx.ellipse(tx + d, ty - 222, 22, 8, 0, 0, TAU); ctx.fill(); ctx.fillRect(tx + d + 8, ty - 240, 4, 16); ctx.beginPath(); ctx.arc(tx + d + 10, ty - 242, 5, 0, TAU); ctx.fill(); ctx.strokeStyle = GOLD; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.ellipse(tx + d, ty - 222, 22, 8, 0, Math.PI, TAU); ctx.stroke(); }
    // guards at the pillars, the regent seated low beside the dais
    for (const [gx, d] of [[52, 1], [668, -1]]) { shadow(ctx, gx, FLOOR + 10, 40, 0.3); figure(ctx, { x: gx, y: FLOOR + 10, s: 1.15, dir: d, kind: 'citizen', prop: 'spear', pose: { ...poses.stand(t + gx), shF: 0.7, elF: 0.9, propA: 3.1 } }); }
    ctx.fillStyle = '#3a1420'; rr(ctx, 120, FLOOR + 6, 170, 22, 10); ctx.fill();
    shadow(ctx, 200, FLOOR + 22, 70, 0.35);
    const nod = s.phase === 'answer' ? Math.sin(Math.min(s.phaseT, 1) * Math.PI) * 0.2 : 0;
    figure(ctx, { x: 200, y: FLOOR + 10, s: 1.75, dir: 1, kind: 'bharat', pose: { ...poses.sit(t), head: nod, shF: s.phase === 'answer' ? 1.2 : 0.5 } });
    // the petitioner
    const [kind, prop] = LOOKS[s.i % LOOKS.length];
    let px = STOP, pose = poses.stand(t), dir = -1;
    if (s.phase === 'enter') { const u = smooth(s.phaseT / 2); px = lerp(W + 120, STOP, u); if (u < 1) pose = poses.walk(t, 5); }
    else if (s.phase === 'leave') { const u = smooth((s.phaseT - 0.7) / 1.5); px = lerp(STOP, W + 140, u); if (s.phaseT < 0.7) pose = { ...poses.stand(t), lean: 0.5 * Math.sin((s.phaseT / 0.7) * Math.PI), head: 0.3 }; else { pose = poses.walk(t, 5); dir = 1; } }
    if (!s.done) {
      const n = s.i === 1 ? 2 : 1;
      for (let k = 0; k < n; k++) { shadow(ctx, px + k * 86, FLOOR + 26, 44, 0.35); figure(ctx, { x: px + k * 86, y: FLOOR + 26, s: 1.5, dir, kind, prop, pose: prop ? { ...pose, shF: 0.7, elF: 0.9, propA: 3.1 } : { ...pose, t: t + k } }); }
    }
    motes(ctx, { n: 20, t, rgb: P.glow, kind: 'dust', top: 250, bottom: 1100, rm });
    finish(ctx, 0.78);

    meter(ctx, 110, 322, W - 220, 22, s.shownOrder / MAX, '255,214,130', L.meter, `${Math.round(s.order)} / ${MAX}`);
    // the petition
    if (!s.done && (s.phase === 'ask' || s.phase === 'answer')) {
      const q = Q[s.i], a = clamp(s.phaseT * 3, 0, 1);
      ctx.save(); ctx.globalAlpha = a;
      panel(ctx, 36, 1184, W - 72, s.phase === 'ask' ? 150 : 190, 0.82);
      label(ctx, q.who.toUpperCase(), W / 2, 1222, 20, 'center', GOLD, SANS, 700);
      ctx.fillStyle = '#fff1cf'; ctx.font = font(30);
      paragraph(ctx, s.phase === 'ask' ? `"${q.text}"` : (s.choice === 0 ? q.ra : q.rb), W / 2, 1264, W - 140, 38);
      if (s.phase === 'ask') { button(ctx, { ...BTN[0], label: q.a }, { size: 28 }); button(ctx, { ...BTN[1], label: q.b }, { size: 28 }); }
      else { const v = s.choice === 0 ? q.va : q.vb; label(ctx, `+${v}`, W / 2, 1352, 34, 'center', v >= 2 ? '#9fe0a0' : GOLD, SANS, 700); }
      ctx.restore();
    }
  }

  return { state: s, update, render, result: () => (s.done && s.doneT > 1.4 ? { stars: s.order >= 10 ? 3 : s.order >= 7 ? 2 : 1 } : null) };
}
