// The play screen: village green, people, ball, guides, scoreboard, buttons, hint sheet and banners. It only READS the game state.
import { FONT, NUM, C, panel, roundPath, paintButton, wrapLines } from './ui.js';
import { FR, playLayout, TEXT_SCALES } from './layout.js';
import {
  geom, P, groundRing, drawGround, drawScenery, person, drawBat, drawBall, drawFx, fielderLook, batterLook, serverLook, PALETTES,
} from './art.js';
import { K, LEVELS, tossAt, landing } from './sim.js';
import { sideNames, unlockedCount } from './menus.js';
import { GL } from './glbridge.js';

const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
const lerp = (a, b, t) => a + (b - a) * t;

export function isHumanSide(m) { return m.cfg.mode === 'solo' || m.cfg.mode === 'two' || (m.cfg.mode === 'ai' && m.side === 0); }
export const palFor = (state) => PALETTES[Math.min(state.settings.kit, unlockedCount(state.record.career) - 1, PALETTES.length - 1)];
export const fieldGeom = () => geom(playLayout().field);

// ---- scoreboard ------------------------------------------------------------------------------------------------------------------------
function pips(ctx, x, y, r, outs, total) {
  for (let i = 0; i < total; i++) {
    const cx = x + i * (r * 2.7), on = i < outs;
    ctx.beginPath(); ctx.arc(cx, y, r + 2, 0, 7); ctx.fillStyle = '#c9a24e'; ctx.fill();            // brass setting
    const g = ctx.createRadialGradient(cx - r * 0.35, y - r * 0.4, 1, cx, y, r);
    if (on) { g.addColorStop(0, '#ffb3a0'); g.addColorStop(0.5, '#e5402f'); g.addColorStop(1, '#7a130a'); } else { g.addColorStop(0, '#5b6d5f'); g.addColorStop(1, '#16221a'); }
    ctx.beginPath(); ctx.arc(cx, y, r, 0, 7); ctx.fillStyle = g; ctx.fill();
  }
}
function drawHud(ctx, state, L) {
  const m = state.m, names = sideNames(m.cfg), hs = Math.min(1.35, TEXT_SCALES[state.settings.textIdx]);
  const two = m.nSides > 1, hb = L.hud, turn = Math.min(m.i + 1, m.nTurns);
  ctx.save();
  panel(ctx, hb.x, hb.y, hb.w, hb.h, { r: 18 });
  ctx.textBaseline = 'middle';
  const who = two ? names[m.side] : (m.cfg.mode === 'watch' ? names[0] : 'You');
  const live = m.ph === 'play' && m.T ? m.T.pts : 0;   // points on the board include the run in progress
  const tot = m.totals.map((v, i) => v + (i === m.side ? live : 0));
  const pts = tot[m.side];
  if (!L.land) {
    ctx.textAlign = 'left'; ctx.fillStyle = '#d9f2b8'; ctx.font = `800 ${Math.round(19 * hs)}px ${NUM}`;
    ctx.fillText(`BATTER ${turn} / ${m.nTurns}`, hb.x + 18, hb.y + hb.h * 0.27);
    ctx.fillStyle = '#fff'; ctx.font = `800 ${Math.round(27 * Math.min(hs, 1.15))}px ${NUM}`;
    ctx.fillText(who, hb.x + 18, hb.y + hb.h * 0.68);
    const cx = hb.x + hb.w * 0.5;
    ctx.textAlign = 'center'; ctx.fillStyle = '#d9f2b8'; ctx.font = `800 ${Math.round(18 * hs)}px ${NUM}`; ctx.fillText('OUTS', cx, hb.y + hb.h * 0.27);
    pips(ctx, cx - 2.7 * 11 + 0.0, hb.y + hb.h * 0.68, 11, m.outs, K.OUTS);
    ctx.textAlign = 'right'; ctx.fillStyle = '#d9f2b8'; ctx.font = `800 ${Math.round(18 * hs)}px ${NUM}`; ctx.fillText(two ? `${names[0]} : ${names[1]}` : 'POINTS', hb.x + hb.w - 18, hb.y + hb.h * 0.27);
    ctx.fillStyle = '#ffe08a'; ctx.font = `900 ${Math.round(42 * Math.min(hs, 1.15))}px ${NUM}`;
    ctx.fillText(two ? `${tot[0]} : ${tot[1]}` : String(pts), hb.x + hb.w - 18, hb.y + hb.h * 0.68);
  } else {
    ctx.textAlign = 'left'; ctx.fillStyle = '#d9f2b8'; ctx.font = `800 ${Math.round(19 * hs)}px ${NUM}`;
    ctx.fillText(`BATTER ${turn} / ${m.nTurns}`, hb.x + 16, hb.y + 26);
    ctx.fillStyle = '#fff'; ctx.font = `800 ${Math.round(26 * Math.min(hs, 1.15))}px ${NUM}`; ctx.fillText(who, hb.x + 16, hb.y + 62);
    ctx.fillStyle = '#d9f2b8'; ctx.font = `800 ${Math.round(18 * hs)}px ${NUM}`; ctx.fillText('OUTS', hb.x + 16, hb.y + 100);
    pips(ctx, hb.x + 84, hb.y + 100, 11, m.outs, K.OUTS);
    ctx.fillStyle = '#ffe08a'; ctx.font = `900 ${Math.round(44 * Math.min(hs, 1.15))}px ${NUM}`;
    ctx.fillText(two ? `${tot[0]} : ${tot[1]}` : `${pts} pts`, hb.x + 16, hb.y + 150);
  }
  ctx.restore();
}

function button(ctx, r, label, o = {}) {
  const { dy, text } = paintButton(ctx, r, o);
  ctx.save(); ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillStyle = text; ctx.shadowColor = o.primary ? 'rgba(255,240,180,0.6)' : 'rgba(0,0,0,0.65)'; ctx.shadowOffsetY = o.primary ? 1 : 2;
  let px = o.size ?? Math.min(34, Math.round(r.h * 0.36));
  ctx.font = `800 ${px}px ${FONT}`;
  while (ctx.measureText(label).width > r.w - 18 && px > 12) { px--; ctx.font = `800 ${px}px ${FONT}`; }
  ctx.fillText(label, r.x + r.w / 2, r.y + r.h / 2 + dy - (o.sub ? px * 0.35 : 0));
  if (o.sub) { ctx.font = `600 ${Math.max(11, Math.round(px * 0.5))}px ${FONT}`; ctx.globalAlpha = 0.85; ctx.fillText(o.sub, r.x + r.w / 2, r.y + r.h / 2 + dy + px * 0.55); }
  ctx.restore();
}

function drawSheet(ctx, state, L, text, title) {
  const s = L.sheet; if (!s) return;
  const hs = Math.min(1.5, TEXT_SCALES[state.settings.textIdx]);
  panel(ctx, s.x, s.y, s.w, s.h, { r: 20, fill: 'rgba(12,32,18,0.95)', stroke: 'rgba(190,235,170,0.55)' });
  ctx.save(); ctx.textBaseline = 'alphabetic'; ctx.textAlign = 'left';
  ctx.fillStyle = '#ffe08a'; ctx.font = `800 ${Math.round(22 * hs)}px ${FONT}`; ctx.fillText(title, s.x + 18, s.y + 14 + 22 * hs);
  const fs = Math.round(23 * hs); ctx.font = `500 ${fs}px ${FONT}`; ctx.fillStyle = '#f4fff0';
  const lines = wrapLines(ctx, text, s.w - 36), room = Math.floor((s.h - 50) / (fs * 1.3));
  lines.slice(0, Math.max(2, room)).forEach((l, i) => ctx.fillText(l, s.x + 18, s.y + 14 + 22 * hs + 14 + fs * (i + 1) * 1.3));
  ctx.restore();
}

// ---- the world ------------------------------------------------------------------------------------------------------------------------------
const swingAngle = (T, t) => {
  if (T.swing) { const k = clamp((T.t - T.swing.t) / 0.24, 0, 1); return k >= 1 ? 2.3 : lerp(1.35, -1.5, k * k * (3 - 2 * k)); }
  return 0.45 + Math.sin(t * 2.6) * 0.05;
};

export function renderPlay(ctx, state) {
  const m = state.m, T = m.T, L = playLayout(), g = geom(L.field), W = FR.w, H = FR.h, t = state.t;
  const human = isHumanSide(m), pal = palFor(state);
  const rival = m.cfg.mode === 'ai' && m.side === 1;
  if (GL.on) {
    // the 3D layer draws the green, the village, the people and the ball from this request; guides, particles and the HUD stay 2D
    GL.views.push({ kind: 'play', g, state, pal });
  } else {
    drawGround(ctx, g, W, H, t);
    drawScenery(ctx, g, t, state.cheer > 0 ? 1 : 0);
  }
  const guides = state.settings.guide && human;
  // ---- ground guides -------------------------------------------------------------------------------------------------
  if (T.ph === 'serve') {
    const o = P(g, 0, K.HOME_Y + 1.2);
    // aim fan: a dashed arrow lying on the grass (quads on the ground, projected)
    if (human || m.ph === 'reveal' || m.cfg.mode === 'watch' || rival) {
      const a = (T.aim * Math.PI) / 180, sx = Math.sin(a), cy0 = Math.cos(a), len = 13.5, y0 = K.HOME_Y + 1.2;
      const at = (d, w) => P(g, sx * d - cy0 * w, y0 + cy0 * d + sx * w);
      ctx.save();
      const dash = 0.95, gap = 0.7, pulse = 0.5 + 0.5 * Math.sin(t * 5);
      for (let d = 0.6 + ((t * 2.4) % (dash + gap)); d < len - 1.6; d += dash + gap) {
        const d2 = Math.min(len - 1.6, d + dash), w0 = 0.34 - d * 0.008, w1 = 0.34 - d2 * 0.008;
        const q = [at(d, -w0), at(d, w0), at(d2, w1), at(d2, -w1)];
        ctx.fillStyle = `rgba(255,236,150,${0.96 - d * 0.03})`;
        ctx.beginPath(); ctx.moveTo(q[0].x, q[0].y); q.slice(1).forEach((p) => ctx.lineTo(p.x, p.y)); ctx.closePath(); ctx.fill();
      }
      const tip = [at(len, 0), at(len - 1.9, -0.95), at(len - 1.9, 0.95)];
      ctx.fillStyle = `rgba(255,240,170,${0.85 + 0.15 * pulse})`; ctx.strokeStyle = 'rgba(80,50,0,0.5)'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(tip[0].x, tip[0].y); ctx.lineTo(tip[1].x, tip[1].y); ctx.lineTo(tip[2].x, tip[2].y); ctx.closePath(); ctx.fill(); ctx.stroke();
      ctx.restore();
    }
    if (guides || !human) {
      // the closing ring around the bat zone
      const c = P(g, 0, K.HOME_Y + 0.15, 1.0), left = T.tossT - T.t, ks = c.k || g.s;
      if (left > -0.12) {
        const r = (0.55 + Math.max(0, left) * 3.2) * ks, inWin = Math.abs(left) <= K.WIN;
        ctx.save(); ctx.lineWidth = Math.max(3, ks * 0.14); ctx.strokeStyle = inWin ? '#7dffb0' : 'rgba(255,230,140,0.9)';
        ctx.beginPath(); ctx.arc(c.x, c.y, r, 0, 7); ctx.stroke();
        ctx.strokeStyle = 'rgba(255,255,255,0.4)'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(c.x, c.y, 0.55 * ks, 0, 7); ctx.stroke();
        ctx.restore();
      }
    }
  } else if (guides && T.ph === 'play') {
    const lp = T.ball.st === 'air' || T.ball.st === 'roll' ? landing(T) : null;
    if (lp && T.runner.st !== 'out') {
      const p = P(g, lp.x, lp.y);
      ctx.save(); ctx.strokeStyle = `rgba(255,240,170,${0.55 + 0.35 * Math.sin(t * 9)})`; ctx.lineWidth = 3;
      groundRing(ctx, g, lp.x, lp.y, 0.9); ctx.stroke(); ctx.restore();
    }
    if (T.ball.st === 'thrown') {
      const b = T.ball, a = P(g, b.x, b.y, b.z), e = P(g, b.x + b.vx * 1.4, b.y + b.vy * 1.4, 0.6);
      ctx.save(); ctx.strokeStyle = 'rgba(255,120,100,0.8)'; ctx.lineWidth = 3; ctx.setLineDash([8, 8]); ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(e.x, e.y); ctx.stroke(); ctx.restore();
    }
  }
  // runner marker
  const r = T.runner;
  if (human && T.ph === 'play' && (r.st === 'toFar' || r.st === 'back' || r.st === 'ready' || r.st === 'atFar')) {
    const p = P(g, r.x, r.y);
    ctx.save();
    const ready = r.cd <= 0 && (r.st === 'toFar' || r.st === 'back');
    ctx.strokeStyle = ready ? '#7dffb0' : 'rgba(255,255,255,0.5)'; ctx.lineWidth = 3;
    groundRing(ctx, g, r.x, r.y, 0.95); ctx.stroke();
    if (r.cd > 0) { ctx.strokeStyle = '#ffd36a'; groundRing(ctx, g, r.x, r.y, 0.95, Math.PI / 2, Math.PI / 2 - 6.283 * (1 - r.cd / K.DODGE_CD)); ctx.stroke(); }
    ctx.restore();
  }
  // ---- people, far to near ------------------------------------------------------------------------------------------------
  const items = [];
  const L2 = LEVELS[T.lv];
  for (const f of T.fielders) {
    items.push({ y: f.y, draw: () => {
      const p = P(g, f.x, f.y), look = fielderLook(f.i);
      const away = f.moving && Math.cos(f.face) > 0.35;
      const winding = f.st === 'wind';
      const arm = winding ? 'throw' : (T.ball.st === 'air' && Math.hypot(T.ball.x - f.x, T.ball.y - f.y) < 5 && T.ball.z > 0.4 ? 'catch' : f.moving ? 'run' : 'idle');
      const armT = winding ? clamp(1 - f.wind / L2.windup, 0, 1) : 0;
      person(ctx, p.x, p.y, g.u * 0.95, { ...look, toward: away ? false : true, moving: !!f.moving, run: f.ph * 1.7, arm, armT, lean: clamp(Math.sin(f.face) * 0.5, -0.5, 0.5) });
    } });
  }
  items.push({ y: K.THROW_Y, draw: () => {
    const p = P(g, 0, K.THROW_Y);
    const k = T.ph === 'serve' ? clamp(T.t / 0.45, 0, 1) : 1;
    person(ctx, p.x, p.y, g.u * 0.95, { ...serverLook(), toward: true, arm: T.ph === 'serve' ? 'throw' : 'catch', armT: k });
  } });
  items.push({ y: r.y, draw: () => {
    const p = P(g, r.x, r.y), look = batterLook(pal);
    const moving = r.st === 'toFar' || r.st === 'back', backWard = r.st === 'back';
    const out = r.st === 'out';
    const lean = r.dT > 0 ? clamp(r.vx / K.DODGE_V, -1, 1) * 0.9 : 0;
    const arm = out ? 'point' : (r.st === 'safe' || (r.st === 'atFar' && T.pts > 0 && T.ph !== 'play')) ? 'cheer' : moving ? 'run' : T.ph === 'serve' || T.swing ? 'bat' : 'idle';
    const o = { ...look, toward: backWard || r.st === 'atFar' ? true : false, moving, run: T.t * 14, arm, lean, armT: 0.5 + 0.5 * Math.sin(t * 10), alpha: out ? 0.9 : 1 };
    const px = p.x + (r.dT > 0 ? 0 : 0);
    const info = person(ctx, px, p.y, g.u * 1.05, o);
    if (arm === 'bat' || arm === 'idle' || arm === 'run') {
      const hx = px + info.hands.ex, hy = p.y + info.hands.ey;
      const ang = arm === 'bat' ? swingAngle(T, t) : arm === 'run' ? 2.5 : 2.3;
      drawBat(ctx, hx, hy, g.u * (arm === 'bat' ? 1.0 : 0.7), ang);
    }
  } });
  if (!GL.on) {
    items.sort((a, b) => b.y - a.y).forEach((it) => it.draw());
    // ball
    if (T.ball.st !== 'held' || T.ph !== 'serve') drawBall(ctx, g, T.ball, t);
  }
  drawFx(ctx, state.fx);
  // floating texts
  for (const f of state.floats) {
    const k = f.t / f.life, y = f.y - 90 * k * (f.big ? 0.7 : 1);
    ctx.save(); ctx.globalAlpha = k < 0.15 ? k / 0.15 : clamp(1.4 - k, 0, 1); ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.font = `900 ${Math.round(f.size * (1 + (f.big ? 0.15 * Math.sin(k * 3) : 0)))}px ${NUM}`; ctx.lineJoin = 'round'; ctx.lineWidth = 7; ctx.strokeStyle = 'rgba(20,40,10,0.85)';
    ctx.strokeText(f.text, f.x, y); ctx.fillStyle = f.col; ctx.fillText(f.text, f.x, y); ctx.restore();
  }
  // ---- HUD and controls ---------------------------------------------------------------------------------------------------------------
  drawHud(ctx, state, L);
  drawControls(ctx, state, L, T, human);
  if (state.hint) drawSheet(ctx, state, L, state.hint.text, state.hint.kind === 'coach' ? 'Coach' : 'Think');
  else if (m.ph === 'think' || m.ph === 'reveal') drawSheet(ctx, state, L, m.plan ? m.plan.text : '', m.ph === 'think' ? `${sideNames(m.cfg)[m.side] || 'Batter'} is thinking` : 'The plan');
  if (m.banner) {
    const b = m.banner, k = clamp(b.t / b.life, 0, 1), a = k < 0.12 ? k / 0.12 : k > 0.78 ? (1 - k) / 0.22 : 1;
    const hs = Math.min(1.25, TEXT_SCALES[state.settings.textIdx]);
    ctx.save(); ctx.globalAlpha = clamp(a, 0, 1); ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    const fs = Math.round(Math.min(L.field.w * 0.12, 70) * Math.min(1.1, hs));
    ctx.font = `900 italic ${fs}px ${FONT}`; ctx.lineJoin = 'round'; ctx.lineWidth = fs * 0.2; ctx.strokeStyle = 'rgba(20,50,10,0.9)';
    const cx = L.field.x + L.field.w / 2, cy = L.field.y + L.field.h * 0.42;
    ctx.strokeText(b.text, cx, cy); ctx.fillStyle = b.col; ctx.fillText(b.text, cx, cy);
    if (b.sub) { ctx.font = `800 ${Math.round(fs * 0.4)}px ${NUM}`; ctx.lineWidth = fs * 0.09; ctx.strokeText(b.sub, cx, cy + fs * 0.75); ctx.fillStyle = '#fff'; ctx.fillText(b.sub, cx, cy + fs * 0.75); }
    ctx.restore();
  }
  if (state.paused && !state.pauseMenu) {
    ctx.save(); ctx.fillStyle = 'rgba(8,20,10,0.38)'; ctx.fillRect(L.field.x, L.field.y, L.field.w, L.field.h);
    ctx.fillStyle = '#fff'; ctx.font = `900 ${Math.round(Math.min(64, L.field.w * 0.1))}px ${NUM}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText('PAUSED', L.field.x + L.field.w / 2, L.field.y + L.field.h * 0.4); ctx.restore();
  }
}

function drawControls(ctx, state, L, T, human) {
  const m = state.m, r = T.runner, watch = m.cfg.mode === 'watch';
  let label = 'Watching', sub = null, primary = false, disabled = true;
  if (human && m.ph === 'play') {
    if (T.ph === 'serve') { label = 'SWING'; sub = 'drag to aim, release to swing'; primary = true; disabled = false; }
    else if (T.ph === 'play' && r.st === 'ready') { label = 'RUN!'; sub = 'or stay home'; primary = true; disabled = false; }
    else if (T.ph === 'play' && r.st === 'atFar') { label = 'COME BACK'; sub = 'or stay on the line'; primary = true; disabled = false; }
    else if (T.ph === 'play' && (r.st === 'toFar' || r.st === 'back')) { label = 'RUNNING'; sub = 'tap the field or Dodge'; }
    else label = '...';
  } else if (!human) { label = watch ? 'Watch & Learn' : 'Rival batting'; }
  button(ctx, L.action, label, { primary, disabled, sub, size: Math.min(36, Math.round(L.action.h * 0.34)) });
  const canD = human && m.ph === 'play' && T.ph === 'play' && (r.st === 'toFar' || r.st === 'back') && r.cd <= 0;
  const dl = (R, lab) => {
    button(ctx, R, lab, { disabled: !canD, active: canD, dark: !canD, size: Math.min(26, Math.round(R.h * 0.3)) });
    if (human && T.ph === 'play' && r.cd > 0 && (r.st === 'toFar' || r.st === 'back')) {
      ctx.save(); ctx.fillStyle = 'rgba(255,211,106,0.35)'; roundPath(ctx, R.x + 4, R.y + R.h - 10, (R.w - 8) * (1 - r.cd / K.DODGE_CD), 6, 3); ctx.fill(); ctx.restore();
    }
  };
  dl(L.dodgeL, L.land ? '< Dodge' : '< DODGE'); dl(L.dodgeR, L.land ? 'Dodge >' : 'DODGE >');
  button(ctx, L.think, watch ? (state.paused ? 'Resume' : 'Pause') : 'Think', { dark: true, size: 26 });
  button(ctx, L.pause, watch ? 'Leave' : 'Pause', { dark: true, size: 26 });
}

// The four rectangles of the field the game uses to turn a screen point into a ground point.
export { unP } from './art.js';
