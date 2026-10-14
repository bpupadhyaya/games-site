// Drawing of the playing screen: the room, the hands and bags in flight, catch rings, the HUD and the phase banners.
import { PAL, DISPLAY, drawRoom, drawHands, drawBag, drawParticles, clamp, ease } from './art.js';
import { txt, button, panel, rrect, icon } from './ui.js';
import { DWELL, PATTERNS, SONG, SONG_EN, comboMult, HAND_NAMES } from './pattern.js';
import { stageCam } from './layout.js';
import { drawCredit } from './brand.js';

const TAU = Math.PI * 2;
export const GRADE_TEXT = { perfect: 'PERFECT', great: 'GREAT', good: 'GOOD', miss: 'DROP', stray: 'STRAY' };
export const GRADE_COL = { perfect: '#ffe07a', great: '#9cf0dc', good: '#a9c4ff', miss: '#ff8aa0', stray: '#c8c8d8' };
const FALL_G = 7;                              // beats^-2: how fast a dropped bag falls (in tosses' own units)

const handX = (cam, hand) => (hand === 0 ? cam.xL : hand === 1 ? cam.xR : cam.xC);
const tossHeight = (cam, v) => Math.min(cam.hMax, cam.hMax * 0.19 * (v - DWELL));

// How far a hand is raised (+) or pressed down (-), in screen units, at beat position `bt`: it rises into each toss and gives way as a bag
// lands. Bags resting in the hand and the start of a flight are offset by it so the picture always agrees.
export function handLift(pl, cam, hand, bt) {
  const A = cam.bag * 0.5;
  let lift = 0;
  for (const list of pl.pat.bags) {
    for (let i = 0; i < list.length; i++) {
      const th = list[i];
      if (th.j0 > bt + 0.2) break;
      if (th.hand === hand) {
        const d = bt - th.j0;
        if (d > -0.14 && d < 0.2) lift = Math.max(lift, A * Math.sin(Math.PI * (d + 0.14) / 0.34));
      }
      if (th.j1 % 2 === hand && th.ev && th.ev.j && th.ev.j !== 'miss') {
        const dc = bt - (th.j1 - DWELL);
        if (dc >= 0 && dc < 0.3) lift -= A * 0.55 * Math.sin(Math.PI * dc / 0.3);
      }
    }
  }
  return lift;
}

// Where a bag is at beat position `bt`. Returns { x, y, rot, sq, hand, rest, air }  (rest: sits in a hand; air: 0..1 height share).
function bagPose(pl, cam, bi, bt, lifts) {
  const list = pl.pat.bags[bi];
  let th = null, k = -1;
  for (let i = 0; i < list.length; i++) { if (list[i].j0 <= bt) { th = list[i]; k = i; } else break; }
  const restY = cam.handY - cam.bag * 0.34;
  if (!th) { const h = list[0].hand; return { x: handX(cam, h), y: restY - lifts[h], rot: 0, sq: 0, hand: h, rest: true, air: 0 }; }
  const catchB = th.j1 - DWELL, landHand = th.j1 % 2, dir = th.hand === 0 ? 1 : -1;
  const ev = th.ev;
  const T = Math.max(0.2, catchB - th.j0);
  if (bt < catchB) {
    const u = (bt - th.j0) / T, H = tossHeight(cam, th.v), x0 = handX(cam, th.hand), x1 = handX(cam, landHand);
    let x = x0 + (x1 - x0) * u;
    if (x0 === x1) x += dir * cam.bag * 0.7 * Math.sin(Math.PI * u);
    const air = 4 * u * (1 - u);
    const lr = th.j0 > 0 ? handLift(pl, cam, th.hand, th.j0) : 0;
    return { x, y: restY - H * air - lr * (1 - u) * (1 - u), rot: dir * th.v * 1.15 * u * Math.PI * 0.5 + th.bag, sq: 0, hand: -1, rest: false, air };
  }
  // the bag has reached the hand
  const dt = bt - catchB;
  if (ev.j && ev.j !== 'miss') {
    return { x: handX(cam, landHand), y: restY - lifts[landHand], rot: 0, sq: Math.max(0, 1 - dt / 0.3) * 0.9, hand: landHand, rest: true, air: 0 };
  }
  // not caught (yet): it keeps falling past the hand, then lies on the mat beside it
  const H = tossHeight(cam, th.v), vy = (4 * H) / T, x1 = handX(cam, landHand);
  const drop = vy * dt + 0.5 * (8 * H / (T * T)) * dt * dt;
  const floor = cam.floorY - restY;
  const out = (landHand === 0 ? -1 : 1) * cam.bag * 0.35;
  if (drop >= floor) {
    const tb = dt - Math.max(0, (-vy + Math.sqrt(vy * vy + 2 * (8 * H / (T * T)) * floor)) / (8 * H / (T * T)));
    const bounce = Math.abs(Math.sin(tb * 9)) * Math.exp(-tb * 7) * cam.bag * 0.5;
    return { x: x1 + out * Math.min(1, 0.3 + tb * 4), y: cam.floorY - bounce, rot: 0.5 * (landHand ? 1 : -1), sq: 0, hand: -1, rest: false, air: 0, lying: true };
  }
  return { x: x1 + out * (drop / floor), y: restY + drop, rot: 0.4 * dt * (landHand ? 1 : -1) + th.bag, sq: 0, hand: -1, rest: false, air: 0 };
}
export const _bagPose = bagPose;

// ---- the stage ------------------------------------------------------------------------------------------------------------------
function ringFor(ctx, cam, ev, lead, lit, num, fade) {
  const x = handX(cam, ev.hand), y = ev.kind === 'clap' ? cam.handY - cam.bag * 1.5 : cam.handY - cam.bag * 0.34;
  const base = cam.bag * (ev.kind === 'clap' ? 0.7 : 0.66), k = clamp(lead / 1.25, 0, 1), r = base + cam.bag * 0.95 * ease(k);
  const col = ev.kind === 'clap' ? '#9cf0dc' : '#ffd77a';
  ctx.save(); ctx.globalAlpha = clamp((1.35 - k * 0.9) * fade, 0, 1) * (lit ? 1 : 0.85);
  ctx.lineWidth = lit ? 7 : 4.5; ctx.strokeStyle = lit ? '#fff3b0' : col;
  if (lit) { ctx.shadowColor = '#ffe07a'; ctx.shadowBlur = 18; }
  ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.stroke();
  if (ev.kind === 'clap') icon(ctx, 'clap', x, y, cam.bag * 0.24, col);
  ctx.restore();
  if (num) txt(ctx, String(num), x, y - base - cam.bag * 0.7, 30, '#fff3b0', { align: 'center', font: DISPLAY, stroke: 6 });
}

export function drawStage(ctx, w, h, st, pl, stage, time) {
  const cam = stageCam(stage), bt = pl.t / pl.beatDur;
  const excite = clamp(pl.flow * 0.6 + Math.min(pl.chain, 24) / 40, 0, 1);
  drawRoom(ctx, w, h, time, { horizon: cam.horizon }, pl.pulse, excite);
  const lifts = [handLift(pl, cam, 0, bt), handLift(pl, cam, 1, bt)];
  const poses = pl.pat.bags.map((_, bi) => bagPose(pl, cam, bi, bt, lifts));
  // bags resting in the same hand are stacked a little so none hides another
  const used = [0, 0];
  poses.forEach((p) => { if (p.rest) { const n = used[p.hand]++; p.y -= n * cam.bag * 0.3; p.x += (n % 2 ? 1 : -1) * n * cam.bag * 0.1; } });
  // soft shadows on the mats
  poses.forEach((p) => {
    const hgt = clamp((cam.handY - p.y) / cam.hMax, 0, 1);
    ctx.fillStyle = `rgba(20,14,6,${0.32 - hgt * 0.18})`; ctx.beginPath();
    ctx.ellipse(p.x, cam.floorY + cam.bag * 0.12, cam.bag * (0.5 - hgt * 0.22), cam.bag * 0.13, 0, 0, TAU); ctx.fill();
  });
  // hands (they move together a little on a clap). The 3D performer, when available, is drawn here; the bags go on top.
  const pull = pl.clapT > 0 ? Math.sin(Math.min(1, pl.clapT) * Math.PI) : 0;
  let look = null;
  for (const p of poses) if (!p.rest && !p.lying && p.air > 0.04 && (!look || p.y < look.y)) look = { x: p.x, y: p.y };
  drawHands(ctx, {
    t: time, paused: !!pl.paused, bag: cam.bag, handY: cam.handY, bottom: cam.bottom, xC: cam.xC, pull, look,
    bags: poses.map((p) => ({ x: p.x, y: p.y, held: p.rest ? p.hand : -1, lying: !!p.lying })),
    hands: [0, 1].map((hnd) => ({ x0: handX(cam, hnd), x: handX(cam, hnd) + (hnd === 0 ? 1 : -1) * pull * (cam.xC - cam.xL) * 0.42, lift: lifts[hnd], press: pl.press[hnd] })),
  });
  // fabrics: the cloths the player owns, in turn
  const fab = (bi) => pl.fabrics[(bi + pl.ri) % pl.fabrics.length];
  // lying bags first, then resting, then flying (so a flying bag is always on top)
  const order = poses.map((p, bi) => ({ p, bi, z: p.lying ? 0 : p.rest ? 1 : 2 })).sort((a, b) => a.z - b.z);
  const lit = pl.reveal;
  for (const { p, bi } of order) {
    // dim a bag that is up high only a touch, for depth
    drawBag(ctx, p.x, p.y, cam.bag, p.rot, fab(bi), p.sq);
  }
  // catch rings for what is coming up
  let shown = 0;
  for (const ev of pl.events) {
    if (ev.j) continue;
    const lead = ev.b - bt;
    const isLit = lit && lit.includes(ev.i);
    if (isLit) { ringFor(ctx, cam, ev, clamp(lead, 0, 1.25), true, lit.indexOf(ev.i) + 1, 1); continue; }
    if (lead < -0.3) continue;
    if (lead > 1.25 || shown >= 3) break;
    shown += 1;
    ringFor(ctx, cam, ev, Math.max(0, lead), false, 0, pl.auto && pl.auto.phase !== 'act' ? 0.2 : 1);
  }
  drawParticles(ctx, pl.parts);
  // grade popups above the hand they belong to
  for (const p of pl.pops) {
    const a = 1 - p.age / 0.85, rise = ease(p.age / 0.85) * 54;
    ctx.save(); ctx.globalAlpha = clamp(a * 1.4, 0, 1);
    txt(ctx, p.text, clamp(handX(cam, p.hand), stage.x + 90, stage.x + stage.w - 90), cam.handY - cam.bag * 1.3 - rise, p.size, p.col, { align: 'center', font: DISPLAY, stroke: 7 });
    ctx.restore();
  }
  return cam;
}

// ---- HUD ---------------------------------------------------------------------------------------------------------------------------
function flowBar(ctx, r, v) {
  ctx.fillStyle = 'rgba(10,12,34,0.7)'; rrect(ctx, r, r.h / 2); ctx.fill();
  const g = ctx.createLinearGradient(r.x, 0, r.x + r.w, 0);
  g.addColorStop(0, '#d9432e'); g.addColorStop(0.5, '#ffd77a'); g.addColorStop(1, '#9cf0dc');
  ctx.fillStyle = g; rrect(ctx, { x: r.x, y: r.y, w: Math.max(r.h, r.w * clamp(v, 0, 1)), h: r.h }, r.h / 2); ctx.fill();
  ctx.lineWidth = 2; ctx.strokeStyle = 'rgba(255,240,220,0.3)'; rrect(ctx, r, r.h / 2); ctx.stroke();
}
function modeLabel(pl) { return pl.mode === 'learn' ? 'LEARN' : pl.mode === 'auto' ? 'WATCH AND LEARN' : 'PERFORM'; }
const catchesDone = (pl) => pl.events.filter((e) => e.j).length;

export function drawHud(ctx, st, pl, P, L) {
  const cfg = PATTERNS[pl.ri], mult = comboMult(pl.chain), done = catchesDone(pl), tot = pl.events.length;
  if (L.mode === 'wide') {
    panel(ctx, P.left, { rad: 24 }); panel(ctx, P.right, { rad: 24 });
    const x = P.score.x, w = P.score.w;
    let y = P.score.y;
    txt(ctx, modeLabel(pl), x, y + 12, 17, PAL.gold, { weight: 800, maxW: w });
    txt(ctx, cfg.name, x, y + 40, 26, PAL.text, { weight: 700, maxW: w });
    y += 84;
    txt(ctx, String(Math.round(pl.score)), x, y + 24, 54, PAL.cream, { weight: 800, font: DISPLAY, maxW: w });
    y += 76;
    txt(ctx, `Chain ${pl.chain}`, x, y, 26, PAL.text, { weight: 700 });
    txt(ctx, `x${mult}`, x + w, y, 34, mult > 1 ? PAL.gold : PAL.dim, { align: 'right', weight: 800 });
    y += 46;
    txt(ctx, 'FLOW', x, y, 17, PAL.dim, { weight: 700 });
    flowBar(ctx, { x, y: y + 18, w, h: 20 }, pl.flow);
    y += 70;
    txt(ctx, `Catch ${Math.min(done + 1, tot)} / ${tot}`, x, y, 22, PAL.dim, { weight: 600 });
    y += 44;
    for (const g of ['perfect', 'great', 'good', 'miss']) { txt(ctx, GRADE_TEXT[g], x, y, 19, GRADE_COL[g], { weight: 700 }); txt(ctx, String(pl.counts[g]), x + w, y, 22, PAL.text, { align: 'right', weight: 800 }); y += 34; }
    // right card: the next catches in order
    txt(ctx, 'NEXT', P.info.x, P.info.y + 12, 17, PAL.gold, { weight: 800 });
    nextCard(ctx, P.info, pl);
  } else {
    const S = P.score;
    panel(ctx, { x: S.x - 4, y: S.y, w: S.w + 4, h: S.h }, { rad: 22 });
    txt(ctx, modeLabel(pl) + '  ·  ' + cfg.name, S.x + 16, S.y + 22, 18, PAL.gold, { weight: 800, maxW: S.w - 32 });
    txt(ctx, String(Math.round(pl.score)), S.x + 16, S.y + 62, 46, PAL.cream, { weight: 800, font: DISPLAY, maxW: S.w * 0.5 });
    txt(ctx, `Chain ${pl.chain}`, S.x + S.w - 16 - 70, S.y + 52, 22, PAL.text, { align: 'right', weight: 700 });
    txt(ctx, `x${mult}`, S.x + S.w - 16, S.y + 52, 32, mult > 1 ? PAL.gold : PAL.dim, { align: 'right', weight: 800 });
    flowBar(ctx, { x: S.x + 16, y: S.y + S.h - 30, w: S.w - 32, h: 16 }, pl.flow);
    txt(ctx, `${Math.min(done + 1, tot)}/${tot}`, S.x + S.w - 16, S.y + 22, 18, PAL.dim, { align: 'right', weight: 600 });
  }
  button(ctx, P.pause, '', { icon: 'pause', kind: 'quiet', rad: P.pause.h * 0.3 });
  if (pl.mode === 'learn') button(ctx, P.hint, L.mode === 'wide' ? 'Hint' : '', { icon: 'bulb', kind: pl.hint ? 'on' : 'quiet', rad: P.hint.h * 0.3 });
  else if (pl.mode === 'auto' && L.mode !== 'wide') button(ctx, P.hint, '', { icon: 'eye', kind: 'disabled', rad: P.hint.h * 0.3 });
}
function nextCard(ctx, r, pl) {
  const next = pl.events.filter((e) => !e.j).slice(0, 5);
  let y = r.y + 50;
  next.forEach((e, i) => {
    const cw = r.w, col = e.kind === 'clap' ? PAL.tealHi : PAL.gold;
    ctx.fillStyle = 'rgba(255,240,220,0.08)'; rrect(ctx, { x: r.x, y: y - 22, w: cw, h: 44 }, 14); ctx.fill();
    icon(ctx, e.kind === 'clap' ? 'clap' : e.hand === 0 ? 'left' : 'right', r.x + 28, y, 12, col);
    txt(ctx, e.kind === 'clap' ? 'Clap' : e.hand === 0 ? 'Left hand' : 'Right hand', r.x + 54, y, 20, i === 0 ? PAL.text : PAL.dim, { weight: i === 0 ? 800 : 600, maxW: cw - 64 });
    y += 52;
  });
}

// ---- a whole playing frame ---------------------------------------------------------------------------------------------------------
export function renderPlay(ctx, st, L, view, meta, pauseItems, drawPauseMenu) {
  const w = view?.width ?? meta.width, h = view?.height ?? meta.height, pl = st.pl, P = L.play;
  if (!pl) return;
  const shake = pl.shake > 0 && !st.prefs.calm ? Math.sin(pl.clock * 90) * pl.shake * 5 : 0;
  ctx.save(); ctx.translate(shake, 0);
  const cam = drawStage(ctx, w, h, st, pl, P.stage, st.t);
  ctx.restore();
  drawHud(ctx, st, pl, P, L);
  const cx = P.stage.x + P.stage.w / 2, cy = P.stage.y + P.stage.h * 0.2;
  // the counting song: the newest word of the chain, big and brief
  if (pl.songT < 0.7 && pl.songWord !== null && st.prefs.song) {
    const a = clamp(1 - pl.songT / 0.7, 0, 1), s = 1 + (1 - clamp(pl.songT / 0.15, 0, 1)) * 0.35;
    ctx.save(); ctx.globalAlpha = a;
    txt(ctx, SONG[pl.songWord], cx, P.stage.y + P.stage.h * 0.3, 92 * s, PAL.cream, { align: 'center', font: DISPLAY, stroke: 12, maxW: P.stage.w - 40 });
    txt(ctx, SONG_EN[pl.songWord], cx, P.stage.y + P.stage.h * 0.3 + 62, 26, PAL.gold, { align: 'center', weight: 700, stroke: 6 });
    ctx.restore();
  }
  // count-in numbers
  const bt = pl.t / pl.beatDur;
  if (bt < 0 && !(pl.auto && pl.auto.phase !== 'act')) {
    const n = Math.ceil(-bt), f = (-bt) % 1;
    ctx.save(); ctx.globalAlpha = 0.5 + 0.5 * f;
    txt(ctx, String(n), cx, cy + 60, 120 * (0.8 + 0.4 * f), PAL.gold, { align: 'center', font: DISPLAY, stroke: 10 });
    ctx.restore();
  }
  if (pl.auto && (pl.auto.phase === 'think' || pl.auto.phase === 'reveal')) {
    const a = pl.auto, think = a.phase === 'think';
    const bw = Math.min(P.stage.w - 40, 580), bh = 132, r = { x: cx - bw / 2, y: P.stage.y + 12, w: bw, h: bh };
    panel(ctx, r, { fill: 'rgba(10,14,40,0.88)', stroke: think ? 'rgba(255,214,120,0.6)' : 'rgba(156,240,220,0.7)' });
    txt(ctx, think ? 'THINK' : 'REVEAL', r.x + 24, r.y + 32, 30, think ? PAL.gold : PAL.tealHi, { font: DISPLAY });
    txt(ctx, (Math.ceil(a.timer * 10) / 10).toFixed(1) + ' s', r.x + r.w - 24, r.y + 32, 30, PAL.text, { align: 'right', weight: 800 });
    txt(ctx, think ? 'Reading the next phrase...' : 'Plan for the next phrase:', r.x + 24, r.y + 70, 22, PAL.dim, { weight: 600, maxW: bw - 48 });
    txt(ctx, a.names.join('  >  '), r.x + 24, r.y + 104, 22, PAL.text, { weight: 700, maxW: bw - 48 });
  }
  if (pl.hint) {
    const bw = Math.min(P.stage.w - 40, 580), r = { x: cx - bw / 2, y: P.stage.y + 12, w: bw, h: 100 };
    panel(ctx, r, { fill: 'rgba(10,14,40,0.88)', stroke: 'rgba(255,224,122,0.7)' });
    txt(ctx, 'HINT', r.x + 24, r.y + 30, 26, PAL.gold, { font: DISPLAY });
    txt(ctx, pl.hint.names.join('  >  '), r.x + 24, r.y + 70, 22, PAL.text, { weight: 700, maxW: bw - 48 });
  }
  if (pl.banner) {
    const b = pl.banner, a = clamp(Math.min(b.t / 0.15, (1.5 - b.t) / 0.4), 0, 1);
    ctx.save(); ctx.globalAlpha = a;
    txt(ctx, b.text, cx, P.stage.y + P.stage.h * 0.14 + (pl.auto && pl.auto.phase !== 'act' ? 150 : 0), 54, PAL.gold, { align: 'center', font: DISPLAY, stroke: 9, maxW: P.stage.w - 40 });
    ctx.restore();
  }
  // quiet pad labels at the very bottom of the stage: where the three tap zones are
  if (!pl.paused && !pl.over && pl.mode !== 'auto') {
    const y = cam.bottom - 20, fa = 0.5;
    ctx.save(); ctx.globalAlpha = fa;
    txt(ctx, 'LEFT', cam.xL, y, 17, PAL.text, { align: 'center', weight: 800, stroke: 4 });
    txt(ctx, 'CLAP', cam.xC, y, 17, PAL.text, { align: 'center', weight: 800, stroke: 4 });
    txt(ctx, 'RIGHT', cam.xR, y, 17, PAL.text, { align: 'center', weight: 800, stroke: 4 });
    ctx.restore();
  }
  if (pl.paused || pl.over) drawPauseMenu(ctx, st, L, pauseItems(pl), pl);
}
export { HAND_NAMES };
