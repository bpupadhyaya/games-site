// The match screen: scoreboard, helpers drawn over the 3D table (timing ring, spin tag, aim marker, pop-ups, banners),
// the intro card, pause menu, coach captions and the lesson prompts.
import { COL, FONT_D, R, icon } from './ui.js';
import { avatar, initials, flagChip, levelPips, pips, ballIcon } from './common.js';
import { project } from './cam.js';
import { readSpin, spinLabel } from './strokes.js';
import { STYLES } from './profiles.js';
import { SCOUT } from './content.js';
import { KINDS } from './shots.js';
import { confirmDialog } from './screens.js';

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const SPIN_COL = { top: '#ffa24a', back: '#6fd8ff', side: '#7dffb0', flat: '#cfd8ea' };

export function drawMatch(ctx, G) {
  const { state, L, ui } = G;
  const sim = G.sim;
  if (!sim) return;
  const w = sim.w, m = state.match, cam = state.cam;
  const hz = Math.min(G.zoom, 1.3);
  ui.zoom = hz;
  const auto = m.kind === 'auto', machine = w.machine, lesson = m.kind === 'lesson';
  // readability gradient over the 3D picture
  const g = ctx.createLinearGradient(0, 0, 0, L.h);
  g.addColorStop(0, 'rgba(3,7,16,0.62)'); g.addColorStop(0.2, 'rgba(3,7,16,0.0)'); g.addColorStop(0.8, 'rgba(3,7,16,0.0)'); g.addColorStop(1, 'rgba(3,7,16,0.6)');
  ctx.fillStyle = g; ctx.fillRect(0, 0, L.w, L.h);
  if (L.mode === 'wide') { panelsWide(ctx, G, w, m); } else scoreTop(ctx, G, w, m);
  if (cam) overlays3d(ctx, G, w, m, cam);
  bottomStrip(ctx, G, w, m);
  banner(ctx, G);
  if (lesson && state.tut) tutorial(ctx, G);
  if (state.think) coachCaption(ctx, G, w);
  if (state.hint) hintCaption(ctx, G, w, cam);
  if (state.intro) intro(ctx, G, m);
  if (state.paused && !state.intro) pauseMenu(ctx, G, auto);
  if (state.confirm === 'leave') confirmDialog(ctx, G, 'Leave this match?', m.kind === 'cup' ? 'Leaving a tournament match counts as a loss of this round attempt.' : 'The match will not be saved.', 'leave:yes', 'leave:no', 'LEAVE');
  ui.zoom = G.zoom;
}

// ---- scoreboard (portrait / square) ----------------------------------------------------------------------------------------------
function infoLine(w, m) {
  if (w.machine) return m.kind === 'lesson' ? 'LEARN THE BASICS' : 'RALLY CHALLENGE';
  if (m.kind === 'auto') return 'WATCH & LEARN';
  return `GAME ${w.gameNo}  ·  BEST OF ${w.bestOf}  ·  FIRST TO ${w.target}`;
}
function sideCard(ctx, G, r, who, w, m, mirror) {
  const { ui } = G;
  const isP = who === 'p', opp = m.opp;
  const name = isP ? (m.kind === 'auto' ? 'COACH' : 'YOU') : (opp ? opp.name : 'MACHINE');
  const hue = isP ? 190 : (opp ? opp.hue : 215);
  ctx.save();
  const gr = ctx.createLinearGradient(r.x, r.y, r.x + r.w, r.y + r.h);
  gr.addColorStop(0, isP ? 'rgba(10,95,120,0.92)' : `hsla(${hue},60%,26%,0.92)`); gr.addColorStop(1, isP ? 'rgba(8,40,70,0.92)' : `hsla(${hue},60%,14%,0.92)`);
  ctx.fillStyle = gr; ctx.beginPath(); ctx.roundRect(r.x, r.y, r.w, r.h, 20); ctx.fill();
  const serving = w.phase !== 'intro' && w.server === who;
  ctx.lineWidth = serving ? 3 : 1.5; ctx.strokeStyle = serving ? COL.orange : 'rgba(180,210,255,0.3)'; ctx.stroke();
  ctx.restore();
  const ar = Math.min(r.h * 0.34, 38), ax = mirror ? r.x + r.w - ar - 12 : r.x + ar + 12;
  avatar(ctx, ax, r.y + r.h * 0.42, ar, isP ? (m.kind === 'auto' ? 'C' : 'YOU') : initials(name), hue);
  const tx = mirror ? ax - ar - 12 : ax + ar + 12, al = mirror ? 'right' : 'left';
  const nsz = Math.min(26, r.h * 0.2);
  const maxNameW = r.w - ar * 2 - 28 - r.h * 0.9;
  let nm = name.toUpperCase();
  let sz = nsz; while (ui.measure(ctx, nm, sz, { disp: true, weight: 800, fixed: true }) > maxNameW && sz > 12) sz -= 1;
  ui.text(ctx, nm, tx + 0, r.y + r.h * 0.4, sz, { disp: true, weight: 800, align: al, fixed: true });
  if (!w.machine) pips(ctx, mirror ? tx : tx, r.y + r.h * 0.66, w.games[who], w.need, 6, COL.gold, mirror ? 'right' : 'left');
  if (serving) ballIcon(ctx, mirror ? tx - (ui.measure(ctx, nm, sz, { disp: true, weight: 800, fixed: true }) + 18) : tx + ui.measure(ctx, nm, sz, { disp: true, weight: 800, fixed: true }) + 18, r.y + r.h * 0.4 - sz * 0.3, 8);
  const sc = String(w.machine ? '' : w.score[who]);
  const ssz = r.h * 0.74;
  ui.text(ctx, sc, mirror ? r.x + 16 : r.x + r.w - 16, r.y + r.h * 0.78, ssz, { disp: true, weight: 800, align: mirror ? 'left' : 'right', fixed: true, shadow: true });
}
function scoreTop(ctx, G, w, m) {
  const { L, ui } = G, t = L.top, U = L.U;
  const back = L.back.w ? L.back.w + 8 : 0;
  ui.text(ctx, infoLine(w, m), U.x + U.w / 2, t.y + 34, 20, { align: 'center', weight: 700, color: 'rgba(214,230,255,0.82)', fixed: false });
  ui.button(ctx, 'pause', R(U.x + U.w - 62, t.y + 6, 54, 54), '', { kind: 'chip', icon: 'pause', size: 24 });
  if (w.machine) {
    const cy = t.y + 54, ch = t.h - 62, cw = U.w - 24;
    ui.panel(ctx, R(U.x + 12, cy, cw, ch), { fill: 'rgba(8,15,30,0.7)', radius: 20, shadow: false });
    ui.text(ctx, String(w.streak), U.x + U.w / 2, cy + ch * 0.8, ch * 0.78, { disp: true, weight: 800, align: 'center', fixed: true, shadow: true });
    ui.text(ctx, 'IN A ROW', U.x + U.w / 2 + ch * 0.62 + (String(w.streak).length - 1) * ch * 0.18, cy + ch * 0.8, 20, { disp: true, weight: 700, color: COL.dim });
    for (let i = 0; i < 3; i++) { ballIcon(ctx, U.x + 40 + i * 34, cy + ch * 0.5, 12); if (i >= w.lives) { ctx.save(); ctx.fillStyle = 'rgba(8,15,30,0.7)'; ctx.beginPath(); ctx.arc(U.x + 40 + i * 34, cy + ch * 0.5, 13, 0, 6.3); ctx.fill(); ctx.restore(); } }
    ui.text(ctx, `BEST ${Math.max(G.state.progress.stats.bestStreak, w.stats.bestStreak)}`, U.x + U.w - 28, cy + ch * 0.5 + 8, 22, { disp: true, weight: 700, align: 'right', color: COL.dim });
    return;
  }
  const cy = t.y + 54, ch = t.h - 62, cw = (U.w - 24 - 10) / 2;
  sideCard(ctx, G, R(U.x + 12, cy, cw, ch), 'p', w, m, false);
  sideCard(ctx, G, R(U.x + 12 + cw + 10, cy, cw, ch), 'o', w, m, true);
}

// ---- panels (landscape) ---------------------------------------------------------------------------------------------------------------
function panelsWide(ctx, G, w, m) {
  const { L, ui, state } = G;
  const lr = L.left, rr = L.right;
  const card = (r, who) => {
    const isP = who === 'p', opp = m.opp;
    const hue = isP ? 190 : (opp ? opp.hue : 215);
    ui.panel(ctx, r, { fill: 'rgba(8,15,30,0.78)', radius: 24 });
    const gr = ctx.createLinearGradient(r.x, r.y, r.x, r.y + r.h * 0.5); gr.addColorStop(0, `hsla(${hue},65%,38%,0.5)`); gr.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.save(); ctx.fillStyle = gr; ctx.beginPath(); ctx.roundRect(r.x, r.y, r.w, r.h * 0.5, 24); ctx.fill(); ctx.restore();
    const ar = clamp(r.w * 0.2, 34, 56), cx = r.x + r.w / 2;
    let y = r.y + 22 + (isP && L.back.w ? Math.max(0, L.back.y + L.back.h - r.y - 14) : 0);
    avatar(ctx, cx, y + ar, ar, isP ? (m.kind === 'auto' ? 'C' : 'YOU') : initials(opp ? opp.name : 'M'), hue);
    y += ar * 2 + 14;
    const nm = (isP ? (m.kind === 'auto' ? 'COACH' : 'YOU') : (opp ? opp.name : 'BALL MACHINE')).toUpperCase();
    let sz = 28; while (ui.measure(ctx, nm, sz, { disp: true, weight: 800, fixed: true }) > r.w - 28 && sz > 13) sz -= 1;
    ui.text(ctx, nm, cx, y + sz * 0.8, sz, { disp: true, weight: 800, align: 'center', fixed: true });
    y += sz + 8;
    if (!isP && opp) { ui.text(ctx, `${STYLES[opp.style].label} · L${opp.level}`, cx, y + 16, 18, { align: 'center', color: COL.dim, weight: 600 }); levelPips(ctx, r.x + 22, y + 28, r.w - 44, opp.level); y += 44; }
    if (isP && m.kind !== 'auto') { ui.text(ctx, w.machine ? 'RALLY' : 'MATCH', cx, y + 16, 18, { align: 'center', color: COL.dim, weight: 600 }); y += 30; }
    if (!w.machine) {
      const ssz = clamp(r.h * 0.22, 56, 120);
      ui.text(ctx, String(w.score[who]), cx, y + ssz * 0.85, ssz, { disp: true, weight: 800, align: 'center', fixed: true, shadow: true });
      y += ssz + 6;
      pips(ctx, cx - (w.need * 6 * 2.7) / 2, y + 6, w.games[who], w.need, 6, COL.gold);
      y += 24;
      if (w.server === who && w.phase !== 'intro') { ballIcon(ctx, cx - 40, y + 14, 8); ui.text(ctx, 'SERVING', cx - 24, y + 20, 18, { weight: 700, color: COL.orange2 }); y += 34; }
    } else if (isP) {
      ui.text(ctx, String(w.streak), cx, y + 84, 100, { disp: true, weight: 800, align: 'center', fixed: true, shadow: true });
      ui.text(ctx, 'IN A ROW', cx, y + 114, 20, { align: 'center', color: COL.dim, weight: 700 });
      for (let i = 0; i < 3; i++) { ballIcon(ctx, cx - 40 + i * 40, y + 150, 12); if (i >= w.lives) { ctx.save(); ctx.fillStyle = 'rgba(8,15,30,0.78)'; ctx.beginPath(); ctx.arc(cx - 40 + i * 40, y + 150, 13, 0, 6.3); ctx.fill(); ctx.restore(); } }
      ui.text(ctx, `BEST ${Math.max(G.state.progress.stats.bestStreak, w.stats.bestStreak)}`, cx, y + 190, 20, { align: 'center', color: COL.dim, weight: 700 });
    }
    return y;
  };
  card(lr, 'p');
  const ry = card(rr, 'o');
  { const lines = ui.lines(ctx, infoLine(w, m).replace(/ {2}/g, ' '), lr.w - 24, 16, { weight: 700 }); lines.reverse().forEach((l, i) => ui.text(ctx, l, lr.x + lr.w / 2, lr.y + lr.h - 16 - i * 22, 16, { align: 'center', color: COL.dim, weight: 700 })); }
  // buttons stack on the right card (bottom)
  const bh = clamp(rr.h * 0.1, 56, 76), gap = 10;
  let by = rr.y + rr.h - 16;
  const btn = (id, label, ic, kind, dis) => { by -= bh; ui.button(ctx, id, R(rr.x + 14, by, rr.w - 28, bh), label, { kind, icon: ic, size: 24, disabled: dis }); by -= gap; };
  if (m.kind === 'auto') btn('a:exit', 'EXIT', 'close', 'secondary'); else btn('pause', 'PAUSE', 'pause', 'secondary');
  if (!w.machine && m.kind !== 'auto') btn('hint', `COACH ${state.hintsLeft}`, 'bulb', 'chip', state.hintsLeft <= 0 || !!state.hint);
}

// ---- bottom strip ---------------------------------------------------------------------------------------------------------------------
function bottomStrip(ctx, G, w, m) {
  const { L, ui, state } = G, b = L.bottom, U = L.U;
  const auto = m.kind === 'auto';
  const wide = L.mode === 'wide';
  if (auto) {
    const n = 4, gap = 10, h = Math.min(b.h - 24, 72);
    const x0 = wide ? b.x : U.x + 12, tw = wide ? b.w : U.w - 24, bw = (tw - gap * (n - 1)) / n, y = b.y + (b.h - h) / 2 - 4;
    ui.button(ctx, 'a:exit', R(x0, y, bw, h), 'EXIT', { kind: 'secondary', size: 24 });
    ui.button(ctx, 'a:pause', R(x0 + (bw + gap), y, bw, h), state.paused ? 'RESUME' : 'PAUSE', { kind: state.paused ? 'primary' : 'secondary', size: 24, icon: state.paused ? 'play' : 'pause' });
    ui.button(ctx, 'a:dec', R(x0 + 2 * (bw + gap), y, bw, h), 'THINK −', { kind: 'chip', size: 22, disabled: state.prefs.thinkIdx <= 0 });
    ui.button(ctx, 'a:inc', R(x0 + 3 * (bw + gap), y, bw, h), `THINK + ${G.THINK_STEPS[state.prefs.thinkIdx]}s`, { kind: 'chip', size: 22, disabled: state.prefs.thinkIdx >= G.THINK_STEPS.length - 1 });
    return;
  }
  // contextual hint text
  let msg = '';
  if (state.serveHint) msg = 'Slide to position, then flick UP to serve';
  else if (w.phase === 'serve' && w.server === 'o') msg = `${m.opp ? m.opp.name.split(' ')[0] : 'Machine'} serves…`;
  else if (w.phase === 'rally' && w.rally.hitter === 'o' && w.rally.bounce.p <= 1) msg = 'Slide under the ball, flick when the ring closes';
  if (msg) {
    const fs = ui.fs(24), tw = ui.measure(ctx, msg, 24, { weight: 700 }) + 44;
    const cx = wide ? b.x + b.w / 2 : U.x + U.w / 2, bw = Math.min(tw, (wide ? b.w : U.w) - 24), bh = fs * 1.9;
    const by = wide ? G.L.region.y + 46 : b.y + 6;
    ui.panel(ctx, R(cx - bw / 2, by, bw, bh), { fill: 'rgba(8,15,30,0.7)', radius: bh / 2, shadow: false, edge: false });
    ui.text(ctx, msg, cx, by + bh / 2 + fs * 0.33, 24, { align: 'center', weight: 700 });
  }
  if (!wide && !w.machine) {
    ui.button(ctx, 'hint', R(U.x + 14, b.y + b.h - 70 - L.ins.b * 0.3, 196, 58), `COACH ${state.hintsLeft}`, { kind: 'chip', icon: 'bulb', size: 22, disabled: state.hintsLeft <= 0 || !!state.hint });
  }
}

// ---- helpers drawn over the table ----------------------------------------------------------------------------------------------------------
function overlays3d(ctx, G, w, m, cam) {
  const { ui, state } = G, pr = state.prefs;
  const now = w.t + w.acc;
  const incoming = w.phase === 'rally' && w.rally.hitter === 'o' && w.rally.bounce.p <= 1;
  const auto = m.kind === 'auto';
  // spin tag on the ball (also while serving to you in the machine mode)
  if (pr.spin && incoming && !auto) {
    const b = project(cam, state.v3.ball);
    if (b.z > 0) {
      const sp = spinLabel(readSpin(w.ball)); const col = SPIN_COL[sp.id];
      const fs = Math.max(14, 20 * ui.zoom), text = sp.text.toUpperCase();
      ctx.font = `800 ${fs}px ${FONT_D}`;
      const tw = ctx.measureText(text).width + 34, th = fs * 1.5;
      const x = clamp(b.x, tw / 2 + 8, G.L.w - tw / 2 - 8), y = Math.max(G.L.region.y + th, b.y - b.s * 0.12 - 34);
      ctx.save(); ctx.fillStyle = 'rgba(6,12,26,0.78)'; ctx.beginPath(); ctx.roundRect(x - tw / 2, y - th / 2, tw, th, th / 2); ctx.fill();
      ctx.strokeStyle = col; ctx.lineWidth = 2; ctx.stroke(); ctx.fillStyle = col; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(text, x + 9, y + 1);
      ctx.beginPath(); ctx.arc(x - tw / 2 + 15, y, 5, 0, 6.3); ctx.fill(); ctx.restore();
    }
  }
  // timing ring and lane marker
  if (pr.guide && incoming && w.guide && !w.pad.p.swing && !auto && !state.hint) {
    const gd = w.guide, c = project(cam, [gd.x, gd.y, gd.z]);
    if (c.z > 0) {
      const tl = gd.tFlick - now, base = 0.1 * c.s;
      const r = base * (1 + clamp(tl, 0, 0.8) * 2.4), ready = Math.abs(tl) < 0.075;
      ctx.save();
      ctx.lineWidth = ready ? 5 : 3; ctx.strokeStyle = ready ? '#ffe27a' : 'rgba(255,170,70,0.85)';
      ctx.shadowColor = ready ? 'rgba(255,220,100,0.9)' : 'rgba(255,150,40,0.5)'; ctx.shadowBlur = ready ? 18 : 8;
      if (tl > -0.12) { ctx.beginPath(); ctx.arc(c.x, c.y, Math.max(r, base), 0, 6.3); ctx.stroke(); }
      ctx.lineWidth = 2; ctx.strokeStyle = 'rgba(255,255,255,0.5)'; ctx.setLineDash([5, 6]); ctx.beginPath(); ctx.arc(c.x, c.y, base, 0, 6.3); ctx.stroke(); ctx.setLineDash([]);
      if (ready) { ctx.fillStyle = 'rgba(255,226,122,0.22)'; ctx.beginPath(); ctx.arc(c.x, c.y, base, 0, 6.3); ctx.fill(); }
      ctx.restore();
      if (ready) ui.text(ctx, 'FLICK!', c.x, c.y - base - 14, 28, { disp: true, weight: 800, align: 'center', color: '#ffe27a', stroke: 6 });
      // lane marker at the near table edge: where to put the paddle sideways
      const e = project(cam, [gd.x, 0.762, 1.37]);
      ctx.save(); ctx.fillStyle = ready ? '#ffe27a' : 'rgba(255,170,70,0.95)'; ctx.beginPath(); ctx.moveTo(e.x, e.y - 10); ctx.lineTo(e.x - 11, e.y + 12); ctx.lineTo(e.x + 11, e.y + 12); ctx.closePath(); ctx.fill(); ctx.restore();
    }
  }
  // coach / hint target marker on the opponent's half
  const plan = (state.hint && state.hint.plan) || (state.think && state.think.phase === 'reveal' ? state.think.info : null);
  if (plan) {
    const tgt = project(cam, [plan.tx, 0.762, -plan.depth]);
    const pulse = 0.6 + 0.4 * Math.sin(state.t * 8), r = 0.09 * tgt.s * (1 + 0.25 * pulse);
    ctx.save(); ctx.strokeStyle = '#7dffb0'; ctx.fillStyle = 'rgba(125,255,176,0.22)'; ctx.lineWidth = 4; ctx.shadowColor = 'rgba(125,255,176,0.8)'; ctx.shadowBlur = 14;
    ctx.beginPath(); ctx.ellipse(tgt.x, tgt.y, r * 1.5, r * 0.7, 0, 0, 6.3); ctx.fill(); ctx.stroke(); ctx.restore();
    ui.text(ctx, 'AIM HERE', tgt.x, tgt.y - r - 10, 20, { disp: true, weight: 800, align: 'center', color: '#7dffb0', stroke: 5 });
  }
  // pop-ups
  for (const q of state.pops) {
    const p = project(cam, [q.x, q.y, q.z]);
    const k = q.t / q.life, a = 1 - Math.pow(k, 2.2);
    ctx.save(); ctx.globalAlpha = clamp(a * 1.4, 0, 1);
    ui.text(ctx, q.text, p.x, p.y - 30 - k * 60, 32 * q.size, { disp: true, weight: 800, align: 'center', color: q.color, stroke: 7 });
    ctx.restore();
  }
}

// ---- banner ---------------------------------------------------------------------------------------------------------------------------------
function banner(ctx, G) {
  const { state, ui, L } = G, b = state.banner;
  if (!b) return;
  const k = b.t, a = clamp(Math.min(k / 0.12, (b.hold - k) / 0.3), 0, 1), s = 1 + Math.max(0, 0.25 - k * 2);
  const reg = L.region, cx = reg.x + reg.w / 2, cy = reg.y + reg.h * 0.22;
  ctx.save(); ctx.globalAlpha = a; ctx.translate(cx, cy); ctx.scale(s, s);
  const size = Math.min(b.big ? 120 : 80, reg.w / (b.text.length * 0.42 + 1));
  ui.text(ctx, b.text, 0, 0, size, { disp: true, weight: 800, align: 'center', color: b.color, stroke: size * 0.12, fixed: true });
  if (b.sub) ui.text(ctx, b.sub, 0, size * 0.5, 24, { align: 'center', weight: 700, color: '#fff', stroke: 6 });
  ctx.restore();
}

// ---- overlays -----------------------------------------------------------------------------------------------------------------------------------
function intro(ctx, G, m) {
  const { state, ui, L } = G, it = state.intro, w = state.w;
  const k = it.t / it.dur, a = clamp(Math.min(it.t / 0.3, (it.dur - it.t) / 0.35), 0, 1);
  const opp = m.opp;
  ctx.save(); ctx.globalAlpha = a;
  ctx.fillStyle = 'rgba(3,7,16,0.62)'; ctx.fillRect(0, 0, L.w, L.h);
  const U = L.U, simple = !opp;
  const cw = Math.min(U.w - 32, 700), x = U.x + (U.w - cw) / 2;
  const title = m.kind === 'practice' ? 'RALLY CHALLENGE' : m.kind === 'lesson' ? 'LEARN THE BASICS' : m.kind === 'auto' ? 'WATCH & LEARN' : null;
  if (simple) {
    ui.text(ctx, title, U.x + U.w / 2, L.region.y + L.region.h * 0.4, 70, { disp: true, weight: 800, align: 'center', stroke: 9, fixed: true });
    ui.text(ctx, m.kind === 'practice' ? 'Return the ball machine. Three lives.' : m.kind === 'lesson' ? 'A short lesson with the ball machine.' : 'The coach plays and explains each shot.', U.x + U.w / 2, L.region.y + L.region.h * 0.4 + 44, 26, { align: 'center', color: COL.dim, stroke: 6 });
  } else {
    const ch = 250, y = L.region.y + Math.max(10, (L.region.h - ch) / 2 - 20);
    ui.panel(ctx, R(x, y, cw, ch), { fill: 'rgba(8,15,30,0.9)', radius: 28 });
    const half = cw / 2;
    avatar(ctx, x + half * 0.5, y + 84, 52, 'YOU', 190);
    ui.text(ctx, 'YOU', x + half * 0.5, y + 178, 30, { disp: true, weight: 800, align: 'center' });
    avatar(ctx, x + half * 1.5, y + 84, 52, initials(opp.name), opp.hue);
    ui.text(ctx, opp.name.toUpperCase(), x + half * 1.5, y + 178, 26, { disp: true, weight: 800, align: 'center' });
    ui.text(ctx, `${STYLES[opp.style].label} · Level ${opp.level}`, x + half * 1.5, y + 208, 20, { align: 'center', color: COL.orange2, weight: 700 });
    ui.text(ctx, 'VS', x + half, y + 100, 56, { disp: true, weight: 800, align: 'center', color: COL.orange, fixed: true });
    flagChip(ctx, x + half * 1.5 + 62, y + 28, 50, 28, opp.cc, opp.hue);
    const info = `Best of ${m.bestOf}  ·  first to ${m.target}`;
    ui.text(ctx, info, x + half * 0.5, y + 208, 20, { align: 'center', color: COL.dim, weight: 700 });
    const sy = y + ch + 14;
    const sc = opp.weak ? `Scouting: ${opp.name.split(' ')[0]} ${SCOUT[opp.weak]}.` : `Scouting: ${opp.name.split(' ')[0]} has no clear weakness.`;
    const ph = ui.paraHeight(ctx, sc, cw - 40, 24) + 24;
    ui.panel(ctx, R(x, sy, cw, ph), { fill: 'rgba(8,15,30,0.82)', radius: 18, shadow: false });
    ui.para(ctx, sc, x + 20, sy + 12, cw - 40, 24, { color: COL.cyan, weight: 600 });
    if (m.cupId) ui.text(ctx, ['QUARTER-FINAL', 'SEMI-FINAL', 'FINAL'][m.round], U.x + U.w / 2, y + 30, 28, { disp: true, weight: 800, align: 'center', color: COL.gold, stroke: 7 });
  }
  ctx.restore();
  ui.hit('skipintro', R(0, 0, L.w, L.h));
  ctx.save(); ctx.fillStyle = 'rgba(255,255,255,0.35)'; ctx.fillRect(U.x + U.w * 0.25, U.y + U.h - 26 - L.ins.b, U.w * 0.5 * k, 4); ctx.restore();
}

function pauseMenu(ctx, G, auto) {
  const { state, ui, L } = G;
  if (auto) {
    ui.panel(ctx, R(L.U.x + L.U.w / 2 - 90, L.region.y + 8, 180, 50), { fill: 'rgba(8,15,30,0.85)', radius: 25, shadow: false });
    ui.text(ctx, 'PAUSED', L.U.x + L.U.w / 2, L.region.y + 42, 26, { disp: true, weight: 800, align: 'center' });
    return;
  }
  if (state.confirm) return;
  ctx.fillStyle = 'rgba(3,7,16,0.75)'; ctx.fillRect(0, 0, L.w, L.h);
  const w = Math.min(L.U.w - 40, 560), bh = Math.max(76, ui.fs(30) * 1.9), n = 5;
  const h = 40 + ui.fs(54) + 3 * (bh + 12) + 20;
  const x = L.U.x + (L.U.w - w) / 2, y = Math.max(L.U.y + 8, L.U.y + (L.U.h - h) / 2);
  ui.panel(ctx, R(x, y, w, h), { fill: '#0d1a36', radius: 28 });
  ui.text(ctx, 'PAUSED', x + w / 2, y + 30 + ui.fs(54) * 0.8, 54, { disp: true, weight: 800, align: 'center' });
  let by = y + 40 + ui.fs(54);
  ui.button(ctx, 'resume', R(x + 24, by, w - 48, bh), 'RESUME', { kind: 'primary', icon: 'play', size: 36 }); by += bh + 12; ui.primary = 'resume';
  const hw = (w - 48 - 12) / 2;
  ui.button(ctx, 'p:sound', R(x + 24, by, hw, bh), state.prefs.sound ? 'SOUND ON' : 'SOUND OFF', { kind: 'chip', icon: state.prefs.sound ? 'sound' : 'mute', size: 24 });
  ui.button(ctx, 'p:guide', R(x + 36 + hw, by, hw, bh), state.prefs.guide ? 'GUIDE ON' : 'GUIDE OFF', { kind: 'chip', icon: 'target', size: 24 }); by += bh + 12;
  ui.button(ctx, 'leave', R(x + 24, by, w - 48, bh), 'LEAVE MATCH', { kind: 'danger', size: 30 });
}

function coachCaption(ctx, G, w) {
  const { state, ui, L } = G, th = state.think, info = th.info;
  const reg = L.region, cw = Math.min(reg.w - 20, L.mode === 'wide' ? 520 : 660), x = reg.x + (reg.w - cw) / 2;
  const think = th.phase === 'think';
  const lines = think ? [info.incoming, 'What would you do? Think about it…'] : [info.incoming, `Plan: ${info.plan}`, info.why];
  let h = 30 + ui.fs(24) + 8;
  for (const l of lines) h += ui.paraHeight(ctx, l, cw - 40, 22) + 4;
  h += 26;
  const y = L.mode === 'wide' ? reg.y + reg.h - h - 6 : reg.y + 8;
  ui.panel(ctx, R(x, y, cw, h), { fill: 'rgba(8,15,30,0.9)', radius: 22 });
  ui.text(ctx, think ? 'THINK' : 'REVEAL', x + 20, y + 14 + ui.fs(24), 24, { disp: true, weight: 800, color: think ? COL.cyan : COL.orange2 });
  const left = Math.max(0, th.dur - th.t);
  ui.text(ctx, `${Math.ceil(left)}s`, x + cw - 20, y + 14 + ui.fs(24), 24, { disp: true, weight: 800, align: 'right', color: COL.dim });
  let yy = y + 20 + ui.fs(24) + 8;
  lines.forEach((l, i) => { yy += ui.para(ctx, l, x + 20, yy, cw - 40, 22, { color: i === 0 ? COL.ink : i === 1 && !think ? COL.gold : COL.dim, weight: i === 1 ? 700 : 500 }) + 4; });
  ctx.save(); ctx.fillStyle = 'rgba(255,255,255,0.12)'; ctx.fillRect(x + 20, y + h - 14, cw - 40, 4); ctx.fillStyle = think ? COL.cyan : COL.orange; ctx.fillRect(x + 20, y + h - 14, (cw - 40) * (1 - left / th.dur), 4); ctx.restore();
}

function hintCaption(ctx, G, w, cam) {
  const { state, ui, L } = G, h = state.hint;
  const reg = L.region, cw = Math.min(reg.w - 20, 640), x = reg.x + (reg.w - cw) / 2;
  const ph = ui.paraHeight(ctx, h.text, cw - 40, 23) + 56;
  const y = L.mode === 'wide' ? reg.y + reg.h - ph - 6 : reg.y + 8;
  ui.panel(ctx, R(x, y, cw, ph), { fill: 'rgba(8,15,30,0.92)', radius: 22 });
  icon(ctx, 'bulb', x + 34, y + 28, 30, COL.gold);
  ui.text(ctx, 'COACH', x + 64, y + 14 + ui.fs(22), 22, { disp: true, weight: 800, color: COL.gold });
  ui.para(ctx, h.text, x + 20, y + 38, cw - 40, 23, { color: COL.ink, weight: 500 });
}

function tutorial(ctx, G) {
  const { state, ui, L } = G, t = state.tut, step = G.TUT[t.step];
  const reg = L.region, cw = Math.min(reg.w - 20, 680), x = reg.x + (reg.w - cw) / 2;
  const text = t.done ? 'You are ready. Go and play a match!' : step.say;
  const ph = ui.paraHeight(ctx, text, cw - 40, 24) + 64;
  const y = L.mode === 'wide' ? reg.y + 6 : L.top.y + 54;
  ui.panel(ctx, R(x, y, cw, ph), { fill: 'rgba(8,15,30,0.9)', radius: 22 });
  for (let i = 0; i < G.TUT.length; i++) { ctx.save(); ctx.fillStyle = i < t.step || t.done ? COL.green : i === t.step ? COL.orange : 'rgba(255,255,255,0.2)'; ctx.beginPath(); ctx.arc(x + 28 + i * 24, y + 24, 7, 0, 6.3); ctx.fill(); ctx.restore(); }
  if (!t.done) ui.button(ctx, 'skip', R(x + cw - 120, y + 8, 106, 40), 'SKIP', { kind: 'chip', size: 18 });
  ui.para(ctx, text, x + 20, y + 44, cw - 40, 24, { color: COL.ink, weight: 600 });
}
