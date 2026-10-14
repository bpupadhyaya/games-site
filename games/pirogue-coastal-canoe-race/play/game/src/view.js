// The play screen: the sea (full screen), the boats, and the thin HUD. Pure drawing from `state` and the layout; game.js owns state.
import { drawWorld, drawFoam, drawPirogue, toScreen } from './art.js';
import { upcoming, progress, PERFECT, CW } from './sim.js';
import { fmtTime, ordinal } from './match.js';
import { FONT, DISPLAY, C, roundPath, paintButton, wrapLines, textShadow, panel } from './ui.js';
import { host } from './layout.js';
import { v3 } from './v3.js';

const TAU = Math.PI * 2;
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

// scene = { race, cam, t, parts, trails, mineLane }
export function drawSea(ctx, L, scene) {
  if (v3.on && v3.fade >= 1) return;                 // the WebGL sea is showing: the 2D HUD draws on a transparent canvas
  ctx.save(); if (v3.on) ctx.globalAlpha = 1 - v3.fade;
  drawSea2d(ctx, L, scene);
  ctx.restore();
}
function drawSea2d(ctx, L, scene) {
  drawWorld(ctx, L.w, L.h, { sea: scene.race.sea, cam: scene.cam, t: scene.t, t0: scene.t0, mineLane: scene.mineLane });
  drawFoam(ctx, L.w, L.h, { cam: scene.cam, trails: scene.trails, parts: scene.parts });
  const { race, cam } = scene;
  // far boats first
  const order = race.boats.map((b, i) => i).sort((a, b) => (race.boats[b].s - race.boats[a].s) * cam.dir * -1);
  for (const i of order) {
    const b = race.boats[i];
    const p = toScreen(cam, b.s, b.y);
    if (p.y < -160 || p.y > L.h + 160 || p.x < -160 || p.x > L.w + 160) continue;
    // the camera follows the heading: during the turn the picture rotates round the buoy and the hull stays upright on screen
    let lift = 0;
    for (const w of race.sea.waves) { const c = w.c0 - CW * scene.t0; const d = c - b.s; if (d < -6) continue; if (d > 6) break; lift += w.h * Math.exp(-(d * d) / 6); }
    drawPirogue(ctx, { lift, x: p.x, y: p.y, ang: b.hd, ppm: cam.ppm, pal: race.pal[i], roll: b.roll, v: b.v, tSince: b.tSince, lastSide: b.lastSide, swamp: b.swamp, ride: b.ride, id: i, t: scene.t });
  }
}

const sec = (t) => (Math.round(t * 10) / 10).toFixed(1);

function pad(ctx, r, label, sub, state, side, flash, glow) {
  const { dy } = paintButton(ctx, r, { dark: true });
  ctx.save();
  const cx = r.x + r.w / 2, cy = r.y + dy + r.h / 2 + 12, rad = Math.min(r.h * 0.3, 38);
  const b = state.race.boats[0];
  const f = clamp(b.tSince / 1.0, 0, 1);
  // ring: grey track, early part, in-time arc, perfect arc, sweeping hand
  ctx.lineWidth = 9; ctx.lineCap = 'butt';
  const arc = (a0, a1, col) => { ctx.strokeStyle = col; ctx.beginPath(); ctx.arc(cx, cy, rad, -Math.PI / 2 + a0 * TAU, -Math.PI / 2 + a1 * TAU); ctx.stroke(); };
  arc(0, 1, 'rgba(255,255,255,0.18)');
  arc(0.5, 0.78, 'rgba(120,230,160,0.55)');
  arc(PERFECT[0], PERFECT[1], '#7dffb0');
  const hx = cx + Math.cos(-Math.PI / 2 + f * TAU) * rad, hy = cy + Math.sin(-Math.PI / 2 + f * TAU) * rad;
  ctx.fillStyle = f > 0.78 ? '#ff9a6a' : f >= 0.5 ? '#ffffff' : '#cfe6f5';
  ctx.beginPath(); ctx.arc(hx, hy, 9, 0, TAU); ctx.fill();
  if (flash > 0) { ctx.strokeStyle = `rgba(255,255,255,${flash})`; ctx.lineWidth = 4; ctx.beginPath(); ctx.arc(cx, cy, rad + 10 + (1 - flash) * 16, 0, TAU); ctx.stroke(); }
  if (glow) { ctx.strokeStyle = '#ffd36a'; ctx.lineWidth = 5; roundPath(ctx, r.x + 5, r.y + dy + 5, r.w - 10, r.h - 10, 14); ctx.stroke(); }
  ctx.fillStyle = '#fff8ea'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.font = `800 ${Math.round(rad * 0.9)}px ${FONT}`;
  ctx.fillText(label, cx, cy + 1);
  ctx.font = `700 ${Math.round(clamp(r.h * 0.17, 16, 22))}px ${FONT}`; ctx.globalAlpha = 0.9;
  ctx.fillText(sub, cx, r.y + dy + 22);
  ctx.restore();
}

function mapStrip(ctx, L, state) {
  const P = L.play, r = P.map, race = state.race;
  panel(ctx, r.x, r.y, r.w, r.h, { r: 18, fill: 'rgba(6,32,44,0.62)', stroke: 'rgba(255,255,255,0.35)', shadow: false });
  const x0 = r.x + 34, x1 = r.x + r.w - 34, cy = r.y + r.h / 2;
  ctx.strokeStyle = 'rgba(255,255,255,0.45)'; ctx.lineWidth = 4; ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(x0, cy); ctx.lineTo(x1, cy); ctx.stroke();
  // beach at both ends, buoy in the middle
  ctx.fillStyle = '#f1d9a4'; roundPath(ctx, x0 - 22, cy - 13, 18, 26, 6); ctx.fill(); roundPath(ctx, x1 + 4, cy - 13, 18, 26, 6); ctx.fill();
  const bx = (x0 + x1) / 2;
  ctx.fillStyle = '#ffffff'; ctx.beginPath(); ctx.arc(bx, cy, 9, 0, TAU); ctx.fill(); ctx.fillStyle = '#f26a21'; ctx.beginPath(); ctx.arc(bx, cy, 5, 0, TAU); ctx.fill();
  const pals = race.pal;
  for (let k = race.boats.length - 1; k >= 0; k--) {
    const b = race.boats[k], p = b.done ? 1 : progress(race.sea, b), x = x0 + (x1 - x0) * clamp(p, 0, 1);
    const mine = k === 0;
    ctx.fillStyle = pals[k].main; ctx.beginPath(); ctx.arc(x, cy, mine ? 12 : 9, 0, TAU); ctx.fill();
    ctx.lineWidth = mine ? 3.5 : 2; ctx.strokeStyle = mine ? '#ffffff' : 'rgba(255,255,255,0.7)'; ctx.stroke();
  }
}

function heel(ctx, L, state, b) {
  const g = L.play.gauge, roll = clamp(b.roll, -1.2, 1.2);
  const hot = Math.abs(roll) > 0.45;
  roundPath(ctx, g.x, g.y, g.w, g.h, g.h / 2); ctx.fillStyle = 'rgba(6,32,44,0.7)'; ctx.fill();
  ctx.lineWidth = 2; ctx.strokeStyle = hot ? '#ffb454' : 'rgba(255,255,255,0.4)'; ctx.stroke();
  const cx = g.x + g.w / 2, half = g.w / 2 - 14;
  ctx.fillStyle = 'rgba(255,255,255,0.18)'; ctx.fillRect(cx - 1.5, g.y + 6, 3, g.h - 12);
  ctx.fillStyle = 'rgba(255,90,70,0.28)'; ctx.fillRect(g.x + 8, g.y + 6, half * 0.17, g.h - 12); ctx.fillRect(g.x + g.w - 8 - half * 0.17, g.y + 6, half * 0.17, g.h - 12);
  const px = cx + clamp(roll, -1.1, 1.1) * half;
  ctx.fillStyle = hot ? '#ffb454' : '#ffffff'; ctx.beginPath(); ctx.arc(px, g.y + g.h / 2, 11, 0, TAU); ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,0.85)'; ctx.font = `700 16px ${FONT}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText('L', g.x + 18, g.y + g.h / 2 + 1); ctx.fillText('R', g.x + g.w - 18, g.y + g.h / 2 + 1);
  if (hot) {
    ctx.fillStyle = '#ffd9a0'; ctx.font = `800 22px ${FONT}`;
    textShadow(ctx, `BRACE ${roll > 0 ? 'RIGHT' : 'LEFT'}: paddle that side`, cx, g.y - 14, '#ffe0a8', 6);
  }
}

function labels(ctx, L, state, b) {
  const race = state.race, cam = state.cam;
  if (b.done || b.leg === 'turn') return;
  const list = upcoming(race.sea, b, race.t, 2);
  list.forEach((u, i) => {
    const c = u.w.c0 - CW * race.t;
    const p = toScreen(cam, c, b.y);
    if (p.y < L.play.map.y + 120 || p.y > L.sb - 120) return;
    let text;
    if (!u.home) {
      const sgn = (u.w.skew * b.flip) >= 0 ? 1 : -1;
      text = i === 0 ? `${sec(u.eta)} s  ·  ${sgn > 0 ? 'brace R' : 'brace L'}` : `${sec(u.eta)} s`;
    } else {
      if (u.rel > 26) return;
      text = i === 0 ? (u.rel > 3.6 ? `swell ${sec(u.eta)} s: keep the beat` : 'CATCH IT: two perfect strokes') : `swell ${sec(u.eta)} s`;
    }
    ctx.save();
    ctx.font = `700 22px ${FONT}`;
    const tw = ctx.measureText(text).width + 24, x = clamp(p.x + 90, tw / 2 + 8, L.w - tw / 2 - 8), y = p.y;
    roundPath(ctx, x - tw / 2, y - 18, tw, 36, 18); ctx.fillStyle = i === 0 ? 'rgba(6,32,44,0.78)' : 'rgba(6,32,44,0.5)'; ctx.fill();
    ctx.fillStyle = '#fff8ea'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(text, x, y + 1);
    ctx.restore();
  });
}

function explainPanel(ctx, L, ex) {
  const r = L.play.explain;
  ctx.save();
  ctx.font = `700 26px ${FONT}`;
  const lines = [];
  ctx.font = `500 22px ${FONT}`;
  for (const l of ex.lines || []) wrapLines(ctx, l, r.w - 40).forEach((w) => lines.push(w));
  const h = 56 + lines.length * 28 + 16;
  panel(ctx, r.x, r.y, r.w, h, { r: 22, fill: 'rgba(6,32,44,0.88)', stroke: 'rgba(255,214,150,0.6)' });
  ctx.fillStyle = '#ffd98a'; ctx.font = `800 26px ${FONT}`; ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic';
  ctx.fillText(ex.head, r.x + 20, r.y + 40);
  ctx.fillStyle = '#fff6e4'; ctx.font = `500 22px ${FONT}`;
  lines.forEach((l, i) => ctx.fillText(l, r.x + 20, r.y + 76 + i * 28));
  ctx.restore();
}

export function renderPlay(ctx, state, L) {
  const P = L.play, race = state.race, b = race.boats[0], watch = race.cfg.mode === 'watch';
  drawSea(ctx, L, { race, cam: state.cam, t: state.t, t0: race.t, parts: state.parts, trails: state.trails, mineLane: b.lane });
  // sea tint when swamped
  if (b.swamp > 0) { ctx.fillStyle = 'rgba(10,60,90,0.18)'; ctx.fillRect(0, 0, L.w, L.h); }
  labels(ctx, L, state, b);
  mapStrip(ctx, L, state);
  // time and place
  const place = race.boats.length > 1 ? ordinal(placeNow(race)) : '';
  ctx.save();
  roundPath(ctx, P.time.x, P.time.y, P.time.w, P.time.h, 16); ctx.fillStyle = 'rgba(6,32,44,0.62)'; ctx.fill();
  ctx.fillStyle = '#fff8ea'; ctx.textBaseline = 'middle'; ctx.textAlign = 'left'; ctx.font = `800 32px ${FONT}`;
  ctx.fillText(fmtTime(race.phase === 'intro' ? 0 : b.done ? b.finishT : race.t), P.time.x + 14, P.time.y + P.time.h / 2 + 1);
  ctx.textAlign = 'right'; ctx.font = `700 22px ${FONT}`; ctx.fillStyle = '#ffd98a';
  ctx.fillText(`${place ? place + '  ' : ''}${legName(b)}`, P.time.x + P.time.w - 14, P.time.y + P.time.h / 2 + 1);
  ctx.restore();
  // buttons
  if (!watch) {
    const hb = paintButton(ctx, P.hint, { dark: true });
    ctx.fillStyle = '#fff8ea'; ctx.font = `700 26px ${FONT}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(state.hintBusy ? '…' : 'Hint', P.hint.x + P.hint.w / 2, P.hint.y + hb.dy + P.hint.h / 2 + 1);
    const pb = paintButton(ctx, P.pause, { dark: true });
    ctx.fillText('Menu', P.pause.x + P.pause.w / 2, P.pause.y + pb.dy + P.pause.h / 2 + 1);
  } else {
    const pb = paintButton(ctx, P.demo.exit, { dark: true });
    ctx.fillStyle = '#fff8ea'; ctx.font = `700 26px ${FONT}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText('Exit', P.demo.exit.x + P.demo.exit.w / 2, P.demo.exit.y + pb.dy + P.demo.exit.h / 2 + 1);
  }
  const glowL = state.hintGlow && state.hintGlow.side < 0, glowR = state.hintGlow && state.hintGlow.side > 0;
  if (!watch) {
    const tl = state.settings.steer === 'turn' ? ['TURN L', 'TURN R'] : ['PADDLE', 'PADDLE'];
    pad(ctx, P.padL, 'L', tl[0], state, -1, state.flash[0], glowL);
    pad(ctx, P.padR, 'R', tl[1], state, 1, state.flash[1], glowR);
  } else {
    const gl = state.coachGlow;
    pad(ctx, P.padL, 'L', 'coach', state, -1, state.flash[0], gl && gl.side < 0);
    pad(ctx, P.padR, 'R', 'coach', state, 1, state.flash[1], gl && gl.side > 0);
    const pb = paintButton(ctx, P.demo.pause, { dark: true });
    ctx.fillStyle = '#fff8ea'; ctx.font = `700 26px ${FONT}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(state.paused ? 'Resume' : 'Pause', P.demo.pause.x + P.demo.pause.w / 2, P.demo.pause.y + pb.dy + P.demo.pause.h / 2 + 1);
  }
  heel(ctx, L, state, b);
  if (state.strokeLab && state.strokeLab.t > 0) {
    const a = clamp(state.strokeLab.t / 0.35, 0, 1);
    ctx.save(); ctx.globalAlpha = a; ctx.font = `800 28px ${FONT}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.lineJoin = 'round'; ctx.lineWidth = 7; ctx.strokeStyle = 'rgba(5,32,48,0.85)'; ctx.strokeText(state.strokeLab.text, P.pace.x + P.pace.w / 2, P.pace.y - 4 - (1 - a) * 8);
    textShadow(ctx, state.strokeLab.text, P.pace.x + P.pace.w / 2, P.pace.y - 4 - (1 - a) * 8, state.strokeLab.col, 6); ctx.restore();
  }
  // toast
  if (state.toastT > 0 && state.toast) {
    ctx.save(); ctx.globalAlpha = clamp(state.toastT / 0.4, 0, 1);
    ctx.font = `800 ${state.toastBig ? 46 : 32}px ${DISPLAY}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    const lines = wrapLines(ctx, state.toast, P.toast.maxW);
    ctx.lineJoin = 'round'; ctx.lineWidth = 8; ctx.strokeStyle = 'rgba(5,32,48,0.8)';
    lines.forEach((l, i) => { ctx.strokeText(l, P.toast.x, P.toast.y + i * 40); textShadow(ctx, l, P.toast.x, P.toast.y + i * 40, state.toastCol || '#fff6e4', 8); });
    ctx.restore();
  }
  if (state.explain) explainPanel(ctx, L, state.explain);
  // start countdown
  if (race.phase === 'intro') {
    const n = Math.ceil(race.go - 0.4);
    ctx.save(); ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillStyle = 'rgba(4,20,30,0.28)'; ctx.fillRect(0, 0, L.w, L.h);
    const wd = L.wide, cy = L.h * (wd ? 0.27 : 0.38);
    ctx.font = `800 ${wd ? (n > 0 ? 140 : 96) : (n > 0 ? 190 : 120)}px ${DISPLAY}`;
    textShadow(ctx, n > 0 ? String(n) : 'GO!', L.w / 2, cy, '#fff6e4', 18);
    ctx.font = `700 ${wd ? 26 : 30}px ${FONT}`;
    ctx.lineJoin = 'round'; ctx.lineWidth = 7; ctx.strokeStyle = 'rgba(5,32,48,0.8)'; ctx.strokeText(`${race.sea.name}: out to the buoy and back`, L.w / 2, cy + (wd ? 88 : 130));
    textShadow(ctx, `${race.sea.name}: out to the buoy and back`, L.w / 2, cy + (wd ? 88 : 130), '#ffe0a8', 8);
    ctx.restore();
  }
  if (state.paused && watch) {
    ctx.save(); ctx.font = `800 54px ${DISPLAY}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    textShadow(ctx, 'Paused', L.w / 2, L.h * 0.3, '#fff6e4', 14); ctx.restore();
  }
}

function legName(b) { return b.done ? 'FINISHED' : b.leg === 'turn' ? 'TURN' : b.leg === 'out' ? 'OUT' : 'HOME'; }
export function placeNow(race) {
  const sea = race.sea;
  const prog = race.boats.map((b) => (b.done ? 2 + 1 / (1 + b.finishT) : progress(sea, b)));
  let p = 1;
  for (let i = 1; i < prog.length; i++) if (prog[i] > prog[0]) p++;
  return p;
}
export { host };
