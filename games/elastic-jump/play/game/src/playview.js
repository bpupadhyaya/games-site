// The play screen: scene, HUD, cue track, pads, count-in, the Watch and Learn routine strip, popups and the pause menu.
import { PAL, DISPLAY, drawPoseIcon, drawSneaker, drawParticles, clamp, TAU } from './art.js';
import { txt, button, panel, rrect, chip, icon, lacquer, mixHex } from './ui.js';
import { drawPlayground } from './stage.js';
import { menuRects } from './layout.js';
import { POSES, TRIES, COUNT_IN, THINK, comboMult } from './moves.js';

const JCOL = { perfect: '#ffd23f', good: '#8ef0b8', ok: '#9fc4ff', miss: '#ff5a5f' };

function renderTrack(ctx, st, r, T) {
  panel(ctx, T, { fill: 'rgba(12,20,52,0.82)', rad: 20 });
  ctx.save(); rrect(ctx, T, 20); ctx.clip();
  const beat = r.rt.beat, step = r.rt.step, nowX = T.x + T.w * 0.2, ahead = clamp(step * 4, 2.0, 3.4);
  const pps = (T.x + T.w - 16 - nowX) / ahead, cy = T.y + T.h * 0.5;
  const size = Math.min(T.h * 0.66, 84, Math.max(36, pps * step * 0.92));
  const t = r.phase === 'play' ? r.t : 0;
  // beat ticks and the count-in numbers
  const b0 = Math.floor((t - (nowX - T.x) / pps) / beat) - 1, b1 = Math.ceil((t + ahead) / beat) + 1;
  for (let b = Math.max(0, b0); b <= b1; b++) {
    const x = nowX + (b * beat - t) * pps;
    if (x < T.x - 4 || x > T.x + T.w + 4) continue;
    ctx.fillStyle = b < COUNT_IN ? 'rgba(255,210,63,0.55)' : 'rgba(255,248,236,0.22)';
    ctx.fillRect(x - 1.5, T.y + T.h - 20, 3, 12);
    if (b < COUNT_IN) txt(ctx, String(COUNT_IN - b), x, T.y + T.h - 30, 18, '#ffd23f', { align: 'center', weight: 800 });
  }
  // the NOW line
  ctx.fillStyle = 'rgba(255,255,255,0.14)'; rrect(ctx, { x: nowX - size * 0.62, y: T.y + 8, w: size * 1.24, h: T.h - 16 }, 14); ctx.fill();
  ctx.fillStyle = 'rgba(255,248,236,0.85)'; ctx.fillRect(nowX - 1.5, T.y + 8, 3, T.h - 16);
  txt(ctx, 'NOW', nowX, T.y + 16, 13, PAL.gold, { align: 'center', weight: 800 });
  // tokens
  const nextI = r.moves.findIndex((m) => !m.j);
  r.moves.forEach((m, i) => {
    const x = nowX + (m.t - t) * pps;
    if (x < T.x - size || x > T.x + T.w + size) return;
    let a = 1; if (m.j) a = clamp(1 - (t - m.t) / 0.9, 0, 1) * 0.9;
    if (m.j && x < nowX - size * 3) return;
    ctx.save(); ctx.globalAlpha = a;
    const near = Math.abs(x - nowX) < size * 0.7 && !m.j;
    const sc = near ? 1.14 : 1;
    drawPoseIcon(ctx, m.pose, x, cy, size * sc);
    if (m.j) { ctx.lineWidth = 5; ctx.strokeStyle = JCOL[m.j]; rrect(ctx, { x: x - size / 2 - 3, y: cy - size / 2 - 3, w: size + 6, h: size + 6 }, size * 0.22); ctx.stroke(); }
    const hinted = i < r.hintTo && !m.j;
    if (hinted) { ctx.lineWidth = 5; ctx.strokeStyle = '#fff'; rrect(ctx, { x: x - size / 2 - 4, y: cy - size / 2 - 4, w: size + 8, h: size + 8 }, size * 0.24); ctx.stroke(); txt(ctx, POSES[m.pose].label, x, cy + size / 2 + 14, 15, '#fff', { align: 'center', weight: 800 }); }
    ctx.restore();
  });
  void nextI;
  ctx.restore();
}

function renderPads(ctx, st, r, P) {
  const next = r.moves.find((m) => !m.j), hintOn = r.hintTo > r.mi && next && r.phase === 'play' && r.mode !== 'auto';
  const live = r.mode !== 'auto' && r.phase === 'play';
  POSES.forEach((p, i) => {
    const R = P.pads[i], f = r.pads[i], rad = Math.min(26, R.h * 0.2);
    ctx.save();
    const dep = Math.max(6, Math.min(12, R.h * 0.07));
    const body = lacquer(ctx, { x: R.x, y: R.y, w: R.w, h: R.h - dep }, rad, [mixHex(p.col, '#ffffff', 0.34), p.col, mixHex(p.col, '#000000', 0.12), p.dark], { depth: dep, pressed: f > 0.35 });
    if (f > 0) { ctx.fillStyle = `rgba(255,255,255,${0.35 * f})`; rrect(ctx, body, rad); ctx.fill(); }
    const s = Math.min(R.w * 0.62, R.h * 0.5);
    drawPoseIcon(ctx, i, R.x + R.w / 2, body.y + R.h * 0.4, s, { bg: false, foot: '#fff', line: 'rgba(255,255,255,0.9)' });
    txt(ctx, p.label, R.x + R.w / 2, body.y + R.h - dep - Math.max(16, R.h * 0.15), Math.min(30, R.w * 0.2, R.h * 0.2), '#fff', { align: 'center', weight: 800, maxW: R.w - 10 });
    if (hintOn && next.pose === i) { ctx.lineWidth = 6; ctx.strokeStyle = `rgba(255,255,255,${0.55 + 0.45 * Math.sin(st.t * 10)})`; rrect(ctx, { x: R.x - 3, y: R.y - 3, w: R.w + 6, h: R.h - dep + 6 }, rad + 3); ctx.stroke(); }
    if (!live) { ctx.fillStyle = 'rgba(12,20,52,0.35)'; rrect(ctx, body, rad); ctx.fill(); }
    ctx.restore();
  });
}

function renderHud(ctx, st, r, L) {
  const P = L.play, wide = L.mode === 'wide', S = L.S;
  // title strip
  const lx = S.x + 14 + L.backPad;
  const label = `${r.li + 1}. ${r.level.name}`;
  txt(ctx, label, lx, P.strip.y + P.strip.h / 2, 30, PAL.text, { weight: 700, maxW: S.w - L.backPad - 250, stroke: 6 });
  ctx.font = `700 30px ${DISPLAY}`;
  const tw = Math.min(ctx.measureText(label).width, S.w - L.backPad - 250);
  if (r.mode !== 'play') chip(ctx, lx + tw + 14, P.strip.y + P.strip.h / 2, r.mode === 'auto' ? 'WATCH' : 'PRACTICE', 18, { fill: r.mode === 'auto' ? 'rgba(38,194,129,0.9)' : 'rgba(255,154,46,0.9)', color: '#14204a' });
  // trips, score, combo
  const H = P.hud;
  if (wide) panel(ctx, H, { fill: 'rgba(12,20,52,0.55)', rad: 18 });
  const cy = H.y + H.h / 2, tripsLeft = TRIES - r.trips;
  for (let i = 0; i < TRIES; i++) drawSneaker(ctx, H.x + 34 + i * 54, cy, 46, r.mode === 'play' ? i < tripsLeft : true);
  if (r.mode !== 'play') txt(ctx, r.mode === 'auto' ? 'no trips' : `${r.trips} trips`, H.x + 34 + TRIES * 54 + 6, cy + 2, 18, PAL.dim, { weight: 600 });
  const cx = wide ? H.x + H.w * 0.55 : H.x + H.w * 0.48;
  txt(ctx, String(r.score), cx, cy - 4, 44, PAL.gold, { align: 'center', weight: 700, stroke: 7 });
  const m = comboMult(r.combo);
  if (r.combo >= 2) chip(ctx, cx + (wide ? 150 : 128), cy, `${r.combo} x${m}`, 22, { fill: 'rgba(255,79,139,0.9)', color: '#fff', align: 'center' });
  // buttons: hint and pause (portrait: in the HUD row; landscape: in the pad column)
  const hintIcon = r.mode === 'auto' ? (r.phase === 'think' ? 'play' : 'bulb') : 'bulb';
  const hintKind = r.mode === 'auto' ? (r.phase === 'think' ? 'gold' : 'disabled') : r.hintTo > r.mi ? 'on' : 'quiet';
  if (wide) {
    button(ctx, P.hint, r.mode === 'auto' ? (r.phase === 'think' ? 'Skip' : 'Hint') : 'Hint', { icon: hintIcon, kind: hintKind, size: 26 });
    button(ctx, P.pause, 'Pause', { icon: 'pause', kind: 'quiet', size: 26 });
  } else {
    button(ctx, P.hint, '', { icon: hintIcon, kind: hintKind });
    button(ctx, P.pause, '', { icon: 'pause', kind: 'quiet' });
  }
}

// Watch and Learn: the whole routine laid out as a strip of tokens (THINK), lit one by one (REVEAL).
function renderRoutine(ctx, st, r, L, g) {
  const P = L.play, stg = P.stage;
  const n = r.moves.length, W = Math.min(stg.w - 24, 860), cols = Math.min(n, L.mode === 'wide' ? 12 : 8), rows = Math.ceil(n / cols);
  const cell = Math.min((W - 24) / cols, 92), pw = cell * cols + 24, ph = rows * (cell + 8) + 120;
  const x = stg.x + (stg.w - pw) / 2, y = stg.y + Math.max(8, (stg.h - ph) * 0.18);
  panel(ctx, { x, y, w: pw, h: ph }, { fill: 'rgba(12,20,52,0.88)', rad: 22 });
  const left = r.phase === 'think' ? Math.max(0, st.prefs.thinkSec - r.phaseT) : Math.max(0, THINK.reveal - r.phaseT);
  txt(ctx, r.phase === 'think' ? 'THINK: read the routine' : 'REVEAL: here it comes', x + pw / 2, y + 36, 30, PAL.gold, { align: 'center', weight: 700, maxW: pw - 30 });
  txt(ctx, `${r.level.name}  -  ${n} steps  -  ${Math.ceil(left)} s`, x + pw / 2, y + 74, 22, PAL.dim, { align: 'center', weight: 600, maxW: pw - 30 });
  const shown = r.phase === 'reveal' ? Math.floor((r.phaseT / THINK.reveal) * n * 1.05) : n;
  r.moves.forEach((m, i) => {
    const cx = x + 12 + cell * (i % cols) + cell / 2, cy = y + 104 + Math.floor(i / cols) * (cell + 8) + cell / 2;
    ctx.save(); ctx.globalAlpha = r.phase === 'reveal' ? (i < shown ? 1 : 0.28) : 1;
    drawPoseIcon(ctx, m.pose, cx, cy, cell * 0.84);
    if (i % 4 === 0) txt(ctx, String(i / 4 + 1), cx - cell * 0.34, cy - cell * 0.34, 13, '#14204a', { align: 'center', weight: 800 });
    ctx.restore();
  });
  void g;
}

function renderPopups(ctx, r, head) {
  for (const p of r.pops) {
    const a = clamp(1 - p.age / 0.85, 0, 1), y = head.hcy - head.headR * 2.2 - p.age * 60;
    ctx.save(); ctx.globalAlpha = Math.min(1, a * 1.6);
    txt(ctx, p.text, head.hcx, y, 36 * p.size * (1 + 0.25 * Math.max(0, 1 - p.age * 6)), p.col, { align: 'center', weight: 700, stroke: 8 });
    ctx.restore();
  }
}

export function renderPlay(ctx, st, L, view, meta, pauseItems) {
  const r = st.run, P = L.play; meta.previewBadge = P.badge;
  const beatPos = r.phase === 'play' ? r.t / r.rt.beat : st.t * 1.6;
  const V = { hgt: r.level.hgt, J: r.jumper, wob: r.wob, wobPh: r.wobPh, beat: beatPos - Math.floor(beatPos) };
  ctx.save();
  if (r.shake > 0 && !st.prefs.calm) ctx.translate(Math.sin(st.t * 90) * 5 * r.shake, Math.cos(st.t * 70) * 3 * r.shake);
  const gl = !!(view && view.gl3d && view.overlay && view.overlay.head);
  const head = gl ? view.overlay.head : drawPlayground(ctx, L.w, L.h, P.stage, V, st.t).head;
  const g = null;
  drawParticles(ctx, r.parts);
  renderPopups(ctx, r, head);
  ctx.restore();
  if (r.flash > 0.01 && !st.prefs.calm) { ctx.fillStyle = `rgba(255,248,200,${r.flash * 0.18})`; ctx.fillRect(0, 0, L.w, L.h); }
  if (L.mode === 'wide') panel(ctx, P.col, { fill: 'rgba(12,20,52,0.55)', rad: 22 });
  renderHud(ctx, st, r, L);
  renderTrack(ctx, st, r, P.track);
  renderPads(ctx, st, r, P);
  // count-in
  if (r.phase === 'play' && r.t < r.rt.T0 + 0.45) {
    const b = Math.floor(r.t / r.rt.beat), within = (r.t / r.rt.beat) - b;
    const word = r.t >= r.rt.T0 ? 'JUMP!' : String(COUNT_IN - b);
    const sc = 1 + 0.35 * Math.max(0, 1 - within * 3.5);
    ctx.save(); ctx.globalAlpha = r.t >= r.rt.T0 ? clamp(1 - (r.t - r.rt.T0) / 0.45, 0, 1) : 1;
    txt(ctx, word, P.stage.x + P.stage.w / 2, P.stage.y + P.stage.h * 0.3, Math.min(150, P.stage.h * 0.2) * sc, '#fff', { align: 'center', weight: 700, stroke: 14, strokeColor: '#ff4f8b' });
    ctx.restore();
  }
  if (r.banner) {
    const a = clamp(Math.min(r.banner.t / 0.15, (1.4 - r.banner.t) / 0.3), 0, 1);
    ctx.save(); ctx.globalAlpha = a;
    txt(ctx, r.banner.text, P.stage.x + P.stage.w / 2, P.stage.y + P.stage.h * 0.075, Math.min(60, P.stage.w * 0.1), PAL.gold, { align: 'center', weight: 700, stroke: 10 });
    ctx.restore();
  }
  if (r.mode === 'auto' && (r.phase === 'think' || r.phase === 'reveal')) renderRoutine(ctx, st, r, L, g);
  if (r.paused) {
    ctx.fillStyle = 'rgba(8,12,34,0.62)'; ctx.fillRect(0, 0, L.w, L.h);
    const items = pauseItems(r), M = menuRects(L, items.length);
    panel(ctx, M.panel, { fill: 'rgba(14,22,58,0.96)' });
    txt(ctx, 'Paused', M.panel.x + M.panel.w / 2, M.panel.y + 64, 50, PAL.gold, { align: 'center', weight: 700, stroke: 8 });
    const names = { resume: 'Resume', restart: 'Restart', quit: 'Leave', replay: 'Watch again', next: 'Next height' };
    items.forEach((it, i) => button(ctx, M.btns[i], names[it], { kind: it === 'resume' ? 'primary' : 'quiet', size: 32, icon: it === 'resume' ? 'play' : it === 'restart' || it === 'replay' ? 'restart' : undefined }));
  }
}
void TAU; void icon;
