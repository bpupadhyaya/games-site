// The show screen: piazza, bearers, flags in flight, figure card, HUD, coach panel (Watch and Learn), pause menu, banner.
import { PAL, UI, DISPLAY, drawBackdrop, drawBearer, drawBearerGround, drawFlag, drawParticles, drawDrum, drawRing, clamp, clamp01, rgba } from './art.js';
import { txt, button, panel, plaque, rrect, chip, wrap } from './ui.js';
import { TUNE, ENS, FIGS, holding, nextCue, youOf, xOf, slotOf, airOf, nAirOf, multFor } from './engine.js';
import { menuRects } from './layout.js';

const TAU = Math.PI * 2;
const ease = (x) => x * x * (3 - 2 * x);
const apexFrac = (air) => 0.18 + 0.82 * nAirOf(air);

export function geom(L) {
  const P = L.play, Lf = P.H * 0.95;
  return { P, Lf, rise: Math.max(140, P.rise - Lf * 0.6) };
}
export const slotX = (L, show, slot) => L.S.x + L.S.w * ENS[show.ens].xs[slot];
export const fracX = (L, f) => L.S.x + L.S.w * f;
export const apexY = (G, air) => G.P.grip - G.rise * apexFrac(air);

// ---- flags in flight ---------------------------------------------------------------------------------------------------------------------------
function flagPose(L, G, show, fl, t) {
  const u = clamp01((show.b - fl.b0) / fl.air), x0 = fracX(L, fl.x0), x1 = fracX(L, fl.x1);
  const apex = G.rise * apexFrac(fl.air) * (fl.kind === 'mirror' ? 0.85 : 1);
  const x = x0 + (x1 - x0) * u, y = G.P.grip - apex * 4 * u * (1 - u);
  const turns = Math.max(1, Math.round(fl.air * 0.9));
  return { x, y, ang: fl.dir * TAU * turns * ease(u) * 0.5 + fl.dir * TAU * turns * u * 0.5, u };
}

function drawFlight(ctx, st, pl, L, G) {
  const show = pl.show, t = st.t, calm = st.prefs.calm;
  for (const fl of show.flags) {
    if (fl.state === 'air') {
      const p = flagPose(L, G, show, fl, t);
      const side = -fl.dir;
      // a faint trail
      ctx.save(); ctx.globalAlpha = 0.18; ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 3; ctx.setLineDash([2, 12]); ctx.lineCap = 'round';
      ctx.beginPath();
      for (let k = 0; k <= 12; k++) {
        const u = clamp01(p.u * k / 12), x = fracX(L, fl.x0) + (fracX(L, fl.x1) - fracX(L, fl.x0)) * u, y = G.P.grip - G.rise * apexFrac(fl.air) * 4 * u * (1 - u);
        if (k) ctx.lineTo(x, y); else ctx.moveTo(x, y);
      }
      ctx.stroke(); ctx.restore();
      const shadowY = G.P.foot - 2, sh = 1 - clamp01((G.P.grip - p.y) / G.rise) * 0.5;
      ctx.fillStyle = 'rgba(40,24,10,0.22)'; ctx.beginPath(); ctx.ellipse(p.x, shadowY, G.Lf * 0.22 * sh, G.Lf * 0.04 * sh, 0, 0, TAU); ctx.fill();
      drawFlag(ctx, p.x, p.y, G.Lf, p.ang, fl.design, { ph: t * 9 + fl.id, side, calm });
    } else if (fl.state === 'dropped') {
      // falls the last bit and lies on the flagstones, then fades
      const age = show.b - fl.tEnd, u = clamp01(age / 0.5), x = fracX(L, fl.x1) + fl.dir * u * 18;
      const y = G.P.grip + (G.P.foot - G.Lf * 0.1 - G.P.grip) * u * u;
      ctx.save(); ctx.globalAlpha = clamp01(1.4 - age / 1.1);
      drawFlag(ctx, x, y, G.Lf, u * 1.2 * fl.dir + (u > 0.95 ? Math.PI / 2.1 * fl.dir : 0), fl.design, { ph: 0, side: -fl.dir, calm: true });
      ctx.restore();
    }
  }
}

// ---- the bearers ---------------------------------------------------------------------------------------------------------------------------------
// Each bearer's pose (hand targets in units of H/100 from the feet, body mechanics, held flags) is worked out here from the show state, as pure
// data. The 3D show (globalThis.__show3d, installed by main.js) draws people, flags, piazza and crowd from it; when it is missing (no WebGL2, a
// failed load, a lost context) the 2D figure and flags are drawn from the same data.
function gazeOf(show, pl, L, G, s, t) {
  for (const fl of show.flags) {
    if (fl.state !== 'air' || fl.kind === 'mirror' || (fl.to !== s && fl.owner !== s)) continue;
    const p = flagPose(L, G, show, fl, t);
    return { x: p.x, y: p.y };
  }
  return null;
}
const sstep = (a, b, x) => { const u = clamp01((x - a) / (b - a)); return u * u * (3 - 2 * u); };
// What one bearer is doing right now: wind-up before a release, follow-through after it, reaching for a flag that is coming down.
function motionOf(show, pl, L, G, s, you) {
  const b = show.b, f = show.fig;
  let wind = 0, follow = 0, reach = null, rel = null, face = null;
  if (s === you) {
    const d = pl.drag;
    if (d && d.moved && d.up > 14 && f.throws.some((q) => q.state === 'wait')) wind = clamp01(d.up / G.P.reach) * 0.85 + 0.15;
    else for (const t of f.throws) if (t.state === 'wait') { const dt = t.relB - b; if (dt > -0.3 && dt < 0.5) wind = Math.max(wind, 0.8 * sstep(0.5, 0.05, dt)); }
  } else {
    for (const inc of f.incoming) if (inc.state === 'wait' && inc.from !== undefined) {
      const slot = ENS[show.ens].roles[inc.from];
      if (slot === s) { const dt = inc.relB - b; if (dt > -0.05 && dt < 0.5) wind = Math.max(wind, sstep(0.5, 0.02, dt)); }
    }
    if (f.mirrors.some((m) => m.state === 'wait' && m.relB - b > -0.05 && m.relB - b < 0.5)) { const m = f.mirrors.find((q) => q.state === 'wait'); wind = Math.max(wind, sstep(0.5, 0.02, m.relB - b)); }
  }
  for (const fl of show.flags) {
    if (fl.state === 'air' && fl.owner === s && fl.kind !== 'mirror' || fl.state === 'air' && fl.kind === 'mirror' && fl.owner === s) {
      const age = b - fl.b0;
      if (age >= 0 && age < 0.9) { follow = Math.max(follow, 1 - sstep(0.12, 0.9, age)); rel = Math.max(rel ?? 0, age); if (fl.to !== s) face = { x: fracX(L, fl.x1), k: 1 - sstep(0.4, 0.9, age) }; }
    }
    if (fl.state === 'air' && fl.to === s && fl.kind !== 'mirror' && (fl.kind !== 'mine' || fl.reach)) {
      const left = fl.b0 + fl.air - b;
      if (left < 0.75 && left > -0.35) reach = { u: sstep(0.75, 0.05, left), x: fracX(L, fl.x1), left };
      if (left < 1.4 && left > -0.2) { const p = flagPose(L, G, show, fl, 0); face = { x: fracX(L, fl.x0), k: sstep(1.4, 0.7, left) * (1 - sstep(0.1, -0.2, left)) }; void p; }
    }
  }
  if (s === you && pl.drag && pl.drag.moved && wind > 0) face = { x: slotX(L, show, s) + pl.drag.dx * 1.4, k: 0.9 };
  return { wind, follow, reach, rel, face };
}
function bearerPoses(st, pl, L, G) {
  const show = pl.show, P = G.P, t = st.t, you = youOf(show), calm = st.prefs.calm, f = show.fig;
  const held = holding(show), waving = f && f.waves.length > 0;
  const xs = ENS[show.ens].xs;
  const poses = [];
  for (let s = 0; s < xs.length; s++) {
    const cx = slotX(L, show, s), n = held[s], mine = s === you;
    const up = pl.arm[s] > 0;
    const idle = Math.sin(t * 1.7 + s * 2.1) * (calm ? 0.3 : 1);
    const mo = motionOf(show, pl, L, G, s, you);
    let hr = { x: 22, y: -62 + idle * 1.5 }, hl = { x: -20, y: -58 };
    let ang = 0.06 * Math.sin(t * 1.3 + s) * (calm ? 0.3 : 1), ph = t * 3 + s;
    let lean = 0;
    const body = { crouch: 0, twist: 0, bend: 0, flex: 0, rise: 0 };
    const grip = ['relaxed', 'relaxed'];
    if (n > 0) { hr = { x: 20, y: -80 + idle * 1.5 }; grip[0] = 'fist'; }
    if (n > 1) { hl = { x: -22, y: -78 + idle * 1.5 }; grip[1] = 'fist'; }
    if (n > 0 && n < 2) hl = { x: -26 + idle, y: -62 };                 // the free hand rests at the hip, a little away from the body
    if (mo.wind > 0) {
      // loading the throw: knees bend, the shoulders turn back, the hand drops behind the hip
      const w = mo.wind;
      hr = { x: 20 + 12 * w, y: -80 + 22 * w };
      hl = { x: -22 - 8 * w, y: n > 1 ? -78 + 10 * w : -62 + 6 * w };
      body.crouch = 0.9 * w; body.twist = 0.35 * w; body.bend = 0.12 * w; body.flex = -0.06 * w;
      lean = -0.05 * w;
    }
    if (mo.follow > 0 || up) {
      // release: the arm drives up and the body rises on the toes, the other arm swings out
      const fo = Math.max(mo.follow, up ? 0.7 : 0);
      hr = { x: 14 + 4 * (1 - fo), y: -96 - 16 * fo };
      hl = { x: -22 - 16 * fo, y: n > 1 ? -84 : -66 + 12 * fo };
      grip[0] = fo > 0.55 ? 'open' : grip[0];
      body.rise = fo; body.twist = -0.2 * fo; body.flex = 0.1 * fo; body.crouch = 0;
      lean = 0.04 * fo;
    }
    if (mine && waving && n > 0 && show.cursorDown) {
      const c = clamp(show.cursor, -1, 1);
      hr = { x: 14 + c * 34, y: -96 - Math.abs(c) * 6 }; ang = c * 0.7; ph = t * 10 + c * 3; lean = c * 0.05;
      hl = { x: -20 - c * 12, y: -66 + Math.abs(c) * 8 };
      body.twist = -c * 0.3; body.bend = c * 0.14; body.crouch = 0.15 * (1 - Math.abs(c));
    }
    if (mo.reach) {
      // a flag is coming down: the hand goes to meet it, the head already there, a small crouch to absorb it
      const r = mo.reach, u = r.u;
      const tx = (r.x - cx) / (P.H / 100), ty = -94;
      hr = { x: hr.x + (tx - hr.x) * u, y: hr.y + (ty - hr.y) * u };
      grip[0] = r.left > 0.12 ? 'open' : 'fist';
      body.bend = clamp(tx / 160, -0.2, 0.2) * u; body.crouch = Math.max(body.crouch, 0.35 * sstep(0.1, -0.25, r.left));
      body.twist = Math.max(-0.3, Math.min(0.3, -tx / 220)) * u;
    }
    let yaw = 0;
    if (mo.face) { const dxm = (mo.face.x - cx) / (P.H / 1.804); yaw = -clamp(dxm * 0.3, -0.5, 0.5) * mo.face.k; }
    poses.push({ s, cx, n, mine, hr, hl, ang, ph, lean, body, grip, yaw, gaze: gazeOf(show, pl, L, G, s, t) });
  }
  return poses;
}
// The flags a bearer holds, as { design, ang, hand (0 right, 1 left), side }: the first in the right fist, a second and third in the left.
function heldSpecs(show, pl, p, you) {
  const out = [];
  for (let k = 0; k < Math.min(p.n, 3); k++) {
    const a = k === 0 ? p.ang : k === 1 ? -p.ang * 0.8 - 0.12 : 0.26;
    out.push({ design: designOf(show, p.s, k), ang: a, hand: k === 0 ? 0 : 1, side: p.s < you ? 1 : p.s > you ? -1 : (k === 1 ? -1 : 1), ph: p.ph + k * 1.3 });
  }
  return out;
}
// Presentation design of a flag: the same formula whether it is held or in the air, so a caught flag does not change its colours.
const designOf = (show, owner, rank) => (show.act + owner * 3 + rank * 2) % 8;
function flightSpecs(L, G, show, t) {
  const out = [], rank = new Map();
  const air = show.flags.filter((fl) => fl.state === 'air').sort((a, b) => a.id - b.id);
  for (const fl of show.flags) {
    const r = fl.state === 'air' ? air.filter((q) => q.owner === fl.owner && q.id < fl.id).length : 0;
    rank.set(fl.id, r);
  }
  for (const fl of show.flags) {
    const design = designOf(show, fl.owner, rank.get(fl.id));
    if (fl.state === 'air') {
      const p = flagPose(L, G, show, fl, t);
      out.push({ id: fl.id, x: p.x, y: p.y, ang: p.ang, design, side: -fl.dir, u: p.u, owner: fl.owner, to: fl.to, kind: fl.kind, age: show.b - fl.b0 });
    } else if (fl.state === 'dropped') {
      const age = show.b - fl.tEnd, u = clamp01(age / 0.5), x = fracX(L, fl.x1) + fl.dir * u * 18;
      const y = G.P.grip + (G.P.foot - G.Lf * 0.1 - G.P.grip) * u * u;
      out.push({ id: fl.id, x, y, ang: u * 1.2 * fl.dir + (u > 0.95 ? Math.PI / 2.1 * fl.dir : 0), design, side: -fl.dir, u: 1, dropped: true, owner: fl.owner, age: 9 });
    }
  }
  return out;
}
export function showFrame(st, pl, L, G, poses) {
  const show = pl.show, you = youOf(show);
  return {
    mode: 'play', w: L.w, h: L.h, t: st.t, foot: G.P.foot, H: G.P.H, calm: st.prefs.calm, beat: show.b, bpm: show.bpm, beatFlash: pl.beatFlash,
    bearers: poses.map((p) => ({ id: p.s, cx: p.cx, you: p.mine, costume: p.mine ? 0 : (p.s % 2) + 1, hands: [p.hr, p.hl], grip: p.grip, lean: p.lean, yaw: p.yaw, gaze: p.gaze, body: p.body, held: heldSpecs(show, pl, p, you) })),
    flights: flightSpecs(L, G, show, st.t), cheer: pl.cheer || null,
  };
}
function drawBearers2D(ctx, st, pl, L, G, poses, pending) {
  const show = pl.show, P = G.P, t = st.t, you = youOf(show), calm = st.prefs.calm;
  const order = [...poses].sort((a, b) => Math.abs(b.cx - L.w / 2) - Math.abs(a.cx - L.w / 2));
  for (const p of order) {
    const { s, cx, n, mine, hr, hl, ang, ph, lean } = p, u = P.H / 100;
    const hands = pending ? [{ x: cx + hr.x * u, y: P.foot + hr.y * u }, { x: cx + hl.x * u, y: P.foot + hl.y * u }] : drawBearer(ctx, cx, P.foot, P.H, { costume: mine ? 0 : (s % 2) + 1, you: mine, hands: [hr, hl], lean });
    const Lf = G.Lf, spots = [hands[0], hands[1], { x: cx, y: hands[0].y - P.H * 0.05 }];
    for (const hs of heldSpecs(show, pl, p, you)) {
      const k = hs.hand === 0 ? 0 : (hs.ang < 0.2 ? 1 : 2);
      const hnd = spots[k];
      drawFlag(ctx, hnd.x + Math.sin(hs.ang) * Lf * 0.3, hnd.y - Math.cos(hs.ang) * Lf * 0.3, Lf, hs.ang, hs.design, { ph: hs.ph, side: hs.side, calm, held: true });
    }
  }
}

// ---- guides: height ruler, drag preview, catch rings, think ghost ----------------------------------------------------------------------------
function drawRuler(ctx, st, pl, L, G, cue) {
  const P = G.P, x = L.S.x + 42;
  ctx.save();
  ctx.strokeStyle = 'rgba(255,255,255,0.45)'; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(x, P.grip); ctx.lineTo(x, apexY(G, TUNE.airMax)); ctx.stroke();
  for (let b = 2; b <= 5; b++) {
    const y = apexY(G, b), on = cue && cue.kind === 'throw' && Math.abs(cue.air - b) < 0.01, r = on ? 18 : 15;
    // a brass medallion with a lit rim
    const g = ctx.createRadialGradient(x - r * 0.3, y - r * 0.35, 1, x, y, r * 1.1);
    if (on) { g.addColorStop(0, '#fff6c8'); g.addColorStop(0.6, '#f2c14e'); g.addColorStop(1, '#a9771c'); }
    else { g.addColorStop(0, '#5a4128'); g.addColorStop(0.7, '#2c1c10'); g.addColorStop(1, '#170e07'); }
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.fill();
    ctx.lineWidth = 2.5; ctx.strokeStyle = on ? '#fff3c0' : '#d9a638'; ctx.stroke();
    txt(ctx, String(b), x, y + 1, on ? 20 : 17, on ? '#2a1d05' : PAL.text, { align: 'center', weight: 800 });
    if (on) { ctx.globalAlpha = 0.5; ctx.setLineDash([10, 10]); ctx.strokeStyle = PAL.gold; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(x + 22, y); ctx.lineTo(L.S.x + L.S.w - 24, y); ctx.stroke(); ctx.setLineDash([]); ctx.globalAlpha = 1; }
  }
  txt(ctx, 'beats', x, apexY(G, 2) + 30, 14, 'rgba(255,255,255,0.9)', { align: 'center', weight: 800, stroke: 4, strokeColor: 'rgba(13,24,48,0.7)' });
  ctx.restore();
}

function ghostThrow(ctx, st, pl, L, G, air, xFrom, xTo, label, alpha = 0.75, col = PAL.gold) {
  const P = G.P, apex = G.rise * apexFrac(air);
  ctx.save(); ctx.globalAlpha = alpha; ctx.strokeStyle = col; ctx.lineWidth = 4; ctx.setLineDash([3, 11]); ctx.lineCap = 'round';
  ctx.beginPath();
  for (let k = 0; k <= 28; k++) { const u = k / 28, x = xFrom + (xTo - xFrom) * u, y = P.grip - apex * 4 * u * (1 - u); if (k) ctx.lineTo(x, y); else ctx.moveTo(x, y); }
  ctx.stroke(); ctx.setLineDash([]);
  const mx = (xFrom + xTo) / 2, my = P.grip - apex;
  ctx.globalAlpha = alpha * 0.8; drawFlag(ctx, mx, my, G.Lf * 0.9, 0.3, 1, { ph: 0, side: 1, held: true });
  ctx.globalAlpha = alpha;
  chip(ctx, mx, my - G.Lf * 0.62, label, 22, { align: 'center', fill: 'rgba(13,24,48,0.88)', stroke: col, color: PAL.text });
  ctx.restore();
}

function drawGuides(ctx, st, pl, L, G) {
  const show = pl.show, P = G.P, you = youOf(show), yx = slotX(L, show, you);
  const cue = nextCue(show), t = st.t;
  const guides = st.prefs.guides;
  if (guides && show.fig.throws.length) drawRuler(ctx, st, pl, L, G, cue);
  if (cue && cue.kind === 'wave') {
    const near = Math.abs(cue.b - show.b) < TUNE.waveGood, x = yx + cue.side * L.S.w * 0.42 * 0.7;
    ctx.save(); ctx.globalAlpha = near ? 0.9 : 0.4;
    ctx.strokeStyle = near ? PAL.goldHi : '#ffffff'; ctx.lineWidth = near ? 8 : 5; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    const s = -cue.side, cy = P.grip - G.Lf * 0.4;
    ctx.beginPath(); ctx.moveTo(x + s * 22, cy - 40); ctx.lineTo(x - s * 22, cy); ctx.lineTo(x + s * 22, cy + 40); ctx.stroke();
    ctx.restore();
  }
  // catch rings
  for (const fl of show.flags) {
    if (fl.state !== 'air' || fl.to !== you || fl.kind === 'mirror' || (fl.kind === 'mine' && !fl.reach)) continue;
    const dt = fl.b0 + fl.air - show.b;
    if (dt > 1.3 || dt < -TUNE.catchGood) continue;
    const r = 34 + clamp(dt, 0, 1.3) * 62, near = Math.abs(dt) <= TUNE.catchGood, perf = Math.abs(dt) <= TUNE.catchPerfect;
    const hx = fracX(L, fl.x1), hy = P.grip + G.Lf * 0.1;
    ctx.save();
    if (perf) { ctx.fillStyle = 'rgba(255,240,176,0.35)'; ctx.beginPath(); ctx.arc(hx, hy, 40, 0, TAU); ctx.fill(); }
    drawRing(ctx, hx, hy, 34, 'rgba(255,255,255,0.35)', 3);
    drawRing(ctx, hx, hy, Math.max(34, r), perf ? PAL.goldHi : near ? '#8fd3ff' : '#ffffff', perf ? 7 : 4, perf ? 1 : 0.85);
    ctx.restore();
  }
  // the drag in progress
  const d = pl.drag;
  if (d && d.moved && d.up > 18 && show.fig.throws.length && guides) {
    const nAir = clamp01(d.up / P.reach), air = airOf(nAir), gold = Math.abs(air - Math.round(air)) <= TUNE.airPerfect;
    const nAim = (d.dx / L.S.w) * TUNE.aimGain;
    ghostThrow(ctx, st, pl, L, G, air, yx, yx + nAim * L.S.w, `${air.toFixed(1)} beats`, 0.95, gold ? PAL.goldHi : '#ffffff');
    ctx.save(); ctx.strokeStyle = gold ? PAL.goldHi : 'rgba(255,255,255,0.7)'; ctx.lineWidth = 5; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(d.x0, d.y0); ctx.lineTo(d.x, d.y); ctx.stroke();
    ctx.fillStyle = gold ? PAL.goldHi : '#fff'; ctx.beginPath(); ctx.arc(d.x, d.y, 14, 0, TAU); ctx.fill(); ctx.restore();
  }
  // Think (and the lesson's reveal): where the next throw should go
  const want = pl.hint || (pl.ai && (pl.ai.phase === 'reveal' || pl.ai.phase === 'think'));
  if (want && cue && cue.kind === 'throw') {
    const xt = fracX(L, ENS[show.ens].xs[slotOf(show, cue.to)]);
    ghostThrow(ctx, st, pl, L, G, cue.air, yx, xt, `throw ${cue.air}`, 0.85, PAL.good);
  }
  if (want && cue && cue.kind === 'wave') {
    const x = yx + cue.side * L.S.w * 0.22;
    ctx.save(); ctx.globalAlpha = 0.7 + 0.3 * Math.sin(t * 6);
    chip(ctx, x, P.grip - G.Lf * 0.9, cue.side < 0 ? '< sweep left' : 'sweep right >', 24, { align: 'center', fill: 'rgba(13,24,48,0.9)', stroke: PAL.good });
    ctx.restore();
  }
}

// ---- the figure card (a plan of the figure with a moving playhead) -----------------------------------------------------------------------
function drawCard(ctx, st, pl, L) {
  const P = L.play, c = P.card, show = pl.show, f = show.fig, tall = c.h > 130, compact = c.h < 100;
  panel(ctx, c, { rad: 20 });
  const pad = compact ? 14 : 18, titleSize = compact ? 22 : tall ? 30 : 26;
  txt(ctx, f.spec.name, c.x + pad, c.y + (compact ? 20 : tall ? 30 : 26), titleSize, PAL.gold, { font: DISPLAY, weight: 700, maxW: c.w * 0.55 });
  const sub = show.mode === 'practice' ? 'Practice' : `Act ${show.act}  ·  ${ENS[show.ens].name}  ·  Figure ${show.actFig + 1}/${TUNE.figsPerAct}`;
  if (!compact || c.w > 520) txt(ctx, sub, c.x + c.w - pad, c.y + (compact ? 20 : tall ? 30 : 26), compact ? 17 : 20, PAL.dim, { align: 'right', weight: 700, maxW: c.w * 0.45 });
  const tl = { x: c.x + pad + 8, y: c.y + c.h - (tall ? 54 : compact ? 34 : 40), w: c.w - pad * 2 - 16, h: tall ? 40 : compact ? 24 : 30 };
  const b0 = f.start, b1 = f.end, X = (b) => tl.x + (b - b0) / (b1 - b0) * tl.w;
  // beat ticks
  for (let b = Math.ceil(b0); b <= b1; b++) {
    const x = X(b), cnt = b - f.start < TUNE.countIn;
    ctx.strokeStyle = cnt ? 'rgba(251,241,220,0.55)' : 'rgba(251,241,220,0.22)'; ctx.lineWidth = cnt ? 2.5 : 1.5;
    ctx.beginPath(); ctx.moveTo(x, tl.y); ctx.lineTo(x, tl.y + tl.h); ctx.stroke();
  }
  ctx.strokeStyle = 'rgba(251,241,220,0.4)'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(tl.x, tl.y + tl.h / 2); ctx.lineTo(tl.x + tl.w, tl.y + tl.h / 2); ctx.stroke();
  const my = tl.y + tl.h / 2, r = tall ? 11 : 9;
  const gcol = { perfect: PAL.goldHi, good: '#8fd3ff', off: PAL.off };
  // throws: dot at release, arc to the landing ring
  for (const t of f.throws) {
    const xa = X(t.relB), xb = X(t.relB + t.air), col = t.state === 'blank' ? PAL.bad : t.grade ? gcol[t.grade] : PAL.gold;
    ctx.strokeStyle = rgba('#ffffff', 0.5); ctx.lineWidth = 2.5; ctx.beginPath(); ctx.moveTo(xa, my - r); ctx.quadraticCurveTo((xa + xb) / 2, my - tl.h * 1.15, xb, my - r); ctx.stroke();
    ctx.fillStyle = col; ctx.beginPath(); ctx.arc(xa, my, r, 0, TAU); ctx.fill();
    ctx.strokeStyle = '#0d1830'; ctx.lineWidth = 2; ctx.stroke();
    ctx.strokeStyle = col; ctx.lineWidth = 3.5; ctx.beginPath(); ctx.arc(xb, my, r, 0, TAU); ctx.stroke();
    if (t.to !== 'self') txt(ctx, t.to === 'partner' ? 'P' : t.to === 'left' ? 'L' : 'R', xb, my + 1, 13, col, { align: 'center', weight: 800 });
  }
  for (const t of f.incoming) {
    const xa = X(t.relB), xb = X(t.relB + t.air), col = '#6fd6c9';
    ctx.strokeStyle = rgba('#6fd6c9', 0.6); ctx.lineWidth = 2.5; ctx.beginPath(); ctx.moveTo(xa, my + r); ctx.quadraticCurveTo((xa + xb) / 2, my + tl.h * 1.15, xb, my + r); ctx.stroke();
    ctx.fillStyle = col; ctx.beginPath(); ctx.moveTo(xa, my - r); ctx.lineTo(xa + r, my + r * 0.7); ctx.lineTo(xa - r, my + r * 0.7); ctx.closePath(); ctx.fill();
    ctx.strokeStyle = col; ctx.lineWidth = 3.5; ctx.beginPath(); ctx.arc(xb, my, r, 0, TAU); ctx.stroke();
  }
  for (const w of f.waves) {
    const x = X(w.b), col = w.state === 'missed' ? PAL.bad : w.grade ? gcol[w.grade] : PAL.gold;
    ctx.strokeStyle = col; ctx.lineWidth = 5; ctx.lineCap = 'round'; ctx.lineJoin = 'round'; ctx.beginPath();
    const s = w.side * -1;
    ctx.moveTo(x + s * r * 0.7, my - r); ctx.lineTo(x - s * r * 0.7, my); ctx.lineTo(x + s * r * 0.7, my + r); ctx.stroke();
  }
  // count-in numerals under the first beats
  for (let n = 0; n < TUNE.countIn; n++) txt(ctx, String(n + 1), X(f.start + n) + 5, tl.y + 9, 15, PAL.cream, { align: 'left', weight: 800 });
  // playhead
  const px = X(clamp(show.b, b0, b1));
  ctx.fillStyle = '#ffffff'; ctx.beginPath(); ctx.moveTo(px, tl.y + tl.h + 4); ctx.lineTo(px - 7, tl.y + tl.h + 15); ctx.lineTo(px + 7, tl.y + tl.h + 15); ctx.closePath(); ctx.fill();
  ctx.strokeStyle = 'rgba(255,255,255,0.8)'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(px, tl.y - 2); ctx.lineTo(px, tl.y + tl.h + 4); ctx.stroke();
  if (tall) {
    ctx.font = `500 21px ${UI}`;
    const line = wrap(ctx, f.spec.tip, c.w - pad * 2)[0];
    txt(ctx, line + (line.length < f.spec.tip.length ? '…' : ''), c.x + pad, c.y + 66, 21, PAL.text, { weight: 500, maxW: c.w - pad * 2 });
  }
}

// ---- HUD ----------------------------------------------------------------------------------------------------------------------------------------
function flagIcon(ctx, x, y, r, lost) {
  ctx.save(); ctx.translate(x, y);
  ctx.strokeStyle = lost ? 'rgba(255,255,255,0.35)' : '#e9d3a0'; ctx.lineWidth = 3; ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(-r * 0.4, r); ctx.lineTo(-r * 0.4, -r); ctx.stroke();
  ctx.fillStyle = lost ? 'rgba(255,255,255,0.14)' : PAL.gules;
  ctx.beginPath(); ctx.moveTo(-r * 0.4, -r); ctx.lineTo(r * 0.9, -r * 0.55); ctx.lineTo(r * 0.45, -r * 0.1); ctx.lineTo(r * 0.9, r * 0.35); ctx.lineTo(-r * 0.4, 0); ctx.closePath(); ctx.fill();
  if (lost) { ctx.strokeStyle = PAL.bad; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(-r, -r); ctx.lineTo(r, r); ctx.stroke(); }
  ctx.restore();
}
function drawHud(ctx, st, pl, L) {
  const P = L.play, S = L.S, show = pl.show, hud = P.hud, wide = L.mode === 'wide';
  plaque(ctx, { x: hud.x - 8, y: hud.y - 16, w: hud.w + 16, h: hud.h + 16 }, 0, { studs: false, shadeTop: 0.2, shadeBot: 0.55 });
  const score = String(Math.round(show.score)).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  txt(ctx, score, P.score.x, P.score.y + 30, wide ? 44 : 52, PAL.text, { weight: 800, base: 'middle', maxW: wide ? 220 : S.w * 0.4 });
  const mult = multFor(show.flow);
  if (show.flow > 0 || mult > 1) {
    const lbl = `x${mult}   FLOW ${show.flow}`;
    chip(ctx, P.flow.x, P.flow.y, lbl, 22, { fill: mult > 1 ? 'rgba(242,193,78,0.3)' : 'rgba(251,241,220,0.12)', stroke: mult > 1 ? PAL.gold : null });
  }
  // drum, flashing on the beat
  drawDrum(ctx, P.drops.x - (wide ? 230 : 190), P.think.y + P.think.h / 2 + 2, Math.min(26, P.pause.w * 0.42), pl.beatFlash);
  if (show.mode === 'perform') {
    const r = Math.min(20, P.pause.w * 0.34), step = r * 2.5, n = TUNE.maxDrops;
    for (let i = 0; i < n; i++) flagIcon(ctx, P.drops.x - r - (n - 1 - i) * step - 8, P.drops.y, r, i < show.drops);
  } else if (show.mode === 'practice') txt(ctx, 'PRACTICE', P.drops.x - 8, P.drops.y, 20, PAL.dim, { align: 'right', weight: 800 });
  const dis = pl.mode === 'auto' || (show.thinkCool > 0 && pl.mode !== 'practice') || pl.thinkT > 0;
  if (pl.mode !== 'auto') {
    button(ctx, P.think, '', { kind: dis ? 'disabled' : 'quiet', icon: 'think', rad: P.think.h * 0.3 });
    if (show.thinkCool > 0 && pl.mode !== 'practice') {
      ctx.save(); ctx.fillStyle = 'rgba(242,193,78,0.6)'; const f = clamp01(show.thinkCool / TUNE.thinkCooldown);
      ctx.fillRect(P.think.x + 8, P.think.y + P.think.h - 8, (P.think.w - 16) * (1 - f), 4); ctx.restore();
    }
  }
  button(ctx, P.pause, '', { kind: 'quiet', icon: 'pause', rad: P.pause.h * 0.3 });
}

// ---- the coach panel: what the computer is doing in Watch and Learn ----------------------------------------------------------------------
function drawCoach(ctx, st, pl, L) {
  const P = L.play, ai = pl.ai, sh = pl.show, c = P.coach, f = sh.fig;
  panel(ctx, c, { rad: 20 });
  const pad = 20, hasBtn = ai.phase === 'think' || ai.phase === 'reveal', tw = c.w - pad * 2 - (hasBtn ? P.skip.w + 10 : 0), strip = c.h < 110;
  const cue = nextCue(sh);
  const what = !cue ? '' : cue.kind === 'throw'
    ? `Release on beat ${Math.round(cue.b - f.start + 1)} of the figure, drag ${cue.air} beats high${cue.to !== 'self' ? ` and aim at the ${cue.to === 'partner' ? 'partner' : cue.to + ' bearer'}` : ''}.`
    : cue.kind === 'wave' ? 'Sweep the flag to the side that is marked, turning on each beat.' : 'Tap as the flag reaches the hands.';
  const head = ai.phase === 'think' ? `THINK  ${Math.ceil(Math.max(0, st.prefs.thinkSec - ai.t))}` : ai.phase === 'reveal' ? 'REVEAL' : 'WATCHING';
  const hcol = ai.phase === 'think' ? PAL.gold : ai.phase === 'reveal' ? '#8fd3ff' : PAL.dim;
  if (strip) {
    txt(ctx, head, c.x + pad, c.y + c.h * 0.3, 22, hcol, { weight: 800 });
    ctx.font = `600 20px ${UI}`;
    const msg = hasBtn ? `${f.spec.name}: ${f.spec.tip}` : 'The computer performs the figure; watch the ghost lines.';
    wrap(ctx, msg, tw - 130).slice(0, 2).forEach((ln, k) => txt(ctx, ln, c.x + pad + 130, c.y + c.h * 0.3 + k * 26, 20, PAL.text, { weight: 600 }));
    if (hasBtn) button(ctx, P.skip, 'Next', { kind: 'primary', size: 22, icon: 'skip' });
    return;
  }
  txt(ctx, head, c.x + pad, c.y + 30, 24, hcol, { weight: 800 });
  const size = c.h > 140 ? 24 : 20;
  ctx.font = `600 ${size}px ${UI}`;
  const msg = ai.phase === 'think' ? `${f.spec.name}. ${f.spec.tip}` : ai.phase === 'reveal' ? `${what}` : 'The computer performs the figure. The dotted ghost is the path it chose.';
  wrap(ctx, msg, tw).slice(0, 3).forEach((ln, k) => txt(ctx, ln, c.x + pad, c.y + 66 + k * (size + 8), size, PAL.text, { weight: 600 }));
  if (ai.phase === 'think') {
    ctx.fillStyle = 'rgba(251,241,220,0.16)'; rrect(ctx, { x: c.x + pad, y: c.y + c.h - 16, w: tw, h: 5 }, 3); ctx.fill();
    ctx.fillStyle = PAL.gold; rrect(ctx, { x: c.x + pad, y: c.y + c.h - 16, w: Math.max(5, tw * clamp01(ai.t / st.prefs.thinkSec)), h: 5 }, 3); ctx.fill();
  }
  if (hasBtn) button(ctx, P.skip, 'Next', { kind: 'primary', size: 24, icon: 'skip' });
}

// ---- the whole show screen ----------------------------------------------------------------------------------------------------------------------
export function renderPlay(ctx, st, L, view, meta, pauseItems) {
  const pl = st.pl;
  if (!pl) return;
  const { w, h } = L, G = geom(L), P = G.P, sh = pl.show, t = st.t;
  meta.previewBadge = { x: L.S.x + L.S.w / 2, y: P.card.y + P.card.h + 8, align: 'center' };
  ctx.save();
  if (pl.shake > 0 && !st.prefs.calm) ctx.translate(Math.sin(t * 70) * 5 * pl.shake, Math.cos(t * 83) * 4 * pl.shake);
  const S3 = globalThis.__show3d;
  const poses = bearerPoses(st, pl, L, G);
  let live = false;
  if (S3 && S3.render) {
    const r = S3.render(ctx, showFrame(st, pl, L, G, poses));
    live = !!r;
  }
  if (!live) {
    drawBackdrop(ctx, w + 20, h + 20, P.floorY);
    if (pl.beatFlash > 0) { ctx.fillStyle = `rgba(255,236,170,${0.10 * pl.beatFlash})`; ctx.fillRect(0, P.floorY, w, h - P.floorY); }
  }
  drawGuides(ctx, st, pl, L, G);
  if (!live && !(S3 && S3.pending)) {
    for (const p of poses) drawBearerGround(ctx, p.cx, P.foot, P.H, { you: p.mine });
    drawBearers2D(ctx, st, pl, L, G, poses, false);
    drawFlight(ctx, st, pl, L, G);
  }
  drawParticles(ctx, pl.parts);
  for (const p of pl.pops) {
    const u = p.age / 0.9, a = u < 0.15 ? u / 0.15 : 1 - Math.max(0, (u - 0.6) / 0.4);
    ctx.save(); ctx.globalAlpha = clamp01(a);
    txt(ctx, p.text, p.x, p.y - u * 56, p.size, p.col, { align: 'center', weight: 800, font: DISPLAY, stroke: 8, maxW: w * 0.5, strokeColor: 'rgba(13,24,48,0.9)' });
    ctx.restore();
  }
  // count-in numerals
  if (pl.count) {
    const u = pl.count.t / 0.6, a = 1 - clamp01((u - 0.5) / 0.5), sc = 1 + 0.5 * (1 - clamp01(u * 3));
    ctx.save(); ctx.globalAlpha = a; ctx.translate(P.banner.x, P.banner.y + 60); ctx.scale(sc, sc);
    txt(ctx, pl.count.text, 0, 0, pl.count.text === 'GO' ? 120 : 170, PAL.goldHi, { align: 'center', weight: 800, stroke: 12, strokeColor: 'rgba(13,24,48,0.85)' });
    ctx.restore();
  }
  ctx.restore();
  drawHud(ctx, st, pl, L);
  drawCard(ctx, st, pl, L);
  if (pl.ai) drawCoach(ctx, st, pl, L);
  else if (pl.thinkT > 0) {
    ctx.save(); ctx.globalAlpha = 0.92;
    chip(ctx, L.S.x + L.S.w / 2, P.skyTop + 12, 'THINK: the drum slows. Follow the ghost.', 24, { align: 'center', fill: 'rgba(13,24,48,0.88)', stroke: '#8fd3ff' });
    ctx.restore();
  }
  if (pl.banner) {
    const b = pl.banner, u = b.t / 2, a = u < 0.12 ? u / 0.12 : u > 0.75 ? 1 - (u - 0.75) / 0.25 : 1;
    const x = P.banner.x, y = P.banner.y, sc = 0.9 + 0.1 * clamp01(u * 5);
    ctx.save(); ctx.globalAlpha = clamp01(a); ctx.translate(x, y); ctx.scale(sc, sc);
    const bw = Math.min(w - 60, 560), bh = b.sub ? 150 : 110;
    plaque(ctx, { x: -bw / 2, y: -62, w: bw, h: bh }, 26, { shadeTop: 0.35, shadeBot: 0.6 });
    txt(ctx, b.text, 0, -8, 60, PAL.gold, { align: 'center', font: DISPLAY, weight: 700, stroke: 8, strokeColor: 'rgba(13,24,48,0.9)', maxW: bw - 40 });
    if (b.sub) txt(ctx, b.sub, 0, 54, 28, PAL.text, { align: 'center', weight: 700, maxW: bw - 40 });
    ctx.restore();
  }
  if (pl.paused) renderPauseMenu(ctx, st, L, pauseItems(pl));
}

function renderPauseMenu(ctx, st, L, items) {
  const M = menuRects(L, items.length);
  ctx.fillStyle = 'rgba(6,12,28,0.66)'; ctx.fillRect(0, 0, L.w, L.h);
  panel(ctx, M.panel, {});
  txt(ctx, 'Paused', M.panel.x + M.panel.w / 2, M.panel.y + 62, 54, PAL.gold, { align: 'center', font: DISPLAY, weight: 700, stroke: 7, strokeColor: 'rgba(13,24,48,0.9)' });
  const labels = { resume: 'Resume', restart: 'Start again', rules: 'Rules', quit: 'Leave the show' };
  items.forEach((it, i) => button(ctx, M.btns[i], labels[it] ?? it, { kind: it === 'resume' ? 'primary' : 'ghost', size: 32 }));
}
