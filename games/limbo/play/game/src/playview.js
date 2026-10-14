// Drawing for the play scene: the beach, the bar, the dancer, the HUD, the two gauges, the coach panel and the pause menu.
import { PAL, UI, DISPLAY, LOOKS, drawScene, drawLights, drawCrowd, drawPoleBack, drawPoleFront, drawBar, barGeom, drawDancer, drawDancerShadow, drawParticles, clamp, clamp01, easeOut, rgba } from './art.js';
import { TUNE, pose, neededLean, roundLabel } from './engine.js';
import { txt, button, panel, chip, wrap, rrect } from './ui.js';
import { drawLean, drawBalance } from './gauges.js';
import { menuRects } from './layout.js';
import { drawBadgeStack } from './brand.js';

export const MODE_NAME = { solo: 'Solo', party: 'Party', practice: 'Practice', auto: 'Watch and Learn' };

// Where the dancer's feet are on screen and how big, for a given layout.
export const sceneOf = (L) => ({ w: L.w, h: L.h, hor: L.play.hor, gy: L.play.gy, U: L.play.U, bx: L.play.bx, floor: L.play.panel.y - 4 });

export function drawWorld(ctx, st, sc, lightsY, o) {
  const pl = o.pl, att = pl.att, calm = st.prefs.calm;
  const U = sc.U, fx = sc.bx + att.x * U, fy = sc.gy;
  drawScene(ctx, sc, st.t, { calm });
  drawLights(ctx, sc.w, lightsY, st.t, calm);
  drawCrowd(ctx, sc, st.t, o.beat, calm);
  const bh = pl.barShown;
  drawPoleBack(ctx, sc, bh);
  // the dancer
  const look = LOOKS[pl.look % LOOKS.length];
  const ph = att.phase === 'ready' ? o.beat * Math.PI : att.stepPh;
  let ang = 0, sit = 0, cheer = 0;
  if (att.phase === 'fall') {
    ang = att.fallDir * Math.min(1.45, Math.pow(att.sinceHit * 2.6, 1.7));
    sit = clamp01((att.sinceHit - 0.35) * 2);
  } else if (att.phase === 'clear') cheer = clamp01(att.sinceHit * 4);
  else if (att.phase === 'touch') ang = -0.1 * Math.sin(att.sinceHit * 9) * Math.max(0, 1 - att.sinceHit);
  const p = pose(att.lean, att.phase === 'fall' ? att.wobble * 0.5 : att.wobble, ph);
  if (o.ghost !== undefined) {
    ctx.save(); ctx.globalAlpha = 0.34;
    const g3 = globalThis.__figure3d, gp = pose(o.ghost, 0, 0.6);     // the ghost is the same 3D person (same look: no re-tint) at low alpha
    if (!(g3 && g3.draw && !g3.off && g3.draw(ctx, gp, fx, fy, U, { look, t: st.t }))) drawDancer(ctx, gp, fx, fy, U, { look: LOOKS[2] });
    ctx.restore();
  }
  const sway = att.phase === 'ready' && !calm ? Math.sin(o.beat * Math.PI) * 0.015 : 0;
  const f3 = globalThis.__figure3d;
  let done = false;
  if (f3 && f3.draw && !f3.off) {
    drawDancerShadow(ctx, p, fx, fy, U, ang + sway);
    done = f3.draw(ctx, p, fx, fy, U, { look, ang: ang + sway, sit, cheer, t: st.t });
  }
  if (!done) drawDancer(ctx, p, fx, fy, U, { look, ang: ang + sway, sit, cheer });
  // the bar (knocked off after a touch)
  const fallT = pl.barFall;
  drawBar(ctx, sc, bh, { fall: fallT, dir: att.fallDir || 1, glow: pl.barGlow });
  drawPoleFront(ctx, sc, bh);
  drawParticles(ctx, pl.parts);
}

function pops(ctx, pl) {
  for (const q of pl.pops) {
    const a = 1 - q.age / q.life, rise = easeOut(clamp01(q.age / q.life)) * 70;
    ctx.save(); ctx.globalAlpha = clamp01(a * 1.6);
    const s = 1 + 0.25 * Math.max(0, 1 - q.age * 7);
    ctx.translate(q.x, q.y - rise); ctx.scale(s, s);
    txt(ctx, q.text, 0, 0, q.size, q.col, { align: 'center', font: DISPLAY, weight: 400, stroke: q.size * 0.2, maxW: 520 });
    ctx.restore();
  }
}

export function renderPlay(ctx, st, L, view, meta, pauseItems) {
  const P = L.play, pl = st.pl, S = L.S, att = pl.att;
  meta.previewBadge = { x: S.x + 14 + (L.backPad || 0), y: S.y + P.hud.h + 40, align: 'left' };
  const beat = pl.beatT / (60 / TUNE.tempo);
  ctx.save();
  if (pl.shake > 0 && !st.prefs.calm) ctx.translate((Math.sin(st.t * 83) * 6) * pl.shake, (Math.cos(st.t * 71) * 5) * pl.shake);
  const need = neededLean(pl.barShown, 0.02);
  const hintOn = !!pl.hint || (pl.ai && (pl.ai.phase === 'reveal' || pl.ai.phase === 'think') && pl.ai.plan);
  const gl = !!(view && view.gl3d);
  if (gl) drawParticles(ctx, pl.parts);            // the 3D presenter paints the beach, dancer and bar behind this layer
  else if (view && view.gl3dPending) { const g = ctx.createLinearGradient(0, 0, 0, L.h); g.addColorStop(0, '#1b0d36'); g.addColorStop(0.5, '#a23a68'); g.addColorStop(1, '#2a1030'); ctx.fillStyle = g; ctx.fillRect(0, 0, L.w, L.h); }
  else drawWorld(ctx, st, sceneOf(L), P.lightsY, { pl, beat, ghost: hintOn ? (pl.ai && pl.ai.plan ? pl.ai.plan.target : need + 0.03) : undefined });
  ctx.restore();

  // bar height tag beside the front pole
  const G = barGeom(sceneOf(L), pl.barShown), ov = gl && view.overlay && view.overlay.barTag;
  const tagX = ov ? clamp(ov.x, S.x + 70, S.x + S.w - 70) : clamp(G.front.x - sceneOf(L).U * 0.06, S.x + 70, S.x + S.w - 70);
  const tagY = ov ? ov.y - sceneOf(L).U * 0.14 : G.front.top - sceneOf(L).U * 0.2;
  chip(ctx, tagX, tagY, `BAR ${Math.round(pl.barShown * 100)}%`, 22, { align: 'center', fill: 'rgba(20,8,40,0.78)', stroke: 'rgba(255,216,115,0.6)', color: PAL.goldHi });
  pops(ctx, pl);

  // ---- HUD -------------------------------------------------------------------------------------------------------------------
  const solo = pl.mode === 'solo' || pl.mode === 'auto';
  {
    // score plaque (teak, brass edge) on the left, tries plaque beside the buttons on the right
    const nTr = pl.mode === 'party' ? pl.players.length : TUNE.tries;
    const trW = pl.mode === 'practice' ? 0 : nTr * (pl.mode === 'party' ? 40 : 38) + 78;
    const px0 = S.x + 6 + (L.backPad || 0), maxW = P.tries.x - trW - 14 - px0;
    const sp = { x: px0, y: S.y + 6, w: clamp(maxW, 190, L.mode === 'wide' ? 400 : 340), h: P.hud.h - 14 };
    panel(ctx, sp, { rad: 20, fill: 'rgba(30,14,20,0.8)' });
    txt(ctx, solo ? String(pl.score) : pl.mode === 'party' ? pl.players[pl.cur].name : 'PRACTICE', P.score.x + 6, P.score.y + 34, solo ? 56 : 38, PAL.goldHi, { font: DISPLAY, weight: 400, stroke: 8, strokeColor: 'rgba(40,10,6,0.9)', maxW: (L.mode === 'wide' ? 170 : sp.w - 34) });
    txt(ctx, `ROUND ${pl.round + 1}  ·  ${Math.round(barOf(pl) * 100)}%`, P.round.x + 6, P.round.y + 2, 24, '#ffd873', { weight: 800, stroke: 5, strokeColor: 'rgba(30,8,6,0.8)', maxW: sp.x + sp.w - P.round.x - 18 });
    if (trW) {
      const tp = { x: P.tries.x - trW + 6, y: S.y + 10, w: trW, h: Math.max(64, P.pause.h) };
      panel(ctx, tp, { rad: 18, fill: 'rgba(30,14,20,0.8)' });
      if (pl.mode === 'solo') {
        for (let i = 0; i < TUNE.tries; i++) {
          const x = tp.x + tp.w - 22 - (TUNE.tries - 1 - i) * 38, y = tp.y + tp.h / 2, on = i < pl.tries;
          const g = ctx.createRadialGradient(x - 4, y - 5, 1, x, y, 15);
          if (on) { g.addColorStop(0, '#fffbe0'); g.addColorStop(0.35, '#ffd873'); g.addColorStop(1, '#b8761c'); } else { g.addColorStop(0, '#5a4a4a'); g.addColorStop(1, '#241418'); }
          ctx.fillStyle = 'rgba(0,0,0,0.35)'; ctx.beginPath(); ctx.ellipse(x, y + 11, 11, 4, 0, 0, Math.PI * 2); ctx.fill();
          ctx.beginPath(); ctx.arc(x, y, 14, 0, Math.PI * 2); ctx.fillStyle = g; ctx.fill();
          ctx.lineWidth = 2; ctx.strokeStyle = on ? '#fff0b0' : 'rgba(255,255,255,0.18)'; ctx.stroke();
        }
        txt(ctx, 'TRIES', tp.x + 14, tp.y + tp.h / 2, 17, PAL.dim, { weight: 800 });
      } else if (pl.mode === 'party') {
        const n = pl.players.length, step = 40;
        pl.players.forEach((q, i) => {
          const x = tp.x + tp.w - 24 - (n - 1 - i) * step, y = tp.y + tp.h / 2, look = LOOKS[q.look % LOOKS.length];
          ctx.globalAlpha = q.out ? 0.35 : 1;
          const g = ctx.createRadialGradient(x - 4, y - 5, 1, x, y, 16); g.addColorStop(0, '#ffffff'); g.addColorStop(0.3, look.top); g.addColorStop(1, 'rgba(20,8,16,0.9)');
          ctx.beginPath(); ctx.arc(x, y, 15, 0, Math.PI * 2); ctx.fillStyle = g; ctx.fill();
          ctx.lineWidth = i === pl.cur ? 4 : 2; ctx.strokeStyle = i === pl.cur ? '#fff2c2' : 'rgba(255,255,255,0.4)'; ctx.stroke();
          ctx.globalAlpha = 1;
          if (q.out) { ctx.strokeStyle = '#ff6b6b'; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(x - 9, y - 9); ctx.lineTo(x + 9, y + 9); ctx.moveTo(x + 9, y - 9); ctx.lineTo(x - 9, y + 9); ctx.stroke(); }
        });
      }
    }
  }
  button(ctx, P.pause, '', { icon: pl.paused ? 'play' : 'pause', kind: 'quiet', size: 30, noShadow: true });
  if (pl.mode !== 'auto') {
    const cool = pl.thinkCool > 0 && pl.mode !== 'practice';
    button(ctx, P.think, '', { icon: 'think', kind: pl.thinkT > 0 ? 'on' : cool ? 'disabled' : 'quiet', size: 30, noShadow: true });
    if (cool) txt(ctx, String(Math.ceil(pl.thinkCool)), P.think.x + P.think.w / 2, P.think.y + P.think.h + 14, 18, PAL.dim, { align: 'center', weight: 700 });
  }

  // ---- gauges ----------------------------------------------------------------------------------------------------------------
  panel(ctx, P.panel, { fill: 'rgba(14,6,34,0.74)', rad: 26 });
  const compact = L.mode === 'wide';
  txt(ctx, 'LEAN', P.leanLabel.x, P.leanLabel.y, 22, PAL.gold, { weight: 800 });
  txt(ctx, `${Math.round(att.lean * 100)}%`, P.leanLabel.x + 86, P.leanLabel.y, 22, PAL.text, { weight: 800 });
  txt(ctx, 'BALANCE', P.balLabel.x, P.balLabel.y, 22, PAL.gold, { weight: 800 });
  drawLean(ctx, P.leanG, att.lean, { target: att.phase === 'run' ? att.target : undefined, need, hint: hintOn });
  drawBalance(ctx, P.balG, att.wobble, { steer: att.phase === 'run' ? att.steerIn : 0 });
  if (!compact || P.panel.h > 90) {
    const msg = att.phase === 'ready' && pl.mode !== 'auto' ? 'Press and hold to start  ·  drag DOWN to lean  ·  SIDEWAYS to balance' : pl.mode === 'auto' ? 'Watch how the lean and the balance work together' : 'Lean late, only as deep as the bar needs';
    txt(ctx, msg, P.hintLine.x, P.hintLine.y, 20, PAL.dim, { align: 'center', weight: 600, maxW: P.panel.w - 24 });
  }

  // ---- coach (Watch and Learn) -------------------------------------------------------------------------------------------------
  if (pl.mode === 'auto' && pl.ai) {
    const ai = pl.ai, C = P.coach;
    panel(ctx, C, { fill: 'rgba(14,6,34,0.84)', stroke: 'rgba(255,216,115,0.45)', rad: 20 });
    const phaseName = ai.phase === 'think' ? 'THINKING' : ai.phase === 'reveal' ? 'REVEAL' : ai.phase === 'act' || att.phase === 'run' ? 'ACTING' : 'WATCH';
    chip(ctx, C.x + 18, C.y + 28, phaseName, 20, { fill: '#ffd873', color: '#2a1030' });
    const regionW = C.w - 40 - (ai.phase === 'think' || ai.phase === 'reveal' ? P.skip.w + 10 : 0);
    const fs = L.mode === 'wide' ? (regionW < 230 ? 18 : 21) : 24, lh = fs * 1.25;
    ctx.font = `600 ${fs}px ${UI}`;
    const text = ai.say || '';
    wrap(ctx, text, regionW).slice(0, 5).forEach((ln, i) => txt(ctx, ln, C.x + 20, C.y + 62 + i * lh, fs, PAL.text, { weight: 600 }));
    if (ai.phase === 'think' || ai.phase === 'reveal') {
      const lim = ai.phase === 'think' ? st.prefs.thinkSec : 2, f = clamp01(ai.t / lim);
      ctx.fillStyle = 'rgba(255,255,255,0.14)'; rrect(ctx, { x: C.x + 18, y: C.y + C.h - 16, w: C.w - 36, h: 8 }, 4); ctx.fill();
      ctx.fillStyle = '#ffd873'; rrect(ctx, { x: C.x + 18, y: C.y + C.h - 16, w: Math.max(8, (C.w - 36) * f), h: 8 }, 4); ctx.fill();
      button(ctx, P.skip, 'Skip', { icon: 'skip', kind: 'quiet', size: 26, noShadow: true });
    }
  }

  // ---- ready prompt and banners ------------------------------------------------------------------------------------------------
  if (pl.banner) {
    const b = pl.banner, a = clamp01(Math.min(b.t / 0.18, (b.hold - b.t) / 0.35));
    ctx.save(); ctx.globalAlpha = a;
    const y = P.banner.y + (1 - easeOut(clamp01(b.t / 0.3))) * 26;
    txt(ctx, b.text, P.banner.x, y, Math.min(70, L.w / 9), PAL.goldHi, { align: 'center', font: DISPLAY, weight: 400, stroke: 11, strokeColor: 'rgba(40,6,40,0.9)', maxW: L.S.w - 40 });
    if (b.sub) txt(ctx, b.sub, P.banner.x, y + Math.min(62, L.w / 10), 28, PAL.text, { align: 'center', weight: 700, stroke: 6, maxW: L.S.w - 40 });
    ctx.restore();
  }
  if (att.phase === 'ready' && pl.stage === 'ready' && pl.mode !== 'auto' && !pl.paused) {
    const pulse = 0.65 + 0.35 * Math.sin(st.t * 4);
    ctx.save(); ctx.globalAlpha = pulse;
    const rdy = gl && view.overlay && view.overlay.ready;
    const rx = clamp(rdy ? rdy.x : P.bx + att.x * P.U + P.U * 0.1, S.x + 120, S.x + S.w - 120);
    chip(ctx, rx, rdy ? rdy.y - P.U * 0.1 : P.gy - P.U * 1.16, 'HOLD TO GO', 28, { align: 'center', fill: 'rgba(226,72,61,0.95)', color: '#fff' });
    ctx.restore();
  }

  // ---- pause menu --------------------------------------------------------------------------------------------------------------
  if (pl.paused) {
    ctx.fillStyle = 'rgba(8,2,20,0.62)'; ctx.fillRect(0, 0, L.w, L.h);
    const items = pauseItems(), M = menuRects(L, items.length);
    panel(ctx, M.panel, { fill: 'rgba(18,8,40,0.95)', rad: 28 });
    txt(ctx, 'PAUSED', M.panel.x + M.panel.w / 2, M.panel.y + 58, 42, PAL.gold, { align: 'center', font: DISPLAY, weight: 400, stroke: 7 });
    const label = { resume: 'Resume', restart: 'Restart', rules: 'Rules', quit: 'Quit to menu' };
    items.forEach((it, i) => button(ctx, M.btns[i], label[it], { kind: it === 'resume' ? 'primary' : 'ghost', size: 32 }));
  }
}

function barOf(pl) { return pl.barShown; }
