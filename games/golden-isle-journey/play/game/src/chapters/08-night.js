// Chapter 8: the fortress city by night. A vertical climb from shadow to shadow while the watch
// sweeps lantern light across the roofs; at the top, the grove and the ring.
import { W, H, TAU, PAL, INK, clamp, lerp, smooth, hash, sky, stars, skyline, light, motes, finish, shadow, wall, gardenTree, moon } from '../stage.js';
import { figure, poses, stridePose } from '../puppets.js';
import { label, caption, pips } from '../ui.js';

const ROWS = 20, STEP = 320, WORLD = 6700, ROW0 = 6400, CONE_LEN = 330, CONE_HALF = 0.3, DASH = 0.6;
const rowY = (r) => ROW0 - r * STEP;

export function create(env, shared) {
  const { rng } = env;
  const L = shared.text.lines;
  const patches = [];
  for (let r = 0; r < ROWS; r++) {
    const slots = r === 0 || r === ROWS - 1 ? [360] : rng.shuffle([130, 360, 590]).slice(0, rng.chance(0.5) ? 3 : 2);
    for (const x of slots) patches.push({ r, x: r === ROWS - 1 ? 300 : x + (r === 0 ? 0 : rng.range(-40, 40)) });
  }
  const guards = [];
  for (let r = 1; r < ROWS - 2; r++) {
    const n = r > 6 && rng.chance(0.5) ? 2 : 1;
    for (let k = 0; k < n; k++) {
      const left = n === 2 ? k === 0 : rng.chance(0.5);
      guards.push({ y: rowY(r) - STEP / 2 + 20, x: left ? rng.range(90, 250) : rng.range(470, 630), walk: rng.chance(0.4) ? rng.range(40, 90) : 0,
        base: left ? rng.range(0.1, 0.7) : Math.PI - rng.range(0.1, 0.7), amp: rng.range(0.75, 1.05), w: rng.range(0.75, 1.15), ph: rng.range(0, 6) });
    }
  }
  const start = shared.showcase ? patches.findIndex((p) => p.r === 5) : 0;
  const s = { t: 0, phase: 'hide', pt: 0, at: start, from: start, to: start, dash: 0, seen: 0, flash: 0, cam: 0, patches, guards, msg: 0, done: false, lost: false };
  s.cam = clamp(rowY(patches[start].r) - 1080, 0, WORLD - H);

  const gx = (g) => g.x + (g.walk ? Math.sin(s.t * 0.5 + g.ph) * g.walk : 0);
  const ga = (g) => g.base + Math.sin(s.t * g.w + g.ph) * g.amp;
  const heroPos = () => {
    const a = s.patches[s.from], b = s.patches[s.to], q = s.phase === 'dash' ? smooth(s.dash) : 1;
    return [lerp(a.x, b.x, q), lerp(rowY(a.r), rowY(b.r), q) - Math.sin(q * Math.PI) * 50];
  };
  const inCone = (g, x, y) => {
    const dx = x - gx(g), dy = y - 70 - (g.y - 60), d = Math.hypot(dx, dy);
    if (d > CONE_LEN) return false;
    let da = Math.atan2(dy, dx) - ga(g); da = Math.atan2(Math.sin(da), Math.cos(da));
    return Math.abs(da) < CONE_HALF;
  };

  function update(dt, input) {
    s.t += dt; s.pt += dt;
    s.flash = Math.max(0, s.flash - dt * 1.6); s.msg = Math.max(0, s.msg - dt);
    const p = input.pointer, cur = s.patches[s.at];
    if (s.phase === 'hide') {
      if (cur.r === ROWS - 1) { s.phase = 'grove'; s.pt = 0; shared.sfx('chime'); }
      else if (p.pressed && p.y > 130) {
        let best = -1, bd = 105;
        s.patches.forEach((q, i) => { if (i === s.at || (q.r !== cur.r && q.r !== cur.r + 1)) return; const d = Math.hypot(p.x - q.x, p.y + s.cam - (rowY(q.r) - 20)); if (d < bd) { bd = d; best = i; } });
        if (best >= 0) { s.from = s.at; s.to = best; s.phase = 'dash'; s.dash = 0; shared.sfx('whoosh'); }
      }
    } else if (s.phase === 'dash') {
      s.dash += dt / DASH;
      const [hx, hy] = heroPos();
      if (s.dash > 0.12 && s.dash < 0.88 && s.guards.some((g) => inCone(g, hx, hy))) {
        s.seen += 1; s.flash = 1; s.msg = 2; shared.sfx('bad');
        if (s.seen >= 4) s.lost = true; else { s.phase = 'seen'; s.pt = 0; s.to = s.from; }
      } else if (s.dash >= 1) { s.at = s.to; s.from = s.to; s.phase = 'hide'; s.pt = 0; shared.sfx('tap'); }
    } else if (s.phase === 'seen') { if (s.pt > 0.8) { s.phase = 'hide'; s.at = s.from; s.to = s.from; } }
    else if (s.phase === 'grove') { if (s.pt > 3.6) s.done = true; }
    const [, hy] = heroPos();
    s.cam = lerp(s.cam, clamp(hy - 1080, 0, WORLD - H), 1 - Math.pow(0.03, dt));
  }

  function terrace(ctx, r, t) {
    const y = rowY(r) - s.cam;
    if (y < -STEP - 60 || y > H + 80) return;
    const tone = ['#0a1030', '#080e2a', '#0b1234'][r % 3];
    wall(ctx, 0, y, W, STEP + 4, tone, { glow: '255,190,110', top: 0.04 });
    // roof lip and crenellations, moon-rimmed
    ctx.fillStyle = '#080d28'; ctx.fillRect(0, y - 8, W, 16);
    for (let i = 0; i < 12; i++) if (hash(r * 31 + i) > 0.35) { const cx = i * 62 + hash(r + i) * 10; ctx.fillStyle = '#0a1030'; ctx.fillRect(cx, y - 22, 34, 16); ctx.fillStyle = 'rgba(190,200,255,0.3)'; ctx.fillRect(cx, y - 22, 34, 2.5); }
    ctx.strokeStyle = 'rgba(244,196,100,0.5)'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(0, y - 8); ctx.lineTo(W, y - 8); ctx.stroke();
    // garden trees or a dome on some terraces
    if (r % 3 === 1) for (let i = 0; i < 3; i++) gardenTree(ctx, 110 + i * 250 + hash(r * 5 + i) * 60, y - 6, 1, '#0c2a30', r * 3 + i);
  }

  function render(ctx) {
    const t = s.t, rm = shared.rm(), cam = s.cam;
    sky(ctx, PAL.night.sky, null);
    stars(ctx, 0.9, t, 0, H);
    const my = 300 + (cam / WORLD) * 120;
    moon(ctx, 540, my, 58, '236,240,255', 0.3);
    skyline(ctx, { base: 1180 - (cam - WORLD) * 0.12 - 500, scroll: 60, color: '#121a44', seed: 3, h: 420, gap: 150, kind: 'lanka', lit: '255,200,120', t });
    for (let r = ROWS - 1; r >= 0; r--) terrace(ctx, r, t);
    // ground below the first row
    const by = rowY(0) + STEP - cam; if (by < H) { ctx.fillStyle = '#04061a'; ctx.fillRect(0, by, W, H - by); }

    // the grove at the top
    const gy = rowY(ROWS - 1) - cam;
    if (gy > -200) {
      light(ctx, 400, gy - 160, 420, '255,214,140', s.phase === 'grove' ? 0.35 + 0.3 * smooth(s.pt / 2) : 0.18);
      for (const [tx, sc] of [[120, 1.1], [560, 1.35], [700, 0.9]]) {
        ctx.fillStyle = '#040816'; ctx.beginPath(); ctx.moveTo(tx - 26 * sc, gy); ctx.quadraticCurveTo(tx - 8 * sc, gy - 200 * sc, tx - 16 * sc, gy - 330 * sc); ctx.lineTo(tx + 16 * sc, gy - 330 * sc); ctx.quadraticCurveTo(tx + 8 * sc, gy - 200 * sc, tx + 30 * sc, gy); ctx.fill();
        for (let i = 0; i < 7; i++) { ctx.beginPath(); ctx.arc(tx + (hash(i + tx) - 0.5) * 300 * sc, gy - (300 + hash(i * 3 + tx) * 190) * sc, (70 + hash(i * 7) * 50) * sc, 0, TAU); ctx.fill(); }
        ctx.fillStyle = 'rgba(255,170,130,0.75)'; for (let i = 0; i < 8; i++) { ctx.beginPath(); ctx.arc(tx + (hash(i * 11 + tx) - 0.5) * 320 * sc, gy - (270 + hash(i * 13 + tx) * 230) * sc, 5, 0, TAU); ctx.fill(); }
      }
      shadow(ctx, 470, gy + 2, 60, 0.4);
      figure(ctx, { x: 470, y: gy, s: 1.05, kind: 'princess_f', dir: -1, pose: { ...poses.sit(t), head: s.phase === 'grove' ? 0.1 : 0 } });
    }

    // shadow patches
    const cur = s.patches[s.at];
    s.patches.forEach((q, i) => {
      const y = rowY(q.r) - cam; if (y < -80 || y > H + 80) return;
      const g = ctx.createRadialGradient(q.x, y - 6, 8, q.x, y - 6, 100); g.addColorStop(0, 'rgba(0,0,8,0.95)'); g.addColorStop(0.7, 'rgba(0,0,8,0.7)'); g.addColorStop(1, 'rgba(0,0,8,0)');
      ctx.save(); ctx.translate(q.x, y - 6); ctx.scale(1, 0.42); ctx.translate(-q.x, -(y - 6)); ctx.fillStyle = g; ctx.fillRect(q.x - 110, y - 116, 220, 220); ctx.restore();
      const can = s.phase === 'hide' && i !== s.at && (q.r === cur.r || q.r === cur.r + 1);
      ctx.strokeStyle = can ? `rgba(255,220,140,${0.55 + 0.35 * Math.sin(t * 5 + i)})` : 'rgba(170,180,255,0.22)'; ctx.lineWidth = can ? 3 : 2; ctx.setLineDash(can ? [10, 9] : []);
      ctx.beginPath(); ctx.ellipse(q.x, y - 6, 84, 30, 0, 0, TAU); ctx.stroke(); ctx.setLineDash([]);
    });

    // the watch
    for (const g of s.guards) {
      const y = g.y - cam; if (y < -CONE_LEN - 60 || y > H + CONE_LEN) continue;
      const x = gx(g), a = ga(g), lx = x, ly = y - 60;
      ctx.fillStyle = '#060a1e'; ctx.fillRect(x - 70, y, 140, 12); ctx.fillRect(x - 60, y + 12, 8, 26); ctx.fillRect(x + 52, y + 12, 8, 26);
      const cg = ctx.createRadialGradient(lx, ly, 10, lx, ly, CONE_LEN); cg.addColorStop(0, 'rgba(255,224,140,0.55)'); cg.addColorStop(1, 'rgba(255,224,140,0.04)');
      ctx.fillStyle = cg; ctx.beginPath(); ctx.moveTo(lx, ly); ctx.arc(lx, ly, CONE_LEN, a - CONE_HALF, a + CONE_HALF); ctx.closePath(); ctx.fill();
      ctx.strokeStyle = 'rgba(255,230,160,0.35)'; ctx.lineWidth = 1.5; ctx.stroke();
      figure(ctx, { x, y, s: 0.9, kind: 'raider', dir: Math.cos(a) >= 0 ? 1 : -1, prop: 'lantern', pose: { ...poses.stand(t + g.ph), shF: 1.2, elF: 0.4 } });
    }

    // the leaper
    const [hx, hy] = heroPos(), moving = s.phase === 'dash', b = s.patches[s.to], a0 = s.patches[s.from];
    const dir = moving ? (b.x >= a0.x ? 1 : -1) : 1;
    if (s.phase === 'grove') {
      const u = smooth(s.pt / 1.2), px = lerp(300, 372, u);
      figure(ctx, { x: px, y: gy, s: 1.1, kind: 'leaper_c', prop: u >= 1 ? 'ring' : null, pose: u < 1 ? stridePose('leaper_c', px, 1.1, { t }) : poses.offer(t) });
    } else {
      ctx.globalAlpha = moving ? 1 : 0.92;
      figure(ctx, { x: hx, y: hy - cam, s: 0.9, kind: 'leaper', dir, pose: moving ? { ...poses.leap(t), tailWave: 0.2 } : poses.sneak(t, false), gold: moving ? '#f2c46a' : 'rgba(242,196,106,0.55)' });
      ctx.globalAlpha = 1;
    }
    motes(ctx, { n: 16, t, rgb: '200,215,255', kind: 'firefly', rm, top: 200, bottom: H });
    if (s.flash > 0) { ctx.fillStyle = `rgba(255,226,150,${s.flash * (rm ? 0.2 : 0.45)})`; ctx.fillRect(0, 0, W, H); }
    finish(ctx, 0.82);
    label(ctx, L.seen, 40, 176, 24); pips(ctx, 110, 168, s.seen, 3, '255,150,110', 9, 26);
    if (s.msg > 0) caption(ctx, L.hush, 1360, Math.min(1, s.msg * 2), 30);
    if (s.phase === 'grove') caption(ctx, L.grove[0].toUpperCase() + L.grove.slice(1), 1300, Math.min(1, s.pt), 34);
  }

  return { state: s, update, render, result: () => (s.lost ? { lost: true } : s.done ? { stars: s.seen === 0 ? 3 : s.seen === 1 ? 2 : 1 } : null) };
}
