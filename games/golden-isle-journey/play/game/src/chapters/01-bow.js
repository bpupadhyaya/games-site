// Chapter 1: the great bow. Three holds (lift, bend, string): gather strength while holding and
// let go inside the gold band. A slip only resets the meter. Then the bow breaks and the hall rejoices.
import { W, H, TAU, PAL, INK, GOLD, clamp, lerp, smooth, hash, sky, light, hall, motes, finish, shadow, shakeOffset, rr } from '../stage.js';
import { figure, lodFigure, poses, stridePose } from '../puppets.js';
import { label, caption } from '../ui.js';

const FLOOR = 1190, HALF = [0.09, 0.07, 0.055], CENTER = [0.58, 0.68, 0.74];

export function create(env, shared) {
  const L = shared.text.lines;
  const s = {
    t: 0, stage: shared.showcase ? 1 : 0, power: shared.showcase ? 0.45 : 0, holding: !!shared.showcase, misses: 0,
    phase: 'play', phaseT: 0, msg: '', msgT: 0, done: false, stageGlow: 0,
  };
  const say = (m) => { s.msg = m; s.msgT = 1.6; };
  const bandC = () => CENTER[Math.min(2, s.stage)] + (s.stage === 2 ? Math.sin(s.t * 1.4) * 0.1 : 0);
  const shown = () => clamp(s.power + (s.stage === 1 && s.holding ? Math.sin(s.t * 9) * 0.035 * (0.4 + s.power) : 0), 0, 1);

  function slip() { s.misses += 1; s.power = 0; s.holding = false; say(L.slipped); shared.sfx('bad'); }

  function update(dt, input) {
    s.t += dt; s.msgT = Math.max(0, s.msgT - dt); s.stageGlow = Math.max(0, s.stageGlow - dt);
    const p = input.pointer, keys = input.keys;
    if (s.phase === 'play') {
      if ((p.pressed && p.y > 120) || keys.pressed.has('Space')) { s.holding = true; shared.sfx('tap'); }
      const still = p.down || keys.down.has('Space');
      if (s.holding && still) {
        s.power += dt * (0.5 - s.stage * 0.04);
        if (s.power >= 1) slip();
      } else if (s.holding) {
        s.holding = false;
        if (Math.abs(shown() - bandC()) <= HALF[s.stage]) {
          s.stage += 1; s.power = 0; s.stageGlow = 1; say(L.steady); shared.sfx('good');
          if (s.stage >= 3) { s.phase = 'snap'; s.phaseT = 0; s.msgT = 0; }
        } else slip();
      } else s.power = Math.max(0, s.power - dt * 0.8);
    } else {
      s.phaseT += dt;
      if (s.phase === 'snap' && s.phaseT > 1.1) { s.phase = 'celebrate'; s.phaseT = 0; shared.sfx('thud'); shared.sfx('star'); }
      if (s.phase === 'celebrate' && s.phaseT > 4.5) s.done = true;
    }
  }

  function crowd(ctx, t, cheer) {
    for (let i = 0; i < 12; i++) {
      const side = i % 2 ? 1 : -1, row = Math.floor(i / 2) % 3, col = Math.floor(i / 6);
      const x = W / 2 + side * (215 + col * 78 + row * 26), y = FLOOR - 60 + row * 44, sc = 0.78 + row * 0.12;
      const kind = hash(i * 5) > 0.55 ? 'woman' : 'citizen';
      shadow(ctx, x, y, 40 * sc, 0.3);
      // the crowd is baked to one sprite per animation frame (LOD): one draw each instead of ~20 part blits
      const fr = 8, rate = (cheer ? 6 : 1.6) / (2 * Math.PI), f = Math.floor((((t * rate + i * 0.137) % 1) + 1) % 1 * fr);
      lodFigure(ctx, { x, y, s: sc, dir: -side, kind }, f, (k) => (cheer ? poses.cheer((k / fr) * 2 * Math.PI / 6, 0) : poses.stand((k / fr) * 2 * Math.PI / 1.6)));
    }
  }

  function brokenBow(ctx, x, y, u) {
    ctx.strokeStyle = INK; ctx.lineCap = 'round'; ctx.lineWidth = 10;
    for (const d of [-1, 1]) {
      ctx.save(); ctx.translate(x + d * u * 90, y + d * 60 + u * u * 330); ctx.rotate(d * (0.4 + u * 2.2));
      ctx.beginPath(); ctx.arc(-70, 0, 120, d > 0 ? 0.05 : -0.95, d > 0 ? 0.95 : -0.05); ctx.stroke();
      ctx.restore();
    }
  }

  function render(ctx) {
    const t = s.t, rm = shared.rm(), P = PAL.palace;
    const prog = clamp((s.stage + (s.phase === 'play' ? s.power * 0.5 : 0)) / 3, 0, 1);
    const zoom = 1 + smooth(prog) * 0.1;
    const snapU = s.phase === 'snap' ? s.phaseT / 1.1 : 0;
    const [ox, oy] = shakeOffset(t, s.phase === 'celebrate' && s.phaseT < 0.5 ? 12 : 0, rm);
    ctx.save();
    ctx.translate(W / 2 + ox, 900 + oy); ctx.scale(zoom, zoom); ctx.translate(-W / 2, -900);
    sky(ctx, P.sky, { x: W / 2, y: 760, r: 720, color: P.glow, alpha: 0.75 });
    // far wall: tall window arches full of evening light
    for (let i = -1; i < 4; i++) {
      const x = 60 + i * 240; ctx.fillStyle = 'rgba(255,214,140,0.16)';
      ctx.beginPath(); ctx.moveTo(x + 60, FLOOR - 120); ctx.lineTo(x + 60, 560); ctx.arc(x + 120, 560, 60, Math.PI, 0); ctx.lineTo(x + 180, FLOOR - 120); ctx.fill();
    }
    hall(ctx, { scroll: 60, color: P.mid, top: 120, floor: FLOOR - 110, gap: 240, t, lampRgb: P.glow });
    // floor with a lit carpet
    const fg = ctx.createLinearGradient(0, FLOOR - 120, 0, H); fg.addColorStop(0, '#5a2420'); fg.addColorStop(0.35, '#2c1016'); fg.addColorStop(1, '#12060c');
    ctx.fillStyle = fg; ctx.fillRect(-40, FLOOR - 120, W + 80, H);
    ctx.fillStyle = 'rgba(200,70,50,0.35)'; ctx.beginPath(); ctx.moveTo(250, FLOOR - 120); ctx.lineTo(470, FLOOR - 120); ctx.lineTo(640, H); ctx.lineTo(80, H); ctx.fill();
    ctx.strokeStyle = 'rgba(242,196,106,0.5)'; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(250, FLOOR - 120); ctx.lineTo(80, H); ctx.moveTo(470, FLOOR - 120); ctx.lineTo(640, H); ctx.stroke();
    // the king on his dais, the princess beside him
    ctx.fillStyle = P.near; rr(ctx, 20, FLOOR - 170, 250, 60, 8); ctx.fill(); rr(ctx, 40, FLOOR - 330, 110, 170, 14); ctx.fill();
    ctx.strokeStyle = 'rgba(242,196,106,0.6)'; ctx.lineWidth = 2; rr(ctx, 48, FLOOR - 322, 94, 150, 10); ctx.stroke();
    figure(ctx, { x: 96, y: FLOOR - 168, s: 0.95, kind: 'king', pose: poses.sit(t) });
    const celebrate = s.phase === 'celebrate', walkU = celebrate ? smooth((s.phaseT - 0.6) / 2.6) : 0;
    const px = lerp(205, 300, walkU), py = lerp(FLOOR - 168, FLOOR - 6, walkU), walking = walkU > 0 && walkU < 1;
    crowd(ctx, t, celebrate);
    shadow(ctx, px, py, 40, 0.3);
    figure(ctx, { x: px, y: py, s: lerp(0.95, 1.3, walkU), kind: 'princess', pose: walking ? { ...stridePose('princess', px, 1.3, { t }), shF: 1.2, elF: 0.6 } : { ...poses.stand(t), shF: 1.1, elF: 0.7 } });
    // garland in her hands
    ctx.strokeStyle = GOLD; ctx.lineWidth = 4; ctx.beginPath(); ctx.ellipse(px + 46 * lerp(0.95, 1.3, walkU), py - 150 * lerp(0.95, 1.3, walkU), 13, 22, 0.2, 0, TAU); ctx.stroke();
    // the prince and the bow
    const hx = 350, hy = FLOOR + 4, sc = 1.85;
    light(ctx, hx + 20, hy - 190, 330, P.glow, 0.35 + s.stageGlow * 0.4);
    shadow(ctx, hx, hy, 70, 0.4);
    const liftA = s.stage > 0 ? 1 : smooth(s.power * 1.4), bendA = s.stage > 1 ? 0.7 + snapU * 0.6 : s.stage === 1 ? s.power * 0.7 : 0;
    if (s.phase !== 'celebrate') {
      const pose = { ...poses.stand(t), hipF: 0.3, hipB: -0.28, kneeF: -0.12 * (1 - liftA), lean: lerp(0.32, -0.02, liftA) + bendA * 0.05,
        shF: lerp(0.75, 1.5, liftA), elF: lerp(0.5, 0.05, liftA), shB: lerp(0.6, 1.2, liftA) - (s.stage === 2 ? s.power * 0.5 : 0), elB: 0.5 + (s.stage === 2 ? s.power : 0),
        aim: lerp(1.15, 0.05, liftA), bend: bendA, string: s.stage >= 3 || (s.stage === 2 && s.power > 0.05), pull: s.stage === 2 ? s.power * 0.35 : snapU * 0.8,
        bob: s.holding && !rm ? Math.sin(t * 30) * s.power * 1.5 : 0 };
      figure(ctx, { x: hx, y: hy, s: sc, kind: 'prince', prop: 'greatbow', pose });
    } else {
      figure(ctx, { x: hx, y: hy, s: sc, kind: 'prince', dir: walkU > 0.5 ? -1 : 1, pose: poses.stand(t) });
      if (s.phaseT < 1.6) brokenBow(ctx, hx + 110, hy - 250, s.phaseT / 1.6);
    }
    if (celebrate) motes(ctx, { n: 46, t, rgb: '255,170,150', kind: 'petal', top: 100, bottom: H, rm });
    motes(ctx, { n: 18, t, rgb: P.glow, kind: 'dust', top: 300, bottom: 1100, rm });
    ctx.restore();
    if (celebrate && s.phaseT < 0.5) { ctx.fillStyle = `rgba(255,244,210,${(0.5 - s.phaseT) * 1.6})`; ctx.fillRect(0, 0, W, H); }
    finish(ctx, 0.75);

    if (s.phase === 'play') {
      // the strength meter: a tall gold-rimmed column on the right
      const mx = 618, my = 470, mw = 46, mh = 640, c = bandC(), hw = HALF[s.stage], v = shown();
      ctx.fillStyle = 'rgba(10,4,8,0.66)'; rr(ctx, mx, my, mw, mh, 22); ctx.fill();
      ctx.fillStyle = 'rgba(255,214,120,0.9)'; rr(ctx, mx + 3, my + mh * (1 - c - hw), mw - 6, mh * hw * 2, 8); ctx.fill();
      light(ctx, mx + mw / 2, my + mh * (1 - c), 90, '255,214,120', 0.35);
      const g = ctx.createLinearGradient(0, my + mh, 0, my); g.addColorStop(0, 'rgba(255,120,60,0.9)'); g.addColorStop(1, 'rgba(255,240,200,0.95)');
      ctx.fillStyle = g; if (v > 0.01) { rr(ctx, mx + 12, my + mh * (1 - v), mw - 24, mh * v, 10); ctx.fill(); }
      ctx.strokeStyle = '#fff2c6'; ctx.lineWidth = 4; ctx.beginPath(); ctx.moveTo(mx - 8, my + mh * (1 - v)); ctx.lineTo(mx + mw + 8, my + mh * (1 - v)); ctx.stroke();
      ctx.strokeStyle = 'rgba(242,196,106,0.9)'; ctx.lineWidth = 2.5; rr(ctx, mx, my, mw, mh, 22); ctx.stroke();
      // the three stages
      [L.lift, L.bend, L.string].forEach((name, i) => {
        const on = i < s.stage, now = i === s.stage;
        label(ctx, name, 60, 330 + i * 46, now ? 38 : 30, 'left', on ? GOLD : now ? '#fff1cf' : 'rgba(255,241,207,0.45)', '"Cormorant Garamond", Georgia, serif', 700);
        ctx.fillStyle = on ? GOLD : 'rgba(255,241,207,0.35)'; ctx.beginPath(); ctx.arc(40, 320 + i * 46, now ? 8 : 6, 0, TAU); ctx.fill();
      });
    }
    caption(ctx, s.msg, 1400, Math.min(1, s.msgT * 2), 32);
  }

  return { state: s, update, render, result: () => (s.done ? { stars: s.misses <= 1 ? 3 : s.misses <= 3 ? 2 : 1 } : null) };
}
