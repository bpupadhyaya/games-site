// Drawing for every screen. render() is the single entry point; text screens are in docview.js.
import {
  PAL, UI, DISPLAY, TAU, TILT, camFor, camFromGl, groundPath, drawBackdrop, drawFloor, drawPlayer, drawBall, drawBallShadow, drawParticles, teamLook,
} from './art.js';
import { txt, button, panel, rrect, chip, wrap } from './ui.js';
import { renderDoc } from './docview.js';
import { ABOUT, HOWTO, RULES, licenseBlocks } from './content.js';
import {
  VENUES, THINK_TIMES, HOLD_MAX, CATCH_CD, STANCE, threatsTo, alive, newWorld,
} from './engine.js';
import { drawCredit, drawMoreLine, edgeStroke, drawLockup } from './brand.js';
import { menuRects } from './layout.js';

const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const mmss = (s) => `${Math.floor(Math.max(0, s) / 60)}:${String(Math.floor(Math.max(0, s) % 60)).padStart(2, '0')}`;
const PAUSE_LABEL = { resume: 'Resume', restart: 'Restart match', quit: 'Quit to menu', again: 'Watch again', exit: 'Menu', think: 'Think time: change' };

function titleLine(ctx, cx, y, size, label, maxW, o = {}) {
  ctx.save(); ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.font = `800 ${size}px ${DISPLAY}`;
  const wmax = ctx.measureText(label).width, s = wmax > maxW ? (size * maxW) / wmax : size;
  ctx.font = `800 ${s}px ${DISPLAY}`;
  const g = ctx.createLinearGradient(0, y - s * 0.5, 0, y + s * 0.5);
  g.addColorStop(0, o.top ?? '#fff6dc'); g.addColorStop(0.5, o.mid ?? '#ffd23f'); g.addColorStop(1, o.bot ?? '#e8890c');
  ctx.lineJoin = 'round'; ctx.lineWidth = s * 0.16; ctx.strokeStyle = '#0a1226'; ctx.strokeText(label, cx, y + s * 0.04);
  ctx.fillStyle = g; ctx.fillText(label, cx, y);
  ctx.restore();
}

// ---- the world on the ground ----------------------------------------------------------------------------------------------------------------
// A ring on the ground. In the 3D view it is handed to the presenter (drawn in the scene, so people stand in front of it); in the oblique
// 2D view it is stroked here. col is a CSS colour, lw a line width in screen px, o: { fill, dash }.
function ringMark(ctx, cam, x, y, r, col, lw = 4, o = {}) {
  if (cam.marks) { cam.marks.push({ x, y, r, col, lw, fill: !!o.fill }); return; }
  ctx.save();
  groundPath(ctx, cam, x, y, r);
  if (o.fill) { ctx.fillStyle = col; ctx.fill(); }
  else { ctx.strokeStyle = col; ctx.lineWidth = Math.max(2, lw); if (o.dash) ctx.setLineDash(o.dash); ctx.stroke(); }
  ctx.restore();
}
const lineP = (ctx, cam, x0, y0, x1, y1, col, lw, dash) => {
  const a = cam.P(x0, y0), b = cam.P(x1, y1);
  ctx.save(); if (dash) ctx.setLineDash(dash); ctx.strokeStyle = col; ctx.lineWidth = lw; ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke(); ctx.restore();
};

// What the 3D scene cannot draw for itself: the gold "you" ring and arrow, the catch-stance ring, stars over a kneeling player.
function playerMarks(ctx, cam, p, o) {
  const u = cam.u(p.x, p.y);
  if (o.you) {
    ringMark(ctx, cam, p.x, p.y, 44, PAL.gold, Math.max(2, 3 * u * 1.4));
    const by = Math.sin((o.t ?? 0) * 6) * 5, q = cam.P(p.x, p.y, 112 * p.tall + by), s = Math.max(9, 17 * u * 1.4);
    ctx.save(); ctx.fillStyle = PAL.gold; ctx.strokeStyle = 'rgba(40,24,0,0.8)'; ctx.lineWidth = 2.5; ctx.lineJoin = 'round';
    ctx.beginPath(); ctx.moveTo(q.x - s * 0.5, q.y - s * 0.55); ctx.lineTo(q.x + s * 0.5, q.y - s * 0.55); ctx.lineTo(q.x, q.y + s * 0.3); ctx.closePath(); ctx.stroke(); ctx.fill(); ctx.restore();
  }
  if (p.catchT > 0) ringMark(ctx, cam, p.x, p.y, 80, 'rgba(255,255,255,0.85)', Math.max(2, 3 * u * 1.4));
  if (p.stun > 0) {
    for (let i = 0; i < 3; i++) {
      const a = (o.t ?? 0) * 5 + (i * TAU) / 3, q = cam.P(p.x + Math.cos(a) * 20, p.y + Math.sin(a) * 12, 96 * p.tall);
      ctx.fillStyle = PAL.gold; ctx.beginPath(); ctx.arc(q.x, q.y, Math.max(2, 3.4 * u * 1.4), 0, TAU); ctx.fill();
    }
  }
}

// Everything that stands on or flies over the court, sorted by depth. `o`: { t, parts, plan, warn (player id to warn), you, shake }
// With a 3D camera (cam.gl) the floor, the people and the balls are already on screen behind the canvas: this draws only the overlays.
export function drawWorld(ctx, cam, w, o = {}) {
  const v = VENUES[w.venueIdx], t = o.t ?? 0, gl = !!cam.gl;
  if (!gl) drawFloor(ctx, v, cam);
  const me = w.ps[w.me];
  // wind-ups: a thin red line from the thrower to the player aimed at
  for (const p of w.ps) {
    if (p.windT > 0 && p.aim && p.aim.tid !== null && !p.aim.pass) {
      const tg = w.ps[p.aim.tid]; if (!tg) continue;
      lineP(ctx, cam, p.x, p.y, tg.x, tg.y, tg.id === w.me ? 'rgba(255,90,70,0.85)' : 'rgba(255,120,100,0.35)', tg.id === w.me ? 4 : 2.5, [10, 8]);
    }
  }
  // the landing mark of every live ball heading for the human's player
  if (o.warn && me && me.st === 'in') {
    for (const th of threatsTo(w, me, 0)) {
      if (th.eta > 1.4) continue;
      const k = clamp(th.eta / 1.4, 0, 1), u = cam.u(th.x, th.y), c = cam.P(th.x, th.y);
      ringMark(ctx, cam, th.x, th.y, 26 + 40 * k, `rgba(255,70,50,${0.9 - 0.3 * k})`, Math.max(2.5, 5 * u));
      ringMark(ctx, cam, th.x, th.y, 24, 'rgba(255,70,50,0.22)', 1, { fill: true });
      txt(ctx, th.eta.toFixed(1), c.x, c.y - 34 * u, Math.max(16, 26 * u), '#fff', { align: 'center', weight: 800, stroke: 5, strokeColor: 'rgba(140,10,0,0.9)' });
    }
  }
  if (o.plan) drawPlan(ctx, cam, w, o.plan, t);
  if (o.dest) ringMark(ctx, cam, o.dest.x, o.dest.y, 18, 'rgba(255,248,236,0.9)', Math.max(2, 3 * cam.u(o.dest.x, o.dest.y)), { dash: [6, 6] });
  // while the human holds a ball: a ring under every opponent says whether a catch is ready (red), possible (yellow) or spent (green)
  if (o.aimHints && me && me.ball !== null) {
    for (const q of w.ps) {
      if (q.team === me.team || q.st !== 'in') continue;
      const col = q.catchT > 0 ? 'rgba(255,90,70,0.95)' : q.catchCd > 0.35 ? 'rgba(110,235,150,0.95)' : 'rgba(255,214,70,0.7)';
      ringMark(ctx, cam, q.x, q.y, gl ? 52 : 36, col, Math.max(2, 3.5 * cam.u(q.x, q.y) * 1.1));
    }
  }
  if (gl) {
    // marks on the people, then the streak behind a flying ball
    for (const p of w.ps) playerMarks(ctx, cam, p, { t, you: p.id === w.me });
    for (const b of w.balls) {
      if (!b.live || b.holder !== null) continue;
      const u = cam.u(b.x, b.y), r = 12 * u;
      for (let i = 5; i >= 1; i--) {
        const k = i * 0.022, q = cam.P(b.x - b.vx * k, b.y - b.vy * k, b.z - b.vz * k);
        ctx.fillStyle = `rgba(255,140,90,${0.07 + 0.16 * (1 - i / 5)})`; ctx.beginPath(); ctx.arc(q.x, q.y, r * (0.5 + 0.5 * (1 - i / 5)), 0, TAU); ctx.fill();
      }
    }
  } else {
    // shadows of balls first, then everything by depth
    for (const b of w.balls) if (b.holder === null) drawBallShadow(ctx, cam, b);
    const items = [];
    for (const p of w.ps) items.push({ y: p.y, p });
    for (const b of w.balls) if (b.holder === null) items.push({ y: b.y + 0.5, b });
    items.sort((a, c) => a.y - c.y);
    for (const it of items) {
      if (it.p) drawPlayer(ctx, cam, it.p, { t, you: it.p.id === w.me });
      else drawBall(ctx, cam, it.b, { t });
    }
  }
  if (o.parts) drawParticles(ctx, cam, o.parts);
  if (o.pops) for (const q of o.pops) {
    const k = q.t / q.life, a = clamp(Math.min(k * 6, (1 - k) * 2.5), 0, 1), c = cam.P(q.x, q.y), u = cam.u(q.x, q.y);
    ctx.save(); ctx.globalAlpha = a;
    txt(ctx, q.text, c.x, c.y - (gl ? 150 + 60 * k : 95 + 50 * k) * u, Math.max(18, 34 * u * (1 + 0.35 * (1 - Math.min(1, k * 5)))), q.col, { align: 'center', font: DISPLAY, weight: 800, stroke: 7 });
    ctx.restore();
  }
}

// The hint / coach overlay on the ground.
function drawPlan(ctx, cam, w, plan, t) {
  const me = w.ps[w.me], pulse = 0.65 + 0.35 * Math.sin(t * 7), col = `rgba(255,214,70,${0.6 + 0.4 * pulse})`;
  const line = (x, y) => lineP(ctx, cam, me.x, me.y, x, y, 'rgba(255,214,70,0.55)', 3, [12, 8]);
  const label = (x, y, text, color, size) => { const c = cam.P(x, y), u = cam.u(x, y); txt(ctx, text, c.x, c.y + 30 * u, Math.max(15, size * u), color, { align: 'center', font: DISPLAY, weight: 800, stroke: 5 }); };
  if (plan.kind === 'throw') {
    const tg = w.ps[plan.tid]; if (!tg) return;
    ringMark(ctx, cam, tg.x, tg.y, 46 + 6 * pulse, col, 5 * cam.u(tg.x, tg.y)); line(tg.x, tg.y);
    label(tg.x, tg.y, plan.kindT === 'lob' ? 'LOB' : 'FAST', '#ffd23f', 22);
  } else if (plan.kind === 'pass') {
    const tg = w.ps[plan.tid]; if (!tg) return;
    ringMark(ctx, cam, tg.x, tg.y, 46 + 6 * pulse, 'rgba(120,230,255,0.95)', 5 * cam.u(tg.x, tg.y)); line(tg.x, tg.y);
    label(tg.x, tg.y, 'PASS', '#8be8ff', 22);
  } else if (plan.kind === 'catch') {
    ringMark(ctx, cam, me.x, me.y, 56 + 8 * pulse, col, 5 * cam.u(me.x, me.y));
    label(me.x, me.y, 'CATCH', '#ffd23f', 24);
  } else if (plan.kind === 'dodge') {
    const x1 = me.x + plan.dx * 150, y1 = me.y + plan.dy * 150, a0 = cam.P(me.x, me.y), a1 = cam.P(x1, y1), u = cam.u(me.x, me.y);
    ctx.save(); ctx.strokeStyle = col; ctx.lineWidth = Math.max(3, 6 * u); ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(a0.x, a0.y); ctx.lineTo(a1.x, a1.y); ctx.stroke();
    const a = Math.atan2(a1.y - a0.y, a1.x - a0.x), hs = 16;
    ctx.beginPath(); ctx.moveTo(a1.x + Math.cos(a - 2.6) * hs, a1.y + Math.sin(a - 2.6) * hs); ctx.lineTo(a1.x, a1.y); ctx.lineTo(a1.x + Math.cos(a + 2.6) * hs, a1.y + Math.sin(a + 2.6) * hs); ctx.stroke(); ctx.restore();
  } else if (plan.tx !== undefined) {
    ringMark(ctx, cam, plan.tx, plan.ty, 40, col, 4 * cam.u(plan.tx, plan.ty), { dash: [10, 7] }); line(plan.tx, plan.ty);
  }
}

// ---- title ------------------------------------------------------------------------------------------------------------------------------
const glOf = (view, kind) => (view && view.gl && view.gl.on && view.gl.kind === kind ? view.gl : null);

function hero(ctx, st, area, gl) {
  const tw = st.titleWorld;
  if (!tw) return;
  const aspect = 0.86;
  let w = Math.min(area.w - 16, (area.h - 8) / aspect), h = w * aspect;
  const rect = { x: area.x + (area.w - w) / 2, y: area.y + (area.h - h) / 2, w, h };
  if (gl) {   // the 3D court is behind this canvas: only the sparks and words of the demo match go on top
    const cam = camFromGl(gl, area);
    drawWorld(ctx, cam, tw.w, { t: st.t, parts: tw.parts, pops: null, warn: false });
    return;
  }
  const cam = camFor(rect);
  ctx.save(); ctx.beginPath(); ctx.roundRect(cam.rect.x, cam.rect.y, cam.rect.w, cam.rect.h, 24); ctx.clip();
  drawWorld(ctx, cam, tw.w, { t: st.t, parts: tw.parts, pops: null, warn: false });
  ctx.restore();
  ctx.strokeStyle = 'rgba(255,210,63,0.6)'; ctx.lineWidth = 3; ctx.beginPath(); ctx.roundRect(cam.rect.x, cam.rect.y, cam.rect.w, cam.rect.h, 24); ctx.stroke();
}

// Scrims that keep the title words and the buttons readable over the 3D court.
function titleScrims(ctx, L, heroArea) {
  const T = L.title, S = L.S, PL = '8,14,32';
  if (L.mode === 'wide') {
    const c = T.col, x0 = c.x - 40;
    const g = ctx.createLinearGradient(x0 - 90, 0, x0 + 20, 0); g.addColorStop(0, `rgba(${PL},0)`); g.addColorStop(1, `rgba(${PL},0.86)`);
    ctx.fillStyle = g; ctx.fillRect(x0 - 90, S.y, 110, S.h);
    ctx.fillStyle = `rgba(${PL},0.86)`; ctx.fillRect(x0 + 20, S.y, S.x + S.w - x0 - 20, S.h);
    const g2 = ctx.createLinearGradient(0, S.y, 0, S.y + 130); g2.addColorStop(0, `rgba(${PL},0.82)`); g2.addColorStop(1, `rgba(${PL},0)`);
    ctx.fillStyle = g2; ctx.fillRect(S.x, S.y, x0 - S.x, 130);
    const g3 = ctx.createLinearGradient(0, S.y + S.h - 70, 0, S.y + S.h); g3.addColorStop(0, `rgba(${PL},0)`); g3.addColorStop(1, `rgba(${PL},0.8)`);
    ctx.fillStyle = g3; ctx.fillRect(S.x, S.y + S.h - 70, x0 - S.x, 70);
  } else {
    const h1 = heroArea.y + 26;
    const g = ctx.createLinearGradient(0, S.y, 0, h1); g.addColorStop(0, `rgba(${PL},0.92)`); g.addColorStop(0.72, `rgba(${PL},0.78)`); g.addColorStop(1, `rgba(${PL},0)`);
    ctx.fillStyle = g; ctx.fillRect(S.x, S.y, S.w, h1 - S.y);
    const y2 = T.col.y - 44, g2 = ctx.createLinearGradient(0, y2, 0, T.col.y + 6); g2.addColorStop(0, `rgba(${PL},0)`); g2.addColorStop(1, `rgba(${PL},0.94)`);
    ctx.fillStyle = g2; ctx.fillRect(S.x, y2, S.w, T.col.y + 6 - y2);
    ctx.fillStyle = `rgba(${PL},0.94)`; ctx.fillRect(S.x, T.col.y + 5, S.w, S.y + S.h - T.col.y - 5);
  }
}

// Where the demo court sits on the title: below the words (tall) or between them (wide). The 3D presenter fits its camera to the same box.
export function heroAreaOf(L) {
  const T = L.title, S = L.S, A = T.art, wide = L.mode === 'wide', shortS = S.h < 1500;
  const titleH = wide ? 0 : clamp(S.h * (shortS ? (S.h / S.w < 1.6 ? 0.27 : 0.2) : 0.17), 170, shortS ? 290 : 250);
  return { titleH, shortS, wide, heroArea: { x: A.x + 8, y: A.y + (wide ? 100 : titleH), w: A.w - 16, h: A.h - (wide ? 160 : titleH + 4) } };
}

function renderTitle(ctx, st, L, view) {
  const T = L.title, S = L.S, A = T.art;
  const gl = glOf(view, 'title');
  const { wide, shortS, titleH, heroArea } = heroAreaOf(L);
  if (gl) titleScrims(ctx, L, heroArea);
  if (wide) {
    titleLine(ctx, A.x + A.w / 2, A.y + 52, Math.min(96, A.w * 0.11), 'CIRCLE DODGEBALL', A.w - 40);
    txt(ctx, 'Queimada  ·  Volkerball  ·  Palla avvelenata', A.x + A.w / 2, A.y + A.h - 22, 22, PAL.dim, { align: 'center', maxW: A.w - 30 });
  } else {
    const size = Math.min(150, S.w / 4.6, shortS ? (titleH - 8) / 2.37 : 999);
    const y1 = A.y + Math.max(titleH * 0.36, size * 0.95);
    titleLine(ctx, S.x + S.w / 2, y1, size, 'CIRCLE', S.w - 30);
    titleLine(ctx, S.x + S.w / 2, y1 + size * 0.78, size * 0.72, 'DODGEBALL', S.w - 30, { mid: '#9fc0ff', bot: '#2f66ff' });
    txt(ctx, 'Queimada  ·  Volkerball  ·  Palla avvelenata', S.x + S.w / 2, y1 + size * 1.42, clamp(S.w * 0.036, 20, 28), PAL.dim, { align: 'center', maxW: S.w - 40 });
  }
  hero(ctx, st, heroArea, gl);
  button(ctx, T.play, 'Play', { kind: 'primary', size: 46, icon: 'play', font: DISPLAY });
  button(ctx, T.auto, 'Watch and Learn', { kind: 'quiet', size: 30, icon: 'watch' });
  button(ctx, T.how, 'How to Play', { kind: 'ghost', size: 26 });
  button(ctx, T.rules, 'Rules', { kind: 'ghost', size: 26 });
  button(ctx, T.about, 'About', { kind: 'ghost', size: 26 });
  button(ctx, T.settings, 'Settings', { kind: 'ghost', size: 26 });
  const lh = 58, lw = lh * 1296 / 354;
  if (!drawLockup(ctx, { x: T.credit.x - lw / 2, y: T.credit.y + 8 - lh, w: lw, h: lh }, 0.92)) drawCredit(ctx, T.credit.x, T.credit.y, 13);
}

function header(ctx, G, S, text) {
  button(ctx, G.back, 'Back', { icon: 'back', kind: 'ghost', size: 28 });
  txt(ctx, text, S.x + S.w / 2, G.titleY, 48, PAL.gold, { align: 'center', font: DISPLAY, weight: 800, stroke: 7, maxW: S.w - 2 * (G.back.w + 30) });
}

function stars(ctx, cx, cy, n, size, gap = 1.15) {
  for (let i = 0; i < 3; i++) {
    const x = cx + (i - 1) * size * gap, on = i < n;
    ctx.save(); ctx.translate(x, cy - (i === 1 ? size * 0.12 : 0)); ctx.fillStyle = on ? PAL.gold : 'rgba(255,248,236,0.16)'; ctx.strokeStyle = on ? '#8a5a00' : 'rgba(255,248,236,0.22)'; ctx.lineWidth = Math.max(2, size * 0.06);
    ctx.beginPath(); for (let k = 0; k < 10; k++) { const r = k % 2 ? size * 0.22 : size * 0.5, a = -Math.PI / 2 + k * Math.PI / 5; ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r); } ctx.closePath(); ctx.fill(); ctx.stroke(); ctx.restore();
  }
}

// ---- venues -----------------------------------------------------------------------------------------------------------------------------
function renderVenues(ctx, st, L, view) {
  const G = L.venues, S = L.S;
  header(ctx, G, S, 'Choose a place');
  const modes = [['dodger', 'Dodger inside', 'catch'], ['ring', 'Thrower on the ring', 'fast']];
  modes.forEach(([id, label, ic], i) => button(ctx, G.modes[i], label, { kind: st.roleSel === id ? 'gold' : 'ghost', size: 28, icon: ic }));
  txt(ctx, 'Role in the ring places (Queimada has everyone playing)', S.x + S.w / 2, G.modes[0].y + G.modes[0].h + 6, 18, PAL.dim, { align: 'center', maxW: S.w - 40 });
  VENUES.forEach((v, i) => {
    const r = G.cards[i], locked = st.demo && i > 0, best = st.best[`${v.id}:${v.kind === 'court' ? 'court' : st.roleSel}`];
    panel(ctx, r, { fill: 'rgba(12,20,42,0.9)' }); edgeStroke(ctx, r, 24, 0.22);
    const pad = 12, mw = r.w - pad * 2, textH = 130, mh = Math.min(mw * 0.9, r.h - pad * 2 - textH);
    const rect = { x: r.x + pad, y: r.y + pad, w: mw, h: mh };
    const cam = camFor(rect);
    ctx.save(); ctx.beginPath(); ctx.roundRect(cam.rect.x, cam.rect.y, cam.rect.w, cam.rect.h, 14); ctx.clip();
    const snap = view && view.gl && view.gl.snapshot ? view.gl.snapshot(i, st.roleSel, previewWorld(i, st.roleSel)) : null;   // a still of the 3D court
    if (snap) {
      const k = Math.max(cam.rect.w / snap.width, cam.rect.h / snap.height), dw = snap.width * k, dh = snap.height * k;
      ctx.drawImage(snap, cam.rect.x + (cam.rect.w - dw) / 2, cam.rect.y + (cam.rect.h - dh) / 2, dw, dh);
    } else drawWorld(ctx, cam, previewWorld(i, st.roleSel), { t: st.t, warn: false });
    if (locked) { ctx.fillStyle = 'rgba(8,14,30,0.6)'; ctx.fillRect(cam.rect.x, cam.rect.y, cam.rect.w, cam.rect.h); }
    ctx.restore();
    const ty = cam.rect.y + cam.rect.h + 26, small = r.h < 300;
    txt(ctx, v.name, r.x + r.w / 2, ty, small ? 32 : 40, locked ? PAL.dim : PAL.text, { align: 'center', font: DISPLAY, weight: 800, maxW: r.w - 24 });
    const meta = v.kind === 'court' ? `${v.local} · ${v.per} v ${v.per} · ${mmss(v.time)}` : `${v.local} · ${v.dodgers} + ${v.ring} · ${mmss(v.time)}`;
    txt(ctx, locked ? 'Full game: iPhone and Android' : meta, r.x + r.w / 2, ty + (small ? 28 : 34), small ? 19 : 22, PAL.gold, { align: 'center', weight: 700, maxW: r.w - 24 });
    if (!small) {
      ctx.font = `500 20px ${UI}`;
      wrap(ctx, v.blurb, r.w - 28).slice(0, 3).forEach((ln, k) => txt(ctx, ln, r.x + r.w / 2, ty + 66 + k * 25, 20, PAL.dim, { align: 'center', weight: 500, maxW: r.w - 20 }));
    }
    if (best && !locked) stars(ctx, r.x + r.w - 56, r.y + 34, best.stars, 24, 1.2);
  });
}

// A fixed little world per venue for the cards: players spread on the court, no sound, never stepped.
const previews = new Map();
function previewWorld(i, role) {
  const key = `${i}:${role}`;
  let w = previews.get(key);
  if (!w) {
    let a = 12345 + i * 77;
    const rng = { next: () => { a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; } };
    rng.int = (n) => Math.floor(rng.next() * n); rng.range = (x, y) => x + rng.next() * (y - x);
    w = newWorld({ venueIdx: i, role: VENUES[i].kind === 'ring' ? role : 'dodger', rng });
    w.me = -1;
    if (previews.size > 12) previews.clear();
    previews.set(key, w);
  }
  return w;
}

// ---- the playing screen ----------------------------------------------------------------------------------------------------------------
function pips(ctx, x, y, n, on, col, size, align) {
  for (let i = 0; i < n; i++) {
    const px = align === 'left' ? x + i * size * 1.45 : x - i * size * 1.45;
    ctx.beginPath(); ctx.arc(px, y, size * 0.5, 0, TAU);
    if (i < on) { ctx.fillStyle = col; ctx.fill(); ctx.strokeStyle = 'rgba(0,0,0,0.5)'; ctx.lineWidth = 2; ctx.stroke(); }
    else { ctx.strokeStyle = 'rgba(255,248,236,0.35)'; ctx.lineWidth = 2.5; ctx.stroke(); ctx.beginPath(); ctx.moveTo(px - size * 0.28, y - size * 0.28); ctx.lineTo(px + size * 0.28, y + size * 0.28); ctx.moveTo(px + size * 0.28, y - size * 0.28); ctx.lineTo(px - size * 0.28, y + size * 0.28); ctx.stroke(); }
  }
}
const sideCount = (w, orig) => w.ps.filter((p) => p.orig === orig).length;
const sideIn = (w, orig) => w.ps.filter((p) => p.orig === orig && p.st === 'in').length;

function scoreBar(ctx, P, w) {
  const b = P.bar;
  ctx.fillStyle = 'rgba(8,14,30,0.7)'; rrect(ctx, b, 16); ctx.fill();
  const cx = b.x + b.w / 2, size = Math.min(26, b.h * 0.42);
  if (w.kind === 'court') {
    const nm = sideCount(w, 0), nt = sideCount(w, 1);
    txt(ctx, 'YOU', b.x + 14, b.y + b.h * 0.3, 15, PAL.sunLight, { weight: 800 });
    txt(ctx, 'THEM', b.x + b.w - 14, b.y + b.h * 0.3, 15, PAL.moonLight, { weight: 800, align: 'right' });
    pips(ctx, b.x + 14 + size * 0.5, b.y + b.h * 0.7, nm, sideIn(w, 0), PAL.sun, size * 0.55, 'left');
    pips(ctx, b.x + b.w - 14 - size * 0.5, b.y + b.h * 0.7, nt, sideIn(w, 1), PAL.moon, size * 0.55, 'right');
  } else {
    // ring: the dodgers (left) against the size of the ring (right)
    const dod = w.ps.filter((p) => p.orig === w.dodgerTeam), ring = w.ps.filter((p) => p.team !== w.dodgerTeam).length;
    const col = w.dodgerTeam === 0 ? PAL.sun : PAL.moon;
    txt(ctx, w.role === 'dodger' ? 'YOUR DODGERS' : 'DODGERS', b.x + 14, b.y + b.h * 0.3, 15, w.dodgerTeam === 0 ? PAL.sunLight : PAL.moonLight, { weight: 800, maxW: b.w * 0.3 });
    pips(ctx, b.x + 14 + size * 0.5, b.y + b.h * 0.7, dod.length, dod.filter((p) => p.st === 'in').length, col, size * 0.55, 'left');
    txt(ctx, 'THE RING', b.x + b.w - 14, b.y + b.h * 0.3, 15, w.dodgerTeam === 0 ? PAL.moonLight : PAL.sunLight, { weight: 800, align: 'right', maxW: b.w * 0.3 });
    txt(ctx, String(ring), b.x + b.w - 14, b.y + b.h * 0.7, size, w.dodgerTeam === 0 ? PAL.moonLight : PAL.sunLight, { weight: 800, align: 'right', font: DISPLAY });
  }
  const low = w.timeLeft < 15;
  txt(ctx, mmss(w.timeLeft), cx, b.y + b.h * 0.5, Math.min(44, b.h * 0.8), low ? '#ff8a7a' : PAL.text, { align: 'center', font: DISPLAY, weight: 800, stroke: 5 });
}

function trayChips(ctx, st, P, pl) {
  const w = pl.w, tr = P.tray, wide = !!P.rail;
  panel(ctx, tr, { fill: 'rgba(8,14,30,0.55)', rad: 18 });
  const sides = [0, 1].map((o) => w.ps.filter((p) => p.orig === o));
  const gap = 6, n = Math.max(sides[0].length, sides[1].length);
  // tall: one row per side; wide: one column per side
  const cell = (ri, i) => {
    if (wide) {
      const cw = (tr.w - 8 * 2 - gap) / 2, rh = Math.min(52, (tr.h - gap * (n + 1)) / n);
      return { x: tr.x + 8 + ri * (cw + gap), y: tr.y + gap + i * (rh + gap), w: cw, h: rh };
    }
    const rh = (tr.h - gap * 3) / 2, cw = Math.min(150, (tr.w - 16 - gap * (n - 1)) / n);
    return { x: tr.x + 8 + i * (cw + gap), y: tr.y + gap + ri * (rh + gap), w: cw, h: rh };
  };
  sides.forEach((list, ri) => {
    const L = teamLook(ri);
    list.forEach((p, i) => {
      const r = cell(ri, i), { x, y, w: cw, h: rh } = r;
      const out = w.kind === 'court' ? p.st !== 'in' : false, onRing = w.kind === 'ring' && p.st === 'rim';
      const cr = Math.min(rh * 0.3, 15), cx0 = x + cr + 8, cy0 = y + rh * 0.5;
      ctx.fillStyle = out ? 'rgba(255,248,236,0.06)' : ri === 0 ? 'rgba(255,138,28,0.22)' : 'rgba(47,102,255,0.24)'; rrect(ctx, r, 10); ctx.fill();
      if (p.id === w.me) { ctx.strokeStyle = PAL.gold; ctx.lineWidth = 2.5; rrect(ctx, r, 10); ctx.stroke(); }
      ctx.fillStyle = out ? 'rgba(255,248,236,0.25)' : L.shirt; ctx.beginPath(); ctx.arc(cx0, cy0, cr, 0, TAU); ctx.fill();
      if (onRing) { ctx.strokeStyle = p.lost ? PAL.gold : 'rgba(255,248,236,0.7)'; ctx.lineWidth = 2.5; ctx.beginPath(); ctx.arc(cx0, cy0, cr + 4, 0, TAU); ctx.stroke(); }
      const nx = cx0 + cr + 10;
      txt(ctx, p.name, nx, y + rh * 0.5, Math.min(21, rh * 0.5), out ? PAL.dim : PAL.text, { weight: 700, maxW: x + cw - nx - (p.ball !== null ? 20 : 6) });
      if (p.ball !== null) { ctx.fillStyle = '#e8352c'; ctx.beginPath(); ctx.arc(x + cw - 12, y + rh * 0.5, 6, 0, TAU); ctx.fill(); }
      if (out) { ctx.strokeStyle = 'rgba(255,107,90,0.7)'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(x + 8, y + rh - 6); ctx.lineTo(x + cw - 8, y + 6); ctx.stroke(); }
    });
  });
}

function contextLine(st, pl) {
  const w = pl.w, me = w.ps[w.me], foes = w.ps.filter((q) => q.team !== me.team && q.st === 'in');
  if (pl.auto) return 'Watch and Learn: the coach plays, you read along';
  if (w.phase === 'over') return '';
  if (me.stun > 0) return 'You are kneeling: wait a moment';
  if (me.st === 'rim' && me.ball !== null) return w.kind === 'court' ? 'Cemetery: tap a player to throw into the court' : 'Ring: tap a dodger to throw, tap a teammate to pass';
  if (me.st === 'rim') return w.kind === 'court' ? 'Cemetery: tap to slide along the rim, run onto a ball' : 'Ring: tap to move along the circle';
  if (me.ball !== null) return foes.length ? 'You have the ball: tap an opponent to throw (hold ' + Math.max(0, Math.ceil(HOLD_MAX - me.heldT)) + ' s)' : 'You have the ball';
  const thr = threatsTo(w, me, 0)[0];
  if (thr && thr.eta < 0.9) return me.catchCd > 0 ? 'Incoming! Move out of the way' : 'Incoming! Step aside or press Catch';
  if (w.balls.some((b) => b.holder === null && !b.live)) return w.kind === 'court' ? 'Run over a loose ball on your side to pick it up' : 'Dodge, and catch when you can';
  return 'Keep moving: a moving player is hard to hit';
}

function drawArena(ctx, st, L, pl, view) {
  const P = L.play, w = pl.w, A = P.arena, t = st.t;
  const gl = glOf(view, 'play');
  const cam = gl ? camFromGl(gl, A) : camFor(A);
  const plan = pl.pre?.plan ?? (pl.hintT > 0 ? pl.hint : null);
  const o = { t, parts: pl.parts, pops: pl.pops, plan, warn: !pl.auto, dest: pl.auto ? null : pl.dest, aimHints: true };
  if (gl) { drawWorld(ctx, cam, w, o); return cam; }   // the court, the people and the ball are behind the canvas
  const shake = pl.shake > 0 && !st.prefs.calm ? Math.sin(pl.shake * 70) * pl.shake * 7 : 0;
  ctx.save();
  ctx.beginPath(); ctx.roundRect(cam.rect.x, cam.rect.y, cam.rect.w, cam.rect.h, 22); ctx.clip();
  ctx.translate(shake, 0);
  drawWorld(ctx, cam, w, o);
  ctx.restore();
  ctx.strokeStyle = 'rgba(255,210,63,0.7)'; ctx.lineWidth = 3; ctx.beginPath(); ctx.roundRect(cam.rect.x, cam.rect.y, cam.rect.w, cam.rect.h, 22); ctx.stroke();
  return cam;
}

function renderCoach(ctx, st, L, pl) {
  const pre = pl.pre, P = L.play;
  if (!pre || !pre.plan) return;
  // The controls are idle while the coach plays, so the explanation sits over them: the court stays fully visible.
  ctx.font = `500 22px ${UI}`;
  const lines = (pre.plan.why ?? []).flatMap((ln) => wrap(ctx, ln, P.btnA.w - 28));
  const need = 54 + lines.length * 27 + 12, base = P.btnB.y + P.btnB.h - P.btnA.y;
  const hh = need > base ? need : Math.min(base, Math.max(need, 150));
  const top = Math.max(P.tray.y, P.btnA.y + base - hh) - (need > base ? 0 : base - hh);
  const r = { x: P.btnA.x, y: top, w: P.btnA.w, h: hh };
  ctx.fillStyle = 'rgba(8,14,30,1)'; rrect(ctx, r, 16); ctx.fill(); ctx.strokeStyle = 'rgba(255,210,63,0.6)'; ctx.lineWidth = 2; rrect(ctx, r, 16); ctx.stroke();
  txt(ctx, pre.kind === 'think' ? 'The coach is reading the court' : 'The coach has decided', r.x + 14, r.y + 24, 21, PAL.gold, { weight: 800, maxW: r.w - 130 });
  const k = clamp(pre.t / pre.dur, 0, 1);
  ctx.fillStyle = 'rgba(255,248,236,0.15)'; rrect(ctx, { x: r.x + r.w - 104, y: r.y + 16, w: 90, h: 10 }, 5); ctx.fill();
  ctx.fillStyle = pre.kind === 'think' ? '#86a8ff' : PAL.gold; rrect(ctx, { x: r.x + r.w - 104, y: r.y + 16, w: 90 * k, h: 10 }, 5); ctx.fill();
  ctx.font = `500 22px ${UI}`;
  let y = r.y + 54;
  for (const l2 of lines) { if (y < r.y + r.h - 4) txt(ctx, l2, r.x + 14, y, 22, PAL.text, { weight: 500, maxW: r.w - 28 }); y += 27; }
}

function renderHint(ctx, st, L, pl) {
  if (pl.hintT <= 0 || !pl.hint || pl.pre) return;
  const A = L.play.arena, lines = pl.hint.why ?? [];
  const bh = clamp(A.h * 0.2, 96, 150), r = { x: A.x + 10, y: A.y + A.h - bh - 10, w: A.w - 20, h: bh };
  ctx.fillStyle = 'rgba(8,14,30,0.92)'; rrect(ctx, r, 16); ctx.fill(); ctx.strokeStyle = 'rgba(255,210,63,0.6)'; ctx.lineWidth = 2; rrect(ctx, r, 16); ctx.stroke();
  txt(ctx, 'Hint', r.x + 14, r.y + 22, 21, PAL.gold, { weight: 800 });
  ctx.font = `500 21px ${UI}`;
  let y = r.y + 50;
  for (const ln of lines) for (const l2 of wrap(ctx, ln, r.w - 28)) { if (y < r.y + r.h - 6) txt(ctx, l2, r.x + 14, y, 21, PAL.text, { weight: 500, maxW: r.w - 28 }); y += 26; }
}

function renderPlay(ctx, st, L, view, meta, helpers) {
  const pl = st.pl, P = L.play, w = pl.w, A = P.arena, wide = !!P.rail;
  meta.previewBadge = { x: A.x + 12, y: A.y + 10, align: 'left' };
  const gl = glOf(view, 'play');
  if (!gl) drawBackdrop(ctx, L.w + 20, L.h + 20, st.t, VENUES[w.venueIdx].floor);
  else if (wide) {   // landscape: the column of controls sits on a plate, so nothing of the 3D scenery shows between the buttons
    const x0 = A.x + A.w + 4, PL = '8,14,32', g = ctx.createLinearGradient(x0 - 60, 0, x0 + 6, 0);
    g.addColorStop(0, `rgba(${PL},0)`); g.addColorStop(1, `rgba(${PL},0.94)`);
    ctx.fillStyle = g; ctx.fillRect(x0 - 60, 0, 66, L.h);
    ctx.fillStyle = `rgba(${PL},0.94)`; ctx.fillRect(x0 + 5, 0, L.w - x0, L.h);
  }
  const v = VENUES[w.venueIdx];
  button(ctx, P.pause, '', { icon: 'pause', kind: 'quiet', size: 28 });
  button(ctx, P.hint, '', { icon: 'hint', kind: pl.auto ? 'disabled' : 'quiet', size: 28 });
  const roleLabel = w.kind === 'ring' ? (w.role === 'dodger' ? ' · dodger' : ' · ring') : '';
  txt(ctx, `${v.name}${pl.auto ? ' · Watch and Learn' : wide ? '' : roleLabel}`, P.title.x + 4, P.title.y + P.title.h / 2, 38, PAL.text, { font: DISPLAY, weight: 800, maxW: P.title.w, stroke: 6 });
  scoreBar(ctx, P, w);
  trayChips(ctx, st, P, pl);
  drawArena(ctx, st, L, pl, view);
  // message strip
  if (w.msg && w.phase !== 'over') {
    const a = clamp(Math.min(w.msgT / 0.25, (2.4 - w.msgT) / 0.4), 0, 1);
    if (a > 0) { ctx.save(); ctx.globalAlpha = a; chip(ctx, A.x + A.w / 2, A.y + 40, w.msg, 28, { align: 'center', fill: 'rgba(8,14,30,0.9)', stroke: 'rgba(255,210,63,0.6)', maxW: A.w - 30, color: PAL.gold }); ctx.restore(); }
  }
  // the start beat
  if (w.phase === 'play' && w.t < 2.2 && !pl.auto) {
    const go = w.t >= 1.2, k = go ? clamp((2.2 - w.t) / 1.0, 0, 1) : 1;
    ctx.save(); ctx.globalAlpha = k;
    txt(ctx, go ? 'GO!' : 'READY', A.x + A.w / 2, A.y + A.h * 0.45, Math.min(130, A.w * 0.3), go ? '#8dffb0' : PAL.gold, { align: 'center', font: DISPLAY, weight: 800, stroke: 12 });
    ctx.restore();
  }
  // what a tap does now
  const cl = contextLine(st, pl);
  if (cl && !pl.pre && pl.hintT <= 0) chip(ctx, A.x + A.w / 2, A.y + A.h - 26, cl, 21, { align: 'center', fill: 'rgba(8,14,30,0.72)', maxW: A.w - 20, color: PAL.text, weight: 600 });
  // controls
  const me = w.ps[w.me], enabled = !pl.auto && w.phase === 'play';
  const canCatch = enabled && me.st === 'in' && me.ball === null && me.stun <= 0;
  const cd = me.catchCd, ready = canCatch && cd <= 0;
  const catchLabel = me.st === 'rim' ? (w.kind === 'court' ? 'You are in the cemetery' : 'Catch (dodgers only)') : 'CATCH';
  button(ctx, P.btnA, catchLabel, { kind: ready ? 'primary' : 'disabled', size: Math.min(46, P.btnA.h * 0.5), icon: 'catch', font: DISPLAY,
    sub: me.st === 'rim' ? (w.kind === 'court' ? 'pick up balls that roll to you and throw' : 'you are on the ring: throw instead') : me.ball !== null ? 'put the ball down first' : cd > 0 ? `recovering ${cd.toFixed(1)} s` : `hands open for ${STANCE} s` });
  if (cd > 0 && enabled) { ctx.fillStyle = 'rgba(255,210,63,0.9)'; ctx.fillRect(P.btnA.x + 12, P.btnA.y + P.btnA.h - 9, (P.btnA.w - 24) * (1 - cd / CATCH_CD), 5); }
  button(ctx, P.btnB, pl.throwKind === 'lob' ? 'Throw: LOB (slow, high)' : 'Throw: FAST (flat, quick)', { kind: enabled ? 'quiet' : 'disabled', size: 28, icon: pl.throwKind === 'lob' ? 'lob' : 'fast' });
  renderCoach(ctx, st, L, pl);
  renderHint(ctx, st, L, pl);
  if (pl.paused || pl.over) renderPause(ctx, st, L, pl, helpers);
}

function renderPause(ctx, st, L, pl, helpers) {
  const items = helpers.pauseItems(pl), M = menuRects(L, items.length);
  ctx.fillStyle = 'rgba(6,10,22,0.66)'; ctx.fillRect(0, 0, L.w, L.h);
  panel(ctx, M.panel, { fill: 'rgba(12,20,42,0.97)', rad: 28 }); edgeStroke(ctx, M.panel, 28, 0.3);
  const title = pl.over ? (pl.w.done === 'won' ? 'Match complete' : 'Match over') : 'Paused';
  txt(ctx, title, M.panel.x + M.panel.w / 2, M.panel.y + 54, 54, PAL.gold, { align: 'center', font: DISPLAY, weight: 800, maxW: M.panel.w - 40, stroke: 7 });
  items.forEach((it, i) => {
    const label = it === 'think' ? `Think time: ${THINK_TIMES[st.prefs.thinkIdx]} s (change)` : PAUSE_LABEL[it];
    button(ctx, M.btns[i], label, { kind: it === 'resume' || it === 'again' ? 'primary' : 'ghost', size: 30 });
  });
}

// ---- result -----------------------------------------------------------------------------------------------------------------------------
function renderResult(ctx, st, L) {
  const Rr = L.result, p = Rr.panel, res = st.result, wide = L.mode === 'wide';
  if (!res) return;
  ctx.fillStyle = 'rgba(6,10,22,0.55)'; ctx.fillRect(0, 0, L.w, L.h);
  panel(ctx, p, { fill: 'rgba(12,20,42,0.96)', rad: 30 }); edgeStroke(ctx, p, 30, 0.35);
  const head = res.won ? 'YOU WIN!' : res.draw ? 'A DRAW' : 'THEY WIN';
  txt(ctx, head, p.x + p.w / 2, p.y + 62, 78, res.won ? PAL.gold : res.draw ? PAL.text : '#ff9a8a', { align: 'center', font: DISPLAY, weight: 800, stroke: 8, maxW: p.w - 50 });
  txt(ctx, `${res.venueName} · ${res.kind === 'court' ? 'Queimada' : res.role === 'dodger' ? 'Dodger' : 'On the ring'}`, p.x + p.w / 2, p.y + 116, 24, PAL.dim, { align: 'center', weight: 600, maxW: p.w - 50 });
  stars(ctx, p.x + p.w / 2, p.y + (wide ? 188 : 210), res.stars, wide ? 70 : 88, 1.12);
  txt(ctx, `${res.score} points`, p.x + p.w / 2, p.y + (wide ? 262 : 306), 56, PAL.text, { align: 'center', font: DISPLAY, weight: 800, stroke: 7, maxW: p.w - 60 });
  if (res.newBest) txt(ctx, 'New best here', p.x + p.w / 2, p.y + (wide ? 300 : 348), 24, PAL.gold, { align: 'center', weight: 800 });
  const rows = [['Players burned by you', String(res.burns)], ['Catches', String(res.catches)], ['Teammates brought back', String(res.revived)], ['Times you were hit', String(res.hitsTaken)], ['Match time', mmss(res.seconds)]];
  const x0 = p.x + 40, wd = p.w - 80;
  let y = p.y + (wide ? 346 : 404);
  const rh = wide ? 33 : 42, limit = Rr.again.y - 40;
  for (const [a, b] of rows) {
    if (y > limit) break;
    txt(ctx, a, x0, y, wide ? 22 : 26, PAL.dim, { weight: 600, maxW: wd * 0.65 }); txt(ctx, b, x0 + wd, y, wide ? 24 : 28, PAL.text, { align: 'right', weight: 800, maxW: wd * 0.35 });
    y += rh;
  }
  button(ctx, Rr.again, 'Play again', { kind: 'primary', size: 30 });
  button(ctx, Rr.rooms, 'Places', { kind: 'quiet', size: 30 });
  button(ctx, Rr.menu, 'Menu', { kind: 'ghost', size: 30 });
  drawMoreLine(ctx, Rr.more.x, Rr.more.y, 15);
}

function renderDemoLimit(ctx, st, L) {
  const S = L.S, cx = S.x + S.w / 2, cy = S.y + S.h / 2, bw = Math.min(S.w - 40, 560);
  panel(ctx, { x: cx - bw / 2, y: cy - 190, w: bw, h: 380 }, { fill: 'rgba(12,20,42,0.96)', rad: 28 });
  txt(ctx, 'That is the free web demo', cx, cy - 110, 46, PAL.gold, { align: 'center', font: DISPLAY, weight: 800, maxW: bw - 40 });
  ctx.font = `500 26px ${UI}`;
  wrap(ctx, 'Get the full game on iPhone and Android for all four places, the ring role and your saved stars.', bw - 80).forEach((ln, i) => txt(ctx, ln, cx, cy - 30 + i * 36, 26, PAL.text, { align: 'center', weight: 500 }));
  txt(ctx, 'Tap to go back to the menu', cx, cy + 150, 24, PAL.dim, { align: 'center', weight: 600 });
}

function settingsBlocks(st) {
  const p = st.prefs, row = (id, label, kind, val, hint, extra = {}) => ({ row: id, label, kind, val, hint, ...extra });
  return [
    row('sound', 'Sound', 'toggle', () => p.sound),
    row('think', 'Think time', 'cycle', () => `${THINK_TIMES[p.thinkIdx]} s`, 'In Watch and Learn, before each move'),
    row('calm', 'Reduced motion', 'toggle', () => p.calm, 'Fewer sparks and no screen shake'),
    row('rules', 'Rules', 'button', () => '', 'The full rule book', { btn: 'Open' }),
    ...(st.demo ? [] : [row('restore', () => (st.owned ? 'Full game unlocked' : 'Restore purchase'), 'button', () => '',
      () => st.restoreMsg || (st.owned ? 'Thank you for playing' : 'Already bought it? Get it back'), { btn: () => (st.owned ? 'Owned' : st.restoreBusy ? 'Wait...' : 'Restore') })]),
    { sp: 1 },
    { p: 'Text size: use the A- and A+ buttons at the top of this screen.' },
  ];
}

function drawToast(ctx, st, L) {
  if (!st.toast) return;
  const a = clamp(Math.min(st.toast.t / 0.2, (st.toast.hold - st.toast.t) / 0.3), 0, 1);
  ctx.save(); ctx.globalAlpha = a;
  chip(ctx, L.S.x + L.S.w / 2, L.S.y + L.S.h - 120, st.toast.text, 28, { align: 'center', fill: 'rgba(12,20,42,0.95)', stroke: 'rgba(255,210,63,0.5)', maxW: L.S.w - 40 });
  ctx.restore();
}

export function render(ctx, st, L, view, meta, helpers) {
  const { w, h } = L, sc = st.scene;
  if (sc === 'play') { renderPlay(ctx, st, L, view, meta, helpers); drawToast(ctx, st, L); return; }
  meta.previewBadge = null;
  const behind = (sc === 'title' && glOf(view, 'title')) || (sc === 'result' && glOf(view, 'play'));   // the 3D court shows through
  if (!behind) drawBackdrop(ctx, w + 20, h + 20, st.t, sc === 'title' ? 'terracotta' : VENUES[st.sel]?.floor ?? 'terracotta');
  if (sc === 'title') renderTitle(ctx, st, L, view);
  else if (sc === 'venues') renderVenues(ctx, st, L, view);
  else if (sc === 'result') { if (st.pl) renderPlayFrozen(ctx, st, L, view, meta, helpers); renderResult(ctx, st, L); }
  else if (sc === 'about') { const lic = (view && view.gl && view.gl.licenses) || ''; renderDoc(ctx, st, L, { key: 'about' + lic.length, title: 'About', blocks: lic ? [...ABOUT, ...licenseBlocks(lic)] : ABOUT }); }
  else if (sc === 'howto') renderDoc(ctx, st, L, { key: 'howto', title: 'How to Play', blocks: HOWTO });
  else if (sc === 'rules') { const pg = RULES[st.rulesPage]; renderDoc(ctx, st, L, { key: 'rules' + st.rulesPage, title: `${st.rulesPage + 1}/${RULES.length}  ${pg.title}`, blocks: pg.blocks, nav: true, page: st.rulesPage, pages: RULES.length }); }
  else if (sc === 'settings') renderDoc(ctx, st, L, { key: st.demo ? 'settings-demo' : 'settings', title: 'Settings', blocks: settingsBlocks(st) });
  else if (sc === 'demo-limit') renderDemoLimit(ctx, st, L);
  drawToast(ctx, st, L);
}
// Behind the result panel: the last frame of the match, dimmed by the panel's own overlay.
function renderPlayFrozen(ctx, st, L, view, meta, helpers) {
  const pl = st.pl, keep = pl.paused, keepOver = pl.over;
  pl.paused = false; pl.over = false;
  renderPlay(ctx, st, L, view, meta, helpers);
  pl.paused = keep; pl.over = keepOver;
}
export { alive };
